// Survivor NPC objectives, like a team of humans splitting the work: escape > keys > rescue > heal >
// enchant (each takes its own tomb where possible) > open nearby chests > explore. Nobody walks in
// a line behind the others: tasks are claimed, and the same tomb only gets a second worker when the
// others are taken.
import { dist } from '../rng.js';
import { inSight } from './perception.js';

// What the other NPC survivors are busy with (tomb ids they claimed).
function claims(g, me) {
  const out = new Map();
  for (const [id, bot] of g.bots) {
    if (id === me.p.id || !bot.task) continue;
    out.set(bot.task, (out.get(bot.task) || 0) + 1);
  }
  return out;
}

export function objective(bot, out) {
  const g = bot.g, p = bot.p, s = g.state, m = g.monster;
  bot.mode = 'objective';
  if (s.door.open) { bot.task = 'door'; bot.goTo(s.door.x, s.door.z + 1, out, 0.4, 0); out.run = true; return out; }
  const freeKeys = s.keys.filter((k) => !k.taken);
  if (p.keys > 0 && (!freeKeys.length || p.keys >= 2 || bot.bravery < 0.6)) {
    bot.task = 'gate';
    if (bot.goTo(s.door.x, s.door.z + 2.5, out, 1.5, 0)) out.interact = true;
    return out;
  }
  const taken = claims(g, bot);
  // keys: each NPC goes for a different one
  const key = freeKeys.filter((k) => !taken.get('key' + k.id) || freeKeys.length === 1)
    .sort((a, b) => dist(p.x, p.z, a.x, a.z) - dist(p.x, p.z, b.x, b.z))[0];
  if (key) { bot.task = 'key' + key.id; bot.goTo(key.x, key.z, out, 0.3, 0); out.run = dist(p.x, p.z, key.x, key.z) > 6; return out; }

  // Rescue hanging teammates (one NPC commits, brave ones go sooner)
  const hooked = g.survivors().find((o) => o.state === 'hooked' && o.hookT > 12 * (1 - bot.bravery));
  const av = bot.avoid && g.time < bot.avoid.until ? bot.avoid : null; // where the monster was just seen
  const nearAv = (o, r = 15) => av && dist(av.x, av.z, o.x, o.z) < r;
  if (hooked && !nearAv(hooked) && (!taken.get('rescue' + hooked.id) && (bot.bravery > 0.5 || bot.closestTo(hooked)))) {
    bot.task = 'rescue' + hooked.id;
    // don't walk into the monster's arms: wait in cover if it is camping in sight
    if (inSight(g, p, m) && dist(m.x, m.z, hooked.x, hooked.z) < 9 && !(m.monster === 'mimic' && m.disguise)) { out.crouch = true; return out; }
    if (bot.goTo(hooked.x, hooked.z, out, 1.5, 0)) out.interact = true; else out.run = true;
    return out;
  }
  // Heal / revive teammates I can see (and the monster isn't right there)
  const hurt = g.survivors().find((o) => o !== p && o.hideIn == null && (o.state === 'downed' || (o.state === 'alive' && o.health === 1)) &&
    dist(p.x, p.z, o.x, o.z) < 16 && (o.state === 'downed' || inSight(g, p, o)) && !taken.get('heal' + o.id));
  if (hurt && (hurt.state === 'downed' || p.health === 2)) {
    bot.task = 'heal' + hurt.id;
    if (bot.goTo(hurt.x, hurt.z, out, 1.2, hurt.level | 0)) { out.interact = true; bot.face(hurt.x, hurt.z, out); }
    return out;
  }
  // A chest in view close by: open it (bandages, batteries, coins…)
  const chest = (s.chests || []).find((c) => !c.opened && (c.lv | 0) === (p.level | 0) && dist(p.x, p.z, c.x, c.z) < 9 && !taken.get('chest' + c.id) && !nearAv(c) && !bot.badChest?.has(String(c.id)));
  if (chest && bot.bravery > 0.3) {
    bot.task = 'chest' + chest.id;
    if (bot.goTo(chest.x, chest.z, out, 1.1, chest.lv | 0)) { out.interact = true; bot.face(chest.x, chest.z, out); }
    return out;
  }
  // Some NPCs go looting: they know the hiding spots (upstairs, dark corners) and walk there when it is quiet.
  // (start only when the monster is far; keep going until it gets much closer - no dithering at the threshold)
  const md0 = dist(p.x, p.z, m.x, m.z), going = typeof bot.task === 'string' && bot.task.startsWith('chest');
  if (bot.chestQuest && !av && md0 > (going ? 14 : 30) && bot.bravery > 0.4 && !(bot.chestQuestOff > g.time)) {
    const far = (s.chests || []).filter((c) => !c.opened && !taken.get('chest' + c.id) && dist(p.x, p.z, c.x, c.z) < 55 && !bot.badChest?.has(String(c.id)))
      .sort((a, b) => dist(p.x, p.z, a.x, a.z) - dist(p.x, p.z, b.x, b.z))[0];
    if (far) {
      bot.task = 'chest' + far.id;
      if (bot.goTo(far.x, far.z, out, 1.1, far.lv | 0)) { out.interact = true; bot.face(far.x, far.z, out); }
      return out;
    }
  }
  // Enchant: my own tomb if possible, favouring progress, avoiding where the monster was last seen
  const danger = bot.seenAt && g.time - bot.seenAt.t < 30 ? bot.seenAt : null;
  const open = s.tombs.filter((t) => !t.done), safeTombs = open.filter((t) => !nearAv(t));
  const pick = (av && !safeTombs.length ? [] : (safeTombs.length ? safeTombs : open))
    .map((t) => ({ t, score: dist(p.x, p.z, t.x, t.z) - t.progress * 25 + (taken.get('tomb' + t.id) || 0) * 40 + (danger && dist(danger.x, danger.z, t.x, t.z) < 14 ? 50 : 0) }))
    .sort((a, b) => a.score - b.score)[0]?.t;
  if (pick) {
    bot.task = 'tomb' + pick.id;
    const slot = (parseInt(String(p.id).replace(/\D/g, ''), 10) || 0) % 4;
    const ox = [1.7, -1.7, 0, 0][slot], oz = [0, 0, 1.5, -1.5][slot];
    if (bot.goTo(pick.x + ox, pick.z + oz, out, 0.6, 0)) { out.interact = true; bot.face(pick.x, pick.z, out); }
    else if (m.monster === 'wanderer' && g.state.towers?.some((t) => dist(t.x, t.z, p.x, p.z) < 8)) out.crouch = true; // sneak past crows
    return out;
  }
  bot.task = null;
  if (av && open.length && dist(p.x, p.z, av.x, av.z) < 28) bot.sneakAway(av, out); // every tomb is guarded right now: back off quietly and wait
  return out;
}
