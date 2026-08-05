#!/usr/bin/env node
/**
 * THE THEME'S STOP/RESUME CYCLE, at the 45 s clock.
 *
 * `MATCH_DURATION_MS` went 180 s -> 45 s this session. The theme is MENU music: the
 * shell fades it out on the way into a match and back in on the way out
 * (`ui/screens/shell.ts` mount()). So the stop/resume cycle now happens roughly FOUR
 * TIMES as often per hour as it used to, and anything that thrashes, clicks,
 * double-starts, leaks or loses its resume point is now four times as visible.
 *
 * ── Why this cannot be an offline render, and what is done about it ─────────────
 *
 * Everything else in this pillar is measured through `OfflineAudioContext` on the
 * production path, because `docs/LESSONS.md` §10 is unambiguous: polling an analyser
 * from rAF at SwiftShader's frame rate missed 4 of 5 countdown blips and reported the
 * game as silent. The theme cannot be measured that way — it is an `HTMLAudioElement`
 * STREAMED through `createMediaElementSource` (decoding it would be ~198 MB resident
 * for a 4 MB file, see `music.ts`), and a media element does not exist inside an
 * OfflineAudioContext at all.
 *
 * So this measures live, and every mitigation the lesson implies is applied:
 *
 *   * A `ScriptProcessorNode` on the master bus, not an analyser poll. It receives
 *     EVERY 2048-sample block regardless of frame rate, so nothing can be missed by
 *     being short. This is the same instrument `--mode live` uses and the reason
 *     `engine.connectTap` exists.
 *   * A CLICK is measured as the largest sample-to-sample step inside a block, which
 *     is a property of the samples, not of when they were looked at.
 *   * Every claim about the element itself (how many were created, whether `play()`
 *     was called twice, where playback resumed from) comes from prototype hooks
 *     installed by `addInitScript` BEFORE any page script runs — the element is
 *     deliberately never appended to the DOM, so `document.querySelectorAll('audio')`
 *     finds nothing even while the theme is playing.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/theme_cycle.mjs --base {URL}
 */

import { chromium } from 'playwright';

const args = process.argv;
const get = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const BASE = get('--base', process.env.PREVIEW_BASE || 'http://localhost:5173');

let failures = 0;
let checks = 0;
function check(name, ok, detail) {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? `   ${detail}` : ''}`);
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });

// Peers are editing this repo live and every save full-reloads the app mid-probe.
await page.route('**/@vite/client*', (r) => r.fulfill({
  status: 200, contentType: 'text/javascript',
  body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
}));

// Before ANY page script. The media element is never in the DOM, so the only way to
// see it is to be holding the prototype when it is used.
await page.addInitScript(() => {
  window.__media = { els: [], play: 0, pause: 0, cmes: 0, srcSet: [] };
  const P = HTMLMediaElement.prototype;
  const origPlay = P.play;
  P.play = function (...a) {
    if (!window.__media.els.includes(this)) window.__media.els.push(this);
    window.__media.play++;
    return origPlay.apply(this, a);
  };
  const origPause = P.pause;
  P.pause = function (...a) { window.__media.pause++; return origPause.apply(this, a); };
  const origSrc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
  Object.defineProperty(HTMLMediaElement.prototype, 'src', {
    ...origSrc,
    set(v) { window.__media.srcSet.push(String(v)); return origSrc.set.call(this, v); },
  });
  for (const C of [window.AudioContext, window.webkitAudioContext].filter(Boolean)) {
    const orig = C.prototype.createMediaElementSource;
    C.prototype.createMediaElementSource = function (...a) {
      window.__media.cmes++;
      if (!window.__media.els.includes(a[0])) window.__media.els.push(a[0]);
      return orig.apply(this, a);
    };
  }
});

await page.goto(`${BASE}/?screen=home`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction('window.__screen !== undefined', null, { timeout: 60000 });

// A real, trusted gesture — the autoplay policy wants nothing less.
await page.mouse.click(500, 320);
await page.waitForTimeout(1500);

const state0 = await page.evaluate(async () => {
  const m = await import('/src/audio/index.ts');
  return {
    audio: window.__audio.stats().state,
    playing: m.audio.music.isPlaying(),
    media: { ...window.__media, els: window.__media.els.length },
  };
});
console.log(`\n  boot: audio=${state0.audio} musicPlaying=${state0.playing} elements=${state0.media.els} play()=${state0.media.play} createMediaElementSource=${state0.media.cmes}`);
check('the context unlocked on the first gesture', state0.audio === 'running', state0.audio);
check('the theme is playing after the first gesture', state0.playing === true, `isPlaying=${state0.playing}`);
if (!state0.playing) {
  console.log('  (no theme in this browser — nothing further is measurable)');
  await browser.close();
  process.exit(failures ? 1 : 0);
}

/**
 * Gapless capture. Per block: RMS, and the largest sample-to-sample STEP — a gain
 * discontinuity is a step, and a step is what a click is.
 */
await page.evaluate(() => {
  const ctx = window.__audio.engine.context;
  const proc = ctx.createScriptProcessor(2048, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  proc.connect(mute).connect(ctx.destination);
  window.__rec = { blocks: [], t0: performance.now() };
  let last = 0;
  proc.onaudioprocess = (e) => {
    const d = e.inputBuffer.getChannelData(0);
    let s = 0, step = 0;
    for (let i = 0; i < d.length; i++) {
      s += d[i] * d[i];
      const j = Math.abs(d[i] - last);
      if (j > step) step = j;
      last = d[i];
    }
    if (window.__rec.blocks.length < 40000) {
      window.__rec.blocks.push({ rms: Math.sqrt(s / d.length), step, at: performance.now() - window.__rec.t0 });
    }
    e.outputBuffer.getChannelData(0).fill(0);
  };
  window.__audio.connectTap(proc);
  window.__recReset = () => { window.__rec.blocks.length = 0; window.__rec.t0 = performance.now(); };
  window.__music = async () => (await import('/src/audio/index.ts')).audio.music;
  window.__mediaEl = () => window.__media.els[0] ?? null;
});

const grab = () => page.evaluate(() => window.__rec.blocks.slice());
const reset = () => page.evaluate(() => window.__recReset());
const music = (fn, arg) => page.evaluate(async ([f, a]) => {
  const m = (await import('/src/audio/index.ts')).audio.music;
  return a === undefined ? m[f]() : m[f](a);
}, [fn, arg]);
const currentTime = () => page.evaluate(() => (window.__media.els[0] ? window.__media.els[0].currentTime : null));
const stats = (bs) => ({
  n: bs.length,
  meanRms: bs.length ? bs.reduce((a, b) => a + b.rms, 0) / bs.length : 0,
  maxStep: bs.reduce((a, b) => Math.max(a, b.step), 0),
});

// ── 1. Steady state. Everything below is measured against this. ─────────────
await reset();
await page.waitForTimeout(2000);
const steady = stats(await grab());
console.log(`\n  steady playback: ${steady.n} blocks meanRms=${steady.meanRms.toExponential(2)} maxStep=${steady.maxStep.toExponential(2)}`);
check('the theme is producing a real waveform at the master bus',
  steady.meanRms > 1e-3, `meanRms=${steady.meanRms.toExponential(2)}`);

// ── 2. A MENU NAVIGATION. `shell.ts` mount() calls fadeIn() on EVERY route that is
//      not a match — including menu-to-menu, where the theme is already playing at
//      full level. `fadeIn()` starts by setting the gain to 0.
await reset();
await music('fadeIn');
await page.waitForTimeout(1200);
const nav = await grab();
const navEarly = stats(nav.filter((b) => b.at < 120));
const navLate = stats(nav.filter((b) => b.at > 900));
console.log(`  menu-to-menu fadeIn(): first 120 ms meanRms=${navEarly.meanRms.toExponential(2)} maxStep=${navEarly.maxStep.toExponential(2)}   after 900 ms meanRms=${navLate.meanRms.toExponential(2)}`);
console.log(`    steady maxStep=${steady.maxStep.toExponential(2)} -> transition maxStep=${navEarly.maxStep.toExponential(2)} (x${(navEarly.maxStep / steady.maxStep).toFixed(2)})`);
check('a menu-to-menu navigation does not put a step discontinuity on the bus',
  navEarly.maxStep <= steady.maxStep * 2, `x${(navEarly.maxStep / steady.maxStep).toFixed(2)} of the steady-state largest step`);
check('the theme is back at level after a menu-to-menu navigation',
  navLate.meanRms > steady.meanRms * 0.7, `${steady.meanRms.toExponential(2)} -> ${navLate.meanRms.toExponential(2)}`);
// The DIP, not the click, is the real symptom here — and it is what `fadeIn()`'s
// unconditional `gain.value = 0` produced on every menu tap: 379 ms below half level,
// four times as often per hour now the clock is 45 s.
const dipMs = (() => {
  const thr = steady.meanRms * 0.5;
  let last = 0;
  for (const b of nav) if (b.rms < thr) last = b.at;
  return last;
})();
console.log(`    level stayed below half of steady for the first ${dipMs.toFixed(0)} ms of the navigation`);
check('a menu-to-menu navigation does not DUCK a theme that never stopped',
  dipMs < 120, `${dipMs.toFixed(0)} ms below half level`);

// ── 3. THE REAL CYCLE: menu -> match -> menu. This is what happens every 45 s now. ──
const tBefore = await currentTime();
await reset();
await music('fadeOut', 0.6);
await page.waitForTimeout(1100);
const out = stats(await grab());
const pausedAt = await currentTime();
const playing1 = await music('isPlaying');
console.log(`\n  fadeOut(0.6): meanRms=${out.meanRms.toExponential(2)} maxStep=${out.maxStep.toExponential(2)} isPlaying=${playing1} currentTime ${tBefore.toFixed(2)}s -> ${pausedAt.toFixed(2)}s`);
check('fadeOut silences the theme', out.meanRms < steady.meanRms * 0.35,
  `${steady.meanRms.toExponential(2)} -> ${out.meanRms.toExponential(2)}`);
check('fadeOut actually PAUSES the element (it is not left decoding silently)',
  playing1 === false, `isPlaying=${playing1}`);
check('fadeOut does not click', out.maxStep <= steady.maxStep * 2,
  `x${(out.maxStep / steady.maxStep).toFixed(2)} of steady`);

await page.waitForTimeout(700);
const restedAt = await currentTime();
check('a paused theme does not keep advancing', Math.abs(restedAt - pausedAt) < 0.05,
  `${pausedAt.toFixed(2)}s -> ${restedAt.toFixed(2)}s after 700 ms paused`);

await reset();
await music('fadeIn', 0.8);
await page.waitForTimeout(1400);
const back = stats((await grab()).filter((b) => b.at > 1000));
const resumedAt = await currentTime();
console.log(`  fadeIn(0.8): meanRms=${back.meanRms.toExponential(2)} currentTime resumed at ${resumedAt.toFixed(2)}s (paused at ${restedAt.toFixed(2)}s)`);
check('fadeIn brings the theme back', back.meanRms > steady.meanRms * 0.7,
  `${steady.meanRms.toExponential(2)} -> ${back.meanRms.toExponential(2)}`);
check('the theme RESUMES rather than restarting from the top',
  resumedAt > restedAt && resumedAt < restedAt + 2.5,
  `paused ${restedAt.toFixed(2)}s -> resumed ${resumedAt.toFixed(2)}s`);

// ── 4. AN INTERRUPTED FADE. Back out of a match before the fade finishes: the
//      pending `pause()` must not fire behind the resumed track. `fadeOut` schedules
//      a real `setTimeout` and guards it with `fadeToken`; this is that guard.
await reset();
await music('fadeOut', 0.6);
await page.waitForTimeout(200);
await music('fadeIn', 0.4);
await page.waitForTimeout(1400);
const interrupted = stats((await grab()).filter((b) => b.at > 900));
const stillPlaying = await music('isPlaying');
console.log(`\n  fadeOut interrupted by fadeIn after 200 ms: isPlaying=${stillPlaying} meanRms=${interrupted.meanRms.toExponential(2)}`);
check('a fadeOut interrupted by a fadeIn does not pause the track behind it',
  stillPlaying === true && interrupted.meanRms > steady.meanRms * 0.7,
  `isPlaying=${stillPlaying} meanRms=${interrupted.meanRms.toExponential(2)}`);

// ── 5. THRASH. Eight menu->match->menu round trips, which at the 45 s clock is
//      about six minutes of play. Nothing may accumulate.
const before = await page.evaluate(() => ({ ...window.__media, els: window.__media.els.length }));
for (let i = 0; i < 8; i++) {
  await music('fadeOut', 0.6);
  await page.waitForTimeout(750);
  await music('fadeIn', 0.8);
  await page.waitForTimeout(900);
}
await reset();
await page.waitForTimeout(1600);
const afterThrash = stats(await grab());
const after = await page.evaluate(() => ({ ...window.__media, els: window.__media.els.length }));
const endTime = await currentTime();
const endPlaying = await music('isPlaying');
console.log(`\n  after 8 stop/resume cycles: elements=${after.els} createMediaElementSource=${after.cmes} src assignments=${after.srcSet.length}`);
console.log(`    play() calls ${before.play} -> ${after.play}, pause() calls ${before.pause} -> ${after.pause}`);
console.log(`    isPlaying=${endPlaying} currentTime=${endTime.toFixed(2)}s meanRms=${afterThrash.meanRms.toExponential(2)} maxStep=${afterThrash.maxStep.toExponential(2)}`);
check('exactly ONE audio element is ever created', after.els === 1, `${after.els} elements`);
check('createMediaElementSource is called exactly once for the page', after.cmes === 1, `${after.cmes} calls`);
check('the track source is assigned once — it never re-downloads', after.srcSet.length === 1, `${after.srcSet.length} src assignments`);
check('play() is called at most once per resume — no double-start',
  after.play - before.play <= 8, `${after.play - before.play} play() calls for 8 resumes`);
check('the theme is still playing after 8 cycles', endPlaying === true, `isPlaying=${endPlaying}`);
check('the theme is still at level after 8 cycles',
  afterThrash.meanRms > steady.meanRms * 0.7, `${steady.meanRms.toExponential(2)} -> ${afterThrash.meanRms.toExponential(2)}`);
check('8 cycles introduced no step discontinuity',
  afterThrash.maxStep <= steady.maxStep * 2, `x${(afterThrash.maxStep / steady.maxStep).toFixed(2)} of steady`);

// ── 6. The REAL shell, through the router. Menu-to-menu only: mounting a match
//      builds a WebGL stage and under SwiftShader that costs minutes, while the code
//      path under test (`mount()` -> fadeOut/fadeIn) is the same three lines either way.
await reset();
const routes = ['characters', 'trophies', 'settings', 'home'];
for (const name of routes) {
  await page.evaluate((n) => window.__shell.navigate({ name: n }), name);
  await page.waitForTimeout(700);
}
const routed = await grab();
const routedLate = stats(routed.filter((b) => b.at > routes.length * 700 - 300));
console.log(`\n  through the real shell (${routes.join(' -> ')}): meanRms=${routedLate.meanRms.toExponential(2)} maxStep=${stats(routed).maxStep.toExponential(2)}`);
const belowHalf = routed.filter((b) => b.rms < steady.meanRms * 0.5).length;
console.log(`    ${belowHalf}/${routed.length} blocks below half the steady level across ${routes.length} menu navigations`);
check('navigating the menus leaves the theme playing at level',
  routedLate.meanRms > steady.meanRms * 0.7, `${steady.meanRms.toExponential(2)} -> ${routedLate.meanRms.toExponential(2)}`);
check('navigating the menus does not click',
  stats(routed).maxStep <= steady.maxStep * 2.5, `x${(stats(routed).maxStep / steady.maxStep).toFixed(2)} of steady`);

await browser.close();
console.log(`\n${checks - failures}/${checks} checks passed${failures ? `, ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
