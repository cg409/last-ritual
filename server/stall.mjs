import { Game } from '../shared/game.js';
import { BOT_NAMES } from '../shared/constants.js';
const mon = process.argv[2] || 'wanderer';
const roster = BOT_NAMES.slice(0, 5).map((n, i) => ({ id: 'b' + i, name: n, isBot: true, monsterPref: mon, trap: 'bear' }));
const g = new Game({ seed: 1234 + mon.length, roster });
while (!g.ended && g.time < 700) { g.tick(1 / 20); g.snapshot(); if (Math.round(g.time) % 100 === 0 && g.time % 1 < 0.05) console.log(Math.round(g.time), g.survivors().map((p) => `${p.state[0]}${p.level | 0}:${g.bots.get(p.id)?.mode}/${g.bots.get(p.id)?.task} (${p.x.toFixed(0)},${p.z.toFixed(0)}) hp${p.health} act=${p.act} sk=${!!p.skill} st=${p.stuck ? 1 : 0} tr=${p.trapped ? 1 : 0} hide=${p.hideIn} lv=${p.level}`).join(' | '), 'M', g.monster.x.toFixed(0), g.monster.z.toFixed(0)); }
console.log('ended', g.ended, g.time.toFixed(0), 'tombs', g.enchantedCount());
