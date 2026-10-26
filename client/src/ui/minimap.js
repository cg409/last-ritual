// Mini-map: pre-rendered static layer (walls, buildings, trees, rocks, grass) + live markers
// (tombs, gallows, keys, gate, candles, survivors, you). The monster is NEVER drawn for survivors.
import { settings } from '../settings.js';

export class MiniMap {
  constructor(map, container) {
    this.map = map;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap';
    container.appendChild(this.canvas);
    this.base = document.createElement('canvas');
    this.base.width = this.base.height = 512;
    this.drawBase();
    this.visible = settings().hud.minimap;
  }

  toggle() { this.visible = !this.visible; }

  w2m(x, z, S) { const k = S / this.map.size; return [(x + this.map.size / 2) * k, (z + this.map.size / 2) * k]; }

  drawBase() {
    const c = this.base.getContext('2d'), S = 512, m = this.map, k = S / m.size;
    c.fillStyle = '#121410'; c.fillRect(0, 0, S, S);
    c.fillStyle = 'rgba(70,72,40,.35)';
    for (const g of m.grass) { const [x, y] = this.w2m(g.x, g.z, S); c.beginPath(); c.arc(x, y, g.r * k, 0, Math.PI * 2); c.fill(); }
    for (const r of m.rects) {
      const [x, y] = this.w2m(r.x - r.hw, r.z - r.hd, S);
      c.fillStyle = r.type === 'boundary' ? '#4a4a48' : r.type === 'building' ? '#6a5e50' : r.type === 'fence' ? '#3e3428' : r.type === 'car' ? '#3a3e44' : r.type === 'tomb' ? '#000' : '#555';
      if (r.type !== 'tomb') c.fillRect(x, y, Math.max(1.5, r.hw * 2 * k), Math.max(1.5, r.hd * 2 * k));
    }
    for (const b of m.buildings) { // roof outline
      const [x, y] = this.w2m(b.x - b.w / 2, b.z - b.d / 2, S);
      c.strokeStyle = 'rgba(160,140,110,.5)'; c.lineWidth = 1; c.strokeRect(x, y, b.w * k, b.d * k);
    }
    for (const ci of m.circles) {
      const [x, y] = this.w2m(ci.x, ci.z, S);
      c.fillStyle = ci.type === 'tree' ? '#24301c' : ci.type === 'rock' ? '#4e4e4a' : ci.type === 'bollard' ? '#7a7a70' : '#3c3a34';
      c.beginPath(); c.arc(x, y, Math.max(1.2, ci.r * k * (ci.type === 'tree' ? 2.2 : 1)), 0, Math.PI * 2); c.fill();
    }
  }

  draw(s, me, yaw) {
    const size = settings().hud.minimapSize;
    this.canvas.style.display = this.visible && me ? 'block' : 'none';
    if (!this.visible || !me) return;
    const dpr = Math.min(2, window.devicePixelRatio);
    if (this.canvas.width !== size * dpr) { this.canvas.width = this.canvas.height = size * dpr; this.canvas.style.width = this.canvas.style.height = size + 'px'; }
    const c = this.canvas.getContext('2d'), S = this.canvas.width;
    c.drawImage(this.base, 0, 0, S, S);
    const P = (x, z) => this.w2m(x, z, S), u = S / 200;
    const dot = (x, z, r, fill, stroke) => { const [a, b] = P(x, z); c.beginPath(); c.arc(a, b, r * u, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = u; c.stroke(); } };
    // gate
    const [gx, gy] = P(s.door.x, s.door.z);
    c.fillStyle = s.door.open ? '#e8d080' : '#b08d57'; c.fillRect(gx - 5 * u, gy - 2 * u, 10 * u, 4 * u);
    for (const h of this.map.hooks) { const [a, b] = P(h.x, h.z); c.strokeStyle = '#8a3a2a'; c.lineWidth = 1.2 * u; c.beginPath(); c.moveTo(a, b + 3 * u); c.lineTo(a, b - 3 * u); c.lineTo(a + 2.5 * u, b - 3 * u); c.stroke(); }
    for (const t of s.tombs) dot(t.x, t.z, 4, t.done ? '#b07ad1' : `rgba(176,122,209,${0.25 + t.progress * 0.6})`, '#d0b0ff');
    for (const t of this.map.towers) dot(t.x, t.z, 2, '#111', '#888');
    for (const k of s.keys) if (!k.taken) dot(k.x, k.z, 3, '#ffd060', '#fff');
    for (const cd of s.candles) if (cd.lit) dot(cd.x, cd.z, 1.6, '#ffb060');
    for (const p of s.players) {
      if (p.role === 'monster') {
        if (me.role !== 'monster') continue;      // survivors never see the monster on the map
      } else if (p.id !== me.id) {
        if (p.state === 'mouse' || p.state === 'escaped') continue;
        dot(p.x, p.z, 3, p.state === 'hooked' ? '#e33' : p.state === 'downed' || p.state === 'carried' ? '#c98b2b' : '#cfc4b3', '#000');
      }
    }
    // me: arrow in camera direction
    const [mx, my] = P(me.x, me.z);
    c.save(); c.translate(mx, my); c.rotate(-yaw + Math.PI);
    c.fillStyle = me.role === 'monster' ? '#c21d1d' : '#ffffff';
    c.beginPath(); c.moveTo(0, -6 * u); c.lineTo(4 * u, 4 * u); c.lineTo(0, 2 * u); c.lineTo(-4 * u, 4 * u); c.closePath(); c.fill();
    c.restore();
    c.strokeStyle = 'rgba(176,141,87,.6)'; c.lineWidth = 2; c.strokeRect(1, 1, S - 2, S - 2);
  }
}
