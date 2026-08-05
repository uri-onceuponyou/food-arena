#!/usr/bin/env node
/**
 * THE FIX LADDER — one `ai.ts` per fix, so each can be priced on its own.
 *
 * This pass found four defects in one file. "The four together cost X" is not a
 * declaration, it is an average of four different answers, and
 * `docs/DECISIONS-FOR-URI.md` §12 exists precisely because a difficulty shift has to be
 * stated as itself. So the ladder is built out of the SHIPPED file — each rung a small,
 * asserted, textual edit — and every rung is measured against the same seeds:
 *
 *   V0   pristine HEAD behaviour, re-expressed through the new selector   (the CONTROL)
 *   V1b  V0 + the chase branch's weapon choice un-gated on stun, and nothing else
 *   V1   V0 + a stun locks movement only                                  (task 1)
 *   V2   V1 + weapons ranked by delivered damage per press                (task 2)
 *   V3   V2 + the flee branch may select a melee weapon      == THE SHIPPED FILE (task 3)
 *   V4   V3 + the flee branch aims at the player             == THE PARKED PATCH
 *   V5   V4 + the flee branch fires OR moves, like the chase branch
 *
 * V0 must come out BIT-IDENTICAL to pristine HEAD across all 440 matchup rates — it did
 * — or the ladder is measuring the rewrite instead of the fixes and every rung is void.
 *
 * V4 is the patch for the one defect that is measured and NOT landed: a two-word deletion
 * worth -25.9 pp of aggregate player win rate. Generating it here means the decision Uri
 * is being asked to make comes with the exact diff, not a description of one.
 *
 *   node tools/tmp/ai_ladder.mjs <outdir>
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const outdir = process.argv[2];
if (!outdir) { console.error('usage: ai_ladder.mjs <outdir>'); process.exit(1); }
mkdirSync(outdir, { recursive: true });

/** The shipped file — V3. Every rung is an edit of it. */
const SHIPPED = readFileSync(`${ROOT}/src/game/ai.ts`, 'utf8');

/** Textual edit that refuses to guess. A rung that silently patched nothing would give a
 *  confident, entirely fictional "this fix was free" row — `docs/LESSONS.md` §13. */
function edit(src, label, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) {
    console.error(`ai_ladder: "${label}" matched ${n} times — refusing to guess`);
    process.exit(2);
  }
  return src.replace(from, to);
}

const FLEE_AIM = '    if (hasBearing) enemy.facing = { x: -adx / adist, y: -ady / adist };\n';
/** The shipped line plus the comment that exists only to explain why it is still there. */
const FLEE_AIM_BLOCK = `    // ⚠️ THE ONE LINE. Aim, not travel — and it is what sends the shot below in the wrong
    // direction. Left in place deliberately; the facing block above carries the
    // measurement, the price and why this is Uri's call and not this file's.
${FLEE_AIM}`;

// ── V4: THE PARKED PATCH. Delete the flee branch's aim-away line. ───────────
const v4 = edit(SHIPPED, 'flee aims at the player', FLEE_AIM_BLOCK, '');

// ── V5: V4, with the flee branch firing OR moving like the chase branch ─────
// V4 leaves the flee half strictly better than the chase half: chase fires XOR moves,
// flee has always done both in one tick, so with the flee shot landing a WOUNDED AI
// becomes more dangerous than a healthy one. Measured: it changes nothing (6.1% vs
// 5.9%) — with three weapons cycling, a weapon is ready on nearly every tick either way.
const v5 = edit(
  edit(v4, 'flee fires or moves',
    '  if (fleeing) {\n    if (!rooted) {',
    `  if (fleeing) {
    const fleeShot = healIndex ?? pickWeapon(state, adist, ALLOW_OFFENSIVE, rankPressValue);
    if (fleeShot !== null) {
      attemptAttack(state, 'enemy', fleeShot, events);
    } else if (!rooted) {`),
  'the fire-and-move shot removed',
  '    const shotIndex = healIndex ?? pickWeapon(state, adist, ALLOW_OFFENSIVE, rankPressValue);\n    if (shotIndex !== null) attemptAttack(state, \'enemy\', shotIndex, events);\n', '');

// ── V2: the flee branch back on "the first RANGED weapon in range" ──────────
const RANGED_DEFS = `/** LADDER RUNG: the pre-fix flee filter — ranged only, which is what left the one
 *  melee-only character with nothing selectable. */
const ALLOW_RANGED_ONLY: WeaponAllow = { melee: false, ranged: true, self: false };
/** LADDER RUNG: the pre-fix flee rank — take the FIRST match, not the best. */
const rankFirstRanged: WeaponRank = (_state, _w, index) => -index;

const rankPressValue: WeaponRank`;
let v2 = edit(SHIPPED, 'ranged-only defs', 'const rankPressValue: WeaponRank', RANGED_DEFS);
v2 = edit(v2, 'flee picks ranged only',
  'healIndex ?? pickWeapon(state, adist, ALLOW_OFFENSIVE, rankPressValue);\n    if (shotIndex !== null)',
  'healIndex ?? pickWeapon(state, adist, ALLOW_RANGED_ONLY, rankFirstRanged);\n    if (shotIndex !== null)');

// ── V1: rank by the authored `damage` field again ───────────────────────────
const v1 = edit(v2, 'rank by authored damage',
  'export function pressValue(w: Weapon, adist: number): number {',
  'export function pressValue(w: Weapon, adist: number): number {\n  // LADDER RUNG: the pre-fix key is applied in `rankPressValue`; this stays exact so the\n  // 183-cell estimator assertion still means something on this rung.')
  .replace('const rankPressValue: WeaponRank = (_state, w, _index, adist) => pressValue(w, adist);',
    '/** LADDER RUNG: the pre-fix key — the authored per-pellet `damage` field. */\nconst rankPressValue: WeaponRank = (_state, w) => w.damage;');
if (v1.includes('(_state, w, _index, adist) => pressValue')) {
  console.error('ai_ladder: v1 did not swap the ranking key'); process.exit(2);
}

// ── V0: the stun back to silencing as well as rooting. THE CONTROL. ─────────
let v0 = edit(v1, 'facing re-gated on stun',
  '  if (hasBearing) {\n    enemy.facing = { x: adx / adist, y: ady / adist };\n  }',
  '  if (!rooted && hasBearing) {\n    enemy.facing = { x: adx / adist, y: ady / adist };\n  }');
v0 = edit(v0, 'escape re-gated on stun', 'const escaping = urgent && !rooted;', 'const escaping = urgent || rooted;');
v0 = edit(v0, 'flee aim back inside the movement guard', `${FLEE_AIM}    if (!rooted) {`,
  `    if (!rooted) {\n  ${FLEE_AIM}`);
v0 = edit(v0, 'flee shot re-gated on stun',
  'const shotIndex = healIndex ?? pickWeapon(state, adist, ALLOW_RANGED_ONLY, rankFirstRanged);',
  'const shotIndex = rooted ? null : (healIndex ?? pickWeapon(state, adist, ALLOW_RANGED_ONLY, rankFirstRanged));');

// ── V1b: the NARROWEST possible reading of the stun finding ─────────────────
// `ed8de35` priced the stun asymmetry at -9.5 pp and described it as "ai.ts:stepAI gates
// chosenIndex on aiFrozen". Taken literally that is ONE clause — the chase branch's
// weapon choice — not the facing, the heal or the flee branch, which the same flag also
// gated. This rung un-gates exactly that clause, so the -9.5 pp on record and the price
// of the whole rule can be compared rather than contradicted. (Measured: -7.8 pp.)
const v1b = edit(v0, 'chase weapon choice un-gated only',
  'const chosenIndex = escaping ? null :', 'const chosenIndex = urgent ? null :');

writeFileSync(`${outdir}/v0-control.ts`, v0);
writeFileSync(`${outdir}/v1b-chase-only.ts`, v1b);
writeFileSync(`${outdir}/v1-stun-symmetry.ts`, v1);
writeFileSync(`${outdir}/v2-press-value.ts`, v2);
writeFileSync(`${outdir}/v3-shipped.ts`, SHIPPED);
writeFileSync(`${outdir}/v4-flee-aims-at-player.ts`, v4);
writeFileSync(`${outdir}/v5-flee-xor.ts`, v5);
console.error(`wrote v0, v1b, v1, v2, v3 (shipped), v4 (the parked patch), v5 to ${outdir}`);
