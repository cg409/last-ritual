// Hiding places: wooden cupboards against the walls inside the mansion (both floors) and the houses,
// and plastic porta-potties spread evenly across the open realm (one per cell of a 3x3 grid, minus
// the mansion's cell). A survivor holds E to climb in and presses E to climb out; inside they can't
// be seen. The monster can search a door (hold E): if someone is inside, they're dragged out.
import { makeRng, dist } from './rng.js';
import { weaponStats } from './weapons.js';

export const HIDE = { enter: 0.7, search: 1.1, reach: 1.25 };
const LOCKER = { w: 1.0, d: 0.62, h: 2.15 }, POTTY = { w: 1.25, d: 1.25, h: 2.35 };

function blockedAt(map, x, z, r, level) {
  for (const b of map.rects) {
    if (!(b.both || (b.lv | 0) === level)) continue;
    const dx = Math.max(0, Math.abs(x - b.x) - b.hw), dz = Math.max(0, Math.abs(z - b.z) - b.hd);
    if (dx * dx + dz * dz < r * r) return true;
  }
  if (level) return false;
  return map.circles.some((c) => dist(x, z, c.x, c.z) < c.r + r) || (map.chests || []).some((c) => dist(x, z, c.x, c.z) < r + 1);
}
const nearStairs = (b, x, z) => b.stair && x > Math.min(b.stair.xb, b.stair.xt) - 2 && x < Math.max(b.stair.xb, b.stair.xt) + 2 && z > b.stair.z0 - 2 && z < b.stair.z1 + 2;

export function placeHides(map) {
  const rng = makeRng((map.seed ^ 0x41de5) >>> 0), H = map.size / 2;
  const hides = map.hides = [];
  const add = (kind, x, z, rot, level, S) => {
    const fx = Math.sin(rot), fz = Math.cos(rot), side = Math.abs(fx) > 0.5;
    hides.push({ id: hides.length, kind, x, z, rot, level, ex: x + fx * (S.d / 2 + 0.55), ez: z + fz * (S.d / 2 + 0.55) });
    map.rects.push({ x, z, hw: (side ? S.d : S.w) / 2, hd: (side ? S.w : S.d) / 2, h: S.h, type: 'hide', ...(level ? { lv: 1 } : {}) });
  };
  // Cupboards: against an exterior wall, facing into the room, clear of doors / stairs / furniture.
  for (const b of map.buildings) {
    const want = b.type === 'mansion' ? [3, 2] : [1, 0];
    for (let level = 0; level < 2; level++) {
      if (level && b.floors < 2) continue;
      const walls = b.segments.filter((s) => s.exterior && s.kind === 'wall');
      for (let k = 0, n = 0; k < 60 && n < want[level]; k++) {
        const s = walls[(rng() * walls.length) | 0]; if (!s) break;
        // inward normal (toward the building centre)
        const nx = s.alongX ? 0 : Math.sign(b.x - s.x), nz = s.alongX ? Math.sign(b.z - s.z) : 0;
        const off = 0.2 + LOCKER.d / 2 + 0.03, x = s.x + nx * off, z = s.z + nz * off;
        const rot = Math.atan2(nx, nz);
        if (nearStairs(b, x, z) || hides.some((h) => dist(h.x, h.z, x, z) < 4)) continue;
        if (b.segments.some((o) => o.kind === 'door' && dist(o.x, o.z, x, z) < 1.9)) continue;
        if (blockedAt(map, x + nx * 0.25, z + nz * 0.25, 0.45, level) || blockedAt(map, x + nx * 1.1, z + nz * 1.1, 0.45, level)) continue;
        if ((map.furniture || []).some((f) => (f.lv | 0) === level && dist(f.x, f.z, x, z) < 1.3)) continue;
        add('locker', x, z, rot, level, LOCKER); n++;
      }
    }
  }
  // Porta-potties: one per cell of a 3x3 grid (the centre cell holds the mansion).
  const cell = (map.size - 20) / 3;
  for (let gx = 0; gx < 3; gx++) for (let gz = 0; gz < 3; gz++) {
    if (gx === 1 && gz === 1) continue;
    const cx = -H + 10 + (gx + 0.5) * cell, cz = -H + 10 + (gz + 0.5) * cell;
    for (let t = 0; t < 200; t++) {
      const sp = t < 100 ? 0.3 : 0.48, x = cx + rng.range(-sp, sp) * cell, z = cz + rng.range(-sp, sp) * cell;
      if (Math.abs(x) > H - 6 || Math.abs(z) > H - 6) continue;
      if (blockedAt(map, x, z, 2.2, 0) || map.buildings.some((b) => Math.abs(x - b.x) < b.w / 2 + 3 && Math.abs(z - b.z) < b.d / 2 + 3)) continue;
      if (map.hooks.some((h) => dist(h.x, h.z, x, z) < 6) || map.tombs.some((tb) => dist(tb.x, tb.z, x, z) < 7)) continue;
      const rot = rng.range(0, Math.PI * 2), fx = Math.sin(rot), fz = Math.cos(rot);
      if (blockedAt(map, x + fx * 1.5, z + fz * 1.5, 0.6, 0)) continue;
      add('potty', x, z, rot, 0, POTTY);
      break;
    }
  }
  return hides;
}

// ---------- rules ----------
const nearHide = (g, p, r = HIDE.reach) => (g.map.hides || []).find((h) => (h.level | 0) === (p.level | 0) && dist(p.x, p.z, h.ex, h.ez) < r);

// Survivor next to a free hiding place, holding E: climbing in takes a moment.
export function tryHide(g, p, dt) {
  const h = nearHide(g, p); if (!h) return false;
  const st = g.state.hides[h.id];
  if (st.occupant) return false;
  if (p.act !== 'hide') { p.act = 'hide'; p.actT = 0; p.skill = null; }
  p.actT = Math.min(1, p.actT + dt / HIDE.enter);
  if (p.actT >= 1) {
    st.occupant = p.id; p.hideIn = h.id; p.hideHeld = true; p.act = null; p.actT = 0;
    p.x = h.x; p.z = h.z; p.level = h.level | 0; p.lightOn = false; p.holding = false;
    g.emit({ t: 'hide', id: p.id, spot: h.id, x: h.x, z: h.z });
  }
  return true;
}

// While hidden: stay put; a fresh E press climbs out in front of the door.
export function updateHidden(g, p, inp) {
  const h = g.map.hides[p.hideIn];
  p.moving = false; p.speed = 0; p.running = false; p.act = null;
  if (!inp.interact) p.hideHeld = false;
  else if (!p.hideHeld) leaveHide(g, p, h);
}
export function leaveHide(g, p, h = g.map.hides[p.hideIn]) {
  if (!h) { p.hideIn = null; return; }
  g.state.hides[h.id].occupant = null;
  p.hideIn = null; p.x = h.ex; p.z = h.ez; p.rot = h.rot; p.level = h.level | 0;
  g.emit({ t: 'unhide', id: p.id, spot: h.id, x: h.x, z: h.z });
}

// Monster holding E at a hiding place: search it. Someone inside is dragged out (and carried).
export function trySearch(g, m, dt, progress) {
  const h = nearHide(g, m, HIDE.reach + 0.2); if (!h || m.carrying) return false;
  progress(m, 'search', dt / (HIDE.search * weaponStats(m.weapon, m.weaponLvl).srch), () => {
    const st = g.state.hides[h.id], v = st.occupant && g.player(st.occupant);
    g.emit({ t: 'search', x: h.x, z: h.z, spot: h.id, found: !!v });
    if (!v) return;
    st.occupant = null; v.hideIn = null; v.x = h.ex; v.z = h.ez;
    v.state = 'carried'; v.carrier = m.id; v.wiggle = 0; v.health = 0; m.carrying = v.id;
    g.emit({ t: 'pickup', id: v.id, name: v.name, fromHide: true });
  });
  return true;
}
