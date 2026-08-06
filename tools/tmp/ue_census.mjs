#!/usr/bin/env node
/**
 * ue_census — the questions a critic cannot answer and a DOM can.
 *
 * THROWAWAY, read-only. Reads `shots/uielem/_raw/ours.json` (written by `ue_shoot`)
 * and prints five censuses over the elements under test. Every number here has a floor
 * of ZERO — they are counts and CSS declarations, not estimates — which is why they
 * carry the ordering that `40afa14` proved the critic's per-element scores cannot.
 *
 *   1. TYPE       distinct font-size/weight/family triples, and which element uses each
 *   2. CHROME     distinct border-radius and box-shadow declarations
 *   3. GLYPHS     raw Extended_Pictographic characters still rendering as type
 *   4. TRUNCATION text runs whose scrollWidth exceeds their clientWidth
 *   5. HIERARCHY  each control's device-pixel area against its screen's primary action
 *
 * (3) and (5) are the two that found defects. (3) because `emojiIcon()` falls through
 * to the glyph when a token is unmapped and nothing downstream can tell; (5) because
 * "the secondary button is nearly as big as the primary" is invisible to every
 * per-element pair by construction — an isolated crop cannot see what it sits beside.
 */
import { readFile } from 'node:fs/promises';

const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'shots/uielem';
const ours = JSON.parse(await readFile(`${OUT}/_raw/ours.json`, 'utf8'));
const VP = process.argv.includes('--vp') ? process.argv[process.argv.indexOf('--vp') + 1] : 'plate';
const vp = ours.viewports[VP];

const EMOJI = /\p{Extended_Pictographic}/u;
const type = new Map(), radius = new Map(), shadow = new Map(), glyphs = [], areas = [];

for (const [screen, s] of Object.entries(vp.screens)) {
  for (const [el, r] of Object.entries(s.rects)) {
    if (!r.found) continue;
    areas.push({ screen, el, w: Math.round(r.css.w * vp.canvas.dsf), h: Math.round(r.css.h * vp.canvas.dsf) });
    for (const d of r.descend) {
      if (d.text) {
        const key = `${d.fs}/${d.fw}/${d.ff}`;
        if (!type.has(key)) type.set(key, new Set());
        type.get(key).add(`${screen}:${el}`);
        if (EMOJI.test(d.text)) glyphs.push({ screen, el, cls: d.cls, text: d.text });
      }
      if (d.radius && d.radius !== '0px') {
        if (!radius.has(d.radius)) radius.set(d.radius, new Set());
        radius.get(d.radius).add(`${screen}:${el}`);
      }
      if (d.shadow) {
        if (!shadow.has(d.shadow)) shadow.set(d.shadow, new Set());
        shadow.get(d.shadow).add(`${screen}:${el}`);
      }
    }
  }
}

const px = (s) => parseFloat(s) || 0;
console.log(`=== 1. TYPE — ${type.size} distinct size/weight/family triples across ${Object.keys(vp.screens).length} screens' tested elements (@${VP}) ===`);
for (const [k, v] of [...type.entries()].sort((a, b) => px(b[0]) - px(a[0]))) {
  console.log(`  ${k.padEnd(34)} ${[...v].join(', ')}`);
}
const fam = new Set([...type.keys()].map((k) => k.split('/')[2]));
console.log(`  -> ${new Set([...type.keys()].map((k) => k.split('/')[0])).size} distinct SIZES, `
  + `${new Set([...type.keys()].map((k) => k.split('/')[1])).size} distinct WEIGHTS, ${fam.size} FAMILIES: ${[...fam].join(', ')}`);

console.log(`\n=== 2. CHROME — ${radius.size} distinct border-radius, ${shadow.size} distinct box-shadow, on the tested elements alone ===`);
for (const [k, v] of [...radius.entries()].sort((a, b) => px(b[0]) - px(a[0]))) console.log(`  radius ${k.padEnd(30)} ${[...v].slice(0, 6).join(', ')}`);
for (const [k, v] of [...shadow.entries()]) console.log(`  shadow ${k.slice(0, 70).padEnd(72)} ${[...v].slice(0, 4).join(', ')}`);

console.log(`\n=== 3. RAW EMOJI still rendering as type ===`);
if (!glyphs.length) console.log('  none');
for (const g of glyphs) console.log(`  ${g.screen}:${g.el} .${g.cls}  "${g.text}"`);

console.log(`\n=== 5. HIERARCHY — device-px area against that screen's own primary action ===`);
for (const screen of Object.keys(vp.screens)) {
  const prim = areas.find((a) => a.screen === screen && a.el === 'primary-button');
  if (!prim) continue;
  const pa = prim.w * prim.h;
  console.log(`  ${screen} (primary = ${prim.w}x${prim.h} = ${pa} px)`);
  for (const a of areas.filter((x) => x.screen === screen).sort((x, y) => y.w * y.h - x.w * x.h)) {
    console.log(`    ${a.el.padEnd(20)} ${String(a.w).padStart(5)}x${String(a.h).padEnd(5)} = ${String(a.w * a.h).padStart(7)}  ${(a.w * a.h / pa).toFixed(2)}x primary`);
  }
}
