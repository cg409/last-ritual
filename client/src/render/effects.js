// Particle & mesh effects: traps, trident, lightning bolts, smoke puffs, glowing footprints.
import * as THREE from 'three';
import { makeWeapon } from './items.js';
import { makeFootprint } from './textures.js';
import { vlight } from './lights.js';

const metal = new THREE.MeshStandardMaterial({ color: 0x6a5a4a, metalness: 0.9, roughness: 0.6 });

export function makeTrap(type) {
  const g = new THREE.Group();
  if (type === 'bear') {
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 6, 20), metal)).rotation.x = Math.PI / 2;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2, tooth = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), metal);
      tooth.position.set(Math.cos(a) * 0.33, 0.06, Math.sin(a) * 0.33); g.add(tooth);
    }
  } else if (type === 'bell') {
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.6), new THREE.MeshBasicMaterial({ color: 0x999999 }));
    wire.rotation.z = Math.PI / 2; wire.position.y = 0.2; g.add(wire);
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xa08040, metalness: 1, roughness: 0.3, side: THREE.DoubleSide }));
    bell.position.y = 0.15; g.add(bell);
  } else {
    const thorn = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 1 });
    for (let i = 0; i < 26; i++) {
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.25, 4), thorn);
      s.position.set((Math.random() - 0.5) * 0.9, 0.08, (Math.random() - 0.5) * 0.9); s.rotation.set(Math.random() - 0.5, 0, Math.random() - 0.5); g.add(s);
    }
  }
  return g;
}

export function makeTrident() {
  const g = new THREE.Group();
  const w = makeWeapon('trident'); w.rotation.x = Math.PI / 2; w.position.z = -0.6; g.add(w);
  g.add(vlight(0x6fe0ff, 3, 6, 2));
  return g;
}

// Jagged lightning bolt striking from the sky where the Stalker aims (visible map-wide).
export class Bolt {
  constructor(root, x, z) {
    const pts = []; let px = x, pz = z;
    for (let y = 60; y >= 0; y -= 4) { pts.push(new THREE.Vector3(px, y, pz)); px += (Math.random() - 0.5) * 3; pz += (Math.random() - 0.5) * 3; }
    pts.push(new THREE.Vector3(x, 0, z));
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 60, 0.12, 5);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 1, fog: false, blending: THREE.AdditiveBlending });
    this.mesh = new THREE.Mesh(geo, this.mat); root.add(this.mesh);
    this.light = vlight(0xbfd8ff, 60, 60, 1.2); this.light.position.set(x, 8, z); root.add(this.light);
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    const k = Math.max(0, 1 - this.t / 0.6) * (Math.random() < 0.7 ? 1 : 0.2);
    this.mat.opacity = k; this.light.intensity = 60 * k;
    if (this.t > 0.6) { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.light.dispose(); return false; }
    return true;
  }
}

export class Puffs {
  constructor(root) {
    this.n = 300; this.items = [];
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.n * 3); geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.PointsMaterial({ color: 0x777777, size: 0.5, transparent: true, opacity: 0.6, depthWrite: false });
    this.points = new THREE.Points(geo, this.mat); this.points.frustumCulled = false; root.add(this.points);
    for (let i = 0; i < this.n; i++) this.items.push({ life: 0 });
    this.idx = 0;
  }
  burst(x, z, color, count) {
    this.mat.color.setHex(color === 0x050505 ? 0x222222 : color === 0x220000 ? 0x8a1010 : 0x8070c0);
    for (let i = 0; i < count; i++) {
      const it = this.items[this.idx++ % this.n];
      Object.assign(it, { life: 1.2, x, y: 0.5 + Math.random(), z, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 2, vz: (Math.random() - 0.5) * 3 });
    }
  }
  update(dt) {
    this.items.forEach((it, i) => {
      if (it.life > 0) { it.life -= dt; it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt; it.vy -= dt * 0.5; }
      this.pos[i * 3] = it.x || 0; this.pos[i * 3 + 1] = it.life > 0 ? it.y : -100; this.pos[i * 3 + 2] = it.z || 0;
    });
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

// Glowing blood footprints that fade over a few seconds (Ravager's Blood Trail).
export class Footprints {
  constructor(root) {
    this.max = 200; this.list = []; this.last = new Map();
    this.mat = new THREE.MeshBasicMaterial({ map: makeFootprint(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.geo = new THREE.PlaneGeometry(0.3, 0.45);
    this.root = root;
  }
  step(id, x, z, rot, t) {
    const l = this.last.get(id);
    if (l && Math.hypot(l.x - x, l.z - z) < 0.7) return;
    const side = (l?.side ?? 1) * -1;
    this.last.set(id, { x, z, side });
    const m = new THREE.Mesh(this.geo, this.mat.clone());
    m.rotation.set(-Math.PI / 2, 0, -rot); m.position.set(x + Math.cos(rot) * 0.12 * side, 0.03, z - Math.sin(rot) * 0.12 * side);
    this.root.add(m); this.list.push({ m, t });
    if (this.list.length > this.max) { const o = this.list.shift(); o.m.removeFromParent(); }
  }
  update(t) {
    this.list = this.list.filter((f) => {
      const age = t - f.t; f.m.material.opacity = Math.max(0, 1 - age / 6);
      if (age > 6) { f.m.removeFromParent(); f.m.material.dispose(); return false; }
      return true;
    });
  }
  dispose() { this.list.forEach((f) => f.m.removeFromParent()); this.list = []; }
}
