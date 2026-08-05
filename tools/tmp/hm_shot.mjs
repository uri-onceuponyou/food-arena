#!/usr/bin/env node
/**
 * Capture the home screen (and character select, as the internal control) on a frozen
 * snapshot, N times, and report `hm_lang` on every frame.
 *
 * ── Why N times and not once ────────────────────────────────────────────────────
 * THE RESOLUTION FLOOR IS MEASURED HERE, not guessed. CLAUDE.md #10: every known floor
 * on this project was discovered AFTER somebody had already acted inside it. The menu
 * hero sways +/-22 degrees on a 15 s cycle and plays an idle animation, so two captures
 * of the SAME tree are not the same picture — the character's projected area moves, and
 * `flat%` / `edge%` move with it. Repeating the capture on ONE frozen snapshot and
 * reporting the max spread across repeats IS the drift control (preamble §5.2: the
 * question is not only "is it there?" but "is it the SAME?", answered with a control
 * rather than a guessed tolerance).
 *
 * Character select is captured alongside home in the SAME run on the SAME snapshot,
 * deliberately. It is the strongest reference this project has for a menu number: same
 * renderer, same lighting, same models, same capture path, same frame, and a blind
 * critic score of 7.00 against home's 5.17. A cross-product comparison against a Brawl
 * Stars plate cannot control for any of that; this can.
 *
 * Usage:
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/hm_shot.mjs --url {URL} \
 *     --out shots/home2/before --repeats 3
 */

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { settleScreen, captureSettled, waitForFaded } from './settle.mjs';
import { measure } from './hm_lang.mjs';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return dflt;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}

const BASE = arg('url', process.env.PREVIEW_BASE);
if (!BASE) { console.error('hm_shot: --url or PREVIEW_BASE required (snapshot only)'); process.exit(2); }
const OUT = String(arg('out', 'shots/home2/run'));
const REPEATS = Number(arg('repeats', 3));
const W = Number(arg('w', 1600));
const H = Number(arg('h', 900));
/** Which screens to shoot. `home` always; `select` is the control. */
const SCREENS = String(arg('screens', 'home,characters')).split(',');

const NORM_W = 1200;
async function langOf(buf) {
  const { data, info } = await sharp(buf).removeAlpha()
    .resize({ width: NORM_W, fit: 'inside', kernel: 'lanczos3' })
    .raw().toBuffer({ resolveWithObject: true });
  return measure(data, info.width, info.height);
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const rows = {};

for (const screen of SCREENS) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // `hold` keeps the opening card from auto-advancing under the capture; `?screen=`
  // skips straight past it. Both are already used by menu_accept.
  await page.goto(`${BASE}/?screen=${screen}&hold=600000`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  // Wait on the screen's NAME, never on "some screen is ready" — preamble §5.8.
  await page.waitForFunction(`window.__screen === ${JSON.stringify(screen)}`, null, { timeout: 90_000 });
  await settleScreen(page, { label: screen, timeout: 60_000 });
  // The lobby's tap hint fades on a 4.2 s timer and a capture that races it measures a
  // different picture each run. Home only; the selector simply is not there elsewhere.
  if (screen === 'home') await waitForFaded(page, '.fa-home .home-stage-hint', { timeout: 20_000 }).catch(() => {});

  const frames = [];
  for (let i = 0; i < REPEATS; i++) {
    const path = join(OUT, `${screen}-${i}.png`);
    // eslint-disable-next-line no-await-in-loop
    const { buf } = await captureSettled(page, { path, label: screen, tool: 'hm_shot', timeout: 120_000 });
    // eslint-disable-next-line no-await-in-loop
    frames.push(await langOf(buf));
    // A quarter of the sway period, so the repeats sample different poses rather than
    // the same one three times — which would report a floor of zero and be useless.
    // eslint-disable-next-line no-await-in-loop
    if (i < REPEATS - 1) await page.waitForTimeout(3700);
  }
  rows[screen] = { frames, errors };
  await page.close();
}

await browser.close();

const KEYS = ['flat', 'hues', 'edge', 'dark', 'chroma'];
const spread = (fs, k) => +(Math.max(...fs.map((f) => f[k])) - Math.min(...fs.map((f) => f[k]))).toFixed(2);
const mean = (fs, k) => +(fs.reduce((a, f) => a + f[k], 0) / fs.length).toFixed(2);

console.log(`\n  screen        n  ` + KEYS.map((k) => k.padStart(8)).join(''));
const summary = {};
for (const [screen, { frames, errors }] of Object.entries(rows)) {
  summary[screen] = {
    mean: Object.fromEntries(KEYS.map((k) => [k, mean(frames, k)])),
    floor: Object.fromEntries(KEYS.map((k) => [k, spread(frames, k)])),
    frames, errors,
  };
  console.log(`  ${screen.padEnd(12)} ${String(frames.length).padStart(2)}  `
    + KEYS.map((k) => String(mean(frames, k)).padStart(8)).join(''));
  console.log(`  ${'  +/- floor'.padEnd(12)}     `
    + KEYS.map((k) => String(spread(frames, k)).padStart(8)).join(''));
  if (errors.length) console.log(`  !! ${errors.length} page errors: ${errors[0]}`);
}

await writeFile(join(OUT, 'lang.json'), JSON.stringify({ tool: 'hm_shot', base: BASE, viewport: [W, H], repeats: REPEATS, summary }, null, 2));
console.log(`\nwrote ${join(OUT, 'lang.json')}`);
const anyErrors = Object.values(rows).some((r) => r.errors.length > 0);
process.exit(anyErrors ? 1 : 0);
