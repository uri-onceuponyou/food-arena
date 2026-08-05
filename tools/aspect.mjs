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
import { settleScreen, captureSettled, describe } from './tmp/settle.mjs';

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
      // ── THE VERDICT HERE IS NOT A PIXEL AND NOT A DOM RECT ────────────────────
      // `guaranteedRadiusUnits` comes out of `camera.ts`'s own fair-view solve, from the
      // canvas's client size and the rig's frustum. `fa-screen-in`'s opacity and its
      // `translateY(10px) scale(0.992)` cannot move it — unlike a `getBoundingClientRect`
      // battery, where that transform is a 0.352px error on a 44px minimum. So this
      // tool's NUMBER never needed the guard, and the 0.00wu gate has never been at risk
      // from the `__screenReady` defect.
      //
      // The 260 ms sleep was a different thing wearing the same clothes: its own comment
      // says it is there to let `#boot` fade, and `#boot` is a z-index 200 overlay over
      // the whole page. That only ever mattered for the optional `--out-dir` PNG, which
      // it could turn into the purple boot gradient. `settleScreen` makes it a condition
      // rather than a bet on this machine's speed; `soft` because a direct `?player=`
      // boot mounts no menu screen, so there may be nothing to settle beyond the overlay
      // and a throw would be wrong.
      const state = await settleScreen(page, { label: v.name, soft: true, timeout: 20_000 });
      if (!state?.ok) console.log(`  note ${v.name}: ${describe(state)}`);
      await page.waitForTimeout(260); // floor for the post chain's own warm-up
      const view = await page.evaluate(() => {
        const canvas = document.querySelector('#game canvas');
        return { ...window.__fairView(), canvasW: canvas.clientWidth, canvasH: canvas.clientHeight };
      });
      // Debug artefact only — never read back, never scored. Guarded for the sidecar and
      // the flat-frame floor, not enforced, because a masked 32:9 letterbox is a
      // legitimately low-variance frame and this gate must not fail on a screenshot.
      if (outDir) {
        await captureSettled(page, {
          path: `${outDir}/${v.name}.png`, label: v.name, tool: 'aspect',
          wait: false, enforce: false,
        });
      }
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
