// How the monster NPC uses each monster's special / aimed ability — only on what it can see.
import { dist, angleTo } from '../rng.js';

export function useSpecials(bot, out, st, tgt) {
  const g = bot.g, m = bot.p;
  const ready = !st.specialSealed && m.specialCdUntil < g.time;
  const d = tgt ? dist(m.x, m.z, tgt.x, tgt.z) : 99;
  switch (m.monster) {
    case 'mimic':
      // Put on a friend's face while hunting unseen; it drops the disguise itself to strike (chase()).
      if (ready && !m.disguise && !tgt && !m.carrying) bot.act({ t: 'special' });
      break;
    case 'wanderer':
      if (ready && g.lastScreech && g.time - g.lastScreech.at < 4 && dist(m.x, m.z, g.lastScreech.x, g.lastScreech.z) > 20) bot.act({ t: 'special' });
      break;
    case 'puppeteer':
      // Blackout when a chase drags on at range; strings at anyone within reach.
      if (ready && tgt && d > 9 && d < 18) bot.act({ t: 'special' });
      if (tgt && d < 7.5 && d > 2.2 && m.stringCdUntil < g.time) aim(bot, out, tgt, 0.45);
      else if (m.aiming) { out.aim = false; bot.act({ t: 'aimRelease' }); }
      break;
    case 'ravager':
      // Lost them: Blood Trail shows the footprints of everyone nearby.
      if (ready && !tgt && (bot.search || (bot.lastSeen && g.time - bot.lastSeen.t < 6))) bot.act({ t: 'special' });
      break;
    case 'stalker':
      // Aiming calls the lightning at once; it holds the aim ~2s before throwing, so survivors who
      // see the strike have a fair moment to react (break line of sight, zig-zag).
      if (!st.specialSealed && tgt && d > 5 && d < 22 && m.tridentCdUntil < g.time && tgt.state === 'alive') {
        if (!m.aiming) bot.throwHold = 1.6 + g.random() * 0.6;
        aim(bot, out, tgt, bot.throwHold || 2);
      } else if (m.aiming) out.aim = false; // target lost: lower the trident without throwing
      break;
  }
}

// Aim like a human: at where the target was a moment ago (reaction lag), leading by its old
// velocity — a survivor who changes direction (zig-zag) makes the shot miss.
function aim(bot, out, tgt, hold) {
  const g = bot.g, m = bot.p;
  out.aim = true;
  out.mx = 0; out.mz = 0;
  const lag = 0.35 + (1 - bot.skill) * 0.25, s = bot.stale(tgt, lag);
  const d = dist(m.x, m.z, s.x, s.z), lead = m.monster === 'stalker' ? d / 26 : 0.12;
  const err = (g.random() - 0.5) * 0.12 * (1.2 - bot.skill);
  out.face = angleTo(m.x, m.z, s.x + s.vx * (lag + lead), s.z + s.vz * (lag + lead)) + err;
  if (m.aiming && g.time - m.aimStartT > hold) { out.aim = false; bot.act({ t: 'aimRelease' }); }
}
