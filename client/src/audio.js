// Fully procedural Web Audio: dark ambience drone, wind, heartbeat (terror radius) and SFX (sfx.js).
import { settings, onSettings } from './settings.js';
let ctx = null, master = null, sfxBus = null, musicBus = null, amb = null;
export const now = () => ctx.currentTime;
export const getCtx = () => ctx;
export const buses = () => ({ sfx: sfxBus, music: musicBus });

export function initAudio() {
  if (ctx) { ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.connect(master);
  applyVolumes(); onSettings(applyVolumes);
  loadSounds();
}
function applyVolumes() {
  if (!ctx) return;
  const a = settings().audio;
  master.gain.value = a.master; sfxBus.gain.value = a.sfx; musicBus.gain.value = a.music;
}

export function noiseBuffer(sec = 2) {
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
export function out(pan = 0, gain = 1) {
  const g = ctx.createGain(); g.gain.value = gain;
  const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
  g.connect(p).connect(sfxBus); return g;
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


// Background: in the menus / lobby the "menu and lobby" track; in a match a low, quiet drone
// (the wind, the mansion, the monsters... are real recordings — see soundscape.js).
export function startAmbience(level = 1) {
  if (!ctx || amb) return;
  amb = { g: ctx.createGain(), nodes: [], music: null }; amb.g.gain.value = 0; amb.g.connect(musicBus);
  if (level < 1) { // menus & lobby
    amb.g.gain.linearRampToValueAtTime(1, now() + 2);
    amb.music = loopClip('menu', { vol: 0.55, music: true, fadeIn: 2.5 });
    return;
  }
  amb.g.gain.linearRampToValueAtTime(0.22, now() + 3);
  for (const f of [43.65, 44.1, 65.4]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
    const g = ctx.createGain(); g.gain.value = 0.08; o.connect(lp).connect(g).connect(amb.g); o.start(); amb.nodes.push(o);
  }
}
export function stopAmbience() {
  if (!amb) return;
  const a = amb; amb = null;
  a.g.gain.linearRampToValueAtTime(0, now() + 1.5);
  a.music?.stop(1.5);
  setTimeout(() => a.nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }), 1700);
}

// Terror-radius heartbeat (the "heart beat" recording, looped): silent far away, then louder and
// faster the closer the monster gets. Call every frame with 0..1.
let hb = null;
export function heartbeat(intensity) {
  if (!ctx) return;
  if (intensity < 0) { hb?.stop(0.6); hb = null; return; } // match over
  if (!hb && intensity > 0.02) hb = loopClip('heartbeat', { vol: 0 });
  if (!hb) return;
  const k = Math.max(0, intensity);
  // clearly there from the edge of the terror radius, pounding when it is on top of you
  hb.set(k <= 0.02 ? 0 : 0.5 + Math.pow(k, 0.7) * 1.1, 0.8 + k * 0.85);
  if (k <= 0.02 && hb.idle()) { hb.stop(0.5); hb = null; }
}
export { sfx } from './sfx.js';
import { loadSounds, loopClip } from './sounds.js';