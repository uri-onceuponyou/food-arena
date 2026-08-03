#!/usr/bin/env node
/**
 * Drive the LIVE game with Playwright, walk the player into the grease puddle
 * (world (560, 900); spawn is (160, 500), so holding "move right + down" heads
 * straight for it — see `src/arena/kitchen.ts`'s `puddleSouth`), and screenshot the
 * exact frame the "you are standing in a puddle and moving" QA counter
 * (`window.__vfxQaCounts.puddleSplash`, added alongside the new splash VFX in
 * `src/game/vfx.ts`) first flips — proof the character-side slow tint/ring/splash
 * are actually live on a real standing-in-the-puddle character, not just compiling.
 *
 * Same "freeze rAF the instant the event fires, THEN screenshot" trick as
 * `tools/tmp/vfx_capture.mjs` — screenshot readback under this environment's
 * SwiftShader software renderer can take real seconds, long enough for a short-lived
 * effect to have already decayed by the time pixels are actually read back.
 *
 * Usage:
 *   node tools/tmp/slow_capture.mjs --out shots/slow/r1/character_slowed.png \
 *     [--simSpeed 3] [--holdMs 30000] [--player hamburger] [--enemy donut]
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

const args = parseArgs(process.argv);
const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const player = args.player ?? 'hamburger';
const enemy = args.enemy ?? 'donut';
const out = args.out ?? 'shots/slow/tmp.png';
const simSpeed = Number(args.simSpeed ?? 3);
const holdMs = Number(args.holdMs ?? 30000);
const w = Number(args.w ?? 1300);
const h = Number(args.h ?? 820);

async function freezeFrame(page) {
  await page.evaluate(() => {
    window.requestAnimationFrame = () => 0;
  });
}

async function main() {
  await mkdir(dirname(out), { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    await run(browser);
  } finally {
    await browser.close();
  }
}

async function run(browser) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => console.error('page error:', String(e)));

  const url = `${BASE}/?simSpeed=${simSpeed}&player=${player}&enemy=${enemy}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 15000 });

  // Player spawns at world (160, 500); the grease puddle is at (560, 900), radius 50
  // (see `kitchen.ts`'s `puddleSouth`). +x is KeyD, +y is KeyS (input.ts) — holding
  // both walks diagonally down-right, straight at it. Harmless if this also runs
  // through the game's countdown first; movement/attack are only forwarded once
  // `state.phase === 'playing'` (match.ts's `buildInput`).
  await page.keyboard.down('KeyD');
  await page.keyboard.down('KeyS');

  const start = Date.now();
  let fired = false;
  try {
    await page.waitForFunction(
      () => (window.__vfxQaCounts?.puddleSplash ?? 0) > 0,
      null,
      { timeout: holdMs, polling: 16 },
    );
    fired = true;
  } catch {
    fired = false;
  }
  const elapsed = Date.now() - start;

  // Stop input, then IMMEDIATELY freeze the canvas before the slow screenshot
  // readback gets a chance to let the effect decay (see the file header).
  await page.keyboard.up('KeyD');
  await page.keyboard.up('KeyS');
  await freezeFrame(page);
  await page.screenshot({ path: out });

  const counts = await page.evaluate(() => window.__vfxQaCounts ?? null);

  console.log(JSON.stringify({ out, fired, elapsedMs: elapsed, counts }, null, 2));
  if (!fired) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
