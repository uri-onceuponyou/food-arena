#!/usr/bin/env node
/**
 * qv5_viewport — REFUTATION PROBE for the "Safari tab vs home-screen icon" cause.
 *
 * The claim under test (peer angle B): launching from a home-screen icon instead of a
 * Safari tab changes the character portrait's VERTICAL RESOLUTION by 27%, and that
 * environmental swing could be what Uri perceived as "the resolution is slightly lower".
 *
 * What this measures, per arm, on the CHARACTER SELECT screen (`?screen=characters`):
 *   - the char canvas DRAWING BUFFER (canvas.width/height)
 *   - the char canvas CSS RECT (getBoundingClientRect)
 *   - the RATIO between them on each axis — this is the only quantity that can be
 *     called "resolution": device pixels per CSS pixel. If it is equal across arms,
 *     nothing is softer, whatever the buffer size does.
 *   - the HERO's projected extent (`window.__charStage()` crown/feet) so a change in
 *     the hero's SIZE can be told apart from a change in its SHARPNESS.
 *
 * 🚨 DRIFT CONTROL (CLAUDE.md rule 4 / rule 6). Arm A is run TWICE, in two fresh pages.
 * Every number quoted afterwards is only believable if the A/A pair is EXACTLY zero.
 * A non-zero A/A means the instrument itself moves and no A/B delta from it means
 * anything.
 *
 * 🚨 NON-VACUITY (CLAUDE.md rule 6, `[].every()` returns true). The arm list and every
 * per-arm field set is asserted NON-EMPTY before any comparison runs, and the run exits
 * 2 if the canvas was not found or the hero readout was null.
 *
 * ⚠️ SwiftShader is not a phone. `deviceScaleFactor` is set to 3 and the viewport to the
 * real iPhone 15 Pro numbers, but the TIER (and therefore `pixelRatioCap`) is decided by
 * `quality.ts` from things a headless box reports differently. The ratio is reported, not
 * assumed, and it is only used as an A/B — the same instrument in both arms.
 *
 * Usage:
 *   PREVIEW_BASE=<url> node tools/tmp/qv5_viewport.mjs
 *   node tools/tmp/qv5_viewport.mjs --url <url>
 */
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const URL_BASE = arg('url', process.env.PREVIEW_BASE || '');
if (!URL_BASE) {
  console.error('qv5_viewport: no --url and no PREVIEW_BASE. Refusing to guess (aspect.mjs e0ece26 precedent).');
  process.exit(2);
}

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl'];

/**
 * The two arms the claim rests on, plus the A/A control.
 * 393x659  — Playwright's `iPhone 15 Pro` descriptor, i.e. a Safari TAB (chrome visible).
 * 393x852  — the full logical screen, i.e. a STANDALONE home-screen launch.
 */
const ARMS = [
  { name: 'A-tab-659',  w: 393, h: 659 },
  { name: 'A2-tab-659', w: 393, h: 659 },   // <- DRIFT CONTROL, identical to A
  { name: 'B-standalone-852', w: 393, h: 852 },
];

function collect() {
  // Page-side. Find the char stage's canvas: it is the canvas inside the holder the
  // MenuCharacterStage created (`position:absolute;inset:0`), and on the characters
  // screen it is the only WebGL canvas mounted.
  const canvases = Array.from(document.querySelectorAll('canvas'));
  const all = canvases.map((x) => ({
    styleW: x.style.width, styleH: x.style.height,
    w: x.width, h: x.height,
    rect: (() => { const r = x.getBoundingClientRect(); return { w: +r.width.toFixed(3), h: +r.height.toFixed(3) }; })(),
    ctx: !!x.getContext, parentStyle: x.parentElement ? x.parentElement.getAttribute('style') : null,
  }));
  // IDENTIFY BY CONSTRUCTION, NOT BY SIZE. `MenuCharacterStage` sets its canvas to
  // `display:block;width:100%;height:100%` and mounts it in a holder styled
  // `position:absolute;inset:0`. Picking "the biggest canvas" grabbed a different one
  // on the first run of this probe — recorded here because that is exactly the
  // "--selftest validates LOGIC, never where the tool is POINTED" trap.
  const cands = canvases.filter((x) => x.style.width === '100%' && x.style.height === '100%' && x.width > 0);
  if (cands.length !== 1) return { error: `expected exactly 1 charStage canvas, found ${cands.length}`, all };
  const c = { x: cands[0], r: cands[0].getBoundingClientRect() };
  const r = c.r;
  const hero = typeof window.__charStage === 'function' ? window.__charStage() : null;
  return {
    canvasCount: canvases.length,
    allCanvases: all,
    buffer: { w: c.x.width, h: c.x.height },
    css: { w: +r.width.toFixed(3), h: +r.height.toFixed(3) },
    ratioX: +(c.x.width / r.width).toFixed(4),
    ratioY: +(c.x.height / r.height).toFixed(4),
    dpr: window.devicePixelRatio,
    tier: window.__quality?.tier ?? window.__quality?.profile?.tier ?? null,
    hero,
    innerH: window.innerHeight,
    innerW: window.innerWidth,
  };
}

async function runArm(browser, arm) {
  const page = await browser.newPage({
    viewport: { width: arm.w, height: arm.h },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  });
  try {
    await page.goto(`${URL_BASE}/?screen=characters`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForFunction('window.__screen === "characters" && window.__screenReady === true', null, { timeout: 180_000 });
    // Settle: the screen-in animation is 260 ms and a ResizeObserver drives the stage's
    // own resize. Wait on the page's rendered state, then let the observer land.
    await page.waitForFunction(
      '(() => { const s = document.querySelector(".fa-screen"); return !!s && getComputedStyle(s).opacity === "1"; })()',
      null, { timeout: 60_000 },
    );
    await page.waitForTimeout(1200);
    const m = await page.evaluate(collect);
    return { arm: arm.name, vp: `${arm.w}x${arm.h}`, ...m };
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({ args: LAUNCH });
const rows = [];
try {
  for (const a of ARMS) rows.push(await runArm(browser, a));
} finally {
  await browser.close();
}

// ── NON-VACUITY: assert the set is non-empty and complete BEFORE comparing ──────────
if (rows.length !== ARMS.length) {
  console.error(`qv5: expected ${ARMS.length} arms, got ${rows.length}. VACUOUS — refusing to compare.`);
  process.exit(2);
}
for (const r of rows) {
  if (r.error || !r.buffer || !r.css) {
    console.error(`qv5: arm ${r.arm} produced no canvas readout (${r.error}). VACUOUS — refusing to compare.`);
    process.exit(2);
  }
  if (!r.hero || !r.hero.crown || !r.hero.feet) {
    console.error(`qv5: arm ${r.arm} produced no hero readout. VACUOUS — refusing to compare.`);
    process.exit(2);
  }
}

const fmt = (r) => {
  const hFrac = Math.abs(r.hero.feet.y - r.hero.crown.y);
  return {
    arm: r.arm,
    vp: r.vp,
    innerWH: `${r.innerW}x${r.innerH}`,
    dpr: r.dpr,
    tier: r.tier,
    buffer: `${r.buffer.w}x${r.buffer.h}`,
    css: `${r.css.w}x${r.css.h}`,
    ratioX: r.ratioX,
    ratioY: r.ratioY,
    heroHFrac: +hFrac.toFixed(4),
    heroPxTall: +(hFrac * r.buffer.h).toFixed(1),
    heroCssTall: +(hFrac * r.css.h).toFixed(1),
  };
};
const T = rows.map(fmt);
console.table(T);

// ── The drift control. Must be EXACTLY zero on every field. ────────────────────────
const a = T[0], a2 = T[1], b = T[2];
const driftFields = ['buffer', 'css', 'ratioX', 'ratioY', 'heroHFrac', 'heroPxTall', 'heroCssTall', 'dpr'];
if (driftFields.length === 0) { console.error('qv5: empty drift field set — VACUOUS'); process.exit(2); }
const drift = driftFields.filter((k) => String(a[k]) !== String(a2[k]));
console.log(`\nDRIFT CONTROL A vs A2 (identical viewport): ${drift.length === 0 ? 'ZERO — instrument is stable' : `NON-ZERO on ${drift.join(', ')} — NO DELTA BELOW IS BELIEVABLE`}`);
for (const k of drift) console.log(`   ${k}: ${a[k]}  vs  ${a2[k]}`);

console.log('\n── THE QUESTION THE CLAIM TURNS ON ────────────────────────────────');
console.log(`device px per CSS px, tab   : x=${a.ratioX}  y=${a.ratioY}`);
console.log(`device px per CSS px, stand.: x=${b.ratioX}  y=${b.ratioY}`);
console.log(`  -> SAME RENDER DENSITY? ${a.ratioX === b.ratioX && a.ratioY === b.ratioY ? 'YES — nothing is softer; the panel is a different SIZE, not a different RESOLUTION' : 'NO'}`);
console.log(`hero height, tab   : ${a.heroPxTall} device px  /  ${a.heroCssTall} CSS px`);
console.log(`hero height, stand.: ${b.heroPxTall} device px  /  ${b.heroCssTall} CSS px`);
const dPx = b.heroPxTall === 0 ? NaN : (b.heroPxTall / a.heroPxTall - 1) * 100;
const dCss = a.heroCssTall === 0 ? NaN : (b.heroCssTall / a.heroCssTall - 1) * 100;
console.log(`  -> hero grows ${dPx.toFixed(1)}% in device px and ${dCss.toFixed(1)}% in CSS px going tab->standalone.`);
console.log(`     If those two are EQUAL, the hero is only BIGGER/SMALLER, never SHARPER/SOFTER.`);
console.log(JSON.stringify(rows, null, 2));
