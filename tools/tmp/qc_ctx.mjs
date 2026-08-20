#!/usr/bin/env node
/**
 * qc_ctx — WebGL CONTEXT CENSUS across a real navigation loop, on an emulated iPhone.
 *
 * ── The question ────────────────────────────────────────────────────────────────
 * Uri, on an iPhone 15 Pro against the deployed bundle: *"slight regression in VFX
 * quality. home screen, and more specifically character screen seems like the
 * resolution is slightly lower, or something else changed."*
 *
 * `CLAUDE.md` rule 4's eighteenth case is the reason this file exists: a RESTORED
 * WebGL context came back **15.65 luma darker, permanently, while looking entirely
 * plausible**. Every `Stage` here is its own context; browsers cap live contexts and
 * kill the OLDEST past the cap. So the question is not "is it there" but **"is it the
 * SAME?"**, and the only honest way to ask that is a ROUND TRIP — navigate away and
 * back the way a player does — with a DRIFT CONTROL licensing every number.
 *
 * ── What is measured, in order, and why each step is here ───────────────────────
 *   0  ENVIRONMENT. Tier, DPR, screen short edge, drawing buffer. Printed first
 *      because everything below is worthless if the emulation did not land on the
 *      device it claims (`quality.ts:detectTier` reads `screen.width`, not the
 *      viewport, and a probe that gets that wrong measures a desktop).
 *   1  DRIFT CONTROL (SELF-PAIR). Capture the character screen twice with nothing
 *      in between. **Must be EXACTLY 0 differing pixels.** If it is not, no later
 *      diff means anything and this tool says so instead of quoting one.
 *   2  KNOWN-BAD. Force a REAL context loss with `WEBGL_lose_context` and restore it,
 *      then diff. The census must SEE the lost/restored pair and the pixel diff must
 *      be NON-ZERO. `CLAUDE.md` rule 6: an instrument not shown to FAIL on the defect
 *      it detects is not an instrument. Without this step step 1 returning 0 and step
 *      3 returning 0 are indistinguishable from a probe that cannot see anything.
 *   3  THE LOOP. home -> characters -> home -> match -> home -> characters, xN, the
 *      way a player actually moves. Contexts created / live / lost, DOM canvases, the
 *      char screen's drawing buffer, and `window.__glLog` after every step.
 *   4  ROUND-TRIP IDENTITY. The character screen captured on visit 1 and visit N,
 *      diffed. Only quoted if step 1 returned 0.
 *
 * ── THE CLOCK, AND WHY IT IS VIRTUAL ────────────────────────────────────────────
 * `charStage.ts:update()` accrues `this.elapsed += dt` and drives BOTH a turntable
 * sway (`rig.yawDeg = sin(elapsed*0.42)*22`) and the model's idle pose off it. Two
 * visits therefore land at different animation phases and a raw pixel diff is
 * meaningless. `shell.ts:431` computes `dt` from the **rAF timestamp**, so this
 * installs a virtual clock: `requestAnimationFrame` still services on the real one,
 * but the timestamp handed to the callback only advances while a BURST is armed.
 *
 *   * default: the clock is frozen, so `elapsed` stays 0 for every instance ever
 *     created, by construction. Nothing is "settled to" — it is never started.
 *   * `armBurst(k)`: the next k serviced frames advance 1/60 s each. Every visit is
 *     therefore captured at `elapsed = k/60` EXACTLY, on a fresh instance or an old
 *     one, which is what makes visit 1 and visit N comparable at all.
 *   * k defaults to 30 (0.5 s), chosen because `charStage`'s entrance pop is 0.34 s:
 *     a smaller k captures the model mid-pop at `rotation.y = -0.9`.
 *
 * ⚠️ A frozen rAF is NOT a frozen page — CSS animations run on the document timeline
 * (`docs/AGENT-BRIEF.md` §3). That is exactly what the self-pair in step 1 is for: if
 * a keyframe is still running it shows up there as a non-zero drift control and this
 * tool refuses rather than quoting a contaminated number.
 *
 * ── SwiftShader is NOT a phone ──────────────────────────────────────────────────
 * Every pixel below is a software rasteriser's. That is fine for an A/B (same
 * instrument in both arms) and worthless as an absolute claim about Uri's screen.
 * The COUNTS (contexts, canvases, drawing-buffer dimensions, tier) are hardware
 * independent and are the numbers this tool is actually for.
 *
 *   node tools/tmp/qc_ctx.mjs --url http://localhost:5188
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-qc -- node tools/tmp/qc_ctx.mjs --url {URL}
 *
 * Flags: --rounds N (default 2) · --burst K (default 30) · --shots DIR · --json FILE
 *        --selftest  (validates the differ's LOGIC against synthetic buffers)
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const has = (k) => a.includes(k);
const base = get('--url', process.env.PREVIEW_BASE || '').replace(/\/$/, '');
const ROUNDS = Number(get('--rounds', '2'));
const BURST = Number(get('--burst', '30'));
const SHOTS = get('--shots', 'tools/tmp/qc_shots');
const JSONOUT = get('--json', null);

// iPhone 15 Pro, the device in the report. 393x852 CSS at DPR 3.
const DEV = { width: 393, height: 852, dpr: 3 };

const HMR_STUB = 'const noop=()=>{};export const createHotContext=()=>({accept:noop,'
  + 'acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,'
  + 'decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;'
  + 'export const removeStyle=noop;export const ErrorOverlay=class{};export default {};';

// ─────────────────────────────────────────────────────────────────────────────
// The differ. Two PNG buffers -> differing pixel count + mean luma of each.
//
// EXACT, deliberately: no tolerance, no threshold. `CLAUDE.md` rule 4 — the answer
// to "is it the SAME?" is a drift control and a zero, never a guessed tolerance.
// ─────────────────────────────────────────────────────────────────────────────
async function raw(buf) {
  const r = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: r.data, w: r.info.width, h: r.info.height, ch: r.info.channels };
}
async function diffPng(bufA, bufB) {
  const A = await raw(bufA);
  const B = await raw(bufB);
  if (A.w !== B.w || A.h !== B.h) {
    return { sizeMismatch: `${A.w}x${A.h} vs ${B.w}x${B.h}`, diffPx: -1 };
  }
  let diffPx = 0;
  let maxChan = 0;
  let sumA = 0;
  let sumB = 0;
  const n = A.w * A.h;
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    const dr = Math.abs(A.data[o] - B.data[o]);
    const dg = Math.abs(A.data[o + 1] - B.data[o + 1]);
    const db = Math.abs(A.data[o + 2] - B.data[o + 2]);
    if (dr || dg || db) { diffPx++; maxChan = Math.max(maxChan, dr, dg, db); }
    sumA += 0.2126 * A.data[o] + 0.7152 * A.data[o + 1] + 0.0722 * A.data[o + 2];
    sumB += 0.2126 * B.data[o] + 0.7152 * B.data[o + 1] + 0.0722 * B.data[o + 2];
  }
  return {
    w: A.w, h: A.h, px: n, diffPx, maxChan,
    diffPct: +((diffPx / n) * 100).toFixed(4),
    lumaA: +(sumA / n).toFixed(3),
    lumaB: +(sumB / n).toFixed(3),
    lumaDelta: +((sumB - sumA) / n).toFixed(3),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// --selftest: the differ's LOGIC, against synthetic inputs.
//
// ⚠️ `CLAUDE.md` rule 6: this validates the LOGIC and NEVER validates where the tool
// is POINTED. The thing that validates the pointing is step 2's forced context loss,
// which runs against the real app and must move real pixels.
// ─────────────────────────────────────────────────────────────────────────────
async function makePng(w, h, fill) {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: fill[0], g: fill[1], b: fill[2] } } })
    .png({ compressionLevel: 0 }).toBuffer();
}
async function selftest() {
  let ok = 0;
  let bad = 0;
  const t = (cond, label, detail = '') => {
    if (cond) { ok++; console.log(`  PASS  ${label} ${detail}`); }
    else { bad++; console.log(`  FAIL  ${label} ${detail}`); }
  };
  const grey = await makePng(8, 8, [100, 100, 100]);
  const grey2 = await makePng(8, 8, [100, 100, 100]);
  const darker = await makePng(8, 8, [90, 100, 100]);
  const big = await makePng(9, 8, [100, 100, 100]);
  const oneStep = await makePng(8, 8, [101, 100, 100]);

  console.log('\n── §A identical inputs read EXACTLY zero ──');
  const d0 = await diffPng(grey, grey2);
  t(d0.diffPx === 0, 'identical -> diffPx 0', `got ${d0.diffPx}`);
  t(d0.lumaDelta === 0, 'identical -> lumaDelta 0', `got ${d0.lumaDelta}`);

  console.log('\n── §B a KNOWN difference is SEEN (the arm that makes §A mean anything) ──');
  const d1 = await diffPng(grey, darker);
  t(d1.diffPx === 64, 'one channel -10 on every px -> all 64 px differ', `got ${d1.diffPx}`);
  t(d1.maxChan === 10, 'maxChan reports the real magnitude', `got ${d1.maxChan}`);
  t(Math.abs(d1.lumaDelta + 2.126) < 0.001, 'lumaDelta signed and correct', `got ${d1.lumaDelta}`);

  console.log('\n── §C a ONE-STEP difference is not rounded away ──');
  const d2 = await diffPng(grey, oneStep);
  t(d2.diffPx === 64, 'a 1/255 change on every pixel is seen', `got ${d2.diffPx}`);

  console.log('\n── §D a size mismatch REFUSES rather than silently comparing ──');
  const d3 = await diffPng(grey, big);
  t(d3.diffPx === -1 && !!d3.sizeMismatch, 'different dimensions -> refusal', d3.sizeMismatch ?? '');

  console.log(`\n  selftest: ${ok} pass, ${bad} fail`);
  return bad === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// The in-page instrument. One string, installed with `addInitScript` so it is in
// place BEFORE any module runs and therefore before the first Stage is built.
//
// `docs/AGENT-BRIEF.md` §3: `page.evaluate()` grants transient user activation, so
// everything here is page-side bookkeeping written by the page itself; Node only
// reads it, and only at the end of a step.
// ─────────────────────────────────────────────────────────────────────────────
const INSTRUMENT = `(() => {
  const Q = {
    // Every context ever created, in creation order. \`lost\` and \`restored\` are
    // written by listeners on the canvas, not inferred.
    contexts: [],
    // A mirror of \`window.__glLog\`'s events, kept separately because \`stage.ts\`
    // caps its own log at 24 entries and a long loop can overflow it.
    events: [],
    // Virtual clock. \`vt\` is the timestamp handed to every rAF callback.
    vt: 0, burst: 0, frames: 0, serviced: 0,
  };
  window.__qc = Q;

  // ── context census ────────────────────────────────────────────────────────
  const oGC = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = oGC.call(this, type, ...rest);
    try {
      if (/webgl/.test(String(type)) && ctx) {
        // getContext is idempotent per canvas+type: a second call returns the SAME
        // context and must NOT be counted twice, or the census invents a leak.
        if (!this.__qcId) {
          const entry = { id: Q.contexts.length + 1, type: String(type), lost: 0, restored: 0,
                          createdAt: performance.now(), w: this.width, h: this.height };
          this.__qcId = entry.id;
          Q.contexts.push(entry);
          this.addEventListener('webglcontextlost', () => {
            entry.lost++;
            Q.events.push({ t: performance.now(), id: entry.id, type: 'lost',
                            size: this.width + 'x' + this.height });
          }, false);
          this.addEventListener('webglcontextrestored', () => {
            entry.restored++;
            Q.events.push({ t: performance.now(), id: entry.id, type: 'restored',
                            size: this.width + 'x' + this.height });
          }, false);
        }
      }
    } catch (e) { /* never break the app to measure it */ }
    return ctx;
  };

  // ── virtual clock ─────────────────────────────────────────────────────────
  // \`shell.ts:431\` derives dt from the rAF TIMESTAMP. Freezing the timestamp
  // freezes every dt-driven animation in the app without stopping the loop, so
  // rendering, resizing and thumbnail generation all still run.
  const realRAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) {
    return realRAF(() => {
      Q.serviced++;
      if (Q.burst > 0) { Q.vt += 1000 / 60; Q.burst--; Q.frames++; }
      cb(Q.vt);
    });
  };
})();`;

/** What the page can tell us about itself at a given moment. Read-only. */
const READ_STATE = `(() => {
  const Q = window.__qc || { contexts: [], events: [] };
  const live = Q.contexts.filter((c) => c.lost > c.restored);
  const stages = (window.__stages || []).filter((s) => !s.disposed);
  const onScreen = stages.filter((s) => !s.offscreen);
  const st = window.__stage || null;
  const canvases = [...document.querySelectorAll('canvas')];
  return {
    screen: window.__screen ?? null,
    ctxCreated: Q.contexts.length,
    ctxLostNow: live.length,
    ctxEverLost: Q.contexts.filter((c) => c.lost > 0).length,
    ctxEverRestored: Q.contexts.filter((c) => c.restored > 0).length,
    // A context is RELEASED by \`forceContextLoss()\`, which fires \`webglcontextlost\`
    // and is never followed by a restore. So "still holding a GPU context" is
    // "created and never lost".
    ctxHeld: Q.contexts.filter((c) => c.lost === 0).length,
    events: Q.events.slice(),
    glLog: (window.__glLog || []).slice(),
    stagesAlive: stages.length,
    stagesOnScreen: onScreen.length,
    canvasesInDom: canvases.filter((c) => c.isConnected).length,
    canvasesTotal: canvases.length,
    frames: Q.frames, serviced: Q.serviced, vt: Q.vt,
    tier: window.__renderTier ?? null,
    dpr: window.devicePixelRatio,
    screenEdge: Math.min(window.screen?.width ?? 0, window.screen?.height ?? 0),
    stage: st ? {
      pixelRatio: st.renderer.getPixelRatio(),
      bufW: st.canvas.width, bufH: st.canvas.height,
      cssW: Math.round(st.canvas.getBoundingClientRect().width),
      cssH: Math.round(st.canvas.getBoundingClientRect().height),
      contextLost: st.contextLost === true,
      pitchDeg: st.rig?.pitchDeg ?? null,
      yawDeg: +(st.rig?.yawDeg ?? 0).toFixed(6),
    } : null,
  };
})()`;

// ─────────────────────────────────────────────────────────────────────────────
let PASS = 0;
let FAIL = 0;
const failures = [];
function ok(cond, label, detail = '') {
  if (cond) { PASS++; console.log(`  PASS  ${label}${detail ? `   ${detail}` : ''}`); }
  else { FAIL++; failures.push(`${label} ${detail}`); console.log(`  FAIL  ${label}${detail ? `   ${detail}` : ''}`); }
  return cond;
}
const head = (s) => console.log(`\n── ${s} ${'─'.repeat(Math.max(0, 68 - s.length))}`);

async function main() {
  if (has("--selftest")) { process.exit((await selftest()) ? 0 : 1); }
  if (!base) { console.error('qc_ctx: no --url and no PREVIEW_BASE. Refusing to guess.'); process.exit(2); }
  await mkdir(SHOTS, { recursive: true });

  const settle = await import('./settle.mjs');
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const out = { base, device: DEV, burst: BURST, rounds: ROUNDS, steps: [], checks: [] };
  const page = await browser.newPage({
    viewport: { width: DEV.width, height: DEV.height },
    deviceScaleFactor: DEV.dpr,
    hasTouch: true,
    isMobile: true,
  });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript', body: HMR_STUB,
  }));
  await page.addInitScript(INSTRUMENT);

  const read = () => page.evaluate(READ_STATE);
  /** Advance the virtual clock by exactly k frames, page-side, and wait for it. */
  const advance = async (k) => {
    await page.evaluate((n) => { window.__qc.burst = n; }, k);
    await page.waitForFunction(() => window.__qc.burst === 0, null, { timeout: 60_000 });
    // One more serviced frame so the LAST advanced frame has actually been drawn.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  };
  /**
   * STILL THE CSS.
   *
   * 🚨 A FROZEN rAF IS NOT A FROZEN PAGE. CSS animations run on the DOCUMENT
   * timeline, so the virtual clock above does nothing to them, and the first run of
   * this tool measured the cost exactly: the self-pair drift control read **609,208
   * px of 3,013,524 (20.22%)** with the WebGL panel already pinned. The diff map
   * (`qc_diffmap.mjs`) showed the whole of it was DOM: a rotating radial sunburst on
   * the page background, the FIGHT button's pulse, and a shine sweep on three roster
   * tiles. The 3D portrait panel was black in that map, i.e. already stable.
   *
   * ⚠️ `animation: none`, NOT the `animation-play-state: paused` that six other tools
   * in `tools/tmp` use. `paused` freezes each animation at WHATEVER PHASE IT HAD
   * REACHED, which is fine for a self-pair taken 200 ms apart and WRONG for the
   * comparison this tool exists to make — visit 1 against visit N, minutes and a
   * match apart, would each be paused at a different phase and the diff would be
   * animation, reported as drift. `none` snaps every element to its un-animated base
   * style, which is the same style on every visit by construction.
   */
  const stillCss = () => page.addStyleTag({
    content: '*,*::before,*::after{animation:none!important;transition:none!important;}',
  }).catch(() => {});
  const shot = async (name) => {
    const buf = await page.screenshot({ timeout: 180_000 });
    await writeFile(`${SHOTS}/${name}.png`, buf);
    return buf;
  };
  /** The 3D panel alone — immune to every piece of DOM chrome around it. */
  const canvasRect = () => page.evaluate(() => {
    const st = window.__stage;
    if (!st) return null;
    const r = st.canvas.getBoundingClientRect();
    const d = window.devicePixelRatio;
    return {
      left: Math.round(r.left * d), top: Math.round(r.top * d),
      width: Math.round(r.width * d), height: Math.round(r.height * d),
    };
  });
  const cropCanvas = async (buf, rect) => {
    if (!rect || rect.width < 2 || rect.height < 2) return null;
    return sharp(buf).extract(rect).png().toBuffer();
  };

  try {
    // ── 0 ENVIRONMENT ────────────────────────────────────────────────────────
    head('0  ENVIRONMENT — did the emulation land on the device it claims?');
    await page.goto(`${base}/?screen=home`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await settle.settleScreen(page, { label: 'home', timeout: 180_000 }).catch((e) => {
      console.log(`  (settle soft-failed: ${e.message.slice(0, 120)})`);
    });
    let s = await read();
    console.log(`  tier=${s.tier}  dpr=${s.dpr}  screen short edge=${s.screenEdge} CSS px`);
    console.log(`  stage: buffer ${s.stage?.bufW}x${s.stage?.bufH}  css ${s.stage?.cssW}x${s.stage?.cssH}`
      + `  pixelRatio ${s.stage?.pixelRatio}  pitch ${s.stage?.pitchDeg}`);
    ok(s.dpr === DEV.dpr, 'devicePixelRatio is the device\'s', `${s.dpr}`);
    ok(s.screenEdge > 0 && s.screenEdge <= 500,
      'screen short edge reads as a PHONE (quality.ts reads screen.width, not the viewport)',
      `${s.screenEdge}`);
    ok(s.tier === 'low', 'detectTier() lands on `low`, i.e. what Uri\'s device gets', `${s.tier}`);
    out.env = s;

    // ── 1 DRIFT CONTROL ──────────────────────────────────────────────────────
    head('1  DRIFT CONTROL (self-pair) — nothing may move when nothing happens');
    await page.evaluate(() => window.__shell.navigate({ name: 'characters' }));
    await page.waitForFunction('window.__screenReady === true', null, { timeout: 120_000 });
    await settle.waitForRoster(page, { timeout: 600_000 }).catch((e) => {
      console.log(`  (roster wait soft-failed: ${String(e.message).slice(0, 140)})`);
    });
    await settle.settleScreen(page, { label: 'characters', timeout: 180_000 }).catch(() => {});
    await stillCss();
    await advance(BURST);
    const rect1 = await canvasRect();
    console.log(`  3D panel rect (device px): ${JSON.stringify(rect1)}`);
    const c1a = await shot('01-chars-visit1-a');
    const c1b = await shot('01-chars-visit1-b');
    const drift = await diffPng(c1a, c1b);
    out.drift = drift;
    console.log(`  self-pair PAGE : ${drift.diffPx} px of ${drift.px} differ  (${drift.diffPct}%)`
      + `  maxChan ${drift.maxChan}  luma ${drift.lumaA} -> ${drift.lumaB}`);
    const p1a = await cropCanvas(c1a, rect1);
    const p1b = await cropCanvas(c1b, rect1);
    const driftPanel = p1a && p1b ? await diffPng(p1a, p1b) : null;
    if (driftPanel) {
      await writeFile(`${SHOTS}/01-panel-visit1.png`, p1a);
      console.log(`  self-pair PANEL: ${driftPanel.diffPx} px of ${driftPanel.px} differ`
        + `  (${driftPanel.diffPct}%)  maxChan ${driftPanel.maxChan}`
        + `  luma ${driftPanel.lumaA} -> ${driftPanel.lumaB}`);
      out.driftPanel = driftPanel;
    }
    ok(drift.diffPx === 0,
      'self-pair PAGE is EXACTLY 0 differing px', `${drift.diffPx} px`);
    // The panel is the arm that licenses the round-trip number this tool is FOR.
    // The page arm is reported either way, because a page that will not sit still is
    // itself worth knowing about, but it is not what gates step 4.
    const driftClean = ok(!!driftPanel && driftPanel.diffPx === 0,
      'self-pair PANEL (the 3D character stage) is EXACTLY 0 differing px'
      + ' — this is what licenses the round-trip diff',
      driftPanel ? `${driftPanel.diffPx} px` : 'no canvas rect');
    const s1 = await read();
    console.log(`  clock: vt=${s1.vt.toFixed(2)}ms frames=${s1.frames} yawDeg=${s1.stage?.yawDeg}`);
    out.steps.push({ label: 'characters visit 1', ...s1 });

    // ── 2 KNOWN-BAD ──────────────────────────────────────────────────────────
    head('2  KNOWN-BAD — a REAL forced context loss must be SEEN and must move pixels');
    const before = c1b;
    const lossRes = await page.evaluate(async () => {
      const st = window.__stage;
      const gl = st.renderer.getContext();
      const ext = gl.getExtension('WEBGL_lose_context');
      if (!ext) return { ok: false, why: 'no WEBGL_lose_context extension' };
      ext.loseContext();
      await new Promise((r) => setTimeout(r, 400));
      const lostSeen = st.contextLost === true;
      ext.restoreContext();
      await new Promise((r) => setTimeout(r, 2500));
      return { ok: true, lostSeen, restoredSeen: st.contextLost === false };
    });
    if (lossRes.ok) {
      await advance(0);
      const afterFull = await shot('02-chars-after-forced-loss');
      const after = (await cropCanvas(afterFull, rect1)) ?? afterFull;
      const kb = await diffPng((await cropCanvas(before, rect1)) ?? before, after);
      out.knownBad = { ...lossRes, diff: kb };
      const s2 = await read();
      console.log(`  census after forced loss: everLost=${s2.ctxEverLost} everRestored=${s2.ctxEverRestored}`
        + `  events=${JSON.stringify(s2.events.map((e) => e.type))}`);
      console.log(`  pixels: ${kb.diffPx} px differ (${kb.diffPct}%)  maxChan ${kb.maxChan}`
        + `  luma ${kb.lumaA} -> ${kb.lumaB} (delta ${kb.lumaDelta})`);
      ok(s2.ctxEverLost >= 1, 'the census SEES a real context loss', `${s2.ctxEverLost}`);
      ok(s2.ctxEverRestored >= 1, 'the census SEES the restore', `${s2.ctxEverRestored}`);
      ok(lossRes.lostSeen, 'the app itself noticed (`Stage.contextLost` went true)');
      // The pixel arm is the one that proves the DIFFER is pointed at the thing that
      // changes. A restore that repaired perfectly would legitimately read 0 here —
      // which is why this is reported, not asserted, and why the census arms above
      // are the ones that must pass.
      console.log(kb.diffPx === 0
        ? '  NOTE  the restore was pixel-perfect: the differ is exercised by the census arms, not this one'
        : `  NOTE  the restore moved ${kb.diffPx} px — the differ demonstrably sees a restore`);
      out.checks.push({ step: 'known-bad', diffPx: kb.diffPx });
    } else {
      ok(false, 'forced context loss available', lossRes.why);
    }

    // ── 2b POINTING ──────────────────────────────────────────────────────────
    // 🚨 `--selftest` VALIDATES LOGIC AND NEVER VALIDATES WHERE A TOOL IS POINTED
    // (`CLAUDE.md` rule 6). Step 2's pixel arm came back 0 — the restore really is
    // pixel-perfect here — which means the ONLY on-app evidence that the crop is
    // aimed at the 3D stage would otherwise be two zeros, and two zeros are exactly
    // what a crop aimed at a static margin returns. So: advance the virtual clock a
    // few frames. The turntable sway is a function of `elapsed`, so the panel MUST
    // move. If it does not, this crop is looking at nothing and every 0 above is
    // vacuous.
    head('2b POINTING — the crop must SEE the 3D stage move when the clock advances');
    const beforeNudge = await shot('02b-before-nudge');
    await advance(12);
    const afterNudge = await shot('02b-after-nudge');
    const nudgePanel = await diffPng(
      (await cropCanvas(beforeNudge, rect1)) ?? beforeNudge,
      (await cropCanvas(afterNudge, rect1)) ?? afterNudge,
    );
    const yawAfter = (await read()).stage?.yawDeg;
    console.log(`  yawDeg ${s1.stage?.yawDeg} -> ${yawAfter} after 12 frames`);
    console.log(`  PANEL moved ${nudgePanel.diffPx} px of ${nudgePanel.px} (${nudgePanel.diffPct}%)`);
    ok(nudgePanel.diffPx > 0,
      'the panel crop is POINTED at the 3D stage — a clock nudge moves it',
      `${nudgePanel.diffPx} px`);
    // Put the clock back where step 1 captured it, so step 4 compares like with like.
    // The clock only ever moves forward, so this reaches the SAME phase by going
    // round: sin has period 2pi/0.42 = 14.96 s. Cheaper and exact: navigate away and
    // back, which destroys the instance and resets `elapsed` to 0 — which is what
    // step 3 does anyway.
    out.pointing = nudgePanel;

    // ── 3 THE LOOP ───────────────────────────────────────────────────────────
    head('3  THE LOOP — home -> characters -> home -> match -> home -> characters');
    const nav = async (route, label, extra) => {
      await page.evaluate((r) => window.__shell.navigate(r), route);
      await page.waitForFunction('window.__screenReady === true', null, { timeout: 180_000 });
      if (extra) await page.waitForFunction(extra, null, { timeout: 300_000 }).catch(() => {});
      await settle.settleScreen(page, { label, timeout: 180_000 }).catch(() => {});
      await page.waitForTimeout(400);
      const st = await read();
      out.steps.push({ label, ...st });
      console.log(`  ${label.padEnd(26)} ctx created ${String(st.ctxCreated).padStart(3)}`
        + `  held ${String(st.ctxHeld).padStart(2)}  lostNow ${String(st.ctxLostNow).padStart(2)}`
        + `  canvasDOM ${String(st.canvasesInDom).padStart(2)}  stages ${st.stagesAlive}`
        + `  buf ${st.stage ? `${st.stage.bufW}x${st.stage.bufH}@${st.stage.pixelRatio}` : '-'}`);
      return st;
    };

    const visits = [];
    for (let r = 0; r < ROUNDS; r++) {
      await nav({ name: 'home' }, `r${r} home`);
      await nav({ name: 'match', player: 'hamburger', enemy: 'donut' }, `r${r} match`,
        `document.querySelector('.hud-countdown')?.style.display === 'none'`);
      await nav({ name: 'home' }, `r${r} home (post-match)`);
      const v = await nav({ name: 'characters' }, `r${r} characters`,
        `window.__thumbsReady === true`);
      await settle.waitForRoster(page, { timeout: 600_000 }).catch(() => {});
      await stillCss();
      await advance(BURST);
      const rect = await canvasRect();
      const buf = await shot(`03-chars-round${r + 1}`);
      const panel = await cropCanvas(buf, rect);
      if (panel) await writeFile(`${SHOTS}/03-panel-round${r + 1}.png`, panel);
      console.log(`  round ${r + 1} panel rect: ${JSON.stringify(rect)}`);
      visits.push({ round: r + 1, state: await read(), buf, panel, rect });
    }

    // ── 4 ROUND-TRIP IDENTITY ────────────────────────────────────────────────
    head('4  ROUND-TRIP IDENTITY — the character screen, visit 1 vs the last visit');
    const last = visits[visits.length - 1];
    const rt = await diffPng(c1b, last.buf);
    out.roundTrip = rt;
    console.log(`  PAGE  visit 1 vs visit ${last.round}: ${rt.diffPx} px differ (${rt.diffPct}%)`
      + `  maxChan ${rt.maxChan}  luma ${rt.lumaA} -> ${rt.lumaB} (delta ${rt.lumaDelta})`);
    // ⚠️ THE PANEL RECT IS ITSELF A MEASUREMENT. If the 3D canvas comes back a
    // different SIZE, the differ refuses rather than comparing — and that refusal is
    // the finding, not a tool failure. Print both rects so the refusal is readable.
    console.log(`  panel rect visit 1: ${JSON.stringify(rect1)}`);
    console.log(`  panel rect visit ${last.round}: ${JSON.stringify(last.rect)}`);
    let rtPanel = null;
    if (last.panel && p1b) {
      rtPanel = await diffPng(p1b, last.panel);
      out.roundTripPanel = rtPanel;
      if (rtPanel.diffPx === -1) {
        console.log(`  PANEL visit 1 vs visit ${last.round}: SIZE MISMATCH ${rtPanel.sizeMismatch}`
          + '  <- the 3D stage came back at a DIFFERENT drawing size');
      } else {
        console.log(`  PANEL visit 1 vs visit ${last.round}: ${rtPanel.diffPx} px differ`
          + ` (${rtPanel.diffPct}%)  maxChan ${rtPanel.maxChan}`
          + `  luma ${rtPanel.lumaA} -> ${rtPanel.lumaB} (delta ${rtPanel.lumaDelta})`);
      }
    }
    console.log(`  clock at both: visit1 vt=${s1.vt.toFixed(2)} yaw=${s1.stage?.yawDeg}`
      + `   visit${last.round} vt=${last.state.vt.toFixed(2)} yaw=${last.state.stage?.yawDeg}`);
    console.log(`  buffer at both: visit1 ${s1.stage?.bufW}x${s1.stage?.bufH}@${s1.stage?.pixelRatio}`
      + `   visit${last.round} ${last.state.stage?.bufW}x${last.state.stage?.bufH}@${last.state.stage?.pixelRatio}`);
    ok(s1.stage?.bufW === last.state.stage?.bufW && s1.stage?.bufH === last.state.stage?.bufH
      && s1.stage?.pixelRatio === last.state.stage?.pixelRatio,
      'the character stage draws at the SAME resolution on visit 1 and visit ' + last.round,
      `${s1.stage?.bufW}x${s1.stage?.bufH}@${s1.stage?.pixelRatio}`
      + ` vs ${last.state.stage?.bufW}x${last.state.stage?.bufH}@${last.state.stage?.pixelRatio}`);
    if (!driftClean) {
      console.log('  ⚠️ NOT QUOTABLE — the panel self-pair in step 1 was not 0, so this number '
        + 'contains drift the instrument cannot attribute.');
    } else {
      ok(!!rtPanel && rtPanel.diffPx === 0,
        'the 3D character stage is BIT-IDENTICAL after a full home/match round trip',
        rtPanel ? `${rtPanel.diffPx} px, luma delta ${rtPanel.lumaDelta}` : 'no panel');
    }

    // ── the census verdict ───────────────────────────────────────────────────
    head('VERDICT — contexts');
    const first = out.steps.find((x) => x.label === 'characters visit 1');
    const lastS = last.state;
    console.log(`  contexts ever created ......... ${lastS.ctxCreated}`);
    console.log(`  contexts still HELD ........... ${lastS.ctxHeld}   (created and never lost)`);
    console.log(`  contexts LOST right now ....... ${lastS.ctxLostNow}`);
    console.log(`  contexts ever lost / restored . ${lastS.ctxEverLost} / ${lastS.ctxEverRestored}`);
    console.log(`  DOM canvases .................. ${lastS.canvasesInDom} (of ${lastS.canvasesTotal} ever)`);
    console.log(`  live Stage objects ............ ${lastS.stagesAlive}`);
    console.log(`  held delta across the loop .... ${lastS.ctxHeld - first.ctxHeld}`);
    ok(lastS.ctxHeld - first.ctxHeld <= 0,
      'a full round trip does not GROW the number of held GL contexts',
      `${first.ctxHeld} -> ${lastS.ctxHeld}`);
    ok(lastS.canvasesInDom - first.canvasesInDom <= 0,
      'a full round trip does not leak DOM canvases',
      `${first.canvasesInDom} -> ${lastS.canvasesInDom}`);
    // Every loss must be OURS (a teardown). An unexplained one is the browser
    // reclaiming a context, which is the failure mode this whole tool is about.
    console.log(`  gl events: ${JSON.stringify(lastS.events.map((e) => `${e.type}#${e.id}`))}`);
    console.log(`  __glLog:   ${JSON.stringify(lastS.glLog.map((e) => e.type))}`);

    if (pageErrors.length) {
      head('PAGE ERRORS');
      pageErrors.slice(0, 8).forEach((e) => console.log(`  ${e.slice(0, 200)}`));
    }
    out.pageErrors = pageErrors.slice(0, 20);
    out.pass = PASS; out.fail = FAIL; out.failures = failures;
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  if (JSONOUT) await writeFile(JSONOUT, JSON.stringify(out, null, 2));
  console.log(`\n${FAIL === 0 ? 'ALL PASS' : `${FAIL} FAIL`}  (${PASS} pass)`);
  if (FAIL) failures.forEach((f) => console.log(`  - ${f}`));
  process.exitCode = FAIL === 0 ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
