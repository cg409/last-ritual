import { Game } from '../shared/game.js';
import { BOT_NAMES } from '../shared/constants.js';
const roster = BOT_NAMES.slice(0, 5).map((n, i) => ({ id: 'b' + i, name: n, isBot: true, monsterPref: 'ravager', trap: 'bear' }));
const g = new Game({ seed: 1234 + 7, roster });
const jumps = {}, where = {};
while (!g.ended && g.time < 600) { g.tick(1 / 20); for (const e of g.snapshot().events) if (e.t === 'jump') { jumps[e.id] = (jumps[e.id] || 0) + 1; const b = g.bots.get(e.id); where[e.id] = `${b?.task} mode=${b?.mode} at ${g.player(e.id).x.toFixed(0)},${g.player(e.id).z.toFixed(0)} lv${g.player(e.id).level} t=${g.time.toFixed(0)}`; } }
console.log(JSON.stringify(jumps), JSON.stringify(where, null, 1), g.ended, g.time);
const up = g.map.chests.filter((c) => c.lv).map((c) => [c.x.toFixed(0), c.z.toFixed(0)]); console.log('up chests', JSON.stringify(up));
