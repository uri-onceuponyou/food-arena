#!/usr/bin/env node
/**
 * IS THE GRADE CHANGE FREE? — per tier, both settings, ONE page load each.
 *
 * ── The claim, and why it still gets measured ────────────────────────────────
 * `contrastAmount` is a plain `THREE.Uniform` in `ToyGradeEffect` (`stage.ts` ~205),
 * not a `#define` and not a macro on the effect — `postprocessing` only rebuilds a
 * shader when `defines` change or `setChanged()` fires, and a uniform write does
 * neither. So the structural answer is "a float, therefore free". That is an
 * argument, and `docs/LESSONS.md` §10 is explicit that a plausible measurement taken
 * once and treated as fact has already cost this project real time. So it is
 * measured, on the numbers this project trusts under SwiftShader — draws, triangles,
 * fullscreen fill, framebuffer binds, program links, live contexts — and NOT on any
 * timing, which means nothing on a CPU rasteriser.
 *
 * ── Why both settings in one page load ───────────────────────────────────────
 * Two page loads differ in boot-time program links, texture uploads and GC state,
 * all of which swamp the thing being asked about. Inside a single load, the SAME
 * context renders N frames at 0.62 and N frames at 0.72 with the counters zeroed in
 * between, so any difference is the uniform and nothing else. Program links are
 * counted CUMULATIVELY as well: if the second setting linked a new program, the boot
 * count would rise after the switch, and that is the number that would betray a
 * hidden recompile.
 *
 *   node tools/tmp/headserve.mjs --overlay src/render/stage.ts -- \
 *     node tools/tmp/gradeperf.mjs --tiers high,medium,low
 */
import { chromium } from 'playwright';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? process.env.HEADSERVE_URL ?? get('--url', null);
const TIERS = get('--tiers', 'high,medium,low').split(',');
const FRAMES = Number(get('--frames', '30'));
const LO = Number(get('--lo', '0.62'));
const HI = Number(get('--hi', '0.72'));

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

/**
 * Counter shim, lifted from `tools/perf.mjs`'s `wrapContext` so the definitions of
 * "a draw" and "fill" are the project's existing ones rather than new inventions.
 * `viewport` is tracked per context so fill is the shaded-pixel count of each draw.
 */
const SHIM = `
window.__P = { draws: 0, tris: 0, fillPx: 0, useProgram: 0, bindFramebuffer: 0,
               programsCreated: 0, programsLinked: 0, shadersCompiled: 0, contexts: 0 };
(function () {
  const P = window.__P;
  for (const proto of [window.WebGL2RenderingContext && WebGL2RenderingContext.prototype,
                       window.WebGLRenderingContext && WebGLRenderingContext.prototype]) {
    if (!proto || proto.__gpWrapped) continue;
    proto.__gpWrapped = true;
    const vp = new WeakMap();
    const ov = proto.viewport;
    proto.viewport = function (x, y, w, h) { vp.set(this, w * h); return ov.call(this, x, y, w, h); };
    const countDraw = (gl, tris) => { P.draws++; P.tris += tris; P.fillPx += vp.get(gl) || 0; };
    const oDE = proto.drawElements;
    proto.drawElements = function (m, c, t, o) { countDraw(this, m === 4 ? c / 3 : 0); return oDE.call(this, m, c, t, o); };
    const oDA = proto.drawArrays;
    proto.drawArrays = function (m, f, c) { countDraw(this, m === 4 ? c / 3 : 0); return oDA.call(this, m, f, c); };
    if (proto.drawElementsInstanced) { const o = proto.drawElementsInstanced;
      proto.drawElementsInstanced = function (m, c, t, off, i) { countDraw(this, (m === 4 ? c / 3 : 0) * i); return o.call(this, m, c, t, off, i); }; }
    if (proto.drawArraysInstanced) { const o = proto.drawArraysInstanced;
      proto.drawArraysInstanced = function (m, f, c, i) { countDraw(this, (m === 4 ? c / 3 : 0) * i); return o.call(this, m, f, c, i); }; }
    const oUP = proto.useProgram; proto.useProgram = function (p) { P.useProgram++; return oUP.call(this, p); };
    const oBF = proto.bindFramebuffer; proto.bindFramebuffer = function (t, f) { P.bindFramebuffer++; return oBF.call(this, t, f); };
    const oCP = proto.createProgram; proto.createProgram = function () { P.programsCreated++; return oCP.call(this); };
    const oLP = proto.linkProgram; proto.linkProgram = function (p) { P.programsLinked++; return oLP.call(this, p); };
    const oCS = proto.compileShader; proto.compileShader = function (s) { P.shadersCompiled++; return oCS.call(this, s); };
  }
  const oGC = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, o) {
    const c = oGC.call(this, t, o);
    if (c && /webgl/.test(t)) P.contexts++;
    return c;
  };
})();
`;

const MEASURE = (opts) => {
  const stage = window.__stage;
  if (!stage || stage.disposed) return { error: 'no live Stage' };
  const r = stage.renderer;
  const P = window.__P;
  const passes = stage.composer ? stage.composer.passes : [];
  const fx = passes.flatMap((p) => p.effects ?? []);
  const g = fx.find((e) => /Grade/.test(e.name)) ?? null;
  if (!g) return { error: 'no grade effect' };
  const u = g.uniforms.get('contrastAmount');
  if (!u) return { error: 'no contrastAmount uniform' };

  r.info.autoReset = false;
  const run = (contrast) => {
    u.value = contrast;
    // one warm-up frame OUTSIDE the counted window, so a lazily-built program or a
    // resized render target is attributed to warm-up rather than to the setting.
    stage.render(0);
    const d0 = P.draws, t0 = P.tris, f0 = P.fillPx, up0 = P.useProgram, fb0 = P.bindFramebuffer;
    const pl0 = P.programsLinked, pc0 = P.programsCreated, sc0 = P.shadersCompiled;
    for (let i = 0; i < opts.frames; i++) stage.render(0.016);
    return {
      contrast: u.value,
      draws: P.draws - d0, tris: Math.round(P.tris - t0), fillPx: P.fillPx - f0,
      useProgram: P.useProgram - up0, bindFramebuffer: P.bindFramebuffer - fb0,
      programsLinked: P.programsLinked - pl0, programsCreated: P.programsCreated - pc0,
      shadersCompiled: P.shadersCompiled - sc0,
      // structural state AFTER the window — a changed chain would show here
      passes: passes.length,
      effects: fx.length,
      // ⚠️ The first version of this probe counted `pass.renderTarget*` and got 0 on
      // every tier — a VACUOUS column that would have been reported as evidence.
      // `postprocessing` keeps its ping-pong buffers on the COMPOSER, not the passes.
      // These three are live numbers that differ between tiers, which is what says
      // they are measuring something at all.
      renderTargets: (stage.composer?.inputBuffer ? 1 : 0) + (stage.composer?.outputBuffer ? 1 : 0)
        + passes.reduce((s, p) => s + (p.renderTarget ? 1 : 0), 0),
      texturesResident: r.info.memory ? r.info.memory.textures : null,
      geometriesResident: r.info.memory ? r.info.memory.geometries : null,
      programsTotal: r.info.programs ? r.info.programs.length : null,
      pixelRatio: r.getPixelRatio(),
      drawingBuffer: [r.domElement.width, r.domElement.height],
      shadowMapEnabled: r.shadowMap.enabled,
      contexts: P.contexts,
    };
  };
  // interleaved A,B,A so an ordering effect (a target resized on the first pass, a
  // program linked lazily) cannot be mistaken for the setting's cost
  const A1 = run(opts.lo), B = run(opts.hi), A2 = run(opts.lo);
  // ⚠️ `stage.quality` does not exist, so an earlier version printed tier "null" and
  // would have happily reported three identical runs of the SAME tier as a per-tier
  // proof. The honest readback is the CHAIN the tier produced — pass and effect counts
  // differ per tier by construction, so a tier that failed to bind is visible.
  return { tierAsked: opts.tier, chain: { passes: passes.length, effects: fx.map((e) => e.name) }, A1, B, A2 };
};

if (!BASE) { console.error('PREVIEW_BASE unset — run under tools/tmp/headserve.mjs'); process.exit(2); }

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const out = {};
let bad = 0, checks = 0;
try {
  for (const tier of TIERS) {
    const page = await browser.newPage({ viewport: { width: 1300, height: 740 }, deviceScaleFactor: 1 });
    await page.addInitScript({ content: SHIM });
    await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
    page.on('pageerror', (e) => console.error('  PAGEERROR', String(e).slice(0, 200)));
    try {
      await page.goto(`${BASE}/?player=hamburger&enemy=donut&simSpeed=0.02&pointerLock=0&tier=${tier}`,
        { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
      await page.waitForTimeout(900);
      const res = await page.evaluate(MEASURE, { frames: FRAMES, lo: LO, hi: HI, tier });
      if (res.error) { console.error(`✗ ${tier}: ${res.error}`); bad++; continue; }
      out[tier] = res;
      const { A1, B, A2 } = res;
      console.log(`\n── tier ${tier}  chain: ${res.chain.effects.join('+')} in ${res.chain.passes} passes  ${FRAMES} frames per window, drawing buffer ${A1.drawingBuffer.join('x')} @ dpr ${A1.pixelRatio}`);
      console.log('  metric              c0.62      c0.72      c0.62(again)   verdict');
      const rows = ['draws', 'tris', 'fillPx', 'useProgram', 'bindFramebuffer', 'programsLinked',
        'programsCreated', 'shadersCompiled', 'passes', 'effects', 'renderTargets',
        'texturesResident', 'geometriesResident', 'programsTotal', 'contexts'];
      for (const k of rows) {
        checks++;
        const ok = A1[k] === B[k] && B[k] === A2[k];
        if (!ok) bad++;
        console.log(`  ${k.padEnd(18)}${String(A1[k]).padStart(9)}${String(B[k]).padStart(11)}${String(A2[k]).padStart(15)}   ${ok ? 'identical' : '*** DIFFERS ***'}`);
      }
      checks++;
      const srOk = A1.shadowMapEnabled === B.shadowMapEnabled;
      if (!srOk) bad++;
      console.log(`  shadowMapEnabled  ${String(A1.shadowMapEnabled).padStart(9)}${String(B.shadowMapEnabled).padStart(11)}${String(A2.shadowMapEnabled).padStart(15)}   ${srOk ? 'identical' : '*** DIFFERS ***'}`);
      console.log(`  contrast actually applied: ${A1.contrast} / ${B.contrast} / ${A2.contrast}` +
        `${A1.contrast === B.contrast ? '   ⚠️ THE UNIFORM DID NOT MOVE — this run proves nothing' : ''}`);
      if (A1.contrast === B.contrast) bad++;
      checks++;
    } catch (e) { console.error(`✗ ${tier}: ${e}`); bad++; }
    finally { await page.close(); }
  }
} finally { await browser.close(); }

console.log(`\n${checks - bad}/${checks} identical across c${LO} / c${HI} / c${LO} on ${Object.keys(out).length} tiers`);
console.log(bad === 0
  ? 'PASS — the grade change costs no draws, no fill, no render targets and no program links.'
  : `FAIL — ${bad} metric(s) moved.`);
process.exit(bad === 0 ? 0 : 1);
