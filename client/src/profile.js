// Player profile & account. Signed-in players keep their profile on the server (synced after every
// change); guests keep it in this browser. Holds level/XP (max 100), ritual coins & soul shards,
// unlocks and upgrade levels, the loadout, lifetime stats and achievements.
import { STARTER, MAX_LEVEL, UNLOCK_COST, UPGRADE_COST, MAX_PERKS, PERKS, SKINS } from '@shared/constants.js';
import { SERVER_URL } from './session.js';

const GUEST_KEY = 'tlr-profile-guest', AUTH_KEY = 'tlr-auth';

// XP needed to go from level L to L+1 (gently rising curve; level 100 is the cap).
export const xpToNext = (L) => Math.round(120 + (L - 1) * 45 + (L - 1) ** 1.6 * 2);

// Achievements. More will be added; each has a progress function (value / goal).
export const ACHIEVEMENTS = [
  { id: 'first_rite', name: 'The First Rite', desc: 'Finish your first match.', goal: 1, val: (p) => p.stats.matches },
  { id: 'escape', name: 'Through the Gate', desc: 'Escape the realm.', goal: 1, val: (p) => p.stats.escapes },
  { id: 'enchanter', name: 'Tomb Keeper', desc: 'Enchant 10 tombs.', goal: 10, val: (p) => p.stats.enchants },
  { id: 'hoarder', name: 'Grave Robber', desc: 'Open 15 chests.', goal: 15, val: (p) => p.stats.chests },
  { id: 'cursed', name: 'Touched by the Curse', desc: 'Open a Cursed chest.', goal: 1, val: (p) => p.stats.cursedChests },
  { id: 'savior', name: 'Cut Them Down', desc: 'Rescue 5 survivors from the gallows.', goal: 5, val: (p) => p.stats.rescues },
  { id: 'hunter', name: 'The Hunt', desc: 'Hang 10 survivors as the monster.', goal: 10, val: (p) => p.stats.hooks },
  { id: 'reaper', name: 'Reaper', desc: 'Kill 10 survivors as the monster.', goal: 10, val: (p) => p.stats.kills },
  { id: 'lv10', name: 'Initiate', desc: 'Reach level 10.', goal: 10, val: (p) => p.level },
  { id: 'lv50', name: 'Acolyte', desc: 'Reach level 50.', goal: 50, val: (p) => p.level },
  { id: 'lv100', name: 'The Last Ritualist', desc: 'Reach level 100.', goal: 100, val: (p) => p.level },
  // Hidden achievements (easter eggs): the name shows, what they are for stays secret until earned.
  ...[
    ['egg_angel', 'The Weeping Angel', 'Looked at the white angel statue up close for 5 seconds as blood began to flow from its eyes.'],
    ['egg_watcher', 'The Watcher', 'Witnessed the pale grey silhouette that appears briefly in a mansion window.'],
    ['egg_mirror', 'That Wasn\'t Me', 'Stared into the mansion mirror until a demon appeared in the reflection.'],
    ['egg_clock', 'It Supposed to...', 'Stared at the mansion clock until its hands began spinning backward.'],
    ['egg_phone', 'Yeah, It\'s a Misscall', 'Was near the mansion telephone when it rang.'],
    ['egg_morgan', 'Dead Legend', 'Paid respects at the tombstone of Arthur Morgan in the cemetery.'],
    ['egg_heart', 'The Heart of the Ritual', 'Found the red orb hidden in the boundary wall.'],
    ['egg_book', 'Extra One', 'Read the book in the wrecked house — and the name of a sixth player.'],
    ['egg_letter', 'Souls of the lantern', 'Opened the sealed letter lying on the bed upstairs in the mansion.'],
    ['egg_oneofus', 'One of Us', 'Found the lone tombstone at the edge of the realm bearing the cursed one\'s name.'],
  ].map(([id, name, desc]) => ({ id, name, desc, goal: 1, hidden: true, val: (p) => (p.achievements[id] ? 1 : 0) })),
];

// Grant a hidden achievement once per account. Returns the achievement when it is new.
export function grantAchievement(id) {
  const p = account.profile, a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!p || !a || p.achievements[id]) return null;
  p.achievements[id] = Date.now(); saveProfile();
  return a;
}

// ---------- friends (accounts only, max 20) ----------
export const friendsApi = {
  list: () => withTimeout(api('friends')),
  request: (username) => withTimeout(api('friends/request', 'POST', { username })),
  accept: (username) => withTimeout(api('friends/accept', 'POST', { username })),
  remove: (username) => withTimeout(api('friends/remove', 'POST', { username })),
};
// Presence: tell the server where we are (menu / lobby + code / match) so friends can see it.
export const presence = { where: 'menu', code: null, requests: 0, onRequests: null };
export function setPresence(where, code = null) {
  presence.where = where; presence.code = code;
  pingPresence();
}
export function pingPresence() {
  if (account.mode !== 'account' || !account.token) return;
  api('ping', 'POST', { where: presence.where, code: presence.code }).then((r) => {
    if (r?.ok && r.requests !== presence.requests) { presence.requests = r.requests; presence.onRequests?.(r.requests); }
  }).catch(() => {});
}
setInterval(pingPresence, 40000);

export async function fetchLeaderboard() {
  try { return await withTimeout(api('leaderboard'), 8000); } catch { return null; }
}

// Share of all players (accounts) who earned each achievement: { total, counts: { id: n } }.
export async function fetchAchievementStats() {
  try { return await withTimeout(fetch(SERVER_URL + '/api/achievements/stats').then((r) => r.json()), 6000); } catch { return null; }
}

export function defaultProfile(name = 'Survivor') {
  return {
    v: 1, name, level: 1, xp: 0, coins: 150, shards: 10,
    unlocked: { monsters: [...STARTER.monsters], traps: [...STARTER.traps], perks: [...STARTER.perks], skins: [...STARTER.skins] },
    perkLv: {}, trapLv: {},
    loadout: { skin: SKINS[0].id, monster: STARTER.monsters[0], trap: STARTER.traps[0], perks: [STARTER.perks[0]] },
    achievements: {}, // id -> unlock timestamp
    stats: { matches: 0, escapes: 0, deaths: 0, enchants: 0, chests: 0, cursedChests: 0, rescues: 0, heals: 0, hooks: 0, kills: 0, monsterWins: 0 },
  };
}
function normalize(p, name) {
  const d = defaultProfile(name);
  const out = { ...d, ...(p || {}) };
  out.unlocked = { ...d.unlocked, ...(p?.unlocked || {}) };
  for (const k of ['monsters', 'traps', 'perks', 'skins']) out.unlocked[k] = [...new Set([...STARTER[k], ...(out.unlocked[k] || [])])];
  out.loadout = { ...d.loadout, ...(p?.loadout || {}) };
  // retired characters (or one no longer owned) fall back to Alex
  if (!SKINS.some((s) => s.id === out.loadout.skin) || !out.unlocked.skins.includes(out.loadout.skin)) out.loadout.skin = SKINS[0].id;
  out.stats = { ...d.stats, ...(p?.stats || {}) };
  out.perkLv = { ...(p?.perkLv || {}) }; out.trapLv = { ...(p?.trapLv || {}) }; out.achievements = { ...(p?.achievements || {}) };
  return out;
}

// ---------- account ----------
export const account = { mode: 'guest', username: null, token: null, profile: null, online: false };

async function api(path, method = 'GET', body) {
  const r = await fetch(SERVER_URL + '/api/' + path, {
    method, headers: { 'Content-Type': 'application/json', ...(account.token ? { Authorization: 'Bearer ' + account.token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}
const withTimeout = (p, ms = 8000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('The server did not answer. (A sleeping server can take ~50s to wake — try again, or play as a guest.)')), ms))]);

function signedIn(res) {
  account.mode = 'account'; account.username = res.username; account.token = res.token || account.token; account.online = true;
  account.profile = normalize(res.profile, res.username);
  account.profile.name = res.username;
  localStorage.setItem(AUTH_KEY, JSON.stringify({ username: account.username, token: account.token }));
  if (!res.profile) saveProfile();
}
export async function signIn(username, password) {
  const res = await withTimeout(api('login', 'POST', { username, password }));
  if (res.ok) signedIn(res);
  return res;
}
export async function signUp(username, password) {
  const res = await withTimeout(api('register', 'POST', { username, password }));
  if (res.ok) {
    // keep the guest's progress when a guest creates an account
    const guest = loadGuest();
    signedIn({ ...res, profile: guest.stats.matches ? { ...guest, name: res.username } : null });
    saveProfile();
  }
  return res;
}
export async function recoverAccount(username, recovery, newPassword) {
  const res = await withTimeout(api('recover', 'POST', { username, recovery, newPassword }));
  if (res.ok) signedIn(res);
  return res;
}
// Silent sign-in with the saved token. Returns true when signed in.
export async function resumeSession() {
  const saved = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
  if (!saved?.token) return false;
  account.token = saved.token;
  try {
    const res = await withTimeout(api('profile'), 6000);
    if (res.ok) { signedIn({ ...res, token: saved.token }); return true; }
  } catch { /* offline */ }
  account.token = null;
  return false;
}
export function signOut() {
  if (account.token) api('logout', 'POST').catch(() => {});
  localStorage.removeItem(AUTH_KEY);
  Object.assign(account, { mode: 'guest', username: null, token: null, online: false });
  account.profile = loadGuest();
}
function loadGuest() { return normalize(JSON.parse(localStorage.getItem(GUEST_KEY) || 'null'), localStorage.getItem('hv-name') || 'Survivor'); }
export function playAsGuest() { Object.assign(account, { mode: 'guest', username: null, token: null }); account.profile = loadGuest(); }

let syncT = null;
export function saveProfile() {
  const p = account.profile; if (!p) return;
  checkAchievements(p);
  if (account.mode === 'guest') { localStorage.setItem(GUEST_KEY, JSON.stringify(p)); return; }
  localStorage.setItem('tlr-profile-cache', JSON.stringify(p));
  clearTimeout(syncT);
  syncT = setTimeout(() => api('profile', 'PUT', { profile: p }).catch(() => {}), 400);
}

// ---------- progression ----------
export function checkAchievements(p) {
  const fresh = [];
  for (const a of ACHIEVEMENTS) if (!p.achievements[a.id] && a.val(p) >= a.goal) { p.achievements[a.id] = Date.now(); fresh.push(a); }
  return fresh;
}
export function addXp(p, n) {
  if (p.level >= MAX_LEVEL) { p.xp = 0; return; }
  p.xp += n;
  while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) { p.xp -= xpToNext(p.level); p.level++; }
  if (p.level >= MAX_LEVEL) p.xp = 0;
}

// Rewards for a finished match. me = my last snapshot (stats, coins, shards), wasMonster from it.
export function applyMatch(result, me) {
  const p = account.profile; if (!p || !me) return null;
  const st = me.stats || {}, monster = me.role === 'monster';
  const before = { level: p.level, xp: p.xp };
  let xp = 60;
  const lines = [['Ritual completed', 60]];
  const add = (label, n) => { if (n > 0) { xp += n; lines.push([label, n]); } };
  if (monster) {
    add(`Survivors struck ×${st.hits || 0}`, (st.hits || 0) * 15);
    add(`Survivors hanged ×${st.hooks || 0}`, (st.hooks || 0) * 60);
    add(`Souls taken ×${st.kills || 0}`, (st.kills || 0) * 100);
    if (result.winner === 'monster') add('The hunt is sated', 200);
  } else {
    add(`Tombs enchanted ×${st.enchants || 0}`, (st.enchants || 0) * 70);
    add(`Rescues ×${st.rescues || 0}`, (st.rescues || 0) * 50);
    add(`Wounds tended ×${st.heals || 0}`, (st.heals || 0) * 30);
    add(`Chests opened ×${st.chests || 0}`, (st.chests || 0) * 20);
    add(me.state === 'escaped' ? 'Escaped' : 'Survived for a while', me.state === 'escaped' ? 220 : 40);
  }
  // winning the match pays 20–30 extra ritual coins
  const won = monster ? result.winner === 'monster' : result.winner === 'survivors';
  const winCoins = won ? 20 + Math.floor(Math.random() * 11) : 0;
  // no coins just for taking part: only the team's win (plus whatever you found in chests)
  const coins = winCoins + (me.coins || 0), shards = me.shards || 0;
  addXp(p, xp);
  p.coins += coins; p.shards += shards;
  const s = p.stats;
  s.matches++; s.enchants += st.enchants || 0; s.chests += st.chests || 0; s.rescues += st.rescues || 0; s.heals += st.heals || 0;
  s.hooks += st.hooks || 0; s.kills += st.kills || 0;
  if (!monster) { if (me.state === 'escaped') s.escapes++; else s.deaths++; }
  if (monster && result.winner === 'monster') s.monsterWins++;
  if (me.cursedChest) s.cursedChests++;
  const newAch = checkAchievements(p);
  saveProfile();
  return { xp, lines, coins, winCoins, shards, before, after: { level: p.level, xp: p.xp }, newAch };
}

// ---------- unlocks & upgrades ----------
export const isUnlocked = (kind, id) => account.profile.unlocked[kind].includes(id);
export function unlock(kind, id) {
  const p = account.profile, cost = UNLOCK_COST[kind.slice(0, -1)];
  if (isUnlocked(kind, id) || p.shards < cost) return false;
  p.shards -= cost; p.unlocked[kind].push(id); saveProfile();
  return true;
}
export const levelOf = (kind, id) => (kind === 'perks' ? account.profile.perkLv[id] : account.profile.trapLv[id]) || 1;
export function upgrade(kind, id) {
  const p = account.profile, lv = levelOf(kind, id), cost = UPGRADE_COST[lv];
  if (lv >= 3 || !isUnlocked(kind, id) || p.coins < cost) return false;
  p.coins -= cost; (kind === 'perks' ? p.perkLv : p.trapLv)[id] = lv + 1; saveProfile();
  return true;
}
export function togglePerk(id) {
  const l = account.profile.loadout;
  if (l.perks.includes(id)) l.perks = l.perks.filter((x) => x !== id);
  else if (isUnlocked('perks', id) && l.perks.length < MAX_PERKS) l.perks.push(id);
  saveProfile();
}
// What the lobby / match needs from the loadout.
export function loadoutPrefs() {
  const p = account.profile, l = p.loadout;
  return {
    skin: l.skin, monsterPref: isUnlocked('monsters', l.monster) ? l.monster : STARTER.monsters[0],
    trap: isUnlocked('traps', l.trap) ? l.trap : STARTER.traps[0], trapLvl: levelOf('traps', l.trap),
    perks: l.perks.filter((id) => PERKS[id] && isUnlocked('perks', id)).map((id) => ({ id, lvl: levelOf('perks', id) })), level: p.level,
  };
}
