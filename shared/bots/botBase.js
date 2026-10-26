// Base class for bots: path following, stuck detection and human-like reaction delays.
import { findPath } from '../nav.js';
import { dist, angleTo } from '../rng.js';

export class BotBase {
  constructor(game, p) {
    this.g = game; this.p = p;
    this.actions = [];
    this.path = []; this.goal = null; this.repathT = 0;
    this.lastPos = { x: p.x, z: p.z }; this.stuckT = 0;
    this.reaction = 0.25 + game.random() * 0.35;   // seconds; each bot has its own reflexes
    this.skill = 0.6 + game.random() * 0.35;       // chance to hit skill checks / make good calls
  }

  // Move toward (x,z) using A*; returns true when arrived.
  goTo(x, z, out, arrive = 1.2) {
    const p = this.p, g = this.g;
    if (dist(p.x, p.z, x, z) < arrive) { this.path = []; return true; }
    this.repathT -= 1 / 20;
    if (!this.goal || dist(this.goal.x, this.goal.z, x, z) > 2 || this.repathT <= 0 || !this.path.length) {
      this.path = findPath(g.map, p.x, p.z, x, z);
      this.goal = { x, z }; this.repathT = 1.5;
    }
    while (this.path.length && dist(p.x, p.z, this.path[0].x, this.path[0].z) < 0.8) this.path.shift();
    const wp = this.path[0] || { x, z };
    const a = angleTo(p.x, p.z, wp.x, wp.z);
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
