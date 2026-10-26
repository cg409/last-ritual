// Detailed procedural props: hats & monster heads. Weapons/candle live in items.js. All in metres.
import * as THREE from 'three';
export { makeWeapon, makeCandle } from './items.js';

export const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
export const metal = (color = 0x777777, rough = 0.45) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.85 });
export function mesh(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; return m;
}

// Mixamo bones live in centimetre space — cancel that scale so props can be authored in metres.
export function attachTo(boneObj, obj, modelRoot) {
  if (!boneObj) return;
  modelRoot?.updateMatrixWorld(true);
  const ws = new THREE.Vector3(); boneObj.getWorldScale(ws);
  const ms = modelRoot ? modelRoot.scale.x : 1;
  obj.scale.multiplyScalar(ms / ws.x);
  boneObj.add(obj);
}

export function makeHat(type, cloth, accent) {
  const g = new THREE.Group();
  if (type === 'hood') {
    const hood = mesh(new THREE.SphereGeometry(0.135, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), std(cloth, { side: THREE.DoubleSide }), 0, 0.1, -0.01);
    hood.scale.set(1.05, 1.15, 1.15); g.add(hood);
    g.add(mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.18, 18, 1, true), std(cloth, { side: THREE.DoubleSide }), 0, -0.02, -0.03));
  } else if (type === 'cap') {
    g.add(mesh(new THREE.CylinderGeometry(0.115, 0.12, 0.08, 20), std(accent), 0, 0.17, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.012, 20, 1, false, -Math.PI / 2, Math.PI), std(accent), 0, 0.135, 0.06));
  } else if (type === 'helmet') {
    g.add(mesh(new THREE.SphereGeometry(0.13, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), metal(0x6b5a2a, 0.6), 0, 0.12, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.04, 12), std(0xffe9a8, { emissive: 0xffd27a, emissiveIntensity: 1.5 }), 0, 0.18, 0.12, Math.PI / 2));
  } else return null;
  return g;
}

export function makeMonsterHead(id) {
  const g = new THREE.Group();
  const eye = std(0x000000, { emissive: 0xff2200, emissiveIntensity: 3 });
  const eyes = (y, z, gap = 0.04, r = 0.014) => {
    g.add(mesh(new THREE.SphereGeometry(r, 8, 8), eye, gap, y, z));
    g.add(mesh(new THREE.SphereGeometry(r, 8, 8), eye, -gap, y, z));
  };
  if (id === 'mimic') { // porcelain theatre mask with a cracked smile
    const mask = mesh(new THREE.SphereGeometry(0.13, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.7), std(0xe8e0d0, { roughness: 0.35 }), 0, 0.1, 0.03);
    mask.scale.set(0.95, 1.2, 0.8); g.add(mask);
    g.add(mesh(new THREE.TorusGeometry(0.05, 0.007, 6, 18, Math.PI), std(0x220000), 0, 0.04, 0.125, 0, 0, Math.PI));
    eyes(0.12, 0.12, 0.045, 0.016);
  } else if (id === 'wanderer') { // plague-crow beak + wide-brim hat
    g.add(mesh(new THREE.ConeGeometry(0.05, 0.22, 12), std(0x2a2018), 0, 0.07, 0.18, Math.PI / 2.2));
    g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.015, 24), std(0x16110d), 0, 0.22, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 20), std(0x16110d), 0, 0.3, 0));
    eyes(0.12, 0.11, 0.05, 0.02);
  } else if (id === 'puppeteer') { // stitched doll head with strings rising into the dark
    g.add(mesh(new THREE.SphereGeometry(0.14, 20, 16), std(0xb9a58f, { roughness: 1 }), 0, 0.1, 0.02));
    for (let i = -2; i <= 2; i++) g.add(mesh(new THREE.BoxGeometry(0.003, 0.003, 0.03), std(0x111111), i * 0.015, 0.03, 0.15));
    for (let i = 0; i < 5; i++) g.add(mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.9), std(0xdddddd), Math.cos(i) * 0.1, 0.65, Math.sin(i) * 0.1));
    eyes(0.13, 0.14, 0.05, 0.02);
  } else if (id === 'ravager') { // leather sack mask with a noose collar
    const sack = mesh(new THREE.SphereGeometry(0.15, 16, 12), std(0x5a4632, { roughness: 1 }), 0, 0.11, 0); sack.scale.set(1, 1.15, 1); g.add(sack);
    g.add(mesh(new THREE.TorusGeometry(0.11, 0.012, 6, 16), std(0x2a1d12), 0, -0.01, 0, Math.PI / 2));
    eyes(0.13, 0.13, 0.05, 0.018);
  } else if (id === 'stalker') { // drowned hood dripping kelp
    g.add(mesh(new THREE.ConeGeometry(0.17, 0.42, 18, 1, true), std(0x16242a, { side: THREE.DoubleSide, roughness: 0.3, metalness: 0.2 }), 0, 0.2, -0.02));
    for (let i = 0; i < 7; i++) g.add(mesh(new THREE.CylinderGeometry(0.006, 0.002, 0.3), std(0x1e3a22), Math.cos(i * 0.9) * 0.13, -0.05, Math.sin(i * 0.9) * 0.13 + 0.02));
    eyes(0.1, 0.11, 0.04, 0.012);
  }
  return g;
}
