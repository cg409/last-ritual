// Procedural realm generation shared by server (authority, bots) and client (rendering).
// Layout: walk-in mansion in the centre, 2 farmhouses, dense dead forest, rock clusters,
// wrecks/crates/barrels, 4 crow bollards, gallows, lamps, 3 tombs and a tall perimeter wall.
import { makeRng, dist } from './rng.js';
import { MAP_SIZE, TOMB_COUNT } from './constants.js';
import { buildNav } from './nav.js';
import { makeBuilding, addBuildingColliders } from './buildings.js';
import { scatterClutter, scatterNature } from './clutter.js';
export { collide, lineOfSight, findPath, inGrass, randomWalkable } from './nav.js';

const H = MAP_SIZE / 2;
export const BOUNDARY_WALL = { height: 9, thickness: 2.4 };

export function generateMap(seed) {
  const rng = makeRng(seed);
  const map = {
    seed, size: MAP_SIZE,
    rects: [], circles: [], grass: [], props: [], buildings: [],
    tombs: [], hooks: [], towers: [], lamps: [], keySpots: [], spawns: [],
    exit: null, monsterSpawn: null,
  };
  const occupied = [];
  const free = (x, z, r) => Math.abs(x) < H - 5 && Math.abs(z) < H - 5 && occupied.every((o) => dist(x, z, o.x, o.z) > o.r + r);
  const place = (r, tries = 300, minEdge = 8) => {
    for (let i = 0; i < tries; i++) {
      const x = rng.range(-H + minEdge, H - minEdge), z = rng.range(-H + minEdge, H - minEdge);
      if (free(x, z, r)) { occupied.push({ x, z, r }); return { x, z }; }
    }
    return null;
  };

  // Central mansion: walk-in, windows to look through, several doors, interior rooms.
  const mansion = makeBuilding({
    id: 'mansion', type: 'mansion', x: 0, z: 0, w: 19.2, d: 14.4, floors: 2,
    sides: { n: 'WOWODOWOW', s: 'WOWODOWOW', e: 'WODOWW', w: 'WOWDOW' },
    inner: [[-2.4, -7.2, -2.4, -1.2, 'WWD'], [-9.6, 1.2, -2.4, 1.2, 'WDW'], [2.4, 1.2, 9.6, 1.2, 'WDW'], [2.4, 1.2, 2.4, 7.2, 'DWW']],
    porch: { side: 's', w: 7.2, d: 2.6 },
  });
  map.buildings.push(mansion); addBuildingColliders(map, mansion);
  occupied.push({ x: 0, z: 0, r: 15 });

  const ex = rng.range(-H + 22, H - 22);
  map.exit = { x: ex, z: -H - 0.2, rot: 0 }; // gatehouse sits in the wall line
  occupied.push({ x: ex, z: -H + 5, r: 7 });

  const baseAng = rng.range(0, Math.PI * 2);
  for (let i = 0; i < TOMB_COUNT; i++) {
    const a = baseAng + (i * Math.PI * 2) / TOMB_COUNT, rr = rng.range(H * 0.55, H * 0.68);
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    occupied.push({ x, z, r: 6.5 });
    map.tombs.push({ id: i, x, z, rot: rng.range(0, Math.PI * 2) });
    map.rects.push({ x, z, hw: 1.1, hd: 0.7, h: 1.1, type: 'tomb', low: true });
    for (let k = 0; k < 4; k++) {
      const pa = (k / 4) * Math.PI * 2 + 0.4;
      map.circles.push({ x: x + Math.cos(pa) * 4.2, z: z + Math.sin(pa) * 4.2, r: 0.45, h: rng.range(1.5, 3.5), type: 'pillar' });
    }
  }

  // Two single-storey farmhouses.
  for (let i = 0; i < 2; i++) {
    const p = place(10, 400, 18); if (!p) continue;
    const b = makeBuilding({
      id: 'house' + i, type: 'house', style: 'farmhouse', x: p.x, z: p.z, w: 9.6, d: 7.2, floors: 1,
      sides: { n: 'WOWW', s: 'WDOW', e: 'WOW', w: 'ODO' }, inner: [[0, -3.6, 0, 1.2, 'WD']],
      porch: { side: 's', w: 4.8, d: 2 },
    });
    map.buildings.push(b); addBuildingColliders(map, b);
  }

  // Four stone bollards, each with one crow.
  for (let i = 0; i < 4; i++) {
    const p = place(5, 400, 14); if (!p) continue;
    map.towers.push({ id: i, x: p.x, z: p.z, h: 1.6, crows: [{ id: `${i}-0`, a: rng.range(0, Math.PI * 2) }] });
    map.circles.push({ x: p.x, z: p.z, r: 0.45, h: 1.6, type: 'bollard' });
  }
  for (let i = 0; i < 12; i++) {
    const p = place(3, 300, 8); if (!p) continue;
    map.hooks.push({ id: i, x: p.x, z: p.z, rot: rng.range(0, Math.PI * 2) });
    map.circles.push({ x: p.x, z: p.z, r: 0.3, h: 3.2, type: 'hookpost' });
  }
  for (let i = 0; i < 6; i++) {
    const p = place(3, 300, 8); if (!p) continue;
    map.lamps.push({ id: i, x: p.x, z: p.z, r: 6 });
    map.circles.push({ x: p.x, z: p.z, r: 0.2, h: 3.9, type: 'lamppost' });
  }

  scatterClutter(map, rng, place, free, occupied, H);
  scatterNature(map, rng, free, occupied, H);

  for (let i = 0; i < 14; i++) { const p = place(1.5, 200, 8); if (p) map.keySpots.push(p); }
  const sa = rng.range(0, Math.PI * 2);
  for (let i = 0; i < 5; i++) {
    const x = Math.cos(sa) * H * 0.8 + (i - 2) * 2.2, z = Math.sin(sa) * H * 0.8;
    map.spawns.push({ x: Math.max(-H + 5, Math.min(H - 5, x)), z: Math.max(-H + 5, Math.min(H - 5, z)) });
  }
  map.monsterSpawn = { x: -Math.cos(sa) * H * 0.72, z: -Math.sin(sa) * H * 0.72 };

  // Tall, thick perimeter wall.
  const { height: wh, thickness: wt } = BOUNDARY_WALL;
  // North wall is split around the exit gatehouse (gap closed by the gate pillars below).
  const gx0 = ex - 3.1, gx1 = ex + 3.1, west = -H - wt, east = H + wt;
  map.rects.push({ x: (west + gx0) / 2, z: -H - wt / 2, hw: (gx0 - west) / 2, hd: wt / 2, h: wh, type: 'boundary' });
  map.rects.push({ x: (gx1 + east) / 2, z: -H - wt / 2, hw: (east - gx1) / 2, hd: wt / 2, h: wh, type: 'boundary' });
  map.rects.push({ x: ex, z: -H - wt - 1, hw: 3.2, hd: 0.5, h: wh, type: 'boundary' }); // behind the gate (can't leave the map)
  for (const s of [-1, 1]) map.rects.push({ x: ex + s * 3.7, z: map.exit.z, hw: 0.7, hd: 1.3, h: 7, type: 'gatepost' });
  map.rects.push({ x: 0, z: H + wt / 2, hw: H + wt, hd: wt / 2, h: wh, type: 'boundary' });
  map.rects.push({ x: -H - wt / 2, z: 0, hw: wt / 2, hd: H + wt, h: wh, type: 'boundary' });
  map.rects.push({ x: H + wt / 2, z: 0, hw: wt / 2, hd: H + wt, h: wh, type: 'boundary' });

  buildNav(map);
  return map;
}
