#!/usr/bin/env node
/**
 * The eleven roster renders, at their native 416x496, as files.
 *
 * `chars_metrics.mjs` shoots the SCREEN and crops cards out of it, so a desktop card is
 * 177x218 and a landscape-phone card is 86x74 — which is the right thing for judging the
 * screen and the wrong thing for judging a FACE. "Are the faces legible at thumbnail
 * size" is answered by looking at the thumbnail; "is this face framed correctly, and what
 * exactly is in the top corner strip the acceptance instrument keys its background from"
 * is answered by looking at the SOURCE.
 *
 * So this pulls the generated `data:` URLs straight out of the cards, writes them, and
 * writes a second copy with the framing overlaid:
 *
 *   * the FACE rect `thumbs.ts` published in `__thumbMeta` (green)
 *   * the HEAD rect (blue)
 *   * the SAFE WINDOW — the intersection of what the desktop, landscape-phone and
 *     portrait card crops all show (white dashes). A face outside this is a FACE-OUT at
 *     some viewport by construction.
 *   * the NAMEPLATE line — the highest the type reaches at any viewport (amber).
 *   * the TOP-CORNER STRIPS `chars_metrics` keys the background from (red), with the
 *     measured std and residual printed, so "the instrument's own precondition broke"
 *     stops being invisible.
 *
 *   node tools/tmp/thumbdump.mjs --url <snap> --out shots/roster/src --label before
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[i + 1]?.startsWith('--') === false ? process.argv[++i] : true;
}
const base = args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const outDir = args.out ?? 'shots/roster/src';
const label = args.label ?? 'run';

/** Measured off the real screen by `faceframe.mjs` — see `shots/roster/cards.json`. */
const SAFE = { x0: 0.0270, x1: 0.9731, y0: 0.0284, y1: 0.7442 };
const NAMEPLATE = 0.5636;

const SEED_PROFILE = {
  name: 'Chef', wins: 40, losses: 22, xp: 4180, selected: 'hamburger',
  economy: {
    trophies: 3170, bestTrophies: 3170, coins: 4210, gems: 96,
    containers: { chest: 2, hamburgerBox: 1, pineappleBox: 0, redBox: 0, fireBox: 0 },
    claimed: [], unlocked: ['hamburger'], winsTowardChest: 1, lastMatch: null, seed: 12345, rolls: 7,
  },
};

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.addInitScript((p) => { try { localStorage.setItem('food-arena.profile.v1', JSON.stringify(p)); } catch { /* private */ } }, SEED_PROFILE);
await page.goto(`${base}/?screen=characters&hold=600000&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction('window.__screen === "characters" && window.__screenReady === true', null, { timeout: 120000 });
// THE FLAG, never a clock (chars_metrics header): 28.9 s under SwiftShader.
await page.waitForFunction('window.__thumbsReady === true', null, { timeout: 300000 });

const data = await page.evaluate(() => {
  const out = [];
  for (const card of document.querySelectorAll('.chars-card[data-char]')) {
    const img = card.querySelector('.chars-card-render');
    out.push({ id: card.dataset.char, src: img?.src ?? null });
  }
  return { cards: out, meta: window.__thumbMeta ?? {} };
});
await browser.close();

const svgRect = (x, y, w, h, stroke, dash) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${stroke}" stroke-width="2"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;

const tiles = [];
const report = [];
for (const c of data.cards) {
  if (!c.src || !c.src.startsWith('data:image/png')) { console.log(`!! ${c.id}: no render`); continue; }
  const buf = Buffer.from(c.src.split(',')[1], 'base64');
  await writeFile(`${outDir}/${label}-${c.id}.png`, buf);

  const { data: px, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  // chars_metrics' background model, verbatim, so its bgStd can be attributed.
  const BROWS = 4, XL = Math.floor(W * 0.22), XR = Math.ceil(W * 0.78);
  let br = 0, bg = 0, bb = 0, bn = 0;
  for (let y = 0; y < BROWS; y++) for (let x = 0; x < W; x++) {
    if (x >= XL && x < XR) continue;
    const i = (y * W + x) * 3; br += px[i]; bg += px[i + 1]; bb += px[i + 2]; bn++;
  }
  br /= bn; bg /= bn; bb /= bn;
  let vsum = 0;
  for (let y = 0; y < BROWS; y++) for (let x = 0; x < W; x++) {
    if (x >= XL && x < XR) continue;
    const i = (y * W + x) * 3;
    vsum += (px[i] - br) ** 2 + (px[i + 1] - bg) ** 2 + (px[i + 2] - bb) ** 2;
  }
  const bstd = Math.sqrt(vsum / bn);
  // Which column does the contamination sit in? Names the offending side directly.
  let worstX = -1, worstD = 0;
  for (let y = 0; y < BROWS; y++) for (let x = 0; x < W; x++) {
    if (x >= XL && x < XR) continue;
    const i = (y * W + x) * 3;
    const d = Math.hypot(px[i] - br, px[i + 1] - bg, px[i + 2] - bb);
    if (d > worstD) { worstD = d; worstX = x; }
  }

  const m = data.meta[c.id];
  const overlays = [
    svgRect(SAFE.x0 * W, SAFE.y0 * H, (SAFE.x1 - SAFE.x0) * W, (SAFE.y1 - SAFE.y0) * H, '#FFFFFF', '10 6'),
    `<line x1="0" y1="${NAMEPLATE * H}" x2="${W}" y2="${NAMEPLATE * H}" stroke="#FFB020" stroke-width="2" stroke-dasharray="6 5"/>`,
    svgRect(0, 0, XL, BROWS * 6, '#FF2040', null),
    svgRect(XR, 0, W - XR, BROWS * 6, '#FF2040', null),
  ];
  if (m?.head) overlays.push(svgRect(m.head.x, m.head.y, m.head.w, m.head.h, '#4090FF', '6 4'));
  if (m?.face) overlays.push(svgRect(m.face.x, m.face.y, m.face.w, m.face.h, '#20E060', null));
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${overlays.join('')}</svg>`);
  const marked = await sharp(buf).composite([{ input: svg }]).png().toBuffer();
  await writeFile(`${outDir}/${label}-${c.id}-rects.png`, marked);

  tiles.push({ id: c.id, plain: buf, marked });
  report.push({
    id: c.id, bgStd: +bstd.toFixed(1), worstD: +worstD.toFixed(1), worstX,
    face: m?.face ? {
      x0: +(m.face.x / W).toFixed(3), x1: +((m.face.x + m.face.w) / W).toFixed(3),
      y0: +(m.face.y / H).toFixed(3), y1: +((m.face.y + m.face.h) / H).toFixed(3),
    } : null,
  });
}

const sheet = async (key, path, scale) => {
  const cols = 4, tw = Math.round(416 * scale), th = Math.round(496 * scale);
  const rows = Math.ceil(tiles.length / cols);
  const comps = [];
  for (let i = 0; i < tiles.length; i++) {
    comps.push({
      input: await sharp(tiles[i][key]).resize(tw, th).png().toBuffer(),
      left: (i % cols) * (tw + 6) + 3, top: Math.floor(i / cols) * (th + 6) + 3,
    });
  }
  await sharp({ create: { width: cols * (tw + 6), height: rows * (th + 6), channels: 3, background: { r: 26, g: 18, b: 36 } } })
    .composite(comps).png().toFile(path);
  return path;
};
console.log(`sheet ${await sheet('plain', `${outDir}/${label}-sheet.png`, 1)}`);
console.log(`sheet ${await sheet('marked', `${outDir}/${label}-sheet-rects.png`, 1)}`);

console.log('\n id            bgStd  worstDelta@x   face x[..]        y[..]      verdict');
for (const r of report) {
  const f = r.face;
  const bad = [];
  if (f) {
    if (f.x0 < SAFE.x0) bad.push('L'); if (f.x1 > SAFE.x1) bad.push('R');
    if (f.y0 < SAFE.y0) bad.push('T'); if (f.y1 > SAFE.y1) bad.push('B');
  }
  console.log(` ${r.id.padEnd(13)} ${String(r.bgStd).padStart(5)}  ${String(r.worstD).padStart(5)}@${String(r.worstX).padStart(3)}   `
    + (f ? `[${f.x0.toFixed(3)}..${f.x1.toFixed(3)}] [${f.y0.toFixed(3)}..${f.y1.toFixed(3)}]` : 'no face          ')
    + `  ${bad.length ? `FACE-OUT ${bad.join('')}` : 'ok'}${r.bgStd > 12 ? '   BG-KEY BROKEN' : ''}`);
}
