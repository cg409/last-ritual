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
const MS = { x: -13, z: -2.5 }; // the monster's dais (loadout screen): a darker corner of the clearing, away from the survivors' circle
const ease = (k) => k * k * (3 - 2 * k);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _w2 = new THREE.Vector3(), _w3 = new THREE.Vector3();

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
      if (Math.hypot(x - MS.x, z - MS.z) < 6.5) continue; // (kept clear for the monster's dais)
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
    // The monster's dais: a wide stone platform ringed by guttering candles, boulders behind it and a blood-red glow.
    const mg = (this.monGroup = new THREE.Group()); mg.visible = false; g.add(mg);
    const dais = sh(new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, 0.22, 28), stone)); dais.position.set(MS.x, 0.11, MS.z); mg.add(dais);
    const sigil = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.62, 48), new THREE.MeshBasicMaterial({ color: 0x8a1212, transparent: true, opacity: 0.7, depthWrite: false }));
    sigil.rotation.x = -Math.PI / 2; sigil.position.set(MS.x, 0.03, MS.z); mg.add(sigil);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3, c = makeCandle(i % 3 === 0); c.position.set(MS.x + Math.cos(a) * 1.9, 0.0, MS.z + Math.sin(a) * 1.9); c.scale.setScalar(1.7); mg.add(c);
    }
    mg.add(instanceModel('boulder_01', Array.from({ length: 7 }, (_, i) => { const a = Math.PI * (0.15 + (i / 6) * 0.7); return { x: MS.x + Math.cos(a) * 5.2, z: MS.z - Math.sin(a) * 4.2 - 0.8, rot: i * 1.7, s: 1.2 + (i % 3) * 0.3 }; })));
    mg.add(instanceModel('dry_branches_medium_01', Array.from({ length: 8 }, (_, i) => ({ x: MS.x + (i - 3.5) * 1.1, z: MS.z - 1.5 - (i % 3) * 0.7, rot: i * 2.1, s: 1 }))));
    this.monLight2 = vlight(0xff2a10, 3.2, 7, 2); this.monLight2.position.set(MS.x, 1.4, MS.z + 1.4); mg.add(this.monLight2);
    const mrim = vlight(0xb01010, 5, 9, 1.6); mrim.position.set(MS.x + 0.5, 2.4, MS.z - 2.6); mg.add(mrim);
    const mkey = vlight(0xffa060, 4.5, 10, 1.6); mkey.position.set(MS.x + 1.5, 2.6, MS.z + 3.4); mg.add(mkey);
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

  // Loadout screen: 'player' (the survivor, on the right, menu on the left) or 'monster' (the monster on its dais, on the left,
  // menu on the right). The camera glides between the two places. shiftPx = half the menu's width.
  setLoadoutView(view, shiftPx = 0) {
    this.lview = view; this.shiftPx = shiftPx;
    if (view) { this.lk = this.lk ?? (view === 'monster' ? 1 : 0); this.monGroup.visible = true; }
    else { this.lk = null; this.monGroup.visible = false; this.mch?.dispose(); this.mch = null; this.mkey = ''; }
  }
  setLoadoutMonster(monster, weapon) {
    const key = monster + '|' + weapon;
    if (key === this.mkey) return; this.mkey = key;
    this.mch?.dispose(); this.mch = null;
    this.mch = new Character({ id: 'loadout-mon', role: 'monster', monster, weapon });
    this.mch.root.position.set(MS.x, 0.22, MS.z); this.mch.root.rotation.y = Math.PI - 0.35; // turned a little towards the menu
    this.monGroup.add(this.mch.root);
  }

  show(v) {
    if (this.active && !v) { this.setLoadoutView(null); this.stage.camera.clearViewOffset(); this.rightInset = 0; this.inset = 0; this.setSolo(false); }
    this.active = v; this.root.visible = v;
    if (!v) for (const s of this.slots) { s.ch?.dispose(); s.ch = null; s.trapObj?.removeFromParent(); s.trapObj = null; s.key = ''; }
  }

  // list[i] = { skin, monster, showMonster } or null for an empty seat.
  setLineup(list) {
    this.slots.forEach((s, i) => {
      const it = list[i];
      const key = it ? (it.trap ? `t:${it.trap}` : it.showMonster ? `m:${it.monster}:${it.weapon}` : `s:${it.skin}`) : '';
      if (key === s.key) return;
      s.ch?.dispose(); s.ch = null; s.key = key;
      s.trapObj?.removeFromParent(); s.trapObj = null;
      if (!it) return;
      if (it.trap) { // trap preview: the trap laid on the plinth, slowly turning
        s.trapObj = makeTrap(it.trap); s.trapObj.scale.setScalar(1.6); s.trapObj.position.set(s.x, 0.15, s.z); this.root.add(s.trapObj);
        s.monster = false;
        return;
      }
      s.ch = new Character({ id: 'lobby' + i, role: it.showMonster ? 'monster' : 'survivor', monster: it.monster, skin: it.skin, weapon: it.showMonster ? it.weapon : null });
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
    if (this.lview) { // loadout: own offset (see below)
      this.lk += ((this.lview === 'monster' ? 1 : 0) - this.lk) * Math.min(1, dt * 2.4);
      cam.setViewOffset(W, H, (this.lk * 2 - 1) * (this.shiftPx || 0), 0, W, H);
    } else cam.setViewOffset(W, H, -(side - this.inset) / 2, 0, W, H);
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * (W / H);
    const d = THREE.MathUtils.clamp((3.5 * W) / (tanH * free), 4.4, 16);
    if (this.lview) {
      const k = ease(Math.min(1, Math.max(0, this.lk))), sl = this.slots[0];
      const a = _v.set(ORIGIN.x + sl.x + Math.sin(t * 0.2) * 0.25, 1.15 + Math.sin(t * 0.11) * 0.03, ORIGIN.z + sl.z + 3.3);
      const b = _w.set(ORIGIN.x + MS.x + Math.sin(t * 0.17) * 0.3, 1.5 + Math.sin(t * 0.11) * 0.04, ORIGIN.z + MS.z + 4.3);
      cam.position.lerpVectors(a, b, k); cam.position.y += Math.sin(k * Math.PI) * 0.35; // a little crane move on the way
      _w2.set(ORIGIN.x + sl.x, 0.98, ORIGIN.z + sl.z).lerp(_w3.set(ORIGIN.x + MS.x, 1.2, ORIGIN.z + MS.z), k);
      cam.lookAt(_w2);
    } else if (this.solo != null) { // one big character: fill the free area
      const s = this.slots[this.solo], dd = THREE.MathUtils.clamp((0.9 * W) / (tanH * free), 2.2, 6);
      cam.position.set(ORIGIN.x + s.x + Math.sin(t * 0.2) * 0.25, 1.15 + Math.sin(t * 0.11) * 0.03, ORIGIN.z + s.z + dd);
      cam.lookAt(ORIGIN.x + s.x, 0.98, ORIGIN.z + s.z);
    } else {
      cam.position.set(ORIGIN.x + Math.sin(t * 0.07) * 0.12, 1.2 + d * 0.025 + Math.sin(t * 0.11) * 0.04, ORIGIN.z + d - 0.3);
      cam.lookAt(ORIGIN.x, 1.15, ORIGIN.z - 0.3);
    }
    for (const s of this.slots) if (s.ch) s.ch.update(dt, { speed: 0, state: 'alive', role: s.monster ? 'monster' : 'survivor' });
    for (const s of this.slots) if (s.trapObj) s.trapObj.rotation.y += dt * 0.5;
    if (this.mch) { this.mch.update(dt, { speed: 0, state: 'alive', role: 'monster' }); this.monLight2.intensity = 3.2 + Math.sin(t * 9) * 0.5; }
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
    st.scene.fog.density = 0.062; st.sky.ring.visible = false;
    st.scene.fog.color.copy(st.fogColor); st.scene.background.copy(st.fogColor);
    st.moon.intensity = st.baseMoon; st.hemi.intensity = st.baseHemi; st.ambient.intensity = 0.3; st.sky.setDark(0);
    st.follow(_v.set(ORIGIN.x, 0, ORIGIN.z), t);
  }
}
