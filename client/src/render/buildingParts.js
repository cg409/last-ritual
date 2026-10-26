// Building details: window frames, sills, shutters, broken glass, hip roofs, chimneys, porches.
import * as THREE from 'three';
import { WALL_T, STORY_HEIGHT } from '@shared/buildings.js';

export const sh = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

export function uvBox(w, h, d, tile = 2) { // world-scaled UVs so textures don't stretch
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, n = g.attributes.normal, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    uv.setXY(i, (ax > 0.5 ? p.getZ(i) : p.getX(i)) / tile, (ay > 0.5 ? p.getZ(i) : p.getY(i)) / tile);
  }
  return g;
}

export function addFrame(g, s, y0, w, h, y, mat) {
  const t = 0.12;
  const bar = (bw, bh, by, off) => {
    const m = sh(new THREE.Mesh(new THREE.BoxGeometry(s.alongX ? bw : WALL_T + 0.08, bh, s.alongX ? WALL_T + 0.08 : bw), mat));
    m.position.set(s.x + (s.alongX ? off : 0), y0 + y + by, s.z + (s.alongX ? 0 : off)); g.add(m);
  };
  bar(w + t * 2, t, h + t / 2, 0); bar(t, h, h / 2, -w / 2 - t / 2); bar(t, h, h / 2, w / 2 + t / 2);
}

export function addWindow(g, s, y0, w, M) {
  addFrame(g, s, y0, w, 1.3, 1.0, M.trim);
  const sill = sh(new THREE.Mesh(new THREE.BoxGeometry(s.alongX ? w + 0.3 : WALL_T + 0.25, 0.08, s.alongX ? WALL_T + 0.25 : w + 0.3), M.trim));
  sill.position.set(s.x, y0 + 1.0, s.z); g.add(sill);
  const mull = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.3, 0.05), M.trim); mull.position.set(s.x, y0 + 1.65, s.z); g.add(mull);
  if (Math.random() < 0.7) { // jagged broken glass hanging from the top of the frame
    const shard = new THREE.Shape(); shard.moveTo(0, 0); shard.lineTo(w / 2 - 0.05, 0); shard.lineTo(w / 2 - 0.05, 0.4 + Math.random() * 0.5); shard.lineTo(w * 0.15, 0.2);
    const gm = new THREE.Mesh(new THREE.ShapeGeometry(shard), M.glass);
    gm.position.set(s.x - (s.alongX ? w / 2 : 0), y0 + 2.25, s.z - (s.alongX ? 0 : w / 2)); gm.rotation.set(Math.PI, s.alongX ? 0 : Math.PI / 2, 0); g.add(gm);
  }
  if (s.exterior && Math.random() < 0.55) { // crooked shutter
    const sht = sh(new THREE.Mesh(new THREE.BoxGeometry(s.alongX ? w / 2 : 0.05, 1.3, s.alongX ? 0.05 : w / 2), M.trim));
    const off = (w / 2 + w / 4 + 0.15) * (Math.random() < 0.5 ? -1 : 1), out = (WALL_T / 2 + 0.06) * (Math.random() < 0.5 ? 1 : -1);
    sht.position.set(s.x + (s.alongX ? off : out), y0 + 1.65, s.z + (s.alongX ? out : off));
    sht.rotation.z = (Math.random() - 0.5) * 0.25; g.add(sht);
  }
}

export function addRoof(g, b, M) {
  const top = b.floors * STORY_HEIGHT, oh = 0.6, rh = b.style === 'mansion' ? 4.2 : 2.8;
  const w = b.w / 2 + oh, d = b.d / 2 + oh, ridge = Math.max(0.5, w - d);
  const v = [-w, 0, -d, w, 0, -d, w, 0, d, -w, 0, d, -ridge, rh, 0, ridge, rh, 0];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.setIndex([0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 3, 5, 4, 3, 4, 0]);
  const non = geo.toNonIndexed(); non.computeVertexNormals();
  const p = non.attributes.position, uv = [];
  for (let i = 0; i < p.count; i++) uv.push((p.getX(i) + p.getZ(i)) / 2, p.getY(i) / 1.4 + Math.abs(p.getZ(i)) / 2);
  non.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const roofMat = M.roof.clone(); roofMat.side = THREE.DoubleSide;
  const roof = sh(new THREE.Mesh(non, roofMat)); roof.position.set(b.x, top + 0.1, b.z); g.add(roof);
  const eave = sh(new THREE.Mesh(uvBox(b.w + 0.5, 0.3, b.d + 0.5), M.trim)); eave.position.set(b.x, top, b.z); g.add(eave);
  for (const cx of b.style === 'mansion' ? [-b.w / 3, b.w / 3] : [b.w / 4]) {
    const c = sh(new THREE.Mesh(uvBox(0.9, rh + 2, 0.9, 1.5), M.stone)); c.position.set(b.x + cx, top + (rh + 2) / 2, b.z - 0.5); g.add(c);
    const cap = sh(new THREE.Mesh(uvBox(1.1, 0.2, 1.1), M.stone)); cap.position.set(b.x + cx, top + rh + 2.1, b.z - 0.5); g.add(cap);
  }
}

export function addPorch(g, b, M) {
  const { w, d } = b.porch, z = b.z + b.d / 2 + d / 2, h = 0.35;
  const deck = sh(new THREE.Mesh(uvBox(w, h, d, 2), M.floor)); deck.position.set(b.x, h / 2, z); g.add(deck);
  const step = sh(new THREE.Mesh(uvBox(w * 0.5, h / 2, 0.5), M.stone)); step.position.set(b.x, h / 4, z + d / 2 + 0.25); g.add(step);
  const ph = b.style === 'mansion' ? STORY_HEIGHT : 2.8;
  for (const s of [-1, 1]) {
    const col = sh(new THREE.Mesh(uvBox(0.3, ph, 0.3, 1), M.trim)); col.position.set(b.x + s * (w / 2 - 0.2), ph / 2 + h, z + d / 2 - 0.2); g.add(col);
    const rail = sh(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, d), M.trim)); rail.position.set(b.x + s * (w / 2 - 0.2), h + 0.9, z); g.add(rail);
  }
  const roof = sh(new THREE.Mesh(uvBox(w + 0.6, 0.18, d + 0.4, 2), M.roof)); roof.position.set(b.x, ph + h + 0.1, z + 0.1); roof.rotation.x = 0.12; g.add(roof);
}
