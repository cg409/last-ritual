import { Game } from '../shared/game.js';
import { MONSTER_IDS, SKINS } from '../shared/constants.js';
import { generateMap } from '../shared/map.js';
const roster = Array.from({ length: 5 }, (_, i) => ({ id: 'p' + i, name: 'P' + i, isBot: i > 0, skin: SKINS[i].id, monsterPref: MONSTER_IDS[0], trap: 'bear' }));
for (let k = 0; k < 4; k++) { const t = performance.now(); new Game({ roster }); console.log('new Game ms', (performance.now() - t).toFixed(0)); }
const t = performance.now(); generateMap(12345); console.log('generateMap alone ms', (performance.now() - t).toFixed(0));
