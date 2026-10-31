// Dynamic props & effects: tomb glow/cracks, gate, keys, candles, traps, trident, crows, lightning,
// blackout, Ravager footprints, Mimic exposure smoke.
import * as THREE from 'three';
import { makeTorch, tickTorch } from './items.js';
import { makeKey } from './landmarks.js';
import { animateCrow } from './crow.js';
import { makeTrap, makeThrown, Bolt, Puffs, Footprints } from './effects.js';
import { dist } from '@shared/rng.js';
import { surfaceY } from '@shared/levels.js';
import { makeChest } from './chests.js';
import { vlight } from './lights.js';
import { makeFog } from '@shared/fog.js';
import { FogBanks } from './fogBanks.js';

const _fogCol = new THREE.Color(0x2c323a); // pale grey-blue fog bank
const _curseCol = new THREE.Color(0x3b3f45); // grey grave-fog

export class Fx {
  constructor(view, map) {
    this.view = view; this.map = map; this.root = view.root;
    this.keys = new Map(); this.candles = new Map(); this.traps = new Map(); this.projs = new Map();
    this.bolts = []; this.puffs = new Puffs(this.root); this.prints = new Footprints(this.root);
    this.flash = 0; this.blackK = 0; this.curseK = 0; this.screech = new Map();
    this.fog = makeFog(map.seed, map.size, map.buildings); this.fogK = 0; this.banks = new FogBanks(this.root, this.fog, map);
    this.lights = new Map(); this.chestOpen = new Set();
    this.chestObjs = (map.chests || []).map((c) => {
      const o = makeChest(c.tier); o.position.set(c.x, surfaceY(map, c.x, c.z, c.lv | 0), c.z); o.rotation.y = c.rot;
      this.root.add(o);
      return { id: c.id, o, lid: o.userData.lid };
    });
  }

  onEvent(e) {
    const v = this.view;
    if (e.t === 'lightning') { this.bolts.push(new Bolt(this.root, e.x, e.z)); this.flash = 1; }
    if (e.t === 'crows') this.screech.set(e.tower, v.time);
    // dark omen smoke (no effect at all for pallets / logs / trips)
    if (e.t === 'exposed') this.puffs.burst(e.x, e.z, 'blood', 30);
    if (e.t === 'teleport') this.puffs.burst(e.x, e.z, 'shadow', 26);
    if (e.t === 'broken' || e.t === 'fail') this.puffs.burst(e.x, e.z, 'ash', 16);
    if (e.t === 'trap') this.puffs.burst(e.x, e.z, e.type === 'cursed' ? 'shadow' : 'ash', 10);
    if (e.t === 'hit' && e.id === v.myId) v.cam.shake = 1;
    if (e.t === 'pallet' && e.stun) v.cam.shake = Math.max(v.cam.shake, 0.6);
    if (e.t === 'trip' && e.id === v.myId) v.cam.shake = 0.8;
    if (e.t === 'chest') this.chestOpen.add(e.chest);
    if (e.t === 'saw' || e.t === 'swing') { const ch = v.chars.get(e.id) || [...v.chars.values()].find((c) => c.isMonster); ch?.swing(); }
    // First-person hands of the local monster.
    const meMon = v.me()?.role === 'monster';
    if (meMon) {
      if (e.t === 'swing') v.vm.swing();
      if (e.t === 'throw') v.vm.throwIt();
      if (e.t === 'string') v.vm.lash();
      if (e.t === 'hit') { v.vm.impact(); v.cam.shake = Math.max(v.cam.shake, 0.35); }
    }
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
      o.light.intensity = s.blackout ? 0 : tb.done ? 1.6 : k * 0.8; // faint rune glow only
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
      tw.crows.forEach((c) => animateCrow(c, t, k, dt));
    }
    this.sync(this.keys, s.keys.filter((k) => !k.taken), () => makeKey(), (o, k) => { o.position.set(k.x, 0.3 + Math.sin(t * 2) * 0.1, k.z); o.rotation.y = t; o.visible = !amMonster || true; });
    this.sync(this.candles, s.candles, () => makeTorch(), (o, c) => { // a torch planted in the ground
      o.position.set(c.x, surfaceY(this.map, c.x, c.z, c.level | 0) + 0.2, c.z); o.scale.setScalar(1.35);
      const lit = c.lit && !s.blackout;
      o.userData.flame.visible = lit; o.userData.light.intensity = lit ? o.userData.baseI : 0;
      tickTorch(o, t);
    });
    // Traps are invisible to survivors unless very close (a candle or flashlight helps spot them).
    this.sync(this.traps, s.traps, (tr) => makeTrap(tr.type), (o, tr) => {
      o.position.set(tr.x, surfaceY(this.map, tr.x, tr.z, tr.level | 0) + 0.01, tr.z);
      const seeR = me?.lightOn ? 5.5 : me?.holding ? 4.5 : 2.2;
      o.visible = amMonster || (!!me && (me.level | 0) === (tr.level | 0) && dist(me.x, me.z, tr.x, tr.z) < seeR);
    });
    // Chests: the lid swings open once looted.
    for (const c of this.chestObjs) {
      const st = s.chests?.find((x) => x.id === c.id);
      const open = st?.opened || this.chestOpen.has(c.id);
      c.lid.rotation.x += ((open ? -1.9 : 0) - c.lid.rotation.x) * Math.min(1, dt * 3);
    }
    // Flashlights: a beam of light thrown ahead of every survivor whose light is on.
    for (const p of s.players) {
      let l = this.lights.get(p.id);
      const on = p.role === 'survivor' && p.lightOn && p.state === 'alive' && !s.blackout;
      if (!l && on) { l = vlight(0xfff2d8, 0, 9, 1.4); this.root.add(l); this.lights.set(p.id, l); }
      if (!l) continue;
      const ch = v.chars.get(p.id);
      l.intensity += ((on ? 5.5 : 0) - l.intensity) * Math.min(1, dt * 12);
      if (ch) { const r = ch.root.rotation.y - Math.PI; l.position.set(ch.root.position.x + Math.sin(r) * 2.6, ch.root.position.y + 1.0, ch.root.position.z + Math.cos(r) * 2.6); }
    }
    this.sync(this.projs, s.projectiles, (p) => makeThrown(s.players.find((q) => q.id === p.owner)?.weapon), (o, p) => { o.position.set(p.x, 1.4, p.z); o.rotation.set(0, p.dir, 0); if (o.userData.pivot) o.userData.pivot.rotation.x = this.view.time * 16; });
    // Monster lantern/candle lights off during blackout
    for (const ch of v.chars.values()) {
      if (ch.candle && s.blackout) ch.candle.userData.beam.visible = ch.candle.userData.lens.visible = false;
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
    st.moon.intensity = st.baseMoon * (1 - kb * 0.9);
    st.hemi.intensity = st.baseHemi * (1 - kb * 0.85) + (amMonster ? 0.25 : 0);
    st.scene.fog.density = st.baseFog + kb * 0.07 - (amMonster ? 0.006 : 0);
    st.sky.setDark(kb);
    st.scene.fog.color.copy(st.fogColor).multiplyScalar(1 - kb * 0.85);
    // Drifting fog banks: the thicker the fog where you stand, the shorter you (and the monster) see.
    const cam = st.camera.position, ft = s.time || 0;
    const fNow = this.fog.at(cam.x, cam.z, ft) * (1 - (v.indoorK || 0));
    this.fogK += (fNow - this.fogK) * Math.min(1, dt * 0.6);
    st.scene.fog.density += this.fogK * 0.085;
    st.scene.fog.color.lerp(_fogCol, this.fogK * 0.55 * (1 - kb));
    this.banks.update(ft, kb, cam, dt);
    // Cursed trap: grave-fog swallows the world around the victim.
    const curse = !amMonster && me?.cursed > 0 ? 1 : 0;
    this.curseK += (curse - this.curseK) * Math.min(1, dt * 2);
    if (this.curseK > 0.01) { st.scene.fog.density += this.curseK * 0.28; st.scene.fog.color.lerp(_curseCol, this.curseK); }
    st.scene.background.copy(st.scene.fog.color);
    // Lightning flash
    this.flash = Math.max(0, this.flash - dt * 2.5);
    st.renderer.toneMappingExposure = st.baseExposure + this.flash * 1.6;
    this.bolts = this.bolts.filter((b) => b.update(dt));
    this.puffs.update(dt);
  }

  dispose() { this.prints.dispose(); for (const l of this.lights.values()) l.dispose(); }
}
