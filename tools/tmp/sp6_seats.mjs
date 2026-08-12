#!/usr/bin/env node
/**
 * SP6_SEATS — THE GATE ON THE 3..6 SEAT ENTRY POINT (`DECISIONS §66`).
 *
 *   node tools/tmp/sp6_seats.mjs
 *   node tools/tmp/sp6_seats.mjs --root <a worktree>     # measure another tree
 *   node tools/tmp/sp6_seats.mjs --matches 12            # bigger corpus (default 6 per seat per arm)
 *   node tools/tmp/sp6_seats.mjs --selftest              # ~3 min: SEVEN mutations of the REAL
 *                                                        #  tree, each required to turn the gate
 *                                                        #  red ON THE ROW IT AIMS AT, plus an
 *                                                        #  unmutated control that must go green
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  WHAT IT GUARDS, AND WHAT IT DELIBERATELY DOES NOT
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Six-player was the largest body of finished, measured, UNREACHABLE work in the repo: the
 * 3-6 seat payout curve, placement XP, the placement result card, `minSafeRadiusFor(N)`
 * (140 / 187.42 / **237.00**), and the seat-fairness pass that took spawn advantage from
 * **2.680 to 0.342 places of six**. Every one of those described a mode a player could not
 * reach — `?fighters=` is documented QA-ONLY and `matchScreen.ts` built exactly two seats.
 *
 * This gate guards the WIRING that makes it reachable behind a default-off flag. It does
 * **not** re-guard:
 *   * the ranking rule — `roster.ts:resolvePlaces`, guarded by `mp_join.mjs`;
 *   * the payout curve — `pc_lab.mjs`, and `nw_profile.mjs` against a frozen oracle;
 *   * the spawn TABLE — `sp_gate.mjs` (symmetry, the dump vs `kitchen.ts`) and
 *     `kx_seatfair.mjs` (the in-degree of the t=0 targeting digraph);
 *   * the N-seat presentation — `np_nfighter.mjs` (browser).
 * Restating any of those here would be a test of a copy.
 *
 * ⚠️ **WHAT THIS ONE ADDS, AND WHY IT IS A DIFFERENT QUANTITY.** `mp_join` plays N-seat
 * matches by passing `spawn: ARENA.spawns[i]` **explicitly**, so it cannot see whether the
 * PRODUCT's path invents its own placement. The product path passes **no spawn at all** and
 * must resolve through `sim.ts:defaultSpawn` — that is the whole difference between using
 * the single source of truth and quietly becoming a second one, and §E is the row that can
 * tell them apart.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  🚨 THE TAUTOLOGY THIS FILE HAD TO BE BUILT AROUND
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * A Node gate cannot import `match.ts` or `matchScreen.ts`: `src/ui/**` and the render
 * layer use extension-less specifiers and drag in Three.js plus a module-scope
 * `document.createElement('canvas')`. Measured, not assumed — an esbuild bridge over
 * `matchScreen.ts` bundles 1.2 MB and dies with `ReferenceError: document is not defined`.
 *
 * So §E and §F reach the sim by REPLAYING the mapping `match.ts:newMatch` performs. **A
 * replay is a copy, and a test of a copy is a tautology** — the exact failure `mp_join`'s
 * header records about a census that counted a function declaration as a call site. §D is
 * what closes it: a source census that asserts the SHIPPED `newMatch` performs the mapping
 * §E replays — no `spawn`, `level` from `this.levels` — and the census is validated on
 * fixtures that must flag before it is allowed to look at `src/`.
 *
 * ⚠️ **RESOLUTION FLOOR: NONE ON ANY ASSERTED ROW.** Every assertion is exact — integer
 * equality, set equality, a permutation test, or a source match. The only reported-not-
 * asserted number is §H's sudden-death share, which is a proportion over a stated corpus.
 */
import { readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const HERE = resolve(new URL('../..', import.meta.url).pathname);
/** Guard the CLI path but keep the exports: `docs/AGENT-BRIEF.md` §3 — importing a tool
 *  that lacked this printed a live sweep report and, elsewhere, launched Chromium. */
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const argOf = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const ROOT = resolve(argOf('root', HERE));
const SELFTEST = process.argv.includes('--selftest');

let pass = 0;
let fail = 0;
const failures = [];
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}${detail ? `  — ${detail}` : ''}`); }
  else { fail++; failures.push(label); console.log(`  ✗ ${label}${detail ? `  — ${detail}` : ''}`); }
}
function section(t) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 74 - t.length))}`); }

const eqJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ═════════════════════════════════════════════════════════════════════════════
//  SOURCE CENSUS — the primitives §D runs, and every one is validated on a
//  fixture before it is pointed at `src/`.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * The body of the first block whose opening line matches `header`, braces balanced.
 *
 * ⚠️ Returns `null` rather than `''` when the header is absent. An empty string would make
 * every "the body does NOT contain X" row below pass **vacuously** — `''.includes(x)` is
 * false for every x — which is `CLAUDE.md` rule 6's `[].every()` trap wearing a string.
 */
export function blockBody(src, header) {
  const at = src.indexOf(header);
  if (at < 0) return null;
  const open = src.indexOf('{', at + header.length - 1);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open + 1, i); }
  }
  return null;
}

/**
 * Source with `//` and block comments removed.
 *
 * 🚨 **WITHOUT THIS EVERY ROW IN §D IS A LIE, AND IT IS THE LIE THIS PROJECT KEEPS
 * TELLING.** The shipped `newMatch` carries a long comment that contains the word `spawn`
 * five times explaining why it passes none; a census that reads raw source would flag the
 * EXPLANATION as the defect, and — worse — a `newMatch` that really did pass a spawn would
 * be indistinguishable from one that only talks about them. Strings are kept: a spawn
 * cannot hide in one and dropping them would need a second parser.
 */
export function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/** The object literal enclosing `idx`, found by balancing back to its `{` and forward to
 *  its `}`. Used to read a `navigate({ name: 'match', … })` argument whole. */
export function objectLiteralAround(src, idx) {
  let open = -1;
  let depth = 0;
  for (let i = idx; i >= 0; i--) {
    if (src[i] === '}') depth++;
    else if (src[i] === '{') { if (depth === 0) { open = i; break; } depth--; }
  }
  if (open < 0) return null;
  depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  return null;
}

/**
 * Every `{ name: 'match', … }` **VALUE** literal in a source string.
 *
 * 🚨 **THE TYPE DECLARATION IS NOT A NAVIGATION, AND THE FIRST VERSION OF THIS FUNCTION
 * COUNTED IT AS ONE.** `types.ts` declares `| { name: 'match'; player: CharacterId; …;
 * seats?: number }` — the route's own definition, which necessarily mentions `seats` — and
 * the §D row below promptly went red on the file that DEFINES the field. That is `mp_join`'s
 * census counting a function DECLARATION as a call site, one census later, and it was caught
 * by running the gate rather than by reading it.
 *
 * The discriminator is the separator, because TypeScript's own grammar supplies it: members
 * of a type literal are separated by `;`, properties of an object literal by `,` (or by the
 * closing brace). Both directions are asserted in §D before this is pointed at `src/`.
 */
export function matchRouteLiterals(src) {
  const clean = stripComments(src);
  const out = [];
  const re = /name:\s*'match'\s*([;,}])?/g;
  let m;
  while ((m = re.exec(clean)) !== null) {
    if (m[1] === ';') continue; // a type member list, not a navigation
    const lit = objectLiteralAround(clean, m.index);
    if (lit) out.push(lit);
  }
  return out;
}

export function walkTs(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkTs(p, acc);
    else if (name.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

// ═════════════════════════════════════════════════════════════════════════════
//  THE KNOWN-BADS — named, run, and each asserted to turn its own row RED.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Mutants of the two shipped rules. Each is the SHAPE of a real defect this area has
 * already produced, not an arbitrary break:
 *
 *  * `nofloor`  — `seatsFromParams` honouring any finite number. The flag stops being
 *                 default-off the moment an out-of-range value is honoured.
 *  * `nodupe`   — `brawlRoster` without the "already seated" skip. Seats a character twice,
 *                 which reads as a legal roster and is not one.
 *  * `hopeful`  — `brawlRoster` built with `.map(...).filter(Boolean)`. **This is the exact
 *                 patch that silently DROPPED FIGHTERS in this area** (a 3-entry order
 *                 listed 3 of 5 losers): it turns "I built the wrong list" into "I built a
 *                 shorter list", which is a bug that looks like data.
 *  * `slotorder` — ranking the losers by slot instead of by the death event stream. Kept
 *                 here because §G's permutation row would pass under it and only the
 *                 disagreement row can see it.
 */
export const MUTANTS = {
  nofloor: (params) => {
    const raw = params.get('seats');
    if (raw === null) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  },
  nodupe: (CHARACTER_IDS) => (player, enemy, seats) => {
    const out = [player];
    if (seats > 1) out.push(enemy);
    const start = CHARACTER_IDS.indexOf(player);
    for (let step = 1; out.length < seats; step++) out.push(CHARACTER_IDS[(start + step) % CHARACTER_IDS.length]);
    return out;
  },
  hopeful: (CHARACTER_IDS) => (player, enemy, seats) => {
    const start = CHARACTER_IDS.indexOf(player);
    const wanted = [player, enemy];
    for (let step = 1; wanted.length < seats; step++) wanted.push(CHARACTER_IDS[(start + step) % CHARACTER_IDS.length]);
    // The defect: an id that is already seated becomes `undefined`, and `filter(Boolean)`
    // makes the list SHORTER rather than wrong.
    const seen = new Set();
    return wanted.map((id) => (seen.has(id) ? undefined : (seen.add(id), id))).filter(Boolean);
  },
};

// ═════════════════════════════════════════════════════════════════════════════
//  --selftest — PROVED RED ON A REAL TREE, NOT ON A FIXTURE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 🚨 **`--selftest` VALIDATES A TOOL'S LOGIC AND NEVER VALIDATES WHERE IT IS POINTED**
 * (`CLAUDE.md` rule 6 — `valuescan` read a perfect selftest with 14 of 18 stations in the
 * wrong quadrant). So this one does not test the logic in isolation at all: it **copies the
 * real `src/` tree, breaks one shipped line, and requires the WHOLE gate to exit non-zero**
 * against that tree through `--root`. `al_guard` was proved the same way — by a real tree
 * revert — and the difference matters, because a mutant defined inside the gate can only
 * ever falsify the gate's idea of the code.
 *
 * ⚠️ **THE CONTROL RUNS FIRST AND IS NOT OPTIONAL.** An unmutated copy must go GREEN. Without
 * it every "went red" below could be the copy being broken — a missing symlink, a stale
 * `arena.gameplay.json`, a node_modules that is not there — and the battery would certify
 * itself while measuring nothing. That is the failure this project has recorded three times
 * in one session.
 */
const LEVEL_LINE = '        level: slot === LOCAL_SLOT ? this.levels.player : this.levels.enemy,';
const ROSTER_GUARD = 'if (out.length !== seats || new Set(out).size !== seats) {';

const MUTATIONS = [
  {
    // ⚠️ TWO EDITS, DELIBERATELY. Removing only the skip makes `brawlRoster`'s own
    // permutation guard THROW, so the gate would go red on a crash and §C's distinct row
    // would never run — a known-bad planted where the bug cannot express itself, which is
    // the trap `CLAUDE.md` rule 6 records firing three times in one session. Removing the
    // guard as well lets the duplicate reach the assertion that is supposed to catch it.
    name: 'nodupe',
    edits: [
      ['src/ui/screens/brawl.ts', 'if (!out.includes(id)) out.push(id);', 'out.push(id);'],
      ['src/ui/screens/brawl.ts', ROSTER_GUARD, 'if (false) {'],
    ],
    expect: 'every roster is DISTINCT',
  },
  {
    name: 'nofloor',
    edits: [['src/ui/screens/brawl.ts',
      'if (n <= MIN_FIGHTERS || n > MAX_FIGHTERS) return undefined;',
      'if (n < 0) return undefined;']],
    expect: 'every query maps to the declared seat count',
  },
  {
    name: 'invented-spawn',
    edits: [['src/game/match.ts', LEVEL_LINE,
      `${LEVEL_LINE}\n        spawn: { x: this.arena.center.x, y: this.arena.center.y },`]],
    expect: 'the roster branch passes NO `spawn`',
  },
  {
    name: 'no-level',
    edits: [['src/game/match.ts', LEVEL_LINE, '']],
    expect: 'the roster branch sets `level` from `this.levels`',
  },
  {
    name: 'no-roster-branch',
    edits: [['src/game/match.ts', 'if (this.roster) {', 'if (false) {']],
    expect: 'has a ROSTER branch',
  },
  {
    name: 'required-seats',
    edits: [['src/ui/screens/types.ts', 'seats?: number };', 'seats: number };']],
    expect: '`Route.match.seats` is OPTIONAL',
  },
  {
    // 🚨 THE ROW THIS WHOLE BATTERY EXISTS FOR. An affordance wired into a screen before Uri
    // has answered §66 Q1 is a design decision shipped under a wiring commit.
    name: 'rogue-affordance',
    edits: [['src/ui/screens/characterSelect.ts',
      "ctx.navigate({ name: 'match', player: viewed, enemy: pickOpponent(viewed) });",
      "ctx.navigate({ name: 'match', player: viewed, enemy: pickOpponent(viewed), seats: 6 });"]],
    expect: 'no SCREEN sets `seats`',
  },
];

function runSelftest() {
  console.log('\nsp6_seats --selftest — every mutation applied to a COPY OF THE REAL TREE\n');
  const dir = mkdtempSync(join(tmpdir(), 'sp6-mut-'));
  const tree = join(dir, 'tree');
  execFileSync('cp', ['-R', join(ROOT, 'src'), join(dir, 'src')]);
  execFileSync('mkdir', ['-p', tree]);
  execFileSync('ln', ['-s', join(ROOT, 'node_modules'), join(tree, 'node_modules')]);
  execFileSync('ln', ['-s', join(ROOT, 'tools'), join(tree, 'tools')]);
  const child = (root) => {
    try {
      const out = execFileSync(process.execPath, [
        join(ROOT, 'tools/tmp/sp6_seats.mjs'), '--root', root, '--matches', '2',
      ], { stdio: 'pipe', encoding: 'utf8' });
      return { code: 0, out };
    } catch (e) { return { code: e.status ?? 1, out: String(e.stdout ?? '') + String(e.stderr ?? '') }; }
  };
  /** Returns the edits that did NOT apply. A STALE mutation — one whose `from` no longer
   *  exists — must be reported as a fault, never silently skipped: a battery of no-op edits
   *  is a battery that certifies whatever it is pointed at. */
  const plant = (mutation) => {
    execFileSync('rm', ['-rf', join(tree, 'src')]);
    execFileSync('cp', ['-R', join(dir, 'src'), join(tree, 'src')]);
    if (!mutation) return [];
    const missed = [];
    for (const [file, from, to] of mutation.edits) {
      const p = join(tree, file);
      const src = readFileSync(p, 'utf8');
      if (!src.includes(from)) { missed.push(`${file}: \`${from.trim().slice(0, 56)}\``); continue; }
      writeFileSync(p, src.replace(from, to));
    }
    return missed;
  };

  plant(null);
  const control = child(tree);
  ok('CONTROL: the UNMUTATED copy of the tree goes GREEN — the copy itself is sound',
    control.code === 0, `exit ${control.code}`);

  ok('the mutation set is non-empty before anything asserts over it', MUTATIONS.length > 0,
    `${MUTATIONS.length} mutations`);
  for (const m of MUTATIONS) {
    const missed = plant(m);
    if (missed.length > 0) {
      ok(`KNOWN-BAD \`${m.name}\`: every line it mutates still EXISTS in the tree`, false,
        `${missed.join(' · ')} — the MUTATION is stale, which is not the same as the code being right`);
      continue;
    }
    const { code, out } = child(tree);
    // ⚠️ **"IT WENT RED" IS NOT "IT WENT RED FOR THE STATED REASON."** A mutation that
    // crashed the gate, or tripped an unrelated row, would satisfy `code !== 0` and certify
    // an assertion that never ran — the shape of every vacuous guard in `CLAUDE.md` rule 6.
    // So the child's own `failing:` line has to name the row this mutation is aimed at.
    const failing = /failing: (.*)$/m.exec(out)?.[1] ?? '';
    ok(`KNOWN-BAD \`${m.name}\` turns the gate RED — and the row that fails is the one it aims at`,
      code !== 0 && failing.includes(m.expect),
      `exit ${code} · failing: ${failing.slice(0, 120) || '(no row failed — the gate CRASHED)'}`);
  }
  rmSync(dir, { recursive: true, force: true });
  return finish();
}

// ═════════════════════════════════════════════════════════════════════════════

async function main() {
  if (SELFTEST) return runSelftest();
  console.log(`\nsp6_seats · root ${relative(HERE, ROOT) || '.'}${SELFTEST ? ' · SELFTEST' : ''}\n`);

  // ───────────────────────────────────────────────────────────────────────────
  section('A. REACHABILITY — the policy module a NODE gate can actually load');

  let B = null;
  try {
    B = await import(pathToFileURL(join(ROOT, 'src/ui/screens/brawl.ts')).href);
  } catch (e) {
    console.log(`    brawl.ts did not import: ${String(e).split('\n')[0]}`);
  }
  const haveRule = !!(B && typeof B.brawlRoster === 'function' && typeof B.seatsFromParams === 'function');
  ok('`screens/brawl.ts` exports `brawlRoster` + `seatsFromParams` and a NODE gate can import it',
    haveRule, haveRule ? '' : 'absent — every row below is unreachable, which is the RED state');
  if (!haveRule) return finish();

  const { brawlRoster, seatsFromParams } = B;
  const { CHARACTER_IDS, maxHpFor, PLAYER_MAX_HP, clampLevel, MATCH_DURATION_MS, SUDDEN_DEATH_MS } =
    await import(pathToFileURL(join(ROOT, 'src/game/rules.ts')).href);
  const { MIN_FIGHTERS, MAX_FIGHTERS } = await import(pathToFileURL(join(ROOT, 'src/game/state.ts')).href);
  const { createMatch, stepMatch } = await import(pathToFileURL(join(ROOT, 'src/game/sim.ts')).href);
  const { resolvePlaces } = await import(pathToFileURL(join(ROOT, 'src/game/roster.ts')).href);
  const { enemyLevelFor } = await import(pathToFileURL(join(ROOT, 'src/game/economy/levels.ts')).href);
  const ECON = await import(pathToFileURL(join(ROOT, 'src/game/economy/index.ts')).href);

  // ANTI-VACUITY. Every §C row below iterates a cross product built from these; if the cast
  // were smaller than the seat cap the rule could not fill a match and the whole section
  // would pass over an empty or truncated set.
  ok('the cast is large enough for the rule to fill a full field',
    CHARACTER_IDS.length >= MAX_FIGHTERS,
    `${CHARACTER_IDS.length} characters, ${MAX_FIGHTERS} seats`);

  // ───────────────────────────────────────────────────────────────────────────
  section('B. THE FLAG IS DEFAULT-OFF — `seatsFromParams`');

  const P = (qs) => new URLSearchParams(qs);
  /** [query, expected] — `undefined` means "the shipped duel". */
  const FLAG_CASES = [
    ['', undefined], ['player=egg', undefined],
    ['seats=', undefined], ['seats=abc', undefined], ['seats=NaN', undefined],
    ['seats=0', undefined], ['seats=1', undefined], ['seats=-1', undefined],
    ['seats=2', undefined],                       // refused: the duel has ONE path
    ['seats=3', 3], ['seats=4', 4], ['seats=5', 5], ['seats=6', 6],
    ['seats=7', undefined], ['seats=60', undefined], ['seats=3.5', undefined],
    ['seats=1e9', undefined],
  ];
  ok('the flag table is non-empty before anything asserts over it', FLAG_CASES.length > 0,
    `${FLAG_CASES.length} cases`);
  const flagWrong = FLAG_CASES.filter(([qs, want]) => seatsFromParams(P(qs)) !== want);
  ok('every query maps to the declared seat count, and everything else to the DUEL',
    flagWrong.length === 0,
    flagWrong.map(([qs, want]) => `${qs || '<none>'} → ${seatsFromParams(P(qs))} (want ${want})`).join(' · '));

  const offCases = FLAG_CASES.filter(([, want]) => want === undefined);
  ok('the OFF cases are a real majority of the table, so the row above is not one arm',
    offCases.length >= 3, `${offCases.length} off / ${FLAG_CASES.length}`);

  // KNOWN-BAD. A parser with no range floor honours `?seats=60`, and `createMatchFromList`
  // would then throw a RangeError at the player instead of the flag simply being off.
  const mutantFlagWrong = FLAG_CASES.filter(([qs, want]) => MUTANTS.nofloor(P(qs)) !== want);
  ok('KNOWN-BAD `nofloor`: a parser with no range check FAILS the row above',
    mutantFlagWrong.length > 0,
    `${mutantFlagWrong.length} cases disagree, e.g. ${mutantFlagWrong[0]?.[0]}`);

  ok('the accepted range is exactly MIN_FIGHTERS+1..MAX_FIGHTERS, derived not retyped',
    seatsFromParams(P(`seats=${MIN_FIGHTERS}`)) === undefined
    && seatsFromParams(P(`seats=${MIN_FIGHTERS + 1}`)) === MIN_FIGHTERS + 1
    && seatsFromParams(P(`seats=${MAX_FIGHTERS}`)) === MAX_FIGHTERS
    && seatsFromParams(P(`seats=${MAX_FIGHTERS + 1}`)) === undefined,
    `${MIN_FIGHTERS + 1}..${MAX_FIGHTERS}`);

  // ───────────────────────────────────────────────────────────────────────────
  section('C. THE FIELD — `brawlRoster` over the full cross product');

  const PAIRS = [];
  for (const p of CHARACTER_IDS) for (const e of CHARACTER_IDS) if (e !== p) PAIRS.push([p, e]);
  const SEATS = [];
  for (let n = MIN_FIGHTERS; n <= MAX_FIGHTERS; n++) SEATS.push(n);
  const ROSTERS = [];
  for (const [p, e] of PAIRS) for (const n of SEATS) ROSTERS.push({ p, e, n, r: brawlRoster(p, e, n) });
  ok('the roster corpus is non-empty before anything asserts over it',
    ROSTERS.length === PAIRS.length * SEATS.length && ROSTERS.length > 0,
    `${PAIRS.length} matchups × ${SEATS.length} seat counts = ${ROSTERS.length} rosters`);

  const IDSET = new Set(CHARACTER_IDS);
  const badLen = ROSTERS.filter((x) => x.r.length !== x.n);
  ok('every roster has EXACTLY the seats asked for — nothing dropped, nothing added',
    badLen.length === 0, `${badLen.length} wrong length`);

  const badDistinct = ROSTERS.filter((x) => new Set(x.r).size !== x.n);
  ok('every roster is DISTINCT — no character seated twice', badDistinct.length === 0,
    badDistinct.slice(0, 2).map((x) => `${x.p}/${x.e}@${x.n}: ${x.r.join(',')}`).join(' · '));

  const badMember = ROSTERS.filter((x) => !x.r.every((id) => IDSET.has(id)));
  ok('every seat holds a real character id (no `undefined`, no hole)', badMember.length === 0);

  const badHead = ROSTERS.filter((x) => x.r[0] !== x.p || x.r[1] !== x.e);
  ok('seat 0 is the PLAYER and seat 1 is the route\'s own opponent, in every roster',
    badHead.length === 0);

  const duels = ROSTERS.filter((x) => x.n === MIN_FIGHTERS);
  ok('the duel arm is non-empty', duels.length > 0, `${duels.length}`);
  ok(`at ${MIN_FIGHTERS} seats the rule returns EXACTLY the pair the shipped duel plays`,
    duels.every((x) => eqJson(x.r, [x.p, x.e])), `${duels.length} duels`);

  // Determinism, measured rather than asserted from the absence of `Math.random`: the same
  // arguments 3× interleaved with other arguments, which is what a hidden cursor or a
  // module-scope RNG would fail.
  const nondet = ROSTERS.filter((x) => {
    const a = brawlRoster(x.p, x.e, x.n);
    brawlRoster(x.e, x.p, MAX_FIGHTERS);
    const b = brawlRoster(x.p, x.e, x.n);
    return !eqJson(a, x.r) || !eqJson(b, x.r);
  });
  ok('the rule is DETERMINISTIC — identical output on repeat calls, interleaved',
    nondet.length === 0, `${ROSTERS.length * 2} repeat calls`);

  // KNOWN-BADs. Each must break a row above, and each is checked for being NON-VACUOUS
  // first: a mutant that never produces a bad roster certifies nothing.
  const mNodupe = MUTANTS.nodupe(CHARACTER_IDS);
  const dupeHits = ROSTERS.filter((x) => new Set(mNodupe(x.p, x.e, x.n)).size !== x.n);
  ok('KNOWN-BAD `nodupe`: dropping the "already seated" skip DOUBLE-SEATS a character',
    dupeHits.length > 0,
    `${dupeHits.length}/${ROSTERS.length} rosters, e.g. ${dupeHits[0] && mNodupe(dupeHits[0].p, dupeHits[0].e, dupeHits[0].n).join(',')}`);

  const mHopeful = MUTANTS.hopeful(CHARACTER_IDS);
  const hopefulHits = ROSTERS.filter((x) => mHopeful(x.p, x.e, x.n).length !== x.n);
  ok('KNOWN-BAD `hopeful`: `.filter(Boolean)` SILENTLY SHORTENS the field',
    hopefulHits.length > 0,
    `${hopefulHits.length}/${ROSTERS.length} rosters lose a seat`);

  let threw = false;
  try { brawlRoster(CHARACTER_IDS[0], CHARACTER_IDS[1], MAX_FIGHTERS + 1); } catch { threw = true; }
  ok('an out-of-range seat count THROWS rather than returning a short field', threw);

  // ───────────────────────────────────────────────────────────────────────────
  section('D. THE WIRING — a census of the SHIPPED files, validated on fixtures FIRST');

  // The census primitives, proven on fixtures before they are pointed at `src/`. This is
  // `mp_join`'s rule after its own census counted a DECLARATION as a call site and printed
  // `ok` beside an evidence line describing the failure.
  const FIX_BODY = 'private newMatch(): MatchState {\n  if (a) { return x; }\n  return y;\n}';
  ok('CENSUS SELFTEST: `blockBody` extracts a balanced body',
    (blockBody(FIX_BODY, 'private newMatch(): MatchState') ?? '').includes('return y;'));
  ok('CENSUS SELFTEST: `blockBody` returns null (never "") for an absent header — no vacuous pass',
    blockBody(FIX_BODY, 'private notThere()') === null);
  ok('CENSUS SELFTEST: `stripComments` removes a comment that MENTIONS the token',
    !stripComments('// spawn spawn\nconst a = 1;').includes('spawn')
    && stripComments('const spawn = 1;').includes('spawn'));
  ok('CENSUS SELFTEST: `matchRouteLiterals` finds a multi-line literal and reads it whole',
    (() => {
      const lits = matchRouteLiterals("nav({\n  name: 'match',\n  player: p,\n  seats: 6,\n});");
      return lits.length === 1 && lits[0].includes('seats: 6');
    })());
  ok('CENSUS SELFTEST: `matchRouteLiterals` ignores a COMMENTED route',
    matchRouteLiterals("// nav({ name: 'match', seats: 6 })\n").length === 0);
  // 🚨 BOTH DIRECTIONS, because the one-directional version of this row went red on the file
  // that DEFINES the field. A census that cannot tell a declaration from a use is the defect
  // `mp_join`'s header records, and it recurred here.
  ok('CENSUS SELFTEST: a TYPE member list is not a navigation…',
    matchRouteLiterals("type R = | { name: 'match'; player: C; seats?: number };").length === 0);
  ok('CENSUS SELFTEST: …while a VALUE literal with the same head still is',
    matchRouteLiterals("nav({ name: 'match', player: p, seats: 6 });").length === 1);

  const matchSrc = readFileSync(join(ROOT, 'src/game/match.ts'), 'utf8');
  const newMatchBody = blockBody(matchSrc, 'private newMatch(): MatchState');
  ok('`match.ts:newMatch` is where a MatchState is built, and the census found it',
    newMatchBody !== null);
  const nmClean = newMatchBody === null ? null : stripComments(newMatchBody);
  const rosterBranch = nmClean === null ? null : blockBody(nmClean, 'if (this.roster)');
  ok('`newMatch` has a ROSTER branch — the product\'s N-seat path exists at all',
    rosterBranch !== null && rosterBranch.length > 0);

  // 🚨 THE ROW THAT CLOSES §E's TAUTOLOGY. §E replays this mapping through the sim; this
  // asserts the SHIPPED mapping is the one §E replays.
  ok('the roster branch passes NO `spawn` — placement stays `src/arena/**`\'s single truth',
    rosterBranch !== null && !/\bspawn\b/.test(rosterBranch),
    rosterBranch === null ? 'branch not found' : '');
  ok('the roster branch sets `level` from `this.levels` — five bots through `enemyLevelFor`',
    rosterBranch !== null && /\blevel\b/.test(rosterBranch) && /this\.levels/.test(rosterBranch));

  // KNOWN-BADs for the two rows above, run on fixtures rather than described.
  const badBranchSpawn = "{ return createMatch(a, r.map((c, i) => ({ characterId: c, spawn: RING[i], level: 1 }))); }";
  const badBranchLevel = "{ return createMatch(a, r.map((c) => ({ characterId: c }))); }";
  ok('KNOWN-BAD: a roster branch that invents spawns is CAUGHT', /\bspawn\b/.test(badBranchSpawn));
  ok('KNOWN-BAD: a roster branch with no level is CAUGHT',
    !(/\blevel\b/.test(badBranchLevel) && /this\.levels/.test(badBranchLevel)));

  // The flag is off wherever the PRODUCT navigates. `main.ts` is the flag's own entry point
  // and is the one file allowed to set it.
  //
  // ⚠️ **WHEN URI ANSWERS §66 THIS ROW MUST CHANGE, AND THAT IS THE POINT.** The affordance
  // will set `seats` from a real screen; at that moment change the allowed set below and
  // keep this wording above it with the reason, per `CLAUDE.md`'s rule on reversed
  // assertions. Until then, a `seats` appearing in a screen is a design decision shipped
  // under a wiring commit and this goes red.
  const FLAG_OWNERS = new Set(['src/main.ts']);
  const navFiles = walkTs(join(ROOT, 'src'))
    .map((p) => ({ p, rel: relative(ROOT, p), lits: matchRouteLiterals(readFileSync(p, 'utf8')) }))
    .filter((f) => f.lits.length > 0);
  ok('the navigation census found at least one `{ name: \'match\' }` literal to judge',
    navFiles.length > 0, navFiles.map((f) => `${f.rel}×${f.lits.length}`).join(' · '));
  const rogue = navFiles.filter((f) => !FLAG_OWNERS.has(f.rel) && f.lits.some((l) => /\bseats\b/.test(l)));
  ok('no SCREEN sets `seats` — the affordance is still Uri\'s to place (§66 Q1)',
    rogue.length === 0, rogue.map((f) => f.rel).join(' · '));
  const owner = navFiles.filter((f) => FLAG_OWNERS.has(f.rel) && f.lits.some((l) => /\bseats\b/.test(l)));
  ok('...and the flag\'s OWN entry point does set it, so the row above is not vacuous',
    owner.length === FLAG_OWNERS.size, `${owner.length}/${FLAG_OWNERS.size}`);

  const typesSrc = stripComments(readFileSync(join(ROOT, 'src/ui/screens/types.ts'), 'utf8'));
  ok('`Route.match.seats` is OPTIONAL — a required field would break every shipped navigation',
    /seats\?\s*:/.test(typesSrc) && !/[^?]\bseats\s*:\s*number/.test(typesSrc));

  const screenSrc = stripComments(readFileSync(join(ROOT, 'src/ui/screens/matchScreen.ts'), 'utf8'));
  ok('`matchScreen.ts` maps an absent `seats` to an absent roster — the OFF path, in source',
    /route\.seats\s*===\s*undefined/.test(screenSrc) && /brawlRoster\(/.test(screenSrc));

  // No randomness anywhere on the seat path. The sim's determinism underwrites every balance
  // number in the project; a random field makes a six-seat match unreproducible.
  const RNG_FIXTURE = 'const x = Math.random();';
  ok('CENSUS SELFTEST: the RNG census FIRES on a fixture that has one',
    /Math\.random/.test(RNG_FIXTURE));
  const brawlSrc = readFileSync(join(ROOT, 'src/ui/screens/brawl.ts'), 'utf8');
  ok('no `Math.random` on the seat path (`brawl.ts`)', !/Math\.random/.test(stripComments(brawlSrc)));

  // ───────────────────────────────────────────────────────────────────────────
  section('E. THE SIM SEATS IT FROM THE ARENA — no spawn passed, none invented');

  const RAW = JSON.parse(readFileSync(join(ROOT, 'tools/arena.gameplay.json'), 'utf8'));
  const ARENA = { ...RAW, build: () => null, update: () => {} };
  const SPAWNS = ARENA.spawns ?? [];
  ok('the arena dump declares a full set of seats', SPAWNS.length === MAX_FIGHTERS,
    `${SPAWNS.length} vs MAX_FIGHTERS ${MAX_FIGHTERS}`);
  // A stale-but-LEGAL coordinate check. The 1× playfield was exactly the NW quadrant of this
  // one, so "is this on the map?" cannot see the class (`DECISIONS §67`); the retired centre
  // is the cheapest positive discriminator and `np_nfighter` uses the same one.
  ok('the arena centre is NOT the retired 1× centre {700,500}',
    !(ARENA.center.x === 700 && ARENA.center.y === 500),
    `centre ${ARENA.center.x},${ARENA.center.y}`);

  /** The mapping `match.ts:newMatch` performs — see §D, which asserts it is the shipped one. */
  const configsFor = (roster, playerLevel) => roster.map((characterId, slot) => ({
    characterId,
    level: slot === 0 ? clampLevel(playerLevel) : enemyLevelFor(playerLevel),
  }));

  const SEAT_CASES = [];
  for (let n = MIN_FIGHTERS + 1; n <= MAX_FIGHTERS; n++) {
    for (const [p, e] of [['hamburger', 'donut'], ['sushi', 'egg'], ['hotdog', 'pizza'], ['lollipop', 'taco']]) {
      SEAT_CASES.push({ n, p, e, roster: brawlRoster(p, e, n) });
    }
  }
  ok('the seating corpus is non-empty before anything asserts over it', SEAT_CASES.length > 0,
    `${SEAT_CASES.length} seatings, ${MIN_FIGHTERS + 1}..${MAX_FIGHTERS}`);

  const offSpawn = [];
  for (const c of SEAT_CASES) {
    const st = createMatch(ARENA, configsFor(c.roster, 1));
    if (st.fighters.length !== c.n) { offSpawn.push(`${c.n}: seated ${st.fighters.length}`); continue; }
    st.fighters.forEach((f, i) => {
      if (f.x !== SPAWNS[i].x || f.y !== SPAWNS[i].y) {
        offSpawn.push(`${c.p}/${c.e}@${c.n} slot ${i}: (${f.x},${f.y}) != spawns[${i}] (${SPAWNS[i].x},${SPAWNS[i].y})`);
      }
      if (st.fighters[i].characterId !== c.roster[i]) offSpawn.push(`${c.n} slot ${i} character drift`);
    });
  }
  ok('every seat lands EXACTLY on `arena.spawns[i]` — resolved, never invented',
    offSpawn.length === 0, offSpawn.slice(0, 3).join(' · '));

  // KNOWN-BAD. A caller that invents a ring is what `sim.ts:defaultSpawn` exists to refuse,
  // and it is the shape that would silently revert `kx_seatfair`'s 2.680 → 0.342 places while
  // every legality check went on passing. **Legality is not fairness.**
  const ringed = createMatch(ARENA, brawlRoster('hamburger', 'donut', MAX_FIGHTERS).map((characterId, i) => ({
    characterId,
    level: 1,
    spawn: {
      x: ARENA.center.x + Math.round(400 * Math.cos((i / MAX_FIGHTERS) * Math.PI * 2)),
      y: ARENA.center.y + Math.round(400 * Math.sin((i / MAX_FIGHTERS) * Math.PI * 2)),
    },
  })));
  const ringOff = ringed.fighters.filter((f, i) => f.x !== SPAWNS[i].x || f.y !== SPAWNS[i].y);
  ok('KNOWN-BAD `ring`: an invented spawn ring FAILS the row above',
    ringOff.length === ringed.fighters.length,
    `${ringOff.length}/${ringed.fighters.length} seats moved off the declared spawns`);

  // ───────────────────────────────────────────────────────────────────────────
  section('F. FIVE BOTS AT THE PLAYER\'S LEVEL — through `enemyLevelFor`, the ONE place');

  const LEVELS = [1, 2, 7, 11, 15];
  const levelCases = [];
  for (const lv of LEVELS) {
    for (let n = MIN_FIGHTERS + 1; n <= MAX_FIGHTERS; n++) {
      levelCases.push({ lv, n, st: createMatch(ARENA, configsFor(brawlRoster('hamburger', 'donut', n), lv)) });
    }
  }
  ok('the level corpus is non-empty before anything asserts over it', levelCases.length > 0,
    `${LEVELS.length} levels × ${MAX_FIGHTERS - MIN_FIGHTERS} seat counts = ${levelCases.length}`);

  const wrongLevel = levelCases.filter((c) => c.st.fighters[0].level !== clampLevel(c.lv)
    || c.st.fighters.slice(1).some((f) => f.level !== enemyLevelFor(c.lv)));
  ok('slot 0 is the player\'s level and EVERY other seat is `enemyLevelFor(playerLevel)`',
    wrongLevel.length === 0, `${wrongLevel.length}/${levelCases.length}`);

  // `enemyLevelFor` is `'mirror'` today, so the row above would also pass under "copy slot 0's
  // level" — which is the same numbers by a different rule and would silently un-answer Uri's
  // question the day the mode changes. This is the row that tells them apart.
  ok('...and it is a CALL to `enemyLevelFor`, not a copy of slot 0 — asserted on the mode',
    levelCases.every((c) => c.st.fighters.slice(1).every((f) => f.level === enemyLevelFor(c.lv))),
    `mode gives enemyLevelFor(15) = ${enemyLevelFor(15)}`);

  // `DECISIONS §49c`: above two seats no slot gets a different dial because of its index.
  // The flag's path must not reintroduce the bot-opponent dial at six seats.
  const wrongHp = levelCases.filter((c) => c.st.fighters.some((f) =>
    f.maxHp !== maxHpFor(f.characterId, PLAYER_MAX_HP, f.level)));
  ok('above two seats every seat is built from the SAME role base (§49c), the flag included',
    wrongHp.length === 0, `${wrongHp.length}/${levelCases.length}`);

  // ───────────────────────────────────────────────────────────────────────────
  section('G. THE PLACEMENT PATH FIRES — real matches, played through the real sim');

  // 6 per seat count per arm = 48 real matches, ~60 s. The clock is 150 s now (`§72`) so a
  // match is ~10× the ticks it was when the 45 s clock was measured; a bigger default would
  // put an offline gate over two minutes for numbers that are already exact at this size
  // (every asserted row is a permutation or an equality, not an estimate).
  const MATCHES = Number(argOf('matches', 6));
  // ⚠️ `{ move: {x,y} }`, NOT `{ moveX, moveY }`. `state.ts:MatchInput` takes a `Vec2`, and a
  // wrong-shaped input does not throw at slot 0 unless slot 0 is a HUMAN seat — which is why
  // an instrument that seats every fighter as a bot can carry the wrong shape indefinitely
  // and never find out. This one crashed on the first run, which is the correct outcome.
  const IDLE = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  const TICK = 16.667;
  /** The tick ceiling. The clock is `MATCH_DURATION_MS`, so anything beyond it is a hang,
   *  not a long match — derived so the 45 s → 150 s reschedule cannot silently truncate it. */
  const TICK_CAP = Math.ceil((MATCH_DURATION_MS / TICK) * 1.2);

  /**
   * One real match.
   *
   * ⚠️ **TWO ARMS, AND THE DIFFERENCE IS WHO SITS IN SLOT 0.**
   *   * `afk`  — the product's EXACT config: slot 0 defaults to `'human'` and is fed
   *     `NEUTRAL_INPUT` forever. This is a real shipped scenario (a player who puts the
   *     phone down) and it is the arm that measures the wiring the product actually builds.
   *   * `bot`  — slot 0 overridden to `'ai'`, a bot standing in for a player. Needed because
   *     an AFK seat finishes at the BOTTOM of the field almost every time, so the `afk` arm
   *     produces few mid-field finishes and the money rows would assert over a near-empty
   *     set. `mp_join` seats every fighter as a bot for the same reason.
   * The `controller` override is the ONLY difference; levels, characters and spawns are the
   * product's, and `§D` is what says the product's mapping is the one being replayed.
   */
  function play(roster, playerLevel, arm) {
    const base = configsFor(roster, playerLevel);
    const configs = arm === 'bot' ? base.map((c, i) => (i === 0 ? { ...c, controller: 'ai' } : c)) : base;
    const state = createMatch(ARENA, configs);
    const eliminated = [];
    let ticks = 0;
    while (state.phase !== 'ended' && ticks++ < TICK_CAP) {
      for (const ev of stepMatch(state, TICK, configs.map(() => IDLE))) {
        if (ev.type === 'death') eliminated.push(ev.fighterId);
      }
    }
    // Exactly `match.ts:outcome()`'s PlacementInput, field for field.
    const input = {
      seats: state.fighters.map((f, i) => ({
        id: i, alive: f.alive, hp: f.hp, maxHp: f.maxHp, x: f.x, y: f.y, deaths: f.deaths,
      })),
      center: { x: ARENA.center.x, y: ARENA.center.y },
      eliminated,
      winnerId: state.winnerId ?? null,
    };
    const places = resolvePlaces(input);
    return { state, ticks, eliminated, input, places, localPlace: places.indexOf(0), seats: input.seats.length, arm };
  }

  const ALL = [];
  for (const arm of ['afk', 'bot']) {
    for (let n = MIN_FIGHTERS + 1; n <= MAX_FIGHTERS; n++) {
      for (let s = 0; s < MATCHES; s++) {
        const p = CHARACTER_IDS[(s * 3) % CHARACTER_IDS.length];
        const raw = CHARACTER_IDS[(s * 3 + 1 + (s % 4)) % CHARACTER_IDS.length];
        const e = raw === p ? CHARACTER_IDS[(s + 5) % CHARACTER_IDS.length] : raw;
        ALL.push({ n, ...play(brawlRoster(p, e, n), 1, arm) });
      }
    }
  }
  const corpus = ALL.filter((m) => m.arm === 'bot');
  const afk = ALL.filter((m) => m.arm === 'afk');
  ok('the match corpus is non-empty before anything asserts over it',
    ALL.length > 0 && corpus.length > 0 && afk.length > 0,
    `${ALL.length} real matches — ${afk.length} AFK-seat (the product's exact config) + ${corpus.length} bot-seat`);
  const unfinished = ALL.filter((m) => m.state.phase !== 'ended');
  ok('every match REACHED an ending inside the clock — the corpus is not a timeout',
    unfinished.length === 0, `${unfinished.length} ran past ${TICK_CAP} ticks`);

  const notPerm = ALL.filter((m) => m.places.length !== m.n
    || new Set(m.places).size !== m.n
    || !m.places.every((id) => id >= 0 && id < m.n));
  ok('every finishing order is a PERMUTATION of the seats the flag opened',
    notPerm.length === 0, `${notPerm.length}/${ALL.length}`);

  // 🚨 THE ROW THE WHOLE FLAG EXISTS FOR. `matchScreen.ts`'s `payable` predicate, restated
  // exactly: a match that fails it silently falls back to `recordResult(winner === 'player')`
  // and **pays a six-player match as a 1v1 loss** — 9 trophies, 24 coins and 39 XP short.
  const payable = (m) => m.localPlace >= 0 && m.seats >= MIN_FIGHTERS && m.seats <= MAX_FIGHTERS;
  const unpayable = ALL.filter((m) => !payable(m));
  ok('every match satisfies `matchScreen.ts`\'s `payable` — the PLACEMENT branch is reached',
    unpayable.length === 0, `${unpayable.length}/${ALL.length} would have fallen back to the duel rate`);
  ok('...including every match on the product\'s EXACT config (slot 0 human)',
    afk.filter((m) => !payable(m)).length === 0, `${afk.length} AFK-seat matches`);

  const seatMismatch = ALL.filter((m) => m.seats !== m.n);
  ok('the seat count that reaches `recordPlacement` IS the seat count the flag asked for',
    seatMismatch.length === 0, `${seatMismatch.length}/${ALL.length}`);

  // ...and the money it reaches is a DIFFERENT number from the duel's. Without this the row
  // above proves a branch is taken, not that taking it matters.
  const midfield = corpus.filter((m) => m.localPlace > 0 && m.localPlace < m.n - 1);
  ok('the corpus contains MID-FIELD finishes, so the money row below is not vacuous',
    midfield.length > 0, `${midfield.length}/${corpus.length} finished neither 1st nor last`);
  const sameMoney = midfield.filter((m) => {
    const curve = ECON.placementCoins(m.localPlace, m.seats);
    const duel = ECON.placementCoins(m.localPlace === 0 ? 0 : 1, MIN_FIGHTERS);
    return curve === duel;
  });
  ok('a mid-field finish is paid the CURVE, and that differs from the boolean duel rate',
    sameMoney.length === 0,
    `${midfield.length - sameMoney.length}/${midfield.length} differ`);

  // KNOWN-BAD `slotorder`. A resolver reading the FINAL STATE degenerates to slot order —
  // every loser ends `alive:false, hp:0, deaths:1` identically — which is the bug the death
  // event stream exists to avoid. If the permutation row above could not tell them apart it
  // would be measuring nothing.
  const six = ALL.filter((m) => m.n === MAX_FIGHTERS);
  ok('the six-seat arm is non-empty', six.length > 0, `${six.length}`);
  const slotOrderAgrees = six.filter((m) => {
    const w = m.input.winnerId;
    return eqJson(m.places, [w, ...m.input.seats.map((f) => f.id).filter((id) => id !== w)]);
  });
  ok('KNOWN-BAD `slotorder`: a final-state resolver DISAGREES at six seats — the row is live',
    slotOrderAgrees.length === 0,
    `slot order matches the real ranking in ${slotOrderAgrees.length}/${six.length}`);

  // XP is a THIRD ladder and is imported, not re-derived — `DECISIONS §61`. `src/ui/**` needs
  // the esbuild bridge; `nw_profile.mjs`'s row is the standing note on why.
  let placementXp = null;
  try {
    const dir = mkdtempSync(join(tmpdir(), 'sp6-xp-'));
    const entry = join(dir, 'entry.ts');
    writeFileSync(entry, `export { placementXp } from ${JSON.stringify(join(ROOT, 'src/ui/screens/profile.ts'))};\n`);
    const outFile = join(dir, 'bridge.mjs');
    execFileSync(join(ROOT, 'node_modules/.bin/esbuild'), [
      entry, '--bundle', '--format=esm', '--platform=node', '--log-level=error', `--outfile=${outFile}`,
    ], { stdio: 'inherit' });
    ({ placementXp } = await import(pathToFileURL(outFile).href));
    rmSync(dir, { recursive: true, force: true });
  } catch (e) {
    console.log(`    ⚠ the XP bridge did not build: ${String(e).split('\n')[0]}`);
  }
  ok('`profile.ts:placementXp` reached through the esbuild bridge', typeof placementXp === 'function');
  if (typeof placementXp === 'function') {
    const flatXp = midfield.filter((m) => placementXp(m.localPlace, m.seats) === placementXp(m.localPlace === 0 ? 0 : 1, MIN_FIGHTERS));
    ok('...and a mid-field finish earns XP the duel ladder cannot express',
      flatXp.length === 0, `${midfield.length - flatXp.length}/${midfield.length} differ`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  section('H. REPORTED, NOT ASSERTED — what an N-seat match now looks like');

  // 🚨 `DECISIONS §58` recorded sudden death deciding **90.5%** of six-player matches and is
  // superseded by **§72**, which Uri answered on 2026-08-12 by PLAYING it: the 30 s trigger
  // was truncating the ring schedule, and the tree now runs a 150 s clock with `FOG_HOLD_MS`
  // / `FOG_CLOSE_MS`. So the 90.5% describes constants that are no longer in the tree. These
  // are today's numbers, on today's schedule, with the corpus size stated.
  console.log(`    clock ${MATCH_DURATION_MS / 1000}s · sudden death at ${SUDDEN_DEATH_MS / 1000}s`);
  for (const armName of ['afk', 'bot']) {
    for (let n = MIN_FIGHTERS + 1; n <= MAX_FIGHTERS; n++) {
      const arm = ALL.filter((m) => m.n === n && m.arm === armName);
      if (arm.length === 0) continue;
      const sd = arm.filter((m) => m.state.elapsed >= SUDDEN_DEATH_MS).length;
      const mean = arm.reduce((a, m) => a + m.state.elapsed, 0) / arm.length / 1000;
      const dist = new Array(n).fill(0);
      for (const m of arm) dist[m.localPlace]++;
      console.log(`    ${armName.padEnd(3)} N=${n}  n=${arm.length}  mean ${mean.toFixed(2)}s  `
        + `sudden death ${sd}/${arm.length} (${(100 * sd / arm.length).toFixed(1)}%)  `
        + `slot-0 places ${dist.join('/')}`);
    }
  }

  return finish();
}

function finish() {
  console.log(`\n${fail === 0 ? '✅' : '🔴'} SP6_SEATS: ${pass} passed, ${fail} failed`);
  if (fail) console.log(`   failing: ${failures.join(' · ')}`);
  return fail;
}

if (IS_MAIN) {
  main().then((n) => process.exit(n === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}
