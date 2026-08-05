#!/usr/bin/env node
/**
 * CONTRAST 0.62 vs 0.72 — a ONE-UNIFORM A/B over the whole cast.
 *
 * ── Why this is not `postablate.mjs --toe` ───────────────────────────────────
 * It cannot be. `postablate.mjs`'s row helper is
 *
 *     const T = (toe, tk, sat = 0.70, c = 0.72) => ...
 *
 * so its row LABELLED `toe .28@.60 s.70` silently runs `contrastAmount` **0.72**,
 * while the row it is read against, `HEAD s.70 c.62 toe0`, passes 0.62 explicitly.
 * Every `--toe` row except the first therefore differs from HEAD by TWO uniforms.
 * That is fine for the sweep it was written for (it was choosing a toe with contrast
 * already assumed) and fatal for this question, which is worth exactly one uniform.
 * `docs/LESSONS.md` §13: validate the instrument before believing it on an unknown
 * input. This one was checked and it does not answer this question.
 *
 * So: same matte technique, same `valuelib.mjs` formulas, same whole-frame clip
 * counter, same image-diff guard — but the two configurations differ by
 * `contrastAmount` and NOTHING else. Every other uniform is left exactly as the
 * served tree authored it, and both are read back and printed so the claim is
 * checkable rather than asserted.
 *
 * ── Why both states in ONE page load ─────────────────────────────────────────
 * `docs/LESSONS.md` §5. A "before" captured from one server and an "after" from
 * another differ by everything else that moved in between — and a peer is live in
 * `src/characters/**` doing a cast-wide albedo pass RIGHT NOW. Driving both states
 * inside a single page load makes the two frames byte-identical except for one float.
 *
 * ── The three extra columns, and why they are here ───────────────────────────
 * The acceptance question is not only "does range go up". More contrast is exactly
 * the move that manufactures banding, crushes shadows and turns darks sooty, and
 * none of those show up in P05. So each row also carries:
 *
 *   crush%   share of the character's own pixels below luma 0.05 — pixels that have
 *            stopped carrying shape. Range bought here is range bought by deleting
 *            the form, which is the failure mode "crushed" names.
 *   plateau  the widest run of IDENTICAL 8-bit luma, as a share of the matte, over
 *            the darkest half only. Banding is quantisation: a gradient that should
 *            step every few pixels instead holds one code for a wide band. This is a
 *            PROXY and it is reported as one — the PNGs are the answer (`--png`).
 *   dkSat    mean HSV saturation of the darkest quartile of the matte. "Sooty" is
 *            darks going grey/brown rather than staying coloured, so it is a chroma
 *            question asked only of the pixels that got darker.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   node tools/tmp/headserve.mjs --overlay src/render/stage.ts -- \
 *     node tools/tmp/contrastab.mjs --station pot_south --out shots/contrastab
 *   node tools/tmp/contrastab.mjs --selftest        # no browser
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { VL, VL_SRC } from './valuelib.mjs';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const has = (k) => a.includes(k);

const BASE = process.env.PREVIEW_BASE ?? process.env.HEADSERVE_URL ?? get('--url', null);
const OUT = get('--out', 'shots/contrastab');
const IDS = get('--ids', 'hamburger,donut,taco,burrito,egg,lollipop,pizza,sushi,soup,waterbottle,hotdog').split(',');
const STATION = get('--station', 'pot_south');
const SAVE_PNG = has('--png');
const LO = Number(get('--lo', '0.62'));
const HI = Number(get('--hi', '0.72'));

const STATIONS = {
  pot_south: { x: 700, y: 640, fog: 850 },
  grease_in: { x: 560, y: 900, fog: 850 },
  spawn_west: { x: 160, y: 500, fog: 850 },
};

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

// ─────────────────────────────────────────────────────────────────────────────
// The three extra statistics, in ONE source string so Node's selftest and the page
// run the same code (`valuelib.mjs`'s reason, same defence).
// ─────────────────────────────────────────────────────────────────────────────
export const CB_SRC = String.raw`
/** Share (%) of masked pixels whose display luma is below 'thr'. */
function cbCrush(lumas, thr) {
  if (!lumas.length) return 0;
  let n = 0;
  for (let i = 0; i < lumas.length; i++) if (lumas[i] < thr) n++;
  return +((100 * n) / lumas.length).toFixed(3);
}

/**
 * Widest run of identical 8-bit luma codes among the DARKEST half of the matte,
 * as a share (%) of the matte. Banding is one code held across a band that should
 * be ramping, so the statistic is "how much of the subject is one flat code".
 * Counted over the sorted dark half, so it is a histogram-mode width, not a spatial
 * run — spatial runs depend on the silhouette and are not comparable between
 * characters. It moves when quantisation coarsens and is blind to where.
 */
function cbPlateau(lumas) {
  if (!lumas.length) return 0;
  const s = Float64Array.from(lumas); s.sort();
  const half = s.subarray(0, Math.max(1, Math.floor(s.length / 2)));
  let best = 1, run = 1;
  let prev = Math.round(half[0] * 255);
  for (let i = 1; i < half.length; i++) {
    const c = Math.round(half[i] * 255);
    if (c === prev) { run++; if (run > best) best = run; } else { run = 1; prev = c; }
  }
  return +((100 * best) / s.length).toFixed(3);
}

/** HSV saturation, 0..1, from 8-bit channels. */
function cbSat(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}
`;
const CB = new Function(`${CB_SRC}; return { crush: cbCrush, plateau: cbPlateau, sat: cbSat };`)();

// ─────────────────────────────────────────────────────────────────────────────
// IN-PAGE: one matte, two configurations that differ by one float.
// ─────────────────────────────────────────────────────────────────────────────
const CAPTURE = (opts) => {
  const stage = window.__stage;
  if (!stage || stage.disposed) return { error: 'no live Stage' };
  const r = stage.renderer, scene = stage.scene, cam = stage.rig && stage.rig.camera;
  const gl = r.getContext();
  const Wp = r.domElement.width, Hp = r.domElement.height;

  const casts = [];
  scene.traverse((o) => { if (/^character:/.test(o.name || '')) casts.push(o); });
  if (!casts.length) return { error: 'no `character:*` node' };
  const topOf = (o) => { let n = o; while (n.parent && n.parent !== scene) n = n.parent; return n; };

  const readAll = () => {
    const buf = new Uint8Array(Wp * Hp * 4);
    gl.readPixels(0, 0, Wp, Hp, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const out = new Uint8Array(Wp * Hp * 4);
    for (let row = 0; row < Hp; row++) out.set(buf.subarray((Hp - 1 - row) * Wp * 4, (Hp - row) * Wp * 4), row * Wp * 4);
    return out;
  };

  const savedBg = scene.background, savedShadow = r.shadowMap.enabled;
  const savedAutoClear = r.autoClear, savedAlpha = r.getClearAlpha();
  let hidden = [];
  const hideEnvironment = (keep) => {
    hidden = [];
    for (const kid of scene.children) { if (keep.has(kid)) continue; if (kid.visible) { hidden.push(kid); kid.visible = false; } }
  };
  const restoreEnvironment = () => { for (const k of hidden) k.visible = true; hidden = []; };
  // ⚠️ The matte comes from the DIRECT render (composer bypassed) for `valuescan.mjs`'s
  // recorded reason: hiding the head changes 41,332 POST-PROCESSED pixels against a
  // 26,173 px character, so a post-processed matte would be 58% halo. It is identical
  // across both configurations BY CONSTRUCTION, which is the only thing that makes the
  // two rows comparable at all.
  const matteAll = () => {
    scene.background = null; r.shadowMap.enabled = false; r.autoClear = true; r.setRenderTarget(null);
    r.setClearColor(0x000000, 1); r.clear(true, true, true); r.render(scene, cam);
    const A = readAll();
    r.setClearColor(0xffffff, 1); r.clear(true, true, true); r.render(scene, cam);
    const B = readAll();
    const m = new Uint8Array(Wp * Hp);
    for (let i = 0, j = 0; i < A.length; i += 4, j++) {
      const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
      m[j] = d < 32 ? 1 : 0;
    }
    return m;
  };

  const result = { buffer: [Wp, Hp], configs: [] };
  try {
    const perCast = [];
    for (const c of casts) {
      hideEnvironment(new Set([topOf(c)]));
      const others = [];
      for (const o of casts) { if (o !== c && topOf(o) === topOf(c) && o.visible) { others.push(o); o.visible = false; } }
      const m = matteAll();
      for (const o of others) o.visible = true;
      restoreEnvironment();
      let n = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      for (let j = 0; j < m.length; j++) {
        if (!m[j]) continue;
        n++; const x = j % Wp, y = (j / Wp) | 0;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      perCast.push({ name: c.name, px: n, bbox: n ? [x0, y0, x1 - x0 + 1, y1 - y0 + 1] : null, mask: m });
    }
    const onScreen = perCast.filter((p) => p.px > 0);
    const named = onScreen.filter((p) => p.name === `character:${opts.playerId}`);
    const player = named.length === 1 ? named[0] : onScreen.sort((x, y) => y.px - x.px)[0];
    if (!player) return { error: 'player has zero on-screen pixels' };
    result.player = player.name;
    result.playerPx = player.px;

    const [bx, by, bw, bh] = player.bbox;
    const pad = Math.max(12, Math.round(0.30 * bh) + 6);
    const cx = Math.max(0, bx - pad), cy = Math.max(0, by - pad);
    const cw = Math.min(Wp - cx, bw + pad * 2), chh = Math.min(Hp - cy, bh + pad * 2);
    result.crop = [cx, cy, cw, chh];
    result.charHeightPx = bh;
    const maskCrop = new Uint8Array(cw * chh);
    for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) maskCrop[y * cw + x] = player.mask[(cy + y) * Wp + (cx + x)];

    const passes = stage.composer ? stage.composer.passes : [];
    const fx = passes.flatMap((p) => p.effects ?? []);
    const g = fx.find((e) => /Grade/.test(e.name)) ?? null;
    if (!g) return { error: 'no grade effect in the chain' };
    if (!g.uniforms.get('contrastAmount')) return { error: 'no contrastAmount uniform' };
    // Read back EVERY grade uniform, so "only contrast moved" is checkable in the
    // output rather than asserted in a comment.
    const names = ['satAmount', 'satKnee', 'contrastAmount', 'highlightKnee', 'shadowToe', 'toeKnee', 'toeChromaKeep'];
    const shipped = {};
    for (const n of names) if (g.uniforms.get(n)) shipped[n] = g.uniforms.get(n).value;
    result.shippedUniforms = shipped;
    result.chain = { effects: fx.map((e) => e.name), passes: passes.map((p) => p.constructor.name) };

    const score = (label, contrast) => {
      // restore EVERYTHING, then move exactly one float
      for (const n of names) if (g.uniforms.get(n)) g.uniforms.get(n).value = shipped[n];
      g.uniforms.get('contrastAmount').value = contrast;
      stage.render(0); stage.render(0);
      const px = readAll();
      const luma = new Float32Array(cw * chh);
      for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
        const s = ((cy + y) * Wp + (cx + x)) * 4;
        luma[y * cw + x] = window.VL.luma(px[s], px[s + 1], px[s + 2]);
      }
      const lm = [], sats = [];
      for (let j = 0; j < cw * chh; j++) {
        if (!maskCrop[j]) continue;
        lm.push(luma[j]);
        const y = (j / cw) | 0, x = j % cw;
        const s = ((cy + y) * Wp + (cx + x)) * 4;
        sats.push({ L: luma[j], s: window.CB.sat(px[s], px[s + 1], px[s + 2]) });
      }
      const L = window.VL.ladder(lm, {});
      const FG = window.VL.figureGround(luma, cw, chh, maskCrop, { ringFrac: 0.30, edgeR: 4 });
      // WHOLE-FRAME channel clipping, both tails. The shoulder exists to hold the
      // high tail down; the toe and the S-curve both push the low one.
      let lo = 0, hi = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i] === 0 || px[i + 1] === 0 || px[i + 2] === 0) lo++;
        if (px[i] === 255 || px[i + 1] === 255 || px[i + 2] === 255) hi++;
      }
      const nPix = px.length / 4;
      // sootiness: mean HSV saturation of the darkest quartile of the SUBJECT
      sats.sort((p, q) => p.L - q.L);
      const q1 = sats.slice(0, Math.max(1, Math.floor(sats.length / 4)));
      const dkSat = q1.reduce((s, p) => s + p.s, 0) / q1.length;
      return {
        label, contrast,
        p05: L.p05, p50: L.p50, p95: L.p95, range: L.range, sd: L.sd,
        steps10: L.steps.j10, steps05: L.steps.j05,
        dL: FG.dL, dLedge: FG.dLedge,
        clipLo: +((100 * lo) / nPix).toFixed(3), clipHi: +((100 * hi) / nPix).toFixed(3),
        crush: window.CB.crush(lm, 0.05), crush02: window.CB.crush(lm, 0.02),
        plateau: window.CB.plateau(lm), dkSat: +dkSat.toFixed(4),
        frame: px,
      };
    };

    const rows = [score(`c${opts.lo.toFixed(2)}`, opts.lo), score(`c${opts.hi.toFixed(2)}`, opts.hi)];

    // IMAGE-DIFF GUARD. A row that reports dMean 0.000 changed NOTHING, whatever its
    // label claims — the trap `postablate.mjs` records twice over.
    const A = rows[0].frame, B = rows[1].frame;
    let sum = 0, mx = 0, over = 0;
    for (let i = 0; i < A.length; i += 4) {
      const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
      sum += d; if (d > mx) mx = d; if (d > 2) over++;
    }
    const nP = A.length / 4;
    result.diff = { dMean: +(sum / nP).toFixed(3), dMax: mx, dPct: +((100 * over) / nP).toFixed(2) };

    if (opts.png) {
      for (const row of rows) {
        const rgb = new Uint8Array(cw * chh * 3);
        for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
          const s = ((cy + y) * Wp + (cx + x)) * 4, d = (y * cw + x) * 3;
          rgb[d] = row.frame[s]; rgb[d + 1] = row.frame[s + 1]; rgb[d + 2] = row.frame[s + 2];
        }
        let str = '';
        for (let i = 0; i < rgb.length; i += 8192) str += String.fromCharCode.apply(null, rgb.subarray(i, i + 8192));
        (result.pngs ??= {})[row.label] = { w: cw, h: chh, b64: btoa(str) };
      }
      // and the WHOLE frame at shipped framing for both, because a close crop cannot
      // answer "does the frame read sooty" (`docs/LESSONS.md` §6).
      for (const row of rows) {
        const rgb = new Uint8Array(Wp * Hp * 3);
        for (let i = 0, j = 0; i < row.frame.length; i += 4, j += 3) {
          rgb[j] = row.frame[i]; rgb[j + 1] = row.frame[i + 1]; rgb[j + 2] = row.frame[i + 2];
        }
        let str = '';
        for (let i = 0; i < rgb.length; i += 8192) str += String.fromCharCode.apply(null, rgb.subarray(i, i + 8192));
        (result.pngs ??= {})[`${row.label}.full`] = { w: Wp, h: Hp, b64: btoa(str) };
      }
    }
    for (const row of rows) { delete row.frame; result.configs.push(row); }

    for (const n of names) if (g.uniforms.get(n)) g.uniforms.get(n).value = shipped[n];
  } finally {
    restoreEnvironment();
    scene.background = savedBg; r.shadowMap.enabled = savedShadow;
    r.autoClear = savedAutoClear; r.setClearColor(0x000000, savedAlpha);
    try { stage.render(0); } catch { /* best effort */ }
  }
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
function selftest() {
  let pass = 0, fail = 0;
  const ck = (n, got, want, eps) => {
    const ok = typeof want === 'number' ? Math.abs(got - want) <= (eps ?? 1e-6) : JSON.stringify(got) === JSON.stringify(want);
    if (ok) { pass++; console.log(`  ✓ ${n.padEnd(60)} ${JSON.stringify(got)}`); }
    else { fail++; console.log(`  ✗ ${n.padEnd(60)} got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
  };
  console.log('\nCONTRASTAB SELFTEST — every claim this tool makes, derived by hand\n');

  // ── The S-curve, `mix(c, c*c*(3-2c), t)`, straight off the shader ──────────
  const S = (c, t) => c * (1 - t) + c * c * (3 - 2 * c) * t;
  ck('S-curve is identity at 0.5, at BOTH settings', [+S(0.5, 0.62).toFixed(9), +S(0.5, 0.72).toFixed(9)], [0.5, 0.5]);
  // 0.30: smoothstep = 0.09*2.40 = 0.216. 0.62 -> .30*.38 + .216*.62 = .1140+.13392 = .24792
  //                                        0.72 -> .30*.28 + .216*.72 = .0840+.15552 = .23952
  ck('c0.62 maps 0.30 ->', +S(0.30, 0.62).toFixed(5), 0.24792, 1e-5);
  ck('c0.72 maps 0.30 ->', +S(0.30, 0.72).toFixed(5), 0.23952, 1e-5);
  ck('...so 0.62 -> 0.72 DEEPENS a 0.30 dark by', +(S(0.30, 0.62) - S(0.30, 0.72)).toFixed(5), 0.0084, 1e-5);
  // 0.90: smoothstep = 0.81*1.20 = 0.972. 0.62 -> .90*.38 + .972*.62 = .342+.60264 = .94464
  //                                       0.72 -> .90*.28 + .972*.72 = .252+.69984 = .95184
  ck('c0.72 LIFTS a 0.90 light by', +(S(0.90, 0.72) - S(0.90, 0.62)).toFixed(5), 0.0072, 1e-5);
  ck('...so range at 0.30/0.90 grows by', +((S(0.90, 0.72) - S(0.30, 0.72)) - (S(0.90, 0.62) - S(0.30, 0.62))).toFixed(5), 0.0156, 1e-5);

  // ⚠️ THE ONE THAT MATTERS FOR THE REPORT: the S-curve's fixed point is 0.5, so a
  // character whose P05 sits ABOVE mid-grey has its dark end pushed UP, not down.
  // This is why egg is expected to move the wrong way, and it is arithmetic, not noise.
  ck('a P05 ABOVE 0.5 gets LIGHTER, not darker', S(0.579, 0.72) > S(0.579, 0.62), true);
  ck('a P05 BELOW 0.5 gets darker', S(0.280, 0.72) < S(0.280, 0.62), true);
  ck('the crossover is exactly mid-grey', +(S(0.5, 0.72) - S(0.5, 0.62)).toFixed(9), 0);

  // ── luma, the same formula every other tool here uses ──────────────────────
  ck('VL.luma white', +VL.luma(255, 255, 255).toFixed(6), 1);
  ck('VL.luma black', VL.luma(0, 0, 0), 0);

  // ── crush ─────────────────────────────────────────────────────────────────
  ck('crush counts nothing when nothing is dark', CB.crush([0.2, 0.5, 0.9], 0.05), 0);
  ck('crush is a PERCENTAGE', CB.crush([0.01, 0.5, 0.5, 0.5], 0.05), 25);
  ck('crush threshold is exclusive at the bound', CB.crush([0.05, 0.5], 0.05), 0);

  // ── plateau: hand-built inputs whose answer is countable ───────────────────
  // 8 values, dark half = the 4 lowest. Four identical codes -> best run 4, of 8 = 50%.
  ck('plateau finds a 4-wide flat band in the dark half',
    CB.plateau([0.2, 0.2, 0.2, 0.2, 0.7, 0.8, 0.9, 1.0]), 50);
  // A clean ramp in the dark half: every code distinct -> best run 1, of 8 = 12.5%.
  ck('plateau on a smooth ramp is one code wide',
    CB.plateau([0.10, 0.20, 0.30, 0.40, 0.7, 0.8, 0.9, 1.0]), 12.5);
  // Quantisation is what it must be sensitive to: values 1/255 apart round to
  // DIFFERENT codes, values inside one code round together.
  ck('plateau is blind to a flat band in the LIGHT half',
    CB.plateau([0.10, 0.20, 0.30, 0.40, 0.9, 0.9, 0.9, 0.9]), 12.5);

  // ── sootiness proxy ───────────────────────────────────────────────────────
  ck('sat of pure grey is 0', CB.sat(90, 90, 90), 0);
  ck('sat of pure red is 1', CB.sat(200, 0, 0), 1);
  ck('sat of black is 0 (no divide by zero)', CB.sat(0, 0, 0), 0);
  ck('sat is value-independent for a scaled colour',
    +CB.sat(50, 25, 25).toFixed(6), +CB.sat(200, 100, 100).toFixed(6));
  // ⚠️ AND THE POINT OF THAT LAST ONE: a pure SCALE cannot change HSV saturation, so
  // if dkSat moves at all under a contrast change it is the S-curve bending the
  // channels apart, not the darkening itself. b4edc22 records the same arithmetic.

  // ── ladder responds to what it claims to ──────────────────────────────────
  const rep = (v, n) => new Array(n).fill(v);
  const L1 = VL.ladder([...rep(0.30, 500), ...rep(0.90, 500)], {});
  const L2 = VL.ladder([...rep(0.24, 500), ...rep(0.90, 500)], {});
  ck('deepening p05 raises range by exactly the deepening', +(L2.range - L1.range).toFixed(4), 0.06, 1e-4);
  ck('...and leaves p95 alone', L2.p95, L1.p95);

  console.log(`\n${pass} passed, ${fail} failed`);
  return fail === 0 ? 0 : 1;
}

// ─────────────────────────────────────────────────────────────────────────────
if (has('--selftest')) process.exit(selftest());

if (!BASE) { console.error('PREVIEW_BASE unset — run under tools/tmp/headserve.mjs'); process.exit(2); }
const st = STATIONS[STATION];
if (!st) { console.error(`no station ${STATION}`); process.exit(2); }
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const all = {};
try {
  for (const id of IDS) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    await page.addInitScript({ content: VL_SRC });
    await page.addInitScript({ content: `${CB_SRC}; window.CB = { crush: cbCrush, plateau: cbPlateau, sat: cbSat };` });
    await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
    page.on('pageerror', (e) => console.error('  PAGEERROR', String(e).slice(0, 200)));
    try {
      const q = `${BASE}/?player=${id}&enemy=donut&px=${st.x}&py=${st.y}&fogRadius=${st.fog}&simSpeed=0.02&pointerLock=0`;
      await page.goto(q, { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
      await page.waitForTimeout(900);
      const res = await page.evaluate(CAPTURE, { playerId: id, lo: LO, hi: HI, png: SAVE_PNG });
      if (res.error) { console.error(`✗ ${id}: ${res.error}`); continue; }
      all[id] = res;
      console.log(`\n${id}  (${res.player}, ${res.playerPx} px, h ${res.charHeightPx}px)  diff dMean ${res.diff.dMean} dMax ${res.diff.dMax} dPct ${res.diff.dPct}%`);
      console.log('  config    p05     p95   range  st10      dL   clip0  clip255   crush%  plateau   dkSat');
      for (const c of res.configs) {
        console.log(`  ${c.label.padEnd(8)}${c.p05.toFixed(3).padStart(6)}${c.p95.toFixed(3).padStart(8)}${c.range.toFixed(3).padStart(8)}` +
          `${String(c.steps10).padStart(6)}${c.dL.toFixed(3).padStart(8)}${c.clipLo.toFixed(3).padStart(8)}${c.clipHi.toFixed(3).padStart(9)}` +
          `${c.crush.toFixed(3).padStart(9)}${c.plateau.toFixed(2).padStart(9)}${c.dkSat.toFixed(4).padStart(8)}`);
      }
      if (res.pngs) {
        for (const [k, v] of Object.entries(res.pngs)) {
          await sharp(Buffer.from(v.b64, 'base64'), { raw: { width: v.w, height: v.h, channels: 3 } })
            .png().toFile(join(OUT, `${id}.${k.replace(/[^a-z0-9]+/gi, '_')}.png`));
        }
      }
    } catch (e) {
      console.error(`✗ ${id}: ${e}`);
    } finally { await page.close(); }
  }
} finally { await browser.close(); }

// ── per-character deltas, then the mean ─────────────────────────────────────
const ids = Object.keys(all);
if (ids.length) {
  const sgn = (v, d = 4) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}`;
  console.log(`\n\nPER CHARACTER at ${STATION} — c${LO.toFixed(2)} -> c${HI.toFixed(2)}, ONE uniform\n`);
  console.log('character        range@lo  range@hi    Δrange       p05@lo   p05@hi      Δp05     p95@lo  p95@hi     Δp95   st10');
  const acc = { rl: 0, rh: 0, pl: 0, ph: 0, ql: 0, qh: 0, cl: 0, ch: 0, cl2: 0, ch2: 0, kl: 0, kh: 0, sl: 0, sh: 0, tl: 0, th: 0 };
  let up = 0, down = 0, stepGain = 0;
  for (const id of ids) {
    const [A, B] = all[id].configs;
    acc.rl += A.range; acc.rh += B.range; acc.pl += A.p05; acc.ph += B.p05;
    acc.ql += A.p95; acc.qh += B.p95; acc.cl += A.clipLo; acc.ch += B.clipLo;
    acc.cl2 += A.clipHi; acc.ch2 += B.clipHi; acc.kl += A.crush; acc.kh += B.crush;
    acc.sl += A.plateau; acc.sh += B.plateau; acc.tl += A.dkSat; acc.th += B.dkSat;
    if (B.range > A.range) up++; else down++;
    if (B.steps10 > A.steps10) stepGain++;
    console.log(`${id.padEnd(14)}${A.range.toFixed(4).padStart(10)}${B.range.toFixed(4).padStart(10)}${sgn(B.range - A.range).padStart(10)}` +
      `${A.p05.toFixed(4).padStart(13)}${B.p05.toFixed(4).padStart(9)}${sgn(B.p05 - A.p05).padStart(10)}` +
      `${A.p95.toFixed(4).padStart(11)}${B.p95.toFixed(4).padStart(8)}${sgn(B.p95 - A.p95).padStart(9)}` +
      `${`${A.steps10}->${B.steps10}`.padStart(7)}`);
  }
  const n = ids.length, m = (k) => acc[k] / n;
  console.log(`\nMEAN over ${n}   range ${m('rl').toFixed(4)} -> ${m('rh').toFixed(4)}  (${sgn(m('rh') - m('rl'))})`);
  console.log(`               p05 ${m('pl').toFixed(4)} -> ${m('ph').toFixed(4)}  (${sgn(m('ph') - m('pl'))})`);
  console.log(`               p95 ${m('ql').toFixed(4)} -> ${m('qh').toFixed(4)}  (${sgn(m('qh') - m('ql'))})`);
  console.log(`  whole-frame clip0 ${m('cl').toFixed(3)}% -> ${m('ch').toFixed(3)}%   clip255 ${m('cl2').toFixed(3)}% -> ${m('ch2').toFixed(3)}%`);
  console.log(`             crush% ${m('kl').toFixed(3)} -> ${m('kh').toFixed(3)}   plateau ${m('sl').toFixed(2)} -> ${m('sh').toFixed(2)}   dkSat ${m('tl').toFixed(4)} -> ${m('th').toFixed(4)}`);
  console.log(`  range improved on ${up}/${n}, regressed on ${down}/${n}; ${stepGain} gained a j0.10 value step`);
  // ⚠️ strip the base64 frames before serialising — leaving them in wrote a 129 MB
  // JSON the first time, for a table that is under 4 KB.
  const lean = Object.fromEntries(Object.entries(all).map(([k, v]) => [k, { ...v, pngs: undefined }]));
  await writeFile(join(OUT, `contrastab.${STATION}.json`), JSON.stringify({ station: STATION, lo: LO, hi: HI, all: lean }, null, 2));
  console.log(`\nwrote ${OUT}/contrastab.${STATION}.json`);
}
