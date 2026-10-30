// Contextual interaction prompt text + progress for the local player.
import { dist } from '@shared/rng.js';
import { SURVIVOR, CHESTS } from '@shared/constants.js';
import { isTouch } from '../touch.js';

const K = (k) => `<span class="key">${k}</span>`;

export function prompts(s, me, view) {
  const r = { text: '', prog: null };
  if (me.role === 'survivor') {
    if (me.state === 'hooked') { r.text = `Hanging… ${Math.max(0, 60 - me.hookT).toFixed(0)}s · ${isTouch ? 'tap the screen to struggle' : K('SPACE') + ' struggle'} (once, 4% chance)`; r.prog = 1 - me.hookT / 60; return r; }
    if (me.state === 'carried') { r.text = isTouch ? 'Wiggle free! Tap the screen again and again' : `Wiggle free! Tap ${K('A')} ${K('D')}`; r.prog = me.wiggle; return r; }
    if (me.state === 'downed') { r.text = 'You are down. Crawl to an ally… they can revive you.'; return r; }
    if (me.state !== 'alive') return r;
    const near = (x, z, d) => dist(me.x, me.z, x, z) < d;
    if (me.hideIn != null) { r.text = `Hiding in the ${view.map.hides[me.hideIn]?.kind === 'potty' ? 'porta-potty' : 'cupboard'} · hold your breath… · ${K('E')} climb out`; return r; }
    if (me.fallen) { r.text = 'You tripped! Getting up…'; r.prog = me.fallK; return r; }
    if (me.trapped) { r.text = `Caught in a foothold trap! ${isTouch ? 'Tap the screen' : 'Press ' + K('SPACE')} on the skill checks to pry it open (${me.trapped.passed}/2)`; return r; }
    if (me.stuck) { r.text = 'Caught!'; return r; }
    if (me.act) {
      const chest = me.act === 'chest' && view.map.chests.find((c) => near(c.x, c.z, 1.6));
      const label = { hide: 'Climbing in…', enchant: 'Enchanting the tomb', rescue: 'Cutting them down', heal: 'Tending wounds', door: 'Placing keys', disarm: 'Disarming trap',
        chest: `Opening the ${CHESTS[chest?.tier || 'supply'].name.toLowerCase()}…`,
        selfheal: me.healBandage ? 'Binding your wounds with a bandage… don\'t move'
          : `Mending your wounds… ${Math.ceil((1 - me.actT) * SURVIVOR.selfHealTime)}s · don't move` }[me.act] || '';
      r.text = label; r.prog = me.actT; return r;
    }
    const healHint = me.health === 1 && (me.heals > 0 || me.inv?.bandage > 0)
      ? `${K('H')} hold to ${me.inv?.bandage > 0 ? 'use a bandage (4s)' : `self-heal (${me.heals} left${me.selfHealT > 0 ? `, ${Math.round(me.selfHealT * 100)}% done` : ''})`}` : '';
    const pal = (me.level | 0) === 0 && view.map.pallets.find((p, i) => s.pallets?.[i]?.state === 'up' && near(p.x, p.z, 1.7));
    const palDown = view.map.pallets.find((p, i) => s.pallets?.[i]?.state === 'down' && near(p.x, p.z, 1.6));
    if (pal) r.text = pal.kind === 'log' ? `${K('E')} Push the log down` : `${K('E')} Drop the pallet`;
    else if (palDown) r.text = `${K('SPACE')} ${palDown.kind === 'log' ? 'Jump the log' : 'Vault the pallet'}`;
    else if (me.keys && !s.door.open && near(s.door.x, s.door.z, 5)) r.text = `${K('E')} Place keys in the gate`;
    else if (s.players.some((p) => p.state === 'hooked' && near(p.x, p.z, 2.4))) r.text = `${K('E')} Cut them down`;
    else if (s.players.some((p) => p.id !== me.id && p.role === 'survivor' && (p.state === 'downed' || (p.state === 'alive' && p.health === 1)) && near(p.x, p.z, 1.8))) r.text = `${K('E')} Heal`;
    else if (view.map.chests.some((c, i) => !s.chests?.[i]?.opened && (c.lv | 0) === (me.level | 0) && near(c.x, c.z, 1.5))) {
      const c = view.map.chests.find((c, i) => !s.chests?.[i]?.opened && (c.lv | 0) === (me.level | 0) && near(c.x, c.z, 1.5));
      r.text = `${K('E')} Open the ${CHESTS[c.tier].name.toLowerCase()}`;
    } else if ((view.map.hides || []).some((h) => (h.level | 0) === (me.level | 0) && near(h.ex, h.ez, 1.25))) {
      const h = view.map.hides.find((h) => (h.level | 0) === (me.level | 0) && near(h.ex, h.ez, 1.25));
      r.text = s.players.some((p) => p.hideIn === h.id) ? 'Someone is hiding in there' : `${K('E')} Hold to hide in the ${h.kind === 'potty' ? 'porta-potty' : 'cupboard'}`;
    } else if (s.tombs.some((t) => !t.done && near(t.x, t.z, 2.4))) r.text = `${K('E')} Enchant the tomb`;
    else if ((view.map.windows || []).some((w) => near(w.x, w.z, 1.6))) r.text = `${K('SPACE')} Vault through the window`;
    if (healHint) r.text = r.text ? `${r.text} · ${healHint}` : healHint;
    return r;
  }
  // Monster
  if (me.stunned) { r.text = 'Stunned!'; return r; }
  if (me.act) { r.text = { hang: 'Hanging', pickup: 'Lifting', kill: 'Killing', break: 'Desecrating the tomb', smash: 'Smashing the pallet', search: 'Yanking the door open…' }[me.act]; r.prog = me.actT; return r; }
  const near = (x, z, d) => dist(me.x, me.z, x, z) < d;
  if (!me.carrying && view.map.pallets.some((p, i) => p.kind !== 'log' && s.pallets?.[i]?.state === 'down' && near(p.x, p.z, 2.0))) r.text = `${K('E')} Smash the pallet`;
  else if (me.carrying) r.text = view.map.hooks.some((h) => near(h.x, h.z, 2.4)) ? `${K('E')} Hang them` : 'Carry them to the gallows… (Z to drop)';
  else {
    const d = s.players.find((p) => p.state === 'downed' && near(p.x, p.z, 1.8));
    if (d) r.text = d.lives <= 1 && !me.disguise ? `${K('E')} Kill` : `${K('E')} Pick up`;
    else if (s.tombs.some((t) => near(t.x, t.z, 2.6) && (t.done ? me.monster === 'mimic' && me.disguise && !t.protected : t.progress > 0.01))) r.text = `${K('E')} Damage the tomb (undo their rite)`;
    else if ((view.map.hides || []).some((h) => (h.level | 0) === (me.level | 0) && near(h.ex, h.ez, 1.45))) r.text = `${K('E')} Hold to search the ${view.map.hides.find((h) => near(h.ex, h.ez, 1.45)).kind === 'potty' ? 'porta-potty' : 'cupboard'}`;
  }
  if (me.monster === 'mimic' && me.disguise) r.text = (r.text ? r.text + ' · ' : '') + 'Disguised: you cannot kill';
  return r;
}
