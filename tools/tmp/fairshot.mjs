#!/usr/bin/env node
/**
 * TEMP (range-retune verification): shoot the live game past the countdown so the
 * countdown badge is not covering the player's head, and report the player's ground
 * screen position plus the fair-view numbers alongside the shot.
 *
 * node tools/tmp/fairshot.mjs --out shots/x.png --w 1600 --h 900 --wait 8000
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
  else { args[a.slice(2)] = n; i++; }
}

const w = Number(args.w ?? 1600);
const h = Number(args.h ?? 900);
const out = args.out ?? 'shots/tmp/fairshot.png';
const waitMs = Number(args.wait ?? 8000);
const url = `${BASE}/?player=${args.player ?? 'hamburger'}&enemy=${args.enemy ?? 'donut'}`;

const browser = await chromium.launch({ args: LAUNCH_ARGS });
try {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForFunction('window.__previewReady === true', null, { timeout: 45000 });
  await page.waitForTimeout(waitMs);
  const info = await page.evaluate(() => ({
    fair: window.__fairView(),
    playerScreen: window.__vfxDebugScreen?.player ?? null,
    phase: document.querySelector('#hud')?.textContent?.slice(0, 40) ?? null,
  }));
  await mkdir(dirname(resolve(out)), { recursive: true });
  await page.screenshot({ path: out, timeout: 90_000 });
  console.log(JSON.stringify(info, null, 2));
  console.log(`✓ ${out}`);
  await page.close();
} finally {
  await browser.close();
}
