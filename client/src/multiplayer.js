// Multiplayer flow: connect to the Render server, browse / create / join lobbies, start matches.
import { lobbyScreen, multiMenu } from './ui/lobby.js';
import { NetClient, NetSession } from './session.js';

export function setupMultiplayer(app, { toMenu, startMatch, preview, savePrefs }) {
  async function multiEntry(error = '') {
    if (!app.net) {
      app.net = new NetClient();
      app.net.on('lobby:state', (l) => { app.lobby = l; if (!app.match && !app.loading && !l.inGame) renderLobby(); });
      app.net.on('lobby:chat', (c) => { app.chat.push(c); if (app.chat.length > 50) app.chat.shift(); if (!app.match && !app.loading) renderLobby(); });
      app.net.on('match:start', ({ seed, snapshot }) => {
        const session = new NetSession(app.net, seed, app.net.id);
        session.firstSnap = snapshot;
        startMatch(session, app.net.id, renderLobby);
      });
      app.net.on('disconnect', () => { if (!app.match && app.lobby) { app.lobby = null; multiEntry('Disconnected from server.'); } });
    }
    const noop = () => {};
    multiMenu({ status: 'Connecting to the server…', error, onBack: toMenu, onQuick: noop, onCreate: noop, onJoin: noop });
    try { await app.net.connect(); } catch (e) {
      return multiMenu({ error: e.message, onBack: toMenu, onQuick: () => multiEntry(), onCreate: () => multiEntry(), onJoin: () => multiEntry() });
    }
    const lobbies = await app.net.call('lobby:list');
    const prefs = { name: app.name, ...app.prefs };
    const after = (res) => {
      if (!res?.ok) return multiEntry(res?.error || 'Could not join.');
      app.chat = [];
      app.net.emit('lobby:update', app.prefs);
    };
    multiMenu({
      lobbies, error, status: 'Connected.', onBack: toMenu,
      onQuick: async () => after(await app.net.call('lobby:quick', prefs)),
      onCreate: async () => after(await app.net.call('lobby:create', prefs)),
      onJoin: async (code) => after(await app.net.call('lobby:join', { ...prefs, code: String(code || '').trim().toUpperCase() })),
    });
  }

  function renderLobby() {
    const l = app.lobby; if (!l || app.match) return;
    const me = l.members.find((m) => m.id === app.net.id);
    const canvas = lobbyScreen({
      mode: 'multi', code: l.code, members: l.members, myId: app.net.id, hostId: l.host, chat: app.chat,
      onUpdate: (u) => { Object.assign(app.prefs, u); savePrefs(); app.net.emit('lobby:update', u); },
      onReady: (r) => app.net.emit('lobby:ready', r),
      onStart: () => app.net.emit('lobby:start'),
      onChat: (t) => app.net.emit('lobby:chat', t),
      onLeave: () => { app.net.emit('lobby:leave'); app.lobby = null; multiEntry(); },
    });
    if (me) preview.attach(canvas, me.skin, me.monsterPref);
  }

  return { multiEntry, renderLobby };
}
