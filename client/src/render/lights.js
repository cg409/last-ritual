// Virtual light sources + a fixed pool of real PointLights (avoids shader recompiles when
// candles/lanterns appear & disappear). Each frame the nearest/brightest sources get real lights.
import * as THREE from 'three';

const registry = new Set();
const BOOST = { i: 2.2, d: 1.6, decay: 1.6 };

export class VLight extends THREE.Object3D {
  constructor(color = 0xffffff, intensity = 1, distance = 10, decay = 2) {
    super();
    this.isVLight = true;
    this.color = new THREE.Color(color);
    this.intensity = intensity; this.distance = distance; this.decay = decay;
    this.flicker = 0; // 0..1 random flicker amount (flames)
    registry.add(this);
  }
  dispose() { registry.delete(this); this.removeFromParent(); }
}
export const vlight = (c, i, d, dec) => new VLight(c, i, d, dec);

// 1 = visible in scene, 0 = hidden in scene, -1 = detached from scene (drop from registry)
function attached(o, scene) {
  let vis = true, n = o;
  for (; n.parent; n = n.parent) if (!n.visible) vis = false;
  if (n !== scene) return -1;
  return vis ? 1 : 0;
}

export class LightPool {
  constructor(scene, size = 12) {
    this.scene = scene;
    this.lights = [];
    for (let i = 0; i < size; i++) {
      const l = new THREE.PointLight(0x000000, 0, 1, 2);
      scene.add(l); this.lights.push(l);
    }
    this.tmp = new THREE.Vector3();
    this.enabled = true;
    this.size = size;
  }

  setSize(n) { this.size = Math.min(n, this.lights.length); }

  update(camPos, t) {
    const cands = [];
    if (this.enabled) {
      for (const v of registry) {
        const a = attached(v, this.scene);
        if (a === -1) continue; // not (yet) in the scene — disposed lights are removed via dispose()
        if (v.intensity <= 0.001 || a === 0) continue;
        v.getWorldPosition(this.tmp);
        const d = this.tmp.distanceTo(camPos);
        if (d > v.distance + 45) continue;
        // Hysteresis: a source that already owns a real light keeps it unless clearly beaten,
        // so lights don't pop on/off (and surfaces don't flash) as the camera moves around.
        cands.push({ v, pos: this.tmp.clone(), score: d - v.intensity * 0.5 - (v._slot != null ? 10 : 0) });
      }
      cands.sort((a, b) => a.score - b.score);
    }
    const chosen = cands.slice(0, this.size);
    const keep = new Set(chosen.map((c) => c.v));
    // Sources keep the same physical light slot when they stay selected.
    const slots = new Array(this.lights.length).fill(null);
    for (const c of chosen) if (c.v._slot != null && c.v._slot < this.size && !slots[c.v._slot]) slots[c.v._slot] = c;
    for (const c of chosen) {
      if (slots.includes(c)) continue;
      const i = slots.findIndex((s, k) => !s && k < this.size); if (i >= 0) slots[i] = c;
    }
    for (const v of registry) if (v._slot != null && !keep.has(v)) v._slot = null;
    this.lights.forEach((l, i) => {
      const c = slots[i];
      if (!c) { l.intensity *= 0.88; if (l.intensity < 0.01) l.intensity = 0; return; } // fade out gently (no popping walls)
      const fresh = c.v._slot !== i;
      c.v._slot = i;
      l.position.copy(c.pos);
      l.color.copy(c.v.color);
      const fl = c.v.flicker ? 1 - c.v.flicker * (0.5 + 0.5 * Math.sin(t * 23 + i * 7) * Math.sin(t * 13.7 + i)) * 0.5 : 1;
      // Boost: lamps and flames actually light their surroundings (reach further, fall off softer).
      const want = c.v.intensity * fl * BOOST.i;
      l.intensity = fresh ? want * 0.1 : l.intensity + (want - l.intensity) * 0.12; // fade in new sources slowly
      l.distance = c.v.distance * BOOST.d; l.decay = Math.min(c.v.decay, BOOST.decay);
    });
  }
}
