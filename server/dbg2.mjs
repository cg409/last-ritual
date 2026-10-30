import { Game } from '../shared/game.js';
import { BOT_NAMES } from '../shared/constants.js';
const roster = BOT_NAMES.slice(0, 5).map((n, i) => ({ id: 'b' + i, name: n, isBot: true, monsterPref: 'wanderer', trap: 'bear' }));
const g = new Game({ seed: 1234 + 8, roster });
for (let i = 0; i < 20 * 60; i++) g.tick(1 / 20);
const m = g.monster;
console.log('monster', m.x, m.z, 'lv', m.level, 'y', m.y, 'hide', m.hideIn, 'actions?', m.act, m.stuckUntil, m.stunUntil, g.time);
console.log(g.map.rects.filter((r) => Math.abs(r.x - m.x) < r.hw + 1.2 && Math.abs(r.z - m.z) < r.hd + 1.2).map((r) => JSON.stringify(r)).join('\n'));
console.log(g.map.circles.filter((c) => Math.hypot(c.x - m.x, c.z - m.z) < c.r + 1.2).map((r) => JSON.stringify(r)).join('\n'));

console.log('logs', JSON.stringify((g.map.logs||[]).filter((l)=>Math.hypot(l.x-m.x,l.z-m.z)<4)), 'dyn', JSON.stringify(g.map.dyn||[]).slice(0,300)); console.log('buildings', g.map.buildings.map((b)=>[b.type,b.x,b.z,b.w,b.d].join(',')).join(' | '));
