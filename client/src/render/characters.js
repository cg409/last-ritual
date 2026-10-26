// Skinned human characters (rigged GLB with a Mixamo skeleton) + procedural pose layers
// for crouch, crawl, downed, carried, hanging and aiming.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applyLook } from './outfits.js';
import { makeCandle, attachTo } from './props.js';

let base = null;
export async function loadCharacterAssets(onProgress) {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/Soldier.glb`,
    (e) => onProgress?.(e.total ? e.loaded / e.total : 0.5));
  base = { scene: gltf.scene, clips: gltf.animations };
}
export const assetsReady = () => !!base;

const bone = (root, n) => root.getObjectByName(`mixamorig${n}`) || root.getObjectByName(`mixamorig:${n}`);

export class Character {
  constructor(info) {
    this.id = info.id;
    this.isMonster = info.role === 'monster';
    this.monster = info.monster;
    this.root = new THREE.Group();
    this.model = SkeletonUtils.clone(base.scene);
    this.root.add(this.model);
    this.meshes = [];
    this.model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; this.meshes.push(o); } });
    const b = (n) => bone(this.model, n);
    this.bones = {
      hips: b('Hips'), spine: b('Spine1'), head: b('Head'), rHand: b('RightHand'), lHand: b('LeftHand'),
      rArm: b('RightArm'), lArm: b('LeftArm'), rUp: b('RightUpLeg'), lUp: b('LeftUpLeg'), rLeg: b('RightLeg'), lLeg: b('LeftLeg'),
    };
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const c of base.clips) this.actions[c.name] = this.mixer.clipAction(c);
    this.current = 'Idle';
    this.actions.Idle?.play();
    this.skin = info.skin; this.disguise = null;
    applyLook(this, info.skin, this.isMonster);
    if (!this.isMonster) {
      this.candle = makeCandle();
      this.candle.visible = false;
      attachTo(this.bones.lHand, this.candle, this.model);
    }
    this.blend = { crouch: 0, crawl: 0, down: 0, hang: 0, carried: 0, aim: 0 };
    this.swingT = 0;
  }

  setAnim(name, fade = 0.25) {
    if (this.current === name || !this.actions[name]) return;
    this.actions[name].reset().setEffectiveWeight(1).fadeIn(fade).play();
    this.actions[this.current]?.fadeOut(fade);
    this.current = name;
  }

  update(dt, s) {
    // Mimic disguise swaps the whole look.
    if (this.isMonster && (s.disguise || null) !== this.disguise) {
      this.disguise = s.disguise || null;
      applyLook(this, this.disguise, !this.disguise);
    }
    const ease = (k, v, rate = 8) => (this.blend[k] += (v - this.blend[k]) * Math.min(1, dt * rate));
    const moving = s.speed > 0.15;
    let anim = 'Idle', ts = 1;
    if (moving) {
      if (s.speed > 3.4) { anim = 'Run'; ts = s.speed / 4.6; } else { anim = 'Walk'; ts = Math.max(0.5, s.speed / 1.9); }
    }
    if (s.state === 'downed' || s.state === 'carried' || s.state === 'hooked') { anim = moving ? 'Walk' : 'Idle'; ts = 0.45; }
    this.setAnim(anim);
    this.actions[anim].timeScale = ts;
    this.mixer.update(dt);

    const crouch = ease('crouch', s.crouch && s.state === 'alive' ? 1 : 0);
    const crawl = ease('crawl', s.crawl && s.state === 'alive' ? 1 : 0);
    const down = ease('down', s.state === 'downed' ? 1 : 0, 5);
    const hang = ease('hang', s.state === 'hooked' ? 1 : 0, 5);
    const carried = ease('carried', s.state === 'carried' ? 1 : 0, 10);
    const aim = ease('aim', s.aiming || s.rev ? 1 : 0, 10);
    const B = this.bones;
    if (B.spine) B.spine.rotation.x += crouch * 0.45 + aim * 0.15;
    if (B.rUp) { B.rUp.rotation.x -= crouch * 0.9; B.lUp.rotation.x -= crouch * 0.9; }
    if (B.rLeg) { B.rLeg.rotation.x += crouch * 1.3; B.lLeg.rotation.x += crouch * 1.3; }
    if (B.rArm && aim > 0.01) B.rArm.rotation.x -= aim * 1.2;
    if (B.rArm && hang > 0.01) { B.rArm.rotation.z += hang * 2.4; B.lArm.rotation.z -= hang * 2.4; }
    if (B.head && hang > 0.01) B.head.rotation.x += hang * 0.7;
    // whole-body tilt for crawl / downed / carried (over the shoulder)
    this.model.rotation.x = -(down * 1.4 + crawl * 1.25);
    this.model.rotation.z = carried * 1.45;
    this.model.position.y = -crouch * 0.38 + down * 0.22 + crawl * 0.22 + hang * 0.6 + carried * 1.35;
    this.model.position.z = carried * -0.25;

    if (this.swingT > 0) {
      this.swingT = Math.max(0, this.swingT - dt);
      const k = Math.sin((1 - this.swingT / 0.45) * Math.PI);
      if (B.rArm) { B.rArm.rotation.x -= k * 2.0; B.rArm.rotation.z += k * 0.6; }
      if (B.spine) B.spine.rotation.y += k * 0.5;
    }
    if (this.weapon && s.saw) this.weapon.rotation.z = (Math.random() - 0.5) * 0.1;
    if (this.candle) this.candle.visible = !!s.holding;
  }

  swing() { this.swingT = 0.45; }
  dispose() { this.root.removeFromParent(); }
}
