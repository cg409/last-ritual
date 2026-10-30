// Chests: 6-7 Supply (common), 2 Ritual (rare), 1 Cursed (legendary) per match. Spread evenly over
// the realm (farthest-point sampling) and preferring hidden spots — tucked against walls, rocks and
// inside buildings — so you only find them by paying attention. No glow, no shine.
import { dist } from './rng.js';
import { collide } from './nav.js';

// Keep staircases (and the landing in front of them) clear.
export function onStairs(b, x, z, m = 1.6) {
  const s = b.stair;
  return !!s && x > Math.min(s.xb, s.xt) - m && x < Math.max(s.xb, s.xt) + m && z > s.z0 - m && z < s.z1 + m;
}

// How hidden a spot is: blockers close by, and being indoors.
function cover(map, x, z) {
  let s = 0;
  for (const r of map.rects) {
    if (r.type === 'boundary' || r.lv) continue;
    const dx = Math.max(0, Math.abs(x - r.x) - r.hw), dz = Math.max(0, Math.abs(z - r.z) - r.hd);
    if (Math.hypot(dx, dz) < 2.2) s += r.low ? 0.5 : 1;
  }
  for (const c of map.circles) if ((c.type === 'rock' || c.type === 'tree') && dist(x, z, c.x, c.z) < c.r + 1.6) s += 0.5;
  if (map.buildings.some((b) => Math.abs(x - b.x) < b.w / 2 - 0.6 && Math.abs(z - b.z) < b.d / 2 - 0.6)) s += 2.5;
  return s;
}

export function placeChests(map, rng, free, occupied, H) {
  const cands = [];
  for (let i = 0; i < 900; i++) {
    const x = rng.range(-H + 6, H - 6), z = rng.range(-H + 6, H - 6);
    if (!free(x, z, 0.9)) continue;
    cands.push({ x, z, s: cover(map, x, z) });
  }
  for (const b of map.buildings) { // indoor spots (ground floor), clear of walls & furniture
    for (let i = 0; i < 25; i++) {
      const x = b.x + rng.range(-b.w / 2 + 1, b.w / 2 - 1), z = b.z + rng.range(-b.d / 2 + 1, b.d / 2 - 1);
      const c = collide(map, x, z, 0.7);
      if (Math.abs(c.x - x) > 1e-3 || Math.abs(c.z - z) > 1e-3) continue;
      if ((map.furniture || []).some((f) => dist(x, z, f.x, f.z) < 1.4) || onStairs(b, x, z)) continue;
      cands.push({ x, z, s: cover(map, x, z) + 0.5, indoor: true });
    }
  }
  let pool = cands.filter((c) => c.s >= 2);
  if (pool.length < 20) pool = cands;
  const nSupply = rng() < 0.5 ? 6 : 7, total = nSupply + 3;
  const picked = [];
  if (pool.length) picked.push(pool[Math.floor(rng() * pool.length)]);
  while (picked.length < total && picked.length < pool.length) {
    let best = null, bestD = -1;
    for (const c of pool) {
      const d = Math.min(...picked.map((p) => dist(p.x, p.z, c.x, c.z))) + c.s * 0.8 + rng() * 2; // spread first, then cover
      if (d > bestD && !picked.includes(c)) { bestD = d; best = c; }
    }
    if (!best) break;
    picked.push(best);
  }
  // tiers: the legendary one and the rares go to the best-hidden of the spread spots
  const order = picked.map((p, i) => ({ p, i })).sort((a, b) => b.p.s - a.p.s);
  const tier = new Array(picked.length).fill('supply');
  if (order[0]) tier[order[0].i] = 'cursed';
  for (const o of order.slice(1, 3)) tier[o.i] = 'ritual';
  picked.forEach((p, i) => {
    map.chests.push({ id: i, x: p.x, z: p.z, rot: rng.range(0, Math.PI * 2), tier: tier[i] });
    map.rects.push({ x: p.x, z: p.z, hw: 0.45, hd: 0.45, h: 0.7, type: 'chest', low: true });
    occupied.push({ x: p.x, z: p.z, r: 1.2 });
  });
}

const ri = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));

// Loot table (rolled when the chest is opened).
export function rollLoot(tier, rng) {
  if (tier === 'supply') {
    const l = { coins: ri(rng, 20, 40) };
    const r = rng();
    if (r < 0.45) l.bandage = 1; else if (r < 0.85) l.battery = 1; else l.string = 1; // the string is the rare find
    if (rng() < 0.25) l.battery = (l.battery || 0) + 1;
    return l;
  }
  if (tier === 'ritual') return { shards: ri(rng, 1, 15), coins: ri(rng, 70, 100), battery: ri(rng, 1, 2), string: ri(rng, 1, 2), eye: ri(rng, 0, 1) };
  return { shards: ri(rng, 15, 25), coins: ri(rng, 100, 150), unlimited: true, string: ri(rng, 2, 3), eye: ri(rng, 2, 3) };
}
