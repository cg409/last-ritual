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
    const yaw = ctl.yaw, pitch = ctl.pitch;
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    if (firstPerson) {
      const eye = new THREE.Vector3(target.x, 2.05, target.z).addScaledVector(fwd, 0.25);
      this.camera.position.copy(eye);
      this.look.set(eye.x + Math.sin(yaw) * Math.cos(pitch), eye.y + Math.sin(pitch), eye.z + Math.cos(yaw) * Math.cos(pitch));
    } else {
      const low = p.crouch || p.crawl || p.state === 'downed';
      const mouse = p.state === 'mouse';
      const head = new THREE.Vector3(target.x, (low ? 0.8 : 1.55) + (p.y || 0) * 0.6, target.z);
      if (p.crawl || p.state === 'downed') head.y = 0.6;
      if (p.state === 'hooked') head.y = 2.3;
      if (mouse) head.y = 0.22 + (p.y || 0) * 0.5;   // low, mouse's-eye view
      const right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
      // Pull the camera in when a wall is behind the player.
      let want = mouse ? 1.1 : 3.6;
      const side = mouse ? 0 : -0.55;
      const back = (d) => head.clone().addScaledVector(fwd, -d * Math.cos(pitch)).addScaledVector(right, side);
      for (let d = want; d > 0.8; d -= 0.4) { const b = back(d); if (lineOfSight(map, head.x, head.z, b.x, b.z)) { want = d; break; } want = d - 0.4; }
      this.dist += (Math.max(0.8, want) - this.dist) * Math.min(1, dt * 8);
      const camPos = back(this.dist); camPos.y = head.y - Math.sin(pitch) * this.dist + (mouse ? 0.12 : 0.25);
      camPos.y = Math.max(mouse ? 0.12 : 0.3, camPos.y);
      this.pos.lerp(camPos, Math.min(1, dt * 14));
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
  }
}
