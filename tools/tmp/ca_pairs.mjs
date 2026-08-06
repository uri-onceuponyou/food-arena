#!/usr/bin/env node
/**
 * ca_pairs — read a `valuescan --mode chars` chars.json and print the per-pair
 * adjacency table **with the sign restored**.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * `valuescan --mode gate` prints `weakBc%` and a `flip` count, and `--mode chars`
 * prints "the tightest three pairs" — both of which give you the MAGNITUDE of a weak
 * boundary and neither of which tells you WHICH SIDE TO MOVE. `dLcontact` is
 * `|cA - cB|`; the sign survives only in `cA`/`cB`, which reach disk at
 * `valuescan.mjs:777` (`result.adjacent = adj.pairs`) and are never printed.
 *
 * A pass steering on an unsigned number is a pass guessing which of two parts to
 * darken, and `docs/LESSONS.md` §13 is the file about instruments that are perfectly
 * true and still tell you nothing.
 *
 * ── What it prints ───────────────────────────────────────────────────────────
 * Per character, every pair `valuescan` reported (i.e. already contact-gated at
 * `minContacts`), sorted by `dLcontact` ASCENDING — weakest boundary first, which is
 * the opposite of `valuescan`'s own sort (it sorts by `dL`, deliberately, because
 * every recorded sentence quoting "the tightest three" means that order).
 *
 *   dLc      the boundary-local step. FLOOR 0.0039 = 1/255, the framebuffer's own
 *            8-bit quantisation. Target >= 0.15.
 *   dL       the whole-part median step. Printed for comparison ONLY — it is wrong in
 *            both directions (valuescan --selftest section L) and must not be steered on.
 *   cA / cB  the two contact-band means. `A` is whichever part sorts first in
 *            `valuescan`'s JOINTS order, not the brighter one.
 *   dir      which side is DARKER at the boundary, spelled out, because that is the
 *            entire question `dLcontact` cannot answer.
 *   cpx      pixels in each contact band. ⚠️ A band of a handful of pixels is a weak
 *            reading: a 9 px band is one row of one limb and its mean is noise.
 *
 * ── Reading it ───────────────────────────────────────────────────────────────
 * `need` is how much luma has to be ADDED to the brighter side (or removed from the
 * darker) to reach 0.15. It is a first-order estimate on the CONTACT BAND, not on the
 * part: moving a part's albedo does not move its contact band by the same amount,
 * because the band is exactly the shaded/occluded strip where the two parts meet.
 * Measure the result; do not report the estimate as the result.
 *
 *   node tools/tmp/ca_pairs.mjs shots/vl/ca_before/chars.json
 *   node tools/tmp/ca_pairs.mjs shots/vl/ca_before/chars.json --only taco,soup --max 0.15
 *   node tools/tmp/ca_pairs.mjs A/chars.json --vs B/chars.json      # paired delta
 *
 * `--selftest` runs the sign logic against hand-derived inputs. `docs/LESSONS.md` §13:
 * a tool that reports a plausible wrong side is worse than no tool.
 */
import { readFileSync } from 'node:fs';

const a = process.argv.slice(2);
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const has = (k) => a.includes(k);

/** Floor of `dLcontact`: 1/255, the framebuffer's own quantisation. */
export const DLC_FLOOR = 0.0039;
/** The target this pass steers to. */
export const DLC_TARGET = 0.15;

/**
 * The one piece of logic worth a selftest: given a pair row, which side is darker and
 * by how much does the gap fall short. Pure, so it can be checked against inputs whose
 * answer is arithmetic rather than opinion.
 */
export function classify(p, target = DLC_TARGET) {
  if (p.dLcontact == null || p.cA == null || p.cB == null) {
    return { ok: false, why: 'no contact band (a part with no measured pixels on this side)' };
  }
  const darker = p.cA < p.cB ? p.a : p.b;
  const brighter = p.cA < p.cB ? p.b : p.a;
  const gap = Math.abs(p.cA - p.cB);
  return {
    ok: true,
    darker,
    brighter,
    gap: +gap.toFixed(4),
    need: +Math.max(0, target - gap).toFixed(4),
    /** true when the two bands are within the 8-bit floor — the sign is NOT readable. */
    signUnreadable: gap < DLC_FLOOR,
    /** true when either band is too small to mean anything. */
    thin: Math.min(p.cpxA ?? 0, p.cpxB ?? 0) < 20,
  };
}

function selftest() {
  let pass = 0, fail = 0;
  const check = (name, cond, detail) => {
    if (cond) { pass++; console.log(`  ✓ ${name.padEnd(62)} ${detail}`); }
    else { fail++; console.log(`  ✗ ${name.padEnd(62)} ${detail}`); }
  };
  console.log('\nca_pairs --selftest — the SIGN, on inputs whose answer is arithmetic\n');

  // A darker than B. The tool must name `head`, not `torso`, however the row is ordered.
  const r1 = classify({ a: 'head', b: 'torso', cA: 0.20, cB: 0.60, cpxA: 100, cpxB: 100, dLcontact: 0.40 });
  check('A darker than B names A', r1.darker === 'head', `darker=${r1.darker}`);
  check('...and B as the brighter side', r1.brighter === 'torso', `brighter=${r1.brighter}`);
  check('gap is |cA-cB|, not a median difference', r1.gap === 0.4, `${r1.gap}`);
  check('a pair already past target needs 0', r1.need === 0, `${r1.need}`);

  // B darker than A — the SAME magnitude, the OPPOSITE answer. This is the assertion
  // that would fail if the comparison were ever written the wrong way round, and it is
  // the only reason this file exists.
  const r2 = classify({ a: 'head', b: 'torso', cA: 0.60, cB: 0.20, cpxA: 100, cpxB: 100, dLcontact: 0.40 });
  check('THE REVERSAL: same magnitude, other side, names torso', r2.darker === 'torso', `darker=${r2.darker}`);
  check('...and the two answers actually differ', r1.darker !== r2.darker, `${r1.darker} vs ${r2.darker}`);

  // Shortfall arithmetic.
  const r3 = classify({ a: 'x', b: 'y', cA: 0.50, cB: 0.53, cpxA: 100, cpxB: 100, dLcontact: 0.03 });
  check('need = target - gap', Math.abs(r3.need - 0.12) < 1e-9, `${r3.need}`);

  // Below the 8-bit floor the SIGN IS NOT INFORMATION. A tool that prints "torso is
  // darker" off a 0.001 difference is inventing a direction out of quantisation noise.
  const r4 = classify({ a: 'x', b: 'y', cA: 0.5000, cB: 0.5010, cpxA: 100, cpxB: 100, dLcontact: 0.001 });
  check('a gap under 1/255 is flagged as an UNREADABLE sign', r4.signUnreadable === true, `gap ${r4.gap} < ${DLC_FLOOR}`);
  const r5 = classify({ a: 'x', b: 'y', cA: 0.500, cB: 0.520, cpxA: 100, cpxB: 100, dLcontact: 0.02 });
  check('a gap over 1/255 is NOT flagged', r5.signUnreadable === false, `gap ${r5.gap}`);

  // A thin band is a weak reading and must say so — 9 px is one row of one limb.
  const r6 = classify({ a: 'x', b: 'y', cA: 0.2, cB: 0.8, cpxA: 9, cpxB: 400, dLcontact: 0.6 });
  check('a 9 px contact band is flagged THIN', r6.thin === true, `cpxA 9`);
  check('...and still reports its sign', r6.darker === 'x', `darker=${r6.darker}`);

  // A pair the instrument could not measure must not be given a direction at all.
  const r7 = classify({ a: 'x', b: 'y', cA: null, cB: null, dLcontact: null });
  check('an unmeasured pair returns ok:false, not a guess', r7.ok === false && r7.darker === undefined, r7.why);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  return fail ? 1 : 0;
}

function load(path) {
  const j = JSON.parse(readFileSync(path, 'utf8'));
  const out = {};
  for (const [id, c] of Object.entries(j)) {
    if (id === '__meta') continue;
    if (!c || !c.ss || !c.ss.adjacent) continue;
    out[id] = c.ss.adjacent;
  }
  // ── REFUSE A PRE-`236f97f` FILE RATHER THAN PRINT AN EMPTY TABLE ───────────
  // `dLcontact`/`cA`/`cB` were added in `236f97f`; every chars.json written before it
  // has `adjacent` rows carrying only `dL`. Sorting those by `dLcontact ?? 9` and then
  // filtering on `--max` prints NOTHING, which is indistinguishable from "this cast has
  // no weak boundaries" — the best possible news, from the worst possible cause.
  // Measured: `shots/vl/gate_head3/chars.json` (16:08, toolHash 28c2fc7819c43633) does
  // exactly this. `docs/LESSONS.md` §13 — a silent zero is not an answer.
  const rows = Object.values(out).flat();
  const withC = rows.filter((p) => p.dLcontact != null).length;
  if (rows.length && withC === 0) {
    console.error(`\n✗ REFUSED — ${path} has ${rows.length} adjacency rows and NOT ONE carries`);
    console.error('  `dLcontact`. It was written by a valuescan older than `236f97f`, so the only');
    console.error('  number in it is `dL` — the whole-part median this tool exists to stop you');
    console.error('  steering on. Re-run `valuescan --mode chars`; there is no way to recover the');
    console.error('  contact bands from this file.\n');
    process.exit(2);
  }
  return { rows: out, meta: j.__meta, withContact: withC, totalRows: rows.length };
}

if (has('--selftest')) process.exit(selftest());

const path = a.find((x) => !x.startsWith('--') && a[a.indexOf(x) - 1] !== '--only'
  && a[a.indexOf(x) - 1] !== '--max' && a[a.indexOf(x) - 1] !== '--vs');
if (!path) {
  console.error('usage: ca_pairs.mjs <chars.json> [--only ids] [--max dLc] [--vs other/chars.json]');
  process.exit(2);
}
const only = get('--only', null);
const ids = only ? only.split(',') : null;
const max = Number(get('--max', 1e9));
const vsPath = get('--vs', null);

const A = load(path);
const B = vsPath ? load(vsPath) : null;
console.log(`\nchars ${path}`);
console.log(`  tree ${A.meta ? A.meta.srcId : 'UNSTAMPED'}   measured ${A.meta ? A.meta.finishedAt : '?'}`);
if (B) {
  console.log(`vs    ${vsPath}`);
  console.log(`  tree ${B.meta ? B.meta.srcId : 'UNSTAMPED'}   measured ${B.meta ? B.meta.finishedAt : '?'}`);
}
console.log(`\n  dLcontact floor ${DLC_FLOOR} (1/255) · target ${DLC_TARGET} · sorted WEAKEST FIRST`);
console.log('  ⚠️ dL is printed for comparison only. It is the whole-part median and is wrong in');
console.log('     both directions (valuescan --selftest section L). Steer on dLc.\n');

const hdr = `${'pair'.padEnd(24)}${'dLc'.padStart(8)}${'dL'.padStart(8)}${'cA'.padStart(8)}${'cB'.padStart(8)}`
  + `${'cpxA'.padStart(6)}${'cpxB'.padStart(6)}${'cts'.padStart(6)}  darker side        need`;

for (const [id, pairs] of Object.entries(A.rows)) {
  if (ids && !ids.includes(id)) continue;
  const sorted = pairs.slice().sort((p, q) => (p.dLcontact ?? 9) - (q.dLcontact ?? 9));
  const shown = sorted.filter((p) => (p.dLcontact ?? 9) <= max);
  if (!shown.length) continue;
  console.log(`── ${id} ──`);
  console.log(`  ${hdr}`);
  for (const p of shown) {
    const c = classify(p);
    const key = `${p.a}|${p.b}`;
    let delta = '';
    if (B && B.rows[id]) {
      const q = B.rows[id].find((z) => z.a === p.a && z.b === p.b);
      if (q && q.dLcontact != null && p.dLcontact != null) {
        const d = q.dLcontact - p.dLcontact;
        delta = `  Δ${d >= 0 ? '+' : ''}${d.toFixed(4)}`;
      } else delta = '  Δ(pair absent on the other side)';
    }
    const flags = [c.thin ? 'THIN' : '', c.signUnreadable ? 'SIGN-UNREADABLE' : ''].filter(Boolean).join(' ');
    console.log(`  ${key.padEnd(24)}${String(p.dLcontact ?? '—').padStart(8)}${String(p.dL).padStart(8)}`
      + `${String(p.cA ?? '—').padStart(8)}${String(p.cB ?? '—').padStart(8)}`
      + `${String(p.cpxA ?? 0).padStart(6)}${String(p.cpxB ?? 0).padStart(6)}${String(p.contacts).padStart(6)}`
      + `  ${(c.ok ? c.darker : '?').padEnd(12)}${(c.ok ? c.need.toFixed(4) : '').padStart(8)}${delta} ${flags}`);
  }
  console.log('');
}
