// The game's displayed title. Finding the Heart of the Ritual renames the game for the rest of
// the session (kept in memory only — closing the game restores it).
import { GAME_NAME } from '@shared/constants.js';

let title = GAME_NAME;
export const gameTitle = () => title;
export function setGameTitle(t) {
  title = t;
  document.title = t.toUpperCase();
  document.querySelectorAll('.lb-brand').forEach((e) => { e.textContent = t; });
}
