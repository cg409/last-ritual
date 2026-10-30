// Tall thick perimeter wall (buttresses, merlons), ruined stone walls, sheds and broken fences.
import * as THREE from 'three';
import { pbr } from './assets.js';
import { uvBox, sh } from './buildingParts.js';
import { BOUNDARY_WALL } from '@shared/map.js';
import { terrainY } from '@shared/levels.js';

// The ground rolls ±0.25m, so walls and posts get a buried footing instead of standing on y=0
// (otherwise they hover wherever the terrain dips).
const SINK = 0.35;

export function buildPerimeter(group, map) {
  const { height: h, thickness: t } = BOUNDARY_WALL;
  const mat = pbr('mossy_stone_wall', 1, { color: 0x8a8a8a });
  for (const r of map.rects.filter((r) => r.type === 'boundary')) {
    const w = sh(new THREE.Mesh(uvBox(r.hw * 2, h + SINK, r.hd * 2, 3), mat)); w.position.set(r.x, (h - SINK) / 2, r.z); group.add(w);
    const alongX = r.hw > r.hd, len = alongX ? r.hw * 2 : r.hd * 2;
    if (len < 4) continue;
    for (let s = -len / 2 + 2; s < len / 2; s += 8) { // merlons on top
      const bx = alongX ? r.x + s : r.x, bz = alongX ? r.z : r.z + s;
      const mer = sh(new THREE.Mesh(uvBox(alongX ? 1.6 : t, 1, alongX ? t : 1.6, 2), mat));
      mer.position.set(bx, h + 0.5, bz); group.add(mer);
    }
  }
  // buttresses: solid, from the shared map (so what you see is what blocks you)
  for (const r of map.rects.filter((r) => r.type === 'buttress')) {
    const but = sh(new THREE.Mesh(uvBox(r.hw * 2, r.h + SINK, r.hd * 2, 2), mat));
    but.position.set(r.x, (r.h - SINK) / 2, r.z); group.add(but);
  }
}

export function buildRuins(group, map) {
  const stone = pbr('mossy_stone_wall', 1), wood = pbr('weathered_plank_siding', 1, { color: 0x7a7870 }), roof = pbr('roof_slates_02', 1, { color: 0x5a5a60 });
  for (const r of map.rects) {
    if (r.type === 'wall' || r.type === 'gatepost') {
      const m = sh(new THREE.Mesh(uvBox(r.hw * 2, r.h + SINK, r.hd * 2, 2), stone)); m.position.set(r.x, (r.h - SINK) / 2, r.z); group.add(m);
      if (r.type === 'gatepost') continue;
      if (r.ruin && !r.broken) { // escape-wall: a timber lintel frame marks the pallet doorway next to it
        const alongX = r.hw > r.hd;
        const end = (alongX ? r.hw : r.hd) * Math.sign(map.pallets.some((p) => (alongX ? p.x > r.x : p.z > r.z) && Math.abs(alongX ? p.z - r.z : p.x - r.x) < 0.5) ? 1 : -1);
        const post = sh(new THREE.Mesh(uvBox(0.22, r.h + 0.2 + SINK, 0.22, 1), wood));
        post.position.set(r.x + (alongX ? end : 0), (r.h + 0.2 - SINK) / 2, r.z + (alongX ? 0 : end)); group.add(post);
      }
      const alongX = r.hw > r.hd, len = Math.max(r.hw, r.hd) * 2;
      for (let i = 0; i < len / 1.2; i++) { // broken, uneven top stones
        if (Math.random() < 0.3) continue;
        const c = sh(new THREE.Mesh(uvBox(0.5 + Math.random() * 0.5, 0.25 + Math.random() * 0.5, Math.min(r.hw, r.hd) * 2 + 0.05, 1), stone));
        const off = -len / 2 + 0.6 + i * 1.2;
        c.position.set(r.x + (alongX ? off : 0), r.h + 0.15, r.z + (alongX ? 0 : off)); c.rotation.y = alongX ? 0 : Math.PI / 2; group.add(c);
      }
    } else if (r.type === 'sill') { // broken window sill: rough stones, chest high
      const m = sh(new THREE.Mesh(uvBox(r.hw * 2, r.h + SINK, r.hd * 2, 1), stone)); m.position.set(r.x, (r.h - SINK) / 2, r.z); group.add(m);
    } else if (r.type === 'shed') {
      const m = sh(new THREE.Mesh(uvBox(r.hw * 2, r.h + SINK, r.hd * 2, 2), wood)); m.position.set(r.x, (r.h - SINK) / 2, r.z); group.add(m);
      const rf = sh(new THREE.Mesh(uvBox(r.hw * 2 + 0.6, 0.15, r.hd * 2 + 0.6, 2), roof)); rf.position.set(r.x, r.h + 0.3, r.z); rf.rotation.x = 0.18; group.add(rf);
    } else if (r.type === 'fence') {
      const alongX = r.hw > r.hd, len = Math.max(r.hw, r.hd) * 2;
      for (let i = 0; i <= len; i += 1.2) {
        if (Math.random() < 0.15) continue;
        const ph = r.h + Math.random() * 0.3;
        const post = sh(new THREE.Mesh(uvBox(0.14, ph + SINK, 0.14, 1), wood));
        post.position.set(r.x + (alongX ? i - len / 2 : 0), (ph - SINK) / 2, r.z + (alongX ? 0 : i - len / 2)); post.rotation.z = (Math.random() - 0.5) * 0.2; group.add(post);
      }
      for (const y of [0.4, 0.85]) {
        const rail = sh(new THREE.Mesh(uvBox(alongX ? len : 0.07, 0.12, alongX ? 0.07 : len, 1), wood));
        rail.position.set(r.x, y + terrainY(r.x, r.z), r.z); rail.rotation[alongX ? 'z' : 'x'] = (Math.random() - 0.5) * 0.06; group.add(rail);
      }
    }
  }
  // Broken windows: a sagging timber lintel over the opening, splintered frame posts, rubble below.
  for (const w of map.windows || []) {
    const lintel = sh(new THREE.Mesh(uvBox(w.alongX ? w.gap + 0.5 : 0.3, 0.22, w.alongX ? 0.3 : w.gap + 0.5, 1), wood));
    lintel.position.set(w.x, w.h - 0.35, w.z); lintel.rotation[w.alongX ? 'z' : 'x'] = 0.06; group.add(lintel);
    const upper = sh(new THREE.Mesh(uvBox(w.alongX ? w.gap : 0.6, 0.3, w.alongX ? 0.6 : w.gap, 1), stone));
    upper.position.set(w.x, w.h - 0.1, w.z); group.add(upper);
    for (const s of [-1, 1]) {
      const post = sh(new THREE.Mesh(uvBox(0.1, w.h - w.sill - 0.5, 0.1, 1), wood));
      post.position.set(w.x + (w.alongX ? s * (w.gap / 2 - 0.06) : 0), (w.sill + w.h - 0.45) / 2, w.z + (w.alongX ? 0 : s * (w.gap / 2 - 0.06)));
      post.rotation.z = (Math.random() - 0.5) * 0.15; group.add(post);
    }
    for (let i = 0; i < 6; i++) { // rubble from the broken wall
      const c = sh(new THREE.Mesh(uvBox(0.2 + Math.random() * 0.25, 0.12 + Math.random() * 0.15, 0.2 + Math.random() * 0.2, 1), stone));
      const a = (Math.random() - 0.5) * 2.4, o = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6);
      c.position.set(w.x + (w.alongX ? a : o), terrainY(w.x, w.z) + 0.06, w.z + (w.alongX ? o : a)); c.rotation.set(Math.random(), Math.random() * 3, Math.random()); group.add(c);
    }
  }
}
