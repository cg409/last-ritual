// Settings screen (used from the main menu and the in-game pause menu): Graphics / Video / Audio /
// Controls (click-to-rebind) / Interface. Changes apply immediately and persist.
import { settings, update, resetSettings, PRESETS, ACTIONS, keyName } from '../settings.js';
import { esc } from './dom.js';
import { sfx } from '../audio.js';

let tab = 'graphics';

export function settingsPanel(container, onBack) {
  const s = settings();
  const slider = (id, label, val, min, max, step, fmt = (v) => v) =>
    `<label class="set-row"><span>${label}</span><input type="range" data-k="${id}" min="${min}" max="${max}" step="${step}" value="${val}"><b>${fmt(val)}</b></label>`;
  const toggle = (id, label, val) => `<label class="set-row"><span>${label}</span><input type="checkbox" data-k="${id}" ${val ? 'checked' : ''}><b></b></label>`;
  const tabs = { graphics: 'Graphics', video: 'Video', audio: 'Audio', controls: 'Controls', interface: 'Interface' };
  let body = '';
  if (tab === 'graphics') {
    body = `<div class="grid" style="grid-template-columns:repeat(3,1fr)">${Object.entries(PRESETS).map(([id, p]) =>
      `<div class="card ${s.preset === id ? 'sel' : ''}" data-preset="${id}"><div style="font-family:Cinzel;font-size:18px">${p.label}</div>
       <div class="lore" style="font-size:12px">${Math.round(p.pixelRatio * 100)}% res · ${p.shadows ? p.shadowRes + ' shadows' : 'no shadows'} · ${p.bloom ? 'bloom' : 'no bloom'} · ${p.antialias ? 'AA' : 'no AA'} · foliage ${Math.round(p.foliage * 100)}%</div></div>`).join('')}</div>
      <div class="lore" style="margin-top:10px;font-size:13px">Foliage density applies when the next match starts.</div>`;
  } else if (tab === 'video') {
    body = slider('video.brightness', 'Brightness', s.video.brightness, 0.6, 1.8, 0.05, (v) => Math.round(v * 100) + '%') +
      slider('video.fov', 'Field of view', s.video.fov, 55, 95, 1, (v) => v + '°') +
      toggle('video.vignette', 'Vignette', s.video.vignette) + toggle('video.filmGrain', 'Film grain (old TV look)', s.video.filmGrain) +
      toggle('video.showFps', 'Show FPS', s.video.showFps);
  } else if (tab === 'audio') {
    const pct = (v) => Math.round(v * 100) + '%';
    body = slider('audio.master', 'Master volume', s.audio.master, 0, 1, 0.05, pct) + slider('audio.music', 'Ambience / music', s.audio.music, 0, 1, 0.05, pct) + slider('audio.sfx', 'Effects', s.audio.sfx, 0, 1, 0.05, pct);
  } else if (tab === 'controls') {
    body = slider('controls.sensitivity', 'Mouse sensitivity', s.controls.sensitivity, 0.2, 3, 0.05, (v) => (+v).toFixed(2)) + toggle('controls.invertY', 'Invert mouse Y', s.controls.invertY) +
      `<div class="keys">${ACTIONS.map(([id, label]) => `<div class="set-row"><span>${esc(label)}</span><button class="keybtn" data-bind="${id}">${esc(keyName(s.controls.keys[id]))}</button></div>`).join('')}</div>`;
  } else {
    body = toggle('hud.minimap', 'Show mini-map', s.hud.minimap) + slider('hud.minimapSize', 'Mini-map size', s.hud.minimapSize, 140, 320, 10, (v) => v + 'px');
  }
  container.innerHTML = `
    <div class="panel settings" style="width:min(760px,94vw)">
      <div class="h2">Settings</div>
      <div class="tabs">${Object.entries(tabs).map(([id, l]) => `<button class="tab ${tab === id ? 'on' : ''}" data-tab="${id}">${l}</button>`).join('')}</div>
      <div class="set-body scroll" style="max-height:56vh">${body}</div>
      <div class="row" style="justify-content:space-between;margin-top:14px">
        <button class="btn small" id="set-reset">Reset defaults</button><button class="btn small primary" id="set-back">Back</button>
      </div>
    </div>`;
  const rerender = () => settingsPanel(container, onBack);
  container.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { tab = b.dataset.tab; sfx.click(); rerender(); });
  container.querySelectorAll('[data-preset]').forEach((b) => b.onclick = () => { update({ preset: b.dataset.preset }); sfx.click(); rerender(); });
  container.querySelectorAll('input[data-k]').forEach((inp) => {
    inp.oninput = () => {
      const [grp, key] = inp.dataset.k.split('.');
      const v = inp.type === 'checkbox' ? inp.checked : parseFloat(inp.value);
      update({ [grp]: { [key]: v } });
      if (inp.type === 'range') rerenderValue(inp);
    };
  });
  container.querySelectorAll('[data-bind]').forEach((b) => b.onclick = () => {
    b.textContent = 'Press a key…'; b.classList.add('wait');
    const h = (e) => {
      e.preventDefault(); e.stopPropagation(); window.removeEventListener('keydown', h, true);
      if (e.code !== 'Escape') update({ controls: { keys: { [b.dataset.bind]: e.code } } });
      rerender();
    };
    window.addEventListener('keydown', h, true);
  });
  container.querySelector('#set-reset').onclick = () => { resetSettings(); rerender(); };
  container.querySelector('#set-back').onclick = () => onBack();
}

function rerenderValue(inp) {
  const b = inp.parentElement.querySelector('b'); if (!b) return;
  const v = parseFloat(inp.value), k = inp.dataset.k;
  b.textContent = k.includes('fov') ? v + '°' : k.includes('Size') ? v + 'px' : k.includes('sensitivity') ? v.toFixed(2) : Math.round(v * 100) + '%';
}
