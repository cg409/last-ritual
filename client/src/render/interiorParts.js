// Procedural old-mansion furniture. Every piece is built from boxes in the item's local frame
// (x = across its front, z = depth, front faces local +Z) and merged into the interior batch.

// f(lx, ly, lz, w, h, d, mat, rx=0, rz=0) → adds a box placed in the item frame.
export function framer(B, it, y0) {
  const c = Math.cos(it.rot), s = Math.sin(it.rot);
  return (lx, ly, lz, w, h, d, mat, rx = 0, rz = 0) =>
    B.box(mat, w, h, d, it.x + lx * c + lz * s, y0 + ly, it.z - lx * s + lz * c, rx, it.rot, rz, 1);
}

function seating(f, it, M, legs) {
  const W = it.w, D = it.d, cl = it.kind === 'sofa' ? M.velvet : M.cloth;
  f(0, 0.22, 0.05, W, 0.3, D - 0.1, cl); f(0, 0.62, -D / 2 + 0.1, W, 0.75, 0.2, cl, -0.08);
  for (const sx of [-1, 1]) f(sx * (W / 2 - 0.07), 0.45, 0.02, 0.14, 0.32, D - 0.1, cl);
  legs(W, D, 0.08);
}

function bookshelf(f, it, M) {
  const W = it.w, D = it.d, H = it.h;
  f(0, H / 2, -D / 2 + 0.03, W, H, 0.06, M.wood);
  for (const sx of [-1, 1]) f(sx * (W / 2 - 0.03), H / 2, 0, 0.06, H, D, M.wood);
  for (let i = 0; i < 5; i++) {
    const y = 0.08 + i * (H - 0.2) / 4; f(0, y, 0, W - 0.08, 0.04, D - 0.04, M.wood);
    if (i === 4) break;
    let x = -W / 2 + 0.1; // rows of books with gaps, a few leaning
    while (x < W / 2 - 0.15) {
      const bw = 0.04 + Math.random() * 0.05, bh = 0.2 + Math.random() * 0.12;
      if (Math.random() > 0.15) f(x + bw / 2, y + 0.02 + bh / 2, 0.02, bw, bh, D - 0.14, M.books[(Math.random() * M.books.length) | 0], 0, Math.random() < 0.1 ? 0.25 : 0);
      x += bw + 0.005;
    }
  }
  f(0, H + 0.04, 0, W + 0.08, 0.08, D + 0.06, M.wood);
}

function fireplace(f, it, M) {
  const W = it.w, D = it.d;
  f(0, 0.05, 0.15, W + 0.4, 0.1, D + 0.4, M.stone);
  for (const sx of [-1, 1]) f(sx * (W / 2 - 0.15), 0.65, 0, 0.3, 1.2, D, M.stone);
  f(0, 1.3, 0, W, 0.2, D, M.stone); f(0, 1.43, 0.06, W + 0.25, 0.08, D + 0.15, M.wood);
  f(0, 0.62, -D / 2 + 0.05, W - 0.6, 1.1, 0.1, M.soot);
  f(0, 2.4, -0.05, W - 0.3, 1.9, D - 0.15, M.stone);
  for (let i = 0; i < 3; i++) f(-0.2 + i * 0.2, 0.18, 0, 0.5, 0.1, 0.1, M.wood, 0, (i - 1) * 0.4);
  f(-0.4, 1.58, 0.05, 0.06, 0.22, 0.06, M.brass); f(0.4, 1.58, 0.05, 0.06, 0.22, 0.06, M.brass);
}

function tables(f, it, M, legs) {
  const W = it.w, D = it.d, H = it.h;
  f(0, H - 0.03, 0, W, 0.06, D, M.wood); legs(W, D, H - 0.06, 0.07);
  if (it.kind === 'desk') { f(W / 2 - 0.3, H / 2, 0, 0.5, H - 0.1, D - 0.06, M.wood); f(-0.2, H + 0.02, 0, 0.3, 0.02, 0.22, M.paper, 0, 0.1); }
  if (it.kind !== 'dining') return;
  f(0, H + 0.005, 0, W - 0.3, 0.012, D * 0.4, M.velvet);
  for (let i = 0; i < 3; i++) for (const sz of [-1, 1]) { // chairs pushed in, a few knocked over
    const cx = -W / 2 + 0.55 + i * (W - 1.1) / 2, cz = sz * (D / 2 + 0.25), over = (i + sz + 3) % 3 === 0;
    f(cx, over ? 0.25 : 0.45, cz, 0.42, 0.05, 0.42, M.wood, over ? 1.3 * sz : 0);
    if (!over) f(cx, 0.75, cz + sz * 0.19, 0.42, 0.6, 0.05, M.wood);
  }
}

function cabinets(f, it, M, legs) {
  const W = it.w, D = it.d, H = it.h, k = it.kind;
  const solid = k !== 'bench' && k !== 'console';
  if (solid) f(0, H / 2, 0, W, H, D, k === 'stove' ? M.iron : M.wood);
  else { f(0, H - 0.03, 0, W, 0.06, D, M.wood); legs(W, D, H - 0.06, 0.05); }
  if (solid && k !== 'stove') for (let i = 0; i < 2; i++) f(-W / 4 + i * W / 2, H * 0.55, D / 2 + 0.01, W / 2 - 0.08, H * 0.6, 0.02, M.wood2);
  if (k === 'stove') f(W / 4, H + 0.6, -D / 4, 0.12, 1.2, 0.12, M.iron);
  if (k === 'dresser' || k === 'console') f(0, H + 0.45, -D / 2 + 0.02, W * 0.6, 0.8, 0.03, M.mirror);
}

export function buildPiece(B, it, y0, M) {
  const f = framer(B, it, y0), W = it.w, D = it.d, H = it.h;
  const legs = (w, d, h, t = 0.06, mat = M.wood) => { for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) f(a * (w / 2 - t), h / 2, b * (d / 2 - t), t, h, t, mat); };
  switch (it.kind) {
    case 'bookshelf': return bookshelf(f, it, M);
    case 'fireplace': return fireplace(f, it, M);
    case 'armchair': case 'sofa': return seating(f, it, M, legs);
    case 'roundtable': case 'coffeetable': case 'table': case 'desk': case 'dining': return tables(f, it, M, legs);
    case 'bench': case 'console': case 'sideboard': case 'dresser': case 'stove': return cabinets(f, it, M, legs);
    case 'chair': f(0, 0.45, 0, W, 0.05, D, M.wood); f(0, 0.75, -D / 2 + 0.03, W, 0.6, 0.05, M.wood); return legs(W, D, 0.45, 0.04);
    case 'rocking': f(0, 0.45, 0, W, 0.05, D * 0.6, M.wood); f(0, 0.85, -D * 0.3, W, 0.8, 0.05, M.wood, -0.15);
      for (const sx of [-1, 1]) f(sx * (W / 2 - 0.03), 0.05, 0, 0.04, 0.05, D, M.wood);
      return legs(W, D * 0.6, 0.42, 0.04);
    case 'clock': f(0, H / 2, 0, W, H, D, M.wood); f(0, H - 0.35, D / 2 + 0.01, W * 0.7, W * 0.7, 0.02, M.paper);
      return f(0, H * 0.45, D / 2 + 0.01, 0.06, 0.5, 0.02, M.brass, 0, 0.3);
    case 'chest': f(0, H / 2, 0, W, H, D, M.wood); f(0, H, 0, W + 0.02, 0.06, D + 0.02, M.wood);
      for (const sx of [-0.35, 0.35]) f(sx * W, H / 2, 0, 0.04, H + 0.02, D + 0.02, M.iron);
      return;
    case 'piano': f(0, 0.75, -0.05, W, 0.9, D - 0.1, M.black); f(0, 0.72, D / 2 - 0.1, W - 0.1, 0.04, 0.2, M.paper);
      f(0, 1.2, -D / 2 + 0.1, W, 0.1, 0.2, M.black); return legs(W, D, 0.3, 0.07, M.black);
    case 'bed': f(0, 0.3, 0, W, 0.25, D, M.wood); f(0, 0.48, 0.05, W - 0.08, 0.14, D - 0.15, M.sheet, 0.02);
      f(0, 0.62, -D / 2 + 0.25, W * 0.7, 0.12, 0.3, M.sheet); f(0, 0.8, -D / 2 + 0.04, W + 0.06, 1.3, 0.08, M.wood);
      f(0, 0.45, D / 2 - 0.04, W + 0.06, 0.7, 0.08, M.wood); return legs(W, D, 0.2, 0.08);
    case 'crib': f(0, 0.45, 0, W, 0.05, D, M.wood);
      for (let i = 0; i <= 8; i++) for (const sz of [-1, 1]) f(-W / 2 + i * W / 8, 0.7, sz * (D / 2 - 0.02), 0.025, 0.5, 0.025, M.wood);
      return legs(W, D, 0.45, 0.05);
    case 'wardrobe': f(0, H / 2, 0, W, H, D, M.wood); f(0, H + 0.05, 0, W + 0.1, 0.1, D + 0.08, M.wood);
      f(-W / 4, H / 2, D / 2 + 0.02, W / 2 - 0.05, H - 0.2, 0.03, M.wood2);
      return f(W / 4 + 0.08, H / 2, D / 2 + 0.2, W / 2 - 0.05, H - 0.2, 0.03, M.wood2); // one door ajar
    default: return f(0, H / 2, 0, W, H, D, M.wood);
  }
}
