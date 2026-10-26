// Dynamic props & effects: tomb glow/cracks, gate, keys, candles, traps, trident, crows, lightning,
// blackout, Ravager footprints, Mimic exposure smoke.
import * as THREE from 'three';
import { makeCandle } from './items.js';
import { makeKey } from './landmarks.js';
import { animateCrow } from './crow.js';
import { makeTrap, makeTrident, Bolt, Puffs, Footprints } from './effects.js';
import { dist } from '@shared/rng.js';

export class Fx {
  constructor(view, map) {
    this.view = view; this.map = map; this.root = view.root;
    this.keys = new Map(); this.candles = new Map(); this.traps = new Map(); this.projs = new Map();
    this.bolts = []; this.puffs = new Puffs(this.root); this.prints = new Footprints(this.root);
    this.flash = 0; this.blackK = 0; this.screech = new Map();
  }

  onEvent(e) {
    const v = this.view;
    if (e.t === 'lightning') { this.bolts.push(new Bolt(this.root, e.x, e.z)); this.flash = 1; }
    if (e.t === 'crows') this.screech.set(e.tower, v.time);
    if (e.t === 'exposed') this.puffs.burst(e.x, e.z, 0x220000, 40);
    if (e.t === 'teleport') this.puffs.burst(e.x, e.z, 0x050505, 30);
    if (e.t === 'broken' || e.t === 'fail') this.puffs.burst(e.x, e.z, 0x6a5aa0, 18);
    if (e.t === 'hit' && e.id === v.myId) v.cam.shake = 1;
    if (e.t === 'saw' || e.t === 'swing') { const ch = v.chars.get(e.id) || [...v.chars.values()].find((c) => c.isMonster); ch?.swing(); }
  }

  sync(map, list, make, upd) {
    const seen = new Set();
    for (const it of list) {
      seen.add(it.id);
      let o = map.get(it.id);
      if (!o) { o = make(it); this.root.add(o); map.set(it.id, o); }
      upd(o, it);
    }
    for (const [id, o] of map) if (!seen.has(id)) { o.traverse((c) => c.isVLight && c.dispose()); o.removeFromParent(); map.delete(id); }
  }

  update(dt, s, me, mon) {
    const v = this.view, t = v.time, objs = v.objs;
    const amMonster = me?.role === 'monster';
    // Tombs: rune glow follows progress, cracks/shards show damage.
    s.tombs.forEach((tb, i) => {
      const o = objs.tombs[i]; if (!o) return;
      const k = tb.done ? 1 : tb.progress;
      o.runeMat.opacity = tb.done ? 0.9 + Math.sin(t * 2) * 0.1 : k * 0.6 * (0.8 + Math.sin(t * 6) * 0.2);
      o.rune.rotation.z += dt * (0.1 + k * 0.6);
      o.light.intensity = s.blackout ? 0 : tb.done ? 6 : k * 3;
      o.lid.position.y = 1.07 + (tb.done ? 0.1 : 0) + (tb.progress > 0 && !tb.done ? Math.sin(t * 30) * 0.004 * k : 0);
      o.shards.forEach((sh, j) => (sh.visible = j < tb.cracks));
      o.cross.rotation.z = Math.min(tb.cracks, 4) * 0.08;
      o.arm.visible = tb.cracks < 5;
    });
    // Exit gate
    const d = objs.door;
    d.sockets.forEach((sk, i) => { const on = i < s.door.keys; sk.material.emissive.setHex(on ? 0xffb030 : 0); sk.material.emissiveIntensity = on ? 2 : 0; });
    for (const dr of d.doors) dr.pivot.rotation.y += ((s.door.open ? dr.s * 1.5 : 0) - dr.pivot.rotation.y) * Math.min(1, dt * 1.5);
    d.light.intensity = s.door.open ? 8 : 0; d.glowMat.opacity = s.door.open ? 0.35 + Math.sin(t * 2) * 0.05 : 0;
    // Lamps die during blackout and flicker as the monster walks by.
    for (const l of objs.lamps) {
      const near = mon && dist(mon.x, mon.z, l.g.position.x, l.g.position.z) < 10;
      const f = s.blackout ? 0 : near ? (Math.random() < 0.3 ? 0.1 : 1) : 1;
      l.light.intensity = l.base * f; l.glass.material.emissiveIntensity = 2.5 * f;
    }
    // Crows
    for (const tw of objs.towers) {
      const since = t - (this.screech.get(tw.id) ?? -99);
      const k = since < 2.5 ? 1 - since / 2.5 : 0;
      tw.crows.forEach((c) => animateCrow(c, t, k));
    }
    this.sync(this.keys, s.keys.filter((k) => !k.taken), () => makeKey(), (o, k) => { o.position.set(k.x, 0.3 + Math.sin(t * 2) * 0.1, k.z); o.rotation.y = t; o.visible = !amMonster || true; });
    this.sync(this.candles, s.candles, () => makeCandle(), (o, c) => {
      o.position.set(c.x, 0, c.z); o.scale.setScalar(2.2);
      const lit = c.lit && !s.blackout;
      o.userData.flame.visible = lit; o.userData.light.intensity = lit ? 5 : 0;
    });
    // Traps are invisible to survivors unless very close (or holding a candle).
    this.sync(this.traps, s.traps, (tr) => makeTrap(tr.type), (o, tr) => {
      o.position.set(tr.x, 0.02, tr.z);
      const seeR = me?.holding ? 4.5 : 2.2;
      o.visible = amMonster || (me && dist(me.x, me.z, tr.x, tr.z) < seeR);
    });
    this.sync(this.projs, s.projectiles, () => makeTrident(), (o, p) => { o.position.set(p.x, 1.4, p.z); o.rotation.set(0, p.dir, 0); });
    // Monster lantern/candle lights off during blackout
    for (const ch of v.chars.values()) {
      ch.candle && (ch.candle.userData.light.intensity = s.blackout ? 0 : 4, ch.candle.userData.flame.visible = !s.blackout);
    }
    // Ravager footprints: visible only to the Ravager.
    if (amMonster && mon.monster === 'ravager') {
      for (const p of s.players) if (p.trail && p.role === 'survivor' && p.state === 'alive' && !p.crouch && !p.crawl && p.speed > 0.3) this.prints.step(p.id, p.x, p.z, p.rot, t);
    }
    this.prints.update(t);
    // Blackout: kill most of the moon & fog to pitch black (the Puppeteer sees fine).
    const black = s.blackout ? 1 : 0;
    this.blackK += (black - this.blackK) * Math.min(1, dt * 2.5);
    const seer = amMonster && mon.monster === 'puppeteer';
    const st = v.stage;
    const kb = seer ? this.blackK * 0.3 : this.blackK;
    st.moon.intensity = st.baseMoon * (1 - kb * 0.88);
    st.hemi.intensity = st.baseHemi * (1 - kb * 0.85) + (amMonster ? 0.4 : 0);
    st.scene.fog.density = 0.035 + kb * 0.07 - (amMonster ? 0.008 : 0);
    st.scene.fog.color.copy(st.fogColor).multiplyScalar(1 - kb * 0.85);
    st.scene.background.copy(st.scene.fog.color);
    // Lightning flash
    this.flash = Math.max(0, this.flash - dt * 2.5);
    st.renderer.toneMappingExposure = st.baseExposure + this.flash * 1.6;
    this.bolts = this.bolts.filter((b) => b.update(dt));
    this.puffs.update(dt);
  }

  dispose() { this.prints.dispose(); }
}
