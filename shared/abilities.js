// Monster special abilities and aimed attacks (trident / puppet string).
import { MONSTERS } from './constants.js';
import { dist, angleTo, angleDiff } from './rng.js';
import { hitSurvivor } from './monster.js';
import { collide } from './nav.js';

export function useSpecial(g, m, a = {}) {
  const def = MONSTERS[m.monster];
  switch (m.monster) {
    case 'mimic': {
      // Q again: drop the disguise at once — the monster is back (the cooldown starts now).
      if (m.disguise) { m.disguise = null; m.specialCdUntil = g.time + 8; g.emit({ t: 'reveal', id: m.id, x: m.x, z: m.z }); return; }
      const pool = g.survivors().filter((p) => p.state !== 'mouse' && p.state !== 'escaped');
      const target = pool.find((p) => p.id === a.target) || pool[Math.floor(g.random() * pool.length)];
      if (!target) return;
      m.disguise = target.skin;   // she takes the look of one of the players in this match
      m.disguiseName = target.name;
      void def;
      g.emit({ t: 'disguise', to: m.id, name: target.name });
      return;
    }
    case 'wanderer': {
      const s = g.lastScreech;
      if (!s || g.time - s.at > 12) { g.emit({ t: 'noCrow', to: m.id }); return; }
      const ang = g.random() * Math.PI * 2;
      m.x = s.x + Math.sin(ang) * 3.2; m.z = s.z + Math.cos(ang) * 3.2; m.level = 0;
      g.lastScreech = null;
      m.specialCdUntil = g.time + def.specialCd;
      g.emit({ t: 'teleport', x: m.x, z: m.z });
      return;
    }
    case 'puppeteer':
      g.blackoutUntil = g.time + 10;
      m.specialCdUntil = g.time + def.specialCd;
      g.emit({ t: 'blackout' });
      return;
    case 'ravager':
      m.trailUntil = g.time + 8;
      for (const p of g.survivors()) if (p.state === 'alive' && dist(p.x, p.z, m.x, m.z) < 30) p.trailUntil = g.time + 8;
      m.specialCdUntil = g.time + def.specialCd;
      g.emit({ t: 'trail', to: m.id });
      return;
    case 'stalker':
      return; // the Stalker's special is the aimed trident (hold RMB)
  }
}

// Stalker: trident (special, sealed after first enchant). Puppeteer: puppet string (normal ability).
export function updateAiming(g, m, inp, st) {
  const wants = !!inp.aim && !m.carrying && m.stunUntil < g.time;
  let can = false;
  if (m.monster === 'stalker') can = !st.specialSealed && m.tridentCdUntil < g.time;
  if (m.monster === 'puppeteer') can = m.stringCdUntil < g.time;
  if (wants && can) {
    if (!m.aiming) { m.aiming = true; m.aimStartT = g.time; m.lastBolt = -99; }
    if (m.monster === 'stalker' && g.time - m.lastBolt > 1.4) {
      // The trident's curse: lightning strikes from where the Stalker aims, seen by everyone.
      m.lastBolt = g.time;
      const d = 18;
      g.emit({ t: 'lightning', x: m.x + Math.sin(m.rot) * d, z: m.z + Math.cos(m.rot) * d, fx: m.x, fz: m.z });
    }
  } else m.aiming = false; // released (aimRelease already handled) or ability unavailable
}

export function onAimRelease(g, m, st) {
  if (!m.aiming) return;
  m.aiming = false;
  if (g.time - m.aimStartT < 0.35) return; // tap = cancel
  if (m.monster === 'stalker') {
    if (st.specialSealed) return;
    m.tridentCdUntil = g.time + MONSTERS.stalker.specialCd;
    g.state.projectiles.push({ id: g.nextId++, owner: m.id, x: m.x + Math.sin(m.rot) * 0.8, z: m.z + Math.cos(m.rot) * 0.8, dir: m.rot, travel: 0, range: st.range > 2 ? 24 : 17, back: false });
    g.emit({ t: 'throw', x: m.x, z: m.z });
  } else if (m.monster === 'puppeteer') {
    m.stringCdUntil = g.time + 1.2; // her strings are her weapon: no real cooldown, just a short recoil
    const reach = st.range > 2 ? 8 : 5.5;
    const target = g.survivors()
      .filter((p) => p.state === 'alive' && dist(m.x, m.z, p.x, p.z) < reach &&
        Math.abs(angleDiff(m.rot, angleTo(m.x, m.z, p.x, p.z))) < 0.17 + 0.25 / Math.max(1, dist(m.x, m.z, p.x, p.z))) // a narrow lash: a sidestep dodges it
      .sort((a, b) => dist(m.x, m.z, a.x, a.z) - dist(m.x, m.z, b.x, b.z))[0];
    g.emit({ t: 'string', x: m.x, z: m.z, dir: m.rot, hit: !!target });
    if (target) {
      // pull the victim in front of the Puppeteer, then strike
      const c = collide(g.map, m.x + Math.sin(m.rot) * 1.2, m.z + Math.cos(m.rot) * 1.2, 0.4, 0, m.level | 0);
      target.x = c.x; target.z = c.z; target.level = m.level | 0;
      hitSurvivor(g, m, target, 'string');
    }
  }
}
