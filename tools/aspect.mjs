#!/usr/bin/env node
/**
 * Aspect-ratio isolation: shoot the live game at every supported display shape and
 * check that they all see the same arena.
 *
 * Viewport fairness is invisible in any single screenshot — the old rig framed a
 * constant WIDTH and quietly let the visible DEPTH collapse from 287 wu on a 4:3
 * tablet to 164 wu on a 21:9 display, which no amount of staring at one 16:9 frame
 * would reveal. The check that matters is a NUMBER, read out of the running game:
 * `window.__fairView()` (published by `src/render/camera.ts` in `frameMode: 'fair'`)
 * reports what the rig can actually see of the ground, and `guaranteedRadiusUnits`
 * — the visible radius in the WORST direction — must be identical on every device.
 *
 * Usage:
 *   node tools/aspect.mjs                        # 4 supported aspects + both masks
 *   node tools/aspect.mjs --out-dir shots/aspect # also write the PNGs
 *   node tools/aspect.mjs --player taco --enemy egg
 *
 * Exits non-zero if any two aspects disagree about how far a player can see.
 */

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';

const LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--enable-webgl',
  '--ignore-gpu-blocklist',
  '--disable-gpu-sandbox',
];

/** The shapes we ship on, plus the two that `Stage.resize()` is supposed to mask. */
const VIEWPORTS = [
  { name: '4x3', label: '4:3 iPad', w: 1200, h: 900, masked: false },
  { name: '16x9', label: '16:9 desktop', w: 1600, h: 900, masked: false },
  { name: '19.5x9', label: '19.5:9 phone', w: 1560, h: 720, masked: false },
  { name: '21x9', label: '21:9 ultrawide', w: 1680, h: 720, masked: false },
  { name: 'mask_32x9', label: '32:9 (masked)', w: 1920, h: 540, masked: true },
  { name: 'mask_portrait', label: 'portrait (masked)', w: 900, h: 1200, masked: true },
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
const url = `${BASE}/?player=${args.player ?? 'hamburger'}&enemy=${args.enemy ?? 'donut'}`;
const outDir = typeof args['out-dir'] === 'string' ? args['out-dir'] : null;
if (outDir) await mkdir(resolve(outDir), { recursive: true });

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const rows = [];

try {
  for (const v of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForFunction('window.__previewReady === true', null, { timeout: 45000 });
      await page.waitForTimeout(260); // let post settle / the boot overlay fade out
      const view = await page.evaluate(() => {
        const canvas = document.querySelector('#game canvas');
        return { ...window.__fairView(), canvasW: canvas.clientWidth, canvasH: canvas.clientHeight };
      });
      if (outDir) await page.screenshot({ path: `${outDir}/${v.name}.png`, timeout: 90_000 });
      rows.push({ ...v, ...view });
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

const f = (n, d = 0) => n.toFixed(d).padStart(6);
console.log('\nviewport            window     canvas     bind    near    far  halfW  GUARANTEED');
for (const r of rows) {
  console.log(
    `${r.label.padEnd(18)} ${String(r.w).padStart(4)}x${String(r.h).padEnd(4)}  ` +
    `${String(r.canvasW).padStart(4)}x${String(r.canvasH).padEnd(4)}  ${r.binding.padEnd(5)} ` +
    `${f(r.nearUnits)} ${f(r.farUnits)} ${f(r.halfWidthUnits)}  ${f(r.guaranteedRadiusUnits, 1)} wu`,
  );
}

const radii = rows.map((r) => r.guaranteedRadiusUnits);
const spread = Math.max(...radii) - Math.min(...radii);
console.log(`\nguaranteed radius spread across all viewports: ${spread.toFixed(2)} wu`);
if (spread > 0.5) {
  console.error('FAIL — displays do not see the same distance. Viewport fairness is broken.');
  process.exit(1);
}
console.log('PASS — every viewport is guaranteed the same view distance in every direction.');
