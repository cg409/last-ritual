// Hidden easter eggs (each one is a hidden achievement). Placed from the map seed with their own RNG
// so they never disturb the rest of the map, and server and clients agree on where they are.
//  - loneGrave: a lone tombstone near the edge of the realm, outside the cemetery (One of Us)
//  - orb:       a faint red orb set into a boundary wall in a quiet spot (The Heart of the Ritual)
//  - book:      a book on the floor of a wrecked farmhouse (Extra One)
//  - phone:     an old telephone on the mansion corridor wall (Yeah, It's a Misscall)
//  - morgan:    the cemetery headstone engraved "Arthur Morgan" (Dead Legend)
//  - clock / mirror: the mansion's grandfather clock and a dresser mirror
//  - watcher:   the upper south window of the mansion where a silhouette shows itself
import { makeRng, dist } from './rng.js';

// Match times (s) when the silhouette shows (for ~7s) and the telephone rings (for ~12s).
export const EGG_TIMES = { watcher: [120, 330, 540], phone: [210, 420, 630] };

function blocked(map, x, z, r) {
  for (const b of map.rects) {
    const dx = Math.max(0, Math.abs(x - b.x) - b.hw), dz = Math.max(0, Math.abs(z - b.z) - b.hd);
    if (dx * dx + dz * dz < r * r) return true;
  }
  return map.circles.some((c) => dist(x, z, c.x, c.z) < c.r + r);
}

export function placeEasterEggs(map) {
  const rng = makeRng((map.seed ^ 0x5eed1e) >>> 0), H = map.size / 2;
  const eggs = map.eggs = {};
  const quiet = (x, z, d) => map.hooks.every((h) => dist(x, z, h.x, h.z) > d) && map.tombs.every((t) => dist(x, z, t.x, t.z) > d + 4)
    && map.spawns.every((s) => dist(x, z, s.x, s.z) > d + 8) && dist(x, z, map.exit.x, map.exit.z) > 18;
  const edgePoint = (inset) => {
    const side = rng.pick(['w', 'e', 's', 'n']), t = rng.range(-H + 10, H - 10);
    if (side === 'w') return { x: -H + inset, z: t, side };
    if (side === 'e') return { x: H - inset, z: t, side };
    if (side === 's') return { x: t, z: H - inset, side };
    return { x: t, z: -H + inset, side };
  };
  const c = map.cemetery;
  // One of Us: lone grave a few metres in from the wall
  for (let i = 0; i < 400 && !eggs.loneGrave; i++) {
    const p = edgePoint(3.2);
    if (c && dist(p.x, p.z, c.x, c.z) < 18) continue;
    if (blocked(map, p.x, p.z, 1.3) || !quiet(p.x, p.z, 6)) continue;
    eggs.loneGrave = { x: p.x, z: p.z, rot: Math.atan2(-p.x, -p.z) };
    map.circles.push({ x: p.x, z: p.z, r: 0.35, h: 0.9, type: 'prop' });
  }
  // The Heart of the Ritual: half sunk into the inner face of a boundary wall
  for (let i = 0; i < 400 && !eggs.orb; i++) {
    const p = edgePoint(0);
    if (p.side === 'n') continue; // the gate wall is too busy
    const ix = p.side === 'w' ? 1 : p.side === 'e' ? -1 : 0, iz = p.side === 's' ? -1 : 0;
    if (blocked(map, p.x + ix * 1.2, p.z + iz * 1.2, 0.9) || !quiet(p.x, p.z, 12)) continue;
    if (eggs.loneGrave && dist(p.x, p.z, eggs.loneGrave.x, eggs.loneGrave.z) < 30) continue;
    if (c && dist(p.x, p.z, c.x, c.z) < 16) continue;
    eggs.orb = { x: p.x + ix * 0.05, z: p.z + iz * 0.05, y: 1.15, nx: ix, nz: iz };
  }
  // Extra One: a book on the floor of a wrecked house
  const houses = map.buildings.filter((b) => b.style === 'wrecked');
  const hs = houses.length ? houses : map.buildings.filter((b) => b.type === 'house');
  for (let i = 0; i < 200 && !eggs.book && hs.length; i++) {
    const b = hs[i % hs.length];
    const x = b.x + rng.range(-b.w / 2 + 1, b.w / 2 - 1), z = b.z + rng.range(-b.d / 2 + 1, b.d / 2 - 1);
    if (blocked(map, x, z, 0.5) || (map.chests || []).some((ch) => dist(x, z, ch.x, ch.z) < 1.6)) continue;
    eggs.book = { x, z, rot: rng.range(0, Math.PI * 2), house: b.id };
  }
  // Mansion pieces (the mansion sits at 0,0)
  // Souls of the lantern: a sealed envelope on the bed upstairs
  eggs.letter = { x: 9.2, z: 5.3, rot: 0.4 };
  eggs.phone = { x: 3.6, z: -0.98, y: 1.45, rot: 0 };
  eggs.watcher = { x: -3.6, z: 8.4 - 0.5, y: 3.4 + 1.0 };
  eggs.clock = (map.furniture || []).find((f) => f.kind === 'clock' && f.building === 'mansion' && !f.lv) || null;
  eggs.mirror = (map.furniture || []).find((f) => (f.kind === 'dresser' || f.kind === 'console') && f.building === 'mansion') || null;
  // Dead Legend: a tall headstone of its own inside the cemetery walls
  if (c) {
    for (let i = 0; i < 300 && !eggs.morgan; i++) {
      const x = c.x + rng.range(-c.w / 2 + 2.2, c.w / 2 - 2.2), z = c.z + rng.range(-c.d / 2 + 2.2, c.d / 2 - 2.2);
      if (blocked(map, x, z, 1.1) || map.graves.some((g) => dist(x, z, g.x, g.z) < 1.8)) continue;
      eggs.morgan = { x, z, rot: rng.range(-0.4, 0.4) };
      map.circles.push({ x, z, r: 0.45, h: 1.3, type: 'prop' });
    }
  }
  // The Weeping Angel: only ONE of the angels in the realm weeps (chosen per map)
  const angels = [...map.graves.filter((g) => g.kind === 'angel').map((g, i) => ({ kind: 'grave', i })),
    ...map.props.map((p, i) => ({ p, i })).filter((x) => x.p.kind === 'gothic_statue').map((x) => ({ kind: 'statue', i: x.i }))];
  eggs.angel = angels.length ? angels[(rng() * angels.length) | 0] : null;
  return eggs;
}
