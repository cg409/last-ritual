// XP leaderboard: the top 50 players by total XP earned, with your own place.
import { show, on, q, esc } from './dom.js';
import { account, fetchLeaderboard } from '../profile.js';

export function leaderboardScreen({ onBack }) {
  show(`
    <div class="screen menuv2"><div class="mm-fade"></div>
      <div class="panel lbd-panel">
        <div class="pf-bar"><button class="btn small" id="lbd-back">← Back</button><div class="h2" style="margin:0">Leaderboard</div><span></span></div>
        <div class="lbd-sub">The most devoted souls, ranked by all the XP they have earned.</div>
        <div id="lbd-body" class="lore">Reading the book of names…</div>
      </div>
    </div>`);
  on('#lbd-back', 'click', onBack);
  fetchLeaderboard().then((d) => {
    const body = q('#lbd-body'); if (!body) return;
    if (!d?.ok) { body.innerHTML = '<i>The server did not answer. Try again later.</i>'; return; }
    const meName = account.mode === 'account' ? account.username : null;
    const row = (r) => `<div class="lbd-row ${r.name === meName ? 'me' : ''} ${r.rank <= 3 ? 'r' + r.rank : ''}">
      <span class="lbd-rank">${r.rank <= 3 ? ['✠', '✠', '✠'][r.rank - 1] : ''}${r.rank}</span><span class="lbd-name">${esc(r.name)}</span>
      <span class="lbd-lv">Lv ${r.level}</span><span class="lbd-xp">${r.xp.toLocaleString()} XP</span></div>`;
    const mine = d.me && !d.top.some((r) => r.name === d.me.name) ? `<div class="lbd-gap">⋯</div>${row(d.me)}` : '';
    body.className = 'lbd-list';
    body.innerHTML = (d.top.map(row).join('') || '<div class="lore"><i>No one has played yet.</i></div>') + mine
      + (account.mode !== 'account' ? '<div class="lbd-note">Guests are not ranked — sign in to join the leaderboard.</div>' : '');
  });
}
