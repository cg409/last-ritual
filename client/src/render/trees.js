// Realistic dead trees: recursive branching built from curved tapered tubes (CatmullRom + TubeGeometry,
// with root flare and gnarled noise), bark PBR textures, and alpha twig cards at the tips.
// 6 variants are generated once and placed with InstancedMesh.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { pbr } from './assets.js';
import { makeTwigCard } from './textures.js';
import { makeRng } from '@shared/rng.js';
import { terrainY } from '@shared/levels.js';

function limb(rng, start, dir, len, r0, r1, bend) {
  const pts = [start.clone()]; let p = start.clone(), d = dir.clone();
  const n = 5;
  for (let i = 1; i <= n; i++) {
    d.add(new THREE.Vector3((rng() - 0.5) * bend, (rng() - 0.35) * bend * 0.5, (rng() - 0.5) * bend)).normalize();
    p = p.clone().addScaledVector(d, len / n); pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const radial = r0 > 0.15 ? 10 : r0 > 0.05 ? 6 : 4;
  const geo = new THREE.TubeGeometry(curve, n * 3, 1, radial, false);
  // taper + bark noise + root flare at the base
  const pos = geo.attributes.position, segs = n * 3;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, c = curve.getPointAt(t), r = THREE.MathUtils.lerp(r0, r1, Math.pow(t, 0.8));
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      const v = new THREE.Vector3().fromBufferAttribute(pos, k).sub(c).normalize();
      const flare = start.y < 0.1 && t < 0.12 ? 1 + (1 - t / 0.12) * 0.9 * (0.6 + 0.4 * Math.sin(j * 2.3)) : 1;
      const knot = 1 + 0.12 * Math.sin(j * 1.7 + i * 0.9) * Math.sin(i * 0.7);
      pos.setXYZ(k, c.x + v.x * r * flare * knot, c.y + v.y * r * flare * knot, c.z + v.z * r * flare * knot);
    }
  }
  // tile bark UV vertically by length
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * len / 1.5);
  geo.computeVertexNormals();
  return { geo, curve };
}

function growTree(seed) {
  const rng = makeRng(seed);
  const wood = [], twigs = [];
  const height = 9 + rng() * 4;
  const recurse = (start, dir, len, r, depth) => {
    const { geo, curve } = limb(rng, start, dir, len, r, r * 0.35, depth === 0 ? 0.18 : 0.5);
    wood.push(geo);
    if (depth >= 3 || r < 0.025) { // tip: twig cards
      const tip = curve.getPointAt(1);
      for (let k = 0; k < 2; k++) twigs.push({ p: tip, a: rng() * Math.PI, s: 0.9 + rng() * 0.8 });
      return;
    }
    const kids = depth === 0 ? 5 + Math.floor(rng() * 3) : 2 + Math.floor(rng() * 2);
    for (let i = 0; i < kids; i++) {
      const t = depth === 0 ? 0.35 + (i / kids) * 0.6 : 0.5 + rng() * 0.5;
      const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
      const yaw = rng() * Math.PI * 2, out = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
      const nd = tan.clone().multiplyScalar(0.6).addScaledVector(out, 0.8).add(new THREE.Vector3(0, 0.35, 0)).normalize();
      recurse(p, nd, len * (depth === 0 ? 0.42 : 0.62) * (0.8 + rng() * 0.4), r * THREE.MathUtils.lerp(0.55, 0.32, t), depth + 1);
    }
  };
  recurse(new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0, 1, 0), height, 0.42, 0);
  const woodGeo = mergeGeometries(wood.map((g) => g.toNonIndexed()));
  // twig cards: two crossed quads per tip
  const card = new THREE.PlaneGeometry(1.4, 1.4); card.translate(0, 0.6, 0);
  const cards = [];
  for (const tw of twigs) for (const rot of [0, Math.PI / 2]) {
    const c = card.clone(); c.scale(tw.s, tw.s, tw.s); c.rotateY(tw.a + rot); c.rotateX((rng() - 0.5) * 0.6); c.translate(tw.p.x, tw.p.y, tw.p.z); cards.push(c);
  }
  const twigGeo = cards.length ? mergeGeometries(cards) : null;
  return { woodGeo, twigGeo };
}

export function buildTrees(root, map, density = 1) {
  const trees = map.circles.filter((c) => c.type === 'tree');
  const variants = Array.from({ length: 6 }, (_, i) => growTree(1000 + i * 77));
  const bark = pbr('bark_brown_02', 1, { color: 0x8a8a8a });
  const twigMat = new THREE.MeshStandardMaterial({ map: makeTwigCard(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1, color: 0x8a8070 });
  const byV = variants.map(() => []);
  trees.forEach((t, i) => { if (i % 10 < density * 10) byV[t.v % 6].push(t); });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  variants.forEach((v, vi) => {
    const list = byV[vi]; if (!list.length) return;
    const wood = new THREE.InstancedMesh(v.woodGeo, bark, list.length);
    const tw = v.twigGeo && new THREE.InstancedMesh(v.twigGeo, twigMat, list.length);
    list.forEach((t, i) => {
      const sc = t.h / 11, rs = t.r / 0.42;
      m4.compose(p.set(t.x, terrainY(t.x, t.z) - 0.08, t.z), q.setFromEuler(e.set((t.x % 1) * 0.06, (t.x * 13.1 + t.z * 7.7) % 6.28, (t.z % 1) * 0.06)), s.set(rs * 0.9 + 0.1, sc, rs * 0.9 + 0.1));
      wood.setMatrixAt(i, m4); tw?.setMatrixAt(i, m4);
    });
    wood.castShadow = wood.receiveShadow = true; root.add(wood);
    if (tw) { tw.castShadow = true; root.add(tw); }
  });
}
