// Tall dead-grass patches (camouflage). Instead of single flat blades, each instance is a tuft made
// of 3 crossed vertical cards textured with a painted clump of ~60 thin curved blades (alpha-tested),
// so a patch reads as dense, soft, natural grass. Wind bends the tops in the vertex shader; the
// colour fades from dark roots to pale, sun-bleached tips. One InstancedMesh = one draw call.
import * as THREE from 'three';
import { terrainY } from '@shared/levels.js';
import { graphics } from '../settings.js';

function grassTexture(lite = false) {
  const W = lite ? 64 : 256, H = lite ? 128 : 512, K = W / 256, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  const blade = (x0, h, lean, w, col) => {
    const x1 = x0 + lean, cx = x0 + lean * 0.35;
    g.beginPath(); g.moveTo(x0 - w, H); g.quadraticCurveTo(cx - w * 0.5, H - h * 0.55, x1, H - h);
    g.quadraticCurveTo(cx + w * 0.5, H - h * 0.55, x0 + w, H); g.closePath();
    g.fillStyle = col; g.fill();
  };
  for (let i = 0; i < 70; i++) {
    const x = W * 0.15 + Math.random() * W * 0.7, h = H * (0.45 + Math.random() * 0.53);
    const lean = (Math.random() - 0.5) * W * 0.55, w = (2 + Math.random() * 3.5) * K;
    const l = 22 + Math.random() * 30, s = 18 + Math.random() * 22, hue = 38 + Math.random() * 22;
    const grad = g.createLinearGradient(0, H, 0, H - h);
    grad.addColorStop(0, `hsl(${hue},${s}%,${l * 0.35}%)`); grad.addColorStop(0.5, `hsl(${hue},${s}%,${l * 0.8}%)`); grad.addColorStop(1, `hsl(${hue + 6},${s - 6}%,${l * 1.15}%)`);
    blade(x, h, lean, w, grad);
  }
  for (let i = 0; i < 10; i++) { // a few seed heads
    const x = W * 0.25 + Math.random() * W * 0.5, y = H * (0.02 + Math.random() * 0.2);
    g.fillStyle = 'rgba(150,130,95,0.9)'; g.beginPath(); g.ellipse(x, y, 3 * K, 12 * K, (Math.random() - 0.5) * 0.6, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = lite ? 1 : 4;
  return t;
}

function tuftGeometry() {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const p = new THREE.PlaneGeometry(1.1, 1.3, 2, 3); p.translate(0, 0.65, 0); p.rotateY((i / 3) * Math.PI);
    parts.push(p);
  }
  const geo = new THREE.BufferGeometry();
  const pos = [], uv = [], nor = [], idx = []; let base = 0;
  for (const p of parts) {
    const pa = p.attributes.position, ua = p.attributes.uv;
    for (let i = 0; i < pa.count; i++) { pos.push(pa.getX(i), pa.getY(i), pa.getZ(i)); uv.push(ua.getX(i), ua.getY(i)); nor.push(0, 1, 0); } // up normals = soft, even lighting
    for (let i = 0; i < p.index.count; i++) idx.push(p.index.getX(i) + base);
    base += pa.count;
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(idx);
  return geo;
}

export function buildGrass(group, map, density = 1) {
  const geo = tuftGeometry();
  const lite = graphics().lite; // ultra low / mobile: small soft texture, flat-lit, no wind
  const mat = lite ? new THREE.MeshLambertMaterial({ map: grassTexture(true), alphaTest: 0.45, side: THREE.DoubleSide, color: 0x9a9480 })
    : new THREE.MeshStandardMaterial({ map: grassTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, color: 0x9a9480 });
  if (!lite) mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 }; mat.userData.shader = sh;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; varying float vH;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp = instanceMatrix * vec4(0.,0.,0.,1.);
        float h = position.y / 1.3; vH = h;
        float w = sin(uTime*1.3 + wp.x*0.3 + wp.z*0.23) + 0.35*sin(uTime*3.3 + wp.x*1.1 + wp.z*0.7);
        transformed.x += w * 0.12 * h * h; transformed.z += w * 0.06 * h * h;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vH;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= mix(0.45, 1.05, smoothstep(0., .8, vH));');
  };
  if (!lite) mat.customProgramCacheKey = () => 'grass-tufts';
  const per = (gp) => Math.floor(gp.r * gp.r * 2.6 * density);
  // One InstancedMesh per 32 m map cell so off-screen / distant grass is skipped by the GPU.
  const cells = new Map();
  for (const gp of map.grass) { const k = Math.floor(gp.x / 32) + ',' + Math.floor(gp.z / 32); (cells.get(k) || cells.set(k, []).get(k)).push(gp); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  for (const patches of cells.values()) {
    const count = patches.reduce((n, gp) => n + per(gp), 0);
    if (!count) continue;
    const inst = new THREE.InstancedMesh(geo, mat, count);
    let i = 0;
    for (const gp of patches) {
      for (let k = 0; k < per(gp); k++) {
        const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * gp.r;
        const edge = 1 - (d / gp.r) * 0.45, x = gp.x + Math.cos(a) * d, z = gp.z + Math.sin(a) * d;
        const sc = (0.8 + Math.random() * 0.5) * edge;
        m4.compose(p.set(x, terrainY(x, z) - 0.03, z), q.setFromEuler(e.set((Math.random() - 0.5) * 0.15, Math.random() * Math.PI, (Math.random() - 0.5) * 0.15)), s.set(sc * (0.9 + Math.random() * 0.4), sc, sc));
        inst.setMatrixAt(i, m4);
        inst.setColorAt(i++, col.setHSL(0.1 + Math.random() * 0.05, 0.25 + Math.random() * 0.15, 0.42 + Math.random() * 0.2));
      }
    }
    inst.receiveShadow = true; inst.castShadow = false;
    inst.computeBoundingSphere();
    group.add(inst);
  }
  group.userData.grassMat = mat;
}
