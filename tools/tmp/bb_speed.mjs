#!/usr/bin/env node
/**
 * BB_SPEED — the acceptance rig for `DECISIONS §75(b)`: the whole game 25% slower, with
 * every ratio between the three movement constants preserved.
 *
 * Uri, 2026-08-12: *"All characters are moving too fast."* Answered 2026-08-21, after the
 * one question that had blocked it for a session — whether the BOTS move too:
 *
 *   > *"75 - drop the bots as well. same rate."*
 *
 * `PLAYER_SPEED` 0.12 -> 0.09 · `AI_CHASE_SPEED` 0.07 -> 0.0525 · `AI_FLEE_SPEED`
 * 0.085 -> 0.06375. All x0.75, so `PLAYER_SPEED / AI_CHASE_SPEED` stays 1.714…x.
 *
 *   --knownbad     Rebuilds the PRE-CHANGE sim from the shipped source with THREE asserted
 *                  substitutions and runs the REAL `sim.test.mjs` against it. §38's marked
 *                  rows must go RED; its non-vacuity rows must stay GREEN.
 *   --consequences The three things a speed change reaches that no balance number shows,
 *                  both trees: dodgeability (weapon `speed` did NOT move), the fog's
 *                  wall-clock schedule, and what a wall-clock stun costs in ground.
 *
 *   node tools/tmp/bb_speed.mjs --knownbad
 *   node tools/tmp/bb_speed.mjs --consequences
 *   node tools/tmp/bb_speed.mjs --selftest
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
// THE PRE-CHANGE TREE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FOUR substitutions, not one, and the fourth is the point: `waterbottle.Mega.castMs` is
 * DERIVED from the roster's slowest speed (`sim.test.mjs` §33(o) asserts the derivation),
 * so a pre-change tree that reverted the speeds and kept `castMs: 1400` would be a tree
 * that has never existed — §33(o) would be red in it for a reason that has nothing to do
 * with this change, and the known-bad would be measuring its own inconsistency.
 */
const SUBS = [
  ["export const PLAYER_SPEED = tune('PLAYER_SPEED', 0.09, {",
    "export const PLAYER_SPEED = tune('PLAYER_SPEED', 0.12, { // BB_SPEED KNOWN-BAD"],
  ["export const AI_CHASE_SPEED = tune('AI_CHASE_SPEED', 0.0525, {",
    "export const AI_CHASE_SPEED = tune('AI_CHASE_SPEED', 0.07, { // BB_SPEED KNOWN-BAD"],
  ["export const AI_FLEE_SPEED = tune('AI_FLEE_SPEED', 0.06375, {",
    "export const AI_FLEE_SPEED = tune('AI_FLEE_SPEED', 0.085, { // BB_SPEED KNOWN-BAD"],
  ["effect: 'slow', castMs: 1400,", "effect: 'slow', castMs: 1100,"],
];

export function buildPreChangeTree() {
  const dir = mkdtempSync(join(tmpdir(), 'bb-speed-'));
  cpSync(join(ROOT, 'src'), join(dir, 'src'), { recursive: true });
  const rulesPath = join(dir, 'src/game/rules.ts');
  let s = readFileSync(rulesPath, 'utf8');
  for (const [a, b] of SUBS) {
    const n = s.split(a).length - 1;
    if (n !== 1) {
      rmSync(dir, { recursive: true, force: true });
      throw new Error(`bb_speed: anchor matched ${n} times, expected exactly 1.\n  anchor: ${a}`);
    }
    s = s.replace(a, b);
  }
  writeFileSync(rulesPath, s);
  return { dir, simDir: join(dir, 'src/game') };
}

const rmTree = (t) => { if (t) rmSync(t.dir, { recursive: true, force: true }); };

// ─────────────────────────────────────────────────────────────────────────────
// --knownbad
// ─────────────────────────────────────────────────────────────────────────────

const MUST_FAIL = [
  '(a) 🔴 …and all three really did move, by the same factor',
  '(b) closing the ladder\'s longest reach takes measurably longer',
  '(b) ⚠️ the evade window GREW',
  '(d) …and a stun now denies LESS ground, not more',
  '(e) 🔴 `waterbottle.Mega.castMs` is a FUNCTION OF THE ROSTER SPEED',
];
/**
 * …and these must be GREEN on the PRE-CHANGE tree. Three of them are the interesting ones:
 * the two RATIO rows pass on both trees BY DESIGN (that is the whole content of "same
 * rate" — the ratios were already right, the change preserved them), and the fog and the
 * camera rows pass on both because a wall-clock schedule and a cancelling constant are
 * exactly the two things this change was checked NOT to have broken. A section where those
 * moved would have changed the experiment rather than the sim.
 */
const MUST_PASS = [
  '(a) the three movement constants are distinct, positive, and ordered',
  '(a) 🔴 the player/bot gap is UNCHANGED',
  '(a) 🔴 …and so is flee/chase',
  '(c) 🔴 the slowest character still outruns the closing ring at every seat count',
  '(c) 🔴 …and outruns it even while slowed',
  '(e) 🔴 the guaranteed-visible radius is INVARIANT under a speed change',
  'waterbottle.Mega\'s wind-up is exactly what its geometry derives',
  // ⚠️ MOVED HERE FROM `MUST_FAIL`, AND THE MISCLASSIFICATION IS WORTH RECORDING: §38(e)'s
  // `FLEE_REFERENCE_SPEED === PLAYER_SPEED * 1000` is a STRUCTURAL claim — that the derived
  // constant still follows its input — and it is true at EVERY speed, so it passes on both
  // trees by construction. Listing it as must-fail was a claim that a structural invariant
  // is evidence about a change; the rig caught it, which is what a must-pass list is for.
  '(e) `FLEE_REFERENCE_SPEED` followed automatically',
];

export function runKnownBad() {
  const tree = buildPreChangeTree();
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
// --consequences
// ─────────────────────────────────────────────────────────────────────────────

export async function runConsequences(dir) {
  const r = await import(`${dir}/src/game/rules.ts`);
  const arena = JSON.parse(readFileSync(join(ROOT, 'tools/arena.gameplay.json'), 'utf8'));
  const speeds = r.CHARACTER_IDS.map((id) => r.speedFor(id, r.PLAYER_SPEED) * 1000);
  const slowest = Math.min(...speeds);
  const fastest = Math.max(...speeds);
  const maxR = Math.hypot(arena.width / 2, arena.height / 2);
  // The ring's own peak closing rate, read off the SHIPPED schedule function.
  const ringPeak = (n) => {
    const floor = r.minSafeRadiusFor(n);
    let peak = 0;
    for (let t = 0; t + 100 <= r.FOG_CLOSE_MS; t += 100) {
      peak = Math.max(peak, ((r.fogRadiusAt(t, maxR, floor) - r.fogRadiusAt(t + 100, maxR, floor)) / 100) * 1000);
    }
    return peak;
  };
  const MEGA = r.CHARACTERS.waterbottle.weapons.find((w) => w.key === 'Mega');
  return {
    player: r.PLAYER_SPEED, chase: r.AI_CHASE_SPEED, flee: r.AI_FLEE_SPEED,
    gap: r.PLAYER_SPEED / r.AI_CHASE_SPEED,
    slowest, fastest,
    evadeMs: r.HIT_RADIUS_VS_PLAYER / r.PLAYER_SPEED,
    closeMaxS: r.REACH.rangedMax / fastest,
    crossMapS: arena.width / fastest,
    ring6: ringPeak(6), ring2: ringPeak(2),
    slowedSpeed: slowest * r.SLOW_MOVE_MULTIPLIER,
    stunWu: r.STUN_DURATION_MS * r.PLAYER_SPEED,
    castMs: MEGA.castMs,
    escapeMs: (MEGA.range / slowest) * 1000,
    projMin: Math.min(...r.CHARACTER_IDS.flatMap((id) => r.CHARACTERS[id].weapons.filter((w) => w.type === 'ranged').map((w) => w.speed ?? 0))),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const all = args.selftest === true;
  if (args.knownbad || all) {
    const r = runKnownBad();
    console.log('── KNOWN-BAD: the REAL suite against the PRE-CHANGE sim (0.12 / 0.07 / 0.085, castMs 1100) ──');
    console.log(`   ${r.summary}`);
    for (const { n, v } of r.failed) console.log(`   ${v === 'FAIL' ? 'ok  ' : 'BAD '} must FAIL: ${v.padEnd(6)} ${n}`);
    for (const { n, v } of r.passed) console.log(`   ${v === 'PASS' ? 'ok  ' : 'BAD '} must PASS: ${v.padEnd(6)} ${n}`);
    const bad = r.failed.filter((x) => x.v !== 'FAIL').length + r.passed.filter((x) => x.v !== 'PASS').length;
    console.log(`   => ${bad === 0 ? 'GUARD VALIDATED' : `${bad} ROW(S) WRONG — the guard is not a guard`}`);
    if (bad !== 0) process.exitCode = 1;
  }
  if (args.consequences || all) {
    const now = await runConsequences(ROOT);
    const tree = buildPreChangeTree();
    let was;
    try { was = await runConsequences(tree.dir); } finally { rmTree(tree); }
    console.log('── WHAT A SPEED CHANGE REACHES THAT NO BALANCE NUMBER SHOWS ──');
    const row = (label, a, b, f = (x) => x.toFixed(2)) =>
      console.log(`   ${label.padEnd(46)} ${String(f(a)).padStart(10)}   was ${String(f(b)).padStart(10)}`);
    row('PLAYER_SPEED / AI_CHASE / AI_FLEE (wu/ms)', now.player, was.player, (x) => x.toFixed(5));
    row('  player/bot gap', now.gap, was.gap, (x) => `${x.toFixed(4)}x`);
    row('roster speed slowest..fastest (wu/s)', now.slowest, was.slowest);
    row('  fastest', now.fastest, was.fastest);
    console.log('   ── 1. DODGEABILITY: weapon `speed` did NOT move ──');
    row('evade window, clear your own hit radius (ms)', now.evadeMs, was.evadeMs);
    row('  slowest projectile in the roster (wu/s)', now.projMin, was.projMin);
    row('close REACH.rangedMax, fastest human (s)', now.closeMaxS, was.closeMaxS);
    row('waterbottle.Mega castMs (DERIVED, followed)', now.castMs, was.castMs, (x) => String(x));
    row('  its escape boundary, slowest human (ms)', now.escapeMs, was.escapeMs);
    console.log('   ── 2. THE FOG IS A WALL CLOCK: can a person keep up? ──');
    row('ring peak closing rate, N=6 (wu/s)', now.ring6, was.ring6);
    row('  N=2', now.ring2, was.ring2);
    row('slowest fighter, SLOWED (wu/s)', now.slowedSpeed, was.slowedSpeed);
    console.log(`   verdict: ${now.slowedSpeed > now.ring6 ? 'a SLOWED slowest fighter still outruns the ring' : '🔴 THE RING OUTRUNS A SLOWED FIGHTER'}`);
    console.log('   ── 3. WALL-CLOCK STATUS: what a stun costs in ground ──');
    row('ground a 2000 ms stun denies (wu)', now.stunWu, was.stunWu);
    row('cross the map, fastest human (s)', now.crossMapS, was.crossMapS, (x) => x.toFixed(1));
  }
}

if (IS_MAIN) await main();
