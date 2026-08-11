#!/usr/bin/env node
/**
 * 🔴 SUPERSEDED AND KNOWN-BAD. DO NOT QUOTE A NUMBER FROM THIS FILE.
 * 🔴 USE `tools/tmp/pf_judder.mjs` INSTEAD.
 *
 * Kept, not deleted, because its failure is the lesson and because deleting it is how it
 * gets rewritten from scratch by someone who never learned why.
 *
 * ── WHAT IS WRONG WITH IT ──────────────────────────────────────────────────────────
 *
 * It seeks on a FIXED GRID IT IS TOLD (`--step`, default 1/30) and calls a near-zero
 * delta a dropped frame. **A grid finer than the source's own frame interval returns the
 * same frame twice**, so it manufactures the exact signal it is looking for. Measured, on
 * a synthesised clip containing ZERO repeats:
 *
 *     sampled at 1x its own rate  ->   0.0% "repeats"
 *     sampled at 2x its own rate  ->  48.1% "repeats"
 *
 * ⚠️ Its output was reported upward as evidence — "8 of 60 repeats at 30 Hz, 19 of 59 at
 * 60 Hz" — before that control was run. Those numbers are arithmetic, not the game.
 *
 * ── WHAT REPLACED IT, AND WHY THAT ONE IS SOUND ────────────────────────────────────
 *
 * `pf_judder.mjs` walks `requestVideoFrameCallback`: one callback per PRESENTED frame,
 * carrying its own `mediaTime`. **The rate is measured, never assumed**, so there is no
 * grid to get wrong. On Uri's capture it reports 393 of 813 presented frames repeated =
 * **30.93 distinct frames/s**, with real 50-117 ms stalls during motion — and it correctly
 * separates a stall from a STATIC SCREEN by the motion either side, which this file's two
 * longest "hitches" turned out to be.
 *
 * ── THE ORIGINAL HEADER, KEPT AS WRITTEN ───────────────────────────────────────────
 *
 * vidjudder — is the capture STUTTERING, measured rather than eyeballed.
 *
 * Samples consecutive frames at the capture's own rate over a window and reports the
 * per-step changed-pixel fraction. A smooth 60/30 fps capture gives a roughly CONSTANT
 * step; a hitch gives one near-zero step (a repeated frame) followed by a large one
 * (the catch-up). ⚠️ This measures the RECORDING, which is itself capped by the screen
 * recorder's own rate — so it can prove judder EXISTS and cannot prove a frame rate.
 *
 * ^ That caveat was right and insufficient. The failure was not the recorder's cap; it
 *   was "at the capture's own rate", which the tool never measured and had to be told.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = process.argv[2];
const t0 = Number(process.argv[3] ?? 6);
const span = Number(process.argv[4] ?? 2);
const step = Number(process.argv[5] ?? 1 / 30);

const b64 = readFileSync(resolve(src)).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
await page.setContent('<video id="v" muted playsinline></video><canvas id="c"></canvas>');
await page.evaluate(async (d) => {
  const v = document.getElementById('v');
  v.src = 'data:video/mp4;base64,' + d;
  await new Promise((r, j) => { v.onloadedmetadata = r; v.onerror = () => j(new Error('decode')); });
}, b64);

const rows = await page.evaluate(async ({ t0, span, step }) => {
  const v = document.getElementById('v'), c = document.getElementById('c');
  const w = v.videoWidth, h = v.videoHeight;
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const grab = async (t) => {
    await new Promise((r) => { v.onseeked = r; v.currentTime = t; });
    ctx.drawImage(v, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h).data;
  };
  const out = [];
  let prev = await grab(t0);
  for (let t = t0 + step; t <= t0 + span; t += step) {
    const cur = await grab(t);
    let diff = 0;
    for (let i = 0; i < cur.length; i += 4) {
      if (Math.abs(cur[i] - prev[i]) + Math.abs(cur[i+1] - prev[i+1]) + Math.abs(cur[i+2] - prev[i+2]) > 24) diff++;
    }
    out.push({ t: +t.toFixed(3), pct: +((diff / (w * h)) * 100).toFixed(3) });
    prev = cur;
  }
  return out;
}, { t0, span, step });

const p = rows.map((r) => r.pct);
const sorted = [...p].sort((a, b) => a - b);
const med = sorted[Math.floor(sorted.length / 2)];
console.log(rows.map((r) => `${r.t.toFixed(2)}s ${String(r.pct).padStart(7)}%`).join('\n'));
console.log(`\nsteps ${p.length}  median ${med.toFixed(3)}%  min ${sorted[0]}%  max ${sorted[sorted.length-1]}%`);
console.log(`near-zero steps (<0.05%, i.e. a REPEATED frame): ${p.filter((x) => x < 0.05).length}`);
await browser.close();
