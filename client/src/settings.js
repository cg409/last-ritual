// Persistent user settings: graphics preset + video, audio, controls (rebindable keys).
const KEY = 'hv-settings-v2';

export const PRESETS = {
  low:    { label: 'Low',    pixelRatio: 0.75, shadows: false, shadowRes: 1024, bloom: false, antialias: false, foliage: 0.45, drawDist: 70,  anisotropy: 2, lights: 6 },
  medium: { label: 'Medium', pixelRatio: 1.0,  shadows: true,  shadowRes: 2048, bloom: true,  antialias: true,  foliage: 0.75, drawDist: 110, anisotropy: 4, lights: 10 },
  high:   { label: 'High',   pixelRatio: 1.5,  shadows: true,  shadowRes: 4096, bloom: true,  antialias: true,  foliage: 1.0,  drawDist: 160, anisotropy: 8, lights: 14 },
};

export const ACTIONS = [
  ['forward', 'Move forward', 'KeyW'], ['back', 'Move back', 'KeyS'], ['left', 'Move left', 'KeyA'], ['right', 'Move right', 'KeyD'],
  ['run', 'Run', 'ShiftLeft'], ['crouch', 'Crouch', 'KeyC'], ['crawl', 'Crawl', 'KeyX'], ['interact', 'Interact (hold)', 'KeyE'],
  ['skill', 'Skill check / struggle / jump', 'Space'], ['jump', 'Jump (extra key)', 'KeyJ'], ['candle', 'Hold candle', 'KeyF'], ['placeCandle', 'Place / pick up candle', 'KeyG'],
  ['toggleCandle', 'Light / snuff candle', 'KeyV'], ['special', 'Monster special', 'KeyQ'], ['trap', 'Set trap', 'KeyT'],
  ['rev', 'Rev chainsaw', 'KeyR'], ['drop', 'Drop survivor', 'KeyZ'], ['map', 'Toggle mini-map', 'KeyM'], ['spectate', 'Spectate toggle', 'Tab'],
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
