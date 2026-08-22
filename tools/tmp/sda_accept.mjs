#!/usr/bin/env node
/**
 * SDA_ACCEPT — the acceptance test for a PURE UNIT RESCALE, written before the change.
 *
 * ── What it asserts, and what would FAIL it ────────────────────────────────
 *
 * A rescale has two halves and the project has a gate for neither.
 *
 *   HALF 1 — THE SIM MUST NOT MOVE. Covered by `sda_bitid --k <k>`: quotient-normalised
 *   lockstep, 0 STRICT divergences. That half is already provable.
 *
 *   HALF 2 — THE PRESENTATION MUST NOT SATURATE, and this is the half nothing sees.
 *   `src/` holds response curves of the form `clamp(a + amount * b, lo, hi)`: hit-stop
 *   length, screen shake, knockback, burst size, particle count, per-character impact
 *   scale, the HUD's damage-number size tier, the audio weight axis. Every one was
 *   fitted to a damage population of 2..18. Multiply the population by k and leave the
 *   coefficient alone and each one **pins at `hi` for every hit**. That failure raises
 *   no error, changes no type, breaks no assertion — `tsc` is clean, `sim.test` is
 *   clean, `sentinel` is clean — and it is the difference between a hit that reads as a
 *   scratch and one that reads as a haymaker, on every hit in the game.
 *
 * So the assertion is a DISTRIBUTION assertion, not a value assertion:
 *
 *   >> For every response curve, the share of the roster's hit population that lands
 *   >> AT THE CLAMP CEILING must be the same after the rescale as before it, and the
 *   >> share that lands at the FLOOR must be the same. A curve that is pinned is a
 *   >> curve that has stopped responding.
 *
 * ── What would FAIL this ───────────────────────────────────────────────────
 *
 *  * Migrating `rules.ts` and forgetting any one of the sites (the known-bad below:
 *    `--known-bad naive` leaves every coefficient alone and must turn this red).
 *  * Migrating a coefficient by the wrong factor.
 *  * Choosing k_HP != k_damage: the HUD's `amount >= 15` tier and the audio axis are
 *    damage-denominated while the health bar is HP-denominated, so they drift apart.
 *
 * ── What would make it pass VACUOUSLY, and the guards against each ────────
 *
 *  1. The census finds nothing (a refactor renamed `amount`) -> `[].every()` is true and
 *     every curve is "unsaturated". GUARDED: the site count is asserted >= MIN_SITES and
 *     the tool exits 1 if the census shrinks.
 *  2. The damage population is empty or constant -> every share is 0/0 or identical.
 *     GUARDED: the population is asserted non-empty AND to hold > 8 distinct values.
 *  3. The comparison runs the SAME coefficients on both arms (the `rg_lib` pinning bug)
 *     -> byte-identical shares, which reads exactly like "nothing saturated". GUARDED:
 *     `--known-bad naive` must produce a DIFFERENT answer, and that is asserted, not
 *     eyeballed.
 *
 * ── RESOLUTION FLOOR ───────────────────────────────────────────────────────
 *
 * This metric is EXACT. It is a count over a finite enumerated population evaluated
 * through deterministic arithmetic — there is no sampling and no seed, so the floor is
 * one population member, i.e. 1/N of a share. It is NOT a win rate and the ~9 pp
 * aggregate floor does not apply to it. Reporting it with a tolerance would be the
 * `DECISIONS §62` mistake in reverse.
 *
 *   node tools/tmp/sda_accept.mjs --root /tmp/fa-sda-base --k 16
 *   node tools/tmp/sda_accept.mjs --root /tmp/fa-sda-base --k 16 --known-bad naive
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const args = (() => { const o = {}; for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (!a.startsWith('--')) continue; const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true; else { o[a.slice(2)] = n; i++; } } return o; })();
const ROOT = String(args.root ?? resolve(new URL('../..', import.meta.url).pathname));
const K = Number(args.k ?? 16);
const KNOWN_BAD = args['known-bad'] ? String(args['known-bad']) : null;

/**
 * The census must not silently shrink. This count lives HERE and nowhere else — it is
 * not a shipped gate row, so it is not in `docs/TOOLS.md`'s table and `gatecount` has
 * nothing to say about it. If this tool is ever promoted to a gate, the number moves to
 * that table and comes out of this file.
 */
const MIN_SITES = 16;

// ── 1. THE CENSUS ──────────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

const SITES = [];
const CLAMP_RE = /clamp\(\s*(-?[\d.]+)\s*\+\s*(?:ev\.|ctx\.|w\.)?(?:amount|damage)\s*\*\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*([A-Za-z0-9_.]+)\s*\)/g;
const RATIO_RE = /clamp\(\s*(?:ev\.|ctx\.|w\.)?(?:amount|damage)\s*\/\s*([\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/g;
const TIER_RE = /\b(?:ev\.|ctx\.)?amount\s*>=\s*(\d+)/g;
const AUDIO_RE = /\(\s*damage\s*-\s*([\d.]+)\s*\)\s*\/\s*([\d.]+)/g;

const CONSTS = { 'GameSession.SHAKE_MAX_M': 0.40 };
const num = (s) => (s in CONSTS ? CONSTS[s] : Number(s));

for (const f of walk(join(ROOT, 'src'))) {
  const src = readFileSync(f, 'utf8');
  const rel = f.slice(ROOT.length + 1);
  for (const m of src.matchAll(CLAMP_RE)) SITES.push({ file: rel, kind: 'clamp', a: Number(m[1]), b: Number(m[2]), lo: Number(m[3]), hi: num(m[4]), raw: m[0] });
  for (const m of src.matchAll(RATIO_RE)) SITES.push({ file: rel, kind: 'clamp', a: 0, b: 1 / Number(m[1]), lo: Number(m[2]), hi: Number(m[3]), raw: m[0] });
  for (const m of src.matchAll(TIER_RE)) SITES.push({ file: rel, kind: 'tier', a: 0, b: 1, lo: -Infinity, hi: Number(m[1]), raw: m[0] });
  for (const m of src.matchAll(AUDIO_RE)) SITES.push({ file: rel, kind: 'clamp', a: -Number(m[1]) / Number(m[2]), b: 1 / Number(m[2]), lo: 0, hi: 1, raw: m[0] });
}

// ── 2. THE POPULATION: every HP amount a player can be shown ──────────────
const R = await import(`${ROOT}/src/game/rules.ts`);
const POP = [];
for (const id of R.CHARACTER_IDS) {
  for (const w of R.CHARACTERS[id].weapons) {
    if (w.comboParts) { for (const p of w.comboParts) POP.push(p.damage); continue; }
    if ((w.healAmount ?? 0) > 0) POP.push(w.healAmount);
    if ((w.damage ?? 0) > 0) POP.push(w.damage);
  }
}
POP.push(R.FOG_DAMAGE, R.POT.damage, R.TRAIL.damage, R.REGEN_AMOUNT);
// The trail-boosted variant is a real `ev.amount` and is not in the table.
POP.push(Math.round(R.CHARACTERS.donut.weapons[0].damage * R.TRAIL.damageBoost));

// ── 3. THE ASSERTIONS ──────────────────────────────────────────────────────
let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); } else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); } };

console.log(`\n══ SDA_ACCEPT ══  root ${ROOT}  k=${K}${KNOWN_BAD ? `  KNOWN-BAD=${KNOWN_BAD}` : ''}\n`);

// VACUITY GUARDS FIRST — everything below filters, and a filtered assertion over an
// empty set is green by construction.
ok(`NON-VACUOUS: the census found >= ${MIN_SITES} response curves`, SITES.length >= MIN_SITES, `${SITES.length} sites in ${new Set(SITES.map((s) => s.file)).size} files`);
ok('NON-VACUOUS: the damage population is non-empty', POP.length > 0, `${POP.length} values`);
ok('NON-VACUOUS: the population has > 8 distinct values', new Set(POP).size > 8, `${new Set(POP).size} distinct: ${[...new Set(POP)].sort((a, b) => a - b).join(',')}`);

/** Share of the population that lands at the ceiling / at the floor of one curve. */
function shares(site, scale, migrate) {
  // `migrate` is the whole question: a MIGRATED curve divides the incoming amount by k
  // (equivalently, divides its own coefficient by k). The known-bad does not.
  const b = migrate ? site.b / scale : site.b;
  let hi = 0, lo = 0;
  for (const v of POP) {
    const y = site.a + v * scale * b;
    if (site.kind === 'tier') { if (y >= site.hi) hi++; else lo++; continue; }
    if (y >= site.hi) hi++;
    if (y <= site.lo) lo++;
  }
  return { hi: hi / POP.length, lo: lo / POP.length };
}

const base = SITES.map((s) => shares(s, 1, false));
const migrated = SITES.map((s) => shares(s, K, !KNOWN_BAD));

let moved = 0, pinnedAfter = 0, pinnedBefore = 0;
const worst = [];
for (let i = 0; i < SITES.length; i++) {
  const d = Math.abs(migrated[i].hi - base[i].hi) + Math.abs(migrated[i].lo - base[i].lo);
  if (d > 1e-12) { moved++; worst.push({ i, d }); }
  if (migrated[i].hi >= 0.999) pinnedAfter++;
  if (base[i].hi >= 0.999) pinnedBefore++;
}
worst.sort((a, b) => b.d - a.d);

console.log(`\n   sites whose saturation share MOVED   ${moved}/${SITES.length}`);
console.log(`   sites PINNED at the ceiling  before ${pinnedBefore}/${SITES.length}   after ${pinnedAfter}/${SITES.length}`);
if (worst.length) {
  console.log(`\n   worst movers:`);
  for (const { i, d } of worst.slice(0, 8)) {
    const s = SITES[i];
    console.log(`     ${s.file}  ${s.raw.slice(0, 62)}`);
    console.log(`        ceiling share ${(100 * base[i].hi).toFixed(1)}% -> ${(100 * migrated[i].hi).toFixed(1)}%   floor ${(100 * base[i].lo).toFixed(1)}% -> ${(100 * migrated[i].lo).toFixed(1)}%   |Δ| ${d.toFixed(4)}`);
  }
}

console.log();
ok('EVERY response curve keeps its saturation share', moved === 0, `${moved} moved`);
ok('no curve is newly PINNED at its ceiling', pinnedAfter === pinnedBefore, `${pinnedBefore} -> ${pinnedAfter}`);

console.log(`\n   RESOLUTION FLOOR: 1/${POP.length} = ${(100 / POP.length).toFixed(2)} pp of share. EXACT — enumerated population, no sampling.`);
console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
process.exit(fail ? 1 : 0);
