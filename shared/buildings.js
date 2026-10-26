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

// Register collisions for a building on the map.
export function addBuildingColliders(map, b) {
  for (const s of b.segments) {
    if (s.kind === 'door') continue;
    map.rects.push({
      x: s.x, z: s.z, hw: s.hw, hd: s.hd,
      h: s.kind === 'window' ? 1.0 : b.height, type: 'building', low: s.kind === 'window',
    });
  }
  // Corner posts so diagonal gaps don't leak
  for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    map.rects.push({ x: b.x + cx * b.w / 2, z: b.z + cz * b.d / 2, hw: 0.35, hd: 0.35, h: b.height, type: 'building' });
  }
}

export const STORY_HEIGHT = STORY;
export const WALL_T = T;
