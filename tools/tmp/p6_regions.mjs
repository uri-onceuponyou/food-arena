#!/usr/bin/env node
/**
 * p6_regions.mjs — the same metrics as p6_flat.mjs, but attributed to REGIONS, so a
 * whole-frame number can be split into "which part of the frame is carrying it".
 * READ-ONLY probe.
 *
 * Two modes, and they answer different questions:
 *
 *   --grid N     Split the frame into an N x N grid of tiles and report the
 *                DISTRIBUTION of each metric across tiles. This is fully objective —
 *                no hand-picked crop — and it is the right shape for "is the whole
 *                frame carrying structure, or only part of it?". The p10 tile is the
 *                emptiest eighth of the frame; the p90 tile is the busiest.
 *
 *   --boxes "label:x0,y0,x1,y1;..."   Named crops in FRACTIONS of the frame, each
 *                dumped as a PNG next to its numbers so the crop can be LOOKED AT
 *                before its number is believed (this project's rule 3).
 *
 * Every tile/box is measured by importing p6_flat's `measure`, on the SAME working
 * height, so a tile number and a whole-frame number are the same quantity.
 *
 * NOTE ON A KNOWN CONFOUND, stated because it changes the reading: our floor carries a
 * regular tile GRID of dark joints. A grid raises local-range and band energy without
 * adding any depth, so a frame can score "not flat" on a texture the eye discounts.
 * That is exactly why the per-tile p10 and the ground-only boxes are here: a grid is
 * uniform, so it lifts EVERY tile, and the failure it hides is visible in the coarse
 * bands (s16/s32) which a grid does not load.
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { measure } from './p6_flat.mjs';

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
const WORK_H = Number(args.height ?? 512);

function srgbLuma(r, g, b) { return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }

/** Load ONCE at the common working height, then slice tiles out of that buffer. */
async function loadWhole(path) {
  const meta = await sharp(path).metadata();
  const { data, info } = await sharp(path)
    .resize({ height: WORK_H, fit: 'inside', kernel: 'lanczos3' })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height, native: [meta.width, meta.height], path };
}

function slice(whole, x0, y0, x1, y1) {
  const { data, W, H } = whole;
  const px0 = Math.max(0, Math.round(x0 * W)), py0 = Math.max(0, Math.round(y0 * H));
  const px1 = Math.min(W, Math.round(x1 * W)), py1 = Math.min(H, Math.round(y1 * H));
  const w = px1 - px0, h = py1 - py0, N = w * h;
  const L = new Float32Array(N), S = new Float32Array(N), C = new Float32Array(N), Hue = new Float32Array(N);
  const rgb = Buffer.alloc(N * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = ((py0 + y) * W + (px0 + x)) * 3, di = (y * w + x);
    const r = data[si], g = data[si + 1], b = data[si + 2];
    rgb[di * 3] = r; rgb[di * 3 + 1] = g; rgb[di * 3 + 2] = b;
    L[di] = srgbLuma(r, g, b);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    C[di] = (mx - mn) / 255; S[di] = mx === 0 ? 0 : (mx - mn) / mx;
    let hh = 0;
    if (mx !== mn) { const d = mx - mn;
      if (mx === r) hh = 60 * (((g - b) / d) % 6);
      else if (mx === g) hh = 60 * ((b - r) / d + 2);
      else hh = 60 * ((r - g) / d + 4); }
    Hue[di] = (hh + 360) % 360;
  }
  return { L, S, C, Hue, W: w, H: h, N, rgb };
}

function pct(arr, q) { const s = [...arr].sort((a, b) => a - b); const i = (s.length - 1) * q; const lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); }

async function main() {
  const imgs = String(args.imgs ?? '').split(',').filter(Boolean);
  const labels = String(args.labels ?? '').split(',').filter(Boolean);
  const outdir = String(args.outdir ?? 'shots/p6/regions');
  mkdirSync(outdir, { recursive: true });
  const report = { workHeight: WORK_H, mode: args.grid ? 'grid' : 'boxes', rows: [] };

  if (args.grid) {
    const N = Number(args.grid);
    console.log(`\nper-tile distribution, ${N}x${N} grid (tile = 1/${N} of frame each way)\n`);
    console.log('label'.padEnd(22) + 'band s8   [p10  p50  p90]     lrange16 [p10  p50]   dead16 [p50 p90]   p05 [p10  p50]');
    for (let i = 0; i < imgs.length; i++) {
      const whole = await loadWhole(imgs[i]);
      const tiles = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const t = slice(whole, c / N, r / N, (c + 1) / N, (r + 1) / N);
        tiles.push(measure(t));
      }
      const g = (f) => tiles.map(f);
      const row = {
        label: labels[i] ?? basename(imgs[i]), file: imgs[i],
        s8: { p10: +pct(g((t) => t.band.s8), 0.10).toFixed(4), p50: +pct(g((t) => t.band.s8), 0.5).toFixed(4), p90: +pct(g((t) => t.band.s8), 0.9).toFixed(4) },
        s16: { p10: +pct(g((t) => t.band.s16), 0.10).toFixed(4), p50: +pct(g((t) => t.band.s16), 0.5).toFixed(4), p90: +pct(g((t) => t.band.s16), 0.9).toFixed(4) },
        lr16: { p10: +pct(g((t) => t.lrange.r16), 0.10).toFixed(4), p50: +pct(g((t) => t.lrange.r16), 0.5).toFixed(4) },
        dead16: { p50: +pct(g((t) => t.dead.r16), 0.5).toFixed(4), p90: +pct(g((t) => t.dead.r16), 0.9).toFixed(4) },
        p05: { p10: +pct(g((t) => t.p05), 0.10).toFixed(4), p50: +pct(g((t) => t.p05), 0.5).toFixed(4) },
        sd: { p10: +pct(g((t) => t.sd), 0.10).toFixed(4), p50: +pct(g((t) => t.sd), 0.5).toFixed(4) },
        hueFamilies: { p50: +pct(g((t) => t.hueFamilies), 0.5).toFixed(2) },
      };
      report.rows.push(row);
      console.log((row.label).padEnd(22)
        + `${row.s8.p10.toFixed(4)} ${row.s8.p50.toFixed(4)} ${row.s8.p90.toFixed(4)}   `
        + `  ${row.lr16.p10.toFixed(3)} ${row.lr16.p50.toFixed(3)}      `
        + `  ${row.dead16.p50.toFixed(3)} ${row.dead16.p90.toFixed(3)}    `
        + `  ${row.p05.p10.toFixed(3)} ${row.p05.p50.toFixed(3)}`);
    }
  } else {
    const boxes = String(args.boxes ?? '').split(';').filter(Boolean).map((b) => {
      const [name, nums] = b.split(':');
      const [x0, y0, x1, y1] = nums.split(',').map(Number);
      return { name, x0, y0, x1, y1 };
    });
    for (let i = 0; i < imgs.length; i++) {
      const whole = await loadWhole(imgs[i]);
      const lab = labels[i] ?? basename(imgs[i], '.png');
      for (const b of boxes) {
        const t = slice(whole, b.x0, b.y0, b.x1, b.y1);
        const m = measure(t);
        const png = `${outdir}/${lab.replace(/[^\w.-]/g, '_')}__${b.name}.png`;
        await sharp(t.rgb, { raw: { width: t.W, height: t.H, channels: 3 } }).png().toFile(png);
        report.rows.push({ label: lab, box: b.name, png, ...m });
        console.log(`${(lab + '/' + b.name).padEnd(30)} `
          + `p05=${m.p05.toFixed(3)} p50=${m.p50.toFixed(3)} p95=${m.p95.toFixed(3)} sd=${m.sd.toFixed(3)} dark=${m.darkShare.toFixed(3)} `
          + `| s4=${m.band.s4.toFixed(4)} s8=${m.band.s8.toFixed(4)} s16=${m.band.s16.toFixed(4)} `
          + `| lr16=${m.lrange.r16.toFixed(3)} dead16=${m.dead.r16.toFixed(3)} `
          + `| sat=${m.meanSat.toFixed(3)} hues=${m.hueFamilies}  -> ${png}`);
      }
    }
  }
  const out = String(args.json ?? `${outdir}/report.json`);
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`\n-> ${out}`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
