// Turns simulation events into sounds, banners and kill-feed lines.
import { sfx } from './audio.js';
import { esc } from './ui/dom.js';

export function eventFeed(m, e, me, s) {
  const hud = m.hud; if (!hud) return;
  const amMonster = me?.role === 'monster';
  const P = (x, z) => m.pan(x, z);
  const n = esc(e.name);
  switch (e.t) {
    case 'enchanted': sfx.enchant(); hud.feedMsg(`${n} enchanted a tomb (${e.count}/3)`, '#b07ad1'); break;
    case 'phase': hud.banner(esc(e.msg), 4500, e.phase === 3 ? '#d4a840' : '#b07ad1'); break;
    case 'fail': { const p = P(e.x, e.z); sfx.fail(p.pan); if (e.tomb != null) hud.feedMsg(`${n} cracked a tomb`, '#c98b2b');
      if (amMonster && me.monster === 'wanderer') hud.banner('A rite has failed — you sense where.', 2000, '#c21d1d'); break; }
    case 'crows': { const p = P(e.x, e.z); sfx.crows(p.pan, p.vol); if (amMonster && me.monster === 'wanderer') hud.feedMsg('The crows screech… (Q to go)', '#c21d1d'); break; }
    case 'saw': { const p = P(e.x, e.z); sfx.saw(p.pan, 0.8); break; }
    case 'lightning': { const p = P(e.x, e.z); sfx.thunder(p.pan); hud.flash(); break; }
    case 'blackout': sfx.blackout(); hud.banner(amMonster ? 'BLACKOUT — they cannot see' : 'THE LIGHTS DIE', 2500, '#c21d1d'); break;
    case 'teleport': { const p = P(e.x, e.z); sfx.teleport(p.pan); break; }
    case 'exposed': { const p = P(e.x, e.z); sfx.exposed(p.pan); hud.feedMsg('The Mimic was exposed by the light!', '#ffb060'); if (amMonster) hud.banner('THE LIGHT BURNS — you are hurled away', 2500, '#ffb060'); break; }
    case 'hit': if (e.id === me?.id) { sfx.hit(); } else sfx.swing(); if (e.weapon !== 'fist') { const p = P(e.x, e.z); sfx.scream(p.pan); } break;
    case 'swing': if (amMonster) sfx.swing(); break;
    case 'downed': hud.feedMsg(`${n} is down`, '#c21d1d'); break;
    case 'hooked': hud.feedMsg(`${n} was hanged`, '#c21d1d'); { const p = P(e.x, e.z); sfx.scream(p.pan); } break;
    case 'rescued': hud.feedMsg(e.by === e.name ? `${n} broke free!` : `${esc(e.by)} rescued ${n}`, '#8fc46a'); break;
    case 'killed': hud.feedMsg(`${n} ${e.how === 'slain' ? 'was slain' : e.how === 'sacrificed' ? 'died on the gallows' : e.how}… now a mouse`, '#c21d1d');
      if (e.id === me?.id) hud.banner('YOU DIED<br><span style="font-size:16px">You return as a mouse. Watch. Wait.</span>', 5000, '#c21d1d'); break;
    case 'healed': hud.feedMsg(`${esc(e.by || '')} tended ${n}`, '#8fc46a'); break;
    case 'wiggleFree': hud.feedMsg(`${n} wriggled free!`, '#8fc46a'); break;
    case 'key': sfx.key(); hud.feedMsg(`${n} found a key`, '#d4a840'); break;
    case 'keysIn': hud.feedMsg(`Keys in the gate: ${e.keys}/3`, '#d4a840'); break;
    case 'doorOpen': sfx.door(); hud.banner('THE GATE IS OPEN', 5000, '#d4a840'); break;
    case 'escaped': hud.feedMsg(`${n} escaped`, '#8fc46a'); if (e.id === me?.id) hud.banner('YOU ESCAPED', 5000, '#8fc46a'); break;
    case 'trap': { const p = P(e.x, e.z); sfx.trap(p.pan); hud.feedMsg(`${n} triggered a trap`, '#c98b2b'); break; }
    case 'disarm': hud.feedMsg(`${n} disarmed a trap`); break;
    case 'broken': hud.feedMsg('An enchanted tomb was desecrated!', '#c21d1d'); break;
    case 'kicked': if (!amMonster) hud.feedMsg('A tomb is being damaged…', '#c98b2b'); break;
    case 'sealed': if (e.to === me?.id) hud.banner('Your power is sealed by the tomb', 1800, '#b07ad1'); break;
    case 'noCrow': if (e.to === me?.id) hud.banner('No crow has screeched recently', 1500); break;
    case 'disguise': if (e.to === me?.id) hud.banner(`You wear the face of ${n}`, 2000, '#c21d1d'); break;
    case 'string': sfx.string(); break;
    case 'throw': sfx.throw(); break;
    case 'candle': sfx.candle(); break;
    case 'trail': if (amMonster) hud.banner('BLOOD TRAIL — their steps betray them', 2000, '#c21d1d'); break;
    case 'trapSet': if (e.to === me?.id) hud.feedMsg('Trap set', '#c98b2b'); break;
    default: break;
  }
  void s;
}
