#!/usr/bin/env node
/**
 * V1_TESS — an offline replica of `src/arena/floor.ts`'s stone tessellation.
 *
 * Same pattern as `tools/tmp/v1_scatter.mjs` (round 9) and for the same reason: the
 * shipped loop runs inside a browser, so the only way to answer *"how many cells, how
 * varied, how many were DROPPED as degenerate"* without a render is to reproduce the
 * loop exactly and mirror-check its constants against the file.
 *
 * 🚨 A REPLICA THAT IS NOT PINNED TO THE FILE IS A SECOND IMPLEMENTATION, NOT A
 * MEASUREMENT. `--verify` greps the six constants out of `floor.ts` and fails if any of
 * them disagrees with the values below, so this file cannot quietly describe a floor
 * that is no longer shipped.
 *
 * Reports, per run:
 *   cells / skipped   the census. `skipped` is the count of sites whose cell was
 *                     degenerate after the two insets — the failure mode that shows up
 *                     as a HOLE in the floor with the subfloor visible through it, and
 *                     the reason this tool exists rather than a comment saying "rare".
 *   area p5/p50/p95   cell size spread, in wu^2. "Varied cell size" is the critic's
 *                     phrase; this is the number under it.
 *   sides             vertex-count histogram — "polygonal" made falsifiable.
 *   maxRun            the longest straight line, swept over angles, that stays within
 *                     `JOINT_W` of a cell EDGE for its whole traverse of a 500wu window.
 *                     This is the offline twin of `v1_joint`'s `maxLineCoverage`, and
 *                     the arm that a lattice fails.
 *
 * ## Known-bads (`--selftest`)
 *
 *   A  jitter 0 and no drops -> a perfect square lattice. maxRun must be ~1.0, the area
 *      spread must collapse, and every cell must have 4 sides. If this passes with the
 *      shipped constants' numbers, the tool is not reading its own inputs.
 *   B  the shipped constants -> maxRun must be far below A's, and the area spread wide.
 *   C  an inset larger than the cell inradius -> EVERY cell degenerate. The arm that
 *      proves `skipped` can be non-zero; without it, "0 skipped" is unfalsifiable.
 *
 * ## Use
 *
 *   node tools/tmp/v1_tess.mjs --selftest
 *   node tools/tmp/v1_tess.mjs --verify
 *   node tools/tmp/v1_tess.mjs --out tools/tmp/v1r2/tess_after.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes('--' + k);
const ROOT = resolve(new URL('../..', import.meta.url).pathname);

/** Mirrored from `src/arena/floor.ts`. `--verify` is what keeps them mirrored. */
export const SHIPPED = {
  ARENA_W: 2800,
  ARENA_H: 2000,
  TILE: 40,
  TILE_SITE_JITTER: 0.40,
  TILE_DROP_P: 0.40,
  TILE_CLEAN: 3.0,
  JOINT_W: 1.6,
  BEVEL_IN: 2.2,
};

// ── the geometry, character for character with floor.ts ──────────────────────

export function polyArea(p) {
  let a = 0;
  for (let i = 0, n = p.length; i < n; i++) { const q = p[(i + 1) % n]; a += p[i].x * q.y - q.x * p[i].y; }
  return a / 2;
}

export function clipHalf(p, nx, ny, d) {
  let cut = false;
  for (let i = 0; i < p.length; i++) if (nx * p[i].x + ny * p[i].y - d > 0) { cut = true; break; }
  if (!cut) return p;
  const out = [];
  for (let i = 0, n = p.length; i < n; i++) {
    const a = p[i], b = p[(i + 1) % n];
    const sa = nx * a.x + ny * a.y - d;
    const sb = nx * b.x + ny * b.y - d;
    if (sa <= 0) out.push(a);
    if ((sa < 0 && sb > 0) || (sa > 0 && sb < 0)) {
      const t = sa / (sa - sb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

export function polyClean(p, eps) {
  const out = [];
  for (let i = 0, n = p.length; i < n; i++) {
    const a = p[i], b = out.length ? out[out.length - 1] : p[n - 1];
    if (Math.hypot(a.x - b.x, a.y - b.y) > eps) out.push(a);
  }
  while (out.length >= 3 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) <= eps) out.pop();
  return out;
}

export function polyInset(p, d) {
  const n = p.length;
  if (n < 3) return null;
  const nrm = [], off = [];
  for (let i = 0; i < n; i++) {
    const a = p[i], b = p[(i + 1) % n];
    const ex = b.x - a.x, ey = b.y - a.y;
    const L = Math.hypot(ex, ey);
    if (L < 1e-9) return null;
    const ix = -ey / L, iy = ex / L;
    nrm.push({ x: ix, y: iy });
    off.push(ix * a.x + iy * a.y + d);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const k = (i - 1 + n) % n;
    const det = nrm[k].x * nrm[i].y - nrm[k].y * nrm[i].x;
    if (Math.abs(det) < 1e-9) return null;
    out.push({
      x: (off[k] * nrm[i].y - off[i] * nrm[k].y) / det,
      y: (nrm[k].x * off[i] - nrm[i].x * off[k]) / det,
    });
  }
  const a0 = polyArea(p), a1 = polyArea(out);
  if (a1 <= 0 || a1 >= a0) return null;
  for (let i = 0; i < n; i++) {
    for (let e = 0; e < n; e++) {
      if (nrm[e].x * out[i].x + nrm[e].y * out[i].y < off[e] - 1e-6) return null;
    }
  }
  return out;
}

/** The shipped LCG, seed and call ORDER — the order is what makes this a replica. */
export function tessellate(o = {}) {
  const C = { ...SHIPPED, ...o };
  let seed = 8191;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const COLS = Math.round(C.ARENA_W / C.TILE), ROWS = Math.round(C.ARENA_H / C.TILE);
  const n = COLS * ROWS;
  const sx = new Float64Array(n), sy = new Float64Array(n);
  const alive = new Uint8Array(n).fill(1);
  const J = C.TILE * C.TILE_SITE_JITTER;
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    const k = j * COLS + i;
    sx[k] = i * C.TILE + C.TILE / 2 + (rnd() - 0.5) * 2 * J;
    sy[k] = j * C.TILE + C.TILE / 2 + (rnd() - 0.5) * 2 * J;
  }
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    if (rnd() >= C.TILE_DROP_P) continue;
    let near = false;
    for (let dj = -1; dj <= 1 && !near; dj++) for (let di = -1; di <= 1; di++) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= COLS || jj >= ROWS) continue;
      if (!alive[jj * COLS + ii]) { near = true; break; }
    }
    if (!near) alive[j * COLS + i] = 0;
  }
  const rect = [{ x: 0, y: 0 }, { x: C.ARENA_W, y: 0 }, { x: C.ARENA_W, y: C.ARENA_H }, { x: 0, y: C.ARENA_H }];
  const cells = [];
  let skipped = 0, dropped = 0, noBevel = 0;
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    const k = j * COLS + i;
    if (!alive[k]) { dropped++; continue; }
    const kx = sx[k], ky = sy[k], kq = kx * kx + ky * ky;
    let poly = rect;
    for (let dj = -2; dj <= 2 && poly.length >= 3; dj++) {
      const jj = j + dj;
      if (jj < 0 || jj >= ROWS) continue;
      for (let di = -2; di <= 2; di++) {
        const ii = i + di;
        if (ii < 0 || ii >= COLS) continue;
        const m = jj * COLS + ii;
        if (m === k || !alive[m]) continue;
        poly = clipHalf(poly, 2 * (sx[m] - kx), 2 * (sy[m] - ky), sx[m] * sx[m] + sy[m] * sy[m] - kq);
        if (poly.length < 3) break;
      }
    }
    if (poly.length >= 3) poly = polyClean(poly, C.TILE_CLEAN);
    const outline = poly.length >= 3 ? polyInset(poly, C.JOINT_W / 2) : null;
    if (!outline) { skipped++; continue; }
    // Mirrors floor.ts: a bevel that will not fit narrows, then vanishes. It never
    // costs the stone, so `skipped` counts ONLY cells with no body at all.
    let top = polyInset(outline, C.BEVEL_IN);
    if (!top) top = polyInset(outline, C.BEVEL_IN * 0.45);
    if (!top) { top = outline; }
    noBevel += top === outline ? 1 : 0;
    cells.push({ poly, outline, sides: outline.length, area: polyArea(outline), site: { x: kx, y: ky } });
  }
  return { COLS, ROWS, sites: n, dropped, skipped, noBevel, cells };
}

/** Longest straight line that stays within `tol` wu of some cell EDGE, over a window. */
export function maxRun(cells, { x0 = 1200, y0 = 800, span = 500, tol = 2.1, res = 1, range = 20, step = 1 } = {}) {
  const W = Math.round(span / res);
  const grid = new Uint8Array(W * W);
  const mark = (ax, ay, bx, by) => {
    const L = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(2, Math.ceil(L / (res * 0.4)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = ax + (bx - ax) * t, py = ay + (by - ay) * t;
      const gx = Math.round((px - x0) / res), gy = Math.round((py - y0) / res);
      const r = Math.max(0, Math.round(tol / 2 / res));
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const u = gx + dx, v = gy + dy;
        if (u >= 0 && v >= 0 && u < W && v < W) grid[v * W + u] = 1;
      }
    }
  };
  for (const c of cells) {
    for (let i = 0, n = c.outline.length; i < n; i++) {
      const a = c.outline[i], b = c.outline[(i + 1) % n];
      if (Math.max(a.x, b.x) < x0 - 40 || Math.min(a.x, b.x) > x0 + span + 40) continue;
      if (Math.max(a.y, b.y) < y0 - 40 || Math.min(a.y, b.y) > y0 + span + 40) continue;
      mark(a.x, a.y, b.x, b.y);
    }
  }
  let best = 0;
  for (const axis of ['row', 'col']) {
    for (let deg = -range; deg <= range + 1e-9; deg += step) {
      const t = Math.tan((deg * Math.PI) / 180);
      const drift = (W - 1) * t;
      const lo = Math.max(0, Math.ceil(-Math.min(0, drift)));
      const hi = Math.min(W - 1, Math.floor(W - 1 - Math.max(0, drift)));
      for (let o = lo; o <= hi; o++) {
        let hits = 0;
        for (let s = 0; s < W; s++) {
          const p = Math.round(o + s * t);
          hits += axis === 'row' ? grid[p * W + s] : grid[s * W + p];
        }
        if (hits / W > best) best = hits / W;
      }
    }
  }
  return +best.toFixed(4);
}

export function report(r) {
  const areas = r.cells.map((c) => c.area).sort((a, b) => a - b);
  // 🚨 An empty cell list is exactly what arm C produces, and `[]` percentiles are
  // `undefined` — reporting 0 for them would make "every cell degenerate" look like a
  // clean floor. Say so instead.
  const pct = (p) => (areas.length === 0 ? null
    : +areas[Math.min(areas.length - 1, Math.round((areas.length - 1) * p))].toFixed(1));
  const sides = {};
  for (const c of r.cells) sides[c.sides] = (sides[c.sides] ?? 0) + 1;
  return {
    grid: `${r.COLS}x${r.ROWS}`, sites: r.sites, dropped: r.dropped, skipped: r.skipped, noBevel: r.noBevel,
    cells: r.cells.length,
    areaP5: pct(0.05), areaP50: pct(0.5), areaP95: pct(0.95),
    areaSpread: areas.length === 0 ? null : +(pct(0.95) / Math.max(1e-6, pct(0.05))).toFixed(2),
    sides,
  };
}

// ── verify + selftest ────────────────────────────────────────────────────────

function verify() {
  const src = readFileSync(resolve(ROOT, 'src/arena/floor.ts'), 'utf8');
  const shared = readFileSync(resolve(ROOT, 'src/arena/shared.ts'), 'utf8');
  const grab = (text, re, name) => {
    const m = text.match(re);
    if (!m) { console.log(`  FAIL  could not find ${name} in the tree`); return null; }
    return Number(m[1]);
  };
  const found = {
    ARENA_W: grab(shared, /export const ARENA_W = ([\d.]+)/, 'ARENA_W'),
    ARENA_H: grab(shared, /export const ARENA_H = ([\d.]+)/, 'ARENA_H'),
    TILE: grab(src, /\n  const TILE = ([\d.]+);/, 'TILE'),
    TILE_CLEAN: grab(src, /const TILE_CLEAN = ([\d.]+);/, 'TILE_CLEAN'),
    TILE_SITE_JITTER: grab(src, /const TILE_SITE_JITTER = ([\d.]+);/, 'TILE_SITE_JITTER'),
    TILE_DROP_P: grab(src, /const TILE_DROP_P = ([\d.]+);/, 'TILE_DROP_P'),
    JOINT_W: grab(src, /const JOINT_W = ([\d.]+);/, 'JOINT_W'),
    BEVEL_IN: grab(src, /const BEVEL_IN = ([\d.]+);/, 'BEVEL_IN'),
  };
  let bad = 0;
  for (const [k, v] of Object.entries(SHIPPED)) {
    const ok = found[k] === v;
    if (!ok) bad++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${k.padEnd(18)} replica ${v}   tree ${found[k]}`);
  }
  // The replica must also still be pointed at the merged-geometry path: if `floor.ts`
  // goes back to an InstancedMesh lattice this file would keep reporting a tessellation
  // that is not on screen.
  const merged = /stoneMesh\(lightBuf, tileLightInst, 'floor_stones_light'\)/.test(src);
  console.log(`  ${merged ? 'ok  ' : 'FAIL'} floor.ts still builds the merged stone field`);
  if (!merged) bad++;
  console.log(bad === 0 ? '\n  replica is pinned to the tree' : `\n  ${bad} DRIFTED`);
  process.exit(bad === 0 ? 0 : 1);
}

function selftest() {
  let pass = 0, fail = 0;
  const ck = (n, ok, d = '') => { if (ok) { pass++; console.log(`  ok   ${n}  ${d}`); } else { fail++; console.log(`  FAIL ${n}  ${d}`); } };

  console.log('\n§A  jitter 0, no drops — a perfect square lattice');
  const a = tessellate({ TILE_SITE_JITTER: 0, TILE_DROP_P: 0 });
  const ra = report(a);
  const runA = maxRun(a.cells);
  ck('A1 every cell is a quadrilateral', Object.keys(ra.sides).join() === '4', JSON.stringify(ra.sides));
  ck('A2 no size variation at all', ra.areaSpread < 1.02, `spread ${ra.areaSpread}`);
  ck('A3 a straight line runs the whole window on joints', runA > 0.95, `maxRun ${runA}`);

  console.log('\n§B  the SHIPPED constants');
  const b = tessellate();
  const rb = report(b);
  const runB = maxRun(b.cells);
  ck('B1 cells were produced', rb.cells > 1000, `${rb.cells} cells`);
  ck('B2 the polygons are not all quads', Object.keys(rb.sides).length >= 3, JSON.stringify(rb.sides));
  ck('B3 cell size genuinely varies', rb.areaSpread > 2.0, `p5 ${rb.areaP5} p50 ${rb.areaP50} p95 ${rb.areaP95}, spread ${rb.areaSpread}`);
  ck('B4 NO straight line survives — well below the lattice', runB < runA - 0.30, `maxRun ${runB} vs lattice ${runA}`);
  ck('B5 degenerate cells are a small minority', rb.skipped < rb.sites * 0.05, `${rb.skipped} skipped of ${rb.sites}`);

  console.log('\n§C  inset larger than the inradius — `skipped` must be able to fire');
  const c = report(tessellate({ JOINT_W: 90 }));
  ck('C1 every cell degenerate, so "0 skipped" is falsifiable', c.cells === 0 && c.skipped > 0, `${c.cells} cells, ${c.skipped} skipped`);

  console.log(`\n  ${pass} pass  ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
}

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_MAIN) {
  if (has('selftest')) selftest();
  else if (has('verify')) verify();
  else {
    const r = tessellate();
    const out = { ...report(r), maxRun: maxRun(r.cells) };
    console.log(JSON.stringify(out, null, 2));
    const dest = arg('out');
    if (dest) { mkdirSync(dirname(resolve(dest)), { recursive: true }); writeFileSync(resolve(dest), JSON.stringify(out, null, 2)); }
  }
}
