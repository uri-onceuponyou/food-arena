#!/usr/bin/env node
/**
 * Does the running game actually publish `__matchDebug.qaSpawnInsideCover` at scan time?
 *
 * `tools/arena-scan.mjs` now aborts a sweep if that field is non-null, on the reasoning
 * that its own hand-copied COVER table is a SECOND source of truth and the game is the
 * first. A guard wired to a field that is always null would be worse than no guard at
 * all — it would look like protection. So this proves the signal on two known inputs:
 * open floor (must be null) and the centre of the NW stove island (must not be).
 *
 *   node tools/tmp/headserve.mjs -- bash -c 'SCAN_BASE=$PREVIEW_BASE node tools/tmp/livecover_probe.mjs'
 */
// Two known inputs: a point in the open, and the centre of the NW stove island.
import { chromium } from 'playwright';
const BASE = process.env.PREVIEW_BASE;
const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-gpu-sandbox'] });
let fail = 0;
for (const [label, x, y, want] of [['open floor (430,420)',430,420,null], ['inside NW stove island (430,300)',430,300,'not-null']]) {
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=${x}&py=${y}&fogRadius=993&simSpeed=0.02&pointerLock=0`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });
  await page.waitForTimeout(600);
  const has = await page.evaluate(() => typeof window.__matchDebug !== 'undefined');
  const v = await page.evaluate(() => window.__matchDebug?.qaSpawnInsideCover ?? null);
  const ok = has && (want === null ? v === null : v !== null);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}  __matchDebug present=${has}  qaSpawnInsideCover=${JSON.stringify(v)}`);
  if (!ok) fail++;
  await page.close();
}
await browser.close();
console.log(fail ? `\n  ${fail} FAILED` : '\n  live guard verified on both known inputs');
process.exit(fail ? 1 : 0);
