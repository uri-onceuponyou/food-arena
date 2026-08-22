#!/usr/bin/env node
/**
 * qv5_shot — the PNG half of `qv5_viewport.mjs` (CLAUDE.md rule 3: judge rendered pixels).
 *
 * Captures the character-select screen at the two viewports the peer's claim turns on,
 * plus the char canvas alone at each, so "the portrait got SOFTER" and "the portrait got
 * SMALLER" can be told apart by eye rather than argued from a buffer height.
 *
 * ⚠️ The canvas-only crops are captured at deviceScaleFactor 3 and are NOT upscaled, so
 * the two files differ in pixel dimensions exactly as the drawing buffers do. That is the
 * point: put them side by side and the question is whether the FIGURE is blurrier or just
 * occupying a shorter strip.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const URL_BASE = arg('url', process.env.PREVIEW_BASE || '');
if (!URL_BASE) { console.error('qv5_shot: no --url and no PREVIEW_BASE.'); process.exit(2); }
const OUT = join(process.cwd(), 'shots', 'qv5');
mkdirSync(OUT, { recursive: true });

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl'];
const ARMS = [
  { name: 'tab659', w: 393, h: 659 },
  { name: 'standalone852', w: 393, h: 852 },
];

const browser = await chromium.launch({ args: LAUNCH });
try {
  for (const arm of ARMS) {
    const page = await browser.newPage({
      viewport: { width: arm.w, height: arm.h }, deviceScaleFactor: 3, hasTouch: true, isMobile: true,
    });
    await page.goto(`${URL_BASE}/?screen=characters`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForFunction('window.__screen === "characters" && window.__screenReady === true', null, { timeout: 180_000 });
    await page.waitForFunction(
      '(() => { const s = document.querySelector(".fa-screen"); return !!s && getComputedStyle(s).opacity === "1"; })()',
      null, { timeout: 60_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(OUT, `full_${arm.name}.png`) });
    const c = page.locator('canvas').first();
    await c.screenshot({ path: join(OUT, `canvas_${arm.name}.png`) });
    const box = await c.boundingBox();
    console.log(arm.name, 'canvas css box', JSON.stringify(box));
    await page.close();
  }
} finally {
  await browser.close();
}
console.log('shots ->', OUT);
