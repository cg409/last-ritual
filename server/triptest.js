// Headless check of the trip-obstacle rules: sprinting across a pallet/log while chased = fall;
// walking across, sprinting with no monster near, or jumping over it = safe. Also: unlimited sprint.
import { Game } from '../shared/game.js';
import { BOT_NAMES } from '../shared/constants.js';
import { TRIP } from '../shared/trips.js';

const roster = BOT_NAMES.slice(0, 5).map((n, i) => ({ id: 'b' + i, name: n, isBot: true, monsterPref: 'stalker' }));
let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) fails++; };
const subject = (g) => { const p = g.state.players.find((q) => q.role === 'survivor'); g.bots.delete(p.id); return p; };

function scenario({ run, chased, jump }) {
  const g = new Game({ seed: 777, roster });
  const me = subject(g);
  const t = g.map.trips.find((tr) => tr.kind === 'log') || g.map.trips[0];
  // Approach perpendicular to the obstacle's long axis from 3m away.
  const nx = Math.cos(t.rot), nz = -Math.sin(t.rot);
  me.x = t.x - nx * 3; me.z = t.z - nz * 3; me.state = 'alive';
  const m = g.monster; g.bots.delete(m.id);
  m.stunUntil = 0;
  m.x = chased ? me.x - nx * 4 : me.x - nx * 60; m.z = chased ? me.z - nz * 4 : me.z - nz * 60;
  let fell = false;
  for (let i = 0; i < 40; i++) {
    const actions = jump && i === Math.round((3 - 1.4) / ((run ? 4 : 1.9) / 20)) ? [{ t: 'jump' }] : [];
    me.input = { mx: nx, mz: nz, run, actions, interact: false };
    m.input = { mx: 0, mz: 0, actions: [] };
    g.tick(1 / 20); g.snapshot();
    if (me.fallUntil > g.time) fell = true;
  }
  return { fell, me };
}

let r = scenario({ run: true, chased: true, jump: false });
check('sprint across obstacle while chased → trips', r.fell);
r = scenario({ run: false, chased: true, jump: false });
check('walk across obstacle while chased → safe', !r.fell);
r = scenario({ run: true, chased: false, jump: false });
check('sprint across obstacle, no monster nearby → safe', !r.fell);
r = scenario({ run: true, chased: true, jump: true });
check('jump over obstacle while chased → safe', !r.fell);

// Unlimited sprint: 60s of running never exhausts.
{
  const g = new Game({ seed: 3, roster });
  const me = subject(g);
  g.monster.x = 9999; g.bots.delete(g.monster.id); g.monster.input = { mx: 0, mz: 0, actions: [] };
  let minSpeed = 99;
  for (let i = 0; i < 1200; i++) {
    me.input = { mx: Math.sin(i / 40), mz: Math.cos(i / 40), run: true, actions: [] };
    g.tick(1 / 20); g.snapshot();
    if (i > 10 && me.moving) minSpeed = Math.min(minSpeed, me.speed);
  }
  check('60s continuous sprint never slows', minSpeed >= 3.9, `(min speed ${minSpeed.toFixed(2)}, exhausted=${me.exhausted})`);
}
// Pallet: dropping it stuns a monster in the doorway, then blocks the monster but survivors vault it.
{
  const g = new Game({ seed: 11, roster });
  const me = subject(g), m = g.monster; g.bots.delete(m.id); m.stunUntil = 0;
  const pal = g.state.pallets[0];
  const nx = pal.alongX ? 0 : 1, nz = pal.alongX ? 1 : 0; // crossing direction through the doorway
  me.x = pal.x + nx * 0.9; me.z = pal.z + nz * 0.9;
  m.x = pal.x; m.z = pal.z;
  me.input = { mx: 0, mz: 0, interact: true, actions: [] }; m.input = { mx: 0, mz: 0, actions: [] };
  g.tick(1 / 20);
  check('E near pallet drops it', pal.state === 'down');
  check('monster under a dropped pallet is stunned', m.stunUntil > g.time + 2);
  // Monster tries to walk through (from the far side) — blocked.
  m.stunUntil = 0; m.x = pal.x - nx * 2; m.z = pal.z - nz * 2;
  for (let i = 0; i < 40; i++) { m.input = { mx: nx, mz: nz, actions: [] }; me.input = { mx: 0, mz: 0, actions: [] }; g.tick(1 / 20); }
  check('dropped pallet blocks the monster', (m.x - pal.x) * nx + (m.z - pal.z) * nz < -0.3);
  // Survivor vaults it with SPACE.
  me.x = pal.x + nx * 1.2; me.z = pal.z + nz * 1.2; m.x = 999;
  for (let i = 0; i < 30; i++) { me.input = { mx: -nx, mz: -nz, run: true, actions: i === 3 ? [{ t: 'jump' }] : [] }; m.input = { mx: 0, mz: 0, actions: [] }; g.tick(1 / 20); }
  check('survivor vaults a dropped pallet', (me.x - pal.x) * nx + (me.z - pal.z) * nz < -0.3);
  // Monster smashes it.
  m.x = pal.x - nx * 1.0; m.z = pal.z - nz * 1.0;
  for (let i = 0; i < 60; i++) { m.input = { mx: 0, mz: 0, interact: true, actions: [] }; me.input = { mx: 0, mz: 0, actions: [] }; g.tick(1 / 20); }
  check('monster smashes the pallet (hold E)', pal.state === 'broken' && !g.map.dyn.length);
}

// Mansion staircase: walk up to the second floor, and jump out of an upstairs window to the ground.
{
  const g = new Game({ seed: 5, roster });
  const me = subject(g); g.monster.x = 999; g.bots.delete(g.monster.id); g.monster.input = { mx: 0, mz: 0, actions: [] };
  const st = g.map.buildings[0].stair;
  me.x = st.xb + 0.8; me.z = (st.z0 + st.z1) / 2; me.level = 0;
  const dir = Math.sign(st.xt - st.xb);
  for (let i = 0; i < 70; i++) { me.input = { mx: dir, mz: 0, run: false, actions: [] }; g.tick(1 / 20); }
  check('climbing the stairs reaches the upper floor', me.level === 1, `(x=${me.x.toFixed(2)} level=${me.level})`);
  // Upstairs, walls block on the upper floor too.
  me.x = 0; me.z = 6; me.level = 1;
  for (let i = 0; i < 60; i++) { me.input = { mx: 0, mz: 1, actions: [] }; g.tick(1 / 20); }
  check('upper-floor walls hold the survivor inside', me.level === 1 && me.z < 8.4, `(z=${me.z.toFixed(2)})`);
}
console.log(`fall duration ${TRIP.fall}s, trip immunity ${TRIP.immune}s`);
process.exit(fails ? 1 : 0);
