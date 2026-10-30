// Drifting fog banks. Most of the realm is clear (and it is always clear indoors); here and there a
// bank of fog drifts in, thickens, thins and drifts away again. Fully deterministic from the map seed
// and the match time, so every client (and the bots) agree on where the fog is. Survivors can lose
// the monster in a thick bank — its bots see less in there.
import { makeRng } from './rng.js';

export function makeFog(seed, size, buildings = []) {
  const rng = makeRng((seed ^ 0xf06f06) >>> 0), H = size / 2 - 6;
  const patches = Array.from({ length: 8 }, () => ({
    x0: rng.range(-H, H), z0: rng.range(-H, H),
    vx: rng.range(-0.25, 0.25), vz: rng.range(-0.25, 0.25),
    r: rng.range(12, 21),
    p1: rng.range(90, 220), p2: rng.range(50, 120), ph1: rng.range(0, 6.28), ph2: rng.range(0, 6.28),
  }));
  const wrap = (v) => { const L = 2 * H, m = ((v + H) % (2 * L) + 2 * L) % (2 * L); return (m < L ? m : 2 * L - m) - H; };
  const state = (p, t) => {
    const s = 0.6 * Math.sin(t * 6.283 / p.p1 + p.ph1) + 0.4 * Math.sin(t * 6.283 / p.p2 + p.ph2); // -1..1
    // only the upper part of the swing is fog: each bank is there roughly a third of the time
    return { x: wrap(p.x0 + p.vx * t), z: wrap(p.z0 + p.vz * t), r: p.r, k: Math.max(0, Math.min(1, (s - 0.1) * 2)) };
  };
  const indoors = (x, z) => buildings.some((b) => Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2);
  return {
    patches: (t) => patches.map((p) => state(p, t)),
    indoors,
    // fog thickness at a point: 0 (clear) .. 1 (can barely see your hands)
    at(x, z, t) {
      if (indoors(x, z)) return 0;
      let f = 0;
      for (const p of patches) {
        const s = state(p, t); if (s.k <= 0) continue;
        const d2 = ((x - s.x) ** 2 + (z - s.z) ** 2) / (s.r * s.r);
        if (d2 < 1) { const e = 1 - d2; f = Math.max(f, s.k * e * e * (3 - 2 * e)); } // soft edge
      }
      return Math.min(1, f);
    },
  };
}
