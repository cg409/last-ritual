// Monster rules. Phase penalties: 1 enchant = special sealed, 2 = slower + shorter reach.
import { MONSTER_BASE, MONSTERS } from './constants.js';
import { dist, angleTo, angleDiff } from './rng.js';
import { moveBody, becomeMouse } from './survivor.js';
import { useSpecial, onAimRelease, updateAiming } from './abilities.js';

export function monsterStats(g) {
  const n = g.enchantedCount();
  const weak = g.phase >= 2 || n >= 2;
  return {
    speed: MONSTER_BASE.speed * (weak ? 0.92 : 1),
    range: MONSTER_BASE.attackRange * (weak ? 0.7 : 1),
    specialSealed: g.phase >= 1,
  };
}

export function updateMonster(g, m, dt) {
  const inp = m.input;
  const st = monsterStats(g);
  const stunned = m.stunUntil > g.time;
  for (const a of inp.actions) if (!stunned) handleAction(g, m, a, st);
  updateAiming(g, m, inp, st);

  let speed = m.carrying ? MONSTER_BASE.carrySpeed : st.speed;
  if (m.aiming) speed *= 0.5;
  if (m.revUntil > g.time) speed *= 0.4;
  if (m.attackCdUntil > g.time) speed *= 0.55;
  if (stunned) speed = 0;
  m.crouch = false; m.crawl = false; m.running = false;
  moveBody(g, m, inp, speed, dt, 0.45);
  if (typeof inp.face === 'number' && !stunned) m.rot = inp.face; // first-person: body follows the camera
  if (inp.interact && !stunned) doMonsterInteract(g, m, dt); else { m.act = null; m.actT = 0; }
}

function handleAction(g, m, a, st) {
  if (a.t === 'attack') tryAttack(g, m, st);
  else if (a.t === 'special') {
    if (st.specialSealed) { g.emit({ t: 'sealed', to: m.id }); return; }
    if (m.specialCdUntil > g.time) return;
    useSpecial(g, m, a);
  } else if (a.t === 'trap') {
    if (m.traps <= 0 || m.carrying) return;
    m.traps--;
    g.state.traps.push({ id: g.nextId++, x: m.x + Math.sin(m.rot) * 0.8, z: m.z + Math.cos(m.rot) * 0.8, type: m.trap, owner: m.id });
    g.emit({ t: 'trapSet', to: m.id });
  } else if (a.t === 'rev' && m.monster === 'ravager' && m.sawUntil < g.time) {
    m.revUntil = g.time + 1.2; m.sawUntil = g.time + 7.2;
    g.emit({ t: 'saw', x: m.x, z: m.z });   // heard across the whole realm
  } else if (a.t === 'aimRelease') onAimRelease(g, m, st);
  else if (a.t === 'drop' && m.carrying) {
    const v = g.player(m.carrying); m.carrying = null;
    if (v) { v.state = 'downed'; v.carrier = null; }
  }
}

const canKill = (m) => !(m.monster === 'mimic' && m.disguise);   // disguised Mimic cannot kill

function tryAttack(g, m, st) {
  if (m.attackCdUntil > g.time || m.carrying || m.aiming || !canKill(m)) return;
  const target = g.survivors().find((p) => p.state === 'alive' && dist(m.x, m.z, p.x, p.z) < st.range &&
    Math.abs(angleDiff(m.rot, angleTo(m.x, m.z, p.x, p.z))) < 0.9);
  g.emit({ t: 'swing', id: m.id, x: m.x, z: m.z });
  if (!target) { m.attackCdUntil = g.time + 0.9; return; }
  m.attackCdUntil = g.time + MONSTER_BASE.attackCd;
  hitSurvivor(g, m, target, MONSTERS[m.monster].weapon);
}

// The Ravager only bruises until the chainsaw is revved; the chainsaw downs in one hit.
export function hitSurvivor(g, m, p, weapon) {
  if (p.state !== 'alive') return;
  const saw = m.monster === 'ravager' && m.sawUntil > g.time && m.revUntil < g.time;
  if (m.monster === 'ravager' && !saw && p.health <= 1) {
    p.slowUntil = g.time + 2;
    g.emit({ t: 'hit', id: p.id, name: p.name, weapon: 'fist', x: p.x, z: p.z });
    return;
  }
  p.health -= saw ? 2 : 1;
  p.act = null; p.skill = null; p.holding = false;
  g.emit({ t: 'hit', id: p.id, name: p.name, weapon, x: p.x, z: p.z });
  if (p.health <= 0) { p.health = 0; p.state = 'downed'; p.downT = 0; g.emit({ t: 'downed', id: p.id, name: p.name }); }
  else p.boostUntil = g.time + 2;
  if (saw) m.sawUntil = g.time;
}

function doMonsterInteract(g, m, dt) {
  const s = g.state;
  if (m.carrying) {
    const hook = s.hooks.find((h) => !h.victim && dist(m.x, m.z, h.x, h.z) < 2.4);
    if (!hook) return;
    return progress(m, 'hang', dt, () => {
      const v = g.player(m.carrying); m.carrying = null;
      if (!v) return;
      v.carrier = null; v.wiggle = 0;
      v.x = hook.x + 0.01; v.z = hook.z + 0.01;
      if (v.lives <= 1) { becomeMouse(g, v, 'hanged'); return; }
      v.lives = 1; v.state = 'hooked'; v.hookT = 0; v.hookId = hook.id; v.triedEscape = false;
      hook.victim = v.id;
      g.emit({ t: 'hooked', id: v.id, name: v.name, x: hook.x, z: hook.z });
    });
  }
  const downed = g.survivors().find((p) => p.state === 'downed' && dist(m.x, m.z, p.x, p.z) < 1.8);
  if (downed) {
    // Second life: the monster can kill instantly.
    if (downed.lives <= 1 && canKill(m)) return progress(m, 'kill', dt / 1.2, () => becomeMouse(g, downed, 'slain'));
    return progress(m, 'pickup', dt, () => {
      downed.state = 'carried'; downed.carrier = m.id; downed.wiggle = 0; m.carrying = downed.id;
      g.emit({ t: 'pickup', id: downed.id, name: downed.name });
    });
  }
  // Damage tombs: regress unfinished ones; a disguised Mimic can break enchanted, unprotected ones.
  const tomb = s.tombs.find((t) => dist(m.x, m.z, t.x, t.z) < 2.6 &&
    (t.done ? m.monster === 'mimic' && m.disguise && !t.protected : t.progress > 0.05));
  if (tomb) {
    return progress(m, 'break', dt / (tomb.done ? 3 : 1.8), () => {
      if (tomb.done) { tomb.done = false; tomb.progress = 0.6; g.emit({ t: 'broken', tomb: tomb.id, x: tomb.x, z: tomb.z }); }
      else { tomb.progress = Math.max(0, tomb.progress - 0.12); g.emit({ t: 'kicked', tomb: tomb.id }); }
      tomb.cracks = Math.min(6, tomb.cracks + 1);
    });
  }
  m.act = null; m.actT = 0;
}

function progress(m, act, amount, done) {
  if (m.act !== act) { m.act = act; m.actT = 0; }
  m.actT += amount;
  if (m.actT >= 1) { m.act = null; m.actT = 0; done(); }
}
