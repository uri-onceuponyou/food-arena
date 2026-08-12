#!/usr/bin/env node
/**
 * ZONE-CLOCK ACCEPTANCE — the HUD's "REACHES YOU m:ss" must be the SCHEDULE's answer,
 * not a hand inversion of a schedule that no longer exists.
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 *
 * `6d5c4d6` replaced the ring's "linear in the match clock" close with a HOLD → CLOSE →
 * HOLD-AT-FLOOR schedule (`rules.ts:fogRadiusAt`, inverse `fogReachesRadiusAt`). Two
 * expressions in `ui/hud.ts` still inverted the OLD one by hand,
 * `shrinkPerMs = maxSafeRadius / MATCH_DURATION_MS`:
 *
 *   * `zoneInfo().msUntilEdge` — the number behind "REACHES YOU m:ss". On the shipped
 *     arena the coded sweep is **11.470 wu/s** against a real **15.615** (N=6) /
 *     **16.636** (N<=4), so the countdown ran **36% long at six seats, IN THE DANGEROUS
 *     DIRECTION**. And because `safeRadius` does not move at all before `FOG_HOLD_MS`,
 *     the pre-fix number was FROZEN for the first 25 s: a countdown that does not count.
 *   * `imminentMs` — when the pill starts its alarm. Coded 17 369 ms, clamped by the
 *     12 s cap. ⚠️ **The cap does NOT rescue it at the seat count this game actually
 *     ships**: at N<=4 the true traverse of `FAIR_PLAY.radiusUnits` is **11 975 ms**,
 *     BELOW the cap, so coded 12 000 vs true 11 975 is a real 25 ms error, not a
 *     clamped-to-equal one. It is only "correct by accident" at N>=5.
 *
 * ── HOW THIS MEASURES THE SHIPPED CODE AND NOT A COPY OF IT ─────────────────
 *
 * There is no re-implementation in this file. `imminentMs`, `zoneInfo` and `formatTime`
 * are **lifted out of `src/ui/hud.ts` itself** — esbuild strips the types, a brace matcher
 * cuts the three function texts out of the JS, and `new Function` rebuilds them over a
 * dependency bag taken from `rules.ts` / `camera.ts` / `roster.ts`. What runs below is the
 * HUD's own arithmetic. A regression in the file is a regression here.
 *
 * ⚠️ Two reasons this is a NODE tool and not a browser one, both of them defects I do
 * not own and neither of them mine to route around:
 *   * `game/match.ts:applyQaSetup` still solves `timeRemaining = MATCH_DURATION_MS *
 *     (R / maxR)` for `?fogRadius=`, and clamps its low end to `maxR *
 *     SUDDEN_DEATH_REMAINING_MS / MATCH_DURATION_MS` = 661.67 wu — all of it the
 *     pre-`6d5c4d6` linear schedule. The one lever a browser probe would use to place
 *     the ring is itself wrong, so a browser arm would be measuring through the bug.
 *   * `MatchDebug` publishes no `timeRemaining`, no `safeRadius` and no fighter position,
 *     so a page-side probe cannot state the input it measured at.
 *
 * ── THE TRUTH MODEL IS THE FORWARD SCHEDULE, NEVER THE INVERSE ──────────────
 *
 * 🚨 The obvious expected value is `fogReachesRadiusAt(dist, …) - playMs`, which is also
 * exactly what the fix writes into the HUD. Asserting one against the other is a
 * **SELF-PAIR** — `CLAUDE.md` §6 — and it would read green against any inverse, correct
 * or not. So the expectation here is **bisected out of `fogRadiusAt`, the FORWARD
 * function**: the first instant at which the ring's radius has fallen to the player's
 * distance. `fogReachesRadiusAt` is never called by this file.
 *
 * ── THE KNOWN-BAD IS NOT TYPED IN, IT IS CHECKED OUT ────────────────────────
 *
 * `--known-bad` re-runs every arm against the same three functions lifted from
 * `git show <ref>:src/ui/hud.ts` at the PRE-FIX commit (default `c858e3e`, HEAD when this
 * file was written). Nothing is transcribed, so the negative control cannot rot into
 * agreement with the fix through a typo. **Every countdown arm must FAIL there**, and the
 * run exits non-zero naming any arm that does not.
 *
 * Vacuity guards, because `[].every()` is `true` and that trap has fired five times here:
 *   * both texts must extract NON-EMPTY, and the live text must DIFFER from the pre-fix
 *     text — a known-bad that is byte-identical to the subject tests nothing;
 *   * every band (`hold`, `close`) and the N<=4 slice of the alarm arm assert their row
 *     count is > 0 BEFORE any `every()` runs over them.
 *
 *   node tools/tmp/ht_zoneclock.mjs
 *   node tools/tmp/ht_zoneclock.mjs --known-bad
 *   node tools/tmp/ht_zoneclock.mjs --known-bad --known-bad-ref <sha>
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const has = (k) => argv.includes(k);
const get = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);

const KNOWN_BAD = has('--known-bad');
/** The commit whose `hud.ts` carries the pre-`6d5c4d6` hand inversion. */
const KNOWN_BAD_REF = get('--known-bad-ref', 'c858e3e');
const HUD_REL = 'src/ui/hud.ts';

const ESBUILD = join(ROOT, 'node_modules/.bin/esbuild');
const tmp = mkdtempSync(join(tmpdir(), 'ht-zoneclock-'));
const cleanup = () => rmSync(tmp, { recursive: true, force: true });

// ── The subject: three functions lifted out of hud.ts ────────────────────────

/** Strip the types. No `--bundle`: we want hud.ts's own text, not its dependencies. */
function toJs(tsText, tag) {
  const src = join(tmp, `${tag}.ts`);
  writeFileSync(src, tsText);
  // The `.ts` extension picks the loader; passing `--loader=ts` as well is an error
  // ("only applies when reading from stdin"), which is why the temp file is named.
  return execFileSync(ESBUILD, [src, '--format=esm', '--log-level=error'], { encoding: 'utf8' });
}

/**
 * Cut `function <name>(…) { … }` out of a JS text by matching braces.
 *
 * Types are already gone at this point, which is the whole reason this runs on the
 * transpiled text: `zoneInfo`'s TypeScript signature carries an inline object RETURN TYPE
 * whose braces a matcher would have to know to skip.
 */
function cutFunction(js, name) {
  const at = js.indexOf(`function ${name}(`);
  if (at < 0) return null;
  const open = js.indexOf('{', js.indexOf(')', at));
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < js.length; i++) {
    const c = js[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return js.slice(at, i + 1);
    }
  }
  return null;
}

const NAMES = ['imminentMs', 'zoneInfo', 'formatTime'];

/** Rebuild the lifted functions over a dependency bag. Free identifiers resolve to it. */
function realise(fnTexts, deps) {
  const keys = Object.keys(deps);
  const body = [
    `const { ${keys.join(', ')} } = __deps;`,
    ...NAMES.map((n) => fnTexts[n]),
    `return { ${NAMES.join(', ')} };`,
  ].join('\n');
  // eslint-disable-next-line no-new-func
  return new Function('__deps', body)(deps);
}

// ── The dependency bag, from the modules that own each name ──────────────────

async function loadDeps() {
  const entry = join(tmp, 'entry.mjs');
  writeFileSync(entry, [
    `export * from ${JSON.stringify(join(ROOT, 'src/game/rules.ts'))};`,
    `export { FAIR_PLAY } from ${JSON.stringify(join(ROOT, 'src/render/camera.ts'))};`,
    `export { localFighter, fightersOf, LOCAL_SLOT } from ${JSON.stringify(join(ROOT, 'src/game/roster.ts'))};`,
  ].join('\n'));
  const out = join(tmp, 'deps.mjs');
  execFileSync(ESBUILD, [
    entry, '--bundle', '--format=esm', '--platform=node', '--log-level=error', `--outfile=${out}`,
  ], { stdio: 'inherit' });
  return import(pathToFileURL(out).href);
}

const R = await loadDeps();
const MAXR = (await import(pathToFileURL(await (async () => {
  const entry = join(tmp, 'arena.mjs');
  writeFileSync(entry, `export { MAX_SAFE_RADIUS } from ${JSON.stringify(join(ROOT, 'src/arena/shared.ts'))};`);
  const out = join(tmp, 'arena.out.mjs');
  execFileSync(ESBUILD, [entry, '--bundle', '--format=esm', '--platform=node', '--log-level=error', `--outfile=${out}`], { stdio: 'inherit' });
  return out;
})()).href)).MAX_SAFE_RADIUS;

const DEPS = { ...R, Math, Number, String, Boolean, Object, isNaN, JSON };

// The SUBJECT is the working tree — the file an author is editing right now — while the
// negative control is a commit. Reading the subject off disk rather than out of the index
// is deliberate: an uncommitted fix must be measurable before it is committed.
const liveTs = readFileSync(join(ROOT, HUD_REL), 'utf8');
const badTs = execFileSync('git', ['show', `${KNOWN_BAD_REF}:${HUD_REL}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64e6 });

const liveJs = toJs(liveTs, 'live');
const badJs = toJs(badTs, 'bad');

const liveTexts = Object.fromEntries(NAMES.map((n) => [n, cutFunction(liveJs, n)]));
const badTexts = Object.fromEntries(NAMES.map((n) => [n, cutFunction(badJs, n)]));

// ── Scoring ──────────────────────────────────────────────────────────────────

const rows = [];
/**
 * `scoring` marks the arms that judge the ARITHMETIC, as opposed to the guards that judge
 * this file's own wiring. Only scoring arms are required to fail under `--known-bad`: a
 * guard like "the extraction is non-empty" is SUPPOSED to hold on the pre-fix code.
 *
 * ⚠️ This was a substring match on the arm's name first, and it caught
 * "lifted `imminentMs` … (non-empty)" — a WIRING guard — and reported the negative control
 * as tautological. A flag set at the call site cannot be fooled by an arm being renamed.
 */
const check = (name, pass, evidence = '', scoring = false) => {
  rows.push({ name, pass: !!pass, scoring });
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${name}${evidence ? ` — ${evidence}` : ''}`);
  return !!pass;
};

console.log(`\nht_zoneclock — subject: WORKING TREE ${HUD_REL}${KNOWN_BAD ? `  ·  ARM: KNOWN-BAD, functions from ${KNOWN_BAD_REF}` : ''}`);
console.log(`  maxSafeRadius ${MAXR.toFixed(4)}  FOG_HOLD_MS ${R.FOG_HOLD_MS}  FOG_CLOSE_MS ${R.FOG_CLOSE_MS}  MATCH_DURATION_MS ${R.MATCH_DURATION_MS}`);
console.log(`  floors: ${[2, 4, 5, 6].map((n) => `N=${n} ${R.minSafeRadiusFor(n).toFixed(2)}`).join('  ')}\n`);

// ── Guard 0: the extraction is live, and the known-bad is genuinely different ─

let extractionOk = true;
for (const n of NAMES) {
  extractionOk = check(`lifted \`${n}\` out of ${HUD_REL} (non-empty)`,
    typeof liveTexts[n] === 'string' && liveTexts[n].length > 0,
    liveTexts[n] ? `${liveTexts[n].length} chars` : 'NOT FOUND — the brace matcher missed it') && extractionOk;
  extractionOk = check(`lifted \`${n}\` out of ${KNOWN_BAD_REF}:${HUD_REL} (non-empty)`,
    typeof badTexts[n] === 'string' && badTexts[n].length > 0,
    badTexts[n] ? `${badTexts[n].length} chars` : 'NOT FOUND') && extractionOk;
}
/**
 * 🚨 THE ARM THAT STOPS THIS WHOLE FILE GOING VACUOUS. If the working tree still carries
 * the pre-fix arithmetic, the "known-bad" is the subject and every negative below is a
 * self-pair that proves nothing. Demand a difference in the two functions that matter.
 */
const differs = liveTexts.imminentMs !== badTexts.imminentMs || liveTexts.zoneInfo !== badTexts.zoneInfo;
extractionOk = check('the known-bad DIFFERS from the subject (else every negative is a self-pair)',
  differs,
  differs ? 'imminentMs/zoneInfo texts differ' : `working tree still matches ${KNOWN_BAD_REF} — the fix has not landed`) && extractionOk;

if (!extractionOk) {
  console.log('\nht_zoneclock: extraction failed — no arm below could mean anything. ABORT.\n');
  cleanup();
  process.exit(1);
}

const HUD = realise(KNOWN_BAD ? badTexts : liveTexts, DEPS);

// ── The truth model: bisect the FORWARD schedule. Never `fogReachesRadiusAt`. ─

/**
 * The play-clock instant at which the ring's edge has fallen to `dist`.
 *
 * Bisection on `rules.ts:fogRadiusAt` — the function the SIM steps the ring with — so the
 * expectation is independent of the inverse the HUD is being judged on.
 */
function arrivalMs(dist, maxR, floor) {
  const f = (t) => R.fogRadiusAt(t, maxR, floor);
  if (f(0) <= dist) return 0;
  let lo = 0;
  let hi = R.FOG_CLOSE_MS;
  if (f(hi) > dist) return Infinity; // the ring stops before it ever reaches them
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) <= dist) hi = mid; else lo = mid;
  }
  return hi;
}

/** How long the edge takes to sweep `d` world units, from the same forward function. */
function traverseMs(d, maxR, floor) {
  const from = arrivalMs(maxR - 1e-9, maxR, floor);
  const to = arrivalMs(maxR - d, maxR, floor);
  return to - from;
}

const stateAt = (n, playMs, dist) => {
  const floor = R.minSafeRadiusFor(n);
  const timeRemaining = R.MATCH_DURATION_MS - playMs;
  const safeRadius = R.suddenDeathActive(timeRemaining)
    ? R.SUDDEN_DEATH_RADIUS
    : R.fogRadiusAt(playMs, MAXR, floor);
  const mk = (i) => ({
    id: i, x: 1400 + (i === 0 ? dist : 0), y: 1000, hp: 100, alive: true,
    role: i === 0 ? 'player' : 'enemy', size: 42,
  });
  const fighters = Array.from({ length: n }, (_, i) => mk(i));
  return {
    phase: 'playing', timeRemaining, safeRadius, fighters,
    player: fighters[0], enemy: fighters[1],
    arena: { maxSafeRadius: MAXR, center: { x: 1400, y: 1000 } },
  };
};

const TOL_MS = 0.5;
const SEATS = [2, 4, 5, 6];

// ── ARM 1 + 2: the countdown equals the schedule, in the HOLD and in the CLOSE ─

const bands = {
  hold: { lo: 0, hi: R.FOG_HOLD_MS - 1, rows: [] },
  close: { lo: R.FOG_HOLD_MS + 1, hi: R.FOG_CLOSE_MS - 1, rows: [] },
};

for (const n of SEATS) {
  const floor = R.minSafeRadiusFor(n);
  for (const [tag, b] of Object.entries(bands)) {
    for (let k = 0; k <= 12; k++) {
      const playMs = b.lo + ((b.hi - b.lo) * k) / 12;
      const safeR = R.fogRadiusAt(playMs, MAXR, floor);
      for (const frac of [0.15, 0.35, 0.55, 0.75, 0.95]) {
        const dist = floor + (safeR - floor) * frac;
        const info = HUD.zoneInfo(stateAt(n, playMs, dist));
        if (info.msUntilEdge === null) continue; // outside / holds — a different arm's job
        const want = arrivalMs(dist, MAXR, floor) - playMs;
        b.rows.push({ n, playMs, dist, got: info.msUntilEdge, want, tag });
      }
    }
  }
}

let armsOk = true;
for (const [tag, b] of Object.entries(bands)) {
  // NON-EMPTY FIRST. During the hold a naive sampler finds nothing to count down to.
  if (!check(`band \`${tag}\` sampled at least one live countdown row`, b.rows.length > 0, `${b.rows.length} rows`)) {
    armsOk = false;
    continue;
  }
  const bad = b.rows.filter((r) => Math.abs(r.got - r.want) > TOL_MS);
  const worst = bad.slice().sort((x, y) => Math.abs(y.got - y.want) - Math.abs(x.got - x.want))[0];
  armsOk = check(
    `band \`${tag}\`: "REACHES YOU" is the schedule's own arrival`,
    bad.length === 0,
    bad.length === 0
      ? `${b.rows.length}/${b.rows.length} rows within ${TOL_MS} ms`
      : `${bad.length}/${b.rows.length} rows wrong; worst N=${worst.n} play ${(worst.playMs / 1000).toFixed(1)}s dist ${worst.dist.toFixed(0)} — HUD ${(worst.got / 1000).toFixed(2)}s vs schedule ${(worst.want / 1000).toFixed(2)}s (${((worst.got / worst.want - 1) * 100).toFixed(1)}% long)`,
    true,
  ) && armsOk;
}

// ── ARM 3: a countdown must COUNT DOWN, and during the hold the pre-fix one froze ─

{
  const n = 6;
  const floor = R.minSafeRadiusFor(n);
  const dist = floor + (R.fogRadiusAt(0, MAXR, floor) - floor) * 0.5;
  const ticks = [];
  for (let playMs = 0; playMs < R.FOG_HOLD_MS; playMs += 2500) {
    const info = HUD.zoneInfo(stateAt(n, playMs, dist));
    if (info.msUntilEdge !== null) ticks.push({ playMs, v: info.msUntilEdge });
  }
  if (check('hold-tick sample is NON-EMPTY before any every() runs over it', ticks.length > 1, `${ticks.length} ticks`)) {
    const drops = ticks.slice(1).map((t, i) => ticks[i].v - t.v);
    const wantDrop = 2500;
    const ok = drops.every((d) => Math.abs(d - wantDrop) <= TOL_MS);
    armsOk = check(
      'during the 25 s HOLD the countdown actually counts down (1 ms per ms of play)',
      ok,
      ok ? `${drops.length} intervals, each -${wantDrop} ms`
        : `frozen or wrong: drops ${drops.map((d) => d.toFixed(1)).join(', ')} ms per 2500 ms of play`,
      true,
    ) && armsOk;
  } else armsOk = false;
}

// ── ARM 4: the reproduction Uri would have walked into ───────────────────────

{
  const n = 6;
  const floor = R.minSafeRadiusFor(n);
  const playMs = 60_000;
  const dist = 900;
  const info = HUD.zoneInfo(stateAt(n, playMs, dist));
  const want = arrivalMs(dist, MAXR, floor) - playMs;
  const ok = info.msUntilEdge !== null && Math.abs(info.msUntilEdge - want) <= TOL_MS;
  armsOk = check(
    'dist 900, N=6, play 60 s: the pill states the real arrival',
    ok,
    `HUD "${info.msUntilEdge === null ? 'FINAL RING' : `REACHES YOU ${HUD.formatTime(info.msUntilEdge)}`}"`
    + ` (${info.msUntilEdge === null ? 'null' : (info.msUntilEdge / 1000).toFixed(2)}s)`
    + `  vs schedule "REACHES YOU ${HUD.formatTime(want)}" (${(want / 1000).toFixed(2)}s)`,
    true,
  ) && armsOk;
}

// ── ARM 5: the alarm threshold is the real traverse of the guaranteed-visible radius ─

{
  const got = [];
  for (const n of SEATS) {
    const floor = R.minSafeRadiusFor(n);
    const want = Math.min(12_000, traverseMs(R.FAIR_PLAY.radiusUnits, MAXR, floor));
    got.push({ n, floor, got: HUD.imminentMs(MAXR, floor), want });
  }
  /**
   * 🚨 THE SLICE THAT MAKES THIS ARM NON-VACUOUS. At N>=5 the true value clamps to the
   * 12 s cap and so does the pre-fix one, so those rows agree with a BROKEN implementation.
   * The arm only means something because the N<=4 rows exist, where the truth (11 975 ms)
   * sits BELOW the cap. Assert they are there before scoring.
   */
  const uncapped = got.filter((g) => g.want < 12_000 - 1e-6);
  if (check('alarm arm has rows where the 12 s cap does NOT bind (else it self-pairs)',
    uncapped.length > 0, `${uncapped.length} of ${got.length} seat counts uncapped: ${uncapped.map((g) => `N=${g.n} ${g.want.toFixed(0)}ms`).join(', ')}`)) {
    const bad = got.filter((g) => Math.abs(g.got - g.want) > TOL_MS);
    armsOk = check(
      'imminentMs is the real traverse of FAIR_PLAY.radiusUnits, capped at 12 s',
      bad.length === 0,
      bad.length === 0
        ? got.map((g) => `N=${g.n} ${g.got.toFixed(0)}ms`).join('  ')
        : bad.map((g) => `N=${g.n}: HUD ${g.got.toFixed(0)}ms vs ${g.want.toFixed(0)}ms`).join('; '),
      true,
    ) && armsOk;
  } else armsOk = false;
}

// ── Verdict ──────────────────────────────────────────────────────────────────

const passed = rows.filter((r) => r.pass).length;
console.log(`\nht_zoneclock: ${passed}/${rows.length} checks passed (arm=${KNOWN_BAD ? `known-bad@${KNOWN_BAD_REF}` : 'live'})`);

cleanup();

if (KNOWN_BAD) {
  // The negative control: the pre-fix arithmetic must be REJECTED. An arm that stays
  // green on it is testing nothing, and naming it is the whole point of this branch.
  const survivors = rows.filter((r) => r.pass && r.scoring);
  if (survivors.length) {
    console.log(`\n  🚨 ${survivors.length} scoring arm(s) PASSED on the pre-fix implementation — tautological:`);
    for (const s of survivors) console.log(`     - ${s.name}`);
    process.exit(1);
  }
  console.log('  ✔ every scoring arm rejected the pre-fix hand inversion.\n');
  process.exit(0);
}

process.exit(armsOk ? 0 : 1);
