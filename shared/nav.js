// Collision, line-of-sight and A* navigation on a coarse grid.
import { dist } from './rng.js';

const CELL = 0.75; // fine enough to thread doorways and squeeze past furniture

// Two grids: the ground (map.nav) and the upper floor of two-storey buildings (map.nav1), so bots
// can find their way upstairs too (the staircase itself is walked directly — see BotBase.goTo).
export function buildNav(map) { // (reference version kept as buildNavSlow for the equivalence test)
  const n = Math.ceil(map.size / CELL);
  const H = map.size / 2;
  // Rasterise the obstacles into the grid (each obstacle only visits the few cells it covers) instead of testing
  // every cell against every obstacle: same result as blocked() below, ~50x faster (the server builds this at the
  // start of every match, the browser again when the match loads).
  const make = (level) => {
    const grid = new Uint8Array(n * n);
    const cx = (gx) => -H + (gx + 0.5) * CELL;
    const range = (lo, hi) => [Math.max(0, Math.floor((lo + H) / CELL - 0.5) - 1), Math.min(n - 1, Math.ceil((hi + H) / CELL - 0.5) + 1)];
    const paint = (x0, x1, z0, z1, test) => {
      const [ga, gb] = range(x0, x1), [ha, hb] = range(z0, z1);
      for (let gz = ha; gz <= hb; gz++) for (let gx = ga; gx <= gb; gx++) if (test(cx(gx), cx(gz))) grid[gz * n + gx] = 1;
    };
    if (level === 1) { // upper floor: only the inside of two-storey buildings is walkable
      grid.fill(1);
      for (const b of map.buildings) {
        if (b.floors < 2) continue;
        const [ga, gb] = range(b.x - b.w / 2, b.x + b.w / 2), [ha, hb] = range(b.z - b.d / 2, b.z + b.d / 2);
        for (let gz = ha; gz <= hb; gz++) for (let gx = ga; gx <= gb; gx++) {
          const x = cx(gx), z = cx(gz);
          if (Math.abs(x - b.x) < b.w / 2 - 0.3 && Math.abs(z - b.z) < b.d / 2 - 0.3) grid[gz * n + gx] = 0;
        }
      }
    }
    const r = 0.42;
    for (const b of map.rects) {
      if (!onLevel(b, level)) continue;
      paint(b.x - b.hw - r, b.x + b.hw + r, b.z - b.hd - r, b.z + b.hd + r, (x, z) => Math.abs(x - b.x) < b.hw + r && Math.abs(z - b.z) < b.hd + r);
    }
    if (level === 0) {
      for (const c of map.circles) paint(c.x - c.r - r, c.x + c.r + r, c.z - c.r - r, c.z + c.r + r, (x, z) => dist(x, z, c.x, c.z) < c.r + r);
      for (const l of map.logs || []) { const R = Math.hypot(l.hl, l.hw) + r; paint(l.x - R, l.x + R, l.z - R, l.z + R, (x, z) => logDist(l, x, z) < r); }
    }
    for (const b of map.buildings || []) { // keep ground paths off the staircases
      const s = b.stair; if (!s) continue;
      paint(Math.min(s.xb, s.xt) - r, Math.max(s.xb, s.xt) + r, s.z0 - r, s.z1 + r,
        (x, z) => x > Math.min(s.xb, s.xt) - r && x < Math.max(s.xb, s.xt) + r && z > s.z0 - r && z < s.z1 + r);
    }
    return { n, grid, cell: CELL, H, level };
  };  map.nav = make(0); map.nav1 = make(1);
}
const navOf = (map, level) => (level ? map.nav1 : map.nav);

// Which floor a rect blocks on: lv:1 = upper floor only, both = every floor, otherwise ground only.
export const onLevel = (b, level) => (b.both ? true : (b.lv | 0) === level);

function blocked(map, x, z, r, level = 0) {
  if (level === 1 && !map.buildings.some((b) => b.floors >= 2 && Math.abs(x - b.x) < b.w / 2 - 0.3 && Math.abs(z - b.z) < b.d / 2 - 0.3)) return true;
  for (const b of map.rects) {
    if (!onLevel(b, level)) continue;
    if (Math.abs(x - b.x) < b.hw + r && Math.abs(z - b.z) < b.hd + r) return true;
  }
  if (level === 0) {
    for (const c of map.circles) if (dist(x, z, c.x, c.z) < c.r + r) return true;
    for (const l of map.logs || []) if (logDist(l, x, z) < r) return true;
  }
  for (const b of map.buildings || []) { // keep ground paths off the staircases
    const s = b.stair;
    if (s && x > Math.min(s.xb, s.xt) - r && x < Math.max(s.xb, s.xt) + r && z > s.z0 - r && z < s.z1 + r) return true;
  }
  return false;
}

// Push a circle at (x,z) radius r out of all obstacles on the given floor. Returns {x,z}.
// clearH: height the body is currently clearing (jumping) — obstacles lower than that are passed over.
// map.dyn holds runtime blockers (dropped pallets).
// Fallen logs are oriented boxes { x, z, rot, hl (half length along (sin rot, cos rot)), hw, h }.
export function logDist(l, x, z) {
  const dx = x - l.x, dz = z - l.z, c = Math.cos(l.rot), s = Math.sin(l.rot);
  const u = dx * s + dz * c, v = dx * c - dz * s;
  const ou = Math.abs(u) - l.hl, ov = Math.abs(v) - l.hw;
  return Math.hypot(Math.max(ou, 0), Math.max(ov, 0)) + Math.min(Math.max(ou, ov), 0);
}
export const logAt = (map, x, z, r) => (map.logs || []).find((l) => logDist(l, x, z) < r);

// ignoreLogs: the monster clambers over logs (slowly) instead of being blocked by them.
export function collide(map, x, z, r = 0.4, clearH = 0, level = 0, ignoreLogs = false) {
  const logPush = (l) => {
    if (clearH > 0 && l.h <= clearH) return;
    const c = Math.cos(l.rot), s = Math.sin(l.rot), dx = x - l.x, dz = z - l.z;
    const u = dx * s + dz * c, v = dx * c - dz * s;
    const ou = l.hl + r - Math.abs(u), ov = l.hw + r - Math.abs(v);
    if (ou <= 0 || ov <= 0) return;
    let nu = u, nv = v;
    if (ov < ou) nv += Math.sign(v || 1) * ov; else nu += Math.sign(u || 1) * ou;
    x = l.x + nu * s + nv * c; z = l.z + nu * c - nv * s;
  };
  const rectPush = (b) => {
    if (clearH > 0 && b.h <= clearH) return;
    const dx = x - b.x, dz = z - b.z;
    const ox = b.hw + r - Math.abs(dx), oz = b.hd + r - Math.abs(dz);
    if (ox > 0 && oz > 0) { if (ox < oz) x += Math.sign(dx || 1) * ox; else z += Math.sign(dz || 1) * oz; }
  };
  for (let iter = 0; iter < 2; iter++) {
    for (const b of map.rects) if (onLevel(b, level)) rectPush(b);
    if (level === 0) {
      for (const b of map.dyn || []) rectPush(b);
      if (!ignoreLogs) for (const l of map.logs || []) logPush(l);
      for (const c of map.circles) {
        if (clearH > 0 && c.h <= clearH) continue;
        const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
        if (d < m && d > 1e-4) { x = c.x + (dx / d) * m; z = c.z + (dz / d) * m; }
      }
    }
  }
  return { x, z };
}

// 2D segment test against tall obstacles (low ones like fences/tombs don't block sight).
export function lineOfSight(map, ax, az, bx, bz, level = 0) {
  const d = dist(ax, az, bx, bz);
  const steps = Math.ceil(d / 0.6);
  for (let i = 1; i < steps; i++) {
    const t = i / steps, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    for (const b of map.rects) {
      if (!b.low && onLevel(b, level) && Math.abs(x - b.x) <= b.hw + 0.02 && Math.abs(z - b.z) <= b.hd + 0.02) return false; // (+2cm: no peeking through the seams between wall bays)
    }
    if (level) continue;
    for (const c of map.circles) {
      if (c.type !== 'tree' && c.type !== 'rock' && c.type !== 'pillar') continue;
      if (dist(x, z, c.x, c.z) < c.r * 0.9) return false;
    }
  }
  return true;
}

export function inGrass(map, x, z) {
  return map.grass.some((g) => dist(x, z, g.x, g.z) < g.r);
}

export function randomWalkable(map, rng) {
  for (let i = 0; i < 200; i++) {
    const x = rng.range(-map.size / 2 + 5, map.size / 2 - 5), z = rng.range(-map.size / 2 + 5, map.size / 2 - 5);
    if (!cellBlocked(map, x, z)) return { x, z };
  }
  return { x: 0, z: 20 };
}

function toCell(map, x, z, nav = map.nav) {
  const { n, cell, H } = nav;
  return [Math.max(0, Math.min(n - 1, Math.floor((x + H) / cell))), Math.max(0, Math.min(n - 1, Math.floor((z + H) / cell)))];
}
function cellBlocked(map, x, z, nav = map.nav) {
  const [gx, gz] = toCell(map, x, z, nav);
  return nav.grid[gz * nav.n + gx] === 1;
}
export const walkableCell = (map, x, z, level = 0) => !cellBlocked(map, x, z, navOf(map, level));

// A* returning an array of {x,z} waypoints (simplified with line-of-sight smoothing).
export function findPath(map, ax, az, bx, bz, maxNodes = 14000, level = 0) {
  const nav = navOf(map, level);
  const { n, grid, cell, H } = nav;
  let [sx, sz] = toCell(map, ax, az, nav);
  let [tx, tz] = toCell(map, bx, bz, nav);
  const nearestFree = (gx, gz) => {
    if (!grid[gz * n + gx]) return [gx, gz];
    for (let r = 1; r < 10; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const x = gx + dx, z = gz + dz;
      if (x >= 0 && z >= 0 && x < n && z < n && !grid[z * n + x]) return [x, z];
    }
    return [gx, gz];
  };
  [sx, sz] = nearestFree(sx, sz); [tx, tz] = nearestFree(tx, tz);
  const start = sz * n + sx, goal = tz * n + tx;
  const g = new Map([[start, 0]]), came = new Map();
  // binary min-heap of [f, cell]
  const open = [[0, start]];
  const push = (e) => { open.push(e); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p][0] <= e[0]) break; open[i] = open[p]; i = p; } open[i] = e; };
  const pop = () => {
    const top = open[0], last = open.pop();
    if (open.length) {
      let i = 0; const L = open.length;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i, mv = last[0];
        if (l < L && open[l][0] < mv) { m = l; mv = open[l][0]; }
        if (r < L && open[r][0] < mv) { m = r; mv = open[r][0]; }
        if (m === i) break;
        open[i] = open[m]; i = m;
      }
      open[i] = last;
    }
    return top;
  };
  const closed = new Set();
  let found = false, count = 0;
  while (open.length && count++ < maxNodes) {
    const [, cur] = pop();
    if (cur === goal) { found = true; break; }
    if (closed.has(cur)) continue;
    closed.add(cur);
    const cx = cur % n, cz = (cur / n) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
      const ni = nz * n + nx;
      if (grid[ni] || closed.has(ni)) continue;
      if (dx && dz && (grid[cz * n + nx] || grid[nz * n + cx])) continue;
      const ng = g.get(cur) + (dx && dz ? 1.414 : 1);
      if (ng < (g.get(ni) ?? Infinity)) {
        g.set(ni, ng); came.set(ni, cur);
        push([ng + Math.hypot(tx - nx, tz - nz), ni]);
      }
    }
  }
  if (!found) return [{ x: bx, z: bz }];
  const cells = [];
  for (let c = goal; c !== undefined && c !== start; c = came.get(c)) cells.push(c);
  cells.reverse();
  const pts = cells.map((c) => ({ x: -H + ((c % n) + 0.5) * cell, z: -H + (((c / n) | 0) + 0.5) * cell }));
  pts.push({ x: bx, z: bz });
  // smoothing: keep a waypoint only when the straight line is blocked
  const out = [];
  let ox = ax, oz = az;
  for (let i = 0; i < pts.length; i++) {
    const next = pts[i + 1];
    if (!next || !segmentWalkable(map, ox, oz, next.x, next.z, nav)) { out.push(pts[i]); ox = pts[i].x; oz = pts[i].z; }
  }
  return out;
}

function segmentWalkable(map, ax, az, bx, bz, nav) {
  const d = dist(ax, az, bx, bz), steps = Math.ceil(d / 0.5);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (cellBlocked(map, ax + (bx - ax) * t, az + (bz - az) * t, nav)) return false;
  }
  return true;
}
