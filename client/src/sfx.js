// Procedural sound effects. `pan` is -1 (left) .. 1 (right) so players can locate sounds.
// Recorded clips (sounds.js) cover the big sounds; these fill the gaps. All kept dark and low.
import { tone, noise } from './audio.js';

let lastHover = 0;
export const sfx = {
  // UI: a muffled knock on old wood (no bright blips); hovering is silent
  click: () => { noise(0.09, 260, 0.35, 0, 'lowpass', 1); tone(70, 0.12, 'sine', 0.18, 0, -20); },
  // moving the cursor over a button: the faintest dry tick (barely there), never more than ~12 per second
  hover: () => { const t = performance.now(); if (t - lastHover < 80) return; lastHover = t; noise(0.018, 3200, 0.035, 0, 'bandpass', 2.5); tone(1250, 0.018, 'sine', 0.012, 0, -250); },
  // a door: a creaking hinge (hide / unhide), slammed open (search)
  creak: (pan = 0, vol = 0.5) => { tone(190, 0.5, 'sawtooth', 0.05 * vol, pan, 70); noise(0.45, 900, 0.18 * vol, pan, 'bandpass', 9); },
  doorBang: (pan = 0, vol = 0.7) => { noise(0.25, 260, 0.6 * vol, pan, 'lowpass'); noise(0.1, 2200, 0.25 * vol, pan, 'bandpass', 3); },
  // a crisp mechanical click (sending a quick message)
  tick: () => { noise(0.025, 3800, 0.5, 0, 'highpass', 0.8); tone(1800, 0.03, 'square', 0.06, 0, -900); setTimeout(() => noise(0.02, 2400, 0.25, 0, 'bandpass', 2), 45); },
  skillWarn: () => { tone(220, 0.25, 'triangle', 0.12, 0, -20); noise(0.15, 900, 0.08, 0, 'bandpass', 4); },
  skillGood: () => noise(0.12, 300, 0.25, 0, 'lowpass'),
  skillGreat: () => { noise(0.16, 260, 0.3, 0, 'lowpass'); tone(98, 0.5, 'sine', 0.15, 0, -10); },
  fail: (pan = 0) => { noise(0.6, 300, 0.5, pan, 'lowpass'); tone(90, 0.8, 'sawtooth', 0.25, pan, -50); },
  crows: (pan = 0, vol = 0.5) => {
    for (let i = 0; i < 5; i++) setTimeout(() => { tone(900 + Math.random() * 500, 0.18, 'sawtooth', vol * 0.25, pan, -500); noise(0.15, 1800, vol * 0.2, pan); }, i * 110 + Math.random() * 80);
  },
  thunder: (pan = 0) => { noise(0.25, 3000, 0.6, pan, 'highpass'); setTimeout(() => noise(2.5, 120, 0.9, pan, 'lowpass'), 250); },
  swing: () => noise(0.25, 1400, 0.3, 0, 'bandpass', 2),
  // a tomb sealed: a low, dissonant swell (minor second) instead of a bright chime
  enchant: () => { tone(73.4, 2.6, 'sine', 0.22, 0, -4); tone(77.8, 2.6, 'sine', 0.14, 0, -4); noise(2.2, 180, 0.2, 0, 'lowpass'); },
  // a key: a rusty iron clank
  key: () => { noise(0.18, 1600, 0.3, 0, 'bandpass', 8); tone(180, 0.6, 'sawtooth', 0.06, 0, -60); },
  door: () => { noise(2.5, 200, 0.6, 0, 'lowpass'); tone(70, 2.5, 'sawtooth', 0.15, 0, -30); },
  blackout: () => { tone(200, 1.5, 'sine', 0.3, 0, -170); noise(1.2, 400, 0.3, 0, 'lowpass'); },
  teleport: (pan = 0) => { tone(120, 0.8, 'sawtooth', 0.2, pan, 400); noise(0.8, 600, 0.3, pan); },
  exposed: (pan = 0) => { tone(1400, 0.5, 'sawtooth', 0.2, pan, -1200); noise(0.6, 2000, 0.3, pan); },
  trap: (pan = 0) => { noise(0.08, 3000, 0.8, pan, 'highpass'); tone(400, 0.1, 'square', 0.3, pan); },
  string: () => { tone(110, 1.2, 'sine', 0.15, 0, -30); noise(0.8, 600, 0.1, 0, 'bandpass', 6); },
  throw: () => noise(0.5, 2500, 0.4, 0, 'bandpass', 3),
  trip: (pan = 0, vol = 0.6) => { noise(0.12, 1800, vol * 0.5, pan, 'bandpass', 2); setTimeout(() => { noise(0.35, 160, vol, pan, 'lowpass'); tone(70, 0.3, 'sine', vol * 0.4, pan, -30); }, 90); },
  pallet: (pan = 0, vol = 0.8) => { noise(0.08, 2500, vol * 0.4, pan, 'highpass'); noise(0.5, 220, vol, pan, 'lowpass'); tone(85, 0.35, 'square', vol * 0.25, pan, -40); },
  palletBreak: (pan = 0, vol = 0.8) => { for (let i = 0; i < 4; i++) setTimeout(() => noise(0.12, 1200 + Math.random() * 1600, vol * 0.5, pan, 'bandpass', 3), i * 70); noise(0.4, 300, vol * 0.6, pan, 'lowpass'); },
  // sensing someone's aura: a low, uneasy shimmer
  aura: () => { tone(110, 1.4, 'sine', 0.14, 0, -10); tone(116.5, 1.4, 'sine', 0.1, 0, -10); noise(1, 2400, 0.04, 0, 'bandpass', 10); },
};
