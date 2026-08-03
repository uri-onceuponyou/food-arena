#!/usr/bin/env node
import { chromium } from 'playwright';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

async function main() {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 650 } });
    page.on('pageerror', (err) => console.log('PAGEERROR:', err.message));
    const t0 = Date.now();
    await page.goto('http://localhost:5173/?simSpeed=3&player=lollipop&enemy=hamburger', { waitUntil: 'networkidle' });
    console.log('goto done', Date.now() - t0);
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 20000 });
    console.log('gameReady', Date.now() - t0);

    await page.keyboard.down('1');
    await page.keyboard.up('1');
    await page.mouse.move(620, 270);
    await page.mouse.down();
    console.log('input sent', Date.now() - t0);

    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000);
      const info = await page.evaluate(() => ({
        counts: window.__vfxQaCounts ?? null,
        timerText: document.querySelector('body')?.innerText?.match(/\d:\d\d/)?.[0] ?? null,
      }));
      console.log(i, Date.now() - t0, JSON.stringify(info));
    }
    await page.mouse.up();
  } finally {
    await browser.close();
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
