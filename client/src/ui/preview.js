// Small rotating 3D preview of the selected survivor skin (and monster) in the lobby.
import * as THREE from 'three';
import { Character } from '../render/characters.js';

export class Preview {
  constructor() { this.canvas = null; this.renderer = null; this.key = ''; }

  attach(canvas, skin, monster) {
    if (!canvas) return;
    if (!this.renderer || this.canvas !== canvas) {
      this.renderer?.dispose();
      this.canvas = canvas;
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(30, 2, 0.1, 50);
      this.camera.position.set(0, 1.3, 6.2); this.camera.lookAt(0, 1.0, 0);
      this.scene.add(new THREE.HemisphereLight(0x8090b0, 0x100808, 0.8));
      const key = new THREE.SpotLight(0xffb070, 30, 12, 0.6, 0.6); key.position.set(2, 4, 3); this.scene.add(key);
      const rim = new THREE.PointLight(0xc02020, 12, 8); rim.position.set(-2, 2, -2); this.scene.add(rim);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(2, 32), new THREE.MeshStandardMaterial({ color: 0x120c0c, roughness: 1 }));
      floor.rotation.x = -Math.PI / 2; this.scene.add(floor);
      this.key = '';
    }
    const k = `${skin}|${monster}`;
    if (k !== this.key) {
      this.key = k;
      for (const c of [this.surv, this.mon]) c?.dispose();
      this.surv = new Character({ id: 'pv', role: 'survivor', skin });
      this.mon = new Character({ id: 'pm', role: 'monster', skin, monster });
      this.surv.root.position.x = -0.9; this.mon.root.position.x = 0.95;
      this.scene.add(this.surv.root, this.mon.root);
    }
    const w = canvas.clientWidth, h = canvas.clientHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (!this.loop) {
      let last = performance.now();
      const tick = () => {
        if (!this.canvas?.isConnected) { this.loop = null; return; }
        const t = performance.now(), dt = (t - last) / 1000; last = t;
        const st = { speed: 0, state: 'alive' };
        this.surv.update(dt, st); this.mon.update(dt, { ...st, role: 'monster' });
        this.surv.root.rotation.y += dt * 0.4; this.mon.root.rotation.y = -0.4 + Math.sin(t / 2000) * 0.3;
        this.renderer.render(this.scene, this.camera);
        this.loop = requestAnimationFrame(tick);
      };
      this.loop = requestAnimationFrame(tick);
    }
  }
}
