// App flow: menu → (singleplayer lobby | multiplayer lobby) → loading (monster reveal) → match → end.
import './style.css';
import './screens.css';
import './hud.css';
import * as THREE from 'three';
import { Stage } from './render/stage.js';
import { loadCharacterAssets, assetsReady, Character } from './render/characters.js';
import { buildTrips } from './render/trips.js';
import { Pallets } from './render/pallets.js';
import { MenuScene } from './render/menuScene.js';
import { LobbyScene } from './render/lobbyScene.js';
import { Input } from './input.js';
import { initAudio, startAmbience, stopAmbience } from './audio.js';
import { mainMenu, loadingScreen, monsterReveal, howTo } from './ui/menu.js';
import { LobbyUI } from './ui/lobby.js';
import { endScreen } from './ui/end.js';
import { LocalSession } from './session.js';
import { Match } from './match.js';
import { setupMultiplayer } from './multiplayer.js';
import { MONSTER_IDS, BOT_NAMES, MAX_PLAYERS, TRAP_IDS } from '@shared/constants.js';
import { account, saveProfile, loadoutPrefs, applyMatch, resumeSession, playAsGuest, presence, setPresence } from './profile.js';
import { friendsScreen } from './ui/friendsScreen.js';
import { levelUpAnim } from './ui/levelUp.js';
import { leaderboardScreen } from './ui/leaderboard.js';
import { chooseGraphicsFirstTime } from './ui/gfxChooser.js';
import { playClip, readyCount } from './sounds.js';
import { getCtx } from './audio.js';
import { authScreen } from './ui/account.js';
import { profileScreen } from './ui/profileScreen.js';
import { settingsPanel } from './ui/settingsMenu.js';
import { show } from './ui/dom.js';
import { loadModels, ALL_MODELS, setAnisotropy, getModel } from './render/assets.js';
import { loadCrowAssets } from './render/crow.js';
import { graphics } from './settings.js';

const stage = new Stage(document.getElementById('game'));
const input = new Input(stage.renderer.domElement);
const app = {
  name: localStorage.getItem('hv-name') || 'Survivor',
  prefs: JSON.parse(localStorage.getItem('hv-prefs') || '{}'),
  match: null, menuScene: null, net: null, lobby: null, chat: [], loading: false,
};
app.celebrate = () => celebrate();
const savePrefs = () => localStorage.setItem('hv-prefs', JSON.stringify(app.prefs));

let last = performance.now(), menuWindAt = 0;
function loop() {
  const t = performance.now(), dt = Math.min(0.1, (t - last) / 1000); last = t;
  if (app.match) app.match.frame(dt);
  else if (app.lobbyScene?.active) app.lobbyScene.update(dt);
  else app.menuScene?.update(dt);
  // the wind never stops — in the menus and lobby too (softly, under the music)
  if (!app.match && t > menuWindAt) { const g = playClip('wind', { vol: 0.12 + Math.random() * 0.18, pan: Math.random() * 1.6 - 0.8, rate: 0.85 + Math.random() * 0.25 }); menuWindAt = t + (g ? g.len * 1000 * (0.6 + Math.random() * 0.5) : 1000); }
  stage.render();
  requestAnimationFrame(loop);
}

// Switch the 3D backdrop between the menu scene and the lobby lineup.
function backdrop(which) {
  app.menuScene?.show(which === 'menu');
  app.lobbyScene?.show(which === 'lobby');
}
// After a match that levelled you up: celebrate once you're back in the lobby (or the menu).
function celebrate() {
  if (!app.pendingLevelUp || app.match) return;
  const [a, b] = app.pendingLevelUp; app.pendingLevelUp = null;
  setTimeout(() => levelUpAnim(a, b), 400);
}

function toMenu() {
  app.match?.dispose(); app.match = null;
  if (app.net && app.lobby) app.net.emit('lobby:leave');
  app.lobby = null; app.lobbyUI = null;
  backdrop('menu');
  startAmbience(0.6);
  setPresence('menu');
  presence.onRequests = (n) => { // live badge on the Friends entry
    const l = document.querySelector('#fr .mm-l'); if (!l) return;
    l.querySelector('.mm-badge-n')?.remove();
    if (n) l.insertAdjacentHTML('beforeend', `<i class="mm-badge-n">${n}</i>`);
  };
  const P = account.profile;
  app.name = account.mode === 'account' ? account.username : P.name || app.name;
  mainMenu({
    name: app.name, locked: account.mode === 'account',
    profile: { level: P.level, coins: P.coins, shards: P.shards, account: account.mode === 'account' },
    onName: (v) => { app.name = v.slice(0, 16); P.name = app.name; localStorage.setItem('hv-name', app.name); saveProfile(); },
    onSingle: singleLobby, onMulti: () => mp.multiEntry(), onHow: () => howTo(toMenu), onLoadout: loadoutScreen,
    requests: presence.requests, onLeaderboard: () => leaderboardScreen({ onBack: toMenu }),
    onFriends: () => friendsScreen({ onBack: toMenu, onSignIn: () => authScreen({ onDone: toMenu }), onJoin: (code) => mp.multiEntry('', code) }),
    onProfile: () => profileScreen({ onBack: toMenu, onSignIn: () => authScreen({ onDone: toMenu }) }),
    onSettings: () => { const ui = show('<div class="screen" id="setwrap"></div>'); settingsPanel(ui.querySelector('#setwrap'), toMenu); },
  });
  celebrate();
}

// Loadout from the main menu: you alone in the circle with the loadout drawer open.
function loadoutScreen() {
  const me = { id: 'you', name: app.name || 'Survivor', ready: true, ...loadoutPrefs() };
  backdrop('lobby');
  const state = () => ({ title: 'Loadout', members: [me], myId: 'you', hostId: 'you', chat: [] });
  const ui = app.lobbyUI = new LobbyUI({
    mode: 'loadout', scene: app.lobbyScene,
    onUpdate: (u) => { Object.assign(me, u); ui.render(state()); },
    onLeave: () => { app.lobbyUI = null; toMenu(); },
    onStart: () => {}, onChat: () => {},
  });
  ui.render(state());
}

// Singleplayer: you + 4 bots that play by the same rules. The bots chat back now and then.
const BOT_LINES = [
  'Save your batteries.', 'I heard something in the trees…', 'Whoever it is — I forgive you.', 'Three tombs. We can do this.',
  "Don't look at the statue.", 'If I fall, cut me down. Please.', 'My hands won\'t stop shaking.', 'Did the crows just move?',
  'Run when your shadow flickers.', 'Pallets. Remember the pallets.', 'I hope it\'s not me.', '…',
];
function singleLobby() {
  const me = { id: 'you', name: app.name || 'Survivor', ready: true, ...loadoutPrefs() };
  const bots = BOT_NAMES.slice(0, MAX_PLAYERS - 1).map((n, i) => ({
    id: `bot${i}`, name: n, isBot: true, ready: true, level: 1 + ((i * 17 + 5) % 40),
    monsterPref: MONSTER_IDS[(i + 1) % MONSTER_IDS.length], trap: TRAP_IDS[i % TRAP_IDS.length],
  }));
  const chat = app.singleChat ||= [{ sys: true, text: 'The circle is drawn. Five souls wait for the ritual.' }];
  backdrop('lobby');
  const state = () => ({ title: 'The Ritual', members: [me, ...bots], myId: 'you', hostId: 'you', chat });
  const say = (m) => { chat.push(m); if (chat.length > 60) chat.shift(); ui.render(state()); };
  const ui = app.lobbyUI = new LobbyUI({
    mode: 'single', scene: app.lobbyScene,
    onUpdate: (u) => { Object.assign(me, u); ui.render(state()); },
    onLeave: () => { app.lobbyUI = null; toMenu(); },
    onStart: () => { app.lobbyUI = null; startMatch(new LocalSession([me, ...bots], 'you'), 'you', singleLobby); },
    onChat: (text) => {
      say({ name: me.name, text, color: '#d9cfbf' });
      if (Math.random() < 0.7) {
        const b = bots[(Math.random() * bots.length) | 0];
        setTimeout(() => { if (app.lobbyUI === ui) say({ name: b.name, text: BOT_LINES[(Math.random() * BOT_LINES.length) | 0] }); }, 900 + Math.random() * 1800);
      }
    },
  });
  ui.render(state());
  celebrate();
}

async function startMatch(session, myId, back) {
  initAudio(); stopAmbience(); setPresence('match');
  app.loading = true;
  const ld = loadingScreen('Summoning the realm');
  if (!assetsReady()) await loadCharacterAssets((k) => ld.progress(k * 0.5));
  ld.progress(0.6);
  await new Promise((r) => setTimeout(r, 50));
  backdrop('none');
  if (window.__hv) { window.__hvGame = session.game; window.__hvInput = input; } // ?debug=1 test hooks
  const match = new Match({ stage, input, session, myId, onEnd: (result, _id, lastMe) => {
    app.match = null;
    backdrop('menu'); startAmbience(0.6);
    const rewards = applyMatch(result, lastMe); // XP, level, coins, shards, achievements
    if (rewards && rewards.after.level > rewards.before.level) app.pendingLevelUp = [rewards.before.level, rewards.after.level];
    endScreen(result, myId, { onAgain: back, onMenu: toMenu, againLabel: session instanceof LocalSession ? 'Play again' : 'Back to lobby', rewards });
  } });
  // Everyone learns who became the monster during loading.
  const first = session.firstSnap || session.game?.snapshot();
  if (first) {
    match.onSnap(first);
    const mon = first.players.find((p) => p.role === 'monster');
    monsterReveal(ld, mon.name, mon.monster, mon.id === myId);
  }
  ld.progress(0.85);
  match.view.update(0.016, input);
  stage.renderer.compile(stage.scene, stage.camera); // pre-compile shaders to avoid hitches
  ld.progress(1);
  await new Promise((r) => setTimeout(r, 3500));
  app.loading = false;
  app.match = match;
  match.begin();
}

const mp = setupMultiplayer(app, { toMenu, startMatch, backdrop });

window.addEventListener('pointerdown', () => { initAudio(); if (!app.match) startAmbience(0.6); }, { once: true });
(async () => {
  await chooseGraphicsFirstTime(stage.renderer); // first launch: pick a graphics setting before anything loads
  const ld = loadingScreen('Waking the dead');
  try {
    setAnisotropy(graphics().anisotropy);
    let a = 0, b = 0;
    await Promise.all([
      loadCharacterAssets((k) => { a = k; ld.progress(a * 0.3 + b * 0.7); }),
      loadModels(ALL_MODELS, (k) => { b = k; ld.progress(a * 0.3 + b * 0.7); }),
      loadCrowAssets(),
    ]);
  } catch (e) { ld.text('Failed to load assets: ' + e.message); return; }
  if (new URLSearchParams(location.search).has('debug')) window.__hv = { Character, stage, getModel, THREE, buildTrips, Pallets, app, sounds: { playClip, levelUpAnim, readyCount, getCtx } };
  app.menuScene = new MenuScene(stage);
  app.lobbyScene = new LobbyScene(stage);
  requestAnimationFrame(loop);
  // Account: resume a saved session, otherwise sign in (or continue as a guest).
  ld.text('Opening the book of names');
  if (await resumeSession()) return toMenu();
  if (localStorage.getItem('tlr-guest') === '1') { playAsGuest(); return toMenu(); }
  authScreen({ onDone: () => { if (account.mode === 'guest') localStorage.setItem('tlr-guest', '1'); else localStorage.removeItem('tlr-guest'); toMenu(); } });
})();
