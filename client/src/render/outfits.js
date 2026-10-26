// Outfit / monster materials applied to the shared rigged human model.
import * as THREE from 'three';
import { SKINS, MONSTERS } from '@shared/constants.js';
import { makeHat, makeWeapon, makeMonsterHead, attachTo } from './props.js';

export const skinById = Object.fromEntries(SKINS.map((s) => [s.id, s]));

// Re-tint the original PBR texture (keeps fabric details & normal map) with the skin's outfit colours.
function outfitMaterial(src, cloth, accent) {
  const m = src.clone();
  m.color = new THREE.Color(cloth).lerp(new THREE.Color(0xffffff), 0.45);
  m.roughness = 0.85; m.metalness = 0.05;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uAccent = { value: new THREE.Color(accent) };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uAccent;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float lum = dot(diffuseColor.rgb, vec3(.299,.587,.114));
        float sat = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)) - min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
        if (sat < 0.12) diffuseColor.rgb = mix(diffuseColor.rgb, uAccent * (lum * 2.2), 0.5);`);
  };
  m.customProgramCacheKey = () => `outfit-${cloth}-${accent}`;
  return m;
}

function monsterMaterial(src, monster) {
  const mat = src.clone();
  mat.color = new THREE.Color(MONSTERS[monster].color).multiplyScalar(1.5);
  mat.roughness = 1; mat.metalness = 0;
  mat.emissive = new THREE.Color(0x250000); mat.emissiveIntensity = 0.4;
  return mat;
}

// Applies either the monster look or a survivor skin (also used by the Mimic's disguise).
export function applyLook(ch, skinId, asMonster) {
  const skin = skinById[skinId] || SKINS[0];
  for (const x of ch.extrasList || []) x.removeFromParent();
  ch.extrasList = [];
  ch.weapon = null;
  for (const m of ch.meshes) {
    if (!m.userData.srcMat) m.userData.srcMat = m.material;
    const visor = m.name.includes('visor');
    if (asMonster) { m.material = monsterMaterial(m.userData.srcMat, ch.monster); m.visible = !visor; }
    else { m.material = outfitMaterial(m.userData.srcMat, skin.cloth, skin.accent); m.visible = !visor || skin.hat === 'helmet'; }
  }
  if (asMonster) {
    ch.model.scale.setScalar(1.2);
    const head = makeMonsterHead(ch.monster);
    attachTo(ch.bones.head, head, ch.model); ch.extrasList.push(head);
    const weapon = makeWeapon(MONSTERS[ch.monster].weapon);
    weapon.rotation.set(0, 0, -Math.PI / 2); // haft along the fist
    attachTo(ch.bones.rHand, weapon, ch.model); ch.extrasList.push(weapon);
    ch.weapon = weapon;
  } else {
    ch.model.scale.setScalar(1);
    const hat = makeHat(skin.hat, skin.cloth, skin.accent);
    if (hat) { attachTo(ch.bones.head, hat, ch.model); ch.extrasList.push(hat); }
  }
}
