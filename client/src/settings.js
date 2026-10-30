// Persistent user settings: graphics preset + video, audio, controls (rebindable keys).
const KEY = 'hv-settings-v2';

// ultra: integrated graphics / no graphics card (e.g. i3 4th gen + 8GB RAM) — tiny render size, no
// shadows, no post-processing, sparse foliage, short view. mobile: phones & tablets.
// noPost = draw straight to the screen (no bloom / colour grade / AA passes); noMirror = no live reflection.
export const PRESETS = {
  ultra:  { label: 'Ultra low', hint: 'No graphics card', pixelRatio: 0.5, shadows: false, shadowRes: 512, bloom: false, antialias: false, foliage: 0.12, drawDist: 45, anisotropy: 1, lights: 2, noPost: true, noMirror: true },
  mobile: { label: 'Mobile', hint: 'Phones & tablets', pixelRatio: 0.65, shadows: false, shadowRes: 512, bloom: false, antialias: false, foliage: 0.2, drawDist: 55, anisotropy: 1, lights: 3, noPost: true, noMirror: true },
  low:    { label: 'Low',    pixelRatio: 0.75, shadows: false, shadowRes: 1024, bloom: false, antialias: false, foliage: 0.45, drawDist: 70,  anisotropy: 2, lights: 4 },
  medium: { label: 'Medium', pixelRatio: 1.0,  shadows: true,  shadowRes: 2048, bloom: true,  antialias: true,  foliage: 0.75, drawDist: 110, anisotropy: 4, lights: 8 },
  high:   { label: 'High',   pixelRatio: 1.5,  shadows: true,  shadowRes: 4096, bloom: true,  antialias: true,  foliage: 1.0,  drawDist: 160, anisotropy: 8, lights: 10 },
};

export const ACTIONS = [
  ['forward', 'Move forward', 'KeyW'], ['back', 'Move back', 'KeyS'], ['left', 'Move left', 'KeyA'], ['right', 'Move right', 'KeyD'],
  ['run', 'Run', 'ShiftLeft'], ['crouch', 'Crouch', 'KeyC'], ['crawl', 'Crawl', 'KeyX'], ['interact', 'Interact (hold)', 'KeyE'], ['heal', 'Self heal (hold)', 'KeyH'],
  ['skill', 'Skill check / struggle / jump', 'Space'], ['jump', 'Jump (extra key)', 'KeyJ'],
  ['light', 'Flashlight on / off', 'KeyF'], ['string', 'Use enchanted string', 'Digit2'], ['eye', 'Use The Eye', 'Digit3'],
  ['chat', 'Chat', 'Enter'], ['quick', 'Quick message wheel (hold)', 'KeyQ'], ['special', 'Monster special', 'KeyQ'], ['trap', 'Set trap', 'KeyT'],
  ['rev', 'Rev chainsaw', 'KeyR'], ['view', 'Mimic: 1st / 3rd person while disguised', 'KeyV'], ['drop', 'Drop survivor', 'KeyZ'], ['map', 'Toggle mini-map', 'KeyM'], ['spectate', 'Spectate toggle', 'Tab'],
];

const DEFAULTS = {
  preset: 'medium',
  video: { brightness: 1.0, fov: 70, filmGrain: false, vignette: true, motionBlur: false, showFps: false },
  audio: { master: 0.8, music: 0.6, sfx: 0.9 },
  controls: { sensitivity: 1.0, invertY: false, keys: Object.fromEntries(ACTIONS.map(([id, , k]) => [id, k])) },
  hud: { minimap: true, minimapSize: 200 },
};

function merge(a, b) {
  const o = { ...a };
  for (const k of Object.keys(b || {})) o[k] = a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? merge(a[k], b[k]) : b[k];
  return o;
}

let current = merge(DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}'));
// v3 migration: crouch is C by default (older saves had it on Ctrl).
if (!localStorage.getItem('hv-settings-mig3')) {
  current.controls.keys.crouch = 'KeyC';
  localStorage.setItem('hv-settings-mig3', '1'); localStorage.setItem(KEY, JSON.stringify(current));
}
// v4: the candle keys are gone — the flashlight moves to F.
if (!localStorage.getItem('hv-settings-mig4')) {
  const k = current.controls.keys;
  if (!k.light || k.light === 'KeyL') k.light = 'KeyF';
  delete k.candle; delete k.placeCandle; delete k.toggleCandle;
  localStorage.setItem('hv-settings-mig4', '1'); localStorage.setItem(KEY, JSON.stringify(current));
}
const listeners = new Set();

export const settings = () => current;
export const graphics = () => PRESETS[current.preset] || PRESETS.medium;
export function update(patch) {
  current = merge(current, patch);
  localStorage.setItem(KEY, JSON.stringify(current));
  listeners.forEach((fn) => fn(current));
}
export function resetSettings() { current = merge(DEFAULTS, {}); localStorage.setItem(KEY, JSON.stringify(current)); listeners.forEach((fn) => fn(current)); }
export const onSettings = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const keyName = (code) => (code || '').replace(/^Key/, '').replace(/^Digit/, '').replace('Left', ' L').replace('Right', ' R').replace('Space', 'SPACE');
