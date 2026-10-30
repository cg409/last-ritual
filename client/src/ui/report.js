// "Report": send a bug report or opinion to the developers from inside the game. The player gives a Gmail address
// (so we can reply), writes a message and may attach up to two screenshots. It is delivered by the game server;
// the player is never sent to an e-mail app and never sees the developers' address.
import { show, on, q, esc } from './dom.js';
import { SERVER_URL } from '../session.js';
import { account } from '../profile.js';

// screenshots are shrunk in the browser (max 1280 px, JPEG) so they upload quickly even on mobile data
async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That file is not an image.')); i.src = url; });
    const k = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}

export function reportScreen({ onBack }) {
  const images = [];
  let sending = false;
  const draw = () => {
    const email = q('#rp-mail')?.value ?? '', msg = q('#rp-msg')?.value ?? '';
    show(`
      <div class="screen menuv2 noanim"><div class="mm-fade"></div>
        <div class="panel rp-panel">
          <div class="pf-bar"><button class="btn small" id="rp-back">&larr; Back</button><div class="h2" style="margin:0">Report / Feedback</div><span></span></div>
          <div class="lore rp-intro">Found a bug, or have an idea or an opinion? Tell the developers. We read everything and reply to your Gmail.</div>
          <input class="field" id="rp-mail" type="email" inputmode="email" autocomplete="email" maxlength="120" placeholder="Your Gmail (so we can reply)" value="${esc(email)}">
          <textarea class="field" id="rp-msg" rows="5" maxlength="4000" placeholder="Describe the problem or write your opinion...">${esc(msg)}</textarea>
          <div class="rp-shots">
            ${images.map((im, i) => `<div class="rp-shot"><img src="${im}" alt=""><button class="rp-x" data-del="${i}" title="Remove">&times;</button></div>`).join('')}
            ${images.length < 2 ? `<label class="rp-add btn small">+ Attach a screenshot (${images.length}/2)<input type="file" id="rp-file" accept="image/*" hidden></label>` : ''}
          </div>
          <div class="rp-err" id="rp-err"></div>
          <button class="btn primary" id="rp-send">Send report</button>
        </div>
      </div>`);
    on('#rp-back', 'click', onBack);
    on('[data-del]', 'click', (_, el) => { images.splice(+el.dataset.del, 1); draw(); });
    const file = q('#rp-file');
    if (file) file.addEventListener('change', async () => {
      const f = file.files[0]; if (!f) return;
      try { images.push(await shrink(f)); draw(); } catch (e) { q('#rp-err').textContent = e.message; }
    });
    on('#rp-send', 'click', async (_, btn) => {
      if (sending) return;
      const err = q('#rp-err'), e = q('#rp-mail').value.trim(), m = q('#rp-msg').value.trim();
      if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(e)) { err.textContent = 'Please enter a valid Gmail address so we can reply.'; return; }
      if (m.length < 5) { err.textContent = 'Please write a few words first.'; return; }
      sending = true; btn.disabled = true; btn.textContent = 'Sending...'; err.textContent = '';
      try {
        const r = await fetch(SERVER_URL + '/api/report', {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...(account.token ? { Authorization: 'Bearer ' + account.token } : {}) },
          body: JSON.stringify({ email: e, message: m, images, device: `${navigator.userAgent} | ${innerWidth}x${innerHeight}` }),
        }).then((x) => x.json());
        if (!r.ok) throw new Error(r.error || 'Could not send the report.');
        thanks();
      } catch (x) { sending = false; btn.disabled = false; btn.textContent = 'Send report'; err.textContent = x.message.includes('fetch') ? 'Could not reach the server. Check your connection and try again.' : x.message; }
    });
  };
  const thanks = () => {
    show(`
      <div class="screen menuv2 noanim"><div class="mm-fade"></div>
        <div class="panel rp-panel rp-done">
          <div class="rp-tick">&#10003;</div>
          <div class="h2">Report sent</div>
          <div class="lore">Thank you for helping us improve The Last Ritual!<br>The developers have received your message and will reply to you on your Gmail soon.</div>
          <button class="btn primary" id="rp-ok">Back to the menu</button>
        </div>
      </div>`);
    on('#rp-ok', 'click', onBack);
  };
  draw();
}