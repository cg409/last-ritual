// Shared game constants — imported by both the Node server and the browser client.
export const GAME_NAME = 'HOLLOW VIGIL';
export const MAX_PLAYERS = 5;
export const TICK_RATE = 20;              // simulation ticks / second
export const MAP_SIZE = 130;              // metres, square (similar scale to a DbD realm)
export const TOMB_COUNT = 3;
export const KEY_COUNT = 3;

export const SURVIVOR = {
  walk: 2.3, run: 4.0, crouch: 1.13, crawl: 0.7,
  candles: 2, candleBurn: 120, candleRadius: 7,
  hangTime: 60, rescueTime: 1.5, enchantRate: 1 / 70, // ~70s solo per tomb
};

export const MONSTER_BASE = { speed: 4.4, attackRange: 2.6, attackCd: 2.2, carrySpeed: 3.6, traps: 3 };

// Survivor skins — each one can only be used by one player in a match.
export const SKINS = [
  { id: 'warden',   name: 'The Warden',  cloth: 0x4a3b2a, accent: 0x8a6d3b, skin: 0xc79a7a, hat: 'hood' },
  { id: 'nurse',    name: 'Ada Vell',    cloth: 0x6e6a63, accent: 0x7a1f1f, skin: 0xe0b9a0, hat: 'cap' },
  { id: 'drifter',  name: 'Silas Rook',  cloth: 0x2b3a3f, accent: 0x5c7a7f, skin: 0xa77b5e, hat: 'none' },
  { id: 'priest',   name: 'Father Orin', cloth: 0x1b1b1f, accent: 0xbfb08a, skin: 0xd4a98c, hat: 'none' },
  { id: 'huntress', name: 'Mara Quill',  cloth: 0x3d4a26, accent: 0x6b4423, skin: 0xb98468, hat: 'hood' },
  { id: 'scholar',  name: 'Elias Thorn', cloth: 0x3a2433, accent: 0x9a8f6a, skin: 0xe6c3a8, hat: 'cap' },
  { id: 'miner',    name: 'Bram Kettle', cloth: 0x4f4334, accent: 0xd4a017, skin: 0x8d5e44, hat: 'helmet' },
];

export const TRAPS = {
  bear:  { id: 'bear',  name: 'Rusted Jaw', desc: 'Snaps shut on a survivor, holding them for 4s and revealing them.' },
  bell:  { id: 'bell',  name: 'Grave Bell', desc: 'Silent tripwire. When crossed, reveals the survivor to the monster for 6s.' },
  thorn: { id: 'thorn', name: 'Thorn Bed',  desc: 'Hidden brambles. Survivors crossing are slowed by 40% for 6s.' },
};

export const BOT_NAMES = ['Hollis', 'Wren', 'Ottilie', 'Caspian', 'Mercy', 'Jory', 'Tamsin', 'Ezra', 'Isolde', 'Fenn'];
export { MONSTERS, MONSTER_IDS } from './monsters.js';
