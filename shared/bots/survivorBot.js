// Survivor AI — uses exactly the same inputs as a human (move, run, crouch, interact, skill checks, candles).
import { BotBase } from './botBase.js';
import { dist, angleTo } from '../rng.js';
import { lineOfSight, inGrass } from '../nav.js';
import { objective } from './survivorGoals.js';

export class SurvivorBot extends BotBase {
  constructor(g, p) {
    super(g, p);
    this.mode = 'objective';
    this.fearT = 0; this.seenAt = null;
    this.bravery = 0.4 + g.random() * 0.6;   // willingness to rescue / stay on tombs
  }

  // What a human could notice: sight (worse in blackout / vs. Stalker / disguised Mimic) and the chainsaw.
  perceive() {
    const g = this.g, p = this.p, m = g.monster;
    const d = dist(p.x, p.z, m.x, m.z);
    if (m.sawUntil > g.time) return { x: m.x, z: m.z, d };
    let sight = g.isBlackout() ? 6 : p.holding ? 22 : 18;
    if (m.monster === 'stalker') sight = Math.min(sight, p.holding ? 12 : 8);
    if (m.monster === 'mimic' && m.disguise) sight = p.holding ? 7 : 2.5;
    if (d > sight) return null;
    if (!lineOfSight(g.map, p.x, p.z, m.x, m.z)) return d < 4 ? { x: m.x, z: m.z, d } : null;
    return { x: m.x, z: m.z, d };
  }

  think(dt) {
    const g = this.g, p = this.p, out = { mx: 0, mz: 0 };
    if (p.state === 'mouse') return this.mouse(out);
    if (p.state === 'escaped') return out;
    if (p.state === 'carried') { if (g.random() < 0.3 * this.skill) this.act({ t: 'wiggle' }); return out; }
    if (p.state === 'hooked') { if (p.hookT > 45 && g.random() < 0.003) this.act({ t: 'struggle' }); return out; }
    if (p.state === 'downed') {
      const mate = this.nearestMate();
      if (mate) this.goTo(mate.x, mate.z, out, 1.5);
      return out;
    }
    this.handleSkillCheck();
    const seen = this.perceive();
    if (seen) this.seenAt = { x: seen.x, z: seen.z, t: g.time };
    const memory = 4 + (1 - this.bravery) * 4;
    const threat = this.seenAt && g.time - this.seenAt.t < memory ? this.seenAt : null;
    if (threat && dist(p.x, p.z, threat.x, threat.z) < 14) this.fearT += dt; else this.fearT = 0;
    if (this.fearT > this.reaction) return this.flee(threat, out);

    // Candle play vs. the Stalker (watch your shadow) and the Mimic (expose it).
    const wantCandle = (g.monster.monster === 'stalker' || g.monster.monster === 'mimic') && p.candles.length > 0 && p.candles[0] > 20 && p.candles.length > 1;
    if (wantCandle !== p.holding && g.random() < 0.02) this.act({ t: 'candle' });
    return objective(this, out);
  }

  handleSkillCheck() {
    const g = this.g, sk = this.p.skill;
    if (!sk || this.answered === sk.id) return;
    const hitT = sk.start + (sk.zoneStart + sk.zoneLen * 0.5) / sk.speed;
    if (g.time < hitT) return;
    this.answered = sk.id;
    // Bots make real mistakes; stress (monster close by) makes them worse.
    const stress = dist(this.p.x, this.p.z, g.monster.x, g.monster.z) < 12 ? 0.15 : 0;
    const r = g.random();
    const result = r < this.skill * 0.3 ? 'great' : r < this.skill - stress ? 'good' : 'miss';
    this.act({ t: 'skill', id: sk.id, result });
  }

  flee(threat, out) {
    const g = this.g, p = this.p;
    this.mode = 'flee';
    const d = dist(p.x, p.z, threat.x, threat.z);
    // Tactic: if not being chased closely, slip into tall grass and crouch still.
    const grass = g.map.grass.filter((gr) => dist(gr.x, gr.z, p.x, p.z) < 12 && dist(gr.x, gr.z, threat.x, threat.z) > d)
      .sort((a, b) => dist(a.x, a.z, p.x, p.z) - dist(b.x, b.z, p.x, p.z))[0];
    if (grass && d > 7 && this.bravery < 0.85) {
      if (inGrass(g.map, p.x, p.z)) { out.crouch = true; return out; } // freeze
      this.goTo(grass.x, grass.z, out, 1);
      out.crouch = d > 12; out.run = !out.crouch;
      return out;
    }
    const a = angleTo(threat.x, threat.z, p.x, p.z) + (g.random() - 0.5) * 0.6;
    const H = g.map.size / 2 - 6;
    const tx = Math.max(-H, Math.min(H, p.x + Math.sin(a) * 14));
    const tz = Math.max(-H, Math.min(H, p.z + Math.cos(a) * 14));
    this.goTo(tx, tz, out, 1);
    out.run = true;
    if (g.monster.monster === 'ravager' && d > 18) { out.run = false; out.crouch = true; } // no footprints
    return out;
  }

  closestTo(o) {
    const mates = this.g.survivors().filter((s) => s.state === 'alive');
    return mates.sort((a, b) => dist(a.x, a.z, o.x, o.z) - dist(b.x, b.z, o.x, o.z))[0] === this.p;
  }
  nearestMate() {
    const p = this.p;
    return this.g.survivors().filter((o) => o !== p && o.state === 'alive')
      .sort((a, b) => dist(p.x, p.z, a.x, a.z) - dist(p.x, p.z, b.x, b.z))[0];
  }
  mouse(out) { // dead bots scurry after a living survivor as mice
    const mate = this.nearestMate();
    if (mate) this.goTo(mate.x + 2, mate.z + 2, out, 2);
    return out;
  }
}
