// Animated 3D backdrop for menus: the mansion façade in fog, dead trees, scanned rocks/ferns/statue,
// a gallows with a hanged figure, the monster with a lantern, a crow on a bollard, drifting camera, lightning.
import * as THREE from 'three';
import { Character } from './characters.js';
import { makeCrow, animateCrow } from './crow.js';
import { vlight } from './lights.js';
import { pbr, instanceModel } from './assets.js';
import { buildBuildings } from './buildings.js';
import { buildTrees } from './trees.js';
import { makeBuilding } from '@shared/buildings.js';
import { sh, uvBox } from './buildingParts.js';

export class MenuScene {
  constructor(stage) {
    this.stage = stage; this.t = 0;
    const g = (this.root = new THREE.Group());
    stage.scene.add(g);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), pbr('forest_ground_04', 30, { color: 0x6a6a6a }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);
    const house = makeBuilding({ id: 'menu', type: 'mansion', x: 0, z: -22, w: 19.2, d: 12, floors: 2,
      sides: { n: 'WWWWWWWW', s: 'WOWODOWOW', e: 'WOWOW', w: 'WOWOW' }, porch: { side: 's', w: 7.2, d: 2.6 } });
    buildBuildings(g, { buildings: [house] });
    const trees = [];
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() - 0.5) * 70, z = -6 - Math.random() * 40;
      if (Math.abs(x) < 12 && z < -12 && z > -32) continue;
      trees.push({ x, z, r: 0.3 + Math.random() * 0.25, h: 9 + Math.random() * 6, v: i % 6, type: 'tree' });
    }
    buildTrees(g, { circles: trees });
    g.add(instanceModel('rock_moss_set_01', [{ x: -8, z: -7, rot: 0.6, s: 0.7 }]));
    g.add(instanceModel('fern_02', Array.from({ length: 20 }, () => ({ x: (Math.random() - 0.5) * 20, z: -2 - Math.random() * 10, rot: Math.random() * 6, s: 1 })), { tint: 0x6a6a58 }));
    g.add(instanceModel('gothic_statue', [{ x: 6.5, z: -9, rot: -0.6, s: 1 }]));
    const wood = pbr('dark_wooden_planks', 1, { color: 0x8a7a6a });
    const post = sh(new THREE.Mesh(uvBox(0.25, 4, 0.25, 1), wood)); post.position.set(3.4, 2, -5); g.add(post);
    const beam = sh(new THREE.Mesh(uvBox(1.8, 0.2, 0.2, 1), wood)); beam.position.set(2.6, 3.9, -5); g.add(beam);
    this.hanged = new Character({ id: 'h', role: 'survivor', skin: 'drifter' });
    this.hanged.root.position.set(1.9, 0, -5); g.add(this.hanged.root);
    this.monster = new Character({ id: 'm', role: 'monster', monster: 'mimic', skin: 'warden' });
    this.monster.root.position.set(-2.6, 0, -6.5); this.monster.root.rotation.y = 0.5; g.add(this.monster.root);
    const prof = [[0.42, 0], [0.34, 0.18], [0.3, 1.25], [0.36, 1.45], [0, 1.6]].map(([r, y]) => new THREE.Vector2(r, y));
    const bol = sh(new THREE.Mesh(new THREE.LatheGeometry(prof, 12), pbr('mossy_stone_wall', 1))); bol.position.set(-5, 0, -4); g.add(bol);
    this.crow = makeCrow(); this.crow.position.set(-5, 1.6, -4); this.crow.rotation.y = 0.8; g.add(this.crow);
    this.redLight = vlight(0xff2a10, 3, 10, 2); this.redLight.position.set(-2.3, 1.6, -6); g.add(this.redLight);
    this.nextBolt = 6;
  }

  show(v) { this.root.visible = v; }

  update(dt) {
    if (!this.root.visible) return;
    this.t += dt;
    const t = this.t, cam = this.stage.camera;
    cam.position.set(Math.sin(t * 0.05) * 2.5, 1.7 + Math.sin(t * 0.13) * 0.15, 5 + Math.cos(t * 0.05) * 0.8);
    cam.lookAt(0, 2.2, -10);
    this.hanged.update(dt, { speed: 0, state: 'hooked' });
    this.hanged.root.rotation.y = Math.sin(t * 0.6) * 0.25;
    this.monster.update(dt, { speed: 0, state: 'alive', role: 'monster' });
    animateCrow(this.crow, t, 0, dt);
    this.redLight.intensity = 3 + Math.sin(t * 9) * 0.6 + Math.sin(t * 23) * 0.4;
    this.nextBolt -= dt;
    let flash = 0;
    if (this.nextBolt < 0) { this.nextBolt = 7 + Math.random() * 9; this.boltT = 0.5; }
    if (this.boltT > 0) { this.boltT -= dt; flash = Math.random() < 0.6 ? this.boltT * 2 : 0; }
    const st = this.stage;
    st.renderer.toneMappingExposure = st.baseExposure + flash * 1.5;
    st.scene.fog.density = 0.05;
    st.scene.fog.color.copy(st.fogColor); st.scene.background.copy(st.fogColor);
    st.moon.intensity = st.baseMoon; st.hemi.intensity = st.baseHemi; st.sky.setDark(0);
    st.follow(new THREE.Vector3(0, 0, -6), t);
  }
}
