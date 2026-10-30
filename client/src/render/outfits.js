// Materials for the character models. Monsters and the exclusive survivors keep their authored PBR
// look (inner faces darkened). Alex's colour variants recolour his black jacket to the skin's
// `cloth` colour (skin, hair, shirt, jeans and shoes keep the authored texture). Which texels are
// jacket is decided by colour (dark, unsaturated) AND by body part (skinned to the torso / arms, see
// prepClothMask), so the dark jeans are left alone.
import * as THREE from 'three';
import { SKINS } from '@shared/constants.js';

export const skinById = Object.fromEntries(SKINS.map((s) => [s.id, s]));
const cache = new Map();

const boneName = (b) => b.name.replace(/^mixamorig:?/, '');
const HEM = 0.55; // jacket hem as a fraction of the survivor model's height (bind pose)
const UPPER = /^(Spine1?|Spine2|LeftShoulder|RightShoulder|LeftArm|RightArm|LeftForeArm|RightForeArm)$/;

// Per-vertex attribute aCloth = (torso + arms weight, hips weight, bind-pose height as a fraction
// of the model height), computed once per geometry.
export function prepClothMask(mesh) {
  const geo = mesh.geometry;
  if (!mesh.isSkinnedMesh || geo.getAttribute('aCloth')) return;
  const kind = mesh.skeleton.bones.map((b) => (UPPER.test(boneName(b)) ? 1 : boneName(b) === 'Hips' ? 2 : 0));
  const si = geo.getAttribute('skinIndex'), sw = geo.getAttribute('skinWeight'), pos = geo.getAttribute('position');
  geo.computeBoundingBox();
  const y0 = geo.boundingBox.min.y, hgt = geo.boundingBox.max.y - y0 || 1;
  const out = new Float32Array(si.count * 3);
  for (let v = 0; v < si.count; v++) {
    for (let c = 0; c < 4; c++) {
      const k = kind[si.getComponent(v, c)], w = sw.getComponent(v, c);
      if (k === 1) out[v * 3] += w; else if (k === 2) out[v * 3 + 1] += w;
    }
    out[v * 3 + 2] = (pos.getY(v) - y0) / hgt;
  }
  geo.setAttribute('aCloth', new THREE.BufferAttribute(out, 3));
}

// Alex's colour variants: his black jacket is recoloured (the shirt keeps its own colour).
function survivorMaterial(src, skin) {
  const key = src.uuid + skin.id;
  if (cache.has(key)) return cache.get(key);
  const m = src.clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uJacket = { value: new THREE.Color(skin.cloth) };
    sh.uniforms.uShirt = { value: new THREE.Color(skin.accent) };
    sh.uniforms.uShirtK = { value: 0 };
    sh.uniforms.uHem = { value: HEM };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aCloth;\nvarying vec3 vCloth;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCloth = aCloth;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uJacket, uShirt;\nuniform float uHem, uShirtK;\nvarying vec3 vCloth;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 c = diffuseColor.rgb;
          vec3 cs = pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));      // perceptual (sRGB-ish) for the masks
          float chroma = max(cs.r, max(cs.g, cs.b)) - min(cs.r, min(cs.g, cs.b));
          float lum = dot(cs, vec3(.299, .587, .114));
          float grey = 1.0 - smoothstep(0.1, 0.22, chroma);       // skin is warm & saturated: untouched
          // the jacket's lower half is skinned to the hips: count it above the hem line
          float body = vCloth.x + vCloth.y * smoothstep(uHem - 0.015, uHem + 0.015, vCloth.z);
          float jacket = smoothstep(0.4, 0.65, body) * (1.0 - smoothstep(0.3, 0.45, lum)) * grey;
          float shirt = smoothstep(0.4, 0.65, vCloth.x + vCloth.y) * smoothstep(0.45, 0.6, lum) * grey;
          diffuseColor.rgb = mix(c, uJacket * (0.4 + lum * 3.0), jacket);
          diffuseColor.rgb = mix(diffuseColor.rgb, uShirt * (0.2 + lum * 0.95), shirt * uShirtK);
        }
        ${BACKFACE}`);
  };
  m.customProgramCacheKey = () => 'surv-outfit';
  cache.set(key, m);
  return m;
}

// The models are single-shell and double-sided: where the arm-repair (skinfix.js) opened a seam,
// the inside of the clothes would show bright. Inner faces are drawn near-black, like a shadowed fold.
const BACKFACE = 'if (!gl_FrontFacing) diffuseColor.rgb *= 0.1;';
function monsterMaterial(src) {
  const key = src.uuid + ':mon';
  if (cache.has(key)) return cache.get(key);
  const m = src.clone();
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>\n${BACKFACE}`); };
  m.customProgramCacheKey = () => 'mon-backface';
  cache.set(key, m);
  return m;
}

export function applyLook(ch, skinId) {
  const skin = skinById[skinId] || SKINS[0];
  const recolor = ch.survivorBody && skin.recolor;
  for (const m of ch.meshes) {
    if (!m.userData.srcMat) m.userData.srcMat = m.material;
    if (recolor) prepClothMask(m);
    m.material = recolor ? survivorMaterial(m.userData.srcMat, skin) : monsterMaterial(m.userData.srcMat);
  }
}
