// Procedural realm generation shared by server (authority, bots) and client (rendering).
// Layout: walk-in mansion in the centre, 2 farmhouses, dense dead forest, rock clusters,
// wrecks/crates/barrels, 4 crow bollards, gallows, lamps, 3 tombs and a tall perimeter wall.
import { makeRng, dist } from './rng.js';
import { MAP_SIZE, TOMB_COUNT } from './constants.js';
import { buildNav } from './nav.js';
import { makeBuilding, addBuildingColliders, wreckBuilding } from './buildings.js';
import { buildCemetery, buildPalletWalls, buildLogDrops, buildWindowWalls } from './landmarks.js';
import { placeChests } from './chests.js';
import { placeEasterEggs } from './easterEggs.js';
import { placeHides } from './hides.js';
import { scatterClutter, scatterNature } from './clutter.js';
import { scatterTrips } from './trips.js';
import { furnishMansion, furnishFarmhouse } from './interior.js';
export { collide, lineOfSight, findPath, inGrass, randomWalkable } from './nav.js';

const H = MAP_SIZE / 2;
export const BOUNDARY_WALL = { height: 9, thickness: 2.4 };

export function generateMap(seed) {
  const rng = makeRng(seed);
  const map = {
    seed, size: MAP_SIZE,
    rects: [], circles: [], grass: [], props: [], buildings: [], trips: [], logs: [], pallets: [], windows: [], chests: [], graves: [], cemetery: null, furniture: [],
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

  // Central mansion: two walkable floors joined by a staircase along the north wall. A long
  // east-west CORRIDOR (z -1.2..1.2) runs through the ground floor from the west door to the east
  // door; furnished rooms open off it (parlour, entrance hall, dining room / library, stair hall,
  // study). The upper floor is an open, furnished loft. See interior.js for the furniture.
  const mansion = makeBuilding({
    id: 'mansion', type: 'mansion', x: 0, z: 0, w: 24, d: 16.8, floors: 2,
    sides: { n: 'WOWOWWWWDW', s: 'WOWOWDWOWOW', e: 'WOWDOWW', w: 'WOWDOWW' },
    inner: [
      [-12, -1.2, 12, -1.2, 'WDWWDDWWDW'], [-12, 1.2, 12, 1.2, 'WDWWDDWWDW'], // corridor walls
      [-4.8, 1.2, -4.8, 8.4, 'WDW'], [4.8, 1.2, 4.8, 8.4, 'WDW'],             // south rooms
      [-4.8, -8.4, -4.8, -1.2, 'WDW'], [6.0, -8.4, 6.0, -1.2, 'WDW'],          // north rooms
    ],
    porch: { side: 's', w: 8.4, d: 2.6 },
  });
  mansion.corridor = { z0: -1.2, z1: 1.2 };
  // Stair: climbs westward from x=+3.6 (ground) to x=-3.6 (upstairs) in a 1.6m lane by the north wall.
  mansion.stair = { xb: 3.6, xt: -3.6, z0: -8.0, z1: -6.4, open: -6.35 };
  map.buildings.push(mansion); addBuildingColliders(map, mansion);
  furnishMansion(map, mansion);
  occupied.push({ x: 0, z: 0, r: 17 });

  // Reserve a south corner for the cemetery (built further down once the area is claimed).
  const cs = rng() < 0.5 ? -1 : 1;
  map.cemetery = { x: cs * (H - 15), z: H - 13, w: 22, d: 18, side: cs };
  occupied.push({ x: map.cemetery.x, z: map.cemetery.z, r: 15 });

  const ex = rng.range(-H + 22, H - 22);
  map.exit = { x: ex, z: -H - 0.2, rot: 0 }; // gatehouse sits in the wall line
  occupied.push({ x: ex, z: -H + 5, r: 7 });

  const baseAng = rng.range(0, Math.PI * 2);
  for (let i = 0; i < TOMB_COUNT; i++) {
    let a = baseAng + (i * Math.PI * 2) / TOMB_COUNT, rr = rng.range(H * 0.55, H * 0.68);
    let x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (dist(x, z, map.cemetery.x, map.cemetery.z) < 20) { a += 0.6; x = Math.cos(a) * rr; z = Math.sin(a) * rr; }
    occupied.push({ x, z, r: 6.5 });
    map.tombs.push({ id: i, x, z, rot: rng.range(0, Math.PI * 2) });
    map.rects.push({ x, z, hw: 1.1, hd: 0.7, h: 1.1, type: 'tomb', low: true });
    for (let k = 0; k < 4; k++) {
      const pa = (k / 4) * Math.PI * 2 + 0.4;
      map.circles.push({ x: x + Math.cos(pa) * 4.2, z: z + Math.sin(pa) * 4.2, r: 0.45, h: rng.range(1.5, 3.5), type: 'pillar' });
    }
  }

  // Cemetery in a south corner (survivors' side varies): walled plot, iron gate, rows of graves.
  buildCemetery(map, rng, occupied, H);

  // Four farmhouses around the realm: two still standing, two wrecked (roofless shells, broken
  // walls you can vault through, rubble).
  for (let i = 0; i < 4; i++) {
    const p = place(10, 500, 16); if (!p) continue;
    const b = makeBuilding({
      id: 'house' + i, type: 'house', style: 'farmhouse', x: p.x, z: p.z, w: 9.6, d: 7.2, floors: 1,
      sides: { n: 'WOWW', s: 'WDOW', e: 'WOW', w: 'ODO' }, inner: [[0, -3.6, 0, 1.2, 'WD']],
      porch: i < 2 ? { side: 's', w: 4.8, d: 2 } : null,
    });
    if (i >= 2) wreckBuilding(b, rng);
    map.buildings.push(b); addBuildingColliders(map, b);
    if (i < 2) furnishFarmhouse(map, b);
  }

  // Ruined escape walls with a doorway and a pallet leaning beside it (drop it on the monster).
  buildPalletWalls(map, rng, place);
  // Dead snags beside boulder gaps that survivors push down across the path.
  buildLogDrops(map, rng, place);

  // Four stone bollards, each with one crow.
  // Exactly 4, evenly spread: one in each quarter of the realm, near the quarter's centre.
  for (let i = 0; i < 4; i++) {
    const qx = (i % 2 ? 1 : -1) * H * 0.5, qz = (i < 2 ? -1 : 1) * H * 0.5;
    let p = null;
    for (let t = 0; t < 300 && !p; t++) {
      const sp = t < 150 ? 0.25 : 0.45, x = qx + rng.range(-sp, sp) * H, z = qz + rng.range(-sp, sp) * H;
      if (free(x, z, 5)) { p = { x, z }; occupied.push({ x, z, r: 5 }); }
    }
    if (!p) continue;
    map.towers.push({ id: i, x: p.x, z: p.z, h: 1.6, crows: [{ id: `${i}-0`, a: rng.range(0, Math.PI * 2) }] });
    map.circles.push({ x: p.x, z: p.z, r: 0.45, h: 1.6, type: 'bollard' });
  }
  // Gallows hooks spread evenly: one per cell of a 4x4 grid over the playable area (tried near the
  // cell centre first, then anywhere in the cell), and never closer than ~half a cell to another
  // hook — no empty quarter of the realm, no clusters.
  const HG = 4, cell = (MAP_SIZE - 16) / HG;
  for (let gx = 0; gx < HG; gx++) for (let gz = 0; gz < HG; gz++) {
    const cx = -H + 8 + (gx + 0.5) * cell, cz = -H + 8 + (gz + 0.5) * cell;
    let p = null;
    for (let t = 0; t < 160 && !p; t++) {
      const spread = t < 70 ? 0.28 : 0.46;
      const x = cx + rng.range(-spread, spread) * cell, z = cz + rng.range(-spread, spread) * cell;
      if (free(x, z, 3) && map.hooks.every((h) => dist(h.x, h.z, x, z) > cell * 0.55)) p = { x, z };
    }
    if (!p) continue;
    occupied.push({ x: p.x, z: p.z, r: 3 });
    map.hooks.push({ id: map.hooks.length, x: p.x, z: p.z, rot: rng.range(0, Math.PI * 2) });
    map.circles.push({ x: p.x, z: p.z, r: 0.3, h: 3.2, type: 'hookpost' });
  }
  // Wrecked walls with broken windows: survivors vault through, the monster must go around.
  buildWindowWalls(map, rng, place);
  { // a single dim lamp at the mansion porch — the realm is lit by the moon
    const x = 5.2, z = 8.4 + 2.6 + 1.2;
    map.lamps.push({ id: 0, x, z, r: 5 });
    map.circles.push({ x, z, r: 0.2, h: 3.9, type: 'lamppost' });
  }

  scatterClutter(map, rng, place, free, occupied, H);
  scatterTrips(map, rng, free, occupied, H);
  scatterNature(map, rng, free, occupied, H);
  placeChests(map, rng, free, occupied, H);

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
  // Buttresses along the inner face of the wall: solid (they used to be scenery you could walk into
  // and hide inside). Rendered from these rects (render/ruins.js).
  for (const r of map.rects.filter((r) => r.type === 'boundary')) {
    const alongX = r.hw > r.hd, len = alongX ? r.hw * 2 : r.hd * 2;
    if (len < 8) continue;
    const inward = alongX ? -Math.sign(r.z) : -Math.sign(r.x);
    for (let s = -len / 2 + 2; s < len / 2; s += 8) {
      const bx = alongX ? r.x + s : r.x + inward * (wt / 2 + 0.6), bz = alongX ? r.z + inward * (wt / 2 + 0.6) : r.z + s;
      if (Math.abs(bx - ex) < 6 && bz < -H + 3) continue; // keep the gate clear
      map.rects.push({ x: bx, z: bz, hw: alongX ? 0.7 : 0.8, hd: alongX ? 0.8 : 0.7, h: wh * 0.8, type: 'buttress' });
    }
  }

  placeHides(map);
  placeEasterEggs(map);
  buildNav(map);
  return map;
}
