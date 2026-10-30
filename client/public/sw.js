// Service worker: lets the game install as an app and keeps its files on the device.
// - game files (models, textures, sounds): served from the device first, refreshed quietly in the background
// - the page itself and config.js: always fetched fresh, the saved copy is only a fallback when offline
const CACHE = 'tlr-app-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
const isGameFile = (u) => /\/(assets|models|icons)\//.test(u.pathname) && !/\/assets\/index-/.test(u.pathname);
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (isGameFile(url)) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  } else {
    e.respondWith(fetch(req).then((r) => { if (r.ok && !/config\.js$/.test(url.pathname)) caches.open(CACHE).then((c) => c.put(req, r.clone())); return r; }).catch(() => caches.match(req)));
  }
});
