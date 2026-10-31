// Monster NPC — hunts like a human killer: it only chases what it has actually seen (a vision cone,
// walls, darkness, crouching, grass, fog and hiding places all count), loses survivors who break
// line of sight, then goes where they were heading, searches nearby cupboards / porta-potties and
// grass, follows real clues (noise, failed rites, auras, crows, footprints) and patrols the tombs.
// Each monster plays to its strengths: strings and trident are aimed at where the survivor WAS a
// moment ago (so zig-zagging makes them miss), the Mimic walks up disguised and unmasks to strike.
import { BotBase } from './botBase.js';
import { dist, angleTo } from '../rng.js';
import { monsterStats } from '../monster.js';
import { weaponStats } from '../weapons.js';
import { useSpecials } from './monsterSpecials.js';
import { palletNear } from '../pallets.js';
import { Notice, inSight } from './perception.js';

export class MonsterBot extends BotBase {
  constructor(g, p) {
    super(g, p);
    this.target = null; this.lastSeen = null; this.clue = null; this.notice = new Notice();
    this.patrol = null; this.trapT = 15 + g.random() * 15; this.lastEventAt = -1;
    this.hist = new Map(); this.search = null; this.scanT = 0;
  }

  // Positions over the last second, to aim at where someone was a moment ago.
  remember(s) {
    const h = this.hist.get(s.id) || []; h.push({ t: this.g.time, x: s.x, z: s.z });
    while (h.length && this.g.time - h[0].t > 1.2) h.shift();
    this.hist.set(s.id, h);
  }
  stale(s, lag) {
    const h = this.hist.get(s.id); if (!h?.length) return { x: s.x, z: s.z, vx: 0, vz: 0 };
    const t = this.g.time - lag; let a = h[0];
    for (const e of h) if (e.t <= t) a = e;
    const b = h[Math.max(0, h.indexOf(a) - 3)] || a, dt = Math.max(0.05, a.t - b.t);
    return { x: a.x, z: a.z, vx: (a.x - b.x) / dt, vz: (a.z - b.z) / dt };
  }

  readClues() {
    const g = this.g, m = this.p;
    for (const e of g.log || []) {
      if (e.seq <= this.lastEventAt) continue;
      if (e.t === 'noise' && e.to === m.id) this.clue = { x: e.x, z: e.z, t: g.time, level: 0 };
      if (e.t === 'fail' && (m.monster === 'wanderer' || dist(m.x, m.z, e.x, e.z) < 40)) this.clue = { x: e.x, z: e.z, t: g.time, level: 0 };
      if (e.t === 'trap') this.clue = { x: e.x, z: e.z, t: g.time, level: 0 };
      if ((e.t === 'pallet' || e.t === 'hide' || e.t === 'unhide') && dist(m.x, m.z, e.x, e.z) < 14) this.clue = { x: e.x, z: e.z, t: g.time, level: 0, hide: e.t === 'hide' ? e.spot : null };
    }
    if (g.log?.length) this.lastEventAt = g.log[g.log.length - 1].seq;
    if (m.trailUntil > g.time) { // Ravager footprints
      const s = g.survivors().filter((s) => s.trailUntil > g.time && s.state === 'alive')
        .sort((a, b) => dist(m.x, m.z, a.x, a.z) - dist(m.x, m.z, b.x, b.z))[0];
      if (s) this.clue = { x: s.x, z: s.z, t: g.time, level: s.level | 0 };
    }
    // a survivor's aura (botched rite, trap, rare chest) — what a human monster would see too
    const aura = g.survivors().find((s) => s.state === 'alive' && s.auraUntil > g.time && s.hideIn == null);
    if (aura) this.clue = { x: aura.x, z: aura.z, t: g.time, level: aura.level | 0 };
  }

  think(dt) {
    const g = this.g, m = this.p, out = { mx: 0, mz: 0 };
    const st = monsterStats(g);
    this.readClues();
    if (m.stunUntil > g.time) return out;

    // Carrying: walk to the nearest free gallows and hang them
    if (m.carrying) {
      if (m.disguise) this.act({ t: 'special' });
      const hook = g.state.hooks.filter((h) => !h.victim).sort((a, b) => dist(m.x, m.z, a.x, a.z) - dist(m.x, m.z, b.x, b.z))[0];
      if (!hook) { this.act({ t: 'drop' }); return out; }
      if (this.goTo(hook.x, hook.z, out, 1.8, 0)) out.interact = true;
      return out;
    }
    // Who do I actually see? (noticing takes a moment at range)
    const surv = g.survivors().filter((s) => s.state === 'alive' || s.state === 'downed');
    for (const s of surv) { const n = this.notice.update(g, m, s, dt); if (n || inSight(g, m, s)) this.remember(s); }
    const visible = surv.filter((s) => s.state === 'alive' && (this.notice.level(s.id) >= 1 || s.revealUntil > g.time) && inSight(g, m, s))
      .sort((a, b) => dist(m.x, m.z, a.x, a.z) - dist(m.x, m.z, b.x, b.z));
    // Downed survivors I know about (seen, or groaning close by)
    const downed = surv.filter((s) => s.state === 'downed' && (dist(m.x, m.z, s.x, s.z) < 14 || this.notice.level(s.id) > 0.3 || this.lastSeen?.id === s.id))
      .sort((a, b) => dist(m.x, m.z, a.x, a.z) - dist(m.x, m.z, b.x, b.z))[0];
    if (downed && (!visible.length || dist(m.x, m.z, downed.x, downed.z) < 12)) {
      if (m.monster === 'mimic' && m.disguise) this.act({ t: 'special' }); // drop the disguise to pick up / kill
      if (this.goTo(downed.x, downed.z, out, 1.2, downed.level | 0)) out.interact = true;
      return out;
    }
    // A dropped pallet in the way: smash it (hold E).
    const pal = palletNear(g, m.x, m.z, 'down', 1.9);
    if (pal && pal.kind !== 'log' && this.lastSeen && g.time - this.lastSeen.t < 4) { out.interact = true; return out; }
    const tgt = visible[0];
    if (tgt) { this.lastSeen = { x: tgt.x, z: tgt.z, t: g.time, id: tgt.id, level: tgt.level | 0, rot: tgt.rot, speed: tgt.speed }; this.search = null; }
    useSpecials(this, out, st, tgt);
    if (tgt) return this.chase(tgt, out, st);
    if (out.aim) return out;

    // Lost them: go to where they were heading, then search around there.
    if (this.lastSeen && g.time - this.lastSeen.t < 7) {
      const ls = this.lastSeen, ahead = Math.min(6, (ls.speed || 0) * 1.6);
      const px = ls.x + Math.sin(ls.rot || 0) * ahead, pz = ls.z + Math.cos(ls.rot || 0) * ahead;
      if (this.goTo(px, pz, out, 1.5, ls.level)) { this.search = { x: px, z: pz, level: ls.level, until: g.time + 12, checked: new Set() }; this.lastSeen = null; }
      out.run = true;
      return out;
    }
    if (this.search && g.time < this.search.until) return this.searchArea(out);
    if (this.clue && g.time - this.clue.t < 12) {
      if (this.goTo(this.clue.x, this.clue.z, out, 2, this.clue.level || 0)) {
        this.search = { x: this.clue.x, z: this.clue.z, level: this.clue.level || 0, until: g.time + 8, checked: new Set(), prefer: this.clue.hide };
        this.clue = null;
      } else out.run = dist(m.x, m.z, this.clue.x, this.clue.z) > 8;
      return out;
    }
    // Lay traps where survivors will come: tombs being worked on, near pallets and windows
    this.trapT -= dt;
    if (this.trapT < 0 && m.traps > 0) {
      const spot = g.state.tombs.find((t) => !t.done && t.progress > 0.1 && dist(m.x, m.z, t.x, t.z) < 6)
        || g.map.pallets.concat(g.map.windows || []).find((o) => dist(m.x, m.z, o.x, o.z) < 3);
      if (spot) { this.act({ t: 'trap' }); this.trapT = 30 + g.random() * 25; }
    }
    return this.patrolTombs(out);
  }

  // Check the hiding places and grass around the spot where they vanished.
  searchArea(out) {
    const g = this.g, m = this.p, s = this.search;
    const hide = (g.map.hides || []).filter((h) => !s.checked.has(h.id) && dist(h.x, h.z, s.x, s.z) < 11 && (h.level | 0) === (s.level | 0))
      .sort((a, b) => (b.id === s.prefer) - (a.id === s.prefer) || dist(m.x, m.z, a.ex, a.ez) - dist(m.x, m.z, b.ex, b.ez))[0];
    if (hide && (hide.id === s.prefer || g.random() < 0.97)) {
      if (this.goTo(hide.ex, hide.ez, out, 0.9, hide.level | 0)) {
        out.mx = 0; out.mz = 0; out.interact = true; this.face(hide.x, hide.z, out);
        if (m.act !== 'search') { this.searchHold = (this.searchHold || 0) + 1 / 20; if (this.searchHold > 1.6) { s.checked.add(hide.id); this.searchHold = 0; } }
      }
      return out;
    }
    // wander around the spot, looking
    if (!s.pt || this.goTo(s.pt.x, s.pt.z, out, 1.5, s.level)) {
      const a = g.random() * Math.PI * 2, r = 3 + g.random() * 7;
      s.pt = { x: s.x + Math.sin(a) * r, z: s.z + Math.cos(a) * r };
    }
    return out;
  }

  chase(tgt, out, st) {
    const g = this.g, m = this.p;
    const d = dist(m.x, m.z, tgt.x, tgt.z);
    // the disguised Mimic walks up calmly like a friend, then unmasks at arm's length
    if (m.monster === 'mimic' && m.disguise) {
      this.goTo(tgt.x, tgt.z, out, 0.5, tgt.level | 0);
      out.run = false;
      if (d < 2.6 || (d < 6 && tgt.running)) this.act({ t: 'special' });
      return out;
    }
    // lead the target slightly, like a human would
    const lead = Math.min(1.2, d / 6);
    const tx = tgt.x + Math.sin(tgt.rot) * tgt.speed * lead * 0.4, tz = tgt.z + Math.cos(tgt.rot) * tgt.speed * lead * 0.4;
    this.goTo(tx, tz, out, 0.2, tgt.level | 0);
    out.run = true; // sprint during a chase
    if (weaponStats(m.weapon, m.weaponLvl).rev && d < 9 && tgt.health <= 1 && m.sawUntil < g.time) this.act({ t: 'rev' });
    if (d < st.range * 0.9 && m.attackCdUntil < g.time) {
      this.face(tgt.x, tgt.z, out);
      if (g.random() < 0.35 + this.skill * 0.4) this.act({ t: 'attack' }); // missed timings happen
    }
    return out;
  }

  patrolTombs(out) {
    const g = this.g, m = this.p;
    if (!this.patrol || this.goTo(this.patrol.x, this.patrol.z, out, 2, this.patrol.level || 0)) {
      const tombs = g.state.tombs.filter((t) => !t.done).concat(g.state.tombs.filter((t) => t.done && m.monster === 'mimic' && !t.protected));
      const pool = g.state.keys.length ? g.state.keys.filter((k) => !k.taken).concat([g.state.door]) : tombs;
      let pick = pool.length ? pool[Math.floor(g.random() * pool.length)] : g.randomPoint(), level = 0;
      if (g.random() < 0.12) { pick = g.randomPoint(); }                                   // roam
      if (g.random() < 0.08) { const b = g.map.buildings.find((x) => x.floors >= 2); if (b) { pick = { x: b.x + (g.random() - 0.5) * (b.w - 4), z: b.z + (g.random() - 0.5) * (b.d - 4) }; level = 1; } } // upstairs
      this.patrol = { x: pick.x + (g.random() - 0.5) * 6, z: pick.z + (g.random() - 0.5) * 6, level };
    }
    // look around now and then while walking
    this.scanT -= 1 / 20;
    if (this.scanT < 0) { this.scanT = 2 + this.g.random() * 3; this.scanTurn = (this.g.random() - 0.5) * 2.2; }
    // kick progressed tombs / break enchanted ones as the Mimic
    const t = g.state.tombs.find((t) => dist(m.x, m.z, t.x, t.z) < 2.5 && (t.done ? m.monster === 'mimic' && m.disguise && !t.protected : t.progress > 0.15));
    if (t) { out.mx = 0; out.mz = 0; out.interact = true; }
    return out;
  }
}
