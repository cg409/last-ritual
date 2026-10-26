// Animated 3D backdrop for menus: fog-drowned graveyard, a gallows with a hanged figure,
// a monster silhouette with a glowing lantern, crows, slow camera drift and lightning.
import * as THREE from 'three';
import { Character } from './characters.js';
import { makeCrow, animateCrow } from './crow.js';
import { makeStone, makeGround, makeBark } from './textures.js';
import { vlight } from './lights.js';

export class MenuScene {
  constructor(stage) {
    this.stage = stage; this.t = 0;
    const g = (this.root = new THREE.Group());
    stage.scene.add(g);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: makeGround(), roughness: 1, color: 0x8a8070 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);
    const stone = new THREE.MeshStandardMaterial({ map: makeStone(), roughness: 0.9 });
    for (let i = 0; i < 22; i++) { // gravestones
      const h = 0.7 + Math.random() * 0.7;
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.6, h, 0.15), stone);
      const x = (Math.random() - 0.5) * 18, z = -2 - Math.random() * 14;
      s.position.set(x, h / 2 - 0.05, z); s.rotation.set((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.2);
      s.castShadow = s.receiveShadow = true; g.add(s);
    }
    const bark = new THREE.MeshStandardMaterial({ map: makeBark(), roughness: 1, color: 0x8a7a6a });
    for (let i = 0; i < 14; i++) { // dead trees
      const h = 7 + Math.random() * 5;
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.4, h, 7), bark);
      tr.position.set((Math.random() - 0.5) * 34, h / 2, -8 - Math.random() * 16); tr.castShadow = true; g.add(tr);
      for (let k = 0; k < 4; k++) {
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 2.5, 5), bark);
        br.position.set(tr.position.x, h * (0.5 + Math.random() * 0.4), tr.position.z); br.rotation.set(0.8, Math.random() * 6, 0.6); g.add(br);
      }
    }
    // Gallows + hanged survivor
    const wood = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 });
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4, 0.25), wood); post.position.set(3.4, 2, -5); g.add(post);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 0.2), wood); beam.position.set(2.6, 3.9, -5); g.add(beam);
    this.hanged = new Character({ id: 'h', role: 'survivor', skin: 'drifter' });
    this.hanged.root.position.set(1.9, 0, -5); g.add(this.hanged.root);
    // Monster with lantern in the fog
    this.monster = new Character({ id: 'm', role: 'monster', monster: 'mimic', skin: 'warden' });
    this.monster.root.position.set(-2.6, 0, -6.5); this.monster.root.rotation.y = 0.5; g.add(this.monster.root);
    this.crows = [];
    for (let i = 0; i < 3; i++) { const c = makeCrow(); c.position.set(2.1 + i * 0.4, 4.0, -5); c.rotation.y = Math.random() * 6; g.add(c); this.crows.push(c); }
    this.redLight = vlight(0xff2a10, 3, 10, 2); this.redLight.position.set(-2.3, 1.6, -6); g.add(this.redLight);
    this.nextBolt = 6;
  }

  show(v) { this.root.visible = v; this.stage.pool.enabled = true; }

  update(dt) {
    if (!this.root.visible) return;
    this.t += dt;
    const t = this.t, cam = this.stage.camera;
    cam.position.set(Math.sin(t * 0.05) * 2.5, 1.7 + Math.sin(t * 0.13) * 0.15, 5 + Math.cos(t * 0.05) * 0.8);
    cam.lookAt(0, 1.6, -6);
    this.hanged.update(dt, { speed: 0, state: 'hooked' });
    this.hanged.root.rotation.y = Math.sin(t * 0.6) * 0.25;
    this.monster.update(dt, { speed: 0, state: 'alive', role: 'monster' });
    this.crows.forEach((c) => animateCrow(c, t, 0));
    this.redLight.intensity = 3 + Math.sin(t * 9) * 0.6 + Math.sin(t * 23) * 0.4;
    this.nextBolt -= dt;
    let flash = 0;
    if (this.nextBolt < 0) { this.nextBolt = 7 + Math.random() * 9; this.boltT = 0.5; }
    if (this.boltT > 0) { this.boltT -= dt; flash = Math.random() < 0.6 ? this.boltT * 2 : 0; }
    const st = this.stage;
    st.renderer.toneMappingExposure = st.baseExposure + flash * 1.5;
    st.scene.fog.density = 0.055;
    st.scene.fog.color.copy(st.fogColor); st.scene.background.copy(st.fogColor);
    st.moon.intensity = st.baseMoon; st.hemi.intensity = st.baseHemi;
    this.stage.follow(new THREE.Vector3(0, 0, -5), t);
  }
}
