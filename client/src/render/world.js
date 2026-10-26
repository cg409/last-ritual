// Static environment: terrain, ruins, sheds, fences, rocks, pillars. Trees & grass live in foliage.js.
import * as THREE from 'three';
import { makeGround, makeStone, makeWood } from './textures.js';
import { buildTrees, buildGrass } from './foliage.js';

export function buildWorld(scene, map) {
  const group = new THREE.Group(); scene.add(group);
  const stoneTex = makeStone(), woodTex = makeWood();
  const H = map.size / 2;

  const gGeo = new THREE.PlaneGeometry(map.size + 120, map.size + 120, 120, 120);
  const pos = gGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const edge = Math.max(0, Math.max(Math.abs(x), Math.abs(y)) - H);
    pos.setZ(i, Math.sin(x * 0.15) * Math.cos(y * 0.13) * 0.12 + edge * edge * 0.04);
  }
  gGeo.computeVertexNormals();
  const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ map: makeGround(), roughness: 1, color: 0x8a8070 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);

  const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.95 });
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.95 });
  const add = (m) => { m.castShadow = true; m.receiveShadow = true; group.add(m); return m; };
  const matCache = new Map();
  const tiled = (base, rx, ry) => {
    const k = `${base.uuid}-${Math.round(rx)}-${Math.round(ry)}`;
    if (!matCache.has(k)) { const t = base.map.clone(); t.repeat.set(Math.max(1, Math.round(rx)), Math.max(1, Math.round(ry))); t.needsUpdate = true; matCache.set(k, new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 })); }
    return matCache.get(k);
  };

  for (const r of map.rects) {
    if (r.type === 'boundary' || r.type === 'tomb' || r.type === 'tower') continue;
    if (r.type === 'fence') { buildFence(group, r, woodMat); continue; }
    const base = r.type === 'shed' ? woodMat : stoneMat;
    const box = add(new THREE.Mesh(new THREE.BoxGeometry(r.hw * 2, r.h, r.hd * 2), tiled(base, Math.max(r.hw, r.hd) / 1.5, r.h / 2)));
    box.position.set(r.x, r.h / 2, r.z);
    if (r.type === 'wall' || r.type === 'stone') { // broken crenellations
      for (let i = 0; i < Math.max(r.hw, r.hd) * 1.2; i++) {
        const c = add(new THREE.Mesh(new THREE.BoxGeometry(0.5 + Math.random() * 0.6, 0.3 + Math.random() * 0.6, 0.5), stoneMat));
        const along = (Math.random() - 0.5) * 2;
        c.position.set(r.x + (r.hw > r.hd ? along * r.hw : 0), r.h + 0.15, r.z + (r.hd > r.hw ? along * r.hd : 0));
      }
    }
    if (r.type === 'shed') {
      const roof = add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, r.hw * 1.5, 1.6, 4, 1), woodMat));
      roof.position.set(r.x, r.h + 0.75, r.z); roof.rotation.y = Math.PI / 4; roof.scale.z = r.hd / r.hw;
    }
  }

  const rockMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 1, color: 0x9a948a });
  for (const c of map.circles) {
    if (c.type === 'rock') {
      const g = new THREE.DodecahedronGeometry(c.r, 1); const rp = g.attributes.position;
      for (let i = 0; i < rp.count; i++) rp.setXYZ(i, rp.getX(i) * (0.85 + Math.random() * 0.3), rp.getY(i) * (c.h / c.r) * 0.6, rp.getZ(i) * (0.85 + Math.random() * 0.3));
      g.computeVertexNormals();
      add(new THREE.Mesh(g, rockMat)).position.set(c.x, c.h * 0.25, c.z);
    } else if (c.type === 'pillar') {
      const m = add(new THREE.Mesh(new THREE.CylinderGeometry(c.r * 0.8, c.r, c.h, 10), stoneMat));
      m.position.set(c.x, c.h / 2, c.z); m.rotation.z = (Math.random() - 0.5) * 0.15;
    }
  }
  buildTrees(group, map);
  buildGrass(group, map);
  return group;
}

function buildFence(group, r, mat) {
  const len = Math.max(r.hw, r.hd) * 2, alongX = r.hw > r.hd;
  for (let i = 0; i <= len; i += 1.2) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, r.h, 0.12), mat); post.castShadow = true;
    post.position.set(r.x + (alongX ? i - len / 2 : 0), r.h / 2, r.z + (alongX ? 0 : i - len / 2));
    post.rotation.z = (Math.random() - 0.5) * 0.2; group.add(post);
  }
  for (const y of [0.4, 0.85]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.06, 0.1, alongX ? 0.06 : len), mat);
    rail.position.set(r.x, y, r.z); rail.castShadow = true; group.add(rail);
  }
}
