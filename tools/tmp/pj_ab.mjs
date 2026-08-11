#!/usr/bin/env node
/**
 * PAIRED A/B over two `pj_probe.mjs` runs.
 *
 * ⚠️ PAIRED PER WEAPON, AND THE AGGREGATE IS PRINTED SEPARATELY AND LABELLED.
 * `CLAUDE.md` rule 10: *"a paired per-matchup delta on identical seeds is EXACT — it
 * is a DIFFERENT QUANTITY from an aggregate and must be reported separately."* The
 * precedent it comes from is `roster_table`, whose aggregate moved 0.8 pp (inside the
 * floor) while **58 of 110 individual matchups moved, max 34.4 pp**. The same shape is
 * live here: a treatment that only rescues the small bespoke projectiles leaves the ten
 * generic ones almost untouched, so a mean over 23 weapons understates it by ~2x and a
 * mean is the number somebody would quote.
 *
 * ⚠️ AND THE PAIRING IS NOT EXACT HERE, WHICH IS SAID OUT LOUD RATHER THAN ASSUMED.
 * `pj_probe` drives the REAL game: the shot leaves a live fighter at a live position
 * on a live arena, and the two arms are two separate matches. Distances sampled differ
 * by a few world units, and what the shot happens to fly over differs with it. So a
 * per-weapon delta here is **paired by weapon, not by pixel**, and a difference under
 * roughly the run-to-run spread of a single arm means nothing. Two independent runs of
 * the same arm on hamburger.Tomato gave median areas of 34 / 34.5 / 35 / 36 / 37 px
 * (five runs, spread 3 px, ~8%) and dE 0.1666 / 0.1741 / 0.174 / 0.1785 / 0.1892
 * (spread 0.023, ~13%). **Treat anything under 15% on either column as noise.**
 *
 *   node tools/tmp/pj_ab.mjs --before shots/pj/before/pj.pitch58.json \
 *                            --after  shots/pj/after/pj.pitch58.json
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2), n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true; else { out[k] = n; i++; }
  }
  return out;
}
const args = parseArgs(process.argv);
const pad = (s, n) => String(s).padEnd(n);
const log = (...a) => console.log(...a);
/** Anything under this on either column is inside one arm's own run-to-run spread. */
const NOISE = Number(args.noise ?? 0.15);

function ratio(a, b) {
  if (!a || !b) return null;
  return +(b / a).toFixed(2);
}

async function main() {
  const before = JSON.parse(await readFile(resolve(String(args.before)), 'utf8'));
  const after = JSON.parse(await readFile(resolve(String(args.after)), 'utf8'));
  const key = (r) => `${r.char}.${r.weapon}`;
  const B = new Map(before.results.map((r) => [key(r), r]));
  const A = new Map(after.results.map((r) => [key(r), r]));

  const rows = [];
  for (const [k, b] of B) {
    const a = A.get(k);
    if (!a || !b.median || !a.median) { rows.push({ k, missing: true, color: b.color }); continue; }
    rows.push({
      k, color: b.color,
      bN: b.median.n, aN: a.median.n, xN: ratio(b.median.n, a.median.n),
      bE: b.median.deMed, aE: a.median.deMed, xE: ratio(b.median.deMed, a.median.deMed),
      bE9: b.median.deP90, aE9: a.median.deP90, xE9: ratio(b.median.deP90, a.median.deP90),
      // ⚠️ DERIVED, and labelled as such. dE is a PER-PIXEL intensity and area is a
      // count; a soft glow adds many pixels at moderate dE and therefore LOWERS the
      // median while raising the total. Both are printed above on their own; this is
      // the product, which is the closest single number to "how much separated signal
      // does this projectile put on the screen". It is not a measurement, it is an
      // arithmetic combination of two, and no threshold is set on it.
      bS: +(b.median.n * b.median.deMed).toFixed(0), aS: +(a.median.n * a.median.deMed).toFixed(0),
      bW: b.worst.n, aW: a.worst.n, xW: ratio(b.worst.n, a.worst.n),
      bWE: b.worst.deMed, aWE: a.worst.deMed,
      bCast: b.vsCast ? b.vsCast.worstDL : null, aCast: a.vsCast ? a.vsCast.worstDL : null,
      bHue: b.median.dHue, aHue: a.median.dHue,
      drift: [...(b.drift ?? []), ...(a.drift ?? [])],
    });
  }
  rows.sort((x, y) => (x.bE ?? 9) - (y.bE ?? 9));

  // ── The drift control, first, because nothing below is worth reading without it ──
  const allDrift = rows.flatMap((r) => r.drift ?? []);
  const bad = allDrift.filter((d) => d && (d.n !== 0 || d.dL !== 0 || d.de !== 0));
  log(`\n══ DRIFT CONTROL — every frozen frame measured TWICE ══════════════════════════`);
  log(`  ${allDrift.length} self-pairs across both arms · ${bad.length} non-zero`);
  log(`  ${bad.length === 0 ? '→ 0.000000 EXACTLY on every column. The instrument is deterministic on one frame.'
    : '→ ⚠️ ' + bad.length + ' SELF-PAIRS DRIFTED — nothing below is trustworthy: ' + JSON.stringify(bad.slice(0, 3))}`);

  log(`\n══ PAIRED PER WEAPON — delivered area and OKLab separation, MEDIAN OF FLIGHT ══`);
  log(`  sorted by the BEFORE separation, worst first. x = after/before.`);
  log(`  ⚠️ x within ${(NOISE * 100).toFixed(0)}% of 1.00 is inside one arm's own spread — see the header.\n`);
  log(`  ${pad('weapon', 22)}${pad('colour', 9)}${pad('px before', 11)}${pad('px after', 10)}${pad('x', 8)}`
    + `${pad('dE med b', 10)}${pad('dE med a', 10)}${pad('dE p90 b', 10)}${pad('dE p90 a', 10)}${pad('signal b', 10)}${pad('signal a', 10)}${pad('x', 7)}`);
  for (const r of rows) {
    if (r.missing) { log(`  ${pad(r.k, 22)}${pad(r.color ?? '-', 9)}(missing from one arm)`); continue; }
    const flagN = r.xN !== null && Math.abs(r.xN - 1) < NOISE ? ' ~' : '';
    const flagE = r.xE !== null && Math.abs(r.xE - 1) < NOISE ? ' ~' : '';
    log(`  ${pad(r.k, 22)}${pad(r.color ?? '-', 9)}${pad(r.bN, 11)}${pad(r.aN, 10)}${pad((r.xN ?? '-') + 'x' + flagN, 8)}`
      + `${pad(r.bE, 10)}${pad(r.aE, 10)}${pad(r.bE9, 10)}${pad(r.aE9, 10)}${pad(r.bS, 10)}${pad(r.aS, 10)}${pad(ratio(r.bS, r.aS) + 'x', 7)}`);
    void flagE;
  }

  log(`\n══ THE SAME AT THE WEAKEST SAMPLE OF EACH FLIGHT ("until they explode") ═══════`);
  log(`  ${pad('weapon', 22)}${pad('px before', 11)}${pad('px after', 10)}${pad('x', 8)}${pad('dE before', 11)}${pad('dE after', 10)}`
    + `${pad('|dL| cast b', 12)}|dL| cast a`);
  for (const r of rows) {
    if (r.missing) continue;
    log(`  ${pad(r.k, 22)}${pad(r.bW, 11)}${pad(r.aW, 10)}${pad((r.xW ?? '-') + 'x', 8)}${pad(r.bWE, 11)}${pad(r.aWE, 10)}`
      + `${pad(r.bCast ?? '-', 12)}${r.aCast ?? '-'}`);
  }

  // ── The aggregate, LAST and labelled, because it is the number that misleads ──
  const ok = rows.filter((r) => !r.missing);
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  const moved = ok.filter((r) => r.xN !== null && Math.abs(r.xN - 1) >= NOISE);
  log(`\n══ AGGREGATE — a DIFFERENT QUANTITY from the rows above, printed last on purpose ══`);
  log(`  weapons paired                 ${ok.length}`);
  log(`  weapons whose AREA moved       ${moved.length} of ${ok.length}  (>= ${(NOISE * 100).toFixed(0)}%, i.e. outside one arm's spread)`);
  log(`  MEDIAN area ratio              ${med(ok.map((r) => r.xN)).toFixed(2)}x`);
  log(`  MEAN area ratio                ${mean(ok.map((r) => r.xN)).toFixed(2)}x   <- flattened by the weapons that were already fine`);
  log(`  largest single gain            ${ok.reduce((a, b) => (b.xN > a.xN ? b : a)).k}  ${ok.reduce((a, b) => (b.xN > a.xN ? b : a)).xN}x`);
  log(`  smallest                       ${ok.reduce((a, b) => (b.xN < a.xN ? b : a)).k}  ${ok.reduce((a, b) => (b.xN < a.xN ? b : a)).xN}x`);
  log(`  MEDIAN dE-median ratio         ${med(ok.map((r) => r.xE)).toFixed(2)}x   <- per-pixel intensity; a soft glow LOWERS this by adding mid-dE pixels`);
  log(`  MEDIAN dE-p90 ratio            ${med(ok.map((r) => r.xE9)).toFixed(2)}x   <- the strongest decile, i.e. the core`);
  log(`  MEDIAN signal ratio (derived)  ${med(ok.map((r) => ratio(r.bS, r.aS))).toFixed(2)}x`);
  const worse = ok.filter((r) => r.xE9 !== null && r.xE9 < 1 - NOISE);
  log(`  weapons whose dE-p90 got WORSE ${worse.length}${worse.length ? ': ' + worse.map((r) => r.k + ' ' + r.xE9 + 'x').join(', ') : ''}`);
  const shrank = ok.filter((r) => r.xN !== null && r.xN < 1 - NOISE);
  log(`  weapons whose AREA shrank      ${shrank.length}${shrank.length ? ': ' + shrank.map((r) => r.k + ' ' + r.xN + 'x').join(', ') : ''}   (the size floor NEVER shrinks; any entry here is a bug)`);
}

/** IS_MAIN guard — `docs/AGENT-BRIEF.md` §3. */
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_MAIN) await main();
