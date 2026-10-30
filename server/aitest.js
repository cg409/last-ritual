// NPC behaviour checks: they take the stairs, the monster doesn't see behind itself or through walls,
// survivors hide in a cupboard and the monster can drag them out.
import { Game } from '../shared/game.js';
import { inSight } from '../shared/bots/perception.js';
import { BotBase } from '../shared/bots/botBase.js';

let fails = 0;
const ok = (c, msg) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${msg}`); if (!c) fails++; };
const roster = [{ id: 'm', name: 'M', monsterPref: 'wanderer' }, ...[1, 2, 3, 4].map((i) => ({ id: 's' + i, name: 'S' + i }))];
const g = new Game({ seed: 77, roster, forceMonster: 'm' });
const m = g.player('m'), s = g.player('s1');
const idle = () => { for (const p of g.players) if (!p._ctl) g.setInput(p.id, { mx: 0, mz: 0, actions: [] }); };
g.bots.clear();

// 1) stairs: a bot walks from the hall to the upper floor
const b = new BotBase(g, s); s._ctl = true;
s.x = 6; s.z = 3; s.level = 0; m.x = -60; m.z = -60; m.stunUntil = 1e9;
const goal = { x: -8, z: 4 };
let t = 0;
for (; t < 900 && !((s.level | 0) === 1 && Math.hypot(s.x - goal.x, s.z - goal.z) < 1.5); t++) {
  const out = { mx: 0, mz: 0 }; b.goTo(goal.x, goal.z, out, 1.2, 1);
  g.setInput('s1', { ...out, actions: [] }); idle(); g.tick(0.05);
}
ok((s.level | 0) === 1 && Math.hypot(s.x - goal.x, s.z - goal.z) < 1.5, `NPC climbs the stairs to the upper floor (${(t / 20).toFixed(1)}s, at ${s.x.toFixed(1)},${s.z.toFixed(1)} lv${s.level})`);
for (t = 0; t < 900 && !((s.level | 0) === 0 && Math.hypot(s.x - 6, s.z - 3) < 1.5); t++) {
  const out = { mx: 0, mz: 0 }; b.goTo(6, 3, out, 1.2, 0);
  g.setInput('s1', { ...out, actions: [] }); idle(); g.tick(0.05);
}
ok((s.level | 0) === 0 && Math.hypot(s.x - 6, s.z - 3) < 1.5, `…and back down (${(t / 20).toFixed(1)}s)`);
s._ctl = false;

// 2) vision: in front yes, behind no, through a wall no
m.level = 0; s.level = 0; m.stunUntil = 1e9;
const open = { x: 30, z: 30 };
m.x = open.x; m.z = open.z; m.rot = 0; s.x = open.x; s.z = open.z + 8; s.speed = 2; s.crouch = false; s.lightOn = false;
const front = inSight(g, m, s);
m.rot = Math.PI; const behind = inSight(g, m, s);
ok(behind === false, `the monster does not see a survivor 8m behind it (front: ${front})`);
m.x = 0; m.z = -4; m.rot = Math.PI; s.x = 0; s.z = -10; // mansion interior wall / corridor wall between
ok(!inSight(g, m, s), 'no sight through the mansion walls');

// 3) hiding: in a cupboard you're invisible; the monster searching the door drags you out
const h = g.map.hides[0];
ok(g.map.hides.length >= 10, `hiding places: ${g.map.hides.filter((x) => x.kind === 'locker').length} cupboards, ${g.map.hides.filter((x) => x.kind === 'potty').length} porta-potties`);
s.x = h.ex; s.z = h.ez; s.level = h.level | 0; s.state = 'alive'; s._ctl = true;
for (let i = 0; i < 30 && s.hideIn == null; i++) { g.setInput('s1', { mx: 0, mz: 0, interact: true, actions: [] }); idle(); g.tick(0.05); }
ok(s.hideIn === h.id, 'a survivor climbs into a cupboard');
m.x = h.ex; m.z = h.ez; m.level = h.level | 0; m.rot = Math.atan2(h.x - h.ex, h.z - h.ez); m.stunUntil = 0;
ok(!inSight(g, m, s), 'hidden survivors cannot be seen');
m._ctl = true;
for (let i = 0; i < 40 && !m.carrying; i++) { g.setInput('m', { mx: 0, mz: 0, interact: true, actions: [] }); g.setInput('s1', { mx: 0, mz: 0, actions: [] }); idle(); g.tick(0.05); }
ok(m.carrying === 's1' && s.state === 'carried', 'the monster searches the door and drags them out');
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
