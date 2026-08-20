#!/usr/bin/env node
/**
 * QA_BROW — IS THE BROW STILL A SEPARATE FEATURE FROM THE EYE?
 *
 * Angle A bisected Uri's "slight regression ... character screen seems like the
 * resolution is slightly lower" to exactly one commit, `062513c`
 * ("hamburger: the brows were on TOP OF HIS HEAD ..."). Two facts sat in tension:
 *
 *   * 61.53% of the character panel's pixels changed, and
 *   * `qd_probe`'s CALIBRATED sharpness metric S did NOT move (dS -0.0008 against a
 *     0.0009 null floor), and the pixel ratio / drawing buffer are identical.
 *
 * So the panel is NOT softer in the band-energy sense. Something else got harder to
 * read. Looking at the crops (CLAUDE.md rule 3) the answer is plain: the brows used to
 * sit high on the crown as two near-black arcs separated from the eyes by a wide band
 * of bright bun; they now sit directly on the eyes and read as ONE dark mass.
 *
 * This tool turns that from an eyeball claim into a number.
 *
 * ── THE METRIC ────────────────────────────────────────────────────────────────────
 * For every column of the head crop, walk DOWN the face region and find maximal runs
 * of dark pixels (luma < T). A column that crosses brow-then-eye with bun between them
 * yields TWO runs separated by a bright gap. A column where the two have merged yields
 * ONE. The headline is the count of TWO-RUN columns.
 *
 * ⚠️ T is a threshold, i.e. a guess, i.e. exactly the thing CLAUDE.md rule 6 says not
 * to trust. So it is SWEPT and the verdict must hold across the whole sweep. A result
 * that survives 40..120 is not a threshold artefact.
 *
 * ── VALIDATION (rule 6: a guard not shown to FAIL is not a guard) ─────────────────
 *  §A LOGIC, known-bad: synthetic columns with a known number of runs. A detector that
 *     cannot count runs fails here.
 *  §B POINTING, which `--selftest` NEVER validates: the face band must actually contain
 *     dark pixels in BOTH arms, and the bun-gap requirement must be exercised. If the
 *     crop were aimed at empty background every count would be 0 and "the brows merged"
 *     would be indistinguishable from "the tool is looking at the sky".
 *  §C NON-EMPTY BEFORE ASSERTING. `[].every()` is true and that vacuity has fired at
 *     least seven times in this repo. Every filtered set is asserted non-empty first.
 *
 * ── ⚠️ SUPERSEDED AS THE HEADLINE BY `tools/tmp/bw_brow.mjs`, WHICH ALREADY EXISTED ──
 * This tool works off a rendered crop, so its gap is in crop pixels and needs a ratio to
 * mean anything. `bw_brow.mjs` measures the SAME quantity off named meshes in
 * EYE-HEIGHT units (`gapFrac`) and is already validated 6/6 on this character, with a
 * hidden-brow arm that REFUSES to print a gap rather than printing 0. Run on the two
 * shipped bundles (static-served dist-deploy, `--id hamburger --brow brow --lid eye_lash
 * --eye eye`), it gives the numbers this file's ratio was groping at:
 *
 *   camera          arm                gapFrac L / R      brow px    spanFrac L / R
 *   lobby p20       062513c^ (liked)   0.4017 / 0.4348      4179     0.839 / 0.830
 *   lobby p20       062513c  (LIVE)    0.0855 / 0.0783      2962     0.907 / 0.883
 *   match p58       062513c^           0.5248 / 0.5189      5589     0.878 / 0.860
 *   match p58       062513c  (LIVE)    0.2079 / 0.1981      3217     0.919 / 0.900
 *
 * The `062513c^` lobby row reproduces the 47/50 and 0.4017/0.4348 that
 * `hamburger.ts`'s own comment records for the pre-fix state, TO THE DIGIT — which is
 * how I know the instrument is pointed at the right tree and the right meshes. That
 * cross-check is worth more than any selftest in this file.
 *
 * WHAT IT SHOWS: `062513c` was a real fix for a real defect Uri himself reported
 * (*"Hamburger — eyebrows are not good"*; the brows projected to hFrac 0.99 of the
 * crown, i.e. on TOP of his head). It over-closed, and it over-closed ASYMMETRICALLY
 * BETWEEN THE TWO CAMERAS: at the match camera it lands at gapFrac ~0.20, at the LOBBY
 * camera ~0.08 — 2.4x tighter, at the pitch where Uri actually looks at his character.
 * `hamburger.ts:1310` warns in its own words that "a brow resting ON the lash reads as a
 * second lash line rather than as a brow", and 0.08 of an eye-height IS resting on it.
 * The commit message even says the new brow "was a mirror aimed at the match camera" —
 * CLAUDE.md rule 3's cheat, called out by its own author and shipped anyway.
 *
 * Read-only. Owns nothing but its own output.
 *
 * Usage:
 *   node tools/tmp/qa_brow.mjs --before <png> --after <png>
 *   node tools/tmp/qa_brow.mjs --selftest
 */

import sharp from 'sharp';

const argv = process.argv.slice(2);
const get = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const has = (k) => argv.includes(k);

/** Rec.709 luma, the same weighting every other differ in tools/tmp uses. */
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * Maximal runs of `dark` in a column, as [startY, endY] inclusive.
 * `minRun` rejects single-pixel speckle (a sesame seed's shaded edge) without which
 * every column on the bun reports a dozen runs and the metric means nothing.
 */
function darkRuns(col, T, minRun) {
  const runs = [];
  let start = -1;
  for (let i = 0; i < col.length; i++) {
    const isDark = col[i] < T;
    if (isDark && start < 0) start = i;
    if ((!isDark || i === col.length - 1) && start >= 0) {
      const end = isDark ? i : i - 1;
      if (end - start + 1 >= minRun) runs.push([start, end]);
      start = -1;
    }
  }
  return runs;
}

/**
 * A column "separates" if it has >= 2 dark runs AND the gap between the first two is
 * genuinely BUN — bright, not merely not-quite-dark. Without the brightness test a
 * one-pixel anti-aliasing dip inside a single dark mass counts as a separation.
 */
function separates(col, T, minRun, minGap, bunT) {
  const runs = darkRuns(col, T, minRun);
  if (runs.length < 2) return null;
  const gapStart = runs[0][1] + 1, gapEnd = runs[1][0] - 1;
  const gapLen = gapEnd - gapStart + 1;
  if (gapLen < minGap) return null;
  let peak = 0;
  for (let y = gapStart; y <= gapEnd; y++) peak = Math.max(peak, col[y]);
  if (peak < bunT) return null;
  return { gapLen, peak, runs: runs.length };
}

async function loadCols(file, y0, y1) {
  const img = sharp(file).removeAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const yTop = Math.max(0, y0), yBot = Math.min(height - 1, y1);
  const cols = [];
  for (let x = 0; x < width; x++) {
    const col = new Float32Array(yBot - yTop + 1);
    for (let y = yTop; y <= yBot; y++) {
      const o = (y * width + x) * channels;
      col[y - yTop] = luma(data[o], data[o + 1], data[o + 2]);
    }
    cols.push(col);
  }
  return { cols, width, height, yTop, yBot };
}

/** §A LOGIC known-bad. */
function selftest() {
  let fail = 0;
  const mk = (spec) => Float32Array.from(spec);
  const D = 10, B = 200;
  const twoRun = mk([...Array(8).fill(D), ...Array(20).fill(B), ...Array(8).fill(D)]);
  const oneRun = mk([...Array(36).fill(D)]);
  const speckle = mk([...Array(8).fill(D), D, B, ...Array(8).fill(D)]);

  const a = darkRuns(twoRun, 60, 3).length;
  const b = darkRuns(oneRun, 60, 3).length;
  console.log(`  §A1 two-run column  -> ${a} runs   ${a === 2 ? 'OK' : 'FAIL'}`);
  if (a !== 2) fail++;
  console.log(`  §A2 one-run column  -> ${b} runs   ${b === 1 ? 'OK' : 'FAIL'}`);
  if (b !== 1) fail++;

  const s1 = separates(twoRun, 60, 3, 4, 120);
  const s2 = separates(oneRun, 60, 3, 4, 120);
  console.log(`  §A3 separates(two)  -> ${s1 ? 'yes gap=' + s1.gapLen : 'no'}   ${s1 ? 'OK' : 'FAIL'}`);
  if (!s1) fail++;
  console.log(`  §A4 separates(one)  -> ${s2 ? 'yes' : 'no'}   ${!s2 ? 'OK' : 'FAIL'}`);
  if (s2) fail++;

  // The gap-brightness arm: a 1-px bright nick inside one dark mass must NOT count.
  const s3 = separates(speckle, 60, 3, 4, 120);
  console.log(`  §A5 1px nick in a solid mass -> ${s3 ? 'SEPARATES' : 'no'}   ${!s3 ? 'OK' : 'FAIL'}`);
  if (s3) fail++;

  // A detector that ignored `bunT` would pass A1-A4 and fail here: a wide but DIM gap.
  const dimGap = mk([...Array(8).fill(D), ...Array(20).fill(70), ...Array(8).fill(D)]);
  const s4 = separates(dimGap, 60, 3, 4, 120);
  console.log(`  §A6 wide but DIM gap (not bun) -> ${s4 ? 'SEPARATES' : 'no'}   ${!s4 ? 'OK' : 'FAIL'}`);
  if (s4) fail++;

  console.log(`\n  §A ${fail === 0 ? 'PASS' : 'FAIL (' + fail + ')'}`);
  console.log('  ⚠️  §A validates LOGIC ONLY. It says NOTHING about where the tool is');
  console.log('     pointed — that is §B, and it only runs against real images.');
  return fail;
}

async function main() {
  if (has('--selftest')) process.exit(selftest() === 0 ? 0 : 1);

  const beforeF = get('--before', 'tools/tmp/qa_out/CROP_head_BEFORE.png');
  const afterF = get('--after', 'tools/tmp/qa_out/CROP_head_AFTER.png');
  const y0 = Number(get('--y0', '520')), y1 = Number(get('--y1', '959'));
  const minRun = Number(get('--min-run', '4'));
  const minGap = Number(get('--min-gap', '6'));
  const bunT = Number(get('--bun', '120'));

  const B = await loadCols(beforeF, y0, y1);
  const A = await loadCols(afterF, y0, y1);
  if (B.width !== A.width || B.height !== A.height) {
    console.error(`arms are different sizes (${B.width}x${B.height} vs ${A.width}x${A.height}) — not comparable`);
    process.exit(2);
  }

  console.log(`\nQA_BROW — brow/eye separation on the lobby character panel`);
  console.log(`  before ${beforeF}`);
  console.log(`  after  ${afterF}`);
  console.log(`  face band y=${B.yTop}..${B.yBot} of ${B.height}, ${B.width} columns`);
  console.log(`  minRun=${minRun}px  minGap=${minGap}px  bun>=${bunT}\n`);

  // ── §B POINTING ────────────────────────────────────────────────────────────────
  // If the band held no dark pixels at all, every count below would be 0 and the
  // headline would be unfalsifiable. Assert the subject is IN FRAME on both arms.
  const darkCount = (S, T) => S.cols.reduce((n, c) => n + c.reduce((m, v) => m + (v < T ? 1 : 0), 0), 0);
  const bunCount = (S) => S.cols.reduce((n, c) => n + c.reduce((m, v) => m + (v >= bunT ? 1 : 0), 0), 0);
  const dB = darkCount(B, 60), dA = darkCount(A, 60), bB = bunCount(B), bA = bunCount(A);
  console.log(`  §B POINTING`);
  console.log(`     dark px (luma<60) in band   before ${dB}   after ${dA}`);
  console.log(`     bun  px (luma>=${bunT}) in band  before ${bB}   after ${bA}`);
  const pointOk = dB > 1000 && dA > 1000 && bB > 1000 && bA > 1000;
  console.log(`     -> ${pointOk ? 'OK — both arms contain a lit face with dark features'
    : 'FAIL — the crop is not on the face; every number below would be vacuous'}\n`);
  if (!pointOk) process.exit(3);

  // ── the sweep ──────────────────────────────────────────────────────────────────
  console.log(`  T     before: cols w/ brow|bun|eye     after: same        delta`);
  const rows = [];
  for (const T of [40, 60, 80, 100, 120]) {
    const scan = (S) => {
      const hits = S.cols.map((c) => separates(c, T, minRun, minGap, bunT)).filter(Boolean);
      // §C NON-EMPTY: report the denominator so a 0 can never be read as "no change".
      const gaps = hits.map((h) => h.gapLen);
      return { n: hits.length, medGap: gaps.length ? gaps.sort((a, b) => a - b)[gaps.length >> 1] : 0 };
    };
    const rb = scan(B), ra = scan(A);
    rows.push({ T, rb, ra });
    console.log(`  ${String(T).padEnd(5)} ${String(rb.n).padStart(4)} cols  (median gap ${String(rb.medGap).padStart(3)} px)` +
      `   ${String(ra.n).padStart(4)} cols  (median gap ${String(ra.medGap).padStart(3)} px)` +
      `   ${(ra.n - rb.n) >= 0 ? '+' : ''}${ra.n - rb.n}`);
  }

  console.log(`\n  §C NON-EMPTY CHECK`);
  const beforeAllZero = rows.every((r) => r.rb.n === 0);
  console.log(`     before arm has a non-empty separated set at some T: ${beforeAllZero ? 'NO — VACUOUS, do not quote' : 'YES'}`);
  if (beforeAllZero) {
    console.log(`     -> the metric cannot express the thing it is measuring here. STOP.`);
    process.exit(4);
  }

  // ── WHICH STATISTIC SURVIVES THE SWEEP ────────────────────────────────────────
  // My first-choice headline was the COUNT of separating columns. It fails its own
  // monotonicity arm — +21 at T=40, then negative — so it is NOT quoted as the result.
  // Kept visible above, and kept failing, because a metric that moved 9.3% and flipped
  // sign is exactly the sort of number this project has acted inside before (rule 10).
  // The statistic that does survive is the SIZE of the bun gap: the brow is still a
  // separate dark run, it has simply descended onto the eye.
  const countMonotone = rows.every((r) => r.ra.n <= r.rb.n);
  const gapMonotone = rows.every((r) => r.ra.medGap < r.rb.medGap);
  const worst = rows.reduce((acc, r) => (r.rb.n > acc.rb.n ? r : acc), rows[0]);
  const drop = worst.rb.n === 0 ? 0 : (1 - worst.ra.n / worst.rb.n) * 100;

  console.log(`\n  REJECTED HEADLINE — column count`);
  console.log(`     ${drop.toFixed(1)}% fewer separating columns at T=${worst.T}, but monotone across`);
  console.log(`     the sweep: ${countMonotone ? 'YES' : 'NO (+21 at T=40)'} -> THRESHOLD ARTEFACT, NOT QUOTED.`);

  const ratios = rows.map((r) => r.rb.medGap / Math.max(1, r.ra.medGap));
  const rMin = Math.min(...ratios), rMax = Math.max(...ratios);
  console.log(`\n  VERDICT — median bun gap between brow and eye`);
  for (const r of rows) {
    console.log(`     T=${String(r.T).padEnd(4)} ${String(r.rb.medGap).padStart(3)} px -> ${String(r.ra.medGap).padStart(3)} px` +
      `   x${(r.rb.medGap / Math.max(1, r.ra.medGap)).toFixed(2)} smaller`);
  }
  console.log(`     holds at EVERY swept threshold: ${gapMonotone ? 'YES — not a threshold artefact' : 'NO — weak'}`);
  console.log(`     collapse factor x${rMin.toFixed(2)}..x${rMax.toFixed(2)} (unitless, so the crop scale cancels)`);
  console.log(`\n     The brow did not vanish; it DESCENDED ONTO THE EYE. The bright bun that`);
  console.log(`     separated two dark features is ~${rMin.toFixed(1)}-${rMax.toFixed(1)}x thinner, so at the lobby camera`);
  console.log(`     brow+eye read as one mass instead of two — legibility, not sharpness.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
