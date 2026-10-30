// Survivor NPC — plays with exactly the same inputs as a human and knows only what a human would:
// the monster only when it is actually seen (or the chainsaw is heard), the terror radius as a
// heartbeat with no direction, and a disguised Mimic only after watching it long enough to get
// suspicious. It works its own task (the team spreads out over tombs, chests and keys), runs when it
// sees the monster, breaks line of sight, uses pallets, windows, grass, darkness and hiding places,
// and comes back out once the heartbeat has faded.
import { BotBase } from './botBase.js';
import { dist, angleTo } from '../rng.js';
import { inGrass } from '../nav.js';
import { objective } from './survivorGoals.js';
import { tripAt } from '../trips.js';
import { palletNear } from '../pallets.js';
import { Notice, inSight } from './perception.js';

export class SurvivorBot extends BotBase {
  constructor(g, p) {
    super(g, p);
    this.mode = 'objective';
    this.fearT = 0; this.seenAt = null; this.notice = new Notice();
    this.bravery = 0.4 + g.random() * 0.6;   // willingness to rescue / stay on tombs
    this.suspicion = 0; this.suspectAt = 3 + (1 - this.skill) * 6 + g.random() * 3; // seconds to see through the Mimic
    this.hideUntilCalm = false; this.calmT = 0; this.zig = g.random() * 6;
  }

  // What this survivor knows about the monster right now: { x, z, d, sure } or null.
  perceive(dt) {
    const g = this.g, p = this.p, m = g.monster;
    const d = dist(p.x, p.z, m.x, m.z);
    if (m.sawUntil > g.time || m.revUntil > g.time) return { x: m.x, z: m.z, d, sure: true }; // the chainsaw roars
    if (m.monster === 'mimic' && m.disguise) {
      // It looks like a friend. Get suspicious if it hangs around, comes straight at you, or runs at you.
      if (inSight(g, p, m) && d < 16) {
        const toward = Math.cos(angleTo(m.x, m.z, p.x, p.z) - m.rot);
        const k = (d < 5 ? 1.6 : d < 10 ? 1 : 0.5) * (m.running && toward > 0.5 ? 2.2 : toward > 0.7 ? 1.4 : 0.8);
        this.suspicion += dt * k;
      } else this.suspicion = Math.max(0, this.suspicion - dt * 0.15);
      if (this.suspicion < this.suspectAt) return null;
      return { x: m.x, z: m.z, d, sure: true };
    }
    if (!(m.monster === 'mimic')) this.suspicion = 0;
    const seen = this.notice.update(g, p, m, dt, 1.3);
    return seen && inSight(g, p, m) ? { x: m.x, z: m.z, d, sure: true } : null;
  }

  think(dt) {
    const g = this.g, p = this.p, out = { mx: 0, mz: 0 };
    if (p.state === 'mouse') return this.mouse(out);
    if (p.state === 'escaped') return out;
    if (p.state === 'carried') { if (g.random() < 0.3 * this.skill) this.act({ t: 'wiggle' }); return out; }
    if (p.state === 'hooked') { if (p.hookT > 45 && g.random() < 0.003) this.act({ t: 'struggle' }); return out; }
    if (p.state === 'downed') {
      const mate = this.nearestMate();
      if (mate) this.goTo(mate.x, mate.z, out, 1.5, mate.level | 0);
      return out;
    }
    this.handleSkillCheck();
    const m = g.monster, md = dist(p.x, p.z, m.x, m.z);
    const seen = this.perceive(dt);
    if (seen) this.seenAt = { x: seen.x, z: seen.z, t: g.time };
    if (m.disguise == null && this.suspicion >= this.suspectAt && !seen) this.suspicion = this.suspectAt * 0.6; // it unmasked: stay wary
    const memory = 3 + (1 - this.bravery) * 4;
    const threat = this.seenAt && g.time - this.seenAt.t < memory ? this.seenAt : null;

    // Hidden in a cupboard / porta-potty: wait until the heartbeat has faded for a while.
    if (p.hideIn != null) {
      this.calmT = md > 26 ? this.calmT + dt : 0; this.hiddenT = (this.hiddenT || 0) + dt;
      if (this.calmT > 4 + this.bravery * 3 || md > 40 || (this.hiddenT > 25 + this.bravery * 20 && md > 10)) {
        out.interact = this.toggleE(); this.hideUntilCalm = false; } // press E (released every other tick)
      else out.interact = false;
      return out;
    }
    this.hiddenT = 0;
    if (threat && dist(p.x, p.z, threat.x, threat.z) < 16) this.fearT += dt; else this.fearT = Math.max(0, this.fearT - dt);
    if (this.fearT > this.reaction) return this.flee(threat || { x: m.x, z: m.z, t: g.time }, out, !!seen);

    // The heartbeat (terror radius, no direction): the timid crouch and look for cover.
    const heartbeat = md < 32 && m.monster !== 'stalker' && !(m.monster === 'mimic' && m.disguise);
    if (heartbeat && md < 14 && this.bravery < 0.55 && !p.act) {
      const spot = this.hideSpot(10, null);
      if (spot) return this.goHide(spot, out);
      out.crouch = true;
    }
    // Injured and safe for now: stand still and mend (limited uses).
    if (p.health === 1 && (p.heals > 0 || p.inv.bandage > 0) && !threat && !heartbeat && (!p.act || p.act === 'selfheal')) { out.heal = true; return out; }
    // Flashlight: only when it's really dark and nothing hunts nearby (it gives you away).
    const wantLight = g.isBlackout() ? false : !heartbeat && (p.unlimited || p.light > 20) && (p.level | 0) === 0 && g.random() < 0.0005 ? !p.lightOn : (p.lightOn && heartbeat ? false : p.lightOn);
    if (wantLight !== !!p.lightOn) this.act({ t: 'light' });
    const r = objective(this, out);
    if (heartbeat && md < 20 && !out.run) out.crouch = out.crouch || this.bravery < 0.8;
    return r;
  }

  // a fresh E press (hiding / leaving needs press, not hold)
  toggleE() { this.eT = !this.eT; return this.eT; }

  handleSkillCheck() {
    const g = this.g, sk = this.p.skill;
    if (!sk || this.answered === sk.id) return;
    const hitT = sk.start + (sk.zoneStart + sk.zoneLen * 0.5) / sk.speed;
    if (g.time < hitT) return;
    this.answered = sk.id;
    // NPCs make real mistakes; stress (heartbeat) makes them worse.
    const stress = dist(this.p.x, this.p.z, g.monster.x, g.monster.z) < 14 ? 0.15 : 0;
    const r = g.random();
    const result = r < this.skill * 0.3 ? 'great' : r < this.skill - stress ? 'good' : 'miss';
    this.act({ t: 'skill', id: sk.id, result });
  }

  // A hiding place within reach, away from the threat (or any, if the threat is unknown).
  hideSpot(range, threat) {
    const g = this.g, p = this.p;
    return (g.map.hides || []).filter((h) => !g.state.hides[h.id].occupant && dist(p.x, p.z, h.ex, h.ez) < range &&
      (!threat || dist(h.x, h.z, threat.x, threat.z) > dist(p.x, p.z, threat.x, threat.z) - 1) && ((h.level | 0) === (p.level | 0) || range > 20))
      .sort((a, b) => dist(p.x, p.z, a.ex, a.ez) - dist(p.x, p.z, b.ex, b.ez))[0];
  }
  goHide(h, out) {
    this.mode = 'hide';
    if (this.goTo(h.ex, h.ez, out, 0.7, h.level | 0)) { out.mx = 0; out.mz = 0; out.interact = true; this.face(h.x, h.z, out); }
    return out;
  }

  flee(threat, out, seenNow) {
    const g = this.g, p = this.p, m = g.monster;
    this.mode = 'flee';
    const d = dist(p.x, p.z, threat.x, threat.z);
    // Out of its sight for now and a hiding place close by: get in.
    if (!seenNow || !inSight(g, m, p)) {
      const spot = this.hideSpot(d > 9 ? 12 : 6, threat);
      if (spot && (d > 7 || g.random() < 0.02)) return this.goHide(spot, out);
      // tall grass: slip in and freeze
      const grass = g.map.grass.filter((gr) => dist(gr.x, gr.z, p.x, p.z) < 12 && dist(gr.x, gr.z, threat.x, threat.z) > d)
        .sort((a, b) => dist(a.x, a.z, p.x, p.z) - dist(b.x, b.z, p.x, p.z))[0];
      if (grass && d > 7 && this.bravery < 0.85 && !(p.level | 0)) {
        if (inGrass(g.map, p.x, p.z)) { out.crouch = true; return out; } // freeze
        this.goTo(grass.x, grass.z, out, 1);
        out.crouch = d > 12; out.run = !out.crouch;
        return out;
      }
    }
    // Run away (each in their own direction), toward pallets and windows when close.
    let a = angleTo(threat.x, threat.z, p.x, p.z) + this.drift * 0.4;
    const H = g.map.size / 2 - 6;
    let tx = Math.max(-H, Math.min(H, p.x + Math.sin(a) * 14)), tz = Math.max(-H, Math.min(H, p.z + Math.cos(a) * 14));
    if (d < 12) { // a pallet or window between me and it nearby: loop through it
      const tool = g.map.pallets.concat(g.map.windows || []).filter((o) => dist(o.x, o.z, p.x, p.z) < 10 && dist(o.x, o.z, threat.x, threat.z) > d * 0.8)
        .sort((u, v) => dist(u.x, u.z, p.x, p.z) - dist(v.x, v.z, p.x, p.z))[0];
      if (tool) { tx = tool.x + (tool.x - threat.x) * 0.25; tz = tool.z + (tool.z - threat.z) * 0.25; }
    }
    this.goTo(tx, tz, out, 1);
    out.run = true;
    // The monster is aiming at me (strings / trident): zig-zag to make it miss.
    if (m.aiming && d < 22 && inSight(g, p, m)) {
      this.zig += 1 / 20 * 3.2;
      const s = Math.sin(this.zig) > 0 ? 1 : -1, perp = Math.atan2(out.mx, out.mz) + s * 1.2;
      out.mx = Math.sin(perp); out.mz = Math.cos(perp);
    }
    if (m.monster === 'ravager' && d > 18) { out.run = false; out.crouch = true; } // no footprints, no noise
    this.hurdle(out);
    // Slam a pallet when the monster is right behind.
    if (d < 5 && palletNear(g, p.x, p.z, 'up') && g.random() < 0.5 + this.skill * 0.4) out.interact = true;
    return out;
  }

  // Seeing a pallet / log just ahead while sprinting: skilled NPCs jump it, others sometimes trip.
  hurdle(out) {
    const g = this.g, p = this.p;
    if (!out.run || (p.y || 0) > 0.05 || this.hurdleT > g.time) return;
    const ax = p.x + (out.mx || 0) * 0.9, az = p.z + (out.mz || 0) * 0.9;
    if (!tripAt(g.map, ax, az, 0.5)) return;
    this.hurdleT = g.time + 1;
    if (g.random() < 0.45 + this.skill * 0.45) this.act({ t: 'jump' });
  }

  closestTo(o) {
    const mates = this.g.survivors().filter((s) => s.state === 'alive' && s.hideIn == null);
    return mates.sort((a, b) => dist(a.x, a.z, o.x, o.z) - dist(b.x, b.z, o.x, o.z))[0] === this.p;
  }
  nearestMate() {
    const p = this.p;
    return this.g.survivors().filter((o) => o !== p && o.state === 'alive' && o.hideIn == null)
      .sort((a, b) => dist(p.x, p.z, a.x, a.z) - dist(p.x, p.z, b.x, b.z))[0];
  }
  mouse(out) { // dead NPCs scurry after a living survivor as mice
    const mate = this.nearestMate();
    if (mate) this.goTo(mate.x + 2, mate.z + 2, out, 2, mate.level | 0);
    return out;
  }
}
