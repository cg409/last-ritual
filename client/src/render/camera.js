// Third-person over-the-shoulder camera for survivors, first-person for the monster (like DbD).
import * as THREE from 'three';
import { onLevel } from '@shared/nav.js';
import { buildingAt } from '@shared/levels.js';
import { STORY_HEIGHT } from '@shared/buildings.js';

// Exact "is the camera path blocked" test. (The shared lineOfSight samples every 0.6 m, which can step right
// over a 0.4 m wall; this is a true segment-vs-box test, with a margin so the near plane never pokes through.)
function camBlocked(map, ax, az, bx, bz, level, pad) {
  const dx = bx - ax, dz = bz - az, minX = Math.min(ax, bx), maxX = Math.max(ax, bx), minZ = Math.min(az, bz), maxZ = Math.max(az, bz);
  for (const r of map.rects) {
    if (r.low || (r.h != null && r.h < 1.3) || !onLevel(r, level)) continue;       // low things (fences, furniture) don't block the view
    const inside = Math.abs(ax - r.x) < r.hw + pad && Math.abs(az - r.z) < r.hd + pad; // already hugging it: only the real box counts
    const p = inside ? 0.02 : pad, hw = r.hw + p, hd = r.hd + p;
    if (maxX < r.x - hw || minX > r.x + hw || maxZ < r.z - hd || minZ > r.z + hd) continue;
    let t0 = 0, t1 = 1, ok = true;
    for (const [o, d, lo, hi] of [[ax, dx, r.x - hw, r.x + hw], [az, dz, r.z - hd, r.z + hd]]) {
      if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { ok = false; break; } continue; }
      let a = (lo - o) / d, b = (hi - o) / d; if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) { ok = false; break; }
    }
    if (ok) return true;
  }
  if (level) return false;
  for (const c of map.circles) { // trees / rocks / pillars: distance from the circle centre to the segment
    if (c.type !== 'tree' && c.type !== 'rock' && c.type !== 'pillar') continue;
    const L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((c.x - ax) * dx + (c.z - az) * dz) / L)) : 0;
    if (Math.hypot(ax + dx * t - c.x, az + dz * t - c.z) < c.r * 0.9 + 0.1) return true;
  }
  return false;
}

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
      const backS = (d, sk) => head.clone().addScaledVector(fwd, -d * Math.cos(pitch)).addScaledVector(right, side * sk);
      const lv = p.level | 0, room = mouse ? 0.1 : 0.28;
      // Walk the camera in until its path is clear; if a wall is beside the player, slide it back behind
      // the shoulder instead (sk shrinks the sideways offset). The check reaches a little further than the
      // camera, so there is always a gap between the lens and the wall.
      let sk = 1, found = false;
      for (let d = want; d > 0.12 && !found; d -= 0.3) {
        for (const k of [1, 0.45, 0]) {
          const bb = backS(d + Math.min(room, d * 0.6), k);
          if (!camBlocked(map, head.x, head.z, bb.x, bb.z, lv, 0.2)) { want = d; sk = k; found = true; break; }
        }
        if (!found) want = d - 0.3;
      }
      if (!found) sk = 0;
      this.sideK = this.sideK == null ? sk : this.sideK + (sk - this.sideK) * Math.min(1, dt * (sk < this.sideK ? 14 : 3));
      const back = (d) => backS(d, this.sideK);
      // Pull in fast when blocked, ease back out slowly (no in/out jitter when running past trees).
      const wantD = Math.max(0.12, want);
      this.dist += (wantD - this.dist) * Math.min(1, dt * (wantD < this.dist ? 10 : 2.5));
      const camPos = back(this.dist); camPos.y = head.y - Math.sin(pitch) * this.dist + (mouse ? 0.2 : 0.25);
      camPos.y = Math.max(gy + (mouse ? 0.25 : 0.3), camPos.y);
      // Never above the ceiling / floor slab of the room you are in (looking down pushes the camera up).
      const roof = buildingAt(map, camPos.x, camPos.z, 0.35) || buildingAt(map, head.x, head.z, 0.1);
      if (roof && lv < roof.floors) camPos.y = Math.min(camPos.y, (lv + 1) * STORY_HEIGHT - 0.28 - (lv ? 0.0 : 0.0));
      // The target is already smoothly interpolated, so follow it rigidly (a lagging lerp on a
      // moving target made the whole view wobble back and forth while running).
      this.pos.copy(camPos);
      this.camera.position.copy(this.pos);
      this.look.copy(head).addScaledVector(right, side * this.sideK).addScaledVector(fwd, 2);
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
