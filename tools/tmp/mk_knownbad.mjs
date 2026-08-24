#!/usr/bin/env node
/**
 * MK_KNOWNBAD — the known-bad battery for `sim.test.mjs` §40, MEDIKITS.
 *
 * `CLAUDE.md` #6: **a guard that has not been shown to FAIL on the bug it guards against is
 * not a guard**, and *"a guard can pass by having nothing left to check — `[].every()`
 * returns `true`"*. §40 asserts fifty-odd properties of a mechanic that did not exist
 * yesterday, so the ones that carry weight need an implementation that would break them,
 * named and run.
 *
 * ── THE RIG IS IMPORTED, NOT COPIED ─────────────────────────────────────────
 *
 * `buildBrokenTree` and `runArm` come from `tools/tmp/wpx_knownbad.mjs`, which already
 * states them once: copy `src/` to a temp dir, apply EXACTLY ONE asserted substitution, run
 * the real `sim.test.mjs` out of the broken tree, and report PASS / FAIL / **ABSENT** per
 * named row. A second copy here would be this codebase's oldest defect shape — *a rule
 * stated once and implemented twice* — in the very file that exists to catch it. That file
 * guards its own CLI behind `IS_MAIN` precisely so it can be imported, and its header says
 * so; importing it costs nothing and cannot drift.
 *
 * ⚠️ **`ABSENT` IS A FAULT, NEVER A PASS**, and that is the inherited property that matters
 * most here: §40's row names are long and quotable, so a reworded assertion would otherwise
 * read as *"not failing"*, which is indistinguishable from *"guarded"*.
 *
 * ── THE ARMS ────────────────────────────────────────────────────────────────
 *
 *   rng-pop           the pop draws `Math.random()` for its bearing. **This is the single
 *                     most natural way to write this feature**, it is what the phrase "jump
 *                     out" suggests, and `rules.ts` forbids it outright (*"NO ROLL. NOT
 *                     NEGOTIABLE"*). Two independent §40 rows must catch it: the replay
 *                     check and the source scan.                        -> §40(c), (k)
 *   fixed-fan         the fan's phase is a constant instead of the victim's facing. The
 *                     kits still land at the right distance and still replay, so every
 *                     other geometry row stays green — only the rotation row moves.
 *                                                                             -> §40(b)
 *   no-arming         the `armsAt` gate is dropped, so a kit is collectable while it is
 *                     still in the air and the killer sweeps both on the tick it killed.
 *                                                                             -> §40(d)
 *   full-hp-denial    the `hp >= maxHp` refusal is dropped: a healthy fighter eats a kit
 *                     for nothing, which is denial-by-standing-on-it.          -> §40(e)
 *   slot-order        🚨 **THE ARM THAT IS THE POINT OF THIS FILE.** The tie-break becomes
 *                     "first in slot order", the shape `TrailMark.damagedMask` already
 *                     exists to refuse. It is RED with the needier fighter in slot 1 and
 *                     GREEN with the needier fighter in slot 0 — *the same assertion, on
 *                     the same broken tree, in the same run*. A one-sided test of a
 *                     tie-break cannot fail, demonstrated rather than argued. -> §40(g)
 *   no-ai-seek        `stepAI` stops looking for kits. This is the seven-times-recorded
 *                     `ai.ts` defect — a rule that reaches the human seat and no other —
 *                     and it is worth a whole arm because the game still LOOKS correct.
 *                                                                             -> §40(f)
 *   radius-not-race   the bot's reach test becomes an unbounded radius instead of "can I
 *                     get there before it expires". A bot that walks at a kit which will
 *                     be gone before it arrives has stopped fighting for nothing. -> §40(f)
 *   no-cover-fallback a bearing into a crate is kept, so the kit is a promise on screen the
 *                     game cannot keep.                                         -> §40(l)
 *   no-expiry         kits never expire, so the floor accumulates for the whole match and
 *                     the contest window — the entire answer to "can they be denied?" —
 *                     silently becomes infinite.                                -> §40(j)
 *   dead-mechanic     `stepMedikits` collects NOTHING. Not a plausible bug; it is the
 *                     VACUITY CONTROL. Every §40 row that can pass with the mechanic
 *                     entirely dead is listed in `mustPass` **and each of those greens is a
 *                     finding, not a reassurance** — it names precisely which rows are
 *                     one-sided and therefore need the paired row beside them.
 *
 * ⚠️ **THE CONTROL ROWS ARE PART OF EACH ARM.** A substitution that reddened everything
 * would have changed the experiment rather than the sim and is indistinguishable from a
 * broken fixture, so every arm names rows that must STAY GREEN.
 *
 *   node tools/tmp/mk_knownbad.mjs                  # every arm  (~2 min: 10 suites)
 *   node tools/tmp/mk_knownbad.mjs --arm rng-pop    # one arm
 *   node tools/tmp/mk_knownbad.mjs --selftest       # every arm + this rig's own controls
 */
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildBrokenTree, runArm } from './wpx_knownbad.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

// `docs/AGENT-BRIEF.md` §3 — three tools here ran their whole CLI path on import.
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

export const ARMS = [
  {
    name: 'rng-pop',
    why: 'the pop rolls for its bearing — the forbidden implementation, caught two ways',
    file: 'game/combat.ts',
    find: '    const angle = base + (i * 2 * Math.PI) / MEDIKIT.count;',
    repl: '    const angle = base + Math.random() * 2 * Math.PI; // MK KNOWN-BAD: a roll in the sim',
    mustFail: [
      '(c) 🔴 the same death produces bit-identical kits, twice',
      '(k) 🔴 NOT ONE `Math.random` in the simulation',
    ],
    mustPass: [
      '(b) 🔴 a death drops exactly `MEDIKIT.count` kits, and announces every one of them',
      '(b) 🔴 every kit lands exactly `popDistance` from the body',
      '(k) …and the scan can see one when there is one',
    ],
  },
  {
    name: 'fixed-fan',
    why: 'the fan phase is a constant, so the pop stops being a fact about the fighter that died',
    file: 'game/combat.ts',
    find: '  const base = Math.atan2(victim.facing.y, victim.facing.x);',
    repl: '  const base = 0; // MK KNOWN-BAD: the fan no longer follows the victim',
    mustFail: [
      '(b) 🔴 …evenly spaced around the full circle, phase-locked to the victim\'s own facing',
      '(b) 🔴 turn the victim 90° and the WHOLE FAN turns with it',
    ],
    mustPass: [
      '(b) 🔴 every kit lands exactly `popDistance` from the body',
      '(c) 🔴 the same death produces bit-identical kits, twice',
    ],
  },
  {
    name: 'no-arming',
    why: 'a kit is collectable in mid-air, so the killer sweeps the body on the tick it killed',
    file: 'game/sim.ts',
    find: '    if (state.elapsed < kit.armsAt) { i++; continue; }',
    repl: '    // MK KNOWN-BAD: no arming delay — a kit can be taken out of the air',
    mustFail: [
      '(d) 🔴 a kit still in the air is NOT collected, however long you stand on it',
    ],
    mustPass: [
      '(d) 🔴 …and it IS collected on the first tick at or after `armsAt`',
      '(e) 🔴 a fighter at FULL HP walks over a kit and leaves it',
      '(j) 🔴 a kit nobody takes is gone at `expiresAt`, match over or not',
    ],
  },
  {
    name: 'full-hp-denial',
    why: 'a healthy fighter eats a kit for nothing — denial by standing on it',
    file: 'game/sim.ts',
    find: '      if (!f.alive || f.hp >= f.maxHp) continue;',
    repl: '      if (!f.alive) continue; // MK KNOWN-BAD: full HP is no longer a refusal',
    mustFail: [
      '(e) 🔴 a fighter at FULL HP walks over a kit and leaves it',
    ],
    mustPass: [
      '(e) 🔴 …and one point of damage is enough to take it',
      '(h) 🔴 HP is capped at the pool',
      '(d) 🔴 a kit still in the air is NOT collected, however long you stand on it',
    ],
  },
  {
    name: 'slot-order',
    why: 'the tie-break becomes the SLOT — red one way round, green the other, same run',
    file: 'game/sim.ts',
    find: '      if (f.hp / f.maxHp < taker.hp / taker.maxHp) taker = f;',
    repl: '      // MK KNOWN-BAD: first in slot order wins, which is a seat advantage',
    mustFail: [
      '(g) 🔴 the NEEDIER fighter takes it — slot 1 is the hurt one and slot 1 gets it',
    ],
    mustPass: [
      // 🚨 THE FINDING. Same assertion, other way round, GREEN on a tree where the rule is
      // provably a seat advantage. A tie-break tested from one side cannot fail.
      '(g) 🔴 the NEEDIER fighter takes it — slot 0 is the hurt one and slot 0 gets it',
      '(g) both fighters really were touching the same kit, and exactly one kit was taken (non-vacuity, needier=slot 1)',
    ],
  },
  {
    name: 'no-ai-seek',
    why: 'the bot stops seeing kits — the seven-times `ai.ts` defect, and the game still looks fine',
    file: 'game/ai.ts',
    find: '    if (state.medikits.length === 0) return null;',
    repl: '    return null; // MK KNOWN-BAD: the bot cannot see a kit; only the human collects',
    mustFail: [
      '(f) 🔴 A HURT BOT WALKS TO THE KIT',
    ],
    mustPass: [
      '(f) 🔴 …and a bot with NOTHING TO HEAL ignores it and goes at the opponent',
      '(f) 🔴 a kit it CANNOT REACH IN TIME is ignored',
      '(f) …and the hurt bot actually MOVED',
    ],
  },
  {
    name: 'radius-not-race',
    why: 'the bot\'s reach test becomes an unbounded radius, so it walks at kits that will be gone',
    file: 'game/ai.ts',
    find: '      if (d > (kit.expiresAt - now) * ownSpeed) continue;',
    repl: '      if (d > 1e9) continue; // MK KNOWN-BAD: a radius, not a race',
    mustFail: [
      '(f) 🔴 a kit it CANNOT REACH IN TIME is ignored',
    ],
    mustPass: [
      '(f) 🔴 A HURT BOT WALKS TO THE KIT',
      '(f) 🔴 …and a bot with NOTHING TO HEAL ignores it and goes at the opponent',
    ],
  },
  {
    name: 'no-cover-fallback',
    why: 'a bearing into a crate is kept, so the kit is a promise on screen the game cannot keep',
    file: 'game/combat.ts',
    find: '      if (boxesOverlap(x, y, r, r, box.x, box.y, box.w, box.h)) { x = victim.x; y = victim.y; break; }',
    repl: '      if (false && boxesOverlap(x, y, r, r, box.x, box.y, box.w, box.h)) { x = victim.x; y = victim.y; break; } // MK KNOWN-BAD',
    mustFail: [
      '(l) 🔴 …so it falls back to the DEATH POINT',
    ],
    mustPass: [
      '(l) the un-fallen-back bearing really WOULD have landed inside the crate',
      '(l) 🔴 a body against the wall does not throw a kit through it',
      '(b) 🔴 every kit lands exactly `popDistance` from the body',
    ],
  },
  {
    name: 'no-expiry',
    why: 'kits never expire, so the contest window — the whole answer to "can they be denied" — is infinite',
    file: 'game/sim.ts',
    find: '    if (state.elapsed >= state.medikits[i].expiresAt) state.medikits.splice(i, 1);',
    repl: '    if (false) state.medikits.splice(i, 1); // MK KNOWN-BAD: a kit lies there for ever',
    mustFail: [
      '(j) 🔴 a kit nobody takes is gone at `expiresAt`, match over or not',
    ],
    mustPass: [
      '(j) there is something to expire',
      '(d) 🔴 …and it IS collected on the first tick at or after `armsAt`',
    ],
  },
  {
    name: 'dead-mechanic',
    why: 'THE VACUITY CONTROL — nothing is ever collected, and every green below is a finding',
    file: 'game/sim.ts',
    find: '  for (let i = 0; i < state.medikits.length;) {',
    repl: '  for (let i = 0; i < 0;) { // MK KNOWN-BAD: collection is dead',
    mustFail: [
      '(d) 🔴 …and it IS collected on the first tick at or after `armsAt`',
      '(e) 🔴 …and one point of damage is enough to take it',
      '(g) 🔴 the NEEDIER fighter takes it — slot 0 is the hurt one and slot 0 gets it',
      '(g) 🔴 the NEEDIER fighter takes it — slot 1 is the hurt one and slot 1 gets it',
      '(h) 🔴 `medikit-taken.amount` is what the fighter GAINED',
      '(i) 🔴 at LEVEL_MIN a kit heals exactly its base',
      '(i) 🔴 …and it scales with the HEALTH ladder',
      '(m) 🔴 a BYSTANDER collects a kit off a body it had nothing to do with',
    ],
    mustPass: [
      // 🚨 EVERY ROW HERE IS GREEN ON A TREE WHERE NOTHING IS EVER COLLECTED. That is the
      // list of §40 rows which are ONE-SIDED, and it is the reason each of them has a
      // paired positive row above it in `mustFail`. Read this list, not the OK at the end.
      '(d) 🔴 a kit still in the air is NOT collected, however long you stand on it',
      '(e) 🔴 a fighter at FULL HP walks over a kit and leaves it',
      '(f) 🔴 a kit it CANNOT REACH IN TIME is ignored',
      '(j) 🔴 a kit nobody takes is gone at `expiresAt`, match over or not',
      '(b) 🔴 a death drops exactly `MEDIKIT.count` kits, and announces every one of them',
    ],
  },
];

/** Run `sim.test.mjs` out of `simDir`; never throws on exit 1. */
function runSuite(simDir) {
  try {
    return execFileSync(process.execPath, [join(simDir, 'sim.test.mjs')], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    return String(e.stdout ?? '') + String(e.stderr ?? '');
  }
}

function verdicts(out, names) {
  const lines = out.split('\n');
  return names.map((n) => {
    const l = lines.find((x) => x.includes(n));
    return { n, v: l === undefined ? 'ABSENT' : (l.trimStart().startsWith('ok -') ? 'PASS' : 'FAIL') };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
if (IS_MAIN) {
  let faults = 0;
  const only = typeof args.arm === 'string' ? args.arm : null;
  const arms = only === null ? ARMS : ARMS.filter((a) => a.name === only);
  if (arms.length === 0) {
    console.log(`mk_knownbad: no arm named "${only}". Arms: ${ARMS.map((a) => a.name).join(', ')}`);
    process.exit(1);
  }

  console.log('══ MK_KNOWNBAD ══  §40 MEDIKITS shown RED, one substitution at a time\n');

  // ── THE BASELINE, AND IT IS NOT CEREMONIAL ────────────────────────────────
  //
  // Every row below is a claim of the form "this goes red when the sim is broken", and it
  // is worth nothing unless the same row is GREEN on the shipped tree — a suite that was
  // already failing would make every `mustFail` verdict true for free.
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
    // ── THIS RIG'S OWN CONTROLS ─────────────────────────────────────────────
    //
    // The staging primitive is `wpx_knownbad`'s and carries its own controls there. What is
    // NOT covered by those is the thing this file adds: a table of arms whose anchors point
    // into MEDIKIT code. An anchor that drifted would stage a tree that is simply the
    // shipped tree, every `mustFail` row would read PASS, and the arm loop already calls
    // that a FAULT — but the shape is worth pinning where it can be read.
    console.log('── RIG CONTROLS ──');

    // (1) Every arm's anchor must be present EXACTLY ONCE, right now, in the file it names.
    //     Checked WITHOUT running a suite, so a drifted anchor is named in a second rather
    //     than diagnosed from ten minutes of confusing verdicts.
    let anchorFaults = 0;
    for (const arm of ARMS) {
      const t = buildBrokenTree({ ...arm, name: `probe-${arm.name}` });
      const ok = t.dir !== null;
      if (!ok) { anchorFaults++; faults++; console.log(`   FAULT  ${arm.name}: ${t.err}`); }
      if (t.dir !== null) execFileSync('rm', ['-rf', t.dir]);
    }
    console.log(`   ${anchorFaults === 0 ? 'PASS' : 'FAULT'}  all ${ARMS.length} anchors match exactly once in the file they name`);

    // (2) NON-EMPTY FIRST. An arm table that had lost its rows would print a clean sheet.
    const emptyArms = ARMS.filter((a) => a.mustFail.length === 0 || a.mustPass.length === 0);
    const ok2 = ARMS.length > 0 && emptyArms.length === 0;
    if (!ok2) faults++;
    console.log(`   ${ok2 ? 'PASS' : 'FAULT'}  every arm names at least one row in BOTH directions (${ARMS.length} arms)`);

    // (3) …and `verdicts` reports ABSENT rather than swallowing a row name that no longer
    //     matches. Inherited behaviour, asserted here because §40's names are long.
    const ok3 = verdicts('  ok - something else\n', ['a row nobody prints'])[0].v === 'ABSENT';
    if (!ok3) faults++;
    console.log(`   ${ok3 ? 'PASS' : 'FAULT'}  a row name that no longer matches reads ABSENT, never "not failing"`);

    // (4) The two directions must be DISJOINT within an arm — a row named in both would be
    //     satisfied whatever it did.
    const overlapping = ARMS.filter((a) => a.mustFail.some((f) => a.mustPass.includes(f)));
    const ok4 = overlapping.length === 0;
    if (!ok4) faults++;
    console.log(`   ${ok4 ? 'PASS' : 'FAULT'}  no arm names the same row in both directions${ok4 ? '' : `: ${overlapping.map((a) => a.name).join(', ')}`}`);
    console.log('');
  }

  if (faults > 0) { console.log(`   ${faults} FAULT(S)`); process.exit(1); }
  console.log(`   OK — ${arms.length} arm(s), every marked §40 row shown RED and every control green.`);
}
