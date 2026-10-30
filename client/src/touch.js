// Mobile mode: detects phones / tablets and gives them an on-screen joystick, a look area and buttons.
// The buttons feed the same Input object as the keyboard, so the game itself never knows the difference.
import { settings, onSettings, setTouch } from './settings.js';

export function detectTouchDevice() {
  const q = new URLSearchParams(location.search).get('touch');
  const dev = settings().device;
  if (q == null && dev === 'phone') return true;
  if (q == null && dev === 'pc') return false;
  if (q === '1') return true;
  if (q === '0') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua)) return true;
  if (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)) return true; // iPadOS pretends to be a Mac
  const coarse = matchMedia('(pointer: coarse)').matches, fine = matchMedia('(any-pointer: fine)').matches;
  return coarse && !fine; // touch-only screens (a touch laptop with a mouse stays in PC mode)
}
export const isTouch = detectTouchDevice();
if (isTouch) document.documentElement.classList.add('touch');

// Names shown on the prompts instead of keyboard keys.
const KEY_NAMES = { E: 'ACT', SPACE: 'JUMP', H: 'HEAL', A: '◀', D: '▶', W: '▲', S: '▼', Q: 'SPECIAL', F: 'LIGHT', R: 'REV', T: 'TRAP', Z: 'DROP', M: 'MAP', SHIFT: 'SPRINT', LMB: 'NEXT', TAB: 'SPECTATE' };

// id, label, who sees it, how it behaves: hold = pressed while the finger is down, tap, toggle
const BUTTONS = [
  { id: 'act',    t: '✋', l: 'ACT',    show: 'sm',  kind: 'hold', big: true, key: 'interact' },
  { id: 'atk',    t: '⚔', l: 'ATTACK', show: 'm',   kind: 'attack', big: true },
  { id: 'jump',   t: '⤒', l: 'JUMP',   show: 'sm',  kind: 'tap',  key: 'skill' },
  { id: 'wig',    t: '↔', l: 'WIGGLE', show: 'carried', kind: 'wiggle' },
  { id: 'crouch', t: '▽', l: 'CROUCH', show: 's',   kind: 'toggle', key: 'crouch' },
  { id: 'heal',   t: '✚', l: 'HEAL',   show: 's',   kind: 'hold', key: 'heal' },
  { id: 'light',  t: '☀', l: 'LIGHT',  show: 's',   kind: 'tap',  key: 'light' },
  { id: 'quick',  t: '💬', l: 'SIGNAL', show: 's',   kind: 'wheel', key: 'quick' },
  { id: 'string', t: '➰', l: 'STRING', show: 'string', kind: 'tap', key: 'string' },
  { id: 'eye',    t: '👁', l: 'EYE',    show: 'eye', kind: 'tap',  key: 'eye' },
  { id: 'aim',    t: '◎', l: 'AIM',    show: 'm',   kind: 'aim' },
  { id: 'spec',   t: '★', l: 'SPECIAL', show: 'm',  kind: 'tap',  key: 'special' },
  { id: 'trap',   t: '⚙', l: 'TRAP',   show: 'm',   kind: 'tap',  key: 'trap' },
  { id: 'rev',    t: '≋', l: 'REV',    show: 'm',   kind: 'tap',  key: 'rev' },
  { id: 'drop',   t: '⤓', l: 'DROP',   show: 'm',   kind: 'tap',  key: 'drop' },
  { id: 'next',   t: '➜', l: 'NEXT',   show: 'dead', kind: 'next' },
  { id: 'spect',  t: '👻', l: 'SPECTATE', show: 'dead', kind: 'tap', key: 'spectate' },
];

export { BUTTONS };

// Full screen + landscape (needs a tap; not possible on iPhone Safari, where the installed app does it instead)
export function goFullscreen() {
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) return;
    const d = document.documentElement, p = (d.requestFullscreen || d.webkitRequestFullscreen)?.call(d);
    p?.then?.(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch?.(() => {});
  } catch { /* not allowed */ }
}

// ---- button layout ----
// Positions are in "units" (u = a fraction of the screen) measured from the RIGHT and BOTTOM edge to the
// button's centre, so the layout looks the same on every phone. The defaults follow the thumb-arc layout of
// popular mobile shooters / Dead by Daylight Mobile: the main action under the right thumb, the others fanned
// out around it in even steps. [right, bottom, size]
const DEFAULT_POS = {
  survivor: { act: [2.3, 2.5, 1.45], jump: [5.0, 1.7, 1], crouch: [4.7, 4.3, 1], heal: [2.1, 5.2, 1], light: [7.6, 3.4, 0.9], quick: [7.2, 5.4, 0.9],
    string: [7.8, 1.4, 0.9], eye: [9.6, 3.4, 0.9], wig: [2.3, 2.5, 1.45] },
  dead: { next: [2.3, 2.5, 1.45], spect: [5.0, 1.7, 1] },
  monster: { atk: [2.3, 2.5, 1.5], act: [5.2, 1.7, 1.1], jump: [4.6, 4.5, 1], aim: [2.1, 5.3, 1], spec: [7.3, 3.4, 1], trap: [7.9, 1.7, 1],
    rev: [7.0, 5.5, 0.95], drop: [4.7, 6.9, 0.95] },
};export const unitSize = () => Math.max(34, Math.min(62, Math.min(window.innerWidth / 17, window.innerHeight / 9.5)));
export const roleOf = (role, state) => (state === 'mouse' || state === 'escaped' ? 'dead' : role === 'monster' ? 'monster' : 'survivor');
// where a button sits right now, as fractions of the screen (x, y of its centre) and a size multiplier
export function placeOf(id, rk) {
  const t = settings().touch || {}, u = unitSize(), W = window.innerWidth, H = window.innerHeight;
  const def = DEFAULT_POS[rk]?.[id] || DEFAULT_POS.survivor[id] || DEFAULT_POS.monster[id] || [3, 3, 1];
  const c = t.pos?.[id];
  return { x: c ? c.x : 1 - def[0] * u / W, y: c ? c.y : 1 - def[1] * u / H, s: (t.size?.[id] ?? def[2]) };
}
export function roleButtons(rk) { return Object.keys(DEFAULT_POS[rk]).map((id) => BUTTONS.find((b) => b.id === id)); }
function styleButton(el, id, rk) {
  const t = settings().touch || {}, p = placeOf(id, rk), d = unitSize() * 1.2 * p.s * (t.scale || 1);
  el.style.cssText = `left:${p.x * window.innerWidth - d / 2}px;top:${p.y * window.innerHeight - d / 2}px;width:${d}px;height:${d}px;--d:${d}px;opacity:${t.opacity ?? 0.85}`;
}

export class TouchControls {
  constructor(input, hudRoot) {
    this.input = input; this.role = ''; this.state = ''; this.inv = {}; this.tick = 0;
    const el = this.el = document.createElement('div');
    el.className = 'tc';
    el.innerHTML = `
      <div class="tc-look"></div>
      <div class="tc-zone"><div class="tc-base"><div class="tc-knob"></div></div></div>
      <div class="tc-top">
        <button data-t="map">MAP</button><button data-t="chat">CHAT</button><button data-t="pause">❚❚</button>
      </div>
      <div class="tc-btns">${BUTTONS.map((b) => `<button class="tc-b" data-id="${b.id}" hidden><i>${b.t}</i><small>${b.l}</small></button>`).join('')}</div>
`;
    document.body.appendChild(el);
    this.base = el.querySelector('.tc-base'); this.knob = el.querySelector('.tc-knob');
    this.stickId = null; this.lookId = null; this.stickC = null; this.lookLast = null;
    this.bindStick(el.querySelector('.tc-zone')); this.bindLook(el.querySelector('.tc-look'));
    for (const b of el.querySelectorAll('.tc-b')) this.bindButton(b, BUTTONS.find((x) => x.id === b.dataset.id));
    const top = (n) => el.querySelector(`[data-t=${n}]`);
    const press = (e, fn) => { e.preventDefault(); e.stopPropagation(); fn(); };
    top('map').addEventListener('pointerdown', (e) => press(e, () => this.input.virtualKey('map')));
    top('chat').addEventListener('pointerdown', (e) => press(e, () => this.input.virtualKey('chat')));
    top('pause').addEventListener('pointerdown', (e) => press(e, () => this.input.onPause?.()));
    this.rk = 'survivor';
    this.onResize = () => this.layout();
    window.addEventListener('resize', this.onResize);
    this.offSet = onSettings(() => this.layout());
    this.onFs = () => this.goFullscreen();
    el.addEventListener('pointerdown', this.onFs, { once: true });
    this.prevHold = new Set();
  }

  goFullscreen() { goFullscreen(); }

  bindStick(zone) {
    const R = 52;
    zone.addEventListener('pointerdown', (e) => {
      if (this.stickId != null) return;
      e.preventDefault(); zone.setPointerCapture(e.pointerId); this.stickId = e.pointerId;
      const r = zone.getBoundingClientRect();
      this.stickC = { x: e.clientX, y: e.clientY };
      this.base.style.cssText = `display:block;left:${e.clientX - r.left - 60}px;top:${e.clientY - r.top - 60}px`;
      this.knob.style.transform = '';
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickId) return;
      let dx = e.clientX - this.stickC.x, dy = e.clientY - this.stickC.y;
      const l = Math.hypot(dx, dy); if (l > R) { dx = dx / l * R; dy = dy / l * R; }
      this.knob.style.transform = `translate(${dx}px,${dy}px)`;
      const x = dx / R, y = -dy / R, m = Math.hypot(x, y);
      const dz = 0.12; // dead zone
      this.input.stick = m < dz ? null : { x, y, mag: m };
    });
    const end = (e) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null; this.input.stick = null; this.base.style.display = 'none';
    };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  }

  bindLook(area) {
    area.addEventListener('pointerdown', (e) => {
      if (this.lookId != null) return;
      e.preventDefault(); area.setPointerCapture(e.pointerId); this.lookId = e.pointerId; this.lookLast = { x: e.clientX, y: e.clientY };
      this.lookT = performance.now(); this.lookMoved = 0;
    });
    area.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookId) return;
      const dx = e.clientX - this.lookLast.x, dy = e.clientY - this.lookLast.y;
      this.lookLast = { x: e.clientX, y: e.clientY }; this.lookMoved += Math.abs(dx) + Math.abs(dy);
      if (this.input.quickOpen) { this.input.onWheelMove?.(dx * 1.5, dy * 1.5); return; }
      const c = settings().controls, sens = 0.0042 * c.sensitivity;
      this.input.yaw -= dx * sens;
      this.input.pitch = Math.max(-1.1, Math.min(0.9, this.input.pitch - dy * sens * (c.invertY ? -1 : 1)));
    });
    const end = (e) => { if (e.pointerId === this.lookId) this.lookId = null; };
    area.addEventListener('pointerup', end); area.addEventListener('pointercancel', end);
  }

  bindButton(el, b) {
    const inp = this.input;
    let held = false;
    const down = (e) => {
      e.preventDefault(); e.stopPropagation(); el.setPointerCapture(e.pointerId); held = true; el.classList.add('on');
      if (b.kind === 'hold') inp.virtualKey(b.key, true);
      else if (b.kind === 'tap') { inp.virtualKey(b.key, true); inp.virtualKey(b.key, false); }
      else if (b.kind === 'toggle') { const on = inp.keys.has(inp.bind(b.key)); inp.virtualKey(b.key, !on); el.classList.toggle('lock', !on); }
      else if (b.kind === 'attack' || b.kind === 'next') { inp.actions.push({ t: 'attack' }); inp.spectateNext = true; }
      else if (b.kind === 'aim') inp.mouse.r = true;
      else if (b.kind === 'wiggle') inp.actions.push({ t: 'wiggle' });
      else if (b.kind === 'wheel') { this.lookId = e.pointerId; this.lookLast = { x: e.clientX, y: e.clientY }; inp.virtualKey(b.key, true); }
    };
    const up = (e) => {
      if (!held) return; held = false; el.classList.remove('on');
      if (b.kind === 'hold') inp.virtualKey(b.key, false);
      else if (b.kind === 'aim') { if (inp.mouse.r) inp.actions.push({ t: 'aimRelease' }); inp.mouse.r = false; }
      else if (b.kind === 'wheel') { inp.virtualKey(b.key, false); if (this.lookId === e.pointerId) this.lookId = null; }
    };
    el.addEventListener('pointerdown', down); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('pointermove', (e) => { // the signal wheel is aimed by dragging the finger that holds its button
      if (b.kind === 'wheel' && held && inp.quickOpen) {
        const dx = e.clientX - this.lookLast.x, dy = e.clientY - this.lookLast.y; this.lookLast = { x: e.clientX, y: e.clientY };
        inp.onWheelMove?.(dx * 1.5, dy * 1.5);
      }
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // me = local player snapshot (may be null)
  update(me, dt) {
    this.tick += dt; if (this.tick < 0.12) return; this.tick = 0;
    const role = me?.role || '', state = me?.state || '';
    const dead = state === 'mouse' || state === 'escaped';
    const inv = me?.inv || {};
    const sig = [role, state, !!inv.string, !!inv.eye].join();
    if (sig !== this.sig) {
      this.sig = sig;
      for (const b of BUTTONS) {
        const e = this.el.querySelector(`[data-id=${b.id}]`);
        const ok = { sm: !dead && !!role, s: role === 'survivor' && !dead, m: role === 'monster',
          carried: state === 'carried', string: role === 'survivor' && !dead && !!inv.string, eye: role === 'survivor' && !dead && !!inv.eye,
          dead }[b.show];
        e.hidden = state === 'carried' ? b.id !== 'wig' : !ok; // carried: only WIGGLE matters
      }
      this.el.querySelector('[data-id=atk]').hidden = !(role === 'monster');
      this.el.classList.toggle('is-monster', role === 'monster');
      this.rk = roleOf(role, state); this.layout();
    }
    for (const k of document.querySelectorAll('.hud .key')) {
      const t = k.textContent.trim();
      if (KEY_NAMES[t]) { k.dataset.orig ??= t; k.textContent = KEY_NAMES[t]; }
    }
  }

  layout() { for (const b of this.el.querySelectorAll('.tc-b')) styleButton(b, b.dataset.id, this.rk); }

  dispose() {
    window.removeEventListener('resize', this.onResize); this.offSet?.();
    this.input.stick = null; this.input.mouse.r = false;
    for (const b of BUTTONS) if (b.kind === 'hold' || b.kind === 'toggle') this.input.keys.delete(this.input.bind(b.key));
    this.el.remove();
  }
}

// Full-screen editor (Settings > Controls): drag a button to move it, pick it and use the slider to resize it.
export function openLayoutEditor(onClose) {
  let rk = 'survivor', sel = null;
  const el = document.createElement('div');
  el.className = 'tc-edit';
  el.innerHTML = `<div class="te-bar"><b>Edit buttons</b>
    <span class="te-tabs"><button data-r="survivor">Survivor</button><button data-r="monster">Monster</button></span>
    <label>Size <input type="range" id="te-size" min="0.5" max="1.8" step="0.05" value="1" disabled></label><span id="te-pick">drag a button, or tap one to resize it</span>
    <span class="te-end"><button id="te-reset">Reset to default</button><button id="te-done" class="primary">Done</button></span></div>
    <div class="te-stick">MOVE<small>(floating stick)</small></div><div class="te-look">drag here to look around</div><div class="te-field"></div>`;
  document.body.appendChild(el);
  const field = el.querySelector('.te-field'), size = el.querySelector('#te-size'), pick = el.querySelector('#te-pick');
  const draw = () => {
    field.innerHTML = '';
    el.querySelectorAll('[data-r]').forEach((b) => b.classList.toggle('on', b.dataset.r === rk));
    for (const b of roleButtons(rk)) {
      const n = document.createElement('div');
      n.className = 'tc-b te' + (sel === b.id ? ' sel' : ''); n.dataset.id = b.id; n.innerHTML = `<i>${b.t}</i><small>${b.l}</small>`;
      styleButton(n, b.id, rk); field.appendChild(n);
      n.addEventListener('pointerdown', (e) => {
        e.preventDefault(); n.setPointerCapture(e.pointerId); sel = b.id;
        field.querySelectorAll('.te').forEach((x) => x.classList.toggle('sel', x === n));
        size.disabled = false; size.value = placeOf(b.id, rk).s; pick.textContent = b.l;
        n.dragging = true;
      });
      n.addEventListener('pointermove', (e) => {
        if (!n.dragging) return;
        const x = Math.min(0.97, Math.max(0.03, e.clientX / window.innerWidth)), y = Math.min(0.95, Math.max(0.1, e.clientY / window.innerHeight));
        const t = settings().touch;
        setTouch({ pos: { ...t.pos, [b.id]: { x, y } } }); styleButton(n, b.id, rk);
      });
      const up = () => { n.dragging = false; };
      n.addEventListener('pointerup', up); n.addEventListener('pointercancel', up);
    }
  };
  size.oninput = () => {
    if (!sel) return;
    const t = settings().touch; setTouch({ size: { ...t.size, [sel]: parseFloat(size.value) } });
    const n = field.querySelector(`[data-id=${sel}]`); if (n) styleButton(n, sel, rk);
  };
  el.querySelectorAll('[data-r]').forEach((b) => { b.onclick = () => { rk = b.dataset.r; sel = null; size.disabled = true; pick.textContent = 'drag a button, or tap one to resize it'; draw(); }; });
  el.querySelector('#te-reset').onclick = () => { setTouch({ pos: {}, size: {} }); sel = null; size.disabled = true; draw(); };
  el.querySelector('#te-done').onclick = () => { el.remove(); onClose?.(); };
  draw();
}