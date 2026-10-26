// Procedural sound effects. `pan` is -1 (left) .. 1 (right) so players can locate sounds.
import { tone, noise, out, now, getCtx } from './audio.js';

function sawRev(pan, vol) {
  const ctx = getCtx(); if (!ctx) return;
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(60, now()); o.frequency.linearRampToValueAtTime(140, now() + 1.2);
  const g = out(pan, 0);
  g.gain.linearRampToValueAtTime(vol * 0.35, now() + 0.2); g.gain.linearRampToValueAtTime(0, now() + 2.2);
  o.connect(g); o.start(); o.stop(now() + 2.3);
  noise(2.2, 900, vol * 0.25, pan);
}

export const sfx = {
  click: () => tone(320, 0.08, 'triangle', 0.15),
  hover: () => tone(180, 0.05, 'sine', 0.05),
  skillWarn: () => tone(880, 0.12, 'square', 0.12),
  skillGood: () => tone(660, 0.1, 'triangle', 0.15),
  skillGreat: () => { tone(880, 0.12, 'triangle', 0.18); tone(1320, 0.18, 'triangle', 0.1); },
  fail: (pan = 0) => { noise(0.6, 300, 0.5, pan, 'lowpass'); tone(90, 0.8, 'sawtooth', 0.25, pan, -50); },
  crows: (pan = 0, vol = 0.5) => {
    for (let i = 0; i < 5; i++) setTimeout(() => { tone(900 + Math.random() * 500, 0.18, 'sawtooth', vol * 0.25, pan, -500); noise(0.15, 1800, vol * 0.2, pan); }, i * 110 + Math.random() * 80);
  },
  saw: (pan = 0, vol = 0.6) => sawRev(pan, vol),
  thunder: (pan = 0) => { noise(0.25, 3000, 0.6, pan, 'highpass'); setTimeout(() => noise(2.5, 120, 0.9, pan, 'lowpass'), 250); },
  hit: () => { noise(0.25, 900, 0.6); tone(220, 0.4, 'sawtooth', 0.3, 0, -150); },
  scream: (pan = 0) => { tone(700, 0.9, 'sawtooth', 0.15, pan, 300); tone(720, 0.9, 'square', 0.06, pan, 260); },
  swing: () => noise(0.25, 1400, 0.3, 0, 'bandpass', 2),
  enchant: () => [262, 330, 392, 523].forEach((f, i) => setTimeout(() => tone(f, 1.6, 'sine', 0.15), i * 120)),
  key: () => { tone(1200, 0.4, 'triangle', 0.15); setTimeout(() => tone(1600, 0.6, 'triangle', 0.12), 120); },
  door: () => { noise(2.5, 200, 0.6, 0, 'lowpass'); tone(70, 2.5, 'sawtooth', 0.15, 0, -30); },
  blackout: () => { tone(200, 1.5, 'sine', 0.3, 0, -170); noise(1.2, 400, 0.3, 0, 'lowpass'); },
  teleport: (pan = 0) => { tone(120, 0.8, 'sawtooth', 0.2, pan, 400); noise(0.8, 600, 0.3, pan); },
  exposed: (pan = 0) => { tone(1400, 0.5, 'sawtooth', 0.2, pan, -1200); noise(0.6, 2000, 0.3, pan); },
  trap: (pan = 0) => { noise(0.08, 3000, 0.8, pan, 'highpass'); tone(400, 0.1, 'square', 0.3, pan); },
  string: () => tone(1800, 0.3, 'triangle', 0.12, 0, -1500),
  throw: () => noise(0.5, 2500, 0.4, 0, 'bandpass', 3),
  candle: () => noise(0.3, 2500, 0.15, 0, 'highpass'),
  stinger: () => { tone(110, 2.5, 'sawtooth', 0.2, 0, -40); tone(116.5, 2.5, 'sawtooth', 0.15); noise(2.5, 300, 0.2, 0, 'lowpass'); },
};
