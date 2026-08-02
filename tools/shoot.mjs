#!/usr/bin/env node
/**
 * Screenshot a preview URL with a real GPU-backed browser.
 *
 * Critics must judge rendered pixels, never a description, so this is load-bearing
 * infrastructure rather than a convenience script.
 *
 * Usage:
 *   node tools/shoot.mjs --url "<url>" --out shots/x.png [--w 1200] [--h 900]
 *   node tools/shoot.mjs --batch batch.json      # [{url, out, w, h}, ...]
 *   node tools/shoot.mjs --char hamburger --out-dir shots/hamburger
 *
 * `--char` renders the standard character review set: 3 animation states x 4
 * orbit angles, all at a frozen animation time so runs are reproducible.
 */

import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';

// Headless Chromium needs these to get a working WebGL2 context.
const LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--enable-webgl',
  '--ignore-gpu-blocklist',
  '--disable-gpu-sandbox',
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

/** The standard review set for a character piece. */
function characterShots(id, outDir) {
  const states = ['idle', 'run', 'attack'];
  const angles = [0, 45, 135, 210];
  const jobs = [];
  for (const anim of states) {
    for (const yaw of angles) {
      // Freeze mid-motion: idle at a breath peak, run mid-stride, attack at impact.
      const t = anim === 'attack' ? 0.22 : anim === 'run' ? 1.07 : 1.5;
      jobs.push({
        url: `${BASE}/preview.html?piece=character&id=${id}&anim=${anim}&yaw=${yaw}&t=${t}&shot=1`,
        out: `${outDir}/${anim}_${yaw}.png`,
        w: 900, h: 1100,
      });
    }
  }
  // One tall hero shot for silhouette review.
  jobs.push({
    url: `${BASE}/preview.html?piece=character&id=${id}&anim=idle&yaw=20&t=1.5&shot=1`,
    out: `${outDir}/hero.png`,
    w: 1200, h: 1500,
  });
  return jobs;
}

async function run() {
  const args = parseArgs(process.argv);
  let jobs = [];

  if (args.batch) {
    jobs = JSON.parse(await readFile(args.batch, 'utf8'));
  } else if (args.char) {
    jobs = characterShots(args.char, args['out-dir'] ?? `shots/${args.char}`);
  } else if (args.url) {
    jobs = [{
      url: args.url,
      out: args.out ?? 'shots/shot.png',
      w: Number(args.w ?? 1200),
      h: Number(args.h ?? 900),
    }];
  } else {
    console.error('Need --url, --batch or --char. See header for usage.');
    process.exit(2);
  }

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const results = [];
  let failures = 0;

  try {
    for (const job of jobs) {
      const w = Number(job.w ?? 1200);
      const h = Number(job.h ?? 900);
      // SwiftShader is CPU-rasterised, so cost scales with total pixels. Drop to 1x
      // on large viewports — at 2x a 1200x1500 shot blows past the screenshot timeout.
      const scale = w * h > 1_100_000 ? 1 : 2;
      const page = await browser.newPage({
        viewport: { width: w, height: h },
        deviceScaleFactor: scale,
      });

      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

      try {
        await page.goto(job.url, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForFunction('window.__previewReady === true', null, { timeout: 45000 });
        // Let post-processing settle.
        await page.waitForTimeout(220);

        const info = await page.evaluate(() => window.__preview?.info?.() ?? null);

        await mkdir(dirname(resolve(job.out)), { recursive: true });
        await page.screenshot({ path: job.out, timeout: 90_000 });
        results.push({ out: job.out, ok: true, info, errors });
        console.log(`✓ ${job.out}${info?.height ? `  (h=${info.height}m)` : ''}`);
      } catch (err) {
        failures++;
        results.push({ out: job.out, ok: false, error: String(err), errors });
        console.error(`✗ ${job.out}\n  ${err}`);
        if (errors.length) console.error(`  page errors: ${errors.slice(0, 3).join(' | ')}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  if (args.report) {
    await writeFile(args.report, JSON.stringify(results, null, 2));
  }
  if (failures > 0) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
