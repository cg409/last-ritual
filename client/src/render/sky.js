// Night sky dome: gradient + drifting cloud layer (shader), a hazy moon, and a distant forest silhouette
// ring beyond the perimeter wall. No point particles (they looked like TV noise / stars in the ground).
import * as THREE from 'three';

export function buildSky(scene, moonDir) {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uMoon: { value: moonDir.clone() }, uDark: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `
      varying vec3 vDir; uniform float uTime, uDark; uniform vec3 uMoon;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= .5; } return v; }
      void main(){
        vec3 d = normalize(vDir); float h = max(d.y, 0.);
        vec3 col = mix(vec3(.035,.045,.06), vec3(.008,.01,.016), pow(h, .5));
        float m = max(dot(d, normalize(uMoon)), 0.);
        col += vec3(.12,.15,.22) * pow(m, 12.) * .7 + vec3(.05,.06,.09) * pow(m, 3.);
        vec2 uv = d.xz / (d.y + .25) * 1.6 + vec2(uTime * .006, uTime * .002);
        float c = smoothstep(.45, .85, fbm(uv));
        vec3 cloud = vec3(.05,.06,.075) + vec3(.18,.2,.26) * pow(m, 6.) * .8;
        col = mix(col, cloud, c * smoothstep(0., .25, d.y) * .9);
        col *= (1. - uDark * .85) * .7;
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMat);
  dome.renderOrder = -10; dome.frustumCulled = false;
  scene.add(dome);

  // The full moon: a painted disc (maria, craters, limb darkening) with a wide soft halo, always
  // placed along the moonlight direction so its light and position agree.
  const moon = new THREE.Group();
  const mc = document.createElement('canvas'); mc.width = mc.height = 256;
  const g = mc.getContext('2d');
  const grd = g.createRadialGradient(118, 112, 10, 128, 128, 120);
  grd.addColorStop(0, '#f4f2ea'); grd.addColorStop(0.75, '#d9d8d0'); grd.addColorStop(1, '#a8a8a4');
  g.fillStyle = grd; g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill();
  g.save(); g.clip();
  for (const [x, y, r, a] of [[92, 96, 34, 0.22], [150, 80, 22, 0.18], [160, 150, 40, 0.2], [100, 165, 26, 0.16], [70, 140, 16, 0.15], [182, 112, 14, 0.15]]) {
    g.fillStyle = `rgba(110,112,120,${a})`; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 40; i++) {
    const x = 20 + Math.random() * 216, y = 20 + Math.random() * 216, r = 2 + Math.random() * 6;
    g.strokeStyle = 'rgba(90,90,96,.25)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  }
  g.restore();
  const moonTex = new THREE.CanvasTexture(mc); moonTex.colorSpace = THREE.SRGBColorSpace;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(14, 48), new THREE.MeshBasicMaterial({ map: moonTex, fog: false, transparent: true, depthWrite: false, color: 0xe8ecf6 }));
  moon.add(disc);
  const hc = document.createElement('canvas'); hc.width = hc.height = 128;
  const hg = hc.getContext('2d'), hgr = hg.createRadialGradient(64, 64, 8, 64, 64, 64);
  hgr.addColorStop(0, 'rgba(200,215,255,0.45)'); hgr.addColorStop(0.35, 'rgba(150,170,220,0.14)'); hgr.addColorStop(1, 'rgba(0,0,0,0)');
  hg.fillStyle = hgr; hg.fillRect(0, 0, 128, 128);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(hc), fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.z = -0.5; moon.add(halo);
  moon.renderOrder = -9; disc.renderOrder = -8; halo.renderOrder = -9;
  scene.add(moon);

  // Distant treeline silhouette: a jagged band of dark spikes far away (fog-tinted).
  const ring = new THREE.Group();
  const spikeGeo = new THREE.BufferGeometry();
  const pos = []; const N = 260, R = 160;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2, am = (a0 + a1) / 2;
    const h = 14 + Math.random() * 22, w = 0.6 + Math.random();
    pos.push(Math.cos(a0) * R, 0, Math.sin(a0) * R, Math.cos(am) * R * w / w, h, Math.sin(am) * R, Math.cos(a1) * R, 0, Math.sin(a1) * R);
  }
  spikeGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const tl = new THREE.Mesh(spikeGeo, new THREE.MeshBasicMaterial({ color: 0x06080b, side: THREE.DoubleSide, fog: false }));
  ring.add(tl); scene.add(ring);

  return {
    dome, ring, mat: skyMat,
    update(camera, focus, t) {
      dome.position.copy(camera.position);
      ring.position.set(focus.x, 0, focus.z);
      skyMat.uniforms.uTime.value = t;
      moon.position.copy(camera.position).addScaledVector(moonDir, 330);
      moon.lookAt(camera.position);
    },
    setDark(k) {
      skyMat.uniforms.uDark.value = k;
      disc.material.opacity = 1 - k * 0.8; halo.material.opacity = 1 - k;
    },
  };
}
