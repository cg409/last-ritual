// Weapon schedule test: every weapon on one monster - damage per hit, move speed, swing time, special rules.
import { Game } from '../shared/game.js';
import { WEAPON_IDS, WEAPONS } from '../shared/weapons.js';
import { BOT_NAMES, SKINS } from '../shared/constants.js';

let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS  ' : 'FAIL  ') + m); };
const make = (weapon, lvl = 1) => {
  const roster = [{ id: 'm', name: 'M', isBot: false, monsterPref: 'wanderer', weapon, weaponLvl: lvl }, ...BOT_NAMES.slice(0, 4).map((n, i) => ({ id: 's' + i, name: n, isBot: false, skin: SKINS[i + 1].id }))];
  const g = new Game({ seed: 99, roster, forceMonster: 'm' });
  g.monster.stunUntil = 0; g.time = 20;
  for (const p of g.survivors()) { p.x = -100 - p.x * 0; p.z = 100; }
  return g;
};
const idle = (g) => { for (const p of g.state.players) if (!p.isBot && p.role === 'survivor') g.setInput(p.id, { mx: 0, mz: 0, actions: [] }); };
const rows = [];
for (const id of WEAPON_IDS) {
  const g = make(id), m = g.monster, s = g.survivors()[0];
  ok(m.weapon === id, `${id}: monster carries it`);
  // speed
  m.x = 0; m.z = 0; s.x = 40; s.z = 40;
  const x0 = m.x; for (let i = 0; i < 20; i++) { g.setInput('m', { mx: 1, mz: 0, run: true, actions: [] }); idle(g); g.tick(0.05); }
  const run = (m.x - x0) / 1.0;
  // hit
  const g2 = make(id), m2 = g2.monster, s2 = g2.survivors()[0];
  m2.x = 0; m2.z = 0; m2.rot = 0; s2.x = 0; s2.z = 1.4; s2.health = 2;
  if (WEAPONS[id].rev) { g2.setInput('m', { mx: 0, mz: 0, actions: [{ t: 'rev' }] }); idle(g2); for (let i = 0; i < 30; i++) { g2.setInput('m', { mx: 0, mz: 0, actions: [] }); idle(g2); g2.tick(0.05); } }
  let t0 = g2.time; g2.setInput('m', { mx: 0, mz: 0, face: 0, actions: [{ t: 'attack' }] }); idle(g2);
  let hitAt = null;
  for (let i = 0; i < 60 && hitAt == null; i++) { g2.tick(0.05); if (s2.health < 2 || s2.state !== 'alive' || (s2.slowUntil > g2.time)) hitAt = g2.time; g2.setInput('m', { mx: 0, mz: 0, face: 0, actions: [] }); idle(g2); }
  // second swing availability
  const cdLeft = m2.attackCdUntil - g2.time;
  rows.push(`${id.padEnd(9)} dmgTaken=${2 - s2.health} state=${s2.state.padEnd(7)} run=${run.toFixed(2)}m/s cdAfterHit=${Math.max(0, cdLeft).toFixed(2)}s slowed=${s2.slowUntil > g2.time}`);
  if (WEAPONS[id].dmg === 2) ok(s2.state === 'downed', `${id}: one hit downs a healthy survivor (health ${s2.health})`);
}
console.log(rows.join('\n'));
// relative expectations
const speedOf = (id) => { const g = make(id), m = g.monster; m.x = 0; m.z = 0; for (let i = 0; i < 20; i++) { g.setInput('m', { mx: 1, mz: 0, run: true, actions: [] }); idle(g); g.tick(0.05); } return m.x; };
ok(speedOf('machete') > speedOf('axe') && speedOf('axe') > speedOf('sledge') && speedOf('sledge') > speedOf('maul'), 'speed order: machete > axe > sledgehammer > timber maul');
const lv3 = make('maul', 3), lv1 = make('maul', 1);
ok(speedOf('maul') < (() => { const g = make('maul', 3), m = g.monster; m.x = 0; m.z = 0; for (let i = 0; i < 20; i++) { g.setInput('m', { mx: 1, mz: 0, run: true, actions: [] }); idle(g); g.tick(0.05); } return m.x; })(), 'upgrading a heavy weapon softens its speed penalty');
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
