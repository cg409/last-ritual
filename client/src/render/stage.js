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

export class Stage {
  constructor(canvas) {
    const gfx = graphics();
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    r.shadowMap.enabled = gfx.shadows; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = this.baseExposure = 1.25;
    this.renderer = r;
    this.scene = new THREE.Scene();
    // Very dark, cold night. Fog slightly lighter than the ground so silhouettes still read.
    this.fogColor = new THREE.Color(0x141b26);
    this.scene.background = this.fogColor.clone();
    this.scene.fog = new THREE.FogExp2(this.fogColor.clone(), this.baseFog = 0.034);
    this.camera = new THREE.PerspectiveCamera(settings().video.fov, window.innerWidth / window.innerHeight, 0.05, 500);

    this.hemi = new THREE.HemisphereLight(0x5a6c90, 0x16120e, this.baseHemi = 1.15);
    this.scene.add(this.hemi);
    this.moon = new THREE.DirectionalLight(0x9db2e8, this.baseMoon = 2.2);
    this.moon.castShadow = true;
    this.moon.shadow.bias = -0.0004; this.moon.shadow.normalBias = 0.04;
    const sc = this.moon.shadow.camera; sc.left = sc.bottom = -38; sc.right = sc.top = 38; sc.near = 1; sc.far = 160;
    this.scene.add(this.moon, this.moon.target);
    this.moonDir = new THREE.Vector3(-0.45, 0.75, -0.35).normalize();
    this.sky = buildSky(this.scene, this.moonDir);
    this.pool = new LightPool(this.scene, 14); // fixed light count = no shader recompiles; preset limits usage

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, gfx.pixelRatio));
    this.renderer.shadowMap.enabled = gfx.shadows;
    this.moon.castShadow = gfx.shadows;
    if (this.moon.shadow.mapSize.x !== gfx.shadowRes) {
      this.moon.shadow.mapSize.set(gfx.shadowRes, gfx.shadowRes);
      this.moon.shadow.map?.dispose(); this.moon.shadow.map = null;
    }
    this.bloom.enabled = gfx.bloom;
    this.smaa.enabled = gfx.antialias;
    this.camera.far = gfx.drawDist + 60; this.camera.fov = v.fov; this.camera.updateProjectionMatrix();
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
    this.moon.position.copy(focus).addScaledVector(this.moonDir, 80);
    this.moon.target.position.copy(focus);
    this.sky.update(this.camera, focus, t);
    this.grade.uniforms.uTime.value = t;
    this.pool.update(this.camera.position, t);
  }

  render() { this.composer.render(); }
}
