#!/usr/bin/env node
// Companion to vfx_convert_capture.mjs: here the BESPOKE weapon is on the
// AI-controlled `enemy` side and `player` is left fully passive (zero input) — the
// camera follows the player, so an enemy attack that lands frames up nicely around
// the camera-centred target. No aiming needed since the AI targets itself; this is
// purely for well-framed impact close-ups.
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
const player = args.player ?? 'donut';
const enemy = args.enemy ?? 'hamburger';
const out = args.out ?? 'shots/vfx/convert/tmp.png';
const simSpeed = Number(args.simSpeed ?? 6);
const holdMs = Number(args.holdMs ?? 60000);
const waitFor = args.waitFor ?? '__bespokeVfxDebugImpact';
const w = Number(args.w ?? 1300);
const h = Number(args.h ?? 820);

async function freezeFrame(page) {
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
}

async function main() {
  await mkdir(dirname(out), { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', (err) => console.log('PAGEERROR:', err.message));
    await page.goto(`${BASE}/?simSpeed=${simSpeed}&player=${player}&enemy=${enemy}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 15000 });

    const start = Date.now();
    let fired = false;
    try {
      await page.waitForFunction(
        (wf) => (window[wf] ?? 0) > 0,
        waitFor,
        { timeout: holdMs, polling: 20 },
      );
      fired = true;
    } catch { fired = false; }
    const elapsed = Date.now() - start;

    await freezeFrame(page);
    await page.screenshot({ path: out });

    const counts = await page.evaluate(() => ({
      qa: window.__vfxQaCounts ?? null,
      bespokeProjectile: window.__bespokeVfxDebug ?? 0,
      bespokeCast: window.__bespokeVfxDebugCast ?? 0,
      bespokeImpact: window.__bespokeVfxDebugImpact ?? 0,
    }));
    console.log(JSON.stringify({ out, fired, elapsedMs: elapsed, counts }, null, 2));
    if (!fired) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
