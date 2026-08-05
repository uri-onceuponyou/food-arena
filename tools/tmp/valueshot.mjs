#!/usr/bin/env node
/**
 * THROWAWAY — a contact sheet of the eleven characters, so the value pass can be
 * JUDGED as pixels rather than as a table (`CLAUDE.md` non-negotiable 3).
 *
 * `valuescan --mode chars` writes MATTE and VALUE overlays only, which is exactly the
 * wrong artefact for the one question a number cannot answer: does the character still
 * read as the food it is, now that a tenth of it is near-black. So this shoots the
 * plain shipped preview render, all eleven, at the pitch `limbcheck` uses.
 *
 * Run it twice against the same probe, once per tree, and diff by eye:
 *   node tools/tmp/headserve.mjs -- node tools/tmp/valueshot.mjs --out shots/vl/sheet/base
 *   node tools/tmp/headserve.mjs --overlay src/characters -- node tools/tmp/valueshot.mjs --out shots/vl/sheet/after
 *
 * `--sheet` tiles the eleven into one PNG, because eleven separate Read calls is eleven
 * chances to compare the wrong pair.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? process.env.HEADSERVE_URL ?? 'http://localhost:5173';
const OUT = get('--out', 'shots/vl/sheet');
const IDS = get('--ids', 'hamburger,donut,taco,burrito,egg,lollipop,pizza,sushi,soup,waterbottle,hotdog').split(',');
const PITCH = Number(get('--pitch', 22));
const T = get('--t', '1.5');
const W = Number(get('--w', 360)), H = Number(get('--h', 460));

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const tiles = [];
try {
  for (const id of IDS) {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
    try {
      await page.goto(`${BASE}/preview.html?piece=character&id=${id}&shot=1&t=${T}&pitch=${PITCH}&anim=idle`,
        { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForFunction('window.__preview != null', null, { timeout: 120000 });
      await page.waitForTimeout(700);
      const buf = await page.screenshot({ path: join(OUT, `${id}.png`) });
      tiles.push({ id, buf });
      console.log(`shot ${id}`);
    } catch (e) {
      console.error(`✗ ${id}: ${e}`);
    } finally { await page.close(); }
  }
} finally { await browser.close(); }

// Tile 11 into a 4x3 sheet at the captured device scale.
if (tiles.length) {
  const meta = await sharp(tiles[0].buf).metadata();
  const tw = meta.width, th = meta.height, cols = 4, rows = Math.ceil(tiles.length / cols);
  await sharp({ create: { width: tw * cols, height: th * rows, channels: 3, background: '#101014' } })
    .composite(tiles.map((t, i) => ({ input: t.buf, left: (i % cols) * tw, top: Math.floor(i / cols) * th })))
    .png().toFile(join(OUT, 'sheet.png'));
  console.log(`wrote ${OUT}/sheet.png  (${cols}x${rows} of ${tw}x${th})`);
}
