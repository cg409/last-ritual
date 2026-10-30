// Survivor "hold E" interactions and skill checks.
import { SURVIVOR, REVEAL, CHESTS, FLASHLIGHT } from './constants.js';
import { rollLoot } from './chests.js';
import { dist } from './rng.js';
import { onTombEnchanted } from './world.js';
import { tryHide } from './hides.js';

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
    hooked.state = 'alive'; hooked.health = 1; hooked.hookId = null; hooked.boostUntil = g.time + 2; p.stats.rescues++;
    g.emit({ t: 'rescued', id: hooked.id, name: hooked.name, by: p.name });
  });
  // 3) Revive downed / mend injured
  const hurt = g.survivors().find((o) => o !== p && o.hideIn == null && (o.state === 'downed' || (o.state === 'alive' && o.health === 1)) && dist(p.x, p.z, o.x, o.z) < HELP_R);
  if (hurt) {
    const dur = hurt.state === 'downed' ? 10 : 12;
    p.healTarget = hurt.id;
    const mk = p.perks?.medic ? [1.25, 1.4, 1.6][p.perks.medic - 1] : 1;
    return progress(g, p, 'heal', (dt / dur) * mk, () => {
      if (hurt.state === 'downed') { hurt.state = 'alive'; hurt.health = 1; } else hurt.health = 2;
      p.stats.heals++;
      g.emit({ t: 'healed', id: hurt.id, name: hurt.name, by: p.name });
    }, dt);
  }
  // 4) Climb into a cupboard / porta-potty
  if (tryHide(g, p, dt)) return;
  // 5) Open a chest (Ritualist opens faster)
  const chest = (s.chests || []).find((c) => !c.opened && dist(p.x, p.z, c.x, c.z) < 1.5);
  if (chest) {
    p.chestId = chest.id;
    return progress(g, p, 'chest', (dt / CHESTS[chest.tier].time) * ritual(p), () => openChest(g, p, chest));
  }
  // 5) Enchant a tomb
  const tomb = s.tombs.find((t) => !t.done && dist(p.x, p.z, t.x, t.z) < ENCHANT_R);
  if (tomb) {
    if (p.act !== 'enchant') {
      p.act = 'enchant'; p.skill = null;
      // Starting a rite shows you to the other survivors (aura + map) for 20s, and marks the tomb.
      if (!(p.allyRevealUntil > g.time)) { p.allyRevealUntil = g.time + 20; g.emit({ t: 'enchantStart', id: p.id, name: p.name, tomb: tomb.id }); }
    }
    p.tombId = tomb.id;
    const workers = g.survivors().filter((o) => o.act === 'enchant' && o.tombId === tomb.id).length;
    tomb.progress = Math.min(1, tomb.progress + dt * SURVIVOR.enchantRate * (workers > 1 ? 0.85 : 1) * ritual(p));
    p.actT = tomb.progress;
    maybeSkill(g, p, dt, 0.2, true); // tombs demand SPACE checks (fair: slow needle, wide zone)
    if (tomb.progress >= 1) {
      tomb.done = true;
      for (const o of g.survivors()) if (o.act === 'enchant' && o.tombId === tomb.id) { o.act = null; o.skill = null; }
      onTombEnchanted(g, tomb, p);
    }
    return;
  }
  // 6) Disarm a monster trap
  const trap = s.traps.find((t) => !t.sprung && dist(p.x, p.z, t.x, t.z) < 1.4);
  if (trap) return progress(g, p, 'disarm', dt / 3, () => {
    s.traps.splice(s.traps.indexOf(trap), 1); g.emit({ t: 'disarm', name: p.name });
  });
  p.act = null; p.actT = 0;
}

const ritual = (p) => (p.perks?.ritualist ? 1 + [0.25, 0.35, 0.45][p.perks.ritualist - 1] : 1);

function openChest(g, p, chest) {
  chest.opened = true; chest.by = p.id;
  const loot = rollLoot(chest.tier, g.rng);
  p.coins += loot.coins || 0; p.shards += loot.shards || 0;
  p.inv.bandage = Math.min(p.bandageCap, p.inv.bandage + (loot.bandage || 0));
  p.inv.battery += loot.battery || 0; p.inv.string += loot.string || 0; p.inv.eye += loot.eye || 0;
  if (loot.unlimited) { p.unlimited = true; p.light = FLASHLIGHT.full; }
  p.stats.chests++;
  // Ritual and Cursed chests betray the opener to the monster for a moment.
  if (chest.tier !== 'supply') p.auraUntil = Math.max(p.auraUntil, g.time + 8);
  g.emit({ t: 'chest', id: p.id, name: p.name, tier: chest.tier, chest: chest.id, loot, x: chest.x, z: chest.z });
}

function progress(g, p, act, amount, done, skillDt = 0) {
  if (p.act !== act) { p.act = act; p.actT = 0; p.skill = null; }
  p.actT += amount;
  if (skillDt) maybeSkill(g, p, skillDt, 0.08);
  if (p.actT >= 1) { p.act = null; p.actT = 0; p.skill = null; done(); }
}

// Dead-by-Daylight style skill check: a needle sweeps the ring, press SPACE inside the zone.
// The client (or bot) evaluates timing and reports 'good' | 'great' | 'miss'; a timeout counts as a miss.
function maybeSkill(g, p, dt, chancePerSec, hard = false) {
  if (p.skill) {
    if (g.time > p.skill.expires) resolveSkill(g, p, 'miss');
    return;
  }
  if (p.skillCdUntil > g.time) return;            // short breather between checks
  if (g.random() < chancePerSec * dt) {
    // Readable DbD-like checks: ~1.6s per lap, a wide zone, a clear warning beat before the needle
    // moves. Tomb checks only tighten slightly as the enchantment nears completion.
    const k = hard ? Math.min(1, p.actT || 0) : 0;
    const speed = (hard ? 0.6 + k * 0.12 : 0.55) + g.random() * 0.1;   // revolutions per second
    const zoneStart = 0.45 + g.random() * 0.35;                         // fraction of the ring
    const zoneLen = hard ? 0.2 - k * 0.04 : 0.22;
    const start = g.time + 1.0;
    p.skillCdUntil = start + 1 / speed + 2.5;
    p.skill = { id: g.nextId++, start, speed, zoneStart, zoneLen, great: 0.05, expires: start + 1 / speed + 0.25 };
    g.emit({ t: 'skillWarn', id: p.id });
  }
}

export function resolveSkill(g, p, result) {
  const sk = p.skill; p.skill = null;
  if (!sk) return;
  const tomb = p.act === 'enchant' ? g.state.tombs.find((t) => t.id === p.tombId) : null;
  if (result === 'great' && tomb) tomb.progress = Math.min(0.99, tomb.progress + 0.02);
  if (result === 'miss') {
    p.stuckUntil = g.time + 0.8;
    p.act = null;
    p.auraUntil = g.time + REVEAL.failAura; // the monster sees this survivor's aura (through walls + mini-map)
    if (tomb) {
      // A wrong click breaks part of the tomb.
      tomb.progress = Math.max(0, tomb.progress - 0.05);
      tomb.cracks = Math.min(6, tomb.cracks + 1);
      g.emit({ t: 'fail', x: tomb.x, z: tomb.z, tomb: tomb.id, name: p.name });
    } else g.emit({ t: 'fail', x: p.x, z: p.z, name: p.name });
  }
}
