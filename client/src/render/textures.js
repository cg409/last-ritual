// Small procedural canvas textures (runes, footprints, leaf cards). Surfaces use real PBR sets (assets.js).
import * as THREE from 'three';

function canvasTex(size, paint) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  paint(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export const makeRune = () => canvasTex(256, (ctx, s) => {
  ctx.strokeStyle = '#d0a0ff'; ctx.lineWidth = 4; ctx.shadowColor = '#a050ff'; ctx.shadowBlur = 16;
  ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.32, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const a1 = (i / 5) * Math.PI * 2 - Math.PI / 2, a2 = ((i + 2) / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(s / 2 + Math.cos(a1) * s * 0.32, s / 2 + Math.sin(a1) * s * 0.32);
    ctx.lineTo(s / 2 + Math.cos(a2) * s * 0.32, s / 2 + Math.sin(a2) * s * 0.32); ctx.stroke();
  }
  ctx.font = '22px serif'; ctx.fillStyle = '#d0a0ff';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2; ctx.save(); ctx.translate(s / 2 + Math.cos(a) * s * 0.37, s / 2 + Math.sin(a) * s * 0.37); ctx.rotate(a + Math.PI / 2);
    ctx.fillText('ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ'[i], -7, 7); ctx.restore();
  }
});

export const makeFootprint = () => canvasTex(64, (ctx) => {
  ctx.fillStyle = '#b01010';
  ctx.beginPath(); ctx.ellipse(32, 38, 10, 16, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(32, 16, 8, 8, 0, 0, Math.PI * 2); ctx.fill();
});

// Dead-leaf / twig cluster card with alpha, for tree crowns.
export const makeTwigCard = () => canvasTex(256, (ctx, s) => {
  ctx.clearRect(0, 0, s, s);
  const branch = (x, y, a, len, w, depth) => {
    if (depth === 0 || len < 4) return;
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    ctx.strokeStyle = depth > 2 ? '#1e1712' : '#2a2018'; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    if (depth <= 2 && Math.random() < 0.6) { ctx.fillStyle = Math.random() < 0.5 ? '#3a2a18' : '#2c2a18'; ctx.beginPath(); ctx.ellipse(x2, y2, 3, 1.6, a, 0, Math.PI * 2); ctx.fill(); }
    for (let i = 0; i < 2 + (Math.random() < 0.4); i++) branch(x2, y2, a + (Math.random() - 0.5) * 1.3, len * (0.6 + Math.random() * 0.2), w * 0.65, depth - 1);
  };
  branch(s / 2, s, -Math.PI / 2, s * 0.32, 6, 6);
});
