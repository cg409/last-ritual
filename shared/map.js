// Procedural realm generation shared by server (authority, bots) and client (rendering).
import { makeRng, dist } from './rng.js';
import { MAP_SIZE, TOMB_COUNT } from './constants.js';
import { buildNav } from './nav.js';
export { collide, lineOfSight, findPath, inGrass, randomWalkable } from './nav.js';

const H = MAP_SIZE / 2;

export function generateMap(seed) {
  const rng = makeRng(seed);
  const map = {
    seed, size: MAP_SIZE,
    rects: [],   // {x,z,hw,hd,h,type}  axis-aligned solid boxes
    circles: [], // {x,z,r,h,type}       trees, rocks, pillars
    grass: [],   // {x,z,r}              camouflage patches
    tombs: [], hooks: [], towers: [], lamps: [], keySpots: [], spawns: [],
    exit: null, monsterSpawn: null,
  };
  const occupied = []; // {x,z,r} reserved areas
  const free = (x, z, r) => Math.abs(x) < H - 6 && Math.abs(z) < H - 6 &&
    occupied.every((o) => dist(x, z, o.x, o.z) > o.r + r);
  const place = (r, tries = 200, minEdge = 8) => {
    for (let i = 0; i < tries; i++) {
      const x = rng.range(-H + minEdge, H - minEdge), z = rng.range(-H + minEdge, H - minEdge);
      if (free(x, z, r)) { occupied.push({ x, z, r }); return { x, z }; }
    }
    return null;
  };

  // Central manor ruin (landmark)
  occupied.push({ x: 0, z: 0, r: 14 });
  const manor = [
    [0, -9, 10, 0.5], [-9.5, 0, 0.5, 9], [9.5, -4, 0.5, 5], [-4, 9, 6, 0.5], [6, 9, 3, 0.5],
    [0, 0, 3, 0.5], [3, 4, 0.5, 2.5],
  ];
  for (const [x, z, hw, hd] of manor) map.rects.push({ x, z, hw, hd, h: 4.5, type: 'stone' });

  // Exit door on the north edge
  const ex = rng.range(-H + 20, H - 20);
  map.exit = { x: ex, z: -H + 1.2, rot: 0 };
  occupied.push({ x: ex, z: -H + 4, r: 6 });

  // Tombs — spread far apart (triangle around the map)
  const baseAng = rng.range(0, Math.PI * 2);
  for (let i = 0; i < TOMB_COUNT; i++) {
    const a = baseAng + (i * Math.PI * 2) / TOMB_COUNT;
    const rr = rng.range(H * 0.55, H * 0.7);
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    occupied.push({ x, z, r: 6 });
    map.tombs.push({ id: i, x, z, rot: rng.range(0, Math.PI * 2) });
    map.rects.push({ x, z, hw: 1.1, hd: 0.7, h: 1.1, type: 'tomb', low: true });
    // broken pillars around each tomb
    for (let k = 0; k < 4; k++) {
      const pa = (k / 4) * Math.PI * 2 + 0.4;
      map.circles.push({ x: x + Math.cos(pa) * 4, z: z + Math.sin(pa) * 4, r: 0.45, h: rng.range(1.5, 3.5), type: 'pillar' });
    }
  }

  // Crow towers
  for (let i = 0; i < 6; i++) {
    const p = place(4, 300, 12); if (!p) continue;
    const crows = [];
    for (let c = 0; c < 4; c++) crows.push({ id: `${i}-${c}`, a: (c / 4) * Math.PI * 2 });
    map.towers.push({ id: i, x: p.x, z: p.z, h: rng.range(9, 12), crows });
    map.rects.push({ x: p.x, z: p.z, hw: 1.6, hd: 1.6, h: 10, type: 'tower' });
  }

  // Hanging gallows (hooks)
  for (let i = 0; i < 13; i++) {
    const p = place(3, 300, 8); if (!p) continue;
    map.hooks.push({ id: i, x: p.x, z: p.z, rot: rng.range(0, Math.PI * 2) });
    map.circles.push({ x: p.x, z: p.z, r: 0.3, h: 3.2, type: 'hookpost' });
  }

  // Lamps — permanently lit areas (Mimic weakness)
  for (let i = 0; i < 6; i++) {
    const p = place(3, 300, 8); if (!p) continue;
    map.lamps.push({ id: i, x: p.x, z: p.z, r: 6 });
    map.circles.push({ x: p.x, z: p.z, r: 0.2, h: 3, type: 'lamppost' });
  }

  // Sheds / ruined walls (loops, like DbD jungle-gyms)
  for (let i = 0; i < 16; i++) {
    const p = place(5, 200, 8); if (!p) continue;
    const kind = rng();
    if (kind < 0.5) { // L-shaped wall
      const s = rng() < 0.5 ? 1 : -1;
      map.rects.push({ x: p.x, z: p.z, hw: 3.5, hd: 0.35, h: 2.6, type: 'wall' });
      map.rects.push({ x: p.x + 3.2 * s, z: p.z + 2.5, hw: 0.35, hd: 2.5, h: 2.6, type: 'wall' });
    } else if (kind < 0.8) { // shed
      map.rects.push({ x: p.x, z: p.z, hw: 2.4, hd: 1.8, h: 3, type: 'shed' });
    } else { // fence line
      map.rects.push({ x: p.x, z: p.z, hw: rng() < 0.5 ? 4 : 0.2, hd: 0.2, h: 1.1, type: 'fence', low: true });
    }
  }

  // Rocks
  for (let i = 0; i < 30; i++) {
    const p = place(1.5, 100, 4); if (!p) continue;
    map.circles.push({ x: p.x, z: p.z, r: rng.range(0.8, 1.8), h: rng.range(0.9, 2.2), type: 'rock' });
  }
  // Dead trees
  for (let i = 0; i < 110; i++) {
    const x = rng.range(-H + 3, H - 3), z = rng.range(-H + 3, H - 3);
    if (!free(x, z, 1.2)) continue;
    occupied.push({ x, z, r: 0.8 });
    map.circles.push({ x, z, r: rng.range(0.3, 0.55), h: rng.range(7, 12), type: 'tree' });
  }
  // Tall grass / corn patches (no collision, camouflage)
  for (let i = 0; i < 28; i++) {
    const x = rng.range(-H + 6, H - 6), z = rng.range(-H + 6, H - 6);
    if (!free(x, z, 3)) continue;
    map.grass.push({ x, z, r: rng.range(3, 6) });
  }

  // Key spots & spawns
  for (let i = 0; i < 12; i++) { const p = place(1.5, 200, 8); if (p) map.keySpots.push(p); }
  const sa = rng.range(0, Math.PI * 2);
  for (let i = 0; i < 5; i++) {
    const x = Math.cos(sa) * H * 0.82 + (i - 2) * 2.2, z = Math.sin(sa) * H * 0.82;
    map.spawns.push({ x: Math.max(-H + 5, Math.min(H - 5, x)), z: Math.max(-H + 5, Math.min(H - 5, z)) });
  }
  map.monsterSpawn = { x: -Math.cos(sa) * H * 0.75, z: -Math.sin(sa) * H * 0.75 };

  // Boundary walls
  map.rects.push({ x: 0, z: -H - 1, hw: H + 2, hd: 1, h: 6, type: 'boundary' });
  map.rects.push({ x: 0, z: H + 1, hw: H + 2, hd: 1, h: 6, type: 'boundary' });
  map.rects.push({ x: -H - 1, z: 0, hw: 1, hd: H + 2, h: 6, type: 'boundary' });
  map.rects.push({ x: H + 1, z: 0, hw: 1, hd: H + 2, h: 6, type: 'boundary' });

  buildNav(map);
  return map;
}
