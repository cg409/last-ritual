// Tiny DOM helpers for the UI layer.
import { sfx } from '../audio.js';

export const $ui = () => document.getElementById('ui');
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export function show(html) {
  const ui = $ui();
  ui.innerHTML = html;
  ui.querySelectorAll('.btn, .card').forEach((b) => {
    b.addEventListener('mouseenter', () => sfx.hover());
    b.addEventListener('click', () => sfx.click());
  });
  return ui;
}
export function on(sel, ev, fn, root = $ui()) { root.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, (e) => fn(e, el))); }
export const q = (sel, root = $ui()) => root.querySelector(sel);
