import { Game } from '../shared/game.js';
import { BOT_NAMES } from '../shared/constants.js';
const roster = BOT_NAMES.slice(0, 5).map((n, i) => ({ id: 'b' + i, name: n, isBot: true, monsterPref: 'wanderer', trap: 'bear' }));
const g = new Game({ seed: 1234 + 8, roster });
for (let i = 0; i < 20 * 60; i++) g.tick(1 / 20);
const m = g.monster, s = g.survivors();
console.log('phase', g.phase, g.state.phase, 'monster', m.name, m.x.toFixed(1), m.z.toFixed(1), 'act', m.act, 'stun', m.stunUntil, 'lvl', m.level, 'state', m.state, 'input', JSON.stringify(m.input).slice(0, 120));
const bm = g.bots.get(m.id); console.log('monster bot', bm?.constructor.name, bm?.mode, JSON.stringify(bm?.clue), 'path', bm?.path?.length);
const p = s[0], b = g.bots.get(p.id); console.log('s0', p.x.toFixed(1), p.z.toFixed(1), 'input', JSON.stringify(p.input), 'path', b.path.length, 'goal', JSON.stringify(b.goal), 'task', b.task, 'tomb', JSON.stringify(g.state.tombs.map((t) => [t.x.toFixed(0), t.z.toFixed(0), t.progress])));
