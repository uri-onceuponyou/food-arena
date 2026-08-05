#!/usr/bin/env node
/**
 * HALO PROBE — how much of the light OUTSIDE the silhouette is BLOOM, and what does
 * the post chain still cost the cast's dark end.
 *
 * ── The two questions, and why one tool ──────────────────────────────────────
 * `docs/STATE.md` records two findings that point at `src/render/stage.ts`:
 *
 *   1. "27% of the character value gap is the post chain."  Measured by
 *      `postablate.mjs` at contrast 0.62 with NO shadow toe, on the PRE-albedo cast.
 *      Every one of those three things has since moved. The number has to be
 *      re-derived, not inherited.
 *   2. "Bloom halos off the lit edge into the floor."  The lighting pass measured that
 *      halo falling 0.0130 -> 0.0016 (-87%) by changing the KEY LIGHT and concluded
 *      "bloom is the mechanism, the key's amplitude was the cause."
 *
 * Both are properties of the same pixels — the band just outside the character — so
 * they are measured on the same frozen frame here.
 *
 * ⚠️ AND THE INHERITED HALO NUMBER IS NOT A BLOOM NUMBER. `contactshadow.mjs`'s
 * `haloDL` is the ground 2-8 px outside the hero minus the same ground 14-26 px out.
 * That is a NET luminance ramp: the hero's own CAST SHADOW lands in the near band and
 * pulls it down, and the lighting pass moved the hero's shadow from 1.24 hero-heights
 * away to 0.67 — i.e. INTO that band. So a large part of -87% may be shadow arriving,
 * not glow leaving. The only way to attribute it to bloom is a PAIRED difference on
 * one frozen frame:
 *
 *      bloomAdd(d) = mean( shipped(d) - bloomOff(d) )
 *
 * Same geometry, same mask, same shadow, same everything — so every contaminant
 * (a counter in the band, the cast shadow, the arena's baked decals) cancels EXACTLY
 * rather than approximately. That difference IS bloom, by construction.
 *
 * ── The mask ─────────────────────────────────────────────────────────────────
 * From the DIRECT render, composer bypassed, two-clear-colour. `valuescan.mjs`
 * measured that hiding the head changes 41,332 POST-PROCESSED pixels against a
 * 26,173 px character — a post-processed matte would be 58% halo, i.e. it would
 * contain the very thing being measured. The mask is identical across every config in
 * a run BY CONSTRUCTION, which is what makes the configs comparable at all.
 *
 * ── What it reports, per config ──────────────────────────────────────────────
 *   ramp[d]     mean luma at each exact 4-connected distance d px OUTSIDE the matte
 *   haloDL      mean(2..8) - mean(14..26)          — the inherited metric, reproduced
 *   bloomAdd*   mean(this - bloomOff) inside the matte / in 2..8 / in 14..26
 *   spill       bloomAdd(2..8) / bloomAdd(inside)  — >1 means bloom lights the FLOOR
 *               beside the character harder than it lights the character
 *   ladder      p05 / p95 / range / steps@0.10 on the character's own matte
 *   clipShare   share of the matte above luma 0.94 — `sepscan.mjs`'s own metric, so
 *               the reference band [0.0072 .. 0.0929], median 0.0249, applies directly
 *   dL, dLedge  figure/ground on the exact matte
 *   clip0/255   whole-frame channel clipping
 *   dMean/dMax  image diff against `shipped` — the SKIP-trap guard. A config reporting
 *               dMean 0.000 did NOTHING, whatever its label says.
 *
 * ⚠️ TRAPS THIS TOOL INHERITS DELIBERATELY FROM `postablate.mjs`, because they were
 * paid for once already:
 *   • `BlendFunction.SKIP` is 9 in postprocessing, `0` is ADD. Nothing here touches a
 *     blend function; every ablation is a uniform set to its identity value.
 *   • SMAA cannot be ablated with `pass.enabled = false` — `EffectComposer` puts
 *     `renderToScreen` on the LAST pass and skips disabled ones, so that mutation
 *     renders a BLACK FRAME and reads as "SMAA is worth 0.25 of P05". It is spliced
 *     out of `composer.passes` and `renderToScreen` handed back instead.
 *
 * ── Instrument validation ────────────────────────────────────────────────────
 * `--selftest` derives every band statistic by hand on synthetic fields (no browser).
 * The LIVE run additionally carries a `VALIDATE` config — bloom intensity driven to
 * 5x — whose bloomAdd MUST be several times the shipped one. An instrument that
 * cannot see a 5x input is not measuring bloom, and the run says so.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   node tools/tmp/haloprobe.mjs --selftest
 *   node tools/tmp/headserve.mjs -- node tools/tmp/haloprobe.mjs --out shots/halo/head
 *   node tools/tmp/headserve.mjs --overlay src/render -- \
 *        node tools/tmp/haloprobe.mjs --out shots/halo/mine
 *   ... --cands            # add the bloom candidate sweep
 *   ... --png              # write crops so the frames can be LOOKED AT
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
const OUT = get('--out', 'shots/halo');
const IDS = get('--ids', 'hamburger,egg,hotdog,waterbottle,soup').split(',');
const STATIONS_ARG = get('--stations', 'pot_south,spawn_west').split(',');
const CANDS_ON = has('--cands');
const ONLY = get('--only', null);
const SAVE_PNG = has('--png');
const PNG_OF = get('--png-of', 'bloom off');

const STATIONS = {
  pot_south: { x: 700, y: 640, fog: 850 },
  spawn_west: { x: 160, y: 500, fog: 850 },
  grease_in: { x: 560, y: 900, fog: 850 },
};

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

// ─────────────────────────────────────────────────────────────────────────────
// BAND ARITHMETIC — one implementation, used by the selftest AND injected into the
// page, for the reason `valuelib.mjs` records: a selftest proves nothing unless it
// exercises the code the live capture runs.
// ─────────────────────────────────────────────────────────────────────────────
const HALO_SRC = String.raw`
/**
 * Mean luma at each exact 4-connected distance OUTSIDE 'mask', 1..cap-1.
 * 'dist' must be VL.distanceField(mask, W, H, cap): 0 inside, d outside, clamped at cap.
 */
function hpRamp(luma, dist, mask, W, H, cap) {
  const sum = new Float64Array(cap + 1), n = new Float64Array(cap + 1);
  for (var j = 0; j < W * H; j++) {
    if (mask[j]) continue;
    var d = dist[j];
    if (d <= 0 || d >= cap) continue;
    sum[d] += luma[j]; n[d]++;
  }
  var out = [];
  for (var d2 = 1; d2 < cap; d2++) out.push(n[d2] ? sum[d2] / n[d2] : null);
  return { mean: out, n: Array.from(n.slice(1, cap)) };
}

/** Mean of 'luma' over the pixels OUTSIDE mask whose distance is in [lo, hi]. */
function hpBand(luma, dist, mask, W, H, lo, hi) {
  var s = 0, n = 0;
  for (var j = 0; j < W * H; j++) {
    if (mask[j]) continue;
    var d = dist[j];
    if (d >= lo && d <= hi) { s += luma[j]; n++; }
  }
  return { mean: n ? s / n : null, n: n };
}

/** Mean of 'luma' INSIDE the mask. */
function hpInside(luma, mask, W, H) {
  var s = 0, n = 0;
  for (var j = 0; j < W * H; j++) if (mask[j]) { s += luma[j]; n++; }
  return { mean: n ? s / n : null, n: n };
}

/**
 * The inherited metric: near band (2..8) minus far band (14..26).
 * Positive = something is brighter right beside the silhouette than it is further out.
 */
function hpHaloDL(luma, dist, mask, W, H) {
  var near = hpBand(luma, dist, mask, W, H, 2, 8);
  var far = hpBand(luma, dist, mask, W, H, 14, 26);
  return (near.mean == null || far.mean == null) ? null : near.mean - far.mean;
}

/** Share of the masked pixels at or above 'thr'. sepscan.mjs's clipShare, thr 0.94. */
function hpClipShare(luma, mask, W, H, thr) {
  var hit = 0, n = 0;
  for (var j = 0; j < W * H; j++) if (mask[j]) { n++; if (luma[j] > thr) hit++; }
  return n ? hit / n : null;
}

globalThis.HP = { ramp: hpRamp, band: hpBand, inside: hpInside, haloDL: hpHaloDL, clipShare: hpClipShare };
`;
new Function(HALO_SRC)();
const HP = globalThis.HP;

const DIST_CAP = 32;

// ─────────────────────────────────────────────────────────────────────────────
// IN-PAGE
// ─────────────────────────────────────────────────────────────────────────────
const CAPTURE = (opts) => {
  const stage = window.__stage;
  if (!stage || stage.disposed) return { error: 'no live Stage' };
  const r = stage.renderer, scene = stage.scene, cam = stage.rig && stage.rig.camera;
  const gl = r.getContext();
  const Wp = r.domElement.width, Hp = r.domElement.height;
  const VLl = window.VL, HPl = window.HP;

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
    // ── the player's exact matte, from the DIRECT render ────────────────────
    const perCast = [];
    for (const c of casts) {
      hideEnvironment(new Set([topOf(c)]));
      const others = [];
      for (const o of casts) { if (o !== c && topOf(o) === topOf(c) && o.visible) { others.push(o); o.visible = false; } }
      const m = matteAll();
      for (const o of others) o.visible = true;
      restoreEnvironment();
      let n = 0;
      for (let j = 0; j < m.length; j++) if (m[j]) n++;
      perCast.push({ name: c.name, px: n, mask: m });
    }
    const onScreen = perCast.filter((p) => p.px > 0);
    const named = onScreen.filter((p) => p.name === `character:${opts.playerId}`);
    const player = named.length === 1 ? named[0] : onScreen.sort((x, y) => y.px - x.px)[0];
    if (!player) return { error: 'player has zero on-screen pixels' };
    result.player = player.name;
    result.playerPx = player.px;

    // ⚠️ THE OTHER FIGHTER IS ALSO ON SCREEN and has its own halo. Any of its pixels
    // inside our distance bands would be read as "the floor beside the player". Every
    // cast matte is therefore excluded from the bands, not just the player's.
    const otherCast = new Uint8Array(Wp * Hp);
    for (const p of perCast) if (p !== player) for (let j = 0; j < p.mask.length; j++) if (p.mask[j]) otherCast[j] = 1;
    let otherPx = 0; for (let j = 0; j < otherCast.length; j++) otherPx += otherCast[j];
    result.otherCastPx = otherPx;

    const mask = player.mask;
    const dist = VLl.distanceField(mask, Wp, Hp, opts.cap);
    // Band membership, precomputed once: outside the player, and not on another fighter.
    const bandOK = new Uint8Array(Wp * Hp);
    for (let j = 0; j < Wp * Hp; j++) bandOK[j] = (!mask[j] && !otherCast[j]) ? 1 : 0;

    const bb = VLl.bbox(mask, Wp, Hp);
    result.charHeightPx = bb ? bb.h : null;
    result.bbox = bb ? [bb.x0, bb.y0, bb.w, bb.h] : null;

    // ── the post chain's handles ────────────────────────────────────────────
    const passes = stage.composer ? stage.composer.passes : [];
    const fx = passes.flatMap((p) => p.effects ?? []);
    const H = {
      bloom: fx.find((e) => e.name === 'BloomEffect') ?? null,
      grade: fx.find((e) => /Grade/.test(e.name)) ?? null,
      vignette: fx.find((e) => e.name === 'VignetteEffect') ?? null,
      ssao: fx.find((e) => e.name === 'SSAOEffect') ?? null,
      smaaPass: passes.find((p) => (p.effects ?? []).some((e) => e.name === 'SMAAEffect')) ?? null,
    };
    result.chain = {
      passes: passes.map((p) => p.constructor.name),
      effects: fx.map((e) => e.name),
      hasBloom: !!H.bloom, hasGrade: !!H.grade, hasVignette: !!H.vignette, hasSmaa: !!H.smaaPass,
      hasSsao: !!H.ssao,
    };
    const g = H.grade;
    const U = g ? {
      sat: g.uniforms.get('satAmount').value,
      knee: g.uniforms.get('satKnee').value,
      contrast: g.uniforms.get('contrastAmount').value,
      hk: g.uniforms.get('highlightKnee').value,
      toe: g.uniforms.get('shadowToe') ? g.uniforms.get('shadowToe').value : null,
      tk: g.uniforms.get('toeKnee') ? g.uniforms.get('toeKnee').value : null,
      tck: g.uniforms.get('toeChromaKeep') ? g.uniforms.get('toeChromaKeep').value : null,
    } : null;
    result.gradeUniforms = U;
    const B0 = H.bloom ? {
      intensity: H.bloom.intensity,
      threshold: H.bloom.luminanceMaterial.threshold,
      smoothing: H.bloom.luminanceMaterial.smoothing,
      radius: H.bloom.mipmapBlurPass.radius,
      levels: H.bloom.mipmapBlurPass.levels,
      blendFunction: H.bloom.blendMode ? H.bloom.blendMode.blendFunction : null,
    } : null;
    result.bloom = B0;
    const vigD = H.vignette ? H.vignette.uniforms.get('darkness').value : null;
    result.vignetteDarkness = vigD;
    // SSAO is ablated by its BLEND OPACITY, never by its blend FUNCTION: `SKIP` is 9
    // in postprocessing and `0` is ADD, and a documented recipe once ADDED the effect
    // it claimed to skip (`docs/LESSONS.md` §12).
    const ssaoOpacity0 = H.ssao ? H.ssao.blendMode.opacity.value : null;
    result.ssao = H.ssao ? { opacity: ssaoOpacity0 } : null;

    const origPasses = [...passes];
    const origRTS = origPasses.map((p) => p.renderToScreen);
    const dropPass = (p) => {
      const i = stage.composer.passes.indexOf(p);
      if (i < 0) return;
      stage.composer.passes.splice(i, 1);
      const last = stage.composer.passes[stage.composer.passes.length - 1];
      if (last) last.renderToScreen = true;
    };
    const restore = () => {
      if (g) {
        g.uniforms.get('satAmount').value = U.sat; g.uniforms.get('satKnee').value = U.knee;
        g.uniforms.get('contrastAmount').value = U.contrast; g.uniforms.get('highlightKnee').value = U.hk;
        if (g.uniforms.get('shadowToe')) g.uniforms.get('shadowToe').value = U.toe;
        if (g.uniforms.get('toeKnee')) g.uniforms.get('toeKnee').value = U.tk;
        if (g.uniforms.get('toeChromaKeep')) g.uniforms.get('toeChromaKeep').value = U.tck;
      }
      if (H.bloom) {
        H.bloom.intensity = B0.intensity;
        H.bloom.luminanceMaterial.threshold = B0.threshold;
        H.bloom.luminanceMaterial.smoothing = B0.smoothing;
        H.bloom.mipmapBlurPass.radius = B0.radius;
        if (H.bloom.mipmapBlurPass.levels !== B0.levels) H.bloom.mipmapBlurPass.levels = B0.levels;
      }
      if (H.vignette) H.vignette.uniforms.get('darkness').value = vigD;
      if (H.ssao) H.ssao.blendMode.opacity.value = ssaoOpacity0;
      setRim(RIM_DEFAULT);
      stage.composer.passes.length = 0;
      stage.composer.passes.push(...origPasses);
      origPasses.forEach((p, i) => { p.renderToScreen = origRTS[i]; p.enabled = true; });
    };

    /** Render whatever is configured now and measure it. */
    const score = (label, apply, direct) => {
      restore();
      if (apply) apply(H, g);
      if (direct) { r.setRenderTarget(null); r.render(scene, cam); }
      else { stage.render(0); stage.render(0); }
      const px = readAll();
      const luma = new Float32Array(Wp * Hp);
      for (let j = 0, i = 0; j < Wp * Hp; j++, i += 4) luma[j] = VLl.luma(px[i], px[i + 1], px[i + 2]);

      const lm = [];
      for (let j = 0; j < Wp * Hp; j++) if (mask[j]) lm.push(luma[j]);
      const L = VLl.ladder(lm, {});
      const FG = VLl.figureGround(luma, Wp, Hp, mask, { ringFrac: 0.30, edgeR: 4 });
      // NOTE: the ramp/band statistics are taken by the `rampClean`/`bandStat` closures
      // below, NOT by `HP.ramp`/`HP.band` — those two are the hand-checked reference
      // implementations the selftest exercises, and the closures add one thing they
      // cannot know about: the OTHER fighter's matte is excluded from every band.
      let lo = 0, hi = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i] === 0 || px[i + 1] === 0 || px[i + 2] === 0) lo++;
        if (px[i] === 255 || px[i + 1] === 255 || px[i + 2] === 255) hi++;
      }
      const nPix = px.length / 4;
      return {
        label, luma, frame: px, ladder: L, fg: FG,
        clipShare: HPl.clipShare(luma, mask, Wp, Hp, 0.94),
        clipLo: +((100 * lo) / nPix).toFixed(3), clipHi: +((100 * hi) / nPix).toFixed(3),
      };
    };

    // Bands, computed on the CLEANED membership (player excluded, other fighter excluded).
    const bandStat = (luma, lo, hi) => {
      let s = 0, n = 0;
      for (let j = 0; j < Wp * Hp; j++) {
        if (!bandOK[j]) continue;
        const d = dist[j];
        if (d >= lo && d <= hi) { s += luma[j]; n++; }
      }
      return { mean: n ? s / n : null, n };
    };
    const insideStat = (luma) => {
      let s = 0, n = 0;
      for (let j = 0; j < Wp * Hp; j++) if (mask[j]) { s += luma[j]; n++; }
      return { mean: n ? s / n : null, n };
    };
    const rampClean = (luma) => {
      const sum = new Float64Array(opts.cap + 1), n = new Float64Array(opts.cap + 1);
      for (let j = 0; j < Wp * Hp; j++) {
        if (!bandOK[j]) continue;
        const d = dist[j];
        if (d <= 0 || d >= opts.cap) continue;
        sum[d] += luma[j]; n[d]++;
      }
      const out = [];
      for (let d = 1; d < opts.cap; d++) out.push(n[d] ? +(sum[d] / n[d]).toFixed(5) : null);
      return out;
    };

    // ── The Fresnel rim (`src/render/toon.ts`) ────────────────────────────────
    // Every `toonMat` carries an additive view-dependent rim, so the brightest pixels
    // on any silhouette EDGE are the rim's — and bloom blurs exactly those outward.
    // `applyRimLight` publishes its uniforms on `material.userData.rimUniforms` so this
    // can be ablated on the same frozen frame instead of on a second page load.
    //
    // ⚠️ RE-COLLECTED ON EVERY USE, NOT CACHED. `userData.rimUniforms` is written inside
    // `onBeforeCompile`, and three calls that again whenever a material needs a program
    // it has not compiled before — which this very tool provokes, because the matte pass
    // above HIDES THE LIGHTS, and light counts are part of the program cache key. A
    // handle collected before that pass can therefore be pointing at a uniforms object
    // the renderer has stopped reading. Collecting it fresh each time costs one
    // traversal and cannot go stale.
    const collectRim = () => {
      const out = [];
      const seen = new Set();
      scene.traverse((o) => {
        const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
        for (const mt of mats) {
          if (!mt || seen.has(mt)) continue;
          seen.add(mt);
          const u = mt.userData && mt.userData.rimUniforms;
          if (u && u.rimStrength) out.push(u.rimStrength);
        }
      });
      return out;
    };
    const RIM_DEFAULT = 0.28;
    result.rim = { materials: collectRim().length, strengths: Array.from(new Set(collectRim().map((u) => u.value))).sort() };
    const setRim = (v) => { for (const u of collectRim()) u.value = v; };

    const setG = (gg, k, v) => { if (gg && gg.uniforms.get(k)) gg.uniforms.get(k).value = v; };
    const BASE_CFG = [
      // `bloom off` and `ssao off` run FIRST so every later row can be differenced
      // against them. Their own image diffs are filled in after the loop, once
      // `shipped` has produced a reference.
      ['bloom off', (h) => { if (h.bloom) h.bloom.intensity = 0; }, false],
      ['ssao off', (h) => { if (h.ssao) h.ssao.blendMode.opacity.value = 0; }, false],
      ['shipped', null, false],
      ['VALIDATE bloom i x5', (h) => { if (h.bloom) h.bloom.intensity = B0.intensity * 5; }, false],
      ['no-post (direct)', null, true],
      ['smaa removed', (h) => { if (h.smaaPass) dropPass(h.smaaPass); }, false],
      ['vignette off', (h) => { if (h.vignette) h.vignette.uniforms.get('darkness').value = 0; }, false],
      ['grade: contrast 0', (h, gg) => setG(gg, 'contrastAmount', 0), false],
      ['grade: toe 0', (h, gg) => setG(gg, 'shadowToe', 0), false],
      ['grade: shoulder off (hk 1)', (h, gg) => setG(gg, 'highlightKnee', 1.0), false],
      ['grade: sat 0', (h, gg) => setG(gg, 'satAmount', 0), false],
      ['VALIDATE rim x20', () => setRim(RIM_DEFAULT * 20), false],
      ['rim off (toon.ts)', () => setRim(0), false],
      ['rim x0.5', () => setRim(RIM_DEFAULT * 0.5), false],
    ];
    const CANDS = [
      ['C1 bloom thr .88', (h) => { if (h.bloom) h.bloom.luminanceMaterial.threshold = 0.88; }, false],
      ['C2 bloom thr .92', (h) => { if (h.bloom) h.bloom.luminanceMaterial.threshold = 0.92; }, false],
      ['C3 bloom r .40', (h) => { if (h.bloom) h.bloom.mipmapBlurPass.radius = 0.40; }, false],
      ['C4 bloom r .30', (h) => { if (h.bloom) h.bloom.mipmapBlurPass.radius = 0.30; }, false],
      ['C5 bloom i .20', (h) => { if (h.bloom) h.bloom.intensity = 0.20; }, false],
      ['C6 bloom smooth .05', (h) => { if (h.bloom) h.bloom.luminanceMaterial.smoothing = 0.05; }, false],
      ['C7 thr .88 + r .40', (h) => {
        if (h.bloom) { h.bloom.luminanceMaterial.threshold = 0.88; h.bloom.mipmapBlurPass.radius = 0.40; }
      }, false],
      ['C8 thr .88 r .40 i .24', (h) => {
        if (h.bloom) {
          h.bloom.luminanceMaterial.threshold = 0.88; h.bloom.mipmapBlurPass.radius = 0.40;
          h.bloom.intensity = 0.24;
        }
      }, false],
    ];
    let CONFIGS = [...BASE_CFG, ...(opts.cands ? CANDS : [])];
    if (opts.only) {
      const want = new Set(opts.only.split('|'));
      CONFIGS = CONFIGS.filter(([l]) => want.has(l) || l === 'shipped' || l === 'bloom off' || l === 'ssao off');
    }

    let shippedFrame = null, bloomOffLuma = null, bloomOffFrame = null, bloomOffRow = null;
    let ssaoOffLuma = null, ssaoOffFrame = null, ssaoOffRow = null;
    const store = {};
    const imageDiff = (A, B) => {
      let sum = 0, over = 0, dMax = 0;
      for (let i = 0; i < A.length; i += 4) {
        const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
        sum += d; if (d > dMax) dMax = d; if (d > 2) over++;
      }
      const n = A.length / 4;
      return { dMean: +(sum / n).toFixed(4), dMax, dPct: +((100 * over) / n).toFixed(2) };
    };
    for (const [label, apply, direct] of CONFIGS) {
      const s = score(label, apply, direct);
      if (label === 'shipped') shippedFrame = s.frame;
      if (label === 'bloom off') { bloomOffLuma = s.luma; bloomOffFrame = s.frame; }
      if (label === 'ssao off') { ssaoOffLuma = s.luma; ssaoOffFrame = s.frame; }
      if (opts.png && (label === 'shipped' || label === opts.png || label === 'ssao off')) store[label] = s;

      const dd = shippedFrame ? imageDiff(shippedFrame, s.frame) : { dMean: null, dMax: null, dPct: null };
      const { dMean, dMax, dPct } = dd;

      const near = bandStat(s.luma, 2, 8), far = bandStat(s.luma, 14, 26);
      const inS = insideStat(s.luma);
      const row = {
        label,
        // Diagnostic, read back AFTER the render: a config whose knob did not stick is
        // indistinguishable from a knob that does nothing, and this separates them.
        rimNow: collectRim().length ? collectRim()[0].value : null,
        bloomNow: H.bloom ? H.bloom.intensity : null,
        nearBand: near.mean == null ? null : +near.mean.toFixed(5), nearPx: near.n,
        farBand: far.mean == null ? null : +far.mean.toFixed(5), farPx: far.n,
        haloDL: (near.mean == null || far.mean == null) ? null : +(near.mean - far.mean).toFixed(5),
        insideLuma: inS.mean == null ? null : +inS.mean.toFixed(5),
        ramp: rampClean(s.luma),
        p05: +s.ladder.p05.toFixed(4), p50: +s.ladder.p50.toFixed(4), p95: +s.ladder.p95.toFixed(4),
        range: +s.ladder.range.toFixed(4), steps10: s.ladder.steps.j10,
        clipShare: +s.clipShare.toFixed(5),
        dL: s.fg.dL, dLedge: s.fg.dLedge,
        clipLo: s.clipLo, clipHi: s.clipHi,
        dMean, dMax, dPct,
      };
      // ── the bloom-attributable deposit ────────────────────────────────────
      // Paired against ONE `bloom off` frame. Only meaningful for configs that differ
      // from it by bloom alone, so it is reported as null for the others.
      const bloomFamily = /^(shipped|VALIDATE|C\d)/.test(label);
      if (bloomOffLuma && bloomFamily) {
        const diff = new Float32Array(Wp * Hp);
        for (let j = 0; j < Wp * Hp; j++) diff[j] = s.luma[j] - bloomOffLuma[j];
        const dn = bandStat(diff, 2, 8), df = bandStat(diff, 14, 26), di = insideStat(diff);
        row.bloomAddNear = dn.mean == null ? null : +dn.mean.toFixed(5);
        row.bloomAddFar = df.mean == null ? null : +df.mean.toFixed(5);
        row.bloomAddIn = di.mean == null ? null : +di.mean.toFixed(5);
        row.bloomHalo = (dn.mean == null || df.mean == null) ? null : +(dn.mean - df.mean).toFixed(5);
        row.bloomSpill = (di.mean && Math.abs(di.mean) > 1e-6 && dn.mean != null)
          ? +(dn.mean / di.mean).toFixed(3) : null;
        row.bloomRamp = rampClean(diff);
      }
      // ── the AO-attributable deposit, same paired construction as bloom's ────
      if (ssaoOffLuma && label === 'shipped') {
        const diff = new Float32Array(Wp * Hp);
        for (let j = 0; j < Wp * Hp; j++) diff[j] = s.luma[j] - ssaoOffLuma[j];
        const dn = bandStat(diff, 2, 8), df = bandStat(diff, 14, 26), di = insideStat(diff);
        row.aoAddNear = dn.mean == null ? null : +dn.mean.toFixed(5);
        row.aoAddFar = df.mean == null ? null : +df.mean.toFixed(5);
        row.aoAddIn = di.mean == null ? null : +di.mean.toFixed(5);
        row.aoContact = (dn.mean == null || df.mean == null) ? null : +(dn.mean - df.mean).toFixed(5);
        row.aoRamp = rampClean(diff);
      }
      if (label === 'bloom off') bloomOffRow = row;
      if (label === 'ssao off') ssaoOffRow = row;
      result.configs.push(row);
      // Free the big buffers as soon as they are no longer needed: 19 configs x a
      // 1600x900 RGBA frame plus its Float32 luma is ~200 MB, and a page that runs out
      // of memory mid-sweep looks exactly like a broken probe.
      if (label !== 'shipped' && label !== 'bloom off' && label !== 'ssao off' && !store[label]) { s.frame = null; s.luma = null; }
    }
    // `bloom off` was scored before `shipped` existed, so its image diff is filled in
    // here rather than left as a hole.
    if (bloomOffRow && bloomOffFrame && shippedFrame) Object.assign(bloomOffRow, imageDiff(shippedFrame, bloomOffFrame));
    if (ssaoOffRow && ssaoOffFrame && shippedFrame) Object.assign(ssaoOffRow, imageDiff(shippedFrame, ssaoOffFrame));

    if (opts.png) {
      const want = new Set(['shipped', opts.png, 'ssao off']);
      const [bx, by, bw, bh] = result.bbox;
      const pad = Math.max(24, Math.round(0.45 * bh));
      const cx = Math.max(0, bx - pad), cy = Math.max(0, by - pad);
      const cw = Math.min(Wp - cx, bw + pad * 2), chh = Math.min(Hp - cy, bh + pad * 2);
      result.crop = [cx, cy, cw, chh];
      for (const label of want) {
        const s = store[label];
        if (!s) continue;
        const rgb = new Uint8Array(cw * chh * 3);
        for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
          const sI = ((cy + y) * Wp + (cx + x)) * 4, d = (y * cw + x) * 3;
          rgb[d] = s.frame[sI]; rgb[d + 1] = s.frame[sI + 1]; rgb[d + 2] = s.frame[sI + 2];
        }
        let str = '';
        for (let i = 0; i < rgb.length; i += 8192) str += String.fromCharCode.apply(null, rgb.subarray(i, i + 8192));
        (result.pngs ??= {})[label] = { w: cw, h: chh, b64: btoa(str) };
      }
    }

    restore();
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
    const ok = typeof want === 'number' ? Math.abs(got - want) <= (eps ?? 1e-9)
      : JSON.stringify(got) === JSON.stringify(want);
    if (ok) { pass++; console.log(`  ✓ ${n.padEnd(56)} ${JSON.stringify(got)}`); }
    else { fail++; console.log(`  ✗ ${n.padEnd(56)} got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
  };
  console.log('\nHALOPROBE SELFTEST — every band derived by hand on a synthetic field\n');

  // A 81x81 field with a 21x21 square mask centred at (40,40). VL.distanceField is a
  // 4-connected BFS, so `dist` is the L1 distance to the nearest mask pixel.
  const W = 81, Hh = 81, cap = 32;
  const mask = new Uint8Array(W * Hh);
  for (let y = 30; y <= 50; y++) for (let x = 30; x <= 50; x++) mask[y * W + x] = 1;
  const dist = VL.distanceField(mask, W, Hh, cap);
  ck('mask area is 21x21', mask.reduce((s, v) => s + v, 0), 441);
  ck('a pixel one to the LEFT of the square is d=1', dist[40 * W + 29], 1);
  ck('a pixel three above is d=3', dist[27 * W + 40], 3);
  ck('the corner diagonal neighbour is L1 d=2', dist[29 * W + 29], 2);
  ck('inside the mask is d=0', dist[40 * W + 40], 0);

  // ⚠️ The live path carries luma in a `Float32Array`, so 0.42 + 0.10 is not 0.52 to
  // more than ~1e-7. EPS below is that rounding, MEASURED here rather than guessed, so
  // the tolerance is derived from the storage type instead of being widened until the
  // assertions pass. Every band assertion then runs on Float32 — the same storage the
  // live capture uses — rather than on a friendlier Float64 stand-in.
  const f32 = new Float32Array(1); f32[0] = 0.42 + 0.10;
  const EPS = Math.max(1e-7, Math.abs(f32[0] - 0.52) * 8);
  ck('float32 rounding of 0.52 is under 1e-6', Math.abs(f32[0] - 0.52) < 1e-6, true);

  // 1. A perfectly FLAT surround must give haloDL exactly 0 — the null case, and the
  //    one that would hide a sign error if it were skipped.
  const flat = new Float32Array(W * Hh).fill(0.42);
  ck('flat surround: haloDL is 0', HP.haloDL(flat, dist, mask, W, Hh), 0, 1e-12);

  // 2. A step of +0.10 applied to everything within d<=8 must give haloDL EXACTLY
  //    0.10: the near band (2..8) is entirely inside the step, the far band (14..26)
  //    entirely outside it.
  const step = new Float32Array(W * Hh);
  for (let j = 0; j < W * Hh; j++) step[j] = 0.42 + (dist[j] <= 8 && !mask[j] ? 0.10 : 0);
  ck('a +0.10 step over d<=8 reads haloDL 0.10', HP.haloDL(step, dist, mask, W, Hh), 0.10, EPS);

  // 3. HALF the step (only d<=5) must read LESS, and by the exact area fraction. The
  //    2..8 band's L1 rings around a 21x21 square have 4*(20+2d) pixels each... which
  //    is why this is checked against a count rather than a formula I might get wrong.
  const half = new Float32Array(W * Hh);
  for (let j = 0; j < W * Hh; j++) half[j] = 0.42 + (dist[j] >= 1 && dist[j] <= 5 && !mask[j] ? 0.10 : 0);
  const nearAll = HP.band(new Float32Array(W * Hh).fill(1), dist, mask, W, Hh, 2, 8).n;
  let nearHit = 0;
  for (let j = 0; j < W * Hh; j++) if (!mask[j] && dist[j] >= 2 && dist[j] <= 5) nearHit++;
  ck('half-step haloDL equals 0.10 x (hit / band)',
    HP.haloDL(half, dist, mask, W, Hh), 0.10 * nearHit / nearAll, EPS);
  ck('...and that is strictly less than the full step',
    HP.haloDL(half, dist, mask, W, Hh) < HP.haloDL(step, dist, mask, W, Hh), true);

  // 4. A DARKENING beside the silhouette — the hero's own cast shadow — reads
  //    NEGATIVE. This is the whole reason the inherited haloDL cannot be read as a
  //    bloom number: shadow and glow land in the same band with opposite signs.
  const shadow = new Float32Array(W * Hh);
  for (let j = 0; j < W * Hh; j++) shadow[j] = 0.42 - (dist[j] <= 8 && !mask[j] ? 0.06 : 0);
  ck('a shadow in the near band reads NEGATIVE', HP.haloDL(shadow, dist, mask, W, Hh), -0.06, EPS);
  // ...and glow + shadow together CANCEL, which is the failure mode being guarded.
  const both = new Float32Array(W * Hh);
  for (let j = 0; j < W * Hh; j++) both[j] = 0.42 + (dist[j] <= 8 && !mask[j] ? 0.10 - 0.10 : 0);
  ck('equal glow and shadow cancel to 0 — the trap', HP.haloDL(both, dist, mask, W, Hh), 0, EPS);
  // ...but the PAIRED difference recovers the glow exactly, which is what this tool does.
  const withGlow = new Float32Array(W * Hh);
  for (let j = 0; j < W * Hh; j++) withGlow[j] = shadow[j] + (dist[j] <= 8 && !mask[j] ? 0.10 : 0);
  const diff = new Float32Array(W * Hh);
  for (let j = 0; j < W * Hh; j++) diff[j] = withGlow[j] - shadow[j];
  ck('the PAIRED difference recovers the glow exactly', HP.haloDL(diff, dist, mask, W, Hh), 0.10, EPS);

  // 5. The ramp: mean luma at each exact distance.
  const rr = HP.ramp(step, dist, mask, W, Hh, cap);
  ck('ramp[d=1] is the raised value', rr.mean[0], 0.52, EPS);
  ck('ramp[d=8] is still raised', rr.mean[7], 0.52, EPS);
  ck('ramp[d=9] has dropped back', rr.mean[8], 0.42, EPS);
  ck('ramp has cap-1 entries', rr.mean.length, cap - 1);

  // 6. clipShare, hand-counted: 100 of the 441 masked pixels above 0.94.
  const cs = new Float32Array(W * Hh).fill(0.5);
  { let k = 0; for (let j = 0; j < W * Hh && k < 100; j++) if (mask[j]) { cs[j] = 0.99; k++; } }
  ck('clipShare counts 100 of 441', +HP.clipShare(cs, mask, W, Hh, 0.94).toFixed(6),
    +(100 / 441).toFixed(6), 1e-6);
  ck('clipShare is 0 when nothing is above the threshold',
    HP.clipShare(new Float32Array(W * Hh).fill(0.5), mask, W, Hh, 0.94), 0);
  ck('clipShare is 1 when everything is', HP.clipShare(new Float32Array(W * Hh).fill(0.99), mask, W, Hh, 0.94), 1);
  ck('the 0.94 threshold is EXCLUSIVE at the boundary',
    HP.clipShare(new Float32Array(W * Hh).fill(0.94), mask, W, Hh, 0.94), 0);

  // 7. Band pixel counts are non-zero and the far band is bigger than the near one
  //    (L1 rings grow linearly), which is what makes the far band the stable side.
  const nb = HP.band(flat, dist, mask, W, Hh, 2, 8).n;
  const fb = HP.band(flat, dist, mask, W, Hh, 14, 26).n;
  ck('near band 2..8 is non-empty', nb > 0, true);
  ck('far band 14..26 is larger than near', fb > nb, true);

  // 8. The S-curve amplifies a halo rather than leaving it alone — the reason bloom
  //    sitting BEFORE the grade matters. Slope of mix(c, smoothstep(c), t) at c.
  // (First written as 1.3384 — my arithmetic, not the tool's. 0.28 + 0.72*6*0.43*0.57
  //  is 1.338832. `postablate.mjs` and `valuescan.mjs` both record the identical
  //  incident: "the instrument disagrees with me, so the instrument is wrong" is the
  //  failure mode a selftest exists to prevent.)
  const slope = (c, t) => (1 - t) + t * (6 * c - 6 * c * c);
  ck('grade slope at the floor value 0.43, contrast 0.72', +slope(0.43, 0.72).toFixed(4), 1.3388, 1e-4);
  ck('...so the S-curve MULTIPLIES a halo there', slope(0.43, 0.72) > 1, true);
  ck('grade slope at 0.5 is the maximum', +slope(0.5, 0.72).toFixed(4), 1.36, 1e-4);
  ck('grade slope at 0.9 compresses', slope(0.9, 0.72) < 1, true);

  console.log(`\n${pass} passed, ${fail} failed`);
  return fail === 0 ? 0 : 1;
}

// ─────────────────────────────────────────────────────────────────────────────
if (has('--selftest')) process.exit(selftest());

if (!BASE) { console.error('PREVIEW_BASE unset — run under tools/tmp/headserve.mjs'); process.exit(2); }
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const all = {};
try {
  for (const stn of STATIONS_ARG) {
    const st = STATIONS[stn];
    if (!st) { console.error(`no station ${stn}`); continue; }
    for (const id of IDS) {
      const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
      await page.addInitScript({ content: VL_SRC });
      await page.addInitScript({ content: HALO_SRC });
      await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
      page.on('pageerror', (e) => console.error('  PAGEERROR', String(e).slice(0, 200)));
      try {
        const q = `${BASE}/?player=${id}&enemy=donut&px=${st.x}&py=${st.y}&fogRadius=${st.fog}&simSpeed=0.02&pointerLock=0`;
        await page.goto(q, { waitUntil: 'networkidle', timeout: 120000 });
        await page.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
        await page.waitForTimeout(900);
        const res = await page.evaluate(CAPTURE, {
          playerId: id, cands: CANDS_ON, only: ONLY, png: SAVE_PNG ? PNG_OF : null, cap: DIST_CAP,
        });
        if (res.error) { console.error(`✗ ${stn}/${id}: ${res.error}`); continue; }
        all[`${stn}/${id}`] = res;
        console.log(`\n${stn}/${id}  (${res.player}, ${res.playerPx} px, h ${res.charHeightPx}px, other cast ${res.otherCastPx} px)`);
        console.log(`  chain: ${res.chain.effects.join('+')}${res.chain.hasSmaa ? '+SMAA' : ''}   bloom ${JSON.stringify(res.bloom)}`);
        console.log('  config                        near     far   haloDL  bloomAdd(in/near)  bHalo  spill |   p05   p95 range st  clipSh    dL  dLedge | dMean');
        for (const c of res.configs) {
          const f = (v, w = 7, d = 4) => (v == null ? '—'.padStart(w) : v.toFixed(d).padStart(w));
          console.log(`  ${c.label.padEnd(26)}${f(c.nearBand)}${f(c.farBand)}${f(c.haloDL, 9, 5)}` +
            `${f(c.bloomAddIn, 9, 5)}${f(c.bloomAddNear, 9, 5)}${f(c.bloomHalo, 8, 5)}${c.bloomSpill == null ? '      —' : String(c.bloomSpill).padStart(7)} | ` +
            `${c.p05.toFixed(3).padStart(5)}${c.p95.toFixed(3).padStart(6)}${c.range.toFixed(3).padStart(6)}${String(c.steps10).padStart(3)}` +
            `${c.clipShare.toFixed(4).padStart(8)}${String(c.dL).padStart(6)}${String(c.dLedge).padStart(8)} | ${String(c.dMean).padStart(6)}`);
        }
        if (res.pngs) {
          for (const [k, v] of Object.entries(res.pngs)) {
            await sharp(Buffer.from(v.b64, 'base64'), { raw: { width: v.w, height: v.h, channels: 3 } })
              .png().toFile(join(OUT, `${stn}.${id}.${k.replace(/[^a-z0-9]+/gi, '_')}.png`));
          }
        }
      } catch (e) {
        console.error(`✗ ${stn}/${id}: ${e}`);
      } finally { await page.close(); }
    }
  }
} finally { await browser.close(); }

// ── means over every (station, character) captured ──────────────────────────
const keys = Object.keys(all);
if (keys.length) {
  const labels = all[keys[0]].configs.map((c) => c.label);
  console.log(`\nMEAN over ${keys.length} (station x character) samples`);
  console.log('config                        haloDL  bloomAddIn bloomAddNear  bHalo   spill |   p05   p95  range  steps clipShare     dL  dLedge  clip255');
  const rows = {};
  for (const L of labels) {
    const rs = keys.map((k) => all[k].configs.find((c) => c.label === L)).filter(Boolean);
    const m = (f) => {
      const v = rs.map(f).filter((x) => x != null && Number.isFinite(x));
      return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
    };
    const o = {
      haloDL: m((r) => r.haloDL), bloomAddIn: m((r) => r.bloomAddIn), bloomAddNear: m((r) => r.bloomAddNear),
      bloomHalo: m((r) => r.bloomHalo), bloomSpill: m((r) => r.bloomSpill),
      aoAddNear: m((r) => r.aoAddNear), aoAddFar: m((r) => r.aoAddFar), aoAddIn: m((r) => r.aoAddIn),
      aoContact: m((r) => r.aoContact),
      p05: m((r) => r.p05), p95: m((r) => r.p95), range: m((r) => r.range), steps10: m((r) => r.steps10),
      clipShare: m((r) => r.clipShare), dL: m((r) => r.dL), dLedge: m((r) => r.dLedge), clipHi: m((r) => r.clipHi),
    };
    rows[L] = o;
    const f = (v, w, d) => (v == null ? '—'.padStart(w) : v.toFixed(d).padStart(w));
    console.log(`${L.padEnd(28)}${f(o.haloDL, 9, 5)}${f(o.bloomAddIn, 11, 5)}${f(o.bloomAddNear, 12, 5)}${f(o.bloomHalo, 8, 5)}${f(o.bloomSpill, 8, 2)} | ` +
      `${f(o.p05, 5, 3)}${f(o.p95, 6, 3)}${f(o.range, 7, 3)}${f(o.steps10, 7, 2)}${f(o.clipShare, 10, 4)}${f(o.dL, 7, 4)}${f(o.dLedge, 8, 4)}${f(o.clipHi, 9, 3)}`);
  }
  // The two derived headline numbers.
  const sh = rows['shipped'], bo = rows['bloom off'], np = rows['no-post (direct)'], vd = rows['VALIDATE bloom i x5'];
  if (sh && np) {
    console.log(`\nPOST CHAIN, NET, on the cast's dark end:  p05 ${np.p05.toFixed(4)} (no post) -> ${sh.p05.toFixed(4)} (shipped)` +
      `   Δ ${(sh.p05 - np.p05 >= 0 ? '+' : '')}${(sh.p05 - np.p05).toFixed(4)}` +
      `   range ${np.range.toFixed(4)} -> ${sh.range.toFixed(4)}   Δ ${(sh.range - np.range >= 0 ? '+' : '')}${(sh.range - np.range).toFixed(4)}`);
  }
  if (sh && bo) {
    console.log(`BLOOM-ATTRIBUTABLE HALO:  ${sh.bloomHalo == null ? 'n/a' : sh.bloomHalo.toFixed(5)}` +
      `   (deposits ${sh.bloomAddNear?.toFixed(5)} at 2-8 px out, ${sh.bloomAddIn?.toFixed(5)} on the character itself)`);
    console.log(`INHERITED haloDL (net ramp, NOT bloom):  shipped ${sh.haloDL.toFixed(5)}   bloom off ${bo.haloDL.toFixed(5)}`);
  }
  const so = rows['ssao off'];
  if (sh && so && sh.aoAddNear != null) {
    console.log(`AO-ATTRIBUTABLE CONTACT:  near 2-8 px ${sh.aoAddNear.toFixed(5)}   far 14-26 px ${sh.aoAddFar.toFixed(5)}` +
      `   contact (near-far) ${sh.aoContact.toFixed(5)}   on the character itself ${sh.aoAddIn.toFixed(5)}`);
  }
  if (vd && sh && sh.bloomAddNear) {
    const ratio = vd.bloomAddNear / sh.bloomAddNear;
    console.log(`INSTRUMENT VALIDATION: bloom intensity x5 -> bloomAddNear x${ratio.toFixed(2)}  ` +
      `${ratio > 3 ? 'VALIDATED' : '⚠ NOT VALIDATED — the probe cannot see a 5x input'}`);
  }
}
await writeFile(join(OUT, 'halo.json'), JSON.stringify(all, null, 2));
console.log(`\nwrote ${OUT}/halo.json`);
