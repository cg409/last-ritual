// Traps, crow towers, trident projectiles, Mimic exposure and noise.
import { SURVIVOR, TRAP_FX } from './constants.js';
import { dist, angleTo } from './rng.js';
import { lineOfSight } from './nav.js';
import { hitSurvivor } from './monster.js';

// A trap wounds (never downs): healthy → injured.
const wound = (p) => { if (p.health > 1) p.health = 1; p.selfHealT = 0; };

export function updateTraps(g) {
  for (const tr of g.state.traps) {
    for (const p of g.survivors()) {
      if (p.state !== 'alive' || p.trapped || (p.level | 0) !== (tr.level | 0) || (p.y || 0) > 0.35 || dist(p.x, p.z, tr.x, tr.z) > 0.75) continue;
      tr.sprung = true;
      const L = Math.max(1, Math.min(3, tr.lvl || 1)) - 1;
      p.act = null; p.skill = null; p.holding = false;
      p.auraUntil = Math.max(p.auraUntil, g.time + 5); // the monster sees a caught survivor's aura
      if (tr.type === 'bear') {
        wound(p);
        p.trapped = { type: 'bear', passed: 0, lvl: L, x: tr.x, z: tr.z, since: g.time };
        p.x = tr.x; p.z = tr.z;
      } else if (tr.type === 'poison') p.poisonUntil = g.time + TRAP_FX.poison[L];
      else if (tr.type === 'cursed') p.cursedUntil = g.time + TRAP_FX.cursed[L];
      else if (tr.type === 'spike') { wound(p); p.slowUntil = g.time + TRAP_FX.spikeSlow[L]; p.stuckUntil = g.time + 0.6; }
      g.emit({ t: 'trap', type: tr.type, x: tr.x, z: tr.z, id: p.id, name: p.name });
      if (p.isBot) botSay(g, p, 'trap');
      break;
    }
  }
  g.state.traps = g.state.traps.filter((t) => !t.sprung);
  // Foothold trap: held fast (aura visible) until two skill checks are passed with SPACE.
  for (const p of g.survivors()) {
    const t = p.trapped;
    if (!t) continue;
    if (p.state !== 'alive') { p.trapped = null; continue; }
    p.x = t.x; p.z = t.z; p.stuckUntil = g.time + 0.2;
    p.auraUntil = Math.max(p.auraUntil, g.time + 0.5);
    if (!p.skill && g.time - (t.lastCheck ?? t.since) > 1.2) {
      const speed = 0.6 + g.random() * 0.15, start = g.time + 0.8;
      p.skill = { id: g.nextId++, start, speed, zoneStart: 0.45 + g.random() * 0.35, zoneLen: 0.2, great: 0.05, expires: start + 1 / speed + 0.25, trap: true };
      g.emit({ t: 'skillWarn', id: p.id });
    } else if (p.skill && g.time > p.skill.expires) resolveTrapSkill(g, p, 'miss');
  }
}

export function resolveTrapSkill(g, p, result) {
  const t = p.trapped; p.skill = null;
  if (!t) return;
  t.lastCheck = g.time;
  if (result === 'miss') { g.emit({ t: 'trapStruggle', id: p.id, ok: false }); return; }
  t.passed++;
  g.emit({ t: 'trapStruggle', id: p.id, ok: true, passed: t.passed });
  if (t.passed >= 2) {
    p.trapped = null; p.stuckUntil = 0;
    p.noRunUntil = g.time + TRAP_FX.bearNoRun[t.lvl];
    g.emit({ t: 'trapFree', id: p.id, name: p.name });
  }
}

// Bots only speak when they are caught in a trap or hanging on the gallows.
const BOT_LINES = {
  trap: ['My leg! Something bit my leg!', 'It\'s a trap — stay away from here!', 'I can\'t see… what IS this?', 'Argh! Watch your step!', 'Help, I\'m caught!'],
  hook: ['Get me down from here!', 'Please… the rope…', 'It\'s camping me, be careful!', 'I don\'t want to die here.', 'Someone, hurry!'],
};
export function botSay(g, p, kind) {
  if (g.botChat === false || g.time < (p.chatCdUntil || 0)) return;
  p.chatCdUntil = g.time + 8;
  const lines = BOT_LINES[kind];
  g.emit({ t: 'chat', name: p.name, text: lines[(g.random() * lines.length) | 0], bot: true });
}

// Crows on every tower screech when they spot an upright survivor (crouching sneaks past).
export function updateCrows(g) {
  for (const t of g.state.towers) {
    if (g.time - t.screamAt < 8) continue;
    for (const p of g.survivors()) {
      if (p.state !== 'alive' || p.crouch || p.crawl) continue;
      const d = dist(p.x, p.z, t.x, t.z);
      if (d > 13) continue;
      if (d > 3 && !lineOfSight(g.map, t.x + Math.sign(p.x - t.x) * 0.6, t.z + Math.sign(p.z - t.z) * 0.6, p.x, p.z)) continue;
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

// (The Mimic no longer fears light - she relies on her camouflage instead; light exposure is gone.)

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
