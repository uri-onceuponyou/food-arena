#!/usr/bin/env node
/**
 * b3_knownbad — every B3 bug-sweep fix, REVERTED on a scratch copy, must turn its own
 * `sim.test.mjs` rows red. (`docs/REVAMP.md` §5 B3, 2026-10-15.)
 *
 * `CLAUDE.md` #6: *"A guard that has not been shown to FAIL on the bug it guards against is not
 * a guard."* Each 🔴 row in §42 went red on `4dbf937` before its fix landed, and the commit says
 * so — but that evidence is a sentence in a log. This makes it re-runnable: each ARM copies
 * `src/` to a temp dir, applies ONE textual revert (the bug, or the wrong placement of the fix),
 * runs that copy's `sim.test.mjs`, and requires:
 *
 *   * every `mustFail` row to FAIL — the guard bites;
 *   * every `mustPass` row to PASS — the revert changed the experiment, not the fixture;
 *   * the patch to match EXACTLY ONCE — an anchor that drifted is a FAULT, never a silent no-op
 *     (`conceal_lab`'s wrong-attacker arm sat at 78/80 for six weeks on exactly that, CL-1).
 *
 * Rows are matched by PREFIX of their name, so a row's detail text can change freely.
 *
 *   node tools/tmp/b3_knownbad.mjs              # every arm
 *   node tools/tmp/b3_knownbad.mjs --arm aura-reset
 *   node tools/tmp/b3_knownbad.mjs --list
 *   node tools/tmp/b3_knownbad.mjs --selftest   # the harness shown to fail: a no-op revert, a drifted anchor
 *
 * Pure Node, writes only to the OS temp dir (removed after each arm). ~12 s per arm.
 */
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

export const ARMS = [
  {
    name: 'stun-item',
    bug: 'BH-06 — an applied stun does not cancel an item wind-up',
    file: 'game/combat.ts',
    find: "      if (target.itemCast !== null) {\n        cancelItemCast(target, 'stun', events);\n      }\n",
    repl: '',
    mustFail: [
      '(a) N=2 🔴 an applied stun CANCELS the item wind-up',
      '(a) N=6 🔴 an applied stun CANCELS the item wind-up',
      '(a) 🔴 a blow that STUNS AND KILLS reports the wind-up once',
    ],
    mustPass: ['(a) N=2 NON-VACUITY: a real press opened a Shiitake WIND-UP', '(a) N=2 CONTROL: the same wind-up, unstunned'],
  },
  {
    name: 'stun-item-placement',
    bug: 'BH-06 fix placed OUTSIDE the stunMs guard — cancels on a grace-refused stun',
    file: 'game/combat.ts',
    find: "      if (target.itemCast !== null) {\n        cancelItemCast(target, 'stun', events);\n      }\n    }\n  }",
    repl: "    }\n    if (effect === 'stun' && target.itemCast !== null) {\n      cancelItemCast(target, 'stun', events);\n    }\n  }",
    mustFail: ['(a) 🔴 a GRACE-REFUSED stun leaves the item wind-up OPEN'],
    mustPass: ['(a) N=2 🔴 an applied stun CANCELS the item wind-up', '(a) NON-VACUITY: the planted stun really is inside the grace window'],
  },
  {
    name: 'reflect-dealt',
    bug: 'BH-05 — Shiitake reflects the blow (dealt), not the HP lost',
    file: 'game/combat.ts',
    find: '      state, attacker, lost * ITEM_TUNING.shiitake.reflect, null,',
    repl: '      state, attacker, dealt * ITEM_TUNING.shiitake.reflect, null,',
    mustFail: ['(b) 🔴 a 12-damage blow into a 3-HP wearer reflects 3', '(b) 🔴 …so at N=3 the attacker SURVIVES'],
    mustPass: ['(b) CONTROL: a blow the wearer survives (50 HP) is reflected in full', '(b) NON-VACUITY: the shield is UP'],
  },
  {
    name: 'reflect-rings',
    bug: 'the mirror re-reflects (the `!isItemDamage` clause dropped) — the cited one-bounce row',
    file: 'game/combat.ts',
    find: "  if (!isItemDamage && source.kind === 'weapon' && attacker != null && attacker !== target\n      && lost > 0",
    repl: "  if (source.kind === 'weapon' && attacker != null && attacker !== target\n      && lost > 0",
    mustFail: ['(b) BOTH shields up, one blow: exactly TWO hit-landed'],
    mustPass: ['(b) CONTROL: a blow the wearer survives (50 HP) is reflected in full'],
  },
  {
    name: 'revive-flat',
    bug: 'BH-11 — Leftovers revive HP not level-scaled',
    file: 'game/combat.ts',
    find: 'ITEM_TUNING.leftovers.hp * levelHealthMultiplier(f.level));',
    repl: 'ITEM_TUNING.leftovers.hp);',
    mustFail: ['(c) N=4 🔴 at L15 the revive is a corpse', '(c) N=6 🔴 at L15 the revive is a corpse', '(c) 🔴 MIXED LEVELS'],
    mustPass: ['(c) CONTROL: at L1 it is exactly', '(c) N=4 NON-VACUITY'],
  },
  {
    name: 'revive-killer-level',
    bug: 'BH-11 fix keyed on the KILLER\'s level instead of the revived fighter\'s',
    file: 'game/combat.ts',
    find: 'ITEM_TUNING.leftovers.hp * levelHealthMultiplier(f.level));',
    repl: 'ITEM_TUNING.leftovers.hp * levelHealthMultiplier(killer.level));',
    mustFail: ['(c) 🔴 MIXED LEVELS'],
    mustPass: ['(c) N=4 🔴 at L15 the revive is a corpse', '(c) CONTROL: at L1 it is exactly'],
  },
  {
    name: 'revive-aura-clock',
    bug: 'the revive leaves Blue Cheese clocks banked on the corpse',
    file: 'game/combat.ts',
    find: '    f.item.auraTimers.length = 0;\n',
    repl: '',
    mustFail: ['(c) a revived fighter\'s accumulators are cleared'],
    mustPass: ['(c) N=4 NON-VACUITY'],
  },
  {
    name: 'loadout-in',
    bug: 'META-09 — `in` walks Object.prototype',
    file: 'game/state.ts',
    find: '    if (!Object.hasOwn(ITEMS, it)) {',
    repl: '    if (!(it in ITEMS)) {',
    mustFail: ['(d) 🔴 EVERY Object.prototype name is REFUSED', '(d) 🔴 …on a six-seat bot slot too'],
    mustPass: ['(d) CONTROL: the N=6 call with a REAL item', '(d) CONTROL: every REAL id is still accepted'],
  },
  {
    name: 'aura-missing',
    bug: 'BH-07 — the aura block absent (the shipped state until 83754a9)',
    file: 'game/sim.ts',
    find: "  if (hasItem(fighter, 'blue_cheese')) {",
    repl: "  if (hasItem(fighter, 'blue_cheese') && false) {",
    mustFail: [
      '(e) 🔴 EVERY opponent inside the cloud is hurt',
      '(e) 🔴 …ONE TICK PER `ITEM_AURA_TICK_MS`',
      '(e) 🔴 at L15 a tick is STILL `dps`',
      '(e) 🔴 a BOT wearing Blue Cheese hurts the opponent in its cloud with NO PRESS',
      '(e) the cloud is the LIVING wearer\'s',
    ],
    mustPass: ['(e) NON-VACUITY: slot 0 wears it', '(e) CONTROL: the same board with NO item hurts nobody'],
  },
  {
    name: 'aura-reset',
    bug: 'BH-07 clock reset to zero instead of carrying the overshoot (0.984 dps)',
    file: 'game/sim.ts',
    find: '        if (due) t -= ITEM_AURA_TICK_MS;',
    repl: '        if (due) t = 0;',
    mustFail: ['(e) 🔴 …and it HOLDS'],
    mustPass: ['(e) 🔴 EVERY opponent inside the cloud is hurt'],
  },
  {
    name: 'item-displaces',
    bug: 'an ITEM-sourced hit displaces (the `!isItemDamage` guard dropped) — cited "§42"',
    file: 'game/combat.ts',
    find: "  if (attacker != null && source.kind === 'weapon' && !isItemDamage) {",
    repl: "  if (attacker != null && source.kind === 'weapon') {",
    mustFail: ['(f) 🔴 …and the SAME key on an ITEM hit displaces nobody'],
    mustPass: ['(f) CONTROL: that weapon key, as a WEAPON hit, really lures'],
  },
];

/** Run one arm. Returns { name, ok, faults[], failed[] }. */
export function runArm(arm, root = ROOT) {
  const faults = [];
  const dir = mkdtempSync(join(tmpdir(), 'b3kb-'));
  try {
    cpSync(join(root, 'src'), join(dir, 'src'), { recursive: true });
    if (existsSync(join(root, 'node_modules'))) symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'));
    const f = join(dir, 'src', arm.file);
    const s = readFileSync(f, 'utf8');
    const n = s.split(arm.find).length - 1;
    if (n !== 1) return { name: arm.name, ok: false, faults: [`anchor matched ${n} times in ${arm.file} (must be exactly 1)`], failed: [] };
    writeFileSync(f, s.replace(arm.find, arm.repl));
    let out;
    try { out = execFileSync('node', [join(dir, 'src/game/sim.test.mjs')], { encoding: 'utf8', maxBuffer: 1 << 28 }); }
    catch (e) { out = e.stdout ?? ''; }
    const rows = out.split('\n').map((l) => l.match(/^ {2}(ok|FAIL) - (.*)$/)).filter(Boolean).map((m) => ({ ok: m[1] === 'ok', name: m[2] }));
    if (rows.length === 0) faults.push('the patched sim.test printed no rows (crash?)');
    const find = (prefix) => rows.filter((r) => r.name.startsWith(prefix));
    for (const p of arm.mustFail) {
      const hit = find(p);
      if (hit.length === 0) faults.push(`mustFail row not found: "${p}"`);
      else if (hit.some((r) => r.ok)) faults.push(`known-bad NOT CAUGHT: "${p}" stayed green`);
    }
    for (const p of arm.mustPass) {
      const hit = find(p);
      if (hit.length === 0) faults.push(`mustPass row not found: "${p}"`);
      else if (hit.some((r) => !r.ok)) faults.push(`control went red: "${p}" — the revert changed the fixture, not the rule`);
    }
    return { name: arm.name, ok: faults.length === 0, faults, failed: rows.filter((r) => !r.ok).map((r) => r.name) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (IS_MAIN) {
  const argv = process.argv.slice(2);
  if (argv.includes('--list')) {
    for (const a of ARMS) console.log(`${a.name.padEnd(22)} ${a.bug}`);
    process.exit(0);
  }
  if (argv.includes('--selftest')) {
    // The harness is an instrument too, so it is shown to FAIL: a revert that changes nothing
    // must be reported NOT CAUGHT, and an anchor that matches nothing must FAULT rather than run.
    const noop = runArm({ ...ARMS[0], name: 'selftest-noop', repl: ARMS[0].find });
    const drift = runArm({ ...ARMS[0], name: 'selftest-drift', find: 'THIS ANCHOR EXISTS NOWHERE' });
    const okNoop = !noop.ok && noop.faults.some((f) => f.startsWith('known-bad NOT CAUGHT'));
    const okDrift = !drift.ok && drift.faults.some((f) => f.startsWith('anchor matched 0 times'));
    console.log(`${okNoop ? 'PASS' : 'FAIL'}  a no-op revert is reported NOT CAUGHT  (${noop.faults.length} faults)`);
    console.log(`${okDrift ? 'PASS' : 'FAIL'}  a drifted anchor FAULTS instead of running  (${drift.faults.join('; ')})`);
    process.exit(okNoop && okDrift ? 0 : 1);
  }
  const only = argv.includes('--arm') ? argv[argv.indexOf('--arm') + 1] : null;
  const arms = only ? ARMS.filter((a) => a.name === only) : ARMS;
  if (arms.length === 0) { console.log(`no arm named ${only}`); process.exit(2); }
  let bad = 0;
  for (const a of arms) {
    const r = runArm(a);
    if (!r.ok) bad++;
    console.log(`${r.ok ? 'CAUGHT' : 'FAULT '}  ${a.name.padEnd(22)} ${a.bug}  — ${r.failed.length} row(s) red`);
    for (const f of r.faults) console.log(`          ${f}`);
  }
  console.log(`\nb3_knownbad: ${arms.length - bad}/${arms.length} arms caught by their own rows`);
  process.exitCode = bad ? 1 : 0;
}
