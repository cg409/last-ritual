import { Game } from '../shared/game.js';
import { BOT_NAMES, SKINS } from '../shared/constants.js';
const roster = [{ id: 'm', name: 'M', monsterPref: 'stalker', weapon: 'axe' }, ...BOT_NAMES.slice(0, 4).map((n, i) => ({ id: 's' + i, name: n, skin: SKINS[i + 1].id }))];
const g = new Game({ seed: 5, roster, forceMonster: 'm' }); const m = g.monster; m.stunUntil = 0; g.time = 40; m.tridentCdUntil = 0; g.phase = 0;
for (const p of g.survivors()) { p.x = 90; p.z = 90; }
const idle = () => { for (const p of g.survivors()) g.setInput(p.id, { mx: 0, mz: 0, actions: [] }); };
for (let i = 0; i < 12; i++) { g.setInput('m', { mx: 0, mz: 0, aim: true, face: 0, actions: [] }); idle(); g.tick(0.05); }
console.log('aiming', m.aiming);
g.setInput('m', { mx: 0, mz: 0, aim: true, face: 0, actions: [{ t: 'aimRelease' }] }); idle(); g.tick(0.05);
console.log('projectiles after LMB-fire', g.state.projectiles.length);
g.setInput('m', { mx: 0, mz: 0, aim: false, actions: [] }); idle(); g.tick(0.05);
// cancel path
g.state.projectiles.length = 0; m.tridentCdUntil = 0;
for (let i = 0; i < 12; i++) { g.setInput('m', { mx: 0, mz: 0, aim: true, face: 0, actions: [] }); idle(); g.tick(0.05); }
g.setInput('m', { mx: 0, mz: 0, aim: false, actions: [{ t: 'aimCancel' }] }); idle(); g.tick(0.05);
console.log('after RMB release (cancel): aiming', m.aiming, 'projectiles', g.state.projectiles.length);
