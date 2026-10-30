// Hiding places: old wooden cupboards (indoors) and grimy plastic porta-potties (outdoors).
// Their doors swing open for a moment when someone climbs in / out or the monster searches them.
import * as THREE from 'three';
import { FLOOR0, FLOOR1, terrainY } from '@shared/levels.js';

let M = null;
function mats() {
  return M ||= {
    wood: new THREE.MeshStandardMaterial({ color: 0x4a3324, roughness: 0.85 }), dark: new THREE.MeshStandardMaterial({ color: 0x241811, roughness: 0.9 }),
    brass: new THREE.MeshStandardMaterial({ color: 0x8a6a2a, roughness: 0.4, metalness: 0.8 }),
    plastic: new THREE.MeshStandardMaterial({ color: 0x2c5a7a, roughness: 0.55 }), roof: new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.6 }),
    grime: new THREE.MeshStandardMaterial({ color: 0x1e3a50, roughness: 0.8 }), inside: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 }),
  };
}
const box = (w, h, d, m, x, y, z, parent) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };

function locker(m) {
  const g = new THREE.Group(), W = 1.0, H = 2.15, D = 0.62;
  box(W, H, 0.04, m.wood, 0, H / 2, -D / 2 + 0.02, g);                       // back
  for (const s of [-1, 1]) box(0.05, H, D, m.wood, s * (W / 2 - 0.025), H / 2, 0, g); // sides
  box(W, 0.06, D, m.wood, 0, H - 0.03, 0, g); box(W, 0.1, D, m.dark, 0, 0.05, 0, g);
  box(W + 0.08, 0.08, D + 0.06, m.wood, 0, H + 0.04, 0, g);                  // cornice
  box(W - 0.1, H - 0.2, D - 0.06, m.inside, 0, H / 2, -0.02, g);            // dark inside
  const doors = [-1, 1].map((s) => {
    const hinge = new THREE.Group(); hinge.position.set(s * (W / 2 - 0.02), 0, D / 2); g.add(hinge);
    const d = box(W / 2 - 0.03, H - 0.16, 0.035, m.wood, -s * (W / 4 - 0.01), H / 2, 0, hinge);
    for (let i = 0; i < 6; i++) box(W / 2 - 0.12, 0.025, 0.01, m.dark, -s * (W / 4 - 0.01), 1.3 + i * 0.09, 0.02, hinge); // vent slats
    box(0.03, 0.12, 0.03, m.brass, -s * (W / 2 - 0.09), 1.05, 0.03, hinge);
    hinge.userData.s = s; void d;
    return hinge;
  });
  return { g, doors };
}

// Weathered, stained plastic: faded sickly green-grey, rust and damp streaks running down, black mould at
// the bottom, scratches — and, on the door, a smeared dark-red handprint and claw marks.
function rotTexture(door, seed) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const x = c.getContext('2d');
  let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  x.fillStyle = '#3d4a42'; x.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '20,24,20' : '90,100,88'},${0.03 + r() * 0.07})`; x.fillRect(r() * 256, r() * 512, 2 + r() * 14, 2 + r() * 14); }
  for (let i = 0; i < 26; i++) { // streaks of rust / damp running down
    const px = r() * 256, len = 80 + r() * 330, g = x.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, `rgba(${r() < 0.6 ? '92,52,24' : '12,16,12'},${0.28 + r() * 0.25})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(px, r() * 120, 2 + r() * 9, len);
  }
  const mould = x.createLinearGradient(0, 330, 0, 512); mould.addColorStop(0, 'rgba(5,8,5,0)'); mould.addColorStop(1, 'rgba(5,8,5,.85)');
  x.fillStyle = mould; x.fillRect(0, 330, 256, 182);
  x.strokeStyle = 'rgba(190,200,185,.18)'; x.lineWidth = 1;
  for (let i = 0; i < 30; i++) { x.beginPath(); const px = r() * 256, py = r() * 512; x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 50, py + (r() - 0.5) * 50); x.stroke(); }
  if (door) {
    x.fillStyle = 'rgba(95,6,6,.82)'; // a smeared handprint
    x.beginPath(); x.ellipse(130, 250, 26, 32, 0.2, 0, 7); x.fill();
    for (const [dx, dy, a] of [[-26, -42, -0.35], [-10, -54, -0.12], [8, -56, 0.1], [26, -44, 0.3], [40, -12, 1.0]]) { x.save(); x.translate(130 + dx, 250 + dy); x.rotate(a); x.fillRect(-5, -16, 10, 30); x.restore(); }
    const drip = x.createLinearGradient(0, 270, 0, 420); drip.addColorStop(0, 'rgba(95,6,6,.7)'); drip.addColorStop(1, 'rgba(95,6,6,0)');
    x.fillStyle = drip; x.fillRect(118, 270, 6, 150); x.fillRect(140, 280, 4, 100);
    x.strokeStyle = 'rgba(8,8,8,.7)'; x.lineWidth = 3; // claw marks
    for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(60 + i * 12, 90); x.quadraticCurveTo(70 + i * 12, 150, 62 + i * 12, 215); x.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function potty(m) {
  const g = new THREE.Group(), W = 1.25, H = 2.3, D = 1.25;
  const wall = new THREE.MeshStandardMaterial({ map: rotTexture(false, 11), roughness: 0.95 });
  const doorMat = new THREE.MeshStandardMaterial({ map: rotTexture(true, 29), roughness: 0.95 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x4a4438, roughness: 0.95 });
  const body = box(W, H, D - 0.06, wall, 0, H / 2, -0.03, g);
  box(W + 0.08, 0.12, D + 0.08, roof, 0, H + 0.06, 0, g);
  const vent = box(0.3, 0.14, 0.3, roof, 0.3, H + 0.19, -0.3, g); vent.rotation.z = 0.18;  // bent vent pipe
  box(0.05, 0.4, 0.05, m.inside, -0.45, H + 0.3, 0.3, g).rotation.z = -0.25;                 // a broken stalk of something
  box(W - 0.2, 0.25, 0.02, m.grime, 0, 0.13, D / 2 - 0.05, g);
  box(W - 0.24, H - 0.4, 0.02, m.inside, 0, H / 2, D / 2 - 0.059, g);
  const hinge = new THREE.Group(); hinge.position.set(-W / 2 + 0.08, 0, D / 2 - 0.03); g.add(hinge);
  const door = box(W - 0.22, H - 0.3, 0.05, doorMat, (W - 0.22) / 2, H / 2 - 0.05, 0, hinge);
  door.rotation.z = 0.012; hinge.rotation.y = -0.06; // hangs a little crooked, never quite shut
  box(0.16, 0.06, 0.03, new THREE.MeshStandardMaterial({ color: 0x6a1010, roughness: 0.6 }), W - 0.4, 1.2, 0.04, hinge); // the latch: stuck on "occupied"
  const lean = 0.035; g.rotation.z = lean; void body;
  hinge.userData.s = -1; hinge.userData.rest = -0.06;
  return { g, doors: [hinge] };
}

export class Hides {
  constructor(root, map) {
    const m = mats();
    this.items = (map.hides || []).map((h) => {
      const it = h.kind === 'potty' ? potty(m) : locker(m);
      it.g.position.set(h.x, h.level ? FLOOR1 : h.kind === 'potty' ? terrainY(h.x, h.z) : FLOOR0, h.z);
      it.g.rotation.y = h.rot; root.add(it.g);
      it.open = 0; it.openUntil = 0;
      return it;
    });
  }
  onEvent(e, now) {
    if ((e.t === 'hide' || e.t === 'unhide' || e.t === 'search') && this.items[e.spot]) this.items[e.spot].openUntil = now + (e.t === 'search' ? 1.0 : 0.6);
  }
  update(dt, now) {
    for (const it of this.items) {
      const want = now < it.openUntil ? 1 : 0;
      it.open += (want - it.open) * Math.min(1, dt * 8);
      for (const d of it.doors) d.rotation.y = (d.userData.rest || 0) + d.userData.s * it.open * 1.6;
    }
  }
}
