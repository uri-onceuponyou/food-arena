#!/usr/bin/env node
/**
 * Close-quarters probe: walks the player INTO melee range of the enemy and holds a
 * melee weapon, so we can inspect the swept-cone VFX up close (previous probes kept
 * the fighters far apart, where any ground VFX reads as a speck). Also watches for
 * the `slow`/`stun` status telegraphs by cycling weapon slots that inflict them.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const outDir = process.argv[2] ?? '/tmp/closeup-probe';
const query = process.argv[3] ?? '';
const simSpeed = process.argv[4] ?? '1';
const totalMs = Number(process.argv[5] ?? 16000);
const everyMs = Number(process.argv[6] ?? 500);
const weaponKey = process.argv[7] ?? 'Digit1';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

async function run() {
  await mkdir(resolve(outDir), { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: 1400, height: 880 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGE ERROR', String(e)));

  await page.goto(`${BASE}/?simSpeed=${simSpeed}${query}`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 45000 });
  await page.waitForTimeout(150);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.keyboard.press(weaponKey);
  // Charge straight at the enemy's spawn direction and keep the mouse aimed there,
  // holding the attack the whole time so we get in range fast and stay attacking.
  await page.mouse.move(box.x + box.width * 0.85, cy);
  await page.keyboard.down('KeyD');
  await page.mouse.down({ button: 'left' });

  let shot = 0;
  const start = Date.now();
  while (Date.now() - start < totalMs) {
    await page.waitForTimeout(everyMs);
    const enemyPos = await page.evaluate(() => {
      const el = document.querySelector('[data-el="float-enemy"]');
      if (!el || el.style.display === 'none') return null;
      const t = el.style.transform;
      const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(t);
      return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
    });
    if (enemyPos) await page.mouse.move(enemyPos.x, enemyPos.y + 40);
    const file = resolve(outDir, `t${String(shot).padStart(2, '0')}_${Date.now() - start}ms.png`);
    await page.screenshot({ path: file });
    console.log(`shot ${file}`);
    shot++;
  }

  await page.mouse.up({ button: 'left' });
  await page.keyboard.up('KeyD');
  await browser.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
