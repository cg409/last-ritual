// Renderer, scene, moonlight, sky dome, fog, post-processing.
// Graphics presets (low/medium/high) control resolution, shadows, bloom, AA and draw distance.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { LightPool } from './lights.js';
import { buildSky } from './sky.js';
import { GradeShader } from './grade.js';
import { settings, graphics, onSettings } from '../settings.js';
import { liteScan } from './assets.js';

const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _s = new THREE.Vector3();

export class Stage {
  constructor(canvas) {
    const gfx = graphics();
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    r.shadowMap.enabled = gfx.shadows; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = this.baseExposure = 1.22;
    this.renderer = r;
    this.scene = new THREE.Scene();
    // Very dark, cold night. Fog slightly lighter than the ground so silhouettes still read.
    this.fogColor = new THREE.Color(0x0b1018);
    this.scene.background = this.fogColor.clone();
    this.scene.fog = new THREE.FogExp2(this.fogColor.clone(), this.baseFog = 0.034);
    this.camera = new THREE.PerspectiveCamera(settings().video.fov, window.innerWidth / window.innerHeight, 0.05, 500);

    // Natural moonlight is the main light source: a strong cold directional "moon" with soft shadows
    // plus a bluish sky fill. Artificial lights are kept to a handful (one porch lamp, lanterns, candles).
    this.hemi = new THREE.HemisphereLight(0x5a6c94, 0x12100e, this.baseHemi = 0.92);
    this.scene.add(this.hemi);
    // Soft, direction-less fill: faces turned away from the moon / in wall shadow are no longer black.
    this.ambient = new THREE.AmbientLight(0x3c465c, 0.35);
    this.scene.add(this.ambient);
    this.moon = new THREE.DirectionalLight(0xb4c6f4, this.baseMoon = 2.6);
    this.moon.castShadow = true;
    this.moon.shadow.bias = -0.0006; this.moon.shadow.normalBias = 0.06; // (less shadow acne shimmer on walls)
    const sc = this.moon.shadow.camera; sc.left = sc.bottom = -38; sc.right = sc.top = 38; sc.near = 1; sc.far = 160;
    this.scene.add(this.moon, this.moon.target);
    this.moonDir = new THREE.Vector3(-0.42, 0.62, -0.55).normalize(); // low-ish full moon over the north wall
    this.sky = buildSky(this.scene, this.moonDir);
    // The monster's red "stain" (like Dead by Daylight): a red beam cast ahead of it on the ground,
    // seen only by survivors. Always in the scene (intensity 0 when hidden) so shaders never recompile.
    this.stain = new THREE.SpotLight(0xff1608, 0, 17, 0.36, 0.45, 1.2);
    this.stain.castShadow = false;
    this.scene.add(this.stain, this.stain.target);
    this.pool = new LightPool(this.scene, 10); // few artificial lights: the moon does the work (fixed count = no recompiles)

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // First-person overlay (the monster's hands + weapon): drawn over the world after clearing depth,
    // so the weapon never clips into walls. Scene/camera are set by ViewModel; disabled otherwise.
    this.vmPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.vmPass.clear = false; this.vmPass.clearDepth = true; this.vmPass.enabled = false;
    this.composer.addPass(this.vmPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.5, 0.85);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.smaa = new SMAAPass(window.innerWidth, window.innerHeight);
    this.composer.addPass(this.smaa);
    this.applySettings();
    onSettings(() => this.applySettings());
    window.addEventListener('resize', () => this.resize());
  }

  applySettings() {
    const gfx = graphics(), v = settings().video;
    this.ratio = gfx.pixelRatio; this.fpsT = 0; this.fpsN = 0;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.ratio));
    this.renderer.shadowMap.enabled = gfx.shadows;
    this.moon.castShadow = gfx.shadows;
    if (this.moon.shadow.mapSize.x !== gfx.shadowRes) {
      this.moon.shadow.mapSize.set(gfx.shadowRes, gfx.shadowRes);
      this.moon.shadow.map?.dispose(); this.moon.shadow.map = null;
    }
    this.bloom.enabled = gfx.bloom;
    this.smaa.enabled = gfx.antialias;
    this.camera.far = gfx.drawDist + (gfx.lite ? 22 : 60); this.camera.fov = v.fov; this.camera.updateProjectionMatrix();
    this.grade.uniforms.uGrain.value = v.filmGrain ? 1 : 0;
    this.grade.uniforms.uVignette.value = v.vignette ? 1 : 0.3;
    this.grade.uniforms.uBright.value = v.brightness;
    this.pool.setSize(gfx.lights);
    this.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); });
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h); this.composer.setSize(w, h);
  }

  follow(focus, t) {
    // Snap the shadow camera to whole shadow-map texels (in light space). Without this the shadow
    // map is re-rasterised at sub-texel offsets every frame while you move, so every shadow edge
    // (trees, props, walls) crawls and shimmers — the "map vibrating while running" effect.
    const texel = (this.moon.shadow.camera.right - this.moon.shadow.camera.left) / this.moon.shadow.mapSize.x;
    const f = _f.copy(this.moonDir).negate(), r = _r.set(0, 1, 0).cross(f).normalize(), u = _u.copy(f).cross(r);
    const sr = Math.round(focus.dot(r) / texel) * texel, su = Math.round(focus.dot(u) / texel) * texel, sf = focus.dot(f);
    const snapped = _s.set(0, 0, 0).addScaledVector(r, sr).addScaledVector(u, su).addScaledVector(f, sf);
    this.moon.position.copy(snapped).addScaledVector(this.moonDir, 80);
    this.moon.target.position.copy(snapped);
    this.sky.update(this.camera, focus, t);
    this.grade.uniforms.uTime.value = t;
    this.pool.update(this.camera.position, t);
  }

  // Dynamic resolution (weak machines): if the frame rate stays low, render at a lower resolution until it
  // recovers; if there is lots of headroom, sharpen again. Only the pixel count changes, never the scene.
  adapt(dt) {
    const gfx = graphics(); if (!gfx.adaptive || dt <= 0) return;
    this.fpsT += dt; this.fpsN++;
    if (this.fpsT < 2.5) return;
    const fps = this.fpsN / this.fpsT; this.fpsT = 0; this.fpsN = 0;
    let r = this.ratio;
    if (fps < 24) r = Math.max(gfx.minRatio || 0.4, r * 0.82);
    else if (fps > 52) r = Math.min(gfx.pixelRatio, r * 1.12);
    if (Math.abs(r - this.ratio) > 0.01) { this.ratio = r; this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, r)); this.resize(); }
  }

  render() {
    if (graphics().lite && (this.liteT = (this.liteT || 0) + 1) % 150 === 0) liteScan(this.scene); // catch newly spawned props    if (!graphics().noPost) { this.composer.render(); return; }
    // Ultra low / mobile: straight to the screen — no bloom, grade or AA passes (tone mapping still
    // applies; the brightness setting scales the exposure instead of the grade pass).
    const r = this.renderer, e = r.toneMappingExposure;
    r.toneMappingExposure = e * settings().video.brightness;
    r.render(this.scene, this.camera);
    if (this.vmPass.enabled) { r.autoClear = false; r.clearDepth(); r.render(this.vmPass.scene, this.vmPass.camera); r.autoClear = true; }
    r.toneMappingExposure = e;
  }
}
