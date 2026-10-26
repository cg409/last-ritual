// GameView: owns the 3D scene for one match and maps each snapshot onto characters & props.
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { buildObjects } from './objects.js';
import { Character } from './characters.js';
import { Fx } from './fx.js';
import { CameraRig } from './camera.js';
import { Mice } from './mouse.js';
import { dist } from '@shared/rng.js';

const MODEL_YAW = Math.PI; // the rigged model faces -Z

export class GameView {
  constructor(stage, map, myId) {
    this.stage = stage; this.map = map; this.myId = myId;
    this.scene = stage.scene;
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.world = buildWorld(this.root, map);
    this.objs = buildObjects(this.root, map);
    this.chars = new Map();
    this.fx = new Fx(this, map);
    this.cam = new CameraRig(stage.camera);
    this.mice = new Mice(this.root);
    this.prev = null; this.snap = null; this.snapT = 0;
    this.time = 0;
  }

  // Interpolate positions between the two latest snapshots (smooth 60fps from 20Hz updates).
  push(snap) {
    this.prev = this.snap; this.snap = snap; this.snapT = 0;
    for (const e of snap.events || []) this.fx.onEvent(e, snap);
  }

  me() { return this.snap?.players.find((p) => p.id === this.myId); }
  monster() { return this.snap?.players.find((p) => p.role === 'monster'); }

  lerpPlayer(p) {
    const q = this.prev?.players.find((o) => o.id === p.id);
    if (!q) return { x: p.x, z: p.z, rot: p.rot };
    const k = Math.min(1, this.snapT / 0.05);
    let dr = p.rot - q.rot; while (dr > Math.PI) dr -= Math.PI * 2; while (dr < -Math.PI) dr += Math.PI * 2;
    if (Math.hypot(p.x - q.x, p.z - q.z) > 4) return { x: p.x, z: p.z, rot: p.rot }; // teleports
    return { x: q.x + (p.x - q.x) * k, z: q.z + (p.z - q.z) * k, rot: q.rot + dr * k };
  }

  update(dt, ctl) {
    if (!this.snap) return;
    this.time += dt; this.snapT += dt;
    const me = this.me(), mon = this.monster();
    const amMonster = me?.role === 'monster';
    const spectating = me && (me.state === 'mouse' || me.state === 'escaped');
    for (const p of this.snap.players) {
      let ch = this.chars.get(p.id);
      if (!ch) { ch = new Character(p); this.chars.set(p.id, ch); this.root.add(ch.root); }
      const pos = this.lerpPlayer(p);
      if (p.state === 'hooked' && p.hookId != null) { // hang from the noose, not the post
        const h = this.map.hooks.find((h) => h.id === p.hookId);
        if (h) { pos.x = h.x + Math.cos(h.rot) * 1.15; pos.z = h.z - Math.sin(h.rot) * 1.15; pos.rot = h.rot; }
      }
      ch.root.position.set(pos.x, 0, pos.z);
      ch.root.rotation.y = pos.rot + MODEL_YAW;
      if (p.state === 'carried' && p.carrier) { // ride on the carrier's shoulder (no lag)
        const cc = this.chars.get(p.carrier);
        if (cc) { ch.root.position.copy(cc.root.position); ch.root.rotation.y = cc.root.rotation.y + Math.PI / 2; }
      }
      ch.update(dt, p);
      // Mice (dead players) are visible to themselves and other dead/escaped spectators only.
      this.mice.update(p, pos, dt, p.id === this.myId || spectating);
      let visible = !(p.state === 'mouse' || p.state === 'escaped');
      // Monster player: survivors camouflaged in grass, or motionless in a blackout, are near-invisible.
      if (amMonster && p.role === 'survivor' && visible && !p.reveal) {
        const d = dist(me.x, me.z, p.x, p.z);
        if (p.hidden && d > (p.speed > 0.2 ? 4 : 1.5)) visible = false;
        if (this.snap.blackout && mon.monster === 'puppeteer' && p.speed < 0.6 && d > 3) visible = false;
      }
      // First-person monster: hide own body.
      if (p.id === this.myId && amMonster) visible = false;
      ch.root.visible = visible;
      // The Mimic casts no shadow.
      const shadow = !(p.role === 'monster' && p.monster === 'mimic');
      for (const m of ch.meshes) m.castShadow = shadow && !ch.noShadow;
      if (p.role === 'monster' && ch.weapon) ch.weapon.visible = !p.disguise;
    }
    for (const [id, ch] of this.chars) if (!this.snap.players.some((p) => p.id === id)) { ch.dispose(); this.chars.delete(id); }

    // Stalker: your own shadow blinks and the world warps when it is near.
    let warp = 0;
    if (me && mon && mon.monster === 'stalker' && me.role === 'survivor' && me.state === 'alive') {
      const d = dist(me.x, me.z, mon.x, mon.z);
      const range = me.holding ? 22 : 15;
      if (d < range) {
        warp = 1 - d / range;
        const myCh = this.chars.get(me.id);
        myCh.noShadow = Math.sin(this.time * (8 + warp * 25)) > 0.2 - warp * 0.4 ? false : true;
      } else { const c = this.chars.get(me.id); if (c) c.noShadow = false; }
    }
    this.stage.grade.uniforms.uWarp.value += (warp - this.stage.grade.uniforms.uWarp.value) * Math.min(1, dt * 3);

    const focusP = spectating ? this.spectateTarget(ctl) : me;
    const fch = focusP && this.chars.get(focusP.id);
    const mouseObj = focusP?.state === 'mouse' ? this.mice.items.get(focusP.id) : null;
    const focusPos = mouseObj ? mouseObj.position : fch?.root.position;
    if (focusPos) this.cam.update(dt, focusPos, focusP, ctl, this.map, amMonster && !spectating);
    this.fx.update(dt, this.snap, me, mon);
    this.stage.follow(focusPos || new THREE.Vector3(), this.time);
    const gm = this.world.userData.grassMat?.userData.shader; if (gm) gm.uniforms.uTime.value = this.time;
  }

  // Dead survivors (mice) and escapees can spectate the remaining survivors.
  spectateTarget(ctl) {
    const alive = this.snap.players.filter((p) => p.role === 'survivor' && !['mouse', 'escaped'].includes(p.state));
    const pool = alive.length ? alive : this.snap.players.filter((p) => p.role === 'monster');
    if (ctl.spectateNext) { this.specIdx = (this.specIdx || 0) + 1; ctl.spectateNext = false; }
    const me = this.me();
    if (me?.state === 'mouse' && !ctl.spectating) return me; // free-roam as the mouse
    return pool[(this.specIdx || 0) % pool.length];
  }

  dispose() {
    this.fx.dispose(); this.mice.dispose();
    this.root.removeFromParent();
    this.root.traverse((o) => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose?.(); m.dispose?.(); }); });
  }
}
