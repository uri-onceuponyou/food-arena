#!/usr/bin/env node
/**
 * p6_knee.mjs — price the grade's HIGHLIGHT SHOULDER against the reference's own
 * whole-playfield highlight band, on a PAUSED frame, with a drift control.
 * READ-ONLY probe: it mutates a uniform in the live page and changes no file.
 *
 * ── The question ────────────────────────────────────────────────────────────────
 * `p6_flat.mjs` measured, on an identical crop and identical code, 7 of our action
 * frames against 6 `gameplay_topdown` plates:
 *
 *   playfield share above luma 0.70   ours 1.28-4.80%   reference 6.65-34.75%
 *   playfield share above luma 0.80   ours 0.67-1.68%   reference  2.39-19.06%
 *   playfield share above luma 0.94   ours 0.08-0.56%   reference  0.11- 5.87%
 *
 * NON-OVERLAPPING on the first two. `stage.ts`'s grade holds `highlightKnee = 0.82`,
 * and the record in that file rejects opening it because it "takes whole-frame
 * clipped-high from 0.06% to 2.50%, a 40x regression". That rejection was made against
 * a CAST reference band (character mattes, reference median 0.0249). The number
 * measured here is the reference's WHOLE PLAYFIELD, where 2.50% is the MIDDLE of the
 * band. Those are two different quantities, so this re-prices the knob against the
 * right one.
 *
 * ── Why paused, and why a drift control ─────────────────────────────────────────
 * A post uniform is a per-pixel transfer, so the comparison is only meaningful if the
 * CONTENT is identical. `window.__matchDebug.pause()` freezes the sim while the render
 * loop keeps running, so the uniform change is the only thing that moves. And because
 * "is it the SAME?" is the eighteenth-invisible-render lesson, the shipped config is
 * captured FIRST and LAST: the A-vs-A' delta is the measurement's own floor, and no
 * config delta below it may be reported as a result.
 *
 * ⚠️ Every config is also confirmed by image diff against shipped. A config that
 * reports dMean 0.000 did nothing, whatever its name says (`postablate.mjs`'s rule,
 * and `BlendFunction.SKIP === 9` is the reason it exists).
 *
 * Usage:
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/p6_knee.mjs --url {URL} --out shots/p6/knee
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { measure } from './p6_flat.mjs';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

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
const BASE = String(args.url ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
const OUT = String(args.out ?? 'shots/p6/knee');
const W = 1600, H = 900;
const PF = [0.05, 0.16, 0.95, 0.86];   // the same crop p6_flat used on both sides

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

/** Same crop + resize as p6_regions, so a number here is the same quantity. */
async function pfMeasure(path) {
  const meta = await sharp(path).metadata();
  const left = Math.round(PF[0] * meta.width), top = Math.round(PF[1] * meta.height);
  const w = Math.round((PF[2] - PF[0]) * meta.width), h = Math.round((PF[3] - PF[1]) * meta.height);
  const { data, info } = await sharp(path).extract({ left, top, width: w, height: h })
    .resize({ height: 512, fit: 'inside', kernel: 'lanczos3' })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const N = info.width * info.height;
  const L = new Float32Array(N), S = new Float32Array(N), C = new Float32Array(N), Hue = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    L[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    C[i] = (mx - mn) / 255; S[i] = mx === 0 ? 0 : (mx - mn) / mx;
    let hh = 0;
    if (mx !== mn) { const d = mx - mn;
      if (mx === r) hh = 60 * (((g - b) / d) % 6);
      else if (mx === g) hh = 60 * ((b - r) / d + 2);
      else hh = 60 * ((r - g) / d + 4); }
    Hue[i] = (hh + 360) % 360;
  }
  return measure({ L, S, C, Hue, W: info.width, H: info.height, N });
}

/** Whole-frame mean |delta| in 0..255, the "did this config do anything" check. */
async function diff(a, b) {
  const A = await sharp(a).removeAlpha().raw().toBuffer();
  const B = await sharp(b).removeAlpha().raw().toBuffer();
  let s = 0, mx = 0, n = 0;
  for (let i = 0; i < A.length; i++) { const d = Math.abs(A[i] - B[i]); s += d; if (d > mx) mx = d; n++; }
  return { dMean: +(s / n).toFixed(4), dMax: mx };
}

async function main() {
  if (!BASE) { console.error('need --url (run under with_snapshot.mjs)'); process.exit(2); }
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(180_000);
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 200)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));

  await page.goto(`${BASE}/?player=hamburger&enemy=sushi&pointerLock=0&px=860&py=500`, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 240_000 });
  await page.waitForFunction(() => {
    const c = document.querySelector('[data-el="countdown"]');
    return !c || c.style.display === 'none';
  }, null, { timeout: 120_000 });
  // Let the AI walk in so the frame carries two fighters and some VFX, then freeze.
  await page.waitForTimeout(Number(args.settle ?? 9000));
  const pauseOk = await page.evaluate(() => {
    const d = window.__matchDebug;
    if (!d || typeof d.pause !== 'function') return false;
    d.pause(); return true;
  });
  console.log(`paused via __matchDebug: ${pauseOk}`);

  const probe = await page.evaluate(() => {
    const st = window.__stage;
    const out = { hasStage: !!st, hasGrade: !!(st && st.grade), knee: null, tier: null, bloomFound: false, bloomThreshold: null };
    if (st && st.grade) out.knee = st.grade.highlightKnee;
    try { out.tier = window.__quality?.tier ?? window.__quality?.current ?? null; } catch { /* none */ }
    try {
      for (const p of (st?.composer?.passes ?? [])) {
        const fx = p.effects ?? p._effects ?? [];
        for (const e of fx) {
          if (e && e.name === 'BloomEffect') {
            out.bloomFound = true;
            try { out.bloomThreshold = e.luminanceMaterial?.threshold ?? null; } catch { /* none */ }
          }
        }
      }
    } catch { /* none */ }
    return out;
  });
  console.log('probe:', JSON.stringify(probe));

  const CONFIGS = [
    ['shipped', null],
    ['knee0.88', 0.88],
    ['knee0.92', 0.92],
    ['knee1.00', 1.00],
    ['shipped2', null],     // the DRIFT CONTROL — same config as row 1
  ];
  const rows = [];
  for (const [name, knee] of CONFIGS) {
    if (knee !== null) {
      const set = await page.evaluate((k) => {
        const st = window.__stage;
        if (!st || !st.grade) return null;
        st.grade.highlightKnee = k;
        return st.grade.highlightKnee;
      }, knee);
      if (set === null) { console.log(`  ${name}: NO GRADE — skipped`); continue; }
    } else {
      await page.evaluate(() => { const st = window.__stage; if (st && st.grade) st.grade.highlightKnee = 0.82; });
    }
    // two rAFs so the composer has redrawn with the new uniform
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(250);
    const path = `${OUT}/${name}.png`;
    await page.screenshot({ path, timeout: 120_000 });  // capture-audit: allow subject is a paused post-chain A/B, not a screen transition
    const m = await pfMeasure(path);
    rows.push({ name, knee: knee ?? 0.82, path, ...m });
    console.log(`  ${name.padEnd(10)} p95=${m.p95.toFixed(3)} p99=${m.p99.toFixed(3)} `
      + `hi70=${(m.hi70 * 100).toFixed(2)}% hi80=${(m.hi80 * 100).toFixed(2)}% clip=${(m.clipShare * 100).toFixed(2)}% `
      + `sd=${m.sd.toFixed(3)} s4=${m.band.s4.toFixed(4)} lr16=${m.lrange.r16.toFixed(3)} sat=${m.meanSat.toFixed(3)}`);
  }

  console.log('\nimage diff vs shipped (a config with dMean 0.000 did NOTHING):');
  for (const r of rows.slice(1)) {
    const d = await diff(rows[0].path, r.path);
    r.diffVsShipped = d;
    console.log(`  ${r.name.padEnd(10)} dMean=${d.dMean}  dMax=${d.dMax}`);
  }

  const a = rows[0], a2 = rows.find((r) => r.name === 'shipped2');
  if (a2) {
    console.log('\nDRIFT CONTROL (shipped vs shipped2 — the floor under every row above):');
    console.log(`  d p95=${(a2.p95 - a.p95).toFixed(4)}  d hi70=${((a2.hi70 - a.hi70) * 100).toFixed(3)}pp  `
      + `d hi80=${((a2.hi80 - a.hi80) * 100).toFixed(3)}pp  d clip=${((a2.clipShare - a.clipShare) * 100).toFixed(3)}pp  `
      + `d sd=${(a2.sd - a.sd).toFixed(4)}`);
  }

  writeFileSync(`${OUT}/report.json`, JSON.stringify({ base: BASE, probe, pf: PF, rows }, null, 2));
  console.log(`\n-> ${OUT}/report.json`);
  await browser.close();
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
