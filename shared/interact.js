// Survivor "hold E" interactions and skill checks.
import { SURVIVOR } from './constants.js';
import { dist } from './rng.js';
import { onTombEnchanted } from './world.js';

const ENCHANT_R = 2.4, HELP_R = 1.8, DOOR_R = 5;

export function doInteract(g, p, dt) {
  const s = g.state;
  // 1) Door: deposit keys
  if (p.keys > 0 && !s.door.open && dist(p.x, p.z, s.door.x, s.door.z) < DOOR_R) {
    return progress(g, p, 'door', dt / 2, () => {
      s.door.keys += p.keys; p.keys = 0;
      g.emit({ t: 'keysIn', keys: s.door.keys });
      if (s.door.keys >= 3) { s.door.open = true; g.emit({ t: 'doorOpen' }); }
    });
  }
  // 2) Rescue a hanging survivor
  const hooked = g.survivors().find((o) => o.state === 'hooked' && dist(p.x, p.z, o.x, o.z) < HELP_R + 0.6);
  if (hooked) return progress(g, p, 'rescue', dt / SURVIVOR.rescueTime, () => {
    const h = s.hooks.find((h) => h.victim === hooked.id); if (h) h.victim = null;
    hooked.state = 'alive'; hooked.health = 1; hooked.hookId = null; hooked.boostUntil = g.time + 2;
    g.emit({ t: 'rescued', id: hooked.id, name: hooked.name, by: p.name });
  });
  // 3) Revive downed / mend injured
  const hurt = g.survivors().find((o) => o !== p && (o.state === 'downed' || (o.state === 'alive' && o.health === 1)) && dist(p.x, p.z, o.x, o.z) < HELP_R);
  if (hurt) {
    const dur = hurt.state === 'downed' ? 10 : 12;
    p.healTarget = hurt.id;
    return progress(g, p, 'heal', dt / dur, () => {
      if (hurt.state === 'downed') { hurt.state = 'alive'; hurt.health = 1; } else hurt.health = 2;
      g.emit({ t: 'healed', id: hurt.id, name: hurt.name, by: p.name });
    }, dt);
  }
  // 4) Enchant a tomb
  const tomb = s.tombs.find((t) => !t.done && dist(p.x, p.z, t.x, t.z) < ENCHANT_R);
  if (tomb) {
    if (p.act !== 'enchant') { p.act = 'enchant'; p.skill = null; }
    p.tombId = tomb.id;
    const workers = g.survivors().filter((o) => o.act === 'enchant' && o.tombId === tomb.id).length;
    tomb.progress = Math.min(1, tomb.progress + dt * SURVIVOR.enchantRate * (workers > 1 ? 0.85 : 1));
    p.actT = tomb.progress;
    maybeSkill(g, p, dt, 0.12);
    if (tomb.progress >= 1) {
      tomb.done = true;
      for (const o of g.survivors()) if (o.act === 'enchant' && o.tombId === tomb.id) { o.act = null; o.skill = null; }
      onTombEnchanted(g, tomb, p);
    }
    return;
  }
  // 5) Disarm a monster trap
  const trap = s.traps.find((t) => !t.sprung && dist(p.x, p.z, t.x, t.z) < 1.4);
  if (trap) return progress(g, p, 'disarm', dt / 3, () => {
    s.traps.splice(s.traps.indexOf(trap), 1); g.emit({ t: 'disarm', name: p.name });
  });
  p.act = null; p.actT = 0;
}

function progress(g, p, act, amount, done, skillDt = 0) {
  if (p.act !== act) { p.act = act; p.actT = 0; p.skill = null; }
  p.actT += amount;
  if (skillDt) maybeSkill(g, p, skillDt, 0.08);
  if (p.actT >= 1) { p.act = null; p.actT = 0; p.skill = null; done(); }
}

// Dead-by-Daylight style skill check: a needle sweeps the ring, press SPACE inside the zone.
// The client (or bot) evaluates timing and reports 'good' | 'great' | 'miss'; a timeout counts as a miss.
function maybeSkill(g, p, dt, chancePerSec) {
  if (p.skill) {
    if (g.time > p.skill.expires) resolveSkill(g, p, 'miss');
    return;
  }
  if (g.random() < chancePerSec * dt) {
    const speed = 0.8 + g.random() * 0.35;          // revolutions per second
    const zoneStart = 0.4 + g.random() * 0.45;      // fraction of the ring
    const start = g.time + 0.7;
    p.skill = { id: g.nextId++, start, speed, zoneStart, zoneLen: 0.13, great: 0.035, expires: start + 1 / speed + 0.15 };
    g.emit({ t: 'skillWarn', id: p.id });
  }
}

export function resolveSkill(g, p, result) {
  const sk = p.skill; p.skill = null;
  if (!sk) return;
  const tomb = p.act === 'enchant' ? g.state.tombs.find((t) => t.id === p.tombId) : null;
  if (result === 'great' && tomb) tomb.progress = Math.min(0.99, tomb.progress + 0.02);
  if (result === 'miss') {
    p.stuckUntil = g.time + 1.2;
    p.act = null;
    if (tomb) {
      // A wrong click breaks part of the tomb.
      tomb.progress = Math.max(0, tomb.progress - 0.08);
      tomb.cracks = Math.min(6, tomb.cracks + 1);
      g.emit({ t: 'fail', x: tomb.x, z: tomb.z, tomb: tomb.id, name: p.name });
    } else g.emit({ t: 'fail', x: p.x, z: p.z, name: p.name });
  }
}
