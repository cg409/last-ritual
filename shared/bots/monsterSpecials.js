// How the monster bot decides to use each monster's special / aimed ability.
import { dist, angleTo } from '../rng.js';

export function useSpecials(bot, out, st, tgt) {
  const g = bot.g, m = bot.p;
  const ready = !st.specialSealed && m.specialCdUntil < g.time;
  const d = tgt ? dist(m.x, m.z, tgt.x, tgt.z) : 99;
  switch (m.monster) {
    case 'mimic':
      // Disguise while patrolling so it can approach and sabotage; avoid lamps.
      if (ready && !m.disguise && !tgt) bot.act({ t: 'special' });
      break;
    case 'wanderer':
      if (ready && g.lastScreech && g.time - g.lastScreech.at < 4 && dist(m.x, m.z, g.lastScreech.x, g.lastScreech.z) > 20) bot.act({ t: 'special' });
      break;
    case 'puppeteer':
      if (ready && tgt && d > 8 && d < 18) bot.act({ t: 'special' });
      if (tgt && d < 7.5 && d > 2.5 && m.stringCdUntil < g.time) aim(bot, out, tgt, 0.5);
      else if (m.aiming) { out.aim = false; bot.act({ t: 'aimRelease' }); }
      break;
    case 'ravager':
      if (ready && !tgt && g.random() < 0.01) bot.act({ t: 'special' });
      break;
    case 'stalker':
      if (!st.specialSealed && tgt && d > 5 && d < 20 && m.tridentCdUntil < g.time && tgt.state === 'alive') aim(bot, out, tgt, 0.8);
      else if (m.aiming) { out.aim = false; bot.act({ t: 'aimRelease' }); }
      break;
  }
}

function aim(bot, out, tgt, hold) {
  const g = bot.g, m = bot.p;
  out.aim = true;
  out.mx = 0; out.mz = 0;
  // Bots aim with a small error so throws can miss.
  const err = (g.random() - 0.5) * 0.25 * (1.2 - bot.skill);
  out.face = angleTo(m.x, m.z, tgt.x + Math.sin(tgt.rot) * tgt.speed * 0.3, tgt.z + Math.cos(tgt.rot) * tgt.speed * 0.3) + err;
  if (m.aiming && g.time - m.aimStartT > hold) { out.aim = false; bot.act({ t: 'aimRelease' }); }
}
