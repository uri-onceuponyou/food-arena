#!/usr/bin/env node
/**
 * Validate `tools/review.mjs`'s capture gate against KNOWN inputs. No browser, no
 * snapshot, ~2 s — so there is no excuse for not running it.
 *
 * ── Why a separate validator ─────────────────────────────────────────────────
 * `tools/tmp/settle_validate.mjs` proves the RUNTIME guard refuses a mid-fade page.
 * That is the producer side. This is the consumer side: the last gate before a
 * ~300k-token blind critic round, where two verdicts have already been formed from
 * images that were not the screen. A gate nobody has watched REFUSE is not evidence
 * that it refuses (`docs/LESSONS.md` §13) — and the failure mode of a gate is silent
 * acceptance, which looks exactly like success.
 *
 * The fixtures are synthesised here rather than committed, so this cannot pass by
 * reading a stale PNG someone regenerated differently:
 *
 *   settled     structured noise + a sidecar saying painted=true      -> ACCEPT
 *   mid-fade    identical pixels + a sidecar saying painted=false     -> REFUSE (5)
 *   flat        a single flat colour, sidecar or not                  -> REFUSE (5)
 *   unverified  perfectly good pixels, NO sidecar at all              -> REFUSE (6)
 *
 * The mid-fade fixture deliberately has HEALTHY pixel statistics. That is the whole
 * point: the frame floor cannot see a fade (a real mid-fade settings frame scores
 * stdev 67.2 against a floor of 8), so only the provenance record catches it. A
 * fixture that was both faded AND flat would let the floor take the credit and the
 * provenance check could rot unnoticed.
 *
 * It also checks that the two overrides are NOT interchangeable: `--allow-unverified`
 * says "nothing is known about this image", `--allow-refused` says "something is
 * known to be wrong with it", and the cheap one must never authorise the dangerous
 * one.
 *
 * Usage:  node tools/tmp/review_gate_validate.mjs
 */

import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import sharp from 'sharp';

const ROOT = resolve(process.argv[1], '../../..');
const CATEGORY = 'gameplay';

if (!existsSync(join(ROOT, `reference/images/curated/${CATEGORY}`))) {
  console.error(`No curated references at reference/images/curated/${CATEGORY} — cannot exercise review.mjs.`);
  console.error('(reference/ is gitignored by design; this validator needs a working checkout of it.)');
  process.exit(77);
}

const dir = await mkdtemp(join(tmpdir(), 'fa-reviewgate-'));

/** A frame with real structure, so the frame-statistics floor has nothing to say. */
async function structured(path) {
  const buf = await sharp({
    create: {
      width: 320, height: 200, channels: 3,
      background: { r: 0, g: 0, b: 0 },
      noise: { type: 'gaussian', mean: 128, sigma: 55 },
    },
  }).png().toBuffer();
  await writeFile(path, buf);
}

/** A frame with none — the curtain / boot-overlay / white-screen class. */
async function flat(path) {
  const buf = await sharp({
    create: { width: 320, height: 200, channels: 3, background: { r: 20, g: 13, b: 30 } },
  }).png().toBuffer();
  await writeFile(path, buf);
}

const sidecar = (path, painted, why = []) => writeFile(`${path}.capture.json`, JSON.stringify({
  tool: 'review_gate_validate', label: 'fixture', takenAt: new Date().toISOString(),
  painted, enforced: false,
  before: { ok: painted, why, effectiveOpacity: painted ? 1 : 0, screen: 'settings' },
  after: { ok: true, why: [], effectiveOpacity: 1, screen: 'settings' },
}, null, 2));

const MIDFADE_WHY = [
  '.fa-curtain still up (opacity 0.722)',
  'screen effective opacity 0.000 (own 0.000)',
  'entry animation running: fa-screen-in',
  'screen transform not identity: matrix(0.992, 0, 0, 0.992, 0, 10)',
];

const settled = join(dir, 'settled.png');
const midfade = join(dir, 'midfade.png');
const flatPng = join(dir, 'flat.png');
const bare = join(dir, 'bare.png');
await structured(settled); await sidecar(settled, true);
await structured(midfade); await sidecar(midfade, false, MIDFADE_WHY);
await flat(flatPng); await sidecar(flatPng, false, ['.fa-curtain still up (opacity 1.000)']);
await structured(bare); // deliberately NO sidecar

// The mid-fade fixture must be pixel-healthy or this validator is testing the floor.
const midStats = await sharp(midfade).stats();
const midStdev = Math.max(...midStats.channels.slice(0, 3).map((c) => c.stdev));

let n = 0; let bad = 0;
function run(name, argv, wantExit, wantIn = null) {
  n++;
  const r = spawnSync('node', ['tools/review.mjs', ...argv, '--category', CATEGORY,
    '--out', join(dir, `out${n}`), '--n', '1'], { cwd: ROOT, encoding: 'utf8' });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const ok = r.status === wantExit && (!wantIn || out.includes(wantIn));
  if (!ok) {
    bad++;
    console.log(`FAIL  ${name.padEnd(56)} exit ${r.status} (want ${wantExit})`);
    console.log(out.split('\n').slice(0, 8).map((l) => `        ${l}`).join('\n'));
  } else {
    console.log(`PASS  ${name.padEnd(56)} exit ${r.status}`);
  }
}

console.log('── review.mjs capture gate, against known inputs ──\n');
console.log(`fixture check: mid-fade frame scores stdev ${midStdev.toFixed(2)} — well clear of the`);
console.log('               frame floor, so only the provenance record can refuse it.\n');
if (midStdev < 20) { bad++; n++; console.log('FAIL  fixture is too flat to test provenance'); }

run('settled + painted:true      -> packet built', ['--ours', settled], 0, 'Provenance: VERIFIED');
run('mid-fade + painted:false    -> REFUSED', ['--ours', midfade], 5, 'PROVEN BAD');
run('flat frame                  -> REFUSED on the floor', ['--ours', flatPng], 5, 'frame is FLAT');
run('no sidecar                  -> REFUSED as unverified', ['--ours', bare], 6, 'CAPTURE UNVERIFIED');
run('no sidecar + allow-unverified -> built, labelled', ['--ours', bare, '--allow-unverified'], 0,
  'Provenance: NOT VERIFIED');
// The two overrides are not interchangeable. This is the check that matters most:
// the cheap flag must not launder a known-bad image.
run('mid-fade + allow-unverified -> STILL REFUSED', ['--ours', midfade, '--allow-unverified'], 5, 'PROVEN BAD');
run('mid-fade + allow-refused    -> built, labelled', ['--ours', midfade, '--allow-refused'], 0,
  'Provenance: NOT VERIFIED');
run('missing file                -> refused before anything else', ['--ours', join(dir, 'nope.png')], 4);

await rm(dir, { recursive: true, force: true });
console.log(`\n${n - bad}/${n} gate checks passed`);
process.exit(bad ? 1 : 0);
