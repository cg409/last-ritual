// The survivor flashlight / torch and candle (monster weapons are glTF models: assets.js).
// Weapons are built with the grip at the origin and the shaft along +Y; userData.head is the height
// of the business end, which the first-person viewmodel keeps on screen (only the top shows).
import * as THREE from 'three';
import { vlight } from './lights.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
// moderate metalness: there is no environment map, so fully metallic surfaces would render black
const metal = (color = 0x777777, rough = 0.45) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.45 });
const wood = (color = 0x3a2616) => std(color, { roughness: 0.95 });
const rust = () => metal(0x5a3a26, 0.75);
const blood = () => std(0x2a0303, { roughness: 0.35, metalness: 0.1 });
function mesh(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; return m;
}
const cyl = (r0, r1, h, seg = 10) => new THREE.CylinderGeometry(r0, r1, h, seg);
// Thin rod from point a to point b.
function rod(a, b, r, mat) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
  const m = new THREE.Mesh(cyl(r, r, d.length(), 6), mat);
  m.position.copy(A).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true; return m;
}
const extrude = (shape, depth, bevel = 0.004) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2 });
// A few dried blood smears on a blade.
function smears(g, pts, mat = blood()) { for (const [x, y, z, s] of pts) { const b = mesh(new THREE.SphereGeometry(s, 6, 4), mat, x, y, z); b.scale.set(1, 0.6, 0.25); g.add(b); } }







// The survivor's electric flashlight. Origin = the grip; +Y points along the beam. Only the light
// splash it throws ahead is shown (fx.js) — no visible beam.
let _flMats = null;
let _glow = null;
function lensGlow() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(0,0,0,1)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  return (_glow = new THREE.CanvasTexture(c));
}
export function makeFlashlight() {
  const M = _flMats ||= {
    body: new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.45, metalness: 0.8 }),
    grip: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }),
    lens: new THREE.MeshBasicMaterial({ color: 0xfff4d8 }),
  };
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.16, 12), M.body, 0, 0.02, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.07, 12), M.grip, 0, -0.02, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.032, 0.02, 0.05, 14), M.body, 0, 0.12, 0));
  const lens = mesh(new THREE.CircleGeometry(0.028, 16), M.lens, 0, 0.146, 0); lens.rotation.x = -Math.PI / 2; lens.castShadow = false; g.add(lens);
  // no visible beam cone — just the light splash it throws ahead (fx.js); a soft glow on the lens
  const beam = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xfff0d0, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.material.map = lensGlow(); beam.scale.setScalar(0.12); beam.position.y = 0.16; g.add(beam);
  g.userData.lens = lens; g.userData.beam = beam;
  return g;
}

// The survivor torch: a charred wooden shaft with a pitch-soaked rag head and a living flame.
// Origin = the grip (a third of the way up the shaft); +Y points to the flame.
let _torchMats = null;
export function makeTorch(withLight = true) {
  const M = _torchMats ||= {
    wood: std(0x4a3222, { roughness: 0.95 }), char: std(0x1c1410, { roughness: 1 }), rag: std(0x3a2e24, { roughness: 1 }),
    band: metal(0x3a3632),
    core: new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }),
    outer: new THREE.MeshBasicMaterial({ color: 0xff7a20, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }),
  };
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.016, 0.012, 0.46, 8), M.wood, 0, 0.08, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.025, 8), M.band, 0, 0.27, 0));
  const head = mesh(new THREE.CylinderGeometry(0.032, 0.022, 0.09, 9), M.rag, 0, 0.33, 0); g.add(head);
  g.add(mesh(new THREE.SphereGeometry(0.032, 9, 6), M.char, 0, 0.375, 0));
  const flame = new THREE.Group(); flame.position.y = 0.39; g.add(flame);
  const outer = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.2, 9, 1, true), M.outer); outer.position.y = 0.08; flame.add(outer);
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 8, 1, true), M.core); core.position.y = 0.05; flame.add(core);
  g.userData.flame = flame; g.userData.flameParts = [outer, core];
  if (withLight) {
    const light = vlight(0xff9a4a, 1.5, 8, 2);
    light.position.y = 0.5; light.flicker = 1; g.add(light);
    g.userData.light = light; g.userData.baseI = 1.5;
  }
  return g;
}
// Flame dance (call per frame).
export function tickTorch(o, t) {
  const f = o.userData.flame; if (!f?.visible) return;
  const k = 1 + Math.sin(t * 17 + o.id) * 0.12 + Math.sin(t * 29.3 + o.id * 3) * 0.08;
  f.scale.set(1 / k, k, 1 / k); f.rotation.z = Math.sin(t * 5 + o.id) * 0.12;
}

export function makeCandle(withLight = true) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.12, 12), std(0xe9e1c8, { roughness: 0.6 }), 0, 0.06, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.012, 14), metal(0x8a6d3b), 0, 0, 0));
  const flame = mesh(new THREE.SphereGeometry(0.014, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffc46b }), 0, 0.14, 0);
  flame.scale.set(1, 2, 1); flame.castShadow = false; g.add(flame);
  g.userData.flame = flame;
  if (withLight) {
    const light = vlight(0xffa64a, 2.2, 6, 2);
    light.position.y = 0.2; light.flicker = 1; g.add(light);
    g.userData.light = light;
  }
  return g;
}
