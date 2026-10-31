// In-game HUD (DOM). Updated ~10x per second; the skill-check ring is drawn by skillcheck.js.
import { MONSTERS, SKINS, PERKS, FLASHLIGHT } from '@shared/constants.js';
import { show, q, esc, hex } from './dom.js';
import { prompts } from './prompts.js';
import { abilitiesHtml } from './abilities.js';
import { settings } from '../settings.js';
import { isTouch } from '../touch.js';

// Survivor inventory: flashlight charge, bandages, string, eye, coins & shards, perks, conditions.
function invHtml(me) {
  const lightPct = me.unlimited ? 100 : Math.round((me.light / FLASHLIGHT.full) * 100);
  const cond = [me.trapped ? `<span class="bad">CAUGHT IN A TRAP — pass skill checks (${me.trapped.passed}/2)</span>` : '',
    me.noRun ? '<span class="bad">Leg wounded — cannot run</span>' : '', me.poison > 0 ? '<span class="bad">Poisoned</span>' : '',
    me.cursed > 0 ? '<span class="bad">Cursed — blinded by fog</span>' : '', me.slow ? '<span class="bad">Slowed</span>' : '',
    me.adrenaline ? '<span class="good">Adrenaline!</span>' : '', me.eye ? '<span class="good">The Eye is open</span>' : '',
    me.tombSight ? '<span class="good">The string shows the tombs</span>' : ''].filter(Boolean).join('');
  const perks = Object.entries(me.perks || {}).map(([id, lv]) => `<span class="perk" title="${esc(PERKS[id].name)} (Lv ${lv})">${PERKS[id].icon}<i>${lv}</i></span>`).join('');
  return `${cond ? `<div class="conds">${cond}</div>` : ''}
    <div class="slots">
      <div class="it ${me.lightOn ? 'on' : ''}" title="Flashlight (F)"><b>F</b>🔦<span>${me.unlimited ? '∞' : lightPct + '%'}</span><small>+${me.inv.battery}</small></div>
      <div class="it" title="Healing bandages (hold H)"><b>H</b>✚<span>${me.inv.bandage}/${me.bandageCap}</span></div>
      <div class="it ${me.inv.string ? '' : 'off'}" title="Enchanted string (2): reveals all tombs for 30s"><b>2</b>➰<span>${me.inv.string}</span></div>
      <div class="it ${me.inv.eye ? '' : 'off'}" title="The Eye (3): reveals the monster for 12s"><b>3</b>👁<span>${me.inv.eye}</span></div>
      <div class="cur"><span title="Ritual coins">◉ ${me.coins}</span><span title="Soul shards">◆ ${me.shards}</span></div>
      ${perks ? `<div class="perks">${perks}</div>` : ''}
    </div>`;
}

// Ravager direction marker: a glowing arc on a ring around the screen centre with a jagged
// saw-tooth blade pointing toward the chainsaw.
const SAW_SVG = `<svg viewBox="-170 -170 340 340" width="340" height="340">
  <defs><linearGradient id="sawg" x1="0" x2="1"><stop offset="0" stop-color="#ff3b1f" stop-opacity="0"/><stop offset=".5" stop-color="#ff3b1f"/><stop offset="1" stop-color="#ff3b1f" stop-opacity="0"/></linearGradient>
  <filter id="sawglow"><feGaussianBlur stdDeviation="3"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <g filter="url(#sawglow)">
    <path d="M -64 -136 A 150 150 0 0 1 64 -136" fill="none" stroke="url(#sawg)" stroke-width="5" stroke-linecap="round"/>
    <path d="M -22 -146 l 6 -10 l 6 8 l 5 -12 l 5 12 l 5 -8 l 6 10 l -11 -2 l -11 -26 l -11 26 z" fill="#ff4a2a"/>
    <path d="M -10 -128 L 0 -118 L 10 -128" fill="none" stroke="#ffb090" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>
  </g></svg>`;

const STATE_ICON = { alive: '♥', downed: '✚', hooked: '☠', carried: '⛓', mouse: '·', escaped: '✓' };

export class Hud {
  constructor() {
    show(`<div class="hud">
      <div class="tl"><div class="monstername" id="h-mon"></div><div class="tombs" id="h-tombs"></div><div class="keys" id="h-keys"></div></div>
      <div class="tr" id="h-surv"></div>
      <div class="feed" id="h-feed"></div>
      <div class="banner" id="h-banner"></div>
      <div class="center" id="h-center"></div>
      <canvas class="skill" id="h-skill" width="300" height="300"></canvas>
      <div class="sawdir" id="h-saw" style="opacity:0">${SAW_SVG}</div>
      <div class="br" id="h-ab"></div>
      <div class="bl" id="h-me"></div>
      <div class="spect" id="h-spect"></div>
      <div class="help" id="h-help"></div>
      <div class="bloodfx" id="h-blood"></div>
      <div class="heartfx" id="h-heart"></div>
      <div class="aimdot" id="h-aim"></div>
      <div class="hidefx" id="h-hidefx"></div>
      <div class="flash" id="h-flash"></div>
      <div class="fps" id="h-fps"></div>
      <div class="chatbox" id="h-chat"><div class="lines" id="h-chatlines"></div></div>
      <div class="inv" id="h-inv"></div>
    </div>`);
    this.chat = [];
    this.fpsAcc = 0; this.fpsN = 0;
    this.el = (id) => q('#h-' + id);
    // Only touch the DOM when the content actually changed (rewriting identical HTML every tick
    // makes text shimmer and restarts CSS animations).
    this.cache = {};
    this.set = (id, html) => {
      if (this.cache[id] === html) return;
      const e = this.el(id); if (!e) return;
      this.cache[id] = html; e.innerHTML = html;
    };
    this.bannerT = null; this.feed = [];
  }

  fps(dt) {
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc < 0.5) return;
    const el = this.el('fps');
    if (el) el.textContent = settings().video.showFps ? `${Math.round(this.fpsN / this.fpsAcc)} FPS` : '';
    this.fpsAcc = 0; this.fpsN = 0;
  }

  banner(text, ms = 3500, color = '#e8ddd0') {
    const b = this.el('banner'); if (!b) return;
    b.style.color = color; b.innerHTML = text; b.style.opacity = 1;
    clearTimeout(this.bannerT); this.bannerT = setTimeout(() => (b.style.opacity = 0), ms);
  }
  feedMsg(text, color = '#cfc4b3') {
    this.feed.push({ text, color, t: performance.now() });
    if (this.feed.length > 6) this.feed.shift();
  }
  // In-match chat: last lines fade out; Enter opens the input.
  chatLine(name, text, sys = false, bot = false) {
    this.chat.push({ name, text, sys, bot, t: performance.now() });
    if (this.chat.length > 8) this.chat.shift();
    this.renderChat();
  }
  renderChat() {
    const el = this.el('chatlines'); if (!el) return;
    const now = performance.now(), open = !!this.el('chatin');
    this.set('chatlines', this.chat.filter((c) => open || now - c.t < 12000).map((c) => c.sys ? `<div class="sys">${esc(c.text)}</div>`
      : `<div><b style="color:${c.bot ? '#8a9aaa' : '#b08d57'}">${esc(c.name)}:</b> ${esc(c.text)}</div>`).join(''));
  }
  openChat(send) {
    const box = this.el('chat'); if (!box || this.el('chatin')) return;
    const inp = document.createElement('input');
    inp.id = 'h-chatin'; inp.className = 'field'; inp.maxLength = 140; inp.placeholder = 'Say something… (Enter to send, Esc to cancel)';
    box.appendChild(inp); inp.focus();
    const close = () => { inp.remove(); this.renderChat(); };
    inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { const t = inp.value.trim(); if (t) send(t); close(); }
      else if (e.key === 'Escape') close();
    });
    inp.addEventListener('blur', () => setTimeout(close, 100));
    this.renderChat();
  }

  flash() {
    const f = this.el('flash'); if (!f) return;
    f.style.transition = 'none'; f.style.opacity = 0.55;
    requestAnimationFrame(() => { f.style.transition = 'opacity .7s'; f.style.opacity = 0; });
  }

  update(s, me, view, camYaw) {
    if (!s || !me) return;
    const mon = s.players.find((p) => p.role === 'monster');
    const M = MONSTERS[mon.monster];
    this.set('mon', me.role === 'monster' ? `YOU ARE ${M.name}` : `THE CURSED: ${esc(mon.name)} — ${M.name}`);
    this.set('tombs', s.tombs.map((t) => `<div class="tomb ${t.done ? 'done' : ''}"><div style="height:${Math.round((t.done ? 1 : t.progress) * 100)}%"></div></div>`).join(''));
    const keysLeft = s.keys.filter((k) => !k.taken).length;
    this.set('keys', s.phase >= 3
      ? (s.door.open ? 'THE GATE IS OPEN — ESCAPE' : `KEYS AT GATE ${s.door.keys}/3 · ${keysLeft} in the realm`)
      : `${3 - s.tombs.filter((t) => t.done).length} TOMBS REMAIN`);
    this.set('surv', s.players.filter((p) => p.role === 'survivor').map((p) => {
      const cls = p.state === 'alive' && p.health === 1 ? 'hurt' : p.state;
      const skin = SKINS.find((k) => k.id === p.skin);
      const border = p.state === 'alive' && p.health === 2 && skin ? hex(skin.cloth) : '';
      return `<div class="surv ${cls}" style="justify-content:flex-end">${esc(p.name)}${p.lives < 2 && p.state !== 'mouse' ? ' <span style="color:#c21d1d">✦</span>' : ''}
        <div class="ic" style="border-color:${border}"><span>${STATE_ICON[p.state] || ''}</span></div></div>`;
    }).join(''));
    const now = performance.now();
    this.set('feed', this.feed.filter((f) => now - f.t < 7000).map((f) => `<div style="color:${f.color}">${f.text}</div>`).join(''));
    const pr = prompts(s, me, view);
    this.set('center', (pr.text ? `<div class="hint">${pr.text}</div>` : '') + (pr.prog != null ? `<div class="prog"><div style="width:${Math.round(pr.prog * 100)}%"></div></div>` : ''));
    this.set('me', me.role === 'survivor' && !['mouse', 'escaped'].includes(me.state)
      ? `${me.keys ? `<div class="hint"><span style="color:#d4a840">🗝 Keys ×${me.keys}</span></div>` : ''}
         <div class="hint">${me.lives === 2 ? 'Two lives remain' : '<span style="color:#c21d1d">Last life — the next fall is death</span>'} · <span style="color:${me.heals ? '#8fc46a' : '#6a5a50'}">✚ Self-heals ×${me.heals ?? 0}</span></div>` : '');
    this.set('ab', me.role === 'monster' ? abilitiesHtml(s, me) : '');
    const hf = this.el('hidefx'); if (hf) hf.style.opacity = me.hideIn != null ? 1 : 0; // looking out through the slats
    // aiming dot for the ranged monsters (puppet strings / trident); it flares while aiming
    const aim = this.el('aim');
    if (aim) aim.className = me.role === 'monster' && (me.monster === 'puppeteer' || me.monster === 'stalker') && me.state !== 'mouse'
      ? `aimdot on ${me.aiming ? 'aiming' : ''}` : 'aimdot';
    this.set('spect', me.state === 'mouse' ? 'YOU ARE A MOUSE · <span class="key">SHIFT</span> scurry · <span class="key">SPACE</span> leap · <span class="key">TAB</span> spectate survivors · <span class="key">LMB</span> next'
      : me.state === 'escaped' ? 'YOU ESCAPED · <span class="key">LMB</span> next survivor' : '');
    this.set('help', isTouch ? '' : me.role === 'monster'
      ? 'SHIFT run · LMB lunge attack · Q special · RMB aim · LMB shoot · T trap · hold E pick up / hang / damage · Z drop' + (mon.weapon === 'chainsaw' ? ' · R rev the chainsaw' : '') + ' · ENTER chat'
      : 'SHIFT run · SPACE jump / vault windows · C crouch · X crawl · hold E interact / open chests · hold H heal · F flashlight · 2 string · 3 eye · Q quick message · ENTER chat');
    this.set('inv', me.role === 'survivor' && me.inv && !['mouse', 'escaped'].includes(me.state) ? invHtml(me) : '');
    this.renderChat();
    const blood = this.el('blood');
    if (blood) blood.style.opacity = me.state === 'downed' || me.state === 'hooked' ? 0.9 : me.health === 1 && me.role === 'survivor' ? 0.45 : 0;
    const saw = this.el('saw'); // faint on-screen chainsaw direction
    if (saw && me.role === 'survivor') {
      if (mon.saw || mon.rev) {
        const a = Math.atan2(mon.x - me.x, mon.z - me.z) - camYaw;
        const d = Math.hypot(mon.x - me.x, mon.z - me.z);
        saw.style.opacity = 0.5 + 0.5 * Math.max(0, 1 - d / 70); saw.style.transform = `rotate(${-a}rad)`;
      } else saw.style.opacity = 0;
    }
  }
}
