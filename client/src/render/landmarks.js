// Lamp posts (permanent lit areas — the Mimic's bane) and the iron exit gate with 3 key sockets.
import * as THREE from 'three';
import { vlight } from './lights.js';
import { cloneModel } from './assets.js';

const sh = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

// Real street-lamp model (Poly Haven) with a warm glowing lantern head.
export function buildLamps(scene, map) {
  return map.lamps.map((l) => {
    const g = new THREE.Group(); g.position.set(l.x, 0, l.z);
    const lamp = cloneModel('street_lamp_01'); g.add(lamp);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffa040, emissiveIntensity: 1.2 }));
    glass.position.set(0, 3.55, 0.12); g.add(glass);
    const light = vlight(0xffb070, 1.3, l.r * 1.3, 2); light.position.set(0, 3.4, 0.2); light.flicker = 0.2; g.add(light);
    scene.add(g);
    return { g, light, glass, base: 1.3 };
  });
}

// soft round glow used for the lantern halos
function haloTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}

// Exit: a stone gatehouse in the perimeter wall with two real wrought-iron gate leaves.
export function buildDoor(scene, ex, sMat) {
  const g = new THREE.Group(); g.position.set(ex.x, 0, ex.z);
  for (const s of [-1, 1]) {
    const p = sh(new THREE.Mesh(new THREE.BoxGeometry(1.4, 7, 2.6), sMat)); p.position.set(s * 3.7, 3.5, 0); g.add(p);
    const cap = sh(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.4, 2.9), sMat)); cap.position.set(s * 3.7, 7.2, 0); g.add(cap);
  }
  const arch = sh(new THREE.Mesh(new THREE.BoxGeometry(8.8, 1.2, 2.6), sMat)); arch.position.y = 6.4; g.add(arch);
  const doors = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 3.0, 0, 0.4); g.add(pivot);
    const leaf = cloneModel('large_iron_gate'); leaf.scale.set(1.0, 1.9, 1); leaf.position.x = -s * 1.5; pivot.add(leaf);
    doors.push({ pivot, s });
  }
  const sockets = [];
  for (let i = 0; i < 3; i++) {
    const sock = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x000000 }));
    sock.position.set(-0.8 + i * 0.8, 6.4, 1.35); g.add(sock); sockets.push(sock);
  }
  // Hanging lanterns on both gateposts (front face) and over the arch: the gate is the goal, so it must be easy to spot in the dark.
  const halo = haloTexture();
  for (const [x, y] of [[-3.7, 3.4], [3.7, 3.4], [-3.7, 5.6], [3.7, 5.6], [0, 5.55]]) {
    const L = new THREE.Group(); L.position.set(x, y, 1.62); g.add(L);
    const iron = new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 0.6, metalness: 0.7 });
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.34), iron); bracket.position.set(0, 0.42, -0.1); L.add(bracket);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.18, 6), iron); cap.position.y = 0.3; L.add(cap);
    L.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffc77a })));
    L.add(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.42, 6, 1, true), new THREE.MeshStandardMaterial({ color: 0x1c1a14, wireframe: true })));
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.1, 0.07, 6), iron); base.position.y = -0.24; L.add(base);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0xffb060, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    spr.scale.set(3.2, 3.2, 1); L.add(spr);
  }
  for (const x of [-3.7, 3.7]) { const l = vlight(0xffb070, 1.6, 15, 2); l.position.set(x, 3.6, 2.2); l.flicker = 0.25; g.add(l); }
  // A beam of light from beyond the gate once it opens
  const light = vlight(0xffe0a0, 0, 18, 1.5); light.position.set(0, 3, -2); g.add(light);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(6, 5.6), glowMat); glow.position.set(0, 2.8, -1.2); g.add(glow);
  scene.add(g);
  return { g, doors, sockets, light, glowMat };
}

// Golden key with glow + beacon so survivors can find it.
export function makeKey() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4a840, metalness: 1, roughness: 0.3, emissive: 0x6a4a10, emissiveIntensity: 0.6 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 8, 16), gold); ring.position.y = 0.2; g.add(ring);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3), gold); shaft.rotation.z = Math.PI / 2; shaft.position.set(0.24, 0.2, 0); g.add(shaft);
  for (const x of [0.32, 0.38]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.02), gold); t.position.set(x, 0.16, 0); g.add(t); }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.4, 12, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd070, transparent: true, opacity: 0.035, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  beam.position.y = 6; g.add(beam);
  const l = vlight(0xffc050, 0.8, 3, 2); l.position.y = 0.6; g.add(l);
  return g;
}
