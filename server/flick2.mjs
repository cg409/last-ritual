import { Game } from '../shared/game.js';
import { BOT_NAMES } from '../shared/constants.js';
import { dist } from '../shared/rng.js';
import { inSight } from '../shared/bots/perception.js';
const roster = BOT_NAMES.slice(0, 5).map((n, i) => ({ id: 'b' + i, name: n, isBot: true, monsterPref: 'wanderer', trap: 'bear' }));
const g = new Game({ seed: 77 + 8, roster });
let prev = '', n = 0;
while (!g.ended && g.time < 300 && n < 30) { g.tick(1 / 20); const b = [...g.bots.values()].find((x) => x.p.role === 'survivor'); if (!b) break; const p = b.p, m = g.monster; const key = b.mode + '/' + (p.input.crouch ? 'c' : '') + (p.input.run ? 'r' : ''); if (key !== prev && g.time > 30) { console.log(g.time.toFixed(1), key.padEnd(12), 'md', dist(p.x, p.z, m.x, m.z).toFixed(1), 'seen', inSight(g, p, m), 'watched', inSight(g, m, p), 'fear', b.fearT.toFixed(2), 'task', b.task); prev = key; n++; } }
