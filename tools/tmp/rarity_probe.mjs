#!/usr/bin/env node
/**
 * `.fa-rarity` treatment bake-off — a ~20k probe instead of a critic round.
 *
 * Five of six rarities fail WCAG AA with white type on the rarity fill (Cyber 1.64,
 * Legendary 2.08, Normal 2.78, Neon 3.20, Rare 3.81; only Epic 4.92 clears). Same
 * failure family as LESSONS §1 case 10, the dark-on-dark HUD wipe that three critics
 * across three rounds reported as "no visible cooldown".
 *
 * Three candidate fixes exist and they are NOT interchangeable:
 *
 *   A  white, as shipped                 — the control
 *   B  cream + ink text-stroke           — colour-independent, what `.fa-title` and
 *                                          `.chars-card-name` already do. The open
 *                                          question is whether a stroke centred on an
 *                                          11 px glyph outline eats the counters: at
 *                                          weight 800 the stems are only ~1.8 px, and
 *                                          half the stroke width comes off each side.
 *   C  ink-or-cream chosen by luminance  — keeps the glyph crisp and the fill fully
 *                                          saturated, and clears AA for all six of
 *                                          OUR rarities (worst 4.77). But the
 *                                          crossover for an ARBITRARY colour is
 *                                          4.07:1, so it is not a guarantee — a
 *                                          rarity added to `rules.ts` at L≈0.185
 *                                          would fail silently.
 *   D  C plus a thin stroke              — crispness of C with the guarantee of B.
 *
 * The ratio is arithmetic and settled; what is NOT settled is whether B is legible at
 * badge size, and that can only be judged by looking. So: render all four at the two
 * sizes the screen actually uses, on all six fills, at 6x, and LOOK.
 *
 *   node tools/tmp/rarity_probe.mjs --out shots/chars_m/rarity.png
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const RARITY_COLORS = {
  Normal: '#9B9B9B', Rare: '#2E86D8', Epic: '#8B4FDE',
  Legendary: '#F4A300', Neon: '#FF2FD0', Cyber: '#00E5B0',
};
const INK = '#1a1224';
const CREAM = '#FFF3DE';

const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const L = (hex) => {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const cr = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? args[outIdx + 1] : 'shots/chars_m/rarity.png';
await mkdir(dirname(out), { recursive: true });

const SIZES = [11.2, 12.6];
const rows = [];
for (const [name, fill] of Object.entries(RARITY_COLORS)) {
  const l = L(fill);
  const inkWins = cr(l, L(INK)) > cr(l, L(CREAM));
  rows.push({
    name, fill,
    A: cr(l, 1),
    B: cr(L(CREAM), L(INK)),
    C: Math.max(cr(l, L(INK)), cr(l, L(CREAM))),
    pick: inkWins ? INK : CREAM,
  });
}

const cell = (r, variant, size) => {
  const common = `background:${r.fill};font-size:${size}px;`;
  if (variant === 'A') return `<span class="chip" style="${common}color:#fff;text-shadow:0 1px 1px rgba(0,0,0,0.45)">${r.name}</span>`;
  if (variant === 'B') return `<span class="chip stroke" style="${common}color:${CREAM};-webkit-text-stroke:2px ${INK}">${r.name}</span>`;
  if (variant === 'C') return `<span class="chip" style="${common}color:${r.pick}">${r.name}</span>`;
  return `<span class="chip stroke" style="${common}color:${r.pick};-webkit-text-stroke:1.2px ${r.pick === INK ? CREAM : INK}">${r.name}</span>`;
};

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  body { margin:0; padding:14px; background:#2a1d3a; font-family:'Rubik',sans-serif; color:#FFF3DE; }
  table { border-collapse:separate; border-spacing:10px 8px; }
  th { font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:0.08em; opacity:0.8; }
  td.lbl { font-size:11px; font-weight:800; opacity:0.75; }
  .chip {
    display:inline-flex; align-items:center; height:21px; padding:0 9px;
    border:2px solid ${INK}; border-radius:999px;
    font-family:'Rubik',sans-serif; font-weight:800; letter-spacing:0.09em;
    text-transform:uppercase; white-space:nowrap;
  }
  .chip.stroke { paint-order:stroke fill; }
</style></head><body>
<table>
<tr><th></th>${SIZES.map((s) => `<th colspan="4">${s}px</th>`).join('')}</tr>
<tr><td></td>${SIZES.map(() => '<th>A white</th><th>B stroke</th><th>C pick</th><th>D pick+stroke</th>').join('')}</tr>
${rows.map((r) => `<tr><td class="lbl">${r.name}<br>A ${r.A.toFixed(2)} · B ${r.B.toFixed(2)} · C ${r.C.toFixed(2)}</td>${
  SIZES.map((s) => ['A', 'B', 'C', 'D'].map((v) => `<td>${cell(r, v, s)}</td>`).join('')).join('')
}</tr>`).join('')}
</table></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 420 }, deviceScaleFactor: 6 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
const el = await page.$('table');
await el.screenshot({ path: out });
await browser.close();

console.log('\n  rarity      fill       A white   B cream/ink-stroke   C pick   picked');
for (const r of rows) {
  console.log(`  ${r.name.padEnd(11)} ${r.fill}   ${r.A.toFixed(2).padStart(6)}   ${r.B.toFixed(2).padStart(6)}              ${r.C.toFixed(2).padStart(6)}   ${r.pick}`);
}
console.log(`\n  worst-case for C over ALL possible fills: 4.07 (crossover L=0.185) — below the 4.5 floor.`);
console.log(`  ${out}\n`);
