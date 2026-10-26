// Keyboard + mouse controls with rebindable keys (see settings.js). Produces camera-relative movement
// and one-shot actions in the same packet format the server and bots use.
import { settings } from './settings.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.yaw = 0; this.pitch = -0.15;
    this.actions = [];
    this.mouse = { l: false, r: false };
    this.enabled = false;
    this.onSkill = null; this.onToggleMap = null; this.onPause = null;
    this.spectateNext = false; this.spectating = false; // dead: roam as the mouse; TAB to spectate survivors
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    canvas.addEventListener('mousedown', (e) => this.mouseBtn(e, true));
    window.addEventListener('mouseup', (e) => this.mouseBtn(e, false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled || document.pointerLockElement !== canvas) return;
      const c = settings().controls, sens = 0.0024 * c.sensitivity;
      this.yaw -= e.movementX * sens;
      this.pitch = Math.max(-1.1, Math.min(0.9, this.pitch - e.movementY * sens * (c.invertY ? -1 : 1)));
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  bind(action) { return settings().controls.keys[action]; }
  down(action) { return this.keys.has(this.bind(action)); }

  lock() {
    if (!this.enabled || document.pointerLockElement === this.canvas) return;
    try { const p = this.canvas.requestPointerLock?.(); p?.catch?.(() => {}); } catch { /* needs a user gesture */ }
  }

  key(e, down) {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (down && e.code === 'Escape' && this.enabled) { this.onPause?.(); return; }
    if (!this.enabled) return;
    const k = e.code, b = settings().controls.keys;
    if (down && !this.keys.has(k)) {
      for (const a of ['candle', 'placeCandle', 'toggleCandle', 'special', 'trap', 'rev', 'drop']) if (b[a] === k) this.actions.push({ t: a });
      // SPACE: skill check if one is showing, otherwise struggle (hooked) / jump.
      if (b.skill === k) { const used = this.onSkill?.(); this.actions.push({ t: 'struggle' }); if (!used) this.actions.push({ t: 'jump' }); }
      if (b.jump && b.jump !== b.skill && b.jump === k) this.actions.push({ t: 'jump' });
      if (b.left === k || b.right === k) this.actions.push({ t: 'wiggle' });
      if (b.spectate === k) { this.spectating = !this.spectating; e.preventDefault(); }
      if (b.map === k) this.onToggleMap?.();
    }
    if (['Space', 'Tab', 'ControlLeft'].includes(k)) e.preventDefault();
    if (down) this.keys.add(k); else this.keys.delete(k);
  }

  mouseBtn(e, down) {
    if (!this.enabled) return;
    if (down) this.lock();
    if (e.button === 0) { this.mouse.l = down; if (down) { this.actions.push({ t: 'attack' }); this.spectateNext = true; } }
    if (e.button === 2) { if (!down && this.mouse.r) this.actions.push({ t: 'aimRelease' }); this.mouse.r = down; }
  }

  sample() {
    let f = 0, s = 0;
    if (this.down('forward') || this.keys.has('ArrowUp')) f += 1;
    if (this.down('back') || this.keys.has('ArrowDown')) f -= 1;
    if (this.down('left') || this.keys.has('ArrowLeft')) s += 1;
    if (this.down('right') || this.keys.has('ArrowRight')) s -= 1;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let mx = sin * f + cos * s, mz = cos * f - sin * s;
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    return {
      mx, mz, face: this.yaw,
      run: this.down('run') || this.keys.has('ShiftRight'),
      crouch: this.down('crouch') || this.keys.has('ControlLeft'),
      crawl: this.down('crawl'),
      interact: this.down('interact'),
      aim: this.mouse.r,
      actions: this.actions.splice(0),
    };
  }
}
