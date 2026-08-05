#!/usr/bin/env node
/**
 * The GEOMETRY half of the `__screenReady` defect, measured rather than argued.
 *
 * `tools/tmp/settle_validate.mjs` proves the guard refuses a mid-fade capture, in
 * PIXELS. But `menu_accept.mjs` and `menu_accept_portrait.mjs` do not mainly read
 * pixels — they read `getBoundingClientRect()`, and a rect INCLUDES transforms.
 * `.fa-screen` runs `fa-screen-in 0.26s` from `translateY(10px) scale(0.992)`, so
 * every rect read inside that window is 0.8% small and ~10px low. Against
 * `MIN_TAP - 0.5 = 43.5` and a `+/-1px` safe-area tolerance, that is not a rounding
 * detail: it is 6.4px of net downward bias on a 1px budget.
 *
 * This runs the EXACT two assertions those files make — `tap-targets>=44` and
 * `inside-safe-area`, copied from `menu_accept.mjs:auditScreen` so the numbers are
 * comparable — at four moments:
 *
 *   @screenReady      the flag, read the instant it flips. Measured at animation
 *                     time 0/260 ms on 4/4 screens, so this is not a rare worst
 *                     case; it is what the flag MEANS.
 *   @previewReady+220 `tools/shoot.mjs`'s wait before the fix, and the alarming one:
 *                     220 < 260, so it expired INSIDE the animation by construction
 *                     rather than by luck. That tool feeds the blind critic packets.
 *                     Frame statistics are captured here as well as geometry.
 *   @previewReady+250 the exact wait `menu_accept`'s viewport x screen loop used
 *                     before the fix. `animMs` is recorded at the moment of the
 *                     read, so the margin is reported instead of assumed.
 *   settled           `settleScreen()`, the new condition.
 *
 * A fixed sleep cannot be the answer here for the same reason it was not the answer
 * for the fade: the margin it needs depends on machine speed, and this file exists
 * to show what that margin actually was.
 *
 * Usage:
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/settle_geom_ab.mjs --url {URL}
 */

import { chromium } from 'playwright';
import { settleScreen, frameStats } from './settle.mjs';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

// Copied from menu_accept.mjs so this measures the same thing it does.
const VIEWPORTS = [
  { name: 'desktop-16:9', width: 1600, height: 900 },
  { name: 'laptop-16:10', width: 1280, height: 800 },
  { name: 'tablet-4:3', width: 1024, height: 768 },
  { name: 'phone-19.5:9', width: 844, height: 390 },
  { name: 'ultrawide-21:9', width: 2560, height: 1080 },
];
const SAFE = { t: 0, r: 44, b: 21, l: 44 };
const MIN_TAP = 44;

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2); const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true; else { out[k] = n; i++; }
  }
  return out;
}
const args = parseArgs(process.argv);
const BASE = args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const SCREENS = String(args.screens ?? 'home,characters,trophies,settings,shop').split(',');
const VPS = args.vp
  ? VIEWPORTS.filter((v) => String(args.vp).split(',').includes(v.name))
  : VIEWPORTS;

/** menu_accept.mjs:auditScreen's geometry, plus the animation clock at read time. */
const READ = ({ minTap, safe }) => {
  const de = document.documentElement;
  const vw = de.clientWidth; const vh = de.clientHeight;
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const controls = [...document.querySelectorAll(
    '.fa-root button:not([disabled]), .fa-root .fa-menuitem:not([disabled])',
  )].filter(visible);
  const scrollers = [...document.querySelectorAll('.fa-root .fa-scroll')].filter(visible);

  const rects = controls.map((el) => ({ el, r: el.getBoundingClientRect() }));
  const small = rects
    .filter(({ r }) => r.width < minTap - 0.5 || r.height < minTap - 0.5)
    .map(({ el, r }) => `${el.className.split(' ')[0]}[${el.textContent.trim().slice(0, 12)}] ${r.width.toFixed(2)}x${r.height.toFixed(2)}`);
  const outside = rects
    .filter(({ el }) => !el.closest('.fa-scroll'))
    .filter(({ r }) => r.left < safe.l - 1 || r.top < safe.t - 1
      || r.right > vw - safe.r + 1 || r.bottom > vh - safe.b + 1)
    .map(({ el, r }) => `${el.className.split(' ')[0]}[${el.textContent.trim().slice(0, 12)}] B${(vh - r.bottom).toFixed(2)}`)
    .concat(scrollers
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.left < safe.l - 1 || r.top < safe.t - 1
        || r.right > vw - safe.r + 1 || r.bottom > vh - safe.b + 1)
      .map(({ el, r }) => `scroller B${(vh - r.bottom).toFixed(2)}`));

  const screen = document.querySelector('.fa-stack > *');
  const anim = screen ? screen.getAnimations().find((a) => a.animationName === 'fa-screen-in') : null;
  const sr = screen ? screen.getBoundingClientRect() : null;
  const heights = rects.map(({ r }) => r.height).filter((h) => h > 0);

  return {
    controls: controls.length,
    small, outside,
    minH: heights.length ? +Math.min(...heights).toFixed(3) : null,
    // The smallest control that is SUPPOSED to be a 44px tap target — the one whose
    // margin against the 43.5 floor the transform eats.
    minH44: (() => {
      const near = heights.filter((h) => h >= 40 && h <= 60);
      return near.length ? +Math.min(...near).toFixed(3) : null;
    })(),
    screenTop: sr ? +sr.top.toFixed(3) : null,
    screenH: sr ? +sr.height.toFixed(3) : null,
    opacity: screen ? +Number(getComputedStyle(screen).opacity).toFixed(3) : null,
    transform: screen ? getComputedStyle(screen).transform : null,
    animMs: anim ? Math.round(Number(anim.currentTime)) : null,
    animState: anim ? anim.playState : 'none',
  };
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const rows = [];
let pass = 0; let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(56)} ${detail}`);
};

for (const vp of VPS) {
  for (const screen of SCREENS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
    // ⚠️ ON THE CONTEXT, NOT THE PAGE. `page.addInitScript` is page-scoped, so the
    // second page opened from this context inherited NO simulated notch — and every
    // control then failed a safe-area bound that was not being applied to it. The
    // first run of this file reported 7 `inside-safe-area` violations at
    // `@previewReady+220` and 0 when settled, which looks exactly like the defect
    // under investigation and was entirely my own setup. `docs/LESSONS.md` §10:
    // when a probe shows the game broken, suspect the probe's own setup first.
    await ctx.addInitScript((safe) => {
      addEventListener('DOMContentLoaded', () => {
        const s = document.documentElement.style;
        s.setProperty('--fa-safe-t', `${safe.t}px`);
        s.setProperty('--fa-safe-r', `${safe.r}px`);
        s.setProperty('--fa-safe-b', `${safe.b}px`);
        s.setProperty('--fa-safe-l', `${safe.l}px`);
      });
    }, SAFE);

    // AFTER the init script, so it is registered for this page too.
    const page = await ctx.newPage();
    await page.goto(`${BASE}/?screen=${screen}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // ── @screenReady: the flag, read the instant it flips ──────────────────────
    await page.waitForFunction(
      `window.__screen === ${JSON.stringify(screen)} && window.__screenReady === true`,
      null, { timeout: 60_000 },
    );
    const atFlag = await page.evaluate(READ, { minTap: MIN_TAP, safe: SAFE });

    // ── The two OLD conditions, on one fresh page ─────────────────────────────
    // A second page, because the first has already settled by now. Same context so
    // the module graph is warm and the timing is the SECOND-visit timing — which is
    // the fast case, i.e. the one the defect appeared on.
    //
    //   +220 ms  is `tools/shoot.mjs`'s wait, and it is SHORTER than the 260 ms
    //            animation. That tool feeds the blind critic packets.
    //   +250 ms  is `menu_accept.mjs`'s viewport x screen loop.
    const page2 = await ctx.newPage();
    await page2.goto(`${BASE}/?screen=${screen}`, { waitUntil: 'networkidle', timeout: 60_000 });
    await page2.waitForFunction('window.__previewReady === true', null, { timeout: 60_000 });
    await page2.waitForTimeout(220);
    const atShoot = await page2.evaluate(READ, { minTap: MIN_TAP, safe: SAFE });
    const shotBuf = await page2.screenshot({ timeout: 120_000 });
    await page2.waitForTimeout(30);
    const atOld = await page2.evaluate(READ, { minTap: MIN_TAP, safe: SAFE });
    const lateBuf = await page2.screenshot({ timeout: 120_000 });
    const shootStats = await frameStats(shotBuf);
    const shootLateStats = await frameStats(lateBuf);
    await page2.close();

    // ── settled: the new condition ─────────────────────────────────────────────
    await settleScreen(page, { label: `${screen}@${vp.name}` });
    const atSettled = await page.evaluate(READ, { minTap: MIN_TAP, safe: SAFE });

    rows.push({ vp: vp.name, screen, atFlag, atShoot, atOld, atSettled, shootStats, shootLateStats });
    console.log(`\n── ${screen} @ ${vp.name} (${vp.width}x${vp.height}, notch ${SAFE.l}/${SAFE.r}/${SAFE.b}) ──`);
    console.log(`   shoot.mjs's old wait (+220ms) frame: stdev ${shootStats.stdev} mean ${shootStats.mean}`
      + `   ·   30ms later: stdev ${shootLateStats.stdev} mean ${shootLateStats.mean}`);
    for (const [k, d] of [['@screenReady', atFlag], ['@previewReady+220', atShoot],
      ['@previewReady+250', atOld], ['settled', atSettled]]) {
      console.log(
        `   ${k.padEnd(18)} anim ${String(d.animMs ?? '-').padStart(4)}ms/260 ${String(d.animState).padEnd(8)}`
        + ` opac ${String(d.opacity ?? '-').padEnd(5)} top ${String(d.screenTop ?? '-').padStart(7)}`
        + ` minTapH ${String(d.minH44 ?? '-').padStart(7)}`
        + `  small ${d.small.length}  outside ${d.outside.length}`,
      );
      if (d.small.length) console.log(`                      small: ${d.small.slice(0, 3).join(' | ')}`);
      if (d.outside.length) console.log(`                      outside: ${d.outside.slice(0, 3).join(' | ')}`);
    }
    // The settled read is the TRUTH: identity transform, full opacity, no animation.
    check(`${screen}@${vp.name}: settled reads identity transform`,
      atSettled.transform === 'none' || atSettled.transform === 'matrix(1, 0, 0, 1, 0, 0)',
      atSettled.transform ?? 'no screen');
    check(`${screen}@${vp.name}: settled assertions agree with menu_accept`,
      atSettled.small.length === 0 && atSettled.outside.length === 0,
      `small ${atSettled.small.length}, outside ${atSettled.outside.length}`);

    await page.close();
    await ctx.close();
  }
}
await browser.close();

// ── The summary that answers "how much did the fade move the numbers" ─────────
console.log('\n── geometry bias, @screenReady vs settled ──────────────────────────────────');
console.log('screen@viewport                      minTapH early   settled    dH      dTop   small e/s  outside e/s');
let worstDH = 0; let worstTop = 0; let flippedSmall = 0; let flippedOutside = 0;
for (const r of rows) {
  const dH = (r.atFlag.minH44 !== null && r.atSettled.minH44 !== null)
    ? +(r.atFlag.minH44 - r.atSettled.minH44).toFixed(3) : null;
  const dTop = (r.atFlag.screenTop !== null && r.atSettled.screenTop !== null)
    ? +(r.atFlag.screenTop - r.atSettled.screenTop).toFixed(2) : null;
  if (dH !== null && Math.abs(dH) > Math.abs(worstDH)) worstDH = dH;
  if (dTop !== null && Math.abs(dTop) > Math.abs(worstTop)) worstTop = dTop;
  if (r.atFlag.small.length !== r.atSettled.small.length) flippedSmall++;
  if (r.atFlag.outside.length !== r.atSettled.outside.length) flippedOutside++;
  console.log(
    `${`${r.screen}@${r.vp}`.padEnd(36)} ${String(r.atFlag.minH44 ?? '-').padStart(8)}`
    + ` ${String(r.atSettled.minH44 ?? '-').padStart(9)} ${String(dH ?? '-').padStart(8)}`
    + ` ${String(dTop ?? '-').padStart(7)}`
    + `   ${r.atFlag.small.length}/${r.atSettled.small.length}`
    + `        ${r.atFlag.outside.length}/${r.atSettled.outside.length}`,
  );
}
const inFade = (k) => rows.filter((r) => r[k].animMs !== null && r[k].animState === 'running').length;
console.log(`\nworst tap-target height error   ${worstDH} px   (floor is ${MIN_TAP} - 0.5 = ${MIN_TAP - 0.5})`);
console.log(`worst screen-top error          ${worstTop} px   (safe-area tolerance is +/-1)`);
console.log(`assertion verdict FLIPPED       tap-targets ${flippedSmall}/${rows.length}`
  + `   ·   inside-safe-area ${flippedOutside}/${rows.length}`);
console.log(`still INSIDE fa-screen-in at    @screenReady ${inFade('atFlag')}/${rows.length}`
  + `   ·   +220ms (shoot.mjs) ${inFade('atShoot')}/${rows.length}`
  + `   ·   +250ms (menu_accept) ${inFade('atOld')}/${rows.length}`);
const shootPairs = rows.filter((r) => r.shootStats && r.shootLateStats);
if (shootPairs.length) {
  const worst = shootPairs.reduce((w, r) =>
    (r.shootLateStats.stdev - r.shootStats.stdev > w.shootLateStats.stdev - w.shootStats.stdev ? r : w));
  console.log(`worst shoot.mjs contrast loss   ${`${worst.screen}@${worst.vp}`}: `
    + `stdev ${worst.shootStats.stdev} at +220ms vs ${worst.shootLateStats.stdev} 30ms later`);
}
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
