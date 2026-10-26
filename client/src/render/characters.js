// Skinned human characters (rigged GLB with a Mixamo skeleton) + procedural pose layers
// for crouch, crawl, downed, carried, hanging and aiming.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applyLook } from './outfits.js';
import { makeCandle, attachTo } from './props.js';
import { crawlPose, downedPose, carriedPose, carrierPose, jumpPose, hangPose } from './poses.js';

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
      hips: b('Hips'), spine: b('Spine1'), neck: b('Neck'), head: b('Head'), rHand: b('RightHand'), lHand: b('LeftHand'),
      rArm: b('RightArm'), lArm: b('LeftArm'), rFore: b('RightForeArm'), lFore: b('LeftForeArm'),
      rUp: b('RightUpLeg'), lUp: b('LeftUpLeg'), rLeg: b('RightLeg'), lLeg: b('LeftLeg'),
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
    this.blend = { crouch: 0, crawl: 0, down: 0, hang: 0, carried: 0, carrying: 0, air: 0, aim: 0 };
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
    // Crawling / downed / carried / hanging / airborne use a still base pose + procedural layers.
    const still = s.state !== 'alive' || (s.crawl && s.state === 'alive') || (s.y || 0) > 0.15;
    if (still) { anim = 'Idle'; ts = 0.3; }
    this.setAnim(anim);
    this.actions[anim].timeScale = ts;
    this.mixer.update(dt);
    this.t = (this.t || 0) + dt;

    const crouch = ease('crouch', s.crouch && s.state === 'alive' && !s.crawl ? 1 : 0);
    const crawl = ease('crawl', s.crawl && s.state === 'alive' ? 1 : 0, 6);
    const down = ease('down', s.state === 'downed' ? 1 : 0, 5);
    const hang = ease('hang', s.state === 'hooked' ? 1 : 0, 5);
    const carried = ease('carried', s.state === 'carried' ? 1 : 0, 10);
    const carrying = ease('carrying', s.carrying ? 1 : 0, 6);
    const air = ease('air', (s.y || 0) > 0.1 ? 1 : 0, 14);
    const aim = ease('aim', s.aiming || s.rev ? 1 : 0, 10);
    const B = this.bones;
    if (B.spine) B.spine.rotation.x += crouch * 0.45 + aim * 0.15;
    if (B.rUp) { B.rUp.rotation.x -= crouch * 0.9; B.lUp.rotation.x -= crouch * 0.9; }
    if (B.rLeg) { B.rLeg.rotation.x += crouch * 1.3; B.lLeg.rotation.x += crouch * 1.3; }
    if (B.rArm && aim > 0.01) B.rArm.rotation.x -= aim * 1.2;
    crawlPose(B, this.t, s.speed, crawl);
    downedPose(B, this.t, s.speed, down);
    carriedPose(B, this.t, s.wiggle || 0, carried);
    carrierPose(B, carrying);
    hangPose(B, this.t, hang);
    if (air > 0.01) jumpPose(B, s.jumpK ?? 0.5, air);
    // Whole-body placement: prone for crawl/downed (with a small crawl-cycle bob), over-the-shoulder when carried.
    const prone = Math.max(down, crawl);
    const bob = (crawl + down) * Math.abs(Math.sin(this.t * (2 + s.speed * 3))) * 0.04 * Math.min(1, s.speed / 0.3);
    // Rotate the whole body about its hips (rest height HIP above the feet), then place the hips:
    //  prone (crawl/downed): pitched face-down (+X), hips 0.2m above the ground at the player position;
    //  carried: pitched head-down (-X) over the carrier's shoulder, hips at ~1.6m.
    const HIP = 0.98 * this.model.scale.x;
    const ang = prone > 0.01 ? prone * 1.45 : -carried * 1.6;
    const hipY = prone > 0.01 ? THREE.MathUtils.lerp(HIP, 0.22, prone) : THREE.MathUtils.lerp(HIP, 1.62, carried);
    this.model.rotation.set(ang, 0, 0);
    // model origin = hips - R·(0, HIP, 0)
    const oy = hipY - HIP * Math.cos(ang), oz = -HIP * Math.sin(ang);
    this.model.position.set(0, oy - crouch * 0.38 + bob + hang * 0.6 + (s.y || 0), oz);

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
