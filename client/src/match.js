// Runs one match on the client: receives snapshots, renders, sends input, plays audio, drives the HUD.
import { generateMap, lineOfSight } from '@shared/map.js';
import { dist } from '@shared/rng.js';
import { MONSTERS } from '@shared/constants.js';
import { GameView } from './render/view.js';
import { Hud } from './ui/hud.js';
import { SkillCheck } from './ui/skillcheck.js';
import { sfx, heartbeat, startAmbience, stopAmbience } from './audio.js';
import { eventFeed } from './events.js';
import { MiniMap } from './ui/minimap.js';
import { PauseMenu } from './ui/pause.js';
import { EasterEggs } from './render/easterEggs.js';
import { QuickWheel, showQuick } from './ui/quickWheel.js';
import { Soundscape } from './soundscape.js';
import { playClip } from './sounds.js';
import { grantAchievement } from './profile.js';
import { setGameTitle } from './title.js';
import { isTouch, TouchControls } from './touch.js';

export class Match {
  constructor({ stage, input, session, myId, onEnd }) {
    this.stage = stage; this.input = input; this.session = session; this.myId = myId; this.onEnd = onEnd;
    this.map = generateMap(session.seed);
    this.view = new GameView(stage, this.map, myId);
    // (footsteps are recorded clips now — soundscape.js)
    this.hud = null; this.skill = new SkillCheck();
    this.snap = null; this.lastSnapAt = 0; this.hudT = 0; this.sendT = 0; this.ended = false;
    this.seenTombs = new Set(); this.pings = [];
    session.onSnap = (s) => this.onSnap(s);
  }

  begin() {
    this.hud = new Hud();
    this.input.enabled = true; this.input.lock();
    if (isTouch) this.touch = new TouchControls(this.input, document.querySelector('.hud'));
    this.input.onSkill = () => {
      const me = this.view.me();
      const a = me && this.skill.press(me.skill, this.gameTime());
      if (a) this.input.actions.push(a);
      return !!a || !!me?.skill || !!me?.act; // consumed: don't also jump
    };
    const me = this.view.me();
    if (me) this.input.yaw = me.rot;
    this.sound = new Soundscape(this.map);
    this.eggs = new EasterEggs({ view: this.view, stage: this.stage, map: this.map, hud: this.hud, grant: grantAchievement, onTitle: setGameTitle });
    this.minimap = new MiniMap(this.map, document.querySelector('.hud'));
    this.input.onToggleMap = () => this.minimap.toggle();
    // In-match chat (Enter). Your own messages go through the session; bots only speak when caught.
    this.input.onChat = () => {
      if (this.pause?.open) return false;
      this.input.keys.clear();
      this.hud.openChat((text) => this.session.sendChat?.(text, this.view.me()?.name || 'You'));
      return true;
    };
    // Quick-message wheel (survivors only): hold Q, aim, release.
    this.wheel = new QuickWheel(document.querySelector('.hud'));
    this.input.onWheelMove = (dx, dy) => this.wheel.move(dx, dy);
    this.input.onQuick = (down) => {
      const me = this.view.me();
      if (down) {
        if (!me || me.role !== 'survivor' || ['mouse', 'escaped'].includes(me.state) || this.pause?.open) return false;
        this.wheel.show(me.quickCd || 0); this.input.quickOpen = true;
        return true;
      }
      this.input.quickOpen = false;
      const msg = this.wheel.close();
      if (msg && !(me?.quickCd > 0)) { this.input.actions.push({ t: 'quick', msg }); sfx.tick(); }
      return true;
    };
    this.pause = new PauseMenu({
      canPause: !!this.session.game,
      onResume: () => { this.session.paused = false; this.input.enabled = true; },
      onLeave: () => this.finish({ ...this.abandonResult(), left: true }),
    });
    this.input.onPause = () => {
      this.pause.toggle();
      if (this.pause.open) { this.session.paused = true; this.input.keys.clear(); this.input.mouse.r = false; }
    };
    startAmbience(1);
    const mon = this.view.monster();
    if (me?.role === 'monster') this.hud.banner(`YOU ARE ${MONSTERS[mon.monster].name}<br><span style="font-size:16px">Hunt them. Hang them. Let none escape.</span>`, 6000, '#c21d1d');
    else this.hud.banner(`${mon.name.toUpperCase()} HAS BECOME ${MONSTERS[mon.monster].name}<br><span style="font-size:16px">It awakens in 10 seconds. Enchant the three tombs. Survive.</span>`, 7000, '#c21d1d');
    this.session.start();
  }

  gameTime() { return (this.snap?.time || 0) + (performance.now() - this.lastSnapAt) / 1000; }

  onSnap(s) {
    this.snap = s; this.lastSnapAt = performance.now();
    this.view.push(s);
    const me = s.players.find((p) => p.id === this.myId);
    for (const e of s.events || []) {
      eventFeed(this, e, me, s);
      if (e.t === 'enchantStart') this.seenTombs.add(e.tomb);                 // a rite marks its tomb for everyone
      if (e.t === 'chest' && e.tier !== 'supply') this.pings.push({ x: e.x, z: e.z, until: performance.now() + 8000 });
      if (e.t === 'chest' && e.tier === 'cursed' && e.id === this.myId) this.gotCursed = true;
      if (e.t === 'chat') this.hud?.chatLine(e.name, e.text, false, e.bot);
      // team quick messages: survivors only (the monster never sees them)
      if (e.t === 'quick' && me?.role === 'survivor') this.view.quickReveal.set(e.id, performance.now() + 6000); // their yellow aura, through walls
      if (e.t === 'quick' && me?.role === 'survivor' && this.hud) { showQuick(document.querySelector('.hud'), e.id === this.myId ? 'You' : e.name.replace(/\s*\[BOT\]$/, ''), e.msg); sfx.click?.(); }
    }
    if (me) this.lastMe = me;
    if (s.ended && !this.ended) {
      this.ended = true;
      heartbeat(-1); this.sound?.dispose();
      // the monster took every soul (or all of them hang): everyone hears it
      if (s.result?.winner === 'monster') playClip('allDead', { vol: 0.9 });
      setTimeout(() => this.finish(s.result), 3500);
    }
  }

  // The terror radius as an indicator you can feel: the screen edges throb red with every heartbeat
  // (lub-dub), faster and stronger as the monster closes in.
  heartPulse(dt, k) {
    const el = document.getElementById('h-heart'); if (!el) return;
    if (k <= 0.02) { el.style.opacity = 0; this.hbPh = 0; return; }
    const bpm = 62 * (0.8 + k * 0.85);
    this.hbPh = ((this.hbPh || 0) + dt * bpm / 60) % 1;
    const ph = this.hbPh, beat = Math.exp(-ph * 14) + 0.6 * Math.exp(-Math.max(0, ph - 0.28) * 16) * (ph > 0.28 ? 1 : 0);
    el.style.opacity = Math.min(1, (0.15 + k * 0.85) * beat);
  }

  // Pan a world-space sound relative to camera yaw, with distance attenuation.
  pan(x, z) {
    const me = this.view.me(); if (!me) return { pan: 0, vol: 1 };
    const a = Math.atan2(x - me.x, z - me.z) - this.input.yaw;
    const d = dist(me.x, me.z, x, z);
    return { pan: -Math.sin(a), vol: Math.max(0.15, 1 - d / 80) };
  }

  frame(dt) {
    if (!this.snap) return;
    const me = this.view.me();
    this.sendT += dt;
    if (this.sendT >= 0.05 && !this.ended) {
      this.sendT = 0;
      const pkt = this.input.sample();
      if (me?.role === 'survivor') delete pkt.face; // third person: survivors face where they move
      this.session.sendInput(pkt);
    }
    this.view.update(dt, this.input);
    this.touch?.update(me, dt);
    this.eggs?.update(dt, this.snap, me, this.gameTime(), this.input.yaw);
    if (!this.ended) this.sound?.update(dt, this.snap, me, this.input.yaw);
    if (me) {
      // Terror radius heartbeat: 32m (like DbD); the silent Stalker only from very close, and a
      // disguised Mimic gives no warning at all.
      const mon = this.view.monster();
      if (me.role === 'survivor' && me.state !== 'mouse' && me.state !== 'escaped' && !(mon.monster === 'mimic' && mon.disguise)) {
        const d = dist(me.x, me.z, mon.x, mon.z);
        // Sixth Sense: the heartbeat reaches much further
        const six = me.perks?.sixth ? [50, 60, 70][me.perks.sixth - 1] : 32;
        const hk = Math.max(0, 1 - d / (mon.monster === 'stalker' ? six * 0.32 : six));
        heartbeat(hk);
        this.heartPulse(dt, hk);
        this.stage.grade.uniforms.uFear.value = Math.max(0, 1 - d / 20);
      } else { this.stage.grade.uniforms.uFear.value = 0; heartbeat(0); this.heartPulse(dt, 0); }
      const pg = this.stage.grade.uniforms.uPoison;
      pg.value += ((me.poison > 0 ? Math.min(1, me.poison / 1.5) : 0) - pg.value) * Math.min(1, dt * 3);
      this.stage.grade.uniforms.uHurt.value = me.state === 'downed' || me.state === 'hooked' ? 1 : me.health === 1 && me.role === 'survivor' ? 0.5 : 0;
      this.skill.update(document.getElementById('h-skill'), me.skill, this.gameTime(), dt);
    }
    this.hudT += dt;
    if (this.hudT > 0.1) { this.hudT = 0; this.hud.update(this.snap, me, this.view, this.input.yaw); }
    this.mapT = (this.mapT || 0) + dt;
    if (this.mapT > 0.066) {
      this.mapT = 0;
      // survivors discover tombs by seeing them (≤22m, line of sight)
      if (me?.role === 'survivor' && me.state === 'alive') for (const t of this.snap.tombs) {
        if (!this.seenTombs.has(t.id) && dist(me.x, me.z, t.x, t.z) < 22 && lineOfSight(this.map, me.x, me.z, t.x, t.z)) this.seenTombs.add(t.id);
      }
      this.pings = this.pings.filter((p) => p.until > performance.now());
      this.minimap?.draw(this.snap, me, this.input.yaw, { seenTombs: this.seenTombs, pings: this.pings });
    }
    this.hud.fps(dt);
  }

  // Result shown when the local player leaves mid-match.
  abandonResult() {
    const s = this.snap, mon = s.players.find((p) => p.role === 'monster');
    const surv = s.players.filter((p) => p.role === 'survivor');
    return { escaped: surv.filter((p) => p.state === 'escaped').length, dead: surv.filter((p) => p.state === 'mouse').length,
      winner: 'monster', players: surv.map((p) => ({ id: p.id, name: p.name, state: p.state })), monster: { name: mon.name, id: mon.monster } };
  }

  finish(result) {
    this.dispose();
    this.onEnd?.(result, this.myId, this.lastMe && { ...this.lastMe, cursedChest: !!this.gotCursed });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.pause?.el?.remove(); this.touch?.dispose();
    this.eggs?.dispose(); this.sound?.dispose(); heartbeat(-1);
    this.input.onPause = null; this.input.onToggleMap = null; this.input.onChat = null;
    this.input.onQuick = null; this.input.onWheelMove = null; this.input.quickOpen = false; this.wheel?.dispose();
    this.session.stop();
    this.input.enabled = false; document.exitPointerLock?.();
    stopAmbience();
    this.stage.grade.uniforms.uFear.value = 0; this.stage.grade.uniforms.uHurt.value = 0; this.stage.grade.uniforms.uWarp.value = 0; this.stage.grade.uniforms.uPoison.value = 0;
    this.view.dispose();
  }
}
