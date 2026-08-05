#!/usr/bin/env node
/**
 * THROWAWAY A/B differ. Renders the live game, applies a mutation supplied as a JS
 * expression, re-renders, and reports the per-pixel difference — the only honest way
 * to answer "does this pass actually do anything?".
 *
 * Usage: node tools/tmp/ab_probe.mjs --name bloom-off --mut "bloom.blendMode.blendFunction = SKIP"
 *        node tools/tmp/ab_probe.mjs --list        # print handles available to --mut
 * Optional: --save <dir>  writes before/after PNGs.
 *           --url <base>  START YOUR OWN VITE; :5173 is shared.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  THREE BUGS THIS TOOL SHIPPED WITH. All three produced numbers, and all three
 *  produced the WRONG numbers, which is worse than producing none.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 1. `SKIP` IS 9. `0` IS `ADD`.
 *    The documented recipe was `--mut "ssao.blendMode.blendFunction = 0"`, described
 *    as "skip". In `postprocessing` 6.37, `BlendFunction.SKIP === 9` (it is an alias
 *    of `DST`, the blend that returns the destination untouched) and `0` is `ADD`.
 *    So the recipe ADDED the effect's output to the frame a second time and called
 *    the result "the effect removed". A difference of zero from that mutation does
 *    not mean the effect is dead — it means the effect's output is zero, which is a
 *    different claim, and the two happen to coincide only for a pass that is already
 *    contributing nothing.
 *
 *    `SKIP` is now RESOLVED OFF THE LIVE OBJECT rather than hardcoded, so a
 *    `postprocessing` upgrade that renumbers the enum cannot silently re-break this.
 *    `BlendMode.getShaderCode()` looks the function up in a map whose SKIP entry is
 *    `null` — that null, and only that null, identifies it. It is exposed to `--mut`
 *    as `SKIP`.
 *
 * 2. `renderer.info` AFTER `composer.render()` REPORTS ONLY THE LAST PASS.
 *    `info` resets at the start of every `renderer.render()`, and a composer calls
 *    that once per pass, so anything reading `info.render.calls` after a composed
 *    frame is reading the SMAA pass — 3 draws — and calling it the frame. `autoReset`
 *    is set false here and the counters are reset explicitly, so `--stats` prints the
 *    real total.
 *
 * 3. `window.__stage` COULD BE A DEAD STAGE.
 *    It used to be a single slot assigned by every `Stage` constructor, and on a menu
 *    the last one built is `thumbs.ts`'s offscreen portrait generator, which then
 *    disposes itself. `stage.ts` now publishes a registry and resolves the slot to a
 *    live, on-screen Stage; this probe additionally REFUSES TO RUN against a disposed
 *    one rather than quietly measuring a corpse.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { captureSettled } from './settle.mjs';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const has = (k) => a.includes(k);
const mut = get('--mut', '');
const name = get('--name', 'mut');
const save = get('--save', null);
const base = get('--url', 'http://localhost:5173').replace(/\/$/, '');

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: Number(get('--w', 1300)), height: Number(get('--h', 740)) }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));

// Every save by another agent triggers a Vite full reload, which would wipe the
// frozen sim mid-probe. Documented in PROGRESS.md as having cost one agent three
// sweeps; `tools/perf.mjs` stubs the client the same way.
await page.route('**/@vite/client*', (r) => r.fulfill({
  status: 200,
  contentType: 'text/javascript',
  body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
}));

const url = get('--game', `${base}/?player=hamburger&enemy=donut&simSpeed=12`);
await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForFunction('window.__previewReady === true || window.__gameReady === true', null, { timeout: 45000 });
if (/\/\?|\/$/.test(new URL(url).pathname + new URL(url).search) && !url.includes('preview.html')) {
  await page.waitForFunction("document.querySelector('.hud-countdown')?.style.display === 'none'", null, { timeout: 60000 }).catch(() => {});
}
await page.waitForTimeout(400);

// Freeze the sim so A and B differ only by the mutation.
await page.evaluate(() => { const r = window.requestAnimationFrame; window.__raf = r; window.requestAnimationFrame = () => 0; });
await page.waitForTimeout(300);

if (save) await mkdir(save, { recursive: true });
// index.html, so the shell IS in the path and `__gameReady` says nothing about the
// screen's opacity. A washed "before" against a settled "after" would read as the
// change having done something.
if (save) await captureSettled(page, { path: `${save}/${name}_before.png`, label: `${name}_before`, tool: 'ab_probe' });

const res = await page.evaluate(({ mut, list }) => {
  const stage = window.__stage;
  if (!stage) throw new Error('no Stage on this route');
  if (stage.disposed) throw new Error('window.__stage is a DISPOSED Stage — nothing here is measurable');
  const gl = stage.renderer.getContext();
  const cv = stage.renderer.domElement;
  const W = cv.width, H = cv.height;
  const read = () => { const p = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, p); return p; };
  const passes = stage.composer ? stage.composer.passes : [];
  const fx = passes.flatMap((p) => p.effects ?? []);

  // Resolve SKIP off a live BlendMode instead of hardcoding it. `blendFunctions` maps
  // SKIP (and its alias DST) to `null`; every other function maps to a shader string,
  // and an unknown value maps to `undefined`. `null` — strictly, not falsy — is the
  // signature. Scanning is deliberately non-destructive: the original value is put
  // back before anything renders.
  const resolveSkip = (effect) => {
    if (!effect) return 9;
    const bm = effect.blendMode;
    const original = bm.blendFunction;
    let found = null;
    for (let i = 0; i <= 40; i++) {
      bm._blendFunction = i; // no event, no recompile — this is a read-only probe
      if (bm.getShaderCode() === null) { found = i; break; }
    }
    bm._blendFunction = original;
    return found ?? 9;
  };
  const SKIP = resolveSkip(fx[0]);

  // `renderer.info` resets per `renderer.render()`, i.e. per composer PASS. Without
  // this, every draw-call number this tool prints is the SMAA pass.
  stage.renderer.info.autoReset = false;
  const stats = () => {
    stage.renderer.info.reset();
    stage.render(1 / 60);
    return { draws: stage.renderer.info.render.calls, tris: stage.renderer.info.render.triangles };
  };

  const handles = {
    stage, scene: stage.scene, SKIP,
    ssao: fx.find((e) => e.name === 'SSAOEffect'),
    bloom: fx.find((e) => e.name === 'BloomEffect'),
    grade: fx.find((e) => /Grade|HueSat|Brightness/.test(e.name)),
    vignette: fx.find((e) => e.name === 'VignetteEffect'),
    lighting: stage.lighting,
  };
  if (list) {
    return {
      listOnly: true, SKIP,
      effects: fx.map((e) => `${e.name} (blendFunction ${e.blendMode.blendFunction})`),
      passes: passes.map((p, i) => `${i}:${p.constructor.name}`),
      handles: Object.keys(handles),
    };
  }

  const before = stats();
  const A = read();
  if (mut) {
    // eslint-disable-next-line no-new-func
    new Function('stage', 'scene', 'ssao', 'bloom', 'grade', 'vignette', 'lighting', 'SKIP', mut)(
      handles.stage, handles.scene, handles.ssao, handles.bloom, handles.grade, handles.vignette,
      handles.lighting, SKIP);
  }
  stage.render(1 / 60);
  const after = stats();
  const B = read();
  let sum = 0, max = 0, changed = 0;
  for (let i = 0; i < A.length; i += 4) {
    const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
    sum += d; if (d > max) max = d; if (d > 2) changed++;
  }
  const n = A.length / 4;
  return {
    meanDiff: sum / n, maxDiff: max, changedPct: 100 * changed / n,
    effects: fx.map((e) => e.name), SKIP, before, after,
  };
}, { mut, list: has('--list') });

if (res.listOnly) {
  console.log(`SKIP resolves to ${res.SKIP}`);
  console.log(`passes:   ${res.passes.join(', ')}`);
  console.log(`effects:  ${res.effects.join(', ')}`);
  console.log(`--mut handles: ${res.handles.join(', ')}`);
} else {
  console.log(`[${name}] mean=${res.meanDiff.toFixed(4)}/255  max=${res.maxDiff}  pixels>2: ${res.changedPct.toFixed(2)}%`);
  console.log(`draws ${res.before.draws} -> ${res.after.draws}   triangles ${res.before.tris} -> ${res.after.tris}   (info.autoReset=false, so these are WHOLE FRAMES)`);
  console.log(`effects: ${res.effects.join(', ')}   SKIP=${res.SKIP}`);
}
if (save && !res.listOnly) { await captureSettled(page, { path: `${save}/${name}_after.png`, label: `${name}_after`, tool: 'ab_probe' }); console.log(`saved ${save}/${name}_{before,after}.png`); }
await browser.close();
