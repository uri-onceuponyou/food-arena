#!/usr/bin/env node
/**
 * b4_knownbad — every B4 fix, REVERTED (or replaced by the wrong fix) on a scratch copy of `src/`,
 * must turn its own `sim.test.mjs` §47 rows red while its controls stay green (`docs/REVAMP.md`
 * §5, B4, 2026-10-15). Owner of the `b4_` prefix.
 *
 * `CLAUDE.md` #6: *"A guard that has not been shown to FAIL on the bug it guards against is not a
 * guard."* Each 🔴 row in §47 went red on `31ed880` before its fix landed and the commits say so;
 * this makes that claim re-runnable. The engine is B3's `tools/tmp/b3_knownbad.mjs:runArm`
 * (imported, not copied): one textual substitution per arm, asserted to match EXACTLY ONCE, the
 * real suite run against the copy, rows matched by name PREFIX.
 *
 * Two kinds of arm, and the second kind is the one a red-on-base test cannot give you:
 *   * REVERT — the shipped bug, put back. Its 🔴 rows must go red.
 *   * WRONG FIX — a plausible fix that is not this one (refuse instead of cancel; snap the chick to
 *     the body's centre; pick ANY standable point instead of the nearest). Each must be caught by
 *     a row that the right fix passes — otherwise that row is decoration.
 *
 *   node tools/tmp/b4_knownbad.mjs                 # every arm (~12 s each)
 *   node tools/tmp/b4_knownbad.mjs --arm escape-stuck
 *   node tools/tmp/b4_knownbad.mjs --list
 *   node tools/tmp/b4_knownbad.mjs --selftest      # the rig shown to fail: a no-op revert, a drifted anchor
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runArm } from './b3_knownbad.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

export const ARMS = [
  // ── BH-02 ──────────────────────────────────────────────────────────────────────
  {
    name: 'escape-stuck',
    bug: 'BH-02 REVERT — escapeCover gives up inside cover when its passes run out (the shipped bug)',
    file: 'game/movement.ts',
    find: '  if (!collidesWithCover(fighter.x, fighter.y, size, cover)) return;\n  const spot = nearestStandable(askedX, askedY, size, arena);',
    repl: '  return;\n  const spot = nearestStandable(askedX, askedY, size, arena);',
    mustFail: [
      '(a) 🔴 `placeFighterAt` into a seam', '(a) 🔴 …and into a box flush', '(a) 🔴 …at the NEAREST',
      '(a) 🔴 a REAL Disposal', '(a) 🔴 …and the victim can WALK AWAY', '(a) 🔴 a fighter already WEDGED',
    ],
    mustPass: [
      '(a) NON-VACUITY: every requested drop point', '(a) NON-VACUITY: the press throws V',
      '(a) CONTROL: a lone box', '(a) CONTROL: a drop onto open floor', '(a) CONTROL: a fighter PARKED',
    ],
  },
  {
    name: 'escape-anywhere',
    bug: 'BH-02 WRONG FIX — the fallback takes ANY standable candidate (the last found), not the nearest',
    file: 'game/movement.ts',
    find: '        if (d > reach || d >= bestD) continue;',
    repl: '        if (d > reach) continue;',
    mustFail: ['(a) 🔴 …at the NEAREST'],
    mustPass: ['(a) 🔴 `placeFighterAt` into a seam', '(a) 🔴 …and into a box flush', '(a) CONTROL: a lone box'],
  },
  // ── BH-10 ──────────────────────────────────────────────────────────────────────
  {
    name: 'throw-keeps-cast',
    bug: 'BH-10 REVERT — Disposal relocates a caster and its wind-up resolves where it landed (the shipped bug)',
    file: 'game/combat.ts',
    find: "      if (victim.cast !== null) cancelCast(victim, 'displaced', events);\n",
    repl: '',
    mustFail: ['(b) 🔴 the throw CANCELS the wind-up', '(b) 🔴 …so the slam never goes off'],
    mustPass: [
      '(b) NON-VACUITY / CONTROL: unthrown', '(b) NON-VACUITY: the throw lands', '(b) CONTROL: the cooldown stays SPENT',
      '(b) CONTROL: a ROOTED victim', '(b) CONTROL: an ITEM wind-up',
    ],
  },
  {
    name: 'throw-refuses-locked',
    bug: 'BH-10 WRONG FIX — stepPush\'s rule copied: a casting OR rooted victim is not thrown at all',
    file: 'game/combat.ts',
    find: "      if (victim.cast !== null) cancelCast(victim, 'displaced', events);\n",
    repl: '      if (victim.cast !== null || state.elapsed < victim.item.rootUntil) return;\n',
    mustFail: ['(b) CONTROL: a ROOTED victim'],
    mustPass: ['(b) NON-VACUITY / CONTROL: unthrown', '(b) CONTROL: an ITEM wind-up'],
  },
  {
    name: 'throw-kills-item-windup',
    bug: 'BH-10 OVER-FIX — the throw also cancels an ITEM wind-up (a Shiitake shield is on the body, not a spot)',
    file: 'game/combat.ts',
    find: "      if (victim.cast !== null) cancelCast(victim, 'displaced', events);\n",
    repl: "      if (victim.cast !== null) cancelCast(victim, 'displaced', events);\n      if (victim.itemCast !== null) cancelItemCast(victim, 'stun', events);\n",
    mustFail: ['(b) CONTROL: an ITEM wind-up'],
    mustPass: ['(b) 🔴 the throw CANCELS the wind-up', '(b) 🔴 …so the slam never goes off'],
  },
  // ── BH-08 ──────────────────────────────────────────────────────────────────────
  {
    name: 'trail-outlives-owner',
    bug: 'BH-08 REVERT — a dead owner\'s marks stay drawn until they expire, biting nobody (the shipped bug)',
    file: 'game/sim.ts',
    find: '    if (state.elapsed >= mark.expiresAt || (owner !== undefined && !owner.alive)) state.trailMarks.splice(i, 1);',
    repl: '    if (state.elapsed >= mark.expiresAt) state.trailMarks.splice(i, 1);',
    mustFail: ['(c) 🔴 the tick after Donut dies', '(c) 🔴 …and six seats', '(c) 🔴 on NO tick after the death'],
    mustPass: ['(c) NON-VACUITY: Donut laid a lane', '(c) CONTROL: the walker crossing', '(c) CONTROL: a LIVING Donut'],
  },
  {
    name: 'trail-cleared-for-all',
    bug: 'BH-08 OVER-FIX — every mark is retired whatever its owner (a LIVING Donut loses its trail)',
    file: 'game/sim.ts',
    find: '    if (state.elapsed >= mark.expiresAt || (owner !== undefined && !owner.alive)) state.trailMarks.splice(i, 1);',
    repl: '    if (state.elapsed >= mark.expiresAt || owner !== undefined) state.trailMarks.splice(i, 1);',
    mustFail: ['(c) CONTROL: a LIVING Donut', '(c) NON-VACUITY: Donut laid a lane'],
    mustPass: ['(c) 🔴 the tick after Donut dies', '(c) 🔴 on NO tick after the death'],
  },
  // ── BH-12 ──────────────────────────────────────────────────────────────────────
  {
    name: 'chick-stays-put',
    bug: 'BH-12 REVERT — the arrived chick never moves; it pecks from where it landed (the shipped bug)',
    file: 'game/sim.ts',
    find: '        p.x += target.x - p.tx;\n        p.y += target.y - p.ty;\n',
    repl: '',
    mustFail: ['(d) 🔴 two seats, a fleeing victim', '(d) 🔴 …at the very offset', '(d) 🔴 six seats, and a BLOCKER'],
    mustPass: ['(d) NON-VACUITY: every arm struck', '(d) CONTROL: the pecks themselves', '(d) CONTROL: a victim that stands still'],
  },
  {
    name: 'chick-snaps-to-centre',
    bug: 'BH-12 WRONG FIX — `p.x = target.x`: the chick snaps INTO the body, where it renders 0 px at 58 deg',
    file: 'game/sim.ts',
    find: '        p.x += target.x - p.tx;\n        p.y += target.y - p.ty;\n',
    repl: '        p.x = target.x;\n        p.y = target.y;\n',
    mustFail: ['(d) 🔴 …at the very offset', '(d) CONTROL: a victim that stands still'],
    mustPass: ['(d) 🔴 two seats, a fleeing victim', '(d) CONTROL: the pecks themselves'],
  },
  {
    name: 'chick-anchored-on-aim',
    bug: 'BH-12 HALF-FIX — the latch is not re-anchored on the body STRUCK, so a blocker\'s chick jumps',
    file: 'game/sim.ts',
    find: '        p.tx = victim.x;\n        p.ty = victim.y;\n',
    repl: '',
    mustFail: ['(d) 🔴 six seats, and a BLOCKER'],
    mustPass: ['(d) 🔴 two seats, a fleeing victim', '(d) 🔴 …at the very offset', '(d) CONTROL: a victim that stands still'],
  },
  // ── move B3 — one arm per timer, each must turn ONLY its own row red ─────────────
  {
    name: 'fog-resets',
    bug: 'move B3 REVERT — the fog clock drops its overshoot (315 ms at a 45 ms hitch)',
    file: 'game/sim.ts',
    find: '      fighter.fogTimer = (fighter.fogTimer - FOG_TICK_MS) % FOG_TICK_MS;',
    repl: '      fighter.fogTimer = 0;',
    mustFail: ['(e) 🔴 the FOG ticks'],
    mustPass: ['(e) 🔴 the POT ticks', '(e) 🔴 REGEN ticks', '(e) 🔴 the Sticky Trail drops', '(e) CONTROL: at the corpus'],
  },
  {
    name: 'pot-resets',
    bug: 'move B3 REVERT — the pot clock drops its overshoot (266.67 ms at 60 Hz)',
    file: 'game/sim.ts',
    find: '        fighter.hazardTimers[idx] = (t - period) % period;',
    repl: '        fighter.hazardTimers[idx] = 0;',
    mustFail: ['(e) 🔴 the POT ticks'],
    mustPass: ['(e) 🔴 the FOG ticks', '(e) 🔴 REGEN ticks', '(e) CONTROL: at the corpus'],
  },
  {
    name: 'regen-resets',
    bug: 'move B3 REVERT — the regen clock drops its overshoot (216.67 ms at 60 Hz)',
    file: 'game/sim.ts',
    find: '      fighter.regenTimer = (fighter.regenTimer - REGEN_TICK_MS) % REGEN_TICK_MS;',
    repl: '      fighter.regenTimer = 0;',
    mustFail: ['(e) 🔴 REGEN ticks'],
    mustPass: ['(e) 🔴 the FOG ticks', '(e) 🔴 the POT ticks', '(e) CONTROL: at the corpus'],
  },
  {
    name: 'trail-drop-resets',
    bug: 'move B3 REVERT — the trail drop clock drops its overshoot (166.67 ms everywhere)',
    file: 'game/sim.ts',
    find: '      fighter.trailDropTimer = (fighter.trailDropTimer - TRAIL.dropIntervalMs) % TRAIL.dropIntervalMs;',
    repl: '      fighter.trailDropTimer = 0;',
    mustFail: ['(e) 🔴 the Sticky Trail drops'],
    mustPass: ['(e) 🔴 the FOG ticks', '(e) 🔴 the POT ticks', '(e) 🔴 REGEN ticks'],
  },
  // ── move B4 ────────────────────────────────────────────────────────────────────
  {
    name: 'fog-reentry-resets',
    bug: 'move B4 REVERT — one frame back inside the ring restarts the fog clock (the dance takes nothing)',
    file: 'game/sim.ts',
    find: "      applyDamage(state, fighter, FOG_DAMAGE, null, { kind: 'fog' }, events);\n    }\n  }\n}",
    repl: "      applyDamage(state, fighter, FOG_DAMAGE, null, { kind: 'fog' }, events);\n    }\n  } else {\n    fighter.fogTimer = 0;\n  }\n}",
    mustFail: ['(f) 🔴 a fighter OUTSIDE the ring 94%'],
    mustPass: ['(f) NON-VACUITY: the dancer', '(f) 🔴 …and the pot', '(f) CONTROL: one brush'],
  },
  {
    name: 'pot-reentry-resets',
    bug: 'move B4 REVERT — one frame off the pot restarts its clock (the dance takes nothing)',
    file: 'game/sim.ts',
    find: '      fighter.hazardTimers[idx] = fighter.hazardTimers[idx] ?? 0;',
    repl: '      fighter.hazardTimers[idx] = 0;',
    mustFail: ['(f) 🔴 …and the pot'],
    mustPass: ['(f) NON-VACUITY: the dancer', '(f) 🔴 a fighter OUTSIDE the ring 94%', '(f) CONTROL: one brush'],
  },
  {
    name: 'fog-reentry-decays',
    bug: 'move B4 WRONG FIX — the clock DECAYS while inside instead of holding (a 50% duty cycle would never tick)',
    file: 'game/sim.ts',
    find: "      applyDamage(state, fighter, FOG_DAMAGE, null, { kind: 'fog' }, events);\n    }\n  }\n}",
    repl: "      applyDamage(state, fighter, FOG_DAMAGE, null, { kind: 'fog' }, events);\n    }\n  } else {\n    fighter.fogTimer = Math.max(0, fighter.fogTimer - dt);\n  }\n}",
    mustFail: ['(f) 🔴 a fighter OUTSIDE the ring 94%'],
    mustPass: ['(f) CONTROL: one brush'],
  },
];

const IS_MAIN = process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (IS_MAIN) {
  const argv = process.argv.slice(2);
  if (argv.includes('--list')) {
    for (const a of ARMS) console.log(`${a.name.padEnd(24)} ${a.bug}`);
    process.exit(0);
  }
  if (argv.includes('--selftest')) {
    const noop = runArm({ ...ARMS[0], name: 'selftest-noop', repl: ARMS[0].find }, ROOT);
    const drift = runArm({ ...ARMS[0], name: 'selftest-drift', find: 'THIS ANCHOR EXISTS NOWHERE' }, ROOT);
    const okNoop = !noop.ok && noop.faults.some((f) => f.startsWith('known-bad NOT CAUGHT'));
    const okDrift = !drift.ok && drift.faults.some((f) => f.startsWith('anchor matched 0 times'));
    console.log(`${okNoop ? 'PASS' : 'FAIL'}  a no-op revert is reported NOT CAUGHT  (${noop.faults.length} faults)`);
    console.log(`${okDrift ? 'PASS' : 'FAIL'}  a drifted anchor FAULTS instead of running  (${drift.faults.join('; ')})`);
    // A COUNT LINE (T1b, 2026-10-16) — gatecount registers this selftest against it; two PASS lines
    // and no total cannot be diffed against a documented number.
    const nPass = [okNoop, okDrift].filter(Boolean).length;
    console.log(`\nb4_knownbad --selftest: ${nPass} passed, ${2 - nPass} failed`);
    process.exit(okNoop && okDrift ? 0 : 1);
  }
  const only = argv.includes('--arm') ? argv[argv.indexOf('--arm') + 1] : null;
  const arms = only ? ARMS.filter((a) => a.name === only) : ARMS;
  if (arms.length === 0) { console.log(`no arm named ${only}`); process.exit(2); }
  let bad = 0;
  for (const a of arms) {
    const r = runArm(a, ROOT);
    if (!r.ok) bad++;
    console.log(`${r.ok ? 'CAUGHT' : 'FAULT '}  ${a.name.padEnd(24)} ${a.bug}  — ${r.failed.length} row(s) red`);
    for (const f of r.faults) console.log(`          ${f}`);
  }
  console.log(`\nb4_knownbad: ${arms.length - bad}/${arms.length} arms caught by their own rows`);
  process.exitCode = bad ? 1 : 0;
}
