#!/usr/bin/env node
/**
 * GX_CHARS_FG — figure/ground of each fighter at the MATCH camera, on an EXACT cast matte.
 *
 * Offline: reads what `gx_chars_cap.mjs --set match6|match2` wrote (`<tag>_canvas.png`, the
 * shipped post-chain frame read off the GL canvas, i.e. no DOM HUD; `<tag>_matte.png`, the
 * two-clear-colour cast matte; `<tag>.json`, per-cast bboxes).
 *
 * Per fighter: figure = matte AND its own bbox (bboxes come from per-cast mattes; a pixel
 * inside two boxes is dropped from both). Surround = a ring 0.5x the bbox's larger side
 * around the bbox, minus the matte. Reported:
 *   L     mean luma (Rec.709 on the gamma-encoded value — the definition `preview.ts` and
 *         `charStage.ts` quote, so numbers compare)
 *   dL    figure - surround
 *   hue   circular mean hue of chromatic px (HSL s >= 0.15, `arena-scan`'s GREY_GATE),
 *         saturation-weighted; dHue = circular distance figure vs surround
 *   inBand share of the figure's chromatic px within +-20 deg of the SURROUND's hue
 *
 * Known-bad controls: SWAP (figure vs itself must give dL = 0 and dHue = 0); NONEMPTY (a
 * fighter with < 50 matte px is reported and skipped, never averaged in).
 *
 *   node tools/tmp/gx_chars_fg.mjs shots/rv/audit/chars/cap/match6 A_t0 A_t1 ...
 */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const [, , dir, ...tags] = process.argv;

function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return { h: 0, s: 0, l };
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return { h, s, l };
}
const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const cdist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

function stats(rgb, idx) {
  let n = 0, L = 0, sx = 0, sy = 0, S = 0, chrom = 0;
  const hues = [];
  for (const i of idx) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    L += luma(r, g, b); n++;
    const q = hsl(r, g, b); S += q.s;
    if (q.s >= 0.15) { chrom++; const a = (q.h * Math.PI) / 180; sx += Math.cos(a) * q.s; sy += Math.sin(a) * q.s; hues.push(q.h); }
  }
  const hue = (Math.atan2(sy, sx) * 180 / Math.PI + 360) % 360;
  // best 35 deg window over this set
  const hist = new Float64Array(360);
  for (const h of hues) hist[Math.min(359, Math.floor(h))]++;
  let best = 0, at = 0;
  for (let s0 = 0; s0 < 360; s0++) { let acc = 0; for (let k = 0; k < 35; k++) acc += hist[(s0 + k) % 360]; if (acc > best) { best = acc; at = s0; } }
  return { n, L: L / Math.max(1, n), S: S / Math.max(1, n), chromShare: chrom / Math.max(1, n), hue, hues,
    win35: hues.length ? best / hues.length : 0, win35From: at };
}

async function one(tag) {
  const meta = JSON.parse(await readFile(join(dir, `${tag}.json`), 'utf8'));
  const { data: rgb, info } = await sharp(join(dir, `${tag}_canvas.png`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: m } = await sharp(join(dir, `${tag}_matte.png`)).extractChannel(0).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const boxes = meta.casts.filter((c) => c.bbox).map((c) => ({ name: c.name.replace('character:', ''), b: c.bbox, px: c.px }));
  const owner = new Int16Array(W * H).fill(-1);
  boxes.forEach((bx, k) => {
    const [x, y, w, h] = bx.b;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const j = yy * W + xx; owner[j] = owner[j] === -1 ? k : -2;
    }
  });
  const rows = [];
  const allCast = [];
  for (let j = 0; j < W * H; j++) if (m[j] > 127) allCast.push(j);
  boxes.forEach((bx, k) => {
    const [x, y, w, h] = bx.b;
    const fig = [];
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const j = yy * W + xx; if (m[j] > 127 && owner[j] === k) fig.push(j);
    }
    if (fig.length < 50) { rows.push({ name: bx.name, skipped: `only ${fig.length} figure px` }); return; }
    const pad = Math.round(Math.max(w, h) * 0.5);
    const sur = [];
    for (let yy = Math.max(0, y - pad); yy < Math.min(H, y + h + pad); yy++) for (let xx = Math.max(0, x - pad); xx < Math.min(W, x + w + pad); xx++) {
      const inside = xx >= x && xx < x + w && yy >= y && yy < y + h;
      const j = yy * W + xx;
      if (!inside && m[j] <= 127) sur.push(j);
    }
    const F = stats(rgb, fig), G = stats(rgb, sur);
    const self = stats(rgb, fig);
    const inBand = F.hues.length ? F.hues.filter((hh) => cdist(hh, G.hue) <= 20).length / F.hues.length : 0;
    rows.push({ name: bx.name, figPx: fig.length, bboxH: h, figL: +F.L.toFixed(3), surL: +G.L.toFixed(3), dL: +(F.L - G.L).toFixed(3),
      figS: +F.S.toFixed(3), surS: +G.S.toFixed(3), figHue: +F.hue.toFixed(1), surHue: +G.hue.toFixed(1), dHue: +cdist(F.hue, G.hue).toFixed(1),
      inBand: +inBand.toFixed(3), figWin35: +F.win35.toFixed(3), figWin35From: F.win35From,
      selfCheck: +(self.L - F.L).toFixed(6) });
  });
  const C = stats(rgb, allCast);
  return { tag, castPx: allCast.length, castShareOfFrame: +(allCast.length / (W * H)).toFixed(4), castWin35: +C.win35.toFixed(3), castWin35From: C.win35From, castHue: +C.hue.toFixed(1), rows };
}

for (const t of tags) {
  const r = await one(t);
  console.log(`\n== ${r.tag}  cast px ${r.castPx} (${(r.castShareOfFrame * 100).toFixed(2)}% of frame)  cast-only win35 ${(r.castWin35 * 100).toFixed(1)}% @${r.castWin35From}-${(r.castWin35From + 35) % 360}`);
  console.log('  fighter       figPx  bboxH  figL   surL    dL    figS  surS  figHue surHue  dHue  inBand(+-20 of floor)');
  for (const x of r.rows) {
    if (x.skipped) { console.log(`  ${x.name.padEnd(12)} SKIPPED ${x.skipped}`); continue; }
    console.log(`  ${x.name.padEnd(12)} ${String(x.figPx).padStart(6)} ${String(x.bboxH).padStart(5)}  ${x.figL.toFixed(3)}  ${x.surL.toFixed(3)} ${x.dL >= 0 ? '+' : ''}${x.dL.toFixed(3)}  ${x.figS.toFixed(2)}  ${x.surS.toFixed(2)}  ${String(x.figHue).padStart(6)} ${String(x.surHue).padStart(6)} ${String(x.dHue).padStart(5)}  ${x.inBand.toFixed(3)}`);
    if (x.selfCheck !== 0) console.log('  SELF-CHECK FAILED');
  }
}
