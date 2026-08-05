#!/usr/bin/env node
/**
 * Does the badge-sized head crop still work after `thumbs.ts` was reframed?
 *
 * `src/ui/icons/index.ts` carries `.fa-ic-portrait--head img { transform: scale(1.8);
 * transform-origin: 50% 31% }` and says in its own comment that the 1.8 exists
 * "because thumbs.ts frames a full standing body". thumbs.ts no longer does. That rule
 * is used by the HUD's two fighter badges, by the trophy road's character nodes and by
 * home's next-reward chip — none of which this owner touches — so the question is
 * whether a change to the SOURCE has broken three consumers, and it is a question about
 * pixels, not about code.
 *
 * Shoots the trophy road (the densest user) and crops every character node at 8x.
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/portrait_crop_check.mjs --url {URL}
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const args = process.argv.slice(2);
const base = args[args.indexOf('--url') + 1] ?? process.env.PREVIEW_BASE;
const OUT = 'shots/chars_m';
await mkdir(OUT, { recursive: true });

const SEED = {
  name: 'Chef', wins: 40, losses: 22, xp: 4180, selected: 'hamburger',
  economy: {
    trophies: 3170, bestTrophies: 3170, coins: 4210, gems: 96,
    containers: { chest: 2, hamburgerBox: 1, pineappleBox: 0, redBox: 0, fireBox: 0 },
    claimed: [], unlocked: ['hamburger'], winsTowardChest: 1, lastMatch: null, seed: 12345, rolls: 7,
  },
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.addInitScript((p) => { try { localStorage.setItem('food-arena.profile.v1', JSON.stringify(p)); } catch { /* */ } }, SEED);
await page.goto(`${base}/?screen=trophies&hold=600000&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction('window.__screen === "trophies" && window.__screenReady === true', null, { timeout: 90000 });
await page.waitForFunction('window.__thumbsReady === true', null, { timeout: 300000 });
await page.waitForTimeout(1500);

const shot = `${OUT}/portraitcrop-trophies.png`;
await page.screenshot({ path: shot, timeout: 120_000 });
const rects = await page.evaluate(() => [...document.querySelectorAll('.fa-ic-portrait--head.has-render')]
  .map((n) => { const r = n.getBoundingClientRect(); return { id: n.dataset.portrait, x: r.x, y: r.y, w: r.width, h: r.height }; })
  .filter((r) => r.w >= 8 && r.h >= 8 && r.x >= 0 && r.y >= 0 && r.x + r.w <= innerWidth && r.y + r.h <= innerHeight));
await browser.close();

console.log(`${rects.length} head-cropped portraits on the trophy road`);
if (!rects.length) { console.log('none rendered — nothing to judge'); process.exit(0); }
const S = 8;
const tiles = [];
for (const r of rects.slice(0, 10)) {
  const w = Math.max(1, Math.round(r.w)), h = Math.max(1, Math.round(r.h));
  tiles.push({
    buf: await sharp(shot).extract({ left: Math.round(r.x), top: Math.round(r.y), width: w, height: h })
      .resize({ width: w * S, height: h * S, kernel: 'nearest' }).png().toBuffer(),
    w: w * S, h: h * S, id: r.id,
  });
  console.log(`  ${r.id.padEnd(12)} ${w}x${h} css px`);
}
const W = tiles.reduce((a, t) => a + t.w + 8, 0) + 8;
const H = Math.max(...tiles.map((t) => t.h)) + 16;
let x = 8;
await sharp({ create: { width: W, height: H, channels: 3, background: { r: 22, g: 15, b: 30 } } })
  .composite(tiles.map((t) => { const o = { input: t.buf, left: x, top: 8 }; x += t.w + 8; return o; }))
  .png().toFile(`${OUT}/portraitcrop-heads.png`);
console.log(`${OUT}/portraitcrop-heads.png`);
