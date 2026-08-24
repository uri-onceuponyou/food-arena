#!/usr/bin/env node
/**
 * `mn_shots` — MENU PLATES at phone portrait AND phone landscape, settled.
 *
 * Uri: *"Menus/Homescreen VFX still doesn't look professional. It needs all elements
 * to look top notch."* That is a vibe until somebody puts the frames side by side, so
 * this is the eye half of turning it into named defects. The measuring half lives in
 * `tools/tmp/mn_occlude.mjs`. (This line said `mn_census.mjs` for one commit and NO SUCH
 * FILE EXISTS — a citation that rotted before it was ever true.)
 *
 * Why not reuse `lu_menus.mjs`: it is LANDSCAPE ONLY (844x390 / 667x375), it waits on
 * `window.__screenReady` plus a fixed 1400 ms sleep, and `settle.mjs`'s whole docblock
 * exists because that flag fires at animation time 0 of 260 ms with the screen at
 * opacity 0.000. Every capture here goes through `captureSettled`, which brackets the
 * shutter and refuses a frame that was not painted.
 *
 *   node tools/tmp/mn_shots.mjs --url '{URL}' --save tools/tmp/mn_before
 *   node tools/tmp/mn_shots.mjs --url '{URL}' --save ... --screens home,shop
 *   node tools/tmp/mn_shots.mjs --url '{URL}' --save ... --vp ph-portrait
 *
 * ⚠️ `--screens opening` is the TITLE CARD, which is boot-only: `?screen=opening` is in
 * `main.ts`'s ladder, and an UNKNOWN `?screen=` value also lands there silently. So
 * every capture asserts `window.__screen` is the screen that was asked for — without
 * that, a typo'd route produces a full green row measured on the title card
 * (`menu_accept.mjs` check 9 records that exact failure).
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { captureSettled, describe } from './settle.mjs';

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const VIEWPORTS = [
  // iPhone 14-class logical sizes. Portrait is where Uri holds the phone; landscape is
  // where the game is played, and both menu acceptance gates run at both.
  { tag: 'ph-portrait', w: 390, h: 844, touch: true },
  { tag: 'ph-land', w: 844, h: 390, touch: true },
  { tag: 'desk', w: 1600, h: 900, touch: false },
];

async function run() {
  const a = process.argv.slice(2);
  const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
  const BASE = (get('--url', process.env.PREVIEW_BASE) ?? '').replace(/\/$/, '');
  if (!BASE) { console.error('mn_shots: need --url or PREVIEW_BASE'); return 2; }
  const OUT = get('--save', 'tools/tmp/mn_shots');
  const screens = get('--screens', 'opening,home,shop,characters,trophies,settings').split(',').filter(Boolean);
  const vpFilter = get('--vp', '');
  const vps = vpFilter ? VIEWPORTS.filter((v) => vpFilter.split(',').includes(v.tag)) : VIEWPORTS;
  if (vps.length === 0) { console.error(`mn_shots: --vp ${vpFilter} matched NO viewport`); return 2; }
  if (screens.length === 0) { console.error('mn_shots: --screens matched nothing'); return 2; }

  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH });
  const rows = [];
  let bad = 0;
  try {
    for (const vp of vps) {
      const ctx = await browser.newContext({
        viewport: { width: vp.w, height: vp.h },
        hasTouch: vp.touch, isMobile: vp.touch, deviceScaleFactor: 1,
      });
      for (const s of screens) {
        const page = await ctx.newPage();
        const errs = [];
        page.on('pageerror', (e) => errs.push(String(e)));
        page.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`); });
        const path = `${OUT}/${vp.tag}--${s}.png`;
        let note = '';
        try {
          // 🚨 PIN THE TITLE CARD — IT AUTO-ADVANCES. `opening.ts` arms
          // `setTimeout(enter, holdMs())` on mount, and under SwiftShader the settle can
          // outlast the hold: three captures in this file's own first runs were labelled
          // `opening` and were actually the LOBBY. `holdMs()` reads `?hold=` for exactly
          // this. The route assertion below stays regardless — a pin that stops working
          // must go red, not quiet.
          const pin = s === 'opening' ? '&hold=900000' : '';
          await page.goto(`${BASE}/?screen=${s}${pin}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
          // The title card holds the first gesture, so it never "settles" past its own
          // infinite animations the way a mounted screen does; soft-wait it.
          const r = await captureSettled(page, { path, label: `${vp.tag}/${s}`, tool: 'mn_shots.mjs', enforce: false, settleTimeout: 60_000 });
          const got = await page.evaluate(() => window.__screen ?? null);
          if (got !== s && !(s === 'opening' && got === null)) { note = `ROUTE MISMATCH asked=${s} got=${got}`; bad++; }
          rows.push({ vp: vp.tag, screen: s, got, painted: r.painted, stdev: +r.stats.stdev.toFixed(2), mean: +r.stats.mean.toFixed(1), errs: errs.length, note });
          console.log(`  ${vp.tag.padEnd(12)} ${s.padEnd(11)} painted=${r.painted ? 'Y' : 'N'} stdev=${r.stats.stdev.toFixed(2)} mean=${r.stats.mean.toFixed(1)} errs=${errs.length} ${note}${r.painted ? '' : ` :: ${describe(r.before)}`}`);
        } catch (e) {
          bad++;
          rows.push({ vp: vp.tag, screen: s, error: String(e).slice(0, 200) });
          console.log(`  ${vp.tag.padEnd(12)} ${s.padEnd(11)} REFUSED :: ${String(e).slice(0, 160)}`);
        }
        await page.close();
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  await writeFile(`${OUT}/index.json`, JSON.stringify({ base: BASE, rows }, null, 2));
  console.log(`\nmn_shots: ${rows.length} plate(s) -> ${OUT}  (${bad} problem row(s))`);
  return 0;
}

const IS_MAIN = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (IS_MAIN) process.exit(await run());
