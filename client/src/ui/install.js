// First screen: offer to install the game as an app (Android / PC: one tap; iPhone: Add to Home Screen).
// Installing also copies the game files onto the device (so later launches are fast and work on a bad
// connection). The screen shows the download size. "Skip" simply plays in the browser.
import { show, on, q } from './dom.js';
import { graphics } from '../settings.js';
import { isTouch } from '../touch.js';

let deferred = null;
let onReady = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; onReady?.(); });
window.addEventListener('appinstalled', () => localStorage.setItem('tlr-installed', '1'));

const standalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
const isIos = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
const mb = (b) => (b / 1e6 < 10 ? (b / 1e6).toFixed(1) : Math.round(b / 1e6)) + ' MB';

async function sizeInfo() {
  const g = graphics(), key = g.lite ? 'lite' : g.lod ? 'md' : 'full';
  try { const d = await (await fetch('/precache.json', { cache: 'no-store' })).json(); return { key, ...d[key] }; } catch { return null; }
}

// copy the game files for this device's graphics tier into the app cache, reporting progress
async function precache(info, onProgress) {
  const cache = await caches.open('tlr-app-v1');
  let done = 0;
  const queue = [...info.files];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const url = queue.shift();
      try { if (!(await cache.match(url))) { const r = await fetch(url); if (r.ok) await cache.put(url, r); } } catch { /* offline copy is optional */ }
      onProgress(++done / info.files.length);
    }
  }));
}

export async function installScreen() {
  const dismissed = Number(localStorage.getItem('tlr-install-skip') || 0);
  if (standalone() || localStorage.getItem('tlr-installed') === '1' || Date.now() - dismissed < 14 * 86400000) return;
  if (new URLSearchParams(location.search).has('debug') || !('serviceWorker' in navigator)) return;
  // give the browser a moment to announce that it can install the app
  if (!isIos() && !deferred) await new Promise((r) => { onReady = r; setTimeout(r, 1500); }); // the browser announces 'installable' a moment after loading
  if (!isIos() && !deferred && !isTouch) return; // desktop browsers that can't install: just play
  const info = await sizeInfo();
  const size = info ? mb(info.bytes) : 'about 20 MB';
  return new Promise((resolve) => {
    const ios = isIos();
    show(`
      <div class="screen installv"><div class="mm-fade"></div>
        <div class="panel inst-panel">
          <img class="inst-icon" src="/icons/icon-192.png" alt="">
          <div class="h2">Install The Last Ritual</div>
          <div class="lore">Play it like a real app: <span style="color:#e8d8a8">full screen</span>, faster to open, and the game files stay on your device.</div>
          <div class="inst-size">Download size <b>${size}</b></div>
          ${ios ? '<div class="lore inst-steps">On iPhone / iPad: tap <b>Share</b> (the square with an arrow), then <b>Add to Home Screen</b>.</div>' : ''}
          <div class="inst-bar" id="inst-bar" hidden><i id="inst-fill"></i></div>
          <div class="inst-msg" id="inst-msg"></div>
          <div class="inst-btns">
            ${ios ? '' : '<button class="btn primary" id="inst-go">Install app</button>'}
            <button class="btn" id="inst-skip">${ios ? 'Continue' : 'Skip - play in the browser'}</button>
          </div>
        </div>
      </div>`);
    const finish = () => { localStorage.setItem('tlr-install-skip', String(Date.now())); resolve(); };
    on('#inst-skip', 'click', finish);
    on('#inst-go', 'click', async () => {
      const go = q('#inst-go'), msg = q('#inst-msg'), bar = q('#inst-bar'), fill = q('#inst-fill');
      go.disabled = true;
      if (deferred) {
        deferred.prompt();
        const choice = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' }));
        deferred = null;
        if (choice.outcome !== 'accepted') { go.disabled = false; msg.textContent = 'Not installed. You can skip and play in the browser.'; return; }
        localStorage.setItem('tlr-installed', '1');
      } else {
        // the browser has not offered a one-tap install: wait a moment, then show the manual way
        await new Promise((r) => { onReady = r; setTimeout(r, 2500); });
        if (deferred) { go.disabled = false; go.click(); return; }
        msg.textContent = 'Open your browser menu (the three dots) and choose "Install app" or "Add to Home screen".';
      }
      if (info) {
        bar.hidden = false; msg.textContent = 'Downloading the game files...';
        await precache(info, (k) => { fill.style.width = Math.round(k * 100) + '%'; });
        msg.textContent = 'Done! Launch it from your home screen any time.';
      }
      setTimeout(finish, 1400);
    });
  });
}

// Used by Settings > Interface ("Install the app"): the browser's own install box, or the manual steps.
export const isInstalled = () => standalone() || localStorage.getItem('tlr-installed') === '1';
export async function installNow() {
  if (deferred) {
    deferred.prompt();
    const c = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' }));
    deferred = null; if (c.outcome === 'accepted') localStorage.setItem('tlr-installed', '1');
    return c.outcome === 'accepted' ? 'Installed! Launch it from your home screen.' : 'Not installed.';
  }
  return isIos() ? 'Tap the Share button, then "Add to Home Screen".' : 'Open your browser menu (the three dots) and choose "Install app" or "Add to Home screen".';
}