// Runs one match on the client: receives snapshots, renders, sends input, plays audio, drives the HUD.
import { generateMap } from '@shared/map.js';
import { dist } from '@shared/rng.js';
import { MONSTERS } from '@shared/constants.js';
import { GameView } from './render/view.js';
import { Hud } from './ui/hud.js';
import { SkillCheck } from './ui/skillcheck.js';
import { sfx, heartbeat, startAmbience, stopAmbience } from './audio.js';
import { eventFeed } from './events.js';
import { MiniMap } from './ui/minimap.js';
import { PauseMenu } from './ui/pause.js';

export class Match {
  constructor({ stage, input, session, myId, onEnd }) {
    this.stage = stage; this.input = input; this.session = session; this.myId = myId; this.onEnd = onEnd;
    this.map = generateMap(session.seed);
    this.view = new GameView(stage, this.map, myId);
    this.hud = null; this.skill = new SkillCheck();
    this.snap = null; this.lastSnapAt = 0; this.hudT = 0; this.sendT = 0; this.ended = false;
    session.onSnap = (s) => this.onSnap(s);
  }

  begin() {
    this.hud = new Hud();
    this.input.enabled = true; this.input.lock();
    this.input.onSkill = () => {
      const me = this.view.me();
      const a = me && this.skill.press(me.skill, this.gameTime());
      if (a) this.input.actions.push(a);
    };
    const me = this.view.me();
    if (me) this.input.yaw = me.rot;
    this.minimap = new MiniMap(this.map, document.querySelector('.hud'));
    this.input.onToggleMap = () => this.minimap.toggle();
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
    sfx.stinger();
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
    for (const e of s.events || []) eventFeed(this, e, me, s);
    if (s.ended && !this.ended) {
      this.ended = true;
      setTimeout(() => this.finish(s.result), 3500);
    }
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
    if (me) {
      // Terror radius heartbeat (the Stalker is silent — no heartbeat)
      const mon = this.view.monster();
      if (me.role === 'survivor' && me.state !== 'mouse' && mon.monster !== 'stalker' && !(mon.monster === 'mimic' && mon.disguise)) {
        const d = dist(me.x, me.z, mon.x, mon.z);
        heartbeat(Math.max(0, 1 - d / 28));
        this.stage.grade.uniforms.uFear.value = Math.max(0, 1 - d / 20);
      } else this.stage.grade.uniforms.uFear.value = 0;
      this.stage.grade.uniforms.uHurt.value = me.state === 'downed' || me.state === 'hooked' ? 1 : me.health === 1 && me.role === 'survivor' ? 0.5 : 0;
      this.skill.update(document.getElementById('h-skill'), me.skill, this.gameTime(), dt);
    }
    this.hudT += dt;
    if (this.hudT > 0.1) { this.hudT = 0; this.hud.update(this.snap, me, this.view, this.input.yaw); }
    this.mapT = (this.mapT || 0) + dt;
    if (this.mapT > 0.066) { this.mapT = 0; this.minimap?.draw(this.snap, me, this.input.yaw); }
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
    this.onEnd?.(result, this.myId);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.pause?.el?.remove();
    this.input.onPause = null; this.input.onToggleMap = null;
    this.session.stop();
    this.input.enabled = false; document.exitPointerLock?.();
    stopAmbience();
    this.stage.grade.uniforms.uFear.value = 0; this.stage.grade.uniforms.uHurt.value = 0; this.stage.grade.uniforms.uWarp.value = 0;
    this.view.dispose();
  }
}
