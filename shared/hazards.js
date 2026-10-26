// Traps, crow towers, trident projectiles, Mimic exposure and noise.
import { SURVIVOR } from './constants.js';
import { dist, angleTo } from './rng.js';
import { lineOfSight } from './nav.js';
import { hitSurvivor } from './monster.js';

export function updateTraps(g) {
  for (const tr of g.state.traps) {
    for (const p of g.survivors()) {
      if (p.state !== 'alive' || dist(p.x, p.z, tr.x, tr.z) > 0.9) continue;
      tr.sprung = true;
      if (tr.type === 'bear') { p.stuckUntil = g.time + 4; p.revealUntil = g.time + 4; p.act = null; }
      if (tr.type === 'bell') p.revealUntil = g.time + 6;
      if (tr.type === 'thorn') p.slowUntil = g.time + 6;
      g.emit({ t: 'trap', type: tr.type, x: tr.x, z: tr.z, id: p.id, name: p.name });
      break;
    }
  }
  g.state.traps = g.state.traps.filter((t) => !t.sprung);
}

// Crows on every tower screech when they spot an upright survivor (crouching sneaks past).
export function updateCrows(g) {
  for (const t of g.state.towers) {
    if (g.time - t.screamAt < 8) continue;
    for (const p of g.survivors()) {
      if (p.state !== 'alive' || p.crouch || p.crawl) continue;
      const d = dist(p.x, p.z, t.x, t.z);
      if (d > 15) continue;
      if (d > 6 && !lineOfSight(g.map, t.x + 2.2, t.z + 2.2, p.x, p.z) && !lineOfSight(g.map, t.x - 2.2, t.z - 2.2, p.x, p.z)) continue;
      t.screamAt = g.time;
      g.lastScreech = { tower: t.id, x: t.x, z: t.z, at: g.time };
      g.emit({ t: 'crows', tower: t.id, x: t.x, z: t.z });
      break;
    }
  }
}

export function updateProjectiles(g, dt) {
  const s = g.state;
  for (const pr of s.projectiles) {
    const owner = g.player(pr.owner);
    if (!pr.back) {
      const step = 26 * dt;
      pr.x += Math.sin(pr.dir) * step; pr.z += Math.cos(pr.dir) * step; pr.travel += step;
      const victim = g.survivors().find((p) => p.state === 'alive' && dist(p.x, p.z, pr.x, pr.z) < 0.9);
      if (victim) { hitSurvivor(g, owner, victim, 'trident'); pr.back = true; }
      const blocked = g.map.rects.some((b) => !b.low && Math.abs(pr.x - b.x) < b.hw && Math.abs(pr.z - b.z) < b.hd) ||
        g.map.circles.some((c) => c.type === 'tree' && dist(pr.x, pr.z, c.x, c.z) < c.r);
      if (pr.travel > pr.range || blocked) pr.back = true;
    } else {
      const a = angleTo(pr.x, pr.z, owner.x, owner.z);
      pr.dir = a;
      pr.x += Math.sin(a) * 32 * dt; pr.z += Math.cos(a) * 32 * dt;
      if (dist(pr.x, pr.z, owner.x, owner.z) < 1.5) pr.done = true;
    }
  }
  s.projectiles = s.projectiles.filter((p) => !p.done);
}

// The Mimic is exposed by candles (held or placed) and lamps, then hurled to a random spot.
export function updateMimicExposure(g) {
  const m = g.monster;
  if (m.monster !== 'mimic' || g.isBlackout() || m.immuneUntil > g.time) return;
  const s = g.state;
  const lit =
    s.candles.some((c) => c.lit && dist(c.x, c.z, m.x, m.z) < 4) ||
    g.map.lamps.some((l) => dist(l.x, l.z, m.x, m.z) < l.r) ||
    g.survivors().some((p) => p.state === 'alive' && p.holding && dist(p.x, p.z, m.x, m.z) < SURVIVOR.candleRadius * 0.55);
  if (!lit) return;
  const from = { x: m.x, z: m.z };
  if (m.carrying) {
    const v = g.player(m.carrying);
    if (v) { v.state = 'downed'; v.carrier = null; }
    m.carrying = null;
  }
  const to = g.randomPoint();
  m.x = to.x; m.z = to.z; m.disguise = null; m.stunUntil = g.time + 1.5; m.immuneUntil = g.time + 6;
  g.emit({ t: 'exposed', x: from.x, z: from.z });
}

// Running survivors make noise. The Ravager hears much further but can't pinpoint the source.
export function updateNoise(g, dt) {
  const m = g.monster;
  g.noiseT = (g.noiseT || 0) + dt;
  if (g.noiseT < 1) return;
  g.noiseT = 0;
  const range = m.monster === 'ravager' ? 45 : 16;
  const err = m.monster === 'ravager' ? 7 : 2;
  for (const p of g.survivors()) {
    if (p.state !== 'alive' || !p.running) continue;
    if (dist(p.x, p.z, m.x, m.z) > range) continue;
    g.emit({ t: 'noise', x: p.x + (g.random() - 0.5) * err * 2, z: p.z + (g.random() - 0.5) * err * 2, to: m.id });
  }
}
