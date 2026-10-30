// Escape pallets: a weathered wooden pallet leaning upright against the wall beside a doorway.
// When dropped it swings down across the gap with a quick, heavy slam (and dust); when the monster
// smashes it, it splinters into boards scattered on the ground.
import * as THREE from 'three';
import { pbr } from './assets.js';
import { uvBox } from './buildingParts.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { terrainY } from '@shared/levels.js';

// Built lying flat: length L along +X starting at the hinge edge (x = 0), 1.0m wide in Z (centred).
function palletGeometry(L) {
  const parts = [];
  const put = (w, h, d, x, y, z) => { const g = uvBox(w, h, d, 1); g.translate(x, y, z); parts.push(g.toNonIndexed()); };
  for (let i = 0; i < 3; i++) put(L, 0.1, 0.09, L / 2, 0.06, -0.45 + i * 0.45); // stringers
  for (let i = 0; i < 8; i++) if (i !== 5) put(0.11, 0.025, 1.0, 0.1 + i * ((L - 0.2) / 7), 0.125, 0); // top slats (one missing)
  for (let i = 0; i < 3; i++) put(0.12, 0.025, 1.0, 0.1 + i * ((L - 0.2) / 2), 0.0, 0);
  return mergeGeometries(parts);
}

// Dead snag for the push-down logs, built lying along +X from its root end (x = 0): a gnarled bark
// trunk with a flared, broken-off root plate, a splintered top and a few snapped branch stubs.
const LOG_R = 0.22;
function logGeometry(L) {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(LOG_R * 0.75, LOG_R, L, 12, 8);
  const p = trunk.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 + Math.sin(p.getY(i) * 4 + p.getX(i) * 11) * 0.07; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
  trunk.rotateZ(-Math.PI / 2); trunk.translate(L / 2, LOG_R, 0); parts.push(trunk);
  const flare = new THREE.CylinderGeometry(LOG_R * 1.05, LOG_R * 1.7, 0.35, 10); flare.rotateZ(-Math.PI / 2); flare.translate(0.17, LOG_R, 0); parts.push(flare);
  const tip = new THREE.ConeGeometry(LOG_R * 0.72, 0.35, 7); tip.rotateZ(-Math.PI / 2); tip.translate(L + 0.15, LOG_R, 0); parts.push(tip);
  for (const [x, a, s] of [[0.45, 0.7, 1], [0.62, -1.0, 0.8], [0.8, 2.2, 0.9]]) {
    const st = new THREE.CylinderGeometry(0.025, 0.05, 0.45 * s, 6); st.translate(0, 0.22 * s, 0);
    st.rotateX(a); st.translate(L * x, LOG_R, 0); parts.push(st);
  }
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}

export class Pallets {
  constructor(root, map) {
    this.items = [];
    const wood = pbr('weathered_plank_siding', 1, { color: 0x9a8a72 });
    const bark = pbr('bark_brown_02', 1, { color: 0x7a6a5a });
    for (const p of map.pallets) {
      const log = p.kind === 'log';
      const g = new THREE.Group(); g.position.set(p.x, terrainY(p.x, p.z), p.z);
      g.rotation.y = p.alongX ? 0 : Math.PI / 2; // local X runs across the doorway gap
      const L = log ? p.gap + 0.5 : p.gap + 0.3;
      const hinge = new THREE.Group(); g.add(hinge);
      const mesh = new THREE.Mesh(log ? logGeometry(L) : palletGeometry(L), log ? bark : wood); mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.rotation.y = p.side > 0 ? Math.PI : 0; // extends from its side of the gap toward the other
      hinge.add(mesh);
      root.add(g);
      this.items.push({ id: p.id, g, hinge, mesh, side: p.side, L, gap: p.gap, state: 'up', k: 0, x: p.x, z: p.z, log });
    }
    this.wood = wood; this.root = root; this.debris = [];
  }

  // "up" = standing upright at one edge of the doorway, leaning slightly into the gap, ready to fall;
  // "down" = pivoted about its bottom edge (along the crossing direction) to lie flat across the gap.
  update(dt, snap) {
    const byId = new Map((snap.pallets || []).map((p) => [p.id, p.state]));
    for (const it of this.items) {
      const st = byId.get(it.id) || 'up';
      if (st !== it.state) {
        if (st === 'broken') this.splinter(it);
        it.state = st;
      }
      const target = st === 'up' ? 0 : 1;
      // accelerate like a falling slab (ease-in) when dropping, slow if ever reset; a tall snag
      // starts slower, topples like a felled tree and bounces once on landing
      it.k = target ? Math.min(1, it.k + dt * (it.log ? 0.9 + it.k * 7 : 2 + it.k * 9)) : Math.max(0, it.k - dt * 2);
      if (it.log && it.k >= 1 && it.landT == null) it.landT = 0;
      let bounce = 0;
      if (it.landT != null && it.landT < 0.35) { it.landT += dt; bounce = Math.sin((it.landT / 0.35) * Math.PI) * 0.06; }
      const up = Math.PI / 2 - (it.log ? 0.2 : 0.12);
      it.hinge.rotation.z = -it.side * (up * (1 - it.k) + bounce);
      it.hinge.position.x = it.side * THREE.MathUtils.lerp(it.gap / 2 - 0.1, it.L / 2, it.k);
      it.g.visible = st !== 'broken';
    }
    for (const d of this.debris) if (d.t < 1) { d.t += dt * 2; d.m.position.y = Math.max(d.y0, d.m.position.y + d.vy * dt); d.vy -= dt * 9; }
  }

  splinter(it) {
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(uvBox(0.11, 0.03, 0.4 + Math.random() * 0.5, 1), this.wood);
      const y0 = terrainY(it.x, it.z) + 0.03;
      m.position.set(it.x + (Math.random() - 0.5) * 1.6, y0 + 0.4, it.z + (Math.random() - 0.5) * 1.2);
      m.rotation.set(0, Math.random() * 6, (Math.random() - 0.5) * 0.3); m.castShadow = true;
      this.root.add(m); this.debris.push({ m, t: 0, vy: 2 + Math.random() * 2, y0 });
    }
  }

  dispose() { for (const it of this.items) it.g.removeFromParent(); for (const d of this.debris) d.m.removeFromParent(); }
}
