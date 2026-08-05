#!/usr/bin/env node
/**
 * `.fa-rarity` round 2 — how THICK can the ink stroke be before it eats the glyph?
 *
 * Round 1 (`rarity_probe.mjs`) settled the arithmetic and showed the shape of the
 * trade: a text-stroke is the only fix that is colour-independent AND needs no JS, and
 * it therefore fixes `home.ts`'s badge too — which matters, because home is another
 * agent's file and its own inset-darkening fix leaves Cyber at 4.06, still under the
 * floor. What round 1 could NOT settle is the stroke WIDTH: `-webkit-text-stroke`
 * centres on the outline, so half of it comes off the inside of a stem that is only
 * ~1.8 px wide at 11 px / weight 800. 2 px visibly closed the counters.
 *
 * So this sweeps width x size x tracking on the two fills where it is hardest to
 * judge (Cyber, the lightest, and Epic, the darkest) plus Legendary, and prints
 * nothing — the answer is in the pixels.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const FILLS = { Normal: '#9B9B9B', Legendary: '#F4A300', Cyber: '#00E5B0', Epic: '#8B4FDE' };
const INK = '#1a1224';
const CREAM = '#FFF3DE';
const WIDTHS = [0, 1, 1.2, 1.5, 1.8, 2.2];
const SIZES = [11.2, 12.6];

const args = process.argv.slice(2);
const i = args.indexOf('--out');
const out = i >= 0 ? args[i + 1] : 'shots/chars_m/rarity2.png';
await mkdir(dirname(out), { recursive: true });

const chip = (name, fill, size, w, track) => `<span class="chip" style="
  background:${fill};font-size:${size}px;letter-spacing:${track}em;color:${CREAM};
  ${w ? `-webkit-text-stroke:${w}px ${INK};` : 'text-shadow:0 1px 1px rgba(0,0,0,0.45);'}
">${name}</span>`;

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  body{margin:0;padding:14px;background:#2a1d3a;font-family:'Rubik',sans-serif;color:#FFF3DE}
  table{border-collapse:separate;border-spacing:9px 7px}
  th{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.07em;opacity:.8}
  td.lbl{font-size:10px;font-weight:800;opacity:.75;white-space:nowrap}
  .chip{display:inline-flex;align-items:center;height:21px;padding:0 9px;border:2px solid ${INK};
    border-radius:999px;font-family:'Rubik',sans-serif;font-weight:800;text-transform:uppercase;
    white-space:nowrap;paint-order:stroke fill}
</style></head><body><table>
<tr><td></td>${SIZES.map((s) => `<th colspan="${WIDTHS.length}">${s}px</th>`).join('')}</tr>
<tr><td></td>${SIZES.map(() => WIDTHS.map((w) => `<th>${w ? `${w}px` : 'none'}</th>`).join('')).join('')}</tr>
${Object.entries(FILLS).flatMap(([name, fill]) => [0.09, 0.12].map((track) => `<tr>
  <td class="lbl">${name}<br>track ${track}em</td>
  ${SIZES.map((s) => WIDTHS.map((w) => `<td>${chip(name, fill, s, w, track)}</td>`).join('')).join('')}
</tr>`)).join('')}
</table></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 560 }, deviceScaleFactor: 6 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await (await page.$('table')).screenshot({ path: out });
await browser.close();
console.log(out);
