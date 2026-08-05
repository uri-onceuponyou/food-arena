#!/usr/bin/env node
/**
 * KIT LAB — how DIFFERENT are the eleven characters, measured rather than asserted.
 *
 * ── Why it exists ───────────────────────────────────────────────────────────
 *
 * `DECISIONS §24b` removed rarity's power (tier spread 20.7 pp -> 4.0 pp) and §26 left
 * rarity with no job but a 4.5x levelling bill. The proposed job is DISTINCTIVENESS —
 * "a rare character plays unlike anything else" — and nothing in this repo had ever
 * measured that quantity. `roster_lab.mjs` answers "is anyone too strong"; this answers
 * "is anyone the same character in a different colour".
 *
 * ── The two metrics, and they are deliberately independent ──────────────────
 *
 * 1. MATCHUP-PROFILE DIVERGENCE (the headline). Two characters are similar if they win
 *    and lose against the SAME opponents. Each character gets a role-symmetric score
 *    against each of the other ten — `(win as player + win as AI) / 2` — the vector is
 *    MEAN-CENTRED (so "strong" and "weak" cancel and only the SHAPE is left, which is
 *    what makes this metric orthogonal to the balance guard), and every pair is compared
 *    over the nine opponents they share.
 *
 *    Reported as RMSD in percentage points and as a Pearson correlation.
 *
 * 2. BEHAVIOURAL FINGERPRINT. Nine realised quantities per character — where it deals
 *    damage from, how much per press, how often it presses, what fraction of its output
 *    is melee / status / one single weapon, how far it walks, how fast it starts. This
 *    is what a PLAYER would notice, and it does not depend on win rates at all, so a
 *    change can move it without touching the balance guard.
 *
 * ── ⚠️ THE NOISE FLOOR IS MEASURED, NOT GUESSED ─────────────────────────────
 *
 * A matchup cell at 32 seeds is a 64-match binomial (32 in each role), SE ~6 pp, and a
 * profile is only nine of them. So a raw profile distance is mostly noise unless the
 * noise is measured and subtracted. Every run therefore splits its seeds into two
 * disjoint halves and compares every character TO ITSELF across them. That is a perfect
 * clone by construction, so whatever distance it reads is the instrument's floor, and
 * RMSD composes quadratically:
 *
 *     RMSD_observed^2 = RMSD_true^2 + RMSD_noise^2
 *
 * Every divergence figure this tool prints is reported BOTH raw and noise-corrected, and
 * a pair closer than the floor is reported as INDISTINGUISHABLE rather than as a number.
 * `docs/LESSONS.md` §3: state a resolution floor for every instrument and refuse to act
 * inside it. The behavioural metric gets the same treatment and prints its own floor.
 *
 * ⚠️ AND THE FLOOR ITSELF WAS VALIDATED AGAINST A KNOWN INPUT, WHICH CAUGHT IT WRONG.
 * The first derivation converted the split-half figure with `/2` where the variance
 * algebra needs `/sqrt(2)`. `tools/tmp/stage_kit.mjs --clone hamburger:hotdog` builds two
 * characters that are IDENTICAL BY CONSTRUCTION; they read raw 6.18 pp, which the wrong
 * floor (4.27 pp) would have reported as a 4.62 pp real difference. Against the corrected
 * floor (6.05 pp) the same pair corrects to 1.26 pp, i.e. nothing — which is the only
 * answer a clone may give. Re-run that clone after touching this arithmetic.
 *
 *   node tools/tmp/kit_lab.mjs --selftest
 *   node tools/tmp/kit_lab.mjs --seeds 32 --policies smart2 --json /tmp/kl.before.json
 *   node tools/tmp/kit_lab.mjs --seeds 32 --sim /tmp/cand/game --baseline /tmp/kl.before.json
 *
 * The driver is `tools/tmp/scripted_player.mjs`, imported and never copied
 * (`driver_guard.mjs`). The seed formula and the reaction jitter are `roster_lab.mjs`'s,
 * unchanged, so a cell here is the SAME MATCH as a cell there — `--selftest` checks that
 * against the real thing rather than assuming it.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createScriptedPlayer, rng, parseDriverFlags } from './scripted_player.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

const args = (() => {
  const o = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true;
    else { o[a.slice(2)] = n; i++; }
  }
  return o;
})();

const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const {
  CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, REACH, RARITY_ORDER,
  HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY, PLAYER_MAX_HP, ENEMY_MAX_HP, PLAYER_SPEED,
  COUNTDOWN_FROM, COUNTDOWN_START_FLASH_MS,
} = RULES;

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
if (!existsSync(ARENA_PATH) && !args.selftest) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
const ARENA_DATA = existsSync(ARENA_PATH) ? JSON.parse(readFileSync(ARENA_PATH, 'utf8')) : null;
const HALF_DIAG = ARENA_DATA ? Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2) : 0;
const FOG_FIRST_CONTACT_MS = 6000;
const derivedMaxSafe = Math.round(HALF_DIAG / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS));
let arena = ARENA_DATA ? {
  ...ARENA_DATA,
  maxSafeRadius: Number(args.maxsafe ?? derivedMaxSafe),
  build: () => null, update: () => {},
} : null;

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 8);
const POLICIES = String(args.policies ?? 'smart2').split(',');
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sum = (a) => a.reduce((x, y) => x + y, 0);

const DRIVER_FLAGS = parseDriverFlags(args);
const driverFor = (a) => createScriptedPlayer({ CHARACTERS, REACH, arena: a, ...DRIVER_FLAGS });
let driver = arena ? driverFor(arena) : null;

const otherRole = (r) => (r === 'player' ? 'enemy' : 'player');

// ─────────────────────────────────────────────────────────────────────────────
// ONE MATCH — outcome plus the behavioural telemetry, for BOTH fighters
// ─────────────────────────────────────────────────────────────────────────────
//
// Telemetry is collected per ROLE and folded into the CHARACTER later, because a
// character is the same character in either seat and `strength` is already defined that
// way. Anything that is only true in the player's hands is a driver property, not a kit
// property (`2cc8193` had to have that removed from `ai.ts` four times).
function runMatch(playerId, enemyId, policy, seed) {
  // roster_lab.mjs's formula, verbatim. Same seed -> same match, across both tools.
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + policy.length);
  const state = createMatch(arena, playerId, enemyId);
  const decide = driver.POLICY_FNS[policy](rnd);
  const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });

  const pReach = driver.maxNormalRange(playerId), eReach = driver.maxNormalRange(enemyId);
  const engageRange = Math.max(pReach + HIT_RADIUS_VS_ENEMY, eReach + HIT_RADIUS_VS_PLAYER);

  const ids = { player: playerId, enemy: enemyId };
  const blank = () => ({
    dmg: 0, dmgMelee: 0, dmgStun: 0, dmgSlow: 0, dmgTrail: 0,
    dmgAtDist: 0, hits: 0, presses: 0, byWeapon: {},
    biggestHit: 0, firstDamageMs: null, travel: 0,
  });
  const t = { player: blank(), enemy: blank() };

  let countdownMs = null, playTicks = 0, engagedTicks = 0;
  let winner = null, endedAt = null;
  let last = null;

  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;

  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    const evs = stepMatch(state, DT, loop.next(state, DT));
    const sep = dist(state.player.x, state.player.y, state.enemy.x, state.enemy.y);

    for (const ev of evs) {
      if (ev.type === 'match-started') countdownMs = state.elapsed;
      else if (ev.type === 'match-ended') { winner = ev.winner; endedAt = state.elapsed; }
      else if (ev.type === 'weapon-fired') t[ev.fighterRole].presses++;
      else if (ev.type === 'hit-landed') {
        const k = ev.source?.kind;
        if (k !== 'weapon' && k !== 'trail') continue;     // fog and the pot have no author
        const by = k === 'trail' ? ev.source.ownerRole : otherRole(ev.targetRole);
        const a = t[by];
        a.dmg += ev.amount;
        a.hits++;
        // Separation at the moment it landed. Read AFTER the tick that produced it, so it
        // is up to one tick (<= ~2 wu of closing) stale — declared rather than hidden,
        // and far below the 40..140 wu band the feature is meant to distinguish.
        a.dmgAtDist += ev.amount * sep;
        if (ev.amount > a.biggestHit) a.biggestHit = ev.amount;
        if (a.firstDamageMs === null) a.firstDamageMs = state.elapsed - (countdownMs ?? 0);
        if (k === 'trail') { a.dmgTrail += ev.amount; a.byWeapon.__trail = (a.byWeapon.__trail ?? 0) + ev.amount; }
        else {
          const w = CHARACTERS[ids[by]].weapons.find((x) => x.key === ev.source.weaponKey);
          if (w?.type === 'melee') a.dmgMelee += ev.amount;
          a.byWeapon[ev.source.weaponKey] = (a.byWeapon[ev.source.weaponKey] ?? 0) + ev.amount;
        }
        if (ev.effect === 'stun') a.dmgStun += ev.amount;
        else if (ev.effect === 'slow') a.dmgSlow += ev.amount;
      }
    }

    if (state.phase === 'playing') {
      playTicks++;
      if (sep <= engageRange) engagedTicks++;
      if (last) {
        t.player.travel += dist(state.player.x, state.player.y, last.px, last.py);
        t.enemy.travel += dist(state.enemy.x, state.enemy.y, last.ex, last.ey);
      }
      last = { px: state.player.x, py: state.player.y, ex: state.enemy.x, ey: state.enemy.y };
    }
  }

  const playMs = countdownMs === null ? 0 : (endedAt ?? state.elapsed) - countdownMs;
  return { playerId, enemyId, policy, seed, winner, playMs, engagedMs: engagedTicks * DT, t };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE MATHS — pure, so --selftest can drive it with hand-built tables whose
// answers are derivable without running a single match.
// ─────────────────────────────────────────────────────────────────────────────

/** Role-symmetric score matrix from a `rate[a>b]` table. `score[a][b] + score[b][a] === 1`. */
export function scoreMatrix(rates, ids) {
  const s = {};
  for (const a of ids) {
    s[a] = {};
    for (const b of ids) {
      if (a === b) continue;
      s[a][b] = (rates[`${a}>${b}`] + (1 - rates[`${b}>${a}`])) / 2;
    }
  }
  return s;
}

/**
 * Divergence between two characters' matchup profiles, over the opponents they SHARE.
 *
 * The head-to-head cell is excluded on both sides — it is the one opponent they cannot
 * have in common, and it is also the cell most likely to differ for reasons that have
 * nothing to do with the rest of the roster. Both vectors are mean-centred first, so a
 * character that simply wins more is not thereby "distinctive"; only the SHAPE counts.
 */
function pairProfiles(S, a, b, ids) {
  const common = ids.filter((o) => o !== a && o !== b);
  const va = common.map((o) => S[a][o]);
  const vb = common.map((o) => S[b][o]);
  const ma = mean(va), mb = mean(vb);
  return { va: va.map((x) => x - ma), vb: vb.map((x) => x - mb) };
}

export function profileRmsd(S, a, b, ids) {
  const { va, vb } = pairProfiles(S, a, b, ids);
  return Math.sqrt(mean(va.map((x, i) => (x - vb[i]) ** 2)));
}

export function profileRho(S, a, b, ids) {
  const { va, vb } = pairProfiles(S, a, b, ids);
  const sa = Math.sqrt(sum(va.map((x) => x * x)));
  const sb = Math.sqrt(sum(vb.map((x) => x * x)));
  if (sa < 1e-12 || sb < 1e-12) return 0;
  return sum(va.map((x, i) => x * vb[i])) / (sa * sb);
}

/**
 * How far a character's own profile swings across the roster — the SD of its centred
 * matchup vector.
 *
 * It has to be reported next to the divergence, because divergence decomposes as
 * `RMSD(a,b)^2 = amp_a^2 + amp_b^2 - 2*rho*amp_a*amp_b`. A character with a FLAT profile
 * (no strong matchups either way) is automatically close to everybody, and reads as
 * "not distinctive" for a completely different reason from being somebody's clone. The
 * two failure modes need different fixes, so they are printed as two columns.
 */
function amplitude(S, c, ids) {
  const v = ids.filter((o) => o !== c).map((o) => S[c][o]);
  const m = mean(v);
  return Math.sqrt(mean(v.map((x) => (x - m) ** 2)));
}

/** Same character, two independent halves — a PERFECT CLONE, so this is the noise floor. */
function selfRmsd(S1, S2, c, ids) {
  const others = ids.filter((o) => o !== c);
  const v1 = others.map((o) => S1[c][o]);
  const v2 = others.map((o) => S2[c][o]);
  const m1 = mean(v1), m2 = mean(v2);
  return Math.sqrt(mean(v1.map((x, i) => ((x - m1) - (v2[i] - m2)) ** 2)));
}
function selfRho(S1, S2, c, ids) {
  const others = ids.filter((o) => o !== c);
  const v1 = others.map((o) => S1[c][o]);
  const v2 = others.map((o) => S2[c][o]);
  const m1 = mean(v1), m2 = mean(v2);
  const a = v1.map((x) => x - m1), b = v2.map((x) => x - m2);
  const sa = Math.sqrt(sum(a.map((x) => x * x))), sb = Math.sqrt(sum(b.map((x) => x * x)));
  if (sa < 1e-12 || sb < 1e-12) return 0;
  return sum(a.map((x, i) => x * b[i])) / (sa * sb);
}

/** The behavioural feature vector, z-scored across the roster, and its pairwise distances. */
const FEATURES = [
  ['engageDist', 'wu at which its damage lands'],
  ['meleeShare', 'share of output delivered in melee'],
  ['dmgPerPress', 'HP delivered per weapon press'],
  ['pressRate', 'presses per engaged second'],
  ['stunShare', 'share of output carrying a stun'],
  ['slowShare', 'share of output carrying a slow'],
  ['focus', 'share of output from its single biggest weapon'],
  ['mobility', 'wu walked per second of play'],
  ['startMs', 'ms from the whistle to its first damage'],
];

/**
 * ⚠️ THE SCALE HAS TO COME FROM SOMEWHERE FIXED, OR THIS METRIC CANNOT BE COMPARED.
 *
 * Z-scoring inside the run makes the nine features commensurable and, on its own, makes
 * the result scale-free — which the uniform-roster control proved is a defect, not a
 * feature: eleven IDENTICAL characters still read a mean behavioural distance of 1.15
 * against the real roster's 1.36, because normalising pure noise still produces spread.
 * A metric that barely moves between "a real roster" and "eleven copies of one character"
 * is not measuring what its name says (`docs/LESSONS.md` §13, "a metric can be perfectly
 * TRUE and tell you nothing").
 *
 * So when a BASELINE is supplied its per-feature mean and SD are used instead, and the
 * distances become comparable across runs in the baseline's units. `zStats` is recorded
 * in the JSON for exactly that purpose.
 */
function zscore(table, ids, fixed = null) {
  const z = {};
  const stats = {};
  for (const id of ids) z[id] = {};
  for (const [f] of FEATURES) {
    const vals = ids.map((id) => table[id][f]);
    const m = fixed ? fixed[f].m : mean(vals);
    const sd = fixed ? fixed[f].sd : Math.sqrt(mean(vals.map((v) => (v - m) ** 2)));
    stats[f] = { m, sd };
    for (const id of ids) z[id][f] = sd < 1e-12 ? 0 : (table[id][f] - m) / sd;
  }
  return { z, stats };
}
function behaviourDist(z, a, b) {
  return Math.sqrt(sum(FEATURES.map(([f]) => (z[a][f] - z[b][f]) ** 2)) / FEATURES.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY — the guard numbers (settled / tier spread / aggregate) come out of the
// SAME run, so a distinctiveness figure and the balance figure it must not move can
// never be taken from two different measurements.
// ─────────────────────────────────────────────────────────────────────────────
function summariseBalance(rates, ids) {
  // ⚠️ NOT called `perChar`. It was, and it was spread into the same object as the
  // DIVERGENCE table's `perChar` — the balance one landed second and silently deleted
  // every distinctiveness number. Caught by a crash; it would have been far worse had the
  // two objects happened to share shapes.
  const strengthOf = {};
  for (const id of ids) {
    const asP = ids.filter((o) => o !== id).map((o) => rates[`${id}>${o}`]);
    const asA = ids.filter((o) => o !== id).map((o) => 1 - rates[`${o}>${id}`]);
    strengthOf[id] = { asPlayer: mean(asP), asAI: mean(asA), strength: (mean(asP) + mean(asA)) / 2 };
  }
  const perChar = strengthOf;
  const strengths = ids.map((id) => perChar[id].strength);
  const m = mean(strengths);
  const sd = Math.sqrt(mean(strengths.map((s) => (s - m) ** 2)));
  const cells = Object.values(rates);
  const settled = cells.filter((r) => r >= 0.95 || r <= 0.05).length;
  const byRarity = {};
  for (const tier of RARITY_ORDER) {
    const tids = ids.filter((id) => CHARACTERS[id].rarity === tier);
    if (tids.length) byRarity[tier] = { n: tids.length, strength: mean(tids.map((id) => perChar[id].strength)), ids: tids };
  }
  const tierVals = RARITY_ORDER.filter((t) => byRarity[t]).map((t) => byRarity[t].strength);
  return {
    strengthOf, strengthMean: m, sd, settled, total: cells.length, byRarity,
    tierSpread: Math.max(...tierVals) - Math.min(...tierVals),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// --selftest
// ─────────────────────────────────────────────────────────────────────────────
if (args.selftest) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };
  console.log(`\n══ kit_lab SELFTEST ══  sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}`);

  const IDS = [...CHARACTER_IDS];

  // ── A. THE MATHS, ON TABLES WHOSE ANSWER IS DERIVABLE BY HAND ─────────────
  //
  // A metric that reports a plausible number on a real roster and the WRONG number on a
  // known input is this project's most expensive failure mode (`docs/LESSONS.md` §13).
  {
    // 1. TWO LITERAL CLONES. Give `taco` and `burrito` identical results against every
    //    shared opponent; their divergence must be exactly zero and their rho exactly 1.
    const rates = {};
    for (const a of IDS) for (const b of IDS) if (a !== b) rates[`${a}>${b}`] = 0.5;
    // A ragged, non-constant profile, so rho = 1 is a real result and not 0/0.
    IDS.forEach((o, i) => {
      if (o === 'taco' || o === 'burrito') return;
      const v = 0.2 + 0.06 * i;
      rates[`taco>${o}`] = v; rates[`${o}>taco`] = 1 - v;
      rates[`burrito>${o}`] = v; rates[`${o}>burrito`] = 1 - v;
    });
    const S = scoreMatrix(rates, IDS);
    ok('two literal clones read RMSD 0.0 pp and rho 1.000',
      profileRmsd(S, 'taco', 'burrito', IDS) < 1e-12 && Math.abs(profileRho(S, 'taco', 'burrito', IDS) - 1) < 1e-12,
      `rmsd ${(profileRmsd(S, 'taco', 'burrito', IDS) * 100).toFixed(3)}pp rho ${profileRho(S, 'taco', 'burrito', IDS).toFixed(4)}`);

    // 2. A PURE OFFSET IS NOT A DIFFERENCE. Make burrito beat everyone by exactly +0.2
    //    more than taco does: same shape, more power. Centring must delete it entirely —
    //    this is the property that keeps the metric orthogonal to the balance guard.
    const rates2 = { ...rates };
    IDS.forEach((o, i) => {
      if (o === 'burrito' || o === 'taco') return;
      const v = 0.2 + 0.06 * i + 0.2;
      rates2[`burrito>${o}`] = v; rates2[`${o}>burrito`] = 1 - v;
    });
    const S2 = scoreMatrix(rates2, IDS);
    ok('a character that simply wins 20 pp more is NOT thereby distinctive (centring works)',
      profileRmsd(S2, 'taco', 'burrito', IDS) < 1e-12,
      `rmsd ${(profileRmsd(S2, 'taco', 'burrito', IDS) * 100).toFixed(3)}pp`);

    // 3. AN INVERTED PROFILE IS MAXIMALLY UNLIKE. Same magnitudes, opposite order.
    const rates3 = { ...rates };
    const revIds = IDS.filter((o) => o !== 'taco' && o !== 'burrito');
    revIds.forEach((o, i) => {
      const v = 0.2 + 0.06 * (IDS.length - 1 - IDS.indexOf(o));
      rates3[`burrito>${o}`] = v; rates3[`${o}>burrito`] = 1 - v;
    });
    const S3 = scoreMatrix(rates3, IDS);
    ok('an inverted profile reads rho < 0 — the sign of the metric is not flipped',
      profileRho(S3, 'taco', 'burrito', IDS) < -0.5,
      `rho ${profileRho(S3, 'taco', 'burrito', IDS).toFixed(3)}`);

    // 4. The role-symmetric score is antisymmetric about 0.5 by construction.
    const bad = IDS.flatMap((a) => IDS.filter((b) => b !== a)
      .filter((b) => Math.abs(S[a][b] + S[b][a] - 1) > 1e-12).map((b) => `${a}/${b}`));
    ok('score[a][b] + score[b][a] === 1 for all 110 cells', bad.length === 0, bad.slice(0, 3).join(' '));

    // 5. The noise-floor subtraction cannot manufacture signal out of noise.
    ok('a pair closer than the floor corrects to exactly 0, never to a negative number',
      Math.sqrt(Math.max(0, 0.02 ** 2 - 0.05 ** 2)) === 0);
  }

  // ── B. THE BEHAVIOURAL FINGERPRINT, ON A KNOWN TABLE ──────────────────────
  {
    const table = {};
    IDS.forEach((id, i) => {
      table[id] = Object.fromEntries(FEATURES.map(([f]) => [f, i]));
    });
    const { z } = zscore(table, IDS);
    ok('two identical behaviour rows are distance 0 apart',
      behaviourDist(zscore({ ...table, taco: { ...table.burrito } }, IDS).z, 'taco', 'burrito') < 1e-12);
    ok('a feature with zero variance contributes nothing rather than NaN',
      Number.isFinite(behaviourDist(z, 'taco', 'burrito'))
      && Number.isFinite(behaviourDist(zscore(Object.fromEntries(IDS.map((id) => [id, Object.fromEntries(FEATURES.map(([f]) => [f, 1]))])), IDS).z, 'taco', 'burrito')));
    // …and the SCALE can be pinned to another run's, which is what makes two runs comparable.
    const fixed = zscore(table, IDS).stats;
    const shifted = Object.fromEntries(IDS.map((id) => [id, Object.fromEntries(FEATURES.map(([f]) => [f, table[id][f] * 2]))]));
    ok('with a FIXED scale, doubling every feature doubles every distance (it is not renormalised away)',
      Math.abs(behaviourDist(zscore(shifted, IDS, fixed).z, 'taco', 'burrito')
        - 2 * behaviourDist(zscore(table, IDS, fixed).z, 'taco', 'burrito')) < 1e-9);
  }

  // ── C. THE SIM SIDE — this tool runs the SAME MATCH `roster_lab.mjs` runs ──
  //
  // Both tools import one driver and share one seed formula, so a matchup cell must come
  // out IDENTICAL. If it does not, one of them is measuring a different game and every
  // before/after taken across the two is meaningless.
  if (arena && !args['skip-crosscheck']) {
    execFileSync(process.execPath,
      [`${ROOT}/tools/tmp/roster_lab.mjs`, '--seeds', '4', '--policies', 'smart2',
        '--skip-crosscheck', '--sim', SIM_DIR, '--json', `/tmp/kitlab_xcheck_${process.pid}.json`],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const rl = JSON.parse(readFileSync(`/tmp/kitlab_xcheck_${process.pid}.json`, 'utf8'));
    const mine = {};
    for (const p of IDS) for (const e of IDS) {
      if (p === e) continue;
      let w = 0;
      for (let s = 0; s < 4; s++) if (runMatch(p, e, 'smart2', s).winner === 'player') w++;
      mine[`${p}>${e}`] = w / 4;
    }
    const differ = Object.keys(mine).filter((k) => Math.abs(mine[k] - rl.policies.smart2.matchupRates[k]) > 1e-12);
    ok('every one of the 110 matchup cells is BIT-IDENTICAL to roster_lab.mjs at the same seeds',
      differ.length === 0, differ.slice(0, 4).map((k) => `${k} ${mine[k]} vs ${rl.policies.smart2.matchupRates[k]}`).join(' · '));
    const agg = summariseBalance(mine, IDS);
    ok('…and so is the settled count derived from them',
      agg.settled === rl.policies.smart2.settled, `${agg.settled} vs ${rl.policies.smart2.settled}`);
  }

  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// RUN
// ─────────────────────────────────────────────────────────────────────────────
const t0 = Date.now();
const IDS = [...CHARACTER_IDS];
// Loaded BEFORE the run, not in the report: the behavioural feature scale is taken from
// it so two runs are measured in the same units (see `zscore`).
const baseline = args.baseline ? JSON.parse(readFileSync(String(args.baseline), 'utf8')) : null;
const out = {
  seeds: SEEDS, dt: DT, policies: {}, simDir: SIM_DIR,
  clockMs: MATCH_DURATION_MS,
  countdownMs: COUNTDOWN_FROM * 1000 + COUNTDOWN_START_FLASH_MS,
  roster: Object.fromEntries(IDS.map((id) => [id, {
    rarity: CHARACTERS[id].rarity, stats: CHARACTERS[id].stats,
    weapons: CHARACTERS[id].weapons.map((w) => w.key),
  }])),
};
let nMatches = 0;

for (const policy of POLICIES) {
  // wins[half][a>b] — the seed halves are kept apart from the start so the split-half
  // noise floor is measured on the SAME matches as everything else.
  const wins = [{}, {}, {}];   // 0 = all seeds, 1 = even seeds, 2 = odd seeds
  // Three buckets, exactly like `wins`: all seeds, even seeds, odd seeds. The two halves
  // exist so the BEHAVIOURAL metric gets a measured noise floor too — without one,
  // "the roster mean moved 1.361 -> 1.416" is a number with no scale attached to it.
  const blankAcc = () => Object.fromEntries(IDS.map((id) => [id, {
    dmg: 0, dmgMelee: 0, dmgStun: 0, dmgSlow: 0, dmgAtDist: 0,
    hits: 0, presses: 0, biggest: [], byWeapon: {}, travel: 0,
    playMs: 0, engagedMs: 0, firstMs: [], matches: 0,
  }]));
  const accs = [blankAcc(), blankAcc(), blankAcc()];
  const acc = accs[0];

  for (const p of IDS) {
    for (const e of IDS) {
      if (p === e) continue;
      for (let s = 0; s < SEEDS; s++) {
        const r = runMatch(p, e, policy, s);
        nMatches++;
        const k = `${p}>${e}`;
        for (const h of [0, 1 + (s % 2)]) {
          (wins[h][k] ??= { w: 0, n: 0 });
          wins[h][k].n++;
          if (r.winner === 'player') wins[h][k].w++;
        }
        for (const role of ['player', 'enemy']) {
          const id = role === 'player' ? p : e;
          const tt = r.t[role];
          for (const h of [0, 1 + (s % 2)]) {
            const A = accs[h][id];
            A.dmg += tt.dmg; A.dmgMelee += tt.dmgMelee; A.dmgStun += tt.dmgStun;
            A.dmgSlow += tt.dmgSlow; A.dmgAtDist += tt.dmgAtDist;
            A.hits += tt.hits; A.presses += tt.presses; A.travel += tt.travel;
            A.playMs += r.playMs; A.engagedMs += r.engagedMs; A.matches++;
            if (tt.dmg > 0) A.biggest.push(tt.biggestHit);
            if (tt.firstDamageMs !== null) A.firstMs.push(tt.firstDamageMs);
            for (const [wk, v] of Object.entries(tt.byWeapon)) A.byWeapon[wk] = (A.byWeapon[wk] ?? 0) + v;
          }
        }
      }
    }
  }

  const rate = (h) => Object.fromEntries(Object.entries(wins[h]).map(([k, v]) => [k, v.w / v.n]));
  const rates = rate(0);
  const S = scoreMatrix(rates, IDS);
  const S1 = scoreMatrix(rate(1), IDS), S2 = scoreMatrix(rate(2), IDS);

  // ── THE NOISE FLOOR, measured on half the seeds each side ─────────────────
  const selfR = IDS.map((c) => selfRmsd(S1, S2, c, IDS));
  const halfFloor = Math.sqrt(mean(selfR.map((x) => x * x)));   // RMS, because RMSDs add in quadrature
  // ── ⚠️ THE CONVERSION FROM HALF-RUN TO FULL-RUN, AND IT WAS WRONG ONCE ────
  //
  // A cell estimated from n seeds has variance sigma^2 ∝ 1/n. The split-half figure is
  // the RMS difference of two n/2-seed estimates: 2 * sigma^2(n/2) = 4 * sigma^2(n).
  // A pair of DIFFERENT characters at n seeds is the difference of two n-seed estimates:
  // 2 * sigma^2(n). So the ratio of variances is 2 and the floor is halfFloor / sqrt(2),
  // NOT halfFloor / 2.
  //
  // The first version divided by 2 and it was caught by the CLONE, not by the algebra:
  // `stage_kit.mjs --clone hamburger:hotdog` produces two characters that are identical
  // by construction, and they read raw 6.18 pp — above the 4.27 pp the wrong formula
  // claimed, i.e. the tool would have reported a literal clone as a real difference.
  // Against the corrected 6.05 pp floor the same pair corrects to 1.26 pp, which is the
  // answer a clone has to give. That is the whole argument for validating an instrument
  // against a known input (`docs/LESSONS.md` §13).
  const floor = halfFloor / Math.SQRT2;
  const selfRhoV = IDS.map((c) => selfRho(S1, S2, c, IDS));
  // Spearman-Brown: reliability of the doubled-length (full-seed) measurement.
  const relHalf = mean(selfRhoV);
  const reliability = (2 * relHalf) / (1 + relHalf);

  // ── PAIRWISE PROFILE DIVERGENCE ───────────────────────────────────────────
  const pairs = [];
  for (let i = 0; i < IDS.length; i++) {
    for (let j = i + 1; j < IDS.length; j++) {
      const a = IDS[i], b = IDS[j];
      const raw = profileRmsd(S, a, b, IDS);
      pairs.push({
        a, b, raw,
        corrected: Math.sqrt(Math.max(0, raw * raw - floor * floor)),
        rho: profileRho(S, a, b, IDS),
      });
    }
  }
  const perChar = {};
  for (const id of IDS) {
    const mine = pairs.filter((p) => p.a === id || p.b === id);
    const nearest = mine.reduce((x, y) => (y.corrected < x.corrected ? y : x));
    const amp = amplitude(S, id, IDS);
    perChar[id] = {
      divergence: mean(mine.map((p) => p.corrected)),
      rawDivergence: mean(mine.map((p) => p.raw)),
      meanRho: mean(mine.map((p) => p.rho)),
      nearest: nearest.a === id ? nearest.b : nearest.a,
      nearestDist: nearest.corrected,
      maxRho: Math.max(...mine.map((p) => p.rho)),
      // A single cell's noise variance is halfFloor^2 / 4 (see the floor derivation).
      amplitude: Math.sqrt(Math.max(0, amp * amp - (halfFloor * halfFloor) / 4)),
      rawAmplitude: amp,
    };
  }

  // ── BEHAVIOURAL FINGERPRINT ───────────────────────────────────────────────
  const buildBTable = (a) => Object.fromEntries(IDS.map((id) => {
    const A = a[id];
    const wv = Object.values(A.byWeapon);
    return [id, {
      engageDist: A.dmg > 0 ? A.dmgAtDist / A.dmg : 0,
      meleeShare: A.dmg > 0 ? A.dmgMelee / A.dmg : 0,
      dmgPerPress: A.presses > 0 ? A.dmg / A.presses : 0,
      pressRate: A.engagedMs > 0 ? (A.presses / A.engagedMs) * 1000 : 0,
      stunShare: A.dmg > 0 ? A.dmgStun / A.dmg : 0,
      slowShare: A.dmg > 0 ? A.dmgSlow / A.dmg : 0,
      focus: A.dmg > 0 ? Math.max(...wv, 0) / sum(wv) : 0,
      mobility: A.playMs > 0 ? (A.travel / A.playMs) * 1000 : 0,
      startMs: A.firstMs.length ? mean(A.firstMs) : MATCH_DURATION_MS,
      _dmgPerMatch: A.dmg / A.matches,
    }];
  }));
  const bTable = buildBTable(acc);
  // Pin the scale to the baseline's when there is one — see `zscore`.
  const { z, stats: zStats } = zscore(bTable, IDS, baseline?.policies?.[policy]?.zStats ?? null);
  const bPairs = [];
  for (let i = 0; i < IDS.length; i++) {
    for (let j = i + 1; j < IDS.length; j++) bPairs.push({ a: IDS[i], b: IDS[j], d: behaviourDist(z, IDS[i], IDS[j]) });
  }
  // ── THE BEHAVIOURAL NOISE FLOOR, on the same split-half principle ─────────
  // Each character against ITSELF on the other half of the seeds, scored in the SAME
  // z-units as the pairwise table above. Halves have twice the variance of the full run,
  // so the full-run floor is the half figure / sqrt(2) — the same conversion, and the
  // same trap, as the profile floor.
  const zH1 = zscore(buildBTable(accs[1]), IDS, zStats).z;
  const zH2 = zscore(buildBTable(accs[2]), IDS, zStats).z;
  const bHalfFloor = Math.sqrt(mean(IDS.map((id) =>
    sum(FEATURES.map(([f]) => (zH1[id][f] - zH2[id][f]) ** 2)) / FEATURES.length)));
  const bFloor = bHalfFloor / Math.SQRT2;
  for (const id of IDS) {
    const mine = bPairs.filter((p) => p.a === id || p.b === id);
    const nearest = mine.reduce((x, y) => (y.d < x.d ? y : x));
    perChar[id].behaviour = mean(mine.map((p) => p.d));
    perChar[id].bNearest = nearest.a === id ? nearest.b : nearest.a;
    perChar[id].bNearestDist = nearest.d;
  }

  const balance = summariseBalance(rates, IDS);
  const byTier = {};
  for (const tier of RARITY_ORDER) {
    const tids = IDS.filter((id) => CHARACTERS[id].rarity === tier);
    if (!tids.length) continue;
    byTier[tier] = {
      n: tids.length, ids: tids,
      divergence: mean(tids.map((id) => perChar[id].divergence)),
      behaviour: mean(tids.map((id) => perChar[id].behaviour)),
      strength: balance.byRarity[tier].strength,
    };
  }

  out.policies[policy] = {
    n: nMatches, rates, matchupRates: rates,
    playerWinRate: mean(Object.values(rates)),
    floor, halfFloor, reliability,
    pairs, perChar, bTable, bPairs, byTier, zStats, bFloor, bHalfFloor, ...balance,
  };
  // A key collision here already deleted the entire distinctiveness table once (see
  // `summariseBalance`). An object literal that silently loses half its contents is
  // exactly the failure class this project keeps paying for, so it is now checked.
  for (const id of IDS) {
    const c = out.policies[policy].perChar[id];
    if (!c || typeof c.divergence !== 'number' || typeof c.behaviour !== 'number') {
      console.error(`kit_lab: the per-character table lost its fields for ${id} — a key collision in the report object`);
      process.exit(4);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT
// ─────────────────────────────────────────────────────────────────────────────
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const pp = (v) => `${(v * 100).toFixed(2)}pp`;
const dpp = (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}`;

console.log(`\n╔══ KIT LAB ══ ${nMatches} matches · ${SEEDS} seeds × 110 matchups × ${POLICIES.length} policies · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`║ sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}`);
console.log(`╚═══════════════════════════════════════════════════════════════════════════`);

if (baseline && baseline.seeds !== SEEDS) console.log(`  ⚠️  SEED COUNT DIFFERS (${baseline.seeds} vs ${SEEDS}) — NOT paired. Re-run.`);

for (const policy of POLICIES) {
  const P = out.policies[policy];
  const B = baseline?.policies?.[policy] ?? null;
  console.log(`\n══════ POLICY ${policy.toUpperCase()} ══════`);
  console.log(`  ⚠️  RESOLUTION FLOOR, measured on this run: a profile RMSD below ${pp(P.floor)} is NOISE.`);
  console.log(`      (same character, two disjoint seed halves: ${pp(P.halfFloor)} at ${SEEDS / 2} seeds -> ${pp(P.floor)} at ${SEEDS})`);
  console.log(`      profile reliability (Spearman-Brown, ${SEEDS} seeds): ${P.reliability.toFixed(3)}`);

  const meanDiv = mean(P.pairs.map((p) => p.corrected));
  const meanRaw = mean(P.pairs.map((p) => p.raw));
  const meanRho = mean(P.pairs.map((p) => p.rho));
  const clones = P.pairs.filter((p) => p.raw <= P.floor).length;
  const nearFloor = P.pairs.filter((p) => p.corrected < P.floor).length;
  console.log(`\n  ── 1. MATCHUP-PROFILE DIVERGENCE (the headline) ──`);
  console.log(`  roster mean pairwise RMSD  raw ${pp(meanRaw)} · NOISE-CORRECTED ${pp(meanDiv)}` +
    (B ? `   (was ${pp(mean(B.pairs.map((p) => p.corrected)))}, ${dpp(meanDiv - mean(B.pairs.map((p) => p.corrected)))}pp)` : ''));
  console.log(`  roster mean pairwise rho   ${meanRho.toFixed(3)}${B ? `   (was ${mean(B.pairs.map((p) => p.rho)).toFixed(3)})` : ''}`);
  console.log(`  pairs INDISTINGUISHABLE (raw <= floor): ${clones}/55   ·   pairs within one floor of it: ${nearFloor}/55`);
  console.log(`  ⚠️ CALIBRATION: a LITERAL clone (stage_kit --clone hamburger:hotdog) reads raw 6.18pp / corrected 1.26pp / rho 0.89.`);

  console.log(`\n  ${'character'.padEnd(12)}${'rarity'.padStart(10)}${'divergence'.padStart(12)}${B ? '     Δ' : ''}${'amplitude'.padStart(11)}${'rho'.padStart(7)}${'nearest'.padStart(14)}${'dist'.padStart(9)}${'behaviour'.padStart(11)}${'bNearest'.padStart(13)}`);
  const order = [...IDS].sort((a, b) => P.perChar[a].divergence - P.perChar[b].divergence);
  for (const id of order) {
    const c = P.perChar[id];
    const d = B ? `  ${dpp(c.divergence - B.perChar[id].divergence).padStart(5)}` : '';
    console.log(`  ${id.padEnd(12)}${CHARACTERS[id].rarity.padStart(10)}${pp(c.divergence).padStart(12)}${d}${pp(c.amplitude).padStart(11)}${c.meanRho.toFixed(2).padStart(7)}${c.nearest.padStart(14)}${pp(c.nearestDist).padStart(9)}${c.behaviour.toFixed(2).padStart(11)}${c.bNearest.padStart(13)}`);
  }

  console.log(`\n  the five most SIMILAR pairs in the roster (corrected RMSD):`);
  for (const p of [...P.pairs].sort((x, y) => x.corrected - y.corrected).slice(0, 5)) {
    console.log(`    ${p.a.padEnd(12)} ~ ${p.b.padEnd(12)} ${pp(p.corrected).padStart(8)}  (raw ${pp(p.raw)}, rho ${p.rho.toFixed(2)})  ${CHARACTERS[p.a].rarity}/${CHARACTERS[p.b].rarity}`);
  }
  console.log(`  the five most DIFFERENT:`);
  for (const p of [...P.pairs].sort((x, y) => y.corrected - x.corrected).slice(0, 5)) {
    console.log(`    ${p.a.padEnd(12)} ~ ${p.b.padEnd(12)} ${pp(p.corrected).padStart(8)}  (raw ${pp(p.raw)}, rho ${p.rho.toFixed(2)})  ${CHARACTERS[p.a].rarity}/${CHARACTERS[p.b].rarity}`);
  }

  console.log(`\n  ── 2. BEHAVIOURAL FINGERPRINT (what a player would notice) ──`);
  const hdr = ['engageDist', 'meleeSh', 'dmg/press', 'press/s', 'stunSh', 'slowSh', 'focus', 'mobility', 'startMs', 'dmg/match'];
  console.log(`  ${'character'.padEnd(12)}${hdr.map((h) => h.padStart(11)).join('')}`);
  for (const id of IDS) {
    const b = P.bTable[id];
    console.log(`  ${id.padEnd(12)}${[
      b.engageDist.toFixed(1), b.meleeShare.toFixed(2), b.dmgPerPress.toFixed(2), b.pressRate.toFixed(2),
      b.stunShare.toFixed(2), b.slowShare.toFixed(2), b.focus.toFixed(2), b.mobility.toFixed(1),
      b.startMs.toFixed(0), b._dmgPerMatch.toFixed(1),
    ].map((v) => String(v).padStart(11)).join('')}`);
  }
  const meanB = mean(P.bPairs.map((p) => p.d));
  console.log(`  roster mean pairwise behaviour distance ${meanB.toFixed(3)} (z-space)${B ? `   (was ${mean(B.bPairs.map((p) => p.d)).toFixed(3)}, ${(meanB - mean(B.bPairs.map((p) => p.d)) >= 0 ? '+' : '')}${(meanB - mean(B.bPairs.map((p) => p.d))).toFixed(3)})` : ''}`);
  console.log(`  ⚠️  BEHAVIOURAL FLOOR ${P.bFloor.toFixed(3)} — same character, disjoint seed halves (${P.bHalfFloor.toFixed(3)} at ${SEEDS / 2} seeds). A behaviour distance below this is noise.`);
  console.log(`  closest behavioural pairs: ${[...P.bPairs].sort((x, y) => x.d - y.d).slice(0, 4).map((p) => `${p.a}~${p.b} ${p.d.toFixed(2)}`).join(' · ')}`);

  console.log(`\n  ── 3. BY RARITY TIER — distinctiveness must RISE with rarity, strength must NOT ──`);
  console.log(`  ${'tier'.padEnd(11)}${'n'.padStart(3)}${'divergence'.padStart(12)}${'behaviour'.padStart(11)}${'strength'.padStart(10)}   members`);
  for (const t of RARITY_ORDER) {
    const T = P.byTier[t];
    if (!T) continue;
    console.log(`  ${t.padEnd(11)}${String(T.n).padStart(3)}${pp(T.divergence).padStart(12)}${T.behaviour.toFixed(2).padStart(11)}${pct(T.strength).padStart(10)}   ${T.ids.join(', ')}`);
  }

  console.log(`\n  ── 4. ⚠️ THE GUARD — measured on these SAME matches ──`);
  console.log(`  rarity tier SPREAD  ${pp(P.tierSpread)}   (must stay under the ~9 pp aggregate noise floor)${B ? `   was ${pp(B.tierSpread)}` : ''}`);
  console.log(`  SETTLED matchups    ${P.settled}/${P.total}${B ? `   was ${B.settled}/${B.total} (${P.settled - B.settled >= 0 ? '+' : ''}${P.settled - B.settled})` : ''}`);
  {
    // Named, not just counted. A settled count is a number; the LIST is what tells you
    // whether the cause is one character, one archetype, or the arena.
    const cells = Object.keys(P.rates).filter((k) => P.rates[k] >= 0.95 || P.rates[k] <= 0.05);
    const involved = {};
    for (const k of cells) for (const id of k.split('>')) involved[id] = (involved[id] ?? 0) + 1;
    console.log(`    cells: ${cells.map((k) => `${k}=${(P.rates[k] * 100).toFixed(0)}%`).join(' · ')}`);
    console.log(`    characters involved: ${Object.entries(involved).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id} ${n}`).join(' · ')}`);
    if (B) {
      const was = new Set(Object.keys(B.rates).filter((k) => B.rates[k] >= 0.95 || B.rates[k] <= 0.05));
      const now = new Set(cells);
      console.log(`    broken: ${[...was].filter((k) => !now.has(k)).join(', ') || '—'}`);
      console.log(`    new:    ${[...now].filter((k) => !was.has(k)).join(', ') || '—'}`);
    }
  }
  console.log(`  aggregate player win ${pct(P.playerWinRate)}${B ? `   was ${pct(B.playerWinRate)} (${dpp(P.playerWinRate - B.playerWinRate)}pp)` : ''}   · roster sd ${pp(P.sd)}`);
  console.log(`  per-character strength: ${[...IDS].sort((a, b) => P.strengthOf[b].strength - P.strengthOf[a].strength).map((id) => `${id} ${pct(P.strengthOf[id].strength)}`).join(' · ')}`);

  if (B) {
    const ks = Object.keys(P.rates);
    const dw = ks.map((k) => (P.rates[k] ?? 0) - (B.rates[k] ?? 0));
    const absw = dw.map(Math.abs);
    console.log(`  PAIRED per-matchup deltas (EXACT — a different quantity from the aggregate):`);
    console.log(`    max |Δ| ${dpp(Math.max(...absw))}pp · mean |Δ| ${dpp(mean(absw))}pp · ${absw.filter((x) => x > 1e-9).length}/${ks.length} matchups moved`);
  }
}

console.log('');
if (args.json) { writeFileSync(String(args.json), JSON.stringify(out, null, 2)); console.log(`wrote ${args.json}\n`); }
