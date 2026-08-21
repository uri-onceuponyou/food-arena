#!/usr/bin/env node
/**
 * BB_TRAIL — the acceptance rig for "`TRAIL.speedBoost` reaches the AI, not just the
 * player".
 *
 * `rules.ts:TRAIL.speedBoost` (1.35) was applied in `sim.ts:moveFighter`, which moves
 * HUMAN-controlled fighters, and nowhere else. `ai.ts:stepAI` built its step out of the
 * status slow and (since `b2be2f7`) the terrain factor, and never the trail — so a Donut
 * BOT got nothing from its own Sticky Trail while a Donut PLAYER got 35%.
 *
 * 🚨 SEVENTH INSTANCE of this file's oldest shape — one rule stated in `rules.ts` and
 * implemented twice — and **it survived the pass that fixed the sixth**, which added the
 * terrain term to the very same expression one line away.
 *
 *   --knownbad   Rebuilds the PRE-FIX sim from the shipped source with ONE asserted
 *                substitution and runs the REAL `sim.test.mjs` against it. §25(a2)'s two
 *                marked rows must go RED; its three controls must stay GREEN.
 *   --ratio      The one-tick control itself, on both trees: displacement bare vs on one's
 *                own trail, per seat. `bb_probe.mjs --trail` is the same measurement; this
 *                prints the two trees side by side.
 *
 *   node tools/tmp/bb_trail.mjs --knownbad
 *   node tools/tmp/bb_trail.mjs --ratio
 *   node tools/tmp/bb_trail.mjs --selftest
 */

import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const args = (() => {
  const o = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true;
    else { o[a.slice(2)] = n; i++; }
  }
  return o;
})();

// ─────────────────────────────────────────────────────────────────────────────
// THE PRE-FIX TREE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The one line the fix added. Dropping the factor — rather than deleting the whole
 * multiplier — is what makes this the PRE-FIX sim and not merely a broken one: the status
 * and terrain terms `b2be2f7` and the shipped code already carried stay exactly as they
 * are, so every row that is not about the trail is unaffected.
 */
const FIX_ANCHOR = '    * (isOnOwnTrail(state, self) ? TRAIL.speedBoost : 1);';
const PREFIX_LINE = '    * 1; // BB_TRAIL KNOWN-BAD: the pre-fix multiplier, with no trail term';

export function buildPreFixTree() {
  const dir = mkdtempSync(join(tmpdir(), 'bb-trail-'));
  cpSync(join(ROOT, 'src'), join(dir, 'src'), { recursive: true });
  const aiPath = join(dir, 'src/game/ai.ts');
  const before = readFileSync(aiPath, 'utf8');
  const hits = before.split(FIX_ANCHOR).length - 1;
  if (hits !== 1) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(
      `bb_trail: the known-bad anchor matched ${hits} times, expected exactly 1.\n`
      + `  anchor: ${FIX_ANCHOR}\n`
      + '  A pre-fix tree that is not pre-fix would turn every known-bad row green.',
    );
  }
  writeFileSync(aiPath, before.replace(FIX_ANCHOR, PREFIX_LINE));
  return { dir, simDir: join(dir, 'src/game') };
}

const rmTree = (t) => { if (t) rmSync(t.dir, { recursive: true, force: true }); };

// ─────────────────────────────────────────────────────────────────────────────
// --knownbad
// ─────────────────────────────────────────────────────────────────────────────

const MUST_FAIL = [
  '(a2) 🔴 the AI IS boosted by its own trail too',
  '(a2) 🔴 …and it is the SAME multiplier on both seats',
];
/**
 * …and these must be GREEN on the pre-fix tree. The PLAYER row is the load-bearing one:
 * it is the positive control, and if it moved too the rig would have broken the fixture
 * rather than the sim, and the bot's "1.000000" would mean nothing.
 */
const MUST_PASS = [
  '(a2) exactly one character in the roster carries the Sticky Trail',
  '(a2) trail control: both fighters move on bare floor',
  '(a2) trail control: the SIM sees a mark of their own under BOTH fighters',
  '(a2) the PLAYER is boosted by its own trail, at exactly TRAIL.speedBoost',
  // The SIXTH defect's row, on the same expression: it must not have been disturbed.
  '🔴 the AI IS slowed by terrain too, at exactly the same factor',
];

export function runKnownBad() {
  const tree = buildPreFixTree();
  let out;
  try {
    out = execFileSync(process.execPath, [join(tree.simDir, 'sim.test.mjs')], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    out = String(e.stdout ?? '') + String(e.stderr ?? '');
  } finally { rmTree(tree); }
  const lines = out.split('\n');
  const verdict = (needle) => {
    const l = lines.find((x) => x.includes(needle));
    if (!l) return 'ABSENT';
    return l.trimStart().startsWith('ok -') ? 'PASS' : 'FAIL';
  };
  return {
    failed: MUST_FAIL.map((n) => ({ n, v: verdict(n) })),
    passed: MUST_PASS.map((n) => ({ n, v: verdict(n) })),
    summary: lines.find((l) => / passed, \d+ failed$/.test(l)) ?? '(no summary line)',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// --ratio : the one-tick control, both trees
// ─────────────────────────────────────────────────────────────────────────────

export async function runRatio(simDir) {
  const { runTrail } = await import(`${ROOT}/tools/tmp/bb_probe.mjs`);
  return runTrail(simDir);
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const all = args.selftest === true;
  if (args.knownbad || all) {
    const r = runKnownBad();
    console.log('── KNOWN-BAD: the REAL suite against the PRE-FIX sim (no trail term in ai.ts) ──');
    console.log(`   ${r.summary}`);
    for (const { n, v } of r.failed) console.log(`   ${v === 'FAIL' ? 'ok  ' : 'BAD '} must FAIL: ${v.padEnd(6)} ${n}`);
    for (const { n, v } of r.passed) console.log(`   ${v === 'PASS' ? 'ok  ' : 'BAD '} must PASS: ${v.padEnd(6)} ${n}`);
    const bad = r.failed.filter((x) => x.v !== 'FAIL').length + r.passed.filter((x) => x.v !== 'PASS').length;
    console.log(`   => ${bad === 0 ? 'GUARD VALIDATED' : `${bad} ROW(S) WRONG — the guard is not a guard`}`);
    if (bad !== 0) process.exitCode = 1;
  }
  if (args.ratio || all) {
    const now = await runRatio(join(ROOT, 'src/game'));
    const tree = buildPreFixTree();
    let was;
    try { was = await runRatio(tree.simDir); } finally { rmTree(tree); }
    console.log('── ONE-TICK CONTROL: displacement bare vs on one\'s OWN trail ──');
    console.log(`   boost constant ${now.boost}`);
    console.log(`   shipped   player ${now.playerRatio.toFixed(6)}   bot ${now.botRatio.toFixed(6)}   controlOk=${now.controlOk} reachesBot=${now.reachesBot}`);
    console.log(`   pre-fix   player ${was.playerRatio.toFixed(6)}   bot ${was.botRatio.toFixed(6)}   controlOk=${was.controlOk} reachesBot=${was.reachesBot}`);
    const ok = now.controlOk && now.reachesBot && was.controlOk && !was.reachesBot;
    console.log(`   => ${ok ? 'the control moves on the fix and HOLDS on the player arm in both trees' : 'FAULT'}`);
    if (!ok) process.exitCode = 1;
  }
}

if (IS_MAIN) await main();
