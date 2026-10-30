// In-match soundscape built from the recorded clips (sounds.js):
//  - wind that never stops (random gusts overlapping, random side and strength)
//  - one whisper in the mansion per match, a child's laugh somewhere far away now and then
//  - the monster's own voice, mostly when it is close to a survivor — both sides hear it
//  - footsteps for every nearby player, matched to the ground (grass / wooden floors / stone)
//  - the tomb rite while someone nearby is enchanting
import { playClip, loopClip, clipLength } from './sounds.js';
import { getCtx } from './audio.js';
import { dist } from '@shared/rng.js';

const rnd = (a, b) => a + Math.random() * (b - a);
// The monster's voice: which recording, at what speed and how much of it.
const VOICE = {
  mimic: { id: 'bones', rate: 1, dur: 3.2, rnd: 3.5 },        // bones cracking as it shifts its shape
  stalker: { id: 'stalker', rate: 1 },
  puppeteer: { id: 'kidLaugh', rate: 0.92 },
  wanderer: { id: 'stalker', rate: 0.8 },                       // the same breathing, slower and deeper
  ravager: { id: 'chainsaw', rate: 0.85, dur: 2.2, rnd: 8, vol: 0.55 }, // the saw idling
};

export class Soundscape {
  constructor(map) {
    this.map = map; this.t = 0;
    this.windT = 0; this.whispered = false; this.kidT = rnd(90, 180); this.voiceT = rnd(8, 16);
    this.steps = new Map(); this.enchant = null;
  }

  surface(x, z, level) {
    if (level) return 'wood';
    if (this.map.buildings.some((b) => Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2)) return 'wood';
    const c = this.map.cemetery;
    if (c && Math.abs(x - c.x) < c.w / 2 && Math.abs(z - c.z) < c.d / 2) return 'stone';
    if (Math.abs(x) < 4.6 && z > 8.2 && z < 11.4) return 'stone'; // the mansion porch
    return 'grass';
  }

  update(dt, s, me, yaw) {
    if (!getCtx() || !s || !me) return;
    this.t += dt;
    const L = me, pan = (x, z) => -Math.sin(Math.atan2(x - L.x, z - L.z) - yaw);
    const indoors = this.surface(L.x, L.z, L.level | 0) === 'wood';
    const inMansion = Math.abs(L.x) < 12 && Math.abs(L.z) < 8.4;

    // wind: always — the next gust starts before the last one fades
    if (this.t >= this.windT) {
      const g = playClip('wind', { vol: rnd(0.3, 0.7) * (indoors ? 0.35 : 1), pan: rnd(-0.8, 0.8), rate: rnd(0.85, 1.1) });
      this.windT = this.t + (g ? g.len * rnd(0.55, 0.95) : 1);
    }
    // The mansion whispers — once a match, at one moment (set by the map), heard only by those inside.
    // The recording is thinned to its breathy highs and drifts from one ear to the other.
    const whisperAt = 150 + (this.map.seed % 240);
    if (!this.whispered && (s.time || 0) >= whisperAt) {
      this.whispered = true;
      if (inMansion) playClip('mansion', { vol: 1.5, rate: 0.92, filter: { type: 'highpass', freq: 1400, q: 0.9, sweep: 0.8 } });
    }
    // a child laughs, far off
    if (this.t >= this.kidT) { playClip('kidLaugh', { vol: rnd(0.12, 0.25), pan: rnd(-1, 1), rate: rnd(0.85, 1) }); this.kidT = this.t + rnd(120, 240); }

    // the monster's voice
    const mon = s.players.find((p) => p.role === 'monster');
    if (mon && this.t >= this.voiceT) {
      const surv = s.players.filter((p) => p.role === 'survivor' && p.state === 'alive');
      const near = Math.min(99, ...surv.map((p) => dist(p.x, p.z, mon.x, mon.z)));
      const v = VOICE[mon.monster] || VOICE.stalker;
      if (!(mon.monster === 'mimic' && mon.disguise)) {
        const d = me.id === mon.id ? 0 : dist(L.x, L.z, mon.x, mon.z);
        const vol = (me.id === mon.id ? 0.45 : Math.pow(Math.max(0, 1 - d / 50), 1.3)) * (v.vol || 1);
        if (vol > 0.04) playClip(v.id, { vol, pan: me.id === mon.id ? 0 : pan(mon.x, mon.z), rate: v.rate, ...(v.dur ? { dur: v.dur, offset: Math.random() * (v.rnd || 0) } : {}) });
      }
      this.voiceT = this.t + (near < 22 ? rnd(7, 15) : rnd(35, 70)); // mostly when it is close to someone
    }

    // footsteps of everyone close by (yours too)
    const seen = new Set();
    for (const p of s.players) {
      const d = p.id === me.id ? 0 : dist(L.x, L.z, p.x, p.z);
      if (d > 18 || p.state === 'escaped' || p.state === 'mouse' || p.state === 'hooked' || p.state === 'carried') continue;
      const moving = p.speed > 0.3 && (p.y || 0) < 0.1;
      const surf = this.surface(p.x, p.z, p.level | 0), run = !!p.running;
      const clip = surf === 'wood' ? 'runWood' : surf === 'stone' ? 'walkConcrete' : run ? 'runGrass' : 'walkGrass';
      const rate = (surf === 'wood' ? (run ? 1.05 : 0.72) : surf === 'stone' ? (run ? 1.55 : 1) : run ? 1 : 1) * (p.role === 'monster' ? 0.85 : 1);
      let vol = (p.id === me.id ? 0.5 : 0.9 * Math.pow(1 - d / 18, 1.5)) * (p.role === 'monster' ? 1.25 : 1);
      if (p.crouch) vol *= 0.3; if (p.crawl || p.state === 'downed') vol *= 0.2; if (surf === 'wood' && !run) vol *= 0.6;
      let h = this.steps.get(p.id);
      if (h && h.clip !== clip) { h.loop.stop(0.25); h = null; this.steps.delete(p.id); }
      if (!h && moving) { h = { clip, loop: loopClip(clip, { vol: 0, rate, fadeIn: 0.05 }) }; this.steps.set(p.id, h); }
      if (h) h.loop?.set(moving ? vol : 0, rate, p.id === me.id ? 0 : pan(p.x, p.z));
      seen.add(p.id);
    }
    for (const [id, h] of this.steps) if (!seen.has(id) || h.loop?.idle()) { h.loop?.stop(0.3); this.steps.delete(id); }

    // the tomb rite while someone near you is enchanting
    let best = 99, bx = 0, bz = 0;
    for (const p of s.players) if (p.act === 'enchant') { const d = dist(L.x, L.z, p.x, p.z); if (d < best) { best = d; bx = p.x; bz = p.z; } }
    if (best < 16) {
      this.enchant ||= loopClip('enchant', { vol: 0 });
      this.enchant?.set(0.7 * (1 - best / 16), 1, best < 1.5 ? 0 : pan(bx, bz));
    } else if (this.enchant) { this.enchant.set(0); if (this.enchant.idle()) { this.enchant.stop(0.5); this.enchant = null; } }
    void clipLength;
  }

  dispose() {
    for (const h of this.steps.values()) h.loop?.stop(0.3);
    this.steps.clear(); this.enchant?.stop(0.5); this.enchant = null;
  }
}
