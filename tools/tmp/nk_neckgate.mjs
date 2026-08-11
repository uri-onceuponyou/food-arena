#!/usr/bin/env node
/**
 * nk_neckgate — THE NECK RULE AS A GATE. `rg_neckz` prints a table; nothing failed.
 *
 * THROWAWAY. READ-ONLY on `src/`. Measurement instrument; changes no game code.
 * Offline — no browser, no snapshot. It shells `rg_neckz.mjs --json` and applies the
 * rule to it, so there is exactly ONE implementation of the occlusion arithmetic.
 *
 * ── WHAT THE OLD CHECK MEASURED ON TACO, AND WHY IT WAS THE WRONG QUESTION ───
 * `rig.ts` carried a table of DELIVERED NECK PIXELS at the MATCH camera (pitch 58)
 * and read the shortfall as a defect: *"86% of it never reaches the screen ... the
 * widening that would fix it is 2.1x to 3.5x."* Taco's row — **782 of 2168 delivered,
 * 0.361, the LARGEST ratio of the six** — was therefore read as the HEALTHIEST.
 *
 * It was the sickest. Uri, on taco: *"No mouth, seems like a hat or something."*
 * **The 782 pixels ARE the hat.** The column is a cylinder of radius 0.171 m on the
 * rig's own axis, so it reaches z = +0.171; taco's face is on a wall leaning back
 * 0.26 rad and only reaches z = +0.017. The column stood 0.15 m IN FRONT OF the face.
 * Every pixel it delivered was a pixel of a third mass at the character's most
 * prominent junction — a crown, with the collar as its brim.
 *
 * The instrument was measuring correctly and interpreting the wrong thing: it counted
 * pixels in a band and called a full band a shortfall, when a full band is the defect.
 * `25d5579` flipped the sign in prose and built `rg_neckz` to compute the 3D fact
 * instead. **Nothing has ever FAILED on it.** That is this file.
 *
 * ── WHAT IS MEASURED NOW ────────────────────────────────────────────────────
 *   A neck column must be BEHIND the mass above it, at BOTH shipped cameras.
 *
 * `rg_neckz` computes `max over the mass of (V.z - P.z - (V.y - P.y)/tan p)` swept
 * down the column's built extent; `exposed` is the share of that extent nothing
 * covers. The rule is `exposed == 0` at pitch 20 AND pitch 58, and it is checked on
 * the characters that actually BUILD a column — a character with `neckFraction: 0`
 * has no column to expose and is not a subject.
 *
 * ── 🚨 THAT FILTER IS THE DANGEROUS PART, AND IT IS WHY G1 AND G2 EXIST ──────
 * Today the filter selects **exactly one character, burrito.** Ten of eleven have
 * migrated off the column (`taco` by hand, `pizza`/`soup`/`sushi`/`hotdog` through
 * `withoutNeck()`, the four STUB characters and `hamburger` by never opting in). One
 * more migration and the subject set is EMPTY — and `[].every()` is `true`, so this
 * gate would print PASS forever while checking nothing. Three controls went vacuous
 * that way in a single session on this project.
 *
 * So the exposure clause is guarded by two clauses that cannot go vacuous:
 *   G1 the builder set is NON-EMPTY;
 *   G2 it equals the pinned roster below.
 * G2 makes a migration or a re-opt-in a deliberate edit to this file with a reason,
 * rather than a silent change in what the gate covers.
 *
 * ── ⚠️ WHAT THIS GATE DOES **NOT** COVER, STATED SO NOBODY INFERS IT ─────────
 * **ATTACHMENT.** Deleting the column deletes the one piece of geometry that spans
 * `torsoTopY` to the food mass, and `a44d36d` shipped exactly that defect: with
 * `neck_column` gone, hotdog's and sushi's heads became their own 68,940 px and
 * 121,177 px islands at the lobby camera. Zero exposure and a detached head are both
 * "zero neck pixels" — this gate cannot tell them apart and must not be read as if it
 * could. The two tools that can, both with known-bads that FAIL on the real defect:
 *
 *   node tools/tmp/n2_geom.mjs --knownbad sort          # offline, metres
 *   PREVIEW_BASE=... node tools/tmp/nm_island.mjs --ids <ids> --pitch 20 \
 *        --knownbad split --dy 0.5                      # pixels, the verdict
 *
 * Measured 2026-08-11 on a frozen snapshot of the working tree, pitch 20, and quoted
 * here because a gate that names its blind spot should also name the number that
 * currently fills it: burrito / hotdog / sushi **1 component each**, taco 3 — and
 * taco's two extras are ABLATED rather than assumed to be innocent: `n2_probe --hide
 * taco_lettuce` matches 18 objects and takes it 3 -> 1, so they are its lettuce sprigs
 * and not its neck. `--knownbad split` (head lifted 0.5 m) **DETECTED on 4 of 4** — the
 * detector still fails on a genuinely detached head, which is what makes the zeros mean
 * anything.
 *
 * ── USE ─────────────────────────────────────────────────────────────────────
 *   node tools/tmp/nk_neckgate.mjs              # the gate
 *   node tools/tmp/nk_neckgate.mjs --selftest   # known-bad inputs
 *   node tools/tmp/nk_neckgate.mjs --json out.json
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const flag = (k) => argv.includes(k);

/**
 * 🔴 THE PINNED ROSTER. Every character whose rig BUILDS `neck_column`.
 *
 * Changing this list is the point: it is the declaration that the change in what this
 * gate covers was intended. If you migrate a character off the column, remove it here
 * AND record why in the commit; if you opt one in, add it here AND satisfy G3.
 *
 *   burrito — LANKY, `neckFraction: 0.065`, column radius 0.0718 m. Its wrap overhangs
 *             its own chin by +0.1234 m at BOTH pitches, so the column is 0.000 exposed
 *             at 20 and at 58. The ablated lobby capture measures 0 px of it, which is
 *             the shipped-render agreement that makes this row trustworthy.
 */
const NECK_BUILDERS = ['burrito'];

/** Exposure tolerance. `exposed` is a share of a swept extent; 0 is exact. */
const MAX_EXP = Number(arg('--maxexp', '0'));

/** Run `rg_neckz --json` and return its rows. */
function neckz() {
  const dir = mkdtempSync(path.join(tmpdir(), 'nk-neckgate-'));
  const out = path.join(dir, 'neckz.json');
  try {
    execFileSync('node', ['tools/tmp/rg_neckz.mjs', '--json', out], {
      cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(readFileSync(out, 'utf8'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The rule, as a pure function of rg_neckz's rows. Pure so the known-bads can feed it
 * mutated rows rather than mutating the tree — the same reason `rg_neckz`'s own
 * selftest builds synthetic masses.
 */
export function judge(data, { builders = NECK_BUILDERS, maxExp = MAX_EXP } = {}) {
  const rows = data.rows;
  const built = rows.filter((r) => r.built).map((r) => r.id).sort();
  const faults = [];

  // ── G1 NON-VACUOUS ────────────────────────────────────────────────────────
  // Asserted BEFORE the universally-quantified clause below, because `[].every()`
  // is `true` and an empty subject set is how a control reports PASS while checking
  // nothing. This is the assertion, not a comment about one.
  if (built.length === 0) {
    faults.push({ id: '-', clause: 'G1', msg: 'NO character builds a neck column — G3 below would be VACUOUS' });
  }

  // ── G2 PINNED ROSTER ──────────────────────────────────────────────────────
  const pin = [...builders].sort();
  const missing = pin.filter((id) => !built.includes(id));
  const extra = built.filter((id) => !pin.includes(id));
  for (const id of missing) {
    faults.push({ id, clause: 'G2', msg: 'pinned as a neck builder but builds NO column — migrated? update NECK_BUILDERS and say why' });
  }
  for (const id of extra) {
    faults.push({ id, clause: 'G2', msg: 'builds a neck column but is NOT pinned — opting in is a decision; add it to NECK_BUILDERS' });
  }

  // ── G3 EXPOSURE, at BOTH shipped cameras ──────────────────────────────────
  // Both, and not just the lobby: the rule is a 3D fact and `25d5579` measured that
  // the ORDERING is not preserved between the two pitches, so neither camera alone
  // is a proxy for the other.
  for (const r of rows) {
    if (!r.built) continue;
    for (const [cam, pitch] of [['lobby', data.LOBBY], ['match', data.MATCH]]) {
      const e = r[cam].exposed;
      if (e > maxExp) {
        faults.push({
          id: r.id, clause: 'G3',
          msg: `column EXPOSED at pitch ${pitch}: ${e.toFixed(3)} of its extent uncovered, short ${r[cam].worst.toFixed(4)} m of forward overhang (nearest mass: ${r[cam].worstBy})`,
        });
      }
    }
  }

  return { built, faults };
}

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST. Every clause above gets an input that MUST fail it.
// ─────────────────────────────────────────────────────────────────────────────
function selftest() {
  let pass = 0, fail = 0;
  const ok = (cond, name, detail = '') => {
    if (cond) { pass++; console.log(`  ok   ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`  🔴   ${name}${detail ? `  ${detail}` : ''}`); }
  };
  const clone = (d) => JSON.parse(JSON.stringify(d));
  const live = neckz();

  console.log('nk_neckgate selftest — known-bad inputs first\n');

  // ── KNOWN-BAD 1: the shipped cast with every opted-out character opting back IN.
  // This is the defect the whole neck pass exists to prevent, and taco is the exact
  // character Uri reported. If this passes, the gate is measuring nothing.
  {
    const bad = clone(live);
    for (const r of bad.rows) r.built = true;
    const ids = bad.rows.map((r) => r.id);
    const v = judge(bad, { builders: ids });
    const g3 = v.faults.filter((f) => f.clause === 'G3');
    ok(g3.length > 0, 'KNOWN-BAD optin: a cast that all opts IN trips G3', `${g3.length} exposure faults`);
    const taco = g3.find((f) => f.id === 'taco');
    ok(!!taco, 'KNOWN-BAD optin: TACO is caught by name — the character that shipped the hat',
      taco ? taco.msg.slice(0, 60) : 'NOT CAUGHT');
    // And the magnitude is the one on record, not merely "nonzero".
    const t = bad.rows.find((r) => r.id === 'taco');
    ok(t.lobby.exposed > 0.8 && t.match.exposed > 0.7,
      'KNOWN-BAD optin: and it is caught at BOTH cameras, 0.833 / 0.778 on record',
      `${t.lobby.exposed.toFixed(3)} / ${t.match.exposed.toFixed(3)}`);
  }

  // ── KNOWN-BAD 2: the vacuous set. `[].every()` is `true`; G1 must refuse it.
  {
    const bad = clone(live);
    for (const r of bad.rows) r.built = false;
    const v = judge(bad, { builders: [] });
    const g1 = v.faults.filter((f) => f.clause === 'G1');
    ok(g1.length === 1, 'KNOWN-BAD empty: an empty builder set FAILS G1 rather than passing vacuously',
      `${g1.length} G1 fault(s)`);
    // ...and prove the exposure clause really would have been vacuous, i.e. that G1
    // is load-bearing rather than decorative.
    ok(v.faults.filter((f) => f.clause === 'G3').length === 0,
      '...and G3 alone would indeed have said nothing — G1 is what is holding it up');
  }

  // ── KNOWN-BAD 3: a silent migration. burrito drops its column; the pin must notice.
  {
    const bad = clone(live);
    for (const r of bad.rows) if (r.id === 'burrito') { r.built = false; r.gap = 0; }
    const v = judge(bad);
    ok(v.faults.some((f) => f.clause === 'G2' && f.id === 'burrito'),
      'KNOWN-BAD migrate: the pinned builder losing its column trips G2');
  }

  // ── KNOWN-BAD 4: a silent opt-in. taco gets its column back without the pin moving.
  {
    const bad = clone(live);
    for (const r of bad.rows) if (r.id === 'taco') { r.built = true; r.gap = 0.1155; }
    const v = judge(bad);
    ok(v.faults.some((f) => f.clause === 'G2' && f.id === 'taco'),
      'KNOWN-BAD optin-silent: an UNPINNED character growing a column trips G2');
    ok(v.faults.some((f) => f.clause === 'G3' && f.id === 'taco'),
      '...and trips G3 as well, so the pin is not the only thing standing between the cast and a hat');
  }

  // ── KNOWN-BAD 5: an injected regression on the one row the gate really covers.
  {
    const bad = clone(live);
    const b = bad.rows.find((r) => r.id === 'burrito');
    b.lobby.exposed = 0.25; b.lobby.worst = -0.05;
    const v = judge(bad);
    const f = v.faults.find((x) => x.clause === 'G3' && x.id === 'burrito');
    ok(!!f, 'KNOWN-BAD regress: burrito exposed 0.25 at the LOBBY trips G3', f ? f.msg.slice(0, 50) : '');
  }
  {
    const bad = clone(live);
    const b = bad.rows.find((r) => r.id === 'burrito');
    b.match.exposed = 0.25; b.match.worst = -0.05;
    const v = judge(bad);
    ok(v.faults.some((x) => x.clause === 'G3' && x.id === 'burrito'),
      'KNOWN-BAD regress: and exposure at the MATCH camera alone trips it too');
  }

  // ── KNOWN-BAD 6: THE OLD RULE AND THE NEW ONE DISAGREE ON TACO, BY CONSTRUCTION.
  // The pre-`25d5579` table, verbatim from `rig.ts`: delivered / foot at pitch 58,
  // read as a shortfall to be closed. Under it taco ranked BEST of the six. Under the
  // rule above taco ranks WORST of the same six. A gate whose verdict agreed with the
  // old reading would be the old bug wearing new arithmetic.
  {
    const OLD = { taco: 782 / 2168, hotdog: 301 / 1503, pizza: 42 / 798, burrito: 0 / 565, sushi: 0 / 939, soup: 0 / 2199 };
    const ids = Object.keys(OLD);
    const oldBest = ids.slice().sort((a, b) => OLD[b] - OLD[a])[0];
    const expOf = (id) => live.rows.find((r) => r.id === id).lobby.exposed;
    const newWorst = ids.slice().sort((a, b) => expOf(b) - expOf(a))[0];
    ok(oldBest === 'taco', 'OLD RULE: "delivered pixels are a shortfall" ranked taco the HEALTHIEST of six',
      `${oldBest} at ${OLD.taco.toFixed(3)} delivered`);
    ok(newWorst === 'taco', 'NEW RULE: exposure at the lobby ranks taco the WORST of the same six',
      `${newWorst} at ${expOf('taco').toFixed(3)} exposed`);
    ok(oldBest === newWorst, 'THE TWO RULES INVERT ON THE SAME CHARACTER — the sign really did flip');
  }

  // ── ORDER-INDEPENDENCE. A verdict that depends on row order is not a verdict.
  {
    const shuf = clone(live);
    shuf.rows.reverse();
    ok(JSON.stringify(judge(shuf).faults) === JSON.stringify(judge(live).faults),
      'ORDER: reversing the row order does not change the verdict');
  }

  // ── SELF-PAIR. Two reads of the same tree agree with themselves.
  {
    const a = JSON.stringify(judge(live));
    const b = JSON.stringify(judge(clone(live)));
    ok(a === b, 'SELF-PAIR: the same input judged twice is identical');
  }

  // ── THE PIN IS ABOUT REAL CHARACTERS. A typo in NECK_BUILDERS must not pass.
  {
    const known = new Set(live.rows.map((r) => r.id));
    ok(NECK_BUILDERS.every((id) => known.has(id)) && NECK_BUILDERS.length > 0,
      'PIN: every pinned id is a real character', NECK_BUILDERS.join(', '));
  }

  // ── LIVE: the shipped tree passes.
  {
    const v = judge(live);
    ok(v.faults.length === 0, 'LIVE: the shipped tree passes all three clauses',
      v.faults.length ? v.faults.map((f) => `${f.clause}/${f.id}`).join(', ') : `builders: ${v.built.join(', ')}`);
  }

  console.log(`\n  ${pass} pass, ${fail} fail`);
  return fail;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN. Guarded, because this module exports `judge` — three tools here made the
// whole CLI path run on import by exporting one function (`docs/AGENT-BRIEF.md` §3).
// ─────────────────────────────────────────────────────────────────────────────
const IS_MAIN = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_MAIN) {
  if (flag('--selftest')) {
    process.exit(selftest() ? 1 : 0);
  } else {
    const data = neckz();
    const v = judge(data);
    console.log(`nk_neckgate — a built neck column must be BEHIND the mass above it, at pitch ${data.LOBBY} AND ${data.MATCH}.`);
    console.log(`builds a column: ${v.built.length ? v.built.join(', ') : '(none)'}   pinned: ${NECK_BUILDERS.join(', ') || '(none)'}\n`);
    for (const r of data.rows) {
      if (!r.built) continue;
      console.log(`  ${r.id.padEnd(12)} r ${r.r.toFixed(4)}  gap ${r.gap.toFixed(4)}`
        + `  exp@${data.LOBBY} ${r.lobby.exposed.toFixed(3)}  exp@${data.MATCH} ${r.match.exposed.toFixed(3)}`);
    }
    console.log('\n  ⚠️ ATTACHMENT IS NOT CHECKED HERE — see the header. `n2_geom --knownbad sort`');
    console.log('     and `nm_island --knownbad split` are the tools that can tell a hidden');
    console.log('     column apart from a head that fell off.\n');
    for (const f of v.faults) console.log(`  🔴 ${f.clause} ${f.id}: ${f.msg}`);
    const jsonOut = arg('--json', null);
    if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ generated: new Date().toISOString(), ...v }, null, 1));
    console.log(v.faults.length ? `\n🔴 ${v.faults.length} fault(s)` : '\n✓ PASS');
    process.exit(v.faults.length ? 1 : 0);
  }
}
