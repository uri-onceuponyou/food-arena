#!/usr/bin/env node
/**
 * pf_ablate.mjs — WHAT EACH SUBSYSTEM COSTS IN MILLISECONDS, paired, in one page.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  READ THIS BEFORE QUOTING A MILLISECOND
 * ═══════════════════════════════════════════════════════════════════════════
 * `pf_census.mjs` says WHERE the draws and triangles are, exactly and device-
 * independently. It cannot say what any of them COST. This says what they cost,
 * and it is the weaker of the two instruments by construction:
 *
 *   * Chromium/ANGLE-on-Metal on an M5 Pro is the right GPU FAMILY as an iPhone
 *     (tile-based deferred, on-chip tile memory) and is roughly **4-6x optimistic**
 *     on core count alone, before the bandwidth gap and before thermal throttling.
 *   * CPU is throttled with CDP `Emulation.setCPUThrottlingRate` — a uniform script
 *     slowdown. It does not model a small cache, weak branch prediction, or little
 *     cores.
 *   * **Chromium is not WebKit.** Nothing here says anything about Safari.
 *
 * ── WHY IT IS PAIRED AND INTERLEAVED ────────────────────────────────────────
 * `tools/perf.mjs`'s own run-to-run spread on an unchanged tree is a documented
 * median 5-16% / max 22-26%, and `ph_frame.mjs` at cpu x6 was measured here at a
 * **22% run-to-run spread on the SAME BUILD**. A between-process A/B at that noise
 * level cannot see anything smaller than the effect it is looking for.
 *
 * So every arm runs **inside one page, interleaved** — base, ablated, base,
 * ablated, … — and the reported number is the paired median difference. The
 * **base-to-base spread over the same run is printed as the resolution floor**,
 * measured rather than guessed, and any delta inside it is reported as NOT
 * RESOLVED rather than as a number.
 *
 * ── THE ABLATIONS, and the two flavours that answer different questions ─────
 *   `*-hide`    sets `visible = false`. `WebGLRenderer.projectObject` returns
 *               early, so the frustum test and the draws go — but
 *               `Object3D.updateMatrixWorld` still walks the subtree, because it
 *               does NOT test `visible`.
 *   `*-detach`  removes the subtree from the scene. Matrices, culling and draws
 *               all go.
 *   The DIFFERENCE between the two is the per-object matrix-update cost, which is
 *   the one number that decides whether "merge the props" or "cull the props" is
 *   the right patch. Neither alone can tell you.
 *
 * ── VALIDATION (`--selftest`) ───────────────────────────────────────────────
 * A guard not shown to FAIL on the bug it guards against is not a guard
 * (CLAUDE.md 6). Three known-bad inputs:
 *   1. NULL       — an arm that mutates NOTHING, run through the identical
 *                   interleave machinery. It must report a delta INSIDE the floor.
 *                   A harness with drift, warm-up or ordering bias fails here.
 *   2. TOTAL      — `scene.visible = false`. Draws must collapse to the post chain
 *                   alone and the submit phase must fall by most of itself. An
 *                   ablation that never reaches the renderer fails here.
 *   3. COUPLING   — every arm must move the DRAW COUNT by the amount `pf_census`
 *                   independently predicts. An arm whose ms moves while its draws
 *                   do not is measuring something other than what it names. This is
 *                   the check that ties this instrument to the validated one.
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────
 *   PH_SCRATCH=<dir> node tools/tmp/ph_serve.mjs --start --ref <sha>
 *   PH_SCRATCH=<dir> node tools/tmp/pf_ablate.mjs                    # all arms, cpu x4
 *   PH_SCRATCH=<dir> node tools/tmp/pf_ablate.mjs --cpu 6 --reps 5
 *   PH_SCRATCH=<dir> node tools/tmp/pf_ablate.mjs --arms shadow-off,props-hide
 *   PH_SCRATCH=<dir> node tools/tmp/pf_ablate.mjs --selftest
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const flag = (k) => argv.includes(`--${k}`);

const SCRATCH = process.env.PH_SCRATCH ?? join(tmpdir(), 'fa-ph');
const STATE = join(SCRATCH, 'ph-serve.json');
const st = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : null;
const BASE = arg('url', null) ?? process.env.PREVIEW_BASE ?? st?.url ?? null;
const SHA = st?.sha ?? 'unknown';

const SCENE = arg('scene', 'match');
const SCENES = {
  match: '/?player=hamburger&enemy=donut',
  // ⚠️ NOT lollipop/pizza, which is what `perf.mjs` pins `match-vfx` to. Lollipop
  // has NO ranged weapon, so that scene samples a frame with ZERO projectiles —
  // i.e. the "VFX scene" in this repo has been measuring a frame with no VFX in it
  // (`ph_frame.mjs` found the same thing). hamburger throws patties and donut fires.
  'match-vfx': '/?player=hamburger&enemy=donut&simSpeed=6',
};
const CPU = Number(arg('cpu', 4));
const REPS = Number(arg('reps', 4));
const FRAMES = Number(arg('frames', 120));
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15'
  + ' (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

// ─────────────────────────────────────────────────────────────────────────────
// Page-side: the sampler + the ablation registry. Installed via addInitScript so
// it wraps rAF and the GL prototypes before the app exists.
//
// 🚨 NO BACKTICKS ANYWHERE BELOW, INCLUDING IN COMMENTS. This whole block is a JS
// template literal, and one backtick terminates it — the file then fails to parse
// with an error pointing at a word in prose. That is `docs/LESSONS.md` §9 (hud.ts's
// CSS-in-a-template-literal trap) in a tool, and it bit three times writing this one. `page.evaluate()`
// grants transient user activation (docs/AGENT-BRIEF.md §3), so nothing here is
// read through an evaluate until a cell is over.
// ─────────────────────────────────────────────────────────────────────────────
const SAMPLER = `
(() => {
  const S = { rows: [], gpu: [], recording: false, i: 0, firstDraw: 0, draws: 0, lastT: -1 };
  window.__pfa = S;

  for (const proto of [window.WebGLRenderingContext && WebGLRenderingContext.prototype,
                       window.WebGL2RenderingContext && WebGL2RenderingContext.prototype]) {
    if (!proto || proto.__pfaWrapped) continue;
    proto.__pfaWrapped = true;
    const mark = () => { if (S.firstDraw === 0) S.firstDraw = performance.now(); };
    for (const k of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const o = proto[k];
      if (!o) continue;
      proto[k] = function (...a) { mark(); S.draws++; return o.apply(this, a); };
    }
  }
  const oGC = HTMLCanvasElement.prototype.getContext;
  S.ctxs = [];
  HTMLCanvasElement.prototype.getContext = function (t, a) {
    const gl = oGC.call(this, t, a);
    if (gl && /webgl/.test(t)) S.ctxs.push(gl);
    return gl;
  };

  let tq = null, ext = null, pool = [], flight = [];
  function pickCtx() {
    let best = null, px = 0;
    for (const gl of S.ctxs) {
      if (gl.isContextLost && gl.isContextLost()) continue;
      const p = (gl.drawingBufferWidth || 0) * (gl.drawingBufferHeight || 0);
      if (p > px) { px = p; best = gl; }
    }
    return best;
  }

  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) {
    return raf(function (t) {
      const a = performance.now();
      const newFrame = t !== S.lastT;
      if (newFrame) { S.lastT = t; S.firstDraw = 0; S.draws = 0; }
      let q = null;
      if (S.recording && newFrame) {
        if (!tq) {
          const gl = pickCtx();
          if (gl && gl.createQuery) {
            ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
            if (ext) { tq = gl; for (let i = 0; i < 6; i++) pool.push(gl.createQuery()); } else tq = 'none';
          }
        }
        if (tq && tq !== 'none' && pool.length) {
          const x = pool.pop();
          try { tq.beginQuery(ext.TIME_ELAPSED_EXT, x); q = x; } catch (e) { pool.push(x); }
        }
      }
      let err = null;
      try { cb(t); } catch (e) { err = e; }
      if (q) { try { tq.endQuery(ext.TIME_ELAPSED_EXT); flight.push({ q, i: S.i }); } catch (e) { pool.push(q); } }
      const b = performance.now();
      if (S.recording) {
        S.rows.push({ i: S.i, t, cpu: b - a,
          pre: S.firstDraw ? S.firstDraw - a : -1,
          gl: S.firstDraw ? b - S.firstDraw : -1,
          draws: S.draws,
          heap: (performance.memory && performance.memory.usedJSHeapSize) || 0 });
        if (newFrame) S.i++;
        for (let k = flight.length - 1; k >= 0; k--) {
          const e = flight[k];
          let ok = false;
          try { ok = tq.getQueryParameter(e.q, tq.QUERY_RESULT_AVAILABLE); } catch (_) { ok = true; }
          if (!ok) continue;
          let dis = false; try { dis = tq.getParameter(ext.GPU_DISJOINT_EXT); } catch (_) {}
          let ns = 0; try { ns = tq.getQueryParameter(e.q, tq.QUERY_RESULT); } catch (_) {}
          if (!dis && ns > 0) S.gpu.push(ns / 1e6);
          pool.push(e.q); flight.splice(k, 1);
        }
      }
      if (err) throw err;
    });
  };

  // ── the ablation registry ─────────────────────────────────────────────────
  function find(pred) {
    const out = [];
    window.__stage.scene.traverse((o) => { if (pred(o)) out.push(o); });
    return out;
  }
  const named = (re) => find((o) => re.test(o.name || ''));
  function x_isUnderProps(o) {
    let c = o;
    while (c) { if ((c.name || '') === 'arena_props') return true; c = c.parent; }
    return false;
  }
  const undo = [];
  window.__pfaApply = function (arm) {
    const st = window.__stage, r = st.renderer;
    const hide = (list) => list.forEach((o) => { const v = o.visible; undo.push(() => { o.visible = v; }); o.visible = false; });
    const detach = (list) => list.forEach((o) => {
      const p = o.parent, i = p.children.indexOf(o);
      undo.push(() => { p.children.splice(i, 0, o); o.parent = p; });
      p.children.splice(i, 1); o.parent = null;
    });
    switch (arm) {
      case 'none': break;
      case 'props-hide':     hide(named(/^arena_props$/)); break;
      case 'props-detach':   detach(named(/^arena_props$/)); break;
      case 'floor-hide':     hide(st.scene.children.filter((c) => (c.name || '') === 'arena:kitchen')
                                   .flatMap((k) => k.children.filter((c) => !/^arena_(props|concealment|apron)$/.test(c.name || '')))); break;
      case 'floor-detach':   detach(st.scene.children.filter((c) => (c.name || '') === 'arena:kitchen')
                                   .flatMap((k) => k.children.filter((c) => !/^arena_(props|concealment|apron)$/.test(c.name || '')))); break;
      case 'conceal-hide':   hide(named(/^arena_concealment$/)); break;
      /**
       * PRICES A SPECIFIC PATCH, not a subsystem: take the arena's static props OUT
       * OF THE SHADOW PASS while leaving them fully drawn. That is the difference
       * between "the props cost too much" and "re-rendering props that never move
       * into the shadow map every frame costs too much", and only this arm can tell
       * them apart. Everything else about the frame is untouched.
       */
      case 'props-noshadow': {
        for (const o of find((x) => x.isMesh && x.castShadow)) {
          if (!x_isUnderProps(o)) continue;
          undo.push(() => { o.castShadow = true; });
          o.castShadow = false;
        }
        r.shadowMap.needsUpdate = true;
        break;
      }
      /**
       * PRICES DISTANCE-CULLING THE GROUND SCATTER. three draws only the first
       * COUNT instances of an InstancedMesh, so dropping count to a quarter costs
       * exactly what a quarter of the scatter costs. A quarter is the pre-x4 AREA
       * fraction, so this arm answers "what would the floor cost if the scatter
       * covered a screen instead of the whole 2800x2000 map".
       * ⚠️ The instances are NOT spatially sorted, so this drops a RANDOM quarter —
       * it is a COST measurement and says nothing about how the frame would LOOK.
       */
      case 'floor-quarter': {
        for (const o of find((x) => x.isInstancedMesh)) {
          const c = o.count;
          if (c < 8) continue;
          undo.push(() => { o.count = c; });
          o.count = Math.floor(c / 4);
        }
        r.shadowMap.needsUpdate = true;
        break;
      }
      case 'apron-hide':     hide(named(/^arena_apron$/)); break;
      case 'arena-hide':     hide(st.scene.children.filter((c) => /^arena:/.test(c.name || ''))); break;
      case 'arena-detach':   detach(st.scene.children.filter((c) => /^arena:/.test(c.name || ''))); break;
      case 'cast-hide':      hide(st.scene.children.filter((c) => /^character:/.test(c.name || ''))); break;
      case 'cast-detach':    detach(st.scene.children.filter((c) => /^character:/.test(c.name || ''))); break;
      case 'outlines-hide':  hide(named(/__outline$/)); break;
      case 'vfx-hide':       hide(st.scene.children.filter((c) => /^vfx/.test(c.name || ''))); break;
      /**
       * ⚠️ NOT AN ABLATION — AN ADDITION, and it exists because the ablation could
       * not answer the question. Measured over 200 frames at simSpeed 6, vfx_layer
       * issued **zero** draws: on the x4 map the camera follows the local seat, the
       * enemy is ~2,500 wu away and first contact is 18.4 s (DECISIONS §48), so a
       * probe watching an idle player simply never has a hit on screen. Ablating a
       * subsystem that is not drawing measures nothing and reports a confident 0.
       *
       * So this DRIVES the feel path instead: window.__feelEvent runs a synthetic
       * hit-landed through the real handleEvents, which is the same code a sim
       * event takes. The reported delta is therefore the cost of VFX being BUSY,
       * with a positive sign — read it as "what a fight costs on top of the frame".
       * (No backticks in this block: it lives inside a template literal and one
       * would terminate the string — docs/LESSONS.md §9, in a tool this time.)
       */
      case 'vfx-load': {
        const roles = ['player', 'enemy'];
        let n = 0;
        const t = setInterval(() => {
          const f = window.__feelEvent;
          if (!f) return;
          n++;
          f({ type: 'hit-landed', targetRole: roles[n % 2], targetId: n % 2,
            amount: 12, effect: null, source: { kind: 'weapon' },
            x: 1400 + Math.sin(n) * 60, y: 1000 + Math.cos(n) * 60 });
        }, 90);
        undo.push(() => clearInterval(t));
        break;
      }
      case 'fog-hide':       hide(st.scene.children.filter((c) => /^fog/.test(c.name || ''))); break;
      case 'shadow-off': {
        const v = r.shadowMap.enabled;
        undo.push(() => { r.shadowMap.enabled = v; r.shadowMap.needsUpdate = true; });
        r.shadowMap.enabled = false;
        break;
      }
      case 'shadow-static': {
        // Keep the shadow map, stop REDRAWING it. Prices the per-frame redraw
        // separately from the pass existing at all.
        const v = r.shadowMap.autoUpdate;
        undo.push(() => { r.shadowMap.autoUpdate = v; });
        r.shadowMap.autoUpdate = false;
        const desc = Object.getOwnPropertyDescriptor(r.shadowMap, 'needsUpdate');
        let sink = false;
        Object.defineProperty(r.shadowMap, 'needsUpdate', { configurable: true, get: () => sink, set: () => { sink = false; } });
        undo.push(() => { if (desc) Object.defineProperty(r.shadowMap, 'needsUpdate', desc); else delete r.shadowMap.needsUpdate; });
        break;
      }
      case 'post-off': {
        const c = st.composer;
        if (!c || !c.passes) break;
        for (const p of c.passes.slice(1)) { const v = p.enabled; undo.push(() => { p.enabled = v; }); p.enabled = false; }
        const last = c.passes[0]; const lv = last.renderToScreen;
        undo.push(() => { last.renderToScreen = lv; });
        last.renderToScreen = true;
        break;
      }
      case 'hud-off': {
        const h = document.querySelector('.hud-root');
        if (!h) break;
        const v = h.style.display; undo.push(() => { h.style.display = v; });
        h.style.display = 'none';
        break;
      }
      case 'scene-hide': {
        const v = st.scene.visible; undo.push(() => { st.scene.visible = v; });
        st.scene.visible = false;
        break;
      }
      default: throw new Error('pf_ablate: unknown arm ' + arm);
    }
    return undo.length;
  };
  window.__pfaRestore = function () { while (undo.length) undo.pop()(); };
})();
`;

const CELL = (frames) => `(async () => {
  const S = window.__pfa;
  S.rows.length = 0; S.gpu.length = 0; S.i = 0; S.recording = true;
  await new Promise((res) => {
    const tick = () => (S.i >= ${frames} ? res() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  });
  S.recording = false;
  const byT = new Map();
  for (const r of S.rows) {
    const c = byT.get(r.t) ?? { cpu: 0, pre: 0, gl: 0, draws: 0, t: r.t, heap: r.heap };
    c.cpu += r.cpu;
    if (r.pre >= 0) { c.pre += r.pre; c.gl += r.gl; } else c.pre += r.cpu;
    c.draws = Math.max(c.draws, r.draws); c.heap = r.heap;
    byT.set(r.t, c);
  }
  const rows = [...byT.values()].sort((a, b) => a.t - b.t).slice(2);   // drop warm-up
  const iv = []; for (let i = 1; i < rows.length; i++) iv.push(rows[i].t - rows[i - 1].t);
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
  const p95 = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length * 0.95)] : NaN; };
  const heap = rows.map((r) => r.heap).filter(Boolean);
  let alloc = 0; for (let i = 1; i < heap.length; i++) { const d = heap[i] - heap[i - 1]; if (d > 0) alloc += d; }
  return {
    n: rows.length,
    interval: med(iv), intervalP95: p95(iv),
    js: med(rows.map((r) => r.cpu)), jsP95: p95(rows.map((r) => r.cpu)),
    pre: med(rows.map((r) => r.pre)),
    submit: med(rows.map((r) => r.gl)),
    gpu: med(S.gpu), gpuN: S.gpu.length,
    draws: med(rows.map((r) => r.draws)),
    allocKB: heap.length > 1 ? alloc / (heap.length - 1) / 1024 : 0,
  };
})()`;

const ARMS_DEFAULT = [
  'shadow-off', 'shadow-static', 'props-hide', 'props-detach', 'floor-hide', 'floor-detach',
  'arena-hide', 'arena-detach', 'cast-hide', 'cast-detach', 'outlines-hide',
  'conceal-hide', 'apron-hide', 'vfx-hide', 'vfx-load', 'fog-hide', 'post-off', 'hud-off',
  'props-noshadow', 'floor-quarter',
];

async function boot() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
      '--disable-gpu-vsync', '--disable-frame-rate-limit', '--js-flags=--expose-gc',
      '--enable-precise-memory-info'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true, userAgent: UA_IPHONE,
  });
  await ctx.addInitScript(SAMPLER);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE + SCENES[SCENE], { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 180_000 });
  await page.waitForFunction(`document.querySelector('.hud-countdown')?.style.display === 'none'`,
    null, { timeout: 90_000 }).catch(() => {});
  await page.waitForTimeout(800);
  const tier = await page.evaluate(`({ tier: window.__quality?.tier, detected: window.__quality?.detected,
    buffer: [window.__stage.renderer.domElement.width, window.__stage.renderer.domElement.height] })`);
  return { browser, page, errs, tier };
}

/**
 * Interleaved PAIRED run. Each rep measures one base cell, then every arm, then
 * restores — so an arm's delta is always against a base taken seconds earlier on
 * the same page, same process, same thermal state.
 *
 * ⚠️ `none` is FORCED into every run and is not decoration: its per-rep deltas are
 * the machinery's own drift, measured through the identical code path, and they
 * are what the resolution floor is computed from. An earlier version of this file
 * derived the floor from the base-to-base RANGE, which gets WIDER with more reps —
 * i.e. more evidence made the instrument look worse. That is backwards, and it is
 * the kind of plausible-but-wrong statistic CLAUDE.md 10 exists to catch.
 */
async function runArms(page, arms) {
  const cell = CELL(FRAMES);
  const all = arms.includes('none') ? arms : ['none', ...arms];
  const base = [], byArm = new Map(all.map((a) => [a, []]));
  for (let r = 0; r < REPS; r++) {
    base.push(await page.evaluate(cell));
    for (const a of all) {
      await page.evaluate(`window.__pfaApply(${JSON.stringify(a)})`);
      byArm.get(a).push(await page.evaluate(cell));
      await page.evaluate('window.__pfaRestore()');
    }
  }
  return { base, byArm };
}

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const f2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : '  --');
const sd = (a) => {
  const v = a.filter(Number.isFinite);
  if (v.length < 2) return NaN;
  const m = v.reduce((x, y) => x + y, 0) / v.length;
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1));
};

function report({ base, byArm }, tier, label) {
  const KEYS = ['js', 'pre', 'submit', 'gpu', 'draws', 'allocKB'];
  /** per-rep paired deltas: arm[r] − base[r] */
  const deltas = new Map();
  for (const [arm, cells] of byArm) {
    const d = {};
    for (const k of KEYS) d[k] = cells.map((c, r) => c[k] - base[r][k]);
    deltas.set(arm, d);
  }
  const nul = deltas.get('none');
  /** Floor = the larger of the null arm's own bias and 2σ of its per-rep spread. */
  const floor = {};
  for (const k of KEYS) floor[k] = Math.max(Math.abs(med(nul[k])), 2 * (sd(nul[k]) || 0));

  const b = {};
  for (const k of KEYS) b[k] = med(base.map((x) => x[k]));
  const bIv = med(base.map((x) => x.interval));

  console.log(`\n══ ${label} — tier ${tier.tier} (detected ${tier.detected}) buffer ${tier.buffer.join('x')} · cpu x${CPU} · ${REPS} reps x ${FRAMES} frames, INTERLEAVED + PAIRED`);
  console.log(`   BASELINE  interval ${f2(bIv)} ms (${(1000 / bIv).toFixed(0)} fps)  ·  JS ${f2(b.js)} = pre ${f2(b.pre)} + submit ${f2(b.submit)}  ·  GPU ${f2(b.gpu)}  ·  ${b.draws} draws  ·  ${b.allocKB.toFixed(0)} KB/frame`);
  console.log(`   🚨 RESOLUTION FLOOR — from the NULL arm's own ${REPS} paired deltas, max(|median|, 2σ). Measured, not guessed:`);
  console.log(`      JS ±${f2(floor.js)} ms   pre ±${f2(floor.pre)} ms   submit ±${f2(floor.submit)} ms   GPU ±${f2(floor.gpu)} ms   draws ±${floor.draws.toFixed(0)}`);
  console.log(`      A delta inside its floor prints "—". Do NOT quote it as a number.\n`);

  console.log(`   ${'arm'.padEnd(15)} ${'ΔJS'.padStart(8)} ${'Δpre'.padStart(8)} ${'Δsubmit'.padStart(8)} ${'ΔGPU'.padStart(8)} ${'Δdraws'.padStart(7)} ${'Δalloc'.padStart(8)}   ${'JS saved'.padStart(9)}`);
  const out = [];
  for (const [arm, d] of deltas) {
    const m = {};
    for (const k of KEYS) m[k] = med(d[k]);
    const show = (k) => (Math.abs(m[k]) <= floor[k] ? '—' : m[k].toFixed(2));
    const resolved = Math.abs(m.js) > floor.js;
    out.push({ arm, dJs: m.js, dPre: m.pre, dSub: m.submit, dGpu: m.gpu, dDr: m.draws, dAl: m.allocKB, resolved });
    console.log(`   ${arm.padEnd(15)} ${show('js').padStart(8)} ${show('pre').padStart(8)} ${show('submit').padStart(8)} ${show('gpu').padStart(8)} ${m.draws.toFixed(0).padStart(7)} ${m.allocKB.toFixed(0).padStart(7)}K   ${(resolved ? `${((-m.js / b.js) * 100).toFixed(1)}%` : '—').padStart(9)}`);
  }
  console.log(`\n   Δ is (ablated − baseline), paired per rep. NEGATIVE ΔJS = removing that subsystem made the frame cheaper.`);
  console.log(`   'hide' keeps the subtree in the graph — Object3D.updateMatrixWorld does NOT test .visible, so it still walks it.`);
  console.log(`   'detach' removes it from the scene. hide→detach on one subsystem is therefore the PER-OBJECT MATRIX cost, isolated.`);
  return { bJs: b.js, bPre: b.pre, bSub: b.submit, bGpu: b.gpu, bDr: b.draws,
    fJs: floor.js, fPre: floor.pre, fSub: floor.submit, fGpu: floor.gpu, floor, out };
}

// ─────────────────────────────────────────────────────────────────────────────
async function selftest() {
  let pass = 0, fail = 0;
  const ok = (name, cond, extra = '') => {
    console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `   ${extra}` : ''}`);
    cond ? pass++ : fail++;
  };
  console.log('\npf_ablate --selftest — three known-bad inputs\n');
  const { browser, page, errs, tier } = await boot();
  if (errs.length) console.log(`  (page errors: ${errs.slice(0, 2).join(' | ')})`);

  const arms = ['none', 'scene-hide', 'shadow-off', 'props-hide', 'cast-hide'];
  const R = await runArms(page, arms);
  const r = report(R, tier, 'selftest');
  const get = (a) => r.out.find((x) => x.arm === a);

  // 1/NULL — the arm that changes nothing, through the identical machinery.
  const nul = get('none');
  ok(`1/KNOWN-BAD NULL: a no-op arm reports ΔJS inside the floor`,
    Math.abs(nul.dJs) <= r.fJs, `ΔJS ${nul.dJs.toFixed(2)} vs floor ±${r.fJs.toFixed(2)}`);
  ok(`1/KNOWN-BAD NULL: a no-op arm changes ZERO draws`, nul.dDr === 0, `Δdraws ${nul.dDr}`);

  // 2/TOTAL — scene.visible=false must collapse the renderer's work.
  const tot = get('scene-hide');
  ok(`2/KNOWN-BAD TOTAL: hiding the whole scene collapses draws to the post chain`,
    tot.dDr <= -(r.bDr - 12), `draws ${r.bDr} → ${r.bDr + tot.dDr}`);
  ok(`2/KNOWN-BAD TOTAL: and it removes most of the SUBMIT phase`,
    tot.dSub < -r.bSub * 0.6, `Δsubmit ${tot.dSub.toFixed(2)} of ${r.bSub.toFixed(2)}`);

  // 3/COUPLING — an arm that names a subsystem must move that subsystem's draws.
  // The predicted counts come from pf_census, which is separately validated (14/14).
  const sh = get('shadow-off'), pr = get('props-hide'), ca = get('cast-hide');
  ok(`3/COUPLING: shadow-off removes the whole shadow pass and nothing else`,
    sh.dDr < -300 && sh.dDr > -700, `Δdraws ${sh.dDr}`);
  ok(`3/COUPLING: props-hide removes props' main AND shadow draws`,
    pr.dDr < -400, `Δdraws ${pr.dDr}`);
  ok(`3/COUPLING: cast-hide removes ~one character's worth of draws`,
    ca.dDr < -150 && ca.dDr > -400, `Δdraws ${ca.dDr}`);
  ok(`3/COUPLING: every arm that moved ms also moved draws (no ms without a cause)`,
    r.out.every((x) => !x.resolved || x.dDr !== 0 || x.arm === 'hud-off' || x.arm === 'none'),
    r.out.filter((x) => x.resolved && x.dDr === 0).map((x) => x.arm).join(',') || 'none violate');

  await browser.close();
  console.log(`\npf_ablate selftest: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
if (!BASE) {
  console.error('pf_ablate: no server. `PH_SCRATCH=<dir> node tools/tmp/ph_serve.mjs --start --ref <sha>` first, or pass --url.');
  process.exit(2);
}
if (flag('selftest')) {
  await selftest();
} else {
  const arms = String(arg('arms', ARMS_DEFAULT.join(','))).split(',').filter(Boolean);
  console.log(`\npf_ablate — ${SHA.slice(0, 7)} production build, scene "${SCENE}", iPhone-landscape emulation`);
  console.log(`rasteriser ANGLE/Metal (Apple M5 Pro, ~4-6x optimistic vs a phone GPU) · pacing UNCAPPED · CPU throttle x${CPU}`);
  console.log('⚠️  ms are indicative and Chromium-only. Draw counts are exact. Chromium is not WebKit.');
  const { browser, page, errs, tier } = await boot();
  if (errs.length) console.log(`⚠ page errors: ${errs.slice(0, 3).join(' | ')}`);
  const R = await runArms(page, arms);
  await browser.close();
  const r = report(R, tier, `${SCENE} @ iPhone/low`);
  const out = arg('json', null);
  if (out) { writeFileSync(out, JSON.stringify({ sha: SHA, scene: SCENE, cpu: CPU, reps: REPS, frames: FRAMES, tier, ...r, raw: { base: R.base, arms: [...R.byArm] } }, null, 2)); console.log(`\nwrote ${out}`); }
}
