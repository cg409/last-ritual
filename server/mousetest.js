// The mouse (a dead survivor) must not slip through the mansion's walls.
import { Game } from '../shared/game.js';
import { collide } from '../shared/nav.js';

const roster = [{ id: 'm', name: 'M', monsterPref: 'wanderer' }, ...[1, 2, 3, 4].map((i) => ({ id: 's' + i, name: 'S' + i }))];
const g = new Game({ seed: 31, roster, forceMonster: 'm' });
g.monster.stunUntil = 1e9; g.monster.x = -60; g.monster.z = -60;
const mouse = g.player('s1'); mouse.state = 'mouse';
const b = g.map.buildings.find((x) => x.id === 'mansion');
const walls = b.segments.filter((s) => s.kind === 'wall');
// crossing a wall segment's centre line within its length = went through it
const crossed = (ax, az, bx, bz) => walls.some((s) => {
  if (s.alongX) { if ((az - s.z) * (bz - s.z) >= 0) return false; const x = ax + (bx - ax) * (s.z - az) / (bz - az); return Math.abs(x - s.x) < s.len / 2 - 0.05; }
  if ((ax - s.x) * (bx - s.x) >= 0) return false; const z = az + (bz - az) * (s.x - ax) / (bx - ax); return Math.abs(z - s.z) < s.len / 2 - 0.05;
});
let through = 0, runs = 0;
for (let k = 0; k < 400; k++) {
  let sx, sz;
  do { sx = b.x + (Math.random() - 0.5) * (b.w - 1.5); sz = b.z + (Math.random() - 0.5) * (b.d - 1.5); const c = collide(g.map, sx, sz, 0.3); if (Math.abs(c.x - sx) < 1e-3 && Math.abs(c.z - sz) < 1e-3) break; } while (true);
  mouse.x = sx; mouse.z = sz; mouse.level = 0; mouse.y = 0; mouse.jumpT0 = null;
  const a = Math.random() * Math.PI * 2;
  for (let i = 0; i < 60; i++) {
    const px = mouse.x, pz = mouse.z;
    for (const p of g.players) if (p !== mouse) g.setInput(p.id, { mx: 0, mz: 0, actions: [] });
    g.setInput('s1', { mx: Math.sin(a), mz: Math.cos(a), run: true, actions: [] });
    g.tick(0.05);
    if ((mouse.level | 0) === 0 && crossed(px, pz, mouse.x, mouse.z)) { // (upstairs the ground-floor walls aren't there)
      through++;
      const s = walls.find((s) => crossed.length && (s.alongX ? (pz - s.z) * (mouse.z - s.z) < 0 && Math.abs(px - s.x) < s.len / 2 : (px - s.x) * (mouse.x - s.x) < 0 && Math.abs(pz - s.z) < s.len / 2));
      if (process.env.V) console.log('  from', px.toFixed(2), pz.toFixed(2), 'to', mouse.x.toFixed(2), mouse.z.toFixed(2), 'wall', JSON.stringify(s), 'rects near:', JSON.stringify(g.map.rects.filter((r) => Math.abs(r.x - mouse.x) < r.hw + 0.5 && Math.abs(r.z - mouse.z) < r.hd + 0.5).map((r) => [r.type, r.x.toFixed(1), r.z.toFixed(1), r.hw, r.hd, r.lv, r.low])));
      break;
    }
  }
  runs++;
}
console.log(`${through ? 'FAIL' : 'PASS'}  mouse through mansion walls: ${through}/${runs} runs`);
process.exit(through ? 1 : 0);
