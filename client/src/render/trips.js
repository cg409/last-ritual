// Trip obstacles: weathered wooden pallets (some cracked, missing slats) and fallen bark logs with
// broken branch stubs, lying across the paths. Merged per material, so they cost a few draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { pbr } from './assets.js';
import { uvBox } from './buildingParts.js';
import { makeRng } from '@shared/rng.js';
import { terrainY } from '@shared/levels.js';

const tmp = new THREE.Object3D();
function put(list, geo, x, y, z, rx, ry, rz, parent) {
  tmp.position.set(x, y, z); tmp.rotation.set(rx, ry, rz); tmp.scale.set(1, 1, 1); tmp.updateMatrix();
  const g = geo.clone().applyMatrix4(tmp.matrix).applyMatrix4(parent);
  list.push(g.index ? g.toNonIndexed() : g);
}

export function buildTrips(group, map) {
  if (!map.trips?.length) return;
  const rng = makeRng(map.seed ^ 0x7a11e7);
  const woodG = [], barkG = [], endG = [];
  const slat = uvBox(0.1, 0.022, 1.2, 1), stringer = uvBox(0.09, 0.09, 1.2, 1), board = uvBox(1.0, 0.022, 0.1, 1);
  const parent = new THREE.Matrix4();
  for (const t of map.trips) {
    // Sit on the rolling ground: height and pitch from the terrain under both ends (long axis = local Z).
    const ex = Math.sin(t.rot) * t.hl, ez = Math.cos(t.rot) * t.hl;
    const ya = terrainY(t.x - ex, t.z - ez), yb = terrainY(t.x + ex, t.z + ez);
    tmp.rotation.order = 'YXZ';
    tmp.position.set(t.x, (ya + yb) / 2 - 0.03, t.z); tmp.rotation.set(-Math.atan2(yb - ya, t.hl * 2), t.rot, 0); tmp.scale.set(1, 1, 1); tmp.updateMatrix();
    tmp.rotation.order = 'XYZ';
    parent.copy(tmp.matrix);
    if (t.kind === 'pallet') { // long axis = local Z (1.2m), width = X (1.0m)
      const tilt = rng.range(-0.05, 0.05);
      for (let i = 0; i < 3; i++) put(woodG, board, 0, 0.011, (i - 1) * 0.55, 0, 0, tilt, parent);            // bottom boards
      for (let i = 0; i < 3; i++) put(woodG, stringer, (i - 1) * 0.45, 0.067, 0, 0, rng.range(-0.02, 0.02), tilt, parent); // stringers
      for (let i = 0; i < 7; i++) {
        if (rng() < 0.18) continue; // missing / broken slat
        const x = (i - 3) * 0.155, cracked = rng() < 0.15;
        put(woodG, slat, x, 0.123 + (cracked ? 0.02 : 0), cracked ? 0.15 : 0, cracked ? rng.range(-0.15, 0.15) : 0, rng.range(-0.03, 0.03), tilt, parent);
      }
    } else { // fallen log across the path, half sunk in the leaf litter
      const r = 0.16, len = t.hl * 2;
      const geo = new THREE.CylinderGeometry(r * 0.85, r, len, 12, 4); const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const k = 1 + Math.sin(p.getY(i) * 3 + p.getX(i) * 9) * 0.06; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
      geo.computeVertexNormals();
      put(barkG, geo, 0, r * 0.85, 0, Math.PI / 2, 0, rng.range(-0.15, 0.15), parent);
      const cap = new THREE.CircleGeometry(r * 0.95, 12);
      put(endG, cap, 0, r * 0.85, len / 2 + 0.002, 0, 0, 0, parent);
      put(endG, cap, 0, r * 0.85, -len / 2 - 0.002, 0, Math.PI, 0, parent);
      const stub = new THREE.CylinderGeometry(0.02, 0.045, 0.35, 6);
      for (let k = 0; k < 3; k++) put(barkG, stub, rng.range(-0.1, 0.1), r * 0.85 + 0.15, rng.range(-len / 2.5, len / 2.5), rng.range(-0.8, 0.8), 0, rng.range(-0.9, 0.9), parent);
    }
  }
  const add = (list, mat) => {
    if (!list.length) return;
    const m = new THREE.Mesh(mergeGeometries(list), mat); m.castShadow = true; m.receiveShadow = true; group.add(m);
  };
  add(woodG, pbr('weathered_plank_siding', 1, { color: 0x8a7a66 }));
  add(barkG, pbr('bark_brown_02', 1, { color: 0x7a6a5a }));
  add(endG, new THREE.MeshStandardMaterial({ color: 0x6a5238, roughness: 1 }));
}
