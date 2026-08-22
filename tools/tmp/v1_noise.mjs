#!/usr/bin/env node
/**
 * V1_NOISE — how much SPECKLE is on the floor, and is it dispersed or placed?
 *
 * ## The claim this exists to re-derive
 *
 * Uri, looking at the game: *"hundreds of small polygonal debris pieces scattered at
 * uniform density across the entire arena, each casting its own shadow. The result is
 * visual noise with no rest for the eye."* The orchestrator's brief attached a number to
 * that — *"non-tile-hue coverage is 5.15% across 1,056 components under 2,000 px"* — with
 * no tool in the tree that produces it. So this file produces one, and reports what it
 * measures rather than what it was handed.
 *
 * ## What it measures, and why it is TWO numbers rather than one
 *
 * The layer has two visual products and they fail differently, so they are counted
 * separately. Merging them is how a report ends up unable to say which half a fix moved.
 *
 *   HUE-OFF   pixels whose hue is more than `--hue-tol` degrees from the frame's own
 *             modal hue, at a saturation floor so near-neutral pixels (whose hue is
 *             numerically unstable) cannot join. This is the CHIP.
 *   DARK      pixels below `median luma - --dark-tol`. This is the chip's own contact
 *             SHADOW, which `src/arena/floor.ts` deliberately exempts from the
 *             "ground markings do not cast shadows" sweep — and which is the half Uri
 *             named explicitly.
 *
 * For each: coverage as a share of the crop, the number of 4-connected components, and
 * a size histogram. **Coverage alone cannot tell dispersed speckle from placed
 * decoration** — 5% of the frame is 5% of the frame whether it is one drift or a
 * thousand specks — so the component count and the size distribution are the part of
 * this measurement that actually answers Uri's sentence.
 *
 * ## Stations are DERIVED, and all four quadrants are asserted
 *
 * `tools/tmp/floorprobe.mjs` — the floor's own acceptance test — has five stations at
 * (400,500) (340,500) (160,500) (1150,330) (700,640): every one a 1× map coordinate, all
 * five in the NW quadrant of the 2800×2000 arena. `al_guard` §D is the arm built for
 * exactly that and does NOT flag it, because `al_lib.addressesShippedArena()` returns
 * false for a file that renders `preview.html` and never reads `__matchArena` — so the
 * legality gate is switched off for it. Reported to the orchestrator, not fixed here
 * (out of file set).
 *
 * This tool therefore derives its own stations from `tools/arena.gameplay.json`: a grid
 * over the playfield, filtered to points clear of every `CoverBox` and outside the pot's
 * burn ring, then spread so that **all four quadrants are represented** — asserted, and
 * the assertion is what makes the spread a measurement rather than a hope. The filtered
 * candidate set is asserted NON-EMPTY before anything is filtered out of it.
 *
 * ## The known-bad
 *
 *   --selftest   synthesises a flat tile field, stamps a KNOWN number of off-hue discs
 *                and a KNOWN number of dark discs, and requires the census to recover
 *                both counts. A flat field must return ZERO components — and the
 *                stamped field must return NON-ZERO, or "0 components" is being produced
 *                by a blind detector rather than by a clean floor.
 *
 * ## Use
 *
 *   node tools/tmp/v1_noise.mjs --selftest
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-v1-before -- \
 *     node tools/tmp/v1_noise.mjs --url '{URL}' --tag before --out tools/tmp/v1_noise_before.json
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes('--' + k);

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const BASE = String(arg('url', process.env.PREVIEW_BASE ?? 'http://localhost:5173')).replace(/\/$/, '');
const TAG = String(arg('tag', 'run'));
const OUT = arg('out', null);
const SHOTS = arg('shots', null);
const HUE_TOL = Number(arg('hue-tol', 25));
const SAT_FLOOR = Number(arg('sat-floor', 0.10));
const DARK_TOL = Number(arg('dark-tol', 0.06));
const SMALL = Number(arg('small', 2000));
const W = 1600, H = 900;
const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

// ─────────────────────────────────────────────────────────────────────────────
// image maths — pure, so `--selftest` can drive it with no browser
// ─────────────────────────────────────────────────────────────────────────────

/** hue in degrees (0 if achromatic), saturation 0..1 (HSV), luma 0..1 (Rec.709). */
export function hsl3(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = 60 * (((g - b) / d) % 6);
    else if (mx === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
  }
  return { h, s: mx > 0 ? d / mx : 0, l: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 };
}

export function hueDist(a, b) { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

/**
 * The frame's SURFACE hues — one entry per dominant hue cluster.
 *
 * 🚨 THIS WAS A SINGLE CIRCULAR MEAN AND THE FIRST REAL RUN FALSIFIED IT.
 * Station `ne_0` (2178,286) sits half on rose tile and half on the blue service
 * decking. A saturation-weighted circular mean of a bimodal frame lands **between** the
 * two modes — measured 286.4°, roughly 50° from *both* surfaces — so 99.169% of that
 * frame was reported "hue-off" against 5-7% at every other station. The number was
 * confidently wrong in the flattering direction for the round (it makes the BEFORE look
 * catastrophic), which is exactly the shape `CLAUDE.md` rule 6 is about. The old
 * one-mean wording is kept above rather than deleted because the reason it failed is the
 * finding: **a frame here is routinely two surfaces, and a mean is a hue no surface has.**
 *
 * So: saturation-weighted hue histogram, keep every bin at or above `peakFrac` of the
 * peak, merge adjacent bins into clusters, return each cluster's own circular mean. A
 * pixel is "off-surface" only when it is far from EVERY cluster.
 */
export function surfaceHues(px, n, { bins = 36, peakFrac = 0.25 } = {}) {
  const w = new Float64Array(bins);
  const cx = new Float64Array(bins), cy = new Float64Array(bins);
  for (let i = 0; i < n; i++) {
    const { h, s } = hsl3(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]);
    if (s <= 0) continue;
    const b = Math.min(bins - 1, Math.floor((h / 360) * bins));
    w[b] += s;
    cx[b] += Math.cos((h * Math.PI) / 180) * s;
    cy[b] += Math.sin((h * Math.PI) / 180) * s;
  }
  const peak = Math.max(...w);
  if (peak <= 0) return [];
  const keep = Array.from(w, (v) => v >= peak * peakFrac);
  // Merge adjacent kept bins, wrapping at 360.
  const clusters = [];
  const used = new Array(bins).fill(false);
  for (let b = 0; b < bins; b++) {
    if (!keep[b] || used[b]) continue;
    let sx = 0, sy = 0, tw = 0;
    // walk backwards to the cluster start so a wrapped run is collected once
    let start = b;
    while (keep[(start - 1 + bins) % bins] && (start - 1 + bins) % bins !== b) start = (start - 1 + bins) % bins;
    let k = start;
    do {
      if (used[k]) break;
      used[k] = true; sx += cx[k]; sy += cy[k]; tw += w[k];
      k = (k + 1) % bins;
    } while (keep[k]);
    let hh = (Math.atan2(sy, sx) * 180) / Math.PI;
    if (hh < 0) hh += 360;
    clusters.push({ hue: +hh.toFixed(1), weight: tw });
  }
  return clusters.sort((a, b2) => b2.weight - a.weight);
}

/** 4-connected component sizes over a Uint8Array mask. Iterative — no recursion depth. */
export function components(mask, w, h) {
  const seen = new Uint8Array(w * h);
  const sizes = [];
  const stack = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || seen[i]) continue;
    let top = 0, size = 0;
    stack[top++] = i; seen[i] = 1;
    while (top > 0) {
      const p = stack[--top]; size++;
      const x = p % w, y = (p / w) | 0;
      if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[top++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[top++] = p + 1; }
      if (y > 0 && mask[p - w] && !seen[p - w]) { seen[p - w] = 1; stack[top++] = p - w; }
      if (y < h - 1 && mask[p + w] && !seen[p + w]) { seen[p + w] = 1; stack[top++] = p + w; }
    }
    sizes.push(size);
  }
  return sizes;
}

/** The census for one RGB buffer. Returns both arms plus the reference colour it used. */
export function census(px, w, h, opts = {}) {
  const hueTol = opts.hueTol ?? HUE_TOL, satFloor = opts.satFloor ?? SAT_FLOOR;
  const darkTol = opts.darkTol ?? DARK_TOL, small = opts.small ?? SMALL;
  const n = w * h;
  if (n === 0) throw new Error('empty crop — nothing to census');
  const surfaces = surfaceHues(px, n, { peakFrac: opts.peakFrac ?? 0.25 });
  if (surfaces.length === 0) throw new Error('no chromatic surface found — every pixel is achromatic, so "off-hue" means nothing here');
  const lum = new Float32Array(n);
  const hueOff = new Uint8Array(n), dark = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const c = hsl3(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]);
    lum[i] = c.l;
    if (c.s >= satFloor && surfaces.every((s) => hueDist(c.h, s.hue) > hueTol)) hueOff[i] = 1;
  }
  const sorted = Float32Array.from(lum).sort();
  const medL = sorted[n >> 1];
  for (let i = 0; i < n; i++) if (lum[i] < medL - darkTol) dark[i] = 1;

  const roll = (mask) => {
    const sizes = components(mask, w, h);
    let cov = 0;
    for (let i = 0; i < n; i++) if (mask[i]) cov++;
    const smalls = sizes.filter((s) => s < small);
    return {
      coveragePct: +((cov / n) * 100).toFixed(3),
      components: sizes.length,
      componentsUnder: smalls.length,
      medianSize: sizes.length ? sizes.slice().sort((a, b) => a - b)[sizes.length >> 1] : 0,
      largest: sizes.length ? Math.max(...sizes) : 0,
      pxInSmall: smalls.reduce((a, b) => a + b, 0),
    };
  };
  return {
    surfaces: surfaces.map((s) => s.hue), refHue: surfaces[0].hue,
    medianLuma: +medL.toFixed(4), hueOff: roll(hueOff), dark: roll(dark),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// stations — derived, spread, and asserted
// ─────────────────────────────────────────────────────────────────────────────

export function deriveStations(arena, want = 6) {
  const half = 21; // PLAYER_SIZE/2, the value movement.ts collides on
  const pot = (arena.hazards ?? []).find((x) => x.kind === 'damage');
  const clear = [];
  const stepX = arena.width / 9, stepY = arena.height / 7;
  for (let gy = 1; gy < 7; gy++) {
    for (let gx = 1; gx < 9; gx++) {
      const x = Math.round(gx * stepX), y = Math.round(gy * stepY);
      if ((arena.cover ?? []).some((b) => Math.abs(x - b.x) <= b.w / 2 + half + 40 && Math.abs(y - b.y) <= b.h / 2 + half + 40)) continue;
      if (pot && Math.hypot(x - pot.x, y - pot.y) < pot.radius * 2) continue;
      clear.push({ x, y });
    }
  }
  // 🚨 NON-EMPTY BEFORE ANY FILTER OVER IT. `[].every()` is `true`, and a station list
  // that came out empty would produce a perfectly clean-looking report of nothing.
  if (clear.length === 0) throw new Error('no clear floor candidate survived the CoverBox/pot filter');
  const quad = (p) => (p.y < arena.height / 2 ? 'N' : 'S') + (p.x < arena.width / 2 ? 'W' : 'E');
  const byQ = { NW: [], NE: [], SW: [], SE: [] };
  for (const p of clear) byQ[quad(p)].push(p);
  const out = [];
  let i = 0;
  while (out.length < want) {
    let added = false;
    for (const q of ['NW', 'NE', 'SW', 'SE']) {
      const list = byQ[q];
      if (i < list.length && out.length < want) {
        // Middle-out, so a quadrant contributes its most CENTRAL clear point first
        // rather than whatever the grid scan happened to reach first.
        const pick = list[Math.floor((list.length - 1) / 2) - i >= 0 ? Math.floor((list.length - 1) / 2) - i : i];
        if (pick && !out.some((o) => o.x === pick.x && o.y === pick.y)) { out.push({ ...pick, id: `${q.toLowerCase()}_${i}` }); added = true; }
      }
    }
    if (!added) break;
    i++;
  }
  const covered = new Set(out.map(quad));
  if (covered.size < 4) throw new Error(`stations cover only ${[...covered].join(',')} — the one-quadrant defect this file documents`);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// selftest
// ─────────────────────────────────────────────────────────────────────────────
function stamp(px, w, h, cx, cy, r, rgb) {
  for (let y = Math.max(0, cy - r); y < Math.min(h, cy + r); y++) {
    for (let x = Math.max(0, cx - r); x < Math.min(w, cx + r); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      const i = (y * w + x) * 3;
      px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2];
    }
  }
}

function selftest() {
  let pass = 0, fail = 0;
  const ck = (n, ok, d = '') => { if (ok) { pass++; console.log(`  ok   ${n}  ${d}`); } else { fail++; console.log(`  FAIL ${n}  ${d}`); } };
  const w = 400, h = 300;

  // §A a FLAT field must return zero of both. If this is the only arm, "0" is
  // indistinguishable from a detector that matched nothing — §B is the other half.
  const flat = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { flat[i * 3] = 138; flat[i * 3 + 1] = 95; flat[i * 3 + 2] = 111; }
  const c0 = census(flat, w, h);
  ck('flat tile field: 0 hue-off components', c0.hueOff.components === 0, JSON.stringify(c0.hueOff));
  ck('flat tile field: 0 dark components', c0.dark.components === 0, JSON.stringify(c0.dark));
  ck('the reference hue is the tile hue (~338)', Math.abs(c0.refHue - 337.7) < 2, `${c0.refHue}`);

  // §B KNOWN-BAD: a KNOWN number of stamps must be recovered.
  const CHIPS = 37, SHADOWS = 21;
  const noisy = Uint8Array.from(flat);
  let k = 0;
  for (let i = 0; i < CHIPS; i++) {
    const cx = 10 + ((i * 37) % (w - 20)), cy = 10 + ((i * 61) % (h - 20));
    // far enough apart that they do not merge; asserted below by recovering the count
    stamp(noisy, w, h, cx, cy, 3, [130, 122, 91]); k++;
  }
  for (let i = 0; i < SHADOWS; i++) {
    const cx = 15 + ((i * 91) % (w - 30)), cy = 200 + ((i * 5) % 90);
    stamp(noisy, w, h, cx, cy, 3, [60, 42, 49]);
  }
  const c1 = census(noisy, w, h);
  ck('KNOWN-BAD: hue-off components are NON-ZERO (else the detector is blind)', c1.hueOff.components > 0, `${c1.hueOff.components}`);
  ck('KNOWN-BAD: recovers the stamped chip count', c1.hueOff.components === CHIPS, `${c1.hueOff.components} vs ${CHIPS}`);
  ck('KNOWN-BAD: dark components are NON-ZERO', c1.dark.components > 0, `${c1.dark.components}`);
  ck('KNOWN-BAD: recovers the stamped shadow count', c1.dark.components >= SHADOWS, `${c1.dark.components} vs ${SHADOWS}`);
  ck('KNOWN-BAD: coverage rises off the flat field', c1.hueOff.coveragePct > c0.hueOff.coveragePct,
    `${c0.hueOff.coveragePct}% -> ${c1.hueOff.coveragePct}%`);
  ck('every stamped chip is UNDER the small threshold', c1.hueOff.componentsUnder === c1.hueOff.components);

  // §C COVERAGE ALONE CANNOT SEE THE DIFFERENCE THIS ROUND IS ABOUT — the arm that
  // justifies reporting components at all. One big blob and many small specks at the
  // SAME coverage must differ in component count.
  const clustered = Uint8Array.from(flat);
  const area = c1.hueOff.coveragePct / 100 * w * h;
  stamp(clustered, w, h, 200, 150, Math.round(Math.sqrt(area / Math.PI)), [130, 122, 91]);
  const c2 = census(clustered, w, h);
  ck('same coverage, ONE component vs many — coverage cannot distinguish them',
    Math.abs(c2.hueOff.coveragePct - c1.hueOff.coveragePct) < 0.6 && c2.hueOff.components === 1,
    `${c1.hueOff.coveragePct}%/${c1.hueOff.components} vs ${c2.hueOff.coveragePct}%/${c2.hueOff.components}`);

  // §C2 🚨 THE ARM THAT CAUGHT THE INSTRUMENT. A frame that is half rose tile and half
  // blue service decking is a REAL station here (`ne_0`), and against a single circular
  // mean it read 99.169% hue-off. Both surfaces must be recognised; the chips stamped on
  // them must still be found; and the count must match the SINGLE-surface case, because
  // the same chips are on the frame either way.
  const bimodal = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const x = i % w;
    const c = x < w / 2 ? [138, 95, 111] : [64, 107, 132]; // rose tile / blue decking, KPAL family
    bimodal[i * 3] = c[0]; bimodal[i * 3 + 1] = c[1]; bimodal[i * 3 + 2] = c[2];
  }
  const surf = surfaceHues(bimodal, w * h);
  ck('BIMODAL: two surface hues found, not one mean between them', surf.length === 2,
    JSON.stringify(surf.map((s) => s.hue)));
  ck('BIMODAL: neither surface hue is the mean that broke this (~286)',
    surf.every((s) => hueDist(s.hue, 286.4) > 20), JSON.stringify(surf.map((s) => s.hue)));
  const cb0 = census(bimodal, w, h);
  ck('BIMODAL: a clean two-surface frame is ~0% hue-off (it was 99.169%)',
    cb0.hueOff.coveragePct < 1, `${cb0.hueOff.coveragePct}%`);
  const bimodalChips = Uint8Array.from(bimodal);
  for (let i = 0; i < CHIPS; i++) {
    const cx = 10 + ((i * 37) % (w - 20)), cy = 10 + ((i * 61) % (h - 20));
    stamp(bimodalChips, w, h, cx, cy, 3, [130, 122, 91]);
  }
  const cb1 = census(bimodalChips, w, h);
  ck('BIMODAL: the same chips are still recovered over BOTH surfaces',
    cb1.hueOff.components === CHIPS, `${cb1.hueOff.components} vs ${CHIPS}`);

  // §D stations
  try {
    const arena = JSON.parse(readFileSync(join(ROOT, 'tools/arena.gameplay.json'), 'utf8'));
    const st = deriveStations(arena, 6);
    ck('6 derived stations', st.length === 6, st.map((s) => `${s.id}(${s.x},${s.y})`).join(' '));
    const q = new Set(st.map((s) => (s.y < arena.height / 2 ? 'N' : 'S') + (s.x < arena.width / 2 ? 'W' : 'E')));
    ck('all four quadrants represented (the al_guard §D class, self-inflicted)', q.size === 4, [...q].join(','));
    ck('no station inside a CoverBox', st.every((s) => !arena.cover.some((b) => Math.abs(s.x - b.x) <= b.w / 2 + 21 && Math.abs(s.y - b.y) <= b.h / 2 + 21)));
    ck('no station is a 1× coordinate cluster (all inside the NW quadrant)',
      !st.every((s) => s.x < arena.width / 2 && s.y < arena.height / 2));
  } catch (e) { ck('station derivation', false, String(e.message)); }

  console.log(`\n  ${pass} pass  ${fail} fail`);
  return fail === 0 ? 0 : 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// the run
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const arena = JSON.parse(readFileSync(join(ROOT, 'tools/arena.gameplay.json'), 'utf8'));
  const stations = deriveStations(arena, Number(arg('stations', 6)));
  const browser = await chromium.launch({ args: LAUNCH });
  const report = { tag: TAG, base: BASE, viewport: { W, H }, hueTol: HUE_TOL, satFloor: SAT_FLOOR, darkTol: DARK_TOL, small: SMALL, stations: [] };
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    // Warm the snapshot: a fresh one's FIRST client eats a dep-optimisation reload that
    // presents as `execution context was destroyed` (AGENT-BRIEF §3).
    await page.goto(`${BASE}/preview.html?piece=floor&tx=${stations[0].x}&ty=${stations[0].y}&t=0&shot=1`,
      { waitUntil: 'domcontentloaded', timeout: 120_000 }).catch(() => {});
    for (const s of stations) {
      const url = `${BASE}/preview.html?piece=floor&tx=${s.x}&ty=${s.y}&t=0&shot=1`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });
      await page.waitForFunction(() => window.__previewReady === true, null, { timeout: 120_000 });
      await page.waitForTimeout(350);
      const buf = await page.locator('canvas').screenshot();
      const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const c = census(data, info.width, info.height);
      report.stations.push({ ...s, url, w: info.width, h: info.height, ...c });
      console.log(`  ${s.id.padEnd(8)} (${String(s.x).padStart(4)},${String(s.y).padStart(4)})  refHue ${String(c.refHue).padStart(5)}  `
        + `hueOff ${String(c.hueOff.coveragePct).padStart(6)}% / ${String(c.hueOff.components).padStart(5)} comp (${c.hueOff.componentsUnder} <${SMALL}px)  `
        + `dark ${String(c.dark.coveragePct).padStart(6)}% / ${String(c.dark.components).padStart(5)} comp`);
      if (SHOTS) { mkdirSync(resolve(SHOTS), { recursive: true }); writeFileSync(join(resolve(SHOTS), `${TAG}_${s.id}.png`), buf); }
    }
  } finally { await browser.close(); }

  const mean = (f) => +(report.stations.reduce((a, s) => a + f(s), 0) / report.stations.length).toFixed(3);
  report.mean = {
    hueOffPct: mean((s) => s.hueOff.coveragePct), hueOffComponents: mean((s) => s.hueOff.components),
    hueOffUnder: mean((s) => s.hueOff.componentsUnder),
    darkPct: mean((s) => s.dark.coveragePct), darkComponents: mean((s) => s.dark.components),
  };
  console.log(`\n  MEAN over ${report.stations.length} stations: ${JSON.stringify(report.mean)}`);
  if (OUT) {
    mkdirSync(dirname(resolve(OUT)), { recursive: true });
    writeFileSync(resolve(OUT), JSON.stringify(report, null, 2));
    console.log(`  wrote ${OUT}`);
  }
  return 0;
}

if (has('selftest')) process.exit(selftest());
else process.exit(await main());
