// End-of-match screen.
import { MONSTERS, MAX_LEVEL } from '@shared/constants.js';
import { xpToNext } from '../profile.js';
import { show, on, esc } from './dom.js';

function rewardsHtml(r) {
  if (!r) return '';
  const lv = r.after.level, need = xpToNext(lv), pct = lv >= MAX_LEVEL ? 100 : Math.round((r.after.xp / need) * 100);
  return `<div class="rewards">
    <div class="rw-lines">${r.lines.map(([l, n]) => `<div><span>${esc(l)}</span><b>+${n} XP</b></div>`).join('')}</div>
    <div class="rw-lv">${r.after.level > r.before.level ? `<div class="rw-up">LEVEL UP — ${r.after.level}</div>` : `<div>Level ${lv}</div>`}
      <div class="pf-xp"><div style="width:${pct}%"></div></div><small>${lv >= MAX_LEVEL ? 'Maximum level' : `${r.after.xp} / ${need} XP`}</small></div>
    <div class="rw-cur"><span>◉ +${r.coins} ritual coins${r.winCoins ? ` (+${r.winCoins} for your team's win)` : ' (no win bonus — your team lost)'}</span>${r.shards ? `<span>◆ +${r.shards} soul shards</span>` : ''}</div>
    ${r.newAch.length ? `<div class="rw-ach">${r.newAch.map((a) => `<div>✠ Achievement — <b>${esc(a.name)}</b></div>`).join('')}</div>` : ''}
  </div>`;
}

export function endScreen(result, myId, { onAgain, onMenu, againLabel = 'Play again', rewards = null }) {
  const meRow = result.players.find((p) => p.id === myId);
  const iWasMonster = result.monster && !meRow;
  let title, color;
  if (iWasMonster) { title = result.winner === 'monster' ? 'THE HUNT IS SATED' : 'THEY SLIPPED AWAY'; color = result.winner === 'monster' ? '#c21d1d' : '#8a8072'; }
  else if (meRow?.state === 'escaped') { title = 'YOU ESCAPED'; color = '#8fc46a'; }
  else { title = 'YOU PERISHED'; color = '#c21d1d'; }
  const label = { escaped: 'Escaped', mouse: 'Dead', alive: 'Trapped', downed: 'Bled out', hooked: 'Hanged' };
  show(`
    <div class="screen endscreen"><div class="panel" style="width:min(640px,94vw);text-align:center">
      <div class="result" style="color:${color}">${title}</div>
      <div class="lore" style="margin-top:8px">The cursed one was <b style="display:inline">${esc(result.monster.name)}</b> — ${MONSTERS[result.monster.id].name}</div>
      <table>${result.players.map((p) => `<tr><td>${esc(p.name)}</td><td style="color:${p.state === 'escaped' ? '#8fc46a' : '#c21d1d'}">${label[p.state] || p.state}</td></tr>`).join('')}</table>
      <div class="lore">${result.escaped} escaped · ${result.dead} fell. ${result.allHung ? 'Every soul left in the realm hangs from the gallows. ' : ''}${result.winner === 'survivors' ? 'The survivors win.' : 'The monster took them all.'}</div>
      ${rewardsHtml(rewards)}
      <div class="row" style="justify-content:center;margin-top:16px">
        <button class="btn small primary" id="again">${againLabel}</button>
        <button class="btn small" id="menu">Main menu</button>
      </div>
    </div></div>`);
  on('#again', 'click', onAgain); on('#menu', 'click', onMenu);
}
