#!/usr/bin/env node
/**
 * `.fa-rarity` — all six rarities, on every screen the badge renders on, scored by
 * BOTH contrast models at once, plus the pixel question neither model asks.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────────
 * `cab4662` reported "home now measures min ratio 2.53 with 1 run below AA on the
 * Normal `.fa-rarity` badge (11.2px/800), against a recorded 5.80 and 0" and called it
 * a live regression rather than a capture artefact. Both halves of that are true and
 * they are not the same claim, because THREE batteries score this screen and only two
 * of them know what a text stroke is:
 *
 *   screen_metrics.mjs   inkVsPapers() has `if (stroke && stroke.width >= 1.5)` — the
 *                        glyph sits on its own stroke, so the paper IS the stroke
 *   chars_metrics.mjs    same branch, same code
 *   home_metrics.mjs     NO such branch. Its contrastIn() takes the modal bin as paper
 *                        and the bin FURTHEST from it in luminance as ink, so on a
 *                        stroked badge it compares `--cream` with the FILL and never
 *                        looks at the ink between them.
 *
 * 2.53 is exactly `contrast(#FFF3DE, #9B9B9B)` to three figures — cream on Normal grey,
 * with the 1.6px ink stroke ignored. It is what a stroke-blind model must return once
 * `home.ts` stopped darkening the fill; it is not evidence about pixels.
 *
 * So the honest question is not "which number is right" but "does the stroke actually
 * enclose the glyph at the size each screen uses", and that is a PIXEL question:
 *
 *   `-webkit-text-stroke` centres on the glyph outline, so HALF the stroke is taken off
 *   the INSIDE of the stem. Rubik at weight 800 has a stem of roughly 0.16em, which is
 *   1.79px at 11.2px — against a 1.6px stroke that eats 0.8px from each side. That
 *   leaves ~0.2px of `--cream` core, which no rasteriser can resolve. `theme.ts` knew
 *   this: it raised the badge's font-size floor 0.70rem -> 0.72rem "to keep that ratio
 *   honest at the smallest place this badge is used". `home.ts` then pinned
 *   `font-size: 0.7rem` in a LOCAL override, which puts home back under that floor.
 *
 * ── What is measured ────────────────────────────────────────────────────────────
 * Per rarity x screen x viewport, from the badge's own settled pixels:
 *
 *   aaStroke    the stroke-aware ratio, from screen_metrics.mjs's inkVsPapers VERBATIM
 *               (copied, not imported, so a change there cannot silently move these
 *               numbers — and so the two files can be diffed)
 *   aaBlind     the same rect scored the way home_metrics.mjs scores it, so the
 *               disagreement is a printed column instead of an argument
 *   coreShare   share of badge pixels within 60 of `--cream`. This is the cream CORE.
 *               If the stroke has eaten the fill, this goes to ~0 and the badge reads
 *               as solid ink on the rarity colour — legible, but no longer the thing
 *               either instrument thinks it is scoring.
 *   coreRun     the widest unbroken horizontal run of core pixels, in CSS px, across
 *               the glyph band. This is the number that says whether the fill SURVIVES.
 *   inkOnFill   what a reader gets in the degenerate case: ink against the fill. Epic
 *               is the worst of the six at 3.69 by hand, so a badge whose core has
 *               vanished is NOT automatically fine.
 *
 * A 6x nearest-neighbour contact sheet is written so the pixels can be judged as
 * pixels (`CLAUDE.md` non-negotiable 3). Measurement is at deviceScaleFactor 1, which
 * is the harshest case and the one every acceptance battery here uses.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/rarity_aa.mjs --url {URL}
 *   node tools/tmp/rarity_aa.mjs --url {URL} --vps desktop        # one viewport
 */

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { settleScreen, captureSettled, waitForRoster } from './settle.mjs';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
  else { args[a.slice(2)] = n; i++; }
}
const base = args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const outDir = args.out ?? 'shots/rarity/aa';

/** One fighter per rarity that reaches the lobby hero plate. Same set as rarity_px.mjs. */
const CASES = [
  { id: 'hamburger', rarity: 'Normal', hex: '#9B9B9B' },
  { id: 'taco', rarity: 'Rare', hex: '#2E86D8' },
  { id: 'soup', rarity: 'Epic', hex: '#8B4FDE' },
  { id: 'sushi', rarity: 'Legendary', hex: '#F4A300' },
  { id: 'egg', rarity: 'Neon', hex: '#FF2FD0' },
  { id: 'lollipop', rarity: 'Cyber', hex: '#00E5B0' },
];

const ALL_VPS = [
  { name: 'desktop', w: 1600, h: 900 },
  { name: 'phone-land', w: 844, h: 390 },
  { name: 'phone-portrait', w: 430, h: 932 },
];
const VPS = args.vps
  ? ALL_VPS.filter((v) => String(args.vps).split(',').includes(v.name))
  : ALL_VPS;

// ── WCAG, verbatim from screen_metrics.mjs ───────────────────────────────────
function relLum(r, g, b) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}
function parseColor(s) {
  const m = /rgba?\(([^)]+)\)/.exec(s || '');
  if (!m) return { r: 0, g: 0, b: 0, a: 1 };
  const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  return { r: p[0] ?? 0, g: p[1] ?? 0, b: p[2] ?? 0, a: p[3] === undefined ? 1 : p[3] };
}
const blend = (c, a, bg) => ({
  r: c.r * a + bg.r * (1 - a), g: c.g * a + bg.g * (1 - a), b: c.b * a + bg.b * (1 - a),
});
const dist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

/** 5-bit bins over a rect, heaviest first. Verbatim from screen_metrics.mjs. */
function binPixels(px, W, x0, y0, w, h) {
  const bins = new Map();
  let n = 0;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * W + x) * 3;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const key = (r >> 3) * 1024 + (g >> 3) * 32 + (b >> 3);
      let e = bins.get(key);
      if (!e) bins.set(key, (e = { n: 0, r: 0, g: 0, b: 0 }));
      e.n++; e.r += r; e.g += g; e.b += b; n++;
    }
  }
  if (n === 0) return [];
  return [...bins.values()]
    .map((e) => ({ r: e.r / e.n, g: e.g / e.n, b: e.b / e.n, share: e.n / n }))
    .sort((a, b) => b.share - a.share);
}

/** screen_metrics.mjs's inkVsPapers, copied verbatim (see header for why). */
function inkVsPapers(px, W, x0, y0, w, h, color, alpha, stroke) {
  const bins = binPixels(px, W, x0, y0, w, h);
  if (bins.length === 0) return null;
  const NEAR = 70;
  if (stroke && stroke.width >= 1.5) {
    const p = { r: stroke.r, g: stroke.g, b: stroke.b, share: 1 };
    let ink = blend(color, alpha, p);
    let best = NEAR;
    for (const b of bins) {
      if (b.share < 0.015) continue;
      const d = dist(b, blend(color, alpha, p));
      if (d < best) { best = d; ink = b; }
    }
    return { ratio: contrast(relLum(ink.r, ink.g, ink.b), relLum(p.r, p.g, p.b)), paper: p, ink, viaStroke: true };
  }
  let cands = bins.filter((b) => dist(b, color) > NEAR);
  if (cands.length === 0) cands = bins;
  const papers = [cands[0]];
  for (const b of cands.slice(1)) {
    if (b.share < 0.10) break;
    const isInk = papers.some((p) => [1, 0.75, 0.5, 0.25].some((t) => dist(b, blend(color, alpha * t, p)) < NEAR));
    if (!isInk) papers.push(b);
  }
  let worst = null;
  for (const p of papers) {
    const predicted = blend(color, alpha, p);
    let ink = predicted;
    let best = NEAR;
    for (const b of bins) {
      if (b.share < 0.015 || b === p) continue;
      const d = dist(b, predicted);
      if (d < best) { best = d; ink = b; }
    }
    const c = contrast(relLum(ink.r, ink.g, ink.b), relLum(p.r, p.g, p.b));
    if (worst === null || c < worst.ratio) worst = { ratio: c, paper: p, ink };
  }
  return worst;
}

/** home_metrics.mjs's contrastIn(), copied verbatim — the stroke-BLIND model. */
function blindContrast(px, W, x0, y0, w, h, minShare = 0.02) {
  const bins = new Map();
  let n = 0;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * W + x) * 3;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const key = (r >> 3) * 1024 + (g >> 3) * 32 + (b >> 3);
      let e = bins.get(key);
      if (!e) bins.set(key, (e = { n: 0, r: 0, g: 0, b: 0 }));
      e.n++; e.r += r; e.g += g; e.b += b; n++;
    }
  }
  if (n === 0) return null;
  let bg = null;
  for (const e of bins.values()) if (!bg || e.n > bg.n) bg = e;
  const bgc = { r: bg.r / bg.n, g: bg.g / bg.n, b: bg.b / bg.n };
  const bgL = relLum(bgc.r, bgc.g, bgc.b);
  let fg = null; let best = -1;
  for (const e of bins.values()) {
    if (e.n / n < minShare) continue;
    const c = { r: e.r / e.n, g: e.g / e.n, b: e.b / e.n };
    const d = Math.abs(relLum(c.r, c.g, c.b) - bgL);
    if (d > best) { best = d; fg = c; }
  }
  return fg ? contrast(relLum(fg.r, fg.g, fg.b), bgL) : 1;
}

/**
 * Does the cream CORE survive the stroke?
 *
 * `coreShare` counts badge pixels within 60 of `--cream`; `coreRun` is the widest
 * unbroken horizontal run of them, in CSS px. A stem that has been eaten leaves
 * antialiased mud, never a run — so a coreRun below 1 means "there is no fill left,
 * only its ghost", whatever the modelled ratio says.
 */
function coreStats(px, W, x0, y0, w, h, cream) {
  let core = 0; let total = 0; let bestRun = 0;
  for (let y = y0; y < y0 + h; y++) {
    let run = 0;
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * W + x) * 3;
      const isCore = dist({ r: px[i], g: px[i + 1], b: px[i + 2] }, cream) < 60;
      total++;
      if (isCore) { core++; run++; if (run > bestRun) bestRun = run; } else run = 0;
    }
  }
  return { coreShare: total ? core / total : 0, coreRun: bestRun };
}

const seed = (id) => ({
  name: 'Chef', wins: 12, losses: 5, xp: 900, selected: id,
  economy: {
    trophies: 900, bestTrophies: 900, coins: 800, gems: 20,
    containers: { chest: 0, hamburgerBox: 0, pineappleBox: 0, redBox: 0, fireBox: 0 },
    claimed: [], unlocked: ['hamburger'], winsTowardChest: 1,
    lastMatch: null, seed: 31337, rolls: 0,
  },
});

/** Read every `.fa-rarity` on the mounted screen, with everything the models need. */
const READ_BADGES = () => {
  const out = [];
  for (const n of document.querySelectorAll('.fa-rarity')) {
    const s = getComputedStyle(n);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) continue;
    const r = n.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    let alpha = 1;
    for (let p = n; p && p.nodeType === 1; p = p.parentElement) alpha *= Number(getComputedStyle(p).opacity);
    out.push({
      text: (n.textContent || '').trim(),
      cls: n.className,
      x: r.x, y: r.y, w: r.width, h: r.height,
      size: Math.round(parseFloat(s.fontSize) * 100) / 100,
      weight: s.fontWeight,
      color: s.color,
      alpha,
      strokeWidth: parseFloat(s.webkitTextStrokeWidth) || 0,
      strokeColor: s.webkitTextStrokeColor,
      fill: s.backgroundColor,
      cream: getComputedStyle(document.documentElement).getPropertyValue('--cream').trim(),
    });
  }
  return out;
};

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const rows = [];
const tiles = [];
let offscreen = 0;

async function scoreScreen(page, screen, vp, expect) {
  const shot = `${outDir}/${screen}-${vp.name}-${expect ?? 'all'}.png`;
  await captureSettled(page, { path: shot, label: `${screen}@${vp.name}`, tool: 'rarity_aa' });
  const badges = await page.evaluate(READ_BADGES);
  const { data, info } = await sharp(shot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const IW = info.width;
  const sx = IW / vp.w;
  for (const b of badges) {
    const x0 = Math.round(b.x * sx);
    const y0 = Math.round(b.y * sx);
    const w = Math.round(b.w * sx);
    const h = Math.round(b.h * sx);
    // ⚠️ CLAMPING AN OFF-SCREEN RECT IS NOT A NEAR MISS, IT IS A DIFFERENT BADGE.
    // The portrait roster scrolls, so a card above the fold has a NEGATIVE y; the
    // first version of this loop did `Math.max(0, ...)` and scored row 0 of the
    // screenshot instead, reporting a 12.48px badge with a 110px "cream run" and 94%
    // core coverage — confident, wrong, and it would have passed unnoticed because the
    // ratio it invented still cleared AA. A badge that is not wholly inside the
    // captured viewport is not measurable and is skipped, counted, and printed.
    if (w < 4 || h < 4) continue;
    if (x0 < 0 || y0 < 0 || x0 + w > info.width || y0 + h > info.height) { offscreen++; continue; }
    const col = parseColor(b.color);
    const sc = parseColor(b.strokeColor);
    const stroke = b.strokeWidth > 0 ? { ...sc, width: b.strokeWidth } : null;
    const aware = inkVsPapers(data, IW, x0, y0, w, h, col, b.alpha * col.a, stroke);
    const blind = blindContrast(data, IW, x0, y0, w, h);
    const creamRgb = (() => {
      const m = /^#?([0-9a-f]{6})$/i.exec(b.cream.replace('#', '#'));
      if (!m) return { r: 255, g: 243, b: 222 };
      const v = parseInt(m[1], 16);
      return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
    })();
    const cs = coreStats(data, IW, x0, y0, w, h, creamRgb);
    const fillRgb = parseColor(b.fill);
    rows.push({
      screen, vp: vp.name, rarity: b.text, where: /chars-card-rarity/.test(b.cls) ? 'card' : 'hero',
      size: b.size, strokePx: b.strokeWidth,
      aaStroke: aware ? +aware.ratio.toFixed(2) : null,
      aaBlind: blind ? +blind.toFixed(2) : null,
      inkOnFill: +contrast(relLum(sc.r, sc.g, sc.b), relLum(fillRgb.r, fillRgb.g, fillRgb.b)).toFixed(2),
      coreShare: +(cs.coreShare * 100).toFixed(2),
      coreRun: +(cs.coreRun / sx).toFixed(2),
    });
    // One tile per (rarity, size) for the contact sheet, at 6x nearest neighbour.
    const key = `${b.text}@${b.size}`;
    if (!tiles.some((t) => t.key === key)) {
      const tile = await sharp(shot).extract({ left: x0, top: y0, width: w, height: h })
        .resize({ width: w * 6, height: h * 6, kernel: 'nearest' }).png().toBuffer();
      tiles.push({ key, buf: tile, w: w * 6, h: h * 6, label: `${b.text} ${b.size}px ${screen}` });
    }
  }
}

for (const vp of VPS) {
  // ── home: one page load per rarity, because only the SELECTED fighter's badge shows
  for (const c of CASES) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
    await page.addInitScript((p) => {
      try { localStorage.setItem('food-arena.profile.v1', JSON.stringify(p)); } catch { /* private mode */ }
    }, seed(c.id));
    await page.goto(`${base}/?screen=home&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction('window.__screen === "home"', null, { timeout: 60_000 });
    await settleScreen(page, { label: `home@${vp.name}` });
    await scoreScreen(page, 'home', vp, c.rarity);
    await page.close();
  }
  // ── characters: every rarity in the roster renders at once, plus the hero plate
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
  await page.addInitScript((p) => {
    try { localStorage.setItem('food-arena.profile.v1', JSON.stringify(p)); } catch { /* private mode */ }
  }, { ...seed('hamburger'), economy: { ...seed('hamburger').economy, unlocked: CASES.map((c) => c.id) } });
  await page.goto(`${base}/?screen=characters&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction('window.__screen === "characters"', null, { timeout: 60_000 });
  await settleScreen(page, { label: `characters@${vp.name}` });
  await waitForRoster(page).catch(() => {});
  await scoreScreen(page, 'characters', vp, null);
  await page.close();
}

await browser.close();

// ── contact sheet ────────────────────────────────────────────────────────────
if (tiles.length) {
  const PAD = 10;
  const colW = Math.max(...tiles.map((t) => t.w)) + PAD * 2;
  const rowH = Math.max(...tiles.map((t) => t.h)) + PAD * 2;
  const cols = Math.min(4, tiles.length);
  const rowsN = Math.ceil(tiles.length / cols);
  const sheet = sharp({
    create: { width: colW * cols, height: rowH * rowsN, channels: 3, background: { r: 40, g: 40, b: 46 } },
  });
  await sheet.composite(tiles.map((t, i) => ({
    input: t.buf,
    left: (i % cols) * colW + PAD,
    top: Math.floor(i / cols) * rowH + PAD,
  }))).png().toFile(`${outDir}/sheet.png`);
  console.log(`\nsheet -> ${outDir}/sheet.png  (${tiles.map((t) => t.key).join(', ')})`);
}

await writeFile(`${outDir}/rarity_aa.json`, JSON.stringify(rows, null, 2));

console.log('\n.fa-rarity — every rarity, every screen it renders on, both contrast models\n');
console.log('screen      vp              where  rarity      size   stroke  AA(stroke)  AA(blind)  ink/fill  core%   coreRun');
let awareFails = 0; let blindFails = 0; let noCore = 0;
for (const r of rows.sort((a, b) => a.screen.localeCompare(b.screen) || a.vp.localeCompare(b.vp) || a.rarity.localeCompare(b.rarity))) {
  const bad = (v) => (v !== null && v < 4.5 ? 'x' : ' ');
  if (r.aaStroke !== null && r.aaStroke < 4.5) awareFails++;
  if (r.aaBlind !== null && r.aaBlind < 4.5) blindFails++;
  if (r.coreRun < 1) noCore++;
  console.log(
    `${r.screen.padEnd(11)} ${r.vp.padEnd(15)} ${r.where.padEnd(6)} ${r.rarity.padEnd(11)} `
    + `${String(r.size).padStart(5)}  ${String(r.strokePx).padStart(5)}  `
    + `${bad(r.aaStroke)}${String(r.aaStroke).padStart(8)}  ${bad(r.aaBlind)}${String(r.aaBlind).padStart(8)}  `
    + `${String(r.inkOnFill).padStart(7)}  ${String(r.coreShare).padStart(6)}  ${String(r.coreRun).padStart(6)}`,
  );
}
console.log(`\n${rows.length} badge(s)  ·  stroke-aware below AA: ${awareFails}  ·  stroke-blind below AA: ${blindFails}`
  + `  ·  cream core narrower than 1 CSS px: ${noCore}  ·  skipped (not wholly on screen): ${offscreen}`);
process.exit(awareFails ? 1 : 0);
