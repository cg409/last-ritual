// Chase test: a human-controlled monster sprints straight at a survivor sprinting away in the open
// and lunges when close. Checks the monster now catches (hits) a running survivor, and that solid
// logs stop survivors but only slow the monster.
import { Game } from '../shared/game.js';
import { collide } from '../shared/nav.js';
import { angleTo, dist } from '../shared/rng.js';

const roster = [{ id: 'm', name: 'M', isBot: false, monsterPref: 'wanderer' }, ...[1, 2, 3, 4].map((i) => ({ id: 's' + i, name: 'S' + i, isBot: false }))];
const g = new Game({ seed: 4242, roster, forceMonster: 'm' });
const m = g.player('m'), s = g.player('s1');
m.stunUntil = 0;
// Park everyone else far away; put the pair on a clear stretch.
let spot = null;
for (let x = -50; x < 50 && !spot; x += 2) for (let z = -50; z < 50 && !spot; z += 2) {
  let ok = true; for (let k = 0; k <= 30 && ok; k += 1) { const c = collide(g.map, x + k, z, 0.5); if (Math.abs(c.x - x - k) > 1e-3 || Math.abs(c.z - z) > 1e-3) ok = false; }
  if (ok) spot = { x, z };
}
m.x = spot.x; m.z = spot.z; s.x = spot.x + 6; s.z = spot.z;
for (const o of g.survivors()) if (o !== s) { o.x = -60; o.z = -60; }
let hitAt = null;
for (let i = 0; i < 20 * 15 && !hitAt; i++) {
  const a = angleTo(m.x, m.z, s.x, s.z);
  const acts = dist(m.x, m.z, s.x, s.z) < 2.6 && !(m.attackCdUntil > g.time) ? [{ t: 'attack' }] : [];
  g.setInput('m', { mx: Math.sin(a), mz: Math.cos(a), run: true, face: a, actions: acts });
  g.setInput('s1', { mx: Math.sin(a), mz: Math.cos(a), run: true, actions: [] });
  for (const o of g.survivors()) if (o !== s) g.setInput(o.id, { mx: 0, mz: 0, actions: [] });
  g.tick(0.05);
  if (s.health < 2) hitAt = g.time;
}
console.log('open-field chase:', hitAt ? `HIT after ${hitAt.toFixed(1)}s` : 'NO HIT (fail)');

// Push-down logs: a survivor drops one, then walking into it is stopped; the monster passes over.
const lp = g.state.pallets.find((p) => p.kind === 'log');
const s3 = g.player('s3'); s3.state = 'alive'; s3.x = lp.x + (lp.alongX ? 0 : 0.2); s3.z = lp.z + (lp.alongX ? 0.9 : 0); s3.level = 0;
g.setInput('s3', { mx: 0, mz: 0, interact: true, actions: [] }); g.tick(0.05);
console.log('log pushed down:', lp.state === 'down' ? 'yes (ok)' : 'NO (fail)');
const log = g.map.logs.find((l) => l.kind === 'drop');
const nx = Math.cos(log.rot), nz = -Math.sin(log.rot); // perpendicular to the long axis
const tryCross = (p) => {
  p.x = log.x - nx * 2.5; p.z = log.z - nz * 2.5; p.level = 0; p.jumpT0 = null; p.y = 0;
  for (let i = 0; i < 60; i++) { g.setInput(p.id, { mx: nx, mz: nz, run: false, face: Math.atan2(nx, nz), actions: [] }); g.tick(0.05); }
  return (p.x - log.x) * nx + (p.z - log.z) * nz > 0.6;
};
const s2 = g.player('s2'); s2.state = 'alive';
console.log('survivor walks through log:', tryCross(s2) ? 'YES (fail)' : 'blocked (ok)');
console.log('monster crosses log:', tryCross(m) ? 'yes (ok)' : 'NO (fail)');
