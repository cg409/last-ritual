// 3D lobby backdrop: the five souls of the match stand in a shallow arc on stone plinths inside a
// ritual circle of candles and standing stones, in a foggy dead forest. Each figure wears its chosen
// survivor outfit; while you browse monsters your own plinth shows the monster instead.
// Drawn with the main Stage (same fog / bloom / grading as the game). The lineup sits right of
// centre so the participants panel on the left never covers it.
import * as THREE from 'three';
import { Character } from './characters.js';
import { vlight } from './lights.js';
import { pbr, instanceModel } from './assets.js';
import { buildTrees } from './trees.js';
import { makeCandle } from './items.js';
import { makeTrap } from './effects.js';
import { sh } from './buildingParts.js';

const ORIGIN = new THREE.Vector3(0, 0, 400); // far from the menu backdrop
const SPACING = 1.3;
const _v = new THREE.Vector3();

export class LobbyScene {
  constructor(stage) {
    this.stage = stage; this.t = 0; this.active = false;
    const g = (this.root = new THREE.Group());
    g.position.copy(ORIGIN); g.visible = false;
    stage.scene.add(g);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), pbr('forest_ground_04', 24, { color: 0x5a5a5a }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);
    // dead forest all around the clearing (open towards the camera)
    const trees = [];
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 26;
      const x = Math.cos(a) * r, z = Math.sin(a) * r - 4;
      if (z > 1 && Math.abs(x) < 9) continue;
      trees.push({ x, z, r: 0.3 + Math.random() * 0.3, h: 9 + Math.random() * 7, v: i % 6, type: 'tree' });
    }
    buildTrees(g, { circles: trees });
    // standing stones in a broken ring behind the lineup, ferns and a statue watching
    const stones = [];
    for (let i = 0; i < 9; i++) { const a = Math.PI * (0.08 + (i / 8) * 0.84); stones.push({ x: Math.cos(a) * 6.2, z: -Math.sin(a) * 4.2 - 1.2, rot: Math.random() * 6, s: 1.1 + Math.random() * 0.7 }); }
    g.add(instanceModel('boulder_01', stones));
    g.add(instanceModel('fern_02', Array.from({ length: 26 }, () => ({ x: (Math.random() - 0.5) * 16, z: -1 - Math.random() * 7, rot: Math.random() * 6, s: 0.9 + Math.random() * 0.5 })), { tint: 0x5a5a4a }));
    g.add(instanceModel('gothic_statue', [{ x: 0, z: -6.5, rot: 0, s: 1.3 }]));
    g.add(instanceModel('dry_branches_medium_01', Array.from({ length: 10 }, () => ({ x: (Math.random() - 0.5) * 12, z: -0.5 - Math.random() * 4, rot: Math.random() * 6, s: 1 }))));
    // ritual circle carved in the earth
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.15, 4.3, 64, 1, Math.PI * 0.05, Math.PI * 0.9),
      new THREE.MeshBasicMaterial({ color: 0x7a1010, transparent: true, opacity: 0.55, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.02, -0.4); g.add(ring);
    const stone = pbr('mossy_stone_wall', 1, { color: 0x8a8a8a });
    this.slots = [];
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * SPACING, z = -((i - 2) ** 2) * 0.16;
      const plinth = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.14, 20), stone));
      plinth.position.set(x, 0.07, z); g.add(plinth);
      const candle = makeCandle(); candle.position.set(x - 0.42, 0.14, z + 0.32); candle.scale.setScalar(1.6); g.add(candle);
      this.slots.push({ x, z, ch: null, key: '', props: [plinth, candle] });
    }
    // warm key light in front, blood-red rim behind
    this.key = vlight(0xffb070, 7, 12, 1.6); this.key.position.set(0.5, 2.6, 3.4); g.add(this.key);
    this.rim = vlight(0xc01818, 5, 10, 1.6); this.rim.position.set(0, 2.2, -3); g.add(this.rim);
    this.monLight = vlight(0xff2a10, 0, 4, 2); g.add(this.monLight);
    this.nextBolt = 5;
  }

  // Solo (the loadout from the main menu): only your own plinth, close up — no empty seats.
  setSolo(on) {
    this.solo = on ? 0 : null;
    this.slots.forEach((s, i) => s.props.forEach((p) => { p.visible = !on || i === 0; }));
  }

  show(v) {
    if (this.active && !v) { this.stage.camera.clearViewOffset(); this.rightInset = 0; this.inset = 0; this.setSolo(false); }
    this.active = v; this.root.visible = v;
    if (!v) for (const s of this.slots) { s.ch?.dispose(); s.ch = null; s.trapObj?.removeFromParent(); s.trapObj = null; s.key = ''; }
  }

  // list[i] = { skin, monster, showMonster } or null for an empty seat.
  setLineup(list) {
    this.slots.forEach((s, i) => {
      const it = list[i];
      const key = it ? (it.trap ? `t:${it.trap}` : it.showMonster ? `m:${it.monster}` : `s:${it.skin}`) : '';
      if (key === s.key) return;
      s.ch?.dispose(); s.ch = null; s.key = key;
      s.trapObj?.removeFromParent(); s.trapObj = null;
      if (!it) return;
      if (it.trap) { // trap preview: the trap laid on the plinth, slowly turning
        s.trapObj = makeTrap(it.trap); s.trapObj.scale.setScalar(1.6); s.trapObj.position.set(s.x, 0.15, s.z); this.root.add(s.trapObj);
        s.monster = false;
        return;
      }
      s.ch = new Character({ id: 'lobby' + i, role: it.showMonster ? 'monster' : 'survivor', monster: it.monster, skin: it.skin });
      s.ch.root.position.set(s.x, 0.14, s.z);
      s.ch.root.rotation.y = Math.PI - (i - 2) * 0.12; // models face -Z: turn to the camera, angled in
      s.monster = !!it.showMonster;
      this.root.add(s.ch.root);
    });
  }

  // Screen positions (CSS px) of the name plates above each figure.
  platePositions(w, h) {
    const cam = this.stage.camera;
    return this.slots.map((s) => {
      if (!s.ch && !s.trapObj) return null;
      _v.set(s.x, s.trapObj ? 0.9 : s.monster ? 2.35 : 2.05, s.z).add(ORIGIN).project(cam);
      return { x: (_v.x * 0.5 + 0.5) * w, y: (-_v.y * 0.5 + 0.5) * h, front: _v.z < 1 };
    });
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const t = this.t, st = this.stage, cam = st.camera;
    // Frame the lineup in the free area right of the participants panel (same width formula as the
    // CSS .lb-side): shift the projection centre there and back off until all five figures fit.
    // rightInset: width of an open picker drawer (set by the lobby UI), eased so the camera glides.
    const W = window.innerWidth, H = window.innerHeight;
    this.inset = (this.inset ?? 0) + ((this.rightInset || 0) - (this.inset ?? 0)) * Math.min(1, dt * 6);
    const side = Math.min(430, Math.max(340, 0.27 * W)), free = Math.max(200, W - side - this.inset - 60);
    cam.setViewOffset(W, H, -(side - this.inset) / 2, 0, W, H);
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * (W / H);
    const d = THREE.MathUtils.clamp((3.5 * W) / (tanH * free), 4.4, 16);
    if (this.solo != null) { // one big character: fill the free area
      const s = this.slots[this.solo], dd = THREE.MathUtils.clamp((0.9 * W) / (tanH * free), 2.2, 6);
      cam.position.set(ORIGIN.x + s.x + Math.sin(t * 0.2) * 0.25, 1.15 + Math.sin(t * 0.11) * 0.03, ORIGIN.z + s.z + dd);
      cam.lookAt(ORIGIN.x + s.x, 0.98, ORIGIN.z + s.z);
    } else {
      cam.position.set(ORIGIN.x + Math.sin(t * 0.07) * 0.12, 1.2 + d * 0.025 + Math.sin(t * 0.11) * 0.04, ORIGIN.z + d - 0.3);
      cam.lookAt(ORIGIN.x, 1.15, ORIGIN.z - 0.3);
    }
    for (const s of this.slots) if (s.ch) s.ch.update(dt, { speed: 0, state: 'alive', role: s.monster ? 'monster' : 'survivor' });
    for (const s of this.slots) if (s.trapObj) s.trapObj.rotation.y += dt * 0.5;
    const mon = this.slots.find((s) => s.monster || s.trapObj);
    this.monLight.intensity = mon ? 2.2 + Math.sin(t * 9) * 0.3 : 0;
    if (mon) this.monLight.position.set(mon.x, mon.trapObj ? 0.9 : 1.4, mon.z + 1.0);
    this.key.intensity = 7 + Math.sin(t * 7.3) * 0.25;
    // distant lightning now and then
    this.nextBolt -= dt;
    let flash = 0;
    if (this.nextBolt < 0) { this.nextBolt = 9 + Math.random() * 10; this.boltT = 0.45; }
    if (this.boltT > 0) { this.boltT -= dt; flash = Math.random() < 0.6 ? this.boltT * 1.6 : 0; }
    st.renderer.toneMappingExposure = st.baseExposure + 0.15 + flash;
    st.scene.fog.density = 0.045;
    st.scene.fog.color.copy(st.fogColor); st.scene.background.copy(st.fogColor);
    st.moon.intensity = st.baseMoon; st.hemi.intensity = st.baseHemi; st.ambient.intensity = 0.3; st.sky.setDark(0);
    st.follow(_v.set(ORIGIN.x, 0, ORIGIN.z), t);
  }
}
