// Map landmarks shared by simulation and renderer: the walled cemetery and the ruined escape walls
// with drop-able pallets.

// Cemetery: stone wall around the plot with an iron-gate opening facing the realm, rows of
// headstones / crosses / a mausoleum. Low graves block movement but not sight.
export function buildCemetery(map, rng, occupied, H) {
  const c = map.cemetery, { x, z, w, d } = c;
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
  const wall = (cx, cz, hw, hd) => map.rects.push({ x: cx, z: cz, hw, hd, h: 1.6, type: 'cemwall', low: false });
  // North wall with a 3m gate in the middle; the other three walls closed (perimeter side doubles up).
  const gx = x - c.side * 3; // gate shifted toward the map centre
  c.gate = { x: gx, z: z0 };
  wall((x0 + gx - 1.5) / 2, z0, (gx - 1.5 - x0) / 2, 0.25);
  wall((gx + 1.5 + x1) / 2, z0, (x1 - gx - 1.5) / 2, 0.25);
  wall(x, z1, w / 2, 0.25);
  // Outer side wall closed; inner side wall (toward the map) has a second opening so it loops.
  const outer = c.side > 0 ? x1 : x0, inner = c.side > 0 ? x0 : x1;
  wall(outer, z, 0.25, d / 2);
  const oz = z0 + d * 0.62; // opening centre, 2.4m wide
  wall(inner, (z0 + oz - 1.2) / 2, 0.25, (oz - 1.2 - z0) / 2);
  wall(inner, (oz + 1.2 + z1) / 2, 0.25, (z1 - oz - 1.2) / 2);
  c.side2 = { x: inner, z: oz };
  // Mausoleum in the far corner.
  const mx = x + c.side * (w / 2 - 3.4), mz = z1 - 3.2;
  c.mausoleum = { x: mx, z: mz, w: 4.4, d: 4.2 };
  map.rects.push({ x: mx, z: mz, hw: 2.2, hd: 2.1, h: 4.2, type: 'mausoleum' });
  // Rows of graves.
  for (let row = 0; row < 4; row++) {
    for (let k = 0; k < 6; k++) {
      const gxp = x0 + 2.4 + k * ((w - 4.8) / 5) + rng.range(-0.3, 0.3);
      const gzp = z0 + 3.2 + row * 3.1 + rng.range(-0.2, 0.2);
      if (Math.abs(gxp - mx) < 3.2 && Math.abs(gzp - mz) < 3.2) continue;
      if (Math.abs(gxp - gx) < 1.6 && row === 0) continue; // keep the gate path clear
      if (rng() < 0.12) continue;
      const kind = rng.pick(['stone', 'stone', 'cross', 'slab', 'angel']);
      const tilt = rng.range(-0.18, 0.18);
      map.graves.push({ x: gxp, z: gzp, kind, tilt, rot: rng.range(-0.08, 0.08), s: rng.range(0.85, 1.15) });
      map.rects.push({ x: gxp, z: gzp + 0.55, hw: 0.45, hd: 0.95, h: 0.5, type: 'grave', low: true });
    }
  }
  void occupied; void H;
}

// Ruined stone wall segments with one doorway each; an upright pallet leans beside the opening.
export function buildPalletWalls(map, rng, place) {
  let id = map.pallets.length;
  for (let i = 0; i < 11; i++) {
    const p = place(5.5, 300, 10); if (!p) continue;
    const alongX = rng() < 0.5, gap = 1.8, seg = 3.2, h = 2.4;
    const off = gap / 2 + seg / 2;
    const wall = (o) => map.rects.push(alongX
      ? { x: p.x + o, z: p.z, hw: seg / 2, hd: 0.35, h, type: 'wall', ruin: true }
      : { x: p.x, z: p.z + o, hw: 0.35, hd: seg / 2, h, type: 'wall', ruin: true });
    wall(-off); wall(off);
    // a short return wall on one side makes a small loop around the pallet
    const s = rng() < 0.5 ? -1 : 1;
    if (alongX) map.rects.push({ x: p.x + s * (off + seg / 2), z: p.z + 1.8, hw: 0.35, hd: 1.8, h, type: 'wall', ruin: true });
    else map.rects.push({ x: p.x + 1.8, z: p.z + s * (off + seg / 2), hw: 1.8, hd: 0.35, h, type: 'wall', ruin: true });
    map.pallets.push({ id: id++, x: p.x, z: p.z, alongX, gap, side: rng() < 0.5 ? -1 : 1, kind: 'pallet' });
  }
}

// Wrecked walls with a broken window: survivors vault the low sill (SPACE / jump), the monster can't
// climb through and has to go around. A ruined wall segment flanks the window on both sides.
export const WINDOW = { gap: 1.3, sill: 0.95, seg: 2.6, h: 2.5 };
export function buildWindowWalls(map, rng, place) {
  const { gap, sill, seg, h } = WINDOW;
  for (let i = 0; i < 12; i++) {
    const p = place(4.5, 300, 9); if (!p) continue;
    const alongX = rng() < 0.5, off = gap / 2 + seg / 2;
    const wall = (o, len) => map.rects.push(alongX
      ? { x: p.x + o, z: p.z, hw: len / 2, hd: 0.3, h, type: 'wall', ruin: true, broken: true }
      : { x: p.x, z: p.z + o, hw: 0.3, hd: len / 2, h, type: 'wall', ruin: true, broken: true });
    const l = seg * rng.range(0.75, 1.15), r = seg * rng.range(0.75, 1.15);
    wall(-(gap / 2 + l / 2), l); wall(gap / 2 + r / 2, r);
    // the sill: low (jumpable by survivors) but a wall for the monster
    map.rects.push(alongX ? { x: p.x, z: p.z, hw: gap / 2, hd: 0.3, h: sill, type: 'sill', low: true }
      : { x: p.x, z: p.z, hw: 0.3, hd: gap / 2, h: sill, type: 'sill', low: true });
    map.windows.push({ id: map.windows.length, x: p.x, z: p.z, alongX, gap, sill, h });
    void off;
  }
}

// Push-down logs: a dead snag leans against one of two boulders flanking a gap. A survivor pushes
// it (E) and it crashes across the gap — stunning a monster caught under it — and then lies there
// for good: survivors jump it, the monster must clamber over it slowly (it can't be smashed).
export const DROP_LOG = { gap: 2.0, rockR: 0.95, h: 0.6, hw: 0.28 };
export function buildLogDrops(map, rng, place) {
  let id = map.pallets.length;
  const { gap, rockR } = DROP_LOG;
  for (let i = 0; i < 9; i++) {
    const p = place(4.2, 300, 10); if (!p) continue;
    const alongX = rng() < 0.5, off = gap / 2 + rockR;
    for (const s of [-1, 1]) {
      const x = p.x + (alongX ? s * off : 0), z = p.z + (alongX ? 0 : s * off), sc = rockR / 0.75;
      map.circles.push({ x, z, r: rockR, h: 1.3, type: 'rock' });
      map.props.push({ x, z, rot: rng.range(0, 6.28), s: sc, kind: 'boulder_01' });
    }
    map.pallets.push({ id: id++, x: p.x, z: p.z, alongX, gap, side: rng() < 0.5 ? -1 : 1, kind: 'log' });
  }
}
