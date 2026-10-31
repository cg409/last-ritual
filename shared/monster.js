// Monster rules. Phase penalties: 1 enchant = special sealed, 2 = slower + shorter reach.
import { MONSTER_BASE, MONSTERS, REVEAL } from './constants.js';
import { weaponStats } from './weapons.js';
import { dist, angleTo, angleDiff } from './rng.js';
import { moveBody, becomeMouse } from './survivor.js';
import { useSpecial, onAimRelease, updateAiming } from './abilities.js';
import { breakPallet } from './pallets.js';
import { trySearch } from './hides.js';

// Ranged monsters pay for their reach with speed: the Puppeteer is slower than a running
// survivor (4.3) — her strings must do the catching — and the Stalker is a little slow too.
// The Mimic is the slowest monster — she hunts with her camouflage; while disguised she moves
// exactly like a survivor so she blends in.
const SPEED = { puppeteer: [3.3, 3.75], stalker: [3.6, 4.25], mimic: [3.5, 4.4] };
const DISGUISED = [2.45, 4.3]; // = a survivor's walk / run

export function monsterStats(g) {
  const n = g.enchantedCount();
  const weak = g.phase >= 2 || n >= 2;
  const [walk, run] = g.monster?.disguise ? DISGUISED : SPEED[g.monster?.monster] || [MONSTER_BASE.speed, MONSTER_BASE.runSpeed];
  const w = weaponStats(g.monster?.weapon, g.monster?.weaponLvl), wm = g.monster?.disguise ? 1 : w.speed; // the weapon changes how fast you move (a disguised Mimic still moves like a survivor)
  return {
    speed: walk * (weak ? 0.92 : 1) * wm,
    runSpeed: run * (weak ? 0.93 : 1) * wm,
    range: MONSTER_BASE.attackRange * (weak ? 0.7 : 1) * w.range,
    specialSealed: g.phase >= 1,
    w,
  };
}

export function updateMonster(g, m, dt) {
  const inp = m.input;
  const st = monsterStats(g);
  const stunned = m.stunUntil > g.time;
  for (const a of inp.actions) if (!stunned) handleAction(g, m, a, st);
  updateAiming(g, m, inp, st);

  const lunging = m.lungeUntil > g.time && !stunned;
  const wantsMove = Math.hypot(inp.mx || 0, inp.mz || 0) > 0.1;
  const canRun = !!inp.run && wantsMove && !m.carrying && !m.aiming && !(m.revUntil > g.time);
  let speed = m.carrying ? MONSTER_BASE.carrySpeed : canRun ? st.runSpeed : st.speed;
  if (m.aiming) speed *= 0.5;
  if (m.revUntil > g.time) speed *= 0.4;
  if (m.attackCdUntil > g.time && !lunging) speed *= 0.6;   // recovering after a swing
  if (m.climbUntil > g.time) speed *= 0.35;                   // clambering over a fallen log
  if (stunned) speed = 0;
  m.crouch = false; m.crawl = false;
  m.running = canRun && !stunned;
  if (typeof inp.face === 'number' && !stunned) m.rot = inp.face; // first-person: body follows the camera
  if (lunging) {
    // Lunge: a burst forward along the facing; hits are checked every tick of the lunge.
    const r = m.rot;
    moveBody(g, m, { mx: Math.sin(r), mz: Math.cos(r), face: r }, Math.max(speed, st.runSpeed) * 1.35 * st.w.lunge, dt, 0.45);
    m.rot = r;
    lungeHit(g, m, st);
  } else moveBody(g, m, inp, speed, dt, 0.45);
  if (typeof inp.face === 'number' && !stunned) m.rot = inp.face;
  if (m.lungeUntil && m.lungeUntil <= g.time) { // lunge ended without connecting
    m.lungeUntil = 0;
    if (!m.lungeHit) m.attackCdUntil = g.time + 0.9 * st.w.cd;
  }
  if (inp.interact && !stunned) doMonsterInteract(g, m, dt); else { m.act = null; m.actT = 0; }
}

function handleAction(g, m, a, st) {
  if (a.t === 'attack') tryAttack(g, m, st);
  else if (a.t === 'special') {
    const unmask = m.monster === 'mimic' && m.disguise; // dropping a disguise is always allowed
    if (st.specialSealed && !unmask) { if (!(m.sealedMsgAt > g.time - 2)) { m.sealedMsgAt = g.time; g.emit({ t: 'sealed', to: m.id }); } return; }
    if (m.specialCdUntil > g.time) return;
    useSpecial(g, m, a);
  } else if (a.t === 'trap') {
    if (m.traps <= 0 || m.carrying) return;
    m.traps--;
    g.state.traps.push({ id: g.nextId++, x: m.x + Math.sin(m.rot) * 0.8, z: m.z + Math.cos(m.rot) * 0.8, level: m.level | 0, type: m.trap, lvl: m.trapLvl, owner: m.id });
    g.emit({ t: 'trapSet', to: m.id });
  } else if (a.t === 'rev' && st.w.rev && m.sawUntil < g.time) {
    m.revUntil = g.time + 1.2; m.sawUntil = g.time + 7.2;
    g.emit({ t: 'saw', x: m.x, z: m.z });   // heard across the whole realm
  } else if (a.t === 'aimRelease') { if (m.aiming) onAimRelease(g, m, st); else tryAttack(g, m, st); } // left click while aiming = shoot (no aim ready: a normal swing)
  else if (a.t === 'aimCancel') m.aiming = false;
  else if (a.t === 'drop' && m.carrying) {
    const v = g.player(m.carrying); m.carrying = null;
    if (v) { v.state = 'downed'; v.carrier = null; }
  }
}

const canKill = (m) => !(m.monster === 'mimic' && m.disguise);   // disguised Mimic cannot kill

// LMB starts a lunge: the monster surges forward and the strike lands on the first survivor that
// enters the arc during the lunge (so a running monster really catches a running survivor).
function tryAttack(g, m, st) {
  if (m.attackCdUntil > g.time || m.lungeUntil > g.time || m.carrying || m.aiming || !canKill(m)) return;
  m.lungeUntil = g.time + MONSTER_BASE.lunge; m.lungeHit = false;
  m.attackCdUntil = g.time + MONSTER_BASE.lunge + 0.05;
  g.emit({ t: 'swing', id: m.id, x: m.x, z: m.z });
  lungeHit(g, m, st);
}

function lungeHit(g, m, st) {
  if (m.lungeHit) return;
  const reach = st.range * 0.75; // the lunge itself closes the rest of the distance
  const target = g.survivors().find((p) => p.state === 'alive' && p.hideIn == null && (p.level | 0) === (m.level | 0) && dist(m.x, m.z, p.x, p.z) < reach &&
    Math.abs(angleDiff(m.rot, angleTo(m.x, m.z, p.x, p.z))) < 0.95);
  if (!target) return;
  m.lungeHit = true; m.lungeUntil = 0;
  m.attackCdUntil = g.time + MONSTER_BASE.attackCd * st.w.cd;
  hitSurvivor(g, m, target, m.weapon);
}

// A melee hit. What it does depends on the monster's WEAPON (shared/weapons.js): damage 1 or 2, grazes, slowing wounds, and the
// chainsaw that must be revved. Ability hits (string / trident) are always plain 1-damage hits.
export function hitSurvivor(g, m, p, weapon) {
  if (p.state !== 'alive') return;
  const melee = !['string', 'trident'].includes(weapon), w = weaponStats(m.weapon, m.weaponLvl);
  const revved = !!w.rev && m.sawUntil > g.time && m.revUntil < g.time;
  let dmg = melee ? (w.rev ? (revved ? 2 : 1) : w.dmg) : 1;
  if (melee && w.rev && !revved && p.health <= 1) { // an idle chainsaw only bruises
    p.slowUntil = g.time + 2;
    g.emit({ t: 'hit', id: p.id, name: p.name, weapon: 'fist', x: p.x, z: p.z });
    return;
  }
  if (melee && w.graze && g.random() < w.graze) { // a shallow cut
    p.slowUntil = Math.max(p.slowUntil || 0, g.time + 1);
    g.emit({ t: 'hit', id: p.id, name: p.name, weapon: 'fist', x: p.x, z: p.z });
    return;
  }
  p.health -= dmg;
  if (melee && w.slow) p.slowUntil = Math.max(p.slowUntil || 0, g.time + w.slow);
  if (m?.stats) m.stats.hits++;
  p.act = null; p.skill = null; p.holding = false; p.selfHealT = 0;
  g.emit({ t: 'hit', id: p.id, name: p.name, weapon: melee ? m.weapon : weapon, x: p.x, z: p.z });
  if (p.health <= 0) { p.health = 0; p.state = 'downed'; p.downT = 0; g.emit({ t: 'downed', id: p.id, name: p.name }); }
  else p.boostUntil = g.time + 2;
  if (revved) m.sawUntil = g.time;
}

function doMonsterInteract(g, m, dt) {
  const s = g.state;
  if (!m.carrying && breakPallet(g, m, dt)) return;
  if (!m.carrying && !g.survivors().some((p) => p.state === 'downed' && dist(m.x, m.z, p.x, p.z) < 2) && trySearch(g, m, dt, progress)) return; // open a cupboard / porta-potty
  if (m.carrying) {
    const hook = s.hooks.find((h) => !h.victim && dist(m.x, m.z, h.x, h.z) < 2.4);
    if (!hook) return;
    return progress(m, 'hang', dt, () => {
      const v = g.player(m.carrying); m.carrying = null;
      if (!v) return;
      v.carrier = null; v.wiggle = 0;
      v.x = hook.x + 0.01; v.z = hook.z + 0.01; v.level = 0; v.trapped = null;
      m.stats.hooks++;
      if (v.lives <= 1) { m.stats.kills++; becomeMouse(g, v, 'hanged'); return; }
      v.lives = 1; v.state = 'hooked'; v.hookT = 0; v.hookId = hook.id; v.triedEscape = false;
      hook.victim = v.id;
      m.auraUntil = g.time + REVEAL.hookAura; // the other survivors see the monster's aura for a moment
      g.emit({ t: 'hooked', id: v.id, name: v.name, x: hook.x, z: hook.z });
    });
  }
  // Once a pickup / kill has started the monster stays locked on that survivor (who is pinned in
  // place — see survivor.js), so a crawling victim can't slip out of reach and restart it forever.
  const busy = (m.act === 'pickup' || m.act === 'kill') && g.player(m.actTarget);
  const downed = busy && busy.state === 'downed' && dist(m.x, m.z, busy.x, busy.z) < 2.8 ? busy
    : g.survivors().find((p) => p.state === 'downed' && dist(m.x, m.z, p.x, p.z) < 1.8);
  if (downed) {
    m.actTarget = downed.id;
    // Second life: the monster can kill instantly.
    if (downed.lives <= 1 && canKill(m)) return progress(m, 'kill', dt / 1.2, () => { m.stats.kills++; becomeMouse(g, downed, 'slain'); });
    return progress(m, 'pickup', dt, () => {
      downed.state = 'carried'; downed.carrier = m.id; downed.wiggle = 0; m.carrying = downed.id;
      g.emit({ t: 'pickup', id: downed.id, name: downed.name });
    });
  }
  // Damage tombs: any monster can set back a tomb that is not fully enchanted; only a disguised
  // Mimic can break an enchanted, unprotected one.
  const tomb = s.tombs.find((t) => dist(m.x, m.z, t.x, t.z) < 2.6 &&
    (t.done ? m.monster === 'mimic' && m.disguise && !t.protected : t.progress > 0.01));
  if (tomb) {
    return progress(m, 'break', dt / (tomb.done ? 3 : 1.8), () => {
      if (tomb.done) { tomb.done = false; tomb.progress = 0.6; g.emit({ t: 'broken', tomb: tomb.id, x: tomb.x, z: tomb.z }); }
      else { tomb.progress = Math.max(0, tomb.progress - 0.2); g.emit({ t: 'kicked', tomb: tomb.id }); }
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
