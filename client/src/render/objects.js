// Interactive world objects: tombs, gallows, crow towers. Lamps & exit gate live in landmarks.js.
import * as THREE from 'three';
import { vlight } from './lights.js';
import { makeStone, makeWood, makeRune } from './textures.js';
import { makeCrow } from './crow.js';
import { buildLamps, buildDoor } from './landmarks.js';

export const sh = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

export function buildObjects(scene, map) {
  const sMat = new THREE.MeshStandardMaterial({ map: makeStone(), roughness: 0.9 });
  const wMat = new THREE.MeshStandardMaterial({ map: makeWood(), roughness: 1 });
  const runeTex = makeRune();
  const out = { tombs: [], hooks: [], towers: [] };

  for (const t of map.tombs) {
    const g = new THREE.Group(); g.position.set(t.x, 0, t.z); g.rotation.y = t.rot;
    const base = sh(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 1.6), sMat)); base.position.y = 0.17; g.add(base);
    const body = sh(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 1.2), sMat)); body.position.y = 0.67; g.add(body);
    const lid = sh(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 1.35), sMat)); lid.position.y = 1.07; g.add(lid);
    const cross = sh(new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), sMat)); cross.position.set(-0.8, 1.6, 0); g.add(cross);
    const arm = sh(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.12), sMat)); arm.position.set(-0.8, 1.85, 0); g.add(arm);
    const runeMat = new THREE.MeshBasicMaterial({ map: runeTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xb070ff });
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), runeMat); rune.rotation.x = -Math.PI / 2; rune.position.y = 0.03; g.add(rune);
    const light = vlight(0x9a50ff, 0, 9, 1.5); light.position.y = 1.6; g.add(light);
    const shards = []; // visible fragments as the tomb gets cracked by wrong clicks
    for (let i = 0; i < 6; i++) {
      const s = sh(new THREE.Mesh(new THREE.DodecahedronGeometry(0.12 + Math.random() * 0.1, 0), sMat));
      s.position.set((Math.random() - 0.5) * 2.6, 0.1, (Math.random() - 0.5) * 2); s.visible = false; g.add(s); shards.push(s);
    }
    scene.add(g);
    out.tombs.push({ g, lid, cross, arm, rune, runeMat, light, shards });
  }

  for (const h of map.hooks) { // wooden gallows with a noose
    const g = new THREE.Group(); g.position.set(h.x, 0, h.z); g.rotation.y = h.rot;
    const post = sh(new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.4, 0.22), wMat)); post.position.y = 1.7; g.add(post);
    const beam = sh(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 0.18), wMat)); beam.position.set(0.6, 3.3, 0); g.add(beam);
    const brace = sh(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), wMat)); brace.position.set(0.25, 2.95, 0); brace.rotation.z = 0.8; g.add(brace);
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x8a7550 });
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.0), ropeMat); rope.position.set(1.15, 2.75, 0); g.add(rope);
    const noose = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 12), ropeMat); noose.position.set(1.15, 2.2, 0); g.add(noose);
    scene.add(g);
    out.hooks.push({ g });
  }

  for (const t of map.towers) { // crumbling bell tower, crows on the parapet
    const g = new THREE.Group(); g.position.set(t.x, 0, t.z);
    const shaft = sh(new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.7, t.h, 8), sMat)); shaft.position.y = t.h / 2; g.add(shaft);
    const top = sh(new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.5, 0.5, 8), sMat)); top.position.y = t.h; g.add(top);
    const roof = sh(new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.4, 8), new THREE.MeshStandardMaterial({ color: 0x1a1414, roughness: 0.8 }))); roof.position.y = t.h + 2.2; g.add(roof);
    for (let i = 0; i < 4; i++) {
      const p = sh(new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.6, 0.2), sMat)); const a = i * Math.PI / 2 + Math.PI / 8;
      p.position.set(Math.cos(a) * 1.6, t.h + 1.0, Math.sin(a) * 1.6); g.add(p);
    }
    const crows = t.crows.map((c) => {
      const crow = makeCrow(); crow.position.set(Math.cos(c.a) * 1.75, t.h + 0.25, Math.sin(c.a) * 1.75); crow.rotation.y = -c.a + Math.PI / 2;
      g.add(crow); return crow;
    });
    for (let i = 0; i < 3; i++) {
      const crow = makeCrow(); const a = Math.random() * 6.28; crow.position.set(Math.cos(a) * 3, 0, Math.sin(a) * 3); crow.rotation.y = Math.random() * 6;
      g.add(crow); crows.push(crow);
    }
    scene.add(g);
    out.towers.push({ g, crows, h: t.h, id: t.id });
  }
  out.lamps = buildLamps(scene, map);
  out.door = buildDoor(scene, map.exit, sMat);
  return out;
}
