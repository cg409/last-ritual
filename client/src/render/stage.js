// Renderer, scene, moonlight, sky, fog and post-processing (bloom + film grain / aberration / grade).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { LightPool } from './lights.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uFear: { value: 0 }, uHurt: { value: 0 },
    uDesat: { value: 0.35 }, uTint: { value: new THREE.Color(0.9, 0.95, 1.05) }, uWarp: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uFear, uHurt, uDesat, uWarp; uniform vec3 uTint; varying vec2 vUv;
    float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      uv.x += sin(uv.y * 40. + uTime * 3.) * 0.002 * uWarp;           // Stalker: world turns wrong
      vec2 dir = uv - 0.5; float d = length(dir);
      float ab = 0.0015 + uFear * 0.006 + uWarp * 0.004;               // chromatic aberration
      vec3 col = vec3(texture2D(tDiffuse, uv + dir * ab).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - dir * ab).b);
      float l = dot(col, vec3(.299,.587,.114));
      col = mix(col, vec3(l), uDesat) * uTint;
      col = mix(col, col * vec3(1.25, .55, .5), uHurt * smoothstep(.25, .8, d));  // blood edges
      col *= 1. - smoothstep(.45, .95, d) * (0.55 + uFear * 0.3);      // vignette
      col += (rand(uv * 999. + uTime) - .5) * 0.025;                     // grain
      gl_FragColor = vec4(col, 1.);
    }`,
};

export class Stage {
  constructor(canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    r.setSize(window.innerWidth, window.innerHeight);
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = this.baseExposure = 1.35;
    this.renderer = r;
    this.scene = new THREE.Scene();
    // Bluish moonlit fog (lighter than the ground) so silhouettes read against it, like DbD.
    this.fogColor = new THREE.Color(0x1c2533);
    this.scene.background = this.fogColor.clone();
    this.scene.fog = new THREE.FogExp2(this.fogColor.clone(), 0.035);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.05, 400);

    this.hemi = new THREE.HemisphereLight(0x7a8cb0, 0x1a1410, this.baseHemi = 1.1);
    this.scene.add(this.hemi);
    this.moon = new THREE.DirectionalLight(0xa8bcff, this.baseMoon = 2.4);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(2048, 2048);
    const sc = this.moon.shadow.camera; sc.left = sc.bottom = -30; sc.right = sc.top = 30; sc.near = 1; sc.far = 140;
    this.moon.shadow.bias = -0.0005; this.moon.shadow.normalBias = 0.03;
    this.scene.add(this.moon, this.moon.target);
    this.moonDir = new THREE.Vector3(-0.45, 0.8, -0.35).normalize();
    this.buildSky();
    this.pool = new LightPool(this.scene, 10);

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.6, 0.82);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    window.addEventListener('resize', () => this.resize());
  }

  buildSky() {
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xdfe6ff, fog: false });
    this.moonMesh = new THREE.Mesh(new THREE.SphereGeometry(6, 32, 16), moonMat);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(14, 32, 16), new THREE.MeshBasicMaterial({ color: 0x5a6a9a, transparent: true, opacity: 0.12, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.moonMesh.add(halo);
    this.scene.add(this.moonMesh);
    // Drifting ash / fog motes around the camera
    const n = 1500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 60; pos[i * 3 + 1] = Math.random() * 12; pos[i * 3 + 2] = (Math.random() - 0.5) * 60; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9aa0a8, size: 0.06, transparent: true, opacity: 0.5, depthWrite: false }));
    this.scene.add(this.motes);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h); this.composer.setSize(w, h);
  }

  // Keep the shadow frustum, moon and particles centred on the focus point.
  follow(focus, t) {
    this.moon.position.copy(focus).addScaledVector(this.moonDir, 60);
    this.moon.target.position.copy(focus);
    this.moonMesh.position.copy(this.camera.position).addScaledVector(this.moonDir, 300);
    this.motes.position.set(focus.x, 0, focus.z);
    this.motes.rotation.y = t * 0.01;
    this.grade.uniforms.uTime.value = t;
    this.pool.update(this.camera.position, t);
  }

  render() { this.composer.render(); }
}
