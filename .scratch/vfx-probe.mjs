#!/usr/bin/env node
/**
 * Ad-hoc Playwright driver to reach a live-combat frame in the food-arena game.
 * Not part of the repo — scratch verification tool only.
 *
 * Drives WASD + held mouse-attack so the player closes on the AI and both sides
 * exchange hits, then grabs periodic screenshots so we can pick frames where VFX
 * are actually on screen (a passive screenshot almost never lands mid-hit).
 *
 * Usage: node /tmp/vfx-probe.mjs [outDir] [simSpeed] [totalMs] [everyMs]
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const outDir = process.argv[2] ?? '/tmp/vfx-probe';
const simSpeed = process.argv[3] ?? '3';
const totalMs = Number(process.argv[4] ?? 6000);
const everyMs = Number(process.argv[5] ?? 400);
const extraQuery = process.argv[7] ?? ''; // e.g. "&player=lollipop&enemy=egg"

const LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--enable-webgl',
  '--ignore-gpu-blocklist',
  '--disable-gpu-sandbox',
];

async function run() {
  await mkdir(resolve(outDir), { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: 1400, height: 880 }, deviceScaleFactor: 1 });

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });

  await page.goto(`${BASE}/?simSpeed=${simSpeed}${extraQuery}`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 45000 });
  await page.waitForTimeout(150);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  // Aim toward the enemy spawn (to the right of the player) so melee/ranged
  // weapons actually connect instead of firing into empty space.
  const aimX = box.x + box.width * 0.82;
  const aimY = cy;

  await page.mouse.move(aimX, aimY);
  const weaponSlot = process.argv[6];
  if (weaponSlot) await page.keyboard.press(weaponSlot);
  await page.keyboard.down('KeyD');
  await page.mouse.down({ button: 'left' });

  let shot = 0;
  const start = Date.now();
  while (Date.now() - start < totalMs) {
    await page.waitForTimeout(everyMs);
    // Keep re-aiming at the enemy's live screen position so ranged/melee attacks
    // keep connecting as both fighters close distance and move around.
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

  if (pageErrors.length) {
    console.error('PAGE ERRORS:', pageErrors.slice(0, 10));
  }

  await browser.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
