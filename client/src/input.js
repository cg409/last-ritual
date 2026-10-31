// Keyboard + mouse controls with rebindable keys (see settings.js). Produces camera-relative movement
// and one-shot actions in the same packet format the server and bots use.
import { settings } from './settings.js';
import { isTouch } from './touch.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.yaw = 0; this.pitch = -0.15;
    this.actions = [];
    this.mouse = { l: false, r: false };
    this.enabled = false;
    this.stick = null; // on-screen joystick (mobile): {x, y, mag}
    this.onSkill = null; this.onToggleMap = null; this.onPause = null; this.onChat = null;
    this.onQuick = null; this.onWheelMove = null; this.quickOpen = false;
    this.spectateNext = false; this.spectating = false; // dead: roam as the mouse; TAB to spectate survivors
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    canvas.addEventListener('mousedown', (e) => this.mouseBtn(e, true));
    window.addEventListener('mouseup', (e) => this.mouseBtn(e, false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled || document.pointerLockElement !== canvas) return;
      if (this.quickOpen) { this.onWheelMove?.(e.movementX, e.movementY); return; } // the wheel takes the mouse
      const c = settings().controls, sens = 0.0024 * c.sensitivity * (this.down('zoom') ? 0.4 : 1); // steadier while zoomed
      this.yaw -= e.movementX * sens;
      this.pitch = Math.max(-1.1, Math.min(0.9, this.pitch - e.movementY * sens * (c.invertY ? -1 : 1)));
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  bind(action) { return settings().controls.keys[action]; }
  down(action) { return this.keys.has(this.bind(action)); }

  // a touch button pressing a bound key (mobile)
  virtualKey(action, down = true) {
    const code = this.bind(action); if (!code) return;
    this.key({ code, target: null, preventDefault() {} }, down);
  }

  lock() {
    if (isTouch || !this.enabled || document.pointerLockElement === this.canvas) return;
    try { const p = this.canvas.requestPointerLock?.(); p?.catch?.(() => {}); } catch { /* needs a user gesture */ }
  }

  key(e, down) {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (down && e.code === 'Escape' && this.enabled) { this.onPause?.(); return; }
    if (!this.enabled) return;
    const k = e.code, b = settings().controls.keys;
    if (down && !this.keys.has(k)) {
      if (b.chat === k && this.onChat?.()) { e.preventDefault(); return; }
      // quick-message wheel (survivors): hold, aim with the mouse, release to send
      if (b.quick === k && this.onQuick?.(true)) { this.keys.add(k); return; }
      for (const a of ['special', 'trap', 'rev', 'drop', 'light']) if (b[a] === k) this.actions.push({ t: a });
      if (b.string === k) this.actions.push({ t: 'item', item: 'string' });
      if (b.eye === k) this.actions.push({ t: 'item', item: 'eye' });
      // SPACE: skill check if one is showing, otherwise struggle (hooked) / jump.
      if (b.skill === k) { const used = this.onSkill?.(); this.actions.push({ t: 'struggle' }); if (!used) this.actions.push({ t: 'jump' }); }
      if (b.jump && b.jump !== b.skill && b.jump === k) this.actions.push({ t: 'jump' });
      if (b.left === k || b.right === k) this.actions.push({ t: 'wiggle' });
      if (b.spectate === k) { this.spectating = !this.spectating; e.preventDefault(); }
      if (b.map === k) this.onToggleMap?.();
      if (b.view === k) this.thirdPerson = !this.thirdPerson; // disguised Mimic: 1st / 3rd person
    }
    if (['Space', 'Tab', 'ControlLeft'].includes(k)) e.preventDefault();
    if (!down && this.quickOpen && b.quick === k) this.onQuick?.(false);
    if (down) this.keys.add(k); else this.keys.delete(k);
  }

  mouseBtn(e, down) {
    if (!this.enabled) return;
    if (down) this.lock();
    if (e.button === 0) { this.mouse.l = down; if (down) { this.actions.push({ t: this.mouse.r ? 'aimRelease' : 'attack' }); this.spectateNext = true; } } // (while aiming, the left button shoots)
    if (e.button === 2) { if (!down && this.mouse.r) this.actions.push({ t: 'aimCancel' }); this.mouse.r = down; }
  }

  sample() {
    let f = 0, s = 0;
    if (this.down('forward') || this.keys.has('ArrowUp')) f += 1;
    if (this.down('back') || this.keys.has('ArrowDown')) f -= 1;
    if (this.down('left') || this.keys.has('ArrowLeft')) s += 1;
    if (this.down('right') || this.keys.has('ArrowRight')) s -= 1;
    if (this.stick) { f += this.stick.y; s -= this.stick.x; }
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let mx = sin * f + cos * s, mz = cos * f - sin * s;
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    return {
      mx, mz, face: this.yaw,
      run: (this.stick && this.stick.mag > 0.85) || this.down('run') || this.keys.has('ShiftRight'),
      crouch: this.down('crouch'),
      crawl: this.down('crawl'),
      interact: this.down('interact'),
      heal: this.down('heal'),
      aim: this.mouse.r,
      zoom: this.down('zoom'),
      actions: this.actions.splice(0),
    };
  }
}
