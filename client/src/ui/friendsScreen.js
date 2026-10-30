// Friends: add players by name (they accept the request), up to 20 friends. Shows who is online
// and where they are; join a friend's lobby with one click.
import { show, on, q, esc } from './dom.js';
import { account, friendsApi } from '../profile.js';

const WHERE = { menu: 'In the menus', lobby: 'In a lobby', match: 'In a match' };

export function friendsScreen({ onBack, onSignIn, onJoin }) {
  const wrap = (body) => show(`
    <div class="screen menuv2"><div class="mm-fade"></div>
      <div class="panel fr-panel">
        <div class="pf-bar"><button class="btn small" id="fr-back">← Back</button><div class="h2" style="margin:0">Friends</div><span></span></div>
        ${body}
      </div>
    </div>`);
  if (account.mode !== 'account') {
    wrap(`<div class="lore" style="margin:30px 0">Friends need an account — guests can't add friends.</div>
      <button class="btn primary" id="fr-in">Sign in / create account</button>`);
    on('#fr-back', 'click', onBack); on('#fr-in', 'click', onSignIn);
    return;
  }
  let data = null, msg = '', err = '', timer = null;
  const render = () => {
    const d = data;
    wrap(`
      <form class="fr-add" id="fr-form" onsubmit="return false">
        <div class="fr-find"><input class="field" id="fr-name" maxlength="16" placeholder="Add a friend by name" autocomplete="off" /><div class="fr-sugg" id="fr-sugg" hidden></div></div>
        <button class="btn small primary" type="submit" ${d && d.friends.length >= d.max ? 'disabled' : ''}>Send request</button>
      </form>
      <div class="fr-msg ${err ? 'err' : ''}">${esc(err || msg)}</div>
      ${!d ? '<div class="lore">Loading…</div>' : `
      ${d.incoming.length ? `<div class="h3">Requests</div><div class="fr-list">${d.incoming.map((n) => `
        <div class="fr-row"><div class="fr-dot req"></div><div class="fr-n"><b>${esc(n)}</b><span>wants to be your friend</span></div>
          <button class="btn small primary" data-acc="${esc(n)}">Accept</button><button class="btn small" data-rem="${esc(n)}">Decline</button></div>`).join('')}</div>` : ''}
      <div class="h3">Friends · ${d.friends.length}/${d.max}</div>
      <div class="fr-list scrollable">${d.friends.map((f) => `
        <div class="fr-row ${f.online ? 'on' : ''}"><div class="fr-dot"></div>
          <div class="fr-n"><b>${esc(f.name)}</b><span>Level ${f.level} · ${f.online ? WHERE[f.where] || 'Online' : `Offline${f.lastSeen ? ' · last seen ' + ago(f.lastSeen) : ''}`}</span></div>
          ${f.code ? `<button class="btn small primary" data-join="${esc(f.code)}">Join lobby</button>` : ''}
          <button class="btn small fr-x" data-rem="${esc(f.name)}" title="Remove friend">✕</button></div>`).join('') || '<div class="lore"><i>No friends yet. Add someone by their name.</i></div>'}</div>
      ${d.outgoing.length ? `<div class="h3">Sent requests</div><div class="fr-list">${d.outgoing.map((n) => `
        <div class="fr-row"><div class="fr-dot req"></div><div class="fr-n"><b>${esc(n)}</b><span>waiting for an answer</span></div>
          <button class="btn small" data-rem="${esc(n)}">Cancel</button></div>`).join('')}</div>` : ''}`}`);
    on('#fr-back', 'click', () => { clearInterval(timer); onBack(); });
    // live suggestions: the closest names while you type (typos included)
    let st = null, seq = 0;
    const box = q('#fr-sugg'), inp = q('#fr-name');
    const STAT = { friend: 'already friends', pending: 'request sent', incoming: 'wants to be your friend', none: '' };
    const suggest = async () => {
      const text = inp.value.trim(), my = ++seq;
      if (!text) { box.hidden = true; return; }
      let r; try { r = await friendsApi.search(text); } catch { return; }
      if (my !== seq || !r?.ok) return;
      box.hidden = !r.results.length;
      box.innerHTML = r.results.map((x) => `<button type="button" class="fr-s" data-n="${esc(x.name)}" ${x.status === 'friend' || x.status === 'pending' ? 'disabled' : ''}><b>${esc(x.name)}</b><span>Lv ${x.level}${STAT[x.status] ? ' - ' + STAT[x.status] : ''}</span></button>`).join('');
    };
    inp.addEventListener('input', () => { clearTimeout(st); st = setTimeout(suggest, 180); });
    box.addEventListener('mousedown', (e) => e.preventDefault()); // keep the focus in the text box
    box.addEventListener('click', (e) => { const b = e.target.closest('.fr-s'); if (!b || b.disabled) return; inp.value = b.dataset.n; box.hidden = true; inp.focus(); });
    inp.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 150));
    q('#fr-form').addEventListener('submit', async () => {
      const n = q('#fr-name').value.trim(); if (!n) return;
      act(friendsApi.request(n), (r) => (r.friend ? `${r.friend} is now your friend.` : `Request sent to ${r.sent}.`));
    });
    on('[data-acc]', 'click', (_, el) => act(friendsApi.accept(el.dataset.acc), (r) => `${r.friend} is now your friend.`));
    on('[data-rem]', 'click', (_, el) => act(friendsApi.remove(el.dataset.rem), () => ''));
    on('[data-join]', 'click', (_, el) => { clearInterval(timer); onJoin(el.dataset.join); });
  };
  const load = async () => {
    try { const r = await friendsApi.list(); if (r.ok) { data = r; } else err = r.error || ''; } catch (e) { err = e.message; }
    if (q('.fr-panel') && document.activeElement?.id !== 'fr-name') render();
  };
  const act = async (p, okText) => {
    try { const r = await p; if (r.ok) { msg = okText(r); err = ''; } else { err = r.error || 'Something went wrong.'; msg = ''; } } catch (e) { err = e.message; }
    await load(); render();
  };
  render(); load();
  timer = setInterval(() => { if (!q('.fr-panel')) clearInterval(timer); else load(); }, 15000);
}

function ago(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
