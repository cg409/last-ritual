// Headless sanity test: runs full bot-only matches for each monster and prints results.
import { Game } from '../shared/game.js';
import { MONSTER_IDS, BOT_NAMES } from '../shared/constants.js';

for (const mon of MONSTER_IDS) {
  const roster = BOT_NAMES.slice(0, 5).map((n, i) => ({ id: 'b' + i, name: n, isBot: true, monsterPref: mon, trap: 'bear' }));
  const g = new Game({ seed: 1234 + mon.length, roster });
  const counts = {};
  const t0 = Date.now();
  while (!g.ended && g.time < 60 * 25) {
    g.tick(1 / 20);
    const snap = g.snapshot();
    for (const e of snap.events) counts[e.t] = (counts[e.t] || 0) + 1;
  }
  console.log(`${mon.padEnd(10)} t=${g.time.toFixed(0)}s cpu=${Date.now() - t0}ms tombs=${g.enchantedCount()} result=${JSON.stringify(g.result && { w: g.result.winner, esc: g.result.escaped })}`);
  console.log('   events', JSON.stringify(counts));
}
