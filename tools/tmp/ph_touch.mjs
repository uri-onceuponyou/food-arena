#!/usr/bin/env node
/**
 * ph_touch.mjs — INPUT LATENCY: finger down → the character moves.
 *
 * Uri's revised complaint is not stutter, so the interesting question moved from
 * "how long is a frame" to "how long after I touch does anything happen". Those are
 * different projects and the same ms does not answer both.
 *
 * ── The chain, and where each link is measured ──────────────────────────────
 *   A. CDP `Input.dispatchTouchEvent` sent          — host clock, converted once
 *   B. page-side capture-phase `touchstart` fires   — browser event dispatch
 *   C. `touch.ts`'s own handler has run             — observed via `__phTouch.after`
 *   D. the first rAF frame whose `__matchDebug.moveX` is non-zero — INPUT IS IN THE SIM
 *   E. the frame after that renders it
 *
 * B−A is the browser's input plumbing. D−B is the game's: `buildInput()` samples the
 * stick inside `GameSession.loop`, so a touch that lands just after a frame started
 * waits out the rest of that frame plus the next one. **That is a whole-frame quantum,
 * which is why frame time still matters even when frame time is not the complaint.**
 *
 * ⚠️ EMULATION. `Input.dispatchTouchEvent` injects at the browser's input pipeline,
 * which is DOWNSTREAM of everything a real phone spends first: the digitiser scan
 * (~8 ms at 120 Hz, ~16 ms at 60 Hz), the OS touch pipeline, and — on iOS Safari —
 * a cross-process hop. So every number here is a FLOOR. The device-independent
 * findings are the FRAME QUANTUM (how many frames of latency the design costs) and
 * the listener configuration, not the absolute ms.
 *
 * 🚨 `page.evaluate()` grants transient user activation (`docs/AGENT-BRIEF.md` §3), so
 * everything is observed page-side from `addInitScript` and read back in ONE evaluate
 * at the end.
 *
 *   node tools/tmp/ph_touch.mjs                 # iPhone 15 landscape, cpu 1 and 4
 *   node tools/tmp/ph_touch.mjs --cpu 1,4,6 --taps 25
 */
import { chromium, devices } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);

// Session scratchpads are cleaned; `docs/AGENT-BRIEF.md` opens with a brief that
// silently vanished from one. So the state path is durable by default and the
// scratchpad is opt-in via PH_SCRATCH.
const SCRATCH = process.env.PH_SCRATCH ?? join(tmpdir(), 'fa-ph');
const STATE = join(SCRATCH, 'ph-serve.json');
const BASE = arg('url', null) ?? process.env.PREVIEW_BASE
  ?? (existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')).url : null);
if (!BASE) { console.error('ph_touch: run `node tools/tmp/ph_serve.mjs --start` first.'); process.exit(2); }

const CPUS = String(arg('cpu', '1,4')).split(',').map(Number);
const TAPS = Number(arg('taps', 20));
const DEV = arg('device', 'iPhone 15 landscape');

const OBS = `
(() => {
  const T = { downs: [], moves: [], frames: [], listeners: [] };
  window.__phTouch = T;
  // Capture phase, installed before the app exists, so it runs FIRST and does not
  // preventDefault — it observes, it does not participate.
  window.addEventListener('touchstart', (ev) => {
    T.downs.push({ at: performance.now(), evTs: ev.timeStamp,
      x: ev.changedTouches[0] && ev.changedTouches[0].clientX,
      y: ev.changedTouches[0] && ev.changedTouches[0].clientY });
  }, { capture: true, passive: true });
  // ...and a bubble-phase one, which runs AFTER touch.ts's window listener, so the
  // gap between the two IS touch.ts's handler cost.
  window.addEventListener('touchstart', () => {
    const d = T.downs[T.downs.length - 1];
    if (d && d.after === undefined) d.after = performance.now();
  }, { capture: false, passive: true });

  /*
   * THE INSTRUMENT FIX, kept with the reason (CLAUDE.md: keep the old wording).
   *
   * v1 measured "touchstart -> the sim moves" and reported a flat 4-5 FRAMES at every
   * CPU rate -- which would have been a headline finding and was an ARTEFACT OF THE
   * PROBE. touch.ts is a FLOATING stick: touchstart only plants the base, so moveX is
   * legitimately 0 until a touchmove arrives, and the probe sent that as a SECOND CDP
   * round trip. The constancy across x1/x4/x6 was the tell: a cost that does not move
   * when you make the CPU six times slower is not being paid by the CPU.
   *
   * So the honest zero is the last touchmove before movement appears, and both are
   * now reported side by side.
   */
  window.addEventListener('touchmove', (ev) => {
    T.moves.push({ at: performance.now(),
      x: ev.changedTouches[0] && ev.changedTouches[0].clientX,
      y: ev.changedTouches[0] && ev.changedTouches[0].clientY });
  }, { capture: true, passive: true });

  // Record which listeners the app registered, and how. A passive touchmove listener
  // cannot preventDefault, which is what lets a browser scroll the page under a stick.
  const oAdd = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    if (/^(touch|pointer)/.test(type)) {
      T.listeners.push({
        target: this === window ? 'window' : (this.tagName || String(this)).toLowerCase(),
        type, passive: !!(opts && opts.passive), capture: !!(opts && (opts === true || opts.capture)),
      });
    }
    return oAdd.call(this, type, fn, opts);
  };

  const raf = window.requestAnimationFrame.bind(window);
  (function sample() {
    const d = window.__matchDebug;
    T.frames.push({ at: performance.now(), mx: d ? d.moveX : null, my: d ? d.moveY : null });
    raf(sample);
  })();
})();
`;

console.log(`\nph_touch — ${DEV}, production build. ⚠️ emulation: absolute ms are a FLOOR.\n`);

for (const cpu of CPUS) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });
  const ctx = await browser.newContext({ ...devices[DEV] });
  await ctx.addInitScript(OBS);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });

  await page.goto(`${BASE}/?player=hamburger&enemy=donut`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 120_000 });
  await page.waitForFunction(`document.querySelector('.hud-countdown')?.style.display === 'none'`,
    null, { timeout: 40_000 }).catch(() => {});
  await page.waitForTimeout(800);

  const vp = devices[DEV].viewport;
  // Land in the LEFT half — `touch.ts` claims a finger for the move stick by which
  // half of the width it lands in (ZONE_SPLIT), so this is the move stick by
  // construction and does not depend on where a visual is drawn.
  const x = Math.round(vp.width * 0.22);
  const y = Math.round(vp.height * 0.68);

  for (let i = 0; i < TAPS; i++) {
    // Stagger the phase so taps do not all land at the same point in the frame — the
    // whole quantity being measured is "how much of a frame do you wait", and a fixed
    // cadence would sample one phase and call it the answer.
    await new Promise((r) => setTimeout(r, 90 + (i % 7) * 5));
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart', touchPoints: [{ x, y, id: 1 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: x + 40, y: y - 30, id: 1 }],
    });
    await new Promise((r) => setTimeout(r, 120));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  const T = await page.evaluate('({ downs: window.__phTouch.downs, moves: window.__phTouch.moves, frames: window.__phTouch.frames, listeners: window.__phTouch.listeners })');
  await browser.close();

  // For each touchstart, find the first sampled frame after it whose moveX is non-zero
  // — and ALSO the same thing measured from the touchmove that actually deflected the
  // stick, which is the honest zero for a floating stick. See the note in OBS.
  const lat = []; const quanta = []; const handler = [];
  const latMove = []; const quantaMove = [];
  for (const d of T.downs) {
    if (d.after !== undefined) handler.push(d.after - d.at);
    const after = T.frames.filter((f) => f.at >= d.at);
    const hitIdx = after.findIndex((f) => f.mx !== null && Math.abs(f.mx) > 0.01);
    if (hitIdx < 0) continue;
    lat.push(after[hitIdx].at - d.at);
    quanta.push(hitIdx + 1);
    const hitAt = after[hitIdx].at;
    const mv = T.moves.filter((m) => m.at >= d.at && m.at <= hitAt).pop();
    if (!mv) continue;
    latMove.push(hitAt - mv.at);
    quantaMove.push(T.frames.filter((f) => f.at >= mv.at && f.at <= hitAt).length);
  }
  const s = (a) => [...a].sort((x, y) => x - y);
  const p = (a, q) => (a.length ? s(a)[Math.min(a.length - 1, Math.floor(q * a.length))] : NaN);
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
  const fps = [];
  for (let i = 1; i < T.frames.length; i++) fps.push(T.frames[i].at - T.frames[i - 1].at);

  console.log(`── cpu x${cpu}   ${T.downs.length} taps, ${lat.length} resolved`);
  console.log(`   touchstart → touch.ts handler done   mean ${mean(handler).toFixed(2)} ms   p95 ${p(handler, 0.95).toFixed(2)} ms`);
  console.log(`   touchstart → sim reports movement    p50 ${p(lat, 0.5).toFixed(1)}  p95 ${p(lat, 0.95).toFixed(1)} ms   (${p(quanta, 0.5)} frames — ⚠ INCLUDES the probe's own touchStart→touchMove round trip)`);
  console.log(`   touchMOVE  → sim reports movement    p50 ${p(latMove, 0.5).toFixed(1)}  p95 ${p(latMove, 0.95).toFixed(1)}  max ${(s(latMove).pop() ?? NaN).toFixed(1)} ms   ← THE GAME'S OWN LATENCY`);
  console.log(`   ... expressed in FRAMES              p50 ${p(quantaMove, 0.5)}  p95 ${p(quantaMove, 0.95)}  max ${Math.max(...quantaMove)} frames   (frame p50 ${p(fps, 0.5).toFixed(1)} ms)`);
  if (cpu === CPUS[0]) {
    const seen = new Set();
    console.log('   listeners registered by the app:');
    for (const l of T.listeners) {
      const k = `${l.target}/${l.type}/${l.passive}/${l.capture}`;
      if (seen.has(k) || /^__ph/.test(k)) continue;
      seen.add(k);
      console.log(`     ${l.target.padEnd(8)} ${l.type.padEnd(12)} passive=${String(l.passive).padEnd(5)} capture=${l.capture}`);
    }
  }
  console.log('');
}
