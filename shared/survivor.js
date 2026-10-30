// Survivor rules: movement, candles, hooked state, keys, escape. Interactions live in interact.js.
import { SURVIVOR, FLASHLIGHT } from './constants.js';
import { collide, inGrass, logAt, lineOfSight } from './nav.js';
import { resolveTrapSkill, botSay } from './hazards.js';
import { updateHidden } from './hides.js';
import { dist } from './rng.js';
import { doInteract, resolveSkill } from './interact.js';
import { checkTrip } from './trips.js';
import { updateLevel } from './levels.js';
import { dropPallet } from './pallets.js';

const DOOR_R = 3.6;

export function updateSurvivor(g, p, dt) {
  const inp = p.input;
  if (p.state === 'escaped') return;
  quickMessage(g, p, inp);
  if (p.state === 'mouse') { // the dead return as a quick little mouse: fast, can leap
    if (inp.actions.some((a) => a.t === 'jump')) startJump(g, p, 0.55, 1.1);
    updateJump(g, p);
    // (a body radius of 0.22: the tiny old one slipped through the seams where mansion walls meet)
    return moveBody(g, p, inp, inp.run ? 6.5 : 4.2, dt, 0.22);
  }
  // Struck down / grabbed in mid-jump: drop to the ground (the jump used to freeze in the air).
  if (p.state !== 'alive' && (p.jumpT0 != null || p.y)) { p.jumpT0 = null; p.y = 0; p.airDir = null; }
  if (p.state === 'hooked') return updateHooked(g, p, dt);
  if (p.state === 'carried') {
    if (inp.actions.some((a) => a.t === 'wiggle')) p.wiggle = Math.min(1, p.wiggle + 0.008);
    return;
  }
  if (p.state === 'downed') {
    p.act = null;
    const m = g.monster, grabbed = m && (m.act === 'pickup' || m.act === 'kill') && m.actTarget === p.id;
    return moveBody(g, p, grabbed ? { mx: 0, mz: 0, actions: [] } : inp, 0.55, dt, 0.4);
  }

  // ---------- alive ----------
  if (p.hideIn != null) { // inside a cupboard / porta-potty
    for (const a of inp.actions) if (a.t === 'skill' && p.skill && a.id === p.skill.id) handleAction(g, p, a);
    return updateHidden(g, p, inp);
  }
  for (const a of inp.actions) handleAction(g, p, a);
  burnHeld(g, p, dt);
  const fallen = p.fallUntil > g.time;               // tripped over a pallet / log
  const stuck = p.stuckUntil > g.time || fallen;
  // Jump: clears fences, window sills, wrecks, tombs and trip obstacles (up to ~1.25m).
  if (inp.actions.some((a) => a.t === 'jump') && !stuck && !inp.crawl && !p.act) startJump(g, p, 0.72, 1.25);
  updateJump(g, p);
  p.crouch = !!inp.crouch; p.crawl = !!inp.crawl;
  // No run limit: survivors may sprint for as long as they like (except after a foothold trap).
  p.stamina = 1; p.exhausted = false;
  updateFlashlight(p, dt);
  adrenaline(g, p); sixthSense(g, p);
  const canRun = !!inp.run && Math.hypot(inp.mx || 0, inp.mz || 0) > 0.1 && !p.crouch && !p.crawl && !(p.noRunUntil > g.time);
  let speed = p.crawl ? SURVIVOR.crawl : p.crouch ? SURVIVOR.crouch : canRun ? SURVIVOR.run : SURVIVOR.walk;
  if (p.boostUntil > g.time) speed = Math.max(speed, SURVIVOR.run * (p.adrenalineUntil > g.time ? (p.perks.adrenaline >= 3 ? 1.45 : 1.4) : 1.25));
  if (p.slowUntil > g.time) speed *= 0.6;
  if (stuck) speed = 0;

  // Poison: legs stagger off course (a slowly turning sideways drift, even when standing).
  let move = inp;
  if (p.poisonUntil > g.time && !stuck) {
    const a = g.time * 0.9 + p.x * 0.01, k = 0.55;
    move = { ...inp, mx: (inp.mx || 0) + Math.sin(a) * k, mz: (inp.mz || 0) + Math.cos(a * 1.3) * k };
    if (Math.hypot(inp.mx || 0, inp.mz || 0) < 0.1) speed = Math.max(speed, SURVIVOR.walk * 0.45);
  }

  const wantsMove = Math.hypot(inp.mx || 0, inp.mz || 0) > 0.1;
  // Heal (hold H): a bandage from a chest heals in 4s; otherwise the self-mend — twice per match,
  // 15s standing still; moving pauses it (progress is kept), being hit loses it.
  const selfHealing = !!inp.heal && !inp.interact && !wantsMove && !stuck && !p.crawl && (p.y || 0) < 0.05 && p.health === 1 && (p.heals > 0 || p.inv.bandage > 0);
  // Pallets drop instantly with E — also mid-sprint, that's the point.
  if (inp.interact && !stuck && dropPallet(g, p)) { p.act = null; }
  else if (inp.interact && !wantsMove && !stuck) doInteract(g, p, dt);
  else if (selfHealing) selfHeal(g, p, dt);
  else if (!stuck) { p.act = null; p.actT = 0; p.skill = null; }
  if (p.act) speed = 0;
  p.running = canRun && speed > SURVIVOR.walk;
  if (fallen) { p.moving = false; p.speed = 0; p.running = false; p.rot = p.fallRot ?? p.rot; }
  else moveBody(g, p, move, speed, dt, 0.4);
  checkTrip(g, p);
  p.hidden = (p.crouch || p.crawl) && inGrass(g.map, p.x, p.z);

  for (const k of g.state.keys) {
    if (!k.taken && dist(p.x, p.z, k.x, k.z) < 1.3) {
      k.taken = true; p.keys++; g.emit({ t: 'key', id: p.id, name: p.name });
    }
  }
  const d = g.state.door;
  if (d.open && dist(p.x, p.z, d.x, d.z) < DOOR_R) {
    p.state = 'escaped'; p.act = null; p.holding = false; g.emit({ t: 'escaped', id: p.id, name: p.name });
  }
}

// Jump arc: p.jumpT0 = start time, p.jumpDur, p.jumpH (apex height). p.y is the current height.
export function startJump(g, p, dur, height) {
  if (p.jumpT0 != null && g.time - p.jumpT0 < p.jumpDur) return false;
  p.jumpT0 = g.time; p.jumpDur = dur; p.jumpH = height;
  g.emit({ t: 'jump', id: p.id });
  return true;
}
export function updateJump(g, p) {
  if (p.jumpT0 == null) { p.y = 0; return; }
  const k = (g.time - p.jumpT0) / p.jumpDur;
  if (k >= 1) { p.jumpT0 = null; p.y = 0; return; }
  p.y = 4 * p.jumpH * k * (1 - k); // parabola
}

export function moveBody(g, p, inp, speed, dt, radius) {
  let mx = inp.mx || 0, mz = inp.mz || 0;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  // Keep momentum while airborne
  if (p.y > 0.05 && len < 0.1 && p.airDir) { mx = p.airDir[0]; mz = p.airDir[1]; speed = Math.max(speed, p.airSpeed || 0); }
  const mlen = Math.hypot(mx, mz);
  p.moving = mlen > 0.1 && speed > 0;
  p.speed = p.moving ? speed * Math.min(1, mlen) : 0;
  if (p.moving) {
    if (p.y > 0.05) { if (!p.airDir) { p.airDir = [mx, mz]; p.airSpeed = speed; } } else p.airDir = null;
    // While in the air the body clears obstacles lower than ~85% of the jump apex.
    const clearH = p.y > 0.25 ? (p.jumpH || 0) * 1.0 : 0;
    // Fallen logs block survivors (jump them); the monster clambers over slowly, mice scurry over.
    const overLogs = p.role === 'monster' || p.state === 'mouse';
    // Sub-steps no longer than ~60% of the body radius (min 0.12m) so small fast bodies (the mouse)
    // can't tunnel through thin walls and furniture in a single tick.
    const step = speed * dt, n = Math.min(12, Math.ceil(step / Math.max(0.12, radius * 0.6)));
    for (let i = 0; i < n; i++) {
      const c = collide(g.map, p.x + (mx * step) / n, p.z + (mz * step) / n, radius, clearH, p.level | 0, overLogs);
      p.x = c.x; p.z = c.z;
    }
    if (p.role === 'monster' && (p.level | 0) === 0 && logAt(g.map, p.x, p.z, radius * 0.6)) p.climbUntil = g.time + 0.15;
    p.rot = Math.atan2(mx, mz);
  } else if (typeof inp.face === 'number') p.rot = inp.face;
  if (p.state !== 'carried' && p.state !== 'hooked') updateLevel(g, p);
}

function handleAction(g, p, a) {
  if (a.t === 'candle') {
    p.holding = !p.holding && p.candles.length > 0 && p.candles[0] > 0;
  } else if (a.t === 'placeCandle') {
    const near = g.state.candles.find((c) => c.owner === p.id && dist(p.x, p.z, c.x, c.z) < 1.6);
    if (near) { // pick it back up, keeping remaining burn
      g.state.candles.splice(g.state.candles.indexOf(near), 1);
      p.candles.push(near.burn);
      return;
    }
    if (!p.candles.length) return;
    const burn = p.candles.shift();
    if (!p.candles.length) p.holding = false;
    g.state.candles.push({ id: g.nextId++, x: p.x + Math.sin(p.rot) * 0.6, z: p.z + Math.cos(p.rot) * 0.6, lit: true, burn, owner: p.id });
    g.emit({ t: 'candle', x: p.x, z: p.z });
  } else if (a.t === 'toggleCandle') {
    const c = g.state.candles.find((c) => dist(p.x, p.z, c.x, c.z) < 1.8);
    if (c && c.burn > 0) c.lit = !c.lit;
  } else if (a.t === 'skill' && p.skill && a.id === p.skill.id) {
    if (p.skill.trap) resolveTrapSkill(g, p, a.result); else resolveSkill(g, p, a.result);
  } else if (a.t === 'light') {
    if (p.light <= 0 && p.inv.battery > 0 && !p.unlimited) { p.inv.battery--; p.light = FLASHLIGHT.battery; } // a spare battery goes in by itself
    p.lightOn = !p.lightOn && (p.unlimited || p.light > 0);
  } else if (a.t === 'item') useItem(g, p, a.item);
}

// Items found in chests: 2 = Enchanted string (all tombs revealed for 30s), 3 = The Eye (the
// monster's aura for 12s). Batteries are used automatically when the flashlight runs dry.
function useItem(g, p, item) {
  if (item === 'string' && p.inv.string > 0) { p.inv.string--; p.tombSightUntil = g.time + 30; g.emit({ t: 'useItem', id: p.id, item, name: p.name }); }
  if (item === 'eye' && p.inv.eye > 0) { p.inv.eye--; p.eyeUntil = g.time + 12; g.emit({ t: 'useItem', id: p.id, item, name: p.name }); }
}

function updateFlashlight(p, dt) {
  if (p.unlimited) return;
  if (p.light <= 0 && p.inv.battery > 0) { p.inv.battery--; p.light = FLASHLIGHT.battery; return; } // empty + spare battery: refill automatically (even if the light was off)
  if (!p.lightOn) return;
  p.light -= dt;
  if (p.light <= 0) {
    if (p.inv.battery > 0) { p.inv.battery--; p.light = Math.max(0, p.light) + FLASHLIGHT.battery; } else { p.light = 0; p.lightOn = false; }
  }
}

// Sixth Sense: the monster within 8m shows its aura for 2s (once every 20s).
function sixthSense(g, p) {
  const m = g.monster;
  if (!p.perks.sixth || !m || (p.sixthCdUntil || 0) > g.time || dist(p.x, p.z, m.x, m.z) > 8) return;
  p.eyeUntil = Math.max(p.eyeUntil, g.time + 2); p.sixthCdUntil = g.time + 20;
}

// Adrenaline Rush: the monster closing in (≤9m, line of sight) triggers a short burst of speed.
function adrenaline(g, p) {
  const lv = p.perks.adrenaline, m = g.monster;
  if (!lv || p.adrenalineCdUntil > g.time || !m || m.stunUntil > g.time || p.trapped) return;
  if (dist(p.x, p.z, m.x, m.z) > 12 || (p.level | 0) !== (m.level | 0) || !lineOfSight(g.map, p.x, p.z, m.x, m.z, p.level | 0)) return;
  const dur = [4, 5, 6][lv - 1];
  p.boostUntil = Math.max(p.boostUntil, g.time + dur); p.adrenalineUntil = g.time + dur;
  p.adrenalineCdUntil = g.time + [35, 30, 25][lv - 1];
  g.emit({ t: 'adrenaline', id: p.id });
}

export const medicK = (p) => (p.perks?.medic ? [1.25, 1.4, 1.6][p.perks.medic - 1] : 1);

function selfHeal(g, p, dt) {
  // a bandage (4s) beats the self-mend (15s); progress carries over between the two
  const bandage = p.inv.bandage > 0;
  if (p.act !== 'selfheal') { p.act = 'selfheal'; p.skill = null; }
  p.selfHealT = Math.min(1, (p.selfHealT || 0) + dt / ((bandage ? 4 : SURVIVOR.selfHealTime) / medicK(p)));
  p.actT = p.selfHealT; p.healBandage = bandage;
  if (p.selfHealT >= 1) {
    if (bandage) p.inv.bandage--; else p.heals--;
    p.health = 2; p.selfHealT = 0; p.act = null; p.actT = 0;
    g.emit({ t: 'healed', id: p.id, name: p.name, by: p.name, self: true, bandage });
  }
}

// Quick-message wheel: run / come here / heal me / help me / monster is here. One every 20s.
export const QUICK_MSGS = ['run', 'come', 'heal', 'help', 'monster'];
export const QUICK_CD = 20;
function quickMessage(g, p, inp) {
  const a = inp.actions.find((x) => x.t === 'quick');
  if (!a || !QUICK_MSGS.includes(a.msg) || p.state === 'mouse' || p.quickCdUntil > g.time) return;
  p.quickCdUntil = g.time + QUICK_CD;
  g.emit({ t: 'quick', id: p.id, name: p.name, msg: a.msg });
}

// The old candles are gone: survivors carry an electric flashlight. "Holding a light" (which
// exposes the Mimic, shows your shadow against the Stalker, helps spot traps) = flashlight on.
function burnHeld(g, p) {
  p.holding = !!p.lightOn && p.state === 'alive';
}

function updateHooked(g, p, dt) {
  p.hookT += dt;
  p.act = null;
  if (p.isBot && (p.hookT < dt * 1.5 || (p.hookT > 35 && p.hookT < 35 + dt * 1.5))) botSay(g, p, 'hook');
  for (const a of p.input.actions) {
    // Desperate self-release attempt: 4% chance, a failure costs 10s of life.
    if (a.t === 'struggle' && !p.triedEscape) {
      p.triedEscape = true;
      if (g.random() < 0.04) {
        const h = g.state.hooks.find((h) => h.victim === p.id); if (h) h.victim = null;
        p.state = 'alive'; p.health = 1; p.hookId = null;
        g.emit({ t: 'rescued', id: p.id, name: p.name, by: p.name });
        return;
      }
      p.hookT += 10;
    }
  }
  if (p.hookT >= SURVIVOR.hangTime) {
    const h = g.state.hooks.find((h) => h.victim === p.id); if (h) h.victim = null;
    becomeMouse(g, p, 'sacrificed');
  }
}

export function becomeMouse(g, p, how) {
  // Drop carried keys where the survivor fell so others can still escape.
  for (let i = 0; i < p.keys; i++) g.state.keys.push({ id: g.nextId++, x: p.x + i * 0.5, z: p.z, taken: false });
  p.keys = 0; p.state = 'mouse'; p.act = null; p.skill = null; p.holding = false; p.carrier = null; p.hookId = null;
  g.emit({ t: 'killed', id: p.id, name: p.name, how });
}
