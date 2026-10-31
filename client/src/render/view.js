// GameView: owns the 3D scene for one match and maps each snapshot onto characters & props.
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { buildObjects } from './objects.js';
import { Character } from './characters.js';
import { Fx } from './fx.js';
import { CameraRig } from './camera.js';
import { Mice } from './mouse.js';
import { Pallets } from './pallets.js';
import { ViewModel } from './viewmodel.js';
import { buildInterior } from './interior.js';
import { Instinct } from './instinct.js';
import { Hides } from './hides.js';
import { settings } from '../settings.js';
import { dist } from '@shared/rng.js';
import { surfaceY, buildingAt } from '@shared/levels.js';

const MODEL_YAW = Math.PI; // the rigged model faces -Z
const INTERP_DELAY = 0.07; // seconds the render clock trails the newest snapshot

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
    this.pallets = new Pallets(this.root, map);
    this.vm = new ViewModel(stage);
    this.interior = buildInterior(this.root, map);
    this.instinct = new Instinct(this.root, map);
    this.hides = new Hides(this.root, map);
    this.quickReveal = new Map(); // survivor id → until (ms): a quick message shows the sender's aura
    this.prev = null; this.snap = null; this.snapT = 0;
    this.time = 0;
  }

  // Snapshots arrive at 20Hz but irregularly (timers / network jitter, sometimes two at once).
  // Rendering "the latest two" made running look like the world vibrating. Instead keep a short
  // buffer keyed by SIMULATION time and render a steady clock ~70ms behind the newest snapshot,
  // interpolating between the two snapshots that bracket it.
  push(snap) {
    this.prev = this.snap; this.snap = snap;
    (this.buf ||= []).push(snap);
    if (this.buf.length > 12) this.buf.shift();
    if (this.renderT == null || Math.abs(snap.time - INTERP_DELAY - this.renderT) > 0.5) this.renderT = snap.time - INTERP_DELAY;
    for (const e of snap.events || []) { this.fx.onEvent(e, snap); this.hides?.onEvent(e, this.time); }
  }

  me() { return this.snap?.players.find((p) => p.id === this.myId); }
  monster() { return this.snap?.players.find((p) => p.role === 'monster'); }

  // Find the snapshots bracketing renderT (a, b) and the blend factor.
  bracket() {
    const buf = this.buf || [];
    let a = buf[0], b = buf[0];
    for (let i = buf.length - 1; i >= 0; i--) if (buf[i].time <= this.renderT) { a = buf[i]; b = buf[i + 1] || buf[i]; break; }
    const k = b === a ? 1 : THREE.MathUtils.clamp((this.renderT - a.time) / (b.time - a.time), 0, 1);
    this.bA = a; this.bB = b; this.bK = k;
  }

  lerpPlayer(p) {
    const a = this.bA?.players.find((o) => o.id === p.id), b = this.bB?.players.find((o) => o.id === p.id);
    if (!a || !b) return { x: p.x, z: p.z, rot: p.rot };
    const k = this.bK;
    let dr = b.rot - a.rot; while (dr > Math.PI) dr -= Math.PI * 2; while (dr < -Math.PI) dr += Math.PI * 2;
    if (Math.hypot(b.x - a.x, b.z - a.z) > 4) return { x: b.x, z: b.z, rot: b.rot }; // teleports
    return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, rot: a.rot + dr * k };
  }

  update(dt, ctl) {
    if (!this.snap) return;
    this.time += dt; this.snapT += dt;
    // Advance the render clock smoothly; gently pull it toward (newest - delay) to absorb drift.
    const target = this.snap.time - INTERP_DELAY;
    this.renderT = (this.renderT ?? target) + dt;
    this.renderT += (target - this.renderT) * Math.min(1, dt * 2);
    if (this.renderT > this.snap.time) this.renderT = this.snap.time;
    this.bracket();
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
      // Stand on the real surface: terrain outdoors, floors/stairs/porches indoors (smoothed).
      const gy = surfaceY(this.map, pos.x, pos.z, p.level | 0);
      ch.groundY = ch.groundY == null || Math.abs(gy - ch.groundY) > 2 ? gy : ch.groundY + (gy - ch.groundY) * Math.min(1, dt * 14);
      ch.root.position.set(pos.x, p.state === 'hooked' ? 0 : ch.groundY, pos.z);
      ch.root.rotation.y = pos.rot + MODEL_YAW;
      if (p.state === 'carried' && p.carrier) { // ride on the carrier's shoulder (no lag)
        const cc = this.chars.get(p.carrier);
        if (cc) { ch.root.position.copy(cc.root.position); ch.root.rotation.y = cc.root.rotation.y + Math.PI / 2; }
      }
      ch.update(dt, p);
      // Mice (dead players) are visible to themselves and other dead/escaped spectators only.
      this.mice.update(p, pos, dt, p.id === this.myId || spectating, this.map);
      let visible = !(p.state === 'mouse' || p.state === 'escaped');
      // Monster player: survivors camouflaged in grass, or motionless in a blackout, are near-invisible.
      if (amMonster && p.role === 'survivor' && visible && !p.reveal) {
        const d = dist(me.x, me.z, p.x, p.z);
        if (p.hidden && d > (p.speed > 0.2 ? 4 : 1.5)) visible = false;
        if (this.snap.blackout && mon.monster === 'puppeteer' && p.speed < 0.6 && d > 3) visible = false;
      }
      // First-person monster: hide own body (a disguised Mimic may switch to a third-person view).
      if (p.id === this.myId && amMonster && this.firstPerson(ctl)) visible = false;
      // Survivors hiding in a cupboard / porta-potty can't be seen.
      if (p.hideIn != null && p.role === 'survivor') visible = false;
      // A hanged survivor is only seen from nearby (not across the whole realm), unless shown by an aura.
      if (p.state === 'hooked' && me && p.id !== this.myId && !spectating && dist(me.x, me.z, p.x, p.z) > 38) visible = false;
      // Auras (seen through walls): the monster sees survivors who failed a skill check / sprang a
      // trap (yellow); survivors see the monster for a while after someone is hanged (red); the
      // dead see the monster at all times (they can't affect the match).
      let aura = 0;
      if (p.id !== this.myId && !(p.state === 'mouse' || p.state === 'escaped')) {
        if (amMonster && p.role === 'survivor' && p.aura && (p.state === 'alive' || p.trapped)) aura = 0xffc040; // trapped / chest / botched rite
        else if (!amMonster && p.role === 'monster' && ((p.aura && me?.state !== 'hooked') || spectating || me?.eye)) aura = 0xff2020;
        // survivors: a hanging survivor senses the others; anyone starting a rite shows for 20s
        else if (!amMonster && p.role === 'survivor' && me && (me.state === 'hooked' || p.allyReveal || this.quickReveal.get(p.id) > performance.now()) && ['alive', 'downed', 'hooked'].includes(p.state)) aura = 0xffc040;
      }
      if (aura) visible = true;
      ch.setAura(!!aura && visible, aura || undefined);
      ch.root.visible = visible;
      // The Mimic casts no shadow.
      const shadow = !(p.role === 'monster' && p.monster === 'mimic');
      for (const m of ch.meshes) m.castShadow = shadow && !ch.noShadow;
    }
    for (const [id, ch] of this.chars) if (!this.snap.players.some((p) => p.id === id)) { ch.dispose(); this.chars.delete(id); }
    this.updateStain(dt, mon, amMonster);
    this.updateBeacons(me);
    this.instinct?.update(dt, me, mon, this.snap);

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
    const fp = this.firstPerson(ctl);
    // Zoom (hold B): the field of view narrows to study details far away in the map
    this.zk = (this.zk || 0) + ((ctl.down?.('zoom') ? 1 : 0) - (this.zk || 0)) * Math.min(1, dt * 9);
    const zfov = settings().video.fov / (1 + this.zk * 1.7), cam3 = this.stage.camera;
    if (Math.abs(cam3.fov - zfov) > 0.02) { cam3.fov = zfov; cam3.updateProjectionMatrix(); }
    this.stage.sky.ring.visible = true; // (the menus hide the distant treeline; the match shows it)
    if (focusPos) this.cam.update(dt, focusPos, focusP, ctl, this.map, fp);
    this.vm.update(dt, me, this.cam, this.snap, fp);
    // First-person monster footsteps, on the camera's footfalls (heavier when running).
    if (amMonster && me.speed > 0.2) {
      const step = Math.floor((this.cam.stepPhase || 0) / Math.PI);
      if (step !== this.lastStep) { this.lastStep = step; this.onStep?.(me.running || me.lunge); }
    }
    this.interior?.update(dt, this.time, this.snap);
    this.fx.update(dt, this.snap, me, mon);
    this.pallets.update(dt, this.snap);
    this.hides.update(dt, this.time);
    // Indoors the moon can't reach: lift the sky fill + exposure so interiors stay readable
    // (the mansion also has candle sconces, chandeliers and a fireplace — see render/interior.js).
    const inside = focusP && buildingAt(this.map, focusP.x, focusP.z, 0.6);
    this.indoorK = (this.indoorK || 0) + ((inside ? 1 : 0) - (this.indoorK || 0)) * Math.min(1, dt * 2);
    const bo = this.snap.blackout ? 0.25 : 1;
    this.stage.hemi.intensity += this.indoorK * 4.5 * bo;
    this.stage.renderer.toneMappingExposure += this.indoorK * 0.5 * bo;
    // Near-wall darkness: the moon is shadowed by walls next to you; a soft ambient keeps it legible.
    // shadow fill: places the moon can't reach (wall shadows, under trees) stay readable
    this.stage.ambient.intensity = (0.72 + this.indoorK * 1.0) * bo;
    this.stage.follow(focusPos || new THREE.Vector3(), this.time);
    const gm = this.world.userData.grassMat?.userData.shader; if (gm) gm.uniforms.uTime.value = this.time;
  }

  // First person for the monster — except a disguised Mimic who switched to third person (V).
  firstPerson(ctl) {
    const me = this.me();
    if (!me || me.role !== 'monster' || me.state === 'mouse' || me.state === 'escaped') return false;
    return !(me.disguise && ctl?.thirdPerson);
  }

  // Enchanted string: a violet aura pillar over every unfinished tomb, seen through walls.
  updateBeacons(me) {
    if (!this.beacons) {
      const c = document.createElement('canvas'); c.width = 32; c.height = 128;
      const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, 'rgba(190,130,255,0)'); gr.addColorStop(0.6, 'rgba(190,130,255,.55)'); gr.addColorStop(1, 'rgba(220,180,255,.9)');
      x.fillStyle = gr; x.fillRect(8, 0, 16, 128);
      const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, depthWrite: false, transparent: true, fog: false });
      this.beacons = this.map.tombs.map((t) => { const s = new THREE.Sprite(mat); s.scale.set(1.2, 7, 1); s.position.set(t.x, 3.5, t.z); s.renderOrder = 998; s.visible = false; this.root.add(s); return s; });
    }
    const on = !!me?.tombSight && me.role === 'survivor';
    this.beacons.forEach((b, i) => { b.visible = on && !this.snap.tombs[i]?.done; });
  }

  // The monster's red torch (like Dead by Daylight's red stain): a strong red light thrown ahead
  // from its head onto the ground where it looks - just light, no visible rays. Survivors see it;
  // the monster itself never does; a disguised Mimic hides it. Stronger in fog; fades only when
  // you are far away.
  updateStain(dt, mon, amMonster) {
    const st = this.stage.stain, ch = mon && this.chars.get(mon.id);
    const on = !!ch && !amMonster && !(mon.monster === 'mimic' && mon.disguise);
    const me = this.me(), d = me ? Math.hypot(me.x - mon.x, me.z - mon.z) : 99;
    const near = Math.max(0, Math.min(1, (40 - d) / 12));
    this.stainK = (this.stainK || 0) + ((on ? near : 0) - (this.stainK || 0)) * Math.min(1, dt * 4);
    const fogHere = this.fx?.fog && mon ? this.fx.fog.at(mon.x, mon.z, this.snap?.time || 0) : 0;
    const flick = 0.95 + Math.sin(this.time * 7.3) * 0.03 + Math.sin(this.time * 17) * 0.02;
    st.intensity = this.stainK * (60 + fogHere * 40) * flick;
    if (!ch) return;
    const p = ch.root.position, rot = ch.root.rotation.y - MODEL_YAW;
    const fx = Math.sin(rot), fz = Math.cos(rot);
    st.position.set(p.x + fx * 0.4, p.y + 1.9, p.z + fz * 0.4);
    st.target.position.set(p.x + fx * 8, p.y, p.z + fz * 8);
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
    this.fx.dispose(); this.mice.dispose(); this.pallets.dispose(); this.vm.dispose();
    this.stage.stain.intensity = 0;
    this.root.removeFromParent();
    this.root.traverse((o) => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose?.(); m.dispose?.(); }); });
  }
}
