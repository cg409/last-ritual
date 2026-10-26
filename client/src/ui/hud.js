// In-game HUD (DOM). Updated ~10x per second; the skill-check ring is drawn by skillcheck.js.
import { MONSTERS, SKINS } from '@shared/constants.js';
import { show, q, esc, hex } from './dom.js';
import { prompts } from './prompts.js';
import { abilitiesHtml } from './abilities.js';

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
      <div class="sawdir" id="h-saw" style="opacity:0"><div></div></div>
      <div class="br" id="h-ab"></div>
      <div class="bl" id="h-me"></div>
      <div class="spect" id="h-spect"></div>
      <div class="help" id="h-help"></div>
      <div class="bloodfx" id="h-blood"></div>
      <div class="flash" id="h-flash"></div>
    </div>`);
    this.el = (id) => q('#h-' + id);
    this.bannerT = null; this.feed = [];
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
  flash() {
    const f = this.el('flash'); if (!f) return;
    f.style.transition = 'none'; f.style.opacity = 0.55;
    requestAnimationFrame(() => { f.style.transition = 'opacity .7s'; f.style.opacity = 0; });
  }

  update(s, me, view, camYaw) {
    if (!s || !me) return;
    const mon = s.players.find((p) => p.role === 'monster');
    const M = MONSTERS[mon.monster];
    this.el('mon').innerHTML = me.role === 'monster' ? `YOU ARE ${M.name}` : `THE CURSED: ${esc(mon.name)} — ${M.name}`;
    this.el('tombs').innerHTML = s.tombs.map((t) => `<div class="tomb ${t.done ? 'done' : ''}"><div style="height:${Math.round((t.done ? 1 : t.progress) * 100)}%"></div></div>`).join('');
    const keysLeft = s.keys.filter((k) => !k.taken).length;
    this.el('keys').innerHTML = s.phase >= 3
      ? (s.door.open ? 'THE GATE IS OPEN — ESCAPE' : `KEYS AT GATE ${s.door.keys}/3 · ${keysLeft} in the realm`)
      : `${3 - s.tombs.filter((t) => t.done).length} TOMBS REMAIN`;
    this.el('surv').innerHTML = s.players.filter((p) => p.role === 'survivor').map((p) => {
      const cls = p.state === 'alive' && p.health === 1 ? 'hurt' : p.state;
      const skin = SKINS.find((k) => k.id === p.skin);
      const border = p.state === 'alive' && p.health === 2 && skin ? hex(skin.accent) : '';
      return `<div class="surv ${cls}" style="justify-content:flex-end">${esc(p.name)}${p.lives < 2 && p.state !== 'mouse' ? ' <span style="color:#c21d1d">✦</span>' : ''}
        <div class="ic" style="border-color:${border}"><span>${STATE_ICON[p.state] || ''}</span></div></div>`;
    }).join('');
    const now = performance.now();
    this.el('feed').innerHTML = this.feed.filter((f) => now - f.t < 7000).map((f) => `<div style="color:${f.color}">${f.text}</div>`).join('');
    const pr = prompts(s, me, view);
    this.el('center').innerHTML = (pr.text ? `<div class="hint">${pr.text}</div>` : '') + (pr.prog != null ? `<div class="prog"><div style="width:${Math.round(pr.prog * 100)}%"></div></div>` : '');
    this.el('me').innerHTML = me.role === 'survivor' && !['mouse', 'escaped'].includes(me.state)
      ? `<div class="hint">Candles: ${me.candles.map((c, i) => `<span style="color:${i === 0 && me.holding ? '#ffd080' : '#a08060'}">🕯${Math.round(c)}s</span>`).join(' ') || '<i>none</i>'}${me.keys ? ` · <span style="color:#d4a840">🗝 ×${me.keys}</span>` : ''}</div>
         <div class="hint">${me.lives === 2 ? 'Two lives remain' : '<span style="color:#c21d1d">Last life — the next fall is death</span>'}</div>` : '';
    this.el('ab').innerHTML = me.role === 'monster' ? abilitiesHtml(s, me) : '';
    this.el('spect').innerHTML = me.state === 'mouse' ? 'YOU ARE A MOUSE · <span class="key">TAB</span> spectate / roam · <span class="key">LMB</span> next'
      : me.state === 'escaped' ? 'YOU ESCAPED · <span class="key">LMB</span> next survivor' : '';
    this.el('help').innerHTML = me.role === 'monster'
      ? 'LMB attack · Q special · RMB aim · T trap · hold E pick up / hang / damage · Z drop' + (mon.monster === 'ravager' ? ' · R chainsaw' : '')
      : 'SHIFT run · C crouch · X crawl · hold E interact · SPACE skill check · F candle · G place · V light';
    const blood = this.el('blood');
    if (blood) blood.style.opacity = me.state === 'downed' || me.state === 'hooked' ? 0.9 : me.health === 1 && me.role === 'survivor' ? 0.45 : 0;
    const saw = this.el('saw'); // faint on-screen chainsaw direction
    if (saw && me.role === 'survivor') {
      if (mon.saw || mon.rev) {
        const a = Math.atan2(mon.x - me.x, mon.z - me.z) - camYaw;
        saw.style.opacity = 0.75; saw.style.transform = `rotate(${-a}rad)`;
      } else saw.style.opacity = 0;
    }
  }
}
