// Level-up celebration, shown when you come back to the lobby (or menu) after a match that raised
// your level: a burning diamond, the number counting up, embers rising, and the level-up sound.
import { playClip } from '../sounds.js';

export function levelUpAnim(from, to) {
  document.querySelector('.lvup')?.remove();
  const el = document.createElement('div');
  el.className = 'lvup';
  el.innerHTML = `<div class="lv-rays"></div><div class="lv-dia"><span>LEVEL</span><b>${from}</b></div>
    <div class="lv-t">LEVEL UP</div><div class="lv-s">The ritual remembers you.</div>`
    + Array.from({ length: 26 }, (_, i) => `<i class="lv-e" style="left:${40 + Math.random() * 20}%;animation-delay:${(i * 0.09).toFixed(2)}s;--dx:${(Math.random() - 0.5) * 260}px"></i>`).join('');
  document.body.appendChild(el);
  playClip('levelUp', { vol: 0.9 });
  const b = el.querySelector('.lv-dia b');
  let n = from;
  const step = () => { if (n >= to) return; n++; b.textContent = n; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); setTimeout(step, 380); };
  setTimeout(step, 700);
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 700); };
  setTimeout(close, 4600);
  el.addEventListener('click', close);
}
