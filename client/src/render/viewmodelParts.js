// Parts for the first-person monster viewmodel: per-monster weapon, how it is held, and keyframes.
// No hands are drawn: the weapon enters the frame from the lower right and only its top shows
// (like Dead by Daylight). The "hand" is an invisible pivot below the screen edge; animations
// move / rotate that pivot, so swings sweep the weapon's head across the view.
import * as THREE from 'three';


// Camera space: -Z forward, +X right, +Y up (fov 58: at 0.6m depth the frame spans about ±0.33
// vertically and ±0.59 horizontally at 16:9).
// pivot = rest position of the hidden hand, dir = shaft direction (pivot → head),
// spin = roll about the shaft (which way the blade / tines face), reach = pivot → head distance.
export const HOLD = {
  axe:      { pivot: [0.46, -0.52, -0.32], dir: [-0.42, 0.72, -0.55], spin: Math.PI / 2 + 0.3, reach: 0.62, scale: 1 },
  machete:  { pivot: [0.46, -0.5, -0.3], dir: [-0.4, 0.74, -0.52], spin: 0.4, reach: 0.6, scale: 1.05 },
  cleaver:  { pivot: [0.46, -0.5, -0.3], dir: [-0.4, 0.74, -0.52], spin: 0.4, reach: 0.52, scale: 1.1 },
  crowbar:  { pivot: [0.48, -0.55, -0.3], dir: [-0.38, 0.78, -0.5], spin: 0.9, reach: 0.64, scale: 1 },
  bat:      { pivot: [0.5, -0.56, -0.3], dir: [-0.38, 0.78, -0.5], spin: 0.2, reach: 0.66, scale: 1 },
  sledge:   { pivot: [0.5, -0.58, -0.3], dir: [-0.36, 0.78, -0.5], spin: 0.5, reach: 0.64, scale: 1 },
  maul:     { pivot: [0.5, -0.6, -0.3], dir: [-0.34, 0.8, -0.48], spin: 0.2, reach: 0.68, scale: 1 },
  chainsaw: { pivot: [0.36, -0.3, -0.3], dir: [-0.25, 0.3, -0.92], spin: Math.PI / 2, reach: 0.52, scale: 1.0 },
};

const ease = (k) => k * k * (3 - 2 * k);
// Keyframe sampler: keys = [[t, pose], ...], t in 0..1, poses are partial offsets of the pivot.
export function sample(keys, k) {
  if (k <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, a] = keys[i], [t1, b] = keys[i + 1];
    if (k <= t1) {
      const u = ease((k - t0) / (t1 - t0)), o = {};
      for (const n of ['px', 'py', 'pz', 'rx', 'ry', 'rz']) o[n] = (a[n] || 0) + ((b[n] || 0) - (a[n] || 0)) * u;
      return o;
    }
  }
  return keys[keys.length - 1][1];
}
// cock back & up to the right → chop across the view, the head passing through the centre and
// down to the lower left (kept on screen) → follow-through → recover
export const SWING = [[0, {}], [0.26, { py: 0.04, rx: 0.2, rz: -0.2 }], [0.48, { px: -0.2, py: 0.12, pz: -0.05, rx: -0.1, rz: 0.45 }],
  [0.62, { px: -0.28, py: 0.06, pz: -0.05, rx: -0.18, rz: 0.6 }], [1, {}]];
// chainsaw: shove the running bar forward
export const SAW_SWING = [[0, {}], [0.3, { py: 0.03, pz: 0.06, rx: 0.15 }], [0.55, { px: -0.08, py: -0.02, pz: -0.2, rx: -0.3, rz: 0.15 }], [1, {}]];
// trident: from the raised aim pose, draw back further, then hurl forward
export const AIM = { px: -0.04, py: 0.2, pz: 0.12, rx: 0.45, rz: -0.1 };
export const THROW = [[0, AIM], [0.35, { px: -0.03, py: 0.24, pz: 0.2, rx: 0.65, rz: -0.12 }], [0.6, { px: -0.05, py: -0.04, pz: -0.32, rx: -0.55 }], [1, {}]];
// halberd: the puppet-string cast is a straight thrust of the polearm
export const LASH = [[0, {}], [0.3, { py: 0.02, pz: 0.08, rx: 0.2 }], [0.55, { px: -0.06, py: 0.04, pz: -0.3, rx: -0.25 }], [1, {}]];

// Orientation of the weapon inside the pivot: shaft along `dir`, rolled by `spin`.
export function holdQuat(h) {
  const d = new THREE.Vector3(...h.dir).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  return q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), h.spin));
}
