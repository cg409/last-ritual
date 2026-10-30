// The dead return as a real (scanned, CC0) rat. The model is static, so it's animated here: scurry
// gait (body pitch/bob + squash-stretch), tail-end swish, sniffing idle and leap arcs.
// The scan's long thin tail runs out to -Z (~11cm) and the head/nose is at +Z (~4cm), so the model
// already faces the game's +Z forward (it was previously flipped, which made it run backwards).
// It stands on the real terrain / floor height so it never sinks into the ground.
import * as THREE from 'three';
import { cloneModel } from './assets.js';
import { vlight } from './lights.js';
import { surfaceY } from '@shared/levels.js';

const SCALE = 3.2;  // ~48cm incl. tail: big enough to read clearly in third person
const NOSE_FWD = 0; // model nose +Z == game forward +Z

let glowTex = null;
function glowTexture() { // soft pale ring under the mouse so other spectators can spot it in the dark
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,240,220,0.16)'); gr.addColorStop(0.55, 'rgba(255,230,200,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c); return glowTex;
}

export class Mice {
  constructor(root) { this.root = root; this.items = new Map(); }

  make() {
    const g = new THREE.Group();
    const body = new THREE.Group(); g.add(body);
    const rat = cloneModel('street_rat');
    rat.scale.setScalar(SCALE);
    rat.rotation.y = NOSE_FWD;
    rat.position.z = -0.005 * SCALE; // pivot under the body (head at +0.041, tail tip at -0.107)
    rat.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiplyScalar(1.35); o.castShadow = true; } });
    body.add(rat);
    // Ground glow (flat decal, never intersects the body) + a faint eye-shine so it reads at night.
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.02; g.add(glow);
    const shine = vlight(0xffe6c8, 0.5, 2.2, 2); shine.position.set(0, 0.35, 0); g.add(shine);
    g.userData.shine = shine;
    Object.assign(g.userData, { body, rat, phase: Math.random() * 10, gy: null });
    this.root.add(g);
    return g;
  }

  update(p, pos, dt, visibleToMe, map) {
    let m = this.items.get(p.id);
    if (p.state !== 'mouse') { if (m) { m.userData.shine.dispose(); m.removeFromParent(); this.items.delete(p.id); } return; }
    if (!m) { m = this.make(); this.items.set(p.id, m); }
    m.visible = visibleToMe !== false; // only the dead see mice
    const u = m.userData; u.t = (u.t || 0) + dt;
    const gy = map ? surfaceY(map, pos.x, pos.z, p.level | 0) : 0;
    u.gy = u.gy == null || Math.abs(gy - u.gy) > 1.5 ? gy : u.gy + (gy - u.gy) * Math.min(1, dt * 16);
    m.position.set(pos.x, u.gy + (p.y || 0), pos.z);
    m.rotation.y = pos.rot; // body faces the game's movement direction
    const run = Math.min(1, p.speed / 4), air = (p.y || 0) > 0.03;
    const f = u.t * (10 + p.speed * 4);
    if (air) { // stretched leap: nose up on the way up, down on the way down
      const k = p.jumpK || 0.5;
      u.body.rotation.set(-(0.5 - k) * 0.9, 0, 0); u.body.scale.set(0.92, 0.92, 1.2); u.body.position.y = 0;
    } else if (run > 0.05) { // scurry gallop
      u.body.rotation.set(Math.sin(f) * 0.16 * run, 0, Math.sin(f * 0.5) * 0.05);
      u.body.position.y = Math.abs(Math.sin(f)) * 0.04 * run;
      const st = 1 + Math.sin(f) * 0.1 * run; u.body.scale.set(1 / Math.sqrt(st), 1 / Math.sqrt(st), st);
    } else { // idle: sniff, look around, now and then rear up
      u.body.position.y = 0; u.body.scale.set(1, 1, 1);
      const rear = Math.sin(u.t * 0.7 + u.phase) > 0.85 ? -0.3 : 0;
      u.body.rotation.set(Math.sin(u.t * 12) * 0.03 + rear, Math.sin(u.t * 0.9 + u.phase) * 0.35, 0);
    }
  }

  dispose() { for (const m of this.items.values()) { m.userData.shine.dispose(); m.removeFromParent(); } this.items.clear(); }
}
