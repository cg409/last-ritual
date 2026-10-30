// Multiplayer flow: connect to the Render server, browse / create / join lobbies, start matches.
import { LobbyUI, multiMenu } from './ui/lobby.js';
import { NetClient, NetSession } from './session.js';
import { loadoutPrefs, presence, setPresence, account } from './profile.js';
import { invitePicker } from './ui/invite.js';

// A small round-trip indicator, so a slow connection is visible (and not mistaken for a slow game).
function startPing(app) {
  if (app.pingTimer) return;
  const badge = document.createElement('div'); badge.id = 'netping'; document.body.appendChild(badge);
  const tick = async () => {
    if (!app.net?.socket?.connected) { badge.textContent = ''; return; }
    const t = performance.now(); await app.net.call('net:ping'); const ms = Math.round(performance.now() - t);
    badge.textContent = ms + ' ms'; badge.style.color = ms < 90 ? '#7fcf7f' : ms < 200 ? '#e0c060' : '#e06060';
  };
  app.pingTimer = setInterval(tick, 3000); tick();
}

export function setupMultiplayer(app, { toMenu, startMatch, backdrop }) {
  // One connection for the whole session (created on demand): lobbies, matches and friend invites all use it.
  function ensureNet() {
    if (!app.net) {
      app.net = new NetClient();
      app.net.getToken = () => account.token; // signed-in players announce themselves, so friends can invite them
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
      app.net.socket.on('invite:recv', (inv) => showInvite(inv));
    }
  }

  // A friend invited you: a banner with Join / Decline (not while a match is running).
  function showInvite(inv) {
    if (app.match || app.loading) return;
    document.querySelector('.invite-toast')?.remove();
    const t = document.createElement('div'); t.className = 'invite-toast';
    t.innerHTML = `<div><b></b> invited you to <i></i></div><div class="it-btns"><button class="btn small primary" data-a="join">Join</button><button class="btn small" data-a="no">Decline</button></div>`;
    t.querySelector('b').textContent = inv.from; t.querySelector('i').textContent = inv.lobby || 'a lobby';
    document.body.appendChild(t);
    const done = setTimeout(() => t.remove(), 30000);
    t.addEventListener('click', (e) => {
      const a = e.target.dataset?.a; if (!a) return;
      clearTimeout(done); t.remove();
      if (a === 'join') { if (app.lobby) { app.net.emit('lobby:leave'); app.lobby = null; } app.lobbyUI = null; multiEntry('', inv.code); }
    });
  }

  async function multiEntry(error = '', joinCode = null) {
    app.lobbyUI = null; backdrop('menu');
    ensureNet();
    const noop = () => {};
    multiMenu({ status: 'Connecting to the server… (a sleeping free server can take up to a minute to wake up — please wait)', error, onBack: toMenu, onQuick: noop, onCreate: noop, onJoin: noop });
    try { await app.net.connect(); } catch (e) {
      return multiMenu({ error: e.message, onBack: toMenu, onQuick: () => multiEntry(), onCreate: () => multiEntry(), onJoin: () => multiEntry() });
    }
    startPing(app);
    const lobbies = await Promise.race([app.net.call('lobby:list'), new Promise((r) => setTimeout(() => r([]), 8000))]);
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

  function patchMe(u) {
    const me = app.lobby?.members.find((m) => m.id === app.net.id); if (!me) return;
    Object.assign(me, u); renderLobby();
  }

  function renderLobby() {
    const l = app.lobby; if (!l || app.match) return;
    if (presence.code !== l.code || presence.where !== 'lobby') setPresence('lobby', l.code);
    if (!app.lobbyUI || app.lobbyUI.o.mode !== 'multi') {
      backdrop('lobby');
      app.lobbyUI = new LobbyUI({
        mode: 'multi', scene: app.lobbyScene,
        // clicks show instantly: the change is applied locally first, the server's reply then confirms it
        onUpdate: (u) => { app.net.emit('lobby:update', u); patchMe(u); },
        onReady: (r) => { app.net.emit('lobby:ready', r); patchMe({ ready: r }); },
        onInvite: () => invitePicker({ send: (to) => app.net.call('invite:send', { to }) }),
        onPrivate: (v) => { app.net.emit('lobby:private', v); app.lobby.private = v; renderLobby(); },
        onStart: () => app.net.emit('lobby:start'),
        onChat: (t) => app.net.emit('lobby:chat', t),
        onLeave: () => { app.net.emit('lobby:leave'); app.lobby = null; multiEntry(); },
      });
    }
    app.lobbyUI.render({ title: l.name, code: l.code, members: l.members, myId: app.net.id, hostId: l.host, chat: app.chat, private: !!l.private });
    app.celebrate?.();
  }

  // signed-in players connect quietly at start-up so invites reach them even from the main menu
  function connectBackground() { if (account.mode !== 'account') return; ensureNet(); app.net.connect().then(() => startPing(app)).catch(() => {}); }

  return { multiEntry, renderLobby, connectBackground };
}
