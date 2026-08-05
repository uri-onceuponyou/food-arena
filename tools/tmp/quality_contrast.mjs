#!/usr/bin/env node
/**
 * WCAG contrast for the graphics row, in the ONE state `screen_metrics.mjs` cannot
 * reach: pinned by `?tier=`, where every cell is disabled.
 *
 * `screen_metrics.mjs` builds its own URL from the screen name, so it always measures
 * the live row. The disabled row is a different set of pixels and it is the state whose
 * whole job is to be READ — it exists to explain why the control is off. `docs/LESSONS`
 * §1 case 10 is the reason this is measured rather than reasoned about: a dark-on-dark
 * HUD cooldown wipe had three critics across three rounds report "no visible cooldown".
 *
 * Method, deliberately the same shape as `screen_metrics`' so the numbers compare:
 * ink is identified by MODEL (the computed `color`, times every inherited opacity) and
 * measured from PIXELS — the bin nearest the prediction is the ink, the modal remaining
 * bin is the paper, and the ratio is between two measured colours.
 *
 * Usage: node tools/tmp/with_snapshot.mjs -- node tools/tmp/quality_contrast.mjs
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const OUT = 'shots/portrait';
const A = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const relLum = (r, g, b) => {
  const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const dist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

function bins(px, W, x0, y0, w, h) {
  const m = new Map();
  let n = 0;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * W + x) * 3;
      const k = (px[i] >> 3) * 1024 + (px[i + 1] >> 3) * 32 + (px[i + 2] >> 3);
      let e = m.get(k);
      if (!e) m.set(k, (e = { n: 0, r: 0, g: 0, b: 0 }));
      e.n++; e.r += px[i]; e.g += px[i + 1]; e.b += px[i + 2]; n++;
    }
  }
  return [...m.values()].map((e) => ({ r: e.r / e.n, g: e.g / e.n, b: e.b / e.n, share: e.n / n }))
    .sort((a, b) => b.share - a.share);
}

async function measure(page, label, out) {
  await mkdir(OUT, { recursive: true });
  const shot = `${OUT}/${out}.png`;
  await page.screenshot({ path: shot, timeout: 120000 });
  const img = sharp(shot).removeAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });

  const runs = await page.evaluate(() => {
    const parse = (s) => {
      const m = /rgba?\(([^)]+)\)/.exec(s ?? '');
      if (!m) return { r: 0, g: 0, b: 0, a: 1 };
      const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
      return { r: p[0] ?? 0, g: p[1] ?? 0, b: p[2] ?? 0, a: p[3] === undefined ? 1 : p[3] };
    };
    const opacityChain = (n) => {
      let a = 1;
      for (let p = n; p && p !== document.documentElement; p = p.parentElement) {
        const o = Number(getComputedStyle(p).opacity);
        if (Number.isFinite(o)) a *= o;
      }
      return a;
    };
    const out = [];
    for (const el of document.querySelectorAll('.set-seg-name, .set-seg-auto, [data-el="qualitypin"], [data-el="qualityblurb"]')) {
      const r = el.getBoundingClientRect();
      // `continue`, not `return`. The first run of this probe said "0 runs" for the
      // LIVE row and it was not a finding: the hidden `qualitypin` banner is first in
      // document order and a `return` here threw the whole screen away. A measurement
      // of nothing reads exactly like a clean measurement.
      if (r.width < 4 || r.height < 4) continue;
      const cs = getComputedStyle(el);
      out.push({
        cls: el.className || el.dataset.el,
        text: (el.textContent ?? '').trim().slice(0, 26),
        size: parseFloat(cs.fontSize), weight: Number(cs.fontWeight) || 400,
        color: parse(cs.color), alpha: parse(cs.color).a * opacityChain(el),
        chain: +opacityChain(el).toFixed(3),
        x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
      });
    }
    return out;
  });

  const rows = [];
  for (const t of runs) {
    const x0 = Math.max(0, t.x); const y0 = Math.max(0, t.y);
    const w = Math.min(info.width - x0, t.w); const h = Math.min(info.height - y0, t.h);
    if (w < 3 || h < 3) continue;
    const bs = bins(data, info.width, x0, y0, w, h);
    const predicted = {
      r: t.color.r * t.alpha + bs[0].r * (1 - t.alpha),
      g: t.color.g * t.alpha + bs[0].g * (1 - t.alpha),
      b: t.color.b * t.alpha + bs[0].b * (1 - t.alpha),
    };
    const paper = bs[0];
    let ink = predicted; let best = 70;
    for (const b of bs) {
      if (b.share < 0.015 || b === paper) continue;
      const d = dist(b, predicted);
      if (d < best) { best = d; ink = b; }
    }
    const ratio = contrast(relLum(ink.r, ink.g, ink.b), relLum(paper.r, paper.g, paper.b));
    const floor = t.size >= 24 || (t.size >= 18.66 && t.weight >= 700) ? 3 : 4.5;
    rows.push({ ...t, ratio: +ratio.toFixed(2), floor, paper, ink });
  }

  console.log(`\n── ${label} ──   ${shot}`);
  let fails = 0;
  for (const r of rows) {
    const ok = r.ratio >= r.floor;
    if (!ok) fails++;
    console.log(`  ${ok ? ' ok ' : 'FAIL'} ${String(r.ratio).padStart(6)} (need ${r.floor})  ${r.size}px/${r.weight} chain=${r.chain}  "${r.text}"  .${String(r.cls).split(' ')[0]}`
      + `  ink ${[r.ink.r, r.ink.g, r.ink.b].map(Math.round).join(',')} on ${[r.paper.r, r.paper.g, r.paper.b].map(Math.round).join(',')}`);
  }
  console.log(`  ${rows.length} runs, ${fails} below AA, min ${rows.length ? Math.min(...rows.map((r) => r.ratio)) : '-'}`);
  // A run count of zero is not a pass. See the `continue` note above.
  if (rows.length < 4) { console.log('  !! MEASURED ALMOST NOTHING — treat this as a failure, not a clean bill'); return 1; }
  return fails;
}

const b = await chromium.launch({ args: A });
let fails = 0;
for (const [label, q, out] of [
  ['graphics row, LIVE', '', 'contrast-live'],
  ['graphics row, PINNED by ?tier= (every cell disabled)', '&tier=medium', 'contrast-pinned'],
]) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await p.goto(`${BASE}/?screen=settings${q}`, { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForFunction('window.__screen === "settings"', null, { timeout: 60000 });
  await p.waitForTimeout(900);
  fails += await measure(p, label, out);
  await p.close();
}
await b.close();
console.log(`\n${fails === 0 ? 'ALL CLEAN' : `${fails} runs below AA`}`);
process.exit(fails ? 1 : 0);
