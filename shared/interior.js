// Furniture for the mansion (both floors) and the standing farmhouses. Shared so collision and
// rendering agree. Each item: { kind, x, z, rot, w, d, h, lv } where w = width across its front,
// d = depth, rot = facing (0 = front faces +Z/south, PI/2 = east, PI = north, -PI/2 = west).
// Items lower than ~1.3m block movement but not sight (you can jump the low ones).
const FACE = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 };

function put(map, b, kind, lx, lz, face, w, d, h, lv = 0, solid = true) {
  const rot = FACE[face] ?? 0, side = face === 'e' || face === 'w';
  const it = { kind, x: b.x + lx, z: b.z + lz, rot, w, d, h, lv, building: b.id };
  map.furniture.push(it);
  if (solid) {
    map.rects.push({
      x: it.x, z: it.z, hw: (side ? d : w) / 2, hd: (side ? w : d) / 2, h,
      type: 'furniture', low: h < 1.3, ...(lv ? { lv: 1 } : {}),
    });
  }
  return it;
}

// Mansion (24 x 16.8, centred on b.x/b.z). Ground floor: an E-W corridor (z -1.2..1.2) with rooms
// off it — library (NW), stair hall (N), study (NE), dining room (SW), entrance hall (S), sitting
// room (SE). Doorways and the corridor are kept clear. Upstairs: an open, decaying bedroom loft.
export function furnishMansion(map, b) {
  // Library / parlour (NW)
  put(map, b, 'bookshelf', -10.6, -8.0, 's', 1.9, 0.45, 2.3);
  put(map, b, 'bookshelf', -6.2, -8.0, 's', 1.9, 0.45, 2.3);
  put(map, b, 'fireplace', -11.65, -7.0, 'e', 1.7, 0.6, 1.5);
  put(map, b, 'armchair', -10.1, -5.6, 'w', 0.85, 0.85, 1.0);
  put(map, b, 'armchair', -9.6, -6.6, 'w', 0.85, 0.85, 1.0);
  put(map, b, 'roundtable', -7.2, -4.4, 's', 1.1, 1.1, 0.75);
  // Stair hall (N, the staircase runs along the north wall)
  put(map, b, 'clock', -4.35, -2.0, 'e', 0.55, 0.4, 2.2);
  put(map, b, 'bench', 5.5, -2.6, 'w', 1.4, 0.45, 0.5);
  // Study (NE)
  put(map, b, 'desk', 10.5, -5.0, 'w', 1.6, 0.8, 0.8);
  put(map, b, 'chair', 9.7, -5.0, 'e', 0.5, 0.5, 1.0, 0, false);
  put(map, b, 'bookshelf', 11.6, -7.2, 'w', 1.7, 0.45, 2.3);
  put(map, b, 'chest', 6.75, -7.8, 's', 0.85, 0.5, 0.55);
  // Dining room (SW)
  put(map, b, 'dining', -8.4, 5.2, 's', 3.2, 1.0, 0.8);
  put(map, b, 'sideboard', -11.65, 3.0, 'e', 1.7, 0.5, 1.0);
  put(map, b, 'clock', -5.2, 7.9, 'n', 0.55, 0.4, 2.2);
  // Entrance hall (S)
  put(map, b, 'console', -4.4, 3.0, 'e', 1.2, 0.4, 0.9);
  put(map, b, 'console', 4.4, 3.0, 'w', 1.2, 0.4, 0.9);
  // Sitting room (SE)
  put(map, b, 'sofa', 8.6, 7.8, 'n', 2.2, 0.85, 0.9);
  put(map, b, 'coffeetable', 8.6, 6.3, 's', 1.2, 0.6, 0.45);
  put(map, b, 'armchair', 10.8, 4.6, 'w', 0.85, 0.85, 1.0);
  put(map, b, 'fireplace', 11.65, 4.7, 'w', 1.7, 0.6, 1.5);
  put(map, b, 'piano', 6.2, 2.4, 's', 1.5, 0.65, 1.2);

  // Upstairs loft (lv 1): keep the arrival from the stairs (x -6..-3.6, z -8.4..-5.5) clear.
  put(map, b, 'bed', -9.2, 5.6, 'n', 1.6, 2.2, 0.75, 1);
  put(map, b, 'wardrobe', -11.6, 1.2, 'e', 1.4, 0.6, 2.2, 1);
  put(map, b, 'chest', -9.2, 3.8, 's', 1.0, 0.55, 0.55, 1);
  put(map, b, 'bed', 9.2, 5.6, 'n', 1.6, 2.2, 0.75, 1);
  put(map, b, 'wardrobe', 11.6, -3.0, 'w', 1.4, 0.6, 2.2, 1);
  put(map, b, 'dresser', 5.6, 7.9, 'n', 1.4, 0.5, 1.0, 1);
  put(map, b, 'rocking', -8.4, -3.6, 's', 0.7, 0.9, 1.0, 1);
  put(map, b, 'crib', 0.0, 6.6, 's', 1.2, 0.7, 0.9, 1);
  put(map, b, 'table', 8.4, -5.2, 's', 1.3, 0.8, 0.8, 1);
  put(map, b, 'chest', 11.0, -7.6, 's', 1.0, 0.55, 0.55, 1);
}

// Standing farmhouse (9.6 x 7.2) — a lived-in, abandoned kitchen and bedroom.
export function furnishFarmhouse(map, b) {
  put(map, b, 'table', -2.4, -1.4, 's', 1.2, 0.8, 0.8);
  put(map, b, 'chair', -2.4, -0.7, 'n', 0.5, 0.5, 1.0, 0, false);
  put(map, b, 'stove', -0.6, -3.0, 's', 0.8, 0.7, 1.1);
  put(map, b, 'sideboard', -4.35, -2.6, 'e', 1.4, 0.5, 1.0);
  put(map, b, 'bed', 3.2, -2.3, 'w', 1.3, 2.0, 0.65);
  put(map, b, 'wardrobe', 4.3, 2.4, 'w', 1.2, 0.6, 2.0);
  put(map, b, 'chest', 2.2, -3.0, 's', 0.9, 0.5, 0.5);
}
