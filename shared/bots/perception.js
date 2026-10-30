// What an NPC can actually perceive — the same things a human player could: only what is in front of
// its eyes (a vision cone, blocked by walls), shortened by darkness, crouching, stillness, tall grass
// and fog, lengthened by a switched-on flashlight or a lit spot. Nobody sees through walls or behind
// themselves (except someone right at their back). Noticing takes a moment at a distance.
import { dist, angleTo, angleDiff } from '../rng.js';
import { lineOfSight, inGrass } from '../nav.js';
import { buildingAt } from '../levels.js';

// How lit a spot is: 0 = moonlit dark .. 1 = well lit (lamps, the lit mansion rooms).
export function lightAt(g, x, z, level = 0) {
  if (g.isBlackout()) return 0;
  let l = 0;
  for (const lp of g.map.lamps) { const d = dist(x, z, lp.x, lp.z); if (d < lp.r * 1.6) l = Math.max(l, 1 - d / (lp.r * 1.6)); }
  const b = buildingAt(g.map, x, z);
  if (b?.type === 'mansion') l = Math.max(l, level ? 0.45 : 0.55); // sconces and chandeliers
  for (const p of g.state.players) if (p.lightOn && p.state === 'alive') { const d = dist(x, z, p.x, p.z); if (d < 7) l = Math.max(l, 1 - d / 7); }
  return l;
}

// The furthest distance at which `viewer` could pick out `target` right now.
export function sightRange(g, viewer, target) {
  const monsterEyes = viewer.role === 'monster';
  let r = monsterEyes ? 24 : 22;
  if (g.isBlackout()) r = monsterEyes && viewer.monster === 'puppeteer' ? 22 : 7;
  const light = lightAt(g, target.x, target.z, target.level | 0);
  r *= 0.5 + 0.5 * light;                           // darkness hides you…
  if (target.lightOn) r += 14;                      // …a flashlight gives you away
  if (target.role === 'survivor') {
    if (target.crawl) r *= 0.45; else if (target.crouch) r *= 0.62;
    if ((target.speed || 0) < 0.2) r *= 0.75; else if (target.running) r *= 1.25;
    if (target.hidden || ((target.crouch || target.crawl) && inGrass(g.map, target.x, target.z))) r = Math.min(r, (target.speed || 0) > 0.2 ? 4 : 1.6);
    if (g.isBlackout() && monsterEyes && viewer.monster === 'puppeteer' && (target.speed || 0) < 0.6) r = Math.min(r, 3);
  } else {
    if (target.monster === 'stalker') r *= 0.5;     // silent, and the dark clings to it
    if (target.running) r *= 1.15;
  }
  if (g.fog && !(target.level | 0)) {
    const f = Math.max(g.fog.at(target.x, target.z, g.time), g.fog.at((target.x + viewer.x) / 2, (target.z + viewer.z) / 2, g.time));
    r *= 1 - 0.75 * f;
  }
  return r;
}

// Is `target` in `viewer`'s sight this instant? (no memory, no noticing delay)
export function inSight(g, viewer, target) {
  if (target.hideIn != null || target.state === 'mouse' || target.state === 'escaped') return false;
  const d = dist(viewer.x, viewer.z, target.x, target.z);
  if ((viewer.level | 0) !== (target.level | 0)) return false;
  if (d < 1.6) return true;                                    // right next to you: you feel them
  const range = sightRange(g, viewer, target);
  if (d > range) return false;
  const off = Math.abs(angleDiff(viewer.rot, angleTo(viewer.x, viewer.z, target.x, target.z)));
  if (off > 1.75) return d < 2.4;                              // behind you: only someone at your back
  if (off > 1.1 && d > range * 0.4) return false;              // the edge of your vision: only close by
  return lineOfSight(g.map, viewer.x, viewer.z, target.x, target.z, viewer.level | 0);
}

// Noticing: a meter per target that fills while they are in sight — fast up close or when they move,
// slow at the edge of your vision — and drains when they are gone. Returns true once noticed.
export class Notice {
  constructor() { this.m = new Map(); }
  update(g, viewer, target, dt, gain = 1) {
    let v = this.m.get(target.id) || 0;
    if (inSight(g, viewer, target)) {
      const d = dist(viewer.x, viewer.z, target.x, target.z), range = Math.max(2, sightRange(g, viewer, target));
      const rate = (1 / (0.12 + (d / range) * 1.1)) * ((target.speed || 0) > 0.3 ? 1.4 : 0.8) * gain;
      v = Math.min(2, v + dt * rate);
    } else v = Math.max(0, v - dt * 0.6);
    this.m.set(target.id, v);
    return v >= 1;
  }
  level(id) { return this.m.get(id) || 0; }
  forget(id) { this.m.delete(id); }
}
