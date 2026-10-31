// Monster ability bar (cooldowns, sealed / weakened state).
import { MONSTERS, WEAPONS } from '@shared/constants.js';

export function abilitiesHtml(s, me) {
  const sealed = s.phase >= 1;
  const box = (label, keyName, cd, off) => `<div class="ab"><div class="box ${cd > 0 ? 'cd' : ''} ${off ? 'sealed' : ''}">${label}${cd > 0 ? `<br>${Math.ceil(cd)}` : ''}</div><small>${keyName}</small></div>`;
  const special = { mimic: me.disguise ? 'UNMASK' : 'DISGUISE', wanderer: 'CROW SIGHT', puppeteer: 'BLACKOUT', ravager: 'BLOOD TRAIL', stalker: 'TRIDENT' }[me.monster];
  let html = box(special, me.monster === 'stalker' ? 'RMB' : 'Q', me.monster === 'stalker' ? me.tridentCd : me.specialCd, sealed && !(me.monster === 'mimic' && me.disguise));
  if (me.monster === 'puppeteer') html += box('STRING', 'RMB', me.stringCd, false);
  if (me.monster === 'ravager') html += box('CHAINSAW', 'R', 0, false);
  if (me.monster === 'mimic' && me.disguise) html += box('VIEW', 'V', 0, false);
  html += box(`TRAPS ×${me.traps}`, 'T', 0, me.traps <= 0);
  const note = s.phase >= 2 ? '<span style="color:#b07ad1">Weakened: slower, shorter reach</span>'
    : sealed ? '<span style="color:#b07ad1">Special sealed by the first tomb</span>' : MONSTERS[me.monster].name + (WEAPONS[me.weapon] ? ` <small style="opacity:.7">${WEAPONS[me.weapon].name}</small>` : '');
  return html + `<div class="hint" style="margin-top:6px">${note}</div>`;
}
