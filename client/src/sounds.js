// Recorded sound clips (public/assets/sounds). Loaded once after the first click, decoded into
// AudioBuffers, then played one-shot (playClip) or looped with live volume / speed / pan (loopClip).
// GAIN balances the recordings against each other (measured loudness, see the list in README).
import { getCtx, buses, now } from './audio.js';

const BASE = `${import.meta.env.BASE_URL}assets/sounds/`;
export const CLIPS = {
  menu: 'menu.mp3', wind: 'wind.mp3', mansion: 'mansion.mp3', heartbeat: 'heartbeat.mp3', hung: 'hung.mp3',
  allDead: 'all_dead.mp3', chainsaw: 'chainsaw.mp3', chest: 'chest.mp3', logs: 'logs.mp3', hit: 'hit.mp3',
  kidLaugh: 'kid_laugh.mp3', levelUp: 'level_up.mp3', bones: 'bones.mp3', pallet: 'pallet.mp3', enchant: 'enchant.mp3',
  ghost: 'ghost.mp3', phone: 'phone.mp3',
  stalker: 'stalker.mp3', runWood: 'run_wood.mp3', runGrass: 'run_grass.mp3', walkConcrete: 'walk_concrete.mp3', walkGrass: 'walk_grass.mp3',
};
// Per-clip loudness trim (1 = as recorded).
// Measured RMS of each recording → trimmed to a common loudness (~0.12 RMS), capped so peaks don't clip.
export const GAIN = {
  menu: 0.5, wind: 1, mansion: 1.3, heartbeat: 1.3, hung: 0.85, allDead: 1, chainsaw: 0.6, chest: 1.1, logs: 1.6, hit: 0.85,
  ghost: 0.8, phone: 0.6,
  kidLaugh: 2, levelUp: 0.4, bones: 1.6, pallet: 0.9, enchant: 0.7, stalker: 1.5, runWood: 1.6, runGrass: 5, walkConcrete: 5, walkGrass: 9,
};
// Where the sound actually starts / how long it lasts (silence trimmed).
export const TRIM = { hit: [0.7, 1.0], stalker: [2.2], kidLaugh: [0.25, 3.0], wind: [1.0], pallet: [0.3], hung: [0.3], chainsaw: [0.4], mansion: [0, 5.6], bones: [0.2, 6.9], allDead: [0.2, 7.3], logs: [0.1, 1.5] };

const buffers = new Map();
let loading = null;
export function loadSounds() {
  const ctx = getCtx(); if (!ctx || loading) return loading;
  loading = Promise.all(Object.entries(CLIPS).map(async ([id, file]) => {
    try {
      const data = await (await fetch(BASE + file)).arrayBuffer();
      buffers.set(id, await ctx.decodeAudioData(data));
    } catch (e) { console.warn('sound failed', id, e); }
  }));
  return loading;
}
export const clipReady = (id) => buffers.has(id);
export const readyCount = () => buffers.size;
export const clipLength = (id) => buffers.get(id)?.duration || 0;

function chain(pan, music) {
  const ctx = getCtx(), g = ctx.createGain(), p = ctx.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  g.connect(p).connect(music ? buses().music : buses().sfx);
  return { g, p };
}

// One-shot. opts: vol, pan, rate, offset (s), dur (s), music, fadeIn, fadeOut
// filter: optional { type: 'highpass'|'bandpass'|'lowpass', freq, q } (e.g. to turn a moan into a whisper)
export function playClip(id, { vol = 1, pan = 0, rate = 1, offset = TRIM[id]?.[0] || 0, dur = TRIM[id]?.[1], music = false, fadeIn = 0.01, fadeOut = 0.15, filter = null } = {}) {
  const ctx = getCtx(), buf = buffers.get(id); if (!ctx || !buf || vol <= 0.001) return null;
  const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
  const { g, p } = chain(pan, music), v = vol * (GAIN[id] ?? 1), t = now();
  if (filter) {
    const f = ctx.createBiquadFilter(); f.type = filter.type; f.frequency.value = filter.freq; f.Q.value = filter.q ?? 0.7;
    src.connect(f); f.connect(g); src._f = f;
  }
  if (filter?.sweep) { p.pan.setValueAtTime(-filter.sweep, t); p.pan.linearRampToValueAtTime(filter.sweep, t + (dur || buf.duration) / rate); }
  const len = Math.min(dur ?? buf.duration - offset, buf.duration - offset) / rate;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + fadeIn);
  g.gain.setValueAtTime(v, t + Math.max(fadeIn, len - fadeOut)); g.gain.linearRampToValueAtTime(0, t + len);
  if (!src._f) src.connect(g);
  src.start(t, offset, len * rate + 0.05);
  return { stop: (f = 0.2) => { const n = now(); g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(g.gain.value, n); g.gain.linearRampToValueAtTime(0, n + f); try { src.stop(n + f + 0.05); } catch { /* done */ } }, len };
}

// Looping clip with live controls: set(vol, rate, pan) glides there; stop(fade).
export function loopClip(id, { vol = 1, pan = 0, rate = 1, music = false, fadeIn = 0.4 } = {}) {
  const ctx = getCtx(); if (!ctx) return null;
  const { g, p } = chain(pan, music);
  let src = null, cur = { vol, rate }, zeroSince = vol <= 0.001 ? now() : null, stopped = false;
  const start = () => {
    const buf = buffers.get(id); if (!buf || stopped) return;
    src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.playbackRate.value = cur.rate;
    src.connect(g); src.start(now(), Math.random() * buf.duration * 0.5);
  };
  g.gain.setValueAtTime(0, now()); g.gain.linearRampToValueAtTime(vol * (GAIN[id] ?? 1), now() + fadeIn);
  if (buffers.has(id)) start(); else loadSounds()?.then(start);
  return {
    set(v = cur.vol, r = cur.rate, pn) {
      if (stopped) return;
      cur = { vol: v, rate: r };
      g.gain.setTargetAtTime(v * (GAIN[id] ?? 1), now(), 0.12);
      if (src) src.playbackRate.setTargetAtTime(r, now(), 0.2);
      if (pn != null) p.pan.setTargetAtTime(Math.max(-1, Math.min(1, pn)), now(), 0.1);
      zeroSince = v <= 0.001 ? zeroSince ?? now() : null;
    },
    idle: () => zeroSince != null && now() - zeroSince > 1.5,
    stop(f = 0.4) {
      if (stopped) return; stopped = true;
      const n = now(); g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(g.gain.value, n); g.gain.linearRampToValueAtTime(0, n + f);
      try { src?.stop(n + f + 0.05); } catch { /* done */ }
    },
  };
}
