// Monster weapons and the survivor candle.
import * as THREE from 'three';
import { vlight } from './lights.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
const metal = (color = 0x777777, rough = 0.45) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.85 });
const wood = () => std(0x4a2f1c, { roughness: 0.95 });
function mesh(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; return m;
}

export function makeWeapon(type) {
  const g = new THREE.Group();
  if (type === 'lantern') {
    g.add(mesh(new THREE.TorusGeometry(0.05, 0.006, 6, 16, Math.PI), metal(0x333333), 0, 0.02, 0));
    const cage = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.16, 6, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, wireframe: true, metalness: 0.8 }), 0, -0.1, 0);
    g.add(cage);
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.13, 12), std(0x221100, { emissive: 0x7a1a00, emissiveIntensity: 2, transparent: true, opacity: 0.85 }), 0, -0.1, 0));
    const l = vlight(0xff3a10, 1.5, 5, 2); l.position.y = -0.1; g.add(l);
  } else if (type === 'axe') {
    g.add(mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.9), wood(), 0, 0.3, 0));
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.2, -0.06); s.quadraticCurveTo(0.25, 0.07, 0.2, 0.2); s.lineTo(0, 0.12); s.lineTo(0, 0);
    g.add(mesh(new THREE.ExtrudeGeometry(s, { depth: 0.015, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2 }), metal(0x8a8a8a, 0.35), 0.01, 0.6, -0.008));
  } else if (type === 'string') {
    g.add(mesh(new THREE.BoxGeometry(0.3, 0.02, 0.02), wood(), 0, 0.05, 0));
    g.add(mesh(new THREE.BoxGeometry(0.02, 0.02, 0.24), wood(), 0, 0.05, 0));
    for (let i = 0; i < 4; i++) g.add(mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.6), std(0xeeeeee), (i - 1.5) * 0.08, -0.25, 0));
  } else if (type === 'chainsaw') {
    g.add(mesh(new THREE.BoxGeometry(0.14, 0.3, 0.18), std(0x7a2a10, { roughness: 0.6, metalness: 0.4 }), 0, 0.05, 0));
    g.add(mesh(new THREE.BoxGeometry(0.03, 0.75, 0.09), metal(0x9a9a9a, 0.3), 0, 0.55, 0));
    g.add(mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12), metal(0x222222), 0, -0.12, 0));
  } else if (type === 'trident') {
    g.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.7), metal(0x3c5450, 0.5), 0, 0.35, 0));
    for (const x of [-0.06, 0, 0.06]) g.add(mesh(new THREE.ConeGeometry(0.014, 0.2, 8), metal(0x6fa59a, 0.3), x, 1.3 - Math.abs(x), 0));
    g.add(mesh(new THREE.BoxGeometry(0.14, 0.02, 0.02), metal(0x6fa59a, 0.3), 0, 1.18, 0));
  }
  return g;
}

export function makeCandle(withLight = true) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.12, 12), std(0xe9e1c8, { roughness: 0.6 }), 0, 0.06, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.012, 14), metal(0x8a6d3b), 0, 0, 0));
  const flame = mesh(new THREE.SphereGeometry(0.014, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffc46b }), 0, 0.14, 0);
  flame.scale.set(1, 2, 1); flame.castShadow = false; g.add(flame);
  g.userData.flame = flame;
  if (withLight) {
    const light = vlight(0xffa64a, 4, 9, 1.6);
    light.position.y = 0.2; light.flicker = 1; g.add(light);
    g.userData.light = light;
  }
  return g;
}
