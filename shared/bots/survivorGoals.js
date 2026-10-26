// Survivor bot objective priorities: escape > keys > rescue > heal > protect tombs > enchant.
import { dist } from '../rng.js';

export function objective(bot, out) {
  const g = bot.g, p = bot.p, s = g.state, m = g.monster;
  bot.mode = 'objective';
  if (s.door.open) { bot.goTo(s.door.x, s.door.z + 1, out, 0.4); out.run = true; return out; }
  const freeKeys = s.keys.filter((k) => !k.taken);
  if (p.keys > 0 && (!freeKeys.length || p.keys >= 2 || bot.bravery < 0.6)) {
    if (bot.goTo(s.door.x, s.door.z + 2.5, out, 1.5)) out.interact = true;
    return out;
  }
  const key = freeKeys.sort((a, b) => dist(p.x, p.z, a.x, a.z) - dist(p.x, p.z, b.x, b.z))[0];
  if (key) { bot.goTo(key.x, key.z, out, 0.3); out.run = dist(p.x, p.z, key.x, key.z) > 6; return out; }

  // Rescue hanging teammates (brave bots go sooner, and only one bot commits)
  const hooked = g.survivors().find((o) => o.state === 'hooked' && o.hookT > 15 * (1 - bot.bravery));
  if (hooked && (bot.bravery > 0.55 || bot.closestTo(hooked))) {
    if (bot.goTo(hooked.x, hooked.z, out, 1.5)) out.interact = true; else out.run = dist(m.x, m.z, p.x, p.z) > 10;
    return out;
  }
  // Heal / revive teammates when the monster is not right there
  const hurt = g.survivors().find((o) => o !== p && (o.state === 'downed' || (o.state === 'alive' && o.health === 1)) &&
    dist(p.x, p.z, o.x, o.z) < 16 && dist(m.x, m.z, o.x, o.z) > 12);
  if (hurt && (hurt.state === 'downed' || p.health === 2)) {
    if (bot.goTo(hurt.x, hurt.z, out, 1.2)) { out.interact = true; bot.face(hurt.x, hurt.z, out); }
    return out;
  }
  // Against the Mimic, guard enchanted tombs with a placed candle
  if (m.monster === 'mimic' && p.candles.length > 1) {
    const t = s.tombs.find((t) => t.done && !t.protected && dist(p.x, p.z, t.x, t.z) < 30);
    if (t) {
      if (bot.goTo(t.x + 1.8, t.z, out, 0.6)) bot.act({ t: 'placeCandle' });
      return out;
    }
  }
  // Enchant: prefer progressed tombs, avoid the monster's area
  const tomb = s.tombs.filter((t) => !t.done)
    .map((t) => ({ t, score: dist(p.x, p.z, t.x, t.z) - t.progress * 30 + (dist(m.x, m.z, t.x, t.z) < 12 ? 60 : 0) }))
    .sort((a, b) => a.score - b.score)[0]?.t;
  if (tomb) {
    const slot = (parseInt(String(p.id).replace(/\D/g, ''), 10) || 0) % 4;
    const ox = [1.7, -1.7, 0, 0][slot], oz = [0, 0, 1.5, -1.5][slot];
    if (bot.goTo(tomb.x + ox, tomb.z + oz, out, 0.6)) { out.interact = true; bot.face(tomb.x, tomb.z, out); }
    else if (m.monster === 'wanderer' && g.state.towers.some((t) => dist(t.x, t.z, p.x, p.z) < 16)) out.crouch = true; // sneak past crows
    return out;
  }
  return out;
}
