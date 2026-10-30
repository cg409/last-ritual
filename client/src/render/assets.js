// Loads the CC0 Poly Haven models (glTF) and PBR texture sets listed in public/assets/manifest.json.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { graphics } from '../settings.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const BASE = `${import.meta.env.BASE_URL}assets/`;
// All game models are meshopt-compressed GLBs with WebP textures (a third of the original download).
export function makeGltfLoader() { const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder); return l; }
// A flaky connection should never kill the game: every asset is retried a few times.
export async function loadRetry(loader, url, onProgress, tries = 4) {
  for (let i = 0; ; i++) {
    try { return await loader.loadAsync(url, onProgress); } catch (e) { if (i >= tries - 1) throw e; await new Promise((r) => setTimeout(r, 600 * (i + 1))); }
  }
}
export async function fetchRetry(url, tries = 4) {
  for (let i = 0; ; i++) {
    try { const r = await fetch(url); if (r.ok) return r; throw new Error(r.status); } catch (e) { if (i >= tries - 1) throw e; await new Promise((r) => setTimeout(r, 600 * (i + 1))); }
  }
}
const gltfLoader = makeGltfLoader();
// Ultra low / mobile: flat-lit, colour-map-only materials (no normal / AO / roughness maps) - far cheaper per pixel.
export const liteMat = (m) => new THREE.MeshLambertMaterial({ map: m.map, color: m.color, alphaTest: m.alphaTest, side: m.side, transparent: m.transparent, opacity: m.opacity, vertexColors: m.vertexColors, emissive: m.emissive, emissiveIntensity: m.emissiveIntensity, emissiveMap: m.emissiveMap });
const liteCache = new WeakMap();
// Swaps every Standard / Physical material under `root` for the cheap flat-lit one (shared materials stay shared).
export function liteScan(root) {
  if (!graphics().lite) return;
  const conv = (m) => {
    if (!m?.isMeshStandardMaterial) return m;
    let n = liteCache.get(m);
    if (!n) { n = liteMat(m); n.onBeforeCompile = m.onBeforeCompile; n.customProgramCacheKey = m.customProgramCacheKey; n.userData = m.userData; liteCache.set(m, n); }
    return n;
  };
  root.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && o.material) o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material); });
}
const texLoader = new THREE.TextureLoader();
let manifest = null;
const models = new Map();   // id -> { scene, parts: [{geometry, material, matrix}] , size }
const textures = new Map(); // id -> { map, normalMap, aoRoughMetal }
let anisotropy = 4;

export function setAnisotropy(a) { anisotropy = a; }

export async function loadManifest() {
  if (!manifest) manifest = await (await fetchRetry(BASE + 'manifest.json')).json();
  return manifest;
}

export async function loadModels(ids, onProgress) {
  await loadManifest();
  let done = 0;
  await Promise.all(ids.map(async (id) => {
    if (models.has(id) || !manifest.models[id]) { done++; return; }
    try {
      const gfx = graphics(), rel = manifest.models[id];
      const g = await loadRetry(gltfLoader, BASE + (gfx.lod ? rel.replace(/\.glb$/, '_' + gfx.lod + '.glb') : rel));
      g.scene.updateMatrixWorld(true);
      const parts = [];
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        let m = o.material;
        if (graphics().lite) m = o.material = liteMat(m);
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
    const set = manifest?.textures[id], lite = graphics().lite && set?.lo;
    if (!set) return new THREE.MeshStandardMaterial({ color: opts.color ?? 0x666666, roughness: 1 });
    const load = (rel, srgb) => {
      const url = BASE + rel, t = texLoader.load(url, undefined, undefined, () => setTimeout(() => texLoader.load(url, (x) => { t.image = x.image; t.needsUpdate = true; }), 1500));
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = anisotropy;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    textures.set(key, lite ? { map: load(set.lo, true) } : { map: load(set.diff, true), normalMap: set.nor && load(set.nor), arm: set.arm && load(set.arm) });
  }
  const t = textures.get(key);
  if (!t.normalMap && graphics().lite) return new THREE.MeshLambertMaterial({ map: t.map, color: opts.color ?? 0xffffff, side: opts.side ?? THREE.FrontSide });
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
  const grid = new Map();
  for (const it of items) { const k = Math.floor(it.x / 32) + ',' + Math.floor(it.z / 32); (grid.get(k) || grid.set(k, []).get(k)).push(it); }
  const cells = [...grid.values()];
  const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (const part of m.parts) {
    let mat = part.material;
    if (tint) { mat = mat.clone(); mat.color.multiply(new THREE.Color(tint)); }
    // One InstancedMesh per map cell: the GPU skips every cell that is off-screen or beyond the view distance
    // (a single map-wide mesh could never be culled, so every rock and shrub was always drawn).
    for (const cell of cells) {
      const im = new THREE.InstancedMesh(part.geometry, mat, cell.length);
      cell.forEach((it, i) => {
        tmp.compose(p.set(it.x, (it.y || 0) + yOffset, it.z), q.setFromEuler(e.set(it.rx || 0, it.rot || 0, it.rz || 0)), s.setScalar(it.s || 1));
        im.setMatrixAt(i, tmp.multiply(part.matrix));
      });
      im.castShadow = castShadow; im.receiveShadow = true;
      im.computeBoundingSphere();
      group.add(im);
    }
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
  'gothic_statue', 'wheelchair_01', 'Lantern_01', 'street_rat'];
