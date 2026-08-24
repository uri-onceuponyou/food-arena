#!/usr/bin/env node
/**
 * CN_REVEAL — DOES CONCEALMENT EVER DENY ANYBODY ANYTHING, on the SHIPPED regions, at SIX
 * SEATS, and would moving `CONCEAL_REVEAL_RADIUS` change that?
 *
 * ── THE QUESTION, AND WHY THE EXISTING TOOL DOES NOT ANSWER IT ──────────────
 *
 * Uri, fourth report on the same feature: *"the bushes are to transparent, players are
 * visible through them, so it makes no point."*
 *
 * `conceal_lab --occupancy` measures OCCUPANCY — the share of playing ticks with a fighter
 * inside a region — on a CANDIDATE region set it generates itself, at TWO seats. Both of
 * those were right for the question it was built for (*"before anybody draws anything,
 * would a fighter ever be inside one?"*) and neither is right for this one:
 *
 *   * the arena now ships **20 real regions**, so the candidate set measures a world that
 *     does not exist;
 *   * **occupancy is not denial.** A fighter can sit inside a region for the whole match
 *     and be seen by everyone the entire time, because `movement.ts:isVisibleFrom` returns
 *     `true` for anyone within `CONCEAL_REVEAL_RADIUS` (84 wu). Occupancy counts the
 *     symptom; this counts the OUTCOME.
 *   * ⚠️ and it is a **six-seat** question. At two seats there is exactly one ordered pair
 *     per tick; at six there are thirty, and "hidden from somebody" and "hidden from
 *     everybody" stop being the same claim. This repo's dominant defect class.
 *
 * ── WHAT IT COUNTS ──────────────────────────────────────────────────────────
 *
 * Every ORDERED pair of living fighters (observer, target), on every playing tick:
 *
 *   IN-REGION    the target is `concealed` — `sim.ts` sets `Fighter.concealed =
 *                isHidden(...)` from the one predicate the gameplay readers call, so this
 *                is the sim's own answer and not a second implementation of it.
 *   DENIED       in-region AND farther than the reveal radius. **This is the mechanic.**
 *                It is exactly the set of pairs for which `isVisibleFrom` returns false.
 *   OVERRIDDEN   in-region AND inside the reveal radius. The mechanic is live, the fighter
 *                is standing in cover, and it buys nothing.
 *
 * ── AND A COUNTERFACTUAL THAT COSTS NOTHING ─────────────────────────────────
 *
 * Every pair's distance is known, so the DENIED share at any other value of
 * `CONCEAL_REVEAL_RADIUS` is a re-bucketing of the same ticks rather than a second run.
 * `--radii` sweeps it. That is what turns *"84 is too small"* from an opinion into a
 * priced proposal — and `rules.ts` pins the band from both sides, so the sweep is mostly
 * there to show how little room there is.
 *
 * ── VALIDATION: TWO PLANTED KNOWN-BADS, AND THE VACUITY RULE ────────────────
 *
 * `--selftest` runs the identical measurement against two constructed worlds:
 *
 *   EMPTY   `concealment: []` — every count must be exactly 0. Catches an instrument that
 *           counts something other than what it says (e.g. reading `alive` for
 *           `concealed`), which would keep printing a number here.
 *   WHOLE   one region covering the playfield. ⚠️ **THIS ARM WAS WRITTEN EXPECTING 100%
 *           IN-REGION AND MEASURED 39.3%, AND THE INSTRUMENT WAS RIGHT.** Old wording kept
 *           per house style: *"IN-REGION must be ~100% of pairs"*. `isHidden` returns
 *           false for `CONCEAL_ATTACK_REVEAL_MS` (500 ms) after the target attacks, so the
 *           exact identity is `IN-REGION + ATTACK-REVEALED === PAIRS`, and DENIED at R is
 *           checked against an IN-REGION-only distance histogram from the same run.
 *           **The known-bad found a reveal mechanism the header did not know about.**
 *
 * ⚠️ **AND THE NON-VACUITY ARM COMES FIRST.** Every share below is a filtered count over
 * living pairs; `0/0` prints `0.00%` and reads exactly like "the mechanic never fires".
 * The pair total is asserted non-zero before any share is believed — `[].every()` returns
 * `true` and this repo has been caught by that three times in one session.
 *
 *   node tools/tmp/cn_reveal.mjs --selftest
 *   node tools/tmp/cn_reveal.mjs --seeds 24
 *   node tools/tmp/cn_reveal.mjs --seeds 24 --n 6 --json /tmp/cn.json
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const args = (() => {
  const o = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true; else { o[a.slice(2)] = n; i++; }
  }
  return o;
})();

const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const STATE = await import(`${SIM_DIR}/state.ts`);
const { CHARACTER_IDS, MATCH_DURATION_MS, CONCEAL_REVEAL_RADIUS, REACH, PLAYER_SIZE } = RULES;
const { MAX_FIGHTERS } = STATE;

/**
 * The ring the fog opens at, derived from the tree under test exactly as `bm_ffa` derives
 * it and for the reason its header gives: 47 tools carry a superseded expression that
 * returns 1792 against a shipped 1720.4651, and using it would measure a different game.
 */
function openingRadiusFor(halfDiag) {
  if (args.maxsafe !== undefined) return Number(args.maxsafe);
  if (typeof RULES.fogOpeningRadiusFor === 'function') return RULES.fogOpeningRadiusFor(halfDiag);
  return Math.round(halfDiag / (1 - 6000 / MATCH_DURATION_MS));
}

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
const AD = existsSync(ARENA_PATH) ? JSON.parse(readFileSync(ARENA_PATH, 'utf8')) : null;
if (!AD) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
const baseArena = (concealment) => ({
  ...AD,
  concealment,
  maxSafeRadius: openingRadiusFor(Math.hypot(AD.width / 2, AD.height / 2)),
  build: () => null,
  update: () => {},
});

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 24);
const N = Number(args.n ?? MAX_FIGHTERS);
/** The counterfactual sweep. `REACH`'s own rungs, plus the two endpoints of the band
 *  `rules.ts` derives the constant inside, so nothing here is a made-up number. */
const RADII = String(args.radii ?? [
  0, REACH.meleeQuick, REACH.meleeStrong, REACH.meleeHeavy,
  REACH.rangedClose, REACH.rangedMid, REACH.rangedLong,
].join(',')).split(',').map(Number);

/**
 * ONE MATCH, all seats AI.
 *
 * ⚠️ **EVERY SEAT IS `controller: 'ai'`, AND THAT IS A LIMIT, NOT A CHOICE** — the same
 * limit `bm_ffa` and `nf_ffa` declare. The scripted driver plays the PLAYER seat of a
 * two-seat match and structurally cannot play a free-for-all, so what this measures is the
 * BOT policy's relationship with the regions. It is therefore a lower bound on nothing and
 * an upper bound on nothing; it is what the shipped AI does with the shipped geometry.
 * A human who deliberately camps a region would score higher, and a human who never
 * notices the regions exist — which is Uri's report — would score lower.
 */
function runMatch(n, seed, arena) {
  const configs = [];
  for (let i = 0; i < n; i++) {
    configs.push({ characterId: CHARACTER_IDS[(seed * 7 + i * 3) % CHARACTER_IDS.length], controller: 'ai' });
  }
  const state = createMatch(arena, configs);
  const inputs = new Array(n).fill(null);
  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;

  let playTicks = 0;
  let pairs = 0, inRegion = 0;
  /**
   * ⚠️ **THE THIRD REVEAL MECHANISM, AND THE `--selftest` KNOWN-BAD IS WHAT FOUND IT.**
   *
   * The "WHOLE PLAYFIELD" arm was written expecting IN-REGION to be **100%** of pairs.
   * It measured **39.3%**, and the instrument was right and the expectation was wrong:
   * `sim.ts` sets `Fighter.concealed = isHidden(...)`, and `movement.ts:isHidden` opens
   *
   *     if (match && target && match.elapsed < target.revealedUntil) return false;
   *
   * — `CONCEAL_ATTACK_REVEAL_MS` (500 ms, = `FLIGHT_MS.normal`) from every attack. Six AI
   * seats attack often enough that a fighter is inside that window most of the time, so
   * even under a region covering the entire map most fighters are NOT concealed.
   *
   * That is a real property of the shipped game and it belongs in the headline, not in a
   * tolerance. Counted here so `inRegion + attackRevealed === pairs` is an EXACT identity
   * under the whole-playfield arm instead of a number to be explained away.
   */
  let attackRevealed = 0;
  /**
   * ⚠️ **AND THE KNOWN-BAD THEN FOUND A FOURTH STATE, WHICH IS THE BIGGEST ONE.**
   *
   * With the whole-playfield region planted, `IN-REGION + ATTACK-REVEALED` came to 63,866
   * of 108,396 pairs. The missing 44,530 are `breakConcealment`: `combat.ts` calls it on
   * every attack, it DESTROYS every standing region containing the attacker, and
   * `MatchState.brokenConcealment` is permanent for the rest of the match — for EVERYONE,
   * not just the attacker. One region covering the map is therefore gone the first time
   * anybody swings from anywhere.
   *
   * That is `DECISIONS §29c` working exactly as Uri specified (*"attacking from under it
   * will break it and reveal you"*), and at six seats over 20 small regions it is a much
   * larger effect than the 84 wu radius. So the four states are counted as an EXACT
   * PARTITION of every living pair, and the partition is asserted to sum.
   */
  let openGround = 0, regionBroken = 0, attackRevealedInBox = 0, geoInRegion = 0;
  /** How many of the arena's declared regions had been destroyed when the match ended. */
  let regionsDestroyed = 0;
  const declared = arena.concealment ?? [];
  /** DENIED at each radius in `RADII`, in the same order. */
  const deniedAt = RADII.map(() => 0);
  /** Distance histogram over ALL living pairs, 20 wu buckets, for the engagement plot. */
  const BUCKET = 20, BUCKETS = 60;
  const distHist = new Array(BUCKETS).fill(0);
  /** The same histogram restricted to IN-REGION pairs — the independent derivation the
   *  selftest checks `deniedAt` against. A whole-population histogram cannot do that job
   *  once part of the population is excluded by the attack-reveal window. */
  const inRegionDistHist = new Array(BUCKETS).fill(0);
  /** Distance at the instant a WEAPON hit lands — the "where do fights happen" answer. */
  const hitHist = new Array(BUCKETS).fill(0);
  let hits = 0, hitsBeyondReveal = 0;
  /** Ticks on which the target was concealed from EVERY other living fighter. */
  let fullyHiddenFighterTicks = 0, aliveFighterTicks = 0;

  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    const evs = stepMatch(state, DT, inputs);
    if (state.phase === 'playing') {
      for (const ev of evs) {
        if (ev.type !== 'hit-landed' || ev.source?.kind !== 'weapon') continue;
        // 🚨 `ev.source.attackerId`, NOT `ev.sourceId`. The first draft read `ev.sourceId`,
        // which does not exist on `hit-landed` — `state.ts` puts the attacker INSIDE the
        // `DamageSource` union (*"a weapon hit ALWAYS has an attacker"*). `find` returned
        // `undefined`, the `continue` below swallowed every hit, and the tool printed
        // **"WEAPON HITS 0 · beyond R: 0.000%"** — a filtered set that had emptied itself
        // and then reported a clean 0%, which is this repo's vacuity class exactly. The
        // `--selftest` arm F now asserts the set is NON-EMPTY before any share of it is
        // believed.
        const a = state.fighters.find((f) => f.id === ev.source.attackerId);
        const t = state.fighters.find((f) => f.id === ev.targetId);
        if (!a || !t) continue;
        const d = Math.hypot(a.x - t.x, a.y - t.y);
        hits++;
        if (d > CONCEAL_REVEAL_RADIUS) hitsBeyondReveal++;
        hitHist[Math.min(BUCKETS - 1, Math.floor(d / BUCKET))]++;
      }
      playTicks++;
      const live = state.fighters.filter((f) => f.alive);
      for (const t of live) {
        aliveFighterTicks++;
        let seenBySomeone = false;
        for (const o of live) {
          if (o === t) continue;
          pairs++;
          const d = Math.hypot(o.x - t.x, o.y - t.y);
          const bin = Math.min(BUCKETS - 1, Math.floor(d / BUCKET));
          distHist[bin]++;
          if (!t.concealed) {
            seenBySomeone = true;
            // EXACTLY ONE of the three not-concealed reasons, tested in the order
            // `movement.ts:isHidden` itself tests them so the partition cannot double-count.
            const standing = declared.some(
              (b) => Math.abs(t.x - b.x) < b.w / 2 && Math.abs(t.y - b.y) < b.h / 2);
            if (standing) geoInRegion++;
            if (state.elapsed < t.revealedUntil) {
              attackRevealed++;
              // 🔴 THE NUMBER THIS WHOLE TOOL EXISTS FOR. Of the moments a player is
              // physically standing under a rack, how many does the attack-reveal window
              // spend? A player who ducks under cover and keeps fighting is revealed for
              // `CONCEAL_ATTACK_REVEAL_MS` after every single swing, and that is invisible
              // in an occupancy figure.
              if (standing) attackRevealedInBox++;
            } else if (!standing) openGround++;
            else regionBroken++;
            continue;
          }
          inRegion++;
          geoInRegion++;
          inRegionDistHist[bin]++;
          for (let r = 0; r < RADII.length; r++) if (d > RADII[r]) deniedAt[r]++;
          if (d <= CONCEAL_REVEAL_RADIUS) seenBySomeone = true;
        }
        if (live.length > 1 && !seenBySomeone) fullyHiddenFighterTicks++;
      }
    }
  }
  regionsDestroyed = state.brokenConcealment.length;
  return {
    playTicks, pairs, inRegion, attackRevealed, attackRevealedInBox, geoInRegion,
    openGround, regionBroken, deniedAt,
    distHist, inRegionDistHist, hitHist, hits, hitsBeyondReveal,
    fullyHiddenFighterTicks, aliveFighterTicks, BUCKET,
    regionsDestroyed, regionsDeclared: declared.length, matches: 1,
  };
}

/** Sum an array of per-match results into one. */
function fold(rows) {
  const out = {
    playTicks: 0, pairs: 0, inRegion: 0, attackRevealed: 0, attackRevealedInBox: 0,
    geoInRegion: 0, openGround: 0, regionBroken: 0,
    hits: 0, hitsBeyondReveal: 0, regionsDestroyed: 0, regionsDeclared: 0, matches: 0,
    fullyHiddenFighterTicks: 0, aliveFighterTicks: 0,
    deniedAt: RADII.map(() => 0), distHist: null, inRegionDistHist: null, hitHist: null, BUCKET: 20,
  };
  for (const r of rows) {
    for (const k of ['playTicks', 'pairs', 'inRegion', 'attackRevealed', 'attackRevealedInBox',
      'geoInRegion', 'openGround',
      'regionBroken', 'hits', 'hitsBeyondReveal', 'regionsDestroyed', 'matches',
      'fullyHiddenFighterTicks', 'aliveFighterTicks']) out[k] += r[k];
    out.regionsDeclared = r.regionsDeclared;
    for (let i = 0; i < RADII.length; i++) out.deniedAt[i] += r.deniedAt[i];
    for (const k of ['distHist', 'inRegionDistHist', 'hitHist']) {
      out[k] = out[k] ? out[k].map((v, i) => v + r[k][i]) : [...r[k]];
    }
    out.BUCKET = r.BUCKET;
  }
  return out;
}

function sweep(n, seeds, arena, seedOffset = 0) {
  const rows = [];
  for (let s = 0; s < seeds; s++) rows.push(runMatch(n, s + seedOffset, arena));
  return fold(rows);
}

/**
 * AREA SHARE — the null hypothesis for occupancy. The regions' share of STANDABLE plan
 * area, sampled on a 5 wu lattice with the fighter's own collision test, because a fighter
 * cannot stand inside `cover` and including it would deflate the denominator's meaning.
 */
function areaShare(arena) {
  const half = PLAYER_SIZE / 2;
  let standable = 0, concealed = 0;
  for (let x = 0; x <= AD.width; x += 5) {
    for (let y = 0; y <= AD.height; y += 5) {
      if (x < half || x > AD.width - half || y < half || y > AD.height - half) continue;
      if (AD.cover.some((o) => Math.abs(x - o.x) < (PLAYER_SIZE + o.w) / 2
        && Math.abs(y - o.y) < (PLAYER_SIZE + o.h) / 2)) continue;
      standable++;
      if (arena.concealment.some((b) => Math.abs(x - b.x) < b.w / 2 && Math.abs(y - b.y) < b.h / 2)) concealed++;
    }
  }
  return { standable, concealed, share: standable ? concealed / standable : 0 };
}

const pctOf = (n, d) => (d ? (100 * n) / d : 0);
const fmt = (n, d, w = 6) => `${pctOf(n, d).toFixed(3).padStart(w)}%`;

/* ─────────────────────────────────────────────────────────────────────────────
 * --selftest — two PLANTED worlds, and the non-vacuity arm first
 * ────────────────────────────────────────────────────────────────────────── */
if (args.selftest) {
  let pass = 0, fail = 0;
  const ok = (nm, c, d = '') => {
    if (c) { pass++; console.log(`   PASS  ${nm}${d ? `  ${d}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${nm}${d ? `  ${d}` : ''}`); }
  };
  const S = Number(args.seeds ?? 4);
  console.log(`\n══ cn_reveal SELFTEST ══  n=${N} · ${S} seeds · R=${CONCEAL_REVEAL_RADIUS} wu`);

  const shipped = baseArena(AD.concealment);
  const live = sweep(N, S, shipped);

  // ⚠️ NON-VACUITY FIRST. Every assertion below is a share over `pairs`; at `pairs === 0`
  // they are all satisfied by an instrument that ran zero ticks, and the printout would be
  // indistinguishable from "the mechanic never fires".
  ok('A  NON-VACUITY: the run produced living ordered pairs to filter over',
    live.pairs > 0, `${live.pairs.toLocaleString()} pairs over ${live.playTicks.toLocaleString()} ticks`);
  ok('A2 NON-VACUITY: the shipped arena actually carries regions',
    shipped.concealment.length > 0, `${shipped.concealment.length} regions`);

  // KNOWN-BAD 1 — EMPTY. Nothing may be counted. An instrument reading the wrong field
  // (`alive`, say) keeps printing a healthy number here.
  const empty = sweep(N, S, baseArena([]));
  ok('B  KNOWN-BAD "EMPTY": with no regions, IN-REGION is exactly 0',
    empty.inRegion === 0 && empty.pairs > 0,
    `inRegion ${empty.inRegion} over ${empty.pairs.toLocaleString()} pairs`);
  ok('B2 KNOWN-BAD "EMPTY": …and DENIED is exactly 0 at every radius',
    empty.deniedAt.every((v) => v === 0), `[${empty.deniedAt.join(',')}]`);

  // KNOWN-BAD 2 — WHOLE PLAYFIELD. IN-REGION must be every pair, and DENIED at R must
  // equal the count of pairs beyond R, computed independently from the distance histogram
  // in the SAME run. Two derivations of one number, and they must agree.
  const whole = sweep(N, S, baseArena([
    { x: AD.center.x, y: AD.center.y, w: AD.width * 2, h: AD.height * 2, kind: 'planted_whole' },
  ]));
  // 🚨 THIS ROW USED TO READ `whole.inRegion === whole.pairs` AND IT WAS WRONG.
  // Kept above the correction because the known-bad earning its keep is the point: it
  // measured 43,235 / 109,944 = **39.3%** under a region covering the entire map, and the
  // instrument was right. `movement.ts:isHidden` returns false for the whole of
  // `CONCEAL_ATTACK_REVEAL_MS` after an attack, so six busy AI seats spend most of their
  // pair-ticks revealed no matter what the geometry says. The identity that IS exact:
  // 🚨 TWO EARLIER VERSIONS OF THIS ROW WERE WRONG AND THE KNOWN-BAD CAUGHT BOTH.
  //   v1: `whole.inRegion === whole.pairs`            -> measured 39.3%, missed ATTACK-REVEAL
  //   v2: `inRegion + attackRevealed === pairs`       -> 63,866 of 108,396, missed BREAKAGE
  // Kept above the correction because a known-bad that only ever confirms what its author
  // already believed is not a known-bad. What is exact is the FOUR-STATE PARTITION.
  const wSum = whole.inRegion + whole.attackRevealed + whole.openGround + whole.regionBroken;
  ok('C  KNOWN-BAD "WHOLE": the four states PARTITION every living pair exactly',
    whole.pairs > 0 && wSum === whole.pairs,
    `${whole.inRegion.toLocaleString()} hidden + ${whole.attackRevealed.toLocaleString()} `
    + `attack-revealed + ${whole.openGround.toLocaleString()} open-ground + `
    + `${whole.regionBroken.toLocaleString()} region-destroyed = ${wSum.toLocaleString()} `
    + `vs ${whole.pairs.toLocaleString()}`);
  ok('C1 KNOWN-BAD "WHOLE": with a region covering the entire map, OPEN-GROUND is exactly 0 '
    + '(nothing else can be true, and a non-zero here means the geometry copy has drifted '
    + 'from movement.ts:isConcealed)',
    whole.openGround === 0 && whole.regionBroken > 0,
    `open-ground ${whole.openGround} · region-destroyed ${whole.regionBroken.toLocaleString()} `
    + `(${pctOf(whole.regionBroken, whole.pairs).toFixed(1)}% — breakConcealment is permanent)`);
  const rIdx = RADII.indexOf(CONCEAL_REVEAL_RADIUS);
  // The independent derivation, restricted to the IN-REGION population — the only one
  // `deniedAt` filters over. Checking it against the WHOLE-population histogram was the
  // second half of the same mistake.
  const beyondFromHist = whole.inRegionDistHist.reduce(
    (a, v, i) => a + (i * whole.BUCKET >= CONCEAL_REVEAL_RADIUS ? v : 0), 0);
  const deniedWhole = rIdx >= 0 ? whole.deniedAt[rIdx] : NaN;
  // The histogram is bucketed at 20 wu and 84 is not a bucket edge, so the two agree to
  // within one bucket's worth of pairs rather than exactly. Stated, not hidden in a
  // tolerance: a bucket-exact claim here would be a lie about the instrument.
  const oneBucket = whole.inRegionDistHist[Math.floor(CONCEAL_REVEAL_RADIUS / whole.BUCKET)];
  ok('C2 KNOWN-BAD "WHOLE": DENIED at R agrees with the independent IN-REGION distance '
    + 'histogram',
    rIdx >= 0 && Math.abs(deniedWhole - beyondFromHist) <= oneBucket,
    `denied ${deniedWhole.toLocaleString()} vs hist ${beyondFromHist.toLocaleString()} `
    + `(± one 20 wu bucket = ${oneBucket.toLocaleString()})`);
  // C3 — the same identity on the SHIPPED arena. Without it, C/C1/C2 could all pass on a
  // planted world while the real one was being counted with a different rule.
  const lSum = live.inRegion + live.attackRevealed + live.openGround + live.regionBroken;
  ok('C3 the same exact partition holds on the SHIPPED arena (without this, C/C1/C2 could '
    + 'all pass on a planted world while the real one was counted by a different rule)',
    lSum === live.pairs && live.inRegion > 0,
    `${lSum.toLocaleString()} vs ${live.pairs.toLocaleString()} pairs · `
    + `in-region ${live.inRegion.toLocaleString()}`);

  // D — THE SWEEP IS MONOTONE. DENIED can only fall as the reveal radius grows; if it
  // does not, the counterfactual is not a re-bucketing of the same ticks and every
  // recommendation built on it is worthless.
  const mono = live.deniedAt.every((v, i) => i === 0 || v <= live.deniedAt[i - 1]);
  ok('D  the radius sweep is MONOTONE NON-INCREASING (it is a re-bucketing, not a re-run)',
    mono, RADII.map((r, i) => `${r}:${live.deniedAt[i]}`).join(' '));

  // E — DETERMINISM. The sim underwrites every balance number in this repo; if the same
  // seeds do not give the same counts, nothing above means anything.
  const again = sweep(N, S, baseArena(AD.concealment));
  ok('E  DETERMINISM: identical seeds give identical counts',
    again.pairs === live.pairs && again.inRegion === live.inRegion
    && again.deniedAt.every((v, i) => v === live.deniedAt[i]),
    `pairs ${again.pairs === live.pairs} · inRegion ${again.inRegion === live.inRegion}`);

  // F — NON-VACUITY ON THE HIT SET. Added after the weapon-hit arm silently reported
  // 0 hits for a run of 20 matches because it read a field that does not exist. A share
  // of an empty set is a clean-looking 0%.
  ok('F  NON-VACUITY: weapon hits were actually observed, so "where fights happen" is a '
    + 'measurement and not an empty filter',
    live.hits > 0, `${live.hits.toLocaleString()} weapon hits · `
    + `${pctOf(live.hitsBeyondReveal, live.hits).toFixed(1)}% beyond R`);
  ok('F2 …and the hit-distance histogram accounts for every one of them',
    live.hitHist.reduce((x, y) => x + y, 0) === live.hits,
    `${live.hitHist.reduce((x, y) => x + y, 0).toLocaleString()} binned vs ${live.hits.toLocaleString()}`);

  console.log(`\n   ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * the measurement
 * ────────────────────────────────────────────────────────────────────────── */
const arena = baseArena(AD.concealment);
const area = areaShare(arena);
const t0 = Date.now();
const A = sweep(N, SEEDS, arena, 0);
/**
 * THE FLOOR ARM. `CLAUDE.md` rule 10: state a resolution floor before acting on a change.
 * There is no published floor for "denied share", so one is built here the only way it can
 * be — a second, DISJOINT seed block on the SAME tree. Identical seeds are bit-identical
 * (selftest §E), so the seed block is the only thing that varies and the gap between the
 * two arms is the floor.
 */
const B = sweep(N, SEEDS, arena, SEEDS);

if (A.pairs === 0 || B.pairs === 0) {
  console.error('cn_reveal: zero living pairs — every share below would be a vacuous 0/0');
  process.exit(1);
}

const share = (r) => pctOf(r.inRegion, r.pairs);
const deniedShare = (r) => pctOf(r.deniedAt[RADII.indexOf(CONCEAL_REVEAL_RADIUS)], r.pairs);

console.log(`\n══ CN_REVEAL ══  n=${N} · ${SEEDS} seeds ×2 arms · `
  + `${(A.playTicks + B.playTicks).toLocaleString()} playing ticks · `
  + `${(A.pairs + B.pairs).toLocaleString()} ordered living pairs`);
console.log(`   arena ${AD.width}×${AD.height} · ${arena.concealment.length} shipped regions · `
  + `CONCEAL_REVEAL_RADIUS ${CONCEAL_REVEAL_RADIUS} wu (= REACH.meleeHeavy)`);
console.log('');
console.log(`   AREA SHARE (null)      ${(area.share * 100).toFixed(3)}%   `
  + `${area.concealed.toLocaleString()} / ${area.standable.toLocaleString()} standable lattice cells`);
console.log(`   IN-REGION (= HIDDEN)   ${fmt(A.inRegion, A.pairs)}   of ordered living pairs (arm A)`);
console.log(`                          ${fmt(B.inRegion, B.pairs)}   (arm B — the floor)`);
console.log(`   LIFT over chance       ${(share(A) - area.share * 100 >= 0 ? '+' : '')}`
  + `${(share(A) - area.share * 100).toFixed(3)} pp`);
console.log('');
console.log('   WHY THE OTHER PAIRS ARE NOT HIDDEN — an exact partition, not a residual:');
console.log(`     open ground          ${fmt(A.openGround, A.pairs)}   the target is not standing in any region`);
console.log(`     attack-revealed      ${fmt(A.attackRevealed, A.pairs)}   inside CONCEAL_ATTACK_REVEAL_MS of its own attack`);
console.log(`     region DESTROYED     ${fmt(A.regionBroken, A.pairs)}   standing in a region breakConcealment already spent`);
console.log(`     hidden               ${fmt(A.inRegion, A.pairs)}`);
console.log(`   REGIONS DESTROYED      ${(A.regionsDestroyed / Math.max(1, A.matches)).toFixed(2)} of `
  + `${A.regionsDeclared} per match, by the final tick`);
console.log('');
console.log('   🔴 WHEN YOU ARE ACTUALLY STANDING UNDER A RACK, DOES IT HIDE YOU?');
console.log(`     standing in one      ${A.geoInRegion.toLocaleString()} pair-ticks `
  + `(${pctOf(A.geoInRegion, A.pairs).toFixed(3)}% of all pairs)`);
console.log(`     …and HIDDEN          ${fmt(A.inRegion, A.geoInRegion)}   ← the mechanic working`);
console.log(`     …revealed by ATTACK  ${fmt(A.attackRevealedInBox, A.geoInRegion)}   CONCEAL_ATTACK_REVEAL_MS`);
console.log(`     …region DESTROYED    ${fmt(A.regionBroken, A.geoInRegion)}   breakConcealment, permanent`);
console.log('');
console.log(`   🔴 DENIED at R=${CONCEAL_REVEAL_RADIUS}      ${fmt(A.deniedAt[RADII.indexOf(CONCEAL_REVEAL_RADIUS)], A.pairs)}   `
  + `pairs for which isVisibleFrom() returns FALSE (arm A)`);
console.log(`                          ${fmt(B.deniedAt[RADII.indexOf(CONCEAL_REVEAL_RADIUS)], B.pairs)}   (arm B)`);
console.log(`   FLOOR (|A − B|)        ${Math.abs(deniedShare(A) - deniedShare(B)).toFixed(3)} pp   `
  + `— do not act on a move smaller than this`);
console.log(`   OVERRIDDEN by R        ${fmt(A.inRegion - A.deniedAt[RADII.indexOf(CONCEAL_REVEAL_RADIUS)], A.inRegion)}   `
  + `of IN-REGION pairs: standing in cover, seen anyway`);
console.log(`   FULLY HIDDEN           ${fmt(A.fullyHiddenFighterTicks, A.aliveFighterTicks)}   `
  + `of living-fighter ticks hidden from EVERY opponent (the six-seat form)`);
console.log('');
if (A.hits === 0) {
  console.error('cn_reveal: ZERO weapon hits observed — every share below would be 0/0. '
    + 'This is not a finding, it is a broken filter.');
  process.exit(1);
}
console.log(`   WEAPON HITS            ${A.hits.toLocaleString()} · beyond R: `
  + `${fmt(A.hitsBeyondReveal, A.hits)}   — where fights actually happen`);
console.log('');
console.log('   COUNTERFACTUAL — DENIED share if CONCEAL_REVEAL_RADIUS moved:');
for (let i = 0; i < RADII.length; i++) {
  const tag = RADII[i] === CONCEAL_REVEAL_RADIUS ? '  ← shipped' : '';
  console.log(`     R = ${String(RADII[i]).padStart(3)} wu   ${fmt(A.deniedAt[i], A.pairs)}${tag}`);
}
console.log('');
console.log('   PAIR DISTANCE HISTOGRAM (all living pairs) · WEAPON-HIT DISTANCE');
for (let i = 0; i < 12; i++) {
  const lo = i * A.BUCKET;
  console.log(`     ${String(lo).padStart(3)}–${String(lo + A.BUCKET).padStart(3)} wu  `
    + `pairs ${fmt(A.distHist[i], A.pairs)}   hits ${fmt(A.hitHist[i], A.hits)}`);
}
console.log(`   wall ${((Date.now() - t0) / 1000).toFixed(1)}s`);

if (args.json) {
  writeFileSync(String(args.json), JSON.stringify({
    n: N, seeds: SEEDS, radii: RADII, revealRadius: CONCEAL_REVEAL_RADIUS, area, A, B,
  }, null, 2));
  console.log(`   json -> ${args.json}`);
}
