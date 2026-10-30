// Shared game constants — imported by both the Node server and the browser client.
export const GAME_NAME = 'THE LAST RITUAL';
export const MAX_PLAYERS = 5;
export const TICK_RATE = 20;              // simulation ticks / second
export const MAP_SIZE = 130;              // metres, square (similar scale to a DbD realm)
export const TOMB_COUNT = 3;
export const KEY_COUNT = 3;

export const SURVIVOR = {
  walk: 2.45, run: 4.3, crouch: 1.13, crawl: 0.7,
  candles: 2, candleBurn: 120, candleRadius: 7,
  hangTime: 60, rescueTime: 1.5, enchantRate: 1 / 70, // ~70s solo per tomb
  selfHeals: 2, selfHealTime: 15,                      // self-mend: twice per match, 15s standing still
};

// Monster top speed equals a running survivor (4.0); survivors can't outrun it in the open,
// they must use loops, windows, grass and darkness. Survivors tire: running drains stamina.
// The monster now also RUNS (Shift, 4.6) — faster than a running survivor (4.3; only the Puppeteer and Stalker are slower) — so it catches them
// in the open like in DbD. Attacks are a short forward lunge that can connect at any moment of it.
export const MONSTER_BASE = { speed: 3.8, runSpeed: 4.6, attackRange: 2.6, attackCd: 2.2, carrySpeed: 3.4, traps: 2, lunge: 0.32 };

// Aura reveals (through walls + on the mini-map), like Dead by Daylight: hanging a survivor reveals
// the monster to everyone else; failing a skill check reveals that survivor to the monster.
export const REVEAL = { hookAura: 6, failAura: 5 };

// Survivor characters — each one can only be worn by one player in a match. Alex comes in 5 jacket
// colours (free; `recolor` = his black jacket is recoloured in render/outfits.js). The others are
// exclusives with their own authored look, unlocked with soul shards. `cloth` / `accent` are the
// colours used for the swatches and HUD markers.
export const SKINS = [
  { id: 'alex',         model: 'alex', name: 'Alex', variant: 'Shadow',  cloth: 0x2a2a2e, accent: 0xd8d2c4 },
  { id: 'alex-crimson', model: 'alex', name: 'Alex', variant: 'Crimson', cloth: 0x9c1d1d, accent: 0xd8d2c4, recolor: true },
  { id: 'alex-navy',    model: 'alex', name: 'Alex', variant: 'Navy',    cloth: 0x1f4fb0, accent: 0xd8d2c4, recolor: true },
  { id: 'alex-forest',  model: 'alex', name: 'Alex', variant: 'Forest',  cloth: 0x2f7d2a, accent: 0xd8d2c4, recolor: true },
  { id: 'alex-mustard', model: 'alex', name: 'Alex', variant: 'Mustard', cloth: 0xc58a12, accent: 0xd8d2c4, recolor: true },
  { id: 'agent',  model: 'agent',  name: 'Agent',  exclusive: true, cloth: 0x2b3a4a, accent: 0xc8c8c8 },
  { id: 'gamer',  model: 'gamer',  name: 'Gamer',  exclusive: true, cloth: 0x6a2a9a, accent: 0x2ab0b0 },
  { id: 'gwenra', model: 'gwenra', name: 'Gwenra', exclusive: true, cloth: 0x7a3a2a, accent: 0xe0c34a },
  { id: 'knight', model: 'knight', name: 'Knight', exclusive: true, cloth: 0x8a8f98, accent: 0x9c1d1d },
  { id: 'sheep',  model: 'sheep',  name: 'Sheep',  exclusive: true, cloth: 0xe8e4da, accent: 0x5a4030 },
  { id: 'wolf',   model: 'wolf',   name: 'Wolf',   exclusive: true, cloth: 0x5a5a62, accent: 0xc4561a },
  { id: 'yuna',   model: 'yuna',   name: 'Yuna',   exclusive: true, cloth: 0xc06a8a, accent: 0x1c1c1c },
];
export const SURVIVOR_MODELS = [...new Set(SKINS.map((s) => s.model))];
export const skinLabel = (s) => (s ? (s.variant ? `${s.name} · ${s.variant}` : s.name) : '');

// Traps (set by the monster with T, and scattered around the realm — also inside the mansion and
// houses — at different places every match). Any caught survivor shows to the monster as a yellow
// aura. Traps injure but never down. Levels (upgraded with ritual coins) lengthen the effects.
export const TRAPS = {
  bear:   { id: 'bear',   name: 'Foothold Trap', desc: 'Iron jaws clamp the leg: wounds the survivor and holds them until they pass 2 skill checks (SPACE). Afterwards they cannot run for a while.' },
  poison: { id: 'poison', name: 'Poison Bloom',  desc: 'Bursts into a spore cloud: the survivor\'s sight blurs and swims and their legs stagger off course.' },
  cursed: { id: 'cursed', name: 'Cursed Sigil',  desc: 'A hidden hex: thick grave-fog swallows everything around the survivor — they can barely see.' },
  spike:  { id: 'spike',  name: 'Floor Spikes',  desc: 'Rusted spikes burst from the ground: wounds the survivor and slows them down.' },
};
export const TRAP_IDS = Object.keys(TRAPS);
// Effect duration (s) per trap level 1..3
export const TRAP_FX = { bearNoRun: [6, 8, 10], poison: [7, 9, 11], cursed: [9, 11, 13], spikeSlow: [5, 6.5, 8] };

// Survivor perks: up to 2 equipped. Levels 1..3 (ritual coins) strengthen them.
export const PERKS = {
  adrenaline: { id: 'adrenaline', name: 'Adrenaline Rush', icon: '⚡', desc: 'When the monster closes in on you (12m), a surge of adrenaline lets you run much faster for a few seconds.', lv: ['+40% speed for 4s · 35s cooldown', '+40% speed for 5s · 30s cooldown', '+45% speed for 6s · 25s cooldown'] },
  ritualist:  { id: 'ritualist',  name: 'Ritualist',       icon: '✠', desc: 'Practised hands: you open chests and enchant tombs faster.', lv: ['+25% speed', '+35% speed', '+45% speed'] },
  instinct:   { id: 'instinct',   name: 'Survival Instinct', icon: '◈', desc: 'While the monster is chasing you, nearby pallets, logs, windows and hiding places are outlined, even through walls.', lv: ['Within 18m', 'Within 24m', 'Within 30m'] },
  medic:      { id: 'medic',      name: 'Field Medic',     icon: '✚', desc: 'You carry more healing bandages, start with one, and bind wounds faster — yours and others\'.', lv: ['Carry 2 · heal 25% faster', 'Carry 3 · heal 40% faster', 'Carry 4 · heal 60% faster'] },
  sixth:      { id: 'sixth',      name: 'Sixth Sense',     icon: '♥', desc: 'You feel the monster\'s heartbeat from much further away — and when it is very close, you sense its aura for a moment.', lv: ['Heartbeat from 50m', 'Heartbeat from 60m', 'Heartbeat from 70m'] },
};
export const PERK_IDS = Object.keys(PERKS);
export const MAX_PERKS = 2;

// Progression: what is free from the start, and what unlocking / upgrading costs.
export const STARTER = { monsters: ['mimic', 'wanderer', 'puppeteer'], traps: ['bear', 'spike', 'poison'], perks: ['adrenaline', 'ritualist', 'medic'],
  skins: ['alex', 'alex-crimson', 'alex-navy', 'alex-forest', 'alex-mustard'] };
export const UNLOCK_COST = { monster: 32, trap: 16, perk: 20, skin: 20 };          // soul shards
export const UPGRADE_COST = [0, 200, 500];                                  // ritual coins: to level 2, to level 3
export const MAX_LEVEL = 100;

// Chests: evenly spread, mostly out of sight, no glow. Opening a Ritual or Cursed chest shows the
// opener to the monster for a moment.
export const CHESTS = {
  supply: { id: 'supply', name: 'Supply Chest', time: 3.5 },
  ritual: { id: 'ritual', name: 'Ritual Chest', time: 5.5 },
  cursed: { id: 'cursed', name: 'Cursed Chest', time: 7.5 },
};
export const ITEMS = { bandage: 'Healing bandage', battery: 'Battery', string: 'Enchanted string', eye: 'The Eye' };
export const FLASHLIGHT = { full: 90, battery: 45 }; // seconds of light

export const BOT_NAMES = ['Hollis', 'Wren', 'Ottilie', 'Caspian', 'Mercy', 'Jory', 'Tamsin', 'Ezra', 'Isolde', 'Fenn'];
export { MONSTERS, MONSTER_IDS } from './monsters.js';
