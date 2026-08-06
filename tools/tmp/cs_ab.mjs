#!/usr/bin/env node
/**
 * BEFORE/AFTER ON ONE SNAPSHOT, WITHOUT HOLDING IT OPEN ACROSS TOOL CALLS.
 *
 * `snap_hold.mjs --swap` is the documented way to A/B across an edit, and it died
 * twice mid-battery here (exit 144, "[snap_hold] snapshot exited 0") with five peer
 * agents live in the tree. The floorprobe A/B that straddled the two snapshots duly
 * disagreed with itself on `vanish%` (0.980 -> 0.292) for a probe that renders no
 * character at all and therefore CANNOT see this change — i.e. the two runs were not
 * on the same tree, and the "improvement" was somebody else's floor edit.
 *
 * So the snapshot's lifetime and the edit both live inside ONE process: `with_snapshot`
 * spawns this, this runs the after battery, overwrites the file INSIDE
 * `$SNAPSHOT_DIR`, runs the before battery, and puts it back. Nothing else in the tree
 * moves between the two sides, no matter what the peers do.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/cs_ab.mjs --url '{URL}' \
 *     --file src/render/stage.ts --before /path/to/stage.before.ts
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const URL_ = arg('url');
const DIR = process.env.SNAPSHOT_DIR;
const REL = arg('file', 'src/render/stage.ts');
const BEFORE = arg('before');
if (!URL_ || !DIR || !BEFORE) throw new Error('need --url, $SNAPSHOT_DIR and --before');
const target = join(DIR, REL);
if (!existsSync(target)) throw new Error(`snapshot has no ${REL} at ${target}`);
// The snapshot's own copy is the AFTER state (it was taken from the live tree).
// Assert that rather than assume it: a snapshot that froze the wrong side would make
// every row below say the opposite of what it means.
const afterSrc = readFileSync(target, 'utf8');
const beforeSrc = readFileSync(BEFORE, 'utf8');
if (afterSrc === beforeSrc) throw new Error('the snapshot already holds the BEFORE file — nothing would differ between the two sides');
const liveSrc = readFileSync(REL, 'utf8');
if (afterSrc !== liveSrc) throw new Error('the snapshot copy does not match the live file — it was taken before the edit finished');

const BATTERY = [
  ['node', ['tools/perf.mjs', '--mode', 'counts', '--url', URL_]],
  ['node', ['tools/tmp/cs_charcontact.mjs', '--ours', '--url', URL_, '--tag', 'SIDE']],
  ['node', ['tools/arena-scan.mjs', '--url', URL_, '--out', 'shots/scan/cs_SIDE']],
];

function run(side) {
  console.log(`\n╔══════════════════════════════════════════════════════════════════╗`);
  console.log(`║  SIDE: ${side.padEnd(58)}║`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝`);
  for (const [cmd, args] of BATTERY) {
    const a = args.map((x) => x.replaceAll('SIDE', side));
    console.log(`\n$ ${cmd} ${a.join(' ')}`);
    const r = spawnSync(cmd, a, { stdio: 'inherit', env: { ...process.env, PREVIEW_BASE: URL_ } });
    if (r.status !== 0) console.log(`  [cs_ab] ${a[0]} exited ${r.status} — recorded, not fatal`);
  }
}

run('after');
writeFileSync(target, beforeSrc);
console.log('\n[cs_ab] swapped the snapshot copy to BEFORE; waiting 6s for the dev server to notice');
await new Promise((r) => setTimeout(r, 6000));
try {
  run('before');
} finally {
  writeFileSync(target, afterSrc);
  console.log('[cs_ab] snapshot copy restored to AFTER');
}
