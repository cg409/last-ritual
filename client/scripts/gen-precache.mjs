// Runs after `vite build`: lists the files each graphics tier downloads (and their total size) in dist/precache.json,
// so the "install as app" screen can show an honest download size and copy the right files to the device.
import fs from 'fs';
import path from 'path';
const dist = path.resolve('dist');
const all = [];
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); f.isDirectory() ? walk(p) : all.push(p); } })(dist);
const rel = all.map((p) => ({ url: '/' + path.relative(dist, p).split(path.sep).join('/'), bytes: fs.statSync(p).size }));
const skip = (u) => /^\/(sw\.js|config\.js|precache\.json|_headers|_redirects)$/.test(u);
const tier = (name) => {
  const lo = name === 'lite', md = name === 'md';
  const files = rel.filter((f) => {
    if (skip(f.url)) return false;
    if (/_lo\.(glb|webp)$/.test(f.url)) return lo;
    if (/_md\.glb$/.test(f.url)) return md;
    if (/\/(models|textures)\//.test(f.url) || /^\/models\//.test(f.url)) {
      if (lo && /\/textures\/.+\/(nor|arm|diff)\.webp$/.test(f.url)) return false;
      return !lo; // full-quality files are not needed by the light tier
    }
    return true;
  });
  // the light tier uses _lo files only: drop full-quality environment models for md/lite handled above; md keeps full characters / textures
  const final = files.filter((f) => !(/\/assets\/models\/.+\.glb$/.test(f.url) && !/_(lo|md)\.glb$/.test(f.url) && !/crow/.test(f.url) && (lo || md)));
  return { files: final.map((f) => f.url), bytes: final.reduce((a, f) => a + f.bytes, 0) };
};
const out = { lite: tier('lite'), md: tier('md'), full: tier('full') };
fs.writeFileSync(path.join(dist, 'precache.json'), JSON.stringify(out));
console.log('precache sizes (MB): lite', (out.lite.bytes / 1e6).toFixed(1), 'md', (out.md.bytes / 1e6).toFixed(1), 'full', (out.full.bytes / 1e6).toFixed(1));
