// Lobby management: up to 5 players, empty seats are filled with bots when the match starts.
import { Game } from '../shared/game.js';
import { MAX_PLAYERS, SKINS, BOT_NAMES, MONSTER_IDS, TRAPS, TICK_RATE, PERKS, MAX_PERKS } from '../shared/constants.js';

const SNAP_EVERY = 1; // send a snapshot every tick (20 Hz)
const code = () => Math.random().toString(36).slice(2, 7).toUpperCase();
const clean = (s, n = 16) => String(s || '').replace(/[^\w \-.']/g, '').trim().slice(0, n);

export class LobbyManager {
  constructor(io) { this.io = io; this.lobbies = new Map(); this.bySocket = new Map(); }
  count() { return this.lobbies.size; }

  list() {
    return [...this.lobbies.values()].filter((l) => !l.game && !l.private)
      .map((l) => ({ code: l.code, name: l.name, players: l.members.length, max: MAX_PLAYERS }));
  }

  create(socket, { name, lobbyName, private: priv }) {
    this.leave(socket);
    let c = code(); while (this.lobbies.has(c)) c = code();
    const lobby = { code: c, name: clean(lobbyName, 24) || `${clean(name) || 'Someone'}'s vigil`, private: !!priv, host: socket.id, members: [], game: null, timer: null, chat: [] };
    this.lobbies.set(c, lobby);
    return this.join(socket, { code: c, name });
  }

  quick(socket, data) {
    const open = [...this.lobbies.values()].find((l) => !l.game && !l.private && l.members.length < MAX_PLAYERS);
    return open ? this.join(socket, { ...data, code: open.code }) : this.create(socket, data);
  }

  join(socket, { code: c, name }) {
    const lobby = this.lobbies.get(String(c || '').toUpperCase());
    if (!lobby) return { ok: false, error: 'Lobby not found.' };
    if (lobby.game) return { ok: false, error: 'Match already in progress.' };
    if (lobby.members.length >= MAX_PLAYERS) return { ok: false, error: 'Lobby is full.' };
    this.leave(socket);
    const taken = new Set(lobby.members.map((m) => m.skin));
    lobby.members.push({
      id: socket.id, name: clean(name) || 'Survivor', ready: false,
      skin: SKINS.find((s) => !taken.has(s.id)).id, monsterPref: MONSTER_IDS[0], trap: 'bear',
    });
    this.bySocket.set(socket.id, lobby.code);
    socket.join(lobby.code);
    this.broadcast(lobby);
    socket.to(lobby.code).emit('lobby:chat', { sys: true, text: `${clean(name) || 'Survivor'} stepped into the circle.` });
    return { ok: true, code: lobby.code, you: socket.id };
  }

  leave(socket) {
    const c = this.bySocket.get(socket.id); if (!c) return;
    this.bySocket.delete(socket.id);
    socket.leave(c);
    const lobby = this.lobbies.get(c); if (!lobby) return;
    const gone = lobby.members.find((m) => m.id === socket.id);
    lobby.members = lobby.members.filter((m) => m.id !== socket.id);
    if (gone && !lobby.game) this.io.to(c).emit('lobby:chat', { sys: true, text: `${gone.name} left the circle.` });
    if (lobby.game) lobby.game.removePlayer(socket.id);
    if (!lobby.members.length) { clearInterval(lobby.timer); this.lobbies.delete(c); return; }
    if (lobby.host === socket.id) lobby.host = lobby.members[0].id;
    this.broadcast(lobby);
  }

  update(socket, data) {
    const lobby = this.lobbyOf(socket); if (!lobby || lobby.game) return;
    const me = lobby.members.find((m) => m.id === socket.id);
    if (data.skin && SKINS.some((s) => s.id === data.skin) && !lobby.members.some((m) => m !== me && m.skin === data.skin)) me.skin = data.skin;
    if (data.monsterPref && MONSTER_IDS.includes(data.monsterPref)) me.monsterPref = data.monsterPref;
    if (data.trap && TRAPS[data.trap]) me.trap = data.trap;
    if (data.trapLvl) me.trapLvl = Math.max(1, Math.min(3, data.trapLvl | 0));
    if (Array.isArray(data.perks)) me.perks = data.perks.filter((p) => PERKS[p?.id]).slice(0, MAX_PERKS).map((p) => ({ id: p.id, lvl: Math.max(1, Math.min(3, p.lvl | 0 || 1)) }));
    if (data.level) me.level = Math.max(1, Math.min(100, data.level | 0));
    if (data.name) me.name = clean(data.name) || me.name;
    this.broadcast(lobby);
  }

  ready(socket, r) {
    const lobby = this.lobbyOf(socket); if (!lobby) return;
    const me = lobby.members.find((m) => m.id === socket.id); if (me) me.ready = r;
    this.broadcast(lobby);
  }

  chat(socket, msg) {
    const lobby = this.lobbyOf(socket); if (!lobby) return;
    const me = lobby.members.find((m) => m.id === socket.id);
    const text = String(msg || '').slice(0, 140).trim(); if (!text || !me) return;
    this.io.to(lobby.code).emit('lobby:chat', { name: me.name, text });
  }

  start(socket) {
    const lobby = this.lobbyOf(socket);
    if (!lobby || lobby.game || lobby.host !== socket.id) return;
    // Fill empty seats with bots (unique names & skins).
    const roster = lobby.members.map((m) => ({ ...m, isBot: false }));
    const usedNames = new Set(roster.map((r) => r.name));
    const botNames = BOT_NAMES.filter((n) => !usedNames.has(n));
    for (let i = roster.length; i < MAX_PLAYERS; i++) {
      roster.push({ id: `bot${i}`, name: botNames[i], isBot: true, monsterPref: MONSTER_IDS[Math.floor(Math.random() * MONSTER_IDS.length)], trap: Object.keys(TRAPS)[i % Object.keys(TRAPS).length] });
    }
    const game = new Game({ roster });
    lobby.game = game;
    this.io.to(lobby.code).emit('match:start', { seed: game.seed, snapshot: game.snapshot() });
    let n = 0;
    lobby.timer = setInterval(() => {
      game.tick(1 / TICK_RATE);
      if (++n % SNAP_EVERY === 0 || game.ended) this.io.to(lobby.code).emit('snap', game.snapshot());
      if (game.ended) {
        clearInterval(lobby.timer);
        setTimeout(() => { lobby.game = null; lobby.members.forEach((m) => (m.ready = false)); this.broadcast(lobby); }, 8000);
      }
    }, 1000 / TICK_RATE);
  }

  input(socket, inp) {
    const lobby = this.lobbyOf(socket);
    if (!lobby?.game || !inp || typeof inp !== 'object') return;
    const num = (v) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
    lobby.game.setInput(socket.id, {
      mx: num(inp.mx), mz: num(inp.mz), run: !!inp.run, crouch: !!inp.crouch, crawl: !!inp.crawl,
      interact: !!inp.interact, heal: !!inp.heal, aim: !!inp.aim, face: Number.isFinite(inp.face) ? inp.face : undefined,
      actions: Array.isArray(inp.actions) ? inp.actions.slice(0, 8) : [],
    });
  }

  lobbyOf(socket) { return this.lobbies.get(this.bySocket.get(socket.id)); }
  broadcast(lobby) {
    this.io.to(lobby.code).emit('lobby:state', {
      code: lobby.code, name: lobby.name, host: lobby.host, inGame: !!lobby.game,
      members: lobby.members.map(({ id, name, ready, skin, monsterPref, trap, perks, level }) => ({ id, name, ready, skin, monsterPref, trap, perks, level })),
    });
  }
}
