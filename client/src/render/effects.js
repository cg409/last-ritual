// Particle & mesh effects: traps, trident, lightning bolts, smoke puffs, glowing footprints.
import * as THREE from 'three';
import { makeWeapon } from './items.js';
import { makeFootprint } from './textures.js';
import { vlight } from './lights.js';

const metal = new THREE.MeshStandardMaterial({ color: 0x6a5a4a, metalness: 0.9, roughness: 0.6 });

const rust = new THREE.MeshStandardMaterial({ color: 0x4a3426, metalness: 0.5, roughness: 0.8 });
// Trap models: dull, dirty, low to the ground — easy to miss.
export function makeTrap(type) {
  const g = new THREE.Group();
  if (type === 'bear') { // foothold trap: a jawed iron ring on a chain stake
    for (const s of [-1, 1]) {
      const jaw = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 18, Math.PI), metal);
      jaw.rotation.set(-Math.PI / 2 + s * 0.35, 0, s > 0 ? 0 : Math.PI); jaw.position.y = 0.05; g.add(jaw);
      for (let i = 0; i < 8; i++) {
        const a = (i / 7) * Math.PI, tooth = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.09, 4), metal);
        tooth.position.set(Math.cos(a) * 0.29, 0.08, Math.sin(a) * 0.29 * s); tooth.rotation.x = s * 0.5; g.add(tooth);
      }
    }
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 12), rust); plate.position.y = 0.02; g.add(plate);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6), metal); chain.rotation.z = Math.PI / 2; chain.position.set(0.55, 0.02, 0); g.add(chain);
  } else if (type === 'poison') { // a bloated fungal bloom
    const cap = new THREE.MeshStandardMaterial({ color: 0x3a4a22, roughness: 0.9, emissive: 0x101800, emissiveIntensity: 0.4 });
    for (let i = 0; i < 7; i++) {
      const r = 0.06 + Math.random() * 0.07, b = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), cap);
      b.position.set((Math.random() - 0.5) * 0.45, r * 0.7, (Math.random() - 0.5) * 0.45); b.scale.y = 0.7; g.add(b);
    }
  } else if (type === 'cursed') { // a sigil scratched into the earth, bones at its points
    const mark = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.38, 5), new THREE.MeshBasicMaterial({ color: 0x2a0606, transparent: true, opacity: 0.85, depthWrite: false }));
    mark.rotation.x = -Math.PI / 2; mark.position.y = 0.015; g.add(mark);
    const bone = new THREE.MeshStandardMaterial({ color: 0x9a907a, roughness: 0.9 });
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2, b = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.12, 2, 6), bone); b.position.set(Math.cos(a) * 0.36, 0.02, Math.sin(a) * 0.36); b.rotation.set(Math.PI / 2, 0, a); g.add(b); }
  } else { // floor spikes: a rusted grate with points barely showing
    const grate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.03, 0.8), rust); grate.position.y = 0.015; g.add(grate);
    for (let i = 0; i < 16; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 4), metal); s.position.set(((i % 4) - 1.5) * 0.18, 0.07, (Math.floor(i / 4) - 1.5) * 0.18); g.add(s); }
  }
  g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  return g;
}

// Soft round sprite for smoke / embers (no hard square points).
let _soft = null;
function softDot() {
  if (_soft) return _soft;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  _soft = new THREE.CanvasTexture(c);
  return _soft;
}

export function makeTrident() {
  const g = new THREE.Group();
  const w = makeWeapon('trident'); w.rotation.x = Math.PI / 2; w.position.z = -0.9; g.add(w);
  g.add(vlight(0x6fe0ff, 1.2, 4, 2));
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

// Horror "omen" effect: black smoke wisps curl slowly up from the spot while a few dying red embers
// drift out of them. kind: 'ash' (a botched rite / desecration), 'blood' (the Mimic exposed),
// 'shadow' (a teleport). Soft round sprites — nothing square, nothing bright.
class Layer {
  constructor(root, n, opts) {
    this.n = n; this.items = Array.from({ length: n }, () => ({ life: 0 }));
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4); // rgba: per-particle fade
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    this.mat = new THREE.PointsMaterial({ size: opts.size, map: softDot(), vertexColors: true, transparent: true, opacity: opts.opacity, depthWrite: false, blending: opts.blending, sizeAttenuation: true });
    this.points = new THREE.Points(geo, this.mat); this.points.frustumCulled = false; root.add(this.points);
    this.idx = 0;
  }
  spawn(o) { Object.assign(this.items[this.idx++ % this.n], o); }
  update(dt, fade) {
    this.items.forEach((it, i) => {
      if (it.life > 0) { it.life -= dt; it.x += it.vx * dt; it.y += it.vy * dt; it.z += it.vz * dt; it.vx *= 0.985; it.vz *= 0.985; it.vy += (it.lift || 0) * dt; }
      const k = it.life > 0 ? fade(it) : 0;
      this.pos[i * 3] = it.x || 0; this.pos[i * 3 + 1] = it.life > 0 ? it.y : -100; this.pos[i * 3 + 2] = it.z || 0;
      this.col[i * 4] = it.r || 0; this.col[i * 4 + 1] = it.g || 0; this.col[i * 4 + 2] = it.b || 0; this.col[i * 4 + 3] = k;
    });
    this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.color.needsUpdate = true;
  }
}

export class Puffs {
  constructor(root) {
    // smoke darkens (normal blending, dark colours), embers glow faintly (additive)
    this.smoke = new Layer(root, 160, { size: 1.6, opacity: 0.55, blending: THREE.NormalBlending });
    this.embers = new Layer(root, 80, { size: 0.09, opacity: 1, blending: THREE.AdditiveBlending });
  }
  burst(x, z, kind = 'ash', count = 18) {
    const tint = kind === 'blood' ? [0.25, 0.02, 0.02] : [0.03, 0.03, 0.035];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.6, life = 2.2 + Math.random() * 1.6;
      this.smoke.spawn({ life, max: life, x: x + Math.cos(a) * r, y: 0.2 + Math.random() * 0.5, z: z + Math.sin(a) * r,
        vx: Math.cos(a) * 0.25, vy: 0.25 + Math.random() * 0.35, vz: Math.sin(a) * 0.25, lift: 0.05, r: tint[0], g: tint[1], b: tint[2] });
    }
    if (kind === 'shadow') return;
    for (let i = 0; i < Math.ceil(count / 2); i++) {
      const life = 1 + Math.random() * 1.4;
      this.embers.spawn({ life, max: life, x: x + (Math.random() - 0.5) * 0.8, y: 0.3 + Math.random() * 0.6, z: z + (Math.random() - 0.5) * 0.8,
        vx: (Math.random() - 0.5) * 0.5, vy: 0.4 + Math.random() * 0.6, vz: (Math.random() - 0.5) * 0.5, lift: -0.1, r: 0.9, g: 0.15, b: 0.05 });
    }
  }
  update(dt) {
    this.smoke.update(dt, (it) => { const u = 1 - it.life / it.max; return Math.min(1, u * 4) * (1 - u); });
    this.embers.update(dt, (it) => (it.life / it.max) * (0.6 + Math.random() * 0.4)); // flicker as they die
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
