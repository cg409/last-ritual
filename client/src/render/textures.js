// Procedurally painted canvas textures (no external assets needed): mud/grass ground, stone, bark, wood.
import * as THREE from 'three';

function canvasTex(size, paint, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  paint(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);

function noise(ctx, s, n, colors, rMin, rMax, alpha = 0.3) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[(Math.random() * colors.length) | 0];
    ctx.globalAlpha = rnd(alpha * 0.3, alpha);
    ctx.beginPath(); ctx.arc(rnd(0, s), rnd(0, s), rnd(rMin, rMax), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export const makeGround = () => canvasTex(1024, (ctx, s) => {
  ctx.fillStyle = '#4a4434'; ctx.fillRect(0, 0, s, s);
  noise(ctx, s, 900, ['#575038', '#302a1c', '#4a5434', '#3a4228', '#5e5440'], 8, 60, 0.35);
  noise(ctx, s, 6000, ['#6a6248', '#26221a', '#4f5a38'], 1, 3, 0.5);
  ctx.strokeStyle = '#5a6a3a'; ctx.lineWidth = 1;
  for (let i = 0; i < 4000; i++) { // grass blades
    const x = rnd(0, s), y = rnd(0, s); ctx.globalAlpha = rnd(0.2, 0.6);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rnd(-3, 3), y - rnd(4, 10)); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}, 18);

export const makeStone = () => canvasTex(512, (ctx, s) => {
  ctx.fillStyle = '#7a766c'; ctx.fillRect(0, 0, s, s);
  noise(ctx, s, 600, ['#8a857a', '#5a564e', '#6e6a60', '#4a5a40'], 4, 30, 0.4);
  ctx.strokeStyle = '#25231f'; ctx.lineWidth = 3;
  const rowH = 64;
  for (let y = 0; y < s; y += rowH) { // brick courses
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
    const off = (y / rowH) % 2 ? 64 : 0;
    for (let x = off; x < s; x += 128) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + rowH); ctx.stroke(); }
  }
  noise(ctx, s, 200, ['#2c3a22', '#1e2a18'], 6, 24, 0.35); // moss
}, 1);

export const makeBark = () => canvasTex(256, (ctx, s) => {
  ctx.fillStyle = '#4a3e32'; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 260; i++) {
    ctx.strokeStyle = Math.random() < 0.5 ? '#1a140f' : '#3a2e24'; ctx.globalAlpha = rnd(0.3, 0.8); ctx.lineWidth = rnd(1, 4);
    const x = rnd(0, s); ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + rnd(-8, 8), s / 3, x + rnd(-8, 8), (2 * s) / 3, x + rnd(-6, 6), s); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}, 1);

export const makeWood = () => canvasTex(256, (ctx, s) => {
  ctx.fillStyle = '#6a5038'; ctx.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 32) { ctx.fillStyle = '#1a120b'; ctx.fillRect(0, y, s, 2); }
  for (let i = 0; i < 400; i++) {
    ctx.strokeStyle = Math.random() < 0.5 ? '#2a1d12' : '#4a3626'; ctx.globalAlpha = rnd(0.2, 0.6);
    const y = rnd(0, s); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y + rnd(-3, 3)); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}, 1);

export const makeRune = () => canvasTex(256, (ctx, s) => {
  ctx.clearRect(0, 0, s, s);
  ctx.strokeStyle = '#d0a0ff'; ctx.lineWidth = 4; ctx.shadowColor = '#a050ff'; ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.32, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 5; i++) { // pentagram
    const a1 = (i / 5) * Math.PI * 2 - Math.PI / 2, a2 = ((i + 2) / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(s / 2 + Math.cos(a1) * s * 0.32, s / 2 + Math.sin(a1) * s * 0.32);
    ctx.lineTo(s / 2 + Math.cos(a2) * s * 0.32, s / 2 + Math.sin(a2) * s * 0.32); ctx.stroke();
  }
  ctx.font = '22px serif'; ctx.fillStyle = '#d0a0ff';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2; ctx.save(); ctx.translate(s / 2 + Math.cos(a) * s * 0.37, s / 2 + Math.sin(a) * s * 0.37); ctx.rotate(a + Math.PI / 2);
    ctx.fillText('ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ'[i], -7, 7); ctx.restore();
  }
}, 1);

export const makeFootprint = () => canvasTex(64, (ctx) => {
  ctx.fillStyle = '#b01010';
  ctx.beginPath(); ctx.ellipse(32, 38, 10, 16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(32, 16, 8, 8, 0, 0, Math.PI * 2); ctx.fill();
}, 1);
