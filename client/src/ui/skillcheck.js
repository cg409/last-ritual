// DbD-style skill check ring. The server sends {start, speed, zoneStart, zoneLen, great};
// the needle position is computed from the shared game clock. SPACE evaluates timing locally.
import { sfx } from '../audio.js';

export class SkillCheck {
  constructor() { this.cur = null; this.answered = new Set(); this.flash = 0; this.flashColor = '#fff'; }

  // gameTime: interpolated simulation time
  needle(sk, gameTime) { return (gameTime - sk.start) * sk.speed; } // in revolutions (0..1 = one lap)

  update(canvas, sk, gameTime, dt) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d'), W = canvas.width, c = W / 2, R = W * 0.36;
    ctx.clearRect(0, 0, W, W);
    if (sk && !this.answered.has(sk.id)) {
      if (this.cur?.id !== sk.id) { this.cur = sk; sfx.skillWarn(); }
      const n = this.needle(sk, gameTime);
      const a0 = -Math.PI / 2;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(220,210,190,.35)';
      ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(230,220,200,.95)'; ctx.lineWidth = 10; // good zone
      ctx.beginPath(); ctx.arc(c, c, R, a0 + sk.zoneStart * Math.PI * 2, a0 + (sk.zoneStart + sk.zoneLen) * Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 14; // great zone
      ctx.beginPath(); ctx.arc(c, c, R, a0 + sk.zoneStart * Math.PI * 2, a0 + (sk.zoneStart + sk.great) * Math.PI * 2); ctx.stroke();
      if (n >= 0) {
        const a = a0 + n * Math.PI * 2;
        ctx.strokeStyle = '#c21d1d'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * (R - 22), c + Math.sin(a) * (R - 22)); ctx.lineTo(c + Math.cos(a) * (R + 16), c + Math.sin(a) * (R + 16)); ctx.stroke();
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (n < 0) { // get-ready beat: pulsing "!" before the needle starts
        ctx.fillStyle = `rgba(255,220,160,${0.6 + Math.sin(gameTime * 18) * 0.4})`; ctx.font = '700 46px Cinzel, serif';
        ctx.fillText('!', c, c - 14);
        ctx.fillStyle = 'rgba(230,220,200,.9)'; ctx.font = '600 18px Cinzel, serif'; ctx.fillText('GET READY', c, c + 24);
      } else {
        ctx.fillStyle = 'rgba(230,220,200,.9)'; ctx.font = '600 22px Cinzel, serif';
        ctx.fillText('SPACE', c, c);
      }
    } else this.cur = null;
    if (this.flash > 0) {
      this.flash -= dt;
      ctx.globalAlpha = Math.max(0, this.flash * 2);
      ctx.fillStyle = this.flashColor; ctx.font = '700 26px Cinzel, serif'; ctx.textAlign = 'center';
      ctx.fillText(this.flashText, c, c); ctx.globalAlpha = 1;
    }
  }

  // Called when SPACE is pressed. Returns an action for the server or null.
  press(sk, gameTime) {
    if (!sk || this.answered.has(sk.id)) return null;
    const n = this.needle(sk, gameTime);
    if (n < 0) return null; // not started yet
    this.answered.add(sk.id);
    // A little forgiveness for input / frame latency (~60ms either side at the usual needle speed).
    const tol = 0.035;
    let result = 'miss';
    if (n >= sk.zoneStart - tol && n <= sk.zoneStart + sk.great + tol * 0.5) result = 'great';
    else if (n >= sk.zoneStart - tol && n <= sk.zoneStart + sk.zoneLen + tol) result = 'good';
    this.flash = 0.8; this.flashText = result.toUpperCase(); this.flashColor = result === 'miss' ? '#c21d1d' : '#fff';
    if (result === 'great') sfx.skillGreat(); else if (result === 'good') sfx.skillGood();
    return { t: 'skill', id: sk.id, result };
  }
}
