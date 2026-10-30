// Checks gallows hooks are spread evenly (count, nearest-neighbour spacing, largest empty gap)
// and that self-heal works (bots mend themselves; 2 uses max).
import { generateMap } from '../shared/map.js';
import { Game } from '../shared/game.js';
import { BOT_NAMES } from '../shared/constants.js';

for (const seed of [1, 42, 777, 2024, 9999]) {
  const m = generateMap(seed), H = m.size / 2;
  const nn = m.hooks.map((h) => Math.min(...m.hooks.filter((o) => o !== h).map((o) => Math.hypot(o.x - h.x, o.z - h.z))));
  let gap = 0; // farthest any walkable-ish point is from a hook
  for (let x = -H + 6; x <= H - 6; x += 4) for (let z = -H + 6; z <= H - 6; z += 4) gap = Math.max(gap, Math.min(...m.hooks.map((h) => Math.hypot(h.x - x, h.z - z))));
  console.log(`seed ${seed}: hooks=${m.hooks.length} minNN=${Math.min(...nn).toFixed(1)} maxNN=${Math.max(...nn).toFixed(1)} maxGap=${gap.toFixed(1)}`);
}

const roster = BOT_NAMES.slice(0, 5).map((n, i) => ({ id: 'b' + i, name: n, isBot: true, monsterPref: 'wanderer', trap: 'bear' }));
const g = new Game({ seed: 4321, roster });
let selfHeals = 0;
while (!g.ended && g.time < 60 * 20) {
  g.tick(1 / 20);
  for (const e of g.snapshot().events) if (e.t === 'healed' && e.self) selfHeals++;
}
console.log('self heals in match:', selfHeals, 'remaining:', g.survivors().map((p) => p.heals).join(','));
if (g.survivors().some((p) => p.heals < 0 || p.heals > 2)) throw new Error('heal count out of range');
