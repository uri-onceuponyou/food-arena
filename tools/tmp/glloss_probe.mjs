#!/usr/bin/env node
/**
 * Render robustness — what happens when the WebGL context is LOST?
 *
 * ── Why this is not theoretical ─────────────────────────────────────────────────
 * A lost context is an ordinary event on real hardware: a GPU reset, a driver
 * update, a tab backgrounded under memory pressure on iOS, or simply Chrome killing
 * the OLDEST context once a process passes ~16 of them (which `stage.ts:dispose`
 * already documents as a real failure this project has hit). The browser hands the
 * page a `webglcontextlost` event and then a `webglcontextrestored` one — and if
 * nothing listens, the canvas is cleared to transparent black and stays that way.
 * `docs/LESSONS.md` §1: when something "isn't there", it is usually rendering and
 * invisible. A black canvas is that failure at its most extreme.
 *
 * ── What is measured, and in what order ─────────────────────────────────────────
 *   0  INSTRUMENT VALIDATION. Everything below is a frame statistic, so the frame
 *      statistic is validated against two KNOWN inputs first: a canvas filled with
 *      pure black (must read mean 0, stdev 0) and the live rendered frame (must read
 *      stdev above `settle.mjs`'s FRAME_FLOOR of 8.0). If those two do not separate,
 *      no later number here means anything (`docs/LESSONS.md` §13).
 *   1  THE LOSS. Forced deterministically with `WEBGL_lose_context`, so this is a
 *      real GL context loss and not a simulation of one. Measures: does the event
 *      fire, is it `preventDefault`ed (without that the context is NEVER restorable),
 *      does the canvas actually go black, and does the app say anything at all.
 *   2  THE RECOVERY. `restoreContext()`, then the frame must come BACK — compared
 *      against the pre-loss frame, not merely "not black".
 *   3  THE SURFACE. A player staring at a black canvas must be told something, and
 *      given a way out. This is where the history fix pays off twice: a reload is now
 *      a genuine recovery rather than a trip to the home screen.
 *   4  NOT ONE-SHOT. A second loss/restore cycle must behave identically — a handler
 *      that works once and then leaks or double-registers is a slow version of the
 *      same bug.
 *   5  THE MENU PORTRAIT. A different Stage, a different framing, the same event.
 *
 *   node tools/tmp/glloss_probe.mjs --url http://localhost:5188
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/glloss_probe.mjs --url {URL}
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
// `--url` wins; otherwise PREVIEW_BASE, which both `with_snapshot.mjs` (frozen
// working tree) and `headserve.mjs` (pristine `git archive HEAD`) export. That is
// what lets the SAME probe file measure the before and the after.
const base = get('--url', process.env.PREVIEW_BASE || 'http://localhost:5173').replace(/\/$/, '');
const only = get('--only', null);
const shotDir = get('--shots', null);
/** `settle.mjs`'s floor for "this is a rendered frame and not a flat fill". */
const FRAME_FLOOR = 8.0;
/** How long the shell may take to offer a way out of an unrecovered context. */
const NOTICE_GRACE_MS = 4500;
/**
 * The match runs at `simSpeed=0.02` throughout — near-frozen, the same setting
 * `arena-scan` uses for byte-comparable runs.
 *
 * THE FIRST VERSION OF THIS PROBE DID NOT, and its "the frame came back" assertion
 * was worthless: a live match moves two fighters and closes a fog ring, so the frame
 * legitimately differs 10 s later and there was no way to tell that apart from a
 * broken restore. The sim is frozen here AND a drift control is measured over the
 * same wall-clock span as the loss/restore cycle, so the tolerance is derived from
 * this machine's own noise rather than guessed (`docs/TOOLS.md`: `--sim-speed 0.02`
 * freezes the sim, NOT the shaders).
 */
const MATCH_URL = '/?player=pizza&enemy=egg&simSpeed=0.02';

const HMR_STUB = 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};';

let pass = 0;
let fail = 0;
const failures = [];
let group = '';
function ok(cond, label, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${label}${detail ? `   ${detail}` : ''}`); }
  else { fail++; failures.push(`[${group}] ${label} ${detail}`); console.log(`  FAIL  ${label}${detail ? `   ${detail}` : ''}`); }
  return cond;
}
function head(name) {
  group = name;
  console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 66 - name.length))}`);
}
const skip = (name) => only !== null && !only.split(',').includes(name[0]);

// ─────────────────────────────────────────────────────────────────────────────
// In-page helpers. Kept as strings passed to `evaluate` so there is exactly one
// copy of each and no bundler is involved.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Luma mean/stdev of the live drawing buffer, at 160x90.
 *
 * The scratch 2D canvas is cleared to OPAQUE BLACK before the draw, deliberately: a
 * lost context leaves the WebGL canvas transparent, and drawing transparent over
 * black is the literal thing the player sees (`alpha: false`, so the compositor puts
 * black behind it). "Black canvas" is therefore measured, not inferred.
 */
const STATS_FN = (sel) => {
  const src = sel === 'control-black' ? null : (window.__stage && window.__stage.renderer.domElement);
  const W = 160; const H = 90;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  let w = 0; let h = 0;
  if (src) { w = src.width; h = src.height; try { g.drawImage(src, 0, 0, W, H); } catch (e) { return { error: String(e) }; } }
  const d = g.getImageData(0, 0, W, H).data;
  let sum = 0; let sum2 = 0;
  const n = W * H;
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    sum += y; sum2 += y * y;
  }
  const mean = sum / n;
  return { mean: +mean.toFixed(3), stdev: +Math.sqrt(Math.max(0, sum2 / n - mean * mean)).toFixed(3), bufW: w, bufH: h };
};

/** Attach the probe's own listeners + grab the extension. Idempotent per document. */
const ARM_FN = () => {
  const s = window.__stage;
  if (!s || s.disposed) return { error: 'no live Stage' };
  const cv = s.renderer.domElement;
  if (!window.__probeGl) {
    window.__probeGl = { lost: [], restored: [], app: [] };
    cv.addEventListener('webglcontextlost', (e) => {
      // Read in a later task as well: defaultPrevented is only final once every
      // listener has run, and ours is not guaranteed to be last.
      const rec = { t: Date.now(), preventedAtListener: e.defaultPrevented };
      window.__probeGl.lost.push(rec);
      setTimeout(() => { rec.preventedAfter = e.defaultPrevented; }, 0);
    });
    cv.addEventListener('webglcontextrestored', () => window.__probeGl.restored.push({ t: Date.now() }));
    for (const n of ['fa:webglcontextlost', 'fa:webglcontextrestored']) {
      window.addEventListener(n, (e) => window.__probeGl.app.push({
        t: Date.now(), type: n, detail: e.detail ? { offscreen: !!e.detail.offscreen } : null,
      }));
    }
  }
  const gl = s.renderer.getContext();
  const ext = gl.getExtension('WEBGL_lose_context');
  window.__probeExt = ext;
  return { hasExt: !!ext, canvasId: `${cv.width}x${cv.height}` };
};

/** What the app publishes about its own GL health. */
const DIAG_FN = () => {
  const s = window.__stage;
  const notice = document.querySelector('[data-el="fa-gl-notice"]');
  const nr = notice ? notice.getBoundingClientRect() : null;
  const btn = notice ? notice.querySelector('button') : null;
  const br = btn ? btn.getBoundingClientRect() : null;
  return {
    contextLost: s ? s.contextLost === true : null,
    hasContextLostField: s ? 'contextLost' in s : null,
    log: Array.isArray(window.__glLog) ? window.__glLog.map((e) => e.type) : null,
    probe: window.__probeGl,
    notice: notice ? {
      w: Math.round(nr.width), h: Math.round(nr.height),
      text: (notice.textContent || '').trim().slice(0, 80),
      visible: getComputedStyle(notice).display !== 'none' && nr.width > 1,
    } : null,
    noticeButton: btn ? { w: Math.round(br.width), h: Math.round(br.height), text: (btn.textContent || '').trim() } : null,
  };
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));

const stats = (sel) => page.evaluate(STATS_FN, sel ?? null);
const diag = () => page.evaluate(DIAG_FN);
/** Numbers are not a substitute for looking at the frame (`CLAUDE.md` §3). */
async function shot(name) {
  if (!shotDir) return;
  await mkdir(shotDir, { recursive: true });
  await page.screenshot({ path: `${shotDir}/${name}.png` });
}

async function lose() {
  const n = await page.evaluate(() => window.__probeGl.lost.length);
  await page.evaluate(() => window.__probeExt.loseContext());
  await page.waitForFunction((k) => window.__probeGl.lost.length > k, n, { timeout: 20_000 }).catch(() => {});
  // One task turn so the deferred `defaultPrevented` read lands.
  await page.waitForTimeout(150);
}

async function restore() {
  const n = await page.evaluate(() => window.__probeGl.restored.length);
  await page.evaluate(() => window.__probeExt.restoreContext());
  const came = await page.waitForFunction((k) => window.__probeGl.restored.length > k, n, { timeout: 30_000 })
    .then(() => true).catch(() => false);
  // Give the app's own loop several frames to draw with the new context.
  await page.evaluate(() => new Promise((r) => {
    let i = 0;
    const step = () => (++i > 12 ? r() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  })).catch(() => {});
  await page.waitForTimeout(400);
  return came;
}

/** Boot a route and arm the probe against whatever Stage is on screen. */
async function bootAndArm(path, ready) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(ready, null, { timeout: 180_000 });
  await page.waitForTimeout(1200);
  return page.evaluate(ARM_FN);
}

try {
  // ── 0. INSTRUMENT VALIDATION ────────────────────────────────────────────────
  head('0. instrument validation (known inputs)');
  const armed = await bootAndArm(MATCH_URL, 'window.__gameReady === true');
  ok(armed && !armed.error, 'a live Stage is reachable through window.__stage', armed?.error ?? armed?.canvasId);
  ok(armed?.hasExt === true, 'WEBGL_lose_context is available, so the loss is REAL, not simulated');
  const black = await stats('control-black');
  ok(black.mean === 0 && black.stdev === 0, 'control: a black fill reads mean 0 / stdev 0',
    `mean ${black.mean} stdev ${black.stdev}`);
  const preA = await stats();
  ok(preA.stdev > FRAME_FLOOR, `control: the live match frame reads stdev above ${FRAME_FLOOR}`,
    `mean ${preA.mean} stdev ${preA.stdev} buffer ${preA.bufW}x${preA.bufH}`);
  await shot('01-pre');
  // The drift control: the same wall-clock span the loss/restore cycle will take,
  // with nothing done to the page. Whatever this moves by is the floor under which a
  // post-restore difference cannot be called a defect.
  console.log('  ...measuring frame drift over the same span the cycle will take');
  await page.waitForTimeout(NOTICE_GRACE_MS + 2500);
  const pre = await stats();
  const drift = Math.abs(pre.mean - preA.mean);
  const driftSd = Math.abs(pre.stdev - preA.stdev);
  ok(drift < 6, 'control: a frozen sim drifts little over the cycle span (the tolerance below is derived from this)',
    `mean ${preA.mean} -> ${pre.mean} (drift ${drift.toFixed(3)}), stdev ${preA.stdev} -> ${pre.stdev} (${driftSd.toFixed(3)})`);
  const tol = Math.max(2.0, drift * 3);

  // ── 1. THE LOSS ─────────────────────────────────────────────────────────────
  if (!skip('1')) {
    head('1. a lost context — is it caught, and is it survivable at all?');
    await lose();
    const d = await diag();
    const ev = d.probe.lost[d.probe.lost.length - 1] ?? {};
    ok(d.probe.lost.length === 1, 'the browser fired webglcontextlost', `${d.probe.lost.length} event(s)`);
    ok(ev.preventedAfter === true, 'the event was preventDefault()ed — without this the context is NEVER restorable',
      `defaultPrevented ${ev.preventedAtListener} at our listener, ${ev.preventedAfter} after`);
    const lostFrame = await stats();
    await shot('02-lost');
    ok(lostFrame.stdev < 1 && lostFrame.mean < 1, 'MEASURED: the canvas is now black',
      `mean ${lostFrame.mean} stdev ${lostFrame.stdev} (was mean ${pre.mean} stdev ${pre.stdev})`);
    ok(d.hasContextLostField === true && d.contextLost === true,
      'the Stage publishes that it has lost its context',
      `field present: ${d.hasContextLostField}, value ${d.contextLost}`);
    ok(Array.isArray(d.log) && d.log.includes('lost'), 'a diagnostic is recorded where a bug report can find it',
      `window.__glLog = ${JSON.stringify(d.log)}`);
    ok(d.probe.app.some((e) => e.type === 'fa:webglcontextlost'), 'the app broadcasts the loss so a UI layer can react');
  }

  // ── 3. THE SURFACE (measured while still lost) ──────────────────────────────
  if (!skip('3')) {
    head('3. the player is told, and given a way out');
    const d0 = await diag();
    ok(!!d0.notice && d0.notice.visible, 'a visible notice covers the black canvas',
      d0.notice ? `${d0.notice.w}x${d0.notice.h} "${d0.notice.text}"` : 'no [data-el="fa-gl-notice"] in the DOM');
    console.log(`  ...waiting ${NOTICE_GRACE_MS}ms for the unrecovered-context affordance`);
    await page.waitForTimeout(NOTICE_GRACE_MS);
    const d1 = await diag();
    ok(!!d1.noticeButton && d1.noticeButton.h >= 44, 'an unrecovered context offers a real (44px+) way out',
      d1.noticeButton ? `${d1.noticeButton.w}x${d1.noticeButton.h} "${d1.noticeButton.text}"` : 'no button');
  }

  // ── 2. THE RECOVERY ─────────────────────────────────────────────────────────
  if (!skip('2')) {
    head('2. the frame comes back');
    const came = await restore();
    ok(came, 'the browser fired webglcontextrestored');
    const post = await stats();
    await shot('03-restored');
    ok(post.stdev > FRAME_FLOOR, 'the frame is rendering again', `mean ${post.mean} stdev ${post.stdev}`);
    // The one that catches a HALF recovery: three re-initialises the GL context but
    // every render target it did not re-render is empty afterwards — the PMREM
    // environment map (which has no CPU-side image to re-upload) and the shadow map
    // (which `autoUpdate = false` will not redraw on its own). Both make the frame
    // DARKER while leaving it plausibly "not black", which is exactly the shape of
    // failure `docs/LESSONS.md` §1 is about.
    ok(Math.abs(post.mean - pre.mean) <= tol && Math.abs(post.stdev - pre.stdev) <= tol,
      `and it is the SAME frame as before the loss (tolerance ${tol.toFixed(2)}, from the drift control)`,
      `mean ${pre.mean} -> ${post.mean} (${(post.mean - pre.mean).toFixed(3)}), stdev ${pre.stdev} -> ${post.stdev} (${(post.stdev - pre.stdev).toFixed(3)})`);
    const d = await diag();
    ok(d.hasContextLostField === true && d.contextLost === false, 'the Stage publishes that it recovered',
      `field present: ${d.hasContextLostField}, value ${d.contextLost}`);
    ok(d.probe.app.some((e) => e.type === 'fa:webglcontextrestored'), 'the app broadcasts the recovery');
    ok(!d.notice || !d.notice.visible, 'the notice is gone', d.notice ? JSON.stringify(d.notice) : 'removed');
  }

  // ── 4. NOT ONE-SHOT ─────────────────────────────────────────────────────────
  if (!skip('4')) {
    head('4. a second cycle behaves identically');
    await lose();
    const mid = await stats();
    const dl = await diag();
    ok(dl.hasContextLostField === true && dl.contextLost === true, 'second loss is caught too');
    ok(mid.stdev < 1, 'canvas black again', `stdev ${mid.stdev}`);
    ok(dl.probe.lost.length === 2 && dl.probe.app.filter((e) => e.type === 'fa:webglcontextlost').length === 2,
      'exactly one broadcast per loss — no double registration',
      `${dl.probe.lost.length} browser events, ${dl.probe.app.filter((e) => e.type === 'fa:webglcontextlost').length} broadcasts`);
    await restore();
    const post2 = await stats();
    ok(post2.stdev > FRAME_FLOOR && Math.abs(post2.mean - pre.mean) <= tol,
      'and it recovers to the SAME frame again', `mean ${pre.mean} -> ${post2.mean} stdev ${post2.stdev}`);
  }

  // ── 5. THE MENU PORTRAIT ────────────────────────────────────────────────────
  if (!skip('5')) {
    head('5. the same event on the menus’ shared portrait Stage');
    const armed2 = await bootAndArm('/?screen=characters', "window.__screen === 'characters' && window.__screenReady === true");
    ok(armed2 && !armed2.error && armed2.hasExt, 'the menu portrait Stage is reachable and losable', armed2?.error ?? armed2?.canvasId);
    const preMa = await stats();
    ok(preMa.stdev > FRAME_FLOOR, 'control: the portrait renders', `mean ${preMa.mean} stdev ${preMa.stdev}`);
    await shot('05-menu-pre');
    // The portrait has its own idle animation, so it gets its own drift control.
    await page.waitForTimeout(NOTICE_GRACE_MS + 2500);
    const preM = await stats();
    const driftM = Math.abs(preM.mean - preMa.mean);
    const tolM = Math.max(2.0, driftM * 3);
    ok(true, 'control: portrait drift over the cycle span',
      `mean ${preMa.mean} -> ${preM.mean} (drift ${driftM.toFixed(3)}) -> tolerance ${tolM.toFixed(2)}`);
    await lose();
    const dM = await diag();
    ok(dM.hasContextLostField === true && dM.contextLost === true, 'a menu context loss is caught');
    await restore();
    const postM = await stats();
    await shot('06-menu-restored');
    ok(postM.stdev > FRAME_FLOOR && Math.abs(postM.mean - preM.mean) <= tolM,
      'the portrait comes back UNCHANGED',
      `mean ${preM.mean} -> ${postM.mean}, stdev ${preM.stdev} -> ${postM.stdev}`);
  }
} finally {
  head('page errors');
  const noisy = pageErrors.filter((e) => !/Context Lost|Context Restored/i.test(e));
  ok(noisy.length === 0, 'no uncaught page errors through the whole cycle',
    noisy.length ? noisy.slice(0, 4).join(' | ').slice(0, 400) : 'none');
  const glErrors = consoleErrors.filter((e) => /GL_INVALID|CONTEXT_LOST|WebGL:/i.test(e));
  console.log(`  console errors: ${consoleErrors.length} total, ${glErrors.length} GL-related`);
  if (glErrors.length) console.log(`    e.g. ${glErrors[0].slice(0, 200)}`);
  await ctx.close();
  await browser.close();
}

console.log(`\n${pass}/${pass + fail} assertions passed`);
if (fail) {
  console.log('\nFAILURES');
  for (const f of failures) console.log(`  ${f}`);
}
process.exit(fail ? 1 : 0);
