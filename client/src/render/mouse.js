// The dead return as a real (scanned, CC0) rat/mouse. The model is static, so it's animated here:
// scurry gait (body pitch/bob + squash-stretch), tail swish, sniffing idle, and leap arcs.
import * as THREE from 'three';
import { cloneModel } from './assets.js';

export class Mice {
  constructor(root) { this.root = root; this.items = new Map(); }

  make() {
    const g = new THREE.Group();
    const body = new THREE.Group(); g.add(body);
    const rat = cloneModel('street_rat');
    rat.scale.setScalar(1.6);      // ~25cm — a large field mouse, readable in third person
    rat.position.z = 0.05;         // centre the body over the pivot
    body.add(rat);
    // Faint spectral rim so dead players can still be found by each other in the dark
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: 0x8fa8ff, transparent: true, opacity: 0.08, depthWrite: false }));
    glow.scale.set(1, 0.6, 2); glow.position.y = 0.04; body.add(glow);
    g.userData = { body, rat, phase: Math.random() * 10 };
    this.root.add(g);
    return g;
  }

  update(p, pos, dt, visibleToMe) {
    let m = this.items.get(p.id);
    if (p.state !== 'mouse') { if (m) { m.removeFromParent(); this.items.delete(p.id); } return; }
    if (!m) { m = this.make(); this.items.set(p.id, m); }
    // Mice are only seen by the dead player themself and by other spectators; the living can't interact.
    m.visible = visibleToMe !== false;
    const u = m.userData; u.t = (u.t || 0) + dt;
    m.position.set(pos.x, p.y || 0, pos.z);
    // The rat model's nose points to -Z; the game's rot points +Z.
    m.rotation.y = pos.rot + Math.PI;
    const run = Math.min(1, p.speed / 4), air = (p.y || 0) > 0.03;
    const f = u.t * (10 + p.speed * 4);
    if (air) { // stretched leap, nose up then down
      const k = p.jumpK || 0.5;
      u.body.rotation.x = (0.5 - k) * 0.9; u.body.scale.set(0.9, 0.9, 1.25); u.body.position.y = 0;
    } else if (run > 0.05) { // scurry gallop
      u.body.rotation.x = Math.sin(f) * 0.18 * run;
      u.body.position.y = Math.abs(Math.sin(f)) * 0.03 * run;
      const st = 1 + Math.sin(f) * 0.12 * run; u.body.scale.set(1 / Math.sqrt(st), 1 / Math.sqrt(st), st);
      u.body.rotation.z = Math.sin(f * 0.5) * 0.05;
    } else { // idle: sniff & look around
      u.body.position.y = 0; u.body.scale.set(1, 1, 1);
      u.body.rotation.x = Math.sin(u.t * 12) * 0.03 + (Math.sin(u.t * 0.7 + u.phase) > 0.8 ? -0.25 : 0); // rear up to sniff
      u.body.rotation.y = Math.sin(u.t * 0.9 + u.phase) * 0.35;
    }
  }

  dispose() { for (const m of this.items.values()) m.removeFromParent(); this.items.clear(); }
}
