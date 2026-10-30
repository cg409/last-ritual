// The walled cemetery: mossy stone walls with capstones, wrought-iron gate posts, rows of tilted
// headstones / crosses / slabs / weeping-angel stones with grave mounds, a mausoleum and dead trees.
// All static geometry is merged per material.
import * as THREE from 'three';
import { pbr, instanceModel } from './assets.js';
import { Batch } from './buildings.js';
import { terrainY } from '@shared/levels.js';

export function buildCemetery(group, map) {
  const c = map.cemetery; if (!c) return;
  const stone = pbr('mossy_stone_wall', 1, { color: 0x8a8a84 }), grave = pbr('castle_wall_slates', 1, { color: 0x9a9a96 });
  const dirt = pbr('brown_mud_leaves_01', 1, { color: 0x6a5a4a });
  const iron = new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 0.55, metalness: 0.8 });
  const B = new Batch();
  for (const r of map.rects) {
    if (r.type === 'cemwall') {
      const y0 = terrainY(r.x, r.z);
      B.box(stone, r.hw * 2, r.h, r.hd * 2, r.x, y0 + r.h / 2, r.z, 0, 0, 0, 1.5);
      B.box(stone, r.hw * 2 + 0.12, 0.14, r.hd * 2 + 0.12, r.x, y0 + r.h + 0.07, r.z, 0, 0, 0, 1);
    } else if (r.type === 'mausoleum') {
      const y0 = terrainY(r.x, r.z), w = r.hw * 2, d = r.hd * 2;
      B.box(stone, w + 0.5, 0.35, d + 0.5, r.x, y0 + 0.17, r.z, 0, 0, 0, 1);
      B.box(grave, w, r.h - 1, d, r.x, y0 + (r.h - 1) / 2 + 0.3, r.z, 0, 0, 0, 1.5);
      for (const s of [-1, 1]) B.box(grave, 0.4, r.h - 0.7, 0.4, r.x + s * (w / 2 - 0.3), y0 + (r.h - 0.7) / 2, r.z - d / 2 - 0.25, 0, 0, 0, 1);
      B.box(grave, w + 0.6, 0.3, d + 0.8, r.x, y0 + r.h - 0.55, r.z - 0.1, 0, 0, 0, 1);
      const roof = new THREE.ConeGeometry(Math.max(w, d) * 0.72, 1.3, 4, 1); roof.rotateY(Math.PI / 4); roof.translate(r.x, y0 + r.h + 0.25, r.z - 0.1);
      B.add(grave, roof);
      B.box(iron, 1.3, 2.0, 0.06, r.x, y0 + 1.3, r.z - d / 2 - 0.02, 0, 0, 0, 1); // rusted door
    }
  }
  // Gate posts with stone balls + leaning iron gate leaves.
  for (const gt of [c.gate, c.side2]) {
    if (!gt) continue;
    const alongX = gt === c.gate, half = gt === c.gate ? 1.5 : 1.2, y0 = terrainY(gt.x, gt.z);
    for (const s of [-1, 1]) {
      const px = gt.x + (alongX ? s * half : 0), pz = gt.z + (alongX ? 0 : s * half);
      B.box(stone, 0.6, 2.3, 0.6, px, y0 + 1.15, pz, 0, 0, 0, 1);
      const ball = new THREE.SphereGeometry(0.24, 10, 8); ball.translate(px, y0 + 2.55, pz); B.add(stone, ball);
    }
    if (alongX) for (const s of [-1, 1]) { // half-open iron leaves
      for (let i = 0; i < 7; i++) {
        const ox = gt.x + s * (1.4 - 0.18 * i) * 0.8, oz = gt.z - s * 0.3 * (i / 7) - 0.4 * (i / 7);
        B.box(iron, 0.035, 1.8, 0.035, ox, y0 + 0.95, oz, 0, 0, 0, 1);
      }
      B.box(iron, 1.1, 0.05, 0.05, gt.x + s * 0.85, y0 + 1.75, gt.z - 0.25, 0, s * 0.45, 0, 1);
      B.box(iron, 1.1, 0.05, 0.05, gt.x + s * 0.85, y0 + 0.3, gt.z - 0.25, 0, s * 0.45, 0, 1);
    }
  }
  // Graves: mound + marker.
  for (const gv of map.graves) {
    const y0 = terrainY(gv.x, gv.z), s = gv.s;
    const mound = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    mound.scale(0.42 * s, 0.16, 0.9 * s); mound.translate(gv.x, y0 - 0.02, gv.z + 0.65);
    B.add(dirt, mound);
    const rotM = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(gv.tilt, gv.rot, gv.tilt * 0.4));
    const put = (geo, y) => { geo.translate(0, y, 0); geo.applyMatrix4(rotM); geo.translate(gv.x, y0, gv.z); B.add(grave, geo); };
    if (gv.kind === 'stone') {
      const sh = new THREE.Shape(); const w = 0.32 * s, h = 0.75 * s;
      sh.moveTo(-w, 0); sh.lineTo(w, 0); sh.lineTo(w, h - w); sh.absarc(0, h - w, w, 0, Math.PI, false); sh.lineTo(-w, 0);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1, curveSegments: 8 });
      geo.translate(0, 0, -0.06); put(geo, 0);
    } else if (gv.kind === 'cross') {
      put(new THREE.BoxGeometry(0.11, 1.0 * s, 0.1), 0.5 * s); put(new THREE.BoxGeometry(0.5 * s, 0.1, 0.1), 0.72 * s);
    } else if (gv.kind === 'slab') {
      const geo = new THREE.BoxGeometry(0.7 * s, 0.14, 1.7 * s); geo.translate(0, 0, 0.65); put(geo, 0.07);
      put(new THREE.BoxGeometry(0.62 * s, 0.45 * s, 0.12), 0.22 * s);
    } else { // weeping angel: plinth + robed body + head + folded wings
      put(new THREE.BoxGeometry(0.5, 0.35, 0.5), 0.17);
      const body = new THREE.CylinderGeometry(0.12, 0.24, 0.95, 10); put(body, 0.82);
      put(new THREE.SphereGeometry(0.11, 10, 8), 1.38);
      const wing = new THREE.BoxGeometry(0.06, 0.7, 0.35); wing.rotateX(0.25); wing.translate(0.12, 0, -0.14); put(wing, 1.05);
      const wing2 = new THREE.BoxGeometry(0.06, 0.7, 0.35); wing2.rotateX(0.25); wing2.translate(-0.12, 0, -0.14); put(wing2, 1.05);
    }
  }
  B.flush(group);
  // A few dead trees and dry undergrowth inside the walls (instanced scans).
  const trees = [], ferns = [];
  for (let i = 0; i < 3; i++) trees.push({ x: c.x + (Math.random() - 0.5) * c.w * 0.7, z: c.z + (Math.random() - 0.5) * c.d * 0.6, rot: Math.random() * 6, s: 0.8 + Math.random() * 0.3 });
  for (let i = 0; i < 18; i++) { const x = c.x + (Math.random() - 0.5) * c.w * 0.9, z = c.z + (Math.random() - 0.5) * c.d * 0.9; ferns.push({ x, z, y: terrainY(x, z), rot: Math.random() * 6, s: 0.7 + Math.random() * 0.5 }); }
  group.add(instanceModel('dead_tree_trunk', trees));
  group.add(instanceModel('dry_branches_medium_01', ferns, { castShadow: false, tint: 0x6a6a58 }));
}
