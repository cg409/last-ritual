// Lobby screen: 5 slots (empty seats become bots), unique skin picker, monster picker with
// abilities / weaknesses / backstory, trap picker, chat, ready/start.
import { SKINS, MONSTERS, MONSTER_IDS, TRAPS, MAX_PLAYERS } from '@shared/constants.js';
import { show, on, q, esc, hex } from './dom.js';

export function lobbyScreen(opts) {
  // opts: { mode, code, members, myId, hostId, onUpdate, onReady, onStart, onLeave, onChat }
  const me = opts.members.find((m) => m.id === opts.myId) || {};
  const isHost = opts.hostId === opts.myId;
  const taken = new Set(opts.members.filter((m) => m.id !== opts.myId).map((m) => m.skin));
  const mon = MONSTERS[me.monsterPref] || MONSTERS[MONSTER_IDS[0]];
  const slots = [];
  for (let i = 0; i < MAX_PLAYERS; i++) {
    const m = opts.members[i];
    slots.push(m
      ? `<div class="slot"><div class="dot ${m.ready || m.isBot ? 'on' : ''}"></div><div class="nm">${esc(m.name)}${m.id === opts.myId ? ' <span class="tag">(you)</span>' : ''}</div>
         <div class="tag">${m.isBot ? 'BOT' : m.id === opts.hostId ? 'HOST' : m.ready ? 'READY' : '...'}</div></div>`
      : `<div class="slot" style="opacity:.4"><div class="dot"></div><div class="nm"><i>— empty: a bot will fill this seat —</i></div></div>`);
  }
  show(`
    <div class="screen"><div class="lobby">
      <div class="panel col">
        <div class="row" style="justify-content:space-between">
          <div class="h2" style="margin:0">${opts.mode === 'single' ? 'The Vigil' : 'Lobby'}</div>
          ${opts.code ? `<div>CODE&nbsp; <span class="code">${esc(opts.code)}</span></div>` : ''}
        </div>
        <div>${slots.join('')}</div>
        <div class="lore" style="font-size:13px">One soul is cursed at random when the match begins. Real players are three times more likely to be chosen than bots.</div>
        ${opts.mode === 'multi' ? `<div class="chat" id="chat">${(opts.chat || []).map((c) => `<div><b style="color:#b08d57">${esc(c.name)}:</b> ${esc(c.text)}</div>`).join('')}</div>
        <input class="field" id="chatin" maxlength="140" placeholder="Say something..." />` : ''}
        <div class="row" style="justify-content:space-between;margin-top:auto">
          <button class="btn small" id="leave">Leave</button>
          ${opts.mode === 'multi' && !isHost ? `<button class="btn small primary" id="ready">${me.ready ? 'Not ready' : 'Ready'}</button>` : ''}
          ${isHost ? `<button class="btn primary" id="start">Begin the Vigil</button>` : '<span class="tag">Waiting for host…</span>'}
        </div>
      </div>
      <div class="panel scroll">
        <div class="h3" style="margin-top:0">Your survivor</div>
        <canvas id="preview"></canvas>
        <div class="grid" style="margin-top:8px">${SKINS.map((s) => `
          <div class="card ${s.id === me.skin ? 'sel' : ''} ${taken.has(s.id) ? 'off' : ''}" data-skin="${s.id}">
            <div class="sw" style="background:linear-gradient(90deg,${hex(s.cloth)},${hex(s.accent)})"></div>${esc(s.name)}</div>`).join('')}
        </div>
        <div class="h3">If the curse takes you…</div>
        <div class="grid">${MONSTER_IDS.map((id) => `<div class="card ${id === me.monsterPref ? 'sel' : ''}" data-mon="${id}">${MONSTERS[id].name.replace('THE ', '')}</div>`).join('')}</div>
        <div class="lore" style="margin-top:10px">
          <b>${mon.name}</b><i>${esc(mon.lore)}</i>
          <b>Special</b>${esc(mon.special)}
          <b>Ability</b>${esc(mon.passive)}
          <b>Weakness</b>${esc(mon.weakness)}
          <b>Counterplay</b>${esc(mon.counter)}
        </div>
        <div class="h3">Trap</div>
        <div class="grid">${Object.values(TRAPS).map((t) => `<div class="card ${t.id === me.trap ? 'sel' : ''}" data-trap="${t.id}" title="${esc(t.desc)}">${esc(t.name)}</div>`).join('')}</div>
        <div class="lore" style="font-size:13px;margin-top:6px">${esc(TRAPS[me.trap]?.desc || '')}</div>
      </div>
    </div></div>`);
  on('[data-skin]', 'click', (_, el) => opts.onUpdate({ skin: el.dataset.skin }));
  on('[data-mon]', 'click', (_, el) => opts.onUpdate({ monsterPref: el.dataset.mon }));
  on('[data-trap]', 'click', (_, el) => opts.onUpdate({ trap: el.dataset.trap }));
  on('#leave', 'click', opts.onLeave);
  on('#ready', 'click', () => opts.onReady(!me.ready));
  on('#start', 'click', opts.onStart);
  const ci = q('#chatin');
  if (ci) ci.addEventListener('keydown', (e) => { if (e.key === 'Enter' && ci.value.trim()) { opts.onChat(ci.value); ci.value = ''; } });
  const chat = q('#chat'); if (chat) chat.scrollTop = chat.scrollHeight;
  return q('#preview');
}

// Multiplayer entry: quick join, create, join by code, browse public lobbies.
export function multiMenu({ onQuick, onCreate, onJoin, onBack, lobbies, error, status }) {
  show(`
    <div class="screen"><div class="panel col" style="width:min(560px,94vw)">
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
  on('#quick', 'click', onQuick); on('#create', 'click', onCreate); on('#back', 'click', onBack);
  on('#join', 'click', () => onJoin(q('#code').value));
  on('.item', 'click', (_, el) => onJoin(el.dataset.code));
}
