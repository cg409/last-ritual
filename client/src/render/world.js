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
  const byKind = {};
  map.props.forEach((p, i) => {
    if (p.deco && (i % 100) / 100 >= gfx.foliage) return; // foliage density by preset
    (byKind[p.kind] ||= []).push(p);
  });
  for (const [kind, items] of Object.entries(byKind)) {
    const soft = SOFT.includes(kind);
    group.add(instanceModel(kind, items, { castShadow: !soft || gfx.foliage >= 1, tint: soft ? 0x6a6a58 : null }));
  }
  // Fallen scanned logs
  const logs = map.props.filter((p, i) => p.deco && i % 11 === 0).slice(0, 24).map((p) => ({ x: p.x + 1.5, z: p.z, rot: p.rot, s: 1.1, rz: Math.PI / 2, y: 0.15 }));
  group.add(instanceModel('dead_tree_trunk_02', logs));
  // Carved stone bollards (crow perches)
  const bollardMat = pbr('mossy_stone_wall', 1);
  const prof = [[0.42, 0], [0.42, 0.12], [0.34, 0.18], [0.3, 1.25], [0.36, 1.32], [0.36, 1.45], [0.28, 1.52], [0, 1.6]].map(([r, y]) => new THREE.Vector2(r, y));
  const bGeo = new THREE.LatheGeometry(prof, 14);
  for (const t of map.towers) { const b = sh(new THREE.Mesh(bGeo, bollardMat)); b.position.set(t.x, 0, t.z); group.add(b); }
  return group;
}

function buildTerrain(group, map) {
  const size = map.size + 60;
  const geo = new THREE.PlaneGeometry(size, size, 160, 160);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, Math.sin(x * 0.11) * Math.cos(y * 0.09) * 0.18 + Math.sin(x * 0.37 + y * 0.21) * 0.05);
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
