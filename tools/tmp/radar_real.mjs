#!/usr/bin/env node
/**
 * Radar in the REAL game, not the DOM harness.
 *
 * The harness (`hud_harness.html`) is what the time-series probe measures, because the
 * radar is pure DOM/CSS and a sample there costs ~80 ms instead of ~40 s of SwiftShader
 * boot. This exists to prove that claim rather than assume it, and to judge the widget
 * in context: full frame at shipped framing plus a 1:1 crop of the widget.
 *
 *   node tools/tmp/radar_real.mjs --url <base> --out shots/radar/real --label before --fog 497
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const arg = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BASE = arg('--url', 'http://localhost:5173');
const OUT = arg('--out', 'shots/radar/real');
const LABEL = arg('--label', 'real');
const FOGS = (arg('--fog', '') || '').split(',').filter(Boolean);
const PX = arg('--px', '700');
const PY = arg('--py', '780');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));

for (const fog of FOGS) {
  const url = `${BASE}/?player=hamburger&enemy=donut&simSpeed=0.02&fogRadius=${fog}&px=${PX}&py=${PY}`;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, `${LABEL}-fog${fog}-frame.png`) });
  await (await page.$('.hud-radar')).screenshot({ path: join(OUT, `${LABEL}-fog${fog}-widget.png`) });
  const info = await page.evaluate(() => {
    const map = document.querySelector('.hud-radar-map').getBoundingClientRect();
    return { w: Math.round(map.width), h: Math.round(map.height), cap: document.querySelector('.hud-radar-cap').textContent };
  });
  console.log(`fog=${fog}  map=${info.w}x${info.h}  cap="${info.cap}"`);
}
if (errs.length) console.log('PAGE ERRORS:\n' + errs.join('\n'));
await browser.close();
