import { Game } from '../shared/game.js';
import { MONSTER_IDS, SKINS, TRAPS } from '../shared/constants.js';
const roster = Array.from({ length: 5 }, (_, i) => ({ id: 'p' + i, name: 'P' + i, isBot: i > 0, skin: SKINS[i].id, monsterPref: MONSTER_IDS[0], trap: 'bear' }));
const g = new Game({ roster });
for (let i = 0; i < 400; i++) g.tick(1 / 20);
const s = JSON.stringify(g.snapshot());
console.log('snapshot bytes', s.length, 'keys', Object.keys(g.snapshot()).map((k) => k + ':' + JSON.stringify(g.snapshot()[k]).length).join(' '));
let t = performance.now(); for (let i = 0; i < 200; i++) { g.tick(1 / 20); JSON.stringify(g.snapshot()); } console.log('ms per tick+snapshot', ((performance.now() - t) / 200).toFixed(2));
