#!/usr/bin/env node
/**
 * Targeted probe for Lollipop's Giant Lollipop ultimate. Drives Lollipop vs Egg,
 * holds the Giant Lollipop slot, waits on the `__vfxDebugGiantSlamCount` QA hook
 * (see match.ts) so the screenshot lands during the ~0.3-0.6s shockwave window
 * instead of guessing at timing with fixed-interval screenshots.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const outDir = process.argv[2] ?? '/tmp/giant-slam-probe';
const simSpeed = process.argv[3] ?? '1';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

async function run() {
  await mkdir(resolve(outDir), { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: 1400, height: 880 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGE ERROR', String(e)));

  await page.goto(`${BASE}/?simSpeed=${simSpeed}&player=lollipop&enemy=egg`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 45000 });
  await page.waitForTimeout(150);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await page.keyboard.press('Digit2'); // Giant Lollipop slot
  await page.mouse.down({ button: 'left' });

  for (let cast = 0; cast < 6; cast++) {
    try {
      await page.waitForFunction(
        (n) => (window.__vfxDebugGiantSlamCount ?? 0) > n,
        cast,
        { timeout: 15000 },
      );
    } catch {
      console.error(`cast ${cast}: never fired within timeout`);
      break;
    }
    // Grab a couple of frames through the shockwave's short life.
    await page.screenshot({ path: resolve(outDir, `cast${cast}_a.png`) });
    await page.waitForTimeout(120);
    await page.screenshot({ path: resolve(outDir, `cast${cast}_b.png`) });
    await page.waitForTimeout(200);
    await page.screenshot({ path: resolve(outDir, `cast${cast}_c.png`) });
    console.log(`cast ${cast} captured`);
  }

  await page.mouse.up({ button: 'left' });
  await browser.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
