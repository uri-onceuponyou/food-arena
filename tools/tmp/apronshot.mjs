#!/usr/bin/env node
/**
 * Apron shot set — the LIVE game, shipped framing, player-centred, at three aspects.
 *
 * Every position is a legal player position (movement.ts clamps to [21, W-21] x
 * [21, H-21]) and every frame is what a player standing there actually sees. The whole
 * point of the apron is the EDGE frames, so the set is deliberately edge-heavy, with
 * `centre` as a control that should show no apron at all.
 *
 * `fogRadius=850` is MAX_SAFE_RADIUS, i.e. the fog fully open — it exists only to skip
 * the countdown so the HUD overlay is not sitting on top of the frame. `nw_fog` uses a
 * real closing radius to catch the death-zone case.
 *
 * Usage: node tools/tmp/apronshot.mjs --out shots/apron/rN [--only w_mid]
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]; if (!a.startsWith('--')) continue;
    const k = a.slice(2); const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true; else { out[k] = n; i++; }
  }
  return out;
}

const ASPECTS = {
  '4x3': { w: 1200, h: 900 },
  '16x9': { w: 1600, h: 900 },
  '21x9': { w: 1680, h: 720 },
};

/** name, px, py, aspect, fogRadius */
const SHOTS = [
  ['w_mid_4x3', 21, 500, '4x3', 850],
  ['w_mid_16x9', 21, 500, '16x9', 850],
  ['w_mid_21x9', 21, 500, '21x9', 850],
  ['n_mid_21x9', 700, 21, '21x9', 850],
  ['s_mid_21x9', 700, 979, '21x9', 850],
  ['nw_corner_21x9', 21, 21, '21x9', 850],
  ['se_corner_21x9', 1379, 979, '21x9', 850],
  ['spawn_21x9', 160, 500, '21x9', 850],
  ['centre_21x9', 700, 500, '21x9', 850],
  ['nw_fog_21x9', 21, 21, '21x9', 420],
];

const args = parseArgs(process.argv);
const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const outDir = resolve(args.out ?? 'shots/apron/tmp');
await mkdir(outDir, { recursive: true });
const only = typeof args.only === 'string' ? args.only.split(',') : null;

const browser = await chromium.launch({ args: LAUNCH_ARGS });
try {
  for (const [name, px, py, aspect, fogRadius] of SHOTS) {
    if (only && !only.some((o) => name.includes(o))) continue;
    const { w, h } = ASPECTS[aspect];
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(60000);
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
    const q = new URLSearchParams({ ...(args.apron === "0" ? { apron: "0" } : {}),
      player: args.player ?? 'hamburger',
      enemy: args.enemy ?? 'donut',
      simSpeed: String(args.simSpeed ?? 0.02),
      fogRadius: String(fogRadius),
      px: String(px), py: String(py),
    });
    await page.goto(`${BASE}/?${q}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 45000 });
    await page.waitForTimeout(Number(args.settle ?? 2200));
    await page.screenshot({ path: `${outDir}/${name}.png` });
    console.log(`wrote ${name}.png`);
    await page.close();
  }
} finally {
  await browser.close();
}
