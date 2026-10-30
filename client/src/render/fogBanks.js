// Visible fog banks: low, wispy layers of mist drifting inside each fog patch (shared/fog.js).
// Each wisp is a soft, noisy (fractal-noise) cloud card — no hard round edges — with its own slow
// drift and turn, fading out as you walk into it (so it never looks like a flat card in your face).
import * as THREE from 'three';
import { terrainY } from '@shared/levels.js';
import { graphics } from '../settings.js';

// fractal value noise → a ragged, see-through wisp
function wispTexture(seed) {
  const N = 128, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), img = x.createImageData(N, N);
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const grids = [4, 8, 16, 32].map((g) => Array.from({ length: (g + 1) * (g + 1) }, r));
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise = (u, v, gi) => {
    const g = [4, 8, 16, 32][gi], G = grids[gi], fx = u * g, fy = v * g, ix = Math.floor(fx), iy = Math.floor(fy), tx = smooth(fx - ix), ty = smooth(fy - iy);
    const at = (a, b) => G[Math.min(g, b) * (g + 1) + Math.min(g, a)];
    return (at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx) * (1 - ty) + (at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx) * ty;
  };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / N, v = j / N;
    const n = noise(u, v, 0) * 0.5 + noise(u, v, 1) * 0.27 + noise(u, v, 2) * 0.15 + noise(u, v, 3) * 0.08;
    const dx = (u - 0.5) * 2, dy = (v - 0.5) * 2.6, fall = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
    const a = Math.max(0, n - 0.35) * 1.9 * fall * fall;
    const k = (j * N + i) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.min(255, a * 255);
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let TEX = null;
export class FogBanks {
  constructor(root, fog, map) {
    this.fog = fog;
    TEX ||= [wispTexture(7), wispTexture(1234), wispTexture(98765)];
    this.group = new THREE.Group(); root.add(this.group);
    const per = graphics().noPost ? 6 : 22; // fewer wisps on weak machines (they cost fill-rate)
    this.banks = fog.patches(0).map(() => Array.from({ length: per }, (_, k) => {
      const mat = new THREE.SpriteMaterial({ map: TEX[k % 3], color: 0x9aa4b0, transparent: true, opacity: 0, depthWrite: false, rotation: Math.random() * 6.28 });
      const s = new THREE.Sprite(mat);
      s.userData = { a: Math.random() * Math.PI * 2, rr: Math.sqrt(Math.random()), y: 0.25 + Math.random() * 1.3, sc: 5 + Math.random() * 6,
        sp: (Math.random() - 0.5) * 0.04, rot: (Math.random() - 0.5) * 0.03, w: 0.6 + Math.random() * 0.4 };
      s.renderOrder = 2; this.group.add(s); return s;
    }));
    this._p = new THREE.Vector3();
  }
  update(t, dark = 0, cam = null, dt = 0.016) {
    this.fog.patches(t).forEach((p, i) => {
      for (const s of this.banks[i]) {
        const u = s.userData;
        if (p.k <= 0.01) { s.visible = false; continue; }
        const a = u.a + t * u.sp, r = u.rr * p.r * 0.8;
        const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
        if (this.fog.indoors(x, z) || this.fog.indoors(x + 2, z) || this.fog.indoors(x - 2, z)) { s.visible = false; continue; }
        s.visible = true;
        s.position.set(x, terrainY(x, z) + u.y, z);
        s.scale.set(u.sc * 1.8, u.sc * 0.7, 1);
        s.material.rotation += u.rot * dt;
        // thicker toward the bank's heart; fades away as you walk into a wisp
        const edge = 1 - u.rr * u.rr * 0.6;
        const near = cam ? Math.min(1, Math.max(0, (Math.hypot(cam.x - x, cam.z - z) - 2) / 6)) : 1;
        s.material.opacity = p.k * 0.16 * u.w * edge * near * (1 - dark * 0.7);
      }
    });
  }
}
