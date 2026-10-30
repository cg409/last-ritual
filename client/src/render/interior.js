// Interiors: furniture for the mansion and farmhouses (layout from shared/interior.js), the old
// mansion corridor (oak wainscoting on every inner wall, a long runner rug, gilt-framed portraits,
// brass candle sconces) plus warm light sources — sconces, two chandeliers, the fireplaces and a
// farmhouse oil lamp — so the houses are gloomy but readable. Lights die during a blackout.
import * as THREE from 'three';
import { pbr } from './assets.js';
import { Batch } from './buildings.js';
import { FLOOR0, FLOOR1 } from '@shared/levels.js';
import { WALL_T } from '@shared/buildings.js';
import { buildPiece } from './interiorParts.js';
import { vlight } from './lights.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });

function materials() {
  return {
    wood: pbr('dark_wooden_planks', 1, { color: 0xb08262 }), wood2: pbr('dark_wooden_planks', 1, { color: 0x8a6448 }),
    stone: pbr('castle_wall_slates', 1, { color: 0x7a7672 }), soot: std(0x0c0a08, { roughness: 1 }),
    cloth: std(0x4a3a2e, { roughness: 1 }), velvet: std(0x4a1418, { roughness: 0.9 }), sheet: std(0x8a8476, { roughness: 1 }),
    paper: std(0xc8bc9c, { roughness: 0.9 }), brass: std(0x9a7a3a, { roughness: 0.35, metalness: 0.9 }),
    iron: std(0x22201e, { roughness: 0.6, metalness: 0.7 }), black: std(0x0e0c0c, { roughness: 0.3 }),
    mirror: std(0x58646c, { roughness: 0.08, metalness: 0.9 }), rug: std(0x5a1a18, { roughness: 1 }), rugEdge: std(0x8a6a2a, { roughness: 1 }),
    books: [0x5a1a14, 0x1e3a24, 0x2a2a4a, 0x6a5a3a, 0x3a2414].map((c) => std(c, { roughness: 0.9 })),
    flame: new THREE.MeshBasicMaterial({ color: 0xffc070 }),
    canvas: [0x3a2a20, 0x2a2622, 0x40302a, 0x24201e].map((c) => std(c, { roughness: 0.9 })),
  };
}

export function buildInterior(root, map) {
  const M = materials(), B = new Batch(), g = new THREE.Group(); root.add(g);
  const lights = [];
  for (const it of map.furniture || []) buildPiece(B, it, it.lv ? FLOOR1 : FLOOR0, M);
  const flame = (x, y, z) => { const f = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), M.flame); f.scale.y = 1.8; f.position.set(x, y, z); g.add(f); return f; };
  const light = (x, y, z, i, d, color = 0xffa050, fl = 0.6) => { const l = vlight(color, i, d, 2); l.position.set(x, y, z); l.flicker = fl; g.add(l); lights.push({ l, base: i }); return l; };

  const m = map.buildings.find((b) => b.id === 'mansion');
  if (m) {
    for (const s of m.segments) { // oak wainscot + dado rail on every inner wall (both faces)
      if (s.exterior || s.kind === 'door' || s.kind === 'gap') continue;
      // (walls running E-W and N-S get slightly different heights/thicknesses so where they cross the
      // tops and faces never share a plane — no z-fighting flicker at the junctions)
      const k = s.alongX ? 0 : 0.012;
      const w = s.alongX ? s.len : WALL_T + 0.05 + k, d = s.alongX ? WALL_T + 0.05 : s.len;
      B.box(M.wood2, w, 1.0 + k, d, s.x, FLOOR0 + 0.5 + k / 2, s.z, 0, 0, 0, 1);
      B.box(M.wood, s.alongX ? s.len : WALL_T + 0.09 + k, 0.06, s.alongX ? WALL_T + 0.09 : s.len, s.x, FLOOR0 + 1.02 + k, s.z, 0, 0, 0, 1);
    }
    const c = m.corridor, cz = m.z + (c.z0 + c.z1) / 2, x0 = m.x - m.w / 2 + 0.6, x1 = m.x + m.w / 2 - 0.6;
    B.box(M.rug, x1 - x0, 0.015, 1.25, (x0 + x1) / 2, FLOOR0 + 0.008, cz, 0, 0, 0, 1);         // runner
    for (const sz of [-1, 1]) B.box(M.rugEdge, x1 - x0, 0.017, 0.08, (x0 + x1) / 2, FLOOR0 + 0.009, cz + sz * 0.6, 0, 0, 0, 1);
    // Portraits & sconces on the corridor walls (on the corridor-facing side).
    let k = 0;
    for (const s of m.segments) {
      if (s.exterior || !s.alongX || s.kind !== 'wall' || Math.abs(Math.abs(s.z - m.z) - 1.2) > 0.05) continue;
      const face = Math.sign(m.z - s.z) || 1, zf = s.z + face * (WALL_T / 2 + 0.03);
      if (k++ % 2 === 0) { // gilt frame + dark canvas
        const pw = 0.8 + Math.random() * 0.3, ph = 1.0 + Math.random() * 0.3;
        B.box(M.brass, pw + 0.12, ph + 0.12, 0.05, s.x, FLOOR0 + 1.85, zf, 0.04 * face, 0, (Math.random() - 0.5) * 0.06, 1);
        B.box(M.canvas[k % M.canvas.length], pw, ph, 0.02, s.x, FLOOR0 + 1.85, zf + face * 0.03, 0.04 * face, 0, 0, 1);
      } else { // brass sconce with a candle
        B.box(M.brass, 0.1, 0.18, 0.06, s.x, FLOOR0 + 1.75, zf, 0, 0, 0, 1);
        B.box(M.brass, 0.04, 0.04, 0.18, s.x, FLOOR0 + 1.78, zf + face * 0.1, 0, 0, 0, 1);
        B.box(M.paper, 0.035, 0.12, 0.035, s.x, FLOOR0 + 1.86, zf + face * 0.18, 0, 0, 0, 1);
        flame(s.x, FLOOR0 + 1.95, zf + face * 0.18);
        if (k % 4 === 1) light(s.x, FLOOR0 + 1.95, zf + face * 0.3, 2.4, 9);
      }
    }
    // A dim oil-lamp glow in every other room (library, stair hall, study, sitting room, loft corners).
    for (const [rx, rz, lv] of [[-8.4, -4.8, 0], [0, -4.2, 0], [9, -4.8, 0], [8.4, 4.8, 0], [-8, -4, 1], [8, -4, 1], [-8, 4.5, 1], [8, 4.5, 1]]) {
      const y = (lv ? FLOOR1 : FLOOR0) + 2.3;
      light(m.x + rx, y, m.z + rz, 1.8, 9, 0xffa860, 0.3);
    }
    // Chandeliers: entrance hall and dining room, plus an upstairs one.
    for (const [cx, cz2, y] of [[0, 4.8, FLOOR0 + 2.75], [-8.4, 5.2, FLOOR0 + 2.75], [0, 1.0, FLOOR1 + 2.8]]) {
      const X = m.x + cx, Z = m.z + cz2;
      B.box(M.iron, 0.02, 0.5, 0.02, X, y + 0.35, Z, 0, 0, 0, 1);
      const ring = new THREE.TorusGeometry(0.45, 0.025, 6, 20); ring.rotateX(Math.PI / 2); ring.translate(X, y, Z); B.add(M.brass, ring);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, px = X + Math.cos(a) * 0.45, pz = Z + Math.sin(a) * 0.45; B.box(M.paper, 0.04, 0.12, 0.04, px, y + 0.08, pz, 0, 0, 0, 1); flame(px, y + 0.18, pz); }
      light(X, y - 0.1, Z, 3.6, 13, 0xffb060, 0.25);
    }
  }
  for (const it of map.furniture || []) { // fire glow; oil lamp on farmhouse tables
    if (it.kind === 'fireplace') light(it.x + Math.sin(it.rot) * 0.6, FLOOR0 + 0.5, it.z + Math.cos(it.rot) * 0.6, 2.2, 8, 0xff7a30, 1);
    if (it.kind === 'table' && !it.lv && it.building !== 'mansion') {
      B.box(M.brass, 0.12, 0.05, 0.12, it.x, FLOOR0 + 0.83, it.z, 0, 0, 0, 1); flame(it.x, FLOOR0 + 0.98, it.z);
      light(it.x, FLOOR0 + 1.1, it.z, 1.6, 7, 0xffa040, 0.5);
    }
  }
  B.flush(g);
  return {
    group: g,
    update(dt, t, snap) { for (const { l, base } of lights) l.intensity = snap?.blackout ? 0 : base; },
  };
}
