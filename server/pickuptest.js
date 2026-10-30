// Pickup test: a downed survivor crawling away from a monster holding E must still be picked up
// (previously the victim slipped out of reach and the pickup restarted forever).
import { Game } from '../shared/game.js';
import { collide } from '../shared/nav.js';

const roster = [{ id: 'm', name: 'M', isBot: false, monsterPref: 'wanderer' }, ...[1, 2, 3, 4].map((i) => ({ id: 's' + i, name: 'S' + i, isBot: false }))];
const g = new Game({ seed: 777, roster, forceMonster: 'm' });
const m = g.player('m'), s = g.player('s1');
let spot = null;
for (let x = -50; x < 50 && !spot; x += 2) for (let z = -50; z < 50 && !spot; z += 2) {
  let ok = true; for (let k = -2; k <= 8 && ok; k++) { const c = collide(g.map, x + k, z, 0.5); if (Math.abs(c.x - x - k) > 1e-3 || Math.abs(c.z - z) > 1e-3) ok = false; }
  if (ok) spot = { x, z };
}
m.x = spot.x; m.z = spot.z; m.stunUntil = 0; m.level = 0;
s.x = spot.x + 1.6; s.z = spot.z; s.state = 'downed'; s.health = 0; s.level = 0;
for (const o of g.survivors()) if (o !== s) { o.x = -60; o.z = -60; }
let picked = false;
for (let i = 0; i < 20 * 5 && !picked; i++) {
  g.setInput('m', { mx: 0, mz: 0, face: Math.PI / 2, interact: true, actions: [] });
  g.setInput('s1', { mx: 1, mz: 0, actions: [] }); // crawl away the whole time
  for (const o of g.survivors()) if (o !== s) g.setInput(o.id, { mx: 0, mz: 0, actions: [] });
  g.tick(0.05);
  picked = s.state === 'carried' && m.carrying === s.id;
}
console.log('pickup of a crawling survivor:', picked ? `ok after ${g.time.toFixed(1)}s` : 'FAILED');
if (!picked) process.exit(1);
