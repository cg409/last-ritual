// Escape pallets (Dead-by-Daylight style). A wooden pallet leans upright beside a doorway in a ruined
// wall. A survivor near it presses E (even while running) to slam it down across the gap:
//  - a monster standing in the gap is stunned for 2.5s;
//  - the dropped pallet blocks the monster completely, survivors can vault it (SPACE);
//  - the monster can smash it by holding E (2.4s) — then the gap is open for good.
import { dist } from './rng.js';
import { DROP_LOG } from './landmarks.js';

export const PALLET = { reach: 1.7, stun: 2.5, breakTime: 2.4, h: 0.85 };

// Footprint of a dropped pallet as a collision rect (spans the doorway gap).
export function palletRect(p) {
  return p.alongX ? { x: p.x, z: p.z, hw: p.gap / 2 + 0.1, hd: 0.32, h: PALLET.h, type: 'pallet' }
    : { x: p.x, z: p.z, hw: 0.32, hd: p.gap / 2 + 0.1, h: PALLET.h, type: 'pallet' };
}

// A fallen push-log as an oriented solid log (see nav.collide): survivors jump it, the monster
// clambers over it slowly. Long axis spans the gap and rests against both boulders.
export function dropLogShape(p) {
  return { x: p.x, z: p.z, rot: p.alongX ? Math.PI / 2 : 0, hl: p.gap / 2 + 0.25, hw: DROP_LOG.hw, h: DROP_LOG.h, kind: 'drop', id: p.id };
}

export function initPallets(g) {
  g.map.dyn = [];
  g.map.logs = (g.map.logs || []).filter((l) => l.kind !== 'drop');
  g.state.pallets = g.map.pallets.map((p) => ({ id: p.id, x: p.x, z: p.z, alongX: p.alongX, gap: p.gap, side: p.side, kind: p.kind || 'pallet', state: 'up' }));
}

export const palletNear = (g, x, z, state, r = PALLET.reach) =>
  g.state.pallets.find((p) => p.state === state && dist(x, z, p.x, p.z) < r);

// Keep the nav grid in sync so bots path around dropped pallets (and through broken ones).
function setNav(g, r, val) {
  const nav = g.map.nav; if (!nav) return;
  const { n, cell, H, grid } = nav;
  const gx0 = Math.max(0, Math.floor((r.x - r.hw - 0.55 + H) / cell)), gx1 = Math.min(n - 1, Math.floor((r.x + r.hw + 0.55 + H) / cell));
  const gz0 = Math.max(0, Math.floor((r.z - r.hd - 0.55 + H) / cell)), gz1 = Math.min(n - 1, Math.floor((r.z + r.hd + 0.55 + H) / cell));
  for (let z = gz0; z <= gz1; z++) for (let x = gx0; x <= gx1; x++) {
    if (val) { if (!grid[z * n + x]) grid[z * n + x] = 2; } else if (grid[z * n + x] === 2) grid[z * n + x] = 0;
  }
}
function rebuildDyn(g) {
  for (const r of g.map.dyn || []) setNav(g, r, false);
  g.map.dyn = g.state.pallets.filter((p) => p.state === 'down' && p.kind !== 'log').map(palletRect);
  for (const r of g.map.dyn) setNav(g, r, true);
  // fallen logs join the solid logs (and stay blocked on the bot nav grid, like pallets)
  g.map.logs = (g.map.logs || []).filter((l) => l.kind !== 'drop')
    .concat(g.state.pallets.filter((p) => p.state === 'down' && p.kind === 'log').map(dropLogShape));
  for (const p of g.state.pallets) if (p.state === 'down' && p.kind === 'log') setNav(g, palletRect(p), true);
}

export function dropPallet(g, p) {
  const pal = palletNear(g, p.x, p.z, 'up');
  if (!pal || (p.level | 0) !== 0) return false;
  pal.state = 'down'; pal.by = p.id;
  const r = palletRect(pal), m = g.monster;
  const inside = Math.abs(m.x - r.x) < r.hw + 0.5 && Math.abs(m.z - r.z) < r.hd + 0.5 && (m.level | 0) === 0;
  if (inside) {
    m.stunUntil = Math.max(m.stunUntil, g.time + PALLET.stun);
    if (m.carrying) { const v = g.player(m.carrying); if (v) { v.state = 'downed'; v.carrier = null; } m.carrying = null; }
  }
  // Everyone in the footprint is shoved out to the side they were already on.
  for (const o of g.state.players) {
    if (Math.abs(o.x - r.x) < r.hw + 0.4 && Math.abs(o.z - r.z) < r.hd + 0.4) {
      if (pal.alongX) o.z = r.z + Math.sign(o.z - r.z || 1) * (r.hd + 0.45); else o.x = r.x + Math.sign(o.x - r.x || 1) * (r.hw + 0.45);
    }
  }
  rebuildDyn(g);
  g.emit({ t: 'pallet', id: pal.id, x: pal.x, z: pal.z, stun: inside, name: p.name, kind: pal.kind });
  return true;
}

// Monster holding E next to a dropped pallet. Returns true while busy.
export function breakPallet(g, m, dt) {
  const pal = g.state.pallets.find((p) => p.state === 'down' && p.kind !== 'log' && dist(m.x, m.z, p.x, p.z) < 2.0);
  if (!pal) return false;
  if (m.act !== 'smash') { m.act = 'smash'; m.actT = 0; }
  m.actT += dt / PALLET.breakTime;
  if (m.actT >= 1) {
    m.act = null; m.actT = 0; pal.state = 'broken';
    rebuildDyn(g);
    g.emit({ t: 'palletBreak', id: pal.id, x: pal.x, z: pal.z });
  }
  return true;
}
