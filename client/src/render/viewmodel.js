// First-person "viewmodel" for the monster player: only the monster's weapon (no hands), entering
// the frame from the lower right with just its top on screen. Drawn in an overlay pass
// (stage.vmPass) so it never clips into walls. Procedurally animated: breathing, walk/run sway
// locked to the camera's footsteps, swing/lunge, trident aim & throw, halberd thrust (puppet
// string), chainsaw rev, carrying, stunned and hold-E actions.
import * as THREE from 'three';
import { cloneWeapon } from './assets.js';
import { HOLD, holdQuat, sample, SWING, SAW_SWING, AIM, THROW, LASH } from './viewmodelParts.js';

export class ViewModel {
  constructor(stage) {
    this.stage = stage;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
    this.hemi = new THREE.HemisphereLight(0x7080a8, 0x1a1410, 1.1); this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xb4c6f4, 1.6); this.key.position.set(-1, 2, 1); this.scene.add(this.key);
    this.pivot = new THREE.Group(); this.scene.add(this.pivot);   // the hidden hand
    this.wid = null; this.t = 0;
    this.swingT = 0; this.throwT = 0; this.lashT = 0; this.hitT = 0;
    this.aimK = 0; this.carryK = 0; this.actK = 0; this.runK = 0;
  }

  // The monster's chosen weapon (any weapon, any monster).
  build(weaponId) {
    this.wid = weaponId;
    this.pivot.clear(); this.weapon = null;
    this.weaponType = HOLD[weaponId] ? weaponId : 'axe';
    this.hold = HOLD[this.weaponType];
    this.weapon = cloneWeapon(this.weaponType);
    if (!this.weapon) { this.wid = null; return; } // models not loaded yet: try again next frame
    const vl = []; this.weapon.traverse((o) => { if (o.isVLight) vl.push(o); o.castShadow = false; });
    vl.forEach((o) => o.dispose());
    const h = this.hold, aim = new THREE.Group();
    aim.quaternion.copy(holdQuat(h));
    this.weapon.scale.setScalar(h.scale);
    this.weapon.position.y = h.reach - this.weapon.userData.head * h.scale; // head sits `reach` from the pivot
    aim.add(this.weapon);
    this.pivot.add(aim);
  }

  swing() { this.swingT = 1; }
  throwIt() { this.throwT = 1; }
  lash() { this.lashT = 1; }
  impact() { this.hitT = 1; }

  // me = local monster snapshot, cam = CameraRig (footstep phase / bob), s = snapshot.
  update(dt, me, cam, s, enabled) {
    const pass = this.stage.vmPass;
    pass.enabled = !!enabled && !!me;
    if (!pass.enabled) return;
    pass.scene = this.scene; pass.camera = this.camera;
    if (this.wid !== (me.weapon || 'axe')) this.build(me.weapon || 'axe');
    if (!this.weapon) { this.pivot.visible = false; return; }
    this.camera.aspect = this.stage.camera.aspect; this.camera.updateProjectionMatrix();
    this.t += dt;
    const k = (v, rate) => Math.min(1, dt * rate) * v;
    const disguised = me.monster === 'mimic' && !!me.disguise;
    const thrown = me.monster === 'stalker' && (s.projectiles || []).length > 0; // the trident is in the air
    this.pivot.visible = !disguised && !thrown;
    const black = s.blackout ? (me.monster === 'puppeteer' ? 0.6 : 0.25) : 1;
    this.hemi.intensity = 1.5 * black; this.key.intensity = 2.4 * black;

    const [px, py, pz] = this.hold.pivot;
    const P = { px, py, pz, rx: 0, ry: 0, rz: 0 };
    const add = (o, w = 1) => { for (const n in o) P[n] += o[n] * w; };
    // Breathing + footsteps: the weapon rides the stride, a heavier rocking sway when running.
    const bob = cam.bobAmp || 0, ph = cam.stepPhase || 0;
    this.runK += k(((me.running || me.lunge) ? 1 : 0) - this.runK, 6);
    const run = this.runK;
    add({ py: Math.sin(this.t * 1.6) * 0.005, rx: Math.sin(this.t * 1.6) * 0.01 });
    add({ px: Math.sin(ph) * 0.018 * bob, py: -Math.abs(Math.cos(ph)) * 0.026 * bob, rz: Math.sin(ph) * 0.03 * bob });
    add({ py: -0.03, rx: -0.12 + Math.sin(ph) * 0.06, rz: Math.sin(ph) * 0.06, pz: 0.02 }, run);
    if (this.weaponType === 'chainsaw' && !disguised) { // idling engine buzz; revving shakes it hard
      const v = me.rev ? 0.01 : me.saw ? 0.004 : 0.0012;
      add({ px: (Math.random() - 0.5) * v, py: (Math.random() - 0.5) * v });
      if (me.rev) add({ py: 0.03, rx: 0.12 });
    }
    // Aim: the Stalker raises the trident over the shoulder; the Puppeteer levels the halberd.
    this.aimK += k((me.aiming ? 1 : 0) - this.aimK, 10);
    if (this.aimK > 0.01) {
      if (me.monster === 'stalker') add({ ...AIM, rx: AIM.rx + Math.sin(this.t * 30) * 0.008 }, this.aimK);
      else add({ px: -0.06, py: 0.05, pz: -0.04, rx: -0.25 }, this.aimK);
    }
    // Carrying a survivor: the weapon drops low and out of the way.
    this.carryK += k((me.carrying ? 1 : 0) - this.carryK, 6);
    if (this.carryK > 0.01) add({ px: 0.04, py: -0.1, rz: -0.25, rx: -0.1 }, this.carryK);
    // Hold-E actions: lowered while working, violent chops for kill / smash / desecrate.
    this.actK += k((me.act ? 1 : 0) - this.actK, 8);
    if (this.actK > 0.01) {
      const hard = me.act === 'kill' || me.act === 'break' || me.act === 'smash';
      const beat = Math.sin(this.t * (hard ? 8 : 3));
      add({ py: -0.08 + (hard ? beat * 0.06 : 0), pz: -0.05, rx: -0.3 + (hard ? beat * 0.45 : 0), rz: hard ? 0.2 : 0 }, this.actK);
    }
    if (me.stunned) { const sh = Math.sin(this.t * 25) * 0.03; add({ py: -0.12 + sh, rx: 0.5, rz: -0.4 + sh }); }
    if (this.swingT > 0) { this.swingT = Math.max(0, this.swingT - dt / 0.5); add(sample(this.weaponType === 'chainsaw' ? SAW_SWING : SWING, 1 - this.swingT)); }
    if (this.throwT > 0) { this.throwT = Math.max(0, this.throwT - dt / 0.55); add(sample(THROW, 1 - this.throwT)); }
    if (this.lashT > 0) { this.lashT = Math.max(0, this.lashT - dt / 0.4); add(sample(LASH, 1 - this.lashT)); }
    if (this.hitT > 0) { this.hitT = Math.max(0, this.hitT - dt / 0.25); add({ pz: 0.05 * this.hitT, rx: 0.12 * this.hitT }); }
    if (me.lunge) add({ pz: -0.06, rx: -0.08 });
    this.pivot.position.set(P.px, P.py, P.pz);
    this.pivot.rotation.set(P.rx, P.ry, P.rz);
  }

  dispose() { this.stage.vmPass.enabled = false; this.pivot.clear(); }
}
