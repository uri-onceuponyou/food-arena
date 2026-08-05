#!/usr/bin/env node
/**
 * hm_lang — "is this screen speaking GAME UI or coloured paper?", as four numbers.
 *
 * ── Why this exists, and why it is PIXELS and not the DOM ───────────────────────
 * Uri: *"I've had a look at the Home Screen and menus and we need to do a better job
 * there. Looks amateurish."* The blind critic independently put home at 5.17 against a
 * reference 8.50 — the second-worst element in the game. `docs/LESSONS.md` §3 says take
 * the symptom and re-derive the cause, and CLAUDE.md §9 says define the acceptance test
 * BEFORE round 1 or the loop oscillates at its own noise floor.
 *
 * The obvious instrument — walk the DOM, count distinct (fill, radius, border, shadow)
 * tuples — CANNOT BE RUN ON THE REFERENCE. `reference/images/curated/menus/*.png` are
 * screenshots; they have no DOM. A metric computed one way on ours and another way on
 * the plate is worthless (it measures the two instruments, not the two screens), so
 * every number here is computed by the SAME function over an RGB bitmap, and the plates
 * go through it unchanged.
 *
 * ── The four numbers, and which of the six diagnosed defects each one tests ─────
 *
 *   flat%   share of 12x12 tiles whose luma stdev is below 2.5 — i.e. featureless.
 *           This IS the "coloured paper" complaint stated as a number: a flat radial
 *           gradient over 60% of the frame is 60% featureless, and a rendered room with
 *           pipes and machinery in it is nearly 0%. Tests diagnosed item 1 (backdrop).
 *
 *   hues    EFFECTIVE number of hues, 1 / sum(p_i^2) over 24 bins of 15 degrees,
 *           counted only over chromatic pixels (HSV S >= 0.22, V >= 0.12). Simpson
 *           diversity, not a raw bin count, so one dominant hue plus 23 traces scores
 *           ~1.0 rather than 24. Tests items 3 and 6: a screen where every panel is the
 *           same cream on the same orange has ~2 effective hues; one that differentiates
 *           tiles BY FUNCTION spends more of the wheel.
 *
 *   edge%   share of pixels on a luma step >= 30 (max of the forward differences in x
 *           and y). Hard outlines, bevels, drop shadows and background detail all
 *           produce these; a hairline border on cream against cream does not. Tests
 *           items 4 (depth) and 1 (backdrop detail).
 *
 *   dark%   share of pixels below luma 45. The outline-and-shadow budget. Brawl Stars
 *           puts a ~3px near-black outline and a hard drop shadow on every single tile;
 *           ours has a 3px ink border and one 3px lip, and the difference shows up here.
 *
 * ⚠️ NONE OF THESE IS A LICENCE TO DESATURATE OR TO DARKEN THE ART. `dark%` counts
 * OUTLINE and SHADOW pixels, which is a UI-material budget, not an exposure setting;
 * CLAUDE.md is explicit that fixing anything by desaturating has been falsified four
 * times. `hues` deliberately rewards ADDING cool chroma rather than removing warm,
 * which is the direction `docs/LESSONS.md` §8 measured as cheaper.
 *
 * ── Scale normalisation, which is load-bearing ──────────────────────────────────
 * `flat%` and `edge%` are tile- and pixel-local, so they are scale dependent: the same
 * screenshot at 2556 px wide has smoother 12x12 tiles than at 1600. Every input is
 * therefore resized to a common width (default 1200) before anything is measured. The
 * plates are 2556x1179 and our captures are 1600x900; without this the comparison would
 * be measuring the screenshot resolution.
 *
 * ── Validated against known-bad input (CLAUDE.md non-negotiable #6) ─────────────
 * `--selftest` synthesises six images whose correct answers are known by construction
 * and requires the instrument to FAIL each one in the specific way it should — a flat
 * fill must read ~100% flat / 1.0 hues / 0% edge, white noise must read ~0% flat and a
 * high edge share, and so on. A guard that has not been shown to fail on the thing it
 * guards against is not a guard.
 *
 * Usage:
 *   node tools/tmp/hm_lang.mjs --selftest
 *   node tools/tmp/hm_lang.mjs shots/homelook/home.png shots/homelook/select.png ...
 *   node tools/tmp/hm_lang.mjs --json --out shots/home2/lang-before.json <files...>
 */

import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, basename } from 'node:path';

const NORM_W = 1200;
const TILE = 12;
const FLAT_STDEV = 2.5;
const EDGE_STEP = 30;
const DARK_LUMA = 45;
const SAT_MIN = 0.22;
const VAL_MIN = 0.12;
const HUE_BINS = 24;

function luma(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; }

/** HSV hue in degrees plus saturation/value, from 0-255 channels. */
function hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = 60 * (((g - b) / d) % 6);
    else if (mx === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: mx === 0 ? 0 : d / mx, v: mx / 255 };
}

/** The whole instrument. `px` is tightly packed RGB, W x H. */
export function measure(px, W, H) {
  // ── flat: tile stdev of luma ──────────────────────────────────────────────
  let tiles = 0, flatTiles = 0;
  for (let ty = 0; ty + TILE <= H; ty += TILE) {
    for (let tx = 0; tx + TILE <= W; tx += TILE) {
      let s = 0, s2 = 0;
      for (let y = ty; y < ty + TILE; y++) {
        for (let x = tx; x < tx + TILE; x++) {
          const i = (y * W + x) * 3;
          const l = luma(px[i], px[i + 1], px[i + 2]);
          s += l; s2 += l * l;
        }
      }
      const n = TILE * TILE;
      const varr = Math.max(0, s2 / n - (s / n) ** 2);
      tiles++;
      if (Math.sqrt(varr) < FLAT_STDEV) flatTiles++;
    }
  }

  // ── edge, dark, hue histogram ─────────────────────────────────────────────
  const hist = new Float64Array(HUE_BINS);
  let chromatic = 0, edge = 0, dark = 0, n = 0;
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const i = (y * W + x) * 3;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const l = luma(r, g, b);
      n++;
      if (l < DARK_LUMA) dark++;
      const ix = i + 3;
      const iy = i + W * 3;
      const dx = Math.abs(l - luma(px[ix], px[ix + 1], px[ix + 2]));
      const dy = Math.abs(l - luma(px[iy], px[iy + 1], px[iy + 2]));
      if (Math.max(dx, dy) >= EDGE_STEP) edge++;
      const c = hsv(r, g, b);
      if (c.s >= SAT_MIN && c.v >= VAL_MIN) {
        hist[Math.min(HUE_BINS - 1, Math.floor(c.h / (360 / HUE_BINS)))]++;
        chromatic++;
      }
    }
  }
  let simpson = 0;
  if (chromatic > 0) for (let i = 0; i < HUE_BINS; i++) { const p = hist[i] / chromatic; simpson += p * p; }

  return {
    flat: +(100 * flatTiles / Math.max(1, tiles)).toFixed(2),
    hues: +(chromatic > 0 ? 1 / simpson : 0).toFixed(2),
    edge: +(100 * edge / Math.max(1, n)).toFixed(2),
    dark: +(100 * dark / Math.max(1, n)).toFixed(2),
    chroma: +(100 * chromatic / Math.max(1, n)).toFixed(2),
  };
}

async function measureFile(path) {
  const img = sharp(path).removeAlpha().resize({ width: NORM_W, fit: 'inside', kernel: 'lanczos3' });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  return measure(data, info.width, info.height);
}

/** Build a raw RGB buffer from a per-pixel function. */
function synth(W, H, fn) {
  const px = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [r, g, b] = fn(x, y);
      const i = (y * W + x) * 3;
      px[i] = r; px[i + 1] = g; px[i + 2] = b;
    }
  }
  return px;
}

/**
 * KNOWN-BAD-INPUT VALIDATION. Six synthetic images whose answers follow from their
 * construction, each asserted in the direction that would catch the instrument being
 * broken. Nineteen instruments were caught returning confident wrong answers in one
 * session on this project; this is the price of being believed.
 */
function selftest() {
  const W = 1200, H = 900;
  const cases = [];
  const push = (name, px, checks) => cases.push({ name, m: measure(px, W, H), checks });

  // 1. A single flat orange. The literal "coloured paper" case.
  push('flat-fill', synth(W, H, () => [232, 120, 44]), {
    'flat >= 99': (m) => m.flat >= 99,
    'hues <= 1.05': (m) => m.hues <= 1.05,
    'edge == 0': (m) => m.edge === 0,
    'dark == 0': (m) => m.dark === 0,
  });

  // 2. White noise. The opposite pole: nothing flat, edges everywhere.
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  push('white-noise', synth(W, H, () => [rnd() * 255, rnd() * 255, rnd() * 255]), {
    'flat == 0': (m) => m.flat === 0,
    'edge >= 50': (m) => m.edge >= 50,
    'hues >= 10': (m) => m.hues >= 10,
  });

  // 3. A smooth vertical ramp. THE CASE THAT SEPARATES flat FROM edge: a gradient has
  //    no local structure (so it must read as flat) but is not one colour. If `flat`
  //    used a global histogram instead of tile-local stdev this would fail.
  push('smooth-ramp', synth(W, H, (x, y) => [40 + (y / H) * 200, 30 + (y / H) * 120, 20]), {
    'flat >= 95': (m) => m.flat >= 95,
    'edge == 0': (m) => m.edge === 0,
  });

  // 4. Six saturated hues in vertical bands. `hues` must recover ~6, not 24 and not 1.
  const six = [[255, 40, 40], [255, 170, 30], [240, 235, 40], [60, 210, 70], [50, 140, 240], [160, 70, 230]];
  push('six-hues', synth(W, H, (x) => six[Math.floor(x / (W / 6)) % 6]), {
    'hues 5.3..6.2': (m) => m.hues >= 5.3 && m.hues <= 6.2,
    'flat >= 95': (m) => m.flat >= 95,
  });

  // 5. Same six hues, but one of them covering 95% of the frame. Simpson must collapse
  //    toward 1 — a RAW BIN COUNT would still say 6 here, and that is the exact way this
  //    metric could have flattered our own orange-on-orange screen.
  push('one-hue-dominant', synth(W, H, (x, y) => (y > H * 0.95 ? six[(Math.floor(x / (W / 5)) + 1) % 6] : six[0])), {
    'hues <= 1.4': (m) => m.hues <= 1.4,
  });

  // 6. Black grid lines on cream — an outlined-tile mock, 4 px lines on a 60 px pitch.
  //    Every expectation here is ARITHMETIC, not a guess, which is the point: a 4/60
  //    duty cycle in each axis leaves (1 - 4/5 * 4/5) = 36% of 12 px tiles touched by a
  //    line, so flat must land at 64; each line has two boundaries, so the edge share is
  //    about 2*(2/60) = 6.7%; and the ink covers 1 - (56/60)^2 = 12.9% of the frame.
  //
  //    ⚠️ The first draft of this case asserted `edge >= 10` and `flat <= 55` and the
  //    selftest failed 2 of 15. THE INSTRUMENT WAS RIGHT AND THE EXPECTATIONS WERE
  //    WRONG — it returned 6.02 and 64.00, both within rounding of the arithmetic above.
  //    Recorded rather than quietly corrected, because "the guard failed so I loosened
  //    the guard" is exactly the move that produces an instrument nobody should believe.
  //    The bounds below are tight windows around the derived values, so this case still
  //    fails if either metric drifts.
  push('outlined-tiles', synth(W, H, (x, y) => ((x % 60 < 4 || y % 60 < 4) ? [12, 10, 16] : [250, 240, 218])), {
    'dark 11..15': (m) => m.dark >= 11 && m.dark <= 15,
    'edge 5..8': (m) => m.edge >= 5 && m.edge <= 8,
    'flat 60..68': (m) => m.flat >= 60 && m.flat <= 68,
    // Greyscale in, so every pixel is below SAT_MIN and the hue metric must report
    // NOTHING rather than a spurious bin. A hue histogram that counted achromatic
    // pixels would read 1.0 here and would then flatter any cream-on-cream screen.
    'hues == 0 (achromatic)': (m) => m.hues === 0 && m.chroma === 0,
  });

  let pass = 0, fail = 0;
  for (const c of cases) {
    for (const [label, fn] of Object.entries(c.checks)) {
      const ok = fn(c.m);
      if (ok) pass++; else fail++;
      console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${c.name.padEnd(18)} ${label.padEnd(16)} -> ${JSON.stringify(c.m)}`);
    }
  }
  console.log(`\nselftest: ${pass} passed, ${fail} failed of ${pass + fail}`);
  return fail === 0;
}

/* ── CLI, guarded ──────────────────────────────────────────────────────────────
   `measure()` is imported by `hm_shot.mjs`, and an ES module body RUNS on import. The
   first version of this file had the CLI at top level, so importing it made the
   importer's own `--url http://...` land in `files` and sharp threw
   "Input file is missing: http://localhost:50786" from inside a capture run. The
   argv-0 check is what makes this file both a tool and a library. */
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
const argv = process.argv.slice(2);
if (isMain && argv.includes('--selftest')) {
  process.exit(selftest() ? 0 : 1);
}
if (!isMain) {
  // Imported as a library — nothing else to do.
} else {

const files = argv.filter((a) => !a.startsWith('--'));
const outIdx = argv.indexOf('--out');
const out = outIdx >= 0 ? argv[outIdx + 1] : null;
if (files.length === 0) {
  console.error('usage: hm_lang.mjs [--selftest] [--out file.json] <png...>');
  process.exit(2);
}

const rows = {};
console.log('  file                                   flat%    hues   edge%   dark%  chroma%');
for (const f of files) {
  if (f === out) continue;
  const m = await measureFile(f);
  rows[f] = m;
  console.log(
    `  ${basename(dirname(f)) + '/' + basename(f)}`.padEnd(42)
    + `${String(m.flat).padStart(6)}  ${String(m.hues).padStart(6)}  `
    + `${String(m.edge).padStart(6)}  ${String(m.dark).padStart(6)}  ${String(m.chroma).padStart(7)}`,
  );
}
if (out) {
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify({ tool: 'hm_lang', normWidth: NORM_W, at: new Date().toISOString(), rows }, null, 2));
  console.log(`\nwrote ${out}`);
}

}
