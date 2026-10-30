// Lobby: the participants panel on the left (seats, chat, Begin / Ready / Leave), the five players
// standing in the 3D ritual circle behind it with name plates (render/lobbyScene.js), and
// "Change character" / "Change monster" drawers on the right. Mounted once and patched on every
// update, so chat typing and open drawers survive lobby changes.
import { SKINS, skinLabel, MONSTERS, MONSTER_IDS, TRAPS, TRAP_IDS, PERKS, PERK_IDS, MAX_PERKS, MAX_PLAYERS, GAME_NAME, UNLOCK_COST, UPGRADE_COST } from '@shared/constants.js';
import { show, on, q, esc, hex } from './dom.js';
import { sfx } from '../audio.js';
import { gameTitle } from '../title.js';
import { account, isUnlocked, levelOf, unlock, upgrade, togglePerk, saveProfile, loadoutPrefs } from '../profile.js';

// The "ghost face" loadout button icon.
const GHOST_SVG = `<svg viewBox="0 0 64 64" width="38" height="38" aria-hidden="true"><path d="M32 4C18 4 10 15 10 29v27l6-5 5 6 5-6 6 6 6-6 5 6 5-6 6 5V29C54 15 46 4 32 4z" fill="#d9cfbf" opacity=".92"/>
  <ellipse cx="23" cy="28" rx="5" ry="8" fill="#0b0707"/><ellipse cx="41" cy="28" rx="5" ry="8" fill="#0b0707"/><path d="M26 44c2-4 10-4 12 0-2 3-10 3-12 0z" fill="#0b0707"/></svg>`;

const skinById = Object.fromEntries(SKINS.map((s) => [s.id, s]));

// The showroom panel for the character you are looking at.
function showroomDetail(s, own, chosen, taken, shards) {
  if (!s) return '';
  const cost = UNLOCK_COST.skin;
  return `<div class="sh-name">${esc(s.name)}</div>
    <div class="sh-sub">${s.exclusive ? '<span class="sh-ex">EXCLUSIVE</span>' : `<span class="sh-dot" style="background:${hex(s.cloth)}"></span>${esc(s.variant)} jacket`}</div>
    <div class="sh-act">${chosen ? '<span class="sh-ok">✓ Your character</span>' : taken ? '<span class="sh-no">Worn by another player</span>'
      : own ? '<span class="sh-hint">Click to choose</span>'
      : `<button class="dr-buy ${shards < cost ? 'poor' : ''}" data-unlock="skins:${s.id}" ${shards < cost ? 'disabled' : ''}>Unlock ◆ ${cost}</button>${shards < cost ? `<span class="sh-no">You have ◆ ${shards}</span>` : ''}`}</div>`;
}

// Same rule the match uses (shared/game.js): in seat order, a missing or already-taken skin
// becomes the first free one — so the lobby shows exactly who will wear what.
export function resolveSkins(members) {
  const used = new Set();
  return members.map((m) => {
    let skin = m.skin;
    if (!skin || used.has(skin) || !skinById[skin]) skin = SKINS.find((s) => !used.has(s.id)).id;
    used.add(skin);
    return skin;
  });
}

export class LobbyUI {
  // opts: { mode: 'single'|'multi', scene, onUpdate, onReady, onStart, onLeave, onChat }
  constructor(opts) { this.o = opts; this.drawer = null; this.el = null; this.chatN = -1; this.state = null; }

  mount() {
    const ui = show(`
      <div class="screen lobbyv2">
        <div class="lb-plates" id="lb-plates"></div>
        <aside class="lb-side">
          <div class="lb-brand">${esc(gameTitle())}</div>
          <div class="lb-head"><div class="lb-title" id="lb-title"></div><div class="lb-code" id="lb-code"></div></div>
          <div class="lb-sub">One soul is cursed when the ritual begins. Real players are three times more likely to be chosen than bots.</div>
          <div class="lb-seats" id="lb-seats"></div>
          <div class="lb-chat">
            <div class="lb-log" id="lb-log"></div>
            <input class="field" id="lb-in" maxlength="140" placeholder="Speak to the others…" autocomplete="off" />
          </div>
          <div class="lb-actions" id="lb-actions"></div>
        </aside>
        <div class="lb-tools">
          <button class="lb-ghost" id="lb-ghost" title="Loadout: character, monster, perks, traps">${GHOST_SVG}<span>Loadout</span></button>
        </div>
        <aside class="lb-drawer" id="lb-drawer"></aside>
      </div>`);
    this.el = ui.querySelector('.lobbyv2');
    on('#lb-ghost', 'click', () => { sfx.click(); this.toggle(this.drawer ? this.drawer : this.lastTab || 'char'); });
    const inp = q('#lb-in');
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && inp.value.trim()) { this.o.onChat(inp.value.trim().slice(0, 140)); inp.value = ''; }
      e.stopPropagation();
    });
    this.chatN = -1;
    this.frame = () => {
      if (!this.el?.isConnected) { this.frame = null; return; }
      this.placePlates();
      requestAnimationFrame(this.frame);
    };
    requestAnimationFrame(this.frame);
  }

  toggle(which) {
    this.drawer = this.drawer === which ? null : which;
    if (this.drawer) this.lastTab = this.drawer;
    this.render(this.state);
  }
  tab(which) { this.drawer = which; this.lastTab = which; this.render(this.state); }

  // state: { code, title, members, myId, hostId, chat }
  render(state) {
    if (!state) return;
    this.state = state;
    if (!this.el?.isConnected) this.mount();
    const { members, myId, hostId } = state;
    const me = members.find((m) => m.id === myId) || {};
    const isHost = hostId === myId, multi = this.o.mode === 'multi';
    const skins = resolveSkins(members);
    this.skins = skins;
    q('#lb-title').textContent = state.title || (multi ? 'Lobby' : 'The Ritual');
    q('#lb-code').innerHTML = state.code ? `CODE <b>${esc(state.code)}</b> <button class="lb-copy" id="lb-copy" title="Copy the lobby code">Copy</button>` : '';
    on('#lb-copy', 'click', async (_, b) => {
      const code = state.code; let ok = false;
      try { await navigator.clipboard.writeText(code); ok = true; } catch { const t = document.createElement('textarea'); t.value = code; document.body.appendChild(t); t.select(); try { ok = document.execCommand('copy'); } catch { /* */ } t.remove(); }
      b.textContent = ok ? 'Copied!' : code; setTimeout(() => { b.textContent = 'Copy'; }, 1600);
    });

    // seats
    const rows = [];
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const m = members[i];
      if (!m) { rows.push('<div class="seat empty"><div class="sw"></div><div class="who"><i>Empty seat — a bot will take it</i></div></div>'); continue; }
      const sk = skinById[skins[i]], you = m.id === myId;
      const tag = m.isBot ? 'READY' : m.id === hostId ? 'HOST' : m.ready ? 'READY' : 'WAITING';
      const detail = you ? `${esc(skinLabel(sk))} · ${esc(MONSTERS[m.monsterPref]?.name || '')}` : esc(skinLabel(sk));
      rows.push(`<div class="seat ${you ? 'me' : ''}">
        <div class="sw" style="background:linear-gradient(135deg,${hex(sk.cloth)} 55%,${hex(sk.accent)} 55%)"></div>
        <div class="who"><div class="nm">${esc(m.name)}${you ? ' <span>(you)</span>' : ''}</div><div class="dt">${detail}</div></div>
        <div class="tg ${tag.toLowerCase()}">${tag}</div></div>`);
    }
    q('#lb-seats').innerHTML = rows.join('');

    // actions
    const ready = multi && !isHost ? `<button class="btn small" id="lb-ready">${me.ready ? 'Not ready' : 'Ready'}</button>` : '';
    const solo = this.o.mode === 'loadout'; // opened from the main menu: just you and the loadout
    this.el.classList.toggle('solo', solo);
    this.o.scene.setSolo(solo);
    if (solo && !this.drawer) { this.drawer = this.lastTab || 'char'; }
    q('#lb-actions').innerHTML = solo
      ? '<div class="lb-wait">Your loadout is saved for every match.</div><button class="btn small" id="lb-leave">← Back to the menu</button>'
      : `${isHost ? '<button class="btn primary lb-begin" id="lb-start">Begin the Ritual</button>' : '<div class="lb-wait">Waiting for the host to begin…</div>'}
      <div class="row" style="justify-content:space-between">${ready}${multi && account.mode === 'account' ? '<button class="btn small" id="lb-inv">Invite friend</button>' : ''}${multi && isHost ? '<button class="btn small" id="lb-priv">' + (state.private ? 'Private lobby' : 'Public lobby') + '</button>' : ''}<button class="btn small" id="lb-leave">Leave</button></div>`;
    for (const b of this.el.querySelectorAll('#lb-actions .btn')) b.addEventListener('mouseenter', () => sfx.hover());
    on('#lb-start', 'click', () => { sfx.click(); this.o.onStart(); });
    on('#lb-leave', 'click', () => { sfx.click(); this.o.onLeave(); });
    on('#lb-ready', 'click', () => { sfx.click(); this.o.onReady(!me.ready); });
    on('#lb-inv', 'click', () => { sfx.click(); this.o.onInvite?.(); });
    on('#lb-priv', 'click', () => { sfx.click(); this.o.onPrivate?.(!state.private); });

    // chat (only re-rendered when it changed, the input is never touched)
    const chat = state.chat || [];
    const sig = chat.length + (chat[chat.length - 1]?.text || '');
    if (sig !== this.chatN) {
      this.chatN = sig;
      const log = q('#lb-log');
      log.innerHTML = chat.map((c) => c.sys ? `<div class="sys">${esc(c.text)}</div>`
        : `<div><b style="color:${c.color || '#b08d57'}">${esc(c.name)}</b> ${esc(c.text)}</div>`).join('') || '<div class="sys">The candles gutter. Say something…</div>';
      log.scrollTop = log.scrollHeight;
    }

    this.renderDrawer(me, members, skins);
    q('#lb-ghost').classList.toggle('on', !!this.drawer);
    this.lineup();
  }

  // The 3D lineup: everyone in their outfit; your own plinth previews what you browse in the
  // loadout (a character you hover, your monster, or your trap).
  lineup() {
    const { members, myId } = this.state, skins = this.skins, me = members.find((m) => m.id === myId) || {};
    const myIdx = members.findIndex((m) => m.id === myId);
    const pv = this.drawer === 'mon' ? 'monster' : this.drawer === 'traps' ? 'trap' : null;
    const previewMon = this.preview?.kind === 'monster' ? this.preview.id : me.monsterPref;
    const previewTrap = this.preview?.kind === 'trap' ? this.preview.id : me.trap;
    this.o.scene.setLineup(Array.from({ length: MAX_PLAYERS }, (_, i) => members[i]
      ? { skin: i === myIdx && this.preview?.kind === 'skin' ? this.preview.id : skins[i], monster: i === myIdx ? previewMon : members[i].monsterPref || MONSTER_IDS[0],
        showMonster: i === myIdx && pv === 'monster', trap: i === myIdx && pv === 'trap' ? previewTrap : null } : null));
    this.names = Array.from({ length: MAX_PLAYERS }, (_, i) => members[i] ? { name: members[i].name, you: i === myIdx, bot: members[i].isBot,
      level: members[i].level, sub: i === myIdx && pv === 'monster' ? MONSTERS[previewMon]?.name : i === myIdx && pv === 'trap' ? TRAPS[previewTrap]?.name
        : skinLabel(skinById[i === myIdx && this.preview?.kind === 'skin' ? this.preview.id : skins[i]]) } : null);
    q('#lb-plates').innerHTML = this.names.map((n, i) => n
      ? `<div class="plate ${n.you ? 'me' : ''}" data-i="${i}"><div class="pn">${n.level ? `<i class="plv">${n.level}</i>` : ''}${esc(n.name)}</div><div class="ps">${esc(n.sub || '')}</div></div>` : '').join('');
    this.placePlates();
  }

  renderDrawer(me, members, skins) {
    const d = q('#lb-drawer');
    d.classList.toggle('open', !!this.drawer);
    this.o.scene.rightInset = this.drawer ? d.offsetWidth : 0; // the 3D lineup reframes beside the drawer
    if (!this.drawer) { d.innerHTML = ''; return; }
    const myIdx = members.findIndex((m) => m === me);
    const taken = new Set(skins.filter((_, i) => i !== myIdx && !members[i].isBot));
    const P = account.profile, L = P.loadout;
    const tabs = [['char', 'Character'], ['mon', 'Monster'], ['perks', 'Perks'], ['traps', 'Traps']];
    const lockBtn = (kind, id) => {
      const cost = UNLOCK_COST[kind.slice(0, -1)];
      return `<button class="dr-buy ${P.shards < cost ? 'poor' : ''}" data-unlock="${kind}:${id}" ${P.shards < cost ? 'disabled' : ''}>Unlock ◆ ${cost}</button>`;
    };
    const upBtn = (kind, id) => {
      const lv = levelOf(kind, id); if (lv >= 3) return '<span class="dr-max">Max level</span>';
      const cost = UPGRADE_COST[lv];
      return `<button class="dr-buy coin ${P.coins < cost ? 'poor' : ''}" data-upgrade="${kind}:${id}" ${P.coins < cost ? 'disabled' : ''}>Upgrade to Lv ${lv + 1} · ◉ ${cost}</button>`;
    };
    let body = '';
    if (this.drawer === 'char') {
      // Showroom: hover a character and your figure in the circle becomes them; click to choose
      // (or unlock). Alex comes in 5 colours; the others are exclusives.
      const cur = skins[myIdx], focus = this.preview?.kind === 'skin' ? this.preview.id : cur, fs = skinById[focus];
      const card = (s) => {
        const own = isUnlocked('skins', s.id);
        return `<div class="card skin ${s.id === cur ? 'sel' : ''} ${s.id === focus ? 'focus' : ''} ${taken.has(s.id) ? 'off' : ''} ${own ? '' : 'locked'}" data-skin="${s.id}">
          <div class="sw" style="background:${s.exclusive ? `radial-gradient(circle at 35% 30%,${hex(s.accent)},${hex(s.cloth)} 70%)` : hex(s.cloth)}"></div>
          <div class="cn">${own ? '' : '<i class="lock">🔒</i>'}${esc(s.variant || s.name)}</div>
          ${taken.has(s.id) ? '<div class="ct">taken</div>' : s.id === cur ? '<div class="ct">chosen</div>' : own ? '' : `<div class="ct">◆ ${UNLOCK_COST.skin}</div>`}</div>`;
      };
      const own = isUnlocked('skins', focus);
      body = `<div class="sh-detail" id="sh-detail">${showroomDetail(fs, own, focus === cur, taken.has(focus), P.shards)}</div>
        <div class="dr-h small">Alex</div>
        <div class="dr-grid skins5">${SKINS.filter((s) => !s.exclusive).map(card).join('')}</div>
        <div class="dr-h small">Exclusives</div>
        <div class="dr-grid">${SKINS.filter((s) => s.exclusive).map(card).join('')}</div>
        <div class="dr-note">Hover to preview on your plinth, click to choose. Exclusives unlock for ◆ ${UNLOCK_COST.skin} soul shards each. Each character can only be worn by one player — bots give way to you.</div>`;
    } else if (this.drawer === 'mon') {
      const id = this.preview?.kind === 'monster' ? this.preview.id : me.monsterPref, mon = MONSTERS[id] || MONSTERS[MONSTER_IDS[0]];
      const open = isUnlocked('monsters', mon.id);
      body = `<div class="dr-grid mons">${MONSTER_IDS.map((m) => `<div class="card ${m === mon.id ? 'sel' : ''} ${isUnlocked('monsters', m) ? '' : 'locked'}" data-mon="${m}">
          ${isUnlocked('monsters', m) ? '' : '<i class="lock">🔒</i>'}${esc(MONSTERS[m].name.replace('THE ', ''))}${m === me.monsterPref ? '<div class="ct">chosen</div>' : ''}</div>`).join('')}</div>
        <div class="lore dr-lore">
          <div class="dr-mon">${esc(mon.name)}</div><i>${esc(mon.lore)}</i>
          <b>Special</b>${esc(mon.special)}<b>Ability</b>${esc(mon.passive)}<b>Weakness</b>${esc(mon.weakness)}<b>Counterplay</b>${esc(mon.counter)}
        </div>
        ${open ? '' : `<div class="dr-lockrow"><span>Locked — unlock with soul shards</span>${lockBtn('monsters', mon.id)}</div>`}
        <div class="dr-note">If the curse picks you, you become this monster. Your figure in the circle shows it.</div>`;
    } else if (this.drawer === 'perks') {
      const focus = this.preview?.kind === 'perk' ? this.preview.id : L.perks[0] || PERK_IDS[0], pk = PERKS[focus];
      body = `<div class="dr-grid">${PERK_IDS.map((id) => `<div class="card perkc ${id === focus ? 'sel' : ''} ${isUnlocked('perks', id) ? '' : 'locked'} ${L.perks.includes(id) ? 'eq' : ''}" data-perk="${id}">
          <div class="pi">${PERKS[id].icon}</div><div class="cn">${esc(PERKS[id].name)}</div>
          <div class="ct">${isUnlocked('perks', id) ? (L.perks.includes(id) ? 'equipped' : `Lv ${levelOf('perks', id)}`) : '🔒'}</div></div>`).join('')}</div>
        <div class="lore dr-lore"><div class="dr-mon">${pk.icon} ${esc(pk.name)}</div>${esc(pk.desc)}
          ${pk.lv.map((t, i) => `<div class="dr-lv ${levelOf('perks', focus) === i + 1 && isUnlocked('perks', focus) ? 'cur' : ''}">Lv ${i + 1} — ${esc(t)}</div>`).join('')}</div>
        <div class="dr-lockrow">${isUnlocked('perks', focus)
          ? `<button class="dr-buy ${L.perks.includes(focus) ? 'on' : ''}" data-equip="${focus}" ${!L.perks.includes(focus) && L.perks.length >= MAX_PERKS ? 'disabled' : ''}>${L.perks.includes(focus) ? 'Unequip' : `Equip (${L.perks.length}/${MAX_PERKS})`}</button>${upBtn('perks', focus)}`
          : `<span>Locked</span>${lockBtn('perks', focus)}`}</div>
        <div class="dr-note">Survivor perks: up to ${MAX_PERKS} equipped. Upgrade them with ritual coins.</div>`;
    } else {
      const id = this.preview?.kind === 'trap' ? this.preview.id : me.trap, t = TRAPS[id];
      body = `<div class="dr-grid traps2">${TRAP_IDS.map((x) => `<div class="card ${x === id ? 'sel' : ''} ${isUnlocked('traps', x) ? '' : 'locked'}" data-trap="${x}">
          ${isUnlocked('traps', x) ? '' : '<i class="lock">🔒</i>'}${esc(TRAPS[x].name)}<div class="ct">${x === me.trap ? 'chosen' : isUnlocked('traps', x) ? `Lv ${levelOf('traps', x)}` : ''}</div></div>`).join('')}</div>
        <div class="lore dr-lore"><div class="dr-mon">${esc(t.name)}</div>${esc(t.desc)}
          <b>Levels</b>Each level makes the effect last longer.</div>
        <div class="dr-lockrow">${isUnlocked('traps', id) ? upBtn('traps', id) : `<span>Locked</span>${lockBtn('traps', id)}`}</div>
        <div class="dr-note">As the monster you carry 2 of your chosen trap and set them with T. Only the monster sets traps.</div>`;
    }
    d.innerHTML = `
      <div class="dr-tabs">${tabs.map(([id, l]) => `<button class="dr-tab ${this.drawer === id ? 'on' : ''}" data-tab="${id}">${l}</button>`).join('')}</div>
      <div class="dr-wallet"><span>◆ ${P.shards} soul shards</span><span>◉ ${P.coins} ritual coins</span></div>
      ${body}
      <button class="btn small" id="dr-close">Done</button>`;
    d.querySelectorAll('.card, .btn, .dr-tab, .dr-buy').forEach((b) => b.addEventListener('mouseenter', () => sfx.hover()));
    const sync = () => this.o.onUpdate(loadoutPrefs());
    on('[data-tab]', 'click', (_, el) => { sfx.click(); this.preview = null; this.pinned = false; this.tab(el.dataset.tab); }, d);
    // Showroom: hovering previews the character on your plinth (without rebuilding the grid);
    // leaving the grid returns to your choice; clicking chooses an owned one or keeps the preview
    // so it can be unlocked.
    const showSkin = (id) => {
      const fs = skinById[id]; if (!fs) return;
      this.preview = id === skins[myIdx] ? null : { kind: 'skin', id };
      d.querySelectorAll('[data-skin]').forEach((c) => c.classList.toggle('focus', c.dataset.skin === id));
      const det = q('#sh-detail'); if (det) det.innerHTML = showroomDetail(fs, isUnlocked('skins', id), id === skins[myIdx], taken.has(id), P.shards);
      this.lineup();
      on('[data-unlock]', 'click', unlockClick, det);
    };
    d.querySelectorAll('[data-skin]').forEach((c) => c.addEventListener('mouseenter', () => showSkin(c.dataset.skin)));
    d.onmouseleave = this.drawer === 'char' ? () => { if (!this.pinned) showSkin(skins[myIdx]); } : null;
    on('[data-skin]', 'click', (_, el) => {
      sfx.click(); const id = el.dataset.skin;
      if (taken.has(id)) return;
      if (isUnlocked('skins', id)) { this.preview = null; this.pinned = false; L.skin = id; saveProfile(); this.o.onUpdate({ skin: id }); }
      else { this.pinned = true; showSkin(id); } // keep showing it: unlock from the panel
    }, d);
    const unlockClick = (_, el) => {
      const [kind, id] = el.dataset.unlock.split(':');
      if (unlock(kind, id)) {
        sfx.key(); if (kind === 'monsters') L.monster = id; if (kind === 'traps') L.trap = id;
        if (kind === 'skins') { L.skin = id; this.pinned = false; this.preview = null; saveProfile(); this.o.onUpdate({ skin: id }); return; }
        saveProfile(); this.preview = kind === 'perks' ? { kind: 'perk', id } : null; sync();
      }
    };
    on('[data-mon]', 'click', (_, el) => {
      sfx.click(); const id = el.dataset.mon;
      if (isUnlocked('monsters', id)) { this.preview = null; L.monster = id; saveProfile(); sync(); } else { this.preview = { kind: 'monster', id }; this.render(this.state); }
    }, d);
    on('[data-trap]', 'click', (_, el) => {
      sfx.click(); const id = el.dataset.trap;
      if (isUnlocked('traps', id)) { this.preview = null; L.trap = id; saveProfile(); sync(); } else { this.preview = { kind: 'trap', id }; this.render(this.state); }
    }, d);
    on('[data-perk]', 'click', (_, el) => { sfx.click(); this.preview = { kind: 'perk', id: el.dataset.perk }; this.render(this.state); }, d);
    on('[data-equip]', 'click', (_, el) => { sfx.click(); togglePerk(el.dataset.equip); sync(); }, d);
    on('[data-unlock]', 'click', unlockClick, d);
    on('[data-upgrade]', 'click', (_, el) => { const [kind, id] = el.dataset.upgrade.split(':'); if (upgrade(kind, id)) { sfx.key(); sync(); } }, d);
    on('#dr-close', 'click', () => { sfx.click(); this.preview = null; if (this.o.mode === 'loadout') this.o.onLeave(); else this.toggle(this.drawer); }, d);
  }

  placePlates() {
    const box = q('#lb-plates'); if (!box) return;
    const pos = this.o.scene.platePositions(window.innerWidth, window.innerHeight);
    for (const el of box.children) {
      const p = pos[+el.dataset.i];
      if (!p || !p.front) { el.style.display = 'none'; continue; }
      el.style.display = '';
      el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
    }
  }
}

// Multiplayer entry: quick join, create, join by code, browse public lobbies.
export function multiMenu({ onQuick, onCreate, onJoin, onBack, lobbies, error, status }) {
  show(`
    <div class="screen menuv2"><div class="mm-fade"></div><div class="panel col mp-panel">
      <div class="lb-brand">${esc(gameTitle())}</div>
      <div class="h2">Multiplayer</div>
      <div class="err">${esc(error || '')}</div>
      <div class="tag">${esc(status || '')}</div>
      <button class="btn primary" id="quick">Quick Join</button>
      <button class="btn" id="create">Create Lobby</button>
      <div class="row"><input class="field" id="code" maxlength="5" placeholder="CODE" style="text-transform:uppercase" /><button class="btn small" id="join">Join</button></div>
      <div class="h3">Open lobbies</div>
      <div class="lobby-list">${(lobbies || []).map((l) => `<div class="item" data-code="${esc(l.code)}"><span>${esc(l.name)}</span><span>${l.players}/${l.max}</span></div>`).join('') || '<div class="lore"><i>No open lobbies. Create one.</i></div>'}</div>
      <button class="btn small" id="back">Back</button>
    </div></div>`);
  const busy = (fn) => (_, el) => { el.classList.add('busy'); el.dataset.t = el.textContent; el.textContent = 'One moment...'; fn(); }; // instant feedback while the server answers
  on('#quick', 'click', busy(onQuick)); on('#create', 'click', busy(onCreate)); on('#back', 'click', onBack);
  on('#join', 'click', busy(() => onJoin(q('#code').value)));
  on('.item', 'click', (_, el) => onJoin(el.dataset.code));
}
