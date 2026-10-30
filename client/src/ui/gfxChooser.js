// First launch only: pick a graphics setting before anything heavy loads (it can be changed any time
// in Settings → Graphics). The machine is sniffed to recommend one.
import { PRESETS, update } from '../settings.js';
import { show, esc } from './dom.js';
import { gameTitle } from '../title.js';

const FLAG = 'tlr-gfx-chosen';

export function recommendPreset(renderer) {
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua))) return 'mobile';
  let gpu = '';
  try { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch { /* unknown */ }
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 8;
  if (/SwiftShader|llvmpipe|Software|Basic Render/i.test(gpu)) return 'ultra';
  if (/Intel/i.test(gpu)) return /Iris|Arc|Xe/i.test(gpu) && cores >= 8 ? 'low' : 'ultra';
  if (/NVIDIA|GeForce|RTX|GTX|Radeon RX|Radeon Pro/i.test(gpu)) return cores >= 8 && mem >= 8 ? 'high' : 'medium';
  return cores <= 4 || mem <= 4 ? 'low' : 'medium';
}

export function chooseGraphicsFirstTime(renderer) {
  if (localStorage.getItem(FLAG) || new URLSearchParams(location.search).has('debug')) return Promise.resolve();
  const rec = recommendPreset(renderer);
  const desc = {
    ultra: 'For computers without a graphics card. Smallest render size, no shadows or effects, sparse foliage.',
    mobile: 'For phones and tablets. Low detail, no shadows or effects.',
    low: 'Older or weak graphics. No shadows, little foliage.',
    medium: 'A balanced look for most computers with a graphics card.',
    high: 'Full shadows, effects and foliage. Needs a good graphics card.',
  };
  return new Promise((resolve) => {
    const ui = show(`
      <div class="screen gfxpick">
        <div class="panel gp-panel">
          <div class="lb-brand">${esc(gameTitle())}</div>
          <div class="h2" style="margin:4px 0 2px">Choose your graphics</div>
          <div class="lore" style="font-size:14px">You can change this any time in Settings → Graphics.</div>
          <div class="gp-grid">${['ultra', 'mobile', 'low', 'medium', 'high'].map((id) => `
            <button class="gp-card ${id === rec ? 'rec' : ''}" data-p="${id}">
              <b>${esc(PRESETS[id].label)}</b>${id === rec ? '<i>Recommended for this device</i>' : ''}
              <span>${esc(desc[id])}</span></button>`).join('')}
          </div>
        </div>
      </div>`);
    ui.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => {
      update({ preset: b.dataset.p });
      localStorage.setItem(FLAG, '1');
      resolve();
    }));
  });
}
