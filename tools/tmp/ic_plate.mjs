#!/usr/bin/env node
/**
 * BLIND PLATE AT THE DELIVERED SIZE.
 *
 * ── This is a DRIVER over the existing instrument, not a second one ──────────
 * `tools/tmp/icon_legibility.html` still does the rendering: it imports the real
 * `icon()` from `src/ui/icons/`, shuffles deterministically, and publishes the answer
 * key on `window.__key`. `tools/tmp/icon_score.mjs` still does all the scoring, the
 * confusion matrix, the cross-family roll-up and the swap detection. Neither is edited
 * and neither is reimplemented here — the key this writes is byte-compatible with the
 * one `icon_score.mjs` already reads.
 *
 * What it adds is the one thing the harness cannot express, and the thing this whole
 * task turns on: **the tiles are sized and coloured from a MEASUREMENT of the shipped
 * screens** (`ic_delivered.mjs`), not from three hand-transcribed CSS classes.
 *
 * The three classes were wrong in both directions, measured:
 *
 *      icon     harness `slot20`   ACTUALLY DELIVERED           where
 *      shards   20 px, dark-on-cream   21.6-27.0 px, dark-on-white   .chars-ability-em
 *                                      24-26 px in the HUD slot      .hud-weapon-emoji
 *      range    20 px, dark-on-cream   12.8-16.4 px, CREAM ON INK    .chars-fact
 *
 * So every round ever judged drew `range` 56% too big and with its polarity INVERTED,
 * and drew `shards` 7-26% too small. A collision measured under those conditions is a
 * measurement of a screen this game does not have. `docs/AGENT-BRIEF.md` §4.7 — a
 * baseline is itself a measurement.
 *
 *   node tools/tmp/with_snapshot.mjs -- \
 *     node tools/tmp/ic_plate.mjs --url {URL} --sizes shots/ic/delivered.json \
 *          --set all --seed 3 --out shots/ic/round1
 *
 * ── --forgery: the DETECTION-POWER check ────────────────────────────────────
 * `--forgery A=B` draws icon B's artwork in the tile whose key says A. Two tiles then
 * carry IDENTICAL pixels under two different names, so a collision is present BY
 * CONSTRUCTION and any judge that can see collisions at all must report it. That is the
 * known-bad input for the whole pipeline: CLAUDE.md non-negotiable #6, a guard that has
 * not been shown to FAIL on the thing it guards against is not a guard.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const a = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[i + 1];
}
const url = (a.url ?? 'http://localhost:5173').replace(/\/$/, '');
const out = a.out ?? 'shots/ic/plate';
const set = a.set ?? 'all';
const seed = a.seed ?? '3';
const cols = Number(a.cols ?? 9);
const tag = a.tag ?? `${set}-s${seed}`;
const only = a.only ?? '';
const forgery = a.forgery ?? '';        // "shards=range,gift=boxRed"
/** Cell pitch. Big enough for the largest delivered icon (73.6 px `lock`) plus air. */
const CELL = Number(a.cell ?? 92);

/** Delivered geometry, per icon, from `ic_delivered.mjs`.
 *
 *  The SMALLEST visible occurrence is used — it is a real shipped condition and it is
 *  the harshest, so a glyph that passes here passes everywhere it ships. `where` is
 *  carried into the key so a verdict can always be traced to a screen. */
function deliveredSpec(sizesPath) {
  const d = JSON.parse(readFileSync(sizesPath, 'utf8'));
  const best = new Map();
  for (const r of d.rows) {
    if (!r.vis || r.occluded || r.name === '?') continue;
    const px = Math.min(r.w, r.h);
    const cur = best.get(r.name);
    // `bgPix` is a SAMPLE of the delivered pixels, agreed by two ablated shots. `bg` is
    // a CSS walk that is KNOWN wrong on gradient-painted buttons. So a row with a
    // measured plate always beats a row without one, even a smaller one — a harsher
    // size measured against a fabricated background is not the harsher condition, it is
    // a different screen. Among rows that agree, smallest wins.
    const measured = Boolean(r.bgPix);
    if (!cur
      || (measured && !cur.measured)
      || (measured === cur.measured && px < cur.px)) {
      best.set(r.name, {
        px, measured, bg: r.bgPix ?? r.bg, outline: r.outline, filter: r.filter,
        where: `${r.vp}/${r.screen}`, bgSource: r.bgPix ? 'pixels' : 'css-walk', host: r.host,
      });
    }
  }
  return best;
}

const spec = a.sizes ? deliveredSpec(a.sizes) : new Map();
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

const qs = new URLSearchParams({ box: 'slot20', set, seed, cols: String(cols) });
if (only) qs.set('only', only);
const target = `${url}/tools/tmp/icon_legibility.html?${qs}`;
await page.goto(target, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });

const key = await page.evaluate(() => window.__key);

// ── Restyle every tile to its measured delivered condition. ──────────────────
const applied = await page.evaluate(
  ({ specArr, cell, forgeryPairs }) => {
    const S = new Map(specArr);
    const forge = new Map(forgeryPairs.map((p) => p.split('=')));
    const g = document.getElementById('grid');
    g.style.gap = '0px';
    g.style.padding = '10px';
    const items = [...g.querySelectorAll('.item')];
    const rows = [];
    for (const [i, item] of items.entries()) {
      const svg = item.querySelector('svg.fa-ic');
      const name = [...svg.classList].find((c) => c.startsWith('fa-ic--')).slice(7);
      const s = S.get(name) ?? { px: 20, bg: 'rgb(255, 243, 222)', outline: '#1a1224', filter: '' };

      // FORGERY: swap in another icon's artwork, leaving the key untouched.
      const src = forge.get(name);
      if (src) {
        const donor = document.querySelector(`svg.fa-ic--${src}`);
        if (donor) svg.innerHTML = donor.innerHTML;
      }

      const plate = item.firstElementChild;            // the .slot20 wrapper
      plate.className = 'plate';
      const pad = Math.max(4, Math.round(s.px * 0.30));
      plate.style.cssText = `width:${s.px + pad * 2}px;height:${s.px + pad * 2}px;`
        + `background:${s.bg};border-radius:${Math.round((s.px + pad * 2) * 0.34)}px;`
        + `display:flex;align-items:center;justify-content:center;--fa-ic-ink:${s.outline};`;
      if (s.filter) svg.style.filter = s.filter;
      svg.setAttribute('width', `${s.px}px`);
      svg.setAttribute('height', `${s.px}px`);
      svg.style.width = `${s.px}px`;
      svg.style.height = `${s.px}px`;

      item.style.cssText = `width:${cell}px;height:${cell}px;display:flex;flex-direction:column;`
        + 'align-items:center;justify-content:center;gap:2px;';
      rows.push({ i: i + 1, name, px: s.px, bg: s.bg, outline: s.outline, where: s.where,
        host: s.host, bgSource: s.bgSource, forged: src ?? null });
    }
    return rows;
  },
  {
    specArr: [...spec.entries()],
    cell: CELL,
    forgeryPairs: forgery ? forgery.split(',') : [],
  },
);
await page.evaluate(({ c, cell }) => {
  document.getElementById('grid').style.gridTemplateColumns = `repeat(${c}, ${cell}px)`;
}, { c: cols, cell: CELL });
await page.waitForTimeout(200);

const png = join(out, `${tag}.png`);
await page.locator('#grid').screenshot({ path: png });
const bb = await page.locator('#grid').boundingBox();

writeFileSync(join(out, `${tag}.key.json`), JSON.stringify({
  url: target, set, seed, plate: png, mode: 'delivered', cell: CELL,
  forgery: forgery || null,
  tiles: key,                       // ← exactly the shape `icon_score.mjs` reads
  delivered: applied,
}, null, 2));

console.log(`wrote ${png}  ${Math.round(bb.width)}x${Math.round(bb.height)}px  ${key.length} tiles`);
console.log(`plate area ${Math.round(bb.width * bb.height / 1000)}k px  (judges downsample above ~1150k)`);
const missing = applied.filter((r) => !spec.has(r.name)).map((r) => r.name);
if (missing.length) console.log(`⚠️  NO DELIVERED MEASUREMENT, fell back to 20px: ${missing.join(', ')}`);
if (forgery) console.log(`FORGERY ACTIVE: ${applied.filter((r) => r.forged).map((r) => `${r.name}<=${r.forged}`).join(', ')}`);
if (errs.length) console.log('CONSOLE ERRORS:\n' + errs.join('\n'));
await browser.close();
