import { Game } from '../shared/game.js';
import { BOT_NAMES } from '../shared/constants.js';
const roster = BOT_NAMES.slice(0, 5).map((n, i) => ({ id: 'b' + i, name: n, isBot: true, monsterPref: 'wanderer', trap: 'bear' }));
const g = new Game({ seed: 1234 + 8, roster });
for (let i = 0; i < 20 * 130; i++) { g.tick(1 / 20); if (i % 100 === 0 && i > 20 * 40) { const s = g.survivors().filter((p) => g.bots.has(p.id) && p.role === 'survivor'); const p = s[2], b = g.bots.get(p.id); console.log((i / 20).toFixed(0), p.x.toFixed(1), p.z.toFixed(1), b.mode, b.task, 'goal', b.goal && [b.goal.x.toFixed(0), b.goal.z.toFixed(0), b.goal.level], 'path', b.path.length, 'stuckT', b.stuckT.toFixed(2), 'in', p.input.mx?.toFixed(2), p.input.mz?.toFixed(2)); } }
const c = g.map.chests.filter((c) => c.lv).map((c) => [c.x.toFixed(0), c.z.toFixed(0)]); console.log('up chests', JSON.stringify(c), 'stairs', JSON.stringify(g.map.buildings[0].stair));
