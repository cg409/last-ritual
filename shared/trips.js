// Trip obstacles: wooden pallets and fallen logs lying across paths. They're low enough to step or
// jump over, but a survivor who sprints across one while the monster is chasing them stumbles and
// falls, losing ~1.7s. Walking (or crouching) over carefully, or jumping it (SPACE), is safe.
import { dist } from './rng.js';

export const TRIP = { fall: 1.7, chaseR: 18, immune: 2.5, reach: 0.35 };

// Place trip obstacles on the routes survivors actually run: mansion→tombs, tombs→gate, plus scatter.
export function scatterTrips(map, rng, free, occupied, H) {
  const tryAt = (x, z, rot) => {
    if (Math.abs(x) > H - 6 || Math.abs(z) > H - 6) return false;
    if (Math.abs(x) < 12 && Math.abs(z) < 10) return false; // not inside the mansion
    if (!free(x, z, 1.6)) return false;
    const kind = 'pallet'; // logs aren't left lying around — survivors push them down (landmarks.js)
    const hl = kind === 'pallet' ? 0.6 : rng.range(1.3, 1.8), hw = kind === 'pallet' ? 0.5 : 0.22;
    occupied.push({ x, z, r: Math.max(hl, hw) + 0.4 });
    map.trips.push({ id: map.trips.length, x, z, rot, kind, hl, hw, h: kind === 'pallet' ? 0.16 : 0.32 });
    // Logs are solid (jump them); slamming into one at a sprint while chased trips you (see tripAt).
    if (kind === 'log') (map.logs ||= []).push({ x, z, rot, hl, hw, h: 0.4, kind: 'trip' });
    return true;
  };
  const routes = map.tombs.map((t) => [0, 0, t.x, t.z]).concat(map.tombs.map((t) => [t.x, t.z, map.exit.x, map.exit.z + 6]));
  for (const [ax, az, bx, bz] of routes) {
    const ang = Math.atan2(bx - ax, bz - az);
    for (let k = 0; k < 3; k++) {
      const f = rng.range(0.2, 0.85), off = rng.range(-3, 3);
      const x = ax + (bx - ax) * f + Math.cos(ang) * off, z = az + (bz - az) * f - Math.sin(ang) * off;
      for (let tries = 0; tries < 6; tries++) if (tryAt(x + rng.range(-2, 2), z + rng.range(-2, 2), ang + Math.PI / 2 + rng.range(-0.35, 0.35))) break;
    }
  }
  for (let i = 0; i < 400 && map.trips.length < 34; i++) tryAt(rng.range(-H + 8, H - 8), rng.range(-H + 8, H - 8), rng.range(0, Math.PI));
}

// Distance from (x,z) to the obstacle's long axis (an oriented box), negative = inside.
export function tripDist(t, x, z) {
  const dx = x - t.x, dz = z - t.z, c = Math.cos(t.rot), s = Math.sin(t.rot);
  // long axis along (sin rot, cos rot)
  const u = dx * s + dz * c, v = dx * c - dz * s;
  const ou = Math.abs(u) - t.hl, ov = Math.abs(v) - t.hw;
  return Math.hypot(Math.max(ou, 0), Math.max(ov, 0)) + Math.min(Math.max(ou, ov), 0);
}

export function tripAt(map, x, z, r = TRIP.reach) {
  // Logs are solid (bodies stop ~0.4m from their axis), so they trip you on contact.
  return map.trips.find((t) => tripDist(t, x, z) < (t.kind === 'log' ? r + 0.15 : r));
}

// Called each tick for an alive survivor (after movement).
export function checkTrip(g, p) {
  if (!g.map.trips?.length || p.state !== 'alive') return;
  if ((p.y || 0) > 0.12 || p.fallUntil > g.time || p.tripImmuneUntil > g.time) return;
  if (!p.running && !(p.boostUntil > g.time && p.moving)) return; // careful steps are safe
  const m = g.monster;
  if (!m || dist(p.x, p.z, m.x, m.z) > TRIP.chaseR || m.stunUntil > g.time) return; // only when chased
  const t = tripAt(g.map, p.x, p.z);
  if (!t) return;
  p.fallUntil = g.time + TRIP.fall;
  p.tripImmuneUntil = g.time + TRIP.fall + TRIP.immune;
  p.fallRot = p.rot;
  p.act = null; p.skill = null; p.holding = false;
  g.emit({ t: 'trip', id: p.id, name: p.name, kind: t.kind, x: p.x, z: p.z });
}
