// Loadout (main menu): two tabs at the top - PLAYER and MONSTER.
//  PLAYER : your survivor stands on the right of the screen, the customisation menu (character, perks) is on the left.
//  MONSTER: the camera glides to the monster's dais, the monster stands on the left and the menu (monster, weapon + upgrades,
//           traps) is on the right. Any weapon can be paired with any monster (shared/weapons.js).
import { SKINS, MONSTERS, MONSTER_IDS, TRAPS, TRAP_IDS, PERKS, PERK_IDS, MAX_PERKS, UNLOCK_COST, UPGRADE_COST, WEAPONS, WEAPON_IDS, weaponStats } from '@shared/constants.js';
import { show, on, q, esc, hex } from './dom.js';
import { sfx } from '../audio.js';
import { account, isUnlocked, levelOf, unlock, upgrade, togglePerk, saveProfile, loadoutPrefs } from '../profile.js';

const skinById = Object.fromEntries(SKINS.map((s) => [s.id, s]));
const BASE = import.meta.env.BASE_URL;

// 0..100 bars for a weapon's numbers (see the ranges in shared/weapons.js)
const pct = (v, lo, hi) => Math.round(Math.max(0.06, Math.min(1, (v - lo) / (hi - lo))) * 100);
function bars(id, lvl) {
  const w = weaponStats(id, lvl), sp = id === 'chainsaw' ? 'Damage (revved)' : 'Damage';
  const rows = [
    [sp, w.dmg === 2 ? 100 : 46, w.dmg === 2 ? 'one-hit down' : w.graze ? 'light cuts' : 'two hits'],
    ['Move speed', pct(w.speed, 0.7, 1.15), `${Math.round(w.speed * 100)}%`],
    ['Reach', pct(w.range, 0.85, 1.5), `${Math.round(w.range * 100)}%`],
    ['Swing speed', pct(1 / w.cd, 0.5, 1.75), w.cd < 0.9 ? 'fast' : w.cd > 1.2 ? 'slow' : 'average'],
    ['Stealth', pct(1.6 - w.hear, 0.1, 0.85), w.hear > 1.2 ? 'loud' : w.hear < 0.95 ? 'quiet' : 'normal'],
  ];
  return rows.map(([n, v, t]) => `<div class="wb"><span>${n}</span><div class="wbar"><i style="width:${v}%"></i></div><em>${t}</em></div>`).join('');
}

// The weapon picker + detail card (HTML). wid = the weapon being looked at.
export function weaponPanelHtml(wid) {
  const P = account.profile, L = P.loadout, w = WEAPONS[wid], own = isUnlocked('weapons', wid), lvl = levelOf('weapons', wid), equipped = L.weapon === wid;
  const lock = `<button class="dr-buy ${P.shards < w.cost ? 'poor' : ''}" data-unlock="weapons:${wid}" ${P.shards < w.cost ? 'disabled' : ''}>Unlock &#9670; ${w.cost}</button>`;
  const up = (() => { if (lvl >= 3) return '<span class="dr-max">Max level</span>'; const c = UPGRADE_COST[lvl]; return `<button class="dr-buy coin ${P.coins < c ? 'poor' : ''}" data-upgrade="weapons:${wid}" ${P.coins < c ? 'disabled' : ''}>Upgrade to Lv ${lvl + 1} &middot; &#9673; ${c}</button>`; })();
  return `<div class="wgrid">${WEAPON_IDS.map((id) => {
    const o = isUnlocked('weapons', id);
    return `<div class="wcard ${id === wid ? 'sel' : ''} ${L.weapon === id ? 'eq' : ''} ${o ? '' : 'locked'}" data-weapon="${id}">
      <img src="${BASE}assets/weapons/icons/${id}.webp" alt="" draggable="false"><div class="wn">${esc(WEAPONS[id].name)}</div>
      <div class="wt">${o ? (L.weapon === id ? 'equipped' : esc(WEAPONS[id].tag)) : `&#128274; &#9670; ${WEAPONS[id].cost}`}</div></div>`;
  }).join('')}</div>
  <div class="wdetail">
    <div class="wd-head"><div class="wd-name">${esc(w.name)}</div><div class="wd-tag">${esc(w.tag)}</div>
      <div class="wd-lv">${[1, 2, 3].map((n) => `<i class="${own && n <= lvl ? 'on' : ''}"></i>`).join('')}</div></div>
    <div class="wd-desc">${esc(w.desc)}</div>
    <div class="wbars">${bars(wid, own ? lvl : 1)}</div>
    <div class="wpm"><div class="plus">${w.plus.map((x) => `<div>+ ${esc(x)}</div>`).join('')}</div><div class="minus">${w.minus.map((x) => `<div>&minus; ${esc(x)}</div>`).join('')}</div></div>
    <div class="dr-lockrow">${own ? `${equipped ? '<span class="sh-ok">&#10003; Equipped</span>' : `<button class="dr-buy" data-equipw="${wid}">Equip</button>`}${up}` : `<span>Locked</span>${lock}`}</div>
    ${own ? '<div class="dr-note">Upgrades (ritual coins): -5% swing time and +3% reach per level, and a smaller speed penalty.</div>' : ''}
  </div>`;
}

export class LoadoutUI {
  // o: { scene, onLeave, onUpdate }
  constructor(o) { this.o = o; this.tab = 'player'; this.skinPrev = null; this.monPrev = null; this.wPrev = null; this.perkFocus = null; this.el = null; this.sub = { player: 'character', monster: 'monsters' }; }

  open(tab = 'player') { this.tab = tab; this.render(true); }

  mount() {
    const ui = show(`
      <div class="screen loadv">
        <div class="ld-top">
          <button class="btn small" id="ld-back">&larr; Menu</button>
          <div class="ld-tabs"><button class="ld-tab" data-tab="player">Player</button><button class="ld-tab" data-tab="monster">Monster</button></div>
          <div class="ld-wallet" id="ld-wallet"></div>
        </div>
        <aside class="ld-panel left" id="ld-player"></aside>
        <aside class="ld-panel right" id="ld-monster"></aside>
        <div class="ld-hint" id="ld-hint"></div>
      </div>`);
    this.el = ui.querySelector('.loadv');
    on('#ld-back', 'click', () => { sfx.click(); this.o.onLeave(); });
    on('.ld-tab', 'click', (_, el) => { sfx.click(); this.tab = el.dataset.tab; this.skinPrev = this.wPrev = this.monPrev = null; this.render(); });
    window.addEventListener('resize', this.onResize = () => this.sync3d());
  }

  dispose() { window.removeEventListener('resize', this.onResize); }

  sync3d() {
    const w = q(this.tab === 'player' ? '#ld-player' : '#ld-monster')?.offsetWidth || 400;
    this.o.scene.setLoadoutView(this.tab, w / 2);
  }

  render(first = false) {
    if (!this.el?.isConnected) this.mount();
    const P = account.profile, L = P.loadout;
    this.el.dataset.tab = this.tab;
    this.el.querySelectorAll('.ld-tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.tab));
    q('#ld-wallet').innerHTML = `<span class="sh">&#9670; ${P.shards}</span><span class="co">&#9673; ${P.coins}</span>`;
    this.renderPlayer(); this.renderMonster();
    // 3D: your survivor, the monster with its weapon, and which side the camera is on
    const skin = this.skinPrev || L.skin;
    this.o.scene.setSolo(true);
    this.o.scene.setLineup([{ skin }, null, null, null, null]);
    this.o.scene.setLoadoutMonster(this.monPrev || L.monster, this.wPrev || L.weapon);
    if (first) { this.o.scene.lk = this.tab === 'monster' ? 1 : 0; }
    this.sync3d();
  }

  lockBtn(kind, id, cost) {
    const P = account.profile;
    return `<button class="dr-buy ${P.shards < cost ? 'poor' : ''}" data-unlock="${kind}:${id}" ${P.shards < cost ? 'disabled' : ''}>Unlock &#9670; ${cost}</button>`;
  }
  upBtn(kind, id) {
    const P = account.profile, lv = levelOf(kind, id);
    if (lv >= 3) return '<span class="dr-max">Max level</span>';
    const cost = UPGRADE_COST[lv];
    return `<button class="dr-buy coin ${P.coins < cost ? 'poor' : ''}" data-upgrade="${kind}:${id}" ${P.coins < cost ? 'disabled' : ''}>Upgrade to Lv ${lv + 1} &middot; &#9673; ${cost}</button>`;
  }

  // the little tab row inside a menu (Player: Character | Perks. Monster: Monsters | Weapons | Traps)
  subTabs(which, items) {
    return `<div class="ld-sub">${items.map(([id, l]) => `<button class="ld-subtab ${this.sub[which] === id ? 'on' : ''}" data-sub="${which}:${id}">${l}</button>`).join('')}</div>`;
  }
  bindSubs(d) {
    on('[data-sub]', 'click', (_, el) => { sfx.click(); const [w, id] = el.dataset.sub.split(':'); this.sub[w] = id; this.skinPrev = this.monPrev = this.wPrev = null; this.render(); }, d);
  }

  // ---------------- PLAYER (left) ----------------
  renderPlayer() {
    const d = q('#ld-player'), P = account.profile, L = P.loadout, cur = L.skin, sub = this.sub.player;
    const focus = this.skinPrev || cur, fs = skinById[focus];
    const card = (s) => {
      const own = isUnlocked('skins', s.id);
      return `<div class="pcard ${s.id === cur ? 'sel' : ''} ${s.id === focus ? 'focus' : ''} ${own ? '' : 'locked'}" data-skin="${s.id}">
        <img src="${BASE}assets/previews/skins/${s.id}.webp" alt="" draggable="false">
        <div class="wn">${esc(s.exclusive ? s.name : s.variant || s.name)}</div>
        <div class="wt">${s.id === cur ? 'chosen' : own ? (s.exclusive ? 'owned' : '') : `&#128274; &#9670; ${UNLOCK_COST.skin}`}</div></div>`;
    };
    const detail = (s) => {
      const own = isUnlocked('skins', s.id), cost = UNLOCK_COST.skin;
      return `<div class="sh-name">${esc(s.name)}</div>
        <div class="sh-sub">${s.exclusive ? '<span class="sh-ex">EXCLUSIVE</span>' : `<span class="sh-dot" style="background:${hex(s.cloth)}"></span>${esc(s.variant)} jacket`}</div>
        <div class="sh-act">${s.id === cur ? '<span class="sh-ok">&#10003; Your character</span>' : own ? '<span class="sh-hint">Click to choose</span>'
          : `<button class="dr-buy ${P.shards < cost ? 'poor' : ''}" data-unlock="skins:${s.id}" ${P.shards < cost ? 'disabled' : ''}>Unlock &#9670; ${cost}</button>${P.shards < cost ? `<span class="sh-no">You have &#9670; ${P.shards}</span>` : ''}`}</div>`;
    };
    const pf = this.perkFocus && PERKS[this.perkFocus] ? this.perkFocus : L.perks[0] || PERK_IDS[0], pk = PERKS[pf];
    const character = `
      <div class="sh-detail" id="sh-detail">${detail(fs)}</div>
      <div class="dr-h small">Alex</div>
      <div class="pgrid five">${SKINS.filter((s) => !s.exclusive).map(card).join('')}</div>
      <div class="dr-h small">Exclusives</div>
      <div class="pgrid">${SKINS.filter((s) => s.exclusive).map(card).join('')}</div>
      <div class="dr-note">Hover to preview, click to choose. Exclusives cost &#9670; ${UNLOCK_COST.skin} soul shards each.</div>`;
    const perks = `
      <div class="dr-grid">${PERK_IDS.map((id) => `<div class="card perkc ${id === pf ? 'sel' : ''} ${isUnlocked('perks', id) ? '' : 'locked'} ${L.perks.includes(id) ? 'eq' : ''}" data-perk="${id}">
        <div class="pi">${PERKS[id].icon}</div><div class="cn">${esc(PERKS[id].name)}</div>
        <div class="ct">${isUnlocked('perks', id) ? (L.perks.includes(id) ? 'equipped' : `Lv ${levelOf('perks', id)}`) : '&#128274;'}</div></div>`).join('')}</div>
      <div class="lore dr-lore"><div class="dr-mon">${pk.icon} ${esc(pk.name)}</div>${esc(pk.desc)}
        ${pk.lv.map((t, i) => `<div class="dr-lv ${levelOf('perks', pf) === i + 1 && isUnlocked('perks', pf) ? 'cur' : ''}">Lv ${i + 1} &mdash; ${esc(t)}</div>`).join('')}</div>
      <div class="dr-lockrow">${isUnlocked('perks', pf)
        ? `<button class="dr-buy ${L.perks.includes(pf) ? 'on' : ''}" data-equip="${pf}" ${!L.perks.includes(pf) && L.perks.length >= MAX_PERKS ? 'disabled' : ''}>${L.perks.includes(pf) ? 'Unequip' : `Equip (${L.perks.length}/${MAX_PERKS})`}</button>${this.upBtn('perks', pf)}`
        : `<span>Locked</span>${this.lockBtn('perks', pf, UNLOCK_COST.perk)}`}</div>
      <div class="dr-note">Survivor perks: up to ${MAX_PERKS} equipped. Upgrade them with ritual coins.</div>`;
    d.innerHTML = `<div class="ld-h">Player</div>${this.subTabs('player', [['character', 'Character'], ['perks', 'Perks']])}${sub === 'perks' ? perks : character}`;
    this.bindSubs(d);

    const refresh = () => { saveProfile(); this.o.onUpdate?.(loadoutPrefs()); this.render(); };
    // hover = preview on the 3D figure (without rebuilding the grid); click = choose / keep the preview so it can be unlocked
    const showSkin = (id) => {
      const s = skinById[id]; if (!s) return;
      this.skinPrev = id === cur ? null : id;
      d.querySelectorAll('[data-skin]').forEach((c) => c.classList.toggle('focus', c.dataset.skin === id));
      const det = q('#sh-detail'); if (det) { det.innerHTML = detail(s); on('[data-unlock]', 'click', unlockClick, det); }
      this.o.scene.setLineup([{ skin: id }, null, null, null, null]);
    };
    d.querySelectorAll('[data-skin]').forEach((c) => c.addEventListener('mouseenter', () => showSkin(c.dataset.skin)));
    d.onmouseleave = () => { if (!this.pinned && this.skinPrev) showSkin(cur); };
    on('[data-skin]', 'click', (_, el) => {
      sfx.click(); const id = el.dataset.skin;
      if (isUnlocked('skins', id)) { this.skinPrev = null; this.pinned = false; L.skin = id; refresh(); } else { this.pinned = true; showSkin(id); }
    }, d);
    const unlockClick = (_, el) => {
      const [kind, id] = el.dataset.unlock.split(':');
      if (!unlock(kind, id)) return;
      sfx.key();
      if (kind === 'skins') { L.skin = id; this.skinPrev = null; this.pinned = false; }
      if (kind === 'perks') this.perkFocus = id;
      refresh();
    };
    on('[data-unlock]', 'click', unlockClick, d);
    on('[data-perk]', 'click', (_, el) => { sfx.click(); this.perkFocus = el.dataset.perk; this.render(); }, d);
    on('[data-equip]', 'click', (_, el) => { sfx.click(); togglePerk(el.dataset.equip); this.o.onUpdate?.(loadoutPrefs()); this.render(); }, d);
    on('[data-upgrade]', 'click', (_, el) => { const [kind, id] = el.dataset.upgrade.split(':'); if (upgrade(kind, id)) { sfx.key(); this.o.onUpdate?.(loadoutPrefs()); this.render(); } }, d);
  }

  // ---------------- MONSTER (right) ----------------
  renderMonster() {
    const d = q('#ld-monster'), P = account.profile, L = P.loadout, sub = this.sub.monster;
    const mon = MONSTERS[this.monPrev || L.monster] || MONSTERS[MONSTER_IDS[0]];
    const wid = this.wPrev || L.weapon;
    const tid = this.trapFocus || L.trap, t = TRAPS[tid];
    const monsters = `
      <div class="pgrid three">${MONSTER_IDS.map((m) => `<div class="pcard ${m === mon.id ? 'sel' : ''} ${m === L.monster ? 'eq' : ''} ${isUnlocked('monsters', m) ? '' : 'locked'}" data-mon="${m}">
        <img src="${BASE}assets/previews/monsters/${m}.webp" alt="" draggable="false">
        <div class="wn">${esc(MONSTERS[m].name.replace('THE ', ''))}</div>
        <div class="wt">${isUnlocked('monsters', m) ? (m === L.monster ? 'chosen' : 'owned') : `&#128274; &#9670; ${UNLOCK_COST.monster}`}</div></div>`).join('')}</div>
      <div class="lore dr-lore"><div class="dr-mon">${esc(mon.name)}</div><i>${esc(mon.lore)}</i>
        <b>Special</b>${esc(mon.special)}<b>Weakness</b>${esc(mon.weakness)}<b>Counterplay</b>${esc(mon.counter)}</div>
      <div class="dr-lockrow">${isUnlocked('monsters', mon.id) ? (L.monster === mon.id ? '<span class="sh-ok">&#10003; Your monster</span>' : `<button class="dr-buy" data-pickmon="${mon.id}">Choose</button>`) : `<span>Locked</span>${this.lockBtn('monsters', mon.id, UNLOCK_COST.monster)}`}</div>`;
    const traps = `
      <div class="dr-grid traps2">${TRAP_IDS.map((x) => `<div class="card ${x === tid ? 'sel' : ''} ${isUnlocked('traps', x) ? '' : 'locked'}" data-trap="${x}">
        ${isUnlocked('traps', x) ? '' : '<i class="lock">&#128274;</i>'}${esc(TRAPS[x].name)}<div class="ct">${x === L.trap ? 'chosen' : isUnlocked('traps', x) ? `Lv ${levelOf('traps', x)}` : ''}</div></div>`).join('')}</div>
      <div class="lore dr-lore"><div class="dr-mon">${esc(t.name)}</div>${esc(t.desc)}</div>
      <div class="dr-lockrow">${isUnlocked('traps', tid)
    ? `${L.trap === tid ? '<span class="sh-ok">&#10003; Equipped</span>' : `<button class="dr-buy" data-equipt="${tid}">Equip</button>`}${this.upBtn('traps', tid)}`
    : `<span>Locked</span>${this.lockBtn('traps', tid, UNLOCK_COST.trap)}`}</div>
      <div class="dr-note">As the monster you carry 2 of your chosen trap and set them with T.</div>`;
    d.innerHTML = `<div class="ld-h">Monster <small>${sub === 'weapons' ? 'any weapon fits any monster' : ''}</small></div>${this.subTabs('monster', [['monsters', 'Monsters'], ['weapons', 'Weapons'], ['traps', 'Traps']])}${sub === 'weapons' ? weaponPanelHtml(wid) : sub === 'traps' ? traps : monsters}`;
    this.bindSubs(d);

    const refresh = () => { saveProfile(); this.o.onUpdate?.(loadoutPrefs()); this.render(); };
    on('[data-mon]', 'click', (_, el) => {
      sfx.click(); const id = el.dataset.mon;
      if (isUnlocked('monsters', id)) { this.monPrev = null; L.monster = id; refresh(); } else { this.monPrev = id; this.render(); }
    }, d);
    on('[data-pickmon]', 'click', (_, el) => { sfx.click(); this.monPrev = null; L.monster = el.dataset.pickmon; refresh(); }, d);
    on('[data-weapon]', 'click', (_, el) => {
      sfx.click(); const id = el.dataset.weapon;
      if (isUnlocked('weapons', id)) { this.wPrev = null; L.weapon = id; refresh(); } else { this.wPrev = id; this.render(); }
    }, d);
    d.querySelectorAll('[data-weapon]').forEach((c) => c.addEventListener('mouseenter', () => {
      const id = c.dataset.weapon; if (this.wHover === id) return; this.wHover = id; this.o.scene.setLoadoutMonster(this.monPrev || L.monster, id); // preview in the monster's hand
    }));
    d.onmouseleave = () => { this.wHover = null; this.o.scene.setLoadoutMonster(this.monPrev || L.monster, this.wPrev || L.weapon); };
    on('[data-equipw]', 'click', (_, el) => { sfx.click(); L.weapon = el.dataset.equipw; this.wPrev = null; refresh(); }, d);
    on('[data-trap]', 'click', (_, el) => { sfx.click(); this.trapFocus = el.dataset.trap; this.render(); }, d);
    on('[data-equipt]', 'click', (_, el) => { sfx.click(); L.trap = el.dataset.equipt; refresh(); }, d);
    const unlockClick = (_, el) => {
      const [kind, id] = el.dataset.unlock.split(':');
      if (!unlock(kind, id)) return;
      sfx.key();
      if (kind === 'monsters') { L.monster = id; this.monPrev = null; }
      if (kind === 'weapons') { L.weapon = id; this.wPrev = null; }
      if (kind === 'traps') L.trap = id;
      refresh();
    };
    on('[data-unlock]', 'click', unlockClick, d);
    on('[data-upgrade]', 'click', (_, el) => { const [kind, id] = el.dataset.upgrade.split(':'); if (upgrade(kind, id)) { sfx.key(); this.o.onUpdate?.(loadoutPrefs()); this.render(); } }, d);
  }
}
