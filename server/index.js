// THE LAST RITUAL — multiplayer server (deploy on Render). Socket.IO lobbies + authoritative simulation.
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { LobbyManager } from './lobby.js';
import { mountAccounts } from './accounts.js';

const PORT = process.env.PORT || 3000;
// Comma-separated list of allowed frontends, e.g. "https://hollow-vigil.netlify.app". "*" allows all.
const ORIGINS = (process.env.CLIENT_ORIGIN || '*').split(',').map((s) => s.trim());

const app = express();
app.use(express.json({ limit: '64kb' }));
mountAccounts(app, ORIGINS);
app.get('/', (_req, res) => res.type('text').send('The Last Ritual server is running.'));
app.get('/health', (_req, res) => res.json({ ok: true, lobbies: lobbies.count(), uptime: process.uptime() }));

const http = createServer(app);
const io = new Server(http, {
  cors: { origin: ORIGINS.includes('*') ? true : ORIGINS, methods: ['GET', 'POST'] },
  pingInterval: 10000, pingTimeout: 20000,
});
const lobbies = new LobbyManager(io);

io.on('connection', (socket) => {
  const safe = (fn) => (...args) => { try { fn(...args); } catch (e) { console.error(e); } };
  socket.on('lobby:list', safe((cb) => typeof cb === 'function' && cb(lobbies.list())));
  socket.on('lobby:create', safe((data, cb) => cb?.(lobbies.create(socket, data || {}))));
  socket.on('lobby:join', safe((data, cb) => cb?.(lobbies.join(socket, data || {}))));
  socket.on('lobby:quick', safe((data, cb) => cb?.(lobbies.quick(socket, data || {}))));
  socket.on('lobby:leave', safe(() => lobbies.leave(socket)));
  socket.on('lobby:update', safe((data) => lobbies.update(socket, data || {})));
  socket.on('lobby:ready', safe((ready) => lobbies.ready(socket, !!ready)));
  socket.on('lobby:start', safe(() => lobbies.start(socket)));
  socket.on('lobby:chat', safe((msg) => lobbies.chat(socket, msg)));
  socket.on('input', safe((inp) => lobbies.input(socket, inp)));
  socket.on('disconnect', safe(() => lobbies.leave(socket)));
});

http.listen(PORT, () => console.log(`The Last Ritual server listening on :${PORT}`));
