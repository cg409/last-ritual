// Renders the shared building layouts (mansion + farmhouses): textured wall bays (solid / window /
// door), a second storey, floors, roofs and porches. Details live in buildingParts.js.
import * as THREE from 'three';
import { pbr } from './assets.js';
import { WALL_T, STORY_HEIGHT } from '@shared/buildings.js';
import { vlight } from './lights.js';
import { sh, uvBox, addFrame, addWindow, addRoof, addPorch } from './buildingParts.js';

export function buildBuildings(root, map) {
  const M = {
    mansionWall: pbr('castle_wall_slates', 1, { color: 0x9a9a9a }), houseWall: pbr('weathered_plank_siding', 1, { color: 0x8a8880 }),
    plaster: pbr('damaged_plaster', 1, { color: 0x5e5a52 }), floor: pbr('dark_wooden_planks', 1), roof: pbr('roof_slates_02', 1, { color: 0x6a6a70 }),
    trim: pbr('dark_wooden_planks', 1, { color: 0x5a4a3a }), stone: pbr('mossy_stone_wall', 1),
    glass: new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
  };
  for (const b of map.buildings) buildOne(root, b, M);
  return M;
}

function buildOne(root, b, M) {
  const g = new THREE.Group(); root.add(g);
  const wallMat = b.style === 'mansion' ? M.mansionWall : M.houseWall;
  const H = STORY_HEIGHT, T = WALL_T;
  for (let f = 0; f < b.floors; f++) {
    const y0 = f * H;
    for (const s of b.segments) {
      if (f > 0 && !s.exterior) continue;
      const mat = s.exterior ? wallMat : M.plaster, L = s.len;
      const piece = (len, h, y, off = 0) => {
        const m = sh(new THREE.Mesh(uvBox(s.alongX ? len : T, h, s.alongX ? T : len), mat));
        m.position.set(s.x + (s.alongX ? off : 0), y0 + y + h / 2, s.z + (s.alongX ? 0 : off)); g.add(m);
      };
      const kind = f > 0 && s.kind === 'door' ? 'window' : s.kind;
      if (kind === 'wall') piece(L, H, 0);
      else if (kind === 'window') {
        piece(L, 1.0, 0); piece(L, H - 2.3, 2.3);
        piece(0.45, 1.3, 1.0, -L / 2 + 0.225); piece(0.45, 1.3, 1.0, L / 2 - 0.225);
        addWindow(g, s, y0, L - 0.9, M);
      } else {
        piece(L, H - 2.4, 2.4); piece(0.5, 2.4, 0, -L / 2 + 0.25); piece(0.5, 2.4, 0, L / 2 - 0.25);
        addFrame(g, s, y0, L - 1.0, 2.4, 0, M.trim);
      }
    }
    const slab = sh(new THREE.Mesh(uvBox(b.w, 0.2, b.d, 3), M.floor));
    slab.position.set(b.x, f === 0 ? 0.02 : y0, b.z); g.add(slab);
    if (f > 0) { const sc = sh(new THREE.Mesh(uvBox(b.w + 0.3, 0.25, b.d + 0.3), M.stone)); sc.position.set(b.x, y0, b.z); g.add(sc); }
  }
  // Foundation plinth
  const plinth = sh(new THREE.Mesh(uvBox(b.w + 0.4, 0.5, b.d + 0.4, 1.5), M.stone)); plinth.position.set(b.x, 0.0, b.z); g.add(plinth);
  addRoof(g, b, M);
  if (b.porch) addPorch(g, b, M);
  if (b.style === 'mansion') { // faint, flickering warm light in one room — something lives here
    const l = vlight(0xff8a3a, 3, 10, 2); l.position.set(b.x - 5, 1.8, b.z - 3); l.flicker = 0.6; g.add(l);
  }
}
