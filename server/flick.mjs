import { Game } from '../shared/game.js';
import { BOT_NAMES } from '../shared/constants.js';
for (const mon of ['wanderer', 'ravager', 'stalker']) {
  const roster = BOT_NAMES.slice(0, 5).map((n, i) => ({ id: 'b' + i, name: n, isBot: true, monsterPref: mon, trap: 'bear' }));
  const g = new Game({ seed: 77 + mon.length, roster });
  const last = {}, ent = {}; let quick = 0, total = 0;
  while (!g.ended && g.time < 600) { g.tick(1 / 20); for (const [id, b] of g.bots) { if (b.p.role !== 'survivor') continue; const fl = b.mode !== 'objective'; const was = last[id]; if (fl && !was?.fl) { total++; if (was && g.time - was.t < 2) quick++; } last[id] = { fl, t: fl ? (was?.t ?? g.time) : (was?.fl ? g.time : was?.t ?? 0) }; } }
  console.log(mon, 'flee entries', total, 're-entries within 2s of the last flee', quick, 'ended', g.ended, g.time.toFixed(0));
}


