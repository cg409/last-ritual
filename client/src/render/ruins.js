// Tall thick perimeter wall (buttresses, merlons), ruined stone walls, sheds and broken fences.
import * as THREE from 'three';
import { pbr } from './assets.js';
import { uvBox, sh } from './buildingParts.js';
import { BOUNDARY_WALL } from '@shared/map.js';

export function buildPerimeter(group, map) {
  const { height: h, thickness: t } = BOUNDARY_WALL;
  const mat = pbr('mossy_stone_wall', 1, { color: 0x8a8a8a });
  for (const r of map.rects.filter((r) => r.type === 'boundary')) {
    const w = sh(new THREE.Mesh(uvBox(r.hw * 2, h, r.hd * 2, 3), mat)); w.position.set(r.x, h / 2, r.z); group.add(w);
    const alongX = r.hw > r.hd, len = alongX ? r.hw * 2 : r.hd * 2;
    if (len < 4) continue;
    for (let s = -len / 2 + 2; s < len / 2; s += 8) {
      const bx = alongX ? r.x + s : r.x, bz = alongX ? r.z : r.z + s;
      const inward = alongX ? -Math.sign(r.z) : -Math.sign(r.x);
      const but = sh(new THREE.Mesh(uvBox(alongX ? 1.4 : 1.6, h * 0.8, alongX ? 1.6 : 1.4, 2), mat));
      but.position.set(bx + (alongX ? 0 : inward * (t / 2 + 0.6)), h * 0.4, bz + (alongX ? inward * (t / 2 + 0.6) : 0)); group.add(but);
      const mer = sh(new THREE.Mesh(uvBox(alongX ? 1.6 : t, 1, alongX ? t : 1.6, 2), mat));
      mer.position.set(bx, h + 0.5, bz); group.add(mer);
    }
  }
}

export function buildRuins(group, map) {
  const stone = pbr('mossy_stone_wall', 1), wood = pbr('weathered_plank_siding', 1, { color: 0x7a7870 }), roof = pbr('roof_slates_02', 1, { color: 0x5a5a60 });
  for (const r of map.rects) {
    if (r.type === 'wall' || r.type === 'gatepost') {
      const m = sh(new THREE.Mesh(uvBox(r.hw * 2, r.h, r.hd * 2, 2), stone)); m.position.set(r.x, r.h / 2, r.z); group.add(m);
      if (r.type === 'gatepost') continue;
      const alongX = r.hw > r.hd, len = Math.max(r.hw, r.hd) * 2;
      for (let i = 0; i < len / 1.2; i++) { // broken, uneven top stones
        if (Math.random() < 0.3) continue;
        const c = sh(new THREE.Mesh(uvBox(0.5 + Math.random() * 0.5, 0.25 + Math.random() * 0.5, Math.min(r.hw, r.hd) * 2 + 0.05, 1), stone));
        const off = -len / 2 + 0.6 + i * 1.2;
        c.position.set(r.x + (alongX ? off : 0), r.h + 0.15, r.z + (alongX ? 0 : off)); c.rotation.y = alongX ? 0 : Math.PI / 2; group.add(c);
      }
    } else if (r.type === 'shed') {
      const m = sh(new THREE.Mesh(uvBox(r.hw * 2, r.h, r.hd * 2, 2), wood)); m.position.set(r.x, r.h / 2, r.z); group.add(m);
      const rf = sh(new THREE.Mesh(uvBox(r.hw * 2 + 0.6, 0.15, r.hd * 2 + 0.6, 2), roof)); rf.position.set(r.x, r.h + 0.3, r.z); rf.rotation.x = 0.18; group.add(rf);
    } else if (r.type === 'fence') {
      const alongX = r.hw > r.hd, len = Math.max(r.hw, r.hd) * 2;
      for (let i = 0; i <= len; i += 1.2) {
        if (Math.random() < 0.15) continue;
        const post = sh(new THREE.Mesh(uvBox(0.14, r.h + Math.random() * 0.3, 0.14, 1), wood));
        post.position.set(r.x + (alongX ? i - len / 2 : 0), r.h / 2, r.z + (alongX ? 0 : i - len / 2)); post.rotation.z = (Math.random() - 0.5) * 0.2; group.add(post);
      }
      for (const y of [0.4, 0.85]) {
        const rail = sh(new THREE.Mesh(uvBox(alongX ? len : 0.07, 0.12, alongX ? 0.07 : len, 1), wood));
        rail.position.set(r.x, y, r.z); rail.rotation[alongX ? 'z' : 'x'] = (Math.random() - 0.5) * 0.06; group.add(rail);
      }
    }
  }
}
