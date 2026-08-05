#!/usr/bin/env node
/** Minimal screenshot driver for the icon contact sheet — the project's shoot.mjs
 *  waits on the game/preview ready flags, which this page does not raise. */
import { chromium } from 'playwright';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, v, i, a) => (v.startsWith('--') ? [...acc, [v.slice(2), a[i + 1]]] : acc), []),
);
const url = args.url ?? 'http://localhost:5173/tools/tmp/icons.html';
const out = args.out ?? 'shots/icons/sheet.png';
const w = Number(args.w ?? 1000);
const h = Number(args.h ?? 1400);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__iconsReady === true, null, { timeout: 20000 }).catch(() => {});
// Wait on the roster cache, not on a stopwatch: a fixed sleep raced the progressive
// renders and shipped a review plate with two characters still on the placeholder.
await page.waitForFunction(() => window.__thumbsReady === true, null, { timeout: 40000 }).catch(() => {});
await page.waitForTimeout(Number(args.wait ?? 1200));
await page.screenshot({ path: out, fullPage: args.full !== '0' });
if (errs.length) console.log('CONSOLE ERRORS:\n' + errs.join('\n'));
console.log('wrote', out);
await browser.close();
