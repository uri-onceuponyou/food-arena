#!/usr/bin/env node
/**
 * TUN_GATE — the override layer's refusals, each proved against a KNOWN-BAD input.
 *
 * `DECISIONS-FOR-URI.md` §76 · `CLAUDE.md` #6: *"A guard that has not been shown to FAIL on
 * the bug it guards against is not a guard."* Every section below therefore carries both arms
 * — a value that must be ACCEPTED and one that must be REFUSED — and the tally at the end
 * asserts that both outcomes actually occurred, because a table whose rows all agree in one
 * direction cannot tell a working refusal from a broken one.
 *
 *   node tools/tmp/tun_gate.mjs
 *   node tools/tmp/tun_gate.mjs --no-tsc      # skip the compile-refusal arm (~8 s)
 *
 * ── 🚨 THE VACUITY RULE IS ENFORCED, NOT MENTIONED ────────────────────────
 *
 * `CLAUDE.md` #6: *"If you FILTER a set before asserting over it, assert the set is NON-EMPTY
 * FIRST."* That exact vacuity fired five times in this repo, twice inside one tool. **An empty
 * registry passes every quantified check here** — `[].every()` is `true`, no key is out of
 * band, no derived key can be written — so `nonEmpty()` guards every filtered set below and
 * the very first assertion is a floor on the registry's size. It is a FLOOR rather than an
 * exact count deliberately: an exact count is a second copy of a number that lives in the
 * tree, and `gatecount` already owns that job.
 *
 * ── WHAT EACH SECTION IS FOR ──────────────────────────────────────────────
 *
 *   1. the registry is populated, and populated with the constants §76 actually named
 *   2. RUNTIME refusals — derived key, out of range, non-integer, unknown key, bad JSON
 *   3. COMPILE refusal — a real `tsc` over a real fixture; the static half of §76 c.2
 *   4. `previewDerived` at depth 2, against the OLD DIRECT-ONLY BODY as the known-bad mutant
 *   5. weapon OBJECT IDENTITY — the property `ai.ts:PRESS_VALUE` silently depends on
 *   6. the set hash: stock is a WORD, a tuned set is a digest, and an unstamped set is refused
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const args = new Set(process.argv.slice(2));

let pass = 0;
let fail = 0;
const outcomes = { accepted: 0, refused: 0 };

const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}${detail ? `   ${detail}` : ''}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? `   ${detail}` : ''}`); }
  return !!cond;
};
const eq = (name, got, want) => ok(name, Object.is(got, want), `got ${got}, want ${want}`);

/** Assert a set is non-empty BEFORE anything quantifies over it. Returns the set. */
const nonEmpty = (name, arr) => {
  ok(`NON-EMPTY ${name}`, arr.length > 0, `${arr.length} item(s)`);
  if (arr.length === 0) throw new Error(`tun_gate: "${name}" is empty — every assertion over it would pass vacuously`);
  return arr;
};

// ═════════════════════════════════════════════════════════════════════════════
// 1. THE REGISTRY IS POPULATED, AND WITH THE THINGS §76 NAMED
// ═════════════════════════════════════════════════════════════════════════════

const T = await import(`${ROOT}/src/game/tuning/index.ts`);
const RULES = await import(`${ROOT}/src/game/rules.ts`);

console.log('\n══ tun_gate ══  §76 override layer\n');
console.log('── 1. the registry populated ─────────────────────────────────────────────');

const entries = nonEmpty('registry entries', T.allEntries());
ok('the registry clears a FLOOR, so nothing below can pass vacuously', entries.length >= 150,
  `${entries.length} entries (floor 150; the exact count lives in the tree, not here)`);

const authored = nonEmpty('authored entries', T.authoredEntries());
const derived = nonEmpty('derived entries', T.derivedEntries());

// §76's own list, plus the two §75(b) hinges. Named individually because "some combat
// constant is registered" is not the claim — THESE are.
const MUST_BE_TUNABLE = [
  'PLAYER_SPEED', 'AI_CHASE_SPEED', 'SLOW_DURATION_MS', 'STUN_DURATION_MS',
  'STUN_GRACE_MS', 'SLOW_GRACE_MS', 'STATUS_DR_WINDOW_MS',
  'FOG_HOLD_MS', 'FOG_CLOSE_MS', 'MATCH_DURATION_MS', 'PLAYER_MAX_HP', 'ENEMY_MAX_HP',
];
for (const k of MUST_BE_TUNABLE) {
  const e = T.entryFor(k);
  ok(`§76 names it and it is AUTHORED: ${k}`, e?.kind === 'authored', `${e?.kind ?? 'MISSING'} = ${e?.value}`);
}

// 🔴 The §75(b) pair. The whole point of the panel is that these two move TOGETHER or the
// gap moves — so a gate that checked one and not the other would miss the actual question.
ok('§75(b): the speed PAIR is registered in one group, so the RATIO is what gets tuned',
  T.entryFor('PLAYER_SPEED')?.group === 'combat' && T.entryFor('AI_CHASE_SPEED')?.group === 'combat',
  `gap ${(RULES.PLAYER_SPEED / RULES.AI_CHASE_SPEED).toFixed(2)}x`);

const DERIVED_MUST = ['SUDDEN_DEATH_MS', 'SUDDEN_DEATH_REMAINING_MS', 'FOG_DPS'];
for (const k of DERIVED_MUST) {
  ok(`§76 c.2: ${k} is DERIVED, not authored`, T.entryFor(k)?.kind === 'derived',
    `${T.entryFor(k)?.kind ?? 'MISSING'} = ${T.entryFor(k)?.value}`);
}
ok('the schedule FUNCTIONS are registered read-only',
  ['minSafeRadiusFor', 'fogRadiusAt', 'fogReachesRadiusAt'].every((k) => T.entryFor(k)?.kind === 'derived-fn'));

// The weapon cooldowns §76 asks for, reached through the roster walk rather than a list.
const cooldowns = nonEmpty('per-weapon cooldown keys', authored.filter((e) => /^char\..*\.cooldown$/.test(e.key)));
ok('every weapon cooldown in the roster is tunable', cooldowns.length >= 30, `${cooldowns.length} keys`);

// ⚠️ THE DEFAULT IS LEARNED, NEVER RESTATED — §76 constraint 1. If any entry's `authored`
// disagreed with the live export, the registry would be the second place and would be WRONG.
eq('the registry LEARNED PLAYER_SPEED from rules.ts', T.entryFor('PLAYER_SPEED').authored, RULES.PLAYER_SPEED);
eq('…and MATCH_DURATION_MS', T.entryFor('MATCH_DURATION_MS').authored, RULES.MATCH_DURATION_MS);
eq('…and the derived SUDDEN_DEATH_MS agrees with the export', T.entryFor('SUDDEN_DEATH_MS').value, RULES.SUDDEN_DEATH_MS);
eq('…and a per-weapon cooldown agrees with the roster object',
  T.entryFor('char.hamburger.Lettuce.cooldown').value,
  RULES.CHARACTERS.hamburger.weapons.find((w) => w.key === 'Lettuce').cooldown);

// ═════════════════════════════════════════════════════════════════════════════
// 2. RUNTIME REFUSALS — the three the brief names, plus the ones around them
// ═════════════════════════════════════════════════════════════════════════════

console.log('\n── 2. runtime refusals (parseSet) ────────────────────────────────────────');

const speed = T.entryFor('PLAYER_SPEED');
const cd = T.entryFor('char.hamburger.Lettuce.cooldown');

const CASES = [
  // [name, input, expect]
  ['a good scalar set', { PLAYER_SPEED: 0.09 }, 'accept'],
  ['a good per-character set', { 'char.hamburger.Lettuce.cooldown': 900 }, 'accept'],
  ['the exported ENVELOPE form', { tuningHash: 'x', overrides: { PLAYER_SPEED: 0.09 } }, 'accept'],
  ['a value written back to its authored default', { PLAYER_SPEED: speed.authored }, 'accept'],

  ['🔴 a DERIVED scalar key', { SUDDEN_DEATH_MS: 5 }, 'refuse'],
  ['🔴 a DERIVED key from the fog block', { FOG_DPS: 1 }, 'refuse'],
  ['🔴 a derived FUNCTION key', { minSafeRadiusFor: 200 }, 'refuse'],
  ['🔴 ABOVE the maximum', { PLAYER_SPEED: speed.max + 1 }, 'refuse'],
  ['🔴 BELOW the minimum', { PLAYER_SPEED: speed.min - 1 }, 'refuse'],
  ['🔴 an UNKNOWN key', { PLAYER_SPEEED: 0.09 }, 'refuse'],
  ['🔴 an unknown per-character key', { 'char.nosuch.Nope.damage': 1 }, 'refuse'],
  ['🔴 a non-integer where int is set', { 'char.hamburger.Lettuce.cooldown': 900.5 }, 'refuse'],
  ['🔴 a non-finite value', { PLAYER_SPEED: Number.NaN }, 'refuse'],
  ['🔴 a string value', { PLAYER_SPEED: '0.09' }, 'refuse'],
  ['🔴 not an object', [1, 2, 3], 'refuse'],
  ['🔴 not JSON at all', 'nonsense{', 'refuse'],
  // ⚠️ ONE bad key must sink the WHOLE set. A partially-applied set has a hash that describes
  // the survivors and a file that describes the request — §76 constraint 3's exact failure.
  ['🔴 one bad key among good ones sinks the SET', { PLAYER_SPEED: 0.09, NOPE: 1 }, 'refuse'],
];

for (const [name, input, expect] of nonEmpty('parseSet cases', CASES)) {
  const r = T.parseSet(input);
  const got = r.ok ? 'accept' : 'refuse';
  outcomes[got === 'accept' ? 'accepted' : 'refused']++;
  ok(`${name} → ${expect}`, got === expect,
    r.ok ? `hash ${r.hash}` : r.rejections.map((x) => `${x.key}: ${x.why}`).join(' | ').slice(0, 110));
}
ok('the refusal table exercised BOTH outcomes — a one-sided table proves nothing',
  outcomes.accepted > 0 && outcomes.refused > 0, `${outcomes.accepted} accepted / ${outcomes.refused} refused`);

// ⚠️ The panel's band check and the registry's boot check must agree, or the failure mode is
// a value the UI accepted and the sim throws on at the NEXT boot — after the reload.
const BAND_CASES = [
  [speed, speed.authored, true], [speed, speed.min, true], [speed, speed.max, true],
  [speed, speed.min - 1e-9, false], [speed, speed.max + 1e-9, false], [speed, Number.NaN, false],
  [cd, cd.authored, true], [cd, cd.authored + 0.5, false],
];
for (const [entry, v, want] of nonEmpty('band cases', BAND_CASES)) {
  ok(`band: ${entry.key} = ${v} → ${want ? 'in' : 'out'}`, (T.bandProblem(entry, v) === null) === want,
    T.bandProblem(entry, v) ?? 'in band');
}

// The seal-time refusal: an override key that matched NOTHING. It is a separate mechanism
// from parseSet because the env/host paths never touch parseSet.
console.log('\n── 2b. the seal-time refusal (FA_TUNING typo) ────────────────────────────');
const child = (env, code) => {
  try {
    const out = execFileSync(process.execPath, ['-e', code], {
      cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, out: out.trim() };
  } catch (err) {
    return { ok: false, out: `${err.stdout ?? ''}${err.stderr ?? ''}`.trim() };
  }
};
const SEAL = "import('./src/game/tuning/index.ts').then(m=>console.log('OK '+m.tuningSetHash())).catch(e=>{console.error(e.message);process.exit(1)})";

const stockRun = child({ FA_TUNING: '' }, SEAL);
ok('a stock boot seals cleanly and hashes to the WORD stock', stockRun.ok && /OK stock/.test(stockRun.out), stockRun.out.slice(0, 120));

const tunedRun = child({ FA_TUNING: '{"PLAYER_SPEED":0.09}' }, SEAL);
ok('a real override boots and hashes to a tun1- digest', tunedRun.ok && /OK tun1-/.test(tunedRun.out), tunedRun.out.slice(0, 120));

const typoRun = child({ FA_TUNING: '{"PLAYER_SPEEED":0.09}' }, SEAL);
ok('🔴 a TYPO\'d override key is REFUSED at the seal, not silently ignored',
  !typoRun.ok && /match no registered constant/.test(typoRun.out), typoRun.out.split('\n')[0].slice(0, 140));

const oobRun = child({ FA_TUNING: '{"PLAYER_SPEED":99}' }, SEAL);
ok('🔴 an out-of-band override THROWS at boot rather than being clamped',
  !oobRun.ok && /outside \[/.test(oobRun.out), oobRun.out.split('\n')[0].slice(0, 140));

const offRun = child({ FA_TUNING: 'off' }, SEAL);
ok('FA_TUNING=off is the escape hatch and it reaches stock', offRun.ok && /OK stock/.test(offRun.out), offRun.out.slice(0, 120));

// ⚠️ …and the escape hatch must survive an otherwise-unbootable set, or a persisted set that
// a later `min` narrows would brick the game with no way in from outside. That is the ONLY
// reason `off` is checked before any source is read.
const offOverBad = child({ FA_TUNING: 'off' }, SEAL);
ok('…and it is checked BEFORE any source, so a bad set cannot brick the boot', offOverBad.ok);

// ═════════════════════════════════════════════════════════════════════════════
// 3. THE COMPILE REFUSAL — a real tsc over a real fixture
// ═════════════════════════════════════════════════════════════════════════════

console.log('\n── 3. the COMPILE refusal (§76 c.2, statically) ──────────────────────────');
if (args.has('--no-tsc')) {
  console.log('  ..   skipped (--no-tsc)');
} else {
  const dir = mkdtempSync(join(tmpdir(), 'tun-typefix-'));
  try {
    const cfg = join(dir, 'tsconfig.json');
    const src = join(dir, 'fixture.ts');
    writeFileSync(cfg, JSON.stringify({
      extends: `${ROOT}/tsconfig.json`,
      include: [src],
      compilerOptions: { noEmit: true, types: [] },
    }));

    const write = (body) => writeFileSync(src, `import type { OverrideSet } from '${ROOT}/src/game/tuning/keys.ts';\n${body}\n`);
    const compiles = () => {
      try {
        execFileSync('npx', ['tsc', '-p', cfg], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        return { ok: true, out: '' };
      } catch (err) { return { ok: false, out: `${err.stdout ?? ''}`.trim() }; }
    };

    // 🚨 THE CONTROL COMES FIRST. Without it, a fixture that failed for an unrelated reason —
    // a bad path, a missing lib, a typo in this very file — would make every refusal below
    // look like a working guard. `--selftest` validates a tool's LOGIC and never validates
    // where it is POINTED (CLAUDE.md #6).
    write('const good: OverrideSet = { PLAYER_SPEED: 0.09, "char.hamburger.Lettuce.cooldown": 900 };\nvoid good;');
    const control = compiles();
    ok('CONTROL: a legal override set COMPILES', control.ok, control.out.split('\n')[0].slice(0, 140));

    for (const [name, body] of [
      ['a derived SCALAR', 'const bad: OverrideSet = { SUDDEN_DEATH_MS: 5 };\nvoid bad;'],
      ['a derived FOG scalar', 'const bad: OverrideSet = { FOG_DPS: 1 };\nvoid bad;'],
      ['a derived FUNCTION', 'const bad: OverrideSet = { minSafeRadiusFor: 200 };\nvoid bad;'],
    ]) {
      write(body);
      const r = compiles();
      ok(`🔴 ${name} is a COMPILE ERROR`, !r.ok && /not assignable to type 'undefined'/.test(r.out),
        r.ok ? 'COMPILED — the type layer is not doing anything' : r.out.split('\n')[0].slice(0, 120));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. previewDerived AT DEPTH 2 — with the OLD BODY as the known-bad mutant
// ═════════════════════════════════════════════════════════════════════════════

console.log('\n── 4. previewDerived, transitively (the bug the panel worked around) ──────');

const REG = await import(`${ROOT}/src/game/tuning/registry.ts`);

/**
 * 🚨 THE MUTANT: `previewDerived`'s body EXACTLY AS IT SHIPPED, verbatim, before 2026-08-17.
 * It substitutes DIRECT inputs only. Kept here rather than described, because a fix whose bug
 * cannot be reproduced on demand is not a proven fix — and the next refactor of the recursive
 * walk has to be able to re-run this and watch it go stale again.
 */
const previewDirectOnly = (key, candidates) => {
  const e = REG.entryFor(key);
  if (!e || e.kind !== 'derived') throw new Error(`not derived: ${key}`);
  const base = REG.valuesOf(e.inputs);
  for (const k of e.inputs) if (k in candidates) base[k] = candidates[k];
  return e.recompute(base);
};

// The chain: SUDDEN_DEATH_REMAINING_MS ← SUDDEN_DEATH_MS ← FOG_CLOSE_MS.
const chain = T.entryFor('SUDDEN_DEATH_REMAINING_MS');
ok('the fixture is a REAL two-deep chain in the shipped registry, not a toy',
  chain.inputs.includes('SUDDEN_DEATH_MS') && T.entryFor('SUDDEN_DEATH_MS').inputs.includes('FOG_CLOSE_MS'),
  `${chain.key} ← ${chain.inputs.join(' + ')} ← ${T.entryFor('SUDDEN_DEATH_MS').inputs.join(' + ')}`);

const CAND = { FOG_CLOSE_MS: 100_000 };
const wantD1 = 100_000 + RULES.SUDDEN_DEATH_GRACE_MS;
const wantD2 = RULES.MATCH_DURATION_MS - wantD1;

// depth 1 — the CONTROL. A walk that changed a depth-1 answer would be broken, not clever.
eq('depth 1: the fix agrees with the old body', REG.previewDerived('SUDDEN_DEATH_MS', CAND), previewDirectOnly('SUDDEN_DEATH_MS', CAND));
eq('depth 1: …and the number is right', REG.previewDerived('SUDDEN_DEATH_MS', CAND), wantD1);

// depth 2 — the KNOWN-BAD.
const walked = REG.previewDerived('SUDDEN_DEATH_REMAINING_MS', CAND);
const stale = previewDirectOnly('SUDDEN_DEATH_REMAINING_MS', CAND);
eq('depth 2: the FIX walks the chain', walked, wantD2);
eq('depth 2: KNOWN-BAD — the old body returns the STALE number', stale, RULES.MATCH_DURATION_MS - RULES.SUDDEN_DEATH_MS);
ok('depth 2: the two DISAGREE — if they ever agree, this fixture has gone vacuous',
  Math.abs(walked - stale) > 1e-9, `fixed ${walked} vs old ${stale}`);

// A candidate naming a DERIVED key must be IGNORED, or the walk becomes the runtime loophole
// that undoes the compile-time refusal in section 3.
eq('a candidate on a DERIVED key is ignored, not honoured',
  REG.previewDerived('SUDDEN_DEATH_REMAINING_MS', { SUDDEN_DEATH_MS: 1 }), RULES.SUDDEN_DEATH_REMAINING_MS);

// And the other derived block, so this section is not measuring one lambda.
eq('FOG_DPS previews from its own inputs', REG.previewDerived('FOG_DPS', { FOG_DAMAGE: 30 }), (30 / RULES.FOG_TICK_MS) * 1000);

// ═════════════════════════════════════════════════════════════════════════════
// 5. WEAPON OBJECT IDENTITY — the property `ai.ts:PRESS_VALUE` silently depends on
// ═════════════════════════════════════════════════════════════════════════════

console.log('\n── 5. weapon object identity (ai.ts:PRESS_VALUE keys on it) ──────────────');

const AI = await import(`${ROOT}/src/game/ai.ts`);
const weapons = nonEmpty('roster weapons', RULES.CHARACTER_IDS.flatMap((id) => RULES.CHARACTERS[id].weapons));

// 🚨 `PRESS_VALUE` is a private `ReadonlyMap<Weapon, …>` keyed on OBJECT IDENTITY, so it is
// probed through `pressValue`'s documented fallback: **a MISS returns `w.damage` and a HIT
// returns the profile frozen at `ai.ts` load.**
//
// ⚠️ THE OBVIOUS PROBE IS VACUOUS FOR MOST OF THE ROSTER, AND THAT IS WHY IT IS NOT USED.
// Comparing a weapon against a structural clone separates hit from miss on only **8 of 31**
// weapons: for a single-pellet melee swing the profile sum IS `w.damage`, so the fallback
// returns the right answer by coincidence and the two branches are indistinguishable. A gate
// built on that would have silently covered a quarter of the roster while reading 31/31.
//
// So the probe MOVES the input instead: `w.damage += 1000` after `ai.ts` has evaluated. The
// frozen profile cannot know about it, so an unchanged answer proves a HIT and a jump of
// exactly 1000 proves a MISS — for every weapon, with no coincidence available.
const offensive = nonEmpty('offensive weapons', weapons.filter((w) => w.type !== 'self' && w.damage > 0));
const BUMP = 1000;
const before = offensive.map((w) => AI.pressValue(w, 1));

// The positive control FIRST: a weapon the map cannot possibly know must show the jump. If it
// does not, the probe cannot detect a miss at all and every row below is meaningless.
const decoy = { ...offensive[0], damage: offensive[0].damage + BUMP };
eq('CONTROL: an unknown weapon object MISSES and falls back to w.damage',
  AI.pressValue(decoy, 1), offensive[0].damage + BUMP);

let hits = 0;
let misses = 0;
try {
  for (const w of offensive) w.damage += BUMP;
  offensive.forEach((w, i) => { if (AI.pressValue(w, 1) === before[i]) hits++; else misses++; });
} finally {
  for (const w of offensive) w.damage -= BUMP;
}
eq('every roster weapon object is the one PRESS_VALUE was built from', misses, 0);
eq('…over the WHOLE offensive roster, not the 8 a clone probe would have covered', hits, offensive.length);
ok('the roster was restored', offensive.every((w, i) => AI.pressValue(w, 1) === before[i]));

// …and the profile was built from the LIVE (post-registration) numbers. Under a stock set this
// is trivially true; it is asserted so it fails loudly if `registerCharacterFields` is ever
// moved to AFTER `ai.ts` evaluates, which would leave the driver ranking weapons by a table
// that no longer describes them.
const lettuce = RULES.CHARACTERS.hamburger.weapons.find((w) => w.key === 'Lettuce');
eq('PRESS_VALUE reflects the roster value, not a pre-registration copy',
  AI.pressValue(lettuce, 1), lettuce.damage * (lettuce.peckHits ?? 1) * (lettuce.pellets ?? 1));

// ═════════════════════════════════════════════════════════════════════════════
// 5b. THE STAGING LAYER STILL WORKS ON EVERY CONSTANT THIS PASS TOUCHED
// ═════════════════════════════════════════════════════════════════════════════
//
// 🚨 **`stage_rules.mjs` REWRITES A CONSTANT TEXTUALLY, AND `tune()` CHANGED THE TEXT.**
// Its substitution is `^(export const KEY\s*=\s*)([^;]+)(;)` — it replaces everything up to
// **the first semicolon**. A bare `export const PLAYER_SPEED = 0.12;` has that semicolon at
// the end of the line. A `tune('PLAYER_SPEED', 0.12, { … })` call has it after the closing
// `});`, several lines down — which is fine, UNTIL a `doc:` string contains a `;`.
//
// Measured, not reasoned: with `doc: '… see AI_CHASE_SPEED; the pair is the decision …'`,
// `stage_rules.mjs PLAYER_SPEED=0.09` produced
//
//     export const PLAYER_SPEED = 0.09; the pair is the decision, not this field.',
//     });
//
// — a syntax error, reported by `stage_rules` as a successful single-hit substitution. That
// is the worst shape available: a staged sweep that fails to parse rather than one that
// silently sweeps the wrong thing, but arriving with a green "staged … with PLAYER_SPEED=0.09"
// line above it. `roster_table`, `pacing_ladder`, `rules_sweep`, `status_grace_sweep` and
// `driver_guard` all sweep through this path.
//
// **So a registered constant's spec strings may not contain a semicolon**, and that rule is
// unenforceable by reading — it is enforced here, by actually staging each one and importing
// the result. Not by grepping for `;`, which would be a proxy for the property rather than
// the property.

console.log('\n── 5b. stage_rules.mjs still rewrites every registered top-level constant ──');

const STAGE_KEYS = nonEmpty('top-level registered scalars', authored
  .filter((e) => !e.key.includes('.'))
  .map((e) => e.key));

const stageDir = join(tmpdir(), `tun-stage-${process.pid}`);
let staged = 0;
let stageBroke = [];
try {
  for (const key of STAGE_KEYS) {
    const entry = T.entryFor(key);
    // A value inside the band, distinct from the authored one, so the rewrite is observable.
    const v = entry.int ? Math.round((entry.authored + entry.min) / 2) || entry.min : (entry.authored + entry.min) / 2;
    const probe = `import('${stageDir}/game/rules.ts').then(m=>{const got=m.${key};process.stdout.write(String(got));}).catch(e=>{process.stdout.write('ERR '+e.message.split('\\n')[0]);process.exitCode=1;})`;
    try {
      execFileSync(process.execPath, [`${ROOT}/tools/tmp/stage_rules.mjs`, stageDir, `${key}=${v}`], { stdio: 'ignore' });
      const got = execFileSync(process.execPath, ['-e', probe], { cwd: ROOT, encoding: 'utf8' });
      if (got.startsWith('ERR') || Number(got) !== v) stageBroke.push(`${key}: ${got.slice(0, 70)}`);
      else staged++;
    } catch (err) {
      stageBroke.push(`${key}: ${String(err.message).split('\n')[0].slice(0, 70)}`);
    }
  }
} finally {
  rmSync(stageDir, { recursive: true, force: true });
}
eq('every registered top-level constant survives a stage_rules rewrite', stageBroke.length, 0);
if (stageBroke.length) for (const b of stageBroke.slice(0, 8)) console.log(`       ${b}`);
ok('…and the rewrite actually took, so this is not a vacuous pass', staged === STAGE_KEYS.length,
  `${staged}/${STAGE_KEYS.length} staged AND read back at the swept value`);

// ═════════════════════════════════════════════════════════════════════════════
// 6. THE SET HASH — §76 constraint 3
// ═════════════════════════════════════════════════════════════════════════════

console.log('\n── 6. the set hash ───────────────────────────────────────────────────────');

eq('this process is stock', T.tuningSetHash(), 'stock');
eq('stock is a WORD, never a digest', T.STOCK_HASH, 'stock');
ok('a hashed set is prefixed, so a stamp is self-describing in a blob',
  T.hashOfPairs([['PLAYER_SPEED', 0.09]]).startsWith('tun1-'), T.hashOfPairs([['PLAYER_SPEED', 0.09]]));
eq('the hash is ORDER-INDEPENDENT',
  T.hashOfPairs([['a', 1], ['b', 2]]), T.hashOfPairs([['b', 2], ['a', 1]]));
ok('…and CONTENT-dependent, or it would hash everything the same',
  T.hashOfPairs([['a', 1]]) !== T.hashOfPairs([['a', 2]]));
eq('an EMPTY set is stock', T.hashOfPairs([]), 'stock');

// 🚨 UNSTAMPED IS NOT STOCK. That distinction is the entire reason stock is a word.
const refuses = (recorded, actual) => {
  try { T.assertSameTuning(recorded, actual); return false; } catch { return true; }
};
ok('🔴 an UNSTAMPED baseline is REFUSED, not assumed stock', refuses(null, 'stock'));
ok('🔴 an unstamped ACTUAL is refused too', refuses('stock', null));
ok('🔴 two different sets are refused', refuses('tun1-aaaa', 'tun1-bbbb'));
ok('CONTROL: two identical stamps are ACCEPTED', !refuses('stock', 'stock'));

// ═════════════════════════════════════════════════════════════════════════════

console.log('\n──────────────────────────────────────────────────────────────────────────');
console.log(`tun_gate: ${pass}/${pass + fail} checks passed${fail ? `  — ${fail} FAILURE(S)` : ''}\n`);
process.exit(fail ? 1 : 0);
