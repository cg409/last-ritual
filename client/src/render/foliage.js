// Instanced dead forest and wind-swayed tall grass (camouflage patches).
import * as THREE from 'three';
import { makeBark } from './textures.js';

export function buildTrees(group, map) {
  const trees = map.circles.filter((c) => c.type === 'tree');
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.45, 1, 8, 6); trunkGeo.translate(0, 0.5, 0);
  const tp = trunkGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); tp.setX(i, tp.getX(i) + Math.sin(y * 7) * 0.05); tp.setZ(i, tp.getZ(i) + Math.cos(y * 5) * 0.04); }
  trunkGeo.computeVertexNormals();
  const barkMat = new THREE.MeshStandardMaterial({ map: makeBark(), roughness: 1, color: 0x8a7a6a });
  const trunks = new THREE.InstancedMesh(trunkGeo, barkMat, trees.length);
  const branchGeo = new THREE.CylinderGeometry(0.025, 0.09, 1, 5); branchGeo.translate(0, 0.5, 0);
  const twigGeo = new THREE.CylinderGeometry(0.008, 0.03, 1, 4); twigGeo.translate(0, 0.5, 0);
  const branches = new THREE.InstancedMesh(branchGeo, barkMat, trees.length * 7);
  const twigs = new THREE.InstancedMesh(twigGeo, barkMat, trees.length * 14);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let bi = 0, ti = 0;
  trees.forEach((t, i) => {
    const sc = t.r / 0.45;
    m4.compose(p.set(t.x, 0, t.z), q.setFromEuler(e.set((Math.random() - 0.5) * 0.08, Math.random() * 6, (Math.random() - 0.5) * 0.08)), s.set(sc, t.h, sc));
    trunks.setMatrixAt(i, m4);
    for (let k = 0; k < 7; k++) {
      const y = t.h * (0.4 + Math.random() * 0.55), len = 1.5 + Math.random() * 2.5, yaw = Math.random() * Math.PI * 2, pitch = 0.5 + Math.random() * 0.8;
      m4.compose(p.set(t.x, y, t.z), q.setFromEuler(e.set(pitch, yaw, 0, 'YXZ')), s.set(1, len, 1));
      branches.setMatrixAt(bi++, m4);
      // two twigs at each branch tip
      const tip = new THREE.Vector3(0, len, 0).applyQuaternion(q).add(p);
      for (let j = 0; j < 2; j++) {
        m4.compose(tip, new THREE.Quaternion().setFromEuler(e.set(pitch + (Math.random() - 0.5) * 1.2, yaw + (Math.random() - 0.5) * 1.5, 0, 'YXZ')), s.set(1, 0.6 + Math.random(), 1));
        twigs.setMatrixAt(ti++, m4);
      }
    }
  });
  for (const im of [trunks, branches, twigs]) { im.castShadow = true; im.receiveShadow = true; group.add(im); }
}

export function buildGrass(group, map) {
  const blade = new THREE.PlaneGeometry(0.12, 1.3, 1, 4); blade.translate(0, 0.65, 0);
  const bp = blade.attributes.position;
  for (let i = 0; i < bp.count; i++) { const y = bp.getY(i); bp.setX(i, bp.getX(i) * (1 - y / 1.4)); } // taper
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 1 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 }; mat.userData.shader = sh;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp = instanceMatrix * vec4(0.,0.,0.,1.);
        transformed.x += sin(uTime*1.3 + wp.x*0.4 + wp.z*0.3) * 0.12 * position.y;`);
  };
  const per = (g) => Math.floor(g.r * g.r * 10);
  const count = map.grass.reduce((n, g) => n + per(g), 0);
  const inst = new THREE.InstancedMesh(blade, mat, Math.max(1, count));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  let i = 0;
  for (const g of map.grass) {
    for (let k = 0; k < per(g); k++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * g.r;
      m4.compose(p.set(g.x + Math.cos(a) * d, 0, g.z + Math.sin(a) * d), q.setFromEuler(e.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI, 0)), s.set(1, 0.7 + Math.random() * 0.6, 1));
      inst.setMatrixAt(i, m4);
      inst.setColorAt(i++, col.setHSL(0.12 + Math.random() * 0.06, 0.35, 0.14 + Math.random() * 0.1));
    }
  }
  inst.receiveShadow = true;
  group.add(inst);
  group.userData.grassMat = mat;
}
