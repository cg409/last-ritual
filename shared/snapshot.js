// Compact, serialisable view of the match (sent over the network / read by the renderer).
const r1 = (v) => Math.round(v * 100) / 100;

export function makeSnapshot(g) {
  const s = g.state, t = g.time;
  const snap = {
    time: r1(t), phase: g.phase, blackout: g.isBlackout(), ended: g.ended, result: g.result,
    lastScreech: g.lastScreech,
    players: s.players.map((p) => ({
      id: p.id, name: p.name, isBot: p.isBot, role: p.role, skin: p.skin, monster: p.monster,
      x: r1(p.x), z: r1(p.z), rot: r1(p.rot), speed: r1(p.speed), running: p.running, crouch: p.crouch, crawl: p.crawl,
      state: p.state, health: p.health, lives: p.lives, keys: p.keys, act: p.act, actT: r1(p.actT),
      candles: p.candles.map(Math.round), holding: p.holding, carrying: p.carrying, carrier: p.carrier, hookId: p.hookId,
      hookT: r1(p.hookT), downT: r1(p.downT), disguise: p.disguise, aiming: p.aiming,
      saw: p.sawUntil > t, rev: p.revUntil > t, trail: p.trailUntil > t, reveal: p.revealUntil > t,
      stuck: p.stuckUntil > t, hidden: !!p.hidden, slow: p.slowUntil > t, traps: p.traps, trap: p.trap, wiggle: r1(p.wiggle),
      specialCd: r1(Math.max(0, p.specialCdUntil - t)), tridentCd: r1(Math.max(0, p.tridentCdUntil - t)),
      stringCd: r1(Math.max(0, p.stringCdUntil - t)), stunned: p.stunUntil > t, skill: p.skill,
    })),
    tombs: s.tombs.map((x) => ({ ...x, progress: r1(x.progress) })),
    hooks: s.hooks, keys: s.keys,
    candles: s.candles.map((c) => ({ id: c.id, x: r1(c.x), z: r1(c.z), lit: c.lit, burn: Math.round(c.burn), owner: c.owner })),
    traps: s.traps.map((x) => ({ id: x.id, x: r1(x.x), z: r1(x.z), type: x.type, sprung: x.sprung })),
    projectiles: s.projectiles.map((p) => ({ id: p.id, x: r1(p.x), z: r1(p.z), dir: r1(p.dir), back: p.back })),
    door: s.door, towers: s.towers.map((x) => ({ id: x.id, screamAt: r1(x.screamAt) })),
    events: g.events,
  };
  g.events = [];
  return snap;
}
