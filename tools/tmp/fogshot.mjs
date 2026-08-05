#!/usr/bin/env node
/**
 * Closing-fog screenshot driver.
 *
 * The fog boundary shrinks continuously over a 3-minute match, so "shoot it at
 * r=300 from just outside" is impossible to hit by waiting. `match.ts` exposes
 * QA-only `?fogRadius=&px=&py=` overrides; this drives them and captures at real
 * gameplay framing from the LIVE game (never preview.html).
 *
 * Usage:
 *   node tools/tmp/fogshot.mjs --fogRadius 300 --px 700 --py 120 --out shots/x.png
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

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

const args = parseArgs(process.argv);
const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const w = Number(args.w ?? 1600), h = Number(args.h ?? 900);
const jobs = args.batch ? JSON.parse(args.batch) : [{
  fogRadius: args.fogRadius, px: args.px, py: args.py, out: args.out,
}];

async function main() {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    for (const job of jobs) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      page.setDefaultTimeout(60000);
      page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
      page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text()); });
      const q = new URLSearchParams({
        player: args.player ?? 'hamburger',
        enemy: args.enemy ?? 'donut',
        simSpeed: String(args.simSpeed ?? 0.02),
        fogRadius: String(job.fogRadius ?? 400),
      });
      if (job.px !== undefined) q.set('px', String(job.px));
      if (job.py !== undefined) q.set('py', String(job.py));
      await page.goto(`${BASE}/?${q}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 40000 });
      // Let a few frames land so pooled VFX / CSS animations settle.
      await page.waitForTimeout(Number(args.settle ?? 2500));
      const out = resolve(job.out);
      await mkdir(dirname(out), { recursive: true });
      await page.screenshot({ path: out });
      const probe = await page.evaluate(() => {
        const g = document.querySelector('.hud-zone-value');
        const l = document.querySelector('.hud-zone-label');
        return { label: l?.textContent, value: g?.textContent };
      });
      console.log(`wrote ${job.out}  [${probe.label} | ${probe.value}]`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
main();
