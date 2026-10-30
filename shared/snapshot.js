// Compact, serialisable view of the match (sent over the network / read by the renderer).
import { TRIP } from './trips.js';
const r1 = (v) => Math.round(v * 100) / 100;

export function makeSnapshot(g) {
  const s = g.state, t = g.time;
  const snap = {
    time: r1(t), phase: g.phase, blackout: g.isBlackout(), ended: g.ended, result: g.result,
    lastScreech: g.lastScreech,
    players: s.players.map((p) => ({
      id: p.id, name: p.name, isBot: p.isBot, role: p.role, skin: p.skin, monster: p.monster,
      x: r1(p.x), z: r1(p.z), y: r1(p.y || 0), level: p.level | 0, jumping: p.jumpT0 != null, jumpK: p.jumpT0 != null ? r1((t - p.jumpT0) / p.jumpDur) : 0, rot: r1(p.rot), speed: r1(p.speed), running: p.running, crouch: p.crouch, crawl: p.crawl,
      state: p.state, health: p.health, lives: p.lives, keys: p.keys, heals: p.heals | 0, selfHealT: r1(p.selfHealT || 0), act: p.act, actT: r1(p.actT),
      candles: p.candles.map(Math.round), holding: p.holding, carrying: p.carrying, carrier: p.carrier, hookId: p.hookId,
      hookT: r1(p.hookT), downT: r1(p.downT), disguise: p.disguise, aiming: p.aiming,
      saw: p.sawUntil > t, rev: p.revUntil > t, trail: p.trailUntil > t, reveal: p.revealUntil > t,
      aura: p.auraUntil > t || p.revealUntil > t, lunge: p.lungeUntil > t, climb: p.climbUntil > t,
      stuck: p.stuckUntil > t, fallen: p.fallUntil > t, fallK: p.fallUntil > t ? r1(1 - (p.fallUntil - t) / TRIP.fall) : 0, hidden: !!p.hidden, stamina: r1(p.stamina ?? 1), exhausted: !!p.exhausted, slow: p.slowUntil > t, traps: p.traps, trap: p.trap, wiggle: r1(p.wiggle),
      specialCd: r1(Math.max(0, p.specialCdUntil - t)), tridentCd: r1(Math.max(0, p.tridentCdUntil - t)),
      stringCd: r1(Math.max(0, p.stringCdUntil - t)), stunned: p.stunUntil > t, skill: p.skill,
      trapped: p.trapped ? { type: p.trapped.type, passed: p.trapped.passed } : null, noRun: p.noRunUntil > t,
      poison: r1(Math.max(0, p.poisonUntil - t)), cursed: r1(Math.max(0, p.cursedUntil - t)), tombSight: p.tombSightUntil > t,
      eye: p.eyeUntil > t, allyReveal: p.allyRevealUntil > t, adrenaline: p.adrenalineUntil > t, perks: p.perks,
      inv: p.inv, bandageCap: p.bandageCap, healBandage: !!p.healBandage, light: Math.round(p.light), lightOn: p.lightOn, unlimited: p.unlimited,
      coins: p.coins, shards: p.shards, stats: p.stats, quickCd: r1(Math.max(0, (p.quickCdUntil || 0) - t)), hideIn: p.hideIn ?? null,
    })),
    chests: (s.chests || []).map((c) => ({ id: c.id, opened: c.opened })),
    tombs: s.tombs.map((x) => ({ ...x, progress: r1(x.progress) })),
    hooks: s.hooks, keys: s.keys,
    candles: s.candles.map((c) => ({ id: c.id, x: r1(c.x), z: r1(c.z), lit: c.lit, burn: Math.round(c.burn), owner: c.owner })),
    traps: s.traps.map((x) => ({ id: x.id, x: r1(x.x), z: r1(x.z), level: x.level | 0, type: x.type, sprung: x.sprung })),
    projectiles: s.projectiles.map((p) => ({ id: p.id, x: r1(p.x), z: r1(p.z), dir: r1(p.dir), back: p.back })),
    pallets: s.pallets.map((p) => ({ id: p.id, state: p.state })),
    door: s.door, towers: s.towers.map((x) => ({ id: x.id, screamAt: r1(x.screamAt) })),
    events: g.events,
  };
  g.events = [];
  return snap;
}
