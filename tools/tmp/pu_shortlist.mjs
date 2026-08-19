#!/usr/bin/env node
/**
 * pu_shortlist — what to type into the §76 panel FIRST, derived from the registry itself.
 *
 * 216 fields is not a starting point. This reads the LIVE registry (not a hand-written
 * list, which would be the twelfth copy of a module list this repo has had to delete) and
 * prints, for each candidate lever: the tab it is on, the authored value, its legal band,
 * every derived value that MOVES when you move it, and the filter string that puts the
 * whole group of related levers on one screen.
 *
 * ⚠️ `matchesQuery` in `adminScreen.ts` matches KEY **or** DOC, case-insensitively, as a
 * plain substring — so the filter box is the only grouping mechanism the shipped panel has.
 * There is no bookmark/pin feature and adding one is outside this pass's file set.
 *
 * Usage:  node tools/tmp/pu_shortlist.mjs [--filter <query>]
 */
import {
  allEntries, derivedEntries, entryFor, hasKey, previewDerived, assertRegistryPopulated,
} from '../../src/game/tuning/index.ts';

assertRegistryPopulated();
const entries = allEntries();

const argv = process.argv.slice(2);
const fi = argv.indexOf('--filter');

/** Exactly `adminScreen.ts:matchesQuery`, re-derived here so the answer is not guessed. */
const matches = (e, q) => !q || e.key.toLowerCase().includes(q) || e.doc.toLowerCase().includes(q);

if (fi >= 0) {
  const q = String(argv[fi + 1] ?? '').toLowerCase();
  const hit = entries.filter((e) => matches(e, q));
  const byGroup = new Map();
  for (const e of hit) byGroup.set(e.group, [...(byGroup.get(e.group) ?? []), e]);
  console.log(`filter "${q}" → ${hit.length} row(s) across ${byGroup.size} tab(s)`);
  for (const [g, list] of byGroup) {
    console.log(`  ${g}:`);
    for (const e of list) console.log(`    ${e.kind === 'authored' ? ' ' : '·'} ${e.key}`);
  }
  process.exit(0);
}

/**
 * The candidates, and every one of them comes from a question Uri already asked —
 * `DECISIONS-FOR-URI.md` §75(b), §80 and §77's correction. Nothing here is invented.
 */
const SHORTLIST = [
  ['PLAYER_SPEED', '§75(b) — the RATIO to AI_CHASE_SPEED is the open question; answered, never landed'],
  ['AI_CHASE_SPEED', '§75(b) — the other half of the ratio. Move BOTH or you are moving the gap'],
  ['AI_FLEE_SPEED', '§75(b) — the third speed; the filter "speed" puts all three on one screen'],
  ['STUN_DURATION_MS', '§80 — the stun is the GATE on every super being dodgeable'],
  ['SLOW_DURATION_MS', '§80 — the other half of the status lock; §75 measured an 83% duty cycle'],
  ['STUN_GRACE_MS', '§80 — the DR window that decides whether the lock is escapable'],
  ['MATCH_DURATION_MS', 'the clock. ⚠️ SUDDEN_DEATH_MS does NOT follow it — see the consequences'],
];

let missing = 0;
console.log('');
for (const [key, why] of SHORTLIST) {
  if (!hasKey(key)) { console.log(` MISSING  ${key} — not in the registry`); missing++; continue; }
  const e = entryFor(key);
  const band = e.kind === 'authored' ? `${e.min} … ${e.max}${e.int ? ' int' : ''}` : 'derived, read-only';
  console.log(`  ${key}`);
  console.log(`      tab ${e.group} · authored ${e.authored ?? e.value} ${e.unit} · band ${band}`);
  console.log(`      ${why}`);
  if (e.kind === 'authored') {
    // Move it by a visible amount and print what else moves. A field whose consequence
    // list is empty is a field you can tune without reading anything else.
    //
    // ⚠️ The walk is over EVERY derived scalar, not over a declared `affects` map — the
    // transitive case is the one that bites (`FOG_CLOSE_MS` reaches
    // `SUDDEN_DEATH_REMAINING_MS` only through `SUDDEN_DEATH_MS`), and a direct-inputs-only
    // reader is the exact known-bad mutant `tun_gate.mjs` keeps.
    const probe = e.authored * 0.6;
    let moved = 0;
    for (const d of derivedEntries()) {
      if (d.kind !== 'derived') continue;
      let before; let after;
      try { before = previewDerived(d.key, {}); after = previewDerived(d.key, { [key]: probe }); }
      catch { continue; }
      if (Math.abs(after - before) < 1e-9) continue;
      moved++;
      console.log(`      ⤷ ${d.key}: ${before} → ${after}   (at ${key}=${probe})`);
    }
    if (!moved) console.log('      moves nothing derived');
  }
  console.log('');
}

// ⚠️ NON-EMPTY FIRST (CLAUDE.md #6): a shortlist that quietly found nothing must not read
// like a shortlist that found everything.
if (missing === SHORTLIST.length) {
  console.error('pu_shortlist: EVERY key was missing — the registry is not populated, or the keys are stale.');
  process.exit(1);
}
console.log(`pu_shortlist: ${SHORTLIST.length - missing}/${SHORTLIST.length} levers present in a registry of ${entries.length} entries`);
if (missing) process.exit(1);
