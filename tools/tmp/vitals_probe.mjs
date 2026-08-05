#!/usr/bin/env node
/**
 * VITALS PROBE — what one point of the character card is worth, per character.
 *
 * `rules.ts` AUTHORISED DEVIATION #10 makes `stats.health` and `stats.speed` real, and
 * the immediate question is how big a step on each is. Guessing it would have meant
 * tuning a roster against an unmeasured lever, which is how `DECISIONS §13` came to
 * contain a correlation that did not reproduce.
 *
 * Method: hold the WHOLE roster at neutral (`health = HEALTH_BASELINE_STAT`,
 * `speed = SPEED_TOP_STAT`, i.e. every multiplier exactly 1.0 — verified bit-identical to
 * the pre-vitals tree across all 220 matchup cells), then move ONE character's ONE stat
 * and re-measure. Everything else in the roster is held, so the delta is that stat's
 * price for that character and nothing else.
 *
 *   node tools/tmp/vitals_probe.mjs --axis health --values 4,8 --seeds 8
 *   node tools/tmp/vitals_probe.mjs --axis speed  --values 4,6 --chars pizza,lollipop
 *   node tools/tmp/vitals_probe.mjs --table /tmp/cand.json --seeds 32   # evaluate one roster
 *
 * ⚠️ These are PER-CHARACTER, and they are not interchangeable: a fragile character
 * converts HP into win rate far better than a durable one, because the quantity that
 * decides a matchup is how many exchanges each side survives, not how much HP it holds.
 * Do not average them into a single "points per stat".
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

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

const { CHARACTER_IDS, CHARACTERS, HEALTH_BASELINE_STAT, SPEED_TOP_STAT, RARITY_ORDER } =
  await import(`${ROOT}/src/game/rules.ts`);

/**
 * ⚠️ SCRATCH PATHS ARE PER-PROCESS. Two of these running at once shared one staging
 * directory and one output JSON, so each was reading the other's roster — the pure-Node
 * form of `docs/LESSONS.md` §5, and it produced a plausible, entirely wrong speed table
 * before it was caught. The PID is in the path so a second copy cannot contaminate a
 * first, and `--scratch` names it explicitly when that matters.
 */
const SCRATCH = String(args.scratch ?? `/tmp/vitals_probe_${process.pid}`);

const SEEDS = String(args.seeds ?? 8);
const POLICIES = String(args.policies ?? 'smart2');
const NEUTRAL = () => Object.fromEntries(CHARACTER_IDS.map((id) =>
  [id, { health: HEALTH_BASELINE_STAT, speed: SPEED_TOP_STAT }]));

/** Stage a table and run the roster instrument on it. Returns the parsed report. */
function evaluate(table, extra = {}) {
  writeFileSync(`${SCRATCH}.cand.json`, JSON.stringify({ ...extra, stats: table }));
  execFileSync(process.execPath, [`${ROOT}/tools/tmp/stage_vitals.mjs`, `${SCRATCH}.stage`, `${SCRATCH}.cand.json`],
    { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
  const out = execFileSync(process.execPath,
    [`${ROOT}/tools/tmp/roster_lab.mjs`, '--seeds', SEEDS, '--policies', POLICIES,
      '--sim', `${SCRATCH}.stage/game`, '--json', `${SCRATCH}.out.json`],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { out, json: JSON.parse(readFileSync(`${SCRATCH}.out.json`, 'utf8')) };
}

const pct = (v) => `${(v * 100).toFixed(1)}%`;

// ── MODE 1: evaluate one candidate roster end to end ───────────────────────
if (args.table) {
  const cand = JSON.parse(readFileSync(String(args.table), 'utf8'));
  const r = evaluate(cand.stats, cand);
  const pol = POLICIES.split(',')[0];
  const P = r.json.policies[pol];
  console.log(r.out);
  console.log(`SUMMARY  ${pol}  win ${pct(P.playerWinRate)}  settled ${P.settled}/110  sd ${(P.sd * 100).toFixed(1)}pp  monotonic ${P.monotonic ? 'YES' : 'NO'}`);
  console.log(`  ${RARITY_ORDER.filter((t) => P.byRarity[t]).map((t) => `${t} ${pct(P.byRarity[t].strength)}`).join('  ·  ')}`);
  process.exit(0);
}

// ── MODE 3: FIT a health ramp to a target strength per rarity tier ─────────
//
// Coordinate descent on the real objective, because the linear model built from MODE 2
// is only good near neutral: every character's response SATURATES at both ends (a
// character already winning 95% gains ~5 pp from a health point, one at 12% gains ~16),
// so a one-shot solve lands nowhere near. Each round measures, moves every character by
// `round(error / --slope)` health points, and re-measures.
//
// The SETTLED-MATCHUP count is printed every round, because that is the quantity this
// whole exercise is for and it is the one that could refuse to move.
//
//   node tools/tmp/vitals_probe.mjs --fit --rounds 5 --seeds 8 \
//     --targets Normal=38,Rare=44,Epic=49,Legendary=53,Neon=57,Cyber=61
if (args.fit) {
  const targets = Object.fromEntries(String(args.targets).split(',').map((p) => {
    const [k, v] = p.split('='); return [k, Number(v) / 100];
  }));
  const SLOPE = Number(args.slope ?? 15) / 100;
  const LO = Number(args.lo ?? 2), HI = Number(args.hi ?? 10);
  const ROUNDS = Number(args.rounds ?? 5);
  const pol = POLICIES.split(',')[0];

  let table = args.from
    ? JSON.parse(readFileSync(String(args.from), 'utf8')).stats
    : NEUTRAL();

  for (let round = 0; round <= ROUNDS; round++) {
    const P = evaluate(table).json.policies[pol];
    const tiers = RARITY_ORDER.filter((t) => P.byRarity[t]);
    console.log(`\n── round ${round} · win ${pct(P.playerWinRate)} · SETTLED ${P.settled}/110 · sd ${(P.sd * 100).toFixed(1)}pp · monotonic ${P.monotonic ? 'YES' : 'NO'}`);
    console.log(`   ${tiers.map((t) => `${t} ${pct(P.byRarity[t].strength)}`).join('  ·  ')}`);
    console.log(`   ${CHARACTER_IDS.map((id) => `${id} h${table[id].health}=${pct(P.perChar[id].strength)}`).join(' · ')}`);
    if (round === ROUNDS) {
      writeFileSync(`${SCRATCH}.fit.json`, JSON.stringify({ stats: table }, null, 2));
      console.log(`\n   wrote ${SCRATCH}.fit.json`);
      break;
    }
    for (const id of CHARACTER_IDS) {
      const err = targets[CHARACTERS[id].rarity] - P.perChar[id].strength;
      const step = Math.round(err / SLOPE);
      table[id].health = Math.max(LO, Math.min(HI, table[id].health + step));
    }
  }
  process.exit(0);
}

// ── MODE 2: one stat, one character at a time ──────────────────────────────
const AXIS = String(args.axis ?? 'health');
const VALUES = String(args.values ?? (AXIS === 'health' ? '4,8' : '4,6')).split(',').map(Number);
const CHARS = args.chars ? String(args.chars).split(',') : [...CHARACTER_IDS];

console.log(`\n══ VITALS PROBE — one ${AXIS} point at a time · ${SEEDS} seeds · policy ${POLICIES} ══`);
const base = evaluate(NEUTRAL()).json.policies[POLICIES.split(',')[0]];
console.log(`   neutral roster: win ${pct(base.playerWinRate)} · settled ${base.settled}/110 · sd ${(base.sd * 100).toFixed(1)}pp\n`);
console.log(`   ${'character'.padEnd(12)}${'neutral'.padStart(9)}${VALUES.map((v) => `${AXIS}=${v}`.padStart(11)).join('')}   per point`);

for (const id of CHARS) {
  const cells = [];
  for (const v of VALUES) {
    const t = NEUTRAL();
    t[id][AXIS] = v;
    cells.push(evaluate(t).json.policies[POLICIES.split(',')[0]].perChar[id].strength);
  }
  const neutralV = AXIS === 'health' ? HEALTH_BASELINE_STAT : SPEED_TOP_STAT;
  const span = VALUES.length >= 2 ? (cells[cells.length - 1] - cells[0]) / (VALUES[VALUES.length - 1] - VALUES[0]) : 0;
  console.log(`   ${id.padEnd(12)}${pct(base.perChar[id].strength).padStart(9)}` +
    cells.map((c) => pct(c).padStart(11)).join('') +
    `   ${(span * 100).toFixed(1)}pp   (neutral ${AXIS}=${neutralV})`);
}
console.log('');
