// THE LAST RITUAL — multiplayer server (deploy on Render). Socket.IO lobbies + authoritative simulation.
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { LobbyManager } from './lobby.js';
import { mountAccounts, byTokenString, areFriends } from './accounts.js';
import { mountReport } from './report.js';

const PORT = process.env.PORT || 3000;
// Comma-separated list of allowed frontends, e.g. "https://hollow-vigil.netlify.app". "*" allows all.
const ORIGINS = (process.env.CLIENT_ORIGIN || '*').split(',').map((s) => s.trim());

const app = express();
app.set('trust proxy', 1);
const small = express.json({ limit: '64kb' });
app.use((req, res, next) => (req.path === '/api/report' ? next() : small(req, res, next))); // reports carry screenshots: bigger limit (see report.js)
mountAccounts(app, ORIGINS);
mountReport(app);
app.get('/', (_req, res) => res.type('text').send('The Last Ritual server is running.'));
app.get('/health', (_req, res) => res.json({ ok: true, lobbies: lobbies.count(), uptime: process.uptime() }));

const http = createServer(app);
const io = new Server(http, {
  cors: { origin: ORIGINS.includes('*') ? true : ORIGINS, methods: ['GET', 'POST'] },
  pingInterval: 10000, pingTimeout: 20000,
});
const lobbies = new LobbyManager(io);

// Signed-in players keep one socket open so friends can invite them to a lobby instantly.
const online = new Map();       // lower-case account name -> Set of socket ids
const lastInvite = new Map();   // "from>to" -> time (one invite per friend per 10 s)

io.on('connection', (socket) => {
  const safe = (fn) => (...args) => { try { fn(...args); } catch (e) { console.error(e); } };
  socket.on('hello', safe((token, cb) => {
    const u = byTokenString(String(token || ''));
    if (!u) return typeof cb === 'function' && cb({ ok: false });
    socket.data.user = u.name;
    const k = u.name.toLowerCase(); if (!online.has(k)) online.set(k, new Set()); online.get(k).add(socket.id);
    if (typeof cb === 'function') cb({ ok: true });
  }));
  socket.on('invite:send', safe((data, cb) => {
    const reply = typeof cb === 'function' ? cb : () => {};
    const from = socket.data.user, to = String(data?.to || '');
    if (!from) return reply({ ok: false, error: 'Sign in to invite friends.' });
    const lobby = lobbies.lobbyOf(socket);
    if (!lobby || lobby.game) return reply({ ok: false, error: 'Open a lobby first.' });
    if (!areFriends(from, to)) return reply({ ok: false, error: 'You can only invite friends.' });
    const ids = online.get(to.toLowerCase());
    if (!ids?.size) return reply({ ok: false, error: `${to} is not online right now.` });
    if (lobby.members.some((m) => ids.has(m.id))) return reply({ ok: false, error: `${to} is already in your lobby.` });
    const k = `${from}>${to}`.toLowerCase(), now = Date.now();
    if (now - (lastInvite.get(k) || 0) < 10000) return reply({ ok: false, error: 'Invite already sent - give them a moment.' });
    lastInvite.set(k, now);
    for (const id of ids) io.to(id).emit('invite:recv', { from, code: lobby.code, lobby: lobby.name });
    reply({ ok: true });
  }));
  socket.on('lobby:list', safe((...a) => { const cb = a.find((x) => typeof x === 'function'); cb?.(lobbies.list()); }));
  socket.on('lobby:create', safe((data, cb) => cb?.(lobbies.create(socket, data || {}))));
  socket.on('lobby:join', safe((data, cb) => cb?.(lobbies.join(socket, data || {}))));
  socket.on('lobby:quick', safe((data, cb) => cb?.(lobbies.quick(socket, data || {}))));
  socket.on('lobby:private', safe((v) => lobbies.setPrivate(socket, v)));
  socket.on('net:ping', safe((...a) => { a.find((x) => typeof x === 'function')?.(Date.now()); }));
  socket.on('lobby:leave', safe(() => lobbies.leave(socket)));
  socket.on('lobby:update', safe((data) => lobbies.update(socket, data || {})));
  socket.on('lobby:ready', safe((ready) => lobbies.ready(socket, !!ready)));
  socket.on('lobby:start', safe(() => lobbies.start(socket)));
  socket.on('lobby:chat', safe((msg) => lobbies.chat(socket, msg)));
  socket.on('input', safe((inp) => lobbies.input(socket, inp)));
  socket.on('disconnect', safe(() => {
    lobbies.leave(socket);
    const k = socket.data.user?.toLowerCase(); if (k && online.has(k)) { online.get(k).delete(socket.id); if (!online.get(k).size) online.delete(k); }
  }));
});

http.listen(PORT, () => console.log(`The Last Ritual server listening on :${PORT}`));
