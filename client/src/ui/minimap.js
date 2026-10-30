// Mini-map: pre-rendered static layer (walls, buildings, trees, rocks, grass) + live markers
// (tombs, gallows, keys, gate, candles, survivors, you). The monster is NEVER drawn for survivors.
import { settings } from '../settings.js';

const pulse0 = () => 1 + Math.sin(performance.now() / 160) * 0.3;

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
      if (r.type === 'tomb' || r.lv) continue; // tombs aren't on the base map (only the monster sees them, live)
      c.fillStyle = r.type === 'boundary' ? '#4a4a48' : r.type === 'building' ? '#6a5e50' : r.type === 'fence' ? '#3e3428' : r.type === 'car' ? '#3a3e44'
        : r.type === 'grave' ? '#4a4a44' : r.type === 'cemwall' || r.type === 'mausoleum' ? '#6a6a62' : '#555';
      c.fillRect(x, y, Math.max(1.5, r.hw * 2 * k), Math.max(1.5, r.hd * 2 * k));
    }
    for (const b of m.buildings) { // roof outline
      const [x, y] = this.w2m(b.x - b.w / 2, b.z - b.d / 2, S);
      c.strokeStyle = 'rgba(160,140,110,.5)'; c.lineWidth = 1; c.strokeRect(x, y, b.w * k, b.d * k);
    }
    for (const p of m.pallets) { // escape pallets: small wooden marks at the doorways
      const [x, y] = this.w2m(p.x, p.z, S);
      c.fillStyle = '#b08850'; c.fillRect(x - 3, y - 3, 6, 6);
    }
    if (m.cemetery) { // cemetery label
      const [x, y] = this.w2m(m.cemetery.x, m.cemetery.z, S);
      c.fillStyle = 'rgba(200,190,170,.55)'; c.font = '14px serif'; c.textAlign = 'center'; c.fillText('✝', x, y + 5); c.textAlign = 'left';
    }
    for (const ci of m.circles) {
      const [x, y] = this.w2m(ci.x, ci.z, S);
      c.fillStyle = ci.type === 'tree' ? '#24301c' : ci.type === 'rock' ? '#4e4e4a' : ci.type === 'bollard' ? '#7a7a70' : '#3c3a34';
      c.beginPath(); c.arc(x, y, Math.max(1.2, ci.r * k * (ci.type === 'tree' ? 2.2 : 1)), 0, Math.PI * 2); c.fill();
    }
  }

  // Who sees what (DbD-like):
  //  Survivors: allies, gate, keys (no tombs). The monster only while its aura shows (after a hanging).
  //  Monster:   tombs, gate, keys — but survivors ONLY while their aura shows (failed skill check, trap).
  //  The dead (rat) and escapees: everything — monster, survivors, tombs, gate, keys.
  // extra: { seenTombs: Set (tombs this survivor has found), pings: [{x,z,until}] (rare chests opened — monster) }
  draw(s, me, yaw, extra = {}) {
    const size = settings().hud.minimapSize;
    const ghost = me && (me.state === 'mouse' || me.state === 'escaped');
    const show = !!(this.visible && me);
    this.canvas.style.display = show ? 'block' : 'none';
    if (!show) return;
    const amMonster = me.role === 'monster';
    const seeAll = ghost;
    const dpr = Math.min(2, window.devicePixelRatio);
    if (this.canvas.width !== size * dpr) { this.canvas.width = this.canvas.height = size * dpr; this.canvas.style.width = this.canvas.style.height = size + 'px'; }
    const c = this.canvas.getContext('2d'), S = this.canvas.width;
    c.drawImage(this.base, 0, 0, S, S);
    const P = (x, z) => this.w2m(x, z, S), u = S / 200;
    const dot = (x, z, r, fill, stroke) => { const [a, b] = P(x, z); c.beginPath(); c.arc(a, b, r * u, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = u; c.stroke(); } };
    // gate: always on the map; once unlocked it shines
    const [gx, gy] = P(s.door.x, s.door.z);
    if (s.door.open) {
      const pr = (8 + Math.sin(performance.now() / 220) * 3) * u, gr = c.createRadialGradient(gx, gy, 0, gx, gy, pr * 2);
      gr.addColorStop(0, 'rgba(255,225,140,.95)'); gr.addColorStop(0.4, 'rgba(255,200,90,.45)'); gr.addColorStop(1, 'rgba(255,200,90,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(gx, gy, pr * 2, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = s.door.open ? '#fff2c0' : '#b08d57'; c.fillRect(gx - 5 * u, gy - 2 * u, 10 * u, 4 * u);
    c.strokeStyle = '#000'; c.lineWidth = u * 0.8; c.strokeRect(gx - 5 * u, gy - 2 * u, 10 * u, 4 * u);
    for (const h of this.map.hooks) { const [a, b] = P(h.x, h.z); c.strokeStyle = '#8a3a2a'; c.lineWidth = 1.2 * u; c.beginPath(); c.moveTo(a, b + 3 * u); c.lineTo(a, b - 3 * u); c.lineTo(a + 2.5 * u, b - 3 * u); c.stroke(); }
    // tombs: the monster knows them all; survivors see the ones they have found (or all, with the string)
    for (const t of s.tombs) {
      if (!(amMonster || seeAll || me.tombSight || extra.seenTombs?.has(t.id))) continue;
      dot(t.x, t.z, me.tombSight && !t.done ? 4 * pulse0() : 4, t.done ? '#b07ad1' : `rgba(176,122,209,${0.25 + t.progress * 0.6})`, '#d0b0ff');
    }
    if (amMonster) for (const pg of extra.pings || []) { // a rare chest was opened over there
      const k = (pg.until - performance.now()) / 8000; if (k <= 0) continue;
      const [a, b] = P(pg.x, pg.z); c.strokeStyle = `rgba(232,192,80,${k})`; c.lineWidth = 1.5 * u;
      c.beginPath(); c.arc(a, b, (10 - k * 6) * u, 0, Math.PI * 2); c.stroke(); dot(pg.x, pg.z, 2.2, '#e8c050');
    }
    for (const t of this.map.towers) dot(t.x, t.z, 2, '#111', '#888');
    for (const l of this.map.logs || []) { // fallen logs (solid, jumpable)
      const [a, b] = P(l.x, l.z), k = S / this.map.size;
      c.save(); c.translate(a, b); c.rotate(-l.rot); c.fillStyle = '#5a4630'; c.fillRect(-l.hw * k, -l.hl * k, l.hw * 2 * k + 1, l.hl * 2 * k); c.restore();
    }
    for (const k of s.keys) if (!k.taken) { // keys pulse so they stand out
      const pulse = 3 + Math.sin(performance.now() / 200) * 0.8;
      dot(k.x, k.z, pulse, '#ffd060', '#fff');
    }
    for (const cd of s.candles) if (cd.lit) dot(cd.x, cd.z, 1.6, '#ffb060');
    const pulse = 1 + Math.sin(performance.now() / 150) * 0.25;
    for (const p of s.players) {
      if (p.id === me.id) continue;
      if (p.role === 'monster') {
        if (!seeAll && !me.eye && (!p.aura || me.state === 'hooked')) continue; // others see it while its aura shows (or with The Eye)
        dot(p.x, p.z, 4.2 * (seeAll ? 1 : pulse), '#c21d1d', '#ff8080');
      } else {
        if (p.state === 'mouse' || p.state === 'escaped') continue;
        // The monster only sees survivors whose aura is revealed (or the ones it has hanged / carries).
        if (amMonster && !p.aura && p.state !== 'hooked' && p.state !== 'carried') continue;
        const col = p.state === 'hooked' ? '#e33' : p.state === 'downed' || p.state === 'carried' ? '#c98b2b' : '#cfc4b3';
        dot(p.x, p.z, amMonster || p.allyReveal ? 3.6 * pulse : 3.2, (amMonster && p.aura) || (!amMonster && p.allyReveal) ? '#e8c050' : col, '#000');
        if (!amMonster) { // name initial next to each survivor
          const [a, b] = P(p.x, p.z);
          c.fillStyle = '#e8ddd0'; c.font = `${Math.round(7 * u)}px serif`; c.fillText(p.name[0], a + 4 * u, b - 3 * u);
        }
      }
    }
    // me: arrow in camera direction
    const [mx, my] = P(me.x, me.z);
    c.save(); c.translate(mx, my); c.rotate(-yaw + Math.PI);
    c.fillStyle = me.role === 'monster' ? '#c21d1d' : ghost ? '#bfa98a' : '#ffffff';
    c.beginPath(); c.moveTo(0, -6 * u); c.lineTo(4 * u, 4 * u); c.lineTo(0, 2 * u); c.lineTo(-4 * u, 4 * u); c.closePath(); c.fill();
    c.restore();
    c.strokeStyle = 'rgba(176,141,87,.6)'; c.lineWidth = 2; c.strokeRect(1, 1, S - 2, S - 2);
  }
}
