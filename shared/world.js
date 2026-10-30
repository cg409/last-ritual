// World systems: tomb phases, keys, candles, carrying, bleed-out. Hazards live in hazards.js.
import { KEY_COUNT } from './constants.js';
import { dist } from './rng.js';
import { becomeMouse } from './survivor.js';
import { updateTraps, updateCrows, updateProjectiles, updateNoise } from './hazards.js';

export function onTombEnchanted(g, tomb, by) {
  const count = g.enchantedCount();
  if (by?.stats) by.stats.enchants++;
  g.phase = Math.max(g.phase, count);
  g.emit({ t: 'enchanted', tomb: tomb.id, count, name: by.name });
  if (count === 1) g.emit({ t: 'phase', phase: 1, msg: "The monster's special ability is sealed." });
  if (count === 2) g.emit({ t: 'phase', phase: 2, msg: 'The monster grows weak: slower, shorter reach.' });
  if (count >= 3 && !g.state.keys.length) {
    const spots = g.rng.shuffle(g.map.keySpots.slice());
    for (let i = 0; i < KEY_COUNT; i++) {
      const s = spots[i] || g.randomPoint();
      g.state.keys.push({ id: g.nextId++, x: s.x, z: s.z, taken: false });
    }
    g.emit({ t: 'phase', phase: 3, msg: 'Three keys have surfaced. Bring them to the gate.' });
  }
}

export function updateWorld(g, dt) {
  const s = g.state, m = g.monster;
  const rate = m.monster === 'stalker' ? 0.5 : 1;
  for (const c of s.candles) if (c.lit && !g.isBlackout()) { c.burn -= dt * rate; if (c.burn <= 0) { c.burn = 0; c.lit = false; } }
  s.candles = s.candles.filter((c) => c.burn > 0);
  // A lit candle next to an enchanted tomb protects it from the Mimic.
  for (const t of s.tombs) t.protected = t.done && s.candles.some((c) => c.lit && dist(c.x, c.z, t.x, t.z) < 3.5);

  for (const p of g.survivors()) {
    if (p.state === 'carried') {
      const c = g.player(p.carrier);
      if (!c || c.carrying !== p.id) { p.state = 'downed'; p.carrier = null; continue; }
      p.x = c.x - Math.sin(c.rot) * 0.2; p.z = c.z - Math.cos(c.rot) * 0.2; p.rot = c.rot; p.level = c.level | 0;
      p.wiggle += dt / 30; // fills on its own over 30s, faster when the victim presses A/D
      if (p.wiggle >= 1) {
        p.state = 'alive'; p.health = 1; p.carrier = null; p.wiggle = 0; p.boostUntil = g.time + 2;
        c.carrying = null; c.stunUntil = g.time + 3;
        g.emit({ t: 'wiggleFree', id: p.id, name: p.name });
      }
    }
    if (p.state === 'downed') { p.downT += dt; if (p.downT > 240) becomeMouse(g, p, 'bled out'); } else p.downT = 0;
  }

  updateTraps(g);
  updateCrows(g);
  updateProjectiles(g, dt);
  updateNoise(g, dt);
}
