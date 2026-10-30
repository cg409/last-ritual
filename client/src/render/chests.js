// Chest models. Deliberately dull — no glow, no shine — so they're only found by looking carefully.
//  supply: a plain weathered crate-chest with iron bands
//  ritual: dark stained wood, iron corners, a faint carved sigil (unlit)
//  cursed: blackened wood bound in chains, a bone clasp
import * as THREE from 'three';
import { pbr } from './assets.js';
import { uvBox } from './buildingParts.js';

const mats = {};
function mat(tier) {
  if (mats[tier]) return mats[tier];
  const color = tier === 'supply' ? 0x7a6650 : tier === 'ritual' ? 0x3e3028 : 0x221c1a;
  mats[tier] = {
    wood: pbr('weathered_plank_siding', 1, { color }),
    iron: new THREE.MeshStandardMaterial({ color: tier === 'cursed' ? 0x2a2a2a : 0x3c3a36, roughness: 0.85, metalness: 0.5 }),
    bone: new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.9 }),
  };
  return mats[tier];
}

export function makeChest(tier) {
  const M = mat(tier), g = new THREE.Group();
  const W = tier === 'supply' ? 0.8 : 0.9, D = 0.5, H = 0.42;
  const add = (geo, m, x, y, z, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  add(uvBox(W, H, D, 1), M.wood, 0, H / 2, 0);
  for (const x of [-W / 2 + 0.08, W / 2 - 0.08]) add(new THREE.BoxGeometry(0.05, H + 0.01, D + 0.01), M.iron, x, H / 2, 0);
  // lid hinged along the back edge
  const lid = new THREE.Group(); lid.position.set(0, H, -D / 2); g.add(lid);
  const top = add(new THREE.CylinderGeometry(D / 2, D / 2, W, 12, 1, false, 0, Math.PI), M.wood, 0, 0, D / 2, lid);
  top.rotation.z = Math.PI / 2; top.rotation.y = Math.PI / 2; top.scale.set(1, 1, 0.5);
  for (const x of [-W / 2 + 0.08, W / 2 - 0.08]) { const b = add(new THREE.TorusGeometry(D / 2, 0.018, 4, 12, Math.PI), M.iron, x, 0, D / 2, lid); b.rotation.y = Math.PI / 2; b.scale.set(1, 0.5, 1); }
  add(new THREE.BoxGeometry(0.08, 0.1, 0.03), M.iron, 0, -0.06, D + 0.01, lid); // clasp
  if (tier === 'ritual') {
    const sig = add(new THREE.RingGeometry(0.07, 0.085, 5), new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 1 }), 0, H * 0.5, D / 2 + 0.003);
    sig.castShadow = false;
  }
  if (tier === 'cursed') {
    for (const s of [-1, 1]) { const ch = add(new THREE.TorusGeometry(0.34, 0.012, 4, 18), M.iron, s * 0.15, H * 0.6, 0); ch.rotation.y = Math.PI / 2; ch.scale.set(1, 0.85, 1.35); }
    add(new THREE.SphereGeometry(0.05, 8, 6), M.bone, 0, -0.04, D + 0.03, lid); // a small skull clasp
  }
  g.userData.lid = lid;
  return g;
}
