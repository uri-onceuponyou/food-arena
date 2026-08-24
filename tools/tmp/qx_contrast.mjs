#!/usr/bin/env node
/**
 * qx_contrast — can a player SEE this control?
 *
 * `tools/tmp/chip_probe.mjs` answers *where the pause chip is* and
 * `tools/tmp/thumbzone.mjs` answers *whether a thumb lands on it*. Neither can answer
 * the question that actually cost this project the feature: **is there anything there
 * to look at.** The chip measured **1.026:1** between its own fill and the pixels
 * immediately outside it at 390x844 — one is "identical" — so the plate was invisible
 * and the only thing on screen was two 4px cream bars.
 *
 * ── What is measured, and why it is the BOUNDARY and not the fill ────────────
 * WCAG 2.1 SC 1.4.11 (Non-text Contrast) asks for **3:1 between a UI component's
 * visual boundary and the adjacent colour**, which is deliberately implementation
 * agnostic: a control may draw its edge as a border, an outline, a shadow ring or a
 * change of fill, and any of those satisfies it. So this takes three bands around the
 * element's border box —
 *
 *     inner     0..EDGE px INSIDE  the rect  (a border, or the fill if there is none)
 *     ring      0..EDGE px OUTSIDE the rect  (an outline / box-shadow spread, which
 *                                             `getBoundingClientRect` does NOT include)
 *     backdrop  GAP..GAP+BAND px outside     (what the control sits on)
 *
 * — and reports `boundary = max(ratio(inner, backdrop), ratio(ring, backdrop))`.
 * Taking the max is the point: it asks "is there a visible step anywhere across this
 * edge", which is the player's question, rather than "is the fill light", which is a
 * design choice and fails whichever backdrop it was not tuned for.
 *
 * 🚨 **AND THE BANDS ARE SCANNED ONE PIXEL AT A TIME, BECAUSE THE FIRST VERSION
 * AVERAGED THEM AND UNDER-READ A REAL EDGE BY 8x.** A `ring` band four CSS px wide
 * containing a two px outline and two px of backdrop returns the MEAN of the two, so a
 * 17:1 outline measured **2.14:1** and the tool reported a fixed control as still
 * broken. That is the "confident wrong answer" class (`CLAUDE.md` rule 6) pointing the
 * safe way for once — it would have sent an agent re-fixing something already fixed.
 * Each 1px offset from the edge is now its own sample and the best one wins, which is
 * what "is there a visible boundary" actually means: an edge one pixel wide is still
 * an edge. Validate with `--selftest`, which plants a known-bad.
 *
 * ⚠️ **NON-EMPTY FIRST** (`CLAUDE.md` rule 6). Every band is asserted to have pixels
 * in it before any statistic is taken over it. A rect partly off-screen, or a
 * `--dsf` that does not match the capture, silently empties a band, and a mean over an
 * empty set is a confident meaningless number — `[].every()` is `true` and so is the
 * arithmetic equivalent.
 *
 *   node tools/tmp/qx_contrast.mjs --in shot.png --x 14 --y 143 --w 44 --h 44 --dsf 2
 */
import sharp from 'sharp';

const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const relLum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [hi, lo] = a > b ? [a, b] : [b, a]; return (hi + 0.05) / (lo + 0.05); };

/** CSS px. `EDGE` covers a 3px border plus a 2px shadow ring; `GAP` clears both. */
const EDGE = 4;
const GAP = 6;
const BAND = 10;

export async function boundaryContrast(file, rect, dsf = 2) {
  const img = sharp(file);
  const { width: W, height: H } = await img.metadata();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const chan = info.channels;
  const at = (x, y) => { const i = (y * W + x) * chan; return [data[i], data[i + 1], data[i + 2]]; };
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

  const x0 = Math.round(rect.x * dsf), y0 = Math.round(rect.y * dsf);
  const w = Math.round(rect.w * dsf), h = Math.round(rect.h * dsf);
  const e = Math.round(EDGE * dsf), g = Math.round(GAP * dsf), b = Math.round(BAND * dsf);

  // One bucket per 1px offset from the edge: outward offsets 1..e in `out`, inward
  // offsets 0..e-1 in `inn`. Averaging across offsets is what destroyed the signal.
  const out = Array.from({ length: e + 1 }, () => []);
  const inn = Array.from({ length: e }, () => []);
  const back = [], fill = [];
  for (let y = y0 - g - b; y < y0 + h + g + b; y++) {
    for (let x = x0 - g - b; x < x0 + w + g + b; x++) {
      if (!inside(x, y)) continue;
      // Chebyshev distance to the rect, which is what an axis-aligned border band is.
      const dx = Math.max(x0 - x, x - (x0 + w - 1), 0);
      const dy = Math.max(y0 - y, y - (y0 + h - 1), 0);
      const outDist = Math.max(dx, dy);
      if (outDist === 0) {
        const inDist = Math.min(x - x0, x0 + w - 1 - x, y - y0, y0 + h - 1 - y);
        if (inDist < e) inn[inDist].push(at(x, y));
        // The fill sample skips the middle third, where the glyph lives.
        else if (inDist > h * 0.34) { /* glyph zone — excluded */ }
        else fill.push(at(x, y));
      } else if (outDist <= e) out[outDist].push(at(x, y));
      else if (outDist > g && outDist <= g + b) back.push(at(x, y));
    }
  }

  // 🚨 NON-EMPTY FIRST. Every band a statistic is taken over is asserted to have
  // pixels in it, and so is the set of bands itself — `Math.max(...[])` is `-Infinity`
  // and would sail through a `>= 3.0` comparison as a clean, confident FAIL, which is
  // the vacuity failure wearing the other mask.
  const empty = [];
  if (!back.length) empty.push('backdrop');
  if (!fill.length) empty.push('fill');
  inn.forEach((s, i) => { if (!s.length) empty.push(`inner+${i}`); });
  out.forEach((s, i) => { if (i > 0 && !s.length) empty.push(`ring+${i}`); });
  if (empty.length) {
    throw new Error(
      `qx_contrast: EMPTY band(s) ${empty.join(',')} for rect ${JSON.stringify(rect)} ` +
      `@dsf${dsf} in a ${W}x${H} image — non-empty first, a statistic over an empty band ` +
      `is a confident meaningless number`);
  }

  const meanL = (s) => {
    const m = s.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]).map((v) => v / s.length);
    return { rgb: m.map(Math.round), L: relLum(...m) };
  };
  const mb = meanL(back), mf = meanL(fill);
  const scan = (bands, from) => {
    let best = { r: 0, off: -1, rgb: null };
    bands.forEach((s, i) => {
      if (i < from || !s.length) return;
      const m = meanL(s);
      const r = ratio(m.L, mb.L);
      if (r > best.r) best = { r, off: i, rgb: m.rgb };
    });
    return best;
  };
  const bi = scan(inn, 0), br = scan(out, 1);
  if (bi.off < 0 || br.off < 0) throw new Error('qx_contrast: no band survived the scan');
  return {
    boundary: +Math.max(bi.r, br.r).toFixed(3),
    innerVsBackdrop: +bi.r.toFixed(3),
    ringVsBackdrop: +br.r.toFixed(3),
    fillVsBackdrop: +ratio(mf.L, mb.L).toFixed(3),
    bestOffsets: { innerPx: bi.off, ringPx: br.off },
    rgb: { inner: bi.rgb, ring: br.rgb, backdrop: mb.rgb, fill: mf.rgb },
    counts: { backdrop: back.length, fill: fill.length, bands: inn.length + out.length - 1 },
  };
}

/**
 * `--selftest` — the tool's LOGIC only, and it says so.
 *
 * ⚠️ `AGENT-BRIEF §4.4`: this validates what the maths does, never where the tool is
 * POINTED. Two synthetic plates, identical except for a bright 2px ring:
 *   NO-RING   a dark square on a dark ground        → boundary must be < 1.5
 *   RING      the same square with a cream outline  → boundary must be > 10
 * If the second does not clear the first by an order of magnitude the scan is
 * averaging its bands again and every number it prints is an under-read.
 */
async function selftest() {
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const S = 120, R = { x: 40, y: 40, w: 40, h: 40 };
  const mk = async (ring, file) => {
    const buf = Buffer.alloc(S * S * 3);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 3;
      const dx = Math.max(R.x - x, x - (R.x + R.w - 1), 0);
      const dy = Math.max(R.y - y, y - (R.y + R.h - 1), 0);
      const d = Math.max(dx, dy);
      let c = [21, 15, 30];                       // ground
      if (d === 0) c = [26, 18, 36];              // plate — 1.026:1 on the ground
      else if (ring && d <= 2) c = [255, 243, 222]; // the 2px cream outline
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
    }
    await sharp(buf, { raw: { width: S, height: S, channels: 3 } }).png().toFile(file);
    return file;
  };
  const noRing = await boundaryContrast(await mk(false, join(tmpdir(), 'qx_ct_noring.png')), R, 1);
  const withRing = await boundaryContrast(await mk(true, join(tmpdir(), 'qx_ct_ring.png')), R, 1);
  const rows = [
    ['KNOWN-BAD no ring reads LOW', noRing.boundary < 1.5, noRing.boundary],
    ['RING reads HIGH', withRing.boundary > 10, withRing.boundary],
    ['ring beats no-ring by >5x', withRing.boundary / noRing.boundary > 5,
      +(withRing.boundary / noRing.boundary).toFixed(1)],
  ];
  let bad = 0;
  for (const [name, ok, v] of rows) { if (!ok) bad++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}  ${v}`); }
  console.log(`qx_contrast --selftest: ${rows.length} rows, ${bad} faults (LOGIC only — not where it points)`);
  process.exitCode = bad === 0 ? 0 : 1;
}

// IS_MAIN guard: `qx_quit.mjs` imports `boundaryContrast`, and three tools in this
// directory have run a live side effect on import for want of exactly this line.
if (import.meta.url === `file://${process.argv[1]}`) {
  const A = process.argv.slice(2);
  const g = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
  if (A.includes('--selftest')) {
    await selftest();
  } else {
    const rect = { x: Number(g('--x')), y: Number(g('--y')), w: Number(g('--w')), h: Number(g('--h')) };
    console.log(JSON.stringify(await boundaryContrast(g('--in'), rect, Number(g('--dsf', 2))), null, 1));
  }
}
