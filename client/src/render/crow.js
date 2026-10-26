// A small low-poly crow with animated wings and head (screeches flap/rise).
import * as THREE from 'three';

const black = new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.55, metalness: 0.25 });
const beakMat = new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.6 });
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a10 });

export function makeCrow() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), black); body.scale.set(0.8, 0.8, 1.4); body.position.y = 0.16; g.add(body);
  const head = new THREE.Group(); head.position.set(0, 0.26, 0.12); g.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), black));
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.09, 6), beakMat); beak.rotation.x = Math.PI / 2; beak.position.z = 0.08; head.add(beak);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6), eyeMat); e.position.set(s * 0.035, 0.015, 0.04); head.add(e); }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.01, 0.14), black); tail.position.set(0, 0.15, -0.18); tail.rotation.x = -0.3; g.add(tail);
  const wings = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.07, 0.2, 0); g.add(pivot);
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.01, 0.14), black); w.position.x = s * 0.1; pivot.add(w);
    wings.push({ pivot, s });
  }
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.08), beakMat); leg.position.set(s * 0.03, 0.04, 0); g.add(leg); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { head, wings, body, baseY: 0, phase: Math.random() * 10 };
  return g;
}

// screech: 0..1 intensity (recent screech) — crows flap and lift.
export function animateCrow(crow, t, screech) {
  const u = crow.userData;
  u.head.rotation.y = Math.sin(t * 0.7 + u.phase) * 0.8 + (Math.sin(t * 3.1 + u.phase) > 0.97 ? 0.6 : 0);
  u.head.rotation.x = screech > 0 ? -0.6 : Math.sin(t * 0.5 + u.phase) * 0.15;
  const flap = screech > 0 ? Math.sin(t * 30) * 1.1 : 0;
  for (const w of u.wings) w.pivot.rotation.z = w.s * (flap + (screech > 0 ? 0.4 : 0));
  crow.position.y = (crow.userData.baseY0 ??= crow.position.y) + screech * 0.6 * Math.abs(Math.sin(t * 6));
}
