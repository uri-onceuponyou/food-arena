#!/usr/bin/env node
/**
 * Does the early AudioContext actually COST anything?
 *
 * `engine.ts`'s header says the context must be created lazily, on the first user
 * gesture, "because a context created before one starts suspended with a frozen clock".
 * `tools/tmp/journey.mjs` measured `state: "suspended"` at `/` with no gesture at all
 * and blamed `shell.mount()`'s `music.fadeIn()`. This probe settles three things a
 * reading of the source cannot:
 *
 *   1. WHO creates it — by patching the `AudioContext` constructor at document_start
 *      and keeping the stack.
 *   2. WHETHER the clock is frozen — sampled on a timer inside the page.
 *   3. WHAT IT COSTS — the A/B that matters. A context created INSIDE a gesture is
 *      `running` synchronously; one created outside needs an async `resume()`, and
 *      `play()` refuses while `state !== 'running'`. So the question is whether the
 *      FIRST CLICK's own sound is dropped.
 *
 *      A (shipped): let the opening card's 4.5 s auto-continue create it, then click.
 *      B (control): `?hold=60000`, so nothing creates it until the click does.
 *
 * ── ⚠️ THE HARNESS INVERTS THE MEASUREMENT — read this before changing anything ──
 *
 * **`page.evaluate()` grants transient user activation.** Playwright sends CDP
 * `Runtime.evaluate` with `userGesture: true`, so merely ASKING the page what state
 * the audio engine is in makes `navigator.userActivation.isActive` true for the next
 * ~5 s — and a context created inside that window is born `running`. The first
 * version of this probe polled with `evaluate` and produced opposite answers on two
 * consecutive runs purely on whether its own poll landed before or after the
 * auto-continue. `docs/LESSONS.md` §13, verbatim: an inverted harness flips the sign
 * of the answer.
 *
 * So: everything is collected by an init script running INSIDE the page, on its own
 * timer, and read out by exactly ONE `evaluate` per page, after all the measuring is
 * finished. Clicks are real `page.mouse.click` input, never dispatched events.
 */
import { chromium } from 'playwright';

const args = process.argv;
const get = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const BASE = get('--url', process.env.PREVIEW_BASE || 'http://localhost:5173');

const LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--enable-webgl',
  '--ignore-gpu-blocklist',
  '--disable-gpu-sandbox',
  // Chrome's autoplay policy must be the SHIPPED one, or the whole measurement is void.
  '--autoplay-policy=document-user-activation-required',
];

/**
 * Everything that measures lives here, so that nothing the driver does can perturb it.
 * Runs before any page script: the constructor patch has to be in place before
 * `main.ts` imports the audio package.
 */
const INIT = `
(() => {
  window.__ctxLog = [];
  window.__timeline = [];
  window.__witness = [];
  const Real = window.AudioContext;
  if (Real) {
    function Patched(...a) {
      const c = new Real(...a);
      window.__ctxLog.push({
        at: Math.round(performance.now()),
        born: c.state,
        ua: !!(navigator.userActivation && navigator.userActivation.isActive),
        stack: new Error().stack,
      });
      window.__theCtx = c;
      return c;
    }
    Patched.prototype = Real.prototype;
    Object.setPrototypeOf(Patched, Real);
    window.AudioContext = Patched;
  }

  setInterval(() => {
    window.__timeline.push({
      at: Math.round(performance.now()),
      engine: window.__audio ? window.__audio.stats().state : 'no-engine',
      ctxs: window.__ctxLog.length,
      now: window.__theCtx ? +window.__theCtx.currentTime.toFixed(4) : null,
      ua: !!(navigator.userActivation && navigator.userActivation.isActive),
      screen: window.__screen || null,
    });
  }, 250);

  // What a button handler would see. BUBBLE phase on window, so the engine's own
  // capture-phase unlock listeners have already run — capture always precedes bubble
  // on the same target, whatever the registration order.
  window.addEventListener('click', () => {
    const s = window.__audio ? window.__audio.stats() : null;
    window.__witness.push({
      at: Math.round(performance.now()),
      state: s ? s.state : 'no-engine',
      // The whole question, in one boolean: would a sound scheduled RIGHT NOW be heard?
      played: window.__audio ? window.__audio.engine.play(() => 0.05, { key: 'probe' }) : false,
      droppedNotRunning: s ? s.droppedNotRunning : -1,
      ctxState: window.__theCtx ? window.__theCtx.state : 'no-ctx',
    });
  }, false);
})();
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name, ok, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? `   ${detail}` : ''}`);
};

async function newPage(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
  await page.addInitScript(INIT);
  // Peers are editing this repo live; a Vite HMR full-reload mid-probe wipes state.
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`,
  }));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  return page;
}

/** The ONE read. Nothing may call this until the page has finished measuring. */
const drain = (page) => page.evaluate(() => ({
  ctxLog: window.__ctxLog,
  timeline: window.__timeline,
  witness: window.__witness,
  final: window.__audio ? window.__audio.stats() : null,
  ctxState: window.__theCtx ? window.__theCtx.state : 'no-ctx',
}));

function printTimeline(tl, label) {
  console.log(`  ${label}`);
  console.log('    t(ms)  engine     ctxs  ctx.currentTime  userActivation  screen');
  for (const r of tl) {
    console.log(`    ${String(r.at).padStart(5)}  ${String(r.engine).padEnd(10)} ${String(r.ctxs).padEnd(4)}  ` +
      `${String(r.now).padEnd(15)}  ${String(r.ua).padEnd(14)}  ${r.screen}`);
  }
}

async function run() {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });

  // ── A: the shipped boot route, untouched until the click ──────────────────
  console.log('\n══ A: the shipped boot route — GET /, no gesture, let the card auto-continue ══');
  const p = await newPage(browser, `${BASE}/`);
  await sleep(11000);          // well past the 4500 ms auto-continue, plus page load
  await p.mouse.click(500, 320); // a REAL trusted click, the first activation of the page
  await sleep(900);
  const A = await drain(p);
  await p.close();

  printTimeline(A.timeline.filter((_, i) => i % 4 === 0 || i >= A.timeline.length - 6), 'sampled every 1 s (plus the tail):');
  for (const e of A.ctxLog) {
    console.log(`\n  AudioContext #1 created at ${e.at} ms — born state="${e.born}", userActivation=${e.ua}`);
    for (const f of String(e.stack).split('\n').slice(1, 7)) console.log(`      ${f.trim()}`);
  }
  const preClick = A.timeline.filter((r) => r.at < A.witness[0]?.at ?? Infinity);
  const lastPre = preClick[preClick.length - 1];
  const froze = preClick.filter((r) => r.now !== null);
  console.log(`\n  before the click: engine=${lastPre?.engine} ctxs=${lastPre?.ctxs}`);
  if (froze.length > 1) {
    console.log(`  ctx.currentTime across ${froze[froze.length - 1].at - froze[0].at} ms of wall clock: ` +
      `${froze[0].now} -> ${froze[froze.length - 1].now}`);
  }
  for (const w of A.witness) {
    console.log(`  INSIDE the first click: engine=${w.state} ctx=${w.ctxState} play()=${w.played} droppedNotRunning=${w.droppedNotRunning}`);
  }
  console.log(`  after: engine=${A.final?.state} ctx=${A.ctxState} droppedNotRunning=${A.final?.droppedNotRunning}`);

  // ── B: the control — nothing may create the context but the click ─────────
  console.log('\n══ B: control — /?hold=60000, so the click itself creates the context ══');
  const q = await newPage(browser, `${BASE}/?hold=60000`);
  await sleep(11000);
  await q.mouse.click(500, 320);
  await sleep(900);
  const B = await drain(q);
  await q.close();

  const bPre = B.timeline[B.timeline.length - 6];
  console.log(`  before the click: engine=${bPre?.engine} ctxs=${bPre?.ctxs} screen=${bPre?.screen}`);
  for (const e of B.ctxLog) console.log(`  AudioContext created at ${e.at} ms — born state="${e.born}", userActivation=${e.ua}`);
  for (const w of B.witness) {
    console.log(`  INSIDE the first click: engine=${w.state} ctx=${w.ctxState} play()=${w.played} droppedNotRunning=${w.droppedNotRunning}`);
  }
  console.log(`  after: engine=${B.final?.state} ctx=${B.ctxState} droppedNotRunning=${B.final?.droppedNotRunning}`);

  // ── The verdict ───────────────────────────────────────────────────────────
  console.log('\n══ verdict ══');
  const aBorn = A.ctxLog[0]?.born ?? 'never created';
  const bBorn = B.ctxLog[0]?.born ?? 'never created';
  const aPlayed = A.witness[0]?.played;
  const bPlayed = B.witness[0]?.played;
  console.log(`  A: context born "${aBorn}"  ->  a sound fired from the first click is ${aPlayed ? 'HEARD' : 'DROPPED'}`);
  console.log(`  B: context born "${bBorn}"  ->  a sound fired from the first click is ${bPlayed ? 'HEARD' : 'DROPPED'}`);

  check('the shipped route never creates a context before a real gesture',
    A.ctxLog.length === 0 || A.ctxLog[0].born === 'running',
    `contexts=${A.ctxLog.length} born=${aBorn}`);
  check('a sound fired from the FIRST click is heard on the shipped route', aPlayed === true);
  check('...and on the control', bPlayed === true);
  check('nothing was dropped for a locked engine', (A.final?.droppedNotRunning ?? -1) === 0,
    `droppedNotRunning=${A.final?.droppedNotRunning}`);

  await browser.close();
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks ok');
  process.exit(failures ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
