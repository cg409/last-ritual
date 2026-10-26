// Interactive objects: sculpted tombs (sarcophagus, stone cross, rune circle, cracks), wooden gallows,
// crows on the bollards, lamps and the exit gate.
import * as THREE from 'three';
import { pbr } from './assets.js';
import { makeRune } from './textures.js';
import { makeCrow } from './crow.js';
import { buildLamps, buildDoor } from './landmarks.js';
import { vlight } from './lights.js';
import { sh, uvBox } from './buildingParts.js';

function sarcophagus(stone) {
  const g = new THREE.Group();
  // stepped plinth
  const p1 = sh(new THREE.Mesh(uvBox(2.6, 0.25, 1.7, 1), stone)); p1.position.y = 0.12; g.add(p1);
  const p2 = sh(new THREE.Mesh(uvBox(2.35, 0.15, 1.45, 1), stone)); p2.position.y = 0.32; g.add(p2);
  // body with bevelled edges (extruded rounded rectangle)
  const s = new THREE.Shape(), w = 1.0, d = 0.6, r = 0.12;
  s.moveTo(-w + r, -d); s.lineTo(w - r, -d); s.quadraticCurveTo(w, -d, w, -d + r); s.lineTo(w, d - r); s.quadraticCurveTo(w, d, w - r, d);
  s.lineTo(-w + r, d); s.quadraticCurveTo(-w, d, -w, d - r); s.lineTo(-w, -d + r); s.quadraticCurveTo(-w, -d, -w + r, -d);
  const body = sh(new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 }), stone));
  body.rotation.x = -Math.PI / 2; body.position.y = 0.4; g.add(body);
  // gabled lid
  const lid = new THREE.Group(); lid.position.y = 1.04; g.add(lid);
  const ls = new THREE.Shape(); ls.moveTo(-0.7, 0); ls.lineTo(0.7, 0); ls.lineTo(0.55, 0.12); ls.lineTo(0, 0.24); ls.lineTo(-0.55, 0.12); ls.lineTo(-0.7, 0);
  const lidM = sh(new THREE.Mesh(new THREE.ExtrudeGeometry(ls, { depth: 2.25, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02 }), stone));
  lidM.rotation.y = Math.PI / 2; lidM.position.x = -1.12; lid.add(lidM);
  // headstone cross (bevelled)
  const cs = new THREE.Shape(); const a = 0.07, b = 0.25;
  cs.moveTo(-a, 0); cs.lineTo(a, 0); cs.lineTo(a, 0.7); cs.lineTo(b, 0.7); cs.lineTo(b, 0.84); cs.lineTo(a, 0.84); cs.lineTo(a, 1.1); cs.lineTo(-a, 1.1); cs.lineTo(-a, 0.84); cs.lineTo(-b, 0.84); cs.lineTo(-b, 0.7); cs.lineTo(-a, 0.7); cs.lineTo(-a, 0);
  const cross = sh(new THREE.Mesh(new THREE.ExtrudeGeometry(cs, { depth: 0.12, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015 }), stone));
  cross.position.set(-1.0, 1.05, -0.06); cross.rotation.y = Math.PI / 2; g.add(cross);
  return { g, lid, cross };
}

export function buildObjects(scene, map) {
  const stone = pbr('castle_wall_slates', 1, { color: 0x8a8a88 });
  const wood = pbr('dark_wooden_planks', 1, { color: 0x8a7a6a });
  const runeTex = makeRune();
  const out = { tombs: [], hooks: [], towers: [] };

  for (const t of map.tombs) {
    const { g, lid, cross } = sarcophagus(stone);
    g.position.set(t.x, 0, t.z); g.rotation.y = t.rot;
    const runeMat = new THREE.MeshBasicMaterial({ map: runeTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xb070ff });
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), runeMat); rune.rotation.x = -Math.PI / 2; rune.position.y = 0.04; g.add(rune);
    const light = vlight(0x9a50ff, 0, 6, 2); light.position.y = 1.6; g.add(light);
    const shards = [];
    for (let i = 0; i < 6; i++) {
      const sd = sh(new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + Math.random() * 0.1, 0), stone));
      sd.position.set((Math.random() - 0.5) * 2.8, 0.08, (Math.random() - 0.5) * 2.2); sd.visible = false; g.add(sd); shards.push(sd);
    }
    scene.add(g);
    out.tombs.push({ g, lid, cross, arm: cross, rune, runeMat, light, shards });
  }

  for (const h of map.hooks) { // rough-hewn gallows with a noose
    const g = new THREE.Group(); g.position.set(h.x, 0, h.z); g.rotation.y = h.rot;
    const post = sh(new THREE.Mesh(uvBox(0.24, 3.5, 0.24, 1), wood)); post.position.y = 1.75; post.rotation.z = 0.02; g.add(post);
    const beam = sh(new THREE.Mesh(uvBox(1.5, 0.2, 0.2, 1), wood)); beam.position.set(0.62, 3.35, 0); g.add(beam);
    const brace = sh(new THREE.Mesh(uvBox(0.14, 1.0, 0.14, 1), wood)); brace.position.set(0.28, 2.95, 0); brace.rotation.z = 0.8; g.add(brace);
    const base = sh(new THREE.Mesh(uvBox(0.9, 0.18, 0.9, 1), wood)); base.position.y = 0.09; g.add(base);
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x6a5838, roughness: 1 });
    const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(1.15, 3.3, 0), new THREE.Vector3(1.16, 2.8, 0.02), new THREE.Vector3(1.15, 2.35, 0)]), 8, 0.018, 6), ropeMat); g.add(rope);
    const noose = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 8, 16), ropeMat); noose.position.set(1.15, 2.22, 0); g.add(noose);
    scene.add(g);
    out.hooks.push({ g });
  }

  for (const t of map.towers) { // one realistic crow per bollard
    const g = new THREE.Group(); g.position.set(t.x, 0, t.z);
    const crow = makeCrow(); crow.position.set(0, 1.6, 0); crow.rotation.y = t.crows[0].a; g.add(crow);
    scene.add(g);
    out.towers.push({ g, crows: [crow], h: t.h, id: t.id });
  }
  out.lamps = buildLamps(scene, map);
  out.door = buildDoor(scene, map.exit, pbr('mossy_stone_wall', 1));
  return out;
}
