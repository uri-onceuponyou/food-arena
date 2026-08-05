#!/usr/bin/env node
/** Capture the PRE-fix state: fast-forward the match until the player (who never
 * moves without input, so they stay on the west spawn at 540 wu from centre) is
 * outside the shrinking safe radius and taking fog damage. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];
const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const out = resolve(process.argv[2] ?? 'shots/fog/before.png');
const hold = Number(process.argv[3] ?? 4200);

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(`${BASE}/?simSpeed=50&player=hamburger&enemy=donut`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 40000 });
// Wait for the fog to actually be biting: the west spawn sits 540 wu from centre, so
// the player starts losing HP the moment safeRadius drops below that.
await page.waitForFunction(() => {
  const t = document.querySelector('.hud-healthbar-text')?.textContent ?? '';
  const hp = Number(t.split('/')[0]);
  return Number.isFinite(hp) && hp < 92 && hp > 30;
}, null, { timeout: 90000 }).catch(() => console.log('WARN: HP condition not met'));
await page.waitForTimeout(hold);
await mkdir(dirname(out), { recursive: true });
await page.screenshot({ path: out });
const hp = await page.evaluate(() => document.querySelector('.hud-healthbar-text')?.textContent);
console.log('wrote', out, 'playerHP=', hp);
await browser.close();
