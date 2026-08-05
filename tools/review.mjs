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

const manifest = {
  ours: args.ours,
  category: args.category,
  sheets: sheets.map((s) => s.sheet),
  keys: sheets.map((s) => s.key),
  // So a verdict can always be traced back to the provenance of the image it was
  // made from — see the capture-gate note in this file's header.
  capture: ourProvenance,
};
await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log('\n── critic packet ready ──');
console.log('Show the critic ONLY these files:');
sheets.forEach((s) => console.log(`  ${s.sheet}`));
console.log(`\nKeys (orchestrator only): ${join(outDir, 'sheet_*.key.json')}`);
// Say it at the END too. The refusal text scrolls off; this is the line the
// orchestrator reads before it spends ~300k tokens, and a verdict formed from an
// unvouched image has to be labelled as such when it is written down.
console.log(ourProvenance.verified
  ? `Provenance: VERIFIED — ${ourProvenance.provenance.tool} "${ourProvenance.provenance.label}", painted=true.`
  : `Provenance: NOT VERIFIED (${ourProvenance.overrides.join(', ') || 'unknown'}). `
    + 'Any score from this packet must be recorded as provisional.');
