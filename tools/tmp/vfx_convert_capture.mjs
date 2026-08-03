#!/usr/bin/env node
// Capture proof screenshots for the bespoke per-weapon VFX conversions
// (hamburger.Tomato, waterbottle.Glass).
//
// `attacker` (the `player` side, so the camera centres on it) holds its weapon slot
// down and continuously re-aims the mouse at `target`'s on-screen floating health
// pill (`[data-el="float-enemy"]`, positioned every frame by `ui/hud.ts` — the same
// signal a human player's eye would track), while never moving itself. `target` is
// left fully passive. The AI-controlled target reliably closes distance on its own
// (verified separately against a stationary opponent), so we just need accurate aim,
// not a chase.
//
// Single sequential poll loop (not a concurrent aim task) — deliberately mirrors the
// exact structure already verified to work for the movement-chase debug script.
//
// Freezes requestAnimationFrame the instant the target counter flips, exactly like
// `tools/tmp/vfx_capture.mjs`, so a slow SwiftShader screenshot readback can't let a
// short-lived effect decay before the pixels are actually captured.
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
const attacker = args.attacker ?? 'hamburger';
const target = args.target ?? 'donut';
const weapon = Number(args.weapon ?? 2);
const out = args.out ?? 'shots/vfx/convert/tmp.png';
const simSpeed = Number(args.simSpeed ?? 6);
const holdMs = Number(args.holdMs ?? 60000);
// 'qa:<key>' waits on window.__vfxQaCounts[key]; anything else is read off `window`
// directly (e.g. __bespokeVfxDebugImpact / __bespokeVfxDebugCast).
const waitFor = args.waitFor ?? '__bespokeVfxDebugImpact';
const settleMs = Number(args.settleMs ?? 0);
const w = Number(args.w ?? 1300);
const h = Number(args.h ?? 820);
const pollMs = Number(args.pollMs ?? 100);

async function freezeFrame(page) {
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
}

function readCounter(page, wf) {
  return page.evaluate((key) => {
    if (key.startsWith('qa:')) return window.__vfxQaCounts?.[key.slice(3)] ?? 0;
    return window[key] ?? 0;
  }, wf);
}

async function main() {
  await mkdir(dirname(out), { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', (err) => console.log('PAGEERROR:', err.message));
    await page.goto(`${BASE}/?simSpeed=${simSpeed}&player=${attacker}&enemy=${target}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 15000 });

    await page.keyboard.down(String(weapon));
    await page.keyboard.up(String(weapon));
    await page.mouse.move(w * 0.6, h * 0.4);
    await page.mouse.down();

    const start = Date.now();
    let fired = false;
    while (Date.now() - start < holdMs) {
      const pt = await page.evaluate(() => window.__vfxDebugScreen?.enemy ?? null);
      if (pt) await page.mouse.move(pt.x, pt.y);

      const count = await readCounter(page, waitFor);
      if (count > 0) { fired = true; break; }

      const fighters = await page.evaluate(() => window.__vfxDebugFighters ?? null);
      if (fighters && (!fighters.player.alive || !fighters.enemy.alive)) break;

      await page.waitForTimeout(pollMs);
    }
    const elapsed = Date.now() - start;

    if (settleMs > 0) await page.waitForTimeout(settleMs);
    await page.mouse.up();
    await freezeFrame(page);
    await page.screenshot({ path: out });

    const counts = await page.evaluate(() => ({
      qa: window.__vfxQaCounts ?? null,
      bespokeProjectile: window.__bespokeVfxDebug ?? 0,
      bespokeCast: window.__bespokeVfxDebugCast ?? 0,
      bespokeImpact: window.__bespokeVfxDebugImpact ?? 0,
      fighters: window.__vfxDebugFighters ?? null,
    }));
    console.log(JSON.stringify({ out, fired, elapsedMs: elapsed, counts }, null, 2));
    if (!fired) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
