// In-game pause overlay (ESC): resume, settings, leave match.
// Singleplayer actually pauses the simulation; multiplayer keeps running (you're still in the realm).
import { settingsPanel } from './settingsMenu.js';

export class PauseMenu {
  constructor({ onResume, onLeave, canPause }) {
    this.onResume = onResume; this.onLeave = onLeave; this.canPause = canPause;
    this.el = null;
  }
  get open() { return !!this.el; }
  toggle() { if (this.el) this.close(); else this.show(); }
  show() {
    const hud = document.querySelector('.hud')?.parentElement || document.getElementById('ui');
    this.el = document.createElement('div'); this.el.className = 'overlay';
    hud.appendChild(this.el);
    document.exitPointerLock?.();
    this.main();
  }
  main() {
    this.el.innerHTML = `<div class="panel col" style="width:340px;text-align:center">
      <div class="h2">${this.canPause ? 'Paused' : 'Menu'}</div>
      <button class="btn" data-a="resume">Resume</button>
      <button class="btn" data-a="settings">Settings</button>
      <button class="btn" data-a="leave">Leave match</button></div>`;
    this.el.querySelector('[data-a=resume]').onclick = () => this.close();
    this.el.querySelector('[data-a=settings]').onclick = () => settingsPanel(this.el, () => this.main());
    this.el.querySelector('[data-a=leave]').onclick = () => { this.close(); this.onLeave(); };
  }
  close() { this.el?.remove(); this.el = null; this.onResume?.(); }
}
