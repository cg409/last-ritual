// Repairs the auto-rigged character meshes. They were rigged with the hands resting against the
// thighs, so the rigger bled weights across: hand / finger vertices follow the UpLeg bones and
// forearm vertices follow the Hips (and the jacket's hem follows the forearms). As soon as an arm
// swings, the hand stays glued to the clothes and the mesh stretches into long flaps.
// Fix (once per geometry, at load): every vertex is given wholly to whichever side it belongs to
// (arm chain vs. hips / legs / lower torso), and the few triangles that still bridge a forearm or
// hand to the hips / legs are dropped so nothing can stretch between them.
const name = (b) => b.name.replace(/^mixamorig:?/, '');

function classify(bone) {
  const n = name(bone);
  if (/^(Left|Right)Hand/.test(n)) return 'H';                    // hand, fingers
  if (/^(Left|Right)ForeArm/.test(n)) return 'F';                 // forearm
  if (/^(Left|Right)Arm$/.test(n)) return 'U';                    // upper arm
  if (n === 'Hips' || /(UpLeg|Leg|Foot|Toe)/.test(n)) return 'L'; // hips & legs
  if (n === 'Spine' || n === 'Spine1') return 'T';                // lower torso
  return 'O';
}

export function fixArmWeights(mesh) {
  const geo = mesh.geometry;
  if (!mesh.isSkinnedMesh || geo.userData.armFixed) return;
  geo.userData.armFixed = true;
  const cls = mesh.skeleton.bones.map(classify);
  const si = geo.getAttribute('skinIndex'), sw = geo.getAttribute('skinWeight');
  const n = si.count, tag = new Uint8Array(n); // 1 = forearm/hand vertex, 2 = hips/legs/lower-torso vertex
  const w = [0, 0, 0, 0], c = ['', '', '', ''];
  for (let v = 0; v < n; v++) {
    const s = { H: 0, F: 0, U: 0, L: 0, T: 0, O: 0 };
    for (let k = 0; k < 4; k++) { c[k] = cls[si.getComponent(v, k)]; w[k] = sw.getComponent(v, k); s[c[k]] += w[k]; }
    const drop = new Set(), body = s.L + s.T;
    if (s.H > 0 && body > 0 && s.H >= s.F) {
      // hand resting on the thigh: the hand keeps its vertices (any gap is left on the thigh)
      if (s.H >= 0.25 * (s.H + s.F + s.U + body)) { drop.add('L'); drop.add('T'); } else { drop.add('H'); drop.add('F'); }
    } else if (s.F + s.H > 0 && body > 0) {
      // forearm pressed against the jacket: seam vertices stay with the jacket (any gap is left on
      // the inner forearm, facing the body, where it can't be seen)
      if (body >= 0.12 * (s.H + s.F + s.U + body)) { drop.add('H'); drop.add('F'); } else { drop.add('L'); drop.add('T'); }
    }
    if (s.U > 0 && s.L > 0 && !drop.has('L')) { if (s.U >= s.L) drop.add('L'); else drop.add('U'); }
    if (drop.size) {
      let tot = 0;
      for (let k = 0; k < 4; k++) { if (drop.has(c[k])) w[k] = 0; tot += w[k]; }
      if (tot > 0) for (let k = 0; k < 4; k++) sw.setComponent(v, k, w[k] / tot);
      for (const d of drop) s[d] = 0;
    }
    const tot = s.H + s.F + s.U + s.L + s.T + s.O || 1;
    tag[v] = (s.H + s.F) / tot > 0.5 ? 1 : s.L / tot > 0.5 ? 2 : 0;
  }
  sw.needsUpdate = true;
  const idx = geo.index;
  if (!idx) return;
  const keep = [];
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), d = idx.getX(t + 2);
    const has1 = tag[a] === 1 || tag[b] === 1 || tag[d] === 1, has2 = tag[a] === 2 || tag[b] === 2 || tag[d] === 2;
    if (!(has1 && has2)) keep.push(a, b, d);
  }
  if (keep.length !== idx.count) geo.setIndex(keep);
}
