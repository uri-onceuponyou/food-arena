#!/usr/bin/env node
/**
 * ph_frame.mjs — WHAT A FRAME COSTS UNDER PHONE CONSTRAINTS, and where the cost is.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  READ THIS BEFORE QUOTING ANY MILLISECOND FROM THIS TOOL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `tools/perf.mjs` refuses to report frame time, and its reason is correct AS WRITTEN:
 * every tool in this repo launches Chromium with `--use-angle=swiftshader`, a CPU
 * rasteriser, so "9-10 fps" is a property of the harness. That reason has been quoted
 * as "frame time cannot be measured in this repo" (`src/render/quality.ts:21`,
 * `docs/LESSONS.md` §10) for the whole life of the project.
 *
 * **It is a property of the FLAG, not of the machine.** `tools/tmp/ph_gpu.mjs` probes
 * four launch configurations on this box and three of them return:
 *
 *     ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Pro)   timerQuery: true
 *
 * — a real GPU, in headless, with `EXT_disjoint_timer_query_webgl2` available. So this
 * tool measures GPU time, and it is the first thing here that ever has.
 *
 * ── WHAT THAT NUMBER IS AND IS NOT ──────────────────────────────────────────
 * An M5 Pro is a 20-core Apple GPU. An iPhone 15/16 is a 5-6 core Apple GPU of the
 * SAME FAMILY: tile-based deferred rendering, on-chip tile memory, hidden-surface
 * removal, the same bandwidth-first cost model. That is why this is worth doing and
 * SwiftShader never was — SwiftShader has none of those properties, so it cannot even
 * rank two passes correctly.
 *
 * 🚨 It is still **not a phone**, and every ms below is labelled:
 *   * GPU ms here is roughly **4-6x optimistic** on core count alone, before thermal
 *     throttling, before the ~4-5x memory-bandwidth gap, and before iOS's WebKit
 *     (Safari is not Chromium; its ANGLE-on-Metal path is similar but not identical).
 *   * CPU ms is throttled with CDP `Emulation.setCPUThrottlingRate`, which is a
 *     uniform slowdown of script execution. It does not model a small cache, a weaker
 *     branch predictor, or the little cores a phone will actually schedule you onto.
 *   * DEVICE-INDEPENDENT and quotable as-is: draw calls, triangles, programs, texture
 *     bytes, drawing-buffer pixels, bytes allocated per frame, GC count, which tier
 *     `auto` selects, and every RATIO between two arms measured in the same run.
 *
 * ── The phase split, and why it is legitimate ───────────────────────────────
 * `GameSession.loop` (`src/game/match.ts:1207`) does everything in one rAF callback and
 * `this.stage.render(...)` is the LAST statement. So inside a frame the first GL draw
 * call is an exact fence: everything before it is sim + events + audio + model updates
 * + VFX + HUD DOM writes; everything after it is the renderer. The tool records the
 * timestamp of the first draw of each frame and splits there. No estimation.
 *
 * ── Usage ───────────────────────────────────────────────────────────────────
 *   node tools/tmp/ph_serve.mjs --start --ref <sha>      # once
 *   node tools/tmp/ph_frame.mjs                          # default sweep
 *   node tools/tmp/ph_frame.mjs --scene match --cpu 1,4,6 --tier auto,low,medium,high
 *   node tools/tmp/ph_frame.mjs --swiftshader            # the control: prove the flag
 *   node tools/tmp/ph_frame.mjs --vsync                  # 60Hz pacing instead of uncapped
 *   node tools/tmp/ph_frame.mjs --json out.json
 *
 * ⚠️ Default is UNCAPPED (`--disable-gpu-vsync --disable-frame-rate-limit`). That is
 * deliberate: with vsync on, every frame that fits in the budget reads 16.7 ms and the
 * only thing you learn is "it fit". Uncapped, the frame interval IS the cost. `--vsync`
 * switches to real pacing, which is the right mode for a JANK question (how many frames
 * MISS 16.7 ms) and the wrong one for a cost question.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const flag = (k) => argv.includes(`--${k}`);

// Session scratchpads are cleaned; `docs/AGENT-BRIEF.md` opens with a brief that
// silently vanished from one. So the state path is durable by default and the
// scratchpad is opt-in via PH_SCRATCH.
const SCRATCH = process.env.PH_SCRATCH ?? join(tmpdir(), 'fa-ph');
const STATE = join(SCRATCH, 'ph-serve.json');
const BASE = arg('url', null)
  ?? process.env.PREVIEW_BASE
  ?? (existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')).url : null);
if (!BASE) { console.error('ph_frame: no server. Run `node tools/tmp/ph_serve.mjs --start` first.'); process.exit(2); }
const SHA = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')).sha : 'unknown';

const SCENES = {
  // hamburger throws patties and donut fires — projectiles and impacts in every
  // sample. ⚠️ NOT `match-vfx`, which `perf.mjs` pins to `player=lollipop`: lollipop
  // has NO ranged weapon, so that scene samples a frame with zero projectiles.
  match: '/?player=hamburger&enemy=donut',
  'match-fast': '/?player=hamburger&enemy=donut&simSpeed=6',
  home: '/?screen=home',
  characters: '/?screen=characters',
};
const SCENE = arg('scene', 'match');
const CPUS = String(arg('cpu', '1,4')).split(',').map(Number);
const TIERS = String(arg('tier', 'auto')).split(',');
const FRAMES = Number(arg('frames', 400));
const VSYNC = flag('vsync');
const SWIFT = flag('swiftshader');
const JSON_OUT = arg('json', null);

// iPhone 14/15-class landscape. 844x390 CSS at DPR 3 is what `perf.mjs --device mobile`
// already uses for its counts, kept identical so the two are comparable.
const VW = Number(arg('w', 844));
const VH = Number(arg('h', 390));
const DSF = Number(arg('dpr', 3));
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15'
  + ' (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const GPU_ARGS = SWIFT
  ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const PACE_ARGS = VSYNC ? [] : ['--disable-gpu-vsync', '--disable-frame-rate-limit'];

// ─────────────────────────────────────────────────────────────────────────────
// The page-side sampler.
//
// Installed with addInitScript so it wraps rAF and the GL prototypes BEFORE the app
// exists. Everything it records is a number pushed into a preallocated array; there is
// exactly ONE `page.evaluate` per cell and it is LAST (`docs/AGENT-BRIEF.md` §3 —
// `page.evaluate()` grants transient user activation, so an early read hands the app a
// gesture it never received).
// ─────────────────────────────────────────────────────────────────────────────
const SAMPLER = `
(() => {
  const S = {
    frames: [],            // one row per animation frame
    gpu: [],               // {frame, ms} resolved TIME_ELAPSED_EXT queries
    longTasks: [],
    gcDrops: 0,
    ctxs: [],
    programsLinked: 0, shadersCompiled: 0, linkMs: 0,
    firstDrawAt: 0, drawsThisFrame: 0, trisThisFrame: 0,
    recording: false,
    frameIndex: 0,
  };
  window.__ph = S;

  // ── GL wrappers: cheap. A counter and one conditional timestamp. ────────────
  for (const proto of [window.WebGLRenderingContext && WebGLRenderingContext.prototype,
                       window.WebGL2RenderingContext && WebGL2RenderingContext.prototype]) {
    if (!proto || proto.__phWrapped) continue;
    proto.__phWrapped = true;
    const mark = () => { if (S.firstDrawAt === 0) S.firstDrawAt = performance.now(); };
    const oDE = proto.drawElements;
    proto.drawElements = function (m, c, t, o) { mark(); S.drawsThisFrame++; if (m === 4) S.trisThisFrame += c / 3; return oDE.call(this, m, c, t, o); };
    const oDA = proto.drawArrays;
    proto.drawArrays = function (m, f, c) { mark(); S.drawsThisFrame++; if (m === 4) S.trisThisFrame += c / 3; return oDA.call(this, m, f, c); };
    if (proto.drawElementsInstanced) {
      const o = proto.drawElementsInstanced;
      proto.drawElementsInstanced = function (m, c, t, off, n) { mark(); S.drawsThisFrame++; if (m === 4) S.trisThisFrame += (c / 3) * n; return o.call(this, m, c, t, off, n); };
    }
    if (proto.drawArraysInstanced) {
      const o = proto.drawArraysInstanced;
      proto.drawArraysInstanced = function (m, f, c, n) { mark(); S.drawsThisFrame++; if (m === 4) S.trisThisFrame += (c / 3) * n; return o.call(this, m, f, c, n); };
    }
    const oLP = proto.linkProgram;
    proto.linkProgram = function (p) { S.programsLinked++; const a = performance.now(); const r = oLP.call(this, p); S.linkMs += performance.now() - a; return r; };
    const oCS = proto.compileShader;
    proto.compileShader = function (s) { S.shadersCompiled++; return oCS.call(this, s); };
  }

  const oGC = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    const gl = oGC.call(this, type, attrs);
    if (gl && /webgl/.test(type)) S.ctxs.push(gl);
    return gl;
  };

  // ── GPU timing. One TIME_ELAPSED query may be active at a time, so this runs on
  //    exactly one context: the one with the biggest drawing buffer, which on any
  //    match route is the Stage's canvas (thumbs.ts's generator host is 448px).
  let tq = null, ext = null, qPool = [], inFlight = [];
  function pickCtx() {
    let best = null, bestPx = 0;
    for (const gl of S.ctxs) {
      if (gl.isContextLost && gl.isContextLost()) continue;
      const px = (gl.drawingBufferWidth || 0) * (gl.drawingBufferHeight || 0);
      if (px > bestPx) { bestPx = px; best = gl; }
    }
    return best;
  }

  // ── rAF wrapper. Callbacks scheduled for the same frame share \`t\`, so a frame's
  //    total main-thread cost is the sum over its rows; the match loop is the max.
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) {
    return raf(function (t) {
      const t0 = performance.now();
      S.firstDrawAt = 0; S.drawsThisFrame = 0; S.trisThisFrame = 0;
      let started = false;
      if (S.recording) {
        if (!tq) {
          const gl = pickCtx();
          if (gl && gl.createQuery) {
            ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
            if (ext) { tq = gl; for (let i = 0; i < 6; i++) qPool.push(gl.createQuery()); }
            else { tq = 'none'; }
          }
        }
        if (tq && tq !== 'none' && qPool.length) {
          const q = qPool.pop();
          try { tq.beginQuery(ext.TIME_ELAPSED_EXT, q); started = q; } catch (e) { qPool.push(q); }
        }
      }
      let err = null;
      try { cb(t); } catch (e) { err = e; }
      if (started) { try { tq.endQuery(ext.TIME_ELAPSED_EXT); inFlight.push({ q: started, frame: S.frameIndex }); } catch (e) { qPool.push(started); } }
      const t1 = performance.now();
      if (S.recording) {
        S.frames.push({
          i: S.frameIndex, t, cpu: t1 - t0,
          pre: S.firstDrawAt ? S.firstDrawAt - t0 : -1,
          gl: S.firstDrawAt ? t1 - S.firstDrawAt : -1,
          draws: S.drawsThisFrame, tris: S.trisThisFrame,
          heap: (performance.memory && performance.memory.usedJSHeapSize) || 0,
        });
        S.frameIndex++;
        // Drain finished GPU queries.
        for (let i = inFlight.length - 1; i >= 0; i--) {
          const e = inFlight[i];
          let avail = false;
          try { avail = tq.getQueryParameter(e.q, tq.QUERY_RESULT_AVAILABLE); } catch (_) { avail = true; }
          if (!avail) continue;
          let disjoint = false;
          try { disjoint = tq.getParameter(ext.GPU_DISJOINT_EXT); } catch (_) {}
          let ns = 0;
          try { ns = tq.getQueryParameter(e.q, tq.QUERY_RESULT); } catch (_) {}
          if (!disjoint && ns > 0) S.gpu.push({ frame: e.frame, ms: ns / 1e6 });
          qPool.push(e.q);
          inFlight.splice(i, 1);
        }
      }
      if (err) throw err;
    });
  };

  try {
    new PerformanceObserver((l) => {
      if (!S.recording) return;
      for (const e of l.getEntries()) S.longTasks.push({ start: e.startTime, ms: e.duration });
    }).observe({ entryTypes: ['longtask'] });
  } catch (e) { /* not supported */ }
})();
`;

// ─────────────────────────────────────────────────────────────────────────────
const pct = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : NaN);
const f2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : ' -- ');

async function cell({ cpu, tier }) {
  const browser = await chromium.launch({
    headless: true,
    // `--enable-precise-memory-info`: without it `performance.memory` is bucketed to
    // 100 KB and refreshed at most every 20 ms, which reports 0.0 KB/frame for any
    // allocation rate a game actually has. Measured: 0.0 KB/frame before the flag.
    args: [...GPU_ARGS, ...PACE_ARGS, '--js-flags=--expose-gc', '--disable-gpu-sandbox',
      '--enable-precise-memory-info'],
  });
  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: DSF,
    isMobile: true,
    hasTouch: true,
    userAgent: UA,
  });
  await ctx.addInitScript(SAMPLER);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });

  const q = tier === 'auto' ? '' : (SCENES[SCENE].includes('?') ? `&tier=${tier}` : `?tier=${tier}`);
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 160)));

  const t0 = Date.now();
  await page.goto(BASE + SCENES[SCENE] + q, { waitUntil: 'domcontentloaded' });
  const ready = SCENE.startsWith('match') ? 'window.__gameReady === true'
    : `window.__screenReady === true`;
  await page.waitForFunction(ready, null, { timeout: 120_000 });
  const bootMs = Date.now() - t0;

  // The match opens on a countdown; sample the game, not the countdown.
  if (SCENE.startsWith('match')) {
    await page.waitForFunction(
      `document.querySelector('.hud-countdown')?.style.display === 'none'`,
      null, { timeout: 60_000 },
    ).catch(() => {});
  }
  await page.waitForTimeout(600);

  // Boot cost, read BEFORE recording so link time is not inside a frame sample.
  const boot = await page.evaluate(`({
    programsLinked: window.__ph.programsLinked,
    shadersCompiled: window.__ph.shadersCompiled,
    linkMs: window.__ph.linkMs,
    tier: (window.__quality && window.__quality.tier) || null,
    detected: (window.__quality && window.__quality.detected) || null,
    signals: (window.__quality && window.__quality.signals) || null,
    profile: (window.__quality && window.__quality.profile) || null,
    dpr: window.devicePixelRatio,
    buffer: (() => { const c = document.querySelector('canvas'); return c ? [c.width, c.height] : null; })(),
    css: (() => { const c = document.querySelector('canvas'); return c ? [c.clientWidth, c.clientHeight] : null; })(),
  })`);

  await page.evaluate(`window.__ph.recording = true; window.__ph.frames.length = 0; window.__ph.gpu.length = 0; window.__ph.longTasks.length = 0;`);
  // Wall-clock budget scales with the throttle so a 6x cell still gets its frames.
  await page.waitForFunction(`window.__ph.frames.length >= ${FRAMES}`, null,
    { timeout: 60_000 * Math.max(1, cpu) }).catch(() => {});
  const S = await page.evaluate(`({
    frames: window.__ph.frames, gpu: window.__ph.gpu, longTasks: window.__ph.longTasks,
  })`);
  await browser.close();

  // ── Fold. Rows sharing an rAF timestamp are ONE frame. ─────────────────────
  const byT = new Map();
  for (const r of S.frames) {
    const k = r.t;
    const cur = byT.get(k) ?? { cpu: 0, pre: 0, gl: 0, draws: 0, tris: 0, heap: r.heap, t: k };
    cur.cpu += r.cpu;
    if (r.pre >= 0) { cur.pre += r.pre; cur.gl += r.gl; }
    else cur.pre += r.cpu;
    cur.draws += r.draws; cur.tris += r.tris; cur.heap = r.heap;
    byT.set(k, cur);
  }
  const rows = [...byT.values()].sort((a, b) => a.t - b.t);
  // Frame INTERVAL from consecutive rAF timestamps. Drop the first: it straddles the
  // moment recording turned on.
  const iv = [];
  for (let i = 2; i < rows.length; i++) iv.push(rows[i].t - rows[i - 1].t);

  const heap = rows.map((r) => r.heap).filter(Boolean);
  let alloc = 0; let gc = 0;
  for (let i = 1; i < heap.length; i++) {
    const d = heap[i] - heap[i - 1];
    if (d >= 0) alloc += d; else gc++;
  }

  const s = (a) => [...a].sort((x, y) => x - y);
  const cpuS = s(rows.map((r) => r.cpu));
  const preS = s(rows.map((r) => r.pre));
  const glS = s(rows.map((r) => r.gl));
  const ivS = s(iv);
  const gpuS = s(S.gpu.map((g) => g.ms));

  return {
    cpu, tier, bootMs, pageErrors, boot,
    n: rows.length,
    draws: rows.length ? rows.map((r) => r.draws).reduce((a, b) => a + b, 0) / rows.length : 0,
    tris: rows.length ? rows.map((r) => r.tris).reduce((a, b) => a + b, 0) / rows.length : 0,
    interval: { p50: pct(ivS, 0.5), p95: pct(ivS, 0.95), p99: pct(ivS, 0.99), max: ivS[ivS.length - 1] },
    js: { p50: pct(cpuS, 0.5), p95: pct(cpuS, 0.95), p99: pct(cpuS, 0.99), max: cpuS[cpuS.length - 1] },
    pre: { p50: pct(preS, 0.5), p95: pct(preS, 0.95) },
    glsubmit: { p50: pct(glS, 0.5), p95: pct(glS, 0.95) },
    gpu: { n: gpuS.length, p50: pct(gpuS, 0.5), p95: pct(gpuS, 0.95), p99: pct(gpuS, 0.99), max: gpuS[gpuS.length - 1] },
    allocPerFrame: heap.length > 1 ? alloc / (heap.length - 1) : 0,
    gcEvents: gc,
    longTasks: S.longTasks.length,
    longTaskMax: S.longTasks.length ? Math.max(...S.longTasks.map((t) => t.ms)) : 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
const results = [];
console.log(`\nph_frame — ${SHA.slice(0, 7)} production build, scene "${SCENE}", ${VW}x${VH} CSS @ DPR ${DSF}`);
console.log(`rasteriser: ${SWIFT ? 'SwiftShader (CONTROL)' : 'ANGLE/Metal — Apple M5 Pro'}   pacing: ${VSYNC ? 'vsync 60Hz' : 'UNCAPPED'}`);
console.log('⚠️  Chromium mobile EMULATION, not a device. ms are indicative; counts are exact.\n');

for (const tier of TIERS) {
  for (const c of CPUS) {
    const r = await cell({ cpu: c, tier });
    results.push(r);
    console.log(`── tier ${String(r.boot.tier).padEnd(6)} (asked "${tier}")  cpu x${c}   n=${r.n} frames`);
    console.log(`   buffer ${r.boot.buffer?.join('x')} px (css ${r.boot.css?.join('x')}, dpr ${r.boot.dpr}, cap ${r.boot.profile?.pixelRatioCap})`);
    console.log(`   draws/frame ${r.draws.toFixed(0)}   tris/frame ${(r.tris / 1000).toFixed(1)}k   programs ${r.boot.programsLinked}   boot ${r.bootMs} ms`);
    console.log(`   frame interval  p50 ${f2(r.interval.p50)}  p95 ${f2(r.interval.p95)}  p99 ${f2(r.interval.p99)}  max ${f2(r.interval.max)} ms   (${(1000 / r.interval.p50).toFixed(0)} fps at p50)`);
    console.log(`   JS main thread  p50 ${f2(r.js.p50)}  p95 ${f2(r.js.p95)}  p99 ${f2(r.js.p99)}  max ${f2(r.js.max)} ms`);
    console.log(`     ├─ sim+VFX+HUD (before first draw)   p50 ${f2(r.pre.p50)}  p95 ${f2(r.pre.p95)} ms`);
    console.log(`     └─ renderer submit (draw → return)   p50 ${f2(r.glsubmit.p50)}  p95 ${f2(r.glsubmit.p95)} ms`);
    console.log(`   GPU (Metal timer)  n=${r.gpu.n}  p50 ${f2(r.gpu.p50)}  p95 ${f2(r.gpu.p95)}  p99 ${f2(r.gpu.p99)}  max ${f2(r.gpu.max)} ms`);
    console.log(`   alloc ${(r.allocPerFrame / 1024).toFixed(1)} KB/frame   GC drops ${r.gcEvents}   longtasks ${r.longTasks} (max ${f2(r.longTaskMax)} ms)`);
    if (r.pageErrors.length) console.log(`   ⚠ page errors: ${r.pageErrors.slice(0, 3).join(' | ')}`);
    console.log('');
  }
}

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({ sha: SHA, scene: SCENE, vw: VW, vh: VH, dsf: DSF, vsync: VSYNC, swiftshader: SWIFT, results }, null, 2));
  console.log(`wrote ${JSON_OUT}`);
}
