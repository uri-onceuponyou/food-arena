#!/usr/bin/env node
/**
 * POST-CHAIN ABLATION — which pass is eating the cast's dark end, per element.
 *
 * ── Why ──────────────────────────────────────────────────────────────────────
 * `tools/tmp/valuescan.mjs` measured the whole chain at once: bypassing the composer
 * moves mean p05 0.304 -> 0.272 and mean range 0.593 -> 0.657. That is 27% of the gap
 * to the reference, but "the post chain" is four things (bloom, the toy grade's
 * highlight shoulder, its contrast S-curve, its saturation, plus vignette and SMAA)
 * and they do NOT pull the same way — the S-curve DEEPENS darks while bloom and SMAA
 * LIFT them. A single before/after cannot tell them apart, and the fixes are opposite.
 *
 * So this holds one frozen frame and walks the chain one knob at a time, reporting
 * the character's own value ladder (P05 / P95 / range on its EXACT matte) plus the
 * hero-vs-ground dL, for every configuration.
 *
 * ⚠️ `BlendFunction.SKIP` is 9 in postprocessing 6.37 and `0` is `ADD`
 * (`docs/LESSONS.md` §12) — a documented ablation recipe once ADDED the effect it
 * claimed to skip. Nothing here touches a blend function. Every ablation is a
 * UNIFORM set to its identity value (`intensity` 0, `darkness` 0, `contrastAmount` 0,
 * `highlightKnee` 1), and EVERY ONE is confirmed by image diff against the shipped
 * frame in the same run — a config that reports `dMean 0.000` did nothing, whatever
 * its name says.
 *
 * ⚠️ AND THE SAME TRAP CAUGHT THIS TOOL ONCE, IN A NEW COSTUME. The first version
 * ablated SMAA with `pass.enabled = false` and reported **every percentile 0.000, a
 * whole-frame diff of 160/255**: `EffectComposer.addPass` puts `renderToScreen` on the
 * LAST pass and `render()` skips disabled ones, so disabling the last pass leaves
 * nothing writing to the default framebuffer. The number was not small or noisy, it
 * was a black screen — and it would have read as "SMAA is worth 0.25 of P05". It is
 * spliced out of `composer.passes` and `renderToScreen` handed back instead.
 *
 * ── What it found ────────────────────────────────────────────────────────────
 * Mean over the cast at pot_south, as a change in the character's own P05
 * (negative = deeper darks). Verified additive: the four rows sum to the measured
 * whole-chain figure, which is what says the attribution is real.
 *
 *   SMAA .................. +0.032    bright floor blended into the fighter's outline
 *   bloom ................. +0.020    halo
 *   contrast S-curve ...... -0.046    already pulling the RIGHT way
 *   vignette ..............  0.000    exactly zero on a centred fighter
 *   highlight shoulder ....  0.000    costs P95, not P05
 *
 * So "the post chain is eating the darks" is true only in NET. The grade is the only
 * part fighting for them, and the two that lift them are an antialiasing pass and a
 * glow that are both art direction. That is why the fix that landed is a new pull at
 * the bottom (`shadowToe` in `stage.ts`) rather than a subtraction anywhere here.
 *
 * ⚠️ MASKS come from the direct render (composer bypassed), for the reason
 * `valuescan.mjs` records: hiding the head changes 41,332 post-processed pixels
 * against a 26,173 px character, so a post-processed matte would be 58% halo. The
 * mask is identical across every config here BY CONSTRUCTION, which is what makes the
 * configs comparable at all.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   node tools/tmp/headserve.mjs -- node tools/tmp/postablate.mjs --out shots/post
 *   node tools/tmp/headserve.mjs --worktree -- node tools/tmp/postablate.mjs --out shots/post/after
 *   node tools/tmp/postablate.mjs --selftest      # no browser
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
const OUT = get('--out', 'shots/post');
const IDS = get('--ids', 'hamburger,taco,waterbottle,hotdog,soup').split(',');
const STATION = get('--station', 'pot_south');
const TIER = get('--tier', null);
const SAVE_PNG = has('--png');
const PNG_OF = get('--png-of', 'no-post (direct)');
const RECIPES_ON = has('--recipes');
const LIGHTS_ON = has('--lights');
const TOE_ON = has('--toe');
const PAIR_ON = has('--pair');
const GREASE_HEX = get('--grease-hex', '#B0802C');

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
// IN-PAGE: one matte, N post configurations, all on the same frozen frame.
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

    // ── the post chain's handles ────────────────────────────────────────────
    const passes = stage.composer ? stage.composer.passes : [];
    const fx = passes.flatMap((p) => p.effects ?? []);
    const H = {
      bloom: fx.find((e) => e.name === 'BloomEffect') ?? null,
      grade: fx.find((e) => /Grade/.test(e.name)) ?? null,
      vignette: fx.find((e) => e.name === 'VignetteEffect') ?? null,
      smaaPass: passes.find((p) => (p.effects ?? []).some((e) => e.name === 'SMAAEffect')) ?? null,
    };
    result.chain = {
      passes: passes.map((p) => p.constructor.name),
      effects: fx.map((e) => e.name),
      hasBloom: !!H.bloom, hasGrade: !!H.grade, hasVignette: !!H.vignette, hasSmaa: !!H.smaaPass,
    };
    const g = H.grade;
    const U = g ? {
      sat: g.uniforms.get('satAmount').value,
      knee: g.uniforms.get('satKnee').value,
      contrast: g.uniforms.get('contrastAmount').value,
      hk: g.uniforms.get('highlightKnee').value,
      toe: g.uniforms.get('shadowToe') ? g.uniforms.get('shadowToe').value : null,
      tk: g.uniforms.get('toeKnee') ? g.uniforms.get('toeKnee').value : null,
    } : null;
    result.gradeUniforms = U;
    const bloomI = H.bloom ? H.bloom.intensity : null;
    const bloomT = H.bloom ? H.bloom.luminanceMaterial.threshold : null;
    const vigD = H.vignette ? H.vignette.uniforms.get('darkness').value : null;
    result.bloom = { intensity: bloomI, threshold: bloomT };
    result.vignetteDarkness = vigD;

    // ⚠️ SMAA CANNOT BE ABLATED WITH `pass.enabled = false`, and the first version of
    // this tool did exactly that and reported a BLACK FRAME (dMean 160.13, every
    // percentile 0.000). `EffectComposer.addPass` moves `renderToScreen` onto whatever
    // pass is last, and `render()` skips disabled passes — so disabling the last pass
    // leaves nothing writing to the default framebuffer. Sibling of the
    // `BlendFunction.SKIP` trap: a plausible mutation that measures something else
    // entirely. It is spliced out and `renderToScreen` handed back instead.
    const bloomRadius = H.bloom ? H.bloom.mipmapBlurPass.radius : null;
    const bloomSmooth = H.bloom ? H.bloom.luminanceMaterial.smoothing : null;
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
      }
      if (H.bloom) {
        H.bloom.intensity = bloomI; H.bloom.luminanceMaterial.threshold = bloomT;
        H.bloom.mipmapBlurPass.radius = bloomRadius; H.bloom.luminanceMaterial.smoothing = bloomSmooth;
      }
      if (H.vignette) H.vignette.uniforms.get('darkness').value = vigD;
      if (greaseDisc && discHex) { greaseDisc.material.color.set(discHex); greaseDisc.material.needsUpdate = true; }
      stage.composer.passes.length = 0;
      stage.composer.passes.push(...origPasses);
      origPasses.forEach((p, i) => { p.renderToScreen = origRTS[i]; p.enabled = true; });
    };
    result.bloom.radius = bloomRadius;
    result.bloom.smoothing = bloomSmooth;

    let restoreLights = () => {};

    /** Render whatever is configured now and score the character. */
    const score = (label, apply, direct) => {
      restore();
      restoreLights();
      if (apply) apply(H, g);
      if (direct) { r.setRenderTarget(null); r.render(scene, cam); }
      else { stage.render(0); stage.render(0); }
      const px = readAll();
      const luma = new Float32Array(cw * chh);
      for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
        const s = ((cy + y) * Wp + (cx + x)) * 4;
        luma[y * cw + x] = window.VL.luma(px[s], px[s + 1], px[s + 2]);
      }
      const lm = [];
      for (let j = 0; j < cw * chh; j++) if (maskCrop[j]) lm.push(luma[j]);
      const L = window.VL.ladder(lm, {});
      const FG = window.VL.figureGround(luma, cw, chh, maskCrop, { ringFrac: 0.30, edgeR: 4 });
      // WHOLE-FRAME channel clipping. The highlight shoulder exists to stop large pale
      // surfaces pinning at white; any candidate that opens it back up has to be
      // checked against the number that motivated it, not against a hope.
      let lo = 0, hi = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i] === 0 || px[i + 1] === 0 || px[i + 2] === 0) lo++;
        if (px[i] === 255 || px[i + 1] === 255 || px[i + 2] === 255) hi++;
      }
      const nPix = px.length / 4;
      return { label, ladder: L, fg: FG, frame: px, clipLo: +((100 * lo) / nPix).toFixed(2), clipHi: +((100 * hi) / nPix).toFixed(2) };
    };

    // ── the configurations ──────────────────────────────────────────────────
    const setG = (gg, k, v) => { if (gg) gg.uniforms.get(k).value = v; };
    const ELEMENTS = [
      ['shipped', null, false],
      ['no-post (direct)', null, true],
      ['bloom off', (h) => { if (h.bloom) h.bloom.intensity = 0; }, false],
      ['vignette off', (h) => { if (h.vignette) h.vignette.uniforms.get('darkness').value = 0; }, false],
      ['smaa removed', (h) => { if (h.smaaPass) dropPass(h.smaaPass); }, false],
      ['grade: contrast 0', (h, gg) => setG(gg, 'contrastAmount', 0), false],
      ['grade: sat 0', (h, gg) => setG(gg, 'satAmount', 0), false],
      ['grade: shoulder off (hk 1)', (h, gg) => setG(gg, 'highlightKnee', 1.0), false],
      ['grade: contrast 0.80', (h, gg) => setG(gg, 'contrastAmount', 0.80), false],
      ['grade: hk 0.92', (h, gg) => setG(gg, 'highlightKnee', 0.92), false],
      ['bloom thr 0.90', (h) => { if (h.bloom) h.bloom.luminanceMaterial.threshold = 0.90; }, false],
      ['bloom i 0.18', (h) => { if (h.bloom) h.bloom.intensity = 0.18; }, false],
    ];
    // ── Recipes: the knobs COMBINED, because they are not independent ─────────
    // The shoulder decides how much room the S-curve has at the top, and bloom's
    // halo is added after both. Reading three single-knob rows and adding them up is
    // exactly the local-optima mistake `docs/LESSONS.md` §7 records; each candidate
    // below is measured as a whole.
    const RECIPES = [
      ['R1 c .72 hk .90', (h, gg) => { setG(gg, 'contrastAmount', 0.72); setG(gg, 'highlightKnee', 0.90); }, false],
      ['R2 c .78 hk .92', (h, gg) => { setG(gg, 'contrastAmount', 0.78); setG(gg, 'highlightKnee', 0.92); }, false],
      ['R3 R2 + bloom r .42', (h, gg) => {
        setG(gg, 'contrastAmount', 0.78); setG(gg, 'highlightKnee', 0.92);
        if (h.bloom) h.bloom.mipmapBlurPass.radius = 0.42;
      }, false],
      ['R4 R2 + bloom i .20', (h, gg) => {
        setG(gg, 'contrastAmount', 0.78); setG(gg, 'highlightKnee', 0.92);
        if (h.bloom) h.bloom.intensity = 0.20;
      }, false],
      ['R5 R2 + smooth .06', (h, gg) => {
        setG(gg, 'contrastAmount', 0.78); setG(gg, 'highlightKnee', 0.92);
        if (h.bloom) h.bloom.luminanceMaterial.smoothing = 0.06;
      }, false],
      ['R6 c .78 hk .95', (h, gg) => { setG(gg, 'contrastAmount', 0.78); setG(gg, 'highlightKnee', 0.95); }, false],
      ['R7 c .85 hk .92', (h, gg) => { setG(gg, 'contrastAmount', 0.85); setG(gg, 'highlightKnee', 0.92); }, false],
      ['R8 R2 + bloom i .20 r .42', (h, gg) => {
        setG(gg, 'contrastAmount', 0.78); setG(gg, 'highlightKnee', 0.92);
        if (h.bloom) { h.bloom.intensity = 0.20; h.bloom.mipmapBlurPass.radius = 0.42; }
      }, false],
    ];
    // ── Lighting, for comparison ONLY ────────────────────────────────────────
    // The hemisphere fill is called "THE SHADOW FLOOR" in `lighting.ts` and was
    // raised 0.24 -> 0.50 in the round that dropped the key to 30 deg. It is the most
    // obvious non-post lever on the cast's dark end, so it is PRICED here rather than
    // left as a hunch — but it darkens the ground at the same time as the fighter, so
    // the column to read is `dL`, not `p05` alone.
    // ⚠️ The rim is deliberately absent: a measured sweep put the whole available gain
    // from retuning it at +0.012 before it INVERTS. Nothing here touches it.
    const L = stage.lighting;
    const fill0 = L && L.fill ? L.fill.intensity : null;
    const amb0 = L && L.ambient ? L.ambient.intensity : null;
    const env0 = scene.environmentIntensity;
    const LIGHTS = [
      ['light: fill 0.50->0.38', () => { if (L && L.fill) L.fill.intensity = 0.38; }, false],
      ['light: fill 0.50->0.30', () => { if (L && L.fill) L.fill.intensity = 0.30; }, false],
      ['light: env x0.80', () => { scene.environmentIntensity = env0 * 0.8; }, false],
      ['light: ambient 0', () => { if (L && L.ambient) L.ambient.intensity = 0; }, false],
    ];
    restoreLights = () => {
      if (L && L.fill && fill0 != null) L.fill.intensity = fill0;
      if (L && L.ambient && amb0 != null) L.ambient.intensity = amb0;
      scene.environmentIntensity = env0;
    };
    result.lighting = { fill: fill0, ambient: amb0, environmentIntensity: env0 };

    // ── The shadow toe (needs a `stage.ts` carrying `shadowToe`) ─────────────
    // Swept live rather than guessed. Every row holds `highlightKnee` at its shipped
    // 0.82 — the light end is already at the reference (P95 0.896 both sides), so
    // range must be bought at the BOTTOM, and the row that buys it at the top costs
    // 40x the clipping.
    const hasToe = !!(g && g.uniforms.get('shadowToe'));
    const T = (toe, tk, sat = 0.70, c = 0.72) => (h, gg) => {
      setG(gg, 'shadowToe', toe); setG(gg, 'toeKnee', tk);
      setG(gg, 'satAmount', sat); setG(gg, 'contrastAmount', c);
    };
    const TOE = !hasToe ? [['⚠ shadowToe uniform ABSENT — stage.ts is not the one under test', null, false]] : [
      ['HEAD s.70 c.62 toe0', T(0.00, 0.60, 0.70, 0.62), false],
      ['toe .28@.60 s.70', T(0.28, 0.60, 0.70), false],
      ['toe .28@.60 s.82', T(0.28, 0.60, 0.82), false],
      ['toe .28@.60 s.86', T(0.28, 0.60, 0.86), false],
      ['toe .28@.60 s.90', T(0.28, 0.60, 0.90), false],
      ['toe .34@.64 s.86', T(0.34, 0.64, 0.86), false],
      ['toe .40@.68 s.86', T(0.40, 0.68, 0.86), false],
      ['toe .34@.70 s.86', T(0.34, 0.70, 0.86), false],
      ['toe .40@.75 s.90', T(0.40, 0.75, 0.90), false],
      ['toe .46@.72 s.90', T(0.46, 0.72, 0.90), false],
    ];

    // ── PAIR: the whole change, before and after, on ONE frozen frame ────────
    //
    // The acceptance numbers cannot be got by running the tool twice. HEAD moved four
    // commits during this session and one of them (`60c5b92`) re-laid out the arena —
    // every island, every counter, both spawns — so a "before" captured an hour ago and
    // an "after" captured now differ by someone else's work as much as by mine
    // (`docs/LESSONS.md` §5). Driving both states inside a single page load makes the
    // two frames byte-identical except for four uniforms and one material colour.
    //
    // `greaseHex` is `KPAL.grease` as HEAD authors it. The served tree carries the
    // darkened clone, so restoring this hex IS the before-state of the puddle.
    let greaseDisc = null;
    {
      let grp = null;
      scene.traverse((o) => { if (o.name === 'puddle_grease_surface__no_outline') grp = o.parent; });
      if (grp) for (const kid of grp.children) if (kid.name === 'puddle') greaseDisc = kid;
    }
    const discHex = greaseDisc ? '#' + greaseDisc.material.color.getHexString() : null;
    result.greaseDisc = { found: !!greaseDisc, colour: discHex };
    const setPuddle = (hex) => {
      if (!greaseDisc) return;
      greaseDisc.material.color.set(hex);
      greaseDisc.material.needsUpdate = true;
    };
    const HEAD_GRADE = { sat: 0.70, contrast: 0.62, hk: 0.82, toe: 0.00, tk: 0.60 };
    const applyGrade = (gg, v) => {
      if (!gg) return;
      setG(gg, 'satAmount', v.sat); setG(gg, 'contrastAmount', v.contrast);
      setG(gg, 'highlightKnee', v.hk);
      if (gg.uniforms.get('shadowToe')) { setG(gg, 'shadowToe', v.toe); setG(gg, 'toeKnee', v.tk); }
    };
    const PAIR = [
      ['A HEAD grade + HEAD puddle', (h, gg) => { applyGrade(gg, HEAD_GRADE); setPuddle(opts.greaseHex); }, false],
      ['B new grade only', (h, gg) => { setPuddle(opts.greaseHex); }, false],
      ['C dark puddle only', (h, gg) => { applyGrade(gg, HEAD_GRADE); }, false],
      ['D SHIPPED both', null, false],
    ];

    const CONFIGS = [...(opts.pair ? [] : ELEMENTS), ...(opts.pair ? PAIR : []),
      ...(opts.recipes ? RECIPES : []), ...(opts.toe ? TOE : []), ...(opts.lights ? LIGHTS : [])];

    let shippedFrame = null;
    for (const [label, apply, direct] of CONFIGS) {
      const s = score(label, apply, direct);
      if (label === 'shipped' || label === 'D SHIPPED both') shippedFrame = s.frame;
      // IMAGE DIFF against the shipped frame — the SKIP-trap guard. A config that
      // reports dMean 0.000 changed NOTHING, whatever its name claims.
      let dMean = 0, dMax = 0, dPct = 0;
      if (shippedFrame) {
        let sum = 0, over = 0;
        for (let i = 0; i < shippedFrame.length; i += 4) {
          const d = Math.max(Math.abs(shippedFrame[i] - s.frame[i]),
            Math.abs(shippedFrame[i + 1] - s.frame[i + 1]),
            Math.abs(shippedFrame[i + 2] - s.frame[i + 2]));
          sum += d; if (d > dMax) dMax = d; if (d > 2) over++;
        }
        const n = shippedFrame.length / 4;
        dMean = +(sum / n).toFixed(4); dPct = +((100 * over) / n).toFixed(2);
      }
      result.configs.push({
        label,
        p05: +s.ladder.p05.toFixed(4), p50: +s.ladder.p50.toFixed(4), p95: +s.ladder.p95.toFixed(4),
        range: +s.ladder.range.toFixed(4), steps10: s.ladder.steps.j10,
        dL: s.fg.dL, dLedge: s.fg.dLedge, figureLuma: s.fg.figureLuma, groundLuma: s.fg.groundLuma,
        clipLo: s.clipLo, clipHi: s.clipHi,
        dMean, dMax, dPct,
      });
      if (opts.png && (label === 'shipped' || label === opts.png)) {
        const rgb = new Uint8Array(cw * chh * 3);
        for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
          const sI = ((cy + y) * Wp + (cx + x)) * 4, d = (y * cw + x) * 3;
          rgb[d] = s.frame[sI]; rgb[d + 1] = s.frame[sI + 1]; rgb[d + 2] = s.frame[sI + 2];
        }
        (result.pngs ??= {})[label] = { w: cw, h: chh, b64: (() => {
          let str = '';
          for (let i = 0; i < rgb.length; i += 8192) str += String.fromCharCode.apply(null, rgb.subarray(i, i + 8192));
          return btoa(str);
        })() };
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
    const ok = typeof want === 'number' ? Math.abs(got - want) <= (eps ?? 1e-6) : JSON.stringify(got) === JSON.stringify(want);
    if (ok) { pass++; console.log(`  ✓ ${n.padEnd(58)} ${JSON.stringify(got)}`); }
    else { fail++; console.log(`  ✗ ${n.padEnd(58)} got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
  };
  console.log('\nPOSTABLATE SELFTEST — the arithmetic this tool reports, by hand\n');
  // The S-curve the grade applies, reproduced in JS so the direction of the fix is
  // not taken on faith. `mix(c, smoothstep(c), t)`.
  const S = (c, t) => c * (1 - t) + c * c * (3 - 2 * c) * t;
  // Derived by hand: 0.30*0.38 + (0.09 * 2.40)*0.62 = 0.1140 + 0.1339 = 0.2479, and
  // 0.80*0.38 + (0.64 * 1.40)*0.62 = 0.3040 + 0.5555 = 0.8595.
  // (Both assertions were first written as 0.2477 and 0.8298 — my arithmetic, not the
  //  tool's. `valuescan.mjs`'s selftest records the identical incident and the same
  //  conclusion: "the instrument disagreed with me so the instrument is wrong" is the
  //  failure mode a selftest exists to prevent.)
  ck('contrast 0.62 pulls 0.30 DOWN', +S(0.30, 0.62).toFixed(4), 0.2479, 1e-4);
  ck('contrast 0.62 pushes 0.80 UP', +S(0.80, 0.62).toFixed(4), 0.8595, 1e-4);
  ck('...so the S-curve EXPANDS range, it does not eat it',
    +((S(0.80, 0.62) - S(0.30, 0.62)) - (0.80 - 0.30)).toFixed(4), 0.1116, 1e-4);
  ck('contrast is identity at 0.5', +S(0.5, 0.62).toFixed(6), 0.5, 1e-9);
  ck('contrast 0.80 pulls 0.30 further', +S(0.30, 0.80).toFixed(4), 0.2328, 1e-4);
  ck('...so MORE contrast DEEPENS darks', S(0.30, 0.80) < S(0.30, 0.62), true);
  // The highlight shoulder, and what raising the knee buys back at the top.
  const sk = (x, k) => { const head = Math.max(1 - k, 1e-4); return x < k ? x : k + head * (1 - Math.exp(-(x - k) / head)); };
  ck('shoulder at knee 0.82 maps 1.0 ->', +sk(1.0, 0.82).toFixed(4), 0.9338, 1e-4);
  ck('shoulder at knee 0.92 maps 1.0 ->', +sk(1.0, 0.92).toFixed(4), 0.9706, 1e-4);
  ck('knee 0.82 -> 0.92 recovers at white', +(sk(1.0, 0.92) - sk(1.0, 0.82)).toFixed(4), 0.0368, 1e-4);
  ck('shoulder is identity below the knee', sk(0.5, 0.82), 0.5);
  ck('knee 1.0 is identity everywhere', sk(1.0, 1.0), 1.0, 1e-3);
  // Luma is the recorded formula.
  ck('VL.luma(255,255,255)', +VL.luma(255, 255, 255).toFixed(6), 1);
  ck('VL.luma(0,0,0)', VL.luma(0, 0, 0), 0);
  // Ladder responds to a range change and only to that.
  const rep = (v, n) => new Array(n).fill(v);
  const L1 = VL.ladder([...rep(0.30, 500), ...rep(0.90, 500)], {});
  const L2 = VL.ladder([...rep(0.24, 500), ...rep(0.90, 500)], {});
  ck('deepening p05 0.30 -> 0.24 raises range by 0.06', +(L2.range - L1.range).toFixed(4), 0.06, 1e-4);
  ck('...and does not change p95', L2.p95, L1.p95);
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
    await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
    page.on('pageerror', (e) => console.error('  PAGEERROR', String(e).slice(0, 200)));
    try {
      const q = `${BASE}/?player=${id}&enemy=donut&px=${st.x}&py=${st.y}&fogRadius=${st.fog}&simSpeed=0.02&pointerLock=0${TIER ? `&tier=${TIER}` : ''}`;
      await page.goto(q, { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
      await page.waitForTimeout(900);
      const res = await page.evaluate(CAPTURE, { playerId: id, recipes: RECIPES_ON, lights: LIGHTS_ON, toe: TOE_ON, pair: PAIR_ON, greaseHex: GREASE_HEX, png: SAVE_PNG ? PNG_OF : null });
      if (res.error) { console.error(`✗ ${id}: ${res.error}`); continue; }
      all[id] = res;
      console.log(`\n${id}  (${res.player}, ${res.playerPx} px, h ${res.charHeightPx}px)  chain: ${res.chain.effects.join('+')}${res.chain.hasSmaa ? '+SMAA' : ''}`);
      console.log('  config                        p05     p95   range  steps      dL   dLedge   clip0 clip255 |  dMean  dMax  dPct');
      for (const c of res.configs) {
        console.log(`  ${c.label.padEnd(28)}${c.p05.toFixed(3).padStart(6)}${c.p95.toFixed(3).padStart(8)}${c.range.toFixed(3).padStart(8)}` +
          `${String(c.steps10).padStart(7)}${String(c.dL).padStart(8)}${String(c.dLedge).padStart(9)}${String(c.clipLo).padStart(8)}${String(c.clipHi).padStart(8)} | ` +
          `${String(c.dMean).padStart(6)}${String(c.dMax).padStart(6)}${String(c.dPct).padStart(6)}`);
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

// ── the summary that matters: mean over characters, per configuration ────────
const ids = Object.keys(all);
if (ids.length) {
  const labels = all[ids[0]].configs.map((c) => c.label);
  console.log(`\nMEAN over ${ids.length} characters at ${STATION}${TIER ? ` (tier ${TIER})` : ''}`);
  console.log('config                          p05     p95   range      dL   clip255      Δp05    Δrange      ΔdL');
  const shipped = {};
  for (const L of labels) {
    const rows = ids.map((id) => all[id].configs.find((c) => c.label === L)).filter(Boolean);
    const m = (f) => rows.reduce((s, r) => s + f(r), 0) / rows.length;
    const p05 = m((r) => r.p05), p95 = m((r) => r.p95), rg = m((r) => r.range), dl = m((r) => r.dL);
    const ch = m((r) => r.clipHi ?? 0);
    if (L === 'shipped') { shipped.p05 = p05; shipped.range = rg; shipped.dL = dl; }
    const sgn = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(3)}`;
    console.log(`${L.padEnd(30)}${p05.toFixed(3).padStart(6)}${p95.toFixed(3).padStart(8)}${rg.toFixed(3).padStart(8)}${dl.toFixed(3).padStart(8)}${ch.toFixed(2).padStart(10)}` +
      sgn(p05 - shipped.p05).padStart(10) + sgn(rg - shipped.range).padStart(10) + sgn(dl - shipped.dL).padStart(9));
  }
}
await writeFile(join(OUT, `ablate${TIER ? '.' + TIER : ''}.json`), JSON.stringify(all, null, 2));
console.log(`\nwrote ${OUT}/ablate${TIER ? '.' + TIER : ''}.json`);
