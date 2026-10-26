// Loads the CC0 Poly Haven models (glTF) and PBR texture sets listed in public/assets/manifest.json.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const BASE = `${import.meta.env.BASE_URL}assets/`;
const gltfLoader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
let manifest = null;
const models = new Map();   // id -> { scene, parts: [{geometry, material, matrix}] , size }
const textures = new Map(); // id -> { map, normalMap, aoRoughMetal }
let anisotropy = 4;

export function setAnisotropy(a) { anisotropy = a; }

export async function loadManifest() {
  if (!manifest) manifest = await (await fetch(BASE + 'manifest.json')).json();
  return manifest;
}

export async function loadModels(ids, onProgress) {
  await loadManifest();
  let done = 0;
  await Promise.all(ids.map(async (id) => {
    if (models.has(id) || !manifest.models[id]) { done++; return; }
    try {
      const g = await gltfLoader.loadAsync(BASE + manifest.models[id]);
      g.scene.updateMatrixWorld(true);
      const parts = [];
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        const m = o.material;
        if (m.map) m.map.anisotropy = anisotropy;
        if (m.transparent || m.alphaTest > 0 || m.alphaMap) { m.transparent = false; m.alphaTest = 0.5; m.side = THREE.DoubleSide; }
        parts.push({ geometry: o.geometry, material: m, matrix: o.matrixWorld.clone() });
      });
      const box = new THREE.Box3().setFromObject(g.scene);
      models.set(id, { scene: g.scene, parts, box });
    } catch (e) { console.warn('model failed', id, e); }
    onProgress?.(++done / ids.length);
  }));
}
export const getModel = (id) => models.get(id);

// PBR texture set: diffuse (sRGB), OpenGL normal, ARM (AO/Rough/Metal packed).
export function pbr(id, repeat = 1, opts = {}) {
  const key = id + '|' + repeat;
  if (!textures.has(key)) {
    const set = manifest?.textures[id];
    if (!set) return new THREE.MeshStandardMaterial({ color: opts.color ?? 0x666666, roughness: 1 });
    const load = (rel, srgb) => {
      const t = texLoader.load(BASE + rel);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = anisotropy;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    textures.set(key, { map: load(set.diff, true), normalMap: set.nor && load(set.nor), arm: set.arm && load(set.arm) });
  }
  const t = textures.get(key);
  return new THREE.MeshStandardMaterial({
    map: t.map, normalMap: t.normalMap, aoMap: t.arm, roughnessMap: t.arm, metalnessMap: opts.metal ? t.arm : null,
    roughness: 1, metalness: opts.metal ? 1 : 0, color: opts.color ?? 0xffffff, normalScale: new THREE.Vector2(1, 1),
    side: opts.side ?? THREE.FrontSide,
  });
}

// Instantiate one model many times with InstancedMesh (one per sub-mesh). items: [{x,y,z,rot,s}]
export function instanceModel(id, items, { castShadow = true, tint = null, yOffset = 0 } = {}) {
  const m = models.get(id);
  const group = new THREE.Group();
  if (!m || !items.length) return group;
  const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (const part of m.parts) {
    let mat = part.material;
    if (tint) { mat = mat.clone(); mat.color.multiply(new THREE.Color(tint)); }
    const im = new THREE.InstancedMesh(part.geometry, mat, items.length);
    items.forEach((it, i) => {
      tmp.compose(p.set(it.x, (it.y || 0) + yOffset, it.z), q.setFromEuler(e.set(it.rx || 0, it.rot || 0, it.rz || 0)), s.setScalar(it.s || 1));
      im.setMatrixAt(i, tmp.multiply(part.matrix));
    });
    im.castShadow = castShadow; im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
  }
  return group;
}

// A single (non-instanced) clone, e.g. for animated or unique props.
export function cloneModel(id) {
  const m = models.get(id);
  if (!m) return new THREE.Group();
  const c = m.scene.clone(true);
  c.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return c;
}

export const ALL_MODELS = ['dead_tree_trunk', 'dead_tree_trunk_02', 'shrub_01', 'shrub_02', 'shrub_04', 'fern_02', 'nettle_plant',
  'weed_plant_02', 'grass_medium_01', 'grass_medium_02', 'rock_moss_set_01', 'rock_moss_set_02', 'boulder_01', 'tree_stump_01',
  'dry_branches_medium_01', 'Barrel_01', 'wooden_crate_01', 'old_tyre', 'covered_car', 'large_iron_gate', 'street_lamp_01',
  'gothic_statue', 'wheelchair_01', 'Lantern_01'];
