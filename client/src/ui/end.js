// End-of-match screen.
import { MONSTERS } from '@shared/constants.js';
import { show, on, esc } from './dom.js';

export function endScreen(result, myId, { onAgain, onMenu, againLabel = 'Play again' }) {
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
      <div class="lore">${result.escaped} escaped · ${result.dead} fell. ${result.winner === 'survivors' ? 'The survivors win.' : 'The monster wins.'}</div>
      <div class="row" style="justify-content:center;margin-top:16px">
        <button class="btn small primary" id="again">${againLabel}</button>
        <button class="btn small" id="menu">Main menu</button>
      </div>
    </div></div>`);
  on('#again', 'click', onAgain); on('#menu', 'click', onMenu);
}
