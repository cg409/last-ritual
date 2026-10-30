// Survival Instinct perk: while the monster is chasing you, nearby escape tools — standing pallets,
// push-down logs and broken windows — are outlined (seen through walls, fading in and out).
import * as THREE from 'three';
import { terrainY, FLOOR1 } from '@shared/levels.js';
import { dist } from '@shared/rng.js';

export class Instinct {
  constructor(root, map) {
    this.mat = new THREE.LineBasicMaterial({ color: 0xf2e6b0, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false });
    this.items = [];
    const box = (w, h, d) => new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
    for (const p of map.pallets) {
      const log = p.kind === 'log', h = log ? 2.4 : 1.25, w = log ? 0.5 : 1.0;
      const ln = new THREE.LineSegments(box(p.alongX ? 0.35 : w, h, p.alongX ? w : 0.35), this.mat);
      const off = p.side * (p.gap / 2 - 0.1);
      ln.position.set(p.x + (p.alongX ? off : 0), terrainY(p.x, p.z) + h / 2, p.z + (p.alongX ? 0 : off));
      ln.renderOrder = 997; ln.visible = false; root.add(ln);
      this.items.push({ ln, x: p.x, z: p.z, pallet: p.id });
    }
    for (const w of map.windows || []) {
      const ln = new THREE.LineSegments(box(w.alongX ? w.gap : 0.7, w.h - w.sill - 0.5, w.alongX ? 0.7 : w.gap), this.mat);
      ln.position.set(w.x, terrainY(w.x, w.z) + (w.sill + w.h - 0.5) / 2, w.z);
      ln.renderOrder = 997; ln.visible = false; root.add(ln);
      this.items.push({ ln, x: w.x, z: w.z });
    }
    for (const h of map.hides || []) { // cupboards and porta-potties
      const pot = h.kind === 'potty', ln = new THREE.LineSegments(box(pot ? 1.3 : 1.05, pot ? 2.4 : 2.2, pot ? 1.3 : 0.66), this.mat);
      ln.position.set(h.x, (h.level ? FLOOR1 : terrainY(h.x, h.z)) + (pot ? 1.2 : 1.1), h.z); ln.rotation.y = h.rot;
      ln.renderOrder = 997; ln.visible = false; root.add(ln);
      this.items.push({ ln, x: h.x, z: h.z });
    }
    this.k = 0;
  }

  update(dt, me, mon, snap) {
    const lv = me?.role === 'survivor' && me.state === 'alive' ? me.perks?.instinct : 0;
    const chased = lv && mon && dist(me.x, me.z, mon.x, mon.z) < 16 && !mon.disguise;
    this.k += ((chased ? 1 : 0) - this.k) * Math.min(1, dt * 4);
    this.mat.opacity = this.k * (0.55 + Math.sin(performance.now() / 180) * 0.15);
    const R = [18, 24, 30][(lv || 1) - 1];
    const state = new Map((snap.pallets || []).map((p) => [p.id, p.state]));
    for (const it of this.items) {
      it.ln.visible = this.k > 0.02 && dist(me.x, me.z, it.x, it.z) < R && (it.pallet == null || state.get(it.pallet) === 'up');
    }
  }
}
