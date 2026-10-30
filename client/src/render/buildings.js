// Renders the shared building layouts: textured wall bays (solid / window / door / broken / gap),
// walkable upper floors with a stairwell opening and real steps, roofs, porches, and wrecked
// roofless farmhouses with ragged walls and rubble. Static geometry is merged per material
// (a building costs a handful of draw calls). Details live in buildingParts.js / stairs.js.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { pbr } from './assets.js';
import { WALL_T, STORY_HEIGHT } from '@shared/buildings.js';
import { FLOOR0, FLOOR1 } from '@shared/levels.js';
import { sh, uvBox, addFrame, addWindow, addRoof, addPorch } from './buildingParts.js';
import { upperFloor, stairs } from './stairs.js';

export function buildBuildings(root, map) {
  const M = {
    mansionWall: pbr('castle_wall_slates', 1, { color: 0x9a9a9a }), houseWall: pbr('weathered_plank_siding', 1, { color: 0x8a8880 }),
    plaster: pbr('damaged_plaster', 1, { color: 0x9a9284 }), floor: pbr('dark_wooden_planks', 1), roof: pbr('roof_slates_02', 1, { color: 0x6a6a70 }),
    trim: pbr('dark_wooden_planks', 1, { color: 0x5a4a3a }), stone: pbr('mossy_stone_wall', 1),
    glass: new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
  };
  for (const b of map.buildings) buildOne(root, b, M);
  return M;
}

// Collects boxes per material and merges them into one mesh each.
export class Batch {
  constructor() { this.lists = new Map(); }
  box(mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0, tile = 2) {
    const g = uvBox(w, h, d, tile);
    if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
    g.translate(x, y, z);
    this.add(mat, g);
  }
  add(mat, g) {
    if (!this.lists.has(mat)) this.lists.set(mat, []);
    this.lists.get(mat).push(g.index ? g.toNonIndexed() : g);
  }
  flush(group) {
    for (const [mat, list] of this.lists) group.add(sh(new THREE.Mesh(mergeGeometries(list), mat)));
    this.lists.clear();
  }
}

function buildOne(root, b, M) {
  const g = new THREE.Group(); root.add(g);
  const B = new Batch(), R = Math.random;
  const wrecked = b.style === 'wrecked';
  const wallMat = b.style === 'mansion' ? M.mansionWall : M.houseWall;
  const H = STORY_HEIGHT, T = WALL_T;
  for (let f = 0; f < b.floors; f++) {
    const y0 = f * H;
    for (const s of b.segments) {
      if (f > 0 && !s.exterior) continue;
      const mat = s.exterior ? wallMat : M.plaster, L = s.len;
      const piece = (len, h, y, off = 0, t = T) => B.box(mat, s.alongX ? len : t, h, s.alongX ? t : len, s.x + (s.alongX ? off : 0), y0 + y + h / 2, s.z + (s.alongX ? 0 : off));
      // ragged columns overlap a little to close the gaps — every other one is a hair thicker so their
      // faces are never in the same plane (that z-fought: flickering stripes on the wrecked walls)
      const cols = (n, hgt) => { for (let i = 0; i < n; i++) piece(L / n + 0.02, hgt * (0.7 + R() * 0.5), 0, -L / 2 + (i + 0.5) * (L / n), T + (i % 2) * 0.016); };
      const kind = f > 0 && s.kind === 'door' ? 'window' : s.kind;
      if (kind === 'gap') { // knocked-out bay: fallen stones at its foot
        for (let i = 0; i < 3; i++) B.box(M.stone, 0.4 + R() * 0.4, 0.25, 0.4, s.x + (R() - 0.5) * L * 0.8, y0 + 0.15, s.z + (R() - 0.5) * 0.9, 0, R() * 3, 0.2, 1);
      } else if (kind === 'broken') cols(4, s.h);       // waist-high jagged stub you can vault
      else if (kind === 'wall') { if (s.vis) cols(3, s.vis); else piece(L, H, 0); }
      else if (kind === 'window') {
        piece(L, 1.0, 0); if (!wrecked) piece(L, H - 2.3, 2.3);
        piece(0.45, wrecked ? 1.6 : 1.3, 1.0, -L / 2 + 0.225); piece(0.45, wrecked ? 1.1 : 1.3, 1.0, L / 2 - 0.225);
        if (!wrecked) addWindow(g, s, y0, L - 0.9, M);
      } else {
        if (!wrecked) piece(L, H - 2.4, 2.4);
        piece(0.5, wrecked ? 2.0 : 2.4, 0, -L / 2 + 0.25); piece(0.5, 2.4, 0, L / 2 - 0.25);
        if (!wrecked) addFrame(g, s, y0, L - 1.0, 2.4, 0, M.trim);
      }
    }
    if (f === 0) B.box(M.floor, b.w, 0.2, b.d, b.x, FLOOR0 - 0.1, b.z, 0, 0, 0, 3);
    else upperFloor(B, b, M, FLOOR1);
  }
  // Foundation plinth: its top sits 3cm BELOW the floorboards (it used to be exactly at FLOOR0,
  // so the stone and the wooden floor z-fought — flickering cobble patches on every floor).
  B.box(M.stone, b.w + 0.4, 0.44, b.d + 0.4, b.x, FLOOR0 - 0.03 - 0.22, b.z, 0, 0, 0, 1.5);
  if (b.stair) stairs(B, b, M);
  if (wrecked) {
    for (const r of b.rubble || []) B.box(M.stone, r.s, r.s * 0.45, r.s * 0.8, r.x, FLOOR0 + r.s * 0.2, r.z, 0.2, r.r, 0.15, 1);
    for (let i = 0; i < 5; i++) // charred, fallen roof beams
      B.box(M.trim, 0.18, 0.18, 2.5 + R() * 2, b.x + (R() - 0.5) * b.w * 0.6, FLOOR0 + 0.25, b.z + (R() - 0.5) * b.d * 0.6, 0, R() * Math.PI, 0.25 * (R() - 0.5), 1);
  }
  B.flush(g);
  if (!wrecked) addRoof(g, b, M);
  if (b.porch) addPorch(g, b, M);
}
