#!/usr/bin/env node
/**
 * Q1 PACKETS — build the blind packets for the first critic round since the map ×4'd,
 * and stage the DRIFT arm without touching a byte of it.
 *
 * ── The design is `baseline_packets.mjs`'s, on purpose ──────────────────────
 * One fixed image of ours per element seen by every critic of that element (so its
 * spread is pure critic noise, comparable to the measured sd 0.50); a DIFFERENT
 * reference plate per critic (so the reference spread measures the library, not the
 * draw); every critic fresh and shown exactly one sheet. Changing any of that would
 * make the before/after incomparable, and the before/after is the whole round.
 *
 * ── THREE ARMS, and the third is the one that decides whether the round means
 *    anything ─────────────────────────────────────────────────────────────────
 *
 *   NEW      our frames captured at 072f245 on a snapshot of a detached clean
 *            worktree. `arena` + `cast`, k=8 each.
 *   CONTROL  `ctl_high` (a shipped third-party plate standing in as ours — if the
 *            rubric cannot return ~8 for shipped work, every low score is a property
 *            of the rubric) and `ctl_low` (our own frame degraded on three axes — it
 *            MUST score below `arena`, or the instrument is not discriminating and
 *            the round is void). k=3 each, same rubric, mixed in.
 *   DRIFT    the BYTE-IDENTICAL sheets of 2026-08-05, re-scored by 8 fresh critics.
 *            Those sheets read 5.17/4.33 on the day (n=6) and 4.75/3.75 six hours
 *            later (n=4) — 1.30σ and 1.80σ, suggestive and not established. This
 *            round's before/after SPANS A SESSION BOUNDARY, so without this arm a
 *            drift of ~0.5 is indistinguishable from a change in the game.
 *
 * 🚨 **The drift arm is REFERENCED, never rebuilt.** `compare.mjs` coin-flips the A/B
 * slot on every build, so re-running `review.mjs` over those inputs would produce
 * different sheets with a different key, and the comparison to the recorded 5.17/4.33
 * would silently stop being a comparison of the same pixels. This file therefore only
 * writes an assignments file that POINTS at `shots/review/baseline/{arena,cast}-c*`.
 *
 * ── What could not be proved, and is recorded instead ───────────────────────
 * Nothing anywhere in this repo recorded a hash of those sheets when they were scored,
 * so their byte-identity to what the 2026-08-05 critics saw **cannot be proved
 * retroactively** — only evidenced (mtimes 18:18-18:19, before verdicts.json at 18:35
 * and verdicts_drift.json at 23:43, and unmodified since). This file writes the sha256
 * of every sheet in every arm into its assignments, so the NEXT round has the proof
 * this one did not.
 *
 * Usage:
 *   node tools/tmp/q1_packets.mjs --selftest
 *   node tools/tmp/q1_packets.mjs --arena shots/q1/cap/match_donut_taco_05.png \
 *     --arena-alt shots/q1/cap/match_donut_taco_00.png \
 *     --cast shots/q1/stage/cast_primary.png --critics 8 --out shots/review
 */

import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile, copyFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import sharp from 'sharp';

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

const TD = ['bs_01.png', 'bs_02.png', 'bs_03.png', 'bs_04.png', 'bs_05.png', 'bs_06.png'];

/**
 * Round-robin. With k > plates, plates repeat — and that is CORRECT here rather than a
 * compromise. The measured unit of replication is the CRITIC, not the sheet: sd 0.50
 * was established by putting SIXTEEN fresh critics on ONE fixed image. The previous
 * round already did this (`home`/`select`, 6 critics over 4 Zooba plates). The library
 * holds six top-down plates and there is no seventh to draw.
 */
const cycle = (arr, k) => Array.from({ length: k }, (_, i) => arr[i % arr.length]);

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

/** `review.mjs:resolutionFloor` — restated so this file can print it, not re-derive it. */
const floorAt = (k) => 1.96 * Math.SQRT2 * (0.50 / Math.sqrt(Math.max(1, k)));
/** Two arms of different size, sd 0.50 both: the 95% floor on their DIFFERENCE. */
const floorBetween = (k1, k2) => 1.96 * 0.50 * Math.sqrt(1 / k1 + 1 / k2);

// ── the drift arm: reference, never rebuild ──────────────────────────────────
const DRIFT_SRC = join(ROOT, 'shots/review/baseline');
/**
 * Six sheets exist per element, and 8 critics are wanted. c1 and c2 are repeated —
 * two critics see one identical file, which is the sd-0.50 design, not a defect.
 */
const DRIFT_ORDER = [1, 2, 3, 4, 5, 6, 1, 2];
/** What those exact sheets scored when they were built. From `baseline_score.mjs`. */
const DRIFT_RECORDED = {
  arena: { firstRead: 5.17, firstN: 6, reRead: 4.75, reReadN: 4 },
  cast: { firstRead: 4.33, firstN: 6, reRead: 3.75, reReadN: 4 },
};

if (args.selftest) {
  const checks = [];
  const add = (ok, name, detail) => checks.push({ ok, name, detail });

  // §0 — the guard can see. Every arm below filters or indexes a list; an empty one passes.
  add(TD.length === 6, 'the top-down plate list is non-empty', `${TD.length} plates`);
  const onDisk = existsSync(join(ROOT, 'reference/images/curated/gameplay_topdown'));
  add(onDisk, 'gameplay_topdown exists on disk', String(onDisk));

  // cycle()
  add(JSON.stringify(cycle(TD, 8)) === JSON.stringify([...TD, 'bs_01.png', 'bs_02.png']),
    'cycle repeats from the start past the library size', cycle(TD, 8).join(','));
  add(new Set(cycle(TD, 6)).size === 6, 'cycle at k=6 uses every plate exactly once', 'ok');

  // floors
  add(Math.abs(floorAt(1) - 1.3859) < 0.001, 'canonical floor at k=1 is 1.39', floorAt(1).toFixed(4));
  add(Math.abs(floorAt(6) - 0.5658) < 0.001, 'canonical floor at k=6 is 0.57', floorAt(6).toFixed(4));
  add(Math.abs(floorAt(8) - 0.4900) < 0.001, 'canonical floor at k=8 is 0.49', floorAt(8).toFixed(4));
  add(Math.abs(floorBetween(8, 6) - 0.5292) < 0.001, 'the k=8 vs k=6 difference floor is 0.53',
    floorBetween(8, 6).toFixed(4));
  // KNOWN-BAD for the floor: a floor that IGNORES k would be constant. Prove it is not.
  add(floorAt(8) < floorAt(6) && floorAt(6) < floorAt(1),
    'KNOWN-BAD: the floor actually shrinks with k (a constant would pass every other check)',
    `${floorAt(1).toFixed(3)} > ${floorAt(6).toFixed(3)} > ${floorAt(8).toFixed(3)}`);

  // the drift arm's inputs must EXIST, or the arm is a manifest pointing at nothing —
  // the exact vacuity this repo has hit three times in one session.
  const driftFiles = ['arena', 'cast'].flatMap((el) => [1, 2, 3, 4, 5, 6]
    .map((i) => join(DRIFT_SRC, `${el}-c${i}`, 'sheet_1.png')));
  add(driftFiles.length === 12, 'the drift arm names 12 sheets (non-empty before asserting over it)',
    String(driftFiles.length));
  const missing = driftFiles.filter((f) => !existsSync(f));
  add(missing.length === 0, 'every drift sheet is on disk', missing.length ? missing.join(', ') : 'all 12 present');
  const keys = driftFiles.map((f) => f.replace('sheet_1.png', 'sheet_1.key.json')).filter((f) => !existsSync(f));
  add(keys.length === 0, 'every drift sheet still has its answer key', keys.length ? keys.join(', ') : 'all 12 present');
  // and they must be DISTINCT — 12 pointers at one file would satisfy every check above
  const hashes = new Set(driftFiles.filter((f) => existsSync(f)).map(sha));
  add(hashes.size === 12, 'KNOWN-BAD: the 12 drift sheets are 12 DISTINCT images', `${hashes.size} distinct`);

  // the rubric the baseline round used must still be the canonical one, byte for byte
  const canon = join(ROOT, 'tools/review.rubric.txt');
  const packetRubric = join(DRIFT_SRC, 'arena-c1', 'RUBRIC.txt');
  let sameRubric = false;
  if (existsSync(canon) && existsSync(packetRubric)) {
    const c = readFileSync(canon);
    sameRubric = readFileSync(packetRubric).subarray(0, c.length).equals(c);
  }
  add(sameRubric, 'the canonical rubric is byte-identical to the one the baseline packets carry',
    sameRubric ? 'identical' : 'DIFFERS — scores are not comparable across rubrics');

  for (const c of checks) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} - ${c.name}  [${c.detail}]`);
  const nOk = checks.filter((c) => c.ok).length;
  console.log(`\n${nOk === checks.length ? '✅ PASS' : '🔴 FAIL'}  q1_packets selftest: ${nOk}/${checks.length}`);
  process.exit(nOk === checks.length ? 0 : 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// build
// ─────────────────────────────────────────────────────────────────────────────

const K = Number(args.critics ?? 8);
const CTL_K = Number(args['control-critics'] ?? 3);
const ALT_K = Number(args['alt-critics'] ?? 4);
const OUT = resolve(args.out ?? join(ROOT, 'shots/review'));
const STAGE = resolve(args.stage ?? join(ROOT, 'shots/q1/stage'));

const ARENA = resolve(args.arena ?? '');
const ARENA_ALT = args['arena-alt'] ? resolve(args['arena-alt']) : null;
const CAST = resolve(args.cast ?? '');
for (const [name, p] of [['--arena', ARENA], ['--cast', CAST]]) {
  if (!existsSync(p)) { console.error(`missing ${name}: ${p}`); process.exit(3); }
}

await mkdir(STAGE, { recursive: true });

// ── the controls ─────────────────────────────────────────────────────────────
// ctl_high: a shipped third-party plate standing in as "ours". Deliberately gets NO
// sidecar — it is not a capture of this game and must never be recorded as a verified
// one, so it goes through `--allow-unverified` and is marked provisional by design.
const CTL_HIGH_SRC = join(ROOT, 'reference/images/curated/gameplay_topdown/bs_05.png');
const ctlHigh = join(STAGE, 'ctl_high.png');
await copyFile(CTL_HIGH_SRC, ctlHigh);

// ctl_low: our arena frame degraded on three axes at once, so no single guard catches
// it. Blur costs acuity, desaturation costs colour, the lift costs contrast — the three
// things the rubric names. Identical parameters to `baseline_packets.mjs`, so the two
// rounds' controls are the same control.
const ctlLow = join(STAGE, 'ctl_low.png');
await sharp(ARENA)
  .blur(3.5)
  .modulate({ saturation: 0.45, brightness: 1.12 })
  .linear(0.72, 40)
  .png()
  .toFile(ctlLow);
{
  const sc = `${ARENA}.capture.json`;
  const src = existsSync(sc) ? JSON.parse(await readFile(sc, 'utf8')) : null;
  await writeFile(`${ctlLow}.capture.json`, JSON.stringify({
    tool: 'q1_packets',
    label: 'DEGRADED CONTROL — not a product image',
    takenAt: new Date().toISOString(),
    painted: src ? src.painted === true : false,
    enforced: false,
    derivedFrom: {
      path: ARENA,
      degrade: 'blur 3.5 + saturation 0.45 + brightness 1.12 + linear(0.72,40)',
    },
    stats: null,
    before: src?.before ?? { ok: false, why: ['no source sidecar'] },
    after: src?.after ?? { ok: false, why: ['no source sidecar'] },
  }, null, 2));
}

const ELEMENTS = [
  {
    id: 'arena', ours: ARENA, category: 'gameplay_topdown', plates: cycle(TD, K),
    what: 'the whole match frame mid-fight: arena, both fighters, VFX, full HUD',
  },
  {
    id: 'cast', ours: CAST, category: 'topdown_cast', plates: cycle(TD, K),
    what: 'the cast at gameplay scale — 45% of frame height, 16:9, centred on the fighters',
  },
  ...(ARENA_ALT ? [{
    id: 'arena_alt', ours: ARENA_ALT, category: 'gameplay_topdown', plates: cycle(TD, ALT_K),
    what: 'OPTIONAL — a SECOND eligible action frame from the same run, same element. '
      + 'Nobody has ever measured how much of an arena score is the frame that was picked '
      + 'rather than the game. If arena and arena_alt agree, frame choice is not driving '
      + 'the number; if they differ, that is the finding.',
  }] : []),
  {
    id: 'ctl_high', ours: ctlHigh, category: 'gameplay_topdown',
    plates: ['bs_02.png', 'bs_04.png', 'bs_06.png'].slice(0, CTL_K),
    extra: ['--allow-unverified'],
    what: 'CONTROL: our panel is a shipped third-party plate. If the rubric cannot return '
      + '~8 for shipped work, every low score it produces is a property of the rubric.',
  },
  {
    id: 'ctl_low', ours: ctlLow, category: 'gameplay_topdown',
    plates: ['bs_01.png', 'bs_03.png', 'bs_05.png'].slice(0, CTL_K),
    extra: [],
    what: 'CONTROL: our panel is the arena frame degraded on three axes. It MUST score '
      + 'below `arena`; if it does not, the instrument is not discriminating and the round is void.',
  },
];

const assignments = [];
for (const el of ELEMENTS) {
  el.plates.forEach((plate, i) => {
    const dir = join(OUT, `q1-${el.id}-c${i + 1}`);
    execFileSync('node', [
      'tools/review.mjs',
      '--ours', el.ours,
      '--category', el.category,
      '--plates', plate,
      '--rubric', 'canonical',
      '--critics', '1',
      '--out', dir,
      ...(el.extra ?? []),
    ], { stdio: 'inherit', cwd: ROOT });
    const sheet = join(dir, 'sheet_1.png');
    const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
    assignments.push({
      arm: 'new',
      element: el.id,
      critic: i + 1,
      dir,
      plate,
      category: el.category,
      ours: el.ours,
      what: el.what,
      sheet,
      sheetSha256: sha(sheet),
      key: join(dir, 'sheet_1.key.json'),
      rubricSource: manifest.rubricSource,
      verified: manifest.capture.verified,
      overrides: manifest.capture.overrides,
    });
  });
}

// ── the drift arm: pointers only ─────────────────────────────────────────────
const drift = [];
for (const el of ['arena', 'cast']) {
  DRIFT_ORDER.forEach((srcIdx, i) => {
    const dir = join(DRIFT_SRC, `${el}-c${srcIdx}`);
    const sheet = join(dir, 'sheet_1.png');
    if (!existsSync(sheet)) { console.error(`drift arm: missing ${sheet}`); process.exit(4); }
    const m = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
    drift.push({
      arm: 'drift',
      element: `drift_${el}`,
      critic: i + 1,
      sourcePacket: `${el}-c${srcIdx}`,
      dir,
      plate: m.plates?.[0] ?? null,
      category: m.category,
      ours: m.ours,
      what: `DRIFT CONTROL — the BYTE-IDENTICAL sheet of 2026-08-05, unmodified. It read `
        + `${DRIFT_RECORDED[el].firstRead} (n=${DRIFT_RECORDED[el].firstN}) that afternoon and `
        + `${DRIFT_RECORDED[el].reRead} (n=${DRIFT_RECORDED[el].reReadN}) six hours later. `
        + `Re-scoring it now measures the INSTRUMENT, because the pixels cannot have changed.`,
      sheet,
      sheetSha256: sha(sheet),
      key: join(dir, 'sheet_1.key.json'),
      rubricSource: m.rubricSource ?? 'tools/review.rubric.txt',
      verified: m.capture?.verified ?? null,
      recorded: DRIFT_RECORDED[el],
    });
  });
}

const all = [...assignments, ...drift];
const outFile = join(OUT, 'q1-manifest.json');
await writeFile(outFile, JSON.stringify({
  builtAt: new Date().toISOString(),
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim(),
  capturedAt: args['captured-at'] ?? null,
  rubric: 'tools/review.rubric.txt (canonical v1)',
  rubricSha256: sha(join(ROOT, 'tools/review.rubric.txt')),
  criticsPerElement: K,
  criticsPerControl: CTL_K,
  criticsPerAlt: ALT_K,
  floors: {
    note: 'review.mjs:resolutionFloor = 1.96*sqrt(2)*0.50/sqrt(k), sd measured over 16 '
      + 'fresh critics on one fixed image. `between` is the 95% floor on the DIFFERENCE '
      + 'of two arms of the given sizes.',
    k1: +floorAt(1).toFixed(3),
    k3: +floorAt(CTL_K).toFixed(3),
    k4: +floorAt(ALT_K).toFixed(3),
    k6: +floorAt(6).toFixed(3),
    k8: +floorAt(K).toFixed(3),
    newVsBaseline_8v6: +floorBetween(K, 6).toFixed(3),
    driftVsFirstRead_8v6: +floorBetween(K, 6).toFixed(3),
  },
  assignments: all,
}, null, 2));

console.log(`\n${all.length} assignments -> ${outFile}`);
for (const a of all) {
  console.log(`  ${a.arm.padEnd(5)} ${a.element.padEnd(11)} c${String(a.critic).padEnd(2)} `
    + `plate ${String(a.plate).padEnd(11)} verified=${a.verified} ${a.sheet}`);
}
