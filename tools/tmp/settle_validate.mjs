#!/usr/bin/env node
/**
 * Validate `tools/tmp/settle.mjs` against a KNOWN input.
 *
 * `docs/LESSONS.md` §13: an instrument that reports a plausible wrong number is
 * worse than no instrument. `screen_metrics` was wrong twice before it was right and
 * `chars_metrics` three times, both on their background model, and both times the
 * wrong number looked entirely reasonable. So this file does not ask "did the fix
 * change anything". It arranges a page in a state we already know the answer for —
 * a screen captured DELIBERATELY EARLY, at the instant `window.__screenReady` flips
 * — and requires the production guard to refuse it.
 *
 * Three arrangements, because the three entry paths differ:
 *
 *   A. FIRST MOUNT (`/?screen=X`).  `shell.navigate` skips the curtain but
 *      `mount()` still appends a `.fa-screen`, which starts `fa-screen-in 0.26s`,
 *      and `index.html`'s `#boot` overlay is still fading over the top for 0.4s.
 *   B. CURTAINED NAVIGATION (a real click).  This is the exact code path in the
 *      commit message: `curtain.classList.remove('is-on')` and
 *      `window.__screenReady = true` in the same tick, curtain opacity still 1.
 *   C. `window.__previewReady` + 250 ms, which is what `menu_accept.mjs`'s
 *      viewport x screen loop actually waits on. Two rAFs into the same animation
 *      plus a fixed sleep — the margin, not the condition.
 *
 * For each: capture with `wait:false, enforce:false` (so we SEE the early frame),
 * then settle and capture again, then require `assertPainted` to throw on the early
 * state and not on the settled one.
 *
 * Usage:
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/settle_validate.mjs --url {URL}
 */

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  captureSettled, settleScreen, paintState, assertPainted, assertFrame,
  frameStats, describe, CaptureRefused, FRAME_FLOOR,
} from './settle.mjs';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true; else { out[k] = n; i++; }
  }
  return out;
}

const args = parseArgs(process.argv);
const BASE = args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const OUT = args.out ?? 'shots/settle_v';
await mkdir(resolve(OUT), { recursive: true });

let pass = 0;
let fail = 0;
const rows = [];
function check(name, ok, detail = '') {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(46)} ${detail}`);
}

/** Does the production guard refuse this state? Returns the refusal message or null. */
function refusal(state, label) {
  try { assertPainted(state, label); return null; } catch (e) { return e.message; }
}

const browser = await chromium.launch({ args: LAUNCH_ARGS });

// ── A. First mount, captured at __screenReady ────────────────────────────────────
const SCREENS = String(args.screens ?? 'home,characters,trophies,settings,shop,opening').split(',');
for (const screen of SCREENS) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const hold = screen === 'opening' ? '&hold=120000' : '';
  await page.goto(`${BASE}/?screen=${screen}${hold}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  // The RAW condition every tool used before this change.
  await page.waitForFunction(
    `window.__screen === ${JSON.stringify(screen)} && window.__screenReady === true`,
    null, { timeout: 60_000 },
  );
  const early = await captureSettled(page, {
    wait: false, enforce: false, label: `${screen}-early`, path: `${OUT}/${screen}-early.png`,
  });
  const late = await captureSettled(page, {
    label: `${screen}-settled`, path: `${OUT}/${screen}-settled.png`,
  });
  const r = refusal(early.before, `${screen}-early`);
  rows.push({
    arrangement: 'A first-mount @__screenReady', screen,
    earlyOpacity: early.before.effectiveOpacity, earlyStdev: early.stats.stdev, earlyMean: early.stats.mean,
    lateOpacity: late.before.effectiveOpacity, lateStdev: late.stats.stdev, lateMean: late.stats.mean,
    settleMs: late.before.settleMs ?? null, refused: !!r,
  });
  console.log(`\n── A. ${screen} @ 1600x900 ──`);
  console.log(`   early   ${describe(early.before)}`);
  console.log(`           stdev ${early.stats.stdev}  mean ${early.stats.mean}  range ${early.stats.min}..${early.stats.max}`);
  console.log(`   settled ${describe(late.before)}`);
  console.log(`           stdev ${late.stats.stdev}  mean ${late.stats.mean}  range ${late.stats.min}..${late.stats.max}`);
  check(`A/${screen}: settled frame is accepted`, late.painted, describe(late.before).slice(0, 60));
  check(`A/${screen}: settled frame clears the floor`, late.stats.stdev >= FRAME_FLOOR,
    `stdev ${late.stats.stdev} >= ${FRAME_FLOOR}`);
  await page.close();
}

// ── B. Curtained navigation, captured at __screenReady ───────────────────────────
// This is the path in the commit message. `?screen=home` first-mounts home, then a
// real click on the gear navigates through `shell.ts:navigate` — curtain and all.
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/?screen=home`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await settleScreen(page, { label: 'home-before-nav' });

  const legs = [
    { to: 'settings', click: '[data-el="settings"]' },
    { to: 'trophies', click: '[data-go="trophies"]' },
  ];
  for (const leg of legs) {
    // Back to home first if we are not there.
    const at = await page.evaluate(() => window.__screen);
    if (at !== 'home') {
      await page.click('[data-el="back"], [data-el="done"]', { force: true }).catch(() => {});
      await page.waitForFunction('window.__screen === "home"', null, { timeout: 20_000 });
      await settleScreen(page, { label: 'home-return' });
    }
    // eslint-disable-next-line no-await-in-loop
    await page.click(leg.click, { force: true });
    // eslint-disable-next-line no-await-in-loop
    await page.waitForFunction(
      `window.__screen === ${JSON.stringify(leg.to)} && window.__screenReady === true`,
      null, { timeout: 20_000 },
    );
    // eslint-disable-next-line no-await-in-loop
    const early = await captureSettled(page, {
      wait: false, enforce: false, label: `nav-${leg.to}-early`, path: `${OUT}/nav-${leg.to}-early.png`,
    });
    // eslint-disable-next-line no-await-in-loop
    const late = await captureSettled(page, {
      label: `nav-${leg.to}-settled`, path: `${OUT}/nav-${leg.to}-settled.png`,
    });
    const r = refusal(early.before, `nav-${leg.to}-early`);
    rows.push({
      arrangement: 'B curtained-nav @__screenReady', screen: leg.to,
      earlyOpacity: early.before.effectiveOpacity, earlyStdev: early.stats.stdev, earlyMean: early.stats.mean,
      lateOpacity: late.before.effectiveOpacity, lateStdev: late.stats.stdev, lateMean: late.stats.mean,
      settleMs: late.before.settleMs ?? null, refused: !!r,
    });
    console.log(`\n── B. home -> ${leg.to} (real click, curtained) ──`);
    console.log(`   early   ${describe(early.before)}`);
    console.log(`           stdev ${early.stats.stdev}  mean ${early.stats.mean}`);
    console.log(`   settled ${describe(late.before)}`);
    console.log(`           stdev ${late.stats.stdev}  mean ${late.stats.mean}`);
    // THE KNOWN INPUT: a capture at __screenReady on a curtained navigation is,
    // by construction, mid-fade. The guard must refuse it.
    check(`B/${leg.to}: guard REFUSES the @__screenReady capture`, !!r, r ? r.slice(0, 96) : 'ACCEPTED — guard is blind');
    check(`B/${leg.to}: guard accepts the settled capture`, late.painted, '');
    // eslint-disable-next-line no-await-in-loop
    const backOk = await page.evaluate(() => !!document.querySelector('[data-el="back"], [data-el="done"]'));
    if (!backOk) break;
  }
  await page.close();
}

// ── C. The MARGIN, measured in the animation's own clock ─────────────────────────
//
// `menu_accept`'s viewport x screen loop waits on `window.__previewReady` and then
// sleeps 250 ms + 80 ms. Whether that is enough is a RACE, so asserting the outcome
// would assert this machine's speed. Instead an rAF trace inside the page records, at
// the first frame on which each flag is true, how far `fa-screen-in` has actually run.
// A margin of 260 ms is the whole animation; anything under it is a capture inside the
// fade, and the recorded value is the honest measure of how close each tool sat.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    window.__flagTrace = {};
    const snap = (key) => {
      if (window.__flagTrace[key]) return;
      const el = document.querySelector('.fa-stack > *');
      const anim = el ? el.getAnimations().find((a) => a.animationName === 'fa-screen-in') : null;
      const boot = document.getElementById('boot');
      window.__flagTrace[key] = {
        animMs: anim ? Math.round(Number(anim.currentTime)) : null,
        animState: anim ? anim.playState : 'none',
        opacity: el ? Number(getComputedStyle(el).opacity) : null,
        bootOpacity: boot ? Number(getComputedStyle(boot).opacity) : null,
      };
    };
    const rec = () => {
      if (window.__previewReady === true) snap('previewReady');
      if (window.__screenReady === true) snap('screenReady');
      requestAnimationFrame(rec);
    };
    requestAnimationFrame(rec);
  });
  for (const screen of ['home', 'characters', 'trophies', 'settings']) {
    // eslint-disable-next-line no-await-in-loop
    await page.goto(`${BASE}/?screen=${screen}`, { waitUntil: 'networkidle', timeout: 45_000 });
    // eslint-disable-next-line no-await-in-loop
    await page.waitForFunction('window.__previewReady === true', null, { timeout: 45_000 });
    // eslint-disable-next-line no-await-in-loop
    const trace = await page.evaluate(() => window.__flagTrace);
    // eslint-disable-next-line no-await-in-loop
    const settled = await settleScreen(page, { label: `C-${screen}` });
    // The geometry consequence, measured rather than argued: getBoundingClientRect
    // INCLUDES transforms, so a tap target read mid-animation is 0.992x its real size
    // and 10px low — against a 44px floor and a +/-1px safe-area tolerance.
    // eslint-disable-next-line no-await-in-loop
    const geom = await page.evaluate(() => {
      const el = document.querySelector('.fa-screen');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: +r.width.toFixed(2), h: +r.height.toFixed(2), top: +r.top.toFixed(2) };
    });
    const p = trace.previewReady ?? {};
    const s = trace.screenReady ?? {};
    console.log(`\n── C. ${screen}: how far into fa-screen-in each flag fires ──`);
    console.log(`   __screenReady   anim ${String(s.animMs ?? '-').padStart(4)}ms/260  state ${s.animState ?? '-'}`
      + `  screen opacity ${s.opacity ?? '-'}  boot ${s.bootOpacity ?? '-'}`);
    console.log(`   __previewReady  anim ${String(p.animMs ?? '-').padStart(4)}ms/260  state ${p.animState ?? '-'}`
      + `  screen opacity ${p.opacity ?? '-'}  boot ${p.bootOpacity ?? '-'}`);
    console.log(`   settled after ${settled.settleMs ?? '?'}ms of polling; .fa-screen rect ${geom ? `${geom.w}x${geom.h} top ${geom.top}` : 'n/a'}`);
    rows.push({
      arrangement: 'C flag-vs-animation', screen,
      earlyOpacity: s.opacity ?? p.opacity ?? null, earlyStdev: null, earlyMean: null,
      lateOpacity: 1, lateStdev: null, lateMean: null,
      settleMs: settled.settleMs ?? null,
      refused: (s.animMs !== null && s.animMs !== undefined && s.animMs < 260),
    });
    check(`C/${screen}: geometry is read at identity transform after settle`,
      !!geom && Math.abs(geom.top) < 0.5, geom ? `top ${geom.top}` : 'no .fa-screen');
  }
  await page.close();
}

// ── D. The frame-statistics floor, on a known-flat input ─────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/?screen=home`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await settleScreen(page, { label: 'floor-baseline' });
  // Force the curtain up by hand: this is exactly the frame a capture racing a
  // navigation would return, and it is FLAT, which is what the floor is for.
  await page.evaluate(() => document.querySelector('.fa-curtain')?.classList.add('is-on'));
  await page.waitForTimeout(400);
  const curtained = await captureSettled(page, {
    wait: false, enforce: false, label: 'curtain', path: `${OUT}/curtain.png`,
  });
  let floorRefused = false;
  try { assertFrame(curtained.stats, { label: 'curtain' }); } catch { floorRefused = true; }
  console.log(`\n── D. curtain frame ── stdev ${curtained.stats.stdev} mean ${curtained.stats.mean}`);
  check('D: frame floor REFUSES a curtain frame', floorRefused,
    `stdev ${curtained.stats.stdev} vs floor ${FRAME_FLOOR}`);
  check('D: paint guard also refuses it', !curtained.before.ok, curtained.before.why.join('; ').slice(0, 70));
  await page.close();
}

await browser.close();

console.log('\n── summary ─────────────────────────────────────────────────────────────');
console.log('arrangement                       screen        earlyOpac  earlyStdev  lateOpac  lateStdev  refused');
for (const r of rows) {
  const f = (v, n = 3) => (v === null || v === undefined ? '   -  ' : Number(v).toFixed(n));
  console.log(
    `${r.arrangement.padEnd(33)} ${String(r.screen).padEnd(13)} ${f(r.earlyOpacity).padStart(9)} `
    + `${f(r.earlyStdev, 2).padStart(11)} ${f(r.lateOpacity).padStart(9)} ${f(r.lateStdev, 2).padStart(10)}  ${r.refused ? 'YES' : 'no'}`,
  );
}
const settled = rows.map((r) => r.lateStdev).filter((v) => typeof v === 'number');
if (settled.length) {
  console.log(`\nlowest SETTLED frame stdev: ${Math.min(...settled)}  (floor is ${FRAME_FLOOR})`);
}
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail > 0 ? 1 : 0);
