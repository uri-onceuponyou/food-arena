#!/usr/bin/env node
/**
 * WPX_KNOWNBAD — the known-bad battery for `sim.test.mjs` §39, the DISPLACEMENT primitive.
 *
 * `CLAUDE.md` #6: **a guard that has not been shown to FAIL on the bug it guards against is
 * not a guard**, and *"a guard can pass by having nothing left to check — `[].every()`
 * returns `true`"*. §39 asserts eight properties of a mechanic that did not exist yesterday,
 * so every one of them needs an implementation that would break it, named and run.
 *
 * Each arm below rebuilds the sim from the SHIPPED source with **one asserted substitution**,
 * copies the real `src/game/sim.test.mjs` along with it, runs that suite against the broken
 * tree, and requires the named §39 rows to go RED while the named controls stay GREEN.
 *
 * ── 🚨 WHY A SUBSTITUTION AND NOT A WORKTREE OF THE PARENT COMMIT ────────────
 *
 * A detached worktree of "before the mechanic" is the honest pre-fix tree while the work is
 * in flight, and it is the WRONG mechanism for a committed rig: the SHA it names goes stale
 * on the next rebase, and a known-bad that silently stops reproducing its bug is exactly the
 * vacuity trap this repo has paid for repeatedly. `bb_block.mjs` settled this argument and
 * this file follows it, including the part that matters most — **the anchor is asserted to
 * match exactly once.** An anchor that stopped matching would produce a "broken" tree that
 * is simply the shipped tree, every row would go green, and the rig would report a passing
 * guard while testing nothing.
 *
 * ── THE EIGHT ARMS, AND WHAT EACH ONE IS THE BUG FOR ─────────────────────────
 *
 *   direct-write   `stepPush` writes `x`/`y` instead of going through `tryMove`, so
 *                  depenetration never runs and a shove buries its victim in a prop —
 *                  the state `movement.ts:escapeCover` calls *"the worst shape a bug can
 *                  have"*.                                                    -> §39(a)
 *   soft-stun      a fighter with a displacement in flight does not take its turn. This is
 *                  the THIRD LOCK `DECISIONS §75`/`§80` forbid, and it is the single most
 *                  natural way to write this feature wrong.                -> §39(b), (d)
 *   no-lock        `stepPush` drops its `movementLocked` refusal, so a caster can be shoved
 *                  mid-wind-up and `state.ts:ActiveCast`'s *"the origin is frozen BY
 *                  CONSTRUCTION"* becomes false — the telegraph lies.           -> §39(e)
 *   lure-victim    the lure pulls only the fighter it struck instead of every opponent.
 *                  🚨 **THIS ARM IS THE POINT OF THE WHOLE FILE**: it is RED at six seats
 *                  and GREEN at two, on the same suite, in the same run — the vacuity of an
 *                  N=2 test of *"lures every enemy"*, demonstrated rather than asserted.
 *                                                                              -> §39(c)
 *   no-clamp       the pull is not clamped to its victim's separation, so a nearby fighter
 *                  is dragged THROUGH the bait and out the far side.            -> §39(c)
 *   over-author    a shipped weapon authors 4 body lengths instead of half of one, breaking
 *                  the roster rate bound `6ea35f5` was refused on.              -> §39(f)
 *   global-push    `w.knockback ?? 0` becomes `?? 10` — every weapon in the game pushes.
 *                  That IS the refused design, in one character.                -> §39(g)
 *   launch-reach   a self-launch is added to the melee reach test, which is what an
 *                  instantaneous launch resolved before delivery would amount to. `§80`
 *                  lever 1 is to SHRINK a super's radius; this grows it quietly. -> §39(h)
 *
 * ⚠️ **THE CONTROL ROWS ARE PART OF EACH ARM, NOT AN AFTERTHOUGHT.** A substitution that
 * reddened everything would have changed the experiment rather than the sim, and would be
 * indistinguishable from a broken fixture. Every arm names rows that must STAY GREEN.
 *
 *   node tools/tmp/wpx_knownbad.mjs                # every arm
 *   node tools/tmp/wpx_knownbad.mjs --arm no-lock  # one arm
 *   node tools/tmp/wpx_knownbad.mjs --selftest     # every arm + the rig's own controls
 */

import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

// `docs/AGENT-BRIEF.md` §3 — three tools here ran their whole CLI path on import, one of
// which would have killed every snapshot server on the box. Guard the main path.
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
// THE ARMS
//
// `file` is relative to `src/`; `find` must appear EXACTLY ONCE in it. `mustFail` rows are
// claims about the mechanic and must be red on this arm's tree; `mustPass` rows are the
// fixture, the non-vacuity guards and — for `lure-victim` — the deliberately vacuous N=2
// control, which is the row whose GREENNESS is the finding.
// ─────────────────────────────────────────────────────────────────────────────
export const ARMS = [
  {
    name: 'direct-write',
    why: 'stepPush bypasses tryMove, so escapeCover never runs and a shove buries its victim',
    file: 'game/movement.ts',
    find: '    : tryMove(fighter, p.x * step, p.y * step, arena);',
    repl: '    : (((fighter.x += p.x * step), (fighter.y += p.y * step)), true); // WPX KNOWN-BAD: no depenetration',
    mustFail: [
      '(a) 🔴 a maximum shove INTO cover is refused at the box face',
    ],
    mustPass: [
      '(a) the victim starts OUTSIDE the cart',
      '(a) …and it did move: a displacement that went nowhere',
      '(b) 🔴 CONTROL AUTHORITY IS BIT-IDENTICAL under a maximum displacement',
      '(e) 🔴 a STUNNED fighter is not displaced at all',
    ],
  },
  {
    name: 'soft-stun',
    why: 'a fighter with a displacement in flight loses its turn — the third lock §75/§80 forbid',
    file: 'game/sim.ts',
    find: '      if (!fighter.alive) continue;\n      if (fighter.controller === \'human\') {',
    repl: '      if (!fighter.alive) continue;\n'
      + '      // WPX KNOWN-BAD: being shoved costs CONTROL as well as position.\n'
      + '      if (fighter.push.remaining > 0) { stepPush(fighter, dt, state.arena, state.elapsed); applyWorldTick(state, fighter, dt, false, events); continue; }\n'
      + '      if (fighter.controller === \'human\') {',
    mustFail: [
      '(b) 🔴 CONTROL AUTHORITY IS BIT-IDENTICAL under a maximum displacement',
      '(d) 🔴 MEASURED: a maximum PULL takes exactly one body away',
    ],
    mustPass: [
      '(b) the fixture MOVES at all',
      '(b) …and the push really displaced it, on the other axis, by the whole cap',
      '(a) 🔴 a maximum shove INTO cover is refused at the box face',
      '(d) 🔴 walking straight INTO a maximum displacement costs less than a FIFTH of a body',
    ],
  },
  {
    name: 'no-lock',
    why: 'a caster can be shoved mid-wind-up, so the telegraph no longer says where the effect lands',
    file: 'game/movement.ts',
    find: '  const moved = movementLocked(fighter, elapsed)\n    ? false\n    : tryMove(fighter, p.x * step, p.y * step, arena);',
    repl: '  const moved = tryMove(fighter, p.x * step, p.y * step, arena); // WPX KNOWN-BAD: locks do not stop a shove',
    mustFail: [
      '(e) 🔴 a STUNNED fighter is not displaced at all',
      '(e) 🔴 a CASTER is not displaced mid-wind-up',
    ],
    mustPass: [
      '(e) the UNLOCKED control travels the whole cap',
      '(e) the cast fixture really opened a wind-up',
      '(a) 🔴 a maximum shove INTO cover is refused at the box face',
    ],
  },
  {
    name: 'lure-victim',
    why: 'the lure pulls only the fighter it struck — RED at six seats, GREEN at two',
    file: 'game/combat.ts',
    find: '    for (const victim of state.fighters) {\n      if (!isLivingOpponentOf(victim, attacker)) continue;\n      const dx = ax - victim.x;',
    repl: '    for (const victim of [target]) { // WPX KNOWN-BAD: "every enemy" becomes "the one it hit"\n'
      + '      if (!isLivingOpponentOf(victim, attacker)) continue;\n      const dx = ax - victim.x;',
    mustFail: [
      '(c) 🔴 EVERY living opponent was pulled toward the impact',
      '(c) 🔴 …and each of them closed by the AUTHORED distance',
      '(c) 🔴 a pull never overshoots its anchor',
    ],
    mustPass: [
      // 🚨 THE FINDING. This row is the N=2 arm of the same mechanic, and it is GREEN on a
      // tree where the mechanic is provably broken — which is what "an N=2 test of `lures
      // every enemy` cannot fail" means, shown rather than argued.
      '(c) 🔴 AT TWO SEATS THE LURE MOVES EXACTLY NOBODY',
      '(c) the N=6 fixture actually LANDED the shot',
      '(c) the bystander set is NON-EMPTY and is FOUR fighters',
    ],
  },
  {
    name: 'no-clamp',
    why: 'a pull is not clamped to its separation, so a near fighter is dragged through the bait',
    file: 'game/combat.ts',
    find: '      displaceFighter(victim, dx, dy, lure < sep ? lure : sep);',
    repl: '      displaceFighter(victim, dx, dy, lure); // WPX KNOWN-BAD: no clamp, so a pull overshoots',
    mustFail: [
      '(c) …and the near fighter is owed its SEPARATION',
      '(c) 🔴 a pull never overshoots its anchor',
    ],
    mustPass: [
      '(c) 🔴 EVERY living opponent was pulled toward the impact',
      '(c) the clamp fixture stands INSIDE the lure distance',
    ],
  },
  {
    name: 'over-author',
    why: 'a shipped weapon authors 4 body lengths — the rate bound 6ea35f5 was refused on',
    file: 'game/rules.ts',
    find: "effect: 'slow', knockback: BODY_LENGTH / 2, emoji: '\u{1F534}' }",
    repl: "effect: 'slow', knockback: BODY_LENGTH * 4, emoji: '\u{1F534}' }", // WPX KNOWN-BAD
    mustFail: [
      '(f) 🔴 no kit displaces its victim faster than it can CHASE',
      '(f) 🔴 …nor faster than the roster\'s SLOWEST walk',
    ],
    mustPass: [
      '(f) the authored set is NON-EMPTY',
      '(f) 🔴 KNOWN-BAD: `6ea35f5`\'s damage-derived wiring BREACHES this bound',
    ],
  },
  {
    name: 'global-push',
    why: 'every weapon in the game knocks back — 6ea35f5\'s refused design, in one character',
    file: 'game/combat.ts',
    find: '  const knockback = w.knockback ?? 0;',
    repl: '  const knockback = w.knockback ?? 10; // WPX KNOWN-BAD: the refused GLOBAL wiring',
    mustFail: [
      '(g) 🔴 …and `Fighter.push` was never written once',
    ],
    mustPass: [
      // A claim about the ROSTER, not about the sim, so it is true on both trees — which is
      // what makes the row above a measurement of behaviour rather than of `rules.ts`.
      '(g) the inert fixture is a pair that authors NOTHING',
      '(g) the inert match actually TRADED WEAPON HITS',
    ],
  },
  {
    name: 'launch-reach',
    why: 'a self-launch is added to the melee reach — a radius increase hidden in a movement field',
    file: 'game/combat.ts',
    find: '      if (dist > range) continue; // "too far"',
    repl: '      if (dist > range + (w.selfLaunch ?? 0)) continue; // WPX KNOWN-BAD: the launch extends the reach',
    mustFail: [
      '(h) 🔴 the hit/miss boundary sits on `range`',
      '(h) 🔴 …and nothing beyond `range` connects',
    ],
    mustPass: [
      '(h) `egg.Tackle` really authors a self-launch',
      '(h) …and the press really QUEUES the launch',
      '(h) the sweep contains BOTH outcomes',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// THE BROKEN TREE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Copy `src/` into a temp dir and apply exactly one substitution. Returns `{ dir, simDir }`;
 * the caller owns the cleanup.
 *
 * The whole of `src/` is copied rather than just `game/`, because `sim.ts` imports
 * `../arena/types.ts` and `../units.ts` by relative path — a `game/`-only copy would resolve
 * those against the ORIGINAL tree and measure a hybrid. `sim.test.mjs` rides along inside
 * `src/game/`, so the suite that runs is the real one, not a copy that can drift.
 *
 * 🚨 **THE MATCH COUNT IS ASSERTED, AND `null` IS RETURNED FOR AN ARM THAT CANNOT STAGE.**
 * Throwing would abort the battery on the first arm whose anchor drifted; returning null
 * lets every other arm run and reports the drift as a FAULT, which is the difference between
 * "one arm needs its anchor re-pointed" and "the battery is down".
 */
export function buildBrokenTree(arm) {
  const dir = mkdtempSync(join(tmpdir(), `wpx-${arm.name}-`));
  cpSync(join(ROOT, 'src'), join(dir, 'src'), { recursive: true });
  const path = join(dir, 'src', arm.file);
  const before = readFileSync(path, 'utf8');
  const hits = before.split(arm.find).length - 1;
  if (hits !== 1) {
    rmSync(dir, { recursive: true, force: true });
    return { dir: null, err: `anchor matched ${hits} times, expected exactly 1 — a "broken" tree that is not broken turns every row below green` };
  }
  const after = before.replace(arm.find, arm.repl);
  if (after === before) {
    rmSync(dir, { recursive: true, force: true });
    return { dir: null, err: 'the substitution changed nothing' };
  }
  writeFileSync(path, after);
  return { dir, simDir: join(dir, 'src/game') };
}

const rmTree = (t) => { if (t && t.dir) rmSync(t.dir, { recursive: true, force: true }); };

/** Run `sim.test.mjs` out of `simDir` and return its stdout+stderr. Never throws on exit 1. */
function runSuite(simDir) {
  try {
    return execFileSync(process.execPath, [join(simDir, 'sim.test.mjs')], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    return String(e.stdout ?? '') + String(e.stderr ?? '');
  }
}

/**
 * PASS / FAIL / ABSENT for a row, by substring.
 *
 * ⚠️ `ABSENT` is a distinct verdict and is always a FAULT, never a silent pass. A row name
 * that stopped matching — because the assertion was reworded — would otherwise read as
 * "not failing", i.e. exactly the same as "guarded", which is the failure mode this whole
 * file exists to refuse.
 */
function verdicts(out, names) {
  const lines = out.split('\n');
  return names.map((n) => {
    const l = lines.find((x) => x.includes(n));
    return { n, v: l === undefined ? 'ABSENT' : (l.trimStart().startsWith('ok -') ? 'PASS' : 'FAIL') };
  });
}

export function runArm(arm) {
  const tree = buildBrokenTree(arm);
  if (tree.dir === null) return { arm, staged: false, err: tree.err, failed: [], passed: [], summary: '' };
  let out;
  try { out = runSuite(tree.simDir); } finally { rmTree(tree); }
  const lines = out.split('\n');
  return {
    arm,
    staged: true,
    failed: verdicts(out, arm.mustFail),
    passed: verdicts(out, arm.mustPass),
    summary: lines.find((l) => / passed, \d+ failed$/.test(l)) ?? '(no summary line)',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
if (IS_MAIN) {
  let faults = 0;
  const only = typeof args.arm === 'string' ? args.arm : null;
  const arms = only === null ? ARMS : ARMS.filter((a) => a.name === only);
  if (arms.length === 0) {
    console.log(`wpx_knownbad: no arm named "${only}". Arms: ${ARMS.map((a) => a.name).join(', ')}`);
    process.exit(1);
  }

  console.log('══ WPX_KNOWNBAD ══  §39 shown RED, one substitution at a time\n');

  // ── THE BASELINE, AND IT IS NOT CEREMONIAL ────────────────────────────────
  //
  // Every row below is a claim of the form "this goes red when the sim is broken". That
  // claim is worth nothing unless the same row is GREEN on the shipped tree, and a suite
  // that was already failing would make every `mustFail` verdict true for free.
  {
    const out = runSuite(join(ROOT, 'src/game'));
    const summary = out.split('\n').find((l) => / passed, \d+ failed$/.test(l)) ?? '(none)';
    const clean = / 0 failed$/.test(summary);
    const named = [...new Set(ARMS.flatMap((a) => [...a.mustFail, ...a.mustPass]))];
    const green = verdicts(out, named);
    const notGreen = green.filter((g) => g.v !== 'PASS');
    console.log(`BASELINE (shipped tree)   ${summary}`);
    if (!clean) { faults++; console.log('   FAULT  the shipped suite is not clean — every "goes red" claim below is unfalsifiable'); }
    if (notGreen.length > 0) {
      faults++;
      console.log(`   FAULT  ${notGreen.length} named row(s) are not PASS on the shipped tree:`);
      for (const g of notGreen) console.log(`            ${g.v}  ${g.n}`);
    } else {
      console.log(`   OK     all ${named.length} named rows are green on the shipped tree\n`);
    }
  }

  for (const arm of arms) {
    const r = runArm(arm);
    console.log(`── ${arm.name.toUpperCase()} ── ${arm.why}`);
    if (!r.staged) {
      faults++;
      console.log(`   FAULT  could not stage: ${r.err}`);
      console.log(`          ${arm.file}  ::  ${JSON.stringify(arm.find).slice(0, 110)}\n`);
      continue;
    }
    console.log(`   suite: ${r.summary}`);
    for (const f of r.failed) {
      const ok = f.v === 'FAIL';
      if (!ok) faults++;
      console.log(`   ${ok ? 'RED   ' : 'FAULT '} must fail — ${f.v.padEnd(6)} ${f.n}`);
    }
    for (const p of r.passed) {
      const ok = p.v === 'PASS';
      if (!ok) faults++;
      console.log(`   ${ok ? 'green ' : 'FAULT '} must hold — ${p.v.padEnd(6)} ${p.n}`);
    }
    console.log('');
  }

  if (args.selftest) {
    // ── THE RIG'S OWN CONTROLS ───────────────────────────────────────────────
    //
    // (1) A no-op substitution must NOT be reported as a working known-bad. This is the
    //     vacuity check on the rig itself: if `buildBrokenTree` ever stopped applying, every
    //     arm would run against the shipped tree and every `mustFail` row would read PASS —
    //     which the arms already catch — but the SHAPE of that failure is worth pinning.
    // (2) An anchor that matches more than once must refuse rather than patch the first one.
    console.log('── RIG CONTROLS ──');
    const noop = { name: 'noop', file: 'game/movement.ts', find: 'export function stepPush(', repl: 'export function stepPush(' };
    const t1 = buildBrokenTree(noop);
    const ok1 = t1.dir === null && /changed nothing/.test(t1.err ?? '');
    if (!ok1) { faults++; rmTree(t1); }
    console.log(`   ${ok1 ? 'PASS' : 'FAULT'}  a substitution that changes nothing is REFUSED, not staged`);

    const multi = { name: 'multi', file: 'game/combat.ts', find: 'const ', repl: 'const ' };
    const t2 = buildBrokenTree(multi);
    const ok2 = t2.dir === null && /matched \d+ times/.test(t2.err ?? '');
    if (!ok2) { faults++; rmTree(t2); }
    console.log(`   ${ok2 ? 'PASS' : 'FAULT'}  an anchor that matches more than once is REFUSED, not applied to the first hit`);

    const absent = { name: 'absent', file: 'game/movement.ts', find: 'no such text anywhere in this file', repl: 'x' };
    const t3 = buildBrokenTree(absent);
    const ok3 = t3.dir === null && /matched 0 times/.test(t3.err ?? '');
    if (!ok3) { faults++; rmTree(t3); }
    console.log(`   ${ok3 ? 'PASS' : 'FAULT'}  an anchor that matches nothing is REFUSED — a drifted anchor is a FAULT, not a pass`);

    // (4) …and `verdicts` must report ABSENT rather than swallowing a missing row.
    const ok4 = verdicts('  ok - something else\n', ['a row nobody prints'])[0].v === 'ABSENT';
    if (!ok4) faults++;
    console.log(`   ${ok4 ? 'PASS' : 'FAULT'}  a row name that no longer matches reads ABSENT, never "not failing"`);
    console.log('');
  }

  if (faults > 0) { console.log(`   ${faults} FAULT(S)`); process.exit(1); }
  console.log(`   OK — ${arms.length} arm(s), every marked §39 row shown RED and every control green.`);
}
