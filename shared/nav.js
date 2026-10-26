// Collision, line-of-sight and A* navigation on a coarse grid.
import { dist } from './rng.js';

const CELL = 1.5;

export function buildNav(map) {
  const n = Math.ceil(map.size / CELL);
  const grid = new Uint8Array(n * n);
  const H = map.size / 2;
  for (let gz = 0; gz < n; gz++) {
    for (let gx = 0; gx < n; gx++) {
      const x = -H + (gx + 0.5) * CELL, z = -H + (gz + 0.5) * CELL;
      grid[gz * n + gx] = blocked(map, x, z, 0.55) ? 1 : 0;
    }
  }
  map.nav = { n, grid, cell: CELL, H };
}

function blocked(map, x, z, r) {
  for (const b of map.rects) {
    if (Math.abs(x - b.x) < b.hw + r && Math.abs(z - b.z) < b.hd + r) return true;
  }
  for (const c of map.circles) if (dist(x, z, c.x, c.z) < c.r + r) return true;
  return false;
}

// Push a circle at (x,z) radius r out of all obstacles. Returns {x,z}.
// clearH: height the body is currently clearing (jumping) — obstacles lower than that are passed over.
export function collide(map, x, z, r = 0.4, clearH = 0) {
  for (let iter = 0; iter < 2; iter++) {
    for (const b of map.rects) {
      if (clearH > 0 && b.h <= clearH) continue;
      const dx = x - b.x, dz = z - b.z;
      const ox = b.hw + r - Math.abs(dx), oz = b.hd + r - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) x += Math.sign(dx || 1) * ox; else z += Math.sign(dz || 1) * oz;
      }
    }
    for (const c of map.circles) {
      if (clearH > 0 && c.h <= clearH) continue;
      const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
      if (d < m && d > 1e-4) { x = c.x + (dx / d) * m; z = c.z + (dz / d) * m; }
    }
  }
  return { x, z };
}

// 2D segment test against tall obstacles (low ones like fences/tombs don't block sight).
export function lineOfSight(map, ax, az, bx, bz) {
  const d = dist(ax, az, bx, bz);
  const steps = Math.ceil(d / 0.6);
  for (let i = 1; i < steps; i++) {
    const t = i / steps, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    for (const b of map.rects) {
      if (!b.low && Math.abs(x - b.x) < b.hw && Math.abs(z - b.z) < b.hd) return false;
    }
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

function toCell(map, x, z) {
  const { n, cell, H } = map.nav;
  return [Math.max(0, Math.min(n - 1, Math.floor((x + H) / cell))), Math.max(0, Math.min(n - 1, Math.floor((z + H) / cell)))];
}
function cellBlocked(map, x, z) {
  const [gx, gz] = toCell(map, x, z);
  return map.nav.grid[gz * map.nav.n + gx] === 1;
}

// A* returning an array of {x,z} waypoints (simplified with line-of-sight smoothing).
export function findPath(map, ax, az, bx, bz, maxNodes = 4000) {
  const { n, grid, cell, H } = map.nav;
  let [sx, sz] = toCell(map, ax, az);
  let [tx, tz] = toCell(map, bx, bz);
  const nearestFree = (gx, gz) => {
    if (!grid[gz * n + gx]) return [gx, gz];
    for (let r = 1; r < 6; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const x = gx + dx, z = gz + dz;
      if (x >= 0 && z >= 0 && x < n && z < n && !grid[z * n + x]) return [x, z];
    }
    return [gx, gz];
  };
  [sx, sz] = nearestFree(sx, sz); [tx, tz] = nearestFree(tx, tz);
  const start = sz * n + sx, goal = tz * n + tx;
  const g = new Map([[start, 0]]), came = new Map();
  const open = [[0, start]];
  const closed = new Set();
  let found = false, count = 0;
  while (open.length && count++ < maxNodes) {
    // small binary-heap-free min extraction (open list stays small on this grid)
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [, cur] = open.splice(bi, 1)[0];
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
        open.push([ng + Math.hypot(tx - nx, tz - nz), ni]);
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
    if (!next || !segmentWalkable(map, ox, oz, next.x, next.z)) { out.push(pts[i]); ox = pts[i].x; oz = pts[i].z; }
  }
  return out;
}

function segmentWalkable(map, ax, az, bx, bz) {
  const d = dist(ax, az, bx, bz), steps = Math.ceil(d / 0.5);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (cellBlocked(map, ax + (bx - ax) * t, az + (bz - az) * t)) return false;
  }
  return true;
}
