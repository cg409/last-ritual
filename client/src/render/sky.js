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
        col += vec3(.45,.5,.6) * pow(m, 900.) * 2.5 + vec3(.12,.15,.22) * pow(m, 12.) * .6;
        vec2 uv = d.xz / (d.y + .25) * 1.6 + vec2(uTime * .006, uTime * .002);
        float c = smoothstep(.45, .85, fbm(uv));
        vec3 cloud = vec3(.05,.06,.075) + vec3(.18,.2,.26) * pow(m, 6.) * .8;
        col = mix(col, cloud, c * smoothstep(0., .25, d.y) * .9);
        col *= 1. - uDark * .85;
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMat);
  dome.renderOrder = -10; dome.frustumCulled = false;
  scene.add(dome);

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
    },
    setDark(k) { skyMat.uniforms.uDark.value = k; },
  };
}
