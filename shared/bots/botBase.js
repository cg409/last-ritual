// Base class for NPCs: path following on both floors (taking the stairs when the goal is on the other
// floor), stuck detection, human-like reaction delays and a little personal drift so a group never
// walks in single file.
import { findPath } from '../nav.js';
import { dist, angleTo } from '../rng.js';
import { stairAt } from '../levels.js';

export class BotBase {
  constructor(game, p) {
    this.g = game; this.p = p;
    this.actions = [];
    this.path = []; this.goal = null; this.repathT = 0;
    this.lastPos = { x: p.x, z: p.z }; this.stuckT = 0;
    this.reaction = 0.25 + game.random() * 0.35;   // seconds; each NPC has its own reflexes
    this.skill = 0.6 + game.random() * 0.35;       // chance to hit skill checks / make good calls
    this.drift = (game.random() - 0.5) * 1.6;       // personal sideways offset on paths
  }

  // Move toward (x,z) on floor `level` (default: the floor you are on); returns true when arrived.
  goTo(x, z, out, arrive = 1.2, level = this.p.level | 0) {
    const p = this.p, g = this.g, lv = p.level | 0;
    const st = stairAt(g.map, p.x, p.z);
    if (st || level !== lv) {
      const s = st || g.map.buildings.find((b) => b.stair)?.stair;
      if (!s) level = lv;
      else {
        const zc = (s.z0 + s.z1) / 2, up = level === 1;
        if (st) { // on the staircase: straight to the end we need
          const ex = up ? s.xt - 1.1 : s.xb + 1.1;
          const a = angleTo(p.x, p.z, ex, zc); out.mx = Math.sin(a); out.mz = Math.cos(a);
          return false;
        }
        // walk to the foot (or the head) of the stairs on this floor, then step onto them
        const entry = lv === 0 ? { x: s.xb + 1.6, z: zc } : { x: s.xt - 1.6, z: zc };
        const de = dist(p.x, p.z, entry.x, entry.z);
        if (de < 1.0 || (de < 2.2 && Math.abs(p.z - zc) < 0.5)) { // lined up: walk onto the stairs
          const a = angleTo(p.x, p.z, lv === 0 ? s.xt : s.xb, zc); out.mx = Math.sin(a); out.mz = Math.cos(a);
          return false;
        }
        if (de < 3) { const a = angleTo(p.x, p.z, entry.x, entry.z); out.mx = Math.sin(a); out.mz = Math.cos(a); return false; }
        x = entry.x; z = entry.z; arrive = 0.5;
      }
    }
    if (dist(p.x, p.z, x, z) < arrive) { this.path = []; return true; }
    this.repathT -= 1 / 20;
    if (!this.goal || dist(this.goal.x, this.goal.z, x, z) > 2 || this.goal.level !== lv || this.repathT <= 0 || !this.path.length) {
      this.path = findPath(g.map, p.x, p.z, x, z, 14000, lv);
      this.goal = { x, z, level: lv }; this.repathT = 1.5;
    }
    while (this.path.length && dist(p.x, p.z, this.path[0].x, this.path[0].z) < 0.8) this.path.shift();
    const wp = this.path[0] || { x, z };
    let a = angleTo(p.x, p.z, wp.x, wp.z);
    // a touch of personal drift on long legs, so NPCs heading the same way spread out
    if (this.path.length > 1 && dist(p.x, p.z, wp.x, wp.z) > 4) a += this.drift * 0.12;
    out.mx = Math.sin(a); out.mz = Math.cos(a);
    // unstick with a sidestep
    if (dist(p.x, p.z, this.lastPos.x, this.lastPos.z) < 0.02) this.stuckT += 1 / 20; else this.stuckT = 0;
    this.lastPos = { x: p.x, z: p.z };
    if (this.stuckT > 0.35 && this.stuckT < 0.4 && p.role === 'survivor') this.act({ t: 'jump' }); // try vaulting first
    if (this.stuckT > 0.6) {
      const side = a + (g.random() < 0.5 ? 1.57 : -1.57);
      out.mx = Math.sin(side); out.mz = Math.cos(side);
      if (this.stuckT > 1.5) { this.path = []; this.stuckT = 0; }
    }
    return false;
  }

  face(x, z, out) { out.face = angleTo(this.p.x, this.p.z, x, z); }
  act(a) { this.actions.push(a); }
}
