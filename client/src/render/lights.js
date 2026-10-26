// Virtual light sources + a fixed pool of real PointLights (avoids shader recompiles when
// candles/lanterns appear & disappear). Each frame the nearest/brightest sources get real lights.
import * as THREE from 'three';

const registry = new Set();

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
  }

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
        cands.push({ v, pos: this.tmp.clone(), score: d - v.intensity * 0.5 });
      }
      cands.sort((a, b) => a.score - b.score);
    }
    this.lights.forEach((l, i) => {
      const c = cands[i];
      if (!c) { l.intensity = 0; return; }
      l.position.copy(c.pos);
      l.color.copy(c.v.color);
      const fl = c.v.flicker ? 1 - c.v.flicker * (0.5 + 0.5 * Math.sin(t * 23 + i * 7) * Math.sin(t * 13.7 + i)) * 0.5 : 1;
      l.intensity = c.v.intensity * fl;
      l.distance = c.v.distance; l.decay = c.v.decay;
    });
  }
}
