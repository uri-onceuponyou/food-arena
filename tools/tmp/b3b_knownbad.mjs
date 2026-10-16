#!/usr/bin/env node
/**
 * b3b_knownbad — every B3b fix, REVERTED on a scratch copy of `src/`, must turn its own
 * `sim.test.mjs` §46 rows red while its controls stay green (`docs/REVAMP.md` §5, B3b,
 * 2026-10-15). Owner of the `b3b_` prefix.
 *
 * `CLAUDE.md` #6: *"A guard that has not been shown to FAIL on the bug it guards against is not
 * a guard."* Each 🔴 row in §46 went red on `d46f750` before its fix landed and the commits say
 * so; this makes that claim re-runnable. The engine is B3's `tools/tmp/b3_knownbad.mjs:runArm`
 * (imported, not copied): one textual substitution per arm, asserted to match EXACTLY ONCE, the
 * real suite run against the copy, rows matched by name prefix.
 *
 * ⚠️ BH-09 IS TWO MECHANISMS, SO IT HAS AN ARM PER MECHANISM AND ONE FOR THE ORIGINAL BUG. The
 * total clamp (`movement.ts:lureFighter`) and the live anchor (`stepPush`) each hold rows the
 * other cannot, and the "never through the bait" rows are held by BOTH — which is exactly why
 * reverting one alone must leave those green (the `mustPass` lists say which) and only the
 * `pre-fix` arm, the literal shipped code, turns them all red.
 *
 * Not here: U1's HUD half (`tools/tmp/b3b_hud_tray.mjs`, a browser test — 12 rows red on
 * `d46f750`) and QUIET-1 (`tools/tmp/b3b_audio.mjs --root <base>`), which are not sim rows.
 *
 *   node tools/tmp/b3b_knownbad.mjs                 # every arm (~15 s each)
 *   node tools/tmp/b3b_knownbad.mjs --arm pre-fix
 *   node tools/tmp/b3b_knownbad.mjs --list
 *   node tools/tmp/b3b_knownbad.mjs --selftest      # the rig shown to fail: a no-op revert, a drifted anchor
 */
import { resolve } from 'node:path';
import { runArm } from './b3_knownbad.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

export const ARMS = [
  // ── U1 ─────────────────────────────────────────────────────────────────────────
  {
    name: 'refusal-order',
    bug: 'U1 — weaponRefusal names the clog before sleep (wrong reason while both hold)',
    file: 'game/combat.ts',
    find: "  if (actionsLocked(f, now)) return 'asleep';\n  if (weaponsLocked(f, now)) return 'clogged';",
    repl: "  if (now < f.item.clogUntil) return 'clogged';\n  if (actionsLocked(f, now)) return 'asleep';",
    mustFail: ['(a) 🔴 every refusal is NAMED'],
    mustPass: ['(a) 🔴 …and it AGREES with `attemptAttack`', '(a) CONTROL: a refused press spends nothing'],
  },
  {
    name: 'refusal-drift',
    bug: 'U1 — attemptAttack drifts from weaponRefusal (it stops refusing a second cast)',
    file: 'game/combat.ts',
    find: '  if (weaponRefusal(state, attacker, weaponIndex) !== null) return false;',
    repl: "  { const why = weaponRefusal(state, attacker, weaponIndex); if (why !== null && why !== 'casting') return false; }",
    mustFail: ['(a) 🔴 …and it AGREES with `attemptAttack`'],
    mustPass: ['(a) 🔴 every refusal is NAMED', '(a) 🔴 `weaponUsable` is exactly'],
  },
  // ── BH-04 ──────────────────────────────────────────────────────────────────────
  {
    name: 'aim-nearest',
    bug: 'BH-04 — a human\'s shot framed on the NEAREST opponent (the shipped bug)',
    file: 'game/combat.ts',
    find: "  const frame = attacker.controller === 'human' ? (aimedLivingOpponent(state, attacker) ?? target) : target;",
    repl: '  const frame = target;',
    mustFail: [
      '(b) 🔴 a HOMING shot aimed at C',
      '(b) 🔴 a homing shot flies PAST a bystander',
      '(b) 🔴 …and with B RUNNING alongside',
      '(b) 🔴 a fleeing AIMED target',
    ],
    mustPass: ['(b) NON-VACUITY: six seats', '(b) CONTROL: a BOT', '(b) CONTROL: at TWO seats', '(b) CONTROL: nobody in front'],
  },
  {
    name: 'aim-bots-too',
    bug: 'BH-04 over-fix — the aim rule applied to BOTS too (the AI corpora would move)',
    file: 'game/combat.ts',
    find: "  const frame = attacker.controller === 'human' ? (aimedLivingOpponent(state, attacker) ?? target) : target;",
    repl: '  const frame = aimedLivingOpponent(state, attacker) ?? target;',
    mustFail: ["(b) CONTROL: a BOT's shot is still framed on its NEAREST"],
    mustPass: ['(b) 🔴 a HOMING shot aimed at C', '(b) 🔴 a fleeing AIMED target'],
  },
  {
    name: 'aim-no-front',
    bug: 'BH-04 — the in-front filter dropped: a shot "aimed" at someone behind the shooter',
    file: 'game/state.ts',
    find: '    if (fx * vx + fy * vy < 0) continue; // behind the aim\n',
    repl: '',
    mustFail: ['(b) CONTROL: nobody in front → the NEAREST'],
    mustPass: ['(b) 🔴 a HOMING shot aimed at C', '(b) CONTROL: two on the aim line'],
  },
  // ── BH-03 ──────────────────────────────────────────────────────────────────────
  {
    name: 'swing-unboosted',
    bug: 'BH-03 — the melee path ignores trailBoosted (the shipped bug, with the flag declared for one swing)',
    file: 'game/combat.ts',
    find: '    const swingDamage = trailBoostedDamage(state, attacker, w);',
    repl: '    const swingDamage = w.damage;',
    mustFail: ['(c) 🔴 a SWING declared trail-boosted'],
    mustPass: ['(c) 🔴 on its own trail, every weapon lands EXACTLY', '(c) CONTROL: the SHIPPED Ring lands its base damage', '(c) NON-VACUITY'],
  },
  {
    name: 'ring-flagged',
    bug: 'BH-03 half-fix — the swing honours the flag but Ring still declares it (shipped balance moves)',
    file: 'game/rules.ts',
    find: "cone: 160, color: '#FF6FA5', effect: null, emoji: '🍩' },",
    repl: "cone: 160, color: '#FF6FA5', effect: null, trailBoosted: true, emoji: '🍩' },",
    mustFail: ['(c) CONTROL: the SHIPPED Ring lands its base damage'],
    mustPass: ['(c) 🔴 on its own trail, every weapon lands EXACTLY', '(c) 🔴 a SWING declared trail-boosted'],
  },
  // ── BH-09 ──────────────────────────────────────────────────────────────────────
  {
    name: 'no-total-clamp',
    bug: 'BH-09 — the total owed pull is not clamped (the live anchor alone still stops a crossing)',
    file: 'game/movement.ts',
    find: '  if (p.remaining > sep) p.remaining = sep;\n',
    repl: '',
    mustFail: ['(d) 🔴 three pellets in one tick', '(c) …and the near fighter is owed its SEPARATION'],
    mustPass: ['(d) 🔴 several pellets owe a bystander', '(d) 🔴 a bait that walks INTO the pull', '(c) 🔴 a pull never overshoots its anchor'],
  },
  {
    name: 'no-live-anchor',
    bug: 'BH-09 — the pull is spent toward where the bait STOOD (the total clamp alone)',
    file: 'game/movement.ts',
    find: '  if (p.anchor !== NO_FIGHTER && fighters !== undefined) {',
    repl: '  if (false) {',
    mustFail: ['(d) 🔴 …nor when a later pellet hooks the BYSTANDER', '(d) 🔴 a bait that walks INTO the pull'],
    mustPass: ['(d) 🔴 several pellets owe a bystander', '(d) 🔴 three pellets in one tick', '(c) 🔴 a pull never overshoots its anchor'],
  },
  {
    name: 'pre-fix',
    bug: 'BH-09 — the shipped code: each pull clamped, the total not, no anchor',
    file: 'game/combat.ts',
    find: '      lureFighter(victim, target, lure);',
    repl: '      displaceFighter(victim, target.x - victim.x, target.y - victim.y, Math.min(lure, Math.hypot(target.x - victim.x, target.y - victim.y)));',
    mustFail: [
      '(d) 🔴 several pellets owe a bystander',
      '(d) 🔴 …nor when a later pellet hooks the BYSTANDER',
      '(d) 🔴 three pellets in one tick',
      '(d) 🔴 a bait that walks INTO the pull',
    ],
    mustPass: ['(d) CONTROL: a STILL bait and one pellet', '(c) …and the near fighter is owed its SEPARATION', '(c) 🔴 a pull never overshoots its anchor'],
  },
];

const IS_MAIN = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_MAIN) {
  const argv = process.argv.slice(2);
  if (argv.includes('--list')) {
    for (const a of ARMS) console.log(`${a.name.padEnd(16)} ${a.bug}`);
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
    console.log(`\nb3b_knownbad --selftest: ${nPass} passed, ${2 - nPass} failed`);
    process.exit(okNoop && okDrift ? 0 : 1);
  }
  const only = argv.includes('--arm') ? argv[argv.indexOf('--arm') + 1] : null;
  const arms = only ? ARMS.filter((a) => a.name === only) : ARMS;
  if (arms.length === 0) { console.log(`no arm named ${only}`); process.exit(2); }
  let bad = 0;
  for (const a of arms) {
    const r = runArm(a, ROOT);
    if (!r.ok) bad++;
    console.log(`${r.ok ? 'CAUGHT' : 'FAULT '}  ${a.name.padEnd(16)} ${a.bug}  — ${r.failed.length} row(s) red`);
    for (const f of r.faults) console.log(`          ${f}`);
  }
  console.log(`\nb3b_knownbad: ${arms.length - bad}/${arms.length} arms caught by their own rows`);
  process.exitCode = bad ? 1 : 0;
}
