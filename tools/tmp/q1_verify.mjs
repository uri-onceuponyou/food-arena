#!/usr/bin/env node
/**
 * Q1 VERIFY — prove that every blind sheet actually CONTAINS the image its answer key
 * says it contains, before a single critic is dispatched.
 *
 * ── Why this is not paranoia ────────────────────────────────────────────────
 * `tools/review.mjs`'s own header: *"Twice now a critic has been shown a frame that was
 * not the screen."* The capture gate it added guards the SOURCE PNG — is it painted, is
 * it flat, does it have provenance. Nothing guards the COMPOSITE. Between the source
 * and the critic sit `compare.mjs`'s resize, a coin-flipped A/B slot, and a key written
 * by a different code path from the pixels. A sheet whose key says `A: ours` while the
 * ours panel sits in B would score the reference as ours and invert the round's verdict,
 * and it is invisible in every filename, every manifest and every eyeball check that
 * does not already know which side is which.
 *
 * So this reconstructs `compare.mjs`'s geometry, cuts the panel the key calls `ours`
 * out of the finished sheet, and compares it pixel-for-pixel with the source resized
 * exactly as `compare.mjs` resized it.
 *
 * ── The known-bad, because a guard not shown to FAIL is not a guard ─────────
 * `--known-bad` runs the identical check with the key's two slots SWAPPED. It must
 * fail on every sheet. Without that arm, a verifier that always returned `ok` would
 * read exactly like this one does.
 *
 * ⚠️ And the set is asserted NON-EMPTY before anything is asserted over it: this file
 * filters assignments by arm, and `[].every()` returns `true`.
 *
 * Usage:
 *   node tools/tmp/q1_verify.mjs --manifest shots/review/q1-manifest.json
 *   node tools/tmp/q1_verify.mjs --manifest shots/review/q1-manifest.json --known-bad
 */

import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { frameStats, FRAME_FLOOR } from './settle.mjs';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

const args = parseArgs(process.argv);
const SWAP = !!args['known-bad'];

// `compare.mjs`'s constants. Restated here, and asserted against the file below so a
// change there cannot silently make this verifier cut the wrong rectangle.
const GAP = 24;
const LABEL_H = 64;
const TARGET_H = 1000;
const BG = { r: 22, g: 16, b: 31, alpha: 1 };

{
  const src = readFileSync(resolve(process.argv[1], '../../compare.mjs'), 'utf8');
  const g = /const\s+GAP\s*=\s*(\d+)/.exec(src);
  const l = /const\s+LABEL_H\s*=\s*(\d+)/.exec(src);
  if (!g || !l) { console.error('cannot read GAP/LABEL_H out of tools/compare.mjs'); process.exit(2); }
  if (Number(g[1]) !== GAP || Number(l[1]) !== LABEL_H) {
    console.error(`compare.mjs geometry drifted: GAP ${g[1]} LABEL_H ${l[1]} vs ${GAP}/${LABEL_H}`);
    process.exit(2);
  }
}

const manifestPath = resolve(args.manifest ?? 'shots/review/q1-manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const rows = manifest.assignments ?? [];

// ── §0: the set is non-empty. A filter over [] passes every assertion below.
if (rows.length === 0) { console.error('manifest has ZERO assignments — nothing to verify'); process.exit(2); }
console.log(`${rows.length} assignments from ${manifestPath}${SWAP ? '   [KNOWN-BAD: keys swapped]' : ''}\n`);

/** Resize exactly as `compare.mjs:normalise` does. */
const norm = (p) => sharp(p).resize({ height: TARGET_H, fit: 'contain', background: BG }).png().toBuffer();

const results = [];
for (const row of rows) {
  const problems = [];
  if (!existsSync(row.sheet)) { problems.push('sheet missing'); }
  if (!existsSync(row.key)) { problems.push('key missing'); }
  if (problems.length) { results.push({ row, ok: false, problems }); continue; }

  const key = JSON.parse(await readFile(row.key, 'utf8'));
  // The known-bad arm swaps the two slots. Everything downstream is untouched.
  const slots = SWAP ? { A: key.B, B: key.A } : { A: key.A, B: key.B };

  // Byte-identity to what the manifest recorded when it was built.
  const nowSha = createHash('sha256').update(readFileSync(row.sheet)).digest('hex');
  if (row.sheetSha256 && nowSha !== row.sheetSha256) problems.push('sheet CHANGED since the manifest was written');

  // Not a blank/curtain frame.
  const st = await frameStats(row.sheet);
  if (st.stdev < FRAME_FLOOR) problems.push(`sheet is FLAT (stdev ${st.stdev} < ${FRAME_FLOOR})`);

  // Reconstruct the layout. Both panels were resized to TARGET_H, so panel widths come
  // from the sources themselves — which is what makes this a real check rather than a
  // restatement of the sheet.
  const oursSrc = resolve(row.ours);
  const refSrc = resolve(`reference/images/curated/${row.category}/${row.plate}`);
  if (!existsSync(oursSrc)) problems.push(`ours source missing: ${oursSrc}`);
  if (!existsSync(refSrc)) problems.push(`reference plate missing: ${refSrc}`);
  if (problems.length) { results.push({ row, ok: false, problems }); continue; }

  const oursBuf = await norm(oursSrc);
  const refBuf = await norm(refSrc);
  const oursW = (await sharp(oursBuf).metadata()).width;
  const refW = (await sharp(refBuf).metadata()).width;

  // Slot A sits at x = GAP; slot B at x = GAP + (width of whatever is in A) + GAP.
  // Written out flat rather than nested, because an off-by-one here is exactly the
  // failure this file exists to catch.
  const leftA = GAP;
  const leftB = GAP + (slots.A === 'ours' ? oursW : refW) + GAP;
  const top = GAP + LABEL_H;

  const oursSlot = slots.A === 'ours' ? 'A' : 'B';
  const oursLeft = oursSlot === 'A' ? leftA : leftB;
  const oursWidth = oursW;

  const sheetMeta = await sharp(row.sheet).metadata();
  const expectW = GAP * 3 + oursW + refW;
  const expectH = TARGET_H + LABEL_H + GAP * 2;
  if (sheetMeta.width !== expectW || sheetMeta.height !== expectH) {
    problems.push(`sheet is ${sheetMeta.width}×${sheetMeta.height}, expected ${expectW}×${expectH}`);
  }

  if (!problems.length) {
    // `removeAlpha` on BOTH: the sheet is composited on a 4-channel canvas and the
    // normalised source keeps its own alpha, so comparing raw buffers of different
    // channel counts fails on LENGTH and tells you nothing about the pixels.
    // A wrong slot can put the rectangle off the right edge, and sharp THROWS on that.
    // A throw is a failure of this check, not a crash of the tool — catching it is what
    // lets `--known-bad` report "0 vouched" instead of dying on the first sheet.
    let cut = null;
    try {
      cut = await sharp(row.sheet)
        .extract({ left: oursLeft, top, width: oursWidth, height: TARGET_H })
        .removeAlpha().raw().toBuffer();
    } catch (e) {
      problems.push(`cannot cut the ours panel at left=${oursLeft} w=${oursWidth}: ${String(e).slice(0, 90)}`);
      results.push({ row, ok: false, problems, oursSlot, stdev: st.stdev });
      continue;
    }
    const want = await sharp(oursBuf).removeAlpha().raw().toBuffer();
    if (cut.length !== want.length) {
      problems.push(`panel buffer ${cut.length} vs source ${want.length}`);
    } else {
      let diff = 0;
      for (let i = 0; i < cut.length; i++) diff += Math.abs(cut[i] - want[i]);
      const mad = diff / cut.length;
      if (mad > 0.5) problems.push(`the panel the key calls OURS does not match ${row.ours} (mean abs diff ${mad.toFixed(3)}/255)`);

      // And the OTHER panel must be the plate the manifest names. Checking only our
      // side would pass a sheet that paired our frame with the WRONG reference — the
      // draw defect the audit called "the real defect", and a round drawn against the
      // wrong plate is not comparable to one drawn against the right one.
      const refLeft = oursSlot === 'A' ? leftB : leftA;
      let refMad = null;
      try {
        const rcut = await sharp(row.sheet)
          .extract({ left: refLeft, top, width: refW, height: TARGET_H })
          .removeAlpha().raw().toBuffer();
        const rwant = await sharp(refBuf).removeAlpha().raw().toBuffer();
        if (rcut.length !== rwant.length) {
          problems.push(`reference panel buffer ${rcut.length} vs plate ${rwant.length}`);
        } else {
          let rd = 0;
          for (let i = 0; i < rcut.length; i++) rd += Math.abs(rcut[i] - rwant[i]);
          refMad = rd / rcut.length;
          if (refMad > 0.5) problems.push(`the reference panel is not ${row.plate} (mean abs diff ${refMad.toFixed(3)}/255)`);
        }
      } catch (e) {
        problems.push(`cannot cut the reference panel at left=${refLeft} w=${refW}: ${String(e).slice(0, 90)}`);
      }

      results.push({
        row, ok: problems.length === 0, problems, mad: +mad.toFixed(4),
        refMad: refMad === null ? null : +refMad.toFixed(4), oursSlot, stdev: st.stdev,
      });
      continue;
    }
  }
  results.push({ row, ok: false, problems, oursSlot, stdev: st.stdev });

}

// 🚨 THE SLOT IS THE ANSWER, AND THIS USED TO PRINT IT ON EVERY ROW, IN BOTH ARMS.
//
// An operator must run this BEFORE dispatching a critic — that is the whole point of
// vouching a sheet. So `ours=slot A` handed the person writing the critic's prompt the
// very fact rule 7 says the critic must never see. `--known-bad` was worse, not better:
// it prints the SWAPPED slot, so the true key is one inversion away.
//
// Found 2026-08-21 by the sixth panel agent, which noted the round was unaffected — the
// critic is a separate context and the prompts were written from the sheet path alone.
// **That is a fact about six careful agents, not a property of the tool.** The seventh
// reads the slot, frames the prompt a shade differently, and nothing anywhere reports it.
//
// So: hidden by default, in BOTH arms. `--show-slots` when you genuinely need it — after
// scoring, or when debugging a manifest. The vouching VERDICT (ok/FAIL, the diffs, the
// stdev) is untouched, because none of it discloses which side is ours.
const SHOW_SLOTS = !!args['show-slots'];

for (const r of results) {
  const tag = `${r.row.arm}/${r.row.element}/c${r.row.critic}`;
  const slot = SHOW_SLOTS ? `ours=slot ${r.oursSlot ?? '?'}  ` : 'ours=slot ·  ';
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} - ${tag.padEnd(26)} ${slot}`
    + `stdev ${r.stdev ?? '-'}  oursDiff ${r.mad ?? '-'}  refDiff ${r.refMad ?? '-'}`
    + `${r.problems.length ? `  :: ${r.problems.join('; ')}` : ''}`);
}
if (!SHOW_SLOTS) console.log('  (slots withheld — rule 7. `--show-slots` to reveal, AFTER scoring.)');

const nOk = results.filter((r) => r.ok).length;
const pass = SWAP ? nOk === 0 : nOk === results.length;
console.log(`\n${pass ? '✅ PASS' : '🔴 FAIL'}  q1_verify${SWAP ? ' --known-bad' : ''}: ${nOk}/${results.length} sheets vouched`
  + `${SWAP ? '  (a swapped key MUST vouch for ZERO)' : ''}`);
process.exit(pass ? 0 : 1);
