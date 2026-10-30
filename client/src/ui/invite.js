// Pick a friend to invite into your lobby: online friends first. The server delivers the invite instantly.
import { friendsApi } from '../profile.js';
import { esc } from './dom.js';

export function invitePicker({ send }) {
  document.querySelector('.invite-pick')?.remove();
  const el = document.createElement('div'); el.className = 'invite-pick';
  el.innerHTML = `<div class="panel ip-panel"><div class="h2">Invite a friend</div><div class="ip-list" id="ip-list"><div class="lore">Loading your friends...</div></div><button class="btn small" id="ip-close">Close</button></div>`;
  document.body.appendChild(el);
  const list = el.querySelector('#ip-list'), close = () => el.remove();
  el.querySelector('#ip-close').onclick = close;
  el.addEventListener('pointerdown', (e) => { if (e.target === el) close(); });
  friendsApi.list().then((r) => {
    if (!r.ok) { list.innerHTML = `<div class="lore">${esc(r.error || 'Could not load friends.')}</div>`; return; }
    if (!r.friends.length) { list.innerHTML = '<div class="lore"><i>You have no friends yet. Add some from the main menu (Friends).</i></div>'; return; }
    list.innerHTML = r.friends.map((f) => `<div class="ip-row ${f.online ? 'on' : ''}"><i class="ip-dot"></i><div class="ip-n"><b>${esc(f.name)}</b><span>${f.online ? 'Online' : 'Offline'} - Level ${f.level}</span></div>
      <button class="btn small ${f.online ? 'primary' : ''}" data-to="${esc(f.name)}">Invite</button></div>`).join('');
    list.querySelectorAll('[data-to]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = '...';
      const res = await send(b.dataset.to);
      b.textContent = res?.ok ? 'Invited' : 'Invite'; b.disabled = !!res?.ok;
      const row = b.closest('.ip-row'), old = row.querySelector('.ip-err'); old?.remove();
      if (!res?.ok) { const e = document.createElement('div'); e.className = 'ip-err'; e.textContent = res?.error || 'Could not send.'; row.querySelector('.ip-n').appendChild(e); }
    }));
  }).catch((e) => { list.innerHTML = `<div class="lore">${esc(e.message)}</div>`; });
}