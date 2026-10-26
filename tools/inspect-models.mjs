// Prints bounding boxes (metres), mesh/material counts for each downloaded glTF.
import fs from 'fs';
import path from 'path';
const ROOT = path.resolve('client/public/assets');
const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json')));
for (const [id, rel] of Object.entries(man.models)) {
  const g = JSON.parse(fs.readFileSync(path.join(ROOT, rel)));
  const min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  // approximate: use POSITION accessor min/max with node translation & scale (no rotation)
  const meshNodes = g.nodes.filter((n) => n.mesh != null);
  for (const n of meshNodes) {
    const s = n.scale || [1, 1, 1], t = n.translation || [0, 0, 0];
    for (const p of g.meshes[n.mesh].primitives) {
      const a = g.accessors[p.attributes.POSITION];
      for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], a.min[i] * s[i] + t[i]); max[i] = Math.max(max[i], a.max[i] * s[i] + t[i]); }
    }
  }
  const tris = g.meshes.reduce((n, m) => n + m.primitives.reduce((k, p) => k + (g.accessors[p.indices]?.count || 0) / 3, 0), 0);
  console.log(id.padEnd(24), 'size', max.map((v, i) => (v - min[i]).toFixed(2)).join(' x '), 'minY', min[1].toFixed(2), 'meshes', meshNodes.length, 'tris', Math.round(tris), 'rot', meshNodes.some((n) => n.rotation) ? 'Y' : '-');
}
