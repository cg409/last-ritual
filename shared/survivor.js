// Survivor rules: movement, candles, hooked state, keys, escape. Interactions live in interact.js.
import { SURVIVOR } from './constants.js';
import { collide, inGrass } from './nav.js';
import { dist } from './rng.js';
import { doInteract, resolveSkill } from './interact.js';

const DOOR_R = 3;

export function updateSurvivor(g, p, dt) {
  const inp = p.input;
  if (p.state === 'escaped') return;
  if (p.state === 'mouse') return moveBody(g, p, inp, 2.6, dt, 0.15);
  if (p.state === 'hooked') return updateHooked(g, p, dt);
  if (p.state === 'carried') {
    if (inp.actions.some((a) => a.t === 'wiggle')) p.wiggle = Math.min(1, p.wiggle + 0.008);
    return;
  }
  if (p.state === 'downed') { p.act = null; return moveBody(g, p, inp, 0.55, dt, 0.4); }

  // ---------- alive ----------
  for (const a of inp.actions) handleAction(g, p, a);
  burnHeld(g, p, dt);
  const stuck = p.stuckUntil > g.time;
  p.crouch = !!inp.crouch; p.crawl = !!inp.crawl;
  let speed = p.crawl ? SURVIVOR.crawl : p.crouch ? SURVIVOR.crouch : inp.run ? SURVIVOR.run : SURVIVOR.walk;
  if (p.boostUntil > g.time) speed = Math.max(speed, SURVIVOR.run * 1.25);
  if (p.slowUntil > g.time) speed *= 0.6;
  if (stuck) speed = 0;

  const wantsMove = Math.hypot(inp.mx || 0, inp.mz || 0) > 0.1;
  if (inp.interact && !wantsMove && !stuck) doInteract(g, p, dt);
  else if (!stuck) { p.act = null; p.actT = 0; p.skill = null; }
  if (p.act) speed = 0;
  p.running = !!inp.run && wantsMove && !p.crouch && !p.crawl && speed > SURVIVOR.walk;
  moveBody(g, p, inp, speed, dt, 0.4);
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

export function moveBody(g, p, inp, speed, dt, radius) {
  let mx = inp.mx || 0, mz = inp.mz || 0;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  p.moving = len > 0.1 && speed > 0;
  p.speed = p.moving ? speed * Math.min(1, len) : 0;
  if (p.moving) {
    const c = collide(g.map, p.x + mx * speed * dt, p.z + mz * speed * dt, radius);
    p.x = c.x; p.z = c.z;
    p.rot = Math.atan2(mx, mz);
  } else if (typeof inp.face === 'number') p.rot = inp.face;
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
    resolveSkill(g, p, a.result);
  }
}

function burnHeld(g, p, dt) {
  if (!p.holding || !p.candles.length) { p.holding = false; return; }
  const rate = g.monster.monster === 'stalker' ? 0.5 : 1; // candles last twice as long vs the Stalker
  if (!g.isBlackout()) p.candles[0] -= dt * rate;
  if (p.candles[0] <= 0) { p.candles.shift(); p.holding = false; g.emit({ t: 'candleOut', id: p.id }); }
}

function updateHooked(g, p, dt) {
  p.hookT += dt;
  p.act = null;
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
