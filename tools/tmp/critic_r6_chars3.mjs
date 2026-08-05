/**
 * Character packet, pass 3 — with the instrument validated first.
 *
 * WHY: pass 2 shot at `preview.html?...&fill=0.88`. `subjectFill` frames on the
 * NOMINAL CHARACTER_HEIGHT and knows nothing about a character's WIDTH, so in a
 * 0.57-aspect frame donut and hamburger had their arms and feet clipped off by the
 * frame edge. Judging that packet would have scored the harness, not the cast
 * (docs/LESSONS.md §13).
 *
 * So: render wide at the default fill, take a matched `silhouette=1` matte at the
 * IDENTICAL camera, derive the subject bbox from the matte, assert it does not
 * touch any frame edge, and crop the colour frame to the bbox + margin at the
 * reference plates' aspect. Subject fill then matches the reference by measurement
 * instead of by hope.
 *
 *   node tools/tmp/headserve.mjs -- node tools/tmp/critic_r6_chars3.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const BASE = process.env.PREVIEW_BASE;
if (!BASE) { console.error('PREVIEW_BASE unset'); process.exit(2); }
const HMR_STUB = 'export const createHotContext=()=>({accept(){},dispose(){},prune(){},invalidate(){},on(){},send(){}});'
  + 'export function injectQuery(u){return u} export function removeStyle(){} export function updateStyle(){}';

const OUT = 'shots/critic-r6';
await mkdir(`${OUT}/chars_fit`, { recursive: true }); // final, cropped
await mkdir(`${OUT}/chars_raw`, { recursive: true }); // wide render + matte

const CHARS = ['donut', 'hamburger', 'hotdog', 'pizza', 'taco'];
const W = 1400, H = 1900;
const REF_ASPECT = 0.565;   // fullbody_fair plates run 0.52-0.60
const MARGIN = 0.07;        // fraction of subject height, all four sides

const browser = await chromium.launch({ args: ARGS });
async function shoot(url, out) {
  const p = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await p.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  await p.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForFunction('window.__previewReady === true', null, { timeout: 90000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: out, timeout: 120000 });
  await p.close();
}

let bad = 0;
for (const id of CHARS) {
  const q = `piece=character&id=${id}&anim=idle&t=0.6&shot=1`;
  const colour = `${OUT}/chars_raw/${id}.png`;
  const matte = `${OUT}/chars_raw/${id}.matte.png`;
  await shoot(`${BASE}/preview.html?${q}`, colour);
  await shoot(`${BASE}/preview.html?${q}&silhouette=1`, matte);

  // bbox of the black subject in the matte
  const { data, info } = await sharp(matte).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * ch;
      if (data[i] < 90 && data[i + 1] < 90 && data[i + 2] < 90) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  const sw = x1 - x0 + 1, sh = y1 - y0 + 1;
  const touches = (x0 <= 1 || y0 <= 1 || x1 >= info.width - 2 || y1 >= info.height - 2);
  if (touches) { bad++; }

  // crop: bbox + margin, then widen/heighten to REF_ASPECT, clamped inside the frame
  const m = Math.round(sh * MARGIN);
  let cy0 = Math.max(0, y0 - m), cy1 = Math.min(info.height - 1, y1 + m);
  let ch2 = cy1 - cy0 + 1;
  let cw = Math.round(ch2 * REF_ASPECT);
  if (cw < sw + 2 * m) { cw = sw + 2 * m; ch2 = Math.round(cw / REF_ASPECT); }
  const cx = Math.round((x0 + x1) / 2);
  let cx0 = Math.max(0, Math.min(info.width - cw, cx - Math.round(cw / 2)));
  cw = Math.min(cw, info.width - cx0);
  cy0 = Math.max(0, Math.min(info.height - ch2, cy0));
  ch2 = Math.min(ch2, info.height - cy0);

  await sharp(colour).extract({ left: cx0, top: cy0, width: cw, height: ch2 })
    .toFile(`${OUT}/chars_fit/${id}.png`);

  console.log(`${touches ? 'CLIPPED ' : 'ok      '} ${id.padEnd(11)} bbox ${sw}x${sh} @ (${x0},${y0}) `
    + `-> crop ${cw}x${ch2} aspect ${(cw / ch2).toFixed(3)} subjectFillH ${(sh / ch2).toFixed(3)}`);
}
await browser.close();
console.log(bad === 0 ? '\nNo character touches a frame edge — crop is safe.' : `\n${bad} CLIPPED IN THE WIDE RENDER`);
