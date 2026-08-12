#!/usr/bin/env node
/**
 * rm_write_baked — add THIS baseline's `bakedInRegressions` to tools/scan/colour-baseline.json.
 *
 * `arena-scan --json` writes everything in that file EXCEPT this one array, and prints
 * "🔴 NOW WRITE THIS BASELINE'S OWN `bakedInRegressions` ... That sentence is the only
 * part a tool cannot write." This is that step, done as a SCRIPT rather than by hand so
 * that the edit is (a) reproducible and (b) mechanically provable to have touched
 * nothing else.
 *
 * It refuses to run unless the target is the exact tool-written file it expects, and it
 * asserts afterwards that every other key is byte-identical.
 *
 *   node tools/tmp/rm_write_baked.mjs --check   # verify only, write nothing
 */
import { readFileSync, writeFileSync } from 'node:fs';

const TARGET = 'tools/scan/colour-baseline.json';
const PRISTINE = 'tools/tmp/rm_baseline_072f245_toolwritten.json';
const CHECK = process.argv.includes('--check');

const BAKED = [
  'EVERY RAIL PASSES. All 11, for the first time in this file\'s history: warmChroma 0.0596 FAIL '
  + '-> 0.0823 PASS and arenaWarmChroma 0.0580 WARN -> 0.0828 PASS. `--gate` now fires on nothing. '
  + '🔴 THAT IS THE RISK THIS BASELINE CARRIES, not a victory lap: a gate that never fires is a gate '
  + 'nobody reads, and every number below is now THE REFERENCE and therefore invisible to the next run.',

  'THE BIG ONE, and nobody chose it: THE ENVIRONMENT HAS RE-OCCUPIED THE CAST\'S HUE BAND. '
  + 'envShareInCastBand 0.1198 -> 0.1700 (+42%), envChromaInCastBand 0.0583 -> 0.0828 (+42%), '
  + 'hueSeparationDeg 133.5 -> 97.1 (-36.4 deg), and topCellsInCastBand 0.296 -> 0.648 — i.e. 65% of '
  + 'the loudest non-player cells now wear the cast\'s own 0-60deg hue, up from 30%. `995ea7d` '
  + '("arena colour: vacate the cast\'s hue band") DELIBERATELY bought that number down — 0.1906 -> '
  + '0.1244, loud-cells-in-cast-hue 37% -> 24%, playerRank median 33.5 -> 23 — by moving the gold trim, '
  + 'the plank pads, floorGrime and the pot stack OUT of 0-60deg. The x4 map has spent a large part of '
  + 'that back. EVERY RAIL STILL PASSES (envWarmShare 0.1646 vs a 0.297 ceiling, envShareInCastBand '
  + '0.1700 vs 0.400), SO NOTHING GATES IT. It reproduced at 0.648 on three independent sweeps, so it '
  + 'is not noise. If the hero should out-read the arena, this is the number to attack.',

  'THE STANDING ART ADVICE THAT SAYS THE OPPOSITE IS NOW FALSE, AND THREE FILES STILL CARRY IT. '
  + 'CLAUDE.md\'s art-direction block, docs/AGENT-BRIEF.md section 6 and docs/TOOLS.md all state '
  + '"warm chroma FAILS LOW (0.053 against a 0.072 minimum) while cool sits at 0.427 against a 0.343 '
  + 'target — over ... warm is the scarce budget today". Measured on this tree: warm 0.0823 PASSES, '
  + 'cool 0.3856 (was 0.4077) is still over target but by 12% rather than 19%. Warm is no longer a '
  + 'contract violation. It is still the furthest rail from its target (57% of 0.145) — but see the '
  + 'next entry before treating 0.145 as the thing to chase.',

  'THE 0.145 WARM TARGET IS A MEAN PULLED UP BY ONE PLATE, and `995ea7d` said so in its message '
  + 'without the band ever being changed. Per-plate warm chroma, straight off `--selftest`\'s own '
  + 'table: 0.017 0.022 0.065 0.079 0.079 0.095 0.115 0.135 0.171 0.213 0.603. MEAN 0.1449 (the '
  + 'target), MEDIAN 0.0950, second-highest 0.213. Our 0.0823 is 57% of the mean but 87% of the '
  + 'median, and 5 of the 11 plates now sit BELOW us — we moved from the 18th percentile of the plate '
  + 'population to the 45th. The band floor 0.0725 is 0.5x the mean, so it inherits the same outlier.',

  'RESOLUTION FLOOR, measured not assumed, on THIS station set: THREE independent full sweeps of '
  + 'pinned 072f245 (tools/tmp/rm_scan_A.json, rm_scan_B.json, and this file) spread <= 0.0006 on '
  + 'every whole-frame chroma aggregate (warmChroma 0.0002, meanChroma/coolChroma 0.0006) and '
  + '<= 0.0001 on every HUD-free rail (arena*/env*/cast*), because the HUD is the only thing that '
  + 'moves. playerRankMedian was 26 in all three; playerRankMean spread 0.7. SIXTEEN of eighteen '
  + 'stations were rank-IDENTICAL across all three and byte-identical on warmChroma; the only two '
  + 'movers are fog_boundary (16/16/15) and fog_inside (31/45/36), BOTH `unstill: hud-css`. So the '
  + 'warm move of +0.0227 is 38x the whole-frame floor and arenaWarmChroma\'s +0.0248 is 248x the '
  + 'HUD-free floor. ⚠️ Three sweeps agreeing on the median does NOT license revising the old '
  + '+/-1.5-place claim downward — n=3 cannot resolve a 1.5-place floor.',

  'NOT COMPARABLE TO 36ee0a6 ON RANK, AND THE TOOL ENFORCES IT. All 18 stationKeys changed (the 1x '
  + 'list was migrated to the x4 map), so `--baseline` against the old file exits 2 — REFUSED, not '
  + 'compared — which is the check doing its job: same station IDs, different GROUND. playerRankMedian '
  + '30 -> 26 is therefore NOT a measured improvement and must not be quoted as one. The CHROMA '
  + 'aggregates are comparable in a weaker, stated sense: `colourBudget()` is BYTE-IDENTICAL between '
  + 'the 36ee0a6-era tool and this one, and `--selftest` reproduces the recorded reference figures '
  + '0.493 / 0.1449 / 0.3431 off the same 11 plates — so each side is an honest description of its own '
  + 'shipped map through the same instrument. What it is NOT is a controlled A/B: the map layout, the '
  + 'prop merge, the rim-clone fix and the station positions all moved together and this run '
  + 'attributes the change to NONE of them.',

  'stillHud: false, DELIBERATELY, matching 36ee0a6 so the old->new chroma delta is a tree change and '
  + 'not an instrument change. Justified by measurement rather than inherited: only 3 of 18 stations '
  + 'are non-still, their effect on the whole-frame aggregates is <= 0.0006 and on the HUD-free rails '
  + '<= 0.0001, and the rank median was identical on all three sweeps. --still-hud would collapse the '
  + 'fog stations\' rank spread to zero but freezes the HUD keyframes at t=0, which is a BIASED sample; '
  + 'the two are not comparable and `--baseline` refuses to compare them silently. I did NOT run a '
  + '--still-hud arm, so what it would buy on this tree is unmeasured.',

  'PROVENANCE IS STRONGER THAN THE FILE IT REPLACES, ON TWO COUNTS. `tool.committed` is TRUE here '
  + '(blob dd5da76) where 36ee0a6\'s baseline recorded blob 9a91cae with `committed: false` — that '
  + 'blob is NOT in the object store and the exact instrument that wrote the old file is '
  + 'UNRECOVERABLE. And `headAtWrite` is 71f670b, not the served 072f245, because two peer commits '
  + 'landed mid-sweep; `git diff 072f245..71f670b -- src/` is 14 lines in src/characters/taco.ts, '
  + 'ALL of them comment lines, and taco is in no station frame (player=hamburger, enemy=donut). '
  + '`srcDirtyFiles: 1` is a peer\'s live src/ui/hud.ts and did NOT enter the measurement: headserve '
  + 'served `git archive 072f245`, and the banner\'s resolved 40-char sha was read back.',
];

const cur = JSON.parse(readFileSync(TARGET, 'utf8'));
const pristine = JSON.parse(readFileSync(PRISTINE, 'utf8'));

// Refuse to touch anything that is not the tool's own output for this commit.
if (cur.provenance?.sha !== '072f245d7cf0c0d99330fd85ce772cfde252eef3') {
  throw new Error(`refusing: ${TARGET} provenance.sha is ${cur.provenance?.sha}, not 072f245`);
}
if (cur.provenance?.trust !== 'served') throw new Error('refusing: provenance.trust is not "served"');

// Rebuild with bakedInRegressions immediately after provenance, every other key in
// its original order and with its original value.
const out = {};
for (const k of Object.keys(cur)) {
  if (k === 'bakedInRegressions') continue;          // never duplicate
  out[k] = cur[k];
  if (k === 'provenance') out.bakedInRegressions = BAKED;
}

// ── PROOF THAT NOTHING ELSE MOVED ───────────────────────────────────────────────
// Compare against the PRISTINE tool output, key by key, on serialised value. This is
// the assertion that makes the edit provably additive.
const keysP = Object.keys(pristine), keysO = Object.keys(out).filter((k) => k !== 'bakedInRegressions');
if (keysP.length === 0) throw new Error('pristine file has no keys — refusing a vacuous proof');
if (JSON.stringify(keysP) !== JSON.stringify(keysO)) {
  throw new Error(`key set or ORDER changed:\n  pristine ${keysP.join(',')}\n  new      ${keysO.join(',')}`);
}
for (const k of keysP) {
  if (JSON.stringify(pristine[k]) !== JSON.stringify(out[k])) throw new Error(`key "${k}" CHANGED — refusing to write`);
}
console.log(`  ✓ all ${keysP.length} tool-written keys byte-identical to ${PRISTINE}, in the same order`);
console.log(`  ✓ the only difference is the added bakedInRegressions (${BAKED.length} entries)`);

// Every FAILing rail must be named in the array — the tool's instruction, asserted.
const failing = (out.rails || []).filter((r) => r.status !== 'PASS');
const text = BAKED.join(' ');
// NONEMPTY first: an empty `failing` set would make the .every() below vacuously true.
if (failing.length === 0) {
  if (!/EVERY RAIL PASSES/.test(text)) throw new Error('no rail is FAILing and the array does not say so');
  console.log('  ✓ 0 rails FAIL/WARN, and the array states that explicitly (guards the vacuous case)');
} else if (!failing.every((r) => text.includes(r.key))) {
  throw new Error(`a FAILing rail is unnamed: ${failing.filter((r) => !text.includes(r.key)).map((r) => r.key)}`);
}

if (CHECK) { console.log('  --check: nothing written'); process.exit(0); }
writeFileSync(TARGET, JSON.stringify(out, null, 2) + '\n');
console.log(`  wrote ${TARGET}`);
