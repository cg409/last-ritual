// Fully procedural Web Audio: dark ambience drone, wind, heartbeat (terror radius) and SFX (sfx.js).
let ctx = null, master = null, amb = null;
export const now = () => ctx.currentTime;
export const getCtx = () => ctx;

export function initAudio() {
  if (ctx) { ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
}

export function noiseBuffer(sec = 2) {
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
export function out(pan = 0, gain = 1) {
  const g = ctx.createGain(); g.gain.value = gain;
  const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
  g.connect(p).connect(master); return g;
}
export function tone(freq, dur, type = 'sine', vol = 0.3, pan = 0, slide = 0) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = out(pan, 0);
  o.type = type; o.frequency.setValueAtTime(freq, now());
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), now() + dur);
  g.gain.setValueAtTime(0, now()); g.gain.linearRampToValueAtTime(vol, now() + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, now() + dur);
  o.connect(g); o.start(); o.stop(now() + dur + 0.05);
}
export function noise(dur, filterF, vol = 0.3, pan = 0, type = 'bandpass', q = 1) {
  if (!ctx) return;
  const s = ctx.createBufferSource(); s.buffer = noiseBuffer(Math.max(0.1, dur));
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterF; f.Q.value = q;
  const g = out(pan, 0);
  g.gain.setValueAtTime(vol, now()); g.gain.exponentialRampToValueAtTime(0.0001, now() + dur);
  s.connect(f).connect(g); s.start();
}

export function startAmbience(level = 1) {
  if (!ctx || amb) return;
  amb = { g: ctx.createGain(), nodes: [] }; amb.g.gain.value = 0; amb.g.connect(master);
  amb.g.gain.linearRampToValueAtTime(0.35 * level, now() + 3);
  for (const f of [43.65, 44.1, 65.4, 97.9]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
    const g = ctx.createGain(); g.gain.value = 0.08; o.connect(lp).connect(g).connect(amb.g); o.start(); amb.nodes.push(o);
  }
  const w = ctx.createBufferSource(); w.buffer = noiseBuffer(4); w.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.6;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
  const lg = ctx.createGain(); lg.gain.value = 250; lfo.connect(lg).connect(bp.frequency); lfo.start();
  const wg = ctx.createGain(); wg.gain.value = 0.25; w.connect(bp).connect(wg).connect(amb.g); w.start(); amb.nodes.push(w, lfo);
}
export function stopAmbience() {
  if (!amb) return;
  const a = amb; amb = null;
  a.g.gain.linearRampToValueAtTime(0, now() + 1.5);
  setTimeout(() => a.nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }), 1700);
}

let hbNext = 0;
export function heartbeat(intensity) {
  if (!ctx || intensity <= 0.02 || now() < hbNext) return;
  const v = 0.25 + intensity * 0.6;
  tone(55, 0.18, 'sine', v); setTimeout(() => tone(48, 0.2, 'sine', v * 0.8), 160);
  hbNext = now() + (1.3 - intensity * 0.75);
}
export { sfx } from './sfx.js';
