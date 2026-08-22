#!/usr/bin/env node
/**
 * fq_sheet — every character's HEAD at the MATCH camera, at GAMEPLAY SUBJECT SCALE,
 * on one sheet, so "four of five present no visible eye" can be LOOKED AT.
 *
 * THROWAWAY, READ-ONLY on src/. Measurement instrument; changes no game code.
 *
 * Why not `fq_face --out` in a loop: half the cast does not NAME its eye meshes
 * (`egg`, `burrito`, `donut`, `lollipop`, `pizza` have no sclera name at all; `sushi`
 * names only a brow and a lash), so the ablation arm cannot be pointed at them and
 * `fq_face` correctly REFUSES rather than reporting a confident 0 px. This sheet asks
 * the question that needs no names: render it and look.
 *
 * ⚠️ THE SUBJECT SCALE IS CALIBRATED, NOT GUESSED. `subjectFill` is a fraction of the
 * VERTICAL frame and `CameraRig` fits metres with NO pitch compensation, so at pitch
 * 58 a fill of 0.11 puts only 5.67% of frame height on screen. `--fill 0.205` was
 * solved against the critic's gameplay figure (a 95x85 px subject box, 10-12% of frame
 * height) and lands hotdog at 106x97 px / 10.78%. Every tile here is at that fill.
 *
 * USE: PREVIEW_BASE=... node tools/tmp/fq_sheet.mjs --out shots/fq/sheet.png
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
const OUT = get('--out', 'shots/fq/sheet.png');
const PITCH = Number(get('--pitch', '58'));
const FILL = Number(get('--fill', '0.205'));
const W = Number(get('--w', '1600')), H = Number(get('--h', '900'));
const Z = Number(get('--zoom', '5'));
/**
 * `--head-pitch <rad>` rotates every rig's `head` Group about its own X axis, live,
 * with NO source edit. NEGATIVE is chin-UP (a point at +Z maps to y' = -z sin0, so a
 * positive angle drives the face DOWN).
 *
 * ⚠️ This is legitimate only because the preview FREEZES: `rig.ts`'s pose writer does
 * `j.head.rotation.set(0, headTurn, headTilt)` every update and would clobber X, but
 * a frozen preview calls `stage.render()` without `advance()`, so nothing re-poses
 * after the tweak. On a LIVE tree the same change has to be authored into the pose
 * writer, and the fact that X is hard-zeroed there is the finding, not a detail.
 */
const HEAD_PITCH = Number(get('--head-pitch', '0'));
const IDS = get('--ids', 'hotdog,hamburger,egg,soup,sushi,taco,pizza,burrito,donut,lollipop,waterbottle')
  .split(',').map(s => s.trim()).filter(Boolean);
if (!BASE) { console.error('need PREVIEW_BASE or --url'); process.exit(2); }

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const browser = await chromium.launch({ args: LAUNCH_ARGS });
async function shot(id, sil) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: HMR_STUB }));
  await page.goto(`${BASE}/preview.html?piece=character&id=${id}&pitch=${PITCH}&yaw=0&fill=${FILL}`
    + `&t=1.5&anim=idle&shot=1&bg=3d2b21${sil ? '&silhouette=1' : ''}`, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForFunction('window.__previewReady === true && !!window.__stage', null, { timeout: 180_000 });
  if (HEAD_PITCH !== 0) {
    const touched = await page.evaluate((rx) => {
      const s = window.__stage; let n = 0;
      s.scene.traverse((o) => { if (o.isGroup && o.name === 'head') { o.rotation.x = rx; n++; } });
      s.render(0);
      return n;
    }, HEAD_PITCH);
    // VACUITY: no `head` group => every tile would silently be the BASE frame and the
    // whole sweep would read "head pitch does nothing".
    if (!touched) { console.error(`!! ${id}: no 'head' group — refusing a vacuous head-pitch tile`); process.exit(4); }
  }
  const buf = await page.locator('canvas').first().screenshot();
  await page.close();
  return buf;
}

const tiles = [];
for (const id of IDS) {
  const [colour, silb] = [await shot(id, false), await shot(id, true)];
  const s = await sharp(silb).raw().toBuffer({ resolveWithObject: true });
  const ch = s.info.channels;
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < s.info.height; y++) for (let x = 0; x < s.info.width; x++) {
    const i = (y * s.info.width + x) * ch;
    if (luma(s.data[i], s.data[i + 1], s.data[i + 2]) >= 110) continue;
    n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  // VACUITY: an empty silhouette would crop the whole frame and look like a tile.
  if (n === 0) { console.error(`!! ${id}: silhouette EMPTY — refusing to emit a tile`); process.exit(4); }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  // Head = the top 55% of the subject box, which is where every head in this cast sits.
  const cw = Math.min(bw + 12, W - Math.max(0, x0 - 6));
  const chh = Math.min(Math.round(bh * 0.55) + 6, H - Math.max(0, y0 - 4));
  const tile = await sharp(colour).extract({ left: Math.max(0, x0 - 6), top: Math.max(0, y0 - 4), width: cw, height: chh })
    .resize(cw * Z, chh * Z, { kernel: 'nearest' }).toBuffer();
  const m = await sharp(tile).metadata();
  tiles.push({ id, tile, w: m.width, h: m.height, box: `${bw}x${bh}`, pct: (100 * bh / H).toFixed(2) });
  console.log(`${id.padEnd(12)} subject ${String(bw).padStart(4)}x${String(bh).padStart(3)} px  ${String(tiles.at(-1).pct).padStart(5)}% of frame H`);
}
await browser.close();

const COLS = 4, PAD = 10;
const cw = Math.max(...tiles.map(t => t.w)), chh = Math.max(...tiles.map(t => t.h));
const rows = Math.ceil(tiles.length / COLS);
const comp = tiles.map((t, i) => ({ input: t.tile, left: PAD + (i % COLS) * (cw + PAD), top: PAD + Math.floor(i / COLS) * (chh + PAD) }));
await mkdir(dirname(OUT), { recursive: true });
await sharp({ create: { width: PAD + COLS * (cw + PAD), height: PAD + rows * (chh + PAD), channels: 3, background: { r: 18, g: 18, b: 22 } } })
  .composite(comp).png().toFile(OUT);
console.log(`wrote ${OUT}  (${tiles.length} tiles, ${COLS} cols, order: ${tiles.map(t => t.id).join(', ')})`);
