// Blocking clutter that creates loops and hiding spots: ruined walls, sheds, fences, wrecked cars,
// mossy rock clusters, boulders, stumps, barrel/crate stacks, statues.
export function scatterClutter(map, rng, place, free, occupied, H) {
  // Ruined stone walls (L / straight / U) — DbD-style "jungle gyms"
  for (let i = 0; i < 22; i++) {
    const p = place(5, 200, 8); if (!p) continue;
    const k = rng(), s = rng() < 0.5 ? 1 : -1;
    const wall = (x, z, hw, hd, h = 2.6) => map.rects.push({ x, z, hw, hd, h, type: 'wall' });
    if (k < 0.4) { wall(p.x, p.z, 3.5, 0.35); wall(p.x + 3.2 * s, p.z + 2.5, 0.35, 2.5); }
    else if (k < 0.6) { wall(p.x, p.z, 4.5, 0.35, 2.2); }
    else { wall(p.x - 3, p.z, 0.35, 2.5); wall(p.x + 3, p.z, 0.35, 2.5); wall(p.x, p.z - 2.5 * s, 3.3, 0.35); }
  }
  // Wooden sheds
  for (let i = 0; i < 6; i++) {
    const p = place(4, 200, 8); if (!p) continue;
    map.rects.push({ x: p.x, z: p.z, hw: 2.4, hd: 1.8, h: 3, type: 'shed' });
  }
  // Broken fences (low: vault-height, don't block sight)
  for (let i = 0; i < 12; i++) {
    const p = place(4, 200, 6); if (!p) continue;
    const alongX = rng() < 0.5;
    map.rects.push({ x: p.x, z: p.z, hw: alongX ? 4 : 0.15, hd: alongX ? 0.15 : 4, h: 1.1, type: 'fence', low: true });
  }
  // Wrecked covered cars
  for (let i = 0; i < 7; i++) {
    const p = place(3.5, 200, 8); if (!p) continue;
    const rot = rng.int(0, 1) * Math.PI / 2 + rng.range(-0.15, 0.15);
    const along = Math.abs(Math.cos(rot)) > 0.5;
    map.rects.push({ x: p.x, z: p.z, hw: along ? 0.95 : 2.2, hd: along ? 2.2 : 0.95, h: 1.4, type: 'car', low: true });
    map.props.push({ x: p.x, z: p.z, rot, s: 1, kind: 'covered_car' });
  }
  // Mossy rock clusters & boulders
  for (let i = 0; i < 14; i++) {
    const p = place(4, 200, 6); if (!p) continue;
    const kind = rng() < 0.5 ? 'rock_moss_set_01' : 'rock_moss_set_02', s = rng.range(0.6, 0.9), rot = rng.range(0, 6.28);
    map.props.push({ x: p.x, z: p.z, rot, s, kind });
    map.circles.push({ x: p.x, z: p.z, r: 2.4 * s, h: 1.4 * s, type: 'rock' });
  }
  for (let i = 0; i < 26; i++) {
    const p = place(1.6, 120, 4); if (!p) continue;
    const s = rng.range(1.0, 2.0);
    map.props.push({ x: p.x, z: p.z, rot: rng.range(0, 6.28), s, kind: 'boulder_01' });
    map.circles.push({ x: p.x, z: p.z, r: 0.75 * s, h: 1 * s, type: 'rock' });
  }
  // Stumps, barrels, crates, tyres, statues, wheelchairs
  const smalls = [['tree_stump_01', 0.7, 0.6], ['Barrel_01', 0.32, 0.9], ['wooden_crate_01', 0.5, 0.5], ['old_tyre', 0.35, 0.3],
    ['gothic_statue', 0.8, 1.8], ['wheelchair_01', 0.5, 1.1]];
  for (let i = 0; i < 60; i++) {
    const p = place(1, 80, 4); if (!p) continue;
    const [kind, r, h] = rng.pick(smalls);
    const s = kind === 'wooden_crate_01' ? 1.6 : 1;
    map.props.push({ x: p.x, z: p.z, rot: rng.range(0, 6.28), s, kind });
    // Stumps: only the trunk blocks — you can walk over the little roots spreading round it. Old
    // tyres lie flat and are simply walked over.
    if (kind !== 'old_tyre') map.circles.push({ x: p.x, z: p.z, r: (kind === 'tree_stump_01' ? 0.3 : r) * s, h: h * s, type: kind === 'gothic_statue' ? 'pillar' : 'prop' });
    if (kind === 'Barrel_01' && rng() < 0.6) { // barrel cluster
      for (let k = 0; k < 2; k++) {
        const a = rng.range(0, 6.28), x = p.x + Math.cos(a) * 0.7, z = p.z + Math.sin(a) * 0.7;
        map.props.push({ x, z, rot: rng.range(0, 6.28), s: 1, kind }); map.circles.push({ x, z, r: 0.32, h: 0.9, type: 'prop' });
      }
    }
  }
  // (No logs lie around from the start: logs only come down when a survivor pushes one — landmarks.js.)
  map.logs ||= [];
  void free; void occupied; void H;
}

// Dense dead forest, camouflage grass and non-blocking undergrowth.
export function scatterNature(map, rng, free, occupied, H) {
  // Tall grass first (it doesn't block, so it only needs the patch centre clear of structures);
  // trees may then grow inside the patches, like a real overgrown field.
  for (let i = 0; i < 600 && map.grass.length < 46; i++) {
    const x = rng.range(-H + 6, H - 6), z = rng.range(-H + 6, H - 6);
    if (!free(x, z, 1.2)) continue;
    if (map.grass.some((g) => Math.hypot(g.x - x, g.z - z) < g.r + 2)) continue;
    map.grass.push({ x, z, r: rng.range(3, 6) });
  }
  // Groves: a ring of thick old trees around a clearing — a loop to run the monster around.
  for (let i = 0, groves = 0; i < 300 && groves < 12; i++) {
    const cx = rng.range(-H + 10, H - 10), cz = rng.range(-H + 10, H - 10);
    if (!free(cx, cz, 5)) continue;
    occupied.push({ x: cx, z: cz, r: 5 }); groves++;
    const n = rng.int(5, 7), R = rng.range(2.6, 3.4), a0 = rng.range(0, 6.28);
    for (let k = 0; k < n; k++) {
      const a = a0 + (k / n) * Math.PI * 2 + rng.range(-0.25, 0.25);
      map.circles.push({ x: cx + Math.cos(a) * R, z: cz + Math.sin(a) * R, r: rng.range(0.5, 0.75), h: rng.range(11, 16), type: 'tree', v: rng.int(0, 5) });
    }
  }
  let trees = 0;
  for (let i = 0; i < 1500 && trees < 260; i++) {
    const x = rng.range(-H + 1.5, H - 1.5), z = rng.range(-H + 1.5, H - 1.5);
    if (!free(x, z, 0.7)) continue;
    occupied.push({ x, z, r: 0.8 }); trees++;
    map.circles.push({ x, z, r: rng.range(0.28, 0.55), h: rng.range(8, 15), type: 'tree', v: rng.int(0, 5) });
  }
  const deco = ['shrub_01', 'shrub_04', 'fern_02', 'fern_02', 'nettle_plant', 'weed_plant_02', 'dry_branches_medium_01', 'grass_medium_02', 'grass_medium_01'];
  for (let i = 0; i < 420; i++) {
    const x = rng.range(-H + 2, H - 2), z = rng.range(-H + 2, H - 2);
    if (Math.abs(x) < 11 && Math.abs(z) < 9) continue; // keep mansion interior clear
    map.props.push({ x, z, rot: rng.range(0, 6.28), s: rng.range(0.7, 1.4), kind: rng.pick(deco), deco: true });
  }
}
