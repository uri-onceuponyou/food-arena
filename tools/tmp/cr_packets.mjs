#!/usr/bin/env node
/**
 * cr_packets — build the ARENA and CAST re-score packets for one capture, one distinct
 * reference plate per critic, under the CANONICAL rubric.
 *
 * This is `tools/tmp/baseline_packets.mjs`'s design with two changes and nothing else,
 * because the recorded numbers (arena 5.17, cast 4.33) came out of that design and a
 * score is comparable only to a score taken the same way:
 *
 *   1. the staging directory is a parameter instead of a constant, so a NEW capture can
 *      be scored without editing a file this agent does not own;
 *   2. only the two elements asked for are built.
 *
 * ⚠️ Everything else is deliberately identical — rubric `canonical`, category
 * `gameplay_topdown` for the whole frame and `topdown_cast` for the crop, plates
 * bs_01..bs_06 round-robin so critic i sees plate i in EVERY arm, and one sheet per
 * critic so k critics is k observations rather than one.
 *
 * ⚠️ It does NOT rebuild the reference-side crops. `baseline_crops.mjs` owns those and
 * they already exist; rebuilding them would put a second copy of that decision in the
 * tree. Run `baseline_crops.mjs --ours <frame> --out <stage>` first for OUR crop.
 *
 * Usage:
 *   node tools/tmp/cr_packets.mjs --stage shots/review/cr1/stage \
 *     --arena match_donut_taco_02.png --cast ours_cast.png \
 *     --out shots/review/cr1/now --critics 6 --tag now
 */

import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

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
const ROOT = resolve(process.argv[1], '../../..');
const K = Number(args.critics ?? 6);
const STAGE = resolve(args.stage ?? join(ROOT, 'shots/review/cr1/stage'));
const OUT = resolve(args.out ?? join(ROOT, 'shots/review/cr1/now'));
const TAG = String(args.tag ?? 'now');

const TD = ['bs_01.png', 'bs_02.png', 'bs_03.png', 'bs_04.png', 'bs_05.png', 'bs_06.png'];
const cycle = (arr, k) => Array.from({ length: k }, (_, i) => arr[i % arr.length]);

const ELEMENTS = [
  {
    id: 'arena',
    ours: join(STAGE, String(args.arena ?? 'match_donut_taco_02.png')),
    category: 'gameplay_topdown',
    what: 'the whole match frame mid-fight: arena, both fighters, VFX, full HUD',
  },
  {
    id: 'cast',
    ours: join(STAGE, String(args.cast ?? 'ours_cast.png')),
    category: 'topdown_cast',
    what: 'the cast at gameplay scale — 45% of frame height, 16:9, centred on the fighters',
  },
];

await mkdir(OUT, { recursive: true });
const assignments = [];

for (const el of ELEMENTS) {
  if (!existsSync(el.ours)) { console.error(`missing ${el.ours}`); process.exit(3); }
  const plates = cycle(TD, K);
  for (let i = 0; i < K; i++) {
    const dir = join(OUT, `${el.id}-c${i + 1}`);
    // eslint-disable-next-line no-await-in-loop
    await mkdir(dir, { recursive: true });
    execFileSync('node', [
      'tools/review.mjs',
      '--ours', el.ours,
      '--category', el.category,
      '--out', dir,
      '--plates', plates[i],
      '--rubric', 'canonical',
      '--critics', '1',
    ], { cwd: ROOT, stdio: 'inherit' });
    assignments.push({
      tag: TAG,
      element: el.id,
      critic: i + 1,
      dir,
      plate: plates[i],
      category: el.category,
      ours: el.ours,
      what: el.what,
      sheet: join(dir, 'sheet_1.png'),
      key: join(dir, 'sheet_1.key.json'),
    });
  }
}

await writeFile(join(OUT, 'assignments.json'), JSON.stringify({
  builtAt: new Date().toISOString(),
  tag: TAG,
  criticsPerElement: K,
  rubric: 'tools/review.rubric.txt (canonical v1)',
  assignments,
}, null, 2));

console.log(`\n${assignments.length} packets -> ${OUT}`);
for (const a of assignments) console.log(`  ${a.tag}/${a.element}-c${a.critic}  plate ${a.plate}  ${a.sheet}`);
