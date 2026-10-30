// Easter eggs — each one grants a hidden achievement (once per account). Positions come from the
// shared map (shared/easterEggs.js); everything here is client-side and only you see/hear it.
import * as THREE from 'three';
import { terrainY, FLOOR0, FLOOR1 } from '@shared/levels.js';
import { lineOfSight } from '@shared/map.js';
import { dist, makeRng } from '@shared/rng.js';
import { EGG_TIMES } from '@shared/easterEggs.js';
import { getModel } from './assets.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { vlight } from './lights.js';
import { playClip, loopClip } from '../sounds.js';
import { settings, graphics } from '../settings.js';
import { esc } from '../ui/dom.js';

const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _c = new THREE.Vector3();
const SIXTH = ['Elias Crane', 'Agnes Holloway', 'Thomas Weir', 'Mary Ashgrove', 'Josiah Pell', 'Constance Hale'];

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const plane = (w, h, map, opts = {}) => new THREE.Mesh(new THREE.PlaneGeometry(w, h),
  new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, ...opts }));

// Carved lettering on stone (dark, slightly worn).
function engraving(lines, w = 256, h = 256) {
  return canvasTex(w, h, (x) => {
    x.textAlign = 'center'; x.textBaseline = 'middle';
    lines.forEach(([text, size, y], i) => {
      x.font = `${size}px Cinzel, Georgia, serif`;
      x.fillStyle = 'rgba(255,255,255,.18)'; x.fillText(text, w / 2 + 1, y + 1);
      x.fillStyle = 'rgba(20,18,16,.85)'; x.fillText(text, w / 2, y);
      void i;
    });
  });
}

export class EasterEggs {
  // ctx: { view, stage, map, hud, grant(id) → achievement|null, onTitle(text) }
  constructor(ctx) {
    Object.assign(this, ctx);
    this.root = new THREE.Group(); this.view.root.add(this.root);
    this.eggs = this.map.eggs || {};
    this.stare = {}; this.rng = makeRng(this.map.seed ^ 0xb00c);
    this.sixth = SIXTH[(this.rng() * SIXTH.length) | 0];
    this.buildAngels(); this.buildWatcher(); this.buildMirror(); this.buildClock(); this.buildPhone();
    this.buildMorgan(); this.buildOrb(); this.buildBook(); this.buildLoneGrave(); this.buildLetter();
    this.onKey = (e) => {
      if (e.repeat || document.activeElement?.tagName === 'INPUT') return;
      if (e.code === settings().controls.keys.interact) this.press();
    };
    window.addEventListener('keydown', this.onKey);
  }

  dispose() { window.removeEventListener('keydown', this.onKey); this.closeBook(); this.closeLetter(); this.ringLoop?.stop(0.2); this.orbLight?.dispose(); this.root.removeFromParent(); }

  // ---------- builders ----------
  // The Weeping Angel: cemetery angel stones and the pale gothic statues around the realm.
  buildAngels() {
    this.angels = [];
    const blood = new THREE.MeshBasicMaterial({ color: 0x5a0000, transparent: true, opacity: 0.95, depthWrite: false });
    const addTears = (g, eyes) => {
      const tears = eyes.map(([x, y, z]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.009, 1, 0.005), blood);
        m.geometry.translate(0, -0.5, 0); m.position.set(x, y, z); m.scale.y = 0.001; m.visible = false; g.add(m);
        return m;
      });
      const drops = Array.from({ length: 6 }, () => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 4), blood); d.visible = false; g.add(d); return d; });
      return { tears, drops };
    };
    // Only the one angel chosen for this map weeps.
    const pick = this.eggs.angel; if (!pick) return;
    if (pick.kind === 'grave') {
      const gv = this.map.graves.filter((x) => x.kind === 'angel')[pick.i]; if (!gv) return;
      const g = new THREE.Group(); g.position.set(gv.x, terrainY(gv.x, gv.z), gv.z); g.rotation.set(gv.tilt, gv.rot, gv.tilt * 0.4); this.root.add(g);
      this.angels.push({ g, hp: new THREE.Vector3(gv.x, terrainY(gv.x, gv.z) + 1.38, gv.z), len: 0.32, ...addTears(g, [[-0.04, 1.4, 0.1], [0.04, 1.4, 0.1]]), k: 0 });
    } else {
      const st = getModel('gothic_statue'), p = this.map.props[pick.i]; if (!st || !p) return;
      const b = st.box, hgt = b.max.y, cx = (b.min.x + b.max.x) / 2, front = b.max.z;
      const s = p.s || 1, y0 = terrainY(p.x, p.z), g = new THREE.Group();
      g.position.set(p.x, y0, p.z); g.rotation.y = p.rot || 0; g.scale.setScalar(s); this.root.add(g);
      const ey = hgt * 0.9, ez = front * 0.75;
      this.angels.push({ g, hp: new THREE.Vector3(p.x, y0 + ey * s, p.z), len: hgt * 0.2, ...addTears(g, [[cx - 0.035, ey, ez], [cx + 0.035, ey, ez]]), k: 0 });
    }
    // her blood hangs in the air around her: droplets drifting, rising, never falling
    const a = this.angels[0];
    const floatMat = new THREE.MeshBasicMaterial({ color: 0x7a0000, transparent: true, opacity: 0, depthWrite: false });
    a.float = Array.from({ length: 60 }, (_, i) => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.018 + (i % 4) * 0.008, 6, 4), floatMat);
      d.userData = { a: Math.random() * Math.PI * 2, r: 0.35 + Math.random() * 0.9, y: Math.random() * 1.6, sp: 0.15 + Math.random() * 0.35, ph: Math.random() * 6 };
      d.scale.y = 1.4; this.root.add(d); return d;
    });
    a.floatMat = floatMat;
  }

  // The Watcher: a pale grey figure behind an upper window of the mansion's south front.
  buildWatcher() {
    const w = this.eggs.watcher; if (!w) return;
    const tex = canvasTex(128, 256, (x) => {
      const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(190,190,195,.95)'); g.addColorStop(1, 'rgba(120,120,128,0)');
      x.fillStyle = g;
      x.beginPath(); x.ellipse(64, 46, 20, 26, 0, 0, Math.PI * 2); x.fill();                       // head
      x.beginPath(); x.moveTo(30, 256); x.quadraticCurveTo(26, 96, 64, 82); x.quadraticCurveTo(102, 96, 98, 256); x.fill(); // shoulders/body
      x.fillStyle = 'rgba(10,10,12,.9)'; x.beginPath(); x.ellipse(56, 44, 4, 6, 0, 0, 7); x.ellipse(72, 44, 4, 6, 0, 0, 7); x.fill(); // hollow eyes
    });
    this.watcher = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
    this.watcher.position.set(w.x, w.y, w.z); this.watcher.visible = false; this.root.add(this.watcher);
  }

  // That Wasn't Me: a demon that exists only in the mirror's reflection.
  buildMirror() {
    const it = this.eggs.mirror; if (!it) return;
    const W = it.w * 0.6, H = 0.8, y0 = it.lv ? FLOOR1 : FLOOR0;
    const tex = canvasTex(192, 256, (x) => {
      const g = x.createRadialGradient(96, 120, 10, 96, 120, 120); g.addColorStop(0, 'rgba(8,4,4,.95)'); g.addColorStop(1, 'rgba(8,4,4,0)');
      x.fillStyle = g; x.fillRect(0, 0, 192, 256);
      x.fillStyle = 'rgba(20,6,6,.95)';
      x.beginPath(); x.moveTo(40, 70); x.lineTo(58, 10); x.lineTo(72, 66); x.fill(); x.beginPath(); x.moveTo(152, 70); x.lineTo(134, 10); x.lineTo(120, 66); x.fill(); // horns
      x.beginPath(); x.ellipse(96, 120, 52, 70, 0, 0, 7); x.fill();                                     // skull
      x.shadowColor = '#ff2010'; x.shadowBlur = 14; x.fillStyle = '#ff3a1a';
      x.beginPath(); x.ellipse(74, 108, 9, 5, 0.3, 0, 7); x.ellipse(118, 108, 9, 5, -0.3, 0, 7); x.fill(); // burning eyes
      x.shadowBlur = 0; x.strokeStyle = '#c8b8a0'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(62, 150); x.quadraticCurveTo(96, 178, 130, 150); x.stroke();               // grin
      for (let i = 0; i < 9; i++) { const tx = 66 + i * 7.5; x.beginPath(); x.moveTo(tx, 154 + Math.sin(i / 8 * Math.PI) * 12); x.lineTo(tx + 3, 164 + Math.sin(i / 8 * Math.PI) * 12); x.stroke(); }
    });
    // A real, framed wall mirror over the console: it reflects the room (and you) — and, if you
    // stare long enough, something that is not in the room.
    const MW = Math.max(W, 0.8), MH = Math.max(H, 1.0), cy = it.h + 0.5, z0 = -it.d / 2 + 0.06;
    const g = new THREE.Group(); g.position.set(it.x, y0, it.z); g.rotation.y = it.rot; this.root.add(g);
    // (ultra low / mobile: a plain silvered pane instead of a live reflection)
    const glass = graphics().noMirror ? new THREE.Mesh(new THREE.PlaneGeometry(MW, MH), new THREE.MeshStandardMaterial({ color: 0x6a7278, roughness: 0.15, metalness: 0.9 }))
      : new Reflector(new THREE.PlaneGeometry(MW, MH), { textureWidth: 384, textureHeight: 480, color: 0x8a9298, clipBias: 0.003 });
    glass.position.set(0, cy, z0); g.add(glass);
    const gilt = new THREE.MeshStandardMaterial({ color: 0x5a4220, roughness: 0.45, metalness: 0.7 });
    for (const [w, h, x, y] of [[MW + 0.16, 0.08, 0, MH / 2 + 0.04], [MW + 0.16, 0.08, 0, -MH / 2 - 0.04], [0.08, MH, -MW / 2 - 0.04, 0], [0.08, MH, MW / 2 + 0.04, 0]]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), gilt); f.position.set(x, cy + y, z0); f.castShadow = true; g.add(f);
    }
    const crest = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 16, Math.PI), gilt); crest.position.set(0, cy + MH / 2 + 0.1, z0); g.add(crest);
    const m = plane(MW * 0.85, MH * 0.85, tex, { opacity: 0, roughness: 0.1, metalness: 0.4 });
    m.position.set(0, cy, z0 + 0.004); g.add(m);
    this.mirror = { m, it, glass, lv: it.lv | 0, pos: new THREE.Vector3() };
    m.updateMatrixWorld(true); m.getWorldPosition(this.mirror.pos);
  }

  // It Supposed to...: a proper face and hands on the grandfather clock.
  buildClock() {
    const it = this.eggs.clock; if (!it) return;
    const tex = canvasTex(256, 256, (x) => {
      x.fillStyle = '#d8ccb0'; x.beginPath(); x.arc(128, 128, 124, 0, 7); x.fill();
      x.strokeStyle = '#3a2a1a'; x.lineWidth = 6; x.stroke();
      x.fillStyle = '#2a1e14'; x.font = '26px Cinzel, Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((n, i) => {
        const a = (i / 12) * Math.PI * 2; x.fillText(n, 128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96);
      });
    });
    const g = new THREE.Group(); g.position.set(it.x, (it.lv ? FLOOR1 : FLOOR0), it.z); g.rotation.y = it.rot; this.root.add(g);
    const face = new THREE.Group(); face.position.set(0, it.h - 0.35, it.d / 2 + 0.026); g.add(face);
    face.add(new THREE.Mesh(new THREE.CircleGeometry(0.17, 32), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })));
    const hand = (len, wdt) => {
      const h = new THREE.Mesh(new THREE.BoxGeometry(wdt, len, 0.006), new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.6, metalness: 0.4 }));
      h.geometry.translate(0, len / 2 - 0.015, 0.006); face.add(h); return h;
    };
    this.clock = { hour: hand(0.09, 0.014), min: hand(0.14, 0.009), it, lv: it.lv | 0, pos: new THREE.Vector3(), spin: 0, t: 0.6 + this.rng() * 0.3 };
    face.updateMatrixWorld(true); face.getWorldPosition(this.clock.pos);
  }

  // Yeah, It's a Misscall: an old wall telephone in the mansion corridor.
  buildPhone() {
    const p = this.eggs.phone; if (!p) return;
    const wood = new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 0.7 }), brass = new THREE.MeshStandardMaterial({ color: 0x9a7a3a, roughness: 0.35, metalness: 0.9 });
    const black = new THREE.MeshStandardMaterial({ color: 0x0c0a08, roughness: 0.4 });
    const g = new THREE.Group(); g.position.set(p.x, FLOOR0 + 1.2, p.z); g.rotation.y = p.rot; this.root.add(g);
    const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    box(0.24, 0.36, 0.1, wood, 0, 0, 0.05);
    this.bells = [-0.05, 0.05].map((x) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 6, 0, 7, 0, Math.PI / 2), brass); b.rotation.x = Math.PI / 2; b.position.set(x, 0.11, 0.115); g.add(b); return b; });
    box(0.03, 0.05, 0.08, black, 0, -0.02, 0.14); // mouthpiece
    const rec = box(0.035, 0.12, 0.035, black, 0.15, 0.03, 0.08); rec.rotation.z = 0.1; // the earpiece on its hook
    box(0.02, 0.02, 0.05, brass, 0.13, 0.1, 0.07);
    this.phone = { g, x: p.x, z: p.z };
  }

  buildMorgan() {
    const gv = this.eggs.morgan; if (!gv) return;
    // A tall, pale headstone of its own on a stone plinth, with a grave mound in front.
    const g = new THREE.Group(); g.position.set(gv.x, terrainY(gv.x, gv.z), gv.z); g.rotation.set(-0.03, gv.rot, 0.02); this.root.add(g);
    const stone = new THREE.MeshStandardMaterial({ color: 0xb4b0a6, roughness: 0.9 }), dirt = new THREE.MeshStandardMaterial({ color: 0x3a2e24, roughness: 1 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 0.42), stone); base.position.y = 0.09; base.castShadow = base.receiveShadow = true; g.add(base);
    const sh = new THREE.Shape(), w = 0.4, h = 1.2;
    sh.moveTo(-w, 0); sh.lineTo(w, 0); sh.lineTo(w, h - w); sh.absarc(0, h - w, w, 0, Math.PI, false); sh.lineTo(-w, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 12 }); geo.translate(0, 0.18, -0.08);
    const m = new THREE.Mesh(geo, stone); m.castShadow = m.receiveShadow = true; g.add(m);
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), dirt); mound.scale.set(0.5, 0.18, 1.0); mound.position.set(0, -0.02, 1.05); g.add(mound);
    const tex = engraving([['✝', 64, 70], ['ARTHUR', 70, 180], ['MORGAN', 70, 262], ['1863 - 1899', 46, 360], ['REST IN PEACE', 30, 440]], 512, 512);
    const txt = plane(0.74, 0.74, tex); txt.position.set(0, 0.84, 0.105); g.add(txt);
    g.updateMatrixWorld(true);
    this.morgan = { pos: new THREE.Vector3(0, 0.84, 0.12).applyMatrix4(g.matrixWorld), x: gv.x, z: gv.z };
  }

  buildOrb() {
    const o = this.eggs.orb; if (!o) return;
    const y = terrainY(o.x, o.z) + o.y;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xc01010, emissiveIntensity: 0.6, roughness: 0.3 }));
    core.position.set(o.x, y, o.z); this.root.add(core);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(64, 64, (x) => {
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,40,30,.8)'); g.addColorStop(1, 'rgba(255,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(0.7); glow.position.copy(core.position); this.root.add(glow);
    this.orbLight = vlight(0xff2010, 0.35, 3, 2); this.orbLight.position.set(o.x + o.nx * 0.4, y, o.z + o.nz * 0.4); this.root.add(this.orbLight);
    this.orb = { core, glow, x: o.x, z: o.z };
  }

  buildBook() {
    const b = this.eggs.book; if (!b) return;
    const g = new THREE.Group(); g.position.set(b.x, terrainY(b.x, b.z) + 0.02, b.z); g.rotation.y = b.rot; this.root.add(g);
    const cover = new THREE.MeshStandardMaterial({ color: 0x3a1210, roughness: 0.8 }), page = new THREE.MeshStandardMaterial({ color: 0xcfc2a0, roughness: 1 });
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.3), cover); c.position.y = 0.025; c.castShadow = true; g.add(c);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.28), page); p.position.set(0.012, 0.026, 0); g.add(p);
    this.book = { x: b.x, z: b.z };
  }

  buildLoneGrave() {
    const lg = this.eggs.loneGrave; if (!lg) return;
    const y0 = terrainY(lg.x, lg.z), g = new THREE.Group(); g.position.set(lg.x, y0, lg.z); g.rotation.set(0.06, lg.rot, -0.04); this.root.add(g);
    const stone = new THREE.MeshStandardMaterial({ color: 0x8a8a86, roughness: 0.95 }), dirt = new THREE.MeshStandardMaterial({ color: 0x3a2e24, roughness: 1 });
    const sh = new THREE.Shape(), w = 0.3, h = 0.8;
    sh.moveTo(-w, 0); sh.lineTo(w, 0); sh.lineTo(w, h - w); sh.absarc(0, h - w, w, 0, Math.PI, false); sh.lineTo(-w, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1, curveSegments: 8 }); geo.translate(0, 0, -0.06);
    const m = new THREE.Mesh(geo, stone); m.castShadow = m.receiveShadow = true; g.add(m);
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), dirt); mound.scale.set(0.42, 0.16, 0.9); mound.position.set(0, -0.02, 0.65); g.add(mound);
    this.lone = { g, name: null, x: lg.x, z: lg.z, pos: new THREE.Vector3() };
    g.updateMatrixWorld(true); this.lone.pos.set(0, 0.4, 0.1).applyMatrix4(g.matrixWorld);
  }
  setLoneName(name) {
    if (!this.lone || this.lone.name === name) return;
    this.lone.name = name;
    this.lone.plate?.removeFromParent();
    const tex = engraving([['HERE LIES', 22, 60], [name.toUpperCase(), name.length > 12 ? 22 : 30, 120], ['ONE OF US', 20, 185]]);
    const p = plane(0.5, 0.5, tex); p.position.set(0, 0.4, 0.08); this.lone.g.add(p); this.lone.plate = p;
  }

  // ---------- per frame ----------
  looking(me, pos, maxD, cosMin, lv = 0) {
    if (!me || (me.level | 0) !== lv || dist(me.x, me.z, pos.x, pos.z) > maxD) return false;
    const cam = this.stage.camera;
    cam.getWorldPosition(_c); cam.getWorldDirection(_d);
    _v.copy(pos).sub(_c).normalize();
    return _v.dot(_d) > cosMin;
  }
  hold(key, on, dt) { this.stare[key] = on ? (this.stare[key] || 0) + dt : Math.max(0, (this.stare[key] || 0) - dt * 2); return this.stare[key]; }
  award(id) {
    const a = this.grant(id);
    if (a) { this.hud.banner(`HIDDEN ACHIEVEMENT<br><span style="font-size:17px">✠ ${esc(a.name)}</span>`, 4500, '#d4a840'); playClip('ghost', { vol: 0.9 }); }
  }

  update(dt, snap, me, time, yaw = 0) {
    const t = this.view.time, alive = me && !['mouse', 'escaped'].includes(me.state);
    const mon = snap.players.find((p) => p.role === 'monster');
    if (mon) this.setLoneName(mon.name.replace(/\s*\[BOT\]$/, ''));
    // line of sight to a point just in front of the target (the target's own collider would block it)
    const visible = (x, z) => {
      if (!me) return false;
      const d = dist(me.x, me.z, x, z); if (d < 1.2) return true;
      return lineOfSight(this.map, me.x, me.z, x + ((me.x - x) / d) * 1.1, z + ((me.z - z) / d) * 1.1);
    };

    // The Weeping Angel: 5s up close → blood runs from the eyes
    for (const a of this.angels) {
      const pos = a.hp, on = alive && this.looking(me, pos, 4.5, 0.93) && visible(pos.x, pos.z);
      a.k = on ? a.k + dt : Math.max(0, a.k - dt * 0.15);
      const f = Math.min(1, a.k / 5);
      a.tears.forEach((m) => { m.visible = f > 0.02; m.scale.y = Math.max(0.001, f * a.len); });
      a.drops.forEach((d, i) => {
        d.visible = f > 0.3;
        if (!d.visible) return;
        const ph = ((t * 0.7 + i / a.drops.length) % 1), base = a.tears[i % 2].position;
        d.position.set(base.x, base.y - a.len * f - ph * 1.0, base.z + 0.01);
        d.scale.setScalar(1 - ph * 0.5);
      });
      // blood floating in the air around her, thickening as you keep looking
      if (a.float) {
        a.floatMat.opacity = Math.min(0.9, f * 1.4);
        const base = a.g.position;
        a.float.forEach((d) => {
          d.visible = f > 0.05;
          if (!d.visible) return;
          const u = d.userData, yy = (u.y + t * u.sp * 0.25) % 1.9;
          d.position.set(base.x + Math.cos(u.a + t * u.sp * 0.3) * u.r, base.y + 0.2 + yy + Math.sin(t * 1.3 + u.ph) * 0.05, base.z + Math.sin(u.a + t * u.sp * 0.3) * u.r);
        });
      }
      if (on && a.k >= 5) this.award('egg_angel');
    }

    // The Watcher: shows at set times; you must be outside, in front of the mansion, looking at it
    if (this.watcher) {
      const show = EGG_TIMES.watcher.some((s) => time >= s && time < s + 7);
      const op = this.watcher.material;
      op.opacity += ((show ? 0.85 : 0) - op.opacity) * Math.min(1, dt * 2);
      this.watcher.visible = op.opacity > 0.01;
      const w = this.watcher.position;
      if (show && alive && me.z > 9 && this.looking(me, w, 45, 0.97) && lineOfSight(this.map, me.x, me.z, w.x, w.z + 0.8)) {
        if (this.hold('watcher', true, dt) > 1) this.award('egg_watcher');
      }
    }

    // That Wasn't Me: stare into the mirror and something stares back
    if (this.mirror) {
      // the reflection is only rendered when someone is close enough to see it (it costs a frame)
      this.mirror.glass.visible = !!me && (me.level | 0) === this.mirror.lv && dist(me.x, me.z, this.mirror.pos.x, this.mirror.pos.z) < 9;
      const mr = this.mirror, on = alive && this.looking(me, mr.pos, 3, 0.94, mr.lv) && visible(mr.pos.x + Math.sin(mr.it.rot) * 0.6, mr.pos.z + Math.cos(mr.it.rot) * 0.6);
      const k = this.hold('mirror', on, dt);
      mr.m.material.opacity = Math.max(0, Math.min(1, (k - 1.5) / 2.5)) * (0.85 + Math.sin(t * 11) * 0.1);
      if (k >= 4) this.award('egg_mirror');
    }

    // It Supposed to...: stare at the clock; its hands begin turning backward
    if (this.clock) {
      const ck = this.clock, on = alive && this.looking(me, ck.pos, 4, 0.94, ck.lv) && visible(ck.pos.x + Math.sin(ck.it.rot) * 0.6, ck.pos.z + Math.cos(ck.it.rot) * 0.6);
      const k = this.hold('clock', on, dt);
      ck.spin += (((k >= 3 ? -1 : 0)) - ck.spin) * Math.min(1, dt * 1.5);
      ck.t += dt / 3600 + ck.spin * dt * 0.35;          // hours (normal speed, or racing backward)
      ck.hour.rotation.z = -(ck.t / 12) * Math.PI * 2;
      ck.min.rotation.z = -ck.t * Math.PI * 2;
      if (k >= 3) this.award('egg_clock');
    }

    // Yeah, It's a Misscall: the phone rings — only those close by can hear it
    if (this.phone) {
      const ring = EGG_TIMES.phone.some((s) => time >= s && time < s + 12), ph = this.phone;
      this.bells.forEach((b, i) => { b.rotation.z = ring ? Math.sin(t * 60 + i) * 0.25 : 0; });
      const d = me ? dist(me.x, me.z, ph.x, ph.z) : 99;
      // the ringtone, heard only within 8m (on the ground floor), louder as you get closer
      const hear = ring && me && (me.level | 0) === 0 && d < 8;
      if (hear && !this.ringLoop) this.ringLoop = loopClip('phone', { vol: 0, fadeIn: 0.1 });
      if (this.ringLoop) {
        const a = me ? Math.atan2(ph.x - me.x, ph.z - me.z) - yaw : 0;
        this.ringLoop.set(hear ? 0.8 * Math.pow(1 - d / 8, 0.7) : 0, 1, -Math.sin(a) * 0.6);
        if (!ring) { this.ringLoop.stop(0.3); this.ringLoop = null; }
      }
      if (ring && alive && (me.level | 0) === 0 && d < 8) this.award('egg_phone');
    }

    // Dead Legend
    if (this.morgan && alive && dist(me.x, me.z, this.morgan.x, this.morgan.z) < 4 && this.looking(me, this.morgan.pos, 4, 0.93)) {
      if (this.hold('morgan', true, dt) >= 1) this.award('egg_morgan');
    } else this.hold('morgan', false, dt);

    // One of Us
    if (this.lone && alive && dist(me.x, me.z, this.lone.x, this.lone.z) < 4.5 && this.looking(me, this.lone.pos, 4.5, 0.93)) {
      if (this.hold('lone', true, dt) >= 1.2) this.award('egg_oneofus');
    } else this.hold('lone', false, dt);

    // the orb breathes
    if (this.orb) {
      const p = 0.6 + Math.sin(t * 1.6) * 0.35;
      this.orb.core.material.emissiveIntensity = p; this.orb.glow.material.opacity = 0.35 + p * 0.4; this.orbLight.intensity = 0.25 + p * 0.25;
    }
    if (this.letterEl && (!me || (me.level | 0) !== 1 || dist(me.x, me.z, this.letter.x, this.letter.z) > 3)) this.closeLetter();
    if (this.bookEl && (!me || dist(me.x, me.z, this.book.x, this.book.z) > 2.6)) this.closeBook();
    this.snap = snap; this.me = me;
  }

  // E near the orb / the book
  press() {
    const me = this.me; if (!me || ['mouse', 'escaped'].includes(me.state)) return;
    if (this.letterEl) { this.closeLetter(); return; }
    if (this.letter && (me.level | 0) === 1 && dist(me.x, me.z, this.letter.x, this.letter.z) < 2.2) { this.openLetter(); return; }
    if ((me.level | 0) !== 0) return;
    if (this.bookEl) { this.closeBook(); return; }
    if (this.orb && dist(me.x, me.z, this.orb.x, this.orb.z) < 2) {
      this.onTitle('The Heart of the Ritual');
      this.award('egg_heart');
      this.hud.banner('THE HEART OF THE RITUAL<br><span style="font-size:15px">It beats in your hand… and the world forgets its name.</span>', 4500, '#c21d1d');
      return;
    }
    if (this.book && dist(me.x, me.z, this.book.x, this.book.z) < 1.7) this.openBook();
  }
  openBook() {
    const names = this.snap.players.map((p) => p.name.replace(/\s*\[BOT\]$/, ''));
    const el = this.bookEl = document.createElement('div');
    el.className = 'egg-book';
    el.innerHTML = `<div class="pg"><div class="bt">Those Who Came</div>${names.map((n) => `<div>${esc(n)}</div>`).join('')}
      <div class="sixth">${esc(this.sixth)}</div><small>E to close</small></div>`;
    document.body.appendChild(el);
    this.award('egg_book');
  }
  closeBook() { this.bookEl?.remove(); this.bookEl = null; }

  // Souls of the lantern: a sealed envelope on the bed upstairs in the mansion; E opens the letter.
  buildLetter() {
    const l = this.eggs.letter; if (!l) return;
    const g = new THREE.Group(); g.position.set(l.x, FLOOR1 + 0.57, l.z); g.rotation.y = l.rot; this.root.add(g);
    const paper = new THREE.MeshStandardMaterial({ color: 0xd8cba8, roughness: 0.95, emissive: 0x2a2010, emissiveIntensity: 0.5 });
    const env = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.012, 0.2), paper); env.castShadow = true; g.add(env);
    const tri = new THREE.Shape(); tri.moveTo(-0.15, 0); tri.lineTo(0.15, 0); tri.lineTo(0, 0.1); // the closed flap
    const flap = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshStandardMaterial({ color: 0xc2b286, roughness: 0.95, side: THREE.DoubleSide }));
    flap.rotation.x = -Math.PI / 2; flap.position.set(0, 0.008, -0.1); g.add(flap);
    const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 12), new THREE.MeshStandardMaterial({ color: 0x7a0a0a, roughness: 0.5 }));
    seal.position.set(0, 0.014, 0.02); g.add(seal);
    this.letter = { x: l.x, z: l.z };
  }
  openLetter() {
    const el = this.letterEl = document.createElement('div');
    el.className = 'egg-letter';
    el.innerHTML = `<div class="lt-frame"><img alt="A letter" src="${import.meta.env.BASE_URL}assets/img/letter.webp"></div><small>E to close</small>`;
    document.body.appendChild(el);
    this.award('egg_letter');
  }
  closeLetter() { this.letterEl?.remove(); this.letterEl = null; }
}
