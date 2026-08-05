#!/usr/bin/env node
/**
 * PAIRED figure/ground A/B from two `valuescan --mode dl` logs.
 *
 * `docs/LESSONS.md` §5: a paired per-row delta and an aggregate delta are different
 * quantities, and conflating them is how a stale driver hid 58 changed matchups behind
 * a 0.8 pp aggregate. So this prints BOTH — the cast minimum and the mean, and every
 * row that moved by more than `--tol` in either direction, named.
 *
 *   node tools/tmp/dlab.mjs --a /tmp/vs_head.log --b /tmp/vs_mine.log
 */
import { readFile } from 'node:fs/promises';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const TOL = Number(arg('tol', 0.01));

const parse = async (p) => {
  const rows = new Map();
  for (const line of (await readFile(p, 'utf8')).split('\n')) {
    const m = line.match(/^(\S+)\s+(\S+)\s+dL\s+(-?[\d.]+)\s+\|dL\|\s+([\d.]+)\s+dLedge\s+(-?[\d.]+)\s+fig\s+([\d.]+)\s+grd\s+([\d.]+)/);
    if (m) rows.set(`${m[1]}|${m[2]}`, { id: m[1], st: m[2], dL: +m[3], fig: +m[6], grd: +m[7] });
  }
  return rows;
};
const A = await parse(arg('a', '/tmp/vs_head.log'));
const B = await parse(arg('b', '/tmp/vs_mine.log'));
const keys = [...A.keys()].filter((k) => B.has(k));
console.log(`paired rows: ${keys.length}  (A ${A.size}, B ${B.size})`);

const perChar = new Map();
let moved = [];
for (const k of keys) {
  const a = A.get(k), b = B.get(k);
  const d = b.dL - a.dL;
  if (!perChar.has(a.id)) perChar.set(a.id, { aMin: Infinity, bMin: Infinity, dSum: 0, n: 0 });
  const c = perChar.get(a.id);
  c.aMin = Math.min(c.aMin, a.dL); c.bMin = Math.min(c.bMin, b.dL); c.dSum += d; c.n++;
  if (Math.abs(d) >= TOL) moved.push({ ...a, bdL: b.dL, d, agrd: a.grd, bgrd: b.grd });
}
console.log('\ncharacter      A min     B min    delta      mean delta');
let aCastMin = Infinity, bCastMin = Infinity, aBelow = 0, bBelow = 0;
for (const [id, c] of perChar) {
  aCastMin = Math.min(aCastMin, c.aMin); bCastMin = Math.min(bCastMin, c.bMin);
  console.log(`${id.padEnd(14)}${c.aMin.toFixed(4).padStart(7)}  ${c.bMin.toFixed(4).padStart(7)}  ${(c.bMin - c.aMin >= 0 ? '+' : '') + (c.bMin - c.aMin).toFixed(4)}      ${(c.dSum / c.n >= 0 ? '+' : '') + (c.dSum / c.n).toFixed(4)}`);
}
for (const k of keys) { if (A.get(k).dL < 0.10) aBelow++; if (B.get(k).dL < 0.10) bBelow++; }
console.log(`\ncast minimum        ${aCastMin.toFixed(4)}  ->  ${bCastMin.toFixed(4)}`);
console.log(`rows below dL 0.10  ${aBelow} of ${keys.length}  ->  ${bBelow} of ${keys.length}`);
const meanA = keys.reduce((s, k) => s + A.get(k).dL, 0) / keys.length;
const meanB = keys.reduce((s, k) => s + B.get(k).dL, 0) / keys.length;
console.log(`mean dL             ${meanA.toFixed(4)}  ->  ${meanB.toFixed(4)}   (${(meanB - meanA >= 0 ? '+' : '') + (meanB - meanA).toFixed(4)})`);
const grdA = keys.reduce((s, k) => s + A.get(k).grd, 0) / keys.length;
const grdB = keys.reduce((s, k) => s + B.get(k).grd, 0) / keys.length;
console.log(`mean ground luma    ${grdA.toFixed(4)}  ->  ${grdB.toFixed(4)}   (${(grdB - grdA >= 0 ? '+' : '') + (grdB - grdA).toFixed(4)})`);

moved.sort((x, y) => x.d - y.d);
console.log(`\nrows moved by >= ${TOL}:  ${moved.length} of ${keys.length}`);
for (const m of moved) {
  console.log(`  ${m.id.padEnd(13)}${m.st.padEnd(14)} dL ${m.dL.toFixed(4)} -> ${m.bdL.toFixed(4)}  (${(m.d >= 0 ? '+' : '') + m.d.toFixed(4)})   ground ${m.agrd.toFixed(4)} -> ${m.bgrd.toFixed(4)}`);
}
