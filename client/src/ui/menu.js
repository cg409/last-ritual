// Main menu, loading screen, how-to-play and settings.
import { GAME_NAME, MONSTERS } from '@shared/constants.js';
import { show, on, q, esc } from './dom.js';

export function mainMenu({ onSingle, onMulti, onHow, onSettings, name, onName }) {
  show(`
    <div class="screen">
      <div class="title">${GAME_NAME}</div>
      <div class="subtitle">ONE OF YOU IS ALREADY DEAD</div>
      <div class="menu">
        <button class="btn" id="sp">Singleplayer</button>
        <button class="btn" id="mp">Multiplayer</button>
        <button class="btn" id="how">The Rites</button>
        <button class="btn" id="set">Settings</button>
      </div>
      <div style="margin-top:36px;width:280px" class="col">
        <input class="field" id="nm" maxlength="16" placeholder="Your name" value="${esc(name)}" />
      </div>
      <div class="foot">WASD · SHIFT · E · SPACE &nbsp;—&nbsp; headphones recommended</div>
    </div>`);
  q('#nm').addEventListener('input', (e) => onName(e.target.value));
  on('#sp', 'click', onSingle); on('#mp', 'click', onMulti); on('#how', 'click', onHow); on('#set', 'click', onSettings);
}

const TIPS = [
  'The Mimic casts no shadow. Look down before you trust a friend.',
  'Crows remember every face. Crouch when you pass the bollards.',
  'When the chainsaw roars, the whole realm hears it — listen for where.',
  'In the Puppeteer\'s darkness, stillness is the only light.',
  'If your shadow flickers, run. The Stalker is already beside you.',
  'A candle beside an enchanted tomb keeps the Mimic\'s hands off it.',
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
        <b>Candles</b><span class="key">F</span> hold a candle · <span class="key">G</span> place / pick up · <span class="key">V</span> light / snuff. Limited, but they burn long.
        <b>Hiding</b><span class="key">C</span> crouch · <span class="key">X</span> crawl. Crouch in tall grass to vanish. Running makes noise.
        <b>Monster</b><span class="key">LMB</span> attack · <span class="key">Q</span> special · <span class="key">RMB</span> aim (Stalker / Puppeteer) · <span class="key">R</span> chainsaw (Ravager) · <span class="key">T</span> set trap · hold <span class="key">E</span> pick up / hang / damage tombs · <span class="key">Z</span> drop.
        Not every monster can simply run you down. Be patient. Be cruel.
      </div>
      <div style="text-align:center;margin-top:18px"><button class="btn small" id="back">Back</button></div>
    </div></div>`);
  on('#back', 'click', onBack);
}
