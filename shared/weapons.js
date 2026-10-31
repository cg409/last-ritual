// Monster weapons - the "schedule". A weapon is chosen separately from the monster: ANY weapon fits ANY monster, and each one
// changes how the monster plays. All numbers are multipliers on the monster's own stats (see monster.js):
//   dmg    health taken per hit (survivors have 2: a 2-damage weapon downs a healthy survivor in ONE hit)
//   speed  walking / running speed          range  attack reach           cd     time between swings (lower = faster)
//   lunge  speed of the forward surge       hear   how far survivors hear the monster coming (footsteps, dragging, engine)
//   brk    time to smash a pallet           srch   time to search a cupboard / porta-potty
//   graze  chance a hit only grazes (no health lost)          slow  seconds a survivor is slowed after being hit
//   rev    chainsaw: must be revved (R) to deal full damage; the roar is heard across the whole realm
// cost: soul shards to unlock (0 = owned from the start). Upgrades (ritual coins, Lv 1-3) sharpen a weapon: -5% swing time and +3%
// reach per level, and soften its speed / noise penalties.
export const WEAPONS = {
  axe: {
    id: 'axe', name: 'Fire Axe', cost: 0, tag: 'Balanced',
    desc: 'A dependable felling axe. No tricks, no weakness - two hits down a healthy survivor.',
    dmg: 1, speed: 1, range: 1, cd: 1, lunge: 1, hear: 1,
    plus: ['Reliable all-rounder'], minus: ['Nothing special'],
  },
  machete: {
    id: 'machete', name: 'Machete', cost: 0, tag: 'Fast',
    desc: 'Light and quick. You swing again almost at once and move faster, but the cuts are shallow and short.',
    dmg: 1, speed: 1.1, range: 0.9, cd: 0.6, lunge: 1.15, hear: 0.8, graze: 0.25,
    plus: ['+10% speed', 'Very fast swings', 'Quieter'], minus: ['Short reach', '1 in 4 hits only grazes'],
  },
  cleaver: {
    id: 'cleaver', name: "Butcher's Cleaver", cost: 15, tag: 'Swift',
    desc: 'A broad, bloodied blade. A touch quicker than the axe, and the wounds slow the victim.',
    dmg: 1, speed: 1.04, range: 0.95, cd: 0.8, lunge: 1.05, hear: 0.9, slow: 1.5,
    plus: ['Faster swings', 'Wounds slow survivors'], minus: ['Slightly short reach'],
  },
  crowbar: {
    id: 'crowbar', name: 'Bloody Crowbar', cost: 12, tag: 'Breaker',
    desc: 'A hooked bar for prying. Smashes pallets and rips open hiding places far faster.',
    dmg: 1, speed: 1, range: 1.1, cd: 0.95, lunge: 1, hear: 0.95, brk: 0.5, srch: 0.55,
    plus: ['Breaks pallets in half the time', 'Searches hiding places fast', 'Slightly longer reach'], minus: ['Plain damage'],
  },
  bat: {
    id: 'bat', name: 'Nailed Rope Bat', cost: 20, tag: 'Long reach',
    desc: 'A club bound in rope and bristling with nails. It reaches far and the nails tear at the legs, but it is slow.',
    dmg: 1, speed: 0.93, range: 1.4, cd: 1.2, lunge: 1, hear: 1.1, slow: 3,
    plus: ['+40% reach', 'Hit survivors are slowed for 3s'], minus: ['-7% speed', 'Slow to swing again'],
  },
  sledge: {
    id: 'sledge', name: 'Sledgehammer', cost: 30, tag: 'Heavy',
    desc: 'One blow caves a survivor in. You pay with speed, a long recovery and a heavy drag that can be heard coming.',
    dmg: 2, speed: 0.84, range: 1, cd: 1.5, lunge: 0.95, hear: 1.3, brk: 0.6,
    plus: ['ONE-HIT down (2 damage)', 'Smashes pallets faster'], minus: ['-16% speed', 'Very slow swings', 'Heard from further away'],
  },
  maul: {
    id: 'maul', name: 'Timber Maul', cost: 35, tag: 'Crusher',
    desc: 'A great strapped log. It reaches a little further and one hit downs anyone, but it makes you the slowest thing in the realm.',
    dmg: 2, speed: 0.76, range: 1.15, cd: 1.8, lunge: 0.9, hear: 1.45, brk: 0.3,
    plus: ['ONE-HIT down (2 damage)', '+15% reach', 'Obliterates pallets'], minus: ['-24% speed', 'Slowest swings', 'Loud'],
  },
  chainsaw: {
    id: 'chainsaw', name: 'Rusted Chainsaw', cost: 40, tag: 'Roaring',
    desc: 'Rev it (R) and every hit downs a healthy survivor in one cut. But the roar carries across the whole realm, and unrevved it only bruises.',
    dmg: 2, speed: 0.97, range: 1, cd: 1, lunge: 1, hear: 1.5, rev: true,
    plus: ['ONE-HIT down while revved (R)'], minus: ['Revving is heard EVERYWHERE', 'Idle engine is loud', 'Unrevved hits only bruise', 'Revving slows you'],
  },
};
export const WEAPON_IDS = Object.keys(WEAPONS);
export const DEFAULT_WEAPON = 'axe';
export const MAX_WEAPON_LEVEL = 3;

// Effective numbers for a monster carrying `id` at upgrade level `lvl` (1-3).
export function weaponStats(id, lvl = 1) {
  const w = WEAPONS[id] || WEAPONS[DEFAULT_WEAPON], k = Math.max(0, Math.min(2, (lvl | 0) - 1));
  return {
    ...w,
    speed: w.speed < 1 ? w.speed + (1 - w.speed) * 0.12 * k : w.speed, // upgrades soften a speed penalty (never touch a bonus)
    cd: w.cd * (1 - 0.05 * k), range: w.range * (1 + 0.03 * k), hear: w.hear * (1 - 0.05 * k),
    lunge: w.lunge, brk: w.brk || 1, srch: w.srch || 1, graze: w.graze || 0, slow: w.slow || 0,
  };
}
