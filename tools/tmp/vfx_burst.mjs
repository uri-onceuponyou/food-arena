#!/usr/bin/env node
// Debug helper: fire one attack and capture a rapid burst of frames right after, so
// we can see a short-lived effect's full lifetime rather than guessing at one frame.
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
const weapon = Number(args.weapon ?? 1);
const outDir = args.outDir ?? 'shots/vfx/burst';
const simSpeed = Number(args.simSpeed ?? 1);
const w = Number(args.w ?? 1300);
const h = Number(args.h ?? 820);
const frames = Number(args.frames ?? 10);
const frameGapMs = Number(args.frameGapMs ?? 60);

// Screenshotting under this environment's software (SwiftShader) renderer can take
// anywhere from ~300ms to several REAL seconds per call. A naive burst loop that
// just calls page.screenshot() on an interval ends up measuring screenshot latency,
// not game time — freeze the canvas (neuter rAF) for the instant of each shot, then
// un-freeze and let the game actually run for `frameGapMs` before the next one, so
// each frame is a true snapshot of live state at that moment, not smeared by however
// long the pixel readback itself took.
async function freezeFrame(page) {
  await page.evaluate(() => {
    if (!window.__origRAF) window.__origRAF = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = () => 0;
  });
}
async function unfreezeFrame(page) {
  await page.evaluate(() => {
    if (window.__origRAF) window.requestAnimationFrame = window.__origRAF;
  });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.setDefaultTimeout(45000);
    page.on('pageerror', (err) => console.log('PAGEERROR:', err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') console.log('CONSOLE:', msg.type(), msg.text());
    });
    await page.goto(`${BASE}/?simSpeed=${simSpeed}&player=${player}&enemy=${enemy}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 20000 });

    await page.keyboard.down(String(weapon));
    await page.keyboard.up(String(weapon));
    await page.mouse.move(w * 0.62, h * 0.42);
    await page.mouse.down();
    // Close distance first — the AI enemy often kites at range rather than walking
    // into OUR melee reach on its own.
    await page.keyboard.down('KeyD');
    await page.keyboard.down('KeyW');

    await page.waitForFunction(() => (window.__vfxQaCounts?.meleeArc ?? 0) + (window.__vfxQaCounts?.impact ?? 0) + (window.__vfxQaCounts?.cast ?? 0) > 0, null, { timeout: 60000, polling: 50 });

    // Stop moving right before the capture burst — screenshotting under a software
    // (SwiftShader) renderer can take a while per frame, and `--simSpeed` scales
    // sim-time-per-real-second, so holding a move key through a slow screenshot call
    // visibly drags the character away from where a short-lived ground decal (e.g.
    // the melee arc, ~300ms sim-life) was actually anchored. Attack stays held.
    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyW');

    for (let i = 0; i < frames; i++) {
      // Frame 0 is captured IMMEDIATELY (no lead-in wait) so it lands as close as
      // possible to the detected event; every subsequent frame waits frameGapMs of
      // real (live, unfrozen) game time first, to sample the effect's decay curve.
      if (i > 0) await page.waitForTimeout(frameGapMs);
      await freezeFrame(page);
      await page.screenshot({ path: `${outDir}/f${String(i).padStart(2, '0')}.png`, timeout: 20000 });
      await unfreezeFrame(page);
    }

    const counts = await page.evaluate(() => window.__vfxQaCounts ?? null);
    await page.mouse.up();
    console.log(JSON.stringify(counts, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
