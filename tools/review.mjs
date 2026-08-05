#!/usr/bin/env node
/**
 * Assemble a blind review packet for a critic agent.
 *
 * Picks N reference plates from the curated library, pairs each with one of our
 * renders, and emits blind A/B sheets plus a manifest. The critic is handed ONLY
 * the sheet paths. The answer key stays in `key.json`, which the orchestrator reads
 * afterwards to score the verdict.
 *
 * Usage:
 *   node tools/review.mjs --ours "shots/hamburger/r1/hero.png" --category character \
 *     --out shots/review/hamburger-r1 [--n 3]
 *
 *   node tools/review.mjs --ours "shots/arena/r1/wide.png" --category gameplay \
 *     --out shots/review/arena-r1
 *
 * ── THE CAPTURE GATE ────────────────────────────────────────────────────────
 * A blind packet is the most expensive thing in this repo to get wrong: a critic
 * round costs ~300k tokens and its verdict is acted on. Twice now a critic has been
 * shown a frame that was not the screen — 2-4 roster cards still on their emoji
 * placeholder (scored as a defect, TWICE), and a screen caught inside its own 0.26 s
 * `fa-screen-in` fade, which measures 3.7x lower contrast than the same content
 * settled. Neither is visible in a filename.
 *
 * So this refuses to build a packet from a capture it cannot vouch for. There are
 * two DIFFERENT reasons an image can fail, and they get two different flags, because
 * one blanket override would let the dangerous one through on the cheap one's
 * authority:
 *
 *   PROVEN BAD  — `<ours>.capture.json` (the sidecar `tools/shoot.mjs` and the metric
 *                 batteries write) says the page was NOT painted, or the pixels are
 *                 under the frame-statistics floor. Something is known to be wrong
 *                 with this image. Override: `--allow-refused`.
 *   UNVERIFIED  — no sidecar at all, so nothing is known either way. Override:
 *                 `--allow-unverified`.
 *
 * Both are refusals, not warnings. A missing sidecar used to be a warning "because
 * most shot pipelines predate it", and that is exactly the quiet failure this file
 * exists to stop: the washed frame that started all of this was a plausible-looking
 * PNG with no record attached, and nothing in a filename could have revealed it.
 * Re-shooting is cheap; a critic round is ~300k tokens.
 *
 * Whichever way it goes, `manifest.json` records `verified`, the frame statistics and
 * the full sidecar, so a verdict can always be traced back to the provenance of the
 * image it was formed from.
 *
 * ── WHAT AN AUDIT OF THIS INSTRUMENT FOUND ──────────────────────────────────
 * The capture gate above guards the IMAGE. Nothing guarded the COMPARISON, and a
 * 28-agent audit — 26 returning scores, 34 reference-panel observations across 4
 * plates and 2 games (`tools/tmp/{packet_audit,critic_cells,subject_ruler}.mjs`) — found
 * the comparison is where this instrument actually loses its numbers. Every figure
 * below is measured, not asserted:
 *
 *   THE CRITIC IS NOT THE NOISE SOURCE. Sixteen fresh critics on one fixed image,
 *   five different prompt phrasings, both A/B slots: our side 5.125 +/- 0.50, the
 *   reference side 8.17 +/- 0.39. With the prompt held byte-identical the spread is
 *   ZERO (6 of 6). Position bias is zero — the same pair with our panel forced into A
 *   and then into B returns identical means, and a panel scored against ITSELF ties
 *   (6/6 and 5/5). => the minimum resolvable difference is ~1.4 points for a round run
 *   as this project runs them (ONE critic, two panels, and that critic gave both panels
 *   the same score in 4 of 4 cases — so n=2 panels is n=1 observation), falling to ~1.0
 *   with two independent critics. Nothing smaller than that is a result. The recorded
 *   3.6 -> 3.25 -> 3.0 -> 2.0 never once cleared it.
 *
 *   THE RUBRIC IS WORTH 2.0 POINTS, and it was never recorded. The SAME sheets score
 *   5.0 under "overall visual quality" and 3.0 under "character design and rendering
 *   only" — deterministically, 2 of 2 each, with the reference side unmoved at 8.5.
 *   The whole recorded character series (3.6 -> 3.25 -> 3.0 -> 2.0) spans less than
 *   one rubric change, and no round wrote its rubric down. That is why `--rubric` now
 *   goes in the packet: a score is comparable ONLY to another score with the same one.
 *
 *   THE PACKET IS NOT BLIND, and it does not matter as much as feared. Critics name
 *   the reference titles on sight, and this repo's CLAUDE.md is in every subagent's
 *   context, so they also know the project is a food brawler and know the 7-9
 *   calibration band — several quoted it back unprompted. Tested for damage and found
 *   little: told "one of these is shipped and one is a WIP", two critics shown TWO
 *   REFERENCE PLATES refused to invent a loser and returned 8.5/8 and 9/8. Recognition
 *   does not confer immunity either — a deliberately degraded reference plate scored
 *   4 against its own clean original's 8. The instrument discriminates.
 *
 *   THE PLATE DRAW IS THE REAL DEFECT. `gameplay` holds 6 Brawl Stars top-down frames
 *   and 5 Zooba over-the-shoulder frames, whose camera is not ours. Three character
 *   rounds drew 4 of 6 Zooba — a recurrence of the exact defect already recorded
 *   against the arena packet — and one draw was `zb_01`, a wide aerial parachute shot
 *   the library's own INDEX calls a reference for ENVIRONMENT ART, used to score
 *   CHARACTERS. `gameplay_topdown` (Brawl Stars only) existed and was not used.
 *
 *   FALSIFIED, and worth stating because it was the leading suspicion: resolution and
 *   framing are NOT stacked against us. The Brawl Stars plates are 1176x~730 marketing
 *   crops that arrive UPSCALED 1.33-1.43x, delivering 0.42-0.48x our edge acuity, and
 *   they still score 8. And subject scale is matched, not 25-35% short — measured off
 *   a ruled frame, our character is 10.4-14.2% of frame height against Shelly 12.5%
 *   and Barley ~11-13.6% in the same plate, and two blind critics measured ~12%
 *   independently and said the failure is MASS, not scale. `CHARACTER_HEIGHT` should
 *   not move on framing grounds.
 */

import { readdir, mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { frameStats, FRAME_FLOOR } from './tmp/settle.mjs';

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
if (!args.ours || !args.category || !args.out) {
  console.error('Need --ours <png> --category character|gameplay --out <dir>');
  process.exit(2);
}

// ── Capture gate ─────────────────────────────────────────────────────────────
/**
 * Vouch for one PNG before it can go in front of a critic. Returns the provenance
 * record that ends up in `manifest.json`.
 */
async function vouch(png, { allowUnverified, allowRefused }) {
  const path = resolve(png);
  if (!existsSync(path)) {
    console.error(`No such capture: ${png}`);
    process.exit(4);
  }
  const stats = await frameStats(path);
  const sidecarPath = `${path}.capture.json`;
  let sidecar = null;
  if (existsSync(sidecarPath)) {
    sidecar = JSON.parse(await readFile(sidecarPath, 'utf8'));
  }

  // PROVEN BAD: something is positively known to be wrong with this image.
  const problems = [];
  if (stats.stdev < FRAME_FLOOR) {
    problems.push(`frame is FLAT (max-channel stdev ${stats.stdev} < ${FRAME_FLOOR}, mean ${stats.mean}, `
      + `range ${stats.min}..${stats.max}) — this is a blank/curtain/boot frame, not a screen`);
  }
  if (sidecar && sidecar.painted === false) {
    const why = [...(sidecar.before?.why ?? []), ...(sidecar.after?.why ?? [])];
    problems.push(`its own capture record says the page was NOT PAINTED: ${why.join('; ')}`);
  }

  console.log(`capture  ${png}`);
  console.log(`         stdev ${stats.stdev}  mean ${stats.mean}  range ${stats.min}..${stats.max}`);
  if (sidecar) {
    console.log(`         provenance: ${sidecar.tool} "${sidecar.label}" at ${sidecar.takenAt}, painted=${sidecar.painted}`);
  }

  if (problems.length) {
    console.error('\n!! CAPTURE REFUSED — this image is PROVEN BAD and must not be shown to a critic:');
    for (const p of problems) console.error(`   - ${p}`);
    if (!allowRefused) {
      console.error('\n   Re-shoot it. `--allow-refused` overrides this specific class, knowingly.');
      process.exit(5);
    }
    console.error('\n   --allow-refused given: building the packet from a known-bad image.\n');
  } else if (!sidecar) {
    // UNVERIFIED: nothing is known either way, which is the state the whole
    // `__screenReady` defect lived in for a session. Refused by default.
    console.error('\n!! CAPTURE UNVERIFIED — no provenance, so this packet cannot be vouched for:');
    console.error(`   there is no ${basename(sidecarPath)} beside this PNG, so nothing records whether`);
    console.error('   the screen was actually ON SCREEN when the shutter fired. A frame captured');
    console.error('   inside .fa-screen\'s 0.26s entry animation is the screen composited over the');
    console.error('   orange page background: measured on the settings screen, card contrast drops');
    console.error('   from stdev 72.9 to 55.8 and the card\'s blue mean from 217.5 to 190.3, while');
    console.error('   the frame as a whole still looks entirely plausible.');
    console.error('\n   Fix it by re-shooting through a tool that writes the sidecar:');
    console.error('     tools/shoot.mjs, tools/tmp/{screen,home,chars}_metrics.mjs');
    console.error('     or any tool calling captureSettled() from tools/tmp/settle.mjs');
    console.error('\n   `--allow-unverified` proceeds anyway; the packet manifest records verified:false.');
    if (!allowUnverified) process.exit(6);
    console.error('\n   --allow-unverified given: building the packet from an unvouched image.\n');
  }

  return {
    path: png,
    stats,
    provenance: sidecar,
    problems,
    // The single field a later reader needs: was this verdict formed from an image
    // anyone can vouch for?
    verified: !!sidecar && problems.length === 0,
    overrides: [allowRefused ? 'allow-refused' : null, allowUnverified ? 'allow-unverified' : null].filter(Boolean),
  };
}

// ── Comparison gate ──────────────────────────────────────────────────────────
/**
 * Categories whose plates do NOT share one camera. Drawing from these mixes cameras
 * inside a single round, and the round then measures the camera instead of the work.
 * Measured consequence, from the audit in this file's header: three character rounds
 * drew 4 of 6 Zooba plates — over-the-shoulder third person against our top-down —
 * repeating a defect already recorded against the arena packet.
 */
const MIXED_CAMERA = {
  gameplay: {
    why: '6 Brawl Stars top-down frames + 5 Zooba OVER-THE-SHOULDER frames, and zb_01 is '
      + 'a wide aerial the library INDEX offers as an ENVIRONMENT reference',
    instead: 'gameplay_topdown',
  },
  character: {
    why: 'tight head-and-shoulders busts (zb_03/zb_04 are face-only) mixed with full-body '
      + 'pedestal shots — a bust reads more finished than a full body of the SAME asset '
      + 'purely because it fills more pixels',
    instead: 'fullbody_fair',
  },
};

/**
 * The single number nobody had for this instrument: sd 0.50, from 16 fresh critics on
 * one fixed image.
 *
 * ⚠️ The unit of replication is the CRITIC, not the panel. A round here is one critic
 * scoring two panels and reporting their mean, and that critic gave the SAME score to
 * both panels in 4 of 4 measured cases (5/5, 5/5, 3/3, 3/3) — within-critic spread
 * 0.00. So "n=2" is n=1, and dividing by sqrt(panels) would claim a precision the
 * round does not have. This deliberately counts critics.
 */
function resolutionFloor(critics) {
  const SD = 0.50;
  return 1.96 * Math.SQRT2 * (SD / Math.sqrt(Math.max(1, critics)));
}

const curatedDir = resolve(`reference/images/curated/${args.category}`);
if (!existsSync(curatedDir)) {
  console.error(`No curated references at ${curatedDir}.`);
  console.error('Run the reference-curation step before any blind review.');
  process.exit(3);
}

const refs = (await readdir(curatedDir)).filter((f) => /\.(png|jpg|jpeg)$/i.test(f));
if (refs.length === 0) {
  console.error(`${curatedDir} is empty — nothing to compare against.`);
  process.exit(3);
}

const n = Math.min(Number(args.n ?? 3), refs.length);

// Sample without replacement so the critic sees a spread of references, not the
// same plate three times.
const pool = [...refs];
const picked = [];
for (let i = 0; i < n; i++) {
  picked.push(pool.splice(randomInt(0, pool.length), 1)[0]);
}

// Vouch for OUR side before a single sheet is built. The reference plates are
// third-party screenshots and are not ours to re-shoot, so they are measured and
// reported but never refused.
const ourProvenance = await vouch(args.ours, {
  allowUnverified: !!args['allow-unverified'],
  allowRefused: !!args['allow-refused'],
});

const outDir = resolve(args.out);
await mkdir(outDir, { recursive: true });

const sheets = [];
for (let i = 0; i < picked.length; i++) {
  const ref = join(curatedDir, picked[i]);
  const sheet = join(outDir, `sheet_${i + 1}.png`);
  const key = join(outDir, `sheet_${i + 1}.key.json`);
  execFileSync('node', [
    'tools/compare.mjs',
    '--ours', args.ours,
    '--ref', ref,
    '--out', sheet,
    '--key', key,
    '--height', String(args.height ?? 1000),
  ], { stdio: 'inherit' });
  sheets.push({ sheet, key, reference: basename(ref) });
}

const rubric = typeof args.rubric === 'string' ? args.rubric : 'UNSPECIFIED';
// Default 1: a round is one critic unless the orchestrator says otherwise.
const critics = Number(args.critics ?? 1);
const floor = resolutionFloor(critics);

const manifest = {
  ours: args.ours,
  category: args.category,
  // The rubric is part of the measurement, not part of the request. Two rounds with
  // different rubrics are not on the same scale — measured at 2.0 points on identical
  // images, which is larger than any change this project has ever moved a score by.
  rubric,
  plates: sheets.map((s) => s.reference),
  mixedCamera: MIXED_CAMERA[args.category] ?? null,
  critics,
  resolutionFloor: +floor.toFixed(2),
  sheets: sheets.map((s) => s.sheet),
  keys: sheets.map((s) => s.key),
  // So a verdict can always be traced back to the provenance of the image it was
  // made from — see the capture-gate note in this file's header.
  capture: ourProvenance,
};
await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

// The rubric goes in the packet as text, so the next round can be run with the SAME
// one instead of whatever its orchestrator happens to type.
await writeFile(join(outDir, 'RUBRIC.txt'),
  `${rubric}\n\n(Paste this verbatim into the critic brief. A score is comparable only to\n`
  + `another score taken under the same rubric — the measured difference between\n`
  + `"overall visual quality" and "character design and rendering only" on identical\n`
  + `sheets is 2.0 points.)\n`);

console.log('\n── critic packet ready ──');
console.log('Show the critic ONLY these files:');
sheets.forEach((s) => console.log(`  ${s.sheet}`));
console.log(`\nKeys (orchestrator only): ${join(outDir, 'sheet_*.key.json')}`);

console.log(`\nRubric: ${rubric === 'UNSPECIFIED' ? 'UNSPECIFIED' : rubric.slice(0, 72)}`);
if (rubric === 'UNSPECIFIED') {
  console.error('!! NO RUBRIC RECORDED. Pass --rubric "<the exact question the critic is asked>".');
  console.error('   Measured on identical sheets: "overall visual quality" scores 5.0 and');
  console.error('   "character design and rendering only" scores 3.0, both deterministic, with');
  console.error('   the reference side unmoved. A score whose rubric is not written down cannot');
  console.error('   be compared to any other score, including the one it is meant to improve on.');
}

console.log(`Resolution floor: differences below ~${floor.toFixed(1)} points are NOT results at ${critics} critic(s)`);
console.log('   (critic sd 0.50 over 16 fresh critics on one fixed image; position bias 0.00;');
console.log('    within-critic spread across the two panels of a round was 0.00 in 4 of 4 —');
console.log('    so the two panels of a round are ONE observation, not two. --critics N to raise it.)');

if (MIXED_CAMERA[args.category]) {
  const m = MIXED_CAMERA[args.category];
  console.error(`\n!! MIXED-CAMERA CATEGORY "${args.category}" — ${m.why}.`);
  console.error(`   Drew: ${sheets.map((s) => s.reference).join(', ')}`);
  console.error(`   Prefer --category ${m.instead}. Three character rounds drew 4 of 6 Zooba`);
  console.error('   plates before anyone looked, repeating the arena packet\'s recorded defect.');
}

console.log('\nNot actually blind: critics name the reference titles on sight, and this repo\'s');
console.log('CLAUDE.md is in every subagent\'s context (they quote the 7-9 band back unprompted).');
console.log('Tested for damage and found little — shown two REFERENCE plates and told one was a');
console.log('WIP, critics returned 8.5/8 and 9/8 rather than inventing a loser.');
// Say it at the END too. The refusal text scrolls off; this is the line the
// orchestrator reads before it spends ~300k tokens, and a verdict formed from an
// unvouched image has to be labelled as such when it is written down.
console.log(ourProvenance.verified
  ? `Provenance: VERIFIED — ${ourProvenance.provenance.tool} "${ourProvenance.provenance.label}", painted=true.`
  : `Provenance: NOT VERIFIED (${ourProvenance.overrides.join(', ') || 'unknown'}). `
    + 'Any score from this packet must be recorded as provisional.');
