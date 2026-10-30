// Player accounts: register / log in / recover, and the player profile (level, XP, currencies,
// unlocks, achievements) stored per account. Passwords and recovery keys are salted scrypt hashes;
// sessions are random bearer tokens. Data lives in a JSON file (DATA_DIR, default ./data).
// Recovery works without e-mail: at sign-up the player gets a one-time recovery key; with it they
// can set a new password (and receive a fresh key).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DIR = process.env.DATA_DIR || path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'data');
const FILE = path.join(DIR, 'accounts.json');
let db = { users: {} };
// Storage: a JSON file (lost when a free Render server restarts) — or, if UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN are set, a free Upstash Redis database that keeps accounts forever.
const UP = process.env.UPSTASH_REDIS_REST_URL, UPT = process.env.UPSTASH_REDIS_REST_TOKEN;
if (UP && UPT) {
  try {
    const r = await (await fetch(UP + '/get/tlr-accounts', { headers: { Authorization: 'Bearer ' + UPT } })).json();
    if (r.result) db = JSON.parse(r.result);
    console.log('Accounts loaded from Upstash:', Object.keys(db.users).length);
  } catch (e) { console.error('Upstash load failed', e.message); }
} else {
  try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { /* first run */ }
}
let saveT = null;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { if (UP && UPT) { fetch(UP + '/set/tlr-accounts', { method: 'POST', headers: { Authorization: 'Bearer ' + UPT }, body: JSON.stringify(db) }).catch((e) => console.error('Upstash save failed', e.message)); return; }
  fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db)); }, 300); };

const MAX_FRIENDS = 20;
const hash = (secret, salt) => crypto.scryptSync(String(secret), salt, 32).toString('hex');
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const recoveryKey = () => Array.from({ length: 4 }, () => Array.from(crypto.randomBytes(4), (b) => ALPH[b % ALPH.length]).join('')).join('-');
const key = (u) => String(u || '').trim().toLowerCase();
const validName = (u) => /^[A-Za-z0-9_]{3,16}$/.test(String(u || '').trim());

function newToken(user) {
  const t = crypto.randomBytes(24).toString('hex');
  user.tokens = [t, ...(user.tokens || [])].slice(0, 5);
  return t;
}
function setRecovery(user) {
  const rk = recoveryKey(); user.rsalt = crypto.randomBytes(16).toString('hex'); user.rhash = hash(rk.replace(/-/g, ''), user.rsalt);
  return rk;
}
const out = (user, token, extra = {}) => ({ ok: true, token, username: user.name, profile: user.profile || null, rewards: user.pendingRewards || [], ...extra });

export function register({ username, password }) {
  if (!validName(username)) return { ok: false, error: 'Name: 3–16 letters, numbers or _.' };
  if (String(password || '').length < 6) return { ok: false, error: 'Password: at least 6 characters.' };
  if (db.users[key(username)]) return { ok: false, error: 'That name is already taken.' };
  const salt = crypto.randomBytes(16).toString('hex');
  const user = { name: String(username).trim(), salt, phash: hash(password, salt), created: Date.now(), profile: null };
  const recovery = setRecovery(user);
  db.users[key(username)] = user; save();
  return out(user, newToken(user), { recovery });
}

export function login({ username, password }) {
  const user = db.users[key(username)];
  if (!user || !same(hash(password || '', user.salt), user.phash)) return { ok: false, error: 'Wrong name or password.' };
  const t = newToken(user); save();
  return out(user, t);
}

export function recover({ username, recovery, newPassword }) {
  const user = db.users[key(username)];
  const rk = String(recovery || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!user || !user.rhash || !same(hash(rk, user.rsalt), user.rhash)) return { ok: false, error: 'That recovery key does not match.' };
  if (String(newPassword || '').length < 6) return { ok: false, error: 'New password: at least 6 characters.' };
  user.salt = crypto.randomBytes(16).toString('hex'); user.phash = hash(newPassword, user.salt);
  user.tokens = [];
  const fresh = setRecovery(user), t = newToken(user); save();
  return out(user, t, { recovery: fresh });
}

function byToken(req) {
  const t = String(req.headers.authorization || '').replace(/^Bearer /, '');
  if (!t) return null;
  return Object.values(db.users).find((u) => (u.tokens || []).includes(t)) || null;
}

// For the game server (invites, reports): who owns this token, and are two players friends?
export const byTokenString = (t) => (t ? Object.values(db.users).find((u) => (u.tokens || []).includes(t)) || null : null);
export const areFriends = (a, b) => !!db.users[key(a)]?.friends?.includes(key(b));

// Express routes (+ permissive CORS for the static client).
export function mountAccounts(app, origins) {
  app.use('/api', (req, res, next) => {
    const o = req.headers.origin;
    res.setHeader('Access-Control-Allow-Origin', origins.includes('*') ? (o || '*') : origins.includes(o) ? o : origins[0]);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  const json = (fn) => (req, res) => { try { res.json(fn(req)); } catch (e) { console.error(e); res.status(500).json({ ok: false, error: 'Server error.' }); } };
  app.post('/api/register', json((req) => register(req.body || {})));
  app.post('/api/login', json((req) => login(req.body || {})));
  app.post('/api/recover', json((req) => recover(req.body || {})));
  app.get('/api/profile', json((req) => { const u = byToken(req); return u ? out(u, null) : { ok: false, error: 'Please sign in again.' }; }));
  app.put('/api/profile', json((req) => {
    const u = byToken(req); if (!u) return { ok: false, error: 'Please sign in again.' };
    const p = req.body?.profile;
    if (!p || typeof p !== 'object' || JSON.stringify(p).length > 40000) return { ok: false, error: 'Bad profile.' };
    u.profile = p; save();
    return { ok: true };
  }));
  // ---------- friends (max 20) ----------
  // Requests must be accepted. Presence: the client pings every ~40s with where it is (menu /
  // lobby code / match); a friend counts as online for 90s after their last ping.
  const auth = (fn) => json((req) => { const u = byToken(req); return u ? fn(u, req.body || {}, req) : { ok: false, error: 'Please sign in again.' }; });
  const lists = (u) => { u.friends ||= []; u.reqIn ||= []; u.reqOut ||= []; return u; };
  const drop = (arr, k) => { const i = arr.indexOf(k); if (i >= 0) arr.splice(i, 1); };
  const view = (k) => {
    const f = db.users[k]; if (!f) return null;
    const online = Date.now() - (f.seen || 0) < 90000;
    return { name: f.name, online, where: online ? f.where || 'menu' : null, code: online && f.where === 'lobby' ? f.code || null : null, level: f.profile?.level || 1, lastSeen: f.seen || 0 };
  };
  app.post('/api/ping', auth((u, b) => {
    u.seen = Date.now(); u.where = ['menu', 'lobby', 'match'].includes(b.where) ? b.where : 'menu';
    u.code = typeof b.code === 'string' ? b.code.slice(0, 8) : null;
    lists(u);
    return { ok: true, requests: u.reqIn.length };
  }));
  // Closest matches for the "add a friend" box: exact > starts with > contains > a small typo away.
  const editDist = (a, b) => {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return dp[a.length][b.length];
  };
  app.get('/api/users/search', auth((u, _b, req) => {
    lists(u);
    const q = String(req.query.q || '').trim().toLowerCase().slice(0, 16), me = key(u.name);
    if (!q) return { ok: true, results: [] };
    const tol = Math.max(1, Math.floor(q.length / 3)), rows = [];
    for (const [k, f] of Object.entries(db.users)) {
      if (k === me) continue;
      const n = k, idx = n.indexOf(q);
      let score = n === q ? 0 : n.startsWith(q) ? 1 + (n.length - q.length) / 100 : idx > 0 ? 2 + idx / 100 : Infinity;
      if (score === Infinity) { const d = Math.min(editDist(n.slice(0, q.length + 1), q), editDist(n, q)); if (d <= tol) score = 3 + d; }
      if (score !== Infinity) rows.push({ score, name: f.name, level: f.profile?.level || 1, status: u.friends.includes(k) ? 'friend' : u.reqOut.includes(k) ? 'pending' : u.reqIn.includes(k) ? 'incoming' : 'none' });
    }
    rows.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
    return { ok: true, results: rows.slice(0, 8).map(({ score, ...r }) => r) };
  }));
  app.get('/api/friends', auth((u) => {
    lists(u);
    return { ok: true, max: MAX_FRIENDS, friends: u.friends.map(view).filter(Boolean).sort((a, b) => b.online - a.online || a.name.localeCompare(b.name)),
      incoming: u.reqIn.map((k) => db.users[k]?.name).filter(Boolean), outgoing: u.reqOut.map((k) => db.users[k]?.name).filter(Boolean) };
  }));
  app.post('/api/friends/request', auth((u, b) => {
    lists(u);
    const k = key(b.username), me = key(u.name), f = db.users[k];
    if (!f) return { ok: false, error: 'No player with that name.' };
    if (k === me) return { ok: false, error: 'That is you.' };
    lists(f);
    if (u.friends.includes(k)) return { ok: false, error: `${f.name} is already your friend.` };
    if (u.friends.length >= MAX_FRIENDS) return { ok: false, error: `You already have ${MAX_FRIENDS} friends.` };
    if (u.reqIn.includes(k)) return accept(u, f);                 // they asked first: become friends
    if (u.reqOut.includes(k)) return { ok: false, error: 'Request already sent.' };
    if (f.friends.length >= MAX_FRIENDS) return { ok: false, error: `${f.name}'s friend list is full.` };
    u.reqOut.push(k); f.reqIn.push(me); save();
    return { ok: true, sent: f.name };
  }));
  function accept(u, f) {
    const a = key(u.name), b = key(f.name);
    if (u.friends.length >= MAX_FRIENDS || f.friends.length >= MAX_FRIENDS) return { ok: false, error: 'A friend list is full (max 20).' };
    drop(u.reqIn, b); drop(u.reqOut, b); drop(f.reqIn, a); drop(f.reqOut, a);
    if (!u.friends.includes(b)) u.friends.push(b);
    if (!f.friends.includes(a)) f.friends.push(a);
    save();
    return { ok: true, friend: f.name };
  }
  app.post('/api/friends/accept', auth((u, b) => {
    lists(u); const f = db.users[key(b.username)];
    if (!f || !u.reqIn.includes(key(b.username))) return { ok: false, error: 'No such request.' };
    return accept(u, lists(f));
  }));
  app.post('/api/friends/remove', auth((u, b) => { // remove a friend, decline or cancel a request
    lists(u); const k = key(b.username), f = db.users[k], me = key(u.name);
    drop(u.friends, k); drop(u.reqIn, k); drop(u.reqOut, k);
    if (f) { lists(f); drop(f.friends, me); drop(f.reqIn, me); drop(f.reqOut, me); }
    save();
    return { ok: true };
  }));

  // WEEKLY XP leaderboard: ranked by the XP earned since the last reset. It resets every Monday at 12:30 pm
  // (server time zone below; default India Standard Time, UTC+5:30 - change with RESET_TZ_OFFSET_MIN).
  // The player in first place when it resets is paid 10 soul shards + 400 ritual coins.
  const xpToNext = (L) => Math.round(250 + (L - 1) * 90 + (L - 1) ** 1.9 * 3); // same curve as the client
  const CURVE = 2; // bump when the curve changes: everybody's weekly baseline is re-taken once so nobody gains / loses weekly XP from it
  const totalXp = (p) => { let t = p?.xp || 0; for (let L = 1; L < (p?.level || 1); L++) t += xpToNext(L); return t; };
  const TZ = Number(process.env.RESET_TZ_OFFSET_MIN ?? 330), WEEK = 7 * 86400000, PRIZE = { shards: 10, coins: 400 };
  const weekStartOf = (now) => { // most recent Monday 12:30 in the configured zone, as a real timestamp
    const local = new Date(now + TZ * 60000);
    let d = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 12, 30) - ((local.getUTCDay() + 6) % 7) * 86400000;
    if (d > local.getTime()) d -= WEEK;
    return d - TZ * 60000;
  };
  const weekBoard = () => Object.values(db.users).filter((u) => u.profile)
    .map((u) => { if (u.curve !== CURVE) { u.curve = CURVE; u.weekBase = totalXp(u.profile); } return u; })
    .map((u) => ({ name: u.name, level: u.profile.level || 1, xp: Math.max(0, totalXp(u.profile) - (u.weekBase || 0)), total: totalXp(u.profile), matches: u.profile.stats?.matches || 0 }))
    .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name));
  const rollWeek = () => {
    const ws = weekStartOf(Date.now());
    db.meta ||= {};
    if (db.meta.weekStart == null) { db.meta.weekStart = ws; save(); return; }
    if (ws <= db.meta.weekStart) return;
    const win = weekBoard().find((r) => r.xp > 0);
    if (win) {
      const u = Object.values(db.users).find((x) => x.name === win.name);
      u.pendingRewards = [...(u.pendingRewards || []), { ...PRIZE, week: db.meta.weekStart, rank: 1 }];
      db.meta.lastWinner = { name: win.name, xp: win.xp, week: db.meta.weekStart };
    }
    for (const u of Object.values(db.users)) u.weekBase = u.profile ? totalXp(u.profile) : 0;
    db.meta.weekStart = ws; save();
  };
  rollWeek(); setInterval(rollWeek, 30000).unref?.();
  app.get('/api/leaderboard', json((req) => {
    rollWeek();
    const me = byToken(req);
    const ranked = weekBoard().filter((r) => r.xp > 0); ranked.forEach((r, i) => { r.rank = i + 1; });
    const mine = me ? ranked.find((r) => r.name === me.name) || { name: me.name, level: me.profile?.level || 1, xp: 0, rank: null } : null;
    return { ok: true, total: ranked.length, top: ranked.slice(0, 50), me: mine, resetAt: db.meta.weekStart + WEEK, now: Date.now(), prize: PRIZE, lastWinner: db.meta.lastWinner || null };
  }));
  app.post('/api/claim', json((req) => {
    const u = byToken(req); if (!u) return { ok: false, error: 'Please sign in again.' };
    const rewards = u.pendingRewards || []; u.pendingRewards = []; save();
    return { ok: true, rewards };
  }));

  // How many players earned each achievement (only accounts that have played count).
  app.get('/api/achievements/stats', json(() => {
    const counts = {}; let total = 0;
    for (const u of Object.values(db.users)) {
      if (!u.profile) continue;
      total++;
      for (const id of Object.keys(u.profile.achievements || {})) counts[id] = (counts[id] || 0) + 1;
    }
    return { ok: true, total, counts };
  }));
  app.post('/api/logout', json((req) => {
    const u = byToken(req), t = String(req.headers.authorization || '').replace(/^Bearer /, '');
    if (u) { u.tokens = (u.tokens || []).filter((x) => x !== t); save(); }
    return { ok: true };
  }));
}
