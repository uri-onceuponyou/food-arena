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

    await page.waitForFunction(() => (window.__vfxQaCounts?.meleeArc ?? 0) + (window.__vfxQaCounts?.impact ?? 0) + (window.__vfxQaCounts?.cast ?? 0) > 0, null, { timeout: 60000, polling: 50 });

    for (let i = 0; i < frames; i++) {
      await page.screenshot({ path: `${outDir}/f${String(i).padStart(2, '0')}.png`, timeout: 20000 });
      await page.waitForTimeout(frameGapMs);
    }

    const counts = await page.evaluate(() => window.__vfxQaCounts ?? null);
    await page.mouse.up();
    console.log(JSON.stringify(counts, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
