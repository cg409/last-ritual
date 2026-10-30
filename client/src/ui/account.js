// Sign in / create account / recover account / continue as guest, and the one-time recovery key.
import { GAME_NAME } from '@shared/constants.js';
import { show, on, q, esc } from './dom.js';
import { gameTitle } from '../title.js';
import { signIn, signUp, recoverAccount, playAsGuest } from '../profile.js';

export function authScreen({ onDone, mode = 'signin', error = '' }) {
  const tabs = [['signin', 'Sign in'], ['signup', 'Create account'], ['recover', 'Recover account']];
  const fields = {
    signin: `<input class="field" id="au-name" maxlength="16" placeholder="Name" autocomplete="username" />
             <input class="field" id="au-pass" type="password" placeholder="Password" autocomplete="current-password" />`,
    signup: `<input class="field" id="au-name" maxlength="16" placeholder="Choose a name (3–16 letters, numbers, _)" autocomplete="username" />
             <input class="field" id="au-pass" type="password" placeholder="Password (6+ characters)" autocomplete="new-password" />
             <input class="field" id="au-pass2" type="password" placeholder="Repeat the password" autocomplete="new-password" />`,
    recover: `<div class="au-note">Lost your password? Enter your name and the recovery key you were given when you created the account.</div>
              <input class="field" id="au-name" maxlength="16" placeholder="Name" />
              <input class="field" id="au-key" maxlength="24" placeholder="Recovery key  (XXXX-XXXX-XXXX-XXXX)" style="text-transform:uppercase" />
              <input class="field" id="au-pass" type="password" placeholder="New password (6+ characters)" autocomplete="new-password" />`,
  };
  const go = { signin: 'Enter', signup: 'Create account', recover: 'Reset password' };
  show(`
    <div class="screen menuv2"><div class="mm-fade"></div>
      <div class="panel col au-panel">
        <div class="lb-brand">${esc(gameTitle())}</div>
        <div class="au-tabs">${tabs.map(([id, l]) => `<button class="au-tab ${id === mode ? 'on' : ''}" data-tab="${id}">${l}</button>`).join('')}</div>
        <div class="err" id="au-err">${esc(error)}</div>
        <form class="col" id="au-form" onsubmit="return false">${fields[mode]}
          <button class="btn primary" id="au-go" type="submit">${go[mode]}</button>
        </form>
        <div class="au-or"><i></i><span>or</span><i></i></div>
        <button class="btn small" id="au-guest">Continue as guest</button>
        <div class="au-note">Guests keep their progress in this browser only. Sign in to keep your level, unlocks and achievements everywhere.</div>
      </div>
    </div>`);
  on('[data-tab]', 'click', (_, el) => authScreen({ onDone, mode: el.dataset.tab }));
  on('#au-guest', 'click', () => { playAsGuest(); onDone(); });
  const err = (t) => { q('#au-err').textContent = t; };
  q('#au-form').addEventListener('submit', async () => {
    const name = q('#au-name')?.value.trim(), pass = q('#au-pass')?.value || '';
    const btn = q('#au-go'); btn.disabled = true; err('');
    try {
      let res;
      if (mode === 'signin') res = await signIn(name, pass);
      else if (mode === 'signup') {
        if (pass !== q('#au-pass2').value) { err('The passwords do not match.'); btn.disabled = false; return; }
        res = await signUp(name, pass);
      } else res = await recoverAccount(name, q('#au-key').value, pass);
      if (!res.ok) { err(res.error || 'Something went wrong.'); btn.disabled = false; return; }
      if (res.recovery) recoveryScreen(res.recovery, mode === 'recover', onDone); else onDone();
    } catch (e) { err(e.message || 'Could not reach the server.'); btn.disabled = false; }
  });
  setTimeout(() => q('#au-name')?.focus(), 50);
}

// Shown once after sign-up / recovery: the only way back into the account without the password.
function recoveryScreen(key, renewed, onDone) {
  show(`
    <div class="screen menuv2"><div class="mm-fade"></div>
      <div class="panel col au-panel">
        <div class="lb-brand">${esc(gameTitle())}</div>
        <div class="h2">${renewed ? 'Password reset' : 'Your recovery key'}</div>
        <div class="au-note">${renewed ? 'Your old recovery key no longer works. Here is your new one.' : 'If you ever forget your password, this key is the only way to recover the account.'}
          <b>Write it down and keep it safe — it is shown only once.</b></div>
        <div class="au-key" id="au-k">${esc(key)}</div>
        <button class="btn small" id="au-copy">Copy</button>
        <button class="btn primary" id="au-ok">I have saved it</button>
      </div>
    </div>`);
  on('#au-copy', 'click', () => { navigator.clipboard?.writeText(key); q('#au-copy').textContent = 'Copied'; });
  on('#au-ok', 'click', onDone);
}
