import { SURVIVOR, MONSTER_BASE, PERKS, MAX_PERKS, FLASHLIGHT, TRAPS } from './constants.js';

// Weighted random monster choice: real players are 3x more likely than bots.
export function chooseMonster(roster, rng) {
  const w = roster.map((r) => (r.isBot ? 1 : 3));
  let pick = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < roster.length; i++) { pick -= w[i]; if (pick <= 0) return roster[i].id; }
  return roster[roster.length - 1].id;
}

// Perks arrive as [{ id, lvl }] (max 2, known ids only) → { id: lvl }.
function perkMap(list) {
  const out = {};
  for (const p of Array.isArray(list) ? list.slice(0, MAX_PERKS) : []) if (PERKS[p?.id]) out[p.id] = Math.max(1, Math.min(3, p.lvl | 0 || 1));
  return out;
}

export function makePlayer(r, isMonster, sp, skin, monster) {
  const perks = isMonster ? {} : perkMap(r.perks);
  return {
    perks, inv: { bandage: perks.medic ? 1 : 0, battery: 0, string: 0, eye: 0 }, bandageCap: perks.medic ? perks.medic + 1 : 1,
    light: FLASHLIGHT.full, lightOn: false, unlimited: false, coins: 0, shards: 0, chestT: 0,
    trapped: null, noRunUntil: 0, poisonUntil: 0, cursedUntil: 0, tombSightUntil: 0, eyeUntil: 0, allyRevealUntil: 0, adrenalineCdUntil: 0,
    trapLvl: Math.max(1, Math.min(3, r.trapLvl | 0 || 1)), stats: { enchants: 0, rescues: 0, heals: 0, chests: 0, hooks: 0, kills: 0, hits: 0 },
    id: r.id, name: r.name, isBot: !!r.isBot, role: isMonster ? 'monster' : 'survivor',
    skin, monster, x: sp.x, z: sp.z, rot: 0, speed: 0, level: 0,
    moving: false, running: false, crouch: false, crawl: false,
    state: 'alive', health: 2, lives: 2, keys: 0, heals: isMonster ? 0 : SURVIVOR.selfHeals, selfHealT: 0,
    act: null, actT: 0,
    candles: [], holding: false, hideIn: null, // (candles were replaced by the electric flashlight)
    slowUntil: 0, stuckUntil: 0, revealUntil: 0, boostUntil: 0, fallUntil: 0, fallT0: 0, tripImmuneUntil: 0,
    hookT: 0, downT: 0, carrier: null, hookId: null, wiggle: 0,
    carrying: null, specialCdUntil: 0, attackCdUntil: 0, stunUntil: 0,
    traps: isMonster ? MONSTER_BASE.traps : 0, trap: TRAPS[r.trap] ? r.trap : 'bear',
    disguise: null, aiming: false, aimStartT: 0, sawUntil: 0, revUntil: 0,
    trailUntil: 0, tridentCdUntil: 0, stringCdUntil: 0, auraUntil: 0, lungeUntil: 0, lungeHit: false, climbUntil: 0,
    input: { mx: 0, mz: 0, actions: [] }, skill: null,
  };
}
