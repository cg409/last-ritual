// The in-game mailbox: letters from the makers. A mail never disappears; the first one is shown automatically the first time
// a player comes back to the menu after a lobby / match, and has to be read to the end before it can be closed.
import { esc } from './dom.js';
import { sfx } from '../audio.js';

export const MAILS = [
  {
    id: 'welcome', from: 'Techkey - Digital World', subject: 'A message for you', date: '',
    body: `Hey, Survivor.

මීට අවුරුදු 3–4 කට කලින් අපි AI භාවිතා කළේ Chat කරන්න විතරයි. මතක ඇති, AI එකෙන් එක වචනයක් හරි වැරදුණොත් අපි ඒකට බැන්නා. 

ඒත් අද ? ඒ කාලයත් එක්ක සසඳද්දී AI තාක්ෂණය ඇදහිය නොහැකි තරම් දුරක් ඇවිත්.

ලෝකයේ වේගයෙන්ම දියුණු වන තාක්ෂණයන් අතරින් එකක් වන AI ගැන තවමත් අපේ රටේ බොහෝ දෙනෙක් දන්නේ ඉතාම සීමිත ප්‍රමාණයක්.

AI එකකට 3D Model එකක් නිර්මාණය කරන්න පුළුවන් කියන එක පවා සමහරුන්ට තවමත් මැජික් එකක් වගේ.

ඒත් විශ්වාස කරන්න...

ඔබ මේ දැන් ක්‍රීඩා කළ මුළු Game එකම AI භාවිතයෙන් Develop කරපු එකක් ! මේක පොඩි උදාහරණයක් විතරයි. මේ AI වල pinnacle නම් නෙමෙයි...

අද මේ වගේ දෙයක් develop කරන්න අපිට AI වෙනුවෙන් සැලකිය යුතු මුදලක් වැය කරන්න සිදු වුණා. ඒත් හෙට මේ AI services නොමිලේම ලබාගන්න පුළුවන් වෙන්නත් ඉඩ තිබෙනවා.

අපි ඔබට මතක් කරන්න උත්සාහ කරන්නේ එක දෙයයි.

අපි ජීවත් වෙන්නේ අතිශය වේගයෙන් වෙනස් වන ලෝකයක.

අද වෙන විට මිනිසුන් කරන කාර්යයන් වෙනුවෙන් AI සහිත රොබෝවරුන් නිර්මාණය වෙනවා. රැකියා ක්ෂේත්‍ර, ව්‍යාපාර සහ අධ්‍යාපනය පවා මේ වෙනස්කම්වලට මුහුණ දෙමින් සිටිනවා.

ඒ නිසා ලෝකය ගැන නිතරම Update එකේ ඉන්න.

ඔබේ අනාගත මාර්ගය තෝරාගනිද්දී, තීරණ ගනිද්දී, ව්‍යාපාරයක් ආරම්භ කරද්දී මේ ලෝකයේ සිදුවන තාක්ෂණික වෙනස්කම් සහ නව ප්‍රවණතා ගැන අනිවාර්යයෙන්ම අවධානය යොමු කරන්න.

නැත්නම් අනාගතයේදී ඔබටත් සිදුවෙන්න පුළුවන් තමන්ගේම ජීවිතයේ තීරණ ගැනීමේ නිදහස අහිමි කරගත්, කූඩුවක සිරවුණු මීයෙක් වගේ තත්ත්වයකට පත්වෙන්න.

Don't just survive the game. Learn to survive the future.

අපි,

Techkey – Digital World
Sri Lankan Largest Tech Community in WhatsApp.

~ A small attempt to showcase how far Artificial Intelligence has advanced ~`,
  },
];

const KEY = 'tlr-mail';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const save = (s) => localStorage.setItem(KEY, JSON.stringify(s));
export const isRead = (id) => !!load().read?.[id];
export const markRead = (id) => { const s = load(); s.read = { ...(s.read || {}), [id]: Date.now() }; save(s); };
export const unreadCount = () => MAILS.filter((m) => !isRead(m.id)).length;
// the next mail that must be shown by itself (the first one, once the player has seen a lobby or a match)
export const pendingForced = () => MAILS.find((m) => !isRead(m.id));

export const MAIL_ICON = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1.6 2L12 12.4 19.4 7H4.6zM4 8.6V17h16V8.6l-8 5.8-8-5.8z"/></svg>';

const paragraphs = (t) => t.split('\n\n').map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

// One letter in a window. force = it cannot be closed until it has been read to the end.
export function openLetter(mail, { force = false, onClose } = {}) {
  document.querySelector('.mail-letter')?.remove();
  const el = document.createElement('div'); el.className = 'mail-letter';
  el.innerHTML = `<div class="ml-paper">
    <div class="ml-head"><div class="ml-from">From <b>${esc(mail.from)}</b></div><div class="ml-sub">${esc(mail.subject)}</div></div>
    <div class="ml-body" id="ml-body">${paragraphs(mail.body)}</div>
    <div class="ml-foot"><span id="ml-hint">${force ? 'Read to the end to continue' : ''}</span><button class="btn primary" id="ml-close" ${force ? 'disabled' : ''}>${force ? 'Continue' : 'Close'}</button></div></div>`;
  document.body.appendChild(el);
  const body = el.querySelector('#ml-body'), btn = el.querySelector('#ml-close'), hint = el.querySelector('#ml-hint');
  const check = () => {
    if (body.scrollTop + body.clientHeight >= body.scrollHeight - 12) { btn.disabled = false; hint.textContent = ''; }
  };
  body.addEventListener('scroll', check); setTimeout(check, 200);
  const poll = setInterval(check, 300); // (also checked on a timer: some phones fire scroll events late)
  const close = () => { clearInterval(poll); markRead(mail.id); el.remove(); onClose?.(); };
  btn.addEventListener('click', () => { if (btn.disabled) return; sfx.click(); close(); });
  if (!force) el.addEventListener('pointerdown', (e) => { if (e.target === el) close(); });
}

// The mailbox: a list of letters (unread ones marked); tap one to read it.
export function openMailbox(onChange) {
  document.querySelector('.mailbox')?.remove();
  const el = document.createElement('div'); el.className = 'mailbox';
  const draw = () => {
    el.innerHTML = `<div class="panel mb-panel"><div class="h2">Mail</div>
      <div class="mb-list">${MAILS.map((m) => `<div class="mb-row ${isRead(m.id) ? '' : 'new'}" data-id="${m.id}"><i class="mb-dot"></i>
        <div class="mb-t"><b>${esc(m.subject)}</b><span>${esc(m.from)}</span></div><em>${isRead(m.id) ? 'read' : 'new'}</em></div>`).join('') || '<div class="lore"><i>No mail yet.</i></div>'}</div>
      <button class="btn small" id="mb-close">Close</button></div>`;
    el.querySelectorAll('.mb-row').forEach((r) => r.addEventListener('click', () => { sfx.click(); openLetter(MAILS.find((m) => m.id === r.dataset.id), { onClose: () => { draw(); onChange?.(); } }); }));
    el.querySelector('#mb-close').addEventListener('click', () => { sfx.click(); el.remove(); onChange?.(); });
  };
  draw(); document.body.appendChild(el);
  el.addEventListener('pointerdown', (e) => { if (e.target === el) { el.remove(); onChange?.(); } });
}

// keep the red number on the menu's mail icon right
export function refreshMailBadge() {
  const n = unreadCount(), i = document.querySelector('.mm-mail-n'); if (!i) return;
  i.textContent = n; i.hidden = !n;
}
