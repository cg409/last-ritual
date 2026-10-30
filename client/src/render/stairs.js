// Upper-floor slab with a stairwell opening, and the straight staircase (steps, handrail, balusters,
// upstairs balustrade). Geometry goes into the building's merge batch.
import { FLOOR0, FLOOR1 } from '@shared/levels.js';

export function upperFloor(B, b, M, top) {
  const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2, t = 0.24, y = top - t / 2;
  const slab = (ax, bx, az, bz) => { if (bx - ax > 0.05 && bz - az > 0.05) B.box(M.floor, bx - ax, t, bz - az, (ax + bx) / 2, y, (az + bz) / 2, 0, 0, 0, 3); };
  // Stone string course: only a band in the outer walls. (It used to be a solid slab across the
  // whole footprint, which closed the stairwell — the "slab over the stairs" you walked through.)
  const T = 0.55, cy = top - 0.16; // top 3.5cm under the floorboards (no z-fighting)
  B.box(M.stone, b.w + 0.3, 0.25, T, b.x, cy, z0 + T / 2 - 0.15, 0, 0, 0, 2);
  B.box(M.stone, b.w + 0.3, 0.25, T, b.x, cy, z1 - T / 2 + 0.15, 0, 0, 0, 2);
  B.box(M.stone, T, 0.25, b.d - 2 * T + 0.3, x0 + T / 2 - 0.15, cy, b.z, 0, 0, 0, 2);
  B.box(M.stone, T, 0.25, b.d - 2 * T + 0.3, x1 - T / 2 + 0.15, cy, b.z, 0, 0, 0, 2);
  const s = b.stair;
  if (!s) { slab(x0, x1, z0, z1); return; }
  // Opening over the WHOLE flight: the top step is level with the upper floor, so the slab starts
  // exactly where the stairs end (previously the top 0.9m of the flight was roofed over).
  const hx0 = Math.min(s.xb, s.xt), hx1 = Math.max(s.xb, s.xt), hz0 = s.z0 - 0.05, hz1 = s.z1 + 0.05;
  slab(x0, x1, z0, hz0); slab(x0, x1, hz1, z1); slab(x0, hx0, hz0, hz1); slab(hx1, x1, hz0, hz1);
}

export function stairs(B, b, M) {
  const s = b.stair, n = 16, run = (s.xb - s.xt) / n, rise = (FLOOR1 - FLOOR0) / n, w = s.z1 - s.z0, zc = (s.z0 + s.z1) / 2;
  for (let i = 0; i < n; i++) { // solid steps down to the floor
    const x = s.xb - (i + 0.5) * run, top = FLOOR0 + (i + 1) * rise;
    B.box(M.trim, Math.abs(run) + 0.02, top, w, x, top / 2, zc, 0, 0, 0, 1);
  }
  const len = Math.abs(s.xb - s.xt), ang = Math.atan2(FLOOR1 - FLOOR0, len) * Math.sign(s.xb - s.xt);
  B.box(M.trim, len + 0.3, 0.08, 0.08, (s.xb + s.xt) / 2, (FLOOR0 + FLOOR1) / 2 + 0.95, s.open, 0, 0, ang, 1); // handrail
  for (let i = 0; i <= 8; i++) { // balusters following the slope
    const k = i / 8, x = s.xb + (s.xt - s.xb) * k, yb = FLOOR0 + (FLOOR1 - FLOOR0) * k;
    B.box(M.trim, 0.05, 0.95, 0.05, x, yb + 0.48, s.open, 0, 0, 0, 1);
  }
  // Upstairs: rail across the low end of the stairwell and along its open side.
  B.box(M.trim, 0.06, 1.0, w, s.xb, FLOOR1 + 0.5, zc, 0, 0, 0, 1);
  B.box(M.trim, len - 0.9, 0.06, 0.06, (s.xb + s.xt) / 2 + Math.sign(s.xb - s.xt) * 0.45, FLOOR1 + 1.0, s.open, 0, 0, 0, 1);
}
