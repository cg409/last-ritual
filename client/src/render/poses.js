// Procedural animation layers added on top of the mixer clip, weighted 0..1. Rotations are given in
// BODY space (independent of each rig's bone axes) and applied about the bone's own pivot:
//   x = pitch: + tips the top of the spine/neck/head FORWARD, or swings a limb's lower end BACKWARD
//       (so UpLeg -x lifts the knee, Leg +x bends the knee, Arm -x raises the arm forward,
//        ForeArm -x bends the elbow);
//   y = yaw about the up axis (+ turns left);   z = roll: + swings a limb's end toward the body's right.
// Body frame = the GLB root: +Y up, +Z forward, -X = the character's right.
import * as THREE from 'three';

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qd = new THREE.Quaternion(), e = new THREE.Euler();

// Tag every bone with its body root so parent rotations can be measured in body space.
export function prepBones(B, root) { for (const b of Object.values(B)) if (b) b.userData.bodyRoot = root; }

export function rot(bone, x, y, z, w = 1) {
  if (!bone || w <= 0.001 || (!x && !y && !z)) return;
  const root = bone.userData.bodyRoot;
  qa.identity(); // parent chain orientation relative to the body root
  for (let n = bone.parent; n && n !== root; n = n.parent) qa.premultiply(n.quaternion);
  qd.setFromEuler(e.set(x * w, y * w, -z * w, 'YXZ'));
  qb.copy(qa).invert();
  bone.quaternion.premultiply(qa).premultiply(qd).premultiply(qb);
}
const add = rot;

// Idle: slow breathing, weight shift and head movement. Monsters hunch and tilt their heads.
export function idlePose(B, t, w, monster) {
  if (w <= 0.001) return;
  const br = Math.sin(t * 1.6) * 0.025, sway = Math.sin(t * 0.55);
  add(B.chest, br, 0, 0, w); add(B.spine, monster ? 0.18 : 0.03, 0, sway * 0.02, w);
  add(B.neck, monster ? -0.1 : 0, Math.sin(t * 0.37) * 0.25, 0, w);
  add(B.head, br * 0.5, Math.sin(t * 0.23 + 1) * 0.15, monster ? 0.14 + Math.sin(t * 0.7) * 0.05 : 0, w);
  add(B.rFore, -0.15 - br, 0, 0, w); add(B.lFore, -0.15 - br, 0, 0, w);
  // hold the arms just off the hips so the hands rest beside the jacket, not inside it
  add(B.rArm, 0.03, 0, 0.12 + br * 0.3, w); add(B.lArm, 0.03, 0, -0.12 - br * 0.3, w);
  add(B.hips, 0, 0, sway * 0.025, w);
}

// Locomotion arms, applied on top of the relaxed hanging idle arms (the caller swaps the clip's
// arms out). swing = -1..1 (right knee ahead = +1, phase-locked to the clip), run = 0 walk .. 1 sprint.
// Walk: arms swing loosely from the shoulder with soft elbows.
// Run: elbows at ~85°, fists pumping from the hip to chest height (elbow closing on the forward
// swing), arms tucked close to the body, a slight forward lean and shoulders counter-rotating
// against the hips while the head stays steady.
export function runArms(B, swing, run, w) {
  if (w <= 0.001) return;
  const fwdAmp = 0.3 + run * 0.12, backAmp = 0.32 + run * 0.4; // swings further back than forward
  const bend = 0.22 + run * 1.05;            // elbow bend
  const out = 0.08 + run * 0.04;             // keep the arms clear of the jacket / hips
  const fwdR = Math.max(0, -swing), fwdL = Math.max(0, swing); // how far each arm is in its forward swing
  const sw = (v) => v * (v > 0 ? backAmp : fwdAmp);
  add(B.rArm, sw(swing), 0, out, w);
  add(B.lArm, sw(-swing), 0, -out, w);
  add(B.rFore, -bend - fwdR * (0.12 + 0.15 * run), 0, 0, w);
  add(B.lFore, -bend - fwdL * (0.12 + 0.15 * run), 0, 0, w);
  add(B.rHand, -0.1 * run, 0, 0, w); add(B.lHand, -0.1 * run, 0, 0, w);
  const twist = swing * (0.03 + 0.06 * run);
  add(B.spine, 0.06 * run, -twist, 0, w);
  add(B.neck, -0.05 * run, twist * 0.8, 0, w);
}

// Self-heal: half-kneeling, hunched over the wound, both hands pressing and dressing it.
export function mendPose(B, t, w) {
  if (w <= 0.001) return;
  const rub = Math.sin(t * 4.5) * 0.1;
  add(B.spine, 0.35, 0.1, 0, w); add(B.neck, 0.15, 0, 0, w); add(B.head, 0.3, -0.15, 0, w);
  add(B.rArm, -0.75, 0, -0.3, w); add(B.rFore, -1.6 + rub, 0, 0, w);
  add(B.lArm, -0.6, 0, 0.35, w); add(B.lFore, -1.75 - rub * 0.6, 0, 0, w);
  add(B.rUp, -0.55, 0, 0, w); add(B.lUp, -0.4, 0, 0, w);
  add(B.rLeg, 1.0, 0, 0, w); add(B.lLeg, 0.8, 0, 0, w);
}

// Belly crawl: body prone (pitched by the caller), alternating arm reaches and frog-leg pushes.
export function crawlPose(B, t, speed, w) {
  const mv = Math.min(1, speed / 0.5), c = t * (2 + speed * 3), s = Math.sin(c), k = Math.cos(c);
  add(B.neck, -0.7, 0, 0, w); add(B.head, -0.5, s * 0.1 * mv, 0, w);
  add(B.spine, -0.15, 0, s * 0.12 * mv, w);
  add(B.rArm, -2.2 + s * 0.5 * mv, 0, 0.25, w); add(B.lArm, -2.2 - s * 0.5 * mv, 0, -0.25, w);
  add(B.rFore, -0.3 - Math.max(0, k) * 0.8 * mv, 0, 0, w); add(B.lFore, -0.3 - Math.max(0, -k) * 0.8 * mv, 0, 0, w);
  add(B.rUp, 0.1 - Math.max(0, s) * 0.7 * mv, 0, 0.3, w); add(B.lUp, 0.1 - Math.max(0, -s) * 0.7 * mv, 0, -0.3, w);
  add(B.rLeg, 0.4 + Math.max(0, s) * 1.2 * mv, 0, 0, w); add(B.lLeg, 0.4 + Math.max(0, -s) * 1.2 * mv, 0, 0, w);
}

// Downed: dragging on the stomach — one arm claws forward, the other clutches the wound.
export function downedPose(B, t, speed, w) {
  const mv = Math.min(1, speed / 0.3), s = Math.sin(t * 2.4);
  add(B.neck, -0.6, 0, 0, w); add(B.head, -0.4, 0.25, 0, w);
  add(B.spine, -0.1, 0.15, 0.1, w);
  add(B.rArm, -2.1 + s * 0.6 * mv, 0, 0.2, w); add(B.rFore, -0.3 - Math.max(0, s) * 1.0 * mv, 0, 0, w);
  add(B.lArm, -0.6, 0, 0.5, w); add(B.lFore, -1.8, 0, 0, w);
  add(B.rUp, -Math.max(0, s) * 0.5 * mv, 0, 0.15, w); add(B.rLeg, 0.4 + Math.max(0, s) * 0.8 * mv, 0, 0, w);
  add(B.lLeg, 0.15, 0, 0, w);
}

// Carried over the shoulder: jack-knifed, arms & head dangling, legs over the chest. Wiggling thrashes.
export function carriedPose(B, t, wiggle, w) {
  const sway = Math.sin(t * 3.2) * 0.12, th = wiggle > 0.02 ? Math.sin(t * 13) * 0.35 * Math.min(1, wiggle * 3 + 0.3) : 0;
  add(B.spine, 0.9 + th * 0.3, th * 0.6, 0, w); add(B.neck, 0.5, 0, 0, w); add(B.head, 0.5 + sway, 0, 0, w);
  add(B.rArm, -2.5 + sway + th, 0, 0.2, w); add(B.lArm, -2.5 - sway - th, 0, -0.2, w);
  add(B.rUp, -1.4 + th, 0, 0, w); add(B.lUp, -1.4 - th, 0, 0, w);
  add(B.rLeg, 1.2 + Math.max(0, th), 0, 0, w); add(B.lLeg, 1.2 + Math.max(0, -th), 0, 0, w);
}

// Monster carrying: left arm clamps the victim on the shoulder; leans forward under the weight.
export function carrierPose(B, w) {
  add(B.spine, 0.2, 0, 0, w);
  add(B.lArm, -2.4, 0, 0.5, w); add(B.lFore, -1.5, 0, 0, w);
}

// Airborne (fallback when a rig has no jump clip): knees tucked, arms out. k = jump progress 0..1.
export function jumpPose(B, k, w) {
  const tuck = Math.sin(Math.min(1, Math.max(0, k)) * Math.PI);
  add(B.rUp, -1.0 * tuck, 0, 0, w); add(B.lUp, -0.6 * tuck, 0, 0, w);
  add(B.rLeg, 1.3 * tuck, 0, 0, w); add(B.lLeg, 1.0 * tuck, 0, 0, w);
  add(B.rArm, -0.5, 0, 0.6, w * tuck); add(B.lArm, -0.5, 0, -0.6, w * tuck);
  add(B.spine, 0.2 * tuck, 0, 0, w);
}

// Hanging from the noose: arms raised & bound, head slumped, legs limp, slow sway.
export function hangPose(B, t, w) {
  const s = Math.sin(t * 1.3) * 0.08;
  add(B.rArm, -2.7, 0, -0.15, w); add(B.lArm, -2.7, 0, 0.15, w);
  add(B.head, 0.6 + s, 0.2, 0, w); add(B.spine, -0.05, 0, s, w);
  add(B.rUp, s, 0, 0, w); add(B.lUp, -s, 0, 0, w); add(B.rLeg, 0.25, 0, 0, w); add(B.lLeg, 0.15, 0, 0, w);
}

// Tripped: k = 0..1 through the fall. Stumble & pitch forward (0-0.22), sprawled on the hands
// (0.22-0.7), then push up and scramble back onto the feet (0.7-1). fallProne = whole-body pitch.
export function fallProne(k) {
  if (k < 0.22) return (k / 0.22) * 0.85;
  if (k < 0.7) return 0.85;
  return 0.85 * (1 - (k - 0.7) / 0.3);
}
export function fallPose(B, k, t, w) {
  const brace = k < 0.7 ? Math.min(1, k / 0.18) : 1 - (k - 0.7) / 0.3;
  const push = k > 0.62 ? Math.sin(Math.min(1, (k - 0.62) / 0.38) * Math.PI) : 0;
  const shake = k > 0.25 && k < 0.7 ? Math.sin(t * 9) * 0.06 : 0;
  add(B.neck, -0.6 * brace, 0, 0, w); add(B.head, -0.35 * brace + shake, 0.2 * brace, 0, w);
  add(B.rArm, -1.7 * brace, 0, 0.3 * brace, w); add(B.lArm, -1.7 * brace, 0, -0.3 * brace, w);
  add(B.rFore, -0.3 * brace, 0, 0, w); add(B.lFore, -0.3 * brace, 0, 0, w);
  add(B.rUp, -0.25 * brace - 1.1 * push, 0, 0.1, w); add(B.lUp, 0.15 * brace, 0, -0.1, w);
  add(B.rLeg, 0.5 * brace + 1.3 * push, 0, 0, w); add(B.lLeg, 0.7 * brace, 0, 0, w);
  add(B.spine, 0.15 * brace, 0, shake, w);
}
