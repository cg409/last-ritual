// Third-person over-the-shoulder camera for survivors, first-person for the monster (like DbD).
import * as THREE from 'three';
import { lineOfSight } from '@shared/nav.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 3, 0);
    this.look = new THREE.Vector3();
    this.shake = 0;
    this.dist = 3.6;
  }

  update(dt, target, p, ctl, map, firstPerson) {
    // Poison: the view sways and drifts on its own.
    const pk = Math.min(1, (p.poison || 0) / 2), tw = performance.now() / 1000;
    const yaw = ctl.yaw + Math.sin(tw * 0.9) * 0.4 * pk + Math.sin(tw * 2.3) * 0.08 * pk, pitch = ctl.pitch + Math.sin(tw * 1.4) * 0.12 * pk;
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const hide = p.hideIn != null && map.hides?.[p.hideIn];
    if (hide) { // peeking out through the slats of the door
      const f = new THREE.Vector3(Math.sin(hide.rot), 0, Math.cos(hide.rot));
      const out = hide.kind === 'potty' ? 0.7 : 0.38; // just at the door: the slats are drawn by the HUD
      this.camera.position.set(hide.x + f.x * out, target.y + 1.55, hide.z + f.z * out);
      const look = hide.rot + Math.max(-0.7, Math.min(0.7, Math.atan2(Math.sin(yaw - hide.rot), Math.cos(yaw - hide.rot))));
      this.look.set(this.camera.position.x + Math.sin(look), this.camera.position.y + Math.sin(pitch) * 0.6, this.camera.position.z + Math.cos(look));
      this.camera.lookAt(this.look);
      return;
    }
    if (firstPerson) {
      // Walking feel: a head bob whose rate follows the footfalls, a side-to-side sway, a heavier
      // bounce when running, a forward dip on lunges and a smoothed eye height on stairs/terrain.
      const sp = p.speed || 0, moving = sp > 0.2;
      const run = p.running || p.lunge ? 1 : 0;
      this.bobAmp = (this.bobAmp || 0) + ((moving ? (run ? 1 : 0.55) : 0) - (this.bobAmp || 0)) * Math.min(1, dt * 6);
      this.stepPhase = (this.stepPhase || 0) + dt * (moving ? sp * (run ? 2.0 : 2.3) : 0);
      const ph = this.stepPhase;
      const bobY = -Math.abs(Math.sin(ph)) * 0.075 * this.bobAmp + 0.035 * this.bobAmp;
      const bobX = Math.sin(ph) * 0.045 * this.bobAmp;
      this.lungeK = (this.lungeK || 0) + ((p.lunge ? 1 : 0) - (this.lungeK || 0)) * Math.min(1, dt * 12);
      this.eyeY = this.eyeY == null || Math.abs(target.y - this.eyeY) > 1.5 ? target.y : this.eyeY + (target.y - this.eyeY) * Math.min(1, dt * 12);
      const right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
      const eye = new THREE.Vector3(target.x, this.eyeY + 1.88 + bobY - this.lungeK * 0.18 - (p.climb ? 0.15 : 0), target.z)
        .addScaledVector(fwd, 0.25 + this.lungeK * 0.25).addScaledVector(right, bobX);
      this.camera.position.copy(eye);
      const roll = Math.sin(ph) * 0.012 * this.bobAmp;
      const pt = pitch - this.lungeK * 0.12;
      this.look.set(eye.x + Math.sin(yaw) * Math.cos(pt), eye.y + Math.sin(pt), eye.z + Math.cos(yaw) * Math.cos(pt));
      this.fpRoll = roll; this.stepOut = ph;
    } else {
      const low = p.crouch || p.crawl || p.state === 'downed';
      const mouse = p.state === 'mouse';
      const gy = target.y - (p.y || 0) * (mouse ? 1 : 1); // ground / floor height under the player
      const head = new THREE.Vector3(target.x, gy + (low ? 0.8 : 1.55) + (p.y || 0) * 0.6, target.z);
      if (p.crawl || p.state === 'downed') head.y = gy + 0.6;
      if (p.state === 'hooked') head.y = gy + 2.3;
      if (mouse) head.y = gy + 0.42 + (p.y || 0) * 0.5;   // low, mouse's-eye view
      const right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
      // Pull the camera in when a wall is behind the player.
      // Indoors (any building, or upstairs) the camera comes in close over the shoulder.
      const inside = (p.level | 0) > 0 || map.buildings.some((b) => Math.abs(target.x - b.x) < b.w / 2 && Math.abs(target.z - b.z) < b.d / 2);
      this.inK = (this.inK || 0) + ((inside ? 1 : 0) - (this.inK || 0)) * Math.min(1, dt * 3);
      let want = mouse ? 1.9 : 3.6 - this.inK * 1.5;
      const side = mouse ? 0 : -0.55 + this.inK * 0.1;
      const back = (d) => head.clone().addScaledVector(fwd, -d * Math.cos(pitch)).addScaledVector(right, side);
      for (let d = want; d > 0.8; d -= 0.4) { const b = back(d); if (lineOfSight(map, head.x, head.z, b.x, b.z)) { want = d; break; } want = d - 0.4; }
      // Pull in fast when blocked, ease back out slowly (no in/out jitter when running past trees).
      const wantD = Math.max(0.8, want);
      this.dist += (wantD - this.dist) * Math.min(1, dt * (wantD < this.dist ? 10 : 2.5));
      const camPos = back(this.dist); camPos.y = head.y - Math.sin(pitch) * this.dist + (mouse ? 0.2 : 0.25);
      camPos.y = Math.max(gy + (mouse ? 0.25 : 0.3), camPos.y);
      // The target is already smoothly interpolated, so follow it rigidly (a lagging lerp on a
      // moving target made the whole view wobble back and forth while running).
      this.pos.copy(camPos);
      this.camera.position.copy(this.pos);
      this.look.copy(head).addScaledVector(right, side).addScaledVector(fwd, 2);
      this.look.y = head.y + Math.sin(pitch) * 2;
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2);
      const s = this.shake * 0.08;
      this.camera.position.x += (Math.random() - 0.5) * s; this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.look);
    if (firstPerson && this.fpRoll) this.camera.rotateZ(this.fpRoll);
    if (pk > 0) this.camera.rotateZ(Math.sin(tw * 1.1) * 0.1 * pk);
  }
}
