// Monster AI — patrols tombs, hunts by sight & sound, uses each monster's special, sets traps, hangs survivors.
import { BotBase } from './botBase.js';
import { dist, angleTo } from '../rng.js';
import { lineOfSight } from '../nav.js';
import { monsterStats } from '../monster.js';
import { useSpecials } from './monsterSpecials.js';

export class MonsterBot extends BotBase {
  constructor(g, p) {
    super(g, p);
    this.target = null; this.lastSeen = null; this.clue = null;
    this.patrol = null; this.trapT = 20 + g.random() * 20; this.lastEventAt = -1;
  }

  canSee(s) {
    const g = this.g, m = this.p;
    if (s.state !== 'alive' && s.state !== 'downed') return false;
    const d = dist(m.x, m.z, s.x, s.z);
    if (s.revealUntil > g.time) return true;
    let range = 20;
    if (g.isBlackout()) range = m.monster === 'puppeteer' ? 22 : 8;
    if (s.holding) range += 8;
    if (s.hidden) range = s.moving ? 4 : 1.5;                    // camouflaged in grass
    if (g.isBlackout() && m.monster === 'puppeteer' && s.speed < 0.6) range = 3; // stillness hides you
    if (d > range) return false;
    const facing = Math.abs(((angleTo(m.x, m.z, s.x, s.z) - m.rot + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (facing > 1.6 && d > 4) return false;                      // ~180° vision cone
    return lineOfSight(g.map, m.x, m.z, s.x, s.z);
  }

  readClues() {
    const g = this.g, m = this.p;
    for (const e of g.log || []) {
      if (e.seq <= this.lastEventAt) continue;
      if (e.t === 'noise' && e.to === m.id) this.clue = { x: e.x, z: e.z, t: g.time };
      if (e.t === 'fail' && (m.monster === 'wanderer' || dist(m.x, m.z, e.x, e.z) < 40)) this.clue = { x: e.x, z: e.z, t: g.time };
      if (e.t === 'trap') this.clue = { x: e.x, z: e.z, t: g.time };
    }
    if (g.log?.length) this.lastEventAt = g.log[g.log.length - 1].seq;
    if (m.trailUntil > g.time) { // Ravager footprints
      const s = g.survivors().filter((s) => s.trailUntil > g.time && s.state === 'alive')
        .sort((a, b) => dist(m.x, m.z, a.x, a.z) - dist(m.x, m.z, b.x, b.z))[0];
      if (s) this.clue = { x: s.x, z: s.z, t: g.time };
    }
  }

  think(dt) {
    const g = this.g, m = this.p, out = { mx: 0, mz: 0 };
    const st = monsterStats(g);
    this.readClues();
    if (m.stunUntil > g.time) return out;

    // Carrying: walk to the nearest free gallows and hang them
    if (m.carrying) {
      const hook = g.state.hooks.filter((h) => !h.victim).sort((a, b) => dist(m.x, m.z, a.x, a.z) - dist(m.x, m.z, b.x, b.z))[0];
      if (!hook) { this.act({ t: 'drop' }); return out; }
      if (this.goTo(hook.x, hook.z, out, 1.8)) out.interact = true;
      return out;
    }
    // Downed survivor nearby: pick up (or finish on second life)
    const downed = g.survivors().filter((s) => s.state === 'downed').sort((a, b) => dist(m.x, m.z, a.x, a.z) - dist(m.x, m.z, b.x, b.z))[0];
    const visible = g.survivors().filter((s) => s.state === 'alive' && this.canSee(s))
      .sort((a, b) => dist(m.x, m.z, a.x, a.z) - dist(m.x, m.z, b.x, b.z));
    if (downed && (dist(m.x, m.z, downed.x, downed.z) < 25 || !visible.length)) {
      if (m.monster === 'mimic' && m.disguise) this.act({ t: 'special' }); // drop disguise to kill
      if (this.goTo(downed.x, downed.z, out, 1.2)) out.interact = true;
      return out;
    }

    const tgt = visible[0];
    if (tgt) { this.lastSeen = { x: tgt.x, z: tgt.z, t: g.time, id: tgt.id }; }
    useSpecials(this, out, st, tgt);
    if (tgt) return this.chase(tgt, out, st);
    if (this.lastSeen && g.time - this.lastSeen.t < 6) { // search last known position
      if (this.goTo(this.lastSeen.x, this.lastSeen.z, out, 1.5)) this.lastSeen = null;
      return out;
    }
    if (this.clue && g.time - this.clue.t < 10) {
      if (this.goTo(this.clue.x, this.clue.z, out, 2)) this.clue = null;
      return out;
    }
    // Lay traps near tombs while patrolling
    this.trapT -= dt;
    if (this.trapT < 0 && m.traps > 0) {
      const t = g.state.tombs.find((t) => !t.done && dist(m.x, m.z, t.x, t.z) < 8);
      if (t) { this.act({ t: 'trap' }); this.trapT = 25 + g.random() * 20; }
    }
    return this.patrolTombs(out);
  }

  chase(tgt, out, st) {
    const g = this.g, m = this.p;
    const d = dist(m.x, m.z, tgt.x, tgt.z);
    // lead the target slightly, like a human would
    const lead = Math.min(1.2, d / 6);
    const tx = tgt.x + Math.sin(tgt.rot) * tgt.speed * lead * 0.4, tz = tgt.z + Math.cos(tgt.rot) * tgt.speed * lead * 0.4;
    this.goTo(tx, tz, out, 0.2);
    if (m.monster === 'ravager' && d < 9 && tgt.health <= 1 && m.sawUntil < g.time) this.act({ t: 'rev' });
    if (m.monster === 'mimic' && m.disguise && d < 5) this.act({ t: 'special' }); // reveal and strike
    if (d < st.range * 0.9 && m.attackCdUntil < g.time) {
      this.face(tgt.x, tgt.z, out);
      if (this.g.random() < 0.35 + this.skill * 0.4) this.act({ t: 'attack' }); // missed timings happen
    }
    return out;
  }

  patrolTombs(out) {
    const g = this.g, m = this.p;
    if (!this.patrol || this.goTo(this.patrol.x, this.patrol.z, out, 2)) {
      const opts = g.state.tombs.filter((t) => !t.done).concat(g.state.tombs.filter((t) => t.done && m.monster === 'mimic' && !t.protected));
      const pool = g.state.keys.length ? g.state.keys.filter((k) => !k.taken).concat([g.state.door]) : opts;
      const pick = pool.length ? pool[Math.floor(g.random() * pool.length)] : g.randomPoint();
      this.patrol = { x: pick.x + (g.random() - 0.5) * 6, z: pick.z + (g.random() - 0.5) * 6 };
    }
    // kick progressed tombs / break enchanted ones as the Mimic
    const t = g.state.tombs.find((t) => dist(m.x, m.z, t.x, t.z) < 2.5 && (t.done ? m.monster === 'mimic' && m.disguise && !t.protected : t.progress > 0.25));
    if (t) { out.mx = 0; out.mz = 0; out.interact = true; }
    return out;
  }
}
