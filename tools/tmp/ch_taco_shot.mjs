#!/usr/bin/env node
/**
 * ONE capture of Taco at the view Uri actually judges — the character-select HERO,
 * i.e. `charStage.ts`'s lobby camera (pitch 20, subjectFill 0.60, yaw sweeping
 * +/-22), NOT `preview.html?piece=character`.
 *
 * Why this exists rather than `tools/shoot.mjs --char taco`:
 *  • the preview harness frames at pitch 22 / fill 0.66 against a flat warm card,
 *    with no cyclorama, no podium and no lobby key — close, but not the frame the
 *    complaint came from, and `docs/LESSONS.md` §13 is the scar for judging a
 *    character in a harness whose figure/ground is not the shipped one;
 *  • the match camera is 58 degrees and `limbcheck` measures 22, where idle passes
 *    go 8/11 -> 0/11. The lobby is where Uri's rejects are written from ("in menu").
 *
 * ⚠️ It waits on `tools/tmp/settle.mjs`, never `window.__screenReady` — that flag is
 * set in the same tick the curtain drops and measured opacity is 0.000 when it flips.
 *
 * Usage (never the shared dev server):
 *   node tools/tmp/headserve.mjs --overlay src/characters/taco.ts -- \
 *     node tools/tmp/ch_taco_shot.mjs --out shots/ch/taco/after
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { settleScreen } from './settle.mjs';

const argv = process.argv;
const get = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
const OUT = get('--out', 'shots/ch/taco/shot');
const ID = get('--id', 'taco');

if (!BASE) {
  console.error('PREVIEW_BASE unset. Run it against a frozen snapshot, never :5173:');
  console.error('  node tools/tmp/headserve.mjs --overlay src/characters/taco.ts -- node tools/tmp/ch_taco_shot.mjs');
  process.exit(2);
}

const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ARGS });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console.log(`  [page ${m.type()}] ${m.text()}`); });

await page.goto(`${BASE}/?screen=characters`, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForFunction('window.__previewReady === true', null, { timeout: 90000 });
await settleScreen(page, { label: 'characters' });
await page.click(`.chars-card[data-char="${ID}"]`, { force: true });
await page.waitForTimeout(900);

const info = await page.evaluate(() => window.__charStage?.() ?? null);
console.log('charStage', JSON.stringify(info));

// The hero panel only — a full-viewport shot spends most of its pixels on the card
// grid, and the subject here is ~1/4 of the frame.
const hero = page.locator('.chars-hero');
await hero.screenshot({ path: join(OUT, `${ID}_hero.png`) });

// And the whole screen, because a per-part/isolated look cannot see a gestalt error
// (DECISIONS §39's blind spot: isolation removes the information needed to detect
// "these correct components compose something else"). Read BOTH.
await page.screenshot({ path: join(OUT, `${ID}_screen.png`) });

await browser.close();
console.log(`wrote ${OUT}/${ID}_hero.png and ${OUT}/${ID}_screen.png`);
