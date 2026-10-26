// Contextual interaction prompt text + progress for the local player.
import { dist } from '@shared/rng.js';

const K = (k) => `<span class="key">${k}</span>`;

export function prompts(s, me, view) {
  const r = { text: '', prog: null };
  if (me.role === 'survivor') {
    if (me.state === 'hooked') { r.text = `Hanging… ${Math.max(0, 60 - me.hookT).toFixed(0)}s · ${K('SPACE')} struggle (once, 4% chance)`; r.prog = 1 - me.hookT / 60; return r; }
    if (me.state === 'carried') { r.text = `Wiggle free! Tap ${K('A')} ${K('D')}`; r.prog = me.wiggle; return r; }
    if (me.state === 'downed') { r.text = 'You are down. Crawl to an ally… they can revive you.'; return r; }
    if (me.state !== 'alive') return r;
    if (me.stuck) { r.text = 'Caught!'; return r; }
    if (me.act) {
      const label = { enchant: 'Enchanting the tomb', rescue: 'Cutting them down', heal: 'Tending wounds', door: 'Placing keys', disarm: 'Disarming trap' }[me.act] || '';
      r.text = label; r.prog = me.actT; return r;
    }
    const near = (x, z, d) => dist(me.x, me.z, x, z) < d;
    if (me.keys && !s.door.open && near(s.door.x, s.door.z, 5)) r.text = `${K('E')} Place keys in the gate`;
    else if (s.players.some((p) => p.state === 'hooked' && near(p.x, p.z, 2.4))) r.text = `${K('E')} Cut them down`;
    else if (s.players.some((p) => p.id !== me.id && p.role === 'survivor' && (p.state === 'downed' || (p.state === 'alive' && p.health === 1)) && near(p.x, p.z, 1.8))) r.text = `${K('E')} Heal`;
    else if (s.tombs.some((t) => !t.done && near(t.x, t.z, 2.4))) r.text = `${K('E')} Enchant the tomb`;
    else if (s.candles.some((c) => near(c.x, c.z, 1.8))) r.text = `${K('V')} Light / snuff candle · ${K('G')} pick up yours`;
    return r;
  }
  // Monster
  if (me.stunned) { r.text = 'Stunned!'; return r; }
  if (me.act) { r.text = { hang: 'Hanging', pickup: 'Lifting', kill: 'Killing', break: 'Desecrating the tomb' }[me.act]; r.prog = me.actT; return r; }
  const near = (x, z, d) => dist(me.x, me.z, x, z) < d;
  if (me.carrying) r.text = view.map.hooks.some((h) => near(h.x, h.z, 2.4)) ? `${K('E')} Hang them` : 'Carry them to the gallows… (Z to drop)';
  else {
    const d = s.players.find((p) => p.state === 'downed' && near(p.x, p.z, 1.8));
    if (d) r.text = d.lives <= 1 && !me.disguise ? `${K('E')} Kill` : `${K('E')} Pick up`;
    else if (s.tombs.some((t) => near(t.x, t.z, 2.6) && (t.done ? me.monster === 'mimic' && me.disguise && !t.protected : t.progress > 0.05))) r.text = `${K('E')} Damage the tomb`;
  }
  if (me.monster === 'mimic' && me.disguise) r.text = (r.text ? r.text + ' · ' : '') + 'Disguised: you cannot kill';
  return r;
}
