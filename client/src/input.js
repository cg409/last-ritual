// Keyboard + mouse controls. Produces camera-relative movement and one-shot actions.
//  WASD move · Shift run · C/Ctrl crouch · X crawl · E (hold) interact · Space skill check
//  F hold/lower candle · G place / pick up candle · V light/snuff a nearby candle
//  Monster: LMB attack · RMB (hold) aim trident/string · Q special · T set trap · R rev chainsaw · Z drop
//  Carried: A/D wiggle · Hooked: Space struggle · Spectating: LMB next survivor, Tab toggle follow
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.yaw = 0; this.pitch = -0.15;
    this.actions = [];
    this.mouse = { l: false, r: false };
    this.enabled = false;
    this.onSkill = null;
    this.spectateNext = false; this.spectating = true;
    this.sens = 0.0024;
    const kd = (e) => this.key(e, true), ku = (e) => this.key(e, false);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    canvas.addEventListener('mousedown', (e) => this.mouseBtn(e, true));
    window.addEventListener('mouseup', (e) => this.mouseBtn(e, false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled || document.pointerLockElement !== canvas) return;
      this.yaw -= e.movementX * this.sens;
      this.pitch = Math.max(-1.1, Math.min(0.9, this.pitch - e.movementY * this.sens));
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  lock() {
    if (!this.enabled || document.pointerLockElement === this.canvas) return;
    try { const p = this.canvas.requestPointerLock?.(); p?.catch?.(() => {}); } catch { /* needs a user gesture; next click locks */ }
  }

  key(e, down) {
    if (!this.enabled) return;
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = e.code;
    if (down && !this.keys.has(k)) {
      const once = { KeyF: 'candle', KeyG: 'placeCandle', KeyV: 'toggleCandle', KeyQ: 'special', KeyT: 'trap', KeyR: 'rev', KeyZ: 'drop' }[k];
      if (once) this.actions.push({ t: once });
      if (k === 'Space') { this.onSkill?.(); this.actions.push({ t: 'struggle' }); }
      if (k === 'KeyA' || k === 'KeyD') this.actions.push({ t: 'wiggle' });
      if (k === 'Tab') { this.spectating = !this.spectating; e.preventDefault(); }
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

  // Build the input packet (movement relative to camera yaw).
  sample() {
    const k = this.keys;
    let f = 0, s = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) s += 1;
    if (k.has('KeyD') || k.has('ArrowRight')) s -= 1;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let mx = sin * f + cos * s, mz = cos * f - sin * s;
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    const pkt = {
      mx, mz, face: this.yaw,
      run: k.has('ShiftLeft') || k.has('ShiftRight'),
      crouch: k.has('KeyC') || k.has('ControlLeft'),
      crawl: k.has('KeyX'),
      interact: k.has('KeyE'),
      aim: this.mouse.r,
      actions: this.actions.splice(0),
    };
    return pkt;
  }
}
