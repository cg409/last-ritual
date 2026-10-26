// Downloads CC0 assets from Poly Haven (https://polyhaven.com, CC0) into client/public/assets.
// Usage: node tools/fetch-assets.mjs [--dry]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'client', 'public', 'assets');
const DRY = process.argv.includes('--dry');
const RES = '1k';

// Kept small enough for the web (~100 MB total, cached by the browser after the first visit).
export const MODELS = [
  'dead_tree_trunk', 'dead_tree_trunk_02', 'shrub_01', 'shrub_02', 'shrub_04', 'fern_02', 'nettle_plant', 'weed_plant_02',
  'grass_medium_01', 'grass_medium_02', 'rock_moss_set_01', 'rock_moss_set_02', 'boulder_01', 'tree_stump_01',
  'dry_branches_medium_01', 'Barrel_01', 'wooden_crate_01', 'old_tyre', 'covered_car', 'large_iron_gate', 'street_lamp_01',
  'gothic_statue', 'wheelchair_01', 'Lantern_01', 'wooden_axe', 'street_rat',
];
export const TEXTURES = [
  'forest_ground_04', 'brown_mud_leaves_01', 'mossy_stone_wall', 'castle_wall_slates', 'weathered_plank_siding',
  'roof_slates_02', 'dark_wooden_planks', 'bark_brown_02', 'damaged_plaster',
];
const EXTRA = [
  ['https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/models/gltf/Parrot.glb', 'models/crow/Parrot.glb'],
];

async function json(url) { const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }
async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return 0;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(dest, buf); return buf.length;
}

const jobs = []; let total = 0;
const manifest = { models: {}, textures: {} };
for (const id of MODELS) {
  try {
    const f = await json(`https://api.polyhaven.com/files/${id}`);
    const g = f.gltf?.[RES]?.gltf || f.gltf?.['2k']?.gltf;
    if (!g) { console.warn('no gltf', id); continue; }
    const dir = `models/${id}`;
    jobs.push([g.url, path.join(OUT, dir, path.basename(g.url))]); total += g.size;
    for (const [rel, inc] of Object.entries(g.include || {})) { jobs.push([inc.url, path.join(OUT, dir, rel)]); total += inc.size; }
    manifest.models[id] = `${dir}/${path.basename(g.url)}`;
    console.log(id.padEnd(26), ((g.size + Object.values(g.include || {}).reduce((a, b) => a + b.size, 0)) / 1e6).toFixed(1), 'MB');
  } catch (e) { console.warn('skip', id, e.message); }
}
for (const id of TEXTURES) {
  try {
    const f = await json(`https://api.polyhaven.com/files/${id}`);
    const set = {};
    for (const [k, name] of [['Diffuse', 'diff'], ['nor_gl', 'nor'], ['arm', 'arm']]) {
      const t = f[k]?.[RES]?.jpg; if (!t) continue;
      const rel = `textures/${id}/${name}.jpg`;
      jobs.push([t.url, path.join(OUT, rel)]); total += t.size; set[name] = rel;
    }
    manifest.textures[id] = set;
  } catch (e) { console.warn('skip', id, e.message); }
}
for (const [url, rel] of EXTRA) jobs.push([url, path.join(OUT, rel)]);
console.log(`TOTAL ≈ ${(total / 1e6).toFixed(1)} MB in ${jobs.length} files`);
if (!DRY) {
  let done = 0;
  const queue = jobs.slice();
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) { const [u, d] = queue.shift(); await download(u, d); if (++done % 20 === 0) console.log(`${done}/${jobs.length}`); }
  }));
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log('done');
}
