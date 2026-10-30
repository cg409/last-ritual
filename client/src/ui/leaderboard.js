// Weekly XP leaderboard: ranked by the XP earned since the last reset (every Monday 12:30 pm). The champion
// of each week is paid 10 soul shards + 400 ritual coins. A live countdown to the next reset sits at the bottom.
import { show, on, q, esc } from './dom.js';
import { account, fetchLeaderboard, claimRewards } from '../profile.js';

const fmt = (ms) => {
  const t = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(t / 86400), h = Math.floor(t % 86400 / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
  const p = (n) => String(n).padStart(2, '0');
  return `${d}d ${p(h)}h ${p(m)}m ${p(s)}s`;
};

export function leaderboardScreen({ onBack }) {
  show(`
    <div class="screen menuv2"><div class="mm-fade"></div>
      <div class="panel lbd-panel">
        <div class="pf-bar"><button class="btn small" id="lbd-back">&larr; Back</button><div class="h2" style="margin:0">Weekly Leaderboard</div><span></span></div>
        <div class="lbd-sub">Ranked by the XP you earn this week. First place when the week ends wins <b>10 soul shards</b> and <b>400 ritual coins</b>.</div>
        <div id="lbd-body" class="lore">Reading the book of names&hellip;</div>
        <div class="lbd-count" id="lbd-count"></div>
      </div>
    </div>`);
  let timer = null;
  on('#lbd-back', 'click', () => { clearInterval(timer); onBack(); });
  claimRewards().then((r) => r && window.dispatchEvent(new CustomEvent('tlr-reward', { detail: r })));
  fetchLeaderboard().then((d) => {
    const body = q('#lbd-body'); if (!body) return;
    if (!d?.ok) { body.innerHTML = '<i>The server did not answer. Try again in a moment.</i>'; return; }
    const meName = account.mode === 'account' ? account.username : null;
    const row = (r) => `<div class="lbd-row ${r.name === meName ? 'me' : ''} ${r.rank && r.rank <= 3 ? 'r' + r.rank : ''}">
      <span class="lbd-rank">${r.rank ? r.rank : '-'}</span><span class="lbd-name">${esc(r.name)}</span>
      <span class="lbd-lv">Lv ${r.level}</span><span class="lbd-xp">${r.xp.toLocaleString()} XP</span></div>`;
    const mine = d.me && !d.top.some((r) => r.name === d.me.name) ? `<div class="lbd-gap">&middot;&middot;&middot;</div>${row(d.me)}` : '';
    body.className = 'lbd-list';
    body.innerHTML = (d.top.map(row).join('') || '<div class="lore"><i>No one has earned XP this week yet. Be the first!</i></div>') + mine
      + (account.mode !== 'account' ? '<div class="lbd-note">Guests are not ranked - sign in to join the leaderboard.</div>' : '')
      + (d.lastWinner ? `<div class="lbd-note">Last week's champion: <b>${esc(d.lastWinner.name)}</b> (${d.lastWinner.xp.toLocaleString()} XP)</div>` : '');
    const skew = d.now - Date.now(), when = new Date(d.resetAt).toLocaleString([], { weekday: 'long', hour: 'numeric', minute: '2-digit' });
    const draw = () => { const c = q('#lbd-count'); if (!c) { clearInterval(timer); return; } c.innerHTML = `Resets in <b>${fmt(d.resetAt - (Date.now() + skew))}</b><small>${esc(when)} (your time)</small>`; };
    draw(); timer = setInterval(draw, 1000);
  });
}