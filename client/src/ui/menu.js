// Main menu, loading screen, how-to-play and settings.
import { GAME_NAME, MONSTERS } from '@shared/constants.js';
import { show, on, q, esc } from './dom.js';
import { sfx } from '../audio.js';
import { gameTitle } from '../title.js';

export function mainMenu({ onSingle, onMulti, onHow, onSettings, onProfile, onLoadout, onFriends, onLeaderboard, requests = 0, name, onName, locked = false, profile = null }) {
  const words = gameTitle().split(' '), last = words.pop();
  const items = [['sp', 'Singleplayer', 'You and four souls bound by the curse'], ['mp', 'Multiplayer', 'Gather with the living — or hunt them'],
    ['lo', 'Loadout', 'Character · monster · perks · traps'],
    ['how', 'The Rites', 'How the ritual is performed'], ['set', 'Settings', 'Video · audio · controls']];
  // social corner (bottom right)
  const side = [['fr', 'Friends', '☩'], ['prof', 'Profile', '✠'], ['lbd', 'Leaderboard', '♛']];
  show(`
    <div class="screen menuv2">
      <div class="mm-fade"></div>
      <div class="mm-left">
        <div class="mm-title"><span class="mm-pre">${esc(words.join(' '))}</span><span class="mm-main">${esc(last)}</span></div>
        <div class="mm-orn"><i></i><b>✠</b><i></i></div>
        <div class="mm-tag">Five souls. Three tombs. One of you is already damned.</div>
        <nav class="mm-nav">${items.map(([id, label, hint], i) => `
          <button class="mm-item" id="${id}"><span class="mm-n">${['I', 'II', 'III', 'IV', 'V'][i]}</span><span class="mm-l">${label}</span><span class="mm-h">${hint}</span></button>`).join('')}
        </nav>
        <label class="mm-name"><span>${locked ? 'Signed in as' : 'Sign your name'}</span><input class="field" id="nm" maxlength="16" placeholder="Survivor" value="${esc(name)}" ${locked ? 'readonly' : ''} /></label>
      </div>
      ${profile ? `<button class="mm-badge" id="mm-badge" title="Open your profile"><div class="bl"><span>LEVEL</span><b>${profile.level}</b></div>
        <div class="bc"><div>${esc(name)}</div><small>${profile.account ? 'Account' : 'Guest'}</small><small>◉ ${profile.coins} · ◆ ${profile.shards}</small></div></button>` : ''}
      <nav class="mm-side">${side.map(([id, label, ic]) => `<button class="mm-sbtn" id="${id}"><b>${ic}</b><span class="mm-l">${label}${id === 'fr' && requests ? `<i class="mm-badge-n">${requests}</i>` : ''}</span></button>`).join('')}</nav>
      <div class="mm-foot"><span>WASD · SHIFT · E · SPACE</span><span>Headphones recommended</span><span>v1.0</span></div>
    </div>`);
  q('#nm').addEventListener('input', (e) => onName(e.target.value));
  document.querySelectorAll('.mm-item, .mm-sbtn').forEach((b) => { b.addEventListener('mouseenter', () => sfx.hover()); b.addEventListener('click', () => sfx.click()); });
  on('#sp', 'click', onSingle); on('#mp', 'click', onMulti); on('#how', 'click', onHow); on('#set', 'click', onSettings);
  on('#prof', 'click', onProfile); on('#mm-badge', 'click', onProfile); on('#lo', 'click', onLoadout); on('#fr', 'click', onFriends); on('#lbd', 'click', onLeaderboard);
}

const TIPS = [
  'The Mimic casts no shadow. Look down before you trust a friend.',
  'Crows remember every face. Crouch when you pass the bollards.',
  'When the chainsaw roars, the whole realm hears it — listen for where.',
  'In the Puppeteer\'s darkness, stillness is the only light.',
  'If your shadow flickers, run. The Stalker is already beside you.',
  'Cupboards and porta-potties hide you — but the monster may open the door.',
  'Miss a skill check and the tomb cracks. The Wanderer will know.',
  'You may hang once. The second time, there is no rope.',
];

export function loadingScreen(text = 'Summoning the realm') {
  show(`
    <div class="screen loading">
      <div class="sigil"></div>
      <div class="reveal" id="ld-text">${esc(text)}</div>
      <div class="bar"><div id="ld-bar" style="width:5%"></div></div>
      <div class="tip">"${TIPS[(Math.random() * TIPS.length) | 0]}"</div>
    </div>`);
  return {
    progress: (k) => { const b = q('#ld-bar'); if (b) b.style.width = `${Math.round(5 + k * 95)}%`; },
    text: (t) => { const el = q('#ld-text'); if (el) el.innerHTML = t; },
  };
}

// Reveal who became the monster — shown to everyone during loading.
export function monsterReveal(ld, monsterName, monsterId, isMe) {
  const m = MONSTERS[monsterId];
  ld.text(isMe
    ? `THE CURSE HAS CHOSEN YOU<b>${esc(m.name)}</b>`
    : `<span style="opacity:.7">The cursed one is</span><b>${esc(monsterName)}</b><span style="font-size:16px;opacity:.7">— ${esc(m.name)} —</span>`);
}

export function howTo(onBack) {
  show(`
    <div class="screen"><div class="panel scroll" style="width:min(820px,94vw)">
      <div class="h2">The Rites</div>
      <div class="lore">
        Five souls wake in the Hollow. One of them is cursed and becomes the <i>monster</i> — chosen at random, and named to all.
        <b>Survivors</b>Enchant the <i>three tombs</i> scattered across the realm (hold <span class="key">E</span>). Rites take time.
        A ring will appear: press <span class="key">SPACE</span> when the needle crosses the marked zone. Miss, and part of the tomb breaks.
        <b>Each enchantment weakens the monster</b>1st: its special ability is sealed. 2nd: it slows and its reach shortens.
        3rd: three keys surface across the realm. Carry them to the iron gate (hold <span class="key">E</span>) and escape.
        <b>Two lives</b>When downed the first time, the monster cannot kill you — it carries you to the gallows. Allies can cut you down (hold <span class="key">E</span>).
        On your second life it can kill you outright. The dead return as <i>mice</i>: they cannot interact, only watch.
        <b>Self-heal</b>Injured? Hold <span class="key">H</span> and stand still for 15s to mend yourself — only twice per match. A heartbeat warns you the monster is near; its red light shows where it looks.
        <b>Flashlight</b><span class="key">F</span> switch your electric flashlight on / off. It runs on batteries — find more in chests. Its beam helps you spot traps — but it also gives you away in the dark.
        <b>Hiding</b>Hold <span class="key">E</span> at a cupboard (indoors) or a porta-potty (outdoors) to climb in; press <span class="key">E</span> again to leave. The monster can't see you inside — unless it searches the right door.
        <b>Quick messages</b>Hold <span class="key">Q</span>, move the mouse to a message and release: run, come here, heal me, help me, the monster is here. Once every 20 seconds.
        <b>Chests</b>Supply, Ritual and Cursed chests hide in quiet corners — they don't glow, look carefully. Hold <span class="key">E</span> to open: bandages, flashlight batteries, enchanted strings (<span class="key">2</span>, shows every tomb for 30s), The Eye (<span class="key">3</span>, shows the monster), ritual coins and soul shards. Opening a Ritual or Cursed chest betrays you to the monster.
        <b>Escape</b>Drop pallets and push logs down (<span class="key">E</span>), vault broken windows (<span class="key">SPACE</span>) — the monster can't follow through a window. When someone begins a rite, the others see them for 20s and the tomb is marked on the map.
        <b>Traps</b>Foothold (pass 2 skill checks to break free, then you can't run for a while), Poison (your sight swims), Cursed (blinding fog) and Floor spikes (wounded, slowed). Only the monster sets them — it carries 2 of its chosen kind. A caught survivor glows for the monster.
        <b>Perks & loadout</b>Open the ghost-face Loadout in the lobby to pick your survivor, monster, perks and trap. Unlock with soul shards, upgrade with ritual coins. Matches give XP up to level 100.
        <b>Chat</b>Press <span class="key">ENTER</span> during a match.
        <b>Hiding</b><span class="key">C</span> crouch · <span class="key">X</span> crawl. Crouch in tall grass to vanish. Running makes noise.
        <b>Monster</b><span class="key">LMB</span> attack · <span class="key">Q</span> special · <span class="key">RMB</span> aim (Stalker / Puppeteer) · <span class="key">R</span> chainsaw (Ravager) · <span class="key">T</span> set trap · hold <span class="key">E</span> pick up / hang / damage tombs · <span class="key">Z</span> drop.
        Not every monster can simply run you down. Be patient. Be cruel.
      </div>
      <div style="text-align:center;margin-top:18px"><button class="btn small" id="back">Back</button></div>
    </div></div>`);
  on('#back', 'click', onBack);
}
