// Multiplayer flow: connect to the Render server, browse / create / join lobbies, start matches.
import { LobbyUI, multiMenu } from './ui/lobby.js';
import { NetClient, NetSession } from './session.js';
import { loadoutPrefs, presence, setPresence } from './profile.js';

export function setupMultiplayer(app, { toMenu, startMatch, backdrop }) {
  async function multiEntry(error = '', joinCode = null) {
    app.lobbyUI = null; backdrop('menu');
    if (!app.net) {
      app.net = new NetClient();
      app.net.on('lobby:state', (l) => { app.lobby = l; if (!app.match && !app.loading && !l.inGame) renderLobby(); });
      app.net.on('lobby:chat', (c) => {
        app.chat.push(c); if (app.chat.length > 60) app.chat.shift();
        if (app.match) app.match.hud?.chatLine(c.name, c.text, c.sys); else if (!app.loading) renderLobby();
      });
      app.net.on('match:start', ({ seed, snapshot }) => {
        app.lobbyUI = null;
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
    const prefs = { name: app.name, ...loadoutPrefs() };
    const after = (res) => {
      if (!res?.ok) return multiEntry(res?.error || 'Could not join.');
      app.chat = [{ sys: true, text: `You entered the circle. Lobby code ${res.code} — share it with friends.` }];
      app.net.emit('lobby:update', loadoutPrefs());
    };
    // joining a friend's lobby straight from the friends list
    if (joinCode) return after(await app.net.call('lobby:join', { ...prefs, code: String(joinCode).toUpperCase() }));
    multiMenu({
      lobbies, error, status: 'Connected.', onBack: toMenu,
      onQuick: async () => after(await app.net.call('lobby:quick', prefs)),
      onCreate: async () => after(await app.net.call('lobby:create', prefs)),
      onJoin: async (code) => after(await app.net.call('lobby:join', { ...prefs, code: String(code || '').trim().toUpperCase() })),
    });
  }

  function renderLobby() {
    const l = app.lobby; if (!l || app.match) return;
    if (presence.code !== l.code || presence.where !== 'lobby') setPresence('lobby', l.code);
    if (!app.lobbyUI || app.lobbyUI.o.mode !== 'multi') {
      backdrop('lobby');
      app.lobbyUI = new LobbyUI({
        mode: 'multi', scene: app.lobbyScene,
        onUpdate: (u) => app.net.emit('lobby:update', u),
        onReady: (r) => app.net.emit('lobby:ready', r),
        onStart: () => app.net.emit('lobby:start'),
        onChat: (t) => app.net.emit('lobby:chat', t),
        onLeave: () => { app.net.emit('lobby:leave'); app.lobby = null; multiEntry(); },
      });
    }
    app.lobbyUI.render({ title: l.name, code: l.code, members: l.members, myId: app.net.id, hostId: l.host, chat: app.chat });
    app.celebrate?.();
  }

  return { multiEntry, renderLobby };
}
