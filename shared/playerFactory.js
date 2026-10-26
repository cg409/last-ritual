import { SURVIVOR, MONSTER_BASE } from './constants.js';

// Weighted random monster choice: real players are 3x more likely than bots.
export function chooseMonster(roster, rng) {
  const w = roster.map((r) => (r.isBot ? 1 : 3));
  let pick = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < roster.length; i++) { pick -= w[i]; if (pick <= 0) return roster[i].id; }
  return roster[roster.length - 1].id;
}

export function makePlayer(r, isMonster, sp, skin, monster) {
  return {
    id: r.id, name: r.name, isBot: !!r.isBot, role: isMonster ? 'monster' : 'survivor',
    skin, monster, x: sp.x, z: sp.z, rot: 0, speed: 0,
    moving: false, running: false, crouch: false, crawl: false,
    state: 'alive', health: 2, lives: 2, keys: 0,
    act: null, actT: 0,
    candles: isMonster ? [] : [SURVIVOR.candleBurn, SURVIVOR.candleBurn], holding: false,
    slowUntil: 0, stuckUntil: 0, revealUntil: 0, boostUntil: 0,
    hookT: 0, downT: 0, carrier: null, hookId: null, wiggle: 0,
    carrying: null, specialCdUntil: 0, attackCdUntil: 0, stunUntil: 0,
    traps: isMonster ? MONSTER_BASE.traps : 0, trap: r.trap || 'bear',
    disguise: null, aiming: false, aimStartT: 0, sawUntil: 0, revUntil: 0,
    trailUntil: 0, tridentCdUntil: 0, stringCdUntil: 0,
    input: { mx: 0, mz: 0, actions: [] }, skill: null,
  };
}
