#!/usr/bin/env node
/**
 * SPAWN GATE — the acceptance test for `ArenaDefinition.spawns`.
 *
 * `tools/tmp/sp_place.mjs` SEARCHED for the six seats; this one refuses to let them rot.
 * They are two files on purpose: a search that also grades itself grades itself to the
 * shape it found, and a fairness constraint checked by its own author's objective function
 * is not checked.
 *
 * ── WHAT IT ASSERTS, AND WHY EACH ONE IS HERE ───────────────────────────────
 *
 *   §A SYMMETRY   entry 2k and entry 2k+1 are exact 180° images about `arena.center`.
 *                 `DECISIONS §48` puts this in the same category as `tools/aspect.mjs` — a
 *                 COMPETITIVE-FAIRNESS constraint, not a style one — and it is checked on
 *                 the **browser dump**, the data the game actually builds, not on the
 *                 source. A source check would prove `ARENA_W - K` was typed correctly,
 *                 which is the easy half. Same choice `ap_reach --selftest` §F made.
 *
 *   §B PAIRING    the list has an EVEN length. An odd count is geometrically impossible
 *                 under a point symmetry: the unpaired seat would have to be its own
 *                 image, i.e. the map centre, which is inside the pot's CoverBox.
 *
 *   §C DUEL       `spawns[0]`/`spawns[1]` are `playerSpawn`/`enemySpawn` to the wu. This
 *                 is the bit-identity contract stated as an assertion instead of as a
 *                 paragraph: 74 `createMatch` call sites and 1,089 untyped `.mjs`
 *                 references read the two-spawn surface and `tsc` can see none of them.
 *
 *   §D RUNWAY     every seat clears `tools/tmp/spawn_runway.mjs` — the SHIPPED tool, run
 *                 as a child process on a per-pair fixture, not a copy of its rule. It is
 *                 the tool that owns "60 wu in all four cardinals over a ±21 wu band, and
 *                 no run stops in a damage hazard"; re-implementing it here would be the
 *                 second drawing this repo keeps paying for.
 *
 *   §E REACH      every seat is in the same flood component as every other, at the sim's
 *                 42 wu body. A spawn in a pocket is a fighter that cannot leave.
 *
 *   §F KEEPOUT    every seat is outside `max(MIN_SAFE_RADIUS, maxSafeRadius × (1 −
 *                 CONCEAL_ENDGAME_PROGRESS))`, is not concealed at t=0
 *                 (`movement.ts:isConcealed`), and is not in a `slow` hazard.
 *
 *   §G SOURCE     the dump still equals `src/arena/kitchen.ts`. `tools/arena.gameplay.json`
 *                 is MACHINE-GENERATED and 39 tools read it; a stale copy is a guard
 *                 measuring a world that does not exist. `arena_probe --verify` does this
 *                 for `cover`; nothing did it for `spawns` until this row.
 *
 * ── AND EVERY ONE IS PAIRED WITH THE IMPLEMENTATION THAT FAILS IT ───────────
 * `docs/LESSONS.md` §13: a guard not shown to FAIL on the bug it guards against is not a
 * guard, and a guard can also be TAUTOLOGICAL. Ask of every assertion: what implementation
 * would fail this? Each §'s known-bads are named in their own labels.
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────
 *   node tools/tmp/sp_gate.mjs             # the shipped arena — the gate
 *   node tools/tmp/sp_gate.mjs --selftest  # + the known-bad battery. OFFLINE
 *   node tools/tmp/sp_gate.mjs --endgame   # what MIN_SAFE_RADIUS looks like at N seats
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import { violations, floodComponent, mirror, keepoutRadius, score, PLAYER_SIZE } from './sp_place.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : (i >= 0 ? true : d); };
const has = (k) => argv.includes(`--${k}`);

const DUMP = `${ROOT}/tools/arena.gameplay.json`;
const loadArena = () => JSON.parse(readFileSync(String(arg('layout', DUMP)), 'utf8'));

// ── The sim's constants, IMPORTED. They were regexes over `rules.ts` source until
//    2026-08-18, and §76 killed every one of them. ─────────────────────────
//
// The old code, kept so the failure is legible rather than forgotten:
//
//     const RULES = readFileSync(`${ROOT}/src/game/rules.ts`, 'utf8');
//     const ruleNum = (re) => Number(re.exec(RULES)[1]);
//     const MIN_SAFE_RADIUS = ruleNum(/export const MIN_SAFE_RADIUS = ([\d.]+)/);
//     const REACH = Object.fromEntries(
//       [...RULES.matchAll(/^\s{2}(melee\w+|ranged\w+):\s*(\d+),/gm)].map(…));
//
// `c5b9754` wrapped the declaration in `tune('MIN_SAFE_RADIUS', 140, {…})`, the regex
// stopped matching, and `ruleNum` — which indexes `[1]` on the match with no null check —
// died on `Cannot read properties of null`. This file never even got that far: it imports
// `sp_place.mjs`, whose identical scrape threw first.
//
// 🚨 **BUT THE REGEX WAS ALREADY THE WRONG TOOL BEFORE §76, AND THE `REACH` TABLE SHOWS WHY
// BETTER THAN `MIN_SAFE_RADIUS` DOES.** `/^\s{2}(melee\w+|ranged\w+):\s*(\d+),/gm` is
// coupled to things that are not the value: **two spaces** of indentation, a **trailing
// comma**, an **integer** literal, and a **key spelling**. Reformat `rules.ts` — prettier,
// a nested object, a trailing entry losing its comma — and this table silently loses a
// rung, with no error anywhere, because a shorter list is a perfectly well-formed list.
// A regex cannot be type-checked and cannot be told that a rung went missing. An import
// can: `REACH` is `as const` in `rules.ts`, so a renamed key is a compile error there and
// an immediate `undefined` here.
//
// ⚠️ **`ultimateSlam` IS THE ONE PLACE THE IMPORT IS NOT A DROP-IN, AND IT IS FILTERED BACK
// OUT ON PURPOSE.** The old alternation `(melee\w+|ranged\w+)` excluded
// `REACH.ultimateSlam: 400`; importing `REACH` whole would have added it, and the endgame
// table's chords (166–235 wu) are all under 400, so **all five rows would have flipped from
// "nothing — out of every reach" to "INSIDE REACH.ultimateSlam"** — a silent behaviour
// change dressed as a bug fix. The exclusion is `rules.ts`'s own, stated at the declaration:
// *"DELIBERATELY NOT ON THE LADDER … excluded from the fair-play radius in
// `render/camera.ts`"*, and `rangedMax` is documented as *"the longest reach any weapon has,
// ultimates aside"*. So the filter keeps the prefix convention the alternation encoded —
// a new `melee*`/`ranged*` rung joins automatically, a new `ultimate*` does not — and is now
// applied to a typed object instead of to source text.
const R = await import(`${ROOT}/src/game/rules.ts`);
const MIN_SAFE_RADIUS = R.MIN_SAFE_RADIUS;
const POT_DANGER = R.POT.dangerRadius;
const POT_BODY = R.POT.bodyRadius;
const { MAX_FIGHTERS } = await import(`${ROOT}/src/game/state.ts`);
const LADDER = /^(melee|ranged)/;
const REACH = Object.fromEntries(Object.entries(R.REACH).filter(([k]) => LADDER.test(k)));
// ⚠️ NON-EMPTY BEFORE ANYTHING QUANTIFIES OVER IT. Every consumer of `REACH` below is a
// `.filter(…)[0]`, and an empty table makes all of them answer "outside every weapon's
// reach" — the reassuring answer — in green. `[].every()` returning `true` has fired five
// times in this repo (`CLAUDE.md` #6); this is the same trap wearing `.filter()`.
if (Object.keys(REACH).length === 0) throw new Error('sp_gate: REACH has no melee/ranged rungs — the ladder filter matched nothing');
for (const [k, v] of Object.entries({ MIN_SAFE_RADIUS, POT_DANGER, POT_BODY })) {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`sp_gate: rules.ts exported no finite ${k} (got ${v})`);
}

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   - ${name}`); }
  else { fail++; console.log(`  FAIL - ${name}${detail ? `\n         ${detail}` : ''}`); }
};

// ─────────────────────────────────────────────────────────────────────────────
// THE PURE PREDICATES — each returns a REASON list, so a known-bad can name which
// one caught it rather than "something failed".
// ─────────────────────────────────────────────────────────────────────────────

/** §A + §B. Returns the entries that have no exact 180° partner at their paired index. */
export function symmetryFaults(spawns, center) {
  const out = [];
  if (spawns.length % 2 !== 0) out.push(`ODD LENGTH ${spawns.length} — an unpaired spawn must sit on the centre, which is inside the pot`);
  for (let i = 0; i + 1 < spawns.length; i += 2) {
    const a = spawns[i], b = spawns[i + 1];
    const mx = 2 * center.x - a.x, my = 2 * center.y - a.y;
    if (Math.abs(b.x - mx) > 1e-9 || Math.abs(b.y - my) > 1e-9) {
      out.push(`pair ${i / 2}: (${a.x},${a.y}) mirrors to (${mx},${my}) but slot ${i + 1} is (${b.x},${b.y})`);
    }
  }
  return out;
}

/** §C. */
export function duelFaults(arena) {
  const s = arena.spawns ?? [];
  const out = [];
  const eq = (a, b) => a && b && a.x === b.x && a.y === b.y;
  if (!eq(s[0], arena.playerSpawn)) out.push(`spawns[0] ${JSON.stringify(s[0])} != playerSpawn ${JSON.stringify(arena.playerSpawn)}`);
  if (!eq(s[1], arena.enemySpawn)) out.push(`spawns[1] ${JSON.stringify(s[1])} != enemySpawn ${JSON.stringify(arena.enemySpawn)}`);
  return out;
}

/** §D — the SHIPPED tool, as a child process, on a per-pair fixture. */
export function runwayFaults(arena) {
  const out = [];
  const s = arena.spawns ?? [];
  // ⚠️ PID-SCOPED. Every agent on this box runs the same tool names, so a fixed fixture
  // path is two peers writing one file mid-measurement — the same class of collision the
  // `pkill -f` ban exists for, in the filesystem instead of the process table.
  const dir = `${tmpdir()}/sp_gate.${process.pid}`;
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i + 1 < s.length; i += 2) {
    const path = `${dir}/pair${i}.json`;
    writeFileSync(path, JSON.stringify({ ...arena, playerSpawn: s[i], enemySpawn: s[i + 1] }));
    const r = spawnSync('node', [`${ROOT}/tools/tmp/spawn_runway.mjs`, '--layout', path], { encoding: 'utf8' });
    if (r.status !== 0) {
      const why = (r.stdout || '').split('\n').filter((l) => l.startsWith('FAIL')).join(' | ') || r.stderr;
      out.push(`pair ${i / 2} (${s[i].x},${s[i].y})/(${s[i + 1].x},${s[i + 1].y}): ${why}`);
    }
  }
  return out;
}

/** §E + §F, per seat, from `sp_place`'s single constraint list. */
export function seatFaults(arena) {
  const s = arena.spawns ?? [];
  const out = [];
  for (const p of s) {
    const v = violations(p, arena);
    if (v.length) out.push(`(${p.x},${p.y}): ${v.join(' ')}`);
  }
  if (s.length) {
    const comp = floodComponent(arena, PLAYER_SIZE, s[0]);
    for (const p of s.slice(1)) if (!comp.at(p)) out.push(`(${p.x},${p.y}) is NOT in slot 0's flood component`);
  }
  return out;
}

/**
 * §G — the dump still equals the source.
 *
 * Parses the named constants out of `kitchen.ts` in the same idiom the concealment block
 * uses (`SPAWN_P2X = 570`), rebuilds the list, and requires it to equal the dump entry for
 * entry. Deliberately NOT a second layout parser: it reads only the spawn block, and the
 * cover half is `arena_probe --from-src --verify`'s job.
 */
export function sourceFaults(arena) {
  const src = readFileSync(`${ROOT}/src/arena/kitchen.ts`, 'utf8');
  const shared = readFileSync(`${ROOT}/src/arena/shared.ts`, 'utf8');
  const W = Number(/export const ARENA_W = (\d+)/.exec(shared)[1]);
  const H = Number(/export const ARENA_H = (\d+)/.exec(shared)[1]);
  const scope = { ARENA_W: W, ARENA_H: H };
  for (const m of src.matchAll(/(?:^|[\s,])(SPAWN_[A-Z0-9_]*)\s*=\s*([-+*/(). \d]+?)\s*[,;]/gm)) {
    scope[m[1]] = new Function(...Object.keys(scope), `"use strict"; return (${m[2]});`)(...Object.values(scope));
  }
  const ps = /const playerSpawn = \{ x: ([^,]+), y: ([^}]+) \}/.exec(src);
  const es = /const enemySpawn = \{ x: ([^,]+), y: ([^}]+) \}/.exec(src);
  const ev = (e) => new Function(...Object.keys(scope), `"use strict"; return (${e});`)(...Object.values(scope));
  const block = /const spawns = \[([\s\S]*?)\n {2}\];/.exec(src);
  if (!block) return ['kitchen.ts declares no `const spawns = [...]` block'];
  const list = [];
  for (const line of block[1].split('\n')) {
    const t = line.trim().replace(/,$/, '');
    if (!t || t.startsWith('//')) continue;
    if (t === 'playerSpawn') { list.push({ x: ev(ps[1]), y: ev(ps[2]) }); continue; }
    if (t === 'enemySpawn') { list.push({ x: ev(es[1]), y: ev(es[2]) }); continue; }
    const mm = /^\{ x: ([^,]+), y: ([^}]+) \}$/.exec(t);
    if (!mm) return [`unparseable spawn entry in kitchen.ts: ${t}`];
    list.push({ x: ev(mm[1]), y: ev(mm[2]) });
  }
  const dump = arena.spawns ?? [];
  if (list.length !== dump.length) return [`kitchen.ts declares ${list.length} spawns, the dump has ${dump.length} — REFRESH IT (node tools/match-sim.mjs --refresh-arena --url <snapshot>)`];
  const out = [];
  for (let i = 0; i < list.length; i++) {
    if (list[i].x !== dump[i].x || list[i].y !== dump[i].y) out.push(`slot ${i}: src (${list[i].x},${list[i].y}) vs dump (${dump[i].x},${dump[i].y})`);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE ENDGAME AT N SEATS — the floor SCALES WITH N as of `4bb64e4` (DECISIONS §53b)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * ⚠️ REVERSED. The old wording, kept verbatim because it is what `DECISIONS §48` says and
 * what several packets quote — and because the reversal is the point:
 *
 *   "THE ENDGAME AT N SEATS — `MIN_SAFE_RADIUS` does NOT scale (DECISIONS §48)
 *    `sim.ts:480` — `safeRadius = max(MIN_SAFE_RADIUS, maxSafeRadius × (1 − progress))`. So
 *    every match that goes the distance ends on a 140 wu disc, at EVERY arena size and at
 *    EVERY fighter count. […] ⚠️ This is a §48 item and it is NOT fixed by a bigger arena —
 *    the floor is a constant."
 *
 * `4bb64e4` made it a function of N. `rules.ts:1130` now exports
 *
 *     minSafeRadiusFor(N) = max(MIN_SAFE_RADIUS,
 *                               ENDGAME_STANDOFF / sin(pi/N) − POT.dangerRadius)
 *     ENDGAME_STANDOFF    = REACH.rangedMax + max(HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY)
 *
 * = 140 at N<=4 (the POT term still binds), 187.42 at N=5, **237.00 at N=6** (the SPACING
 * term binds). So the sentence this function printed for months — "the same disc at 2 seats
 * and at 6" — was FALSE by 97 wu at six seats.
 *
 * 🚨 This block is REPORT-ONLY: nothing here is asserted, which is exactly why it went on
 * printing a false headline through the commit that falsified it and through the x4 map
 * after that. **An unasserted line is not checked by anything.** It is left report-only
 * deliberately — the assertion that matters lives in `sim.test.mjs` §29 and in
 * `rg2_mutants.mjs` — but the reason is recorded here so the next reader knows the sentence
 * is only as fresh as the last person to read it.
 *
 * ⚠️ AND THE RING NEVER REACHES THIS FLOOR IN A SHIPPED MATCH (`rules.ts:1194`): sudden
 * death fires at 30 s, where the scheduled radius is 661.67 wu — 2.8x the N=6 floor. The
 * table below therefore describes the floor's GEOMETRY, not a state any match arrives at.
 *
 * The pot sits in the middle and is SOLID (`POT.bodyRadius × 2` = 104 wu box, blocking a
 * 42 wu centre out to 73 wu) with a `dangerRadius` 95 wu burn ring around it. So the
 * endgame floor is an ANNULUS, and the honest description of six seats is the width of that
 * annulus against the width of a body — measured here, not guessed.
 */
// 🚨 **THE WORST SCRAPE IN THIS FILE WAS THIS ONE, AND IT WAS NOT BROKEN BY §76.** It read
//
//     PLAYER_SIZE * Number(/export const HIT_RADIUS_VS_PLAYER = PLAYER_SIZE \* ([\d.]+)/…)
//
// — a regex that hardcodes **the shape of the right-hand side**, not just the constant's
// name. It only works while the declaration is spelled `PLAYER_SIZE * 0.6`; rewrite it as
// `25.2`, or as `BODY_LENGTH * 0.6`, and the match is gone. The value is exported. Import it.
const HIT_RADIUS_MAX = Math.max(R.HIT_RADIUS_VS_PLAYER, R.HIT_RADIUS_VS_ENEMY);
/**
 * ⚠️ THIS LINE USED TO READ `const ENDGAME_STANDOFF = REACH.rangedMax + HIT_RADIUS_MAX;`,
 * with the comment *"`rules.ts:minSafeRadiusFor`, re-derived here rather than imported
 * (this file reads no TS)"* on the function below. **The parenthetical is no longer true —
 * this file reads TS now — and the re-derivation was the exact thing `x4_layout.mjs`'s
 * header forbids**: *"THE FIRST DRAFT RE-DERIVED IT AND WAS WRONG BY 1.60 wu WITHIN THE
 * HOUR … There is no version of this file that is allowed to own a second copy of that
 * arithmetic."* Both are now the sim's own symbols.
 *
 * **Measured before the swap, not assumed:** the local copy and `rules.ts:minSafeRadiusFor`
 * agree to a delta of EXACTLY 0.0 at N = 1,2,3,4,5,6,7,8,12 and at `NaN`/`Infinity`
 * (140.000000 / 187.416068 / 237.000000 / 287.590969 / 338.778904 / 546.374749), and
 * `ENDGAME_STANDOFF` matches at 166 with delta 0. The one difference is real but unreachable
 * from here: `rules.ts` does `Math.floor(fighterCount)` first and the copy did not, so they
 * part company only on a non-integer N, which no caller in this file produces.
 */
const ENDGAME_STANDOFF = R.ENDGAME_STANDOFF;
const minSafeRadiusFor = R.minSafeRadiusFor;

function endgame(arena) {
  const rIn = POT_DANGER;                                   // inside this the ground burns
  const rBlock = POT_BODY + PLAYER_SIZE / 2;                // a 42 wu centre cannot get closer
  console.log(`\n== THE ENDGAME — the floor SCALES WITH N as of 4bb64e4 (DECISIONS §53b), ${MIN_SAFE_RADIUS} wu at N<=4 and ${minSafeRadiusFor(6).toFixed(2)} at N=6`);
  console.log(`   ⚠️ This REVERSES §48's "MIN_SAFE_RADIUS does NOT scale". It does now.`);
  console.log(`   ENDGAME_STANDOFF     = ${ENDGAME_STANDOFF} wu   (REACH.rangedMax ${REACH.rangedMax} + max hit radius ${HIT_RADIUS_MAX})`);
  console.log(`   pot burn ring        r = ${rIn} wu         (POT.dangerRadius, 32 HP/s inside)`);
  console.log(`   pot solid box        r = ${rBlock} wu         (POT.bodyRadius + half a body — a centre cannot go closer)`);
  console.log(`   ⚠️ maxSafeRadius is ${arena.maxSafeRadius} wu on this ${arena.width}x${arena.height} map, and sudden death fires at 30 s`);
  console.log(`      where the scheduled radius is ${(arena.maxSafeRadius * (1 - 30 / 45)).toFixed(2)} wu — so NO SHIPPED MATCH REACHES THE FLOOR.`);
  console.log(`\n   ${'N'.padStart(3)} ${'floor'.padStart(8)} ${'annulus'.padStart(9)} ${'arc each'.padStart(10)} ${'gap'.padStart(7)} ${'chord'.padStart(8)}   inside which weapon`);
  for (const n of [2, 3, 4, 5, 6]) {
    const rOut = minSafeRadiusFor(n);                       // outside this the fog burns
    const bandWu = rOut - rIn;
    const midR = (rIn + rOut) / 2;
    const arc = (2 * Math.PI * midR) / n;
    const gap = arc - PLAYER_SIZE;
    const chord = 2 * midR * Math.sin(Math.PI / n);
    const inside = Object.entries(REACH).filter(([, v]) => chord <= v).sort((a, b) => a[1] - b[1])[0];
    console.log(`   ${String(n).padStart(3)} ${rOut.toFixed(2).padStart(7)}wu ${bandWu.toFixed(1).padStart(8)}wu ${arc.toFixed(0).padStart(9)}wu ${gap.toFixed(0).padStart(6)}wu ${chord.toFixed(0).padStart(7)}wu   ${inside ? `${inside[0]} (${inside[1]})` : 'nothing — out of every reach'}`);
  }
  console.log(`\n   Read the last column as: at that seat count, two fighters standing evenly spaced on the`);
  console.log(`   endgame ring are ALREADY inside that weapon's range of each other, before either moves.`);
  console.log(`   §53b's whole point is that the chord is now HELD AT ENDGAME_STANDOFF as N rises, instead`);
  console.log(`   of collapsing — which is what a constant floor did.\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// THE GATE
// ─────────────────────────────────────────────────────────────────────────────
function gate(arena) {
  const s = arena.spawns ?? [];
  console.log(`\n== SPAWN GATE — ${arena.id} ${arena.width}x${arena.height}, ${s.length} seats in ${s.length / 2} mirror pairs`);
  console.log(`   keep-out ${keepoutRadius(arena).toFixed(2)} wu · body ${PLAYER_SIZE} wu · layout ${String(arg('layout', DUMP)).replace(`${ROOT}/`, '')}\n`);

  console.log('§A/§B — 180° point symmetry, pairwise, on the shipped dump');
  const sym = symmetryFaults(s, arena.center);
  check(`all ${s.length} spawns are exact 180° pairs about (${arena.center.x},${arena.center.y})`, sym.length === 0, sym.join('\n         '));

  // The arena and the sim must agree on how many seats exist. `sim.test.mjs` §27 pins
  // `MAX_FIGHTERS` against the state layout; nothing pinned it against the ARENA, so
  // raising it to 8 would produce a sim that seats 8 and a kitchen that can start 6 —
  // and `createMatch` would throw on slot 6 with no gate having said why.
  // ⚠️ WAS `Number(/export const MAX_FIGHTERS = (\d+)/.exec(readFileSync(state.ts))[1])`.
  // Same class as the `rules.ts` scrapes above and the same fix: `src/game/**` spells its
  // imports with explicit `.ts` extensions precisely so Node can load them, so there is no
  // reason to read this one as text. Hoisted to module scope because the import is `await`ed
  // once and this function is synchronous.
  check(`the arena seats exactly MAX_FIGHTERS (${MAX_FIGHTERS}) — state.ts and src/arena/** agree`,
    s.length === MAX_FIGHTERS, `spawns ${s.length} vs MAX_FIGHTERS ${MAX_FIGHTERS}`);

  console.log('\n§C — the duel is byte-identical: spawns[0]/[1] ARE playerSpawn/enemySpawn');
  const duel = duelFaults(arena);
  check('spawns[0] == playerSpawn and spawns[1] == enemySpawn', duel.length === 0, duel.join('\n         '));

  console.log('\n§D — every seat clears the SHIPPED spawn_runway.mjs (run as a child, per pair)');
  const rw = runwayFaults(arena);
  check(`all ${s.length / 2} pairs pass spawn_runway --layout`, rw.length === 0, rw.join('\n         '));

  console.log('\n§E/§F — reachable, outside the keep-out, not concealed, not in a puddle');
  const seat = seatFaults(arena);
  check(`all ${s.length} seats clear every per-seat constraint and share one flood component`, seat.length === 0, seat.join('\n         '));

  console.log('\n§G — tools/arena.gameplay.json still equals src/arena/kitchen.ts');
  const srcF = sourceFaults(arena);
  check('the machine-generated dump is not stale', srcF.length === 0, srcF.join('\n         '));

  // ── The numbers, printed whether or not anything failed ──────────────────
  const sc = score(s);
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  console.log('\n   SEPARATION MATRIX (wu)');
  console.log(`   ${'  '.padEnd(6)}${s.map((_, j) => `slot${j}`.padStart(8)).join('')}`);
  s.forEach((p, i) => console.log(`   slot${i} ${s.map((q, j) => (i === j ? '.' : d(p, q).toFixed(0)).padStart(8)).join('')}`));
  const worstPair = (() => {
    let best = null;
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
      const dd = d(s[i], s[j]);
      if (!best || dd < best.d) best = { i, j, d: dd };
    }
    return best;
  })();
  const bites = Object.entries(REACH).filter(([, v]) => worstPair && worstPair.d <= v).sort((a, b) => a[1] - b[1])[0];
  console.log(`\n   closest two seats: ${worstPair.i} and ${worstPair.j}, ${worstPair.d.toFixed(1)} wu apart`
    + `${bites ? ` — INSIDE REACH.${bites[0]} (${bites[1]})` : ' — outside every weapon\'s reach'}`);
  console.log(`   inter-pair residual (classSpread): ${sc.classSpread === null ? 'n/a' : `${sc.classSpread.toFixed(1)} wu`}`
    + ' — a C2 map cannot drive this to 0; see sp_place.mjs\'s header.');
  for (const n of [2, 3, 4, 5, 6]) {
    if (n > s.length) break;
    const sub = s.slice(0, n);
    console.log(`   N=${n}: minimum separation ${score(sub).minSep.toFixed(1)} wu`
      + `${n % 2 === 0 ? '  (a complete set of mirror pairs — exactly fair pairwise)' : '  (ODD — no symmetric seating exists on a C2 map)'}`);
  }
  return fail;
}

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — every § above, paired with the implementation that fails it
// ─────────────────────────────────────────────────────────────────────────────
async function selftest() {
  const arena = loadArena();
  console.log(`\nsp_gate --selftest   ${arena.spawns?.length ?? 0} seats · body ${PLAYER_SIZE} wu\n`);

  console.log('§A — the symmetry checker fails on every way a mirror can be wrong');
  {
    const s = arena.spawns;
    check('CONTROL: the shipped list is symmetric', symmetryFaults(s, arena.center).length === 0);
    check('KNOWN-BAD: nudging ONE seat by 1 wu is caught',
      symmetryFaults(s.map((p, i) => (i === 4 ? { ...p, x: p.x + 1 } : p)), arena.center).length > 0);
    check('KNOWN-BAD: nudging its PARTNER by 1 wu is caught too (not just slot 0 of a pair)',
      symmetryFaults(s.map((p, i) => (i === 5 ? { ...p, y: p.y + 1 } : p)), arena.center).length > 0);
    // ⚠️ WAS `[{x:160,y:390},{x:1240,y:390}]` — an axis mirror about x=700, i.e. about the
    //    1400x1000 map's centre. On the x4 map those two points are not a mirror of ANY kind
    //    about (1400,1000), so the row went on passing while testing nothing it names: it
    //    refused an arbitrary pair, not an axis mirror. Rebuilt from the shipped seat and
    //    the CURRENT centre: mirror(300,810) is (2500,1190); the AXIS mirror is (2500,810).
    check('KNOWN-BAD: an AXIS mirror (x flipped, y kept) is refused',
      symmetryFaults([{ x: s[0].x, y: s[0].y }, { x: arena.width - s[0].x, y: s[0].y }], arena.center).length > 0,
      'a checker that only tested x would pass this');
    check('  CONTROL: …and the true POINT mirror of that same seat is accepted',
      symmetryFaults([{ x: s[0].x, y: s[0].y }, mirror(s[0], arena)], arena.center).length === 0,
      'so the row above refuses the AXIS mirror specifically, not any pair it is handed');
    check('KNOWN-BAD: SWAPPING two pairs\' partners is caught',
      symmetryFaults([s[0], s[3], s[2], s[1], s[4], s[5]], arena.center).length > 0,
      'the list is still a symmetric SET; the PAIRING is what broke, and slots are what seats fighters');
    check('KNOWN-BAD: an ODD list is refused', symmetryFaults(s.slice(0, 5), arena.center).length > 0);
    check('KNOWN-BAD: the only self-symmetric point is the centre, and it is inside the pot',
      violations({ ...arena.center }, arena).includes('inside-cover'),
      'this is WHY an odd count is impossible rather than merely discouraged');
  }

  console.log('\n§C — the duel check is not tautological');
  {
    check('CONTROL: the shipped list passes', duelFaults(arena).length === 0);
    check('KNOWN-BAD: moving spawns[0] 1 wu off playerSpawn is caught',
      duelFaults({ ...arena, spawns: arena.spawns.map((p, i) => (i === 0 ? { ...p, x: p.x + 1 } : p)) }).length > 0);
    check('KNOWN-BAD: swapping spawns[0] and spawns[1] is caught',
      duelFaults({ ...arena, spawns: [arena.spawns[1], arena.spawns[0], ...arena.spawns.slice(2)] }).length > 0,
      'slot order is a game rule — sim.ts gives slot 0 the human controller');
  }

  console.log('\n§D — the runway check really runs spawn_runway.mjs and really fails');
  {
    check('CONTROL: the shipped list passes', runwayFaults(arena).length === 0);
    // The pot pin, as a whole PAIR: a centre-line seat whose east run ends flush on the pot.
    // ⚠️ WAS `{x:280,y:500}` / `{x:1120,y:500}` — the `60c5b92` pin on the 1400x1000 map. On
    //    the x4 map (280,500) is INSIDE the north-west walk-in freezer, so the fixture failed
    //    with five cover faults instead of the one hazard fault it is asserting. Rebuilt to
    //    the same GEOMETRY: (800,1000) is on the centre line, 600 wu west of the x4 centre
    //    (outside the 496.25 keep-out), and its east run ends flush on the pot at
    //    clearance -19.0 against a 21 wu margin. `sp_place`'s pin row uses the same seat.
    const pinned = { ...arena, spawns: [...arena.spawns.slice(0, 4), { x: 800, y: 1000 }, { x: 2000, y: 1000 }] };
    const f = runwayFaults(pinned);
    check('KNOWN-BAD: a centre-line pair whose run ends on the pot is caught by the shipped tool',
      f.length === 1 && /hazard/.test(f[0]), f.join(' '));
    // And a seat with plenty of hazard clearance but a blocked cardinal.
    // ⚠️ WAS `{x:700,y:250}` / `{x:700,y:750}` — 24 wu from the 1x sink counter at (700,170).
    //    The x4 sink counter is at (1400,670), 150x70: its north face is y=635, so a body
    //    centred at y = 635 − 21 − 24 = 590 stands 24 wu clear of it.
    const boxed = { ...arena, spawns: [...arena.spawns.slice(0, 4), { x: 1400, y: 590 }, { x: 1400, y: 1410 }] };
    check('KNOWN-BAD: a seat 24 wu from the sink counter is caught by the runway half',
      runwayFaults(boxed).some((x) => /runway/.test(x)), runwayFaults(boxed).join(' '));
  }

  console.log('\n§E/§F — the per-seat checks');
  {
    check('CONTROL: the shipped list passes', seatFaults(arena).length === 0);
    // ⚠️ ALL THREE FIXTURES REBUILT for `6631446`. Every one of them was a 1x coordinate,
    //    and the interesting part is that only TWO of the three went red:
    //      inPot     (700,500)  — on the x4 map this is inside a HERB CRATE at (700,465).
    //                             The row went on passing while asserting nothing about the
    //                             pot. **A green known-bad is not evidence it still aims at
    //                             the thing it names.** Now the pot's own centre.
    //      inConceal (260,375)  — no longer a concealment patch anywhere. Failed loudly.
    //                             Now `arena.concealment[0]`, read from the dump.
    //      nearHub   (700,620)  — 156 wu from the 1x centre, 782 wu from the x4 one, i.e.
    //                             far OUTSIDE the 496.25 keep-out. Failed loudly.
    //                             Now 120 wu off the centre, the same offset the 1x fixture
    //                             used (and `sp_place`'s centre-adjacent row uses).
    //    Each is now built from `arena` rather than from a literal, so the next map change
    //    moves them instead of stranding them.
    const inPot = { ...arena, spawns: [...arena.spawns.slice(0, 4), { ...arena.center }, { ...arena.center }] };
    check('KNOWN-BAD: a seat inside the pot is caught', seatFaults(inPot).length > 0);
    const patch = arena.concealment[0];
    const inConceal = { ...arena, spawns: [...arena.spawns.slice(0, 4), { x: patch.x, y: patch.y }, mirror(patch, arena)] };
    check(`KNOWN-BAD: a seat that starts CONCEALED is caught (${patch.kind}@${patch.x},${patch.y})`,
      seatFaults(inConceal).some((x) => /concealment/.test(x)));
    const nearHub = { ...arena, spawns: [...arena.spawns.slice(0, 4), { x: arena.center.x, y: arena.center.y + 120 }, { x: arena.center.x, y: arena.center.y - 120 }] };
    check('KNOWN-BAD: a seat inside the endgame keep-out is caught', seatFaults(nearHub).some((x) => /keepout/.test(x)));
    // A seat sealed away from the rest: walled off by a razor wall the flood cannot cross.
    const walled = {
      ...arena,
      cover: [...arena.cover, { x: 250, y: 500, w: 1, h: 3000, kind: 'razor' }],
      spawns: [...arena.spawns],
    };
    check('KNOWN-BAD: a razor wall that strands slot 4 from slot 0 is caught by the flood',
      seatFaults(walled).some((x) => /flood component/.test(x)), seatFaults(walled).join(' | '));
    check('CONTROL: …and without the wall the same seats share a component',
      !seatFaults(arena).some((x) => /flood component/.test(x)));
  }

  console.log('\n§G — the staleness check can see a stale dump');
  {
    check('CONTROL: the committed dump matches kitchen.ts', sourceFaults(arena).length === 0);
    check('KNOWN-BAD: a dump whose slot 4 drifted 1 wu is caught',
      sourceFaults({ ...arena, spawns: arena.spawns.map((p, i) => (i === 4 ? { ...p, x: p.x + 1 } : p)) }).length > 0,
      'this is the row that would have caught someone hand-editing the machine-generated file');
    check('KNOWN-BAD: a dump with a seat MISSING is caught',
      sourceFaults({ ...arena, spawns: arena.spawns.slice(0, 4) }).length > 0);
  }

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  ${pass} passed, ${fail} failed\n`);
  process.exitCode = fail ? 1 : 0;
}

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_MAIN) {
  const arena = loadArena();
  if (has('selftest')) {
    await selftest();
  } else if (has('endgame')) {
    endgame(arena);
  } else {
    const n = gate(arena);
    endgame(arena);
    console.log(`${n === 0 ? 'PASS' : 'FAIL'}  ${pass} passed, ${fail} failed\n`);
    process.exitCode = n ? 1 : 0;
  }
}
