// Building layouts (shared so collision and rendering agree). Walls are split into 2.4m bays:
// 'wall' = solid, 'window' = waist-high sill (blocks movement, NOT sight), 'door' = open passage.
const BAY = 2.4, T = 0.4, STORY = 3.4;

// Build one straight wall from (ax,az) to (bx,bz). pattern: string of W (wall) / O (window) / D (door).
function wallRun(b, ax, az, bx, bz, pattern, exterior = true) {
  const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / BAY)), bay = len / n;
  const alongX = Math.abs(bx - ax) > Math.abs(bz - az);
  for (let i = 0; i < n; i++) {
    const kind = { W: 'wall', O: 'window', D: 'door' }[pattern[i % pattern.length]] || 'wall';
    const t = (i + 0.5) / n;
    b.segments.push({
      x: ax + (bx - ax) * t, z: az + (bz - az) * t, len: bay, alongX, kind, exterior,
      hw: alongX ? bay / 2 : T / 2, hd: alongX ? T / 2 : bay / 2,
    });
  }
}

// Rectangular building centred at (x,z). sides: { n, s, e, w } patterns. inner: extra interior walls.
export function makeBuilding({ id, type, x, z, w, d, floors = 2, sides, inner = [], porch = null, style = 'mansion' }) {
  const b = { id, type, style, x, z, w, d, floors, height: floors * STORY, segments: [], porch };
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  wallRun(b, x0, z0, x1, z0, sides.n);   // north (-z)
  wallRun(b, x0, z1, x1, z1, sides.s);   // south (+z)
  wallRun(b, x1, z0 + T / 2, x1, z1 - T / 2, sides.e);
  wallRun(b, x0, z0 + T / 2, x0, z1 - T / 2, sides.w);
  for (const [ax, az, bx, bz, p] of inner) wallRun(b, x + ax, z + az, x + bx, z + bz, p, false);
  return b;
}

// Wrecked house: knock out wall bays (gaps), leave others as broken, vaultable stubs, and give the
// rest ragged partial heights (rendered only — they still block like full walls).
export function wreckBuilding(b, rng) {
  b.style = 'wrecked'; b.floors = 1; b.height = STORY;
  for (const s of b.segments) {
    const r = rng();
    if (s.kind === 'door') continue;
    if (r < 0.22) s.kind = 'gap';
    else if (r < 0.45) { s.kind = 'broken'; s.h = 0.8 + rng() * 0.35; }
    else { s.vis = 1.6 + rng() * (STORY - 1.6); s.kind = s.kind === 'window' && rng() < 0.5 ? 'window' : 'wall'; }
  }
  b.rubble = Array.from({ length: 10 }, () => ({ x: b.x + (rng() - 0.5) * b.w * 0.9, z: b.z + (rng() - 0.5) * b.d * 0.9, s: 0.4 + rng() * 0.8, r: rng() * 6 }));
}

// Register collisions for a building on the map. Two-storey buildings: exterior walls/corners block
// on both floors (both:true); a ground-floor door is a window bay upstairs (lv:1); interior walls
// exist only downstairs (the upper floor is an open loft).
export function addBuildingColliders(map, b) {
  const two = b.floors >= 2;
  for (const s of b.segments) {
    if (s.kind === 'gap') continue;
    if (s.kind === 'door') {
      if (two && s.exterior) map.rects.push({ x: s.x, z: s.z, hw: s.hw, hd: s.hd, h: 1.0, type: 'building', low: true, lv: 1 });
      continue;
    }
    const low = s.kind === 'window' || s.kind === 'broken';
    map.rects.push({
      x: s.x, z: s.z, hw: s.hw, hd: s.hd, h: s.kind === 'broken' ? s.h : low ? 1.0 : b.height,
      type: 'building', low, both: two && s.exterior,
    });
  }
  // Corner posts so diagonal gaps don't leak
  for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    map.rects.push({ x: b.x + cx * b.w / 2, z: b.z + cz * b.d / 2, hw: 0.35, hd: 0.35, h: b.height, type: 'building', both: two });
  }
  // Staircase: side wall / rail along the open side (both floors), a rail across the low end
  // (upstairs only: it's a drop) and a wall closing the space under the high end (downstairs only).
  const st = b.stair;
  if (st) {
    const zc = (st.z0 + st.z1) / 2, side = st.open, rx0 = Math.min(st.xb, st.xt), rx1 = Math.max(st.xb, st.xt);
    map.rects.push({ x: (rx0 + rx1) / 2, z: side, hw: (rx1 - rx0) / 2, hd: 0.08, h: 1.0, type: 'rail', low: true, both: true });
    map.rects.push({ x: st.xb, z: zc, hw: 0.08, hd: (st.z1 - st.z0) / 2, h: 1.0, type: 'rail', low: true, lv: 1 });
    map.rects.push({ x: st.xt, z: zc, hw: 0.12, hd: (st.z1 - st.z0) / 2, h: STORY, type: 'building' });
  }
}

export const STORY_HEIGHT = STORY;
export const WALL_T = T;
