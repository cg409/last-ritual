// Mobile mode: detects phones / tablets and gives them an on-screen joystick, a look area and buttons.
// The buttons feed the same Input object as the keyboard, so the game itself never knows the difference.
import { settings } from './settings.js';

export function detectTouchDevice() {
  const q = new URLSearchParams(location.search).get('touch');
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
      <div class="tc-btns">${BUTTONS.map((b) => `<button class="tc-b ${b.big ? 'big' : ''}" data-id="${b.id}" hidden><i>${b.t}</i><small>${b.l}</small></button>`).join('')}</div>
      <div class="tc-rotate"><div>↻</div>Rotate your phone sideways to play</div>`;
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
    this.onFs = () => this.goFullscreen();
    el.addEventListener('pointerdown', this.onFs, { once: true });
    this.prevHold = new Set();
  }

  goFullscreen() {
    try {
      const d = document.documentElement;
      (d.requestFullscreen || d.webkitRequestFullscreen)?.call(d)?.then?.(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch?.(() => {});
    } catch { /* not allowed (iPhone Safari) */ }
  }

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
        e.hidden = !ok;
      }
      this.el.querySelector('[data-id=atk]').hidden = !(role === 'monster');
      this.el.classList.toggle('is-monster', role === 'monster');
    }
    for (const k of document.querySelectorAll('.hud .key')) {
      const t = k.textContent.trim();
      if (KEY_NAMES[t]) { k.dataset.orig ??= t; k.textContent = KEY_NAMES[t]; }
    }
  }

  dispose() {
    this.input.stick = null; this.input.mouse.r = false;
    for (const b of BUTTONS) if (b.kind === 'hold' || b.kind === 'toggle') this.input.keys.delete(this.input.bind(b.key));
    this.el.remove();
  }
}
