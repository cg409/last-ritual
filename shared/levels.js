// Multi-storey support for the 2D simulation. Players carry `level` (0 = ground, 1 = upper floor).
// A staircase is an axis-aligned ramp along X: walking from its bottom end (xb) to its top end (xt)
// raises the feet from the ground floor to the upper floor. The renderer uses floorY for heights.
import { STORY_HEIGHT } from './buildings.js';

export const FLOOR0 = 0.25;                     // top of the building plinth / ground-floor boards
export const FLOOR1 = STORY_HEIGHT + 0.12;      // top of the upper-floor slab

export function stairAt(map, x, z) {
  for (const b of map.buildings) {
    const s = b.stair;
    if (s && x >= Math.min(s.xb, s.xt) && x <= Math.max(s.xb, s.xt) && z >= s.z0 && z <= s.z1) return s;
  }
  return null;
}
export const stairT = (s, x) => Math.min(1, Math.max(0, (s.xb - x) / (s.xb - s.xt)));

export function buildingAt(map, x, z, pad = 0) {
  for (const b of map.buildings) if (Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad) return b;
  return null;
}

// After moving: on the stairs the level follows the ramp; upstairs but outside the walls = a fall.
export function updateLevel(g, p) {
  const s = stairAt(g.map, p.x, p.z);
  if (s) { p.level = stairT(s, p.x) > 0.5 ? 1 : 0; return; }
  if (p.level === 1) {
    const b = buildingAt(g.map, p.x, p.z);
    if (!b || b.floors < 2) { // jumped out of an upstairs window
      p.level = 0;
      if (p.role === 'survivor' && p.state === 'alive') { p.stuckUntil = Math.max(p.stuckUntil || 0, g.time + 0.7); g.emit({ t: 'land', id: p.id, x: p.x, z: p.z }); }
    }
  }
}

// Height of the walking surface from structures, or null on open ground (renderer adds terrain).
export function floorY(map, x, z, level) {
  const s = stairAt(map, x, z);
  if (s) return FLOOR0 + stairT(s, x) * (FLOOR1 - FLOOR0);
  if (level === 1) return FLOOR1;
  const b = buildingAt(map, x, z, 0.2);
  if (b) return FLOOR0;
  for (const bb of map.buildings) { // porch deck
    const pc = bb.porch; if (!pc) continue;
    const pz = bb.z + bb.d / 2 + pc.d / 2;
    if (Math.abs(x - bb.x) < pc.w / 2 && Math.abs(z - pz) < pc.d / 2) return 0.35;
  }
  return null;
}

export const sameLevel = (a, b) => (a.level | 0) === (b.level | 0);

// Rolling terrain height (must match the client's terrain mesh displacement exactly).
export function terrainY(x, z) {
  const y = -z; // the terrain plane is rotated -90° about X: plane-local y = -world z
  return Math.sin(x * 0.11) * Math.cos(y * 0.09) * 0.18 + Math.sin(x * 0.37 + y * 0.21) * 0.05;
}

// Where feet stand: floors/stairs/porches inside structures, terrain everywhere else.
export function surfaceY(map, x, z, level = 0) {
  const f = floorY(map, x, z, level);
  return f == null ? terrainY(x, z) : f;
}
