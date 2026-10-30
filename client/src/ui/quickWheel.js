// Quick-message wheel (survivors): hold Q, move the mouse toward a message, release to send.
// The message shows to the team at the top of the screen in the hand-written lettering
// (assets/quick/*.png) with the sender's name. 20s cooldown.
export const QUICK = [
  { id: 'run', label: 'Run!' },
  { id: 'come', label: 'Come here' },
  { id: 'heal', label: 'Heal me' },
  { id: 'help', label: 'Help me' },
  { id: 'monster', label: 'The monster is here' },
];
const img = (id) => `${import.meta.env.BASE_URL}assets/quick/${id}.png`;
// preload so the first message pops in instantly
for (const q of QUICK) { const i = new Image(); i.src = img(q.id); }

export class QuickWheel {
  constructor(parent) {
    this.el = document.createElement('div');
    this.el.className = 'qwheel';
    const n = QUICK.length;
    this.el.innerHTML = `<div class="qw-ring">${QUICK.map((q, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      return `<div class="qw-item" data-i="${i}" style="left:${50 + Math.cos(a) * 36}%;top:${50 + Math.sin(a) * 36}%">${q.label}</div>`;
    }).join('')}<div class="qw-hub"><div class="qw-ptr"></div><span id="qw-cd"></span></div></div>`;
    parent.appendChild(this.el);
    this.open = false; this.sel = -1; this.vx = 0; this.vy = 0;
  }
  show(cd) {
    this.open = true; this.sel = -1; this.vx = this.vy = 0;
    this.el.classList.add('on'); this.el.classList.toggle('cool', cd > 0);
    this.el.querySelector('#qw-cd').textContent = cd > 0 ? `${Math.ceil(cd)}s` : '';
    this.mark();
  }
  move(dx, dy) {
    this.vx = Math.max(-120, Math.min(120, this.vx + dx)); this.vy = Math.max(-120, Math.min(120, this.vy + dy));
    if (Math.hypot(this.vx, this.vy) < 28) { this.sel = -1; this.mark(); return; }
    const a = Math.atan2(this.vy, this.vx) + Math.PI / 2, n = QUICK.length;
    this.sel = ((Math.round((a / (Math.PI * 2)) * n) % n) + n) % n;
    this.el.querySelector('.qw-ptr').style.transform = `rotate(${Math.atan2(this.vy, this.vx) + Math.PI / 2}rad)`;
    this.mark();
  }
  mark() { this.el.querySelectorAll('.qw-item').forEach((e, i) => e.classList.toggle('sel', i === this.sel)); this.el.classList.toggle('aimed', this.sel >= 0); }
  close() { this.open = false; this.el.classList.remove('on'); const s = this.sel; this.sel = -1; return s >= 0 ? QUICK[s].id : null; }
  dispose() { this.el.remove(); }
}

// Top-of-screen team messages.
export function showQuick(parent, name, id) {
  let box = parent.querySelector('.qmsgs');
  if (!box) { box = document.createElement('div'); box.className = 'qmsgs'; parent.appendChild(box); }
  const m = document.createElement('div');
  m.className = 'qmsg';
  m.innerHTML = `<div class="qn"></div><img alt="" src="${img(id)}">`;
  m.querySelector('.qn').textContent = name;
  box.appendChild(m);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => m.classList.add('out'), 5000);
  setTimeout(() => m.remove(), 6000);
}
