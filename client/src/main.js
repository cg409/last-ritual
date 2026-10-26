// App flow: menu → (singleplayer lobby | multiplayer lobby) → loading (monster reveal) → match → end.
import './style.css';
import './screens.css';
import './hud.css';
import { Stage } from './render/stage.js';
import { loadCharacterAssets, assetsReady, Character } from './render/characters.js';
import { MenuScene } from './render/menuScene.js';
import { Input } from './input.js';
import { initAudio, startAmbience, stopAmbience } from './audio.js';
import { mainMenu, loadingScreen, monsterReveal, howTo } from './ui/menu.js';
import { lobbyScreen } from './ui/lobby.js';
import { endScreen } from './ui/end.js';
import { Preview } from './ui/preview.js';
import { LocalSession } from './session.js';
import { Match } from './match.js';
import { setupMultiplayer } from './multiplayer.js';
import { SKINS, MONSTER_IDS, BOT_NAMES, MAX_PLAYERS, TRAPS } from '@shared/constants.js';
import { settingsPanel } from './ui/settingsMenu.js';
import { show } from './ui/dom.js';
import { loadModels, ALL_MODELS, setAnisotropy, getModel } from './render/assets.js';
import { loadCrowAssets } from './render/crow.js';
import { graphics } from './settings.js';

const stage = new Stage(document.getElementById('game'));
const input = new Input(stage.renderer.domElement);
const preview = new Preview();
const app = {
  name: localStorage.getItem('hv-name') || 'Survivor',
  prefs: JSON.parse(localStorage.getItem('hv-prefs') || '{}'),
  match: null, menuScene: null, net: null, lobby: null, chat: [], loading: false,
};
const savePrefs = () => localStorage.setItem('hv-prefs', JSON.stringify(app.prefs));

let last = performance.now();
function loop() {
  const t = performance.now(), dt = Math.min(0.1, (t - last) / 1000); last = t;
  if (app.match) app.match.frame(dt); else app.menuScene?.update(dt);
  stage.render();
  requestAnimationFrame(loop);
}

function toMenu() {
  app.match?.dispose(); app.match = null;
  if (app.net && app.lobby) app.net.emit('lobby:leave');
  app.lobby = null;
  app.menuScene?.show(true);
  startAmbience(0.6);
  mainMenu({
    name: app.name,
    onName: (v) => { app.name = v.slice(0, 16); localStorage.setItem('hv-name', app.name); },
    onSingle: singleLobby, onMulti: () => mp.multiEntry(), onHow: () => howTo(toMenu),
    onSettings: () => { const ui = show('<div class="screen" id="setwrap"></div>'); settingsPanel(ui.querySelector('#setwrap'), toMenu); },
  });
}

// Singleplayer: you + 4 bots that play by the same rules.
function singleLobby() {
  const me = { id: 'you', name: app.name || 'Survivor', skin: app.prefs.skin || SKINS[0].id, monsterPref: app.prefs.monsterPref || MONSTER_IDS[0], trap: app.prefs.trap || 'bear', ready: true };
  const bots = BOT_NAMES.slice(0, MAX_PLAYERS - 1).map((n, i) => ({
    id: `bot${i}`, name: `${n} [BOT]`, isBot: true, ready: true,
    monsterPref: MONSTER_IDS[(i + 1) % MONSTER_IDS.length], trap: Object.keys(TRAPS)[i % 3],
  }));
  const render = () => {
    const canvas = lobbyScreen({
      mode: 'single', members: [me, ...bots], myId: 'you', hostId: 'you',
      onUpdate: (u) => { Object.assign(me, u); Object.assign(app.prefs, u); savePrefs(); render(); },
      onLeave: toMenu,
      onStart: () => startMatch(new LocalSession([me, ...bots], 'you'), 'you', singleLobby),
    });
    preview.attach(canvas, me.skin, me.monsterPref);
  };
  render();
}

async function startMatch(session, myId, back) {
  initAudio(); stopAmbience();
  app.loading = true;
  const ld = loadingScreen('Summoning the realm');
  if (!assetsReady()) await loadCharacterAssets((k) => ld.progress(k * 0.5));
  ld.progress(0.6);
  await new Promise((r) => setTimeout(r, 50));
  app.menuScene?.show(false);
  const match = new Match({ stage, input, session, myId, onEnd: (result) => {
    app.match = null;
    app.menuScene?.show(true); startAmbience(0.6);
    endScreen(result, myId, { onAgain: back, onMenu: toMenu, againLabel: session instanceof LocalSession ? 'Play again' : 'Back to lobby' });
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

const mp = setupMultiplayer(app, { toMenu, startMatch, preview, savePrefs });

window.addEventListener('pointerdown', () => { initAudio(); if (!app.match) startAmbience(0.6); }, { once: true });
(async () => {
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
  if (new URLSearchParams(location.search).has('debug')) window.__hv = { Character, stage, getModel };
  app.menuScene = new MenuScene(stage);
  requestAnimationFrame(loop);
  toMenu();
})();
