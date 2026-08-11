#!/usr/bin/env node
/**
 * KX_FOGCOVER — DOES THE DANGER CANOPY REACH EVERY CELL A FIGHTER CAN STAND ON?
 *
 * ## The bug this exists to stop coming back
 *
 * `fogRing.ts`'s `FIELD_OUTER_UNITS` was the literal **1500**, justified in its own comment
 * by *"the arena's half-diagonal is ~860, so this covers every corner"* — the **1400×1000**
 * number. The map went ×4 in area (`DECISIONS §48`) and the half-diagonal doubled to
 * 1720.47, so the constant stopped covering the corners while the sentence next to it still
 * read as a proof. `779dc62`'s commit message repeats the claim, so the log was wrong too.
 *
 * Sudden death (`f87d407`) drives the safe radius to **0** and makes the whole map lethal, so
 * the shortfall is not cosmetic: **3.25% of the standable map was lethal ground rendered as
 * bright, fully-lit floor**, with the HUD reading *"OUTSIDE THE ZONE −50 HP/s"* over it.
 *
 * 🚨 **NOTHING COULD SEE IT.** `tsc` cannot; the sim does not know the canopy exists; every
 * fog fixture in the repo requested a radius the ring reaches while it is still wide. The
 * defect only exists at radius 0, which was unreachable in a real match until sudden death
 * landed. This file is the row that would have gone red.
 *
 * ## What it asserts
 *
 *   §A COVERAGE   every standable cell of the shipped arena is inside `FIELD_OUTER_UNITS`.
 *                 Standable = in bounds inset by half a body, and not inside a `CoverBox`
 *                 for a `PLAYER_SIZE` body — `movement.ts:collidesWithCover`'s own rule, via
 *                 `sp_place.mjs:blocked` rather than a second copy of it.
 *   §B CORNERS    it reaches `ARENA_HALF_DIAGONAL`. Weaker than §A and kept separate,
 *                 because it is the claim the OLD comment made and the one the commit log
 *                 still carries.
 *   §C CAMERA     it reaches the furthest standable cell PLUS `camera.ts`'s worst-case
 *                 ground reach past a bound (470 wu, solved in `apron.ts`'s header). §A is
 *                 about lethal ground; this is about the canopy's own outer RIM never being
 *                 on screen as a hard edge, which is what the corner PNG actually showed.
 *   §D DERIVED    the value is not a literal that happens to fit today's map. Recomputed at
 *                 the 1400×1000 arena this replaces, the SAME expression must still clear
 *                 that map's §A/§B/§C. A tuned literal passes §A–§C and fails this.
 *
 * ## And every one is paired with the implementation that FAILS it
 *
 * `--selftest` re-runs the whole battery against **the shipped literal 1500** and requires
 * §A, §B and §C to go RED, and against a hypothetical hardcoded `1721` (the ×4 corner
 * distance, which is the tempting fix) and requires §D to go RED while §A/§B pass. A guard
 * that has not been shown to fail on the bug it guards against is not a guard.
 *
 * ⚠️ It also asserts the standable set is NON-EMPTY before asserting anything over it.
 * Three guards went vacuous in one session here by filtering a set to nothing and letting
 * `[].every()` return `true`.
 *
 *   node tools/tmp/kx_fogcover.mjs             # the gate
 *   node tools/tmp/kx_fogcover.mjs --selftest  # + the known-bad battery. OFFLINE, no browser
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { blocked, PLAYER_SIZE } from './sp_place.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : (i >= 0 ? true : d); };
const has = (k) => argv.includes(`--${k}`);

/**
 * The shipped constants, READ OUT OF THE SOURCE rather than re-typed here.
 *
 * ⚠️ **`await import('src/arena/fogRing.ts')` DOES NOT WORK AND THE REASON MATTERS.**
 * `src/arena/**` and `src/render/**` are written with EXTENSIONLESS imports (`from
 * '../units'`), which Vite resolves and Node does not — unlike `src/game/**`, which spells
 * `./state.ts` everywhere, which is why `sp_place.mjs` can import `movement.ts` directly.
 * Node dies with `ERR_MODULE_NOT_FOUND` on `src/units`.
 *
 * So this reads the source text, the same way `sp_place.mjs` reads `PLAYER_SIZE` out of
 * `rules.ts` — and here that is the STRONGER choice rather than a fallback, because the bug
 * being guarded against is *a literal typed into source*. §D can therefore ask the question
 * that actually matters: **is the right-hand side a derivation of named constants, or a
 * number?** — and it can re-evaluate that same expression against a DIFFERENT map size,
 * which is the only way to tell a derivation from a literal that happens to fit.
 */
const readConst = (src, file, name, re) => {
  const m = re.exec(src);
  if (!m) throw new Error(`kx_fogcover: could not read ${name} out of ${file}`);
  return m[1].trim();
};
const SHARED_SRC = readFileSync(`${ROOT}/src/arena/shared.ts`, 'utf8');
const FOGRING_SRC = readFileSync(`${ROOT}/src/arena/fogRing.ts`, 'utf8');

const ARENA_W = Number(readConst(SHARED_SRC, 'shared.ts', 'ARENA_W', /^export const ARENA_W = ([\d.]+);/m));
const ARENA_H = Number(readConst(SHARED_SRC, 'shared.ts', 'ARENA_H', /^export const ARENA_H = ([\d.]+);/m));
const APRON_OUT = Number(readConst(SHARED_SRC, 'shared.ts', 'APRON_OUT', /^export const APRON_OUT = ([\d.]+);/m));
const ARENA_HALF_DIAGONAL = Math.hypot(ARENA_W / 2, ARENA_H / 2);

/** The RIGHT-HAND SIDE of `fogRing.ts`'s `FIELD_OUTER_UNITS`, as source text. */
const OUTER_EXPR = readConst(FOGRING_SRC, 'fogRing.ts', 'FIELD_OUTER_UNITS', /^const FIELD_OUTER_UNITS = (.+);\s*$/m);

/** Evaluate that expression for an arbitrary map size — the whole point of §D. */
function evalOuter(expr, w, h, apron) {
  // eslint-disable-next-line no-new-func
  return Function('ARENA_HALF_DIAGONAL', 'APRON_OUT', 'ARENA_W', 'ARENA_H', `"use strict"; return (${expr});`)(
    Math.hypot(w / 2, h / 2), apron, w, h,
  );
}
const FIELD_OUTER_UNITS = evalOuter(OUTER_EXPR, ARENA_W, ARENA_H, APRON_OUT);

/**
 * `camera.ts`'s worst-case ground reach past a play bound, world units.
 *
 * Solved in `apron.ts`'s header across the shipped aspect range (4:3 → 21:9): lateral 311 /
 * 470 wu, up-screen 319 / 275, down-screen 143 / 123. The maximum over every aspect and
 * every direction is the 21:9 lateral figure.
 */
const CAMERA_REACH_WU = 470;

/** Lattice for the standable sweep, world units. 4 wu is ~1/10 of a body. */
const L = Number(arg('lattice', 4));

const DUMP = String(arg('layout', `${ROOT}/tools/arena.gameplay.json`));
const loadArena = () => JSON.parse(readFileSync(DUMP, 'utf8'));

/**
 * Every standable cell, and how many of them fall outside a given canopy radius.
 *
 * ⚠️ Returns the TOTAL as well as the count outside, and the caller asserts the total is
 * non-zero before asserting the outside count is zero. "0 of 0 cells are outside" is a
 * sentence three vacuous guards in this repo have already printed in green.
 */
export function coverage(arena, outerUnits) {
  const half = PLAYER_SIZE / 2;
  const cols = Math.floor(arena.width / L), rows = Math.floor(arena.height / L);
  let total = 0, outside = 0, maxR = 0, worst = null;
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const x = (gx + 0.5) * L, y = (gy + 0.5) * L;
      if (x < half || x > arena.width - half || y < half || y > arena.height - half) continue;
      if (blocked(x, y, PLAYER_SIZE, arena.cover)) continue;
      total++;
      const r = Math.hypot(x - arena.center.x, y - arena.center.y);
      if (r > maxR) { maxR = r; worst = { x, y }; }
      if (r > outerUnits) outside++;
    }
  }
  return { total, outside, maxR, worst, pct: total ? (100 * outside) / total : NaN };
}

/** One arena's worth of rows. `outer` is passed in so a known-bad can be run through the
 *  identical code path — the arms differ by ONE number and nothing else. */
function battery(arena, outer, label, emit) {
  const cov = coverage(arena, outer);
  const halfDiag = Math.hypot(arena.width / 2, arena.height / 2);
  const rows = [];
  const add = (id, pass, text) => { rows.push({ id, pass, text }); emit?.(id, pass, text, label); };

  add('§0 non-empty', cov.total > 0,
    `${cov.total.toLocaleString()} standable cells on a ${L} wu lattice — asserted BEFORE anything is asserted over the set`);
  add('§A coverage', cov.total > 0 && cov.outside === 0,
    `${cov.outside.toLocaleString()} of ${cov.total.toLocaleString()} standable cells (${cov.pct.toFixed(2)}%) outside a ${outer.toFixed(2)} wu canopy`
    + ` · furthest standable ${cov.maxR.toFixed(1)} wu at (${cov.worst?.x},${cov.worst?.y})`);
  add('§B corners', outer >= halfDiag,
    `canopy ${outer.toFixed(2)} vs half-diagonal ${halfDiag.toFixed(2)} — the claim the old comment and 779dc62's log both make`);
  add('§C camera rim', outer >= cov.maxR + CAMERA_REACH_WU,
    `canopy ${outer.toFixed(2)} vs furthest standable ${cov.maxR.toFixed(1)} + ${CAMERA_REACH_WU} wu of frustum reach = ${(cov.maxR + CAMERA_REACH_WU).toFixed(1)}`);
  return { rows, cov, halfDiag };
}

/**
 * §D — the value must be DERIVED, and this is the row a bigger LITERAL cannot pass.
 *
 * Two halves, and both are needed:
 *   1. the source expression carries **no numeric literal at all** — it is named constants
 *      and arithmetic. `1721`, `2481` and `ARENA_HALF_DIAGONAL + 760` all fail here.
 *   2. re-evaluating **that same expression** at the 1400×1000 map this one replaces still
 *      clears that map's requirement. A constant tuned to today's arena cannot.
 *
 * ⚠️ Half 1 alone would be satisfied by `ARENA_HALF_DIAGONAL` on its own (which fails §C),
 * and half 2 alone by any large literal — so they are ANDed and both are printed.
 */
function derivedRow(expr) {
  const noLiteral = !/\d/.test(expr);
  const OLD_W = 1400, OLD_H = 1000;
  let oldMapDerived = NaN;
  try { oldMapDerived = evalOuter(expr, OLD_W, OLD_H, APRON_OUT); } catch { /* a literal still evaluates */ }
  const oldMapNeeded = Math.hypot(OLD_W / 2 - PLAYER_SIZE / 2, OLD_H / 2 - PLAYER_SIZE / 2) + CAMERA_REACH_WU;
  const scales = Number.isFinite(oldMapDerived) && oldMapDerived >= oldMapNeeded;
  return {
    noLiteral,
    scales,
    pass: noLiteral && scales,
    text: `expr \`${expr}\` — numeric literal: ${noLiteral ? 'none' : 'PRESENT'}`
      + ` · the SAME expression at 1400×1000 gives ${Number.isFinite(oldMapDerived) ? oldMapDerived.toFixed(2) : 'n/a'}`
      + ` against a need of ${oldMapNeeded.toFixed(2)} — ${scales ? 'clears it' : 'SHORT'}`,
  };
}

function run() {
  const arena = loadArena();
  console.log(`\nKX_FOGCOVER  ${arena.width}×${arena.height}  ${arena.cover.length} cover  lattice ${L} wu`);
  console.log(`   FIELD_OUTER_UNITS = ${OUTER_EXPR} = ${FIELD_OUTER_UNITS.toFixed(2)} wu`);
  console.log(`   read from source: ARENA_HALF_DIAGONAL ${ARENA_HALF_DIAGONAL.toFixed(2)} · APRON_OUT ${APRON_OUT} · camera reach ${CAMERA_REACH_WU}`);
  if (arena.width !== ARENA_W || arena.height !== ARENA_H) {
    console.error(`   🚨 the dump is ${arena.width}×${arena.height} but shared.ts says ${ARENA_W}×${ARENA_H} — the dump is STALE.`);
    return 1;
  }
  let bad = 0;
  const { rows } = battery(arena, FIELD_OUTER_UNITS, 'shipped');
  const d = derivedRow(OUTER_EXPR);
  rows.push({ id: '§D derived', pass: d.pass, text: d.text });
  for (const r of rows) {
    if (!r.pass) bad++;
    console.log(`  ${r.pass ? 'ok  ' : 'FAIL'} - ${r.id}   ${r.text}`);
  }
  console.log(`\n${rows.length - bad} passed, ${bad} failed\n`);
  return bad;
}

async function selftest() {
  const arena = loadArena();
  let n = 0, bad = 0;
  const ok = (label, cond, evidence) => { n++; if (!cond) bad++; console.log(`  ${cond ? 'ok  ' : 'FAIL'} - ${label}${evidence ? `   ${evidence}` : ''}`); };
  console.log('\nKX_FOGCOVER --selftest');

  // The live gate must be green, or the known-bads below prove nothing.
  const live = battery(arena, FIELD_OUTER_UNITS, 'shipped');
  ok('the SHIPPED value passes every row', live.rows.every((r) => r.pass),
    live.rows.map((r) => `${r.id}:${r.pass ? 'ok' : 'FAIL'}`).join(' '));
  ok('§D: the shipped value IS a derivation, and it scales', derivedRow(OUTER_EXPR).pass,
    derivedRow(OUTER_EXPR).text);

  // ── KNOWN-BAD 1: THE SHIPPED LITERAL. This is the actual defect. ───────────
  const kb1 = battery(arena, 1500, 'literal-1500');
  const byId = (b, id) => b.rows.find((r) => r.id === id);
  ok('KNOWN-BAD 1500: §0 non-empty still PASSES (the set is real, not filtered away)', byId(kb1, '§0 non-empty').pass === true,
    byId(kb1, '§0 non-empty').text);
  ok('KNOWN-BAD 1500: §A coverage goes RED', byId(kb1, '§A coverage').pass === false,
    byId(kb1, '§A coverage').text);
  ok('KNOWN-BAD 1500: §B corners goes RED', byId(kb1, '§B corners').pass === false,
    byId(kb1, '§B corners').text);
  ok('KNOWN-BAD 1500: §C camera rim goes RED', byId(kb1, '§C camera rim').pass === false,
    byId(kb1, '§C camera rim').text);

  // ── KNOWN-BAD 2: THE TEMPTING WRONG FIX — retype a bigger literal. ─────────
  // 1721 reaches the corners, so §A and §B go green and only §C and §D can catch it. That
  // is the whole reason §D exists: `DECISIONS §60`'s "a green fixture testing something
  // nobody chose", one map change away from being this bug again.
  const kb2 = battery(arena, 1721, 'literal-1721');
  ok('KNOWN-BAD 1721: §B corners PASSES — a bigger literal looks fixed', byId(kb2, '§B corners').pass === true);
  ok('KNOWN-BAD 1721: §A coverage PASSES — and it is still the same bug', byId(kb2, '§A coverage').pass === true,
    byId(kb2, '§A coverage').text);
  ok('KNOWN-BAD 1721: §C camera rim goes RED', byId(kb2, '§C camera rim').pass === false,
    byId(kb2, '§C camera rim').text);
  ok('KNOWN-BAD 1721: §D derived goes RED', derivedRow('1721').pass === false,
    derivedRow('1721').text);
  ok('KNOWN-BAD `ARENA_HALF_DIAGONAL + 760`: §D goes RED on the half-fixed form',
    derivedRow('ARENA_HALF_DIAGONAL + 760').pass === false,
    derivedRow('ARENA_HALF_DIAGONAL + 760').text);
  // ⚠️ THIS ROW EXPECTED §D TO PASS AND IT DID NOT, WHICH IS THE BETTER ANSWER — the old
  //    wording was *"§D passes but §C goes RED: a derivation can still be too small"*. It is
  //    kept because the correction is the useful part: §D's SCALE half already refuses
  //    `ARENA_HALF_DIAGONAL` alone (860.23 at the 1×  map against a need of 1300.95), so
  //    "no numeric literal" is NOT sufficient to pass §D and the two halves are doing
  //    different work. §C is still a separate row, and still the one that reports the RIM.
  const halfOnly = derivedRow('ARENA_HALF_DIAGONAL');
  ok('KNOWN-BAD `ARENA_HALF_DIAGONAL` alone: no literal, but BOTH §D-scale and §C go RED',
    halfOnly.noLiteral === true && halfOnly.scales === false
      && battery(arena, ARENA_HALF_DIAGONAL, 'halfdiag-only').rows.find((r) => r.id === '§C camera rim').pass === false,
    `${halfOnly.text} — a derivation can still be too small`);

  // ── KNOWN-BAD 3: a canopy that reaches everything but is NOT the derivation.
  // Proves §D is not satisfied by "big enough", which would make it a tautology.
  ok('KNOWN-BAD 9999: §A/§B/§C all pass but §D goes RED', battery(arena, 9999, 'huge').rows.every((r) => r.pass) && derivedRow('9999').pass === false,
    'a value can be large enough and still not be derived');

  // ── §0's own known-bad: a coverage() over an EMPTY set must not report success. ──
  const emptyArena = { ...arena, cover: [{ x: arena.width / 2, y: arena.height / 2, w: arena.width * 2, h: arena.height * 2 }] };
  const ecov = coverage(emptyArena, 1);
  ok('VACUITY CONTROL: an arena with no standable cell fails §0 rather than passing §A',
    ecov.total === 0 && battery(emptyArena, 1, 'empty').rows.find((r) => r.id === '§A coverage').pass === false,
    `total ${ecov.total}, outside ${ecov.outside} — "0 of 0 outside" must NOT read as green`);

  // ── The scale invariance §D leans on, checked directly on the map that shipped before. ──
  const oldArena = {
    width: 1400, height: 1000, center: { x: 700, y: 500 },
    cover: [], hazards: [], concealment: [],
  };
  const oldDerived = Math.hypot(700, 500) + APRON_OUT;
  const oldBat = battery(oldArena, oldDerived, '1400×1000');
  ok('the SAME expression is green on the 1400×1000 map this replaces', oldBat.rows.every((r) => r.pass),
    `derived ${oldDerived.toFixed(2)} · ${oldBat.rows.map((r) => `${r.id}:${r.pass ? 'ok' : 'FAIL'}`).join(' ')}`);
  ok('…and the shipped LITERAL 1500 was green on that map too — which is why it survived',
    battery(oldArena, 1500, '1400×1000').rows.every((r) => r.pass),
    'the constant was correct when it was written; the map moved under it');

  console.log(`\n${n - bad} passed, ${bad} failed\n`);
  return bad;
}

if (IS_MAIN) {
  process.exit(has('selftest') ? ((await selftest()) ? 1 : 0) : (run() ? 1 : 0));
}
