// Realistic crow: sculpted perched body (lathe profile + layered feather cards + curved beak, claws),
// and an animated flying crow (morph-target bird model, re-skinned glossy black) that takes off on screech.
import * as THREE from 'three';
import { makeGltfLoader, loadRetry } from './assets.js';

const feather = new THREE.MeshPhysicalMaterial({ color: 0x0c0c10, roughness: 0.38, metalness: 0.1, sheen: 1, sheenColor: new THREE.Color(0x2a3a6a), sheenRoughness: 0.4, side: THREE.DoubleSide });
const beakMat = new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.35 });
const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.05, clearcoat: 1 });
let flyer = null;

export async function loadCrowAssets() {
  try {
    const g = await loadRetry(makeGltfLoader(), `${import.meta.env.BASE_URL}assets/models/crow/Parrot.glb`);
    const mesh = g.scene.getObjectByProperty('isMesh', true);
    mesh.material = new THREE.MeshStandardMaterial({ color: 0x0a0a0d, roughness: 0.45, metalness: 0.1, vertexColors: false });
    flyer = { mesh, clip: g.animations[0] };
  } catch (e) { console.warn('crow flyer not loaded', e); }
}

function featherGeo(len, wid) { // tapered, slightly curved feather blade
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.quadraticCurveTo(wid, len * 0.35, wid * 0.4, len); s.lineTo(-wid * 0.15, len * 0.98); s.quadraticCurveTo(-wid * 0.7, len * 0.4, 0, 0);
  const g = new THREE.ShapeGeometry(s, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, Math.sin((y / len) * Math.PI) * wid * 0.25); }
  g.computeVertexNormals();
  return g;
}

export function makeCrow() {
  const g = new THREE.Group();
  // Body: lathe profile (tail-end to chest) rotated to lie horizontally
  const prof = [[0, -0.16], [0.035, -0.13], [0.065, -0.07], [0.078, 0], [0.072, 0.06], [0.055, 0.1], [0, 0.12]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 18), feather);
  body.rotation.x = Math.PI / 2 - 0.45; body.position.set(0, 0.17, 0); body.scale.set(1, 1, 0.9); g.add(body);
  // Head + neck ruff
  const head = new THREE.Group(); head.position.set(0, 0.255, 0.085); g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.045, 18, 14), feather); skull.scale.set(0.9, 0.95, 1.1); head.add(skull);
  // Curved heavy beak (lathe, bent)
  const bp = [[0.0, 0], [0.017, 0.005], [0.014, 0.03], [0.008, 0.055], [0, 0.075]].map(([r, y]) => new THREE.Vector2(r, y));
  const beakGeo = new THREE.LatheGeometry(bp, 10); const pp = beakGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) { const y = pp.getY(i); pp.setZ(i, pp.getZ(i) - y * y * 2.2); pp.setX(i, pp.getX(i) * 0.75); }
  beakGeo.computeVertexNormals();
  const beak = new THREE.Mesh(beakGeo, beakMat); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.004, 0.035); head.add(beak);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), eyeMat); e.position.set(s * 0.03, 0.012, 0.025); head.add(e); }
  // Folded wings: layered feather cards
  const fg = featherGeo(0.2, 0.04), wings = [];
  for (const s of [-1, 1]) {
    const wing = new THREE.Group(); wing.position.set(s * 0.06, 0.2, 0.04); g.add(wing);
    for (let i = 0; i < 7; i++) {
      const f = new THREE.Mesh(fg, feather);
      f.rotation.set(-Math.PI / 2 + 0.35, 0, s * (0.08 + i * 0.035)); f.position.set(s * 0.004 * i, -i * 0.006, -i * 0.012);
      f.scale.setScalar(0.85 + i * 0.05); wing.add(f);
    }
    wings.push({ pivot: wing, s });
  }
  // Tail fan
  const tg = featherGeo(0.16, 0.03);
  for (let i = -2; i <= 2; i++) { const f = new THREE.Mesh(tg, feather); f.rotation.set(-Math.PI / 2 - 0.35, 0, i * 0.12 + Math.PI); f.position.set(0, 0.13, -0.12); g.add(f); }
  // Legs & claws
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.09, 6), beakMat); leg.position.set(s * 0.025, 0.06, 0.01); g.add(leg);
    for (let k = -1; k <= 1; k++) { const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.002, 0.04, 5), beakMat); toe.rotation.set(Math.PI / 2, 0, k * 0.4); toe.position.set(s * 0.025 + k * 0.006, 0.015, 0.03); g.add(toe); }
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar(1.6); // large raven-sized bird
  g.userData = { head, wings, body, phase: Math.random() * 10, flight: null };
  return g;
}

// Idle: head twitches & looks around. Screech: beak up, wings flare; a flying crow bursts away.
export function animateCrow(crow, t, screech, dt = 0.016) {
  const u = crow.userData;
  const twitch = Math.sin(t * 3.1 + u.phase) > 0.96 ? 0.7 : 0;
  u.head.rotation.y = Math.sin(t * 0.6 + u.phase) * 0.9 + twitch;
  u.head.rotation.x = screech > 0 ? -0.7 : Math.sin(t * 0.45 + u.phase) * 0.18;
  for (const w of u.wings) w.pivot.rotation.z = w.s * (screech > 0 ? 0.6 + Math.sin(t * 28) * 0.4 : 0);
  if (screech > 0.95 && !u.flight && flyer && crow.parent) launchFlyer(crow);
  if (u.flight) {
    const f = u.flight; f.t += dt; f.mixer.update(dt);
    f.obj.position.addScaledVector(f.vel, dt); f.vel.y += dt * 0.6;
    if (f.t > 6) { f.obj.removeFromParent(); u.flight = null; }
  }
}

function launchFlyer(crow) {
  const obj = flyer.mesh.clone(); obj.scale.setScalar(0.012); obj.castShadow = true;
  const wp = new THREE.Vector3(); crow.getWorldPosition(wp);
  const a = Math.random() * Math.PI * 2;
  obj.position.copy(wp).add(new THREE.Vector3(0, 0.4, 0)); obj.rotation.y = a;
  crow.parent.parent?.add(obj) ?? crow.parent.add(obj);
  const mixer = new THREE.AnimationMixer(obj); mixer.clipAction(flyer.clip).setDuration(0.5).play();
  crow.userData.flight = { obj, mixer, t: 0, vel: new THREE.Vector3(Math.sin(a) * 5, 2.5, Math.cos(a) * 5) };
}
