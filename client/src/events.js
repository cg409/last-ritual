// Turns simulation events into sounds, banners and kill-feed lines.
import { sfx } from './audio.js';
import { esc } from './ui/dom.js';
import { TRAPS, CHESTS } from '@shared/constants.js';
import { playClip } from './sounds.js';

export function eventFeed(m, e, me, s) {
  const hud = m.hud; if (!hud) return;
  const amMonster = me?.role === 'monster';
  const P = (x, z) => m.pan(x, z);
  const n = esc(e.name);
  switch (e.t) {
    case 'enchanted': sfx.enchant(); hud.feedMsg(`${n} enchanted a tomb (${e.count}/3)`, '#b07ad1'); break;
    case 'phase': hud.banner(esc(e.msg), 4500, e.phase === 3 ? '#d4a840' : '#b07ad1'); break;
    case 'fail': { const p = P(e.x, e.z); sfx.fail(p.pan); if (e.tomb != null) hud.feedMsg(`${n} cracked a tomb`, '#c98b2b');
      if (amMonster) { sfx.aura(); hud.banner(`${n} botched a rite — you see them`, 2000, '#e8c050'); }
      else if (e.id === me?.id || e.name === me?.name) hud.banner('You failed — the monster sees you!', 1800, '#e8c050'); break; }
    case 'crows': { const p = P(e.x, e.z); sfx.crows(p.pan, p.vol); if (amMonster && me.monster === 'wanderer') hud.feedMsg('The crows screech… (Q to go)', '#c21d1d'); break; }
    case 'saw': { const p = P(e.x, e.z); playClip('chainsaw', { pan: p.pan, vol: 0.35 + p.vol * 0.65, dur: 2.6, offset: 0.4 + Math.random() * 6 }); break; }
    case 'lightning': { const p = P(e.x, e.z); sfx.thunder(p.pan); hud.flash(); break; }
    case 'blackout': sfx.blackout(); hud.banner(amMonster ? 'BLACKOUT — they cannot see' : 'THE LIGHTS DIE', 2500, '#c21d1d'); break;
    case 'teleport': { const p = P(e.x, e.z); sfx.teleport(p.pan); break; }
    case 'exposed': { const p = P(e.x, e.z); sfx.exposed(p.pan); playClip('bones', { pan: p.pan, vol: p.vol, dur: 2.5 }); hud.feedMsg('The Mimic was exposed by the light!', '#ffb060'); if (amMonster) hud.banner('THE LIGHT BURNS — you are hurled away', 2500, '#ffb060'); break; }
    case 'hit': { const p = P(e.x, e.z); playClip('hit', e.id === me?.id ? { vol: 1 } : { pan: p.pan, vol: p.vol * 0.8 }); break; }
    case 'swing': if (amMonster) sfx.swing(); break;
    case 'downed': hud.feedMsg(`${n} is down`, '#c21d1d'); break;
    case 'hooked': hud.feedMsg(`${n} was hanged`, '#c21d1d'); { const p = P(e.x, e.z); playClip('hung', { pan: e.id === me?.id ? 0 : p.pan, vol: e.id === me?.id ? 1 : Math.max(0.45, p.vol) }); }
      if (!amMonster && me?.state !== 'mouse' && e.id !== me?.id) { sfx.aura(); hud.banner('The noose tightens — you sense the monster', 2200, '#c21d1d'); } break;
    case 'rescued': hud.feedMsg(e.by === e.name ? `${n} broke free!` : `${esc(e.by)} rescued ${n}`, '#8fc46a'); break;
    case 'killed': hud.feedMsg(`${n} ${e.how === 'slain' ? 'was slain' : e.how === 'sacrificed' ? 'died on the gallows' : e.how}… now a mouse`, '#c21d1d');
      if (e.id === me?.id) hud.banner('YOU DIED<br><span style="font-size:16px">You return as a mouse. Watch. Wait.</span>', 5000, '#c21d1d'); break;
    case 'healed': hud.feedMsg(e.self ? `${n} patched their own wounds` : `${esc(e.by || '')} tended ${n}`, '#8fc46a'); break;
    case 'wiggleFree': hud.feedMsg(`${n} wriggled free!`, '#8fc46a'); break;
    case 'key': sfx.key(); hud.feedMsg(`${n} found a key`, '#d4a840'); break;
    case 'keysIn': hud.feedMsg(`Keys in the gate: ${e.keys}/3`, '#d4a840'); break;
    case 'doorOpen': sfx.door(); hud.banner('THE GATE IS OPEN', 5000, '#d4a840'); break;
    case 'escaped': hud.feedMsg(`${n} escaped`, '#8fc46a'); if (e.id === me?.id) hud.banner('YOU ESCAPED', 5000, '#8fc46a'); break;
    case 'trap': { const p = P(e.x, e.z); sfx.trap(p.pan);
      const tn = TRAPS[e.type]?.name || 'a trap';
      if (e.id === me?.id) hud.banner({ bear: 'FOOTHOLD TRAP — pass 2 skill checks to break free', poison: 'POISONED — your senses swim', cursed: 'CURSED — the fog takes your sight', spike: 'SPIKES — you are wounded and slowed' }[e.type] || 'TRAPPED', 2600, '#e06040');
      else hud.feedMsg(amMonster ? `${n} is caught in your ${tn} — you see them` : `${n} triggered a ${tn}`, '#c98b2b');
      if (amMonster) sfx.aura(); break; }
    case 'trapStruggle': if (e.id === me?.id) hud.feedMsg(e.ok ? `The jaws give a little… (${e.passed}/2)` : 'The jaws bite deeper…', e.ok ? '#8fc46a' : '#c98b2b'); break;
    case 'trapFree': hud.feedMsg(`${n} pried the trap open`, '#8fc46a'); break;
    case 'chest': {
      { const p = P(e.x, e.z); if (e.id === me?.id || p.vol > 0.75) playClip('chest', { pan: e.id === me?.id ? 0 : p.pan, vol: e.id === me?.id ? 1 : p.vol * 0.7 }); }
      const l = e.loot || {}, parts = [l.coins && `${l.coins} ritual coins`, l.shards && `${l.shards} soul shards`, l.bandage && 'a bandage', l.battery && `${l.battery} batter${l.battery > 1 ? 'ies' : 'y'}`,
        l.string && `${l.string} enchanted string${l.string > 1 ? 's' : ''}`, l.eye && `${l.eye} × The Eye`, l.unlimited && 'an everlasting flashlight'].filter(Boolean);
      if (e.id === me?.id) hud.banner(`${CHESTS[e.tier].name.toUpperCase()}<br><span style="font-size:15px">${parts.join(' · ')}</span>`, 4200, e.tier === 'cursed' ? '#b07ad1' : e.tier === 'ritual' ? '#d4a840' : '#cfc4b3');
      else if (amMonster && e.tier !== 'supply') { sfx.aura(); hud.banner(`Someone opened a ${CHESTS[e.tier].name} — you sense them`, 2500, '#e8c050'); }
      break; }
    case 'useItem': if (e.id === me?.id) hud.banner(e.item === 'eye' ? 'THE EYE OPENS — you see the monster' : 'The string pulls toward every tomb', 2400, e.item === 'eye' ? '#c21d1d' : '#b07ad1'); break;
    case 'enchantStart': if (!amMonster && e.id !== me?.id) hud.feedMsg(`${n} began a rite — you can see them`, '#b07ad1'); break;
    case 'adrenaline': if (e.id === me?.id) hud.banner('ADRENALINE', 1200, '#a8d080'); break;
    case 'disarm': hud.feedMsg(`${n} disarmed a trap`); break;
    case 'broken': hud.feedMsg('An enchanted tomb was desecrated!', '#c21d1d'); break;
    case 'kicked': if (!amMonster) hud.feedMsg('A tomb is being damaged…', '#c98b2b'); break;
    case 'sealed': if (e.to === me?.id) hud.banner('Your power is sealed by the tomb', 1800, '#b07ad1'); break;
    case 'noCrow': if (e.to === me?.id) hud.banner('No crow has screeched recently', 1500); break;
    case 'disguise': if (e.to === me?.id) playClip('bones', { vol: 0.6, dur: 2.2 });
      if (e.to === me?.id) hud.banner(`You wear the face of ${n}`, 2000, '#c21d1d'); break;
    case 'string': sfx.string(); break;
    case 'throw': sfx.throw(); break;
    case 'trail': if (amMonster) hud.banner('BLOOD TRAIL — their steps betray them', 2000, '#c21d1d'); break;
    case 'trip': { const p = P(e.x, e.z); sfx.trip(p.pan, e.id === me?.id ? 0.9 : (p.vol ?? 0.5));
      if (e.id === me?.id) hud.banner(`You tripped over a ${e.kind === 'pallet' ? 'pallet' : 'log'}!`, 1400, '#c98b2b');
      else hud.feedMsg(amMonster ? `${n} stumbled — strike now!` : `${n} tripped over a ${e.kind}`, '#c98b2b'); break; }
    case 'pallet': { const p = P(e.x, e.z), log = e.kind === 'log';
      if (log) playClip('logs', { pan: p.pan, vol: p.vol }); else playClip('pallet', { pan: p.pan, vol: p.vol }); // falling log / slammed pallet
      if (e.stun) { hud.feedMsg(`${n} brought a ${log ? 'log' : 'pallet'} down on the monster!`, '#8fc46a'); if (amMonster) hud.banner(`STUNNED BY A ${log ? 'FALLING LOG' : 'PALLET'}`, 1800, '#c98b2b'); }
      break; }
    case 'palletBreak': { const p = P(e.x, e.z); sfx.palletBreak(p.pan, p.vol * 0.6); playClip('pallet', { pan: p.pan, vol: p.vol * 0.8, rate: 0.75 }); if (!amMonster) hud.feedMsg('A pallet was smashed', '#c98b2b'); break; }
    case 'land': if (e.id === me?.id) sfx.trip(0, 0.6); break;
    case 'hide': case 'unhide': { const p = P(e.x, e.z); if (p.vol > 0.6 || e.id === me?.id) sfx.creak(p.pan, e.id === me?.id ? 0.8 : p.vol * 0.6); break; }
    case 'search': { const p = P(e.x, e.z); sfx.doorBang(p.pan, Math.max(0.3, p.vol));
      if (e.found && !amMonster) hud.feedMsg('Someone was dragged out of their hiding place!', '#c21d1d');
      if (amMonster) hud.feedMsg(e.found ? 'Found one!' : 'Empty…', e.found ? '#c21d1d' : '#8a8072'); break; }
    case 'trapSet': if (e.to === me?.id) hud.feedMsg('Trap set', '#c98b2b'); break;
    default: break;
  }
  void s;
}
