#!/usr/bin/env node
/**
 * WHAT A GRADE CHANGE COSTS THE COLOUR BUDGET — priced before `arena-scan` is run.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * The shadow toe added to `ToyGradeEffect` is a UNIFORM SCALE on dark pixels. That
 * leaves HSV saturation and hue exactly alone, which is what makes it a legal VALUE
 * lever under `docs/LESSONS.md` §8 — but `tools/arena-scan.mjs` does NOT measure HSV
 * saturation. It measures HSL saturation and ABSOLUTE chroma `(max-min)/255`, and both
 * of those fall when you scale a pixel down:
 *
 *   * absolute chroma is linear in the scale, so a 12% darkening is a 12% chroma loss;
 *   * HSL saturation is scale-INVARIANT below L=0.5 but not above it — a light pixel
 *     pushed under L=0.5 goes from `d/(510-mx-mn)` to `d/(mx+mn)`, and since mx+mn>255
 *     there, that is strictly SMALLER.
 *
 * The second one is why the first attempt at this landed 3 colour regressions with the
 * WARM rail hit nearly 4x harder than the cool one (-18.7% vs +3.8%): this arena's warm
 * surfaces (grease, wood pads, gold trim) are the LIGHT ones, and its cool surfaces
 * (plum tile, blue counters) are the mid-dark ones. A global darkening is therefore
 * not colour-neutral on this particular frame even though it is colour-neutral in HSV.
 *
 * That is `docs/LESSONS.md` §7 exactly — a locally-correct change measured only by its
 * own metric — and it is cheaper to find here than in a 10-minute 18-station scan.
 *
 * ── How ─────────────────────────────────────────────────────────────────────
 * The `tools/tmp/tier_colour.mjs` pattern: six `arena-scan` stations, ONE page load
 * each, `requestAnimationFrame` frozen, and the candidate driven live between captures
 * — so two candidates differ ONLY by the grade uniforms and not at all by sim state.
 * `colourBudget` below is copied verbatim from `tools/arena-scan.mjs` (which is itself
 * `tools/tmp/chroma.mjs` verbatim), including the 320x180 box downsample and the 0.15
 * grey gate, so a delta measured here is a delta the real gate will see.
 *
 * ⚠️ ABSOLUTES HERE ARE NOT THE GATE'S ABSOLUTES. `arena-scan` scores `<id>.canvas.png`,
 * a Playwright element screenshot that INCLUDES the DOM HUD — 13.4% of the frame and
 * ~25% of its warm chroma. This reads the WebGL buffer, so the HUD is absent. The HUD
 * is identical across candidates, so every DELTA transfers; no absolute does. Run
 * `arena-scan --baseline` on the winner.
 *
 *   node tools/tmp/headserve.mjs --overlay src/render/stage.ts -- node tools/tmp/gradechroma.mjs
 *   node tools/tmp/gradechroma.mjs --selftest
 */
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const has = (k) => a.includes(k);
const BASE = process.env.PREVIEW_BASE ?? process.env.HEADSERVE_URL ?? get('--url', null);
const OUT = get('--out', 'shots/gradechroma');
const SHOT_STATION = get('--shot-station', null);

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

/** Verbatim from `tools/tmp/tier_colour.mjs`, itself a subset of `arena-scan.mjs`. */
const STATIONS = [
  { id: 'spawn_west', x: 160, y: 500, fog: 850 },
  { id: 'west_lane', x: 340, y: 500, fog: 850 },
  { id: 'pot_diagonal', x: 570, y: 430, fog: 850 },
  { id: 'pantry_ne', x: 1150, y: 330, fog: 850 },
  { id: 'edge_west', x: 70, y: 500, fog: 850 },
  { id: 'fryer_south', x: 560, y: 790, fog: 850 },
];

/**
 * Candidate grades. EVERY FIELD IS EXPLICIT — none of them may be `null`.
 *
 * ⚠️ The first version of this table used `null` for "leave the shipped value alone"
 * and made the control row A that. That is only the HEAD grade while the served
 * `stage.ts` still HAS the HEAD grade — and by the time it was run, `stage.ts` had
 * already been given its new defaults, so row A and row B came out identical to four
 * decimals and the whole table was measured against the change instead of against the
 * baseline. It looked like a table with a control and it had none. Same family as
 * `docs/LESSONS.md` §13: the instrument was fine, the reference row was wrong.
 */
const CANDIDATES = [
  // THE CONTROL — the grade exactly as it was on HEAD before this session.
  { label: 'HEAD s.70 c.62 toe0', sat: 0.70, contrast: 0.62, toe: 0.00, tk: 0.60, keep: 0 },
  // `keep` sweeps the toe between its two forms. Neither end can satisfy both colour
  // rails: `keep 0` (pure scale) is HSL-saturation-neutral and chroma-LOSSY, `keep 1`
  // (subtract as far as the gamut allows) is chroma-neutral and saturation-RAISING.
  // arena-scan has a drift rail against each, so the answer is somewhere between.
  { label: 'K0.00 toe.28@.60', sat: 0.70, contrast: 0.62, toe: 0.28, tk: 0.60, keep: 0.00 },
  { label: 'K0.25 toe.28@.60', sat: 0.70, contrast: 0.62, toe: 0.28, tk: 0.60, keep: 0.25 },
  { label: 'K0.40 toe.28@.60', sat: 0.70, contrast: 0.62, toe: 0.28, tk: 0.60, keep: 0.40 },
  { label: 'K0.55 toe.28@.60', sat: 0.70, contrast: 0.62, toe: 0.28, tk: 0.60, keep: 0.55 },
  { label: 'K0.70 toe.28@.60', sat: 0.70, contrast: 0.62, toe: 0.28, tk: 0.60, keep: 0.70 },
  { label: 'K1.00 toe.28@.60', sat: 0.70, contrast: 0.62, toe: 0.28, tk: 0.60, keep: 1.00 },
  { label: 'K0.40 toe.34@.64', sat: 0.70, contrast: 0.62, toe: 0.34, tk: 0.64, keep: 0.40 },
  { label: 'K0.40 toe.22@.56', sat: 0.70, contrast: 0.62, toe: 0.22, tk: 0.56, keep: 0.40 },
];

// ─────────────────────────────────────────────────────────────────────────────
// `colourBudget`, copied from `tools/arena-scan.mjs` so the numbers are the gate's.
// ─────────────────────────────────────────────────────────────────────────────
const GREY_GATE = 0.15;
const HUE_BINS = 12;
export function colourBudget(data, n) {
  let px = 0, sat = 0, chroma = 0, luma = 0, warm = 0, cool = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const l = (mx + mn) / 2 / 255;
    const s = d === 0 ? 0 : (l > 0.5 ? d / (510 - mx - mn) : d / (mx + mn));
    px++; sat += s; chroma += d / 255;
    luma += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (s < GREY_GATE) continue;
    let h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = ((h * 60) % 360 + 360) % 360;
    if (h < 60) warm += s; else cool += s;
  }
  const total = warm + cool;
  return {
    meanSat: sat / n, meanChroma: chroma / n, meanLuma: luma / n,
    warmChroma: warm / n, coolChroma: cool / n, warmShare: total ? warm / total : 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
const CAPTURE = (opts) => {
  const stage = window.__stage;
  if (!stage || stage.disposed) return { error: 'no live Stage' };
  const r = stage.renderer, gl = r.getContext();
  const Wp = r.domElement.width, Hp = r.domElement.height;
  const passes = stage.composer ? stage.composer.passes : [];
  const fx = passes.flatMap((p) => p.effects ?? []);
  const g = fx.find((e) => /Grade/.test(e.name));
  if (!g) return { error: 'no ToyGradeEffect in the chain' };
  if (!g.uniforms.get('shadowToe')) return { error: 'shadowToe uniform ABSENT — wrong stage.ts' };
  const U = {
    sat: g.uniforms.get('satAmount').value,
    contrast: g.uniforms.get('contrastAmount').value,
    toe: g.uniforms.get('shadowToe').value,
    tk: g.uniforms.get('toeKnee').value,
    keep: g.uniforms.get('toeChromaKeep') ? g.uniforms.get('toeChromaKeep').value : null,
  };
  const SW = 320, SH = 180;
  const out = { shipped: U, rows: [] };
  const read = () => {
    const buf = new Uint8Array(Wp * Hp * 4);
    gl.readPixels(0, 0, Wp, Hp, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    // box downsample to arena-scan's metric grid. `sharp`'s fit:'fill' is a box
    // average at these ratios, and the grid is what `colourBudget` is fed there.
    const small = new Uint8Array(SW * SH * 3);
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const x0 = Math.floor((x / SW) * Wp), x1 = Math.max(x0 + 1, Math.floor(((x + 1) / SW) * Wp));
      const y0 = Math.floor((y / SH) * Hp), y1 = Math.max(y0 + 1, Math.floor(((y + 1) / SH) * Hp));
      let R = 0, G = 0, B = 0, c = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
        // gl rows are bottom-up; the metric is orientation-independent, but keep it
        // honest anyway so a saved crop matches what is scored.
        const i = ((Hp - 1 - yy) * Wp + xx) * 4;
        R += buf[i]; G += buf[i + 1]; B += buf[i + 2]; c++;
      }
      const k = (y * SW + x) * 3;
      small[k] = Math.round(R / c); small[k + 1] = Math.round(G / c); small[k + 2] = Math.round(B / c);
    }
    return small;
  };
  for (const cand of opts.cands) {
    // Explicit, never `?? shipped` — see the note on CANDIDATES for what that cost.
    if ([cand.sat, cand.contrast, cand.toe, cand.tk, cand.keep].some((v) => typeof v !== 'number')) {
      return { error: 'candidate ' + cand.label + ' has a non-numeric field; every knob must be explicit' };
    }
    g.uniforms.get('satAmount').value = cand.sat;
    g.uniforms.get('contrastAmount').value = cand.contrast;
    g.uniforms.get('shadowToe').value = cand.toe;
    g.uniforms.get('toeKnee').value = cand.tk;
    if (g.uniforms.get('toeChromaKeep')) g.uniforms.get('toeChromaKeep').value = cand.keep;
    stage.render(0); stage.render(0);
    out.rows.push({ label: cand.label, small: Array.from(read()) });
  }
  g.uniforms.get('satAmount').value = U.sat;
  g.uniforms.get('contrastAmount').value = U.contrast;
  g.uniforms.get('shadowToe').value = U.toe;
  g.uniforms.get('toeKnee').value = U.tk;
  if (g.uniforms.get('toeChromaKeep')) g.uniforms.get('toeChromaKeep').value = U.keep;
  stage.render(0);
  return out;
};

// ─────────────────────────────────────────────────────────────────────────────
function selftest() {
  let pass = 0, fail = 0;
  const ck = (n, got, want, eps) => {
    const ok = Math.abs(got - want) <= (eps ?? 1e-6);
    if (ok) { pass++; console.log(`  ✓ ${n.padEnd(58)} ${got.toFixed(4)}`); }
    else { fail++; console.log(`  ✗ ${n.padEnd(58)} got ${got.toFixed(4)} want ${want}`); }
  };
  const flat = (r, g, b, n = 1000) => {
    const d = new Uint8Array(n * 3);
    for (let i = 0; i < n; i++) { d[i * 3] = r; d[i * 3 + 1] = g; d[i * 3 + 2] = b; }
    return d;
  };
  console.log('\nGRADECHROMA SELFTEST — arena-scan\'s own colourBudget, on inputs solved by hand\n');
  // Mid grey: zero chroma, zero saturation, and it must not land in a hue bin.
  let c = colourBudget(flat(128, 128, 128), 1000);
  ck('grey: meanSat', c.meanSat, 0);
  ck('grey: meanChroma', c.meanChroma, 0);
  ck('grey: warm + cool', c.warmChroma + c.coolChroma, 0);
  // Pure red: HSL L = 0.5 exactly, so s = 255/255 = 1; chroma = 1; hue 0 = warm.
  c = colourBudget(flat(255, 0, 0), 1000);
  ck('pure red: meanSat', c.meanSat, 1);
  ck('pure red: meanChroma', c.meanChroma, 1);
  ck('pure red: warmChroma', c.warmChroma, 1);
  ck('pure red: warmShare', c.warmShare, 1);
  // THE MECHANISM THIS TOOL EXISTS FOR, stated as an assertion rather than as prose.
  // A LIGHT warm swatch scaled down 25% loses HSL saturation even though hue and HSV
  // saturation are untouched, because it crosses L = 0.5.
  //   (230,180,60): mx+mn = 290 > 255 so L > 0.5, d = 170, s = 170/(510-290) = 0.7727
  //   x0.75 -> (173,135,45): mx+mn = 218 < 255 so L < 0.5, s = 128/218 = 0.5872
  const light = colourBudget(flat(230, 180, 60), 1000);
  const dark = colourBudget(flat(173, 135, 45), 1000);
  ck('light warm swatch: HSL sat', light.meanSat, 0.7727, 1e-3);
  ck('same swatch x0.75: HSL sat', dark.meanSat, 0.5872, 2e-3);
  ck('...so a uniform DARKENING costs HSL saturation', light.meanSat - dark.meanSat, 0.1855, 3e-3);
  ck('...and costs absolute chroma linearly', dark.meanChroma / light.meanChroma, 0.752, 5e-3);
  // A MID-DARK cool swatch loses nothing, which is why the warm rail moved 4x further.
  //   (60,90,150): mx+mn = 210 < 255, s = 90/210 = 0.4286
  //   x0.75 -> (45,68,113): mx+mn = 158, s = 68/158 = 0.4304  (rounding only)
  const coolL = colourBudget(flat(60, 90, 150), 1000);
  const coolD = colourBudget(flat(45, 68, 113), 1000);
  ck('mid-dark cool swatch: HSL sat', coolL.meanSat, 0.4286, 1e-3);
  ck('same swatch x0.75: HSL sat UNCHANGED', coolD.meanSat, 0.4286, 3e-3);
  ck('...cool loses ~nothing where warm lost 0.19', Math.abs(coolL.meanSat - coolD.meanSat), 0, 3e-3);
  // Hue split boundary: 60 deg is COOL by this metric (`h < 60` is the warm test).
  c = colourBudget(flat(255, 255, 0), 1000);   // hue exactly 60
  ck('hue 60 counts as COOL', c.warmChroma, 0);
  c = colourBudget(flat(255, 254, 0), 1000);   // hue just under 60
  ck('hue just under 60 counts as WARM', c.warmChroma > 0.9 ? 1 : 0, 1);
  // The grey gate: a nearly-grey pixel contributes to meanSat but to NO hue bin.
  c = colourBudget(flat(130, 128, 128), 1000);
  ck('near-grey still counts in meanSat', c.meanSat > 0 ? 1 : 0, 1);
  ck('...but is excluded from warm/cool by the 0.15 gate', c.warmChroma + c.coolChroma, 0);
  console.log(`\n${pass} passed, ${fail} failed`);
  return fail === 0 ? 0 : 1;
}

// ─────────────────────────────────────────────────────────────────────────────
if (has('--selftest')) process.exit(selftest());
if (!BASE) { console.error('PREVIEW_BASE unset — run under tools/tmp/headserve.mjs'); process.exit(2); }
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const acc = new Map(CANDIDATES.map((c) => [c.label, []]));
let shippedU = null;
try {
  for (const st of STATIONS) {
    const page = await browser.newPage({ viewport: { width: 1300, height: 740 }, deviceScaleFactor: 1 });
    await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
    page.on('pageerror', (e) => console.error('  PAGEERROR', String(e).slice(0, 160)));
    try {
      await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=${st.x}&py=${st.y}&fogRadius=${st.fog}&simSpeed=0.02&pointerLock=0`,
        { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
      await page.waitForTimeout(800);
      await page.evaluate(() => { window.__raf = window.requestAnimationFrame; window.requestAnimationFrame = () => 0; });
      await page.waitForTimeout(200);
      // ── the picture, per candidate, at ONE station ────────────────────────
      // Non-negotiable #3. Every number in this file is a colour-budget rail, and no
      // rail can answer "is this too saturated to look like the reference" — that is a
      // judgement, and it needs a rendered frame at shipped framing to make.
      if (SHOT_STATION && st.id === SHOT_STATION) {
        for (const c of CANDIDATES) {
          await page.evaluate((cand) => {
            const fx = window.__stage.composer.passes.flatMap((p) => p.effects ?? []);
            const g = fx.find((e) => /Grade/.test(e.name));
            g.uniforms.get('satAmount').value = cand.sat;
            g.uniforms.get('contrastAmount').value = cand.contrast;
            g.uniforms.get('shadowToe').value = cand.toe;
            g.uniforms.get('toeKnee').value = cand.tk;
            if (g.uniforms.get('toeChromaKeep')) g.uniforms.get('toeChromaKeep').value = cand.keep;
            window.__stage.render(0); window.__stage.render(0);
          }, c);
          await page.screenshot({ path: join(OUT, `${st.id}.${c.label.replace(/[^a-z0-9]+/gi, '_')}.png`) });
        }
      }
      const res = await page.evaluate(CAPTURE, { cands: CANDIDATES });
      if (res.error) { console.error(`✗ ${st.id}: ${res.error}`); continue; }
      shippedU ??= res.shipped;
      for (const row of res.rows) acc.get(row.label).push(colourBudget(Uint8Array.from(row.small), 320 * 180));
      console.log(`${st.id} ok`);
    } catch (e) { console.error(`✗ ${st.id}: ${e}`); } finally { await page.close(); }
  }
} finally { await browser.close(); }

const mean = (rows, k) => rows.reduce((s, r) => s + r[k], 0) / Math.max(1, rows.length);
const table = CANDIDATES.map((c) => {
  const rows = acc.get(c.label);
  return {
    label: c.label, n: rows.length,
    meanSat: mean(rows, 'meanSat'), meanChroma: mean(rows, 'meanChroma'),
    warmChroma: mean(rows, 'warmChroma'), coolChroma: mean(rows, 'coolChroma'),
    warmShare: mean(rows, 'warmShare'), meanLuma: mean(rows, 'meanLuma'),
  };
});
const base = table[0];
console.log(`\nshipped grade in the served tree: ${JSON.stringify(shippedU)}`);
console.log('\nMEAN over the 6 stations — WebGL buffer, no DOM HUD, so read the DELTAS\n');
console.log('candidate                    meanSat  chroma    warm    cool  warmShr    luma |   dSat  dChroma   dWarm  dShare');
for (const t of table) {
  const s = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(4)}`;
  console.log(`${t.label.padEnd(28)}${t.meanSat.toFixed(4).padStart(8)}${t.meanChroma.toFixed(4).padStart(8)}` +
    `${t.warmChroma.toFixed(4).padStart(8)}${t.coolChroma.toFixed(4).padStart(8)}${t.warmShare.toFixed(4).padStart(9)}` +
    `${t.meanLuma.toFixed(4).padStart(8)} | ${s(t.meanSat - base.meanSat).padStart(7)}${s(t.meanChroma - base.meanChroma).padStart(9)}` +
    `${s(t.warmChroma - base.warmChroma).padStart(8)}${s(t.warmShare - base.warmShare).padStart(8)}`);
}
await writeFile(join(OUT, 'gradechroma.json'), JSON.stringify({ shippedU, table }, null, 2));
console.log(`\nwrote ${OUT}/gradechroma.json`);
console.log('⚠️ absolutes exclude the DOM HUD; only the deltas transfer to `arena-scan --baseline`.');
