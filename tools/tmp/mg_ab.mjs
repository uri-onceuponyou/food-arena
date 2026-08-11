#!/usr/bin/env node
/**
 * mg_ab.mjs — WHAT STATIC BATCHING COSTS/SAVES, paired, inside ONE bundle.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  READ THIS BEFORE QUOTING A MILLISECOND
 * ═══════════════════════════════════════════════════════════════════════════
 * `pf_ablate.mjs` measures a subsystem by MUTATING a live page — hide it, detach
 * it, measure the difference in the same page. That is the right instrument for
 * "what does this subsystem cost", and it is not available for "what does this
 * PATCH cost", because a patch is a different build.
 *
 * The two ways to A/B a build are both bad on their own:
 *   * two processes, two bundles — `tools/perf.mjs`'s documented run-to-run spread
 *     is median 5-16% / max 22-26%, and a 30% effect is not safely visible in that;
 *   * one process, two bundles — the second bundle's numbers are contaminated by
 *     whatever the first left in the GPU driver and the JS heap.
 *
 * So the patch ships with a RUNTIME SWITCH (`?merge=0`, `arena/kitchen.ts`), one
 * bundle serves both arms, and this interleaves them page-load by page-load in ONE
 * browser: A, B, A, B, … The reported number is the **paired median difference**
 * over those pairs, and the **resolution floor is measured, not guessed** — from a
 * NULL run of (A, A) pairs through the identical machinery, as max(|median|, 2σ).
 * Any delta inside that floor prints "—" instead of a number.
 *
 * ⚠️ A PAGE RELOAD IS A NOISIER PAIRING THAN `pf_ablate`'S IN-PAGE MUTATION, and
 * the floor printed here is correspondingly wider. That is the honest price of
 * measuring a build rather than a subtree; do not compare this tool's floor to
 * `pf_ablate`'s and conclude anything about either.
 *
 * ── WHAT IS EXACT AND WHAT IS NOT ───────────────────────────────────────────
 *   EXACT — draw calls per frame, triangles per frame, object and drawable counts.
 *     They are integers read off the renderer and the graph and they do not move
 *     between runs. Quote them as-is and SEPARATELY from any timing.
 *   NOT EXACT — every millisecond. Chromium/ANGLE-on-Metal on an M5 Pro is the
 *     right GPU family as an iPhone and roughly 4-6x optimistic; CDP CPU throttling
 *     is a uniform script slowdown that models neither a small cache nor little
 *     cores; and Chromium is not WebKit.
 *
 * ── VALIDATION (`--selftest`) ───────────────────────────────────────────────
 * A guard not shown to FAIL on the bug it guards against is not a guard
 * (CLAUDE.md 6). Three known-bad inputs:
 *   1. NULL-HOLDS — the floor is derived from one set of (A,A) pairs and then a
 *      SECOND, INDEPENDENT set of (A,A) pairs must land inside it. Deriving the
 *      floor from the same samples it judges is circular and would always pass.
 *   2. THROTTLE-MOVES — the same URL at CPU x4 against CPU x8 must land FAR
 *      outside the floor and in the POSITIVE direction. An instrument that cannot
 *      see a 2x slowdown cannot see a 30% one, and one that reports it with the
 *      wrong sign is subtracting the wrong way round.
 *   3. GRAPH-COUPLING — the arm must be shown to have changed the SCENE, not just
 *      the timings: `merge=0` must carry >1,500 prop drawables and the default arm
 *      under 200. An arm whose milliseconds move while the graph does not is
 *      measuring something other than what it names.
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────
 *   MG_SCRATCH=<dir> node tools/tmp/mg_serve.mjs --start
 *   MG_SCRATCH=<dir> node tools/tmp/mg_ab.mjs [--reps 6] [--cpu 4] [--frames 180]
 *   MG_SCRATCH=<dir> node tools/tmp/mg_ab.mjs --selftest
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const flag = (k) => argv.includes(`--${k}`);

const SCRATCH = process.env.MG_SCRATCH ?? join(tmpdir(), 'fa-mg');
const STATE = join(SCRATCH, 'mg-serve.json');
function baseUrl() {
  const u = arg('url', null);
  if (u) return u;
  if (!existsSync(STATE)) {
    console.error('mg_ab: no mg_serve running. MG_SCRATCH=<dir> node tools/tmp/mg_serve.mjs --start');
    process.exit(2);
  }
  return JSON.parse(readFileSync(STATE, 'utf8')).url;
}

const MATCH = '/?player=hamburger&enemy=donut';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15'
  + ' (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

// ─────────────────────────────────────────────────────────────────────────────
// Page-side sampler. Wraps rAF and the GL draw entry points before the app exists.
// The shape is `pf_ablate.mjs`'s SAMPLER, which is the validated one; it is copied
// rather than imported because that tool is owned elsewhere this session.
//
// 🚨 NO BACKTICKS ANYWHERE BELOW, INCLUDING IN PROSE. This whole block is one JS
// template literal and a single backtick terminates it, with a parse error pointing
// at a word in a comment.
// ─────────────────────────────────────────────────────────────────────────────
const SAMPLER = `
(() => {
  const S = { rows: [], gpu: [], recording: false, i: 0, firstDraw: 0, draws: 0, lastT: -1, ctxs: [] };
  window.__mgab = S;

  for (const proto of [window.WebGLRenderingContext && WebGLRenderingContext.prototype,
                       window.WebGL2RenderingContext && WebGL2RenderingContext.prototype]) {
    if (!proto || proto.__mgabWrapped) continue;
    proto.__mgabWrapped = true;
    const mark = () => { if (S.firstDraw === 0) S.firstDraw = performance.now(); };
    for (const k of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const o = proto[k];
      if (!o) continue;
      proto[k] = function (...a) { mark(); S.draws++; return o.apply(this, a); };
    }
  }
  const oGC = HTMLCanvasElement.prototype.getContext;
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
      if (q) { try { tq.endQuery(ext.TIME_ELAPSED_EXT); flight.push({ q: q }); } catch (e) { pool.push(q); } }
      const b = performance.now();
      if (S.recording && newFrame) {
        S.rows.push({ cpu: b - a, pre: S.firstDraw ? S.firstDraw - a : -1,
          gl: S.firstDraw ? b - S.firstDraw : -1, draws: S.draws });
        S.i++;
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

  /** The graph facts, so a timing delta can be tied to a scene that really changed. */
  window.__mgGraph = function () {
    const st = (window.__stages ? [...window.__stages].find((s) => !s.offscreen) : null) || window.__stage;
    if (!st) return null;
    let objects = 0, meshes = 0, props = 0, propObjects = 0;
    st.scene.traverse((o) => {
      objects++; if (o.isMesh) meshes++;
      let c = o, inProps = false;
      while (c) { if (c.name === 'arena_props') { inProps = true; break; } c = c.parent; }
      if (inProps) { propObjects++; if (o.isMesh) props++; }
    });
    const r = st.renderer;
    return { objects: objects, meshes: meshes, propDrawables: props, propObjects: propObjects,
      tier: (window.__quality && window.__quality.tier) || null,
      detected: (window.__quality && window.__quality.detected) || null,
      buffer: [r.domElement.width, r.domElement.height],
      programs: r.info.programs ? r.info.programs.length : -1,
      memGeometries: r.info.memory.geometries, memTextures: r.info.memory.textures };
  };
})()`;

const median = (a) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mode = (a) => {
  const m = new Map();
  for (const v of a) m.set(v, (m.get(v) || 0) + 1);
  return [...m].sort((x, y) => y[1] - x[1])[0]?.[0] ?? NaN;
};

/** One cell: a fresh page on `suffix`, measured for `frames` animation frames. */
async function cell(ctx, url, suffix, { frames, cpu }) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  const cdp = await ctx.newCDPSession(page);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  try {
    await page.goto(url + MATCH + suffix, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction('window.__gameReady === true', null, { timeout: 180_000 });
    await page.waitForFunction(`document.querySelector('.hud-countdown')?.style.display === 'none'`,
      null, { timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(1200);            // let the first-frame shader compiles settle
    await page.evaluate('window.__mgab.rows.length = 0; window.__mgab.gpu.length = 0; window.__mgab.recording = true');
    await page.waitForFunction(`window.__mgab.rows.length >= ${frames}`, null, { timeout: 180_000 });
    // ONE evaluate, and it is LAST: page.evaluate() grants transient user activation.
    const out = await page.evaluate(`(() => {
      window.__mgab.recording = false;
      return { rows: window.__mgab.rows, gpu: window.__mgab.gpu, graph: window.__mgGraph() };
    })()`);
    const rows = out.rows.slice(20);            // drop the first 20: warm-up, not signal
    return {
      cpu: median(rows.map((r) => r.cpu)),
      pre: median(rows.map((r) => r.pre)),
      gl: median(rows.map((r) => r.gl)),
      draws: mode(rows.map((r) => r.draws)),
      gpu: median(out.gpu),
      graph: out.graph, errs, n: rows.length,
    };
  } finally {
    await page.close();
  }
}

/** `reps` interleaved (A,B) pairs. Returns per-pair deltas plus both cell lists. */
async function pairs(ctx, url, A, B, opts, reps) {
  const a = [], b = [];
  for (let i = 0; i < reps; i++) {
    // Alternate which arm goes first, so any warm/cold ordering bias cancels rather
    // than being attributed to whichever arm is always second.
    const first = i % 2 === 0;
    const x = first ? await cell(ctx, url, A.suffix, { ...opts, cpu: A.cpu ?? opts.cpu })
      : await cell(ctx, url, B.suffix, { ...opts, cpu: B.cpu ?? opts.cpu });
    const y = first ? await cell(ctx, url, B.suffix, { ...opts, cpu: B.cpu ?? opts.cpu })
      : await cell(ctx, url, A.suffix, { ...opts, cpu: A.cpu ?? opts.cpu });
    a.push(first ? x : y);
    b.push(first ? y : x);
  }
  return { a, b, d: a.map((x, i) => b[i].cpu - x.cpu) };
}

function floorOf(deltas) {
  const m = median(deltas);
  const mu = deltas.reduce((s, v) => s + v, 0) / deltas.length;
  const sd = Math.sqrt(deltas.reduce((s, v) => s + (v - mu) ** 2, 0) / Math.max(1, deltas.length - 1));
  return Math.max(Math.abs(m), 2 * sd);
}

async function launch(cpu) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true, userAgent: UA_IPHONE,
  });
  await ctx.addInitScript(SAMPLER);
  void cpu;
  return { browser, ctx };
}

async function main() {
  const url = baseUrl();
  const reps = Number(arg('reps', 6));
  const cpuRate = Number(arg('cpu', 4));
  const frames = Number(arg('frames', 140));
  const opts = { frames, cpu: cpuRate };
  const { browser, ctx } = await launch(cpuRate);
  try {
    console.log(`\n══ mg_ab — ${url}   cpu x${cpuRate} · ${frames} frames/cell · ${reps} pairs`);

    console.log('\n── floor: NULL pairs (default arm against itself) ─────────────────────────');
    const nul = await pairs(ctx, url, { suffix: '' }, { suffix: '' }, opts, reps);
    const fl = floorOf(nul.d);
    console.log(`   null deltas: ${nul.d.map((v) => v.toFixed(2)).join(', ')}`);
    console.log(`   median ${median(nul.d).toFixed(2)} ms  →  RESOLUTION FLOOR ±${fl.toFixed(2)} ms`);

    console.log('\n── arm: merge=0 (unbatched) against the default (batched) ────────────────');
    const ab = await pairs(ctx, url, { suffix: '' }, { suffix: '&merge=0' }, opts, reps);
    const dj = median(ab.d);
    const g0 = ab.a[0].graph, g1 = ab.b[0].graph;

    const row = (label, batched, unbatched, unit = '') => {
      const d = unbatched - batched;
      console.log(`   ${label.padEnd(22)} batched ${String(batched).padStart(9)}   unbatched ${String(unbatched).padStart(9)}   Δ ${(d > 0 ? '+' : '') + d}${unit}`);
    };
    console.log(`   tier ${g0.tier} (detected ${g0.detected}) · buffer ${g0.buffer.join('x')}`);
    row('scene objects', g0.objects, g1.objects);
    row('scene drawables', g0.meshes, g1.meshes);
    row('prop objects', g0.propObjects, g1.propObjects);
    row('prop drawables', g0.propDrawables, g1.propDrawables);
    row('GL programs', g0.programs, g1.programs);
    row('renderer geometries', g0.memGeometries, g1.memGeometries);
    row('renderer textures', g0.memTextures, g1.memTextures);

    const dA = mode(ab.a.map((c) => c.draws));
    const dB = mode(ab.b.map((c) => c.draws));
    console.log(`\n   DRAW CALLS/FRAME (exact)   batched ${dA}   unbatched ${dB}   Δ ${dB - dA}  (${((1 - dA / dB) * 100).toFixed(1)}% fewer)`);

    const fmt = (v) => (Math.abs(v) < fl ? `— (inside ±${fl.toFixed(2)})` : `${v > 0 ? '+' : ''}${v.toFixed(2)} ms`);
    console.log(`\n   MAIN-THREAD JS  batched ${median(ab.a.map((c) => c.cpu)).toFixed(2)} ms   unbatched ${median(ab.b.map((c) => c.cpu)).toFixed(2)} ms`);
    console.log(`   paired deltas (unbatched − batched): ${ab.d.map((v) => v.toFixed(2)).join(', ')}`);
    console.log(`   → BATCHING SAVES ${fmt(dj)} of ${median(ab.b.map((c) => c.cpu)).toFixed(2)} ms`
      + `  (${((dj / median(ab.b.map((c) => c.cpu))) * 100).toFixed(1)}%)`);
    console.log(`   pre-first-draw   batched ${median(ab.a.map((c) => c.pre)).toFixed(2)}   unbatched ${median(ab.b.map((c) => c.pre)).toFixed(2)}`);
    console.log(`   submit phase     batched ${median(ab.a.map((c) => c.gl)).toFixed(2)}   unbatched ${median(ab.b.map((c) => c.gl)).toFixed(2)}`);
    const gA = median(ab.a.map((c) => c.gpu)), gB = median(ab.b.map((c) => c.gpu));
    console.log(`   GPU (timer query) batched ${gA.toFixed(2)} ms   unbatched ${gB.toFixed(2)} ms   Δ ${(gA - gB > 0 ? '+' : '') + (gA - gB).toFixed(2)} ms on the batched side`);

    const errs = [...ab.a, ...ab.b].flatMap((c) => c.errs);
    if (errs.length) console.log(`\n   ⚠️ page errors: ${[...new Set(errs)].slice(0, 3).join(' | ')}`);
  } finally {
    await browser.close();
  }
}

async function selftest() {
  const url = baseUrl();
  const reps = Number(arg('reps', 4));
  const frames = Number(arg('frames', 120));
  const opts = { frames, cpu: 4 };
  const { browser, ctx } = await launch(4);
  let pass = 0, fail = 0;
  const check = (n, ok, d) => { console.log(`   ${ok ? 'PASS' : '🚨 FAIL'}  ${n}${d ? '  — ' + d : ''}`); ok ? pass++ : fail++; };
  try {
    console.log('\n══ mg_ab --selftest ══');
    const n1 = await pairs(ctx, url, { suffix: '' }, { suffix: '' }, opts, reps);
    const fl = floorOf(n1.d);
    const n2 = await pairs(ctx, url, { suffix: '' }, { suffix: '' }, opts, reps);
    check('1. NULL-HOLDS: an independent null run lands inside the derived floor',
      Math.abs(median(n2.d)) <= fl, `floor ±${fl.toFixed(2)}, second null median ${median(n2.d).toFixed(2)}`);

    const th = await pairs(ctx, url, { suffix: '', cpu: 4 }, { suffix: '', cpu: 8 }, opts, reps);
    const dt = median(th.d);
    check('2. THROTTLE-MOVES: cpu x8 is far slower than x4, with the right sign',
      dt > fl * 3, `Δ ${dt.toFixed(2)} ms against a floor of ±${fl.toFixed(2)}`);

    const a = await cell(ctx, url, '', opts);
    const b = await cell(ctx, url, '&merge=0', opts);
    check('3. GRAPH-COUPLING: the arm really changes the scene graph',
      b.graph.propDrawables > 1500 && a.graph.propDrawables < 200,
      `batched ${a.graph.propDrawables} prop drawables, unbatched ${b.graph.propDrawables}`);

    console.log(`\n   ${pass}/${pass + fail} selftests pass`);
    if (fail) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

const IS_MAIN = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (IS_MAIN) {
  (flag('selftest') ? selftest() : main()).catch((e) => { console.error(e); process.exit(1); });
}
