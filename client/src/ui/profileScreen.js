// Player profile: level & XP, ritual coins, soul shards, lifetime stats, achievements (earned and
// still to get, with progress and the share of all players who earned each), account actions.
// Hidden achievements show their name only — what they are for stays secret until earned.
import { MAX_LEVEL } from '@shared/constants.js';
import { show, on, esc, q } from './dom.js';
import { account, xpToNext, ACHIEVEMENTS, signOut, fetchAchievementStats } from '../profile.js';

export function profileScreen({ onBack, onSignIn }) {
  const p = account.profile, guest = account.mode === 'guest';
  const need = xpToNext(p.level), pct = p.level >= MAX_LEVEL ? 100 : Math.round((p.xp / need) * 100);
  const got = ACHIEVEMENTS.filter((a) => p.achievements[a.id]), todo = ACHIEVEMENTS.filter((a) => !p.achievements[a.id]);
  const ach = (a, done) => {
    const v = Math.min(a.goal, a.val(p) || 0), secret = a.hidden && !done;
    return `<div class="ach ${done ? 'done' : ''} ${a.hidden ? 'hid' : ''}"><div class="ai">${done ? '✠' : secret ? '?' : '✧'}</div>
      <div class="at"><b>${esc(a.name)}</b><span>${secret ? '<i>Hidden achievement — discover it in the realm.</i>' : esc(a.desc)}</span>
      ${done ? `<small>Earned ${new Date(p.achievements[a.id]).toLocaleDateString()}</small>`
        : secret ? '' : `<div class="ap"><div style="width:${Math.round((v / a.goal) * 100)}%"></div></div><small>${v} / ${a.goal}</small>`}</div>
      <div class="apct" data-pct="${a.id}" title="Players who earned this">…</div></div>`;
  };
  const S = p.stats;
  show(`
    <div class="screen menuv2"><div class="mm-fade"></div>
      <div class="panel prof">
        <div class="pf-bar">
          <button class="btn small" id="pf-back">← Back</button>
          ${guest ? '<button class="btn small primary" id="pf-in">Sign in / create account</button>' : '<button class="btn small" id="pf-out">Sign out</button>'}
        </div>
        <div class="pf-head">
          <div class="pf-lv"><span>LEVEL</span><b>${p.level}</b></div>
          <div class="pf-id">
            <div class="pf-name">${esc(p.name)}</div>
            <div class="pf-acc">${guest ? 'Guest — progress saved in this browser only' : `Signed in as ${esc(account.username)}`}</div>
            <div class="pf-xp"><div style="width:${pct}%"></div></div>
            <div class="pf-xpt">${p.level >= MAX_LEVEL ? 'Maximum level reached' : `${p.xp} / ${need} XP to level ${p.level + 1}`}</div>
          </div>
          <div class="pf-cur"><div title="Ritual coins — upgrade perks and traps">◉ <b>${p.coins}</b><span>ritual coins</span></div>
            <div title="Soul shards — unlock monsters, traps and perks">◆ <b>${p.shards}</b><span>soul shards</span></div></div>
        </div>
        <div class="pf-stats">${[['Matches', S.matches], ['Escapes', S.escapes], ['Tombs enchanted', S.enchants], ['Chests opened', S.chests], ['Rescues', S.rescues],
          ['Hanged (as monster)', S.hooks], ['Souls taken', S.kills], ['Hunts won', S.monsterWins]].map(([l, v]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div>
        <div class="pf-cols">
          <div class="pf-col"><div class="h3">Achievements earned · ${got.length}/${ACHIEVEMENTS.length}</div><div class="achs">${got.map((a) => ach(a, true)).join('') || '<div class="lore"><i>None yet. The ritual awaits.</i></div>'}</div></div>
          <div class="pf-col"><div class="h3">Still to earn</div><div class="achs">${todo.map((a) => ach(a, false)).join('') || '<div class="lore"><i>You have earned them all.</i></div>'}</div></div>
        </div>
      </div>
    </div>`);
  on('#pf-back', 'click', onBack);
  on('#pf-in', 'click', onSignIn);
  on('#pf-out', 'click', () => { signOut(); onSignIn(); });
  // How many players earned each achievement (all accounts on the server).
  fetchAchievementStats().then((st) => {
    document.querySelectorAll('[data-pct]').forEach((el) => {
      if (!st || !st.total) { el.textContent = ''; return; }
      const n = st.counts[el.dataset.pct] || 0, v = (n / st.total) * 100;
      el.textContent = `${v >= 10 || v === 0 ? Math.round(v) : v.toFixed(1)}%`;
      el.title = `${v.toFixed(1)}% of players earned this`;
    });
  });
  void q;
}
