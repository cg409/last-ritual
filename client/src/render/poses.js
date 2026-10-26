// Procedural animation layers added on top of the mixer clip (Mixamo rig), weighted 0..1.
// Axis behaviour measured on this rig: UpLeg -x lifts the knee forward, Leg +x bends the knee,
// Arm -x raises the arm forward, Spine +x bends forward, ForeArm z bends the elbow.

function add(bone, x, y, z, w) {
  if (!bone || w <= 0.001) return;
  bone.rotation.x += x * w; bone.rotation.y += y * w; bone.rotation.z += z * w;
}

// Belly crawl: body prone (tilted by the caller), alternating arm reaches and frog-leg pushes.
export function crawlPose(B, t, speed, w) {
  const mv = Math.min(1, speed / 0.5), c = t * (2 + speed * 3), s = Math.sin(c), k = Math.cos(c);
  add(B.neck, -0.7, 0, 0, w); add(B.head, -0.5, s * 0.1 * mv, 0, w);
  add(B.spine, -0.15, 0, s * 0.12 * mv, w);
  add(B.rArm, -1.9 + s * 0.5 * mv, 0, 0.3, w); add(B.lArm, -1.9 - s * 0.5 * mv, 0, -0.3, w);
  add(B.rFore, 0, 0, -0.4 - Math.max(0, k) * 0.8 * mv, w); add(B.lFore, 0, 0, 0.4 + Math.max(0, -k) * 0.8 * mv, w);
  add(B.rUp, 0.15 - Math.max(0, s) * 0.7 * mv, 0, 0.35, w); add(B.lUp, 0.15 - Math.max(0, -s) * 0.7 * mv, 0, -0.35, w);
  add(B.rLeg, 0.4 + Math.max(0, s) * 1.2 * mv, 0, 0, w); add(B.lLeg, 0.4 + Math.max(0, -s) * 1.2 * mv, 0, 0, w);
}

// Downed: dragging on the stomach — one arm claws forward, the other clutches the wound.
export function downedPose(B, t, speed, w) {
  const mv = Math.min(1, speed / 0.3), s = Math.sin(t * 2.4);
  add(B.neck, -0.6, 0, 0, w); add(B.head, -0.4, 0.25, 0, w);
  add(B.spine, -0.1, 0.15, 0.1, w);
  add(B.rArm, -1.8 + s * 0.6 * mv, 0, 0.2, w); add(B.rFore, 0, 0, -0.3 - Math.max(0, s) * 1.0 * mv, w);
  add(B.lArm, 0.4, 0, 0.9, w); add(B.lFore, 0, 0, 1.6, w);
  add(B.rUp, -Math.max(0, s) * 0.5 * mv, 0, 0.15, w); add(B.rLeg, 0.4 + Math.max(0, s) * 0.8 * mv, 0, 0, w);
  add(B.lLeg, 0.15, 0, 0, w);
}

// Carried over the shoulder: jack-knifed, arms & head dangling down the back, legs over the chest.
// Wiggling makes the body thrash.
export function carriedPose(B, t, wiggle, w) {
  const sway = Math.sin(t * 3.2) * 0.12, th = wiggle > 0.02 ? Math.sin(t * 13) * 0.35 * Math.min(1, wiggle * 3 + 0.3) : 0;
  add(B.spine, 0.9 + th * 0.3, th * 0.6, 0, w); add(B.neck, 0.5, 0, 0, w); add(B.head, 0.5 + sway, 0, 0, w);
  add(B.rArm, 0.4 + sway + th, 0, -1.0, w); add(B.lArm, 0.4 - sway - th, 0, 1.0, w);
  add(B.rUp, -1.4 + th, 0, 0, w); add(B.lUp, -1.4 - th, 0, 0, w);
  add(B.rLeg, 1.2 + Math.max(0, th), 0, 0, w); add(B.lLeg, 1.2 + Math.max(0, -th), 0, 0, w);
}

// Monster carrying: left arm clamps the victim on the shoulder; leans forward under the weight.
export function carrierPose(B, w) {
  add(B.spine, 0.2, 0, 0, w);
  add(B.lArm, -1.6, 0, -0.6, w); add(B.lFore, 0, 0, 1.6, w);
}

// Airborne: knees tucked, arms out for balance. k = jump progress 0..1.
export function jumpPose(B, k, w) {
  const tuck = Math.sin(Math.min(1, Math.max(0, k)) * Math.PI);
  add(B.rUp, -1.0 * tuck, 0, 0, w); add(B.lUp, -0.6 * tuck, 0, 0, w);
  add(B.rLeg, 1.3 * tuck, 0, 0, w); add(B.lLeg, 1.0 * tuck, 0, 0, w);
  add(B.rArm, -0.5, 0, -0.6, w * tuck); add(B.lArm, -0.5, 0, 0.6, w * tuck);
  add(B.spine, 0.2 * tuck, 0, 0, w);
}

// Hanging from the noose: arms raised & bound, head slumped, legs limp, slow sway.
export function hangPose(B, t, w) {
  const s = Math.sin(t * 1.3) * 0.08;
  add(B.rArm, -2.6, 0, 0.2, w); add(B.lArm, -2.6, 0, -0.2, w);
  add(B.head, 0.6 + s, 0.2, 0, w); add(B.spine, -0.05, 0, s, w);
  add(B.rUp, s, 0, 0, w); add(B.lUp, -s, 0, 0, w); add(B.rLeg, 0.25, 0, 0, w); add(B.lLeg, 0.15, 0, 0, w);
}
