// Static environment: PBR forest-floor terrain with mud patches, perimeter wall, buildings, dead forest,
// real scanned props (rocks, shrubs, ferns, cars, barrels, statues...), tall grass, ruins, bollards.
import * as THREE from 'three';
import { pbr, instanceModel } from './assets.js';
import { buildBuildings } from './buildings.js';
import { buildTrees } from './trees.js';
import { buildGrass } from './grass.js';
import { buildPerimeter, buildRuins } from './ruins.js';
import { sh } from './buildingParts.js';
import { graphics } from '../settings.js';
import { buildTrips } from './trips.js';
import { terrainY } from '@shared/levels.js';
import { buildCemetery } from './cemetery.js';

const SOFT = ['grass_medium_01', 'grass_medium_02', 'fern_02', 'weed_plant_02', 'nettle_plant', 'shrub_01', 'shrub_04', 'dry_branches_medium_01'];

export function buildWorld(scene, map) {
  const group = new THREE.Group(); scene.add(group);
  const gfx = graphics();
  buildTerrain(group, map);
  buildPerimeter(group, map);
  buildBuildings(group, map);
  buildTrees(group, map, gfx.foliage);
  buildRuins(group, map);
  buildGrass(group, map, gfx.foliage);
  buildTrips(group, map);
  buildCemetery(group, map);
  const byKind = {};
  map.props.forEach((p, i) => {
    if (p.deco && (i % 100) / 100 >= gfx.foliage) return; // foliage density by preset
    // rest on the rolling terrain (slightly sunk so nothing hovers where the ground dips)
    (byKind[p.kind] ||= []).push(p.y != null ? p : { ...p, y: terrainY(p.x, p.z) - 0.04 });
  });
  for (const [kind, items] of Object.entries(byKind)) {
    const soft = SOFT.includes(kind);
    group.add(instanceModel(kind, items, { castShadow: !soft || gfx.foliage >= 1, tint: soft ? 0x6a6a58 : null }));
  }
  // Fallen scanned trunks — exactly where the solid log colliders are (map.logs kind 'trunk').
  // The scan's long axis is its local X (≈4m, centred ~0.1m off), lying on the ground already;
  // rotate so local X matches the collider's long axis (sin rot, cos rot) → yaw = rot - PI/2.
  // Each trunk is pitched to follow the ground between its two ends, so neither end hovers.
  const trunks = (map.logs || []).filter((l) => l.kind === 'trunk').map((l) => {
    const dx = Math.sin(l.rot) * l.hl, dz = Math.cos(l.rot) * l.hl;
    const ya = terrainY(l.x - dx, l.z - dz), yb = terrainY(l.x + dx, l.z + dz);
    return { x: l.x - Math.sin(l.rot) * 0.1 * l.s, z: l.z - Math.cos(l.rot) * 0.1 * l.s, y: (ya + yb) / 2 + 0.24 * l.s,
      rot: l.rot - Math.PI / 2, rz: Math.atan2(yb - ya, l.hl * 2), s: l.s };
  });
  group.add(instanceModel('dead_tree_trunk_02', trunks));
  // Carved stone bollards (crow perches)
  const bollardMat = pbr('mossy_stone_wall', 1);
  const prof = [[0.42, 0], [0.42, 0.12], [0.34, 0.18], [0.3, 1.25], [0.36, 1.32], [0.36, 1.45], [0.28, 1.52], [0, 1.6]].map(([r, y]) => new THREE.Vector2(r, y));
  const bGeo = new THREE.LatheGeometry(prof, 14);
  for (const t of map.towers) { const b = sh(new THREE.Mesh(bGeo, bollardMat)); b.position.set(t.x, terrainY(t.x, t.z) - 0.05, t.z); group.add(b); }
  return group;
}

function buildTerrain(group, map) {
  const size = map.size + 60;
  const geo = new THREE.PlaneGeometry(size, size, 160, 160);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, terrainY(x, -y)); // plane-local y = -world z (shared with the gameplay ground height)
  }
  geo.computeVertexNormals();
  const mat = pbr('forest_ground_04', size / 4, { color: 0x6a6a6a });
  const mud = pbr('brown_mud_leaves_01', size / 5, { color: 0x5a5a5a });
  mat.onBeforeCompile = (s) => { // blend mud/leaf patches using low-frequency noise
    s.uniforms.mudMap = { value: mud.map };
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D mudMap;\nfloat hn(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5);}\nfloat vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hn(i),hn(i+vec2(1,0)),f.x),mix(hn(i+vec2(0,1)),hn(i+vec2(1,1)),f.x),f.y);}')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float m = smoothstep(.45,.7, vn(vMapUv*0.06) * .7 + vn(vMapUv*0.23) * .3);
        diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(mudMap, vMapUv*0.8).rgb * 0.8, m);`);
  };
  mat.customProgramCacheKey = () => 'terrain-mud';
  const ground = new THREE.Mesh(geo, mat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);
}
