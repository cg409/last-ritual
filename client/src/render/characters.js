// Skinned characters: one rigged, textured GLB per monster + one for survivors (see /models/chars),
// each with its own Walk/Run clips (survivors also InjuredRun + Jump). Procedural pose layers
// (crouch, crawl, downed, carried, hanging, aiming, tripping) are expressed in body space, so they
// work on any rig orientation (see poses.js).
import * as THREE from 'three';
import { makeGltfLoader, loadRetry, fetchRetry, liteMat } from './assets.js';
import { graphics } from '../settings.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applyLook, skinById } from './outfits.js';
import { SKINS } from '@shared/constants.js';
import { fixArmWeights } from './skinfix.js';
import { makeFlashlight, attachTo } from './props.js';
import { vlight } from './lights.js';
import { prepBones, rot, crawlPose, downedPose, carriedPose, carrierPose, jumpPose, hangPose, fallPose, fallProne, idlePose, runArms, mendPose } from './poses.js';

const _ka = new THREE.Vector3(), _kb = new THREE.Vector3();
const LEG_FIX = 0.5;
const _tq = new THREE.Quaternion(), _tw = new THREE.Quaternion(), _tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 - 0.12, 0, 0)); // how far the running legs are eased toward straight, tucked-in legs

const BASE = import.meta.env.BASE_URL;
const MONSTER_HEIGHT = 2.05, SURVIVOR_HEIGHT = 1.75;
const lib = {};

// The models ship without an idle (and their node rest pose is not the bind pose), so the idle is
// a frozen frame of the walk cycle: the "passing" pose where the hips are highest and the legs are
// together. A breathing / head-turn layer (idlePose) brings it to life.
function idleClip(walk) {
  const hipsT = walk.tracks.find((t) => /Hips\.position$/.test(t.name));
  let best = 0;
  if (hipsT) { let hy = -1e9; for (let i = 0; i < hipsT.times.length; i++) { const y = hipsT.values[i * 3 + 1]; if (y > hy) { hy = y; best = hipsT.times[i]; } } }
  const tracks = walk.tracks.map((t) => {
    const v = t.createInterpolant().evaluate(best).slice();
    return new t.constructor(t.name, [0], Array.from(v));
  });
  return new THREE.AnimationClip('Idle', 1, tracks);
}

export async function loadCharacterAssets(onProgress) {
  if (lib.surv_alex) return;
  const meta = await (await fetchRetry(`${BASE}models/chars/chars.json`)).json();
  const ids = Object.keys(meta), loaded = {};
  const loader = makeGltfLoader();
  const tick = () => onProgress?.(Object.values(loaded).reduce((a, b) => a + b, 0) / ids.length);
  await Promise.all(ids.map(async (id) => {
    const g = await loadRetry(loader, `${BASE}models/${graphics().lite ? meta[id].file.replace('.glb', '_lo.glb') : meta[id].file}`, (e) => { loaded[id] = e.total ? e.loaded / e.total : 0.5; tick(); });
    loaded[id] = 1; tick();
    g.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      if (!meta[id].survivor) fixArmWeights(o); // (the new survivor rigs are clean)
      if (graphics().lite) o.material = liteMat(o.material);
      for (const t of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) if (o.material[t]) o.material[t].anisotropy = 4;
    });
    const clips = Object.fromEntries(g.animations.map((c) => [c.name, c]));
    clips.Idle = idleClip(clips.Walk);
    const target = meta[id].survivor ? SURVIVOR_HEIGHT * Math.min(1.05, Math.max(0.97, meta[id].height / 1.72)) : MONSTER_HEIGHT;
    lib[id] = { scene: g.scene, clips, meta: meta[id], scale: target / meta[id].height };
  }));
}
export const assetsReady = () => !!lib.surv_alex;
// The survivor model behind a character / skin id.
const survLib = (skinId) => lib[`surv_${(skinById[skinId] || SKINS[0]).model}`] || lib.surv_alex;

const bone = (root, n) => root.getObjectByName(n) || root.getObjectByName(`mixamorig${n}`) || root.getObjectByName(`mixamorig:${n}`);

export class Character {
  constructor(info) {
    this.id = info.id;
    this.isMonster = info.role === 'monster';
    this.monster = info.monster;
    this.root = new THREE.Group();
    this.model = new THREE.Group();   // container: faces -Z (the view yaws it by PI), pitched for prone poses
    this.root.add(this.model);
    this.skin = info.skin; this.disguise = null;
    this.blend = { crouch: 0, crawl: 0, down: 0, hang: 0, carried: 0, carrying: 0, air: 0, aim: 0, fall: 0, idle: 0, arms: 0, runK: 0, mend: 0 };
    this.swingT = 0; this.t = Math.random() * 10;
    this.setBody(this.isMonster ? this.monster : 'player', info.skin);
  }

  // Build the skinned body (monster model, or the survivor model for survivors / the disguised Mimic).
  setBody(kind, skin) {
    const L = kind === 'player' ? survLib(skin) : lib[kind] || survLib(skin);
    if (this.body) { this.body.removeFromParent(); this.mixer.stopAllAction(); }
    for (const x of this.extrasList || []) { x.traverse((c) => c.isVLight && c.dispose()); x.removeFromParent(); }
    this.extrasList = []; this.candle = null;
    this.survivorBody = !!L.meta.survivor;
    this.kind = this.survivorBody ? 'player' : kind; this.lib = L;
    this.body = SkeletonUtils.clone(L.scene);
    this.body.rotation.y = Math.PI;     // GLB faces +Z -> container faces -Z
    this.model.add(this.body);
    this.model.scale.setScalar(L.scale);
    this.model.rotation.set(0, 0, 0); this.model.position.set(0, 0, 0);
    this.meshes = [];
    this.body.traverse((o) => { if (o.isMesh) this.meshes.push(o); });
    const b = (n) => bone(this.body, n);
    this.bones = {
      hips: b('Hips'), lowSpine: b('Spine'), spine: b('Spine1'), chest: b('Spine2'), neck: b('Neck'), head: b('Head'),
      rSh: b('RightShoulder'), lSh: b('LeftShoulder'), rArm: b('RightArm'), lArm: b('LeftArm'), rFore: b('RightForeArm'), lFore: b('LeftForeArm'), rHand: b('RightHand'), lHand: b('LeftHand'),
      rUp: b('RightUpLeg'), lUp: b('LeftUpLeg'), rLeg: b('RightLeg'), lLeg: b('LeftLeg'), rFoot: b('RightFoot'), lFoot: b('LeftFoot'),
    };
    this.mixer = new THREE.AnimationMixer(this.body);
    this.actions = {};
    for (const [name, c] of Object.entries(L.clips)) {
      const a = this.mixer.clipAction(c);
      if (name === 'Jump') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      this.actions[name] = a;
    }
    this.current = 'Idle'; this.actions.Idle.play(); this.mixer.update(0);
    prepBones(this.bones, this.body);
    this.poseBones = Object.values(this.bones).filter(Boolean);
    this.cleanQ = this.poseBones.map((b) => b.quaternion.clone());
    // Relaxed hanging arms of the idle frame: the base the survivor's locomotion arm swing starts from
    // (the source Run clips hold the arms in awkward, flared poses).
    this.armBones = ['rSh', 'lSh', 'rArm', 'lArm', 'rFore', 'lFore', 'rHand', 'lHand'].map((k) => this.bones[k]).filter(Boolean);
    this.idleArmQ = this.armBones.map((b) => b.quaternion.clone());
    this.legBones = ['rUp', 'lUp', 'rLeg', 'lLeg'].map((k) => this.bones[k]).filter(Boolean);
    this.idleLegQ = this.legBones.map((b) => b.quaternion.clone());
    this.legLift = 0;
    this.hip = L.meta.hipY * L.scale;
    applyLook(this, skin);
    if (this.kind === 'player' && !this.isMonster) {
      this.candle = makeFlashlight(); this.candle.visible = false;
      attachTo(this.bones.lHand, this.candle, this.model); this.extrasList.push(this.candle);
    }
    if (this.kind === 'mimic') { // the lantern in her hand casts a warm, flickering glow
      const l = vlight(0xff9a40, 1.0, 5, 2); l.flicker = 1;
      attachTo(this.bones.rHand, l, this.model); this.extrasList.push(l);
    }
  }

  setAnim(name, fade = 0.25) {
    if (this.current === name || !this.actions[name]) return;
    this.actions[name].reset().setEffectiveWeight(1).fadeIn(fade).play();
    this.actions[this.current]?.fadeOut(fade);
    this.current = name;
  }

  // Which clip, and how fast, so the feet match the ground speed.
  pickClip(s) {
    const L = this.lib, sp = L.meta.speeds, sc = L.scale, monster = this.kind !== 'player';
    const still = s.state !== 'alive' || s.crawl || s.fallen;
    if (!still && (s.y || 0) > 0.12 && this.actions.Jump) return ['Jump', this.actions.Jump.getClip().duration / 0.72];
    if (still || s.speed < 0.15) return ['Idle', 1];
    let anim = 'Walk';
    if (monster) { if (s.running || s.lunge) anim = 'Run'; }
    else if (s.running && !s.crouch) anim = s.health === 1 && this.actions.InjuredRun ? 'InjuredRun' : 'Run';
    let ts = s.speed / ((sp[anim] || 1.5) * sc);
    ts = THREE.MathUtils.clamp(ts, 0.45, monster && anim === 'Walk' ? 2.2 : 1.8);
    if (L.meta.reverse.includes(anim)) ts = -ts;
    return [anim, ts];
  }

  update(dt, s) {
    // The Mimic's disguise swaps the whole body to the survivor model.
    if (this.isMonster && (s.disguise || null) !== this.disguise) {
      this.disguise = s.disguise || null;
      this.setBody(this.disguise ? 'player' : this.monster, this.disguise || this.skin);
    }
    const ease = (k, v, rate = 8) => (this.blend[k] += (v - this.blend[k]) * Math.min(1, dt * rate));
    const [anim, ts] = this.pickClip(s);
    this.setAnim(anim, anim === 'Jump' ? 0.1 : 0.3);
    this.actions[anim].timeScale = ts;
    // three's mixer skips writing a bone whose clip value didn't change since last frame (e.g. the
    // one-frame idle), so restore the clean clip pose first — pose layers must never accumulate.
    const PB = this.poseBones;
    for (let i = 0; i < PB.length; i++) PB[i].quaternion.copy(this.cleanQ[i]);
    this.mixer.update(dt);
    for (let i = 0; i < PB.length; i++) this.cleanQ[i].copy(PB[i].quaternion);
    this.t += dt;

    const crouch = ease('crouch', s.crouch && s.state === 'alive' && !s.crawl ? 1 : 0);
    const crawl = ease('crawl', s.crawl && s.state === 'alive' ? 1 : 0, 6);
    const down = ease('down', s.state === 'downed' ? 1 : 0, 5);
    const hang = ease('hang', s.state === 'hooked' ? 1 : 0, 5);
    const carried = ease('carried', s.state === 'carried' ? 1 : 0, 10);
    const carrying = ease('carrying', s.carrying ? 1 : 0, 6);
    const air = ease('air', (s.y || 0) > 0.1 ? 1 : 0, 14);
    const aim = ease('aim', s.aiming || s.rev ? 1 : 0, 10);
    const idle = ease('idle', anim === 'Idle' && s.state === 'alive' && !s.crawl && !s.fallen ? 1 : 0, 6);
    const B = this.bones;
    // Arm swing for the survivor rig, phase-locked to the clip by measuring which knee is ahead.
    // The clip's arms are replaced by the relaxed idle arms, then swung procedurally.
    // (only for rigs whose clips need it — the new survivors walk and run properly on their own)
    const loco = this.kind === 'player' && this.lib.meta.fixGait && s.state === 'alive' && !s.crawl && !s.fallen && (s.y || 0) < 0.1 && (anim === 'Run' || anim === 'InjuredRun' || anim === 'Walk');
    const armW = ease('arms', loco ? 1 : 0, 10);
    if (armW > 0.01 && B.rLeg && B.lLeg) {
      this.armBones.forEach((b, i) => b.quaternion.slerp(this.idleArmQ[i], armW));
      this.body.updateMatrixWorld(true);
      this.body.worldToLocal(B.rLeg.getWorldPosition(_ka)); this.body.worldToLocal(B.lLeg.getWorldPosition(_kb));
      const swing = THREE.MathUtils.clamp((_ka.z - _kb.z) / (anim === 'Walk' ? 0.22 : 0.32), -1, 1);
      this.armSwing = (this.armSwing ?? swing) + (swing - (this.armSwing ?? swing)) * Math.min(1, dt * 20);
      const run = ease('runK', anim === 'Walk' ? 0 : s.crouch ? 0.3 : 1, 6) * (anim === 'InjuredRun' ? 0.7 : 1);
      runArms(B, this.armSwing, run, armW * (1 - this.blend.crouch * 0.6));
      // Running legs: the source clip runs low with deeply buckled knees and the feet far apart.
      // Ease the legs toward the straight idle legs, tuck them under the body, then lower the body
      // by however much the feet were lifted so they stay planted on the ground.
      const legW = armW * this.blend.runK * (1 - this.blend.crouch) * LEG_FIX;
      if (legW > 0.01 && B.rFoot && B.lFoot) {
        const before = this.footMin();
        this.legBones.forEach((b, i) => b.quaternion.slerp(this.idleLegQ[i], legW));
        rot(B.rUp, 0, 0, -0.07, legW / LEG_FIX); rot(B.lUp, 0, 0, 0.07, legW / LEG_FIX);
        const lift = (before - this.footMin()) * this.lib.scale; // < 0 = the feet now hang below the ground
        this.legLift += (lift - this.legLift) * Math.min(1, dt * 12);
      } else this.legLift += (0 - this.legLift) * Math.min(1, dt * 8);
    } else this.legLift += (0 - this.legLift) * Math.min(1, dt * 8);
    idlePose(B, this.t, idle, this.kind !== 'player');
    const mend = ease('mend', s.act === 'selfheal' && s.state === 'alive' ? 1 : 0, 6);
    mendPose(B, this.t, mend);
    rot(B.spine, 0.45, 0, 0, crouch); rot(B.spine, 0.15, 0, 0, aim);
    rot(B.rUp, -0.9, 0, 0, crouch); rot(B.lUp, -0.9, 0, 0, crouch);
    rot(B.rLeg, 1.3, 0, 0, crouch); rot(B.lLeg, 1.3, 0, 0, crouch);
    rot(B.rArm, -1.2, 0, 0, aim);
    crawlPose(B, this.t, s.speed, crawl);
    downedPose(B, this.t, s.speed, down);
    carriedPose(B, this.t, s.wiggle || 0, carried);
    carrierPose(B, carrying);
    hangPose(B, this.t, hang);
    if (air > 0.01 && !this.actions.Jump) jumpPose(B, s.jumpK ?? 0.5, air);
    // Tripped over a pallet / log: pitch forward onto the hands, then scramble back up.
    const fall = ease('fall', s.fallen ? 1 : 0, s.fallen ? 14 : 5);
    if (fall > 0.01) fallPose(B, s.fallK ?? 0.5, this.t, fall);
    // Whole-body placement about the hips: prone = pitched face-down, carried = head-down over a shoulder.
    const prone = Math.max(down, crawl, fall * fallProne(s.fallK ?? 0.5));
    const bob = (crawl + down) * Math.abs(Math.sin(this.t * (2 + s.speed * 3))) * 0.04 * Math.min(1, s.speed / 0.3);
    const HIP = this.hip;
    const ang = prone > 0.01 ? -prone * 1.45 : carried * 1.6; // container faces -Z: negative pitch = face-down
    const hipY = prone > 0.01 ? THREE.MathUtils.lerp(HIP, 0.22, prone) : THREE.MathUtils.lerp(HIP, 1.62, carried);
    this.model.rotation.set(ang, 0, 0);
    const oy = hipY - HIP * Math.cos(ang), oz = -HIP * Math.sin(ang); // model origin = hips - R*(0, HIP, 0)
    this.model.position.set(0, oy - crouch * 0.36 - mend * 0.2 + bob + hang * 0.6 + (s.y || 0) + this.legLift, oz);

    if (this.swingT > 0) {
      this.swingT = Math.max(0, this.swingT - dt);
      const k = Math.sin((1 - this.swingT / 0.45) * Math.PI);
      rot(B.rArm, -2.0, 0, 0.5, k); rot(B.spine, 0, 0.5, 0, k);
    }
    if (this.candle) { // the flashlight: always in hand while alive, beam only when switched on
      this.candle.visible = s.state === 'alive' && !s.crawl;
      this.candle.userData.beam.visible = this.candle.userData.lens.visible = !!s.lightOn;
      // point it ahead (slightly down) whatever the hand is doing
      if (this.candle.visible && this.candle.parent) {
        this.candle.parent.getWorldQuaternion(_tq).invert();
        this.root.getWorldQuaternion(_tw).multiply(_tilt);
        this.candle.quaternion.copy(_tq.multiply(_tw));
      }
    }
  }

  swing() { this.swingT = 0.45; }

  // Height of the lower foot in body space (for keeping the feet on the ground).
  footMin() {
    this.body.updateMatrixWorld(true);
    this.body.worldToLocal(this.bones.rFoot.getWorldPosition(_ka)); this.body.worldToLocal(this.bones.lFoot.getWorldPosition(_kb));
    return Math.min(_ka.y, _kb.y);
  }

  // DbD-style aura: a glowing silhouette drawn on top of everything (seen through walls).
  // Uses clones of the skinned meshes sharing the same skeleton, so it follows the animation.
  setAura(on, color = 0xff2a2a) {
    if (on && (!this.aura || this.auraBody !== this.body)) {
      this.clearAura();
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false, fog: false });
      this.aura = [];
      for (const m of this.meshes) {
        const a = m.isSkinnedMesh ? new THREE.SkinnedMesh(m.geometry, mat) : new THREE.Mesh(m.geometry, mat);
        if (m.isSkinnedMesh) a.bind(m.skeleton, m.bindMatrix);
        a.renderOrder = 999; a.frustumCulled = false; a.castShadow = false;
        a.position.copy(m.position); a.quaternion.copy(m.quaternion); a.scale.copy(m.scale);
        m.parent.add(a); this.aura.push(a);
      }
      this.auraMat = mat; this.auraBody = this.body;
    }
    if (!on) { this.clearAura(); return; }
    this.auraMat.color.setHex(color);
    this.auraMat.opacity = 0.38 + Math.sin(this.t * 6) * 0.14;
  }
  clearAura() {
    for (const a of this.aura || []) a.removeFromParent();
    this.auraMat?.dispose(); this.aura = null; this.auraMat = null; this.auraBody = null;
  }

  dispose() {
    this.clearAura();
    for (const x of this.extrasList || []) x.traverse((c) => c.isVLight && c.dispose());
    this.root.removeFromParent();
  }
}
