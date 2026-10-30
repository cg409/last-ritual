// Authoritative match simulation. Runs on the Render server for multiplayer and
// inside the browser for singleplayer — identical rules for humans and bots.
import { generateMap, randomWalkable, collide } from './map.js';
import { makeRng, dist } from './rng.js';
import { MONSTERS, MONSTER_IDS, SKINS, TRAP_IDS } from './constants.js';
import { updateSurvivor } from './survivor.js';
import { updateMonster } from './monster.js';
import { updateWorld } from './world.js';
import { SurvivorBot } from './bots/survivorBot.js';
import { MonsterBot } from './bots/monsterBot.js';
import { makeSnapshot } from './snapshot.js';
import { onStairs } from './chests.js';
import { makeFog } from './fog.js';
import { initPallets } from './pallets.js';
import { chooseMonster, makePlayer } from './playerFactory.js';
export { chooseMonster };

export class Game {
  // roster: [{ id, name, isBot, skin, monsterPref, trap }]
  constructor({ seed = (Math.random() * 1e9) | 0, roster, forceMonster = null }) {
    this.seed = seed;
    this.rng = makeRng(seed ^ 0x5bd1e995);
    this.map = generateMap(seed);
    this.fog = makeFog(seed, this.map.size, this.map.buildings); // drifting fog banks (shared/fog.js)
    this.time = 0;
    this.ended = false;
    this.result = null;
    this.events = [];
    this.phase = 0;
    this.blackoutUntil = 0;
    this.lastScreech = null;
    this.nextId = 1;
    this.bots = new Map();
    this.state = {
      players: [],
      tombs: this.map.tombs.map((t) => ({ id: t.id, x: t.x, z: t.z, progress: 0, done: false, cracks: 0, protected: false })),
      hooks: this.map.hooks.map((h) => ({ id: h.id, x: h.x, z: h.z, victim: null })),
      keys: [], candles: [], traps: [], projectiles: [],
      door: { x: this.map.exit.x, z: this.map.exit.z, keys: 0, open: false },
      towers: this.map.towers.map((t) => ({ id: t.id, x: t.x, z: t.z, cd: 0, screamAt: -99 })),
    };
    initPallets(this);
    const monsterId = roster.some((r) => r.id === forceMonster) ? forceMonster : chooseMonster(roster, this.rng);
    const usedSkins = new Set();
    let spawnIdx = 0;
    for (const r of roster) {
      const isMonster = r.id === monsterId;
      let skin = r.skin;
      if (!skin || usedSkins.has(skin) || !SKINS.some((s) => s.id === skin)) skin = SKINS.find((s) => !usedSkins.has(s.id)).id;
      usedSkins.add(skin);
      const sp = isMonster ? this.map.monsterSpawn : this.map.spawns[spawnIdx++ % this.map.spawns.length];
      const monster = isMonster ? (MONSTERS[r.monsterPref] ? r.monsterPref : this.rng.pick(MONSTER_IDS)) : null;
      const p = makePlayer(r, isMonster, sp, skin, monster);
      this.state.players.push(p);
      if (p.isBot) this.bots.set(p.id, p.role === 'monster' ? new MonsterBot(this, p) : new SurvivorBot(this, p));
    }
    this.monster = this.state.players.find((p) => p.role === 'monster');
    this.state.hides = (this.map.hides || []).map((h) => ({ id: h.id, occupant: null }));
    this.state.chests = this.map.chests.map((c) => ({ id: c.id, x: c.x, z: c.z, tier: c.tier, opened: false }));
    // (no traps lie around the realm: only the monster sets them — 2 of its one chosen kind)
    // Grace period: the curse takes 10s to awaken; specials begin on cooldown.
    this.monster.stunUntil = 10;
    this.monster.specialCdUntil = 30;
    this.monster.tridentCdUntil = 25;
    this.emit({ t: 'start', monster: this.monster.name, monsterId: this.monster.monster });
  }

  // Hidden traps waiting around the realm — outdoors and inside the mansion and houses — at
  // different random places (and of random kinds) every match.
  scatterTraps() {
    const spots = [], far = (x, z) => this.map.spawns.every((s) => dist(s.x, s.z, x, z) > 14) &&
      spots.every((s) => dist(s.x, s.z, x, z) > 9) && this.map.chests.every((c) => dist(c.x, c.z, x, z) > 2.5);
    for (let i = 0; i < 60 && spots.length < 7; i++) { const p = this.randomPoint(); if (far(p.x, p.z)) spots.push({ ...p, level: 0 }); }
    const blds = this.map.buildings;
    for (let i = 0, n = 0; i < 120 && n < 6; i++) {
      const b = blds[(this.rng() * blds.length) | 0]; if (!b) break;
      const x = b.x + this.rng.range(-b.w / 2 + 1, b.w / 2 - 1), z = b.z + this.rng.range(-b.d / 2 + 1, b.d / 2 - 1);
      const c = collide(this.map, x, z, 0.6);
      if (Math.abs(c.x - x) > 1e-3 || Math.abs(c.z - z) > 1e-3 || !far(x, z) || onStairs(b, x, z)) continue;
      spots.push({ x, z, level: 0, indoor: true }); n++;
    }
    for (const s of spots) this.state.traps.push({ id: this.nextId++, x: s.x, z: s.z, level: s.level, type: this.rng.pick(TRAP_IDS), lvl: 1 + ((this.rng() * 2) | 0), owner: null });
  }

  get players() { return this.state.players; }
  player(id) { return this.state.players.find((p) => p.id === id); }
  survivors() { return this.state.players.filter((p) => p.role === 'survivor'); }
  // Events go to clients (cleared each snapshot) and to a rolling log the bots read.
  emit(e) {
    const ev = { ...e, at: this.time, seq: (this.seq = (this.seq || 0) + 1) };
    this.events.push(ev);
    (this.log ||= []).push(ev);
    if (this.log.length > 60) this.log.shift();
  }
  random() { return this.rng(); }
  randomPoint() { return randomWalkable(this.map, this.rng); }
  enchantedCount() { return this.state.tombs.filter((t) => t.done).length; }
  isBlackout() { return this.time < this.blackoutUntil; }

  // Human inputs arrive asynchronously; one-shot actions are queued until the next tick.
  setInput(id, input) {
    const p = this.player(id); if (!p || p.isBot) return;
    const queued = p.input.actions || [];
    p.input = { ...input, actions: queued.concat(input.actions || []) };
  }

  // Disconnected humans are taken over by a bot so the match keeps going.
  removePlayer(id) {
    const p = this.player(id); if (!p || p.isBot) return;
    p.isBot = true; p.name += ' (bot)';
    p.input = { mx: 0, mz: 0, actions: [] };
    this.bots.set(p.id, p.role === 'monster' ? new MonsterBot(this, p) : new SurvivorBot(this, p));
  }

  tick(dt) {
    if (this.ended) return;
    this.time += dt;
    for (const [id, bot] of this.bots) {
      const p = this.player(id);
      if (!p) continue;
      const out = bot.think(dt);
      p.input = { ...out, actions: (p.input.actions || []).concat(bot.actions.splice(0)) };
    }
    for (const p of this.state.players) {
      if (p.role === 'monster') updateMonster(this, p, dt); else updateSurvivor(this, p, dt);
      p.input.actions = [];
    }
    updateWorld(this, dt);
    this.checkEnd();
  }

  checkEnd() {
    const surv = this.survivors();
    const inPlay = surv.filter((p) => ['alive', 'downed', 'carried', 'hooked'].includes(p.state));
    // Everyone still in the realm hanging on the gallows: nobody is left to save them — it's over.
    const allHung = inPlay.length > 0 && inPlay.every((p) => p.state === 'hooked');
    if (inPlay.length && !allHung && this.time < 60 * 25) return;
    const escaped = surv.filter((p) => p.state === 'escaped').length;
    this.ended = true;
    this.result = {
      escaped, dead: surv.length - escaped, allHung,
      // the monster only wins by taking every soul; a single escape is a win for the survivors
      winner: escaped > 0 ? 'survivors' : 'monster',
      players: surv.map((p) => ({ id: p.id, name: p.name, state: p.state })),
      monster: { name: this.monster.name, id: this.monster.monster },
    };
    this.emit({ t: 'end', result: this.result });
  }

  snapshot() { return makeSnapshot(this); }
}
