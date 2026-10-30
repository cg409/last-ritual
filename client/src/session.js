// Sessions hide where the simulation runs:
//  LocalSession  — singleplayer: the full Game (with 4 bots) runs in the browser.
//  NetSession    — multiplayer: Socket.IO to the Render server, which runs the Game.
import { io } from 'socket.io-client';
import { Game } from '@shared/game.js';
import { TICK_RATE } from '@shared/constants.js';

// The server address: edit dist/config.js after building (no rebuild needed), or set VITE_SERVER_URL at build time.
const cfg = typeof window !== 'undefined' && window.TLR_SERVER_URL && !/PASTE/.test(window.TLR_SERVER_URL) ? window.TLR_SERVER_URL.replace(/\/+$/, '') : '';
export const SERVER_URL = cfg || import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
// Opened from the internet but still pointing at localhost = the Render address was never put into config.js.
export const SERVER_MISCONFIGURED = /localhost|127\.0\.0\.1/.test(SERVER_URL) && !/^(localhost|127\.0\.0\.1|192\.168\.|10\.)/.test(location.hostname);
// Free servers fall asleep; poking /health the moment the page opens wakes it while the game loads.
export function wakeServer() { if (!SERVER_MISCONFIGURED) fetch(SERVER_URL + '/health', { mode: 'no-cors', cache: 'no-store' }).catch(() => {}); }

export class LocalSession {
  constructor(roster, myId) {
    this.myId = myId;
    // Debug: ?as=monster or ?as=survivor forces your role in singleplayer.
    const as = new URLSearchParams(location.search).get('as');
    const forceMonster = as === 'monster' ? myId : as === 'survivor' ? roster.find((r) => r.id !== myId)?.id : null;
    this.game = new Game({ roster, forceMonster });
    this.game.botChat = false; // singleplayer: the bots stay silent during the match
    // Debug: ?dead=1 starts you as a mouse (to test the after-death mode).
    if (new URLSearchParams(location.search).has('dead')) { const me = this.game.player(myId); if (me && me.role === 'survivor') me.state = 'mouse'; }
    this.seed = this.game.seed;
    this.onSnap = null;
    this.acc = 0; this.paused = false;
  }
  start() {
    this.last = performance.now();
    this.timer = setInterval(() => {
      const t = performance.now(), dt = Math.min(0.25, (t - this.last) / 1000); this.last = t;
      if (this.paused) return;
      this.acc += dt;
      const step = 1 / TICK_RATE;
      while (this.acc >= step) { this.game.tick(step); this.acc -= step; this.onSnap?.(this.game.snapshot()); }
    }, 1000 / TICK_RATE / 2);
  }
  sendInput(inp) { this.game.setInput(this.myId, inp); }
  sendChat(text, name) { this.game.emit({ t: 'chat', name, text: String(text).slice(0, 140) }); }
  stop() { clearInterval(this.timer); }
}

export class NetClient {
  constructor() {
    this.socket = io(SERVER_URL, { transports: ['websocket', 'polling'], autoConnect: false, reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 4000, timeout: 20000 });
    this.handlers = {};
    this.socket.on('connect', () => { const t = this.getToken?.(); if (t) this.socket.emit('hello', t); }); // (re)announce after every reconnect
    for (const ev of ['lobby:state', 'lobby:chat', 'match:start', 'snap', 'connect', 'disconnect', 'connect_error']) {
      this.socket.on(ev, (d) => this.handlers[ev]?.(d));
    }
  }
  on(ev, fn) { this.handlers[ev] = fn; }
  get id() { return this.socket.id; }
  connect() {
    return new Promise((res, rej) => {
      if (this.socket.connected) return res();
      if (SERVER_MISCONFIGURED) return rej(new Error('This game is not linked to its server yet: put your Render address in config.js (see DEPLOY.md) and upload the site again.'));
      const to = setTimeout(() => rej(new Error('Server did not respond. (A sleeping Render server can take ~50s to wake up — try again.)')), 60000);
      this.socket.once('connect', () => { clearTimeout(to); res(); });
      this.socket.once('connect_error', () => {});
      this.socket.connect();
    });
  }
  call(ev, data) { return new Promise((res) => (data === undefined ? this.socket.emit(ev, res) : this.socket.emit(ev, data, res))); }
  emit(ev, data) { this.socket.emit(ev, data); }
}

export class NetSession {
  constructor(net, seed, myId) {
    this.net = net; this.seed = seed; this.myId = myId; this.onSnap = null;
    net.on('snap', (s) => this.onSnap?.(s));
  }
  start() {}
  sendInput(inp) { this.net.emit('input', inp); }
  sendChat(text) { this.net.emit('lobby:chat', text); }
  stop() { this.net.on('snap', null); }
}
