#!/usr/bin/env node
/**
 * The value pass's own before/after, rendered as the table the brief asked for.
 *
 * Reads two `valuescan --mode chars` outputs and (optionally) two `--mode dl` outputs
 * and prints range / p05 / steps / weakBoundaryPct / figure-ground per character with
 * the gate verdict, plus how many characters pass all of the gates each side.
 *
 * ⚠️ BOTH SIDES MUST BE MEASURED ON THE SAME TREE apart from the change under test.
 * A peer landed a post-chain `shadowToe` mid-pass that moved p05 by -0.035 across the
 * whole cast on its own; comparing this work against a figure recorded before that
 * would have credited it with someone else's 27%. `docs/LESSONS.md` §5.
 *
 *   node tools/tmp/valuereport.mjs --before shots/vlBase --after shots/vlFinal
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BEFORE = get('--before', 'shots/vlBase');
const AFTER = get('--after', 'shots/vlFinal');
const IDS = get('--ids', 'hamburger,donut,taco,burrito,egg,lollipop,pizza,sushi,soup,waterbottle,hotdog').split(',');

/** Thresholds copied verbatim from `valuescan.mjs`'s GATES so the two cannot drift. */
const G = { range: 0.636, p05: 0.180, steps: 6, weakB: 15 };

const load = async (dir, f) => (existsSync(join(dir, f)) ? JSON.parse(await readFile(join(dir, f), 'utf8')) : null);
const weakB = (c) => {
  const A = (c && c.ss && c.ss.adjacent) || [];
  const t = A.reduce((s, p) => s + p.contacts, 0);
  return t ? +((100 * A.filter((p) => p.dL < 0.10).reduce((s, p) => s + p.contacts, 0)) / t).toFixed(1) : 0;
};
const row = (c) => {
  const L = c.shipped.ladder;
  return { range: L.range, p05: L.p05, steps: L.steps.j10, weakB: weakB(c), fg: c.shipped.fg.dL };
};
const passes = (v) => v.range >= G.range && v.p05 <= G.p05 && v.steps >= G.steps && v.weakB <= G.weakB;
const m = (ok) => (ok ? '✓' : '✗');

const B = await load(BEFORE, 'chars.json'), A2 = await load(AFTER, 'chars.json');
if (!B || !A2) { console.error('missing chars.json on one side'); process.exit(2); }

console.log('\nVALUE LADDER — before/after, both measured on the SAME tree');
console.log(`  before: ${BEFORE} (pristine HEAD)     after: ${AFTER} (HEAD + src/characters)\n`);
console.log('char             range              p05              steps        weakBoundary%       gate');
let np = 0, nb = 0;
const dlB = await load(BEFORE, 'dl.json'), dlA = await load(AFTER, 'dl.json');
const fgRows = [];
for (const id of IDS) {
  if (!B[id] || !A2[id]) { console.log(`${id.padEnd(14)} MISSING`); continue; }
  const b = row(B[id]), v = row(A2[id]);
  if (passes(b)) nb++;
  if (passes(v)) np++;
  console.log(
    id.padEnd(14) +
    `${b.range.toFixed(3)} -> ${v.range.toFixed(3)}${m(v.range >= G.range)}  `.padEnd(19) +
    `${b.p05.toFixed(3)} -> ${v.p05.toFixed(3)}${m(v.p05 <= G.p05)}  `.padEnd(19) +
    `${b.steps} -> ${v.steps}${m(v.steps >= G.steps)}  `.padEnd(13) +
    `${b.weakB.toFixed(1)} -> ${v.weakB.toFixed(1)}${m(v.weakB <= G.weakB)}  `.padEnd(20) +
    (passes(v) ? 'PASS' : 'fail: ' + [
      v.range < G.range && 'range', v.p05 > G.p05 && 'p05',
      v.steps < G.steps && 'steps', v.weakB > G.weakB && 'weakB',
    ].filter(Boolean).join(','))
  );
  fgRows.push({ id, b, v });
}
console.log(`\n  gate (range + p05 + steps + weakBoundary): ${nb}/${IDS.length} -> ${np}/${IDS.length}`);

console.log('\nFIGURE / GROUND — the budget this pass had to spend FROM, not into');
console.log('char           pot_south dL       worst of the 5 measured stations   station');
for (const { id, b, v } of fgRows) {
  let extra = '';
  if (dlB && dlA) {
    const wb2 = dlB.rows.filter((r) => r.id === id && !r.error);
    const wa = dlA.rows.filter((r) => r.id === id && !r.error);
    if (wb2.length && wa.length) {
      const lo = (rs) => rs.reduce((x, y) => (x.dL <= y.dL ? x : y));
      const b2 = lo(wb2), a3 = lo(wa);
      // grease_in is a known ARENA fact — 9 of 11 fail it and the gate allows one
      // station — so the SECOND-worst is the number that decides anything.
      const s2 = (rs) => rs.slice().sort((x, y) => x.dL - y.dL)[1];
      const b3 = s2(wb2), a4 = s2(wa);
      extra = `${b2.dL.toFixed(3)} -> ${a3.dL.toFixed(3)}   2nd ${b3.dL.toFixed(3)} -> ${a4.dL.toFixed(3)}  ${a4.station}`;
    }
  }
  console.log(`${id.padEnd(14)}${b.fg.toFixed(3)} -> ${v.fg.toFixed(3)}   ${extra}`);
}
const minB = Math.min(...fgRows.map((r) => r.b.fg)), minA = Math.min(...fgRows.map((r) => r.v.fg));
console.log(`\n  minimum pot_south figure/ground across the cast: ${minB.toFixed(4)} -> ${minA.toFixed(4)}  (floor 0.10)`);
