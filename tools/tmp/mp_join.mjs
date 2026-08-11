#!/usr/bin/env node
/**
 * MP_JOIN — THE GATE ON THE PAYOUT JOIN.
 *
 *   node tools/tmp/mp_join.mjs --selftest
 *   node tools/tmp/mp_join.mjs --selftest --root <a worktree>   # measure another tree
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  WHAT IT GUARDS
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * `matchScreen.ts` banked `ctx.profile.recordResult(winner === 'player')` — a BOOLEAN,
 * which `profile.ts` forwards as `recordPlacement(won ? 0 : 1, MIN_FIGHTERS)`. So **every
 * match this product has ever played paid as a duel**, and the 3-6 seat curve built in
 * `DECISIONS §59` and wired through in `§61` was unreachable from the game.
 *
 * 🚨 **THE KNOWN-BAD FOR THIS GATE IS THE SHIPPED CODE, AND IT IS RUN, NOT DESCRIBED.**
 * `--selftest` on the commit before the join goes RED on §A. That is the whole licence for
 * reading the rest: `docs/AGENT-BRIEF.md` §4.4 — *"a guard that has not been shown to FAIL
 * on the bug it guards against is not a guard"* — and `§61` records three known-bads in one
 * night that each certified the check they were meant to falsify.
 *
 * ⚠️ **AND THE CENSUS IS ITSELF VALIDATED, BECAUSE THE LAST ONE HERE WAS WRONG.** The pass
 * that found this defect declared its own trap: **its call-site census counted the function
 * DECLARATION `recordPlacement(place: number, seats: number)` as a call site**, printed
 * `ok`, and put an evidence line describing the failure next to it. §A therefore runs the
 * census over a FIXTURE containing one declaration, one call and one comment mentioning the
 * name, and requires it to return exactly the call — before it is allowed to look at `src/`.
 *
 * ⚠️ **RESOLUTION FLOOR: NONE ON ANY ASSERTED ROW.** Every check is exact — integer
 * equality, set equality, or a permutation test. The only reported-not-asserted numbers are
 * §E's per-match means, which are exact means over a finite measured distribution and are
 * labelled as a price, not as a target.
 */
import { readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const HERE = resolve(new URL('../..', import.meta.url).pathname);
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const argOf = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
/** The tree under test. Defaults to this repo; `--root` points it at a detached worktree,
 *  which is how the known-bad arm is run without touching anybody's working tree. */
const ROOT = resolve(argOf('root', HERE));

let pass = 0;
let fail = 0;
const failures = [];
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}${detail ? `  — ${detail}` : ''}`); }
  else { fail++; failures.push(label); console.log(`  ✗ ${label}${detail ? `  — ${detail}` : ''}`); }
}
function section(t) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 74 - t.length))}`); }

// ═════════════════════════════════════════════════════════════════════════════
// The census
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Calls to `name(` in TypeScript source — **declarations excluded**, which is the whole
 * point of this function existing rather than a `grep`.
 *
 * A call and a declaration are the same three tokens (`name` `(` args). What separates them
 * is what comes BEFORE and what is INSIDE:
 *   * a declaration is preceded by `function`/`async function`, or is a class method — i.e.
 *     it starts a line (modulo indentation and `private `/`public `/`static `/`readonly `);
 *   * a declaration's parameter list contains `:` type annotations at depth 1, or the whole
 *     construct is followed by `{`;
 *   * a CALL always has a receiver or an operator in front of it: `.`, `=`, `(`, `return `,
 *     `,`, `&&`, `?`, `:`.
 *
 * So the rule used is the strongest available and is stated once: **a call is an occurrence
 * of `name(` immediately preceded by `.`** (a method call, which is what every payout call
 * site in this product is — `profile.recordResult(…)`, `this.recordPlacement(…)`,
 * `ctx.profile.recordPlacement(…)`) **or by an operator/keyword boundary, and NOT followed
 * by a parameter list that type-annotates.** Comments and strings are stripped first.
 */
export function callSites(source, name) {
  const stripped = source
    // Block comments, then line comments, then string/template bodies. Newlines preserved
    // so the reported line numbers stay true.
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length))
    .replace(/`(?:[^`\\]|\\.)*`/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/'(?:[^'\\\n]|\\.)*'/g, (m) => ' '.repeat(m.length))
    .replace(/"(?:[^"\\\n]|\\.)*"/g, (m) => ' '.repeat(m.length));

  const out = [];
  const re = new RegExp(`\\b${name}\\s*\\(`, 'g');
  let m;
  while ((m = re.exec(stripped)) !== null) {
    const at = m.index;
    // What precedes the identifier, ignoring horizontal whitespace.
    const before = stripped.slice(0, at).replace(/[ \t]+$/, '');
    const prevChar = before.slice(-1);
    const lineStart = before.lastIndexOf('\n') + 1;
    const linePrefix = before.slice(lineStart);

    // A DECLARATION: `function name(`, or a class method (nothing but modifiers before it
    // on its own line). Both are excluded.
    const isFunctionKeyword = /\b(?:function|get|set)$/.test(before);
    const isMethodDecl = prevChar !== '.' && /^(?:\s*)(?:(?:public|private|protected|static|readonly|abstract|async|override)\s+)*$/.test(linePrefix);
    if (isFunctionKeyword || isMethodDecl) continue;

    // A TYPE POSITION — `foo: recordPlacement(` cannot occur, but `interface X { f(...)`
    // can; excluded by the method-decl rule above. What remains and must be excluded is an
    // identifier immediately before (e.g. `applyMatchPlacement` matching `Placement`),
    // which `\b` already prevents.
    const line = stripped.slice(lineStart, stripped.indexOf('\n', at) === -1 ? undefined : stripped.indexOf('\n', at));
    out.push({ index: at, line: source.slice(0, at).split('\n').length, text: line.trim() });
  }
  return out;
}

function walkTs(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walkTs(p, acc);
    else if (/\.tsx?$/.test(entry)) acc.push(p);
  }
  return acc;
}

// ═════════════════════════════════════════════════════════════════════════════

if (!IS_MAIN) {
  // Exports only. `docs/AGENT-BRIEF.md` §3: three tools here made their whole CLI path run
  // on import, and one of them would have killed every snapshot server on the box.
} else {
  console.log(`MP_JOIN — the payout join\n  tree under test: ${ROOT}`);

  // ═══════════════════════════════════════════════════════════════════════════
  section('A. THE CALL SITE — and the census validated on a known-bad FIRST');

  const FIXTURE = `
class P {
  /** recordPlacement is named in this comment and must NOT count. */
  recordPlacement(place: number, seats: number): LastMatch {
    return this.applyMatchPlacement(place, seats);
  }
  recordResult(won: boolean): LastMatch {
    return this.recordPlacement(won ? 0 : 1, MIN_FIGHTERS);
  }
}
const s = "recordPlacement(1, 6) inside a string";
export function recordPlacement(place: number, seats: number) { return 0; }
`;
  const fixtureHits = callSites(FIXTURE, 'recordPlacement');
  ok('the census sees the PLANTED call and only it',
    fixtureHits.length === 1 && fixtureHits[0].text.includes('this.recordPlacement(won ? 0 : 1'),
    `${fixtureHits.length} hit(s): ${fixtureHits.map((h) => h.text).join(' | ') || '—'}`);
  ok('the census excludes the DECLARATION — the exact trap that fooled the last one',
    !fixtureHits.some((h) => /place: number/.test(h.text)));
  ok('the census excludes the comment and the string literal',
    !fixtureHits.some((h) => /comment|inside a string/.test(h.text)));

  const files = walkTs(join(ROOT, 'src'));
  const ECONOMY = /src[\\/]game[\\/]economy[\\/]/;
  const PROFILE = /src[\\/]ui[\\/]screens[\\/]profile\.ts$/;

  const placementCalls = [];
  const resultCalls = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const rel = relative(ROOT, f);
    for (const h of callSites(src, 'recordPlacement')) placementCalls.push({ rel, ...h });
    for (const h of callSites(src, 'recordResult')) resultCalls.push({ rel, ...h });
  }
  const outsideEconomy = (c) => !ECONOMY.test(c.rel) && !PROFILE.test(c.rel);
  const productPlacement = placementCalls.filter(outsideEconomy);
  const productResult = resultCalls.filter(outsideEconomy);

  console.log(`    recordPlacement call sites: ${placementCalls.length} total, `
    + `${productPlacement.length} outside game/economy + profile.ts`);
  for (const c of placementCalls) console.log(`      ${c.rel}:${c.line}  ${c.text}`);
  console.log(`    recordResult call sites:    ${resultCalls.length} total, `
    + `${productResult.length} outside game/economy + profile.ts`);
  for (const c of resultCalls) console.log(`      ${c.rel}:${c.line}  ${c.text}`);

  // 🔴 THE ROW THAT IS RED ON THE UNJOINED TREE.
  ok('the product banks a SEAT-AWARE placement (not a boolean)',
    productPlacement.length >= 1,
    productPlacement.length === 0
      ? `0 — every payout goes through recordResult(boolean) === recordPlacement(won?0:1, 2), `
        + `so the 3-6 seat curve is unreachable from the game`
      : productPlacement.map((c) => `${c.rel}:${c.line}`).join(', '));

  ok('the join is in `matchScreen.ts`, the one screen that owns a match result',
    productPlacement.some((c) => /matchScreen\.ts$/.test(c.rel)),
    productPlacement.map((c) => c.rel).join(', ') || '—');

  // ═══════════════════════════════════════════════════════════════════════════
  section('B. THE RESOLVER — is it even in the tree?');

  let R = null;
  try {
    R = await import(pathToFileURL(join(ROOT, 'src/game/roster.ts')).href);
  } catch (e) {
    console.log(`    roster.ts did not import: ${e.message.split('\n')[0]}`);
  }
  const haveResolver = !!(R && typeof R.resolvePlaces === 'function');
  ok('`roster.ts:resolvePlaces` exists and is importable by a NODE gate',
    haveResolver,
    haveResolver ? '' : 'absent — every row below is unreachable, which is the RED state');

  if (haveResolver) {
    const { resolvePlaces, placeOf } = R;
    const { createMatch, stepMatch } = await import(pathToFileURL(join(ROOT, 'src/game/sim.ts')).href);
    const { CHARACTER_IDS } = await import(pathToFileURL(join(ROOT, 'src/game/rules.ts')).href);
    const { MIN_FIGHTERS, MAX_FIGHTERS } = await import(pathToFileURL(join(ROOT, 'src/game/state.ts')).href);
    const ECON = await import(pathToFileURL(join(ROOT, 'src/game/economy/index.ts')).href);

    const RAW = JSON.parse(readFileSync(join(ROOT, 'tools/arena.gameplay.json'), 'utf8'));
    const ARENA = { ...RAW, build: () => null, update: () => {} };
    const IDLE = { moveX: 0, moveY: 0, attack: false, facingX: 1, facingY: 0, selectedWeapon: 0 };

    /** One real match, played through the real `stepMatch`, with the event stream kept. */
    function play(seats, seed) {
      const configs = [];
      for (let i = 0; i < seats; i++) {
        configs.push({
          characterId: CHARACTER_IDS[(seed * 7 + i * 3) % CHARACTER_IDS.length],
          controller: 'ai',
          spawn: ARENA.spawns[i],
        });
      }
      const state = createMatch(ARENA, configs);
      const eliminated = [];
      let ticks = 0;
      while (state.phase !== 'ended' && ticks++ < 20000) {
        for (const ev of stepMatch(state, 16.667, configs.map(() => IDLE))) {
          if (ev.type === 'death') eliminated.push(ev.fighterId);
        }
      }
      return {
        state,
        eliminated,
        input: {
          seats: state.fighters.map((f, i) => ({
            id: i, alive: f.alive, hp: f.hp, maxHp: f.maxHp, x: f.x, y: f.y, deaths: f.deaths,
          })),
          center: { x: ARENA.center.x, y: ARENA.center.y },
          eliminated,
          winnerId: state.winnerId ?? null,
        },
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    section('C. AGAINST REAL MATCHES — 2 to 6 seats');

    const MATCHES = Number(argOf('matches', 24));
    const corpus = [];
    for (let n = MIN_FIGHTERS; n <= MAX_FIGHTERS; n++) {
      for (let s = 0; s < MATCHES; s++) corpus.push({ n, ...play(n, s) });
    }
    console.log(`    corpus: ${corpus.length} real matches (${MATCHES} per seat count, ${MIN_FIGHTERS}..${MAX_FIGHTERS})`);

    const permutationOk = corpus.every((m) => {
      const p = resolvePlaces(m.input);
      return p.length === m.n && new Set(p).size === m.n && p.every((id) => id >= 0 && id < m.n);
    });
    ok('every ranking is a PERMUTATION of the seats — nothing dropped, nothing doubled',
      permutationOk);

    const winnerFirst = corpus.filter((m) => resolvePlaces(m.input)[0] === m.state.winnerId);
    ok('place 0 IS the winner the SIM declared, in every match',
      winnerFirst.length === corpus.length,
      `${winnerFirst.length}/${corpus.length}`);

    // The reconciliation branch must be DEAD on real matches: if it were load-bearing here,
    // "place 0 is the winner" above would be a tautology rather than a measurement.
    const reconciled = corpus.filter((m) => {
      const noWinner = resolvePlaces({ ...m.input, winnerId: null });
      return noWinner[0] !== m.state.winnerId;
    });
    ok('the winner-reconciliation branch fires ZERO times on the real corpus',
      reconciled.length === 0,
      `${reconciled.length}/${corpus.length} would have needed it`);

    const runnerUpIsLastEliminated = corpus.filter((m) => {
      if (m.eliminated.length === 0) return true;
      return resolvePlaces(m.input)[1] === m.eliminated[m.eliminated.length - 1];
    });
    ok('the RUNNER-UP is the last fighter knocked out',
      runnerUpIsLastEliminated.length === corpus.length,
      `${runnerUpIsLastEliminated.length}/${corpus.length}`);

    // 🚨 THE KNOWN-BAD FOR THE ROW ABOVE. A resolver that ranks the losers in SLOT order is
    // exactly what a final-state resolver degenerates to (`roster.ts:resolvePlaces`'s
    // header), and it is what `hud.ts`'s result card does today. If the row above cannot
    // see it, the row above is measuring nothing.
    const mutantSlotOrder = (input) => {
      const w = input.winnerId;
      return [w, ...input.seats.map((f) => f.id).filter((id) => id !== w)];
    };
    const six = corpus.filter((m) => m.n === 6);
    const mutantAgrees = six.filter((m) => {
      const a = resolvePlaces(m.input);
      const b = mutantSlotOrder(m.input);
      return JSON.stringify(a) === JSON.stringify(b);
    });
    ok('KNOWN-BAD: a slot-order resolver DISAGREES at six seats — so the row above is live',
      mutantAgrees.length === 0,
      `slot-order matches the real ranking in ${mutantAgrees.length}/${six.length} six-seat matches`);

    // ─────────────────────────────────────────────────────────────────────────
    section('B2. THE TWO-SEAT CONTROL — the join must be a NO-OP at N=2');

    const duels = corpus.filter((m) => m.n === 2);
    const duelArgsMatch = duels.every((m) => {
      const place = placeOf(m.input, 0);
      const wonBoolean = m.state.winner === 'player';
      // `recordResult(won)` forwards exactly `recordPlacement(won ? 0 : 1, MIN_FIGHTERS)`.
      return place === (wonBoolean ? 0 : 1) && m.input.seats.length === MIN_FIGHTERS;
    });
    ok('at two seats the resolver produces recordResult(won)\'s EXACT arguments',
      duelArgsMatch, `${duels.length} duels`);

    // ...and the same arguments must produce the same money, at every standing, on a real
    // economy. The floor here is zero: it is a deep equality on the serialised state.
    let moneyIdentical = true;
    let firstMismatch = '';
    for (const trophies of [0, 40, 120, 500, 1200, 3000]) {
      for (const won of [true, false]) {
        const a = ECON.createEconomy();
        const b = ECON.createEconomy();
        // 🚨 THE SEED IS PINNED, AND FINDING OUT WHY COST A RED ROW. `createEconomy()`
        // draws a RANDOM `seed` for the container RNG, so two fresh economies are never
        // `serialize`-equal and this row failed on the harness rather than on the code —
        // the instrument was wrong, exactly as `CLAUDE.md` #6 says to expect. Pinning it
        // is what makes the comparison about the payout.
        a.seed = 0x9E3779B9; b.seed = 0x9E3779B9;
        a.trophies = trophies; b.trophies = trophies;
        const viaBoolean = ECON.applyMatchResult(a, won);
        const viaPlacement = ECON.applyMatchPlacement(b, won ? 0 : 1, MIN_FIGHTERS);
        const same = JSON.stringify(viaBoolean) === JSON.stringify(viaPlacement)
          && JSON.stringify(ECON.serialize(a)) === JSON.stringify(ECON.serialize(b));
        if (!same && !firstMismatch) firstMismatch = `${trophies} trophies, won=${won}`;
        moneyIdentical = moneyIdentical && same;
      }
    }
    ok('...and those arguments pay IDENTICALLY at six standings, win and loss',
      moneyIdentical, firstMismatch || 'identical across 12 cells');

    // ─────────────────────────────────────────────────────────────────────────
    section('D. THE SHAPES A REAL MATCH DOES NOT PRODUCE — built by hand');

    const seat = (id, o = {}) => ({
      id, alive: false, hp: 0, maxHp: 100, x: 0, y: 0, deaths: 1, ...o,
    });
    const centre = { x: 0, y: 0 };

    // D1 — SEVERAL ALIVE AT DIFFERENT HP. This is a `resolveTimeout` finish, which §58 made
    // rare rather than impossible, and it is the case the brief names explicitly.
    const timeoutish = {
      seats: [
        seat(0, { alive: true, hp: 10, x: 300, y: 0 }),
        seat(1, { alive: true, hp: 80, x: 400, y: 0 }),
        seat(2, { alive: true, hp: 55, x: 10, y: 0 }),
        seat(3),
      ],
      center: centre,
      eliminated: [3],
      winnerId: 1,
    };
    ok('D1 several alive at different HP → ranked by HP FRACTION, corpses last',
      JSON.stringify(resolvePlaces(timeoutish)) === JSON.stringify([1, 2, 0, 3]),
      JSON.stringify(resolvePlaces(timeoutish)));

    // D1b — the same HP fraction: rung 2 is DISTANCE TO CENTRE, not the slot.
    const tied = {
      seats: [seat(0, { alive: true, hp: 50, x: 900, y: 0 }), seat(1, { alive: true, hp: 50, x: 5, y: 0 })],
      center: centre, eliminated: [], winnerId: 1,
    };
    ok('D1b equal HP fraction → the fighter nearer the centre places higher (rung 2)',
      JSON.stringify(resolvePlaces(tied)) === JSON.stringify([1, 0]));

    // D2 — TOTAL WIPE. `state.ts:lastFighterStanding` documents it as reachable in
    // principle and nothing has ever executed it, which is why it is constructed here.
    const wipe = {
      seats: [seat(0, { x: 999 }), seat(1, { x: 1 }), seat(2, { x: 500 })],
      center: centre,
      // Slot 2 died LAST, so the un-reconciled ranking would put slot 2 first...
      eliminated: [0, 1, 2],
      // ...but the sim declared slot 1 (nearest the centre, `resolveTimeout` rung 2).
      winnerId: 1,
    };
    const wipeRanked = resolvePlaces(wipe);
    ok('D2 total wipe → the SIM\'s declared winner is still first (the guard fires)',
      wipeRanked[0] === 1 && new Set(wipeRanked).size === 3,
      JSON.stringify(wipeRanked));
    ok('D2b ...and with no declared winner the guard does NOT fire — so D2 measured it',
      JSON.stringify(resolvePlaces({ ...wipe, winnerId: null })) === JSON.stringify([2, 1, 0]),
      JSON.stringify(resolvePlaces({ ...wipe, winnerId: null })));

    // D3 — RESPAWN SHAPE. `Fighter.deaths` is 0/1 today; `state.ts` says the counter exists
    // to stay correct when respawns land, and on that day the rung is the LAST knockout.
    const respawn = {
      seats: [seat(0, { deaths: 2 }), seat(1, { deaths: 1 }), seat(2, { alive: true, hp: 30 })],
      center: centre,
      eliminated: [0, 1, 0],
      winnerId: 2,
    };
    ok('D3 a slot knocked out twice is ranked on its LAST knockout, not its first',
      JSON.stringify(resolvePlaces(respawn)) === JSON.stringify([2, 0, 1]),
      JSON.stringify(resolvePlaces(respawn)));

    // D4 — a seat that never emitted a death event must still get a place.
    const orphan = {
      seats: [seat(0, { alive: true, hp: 90 }), seat(1), seat(2, { deaths: 0 })],
      center: centre, eliminated: [1], winnerId: 0,
    };
    const orphanRanked = resolvePlaces(orphan);
    ok('D4 a dead seat with no `death` event still gets a place (§49a orders it)',
      orphanRanked.length === 3 && new Set(orphanRanked).size === 3
        && orphanRanked[0] === 0 && orphanRanked[1] === 1,
      JSON.stringify(orphanRanked));

    // ─────────────────────────────────────────────────────────────────────────
    section('E. THE PRICE — what the boolean join was costing, per match');

    // The place distribution the LOCAL seat actually finishes in, measured on the corpus
    // rather than assumed uniform: slot 0 is a bot here, so this is the distribution a
    // competent-average player faces, and it is reported as a model, not as a target.
    const sixCorpus = corpus.filter((m) => m.n === 6);
    const dist = new Array(6).fill(0);
    for (const m of sixCorpus) dist[placeOf(m.input, 0)]++;
    console.log(`    measured place distribution of slot 0 over ${sixCorpus.length} six-seat matches: `
      + dist.map((c, i) => `${i + 1}${['st', 'nd', 'rd', 'th', 'th', 'th'][i]}:${c}`).join(' '));

    /**
     * 🚨 XP IS A THIRD LADDER AND IT IS IMPORTED, NOT RE-DERIVED. `DECISIONS §61`: XP was a
     * SECOND two-outcome ladder nobody had noticed, and `profile.ts:placementXp` is the
     * interpolation that fixed it. `src/ui/**` cannot be imported by a Node instrument
     * (extension-less specifiers), so this bundles ONE bridge entry — the same idiom, and
     * the same reason, as `tools/tmp/nw_profile.mjs`. Re-deriving `100 - w * 65` here would
     * make this section a test of the copy.
     */
    let placementXp = null;
    try {
      const dir = mkdtempSync(join(tmpdir(), 'mp-xp-'));
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
    ok('`profile.ts:placementXp` reached through the esbuild bridge (the THIRD ladder)',
      typeof placementXp === 'function');

    /** `dist` is the measured distribution; `flat` is an even field, which is what a fair
     *  matchmaker produces and is therefore the seat-count-only price of the defect. */
    const price = (weights, label) => {
      const total = weights.reduce((a, b) => a + b, 0);
      for (const trophies of [0, 500, 1200]) {
        let tCurve = 0; let tBool = 0; let cCurve = 0; let cBool = 0; let xCurve = 0; let xBool = 0;
        for (let place = 0; place < 6; place++) {
          const w = weights[place] / total;
          const boolPlace = place === 0 ? 0 : 1;   // what the shipped join actually paid
          tCurve += w * ECON.placementTrophyDelta(place, 6, trophies);
          tBool += w * ECON.placementTrophyDelta(boolPlace, 2, trophies);
          cCurve += w * ECON.placementCoins(place, 6);
          cBool += w * ECON.placementCoins(boolPlace, 2);
          if (placementXp) {
            xCurve += w * placementXp(place, 6);
            xBool += w * placementXp(boolPlace, 2);
          }
        }
        console.log(`    ${label} @ ${String(trophies).padStart(4)} trophies:  `
          + `trophies underpaid ${(tCurve - tBool).toFixed(2)}   `
          + `coins underpaid ${(cCurve - cBool).toFixed(1)}   `
          + `XP underpaid ${placementXp ? (xCurve - xBool).toFixed(1) : 'n/a'}`);
      }
    };
    price(dist, 'measured');
    price([1, 1, 1, 1, 1, 1], 'even field');
    ok('the curve pays STRICTLY more than the boolean join at six seats (the defect is real)',
      (() => {
        let cCurve = 0; let cBool = 0;
        for (let place = 0; place < 6; place++) {
          const w = dist[place] / sixCorpus.length;
          cCurve += w * ECON.placementCoins(place, 6);
          cBool += w * ECON.placementCoins(place === 0 ? 0 : 1, 2);
        }
        return cCurve > cBool;
      })());
  }

  console.log(`\n${fail === 0 ? '✅' : '🔴'} MP_JOIN: ${pass} passed, ${fail} failed`);
  if (fail) console.log(`   failing: ${failures.join(' · ')}`);
  process.exit(fail === 0 ? 0 : 1);
}
