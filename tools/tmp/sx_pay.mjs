#!/usr/bin/env node
/**
 * SX_PAY — DOES A SIX-PLAYER MATCH ACTUALLY PAY SIX PLACES?
 *
 * `721ce3c` built the 3–6 seat payout curve, `a588066` wired XP and the league through it, and
 * `nw_profile.mjs` proves both **at the API**: `recordPlacement(place, seats)` and
 * `applyMatchResult` price correctly, including §61's per-finisher-at-their-own-standing fix.
 *
 * 🚨 **NOTHING HAD ASKED WHAT THE GAME ACTUALLY CALLS.** That is the seam, and it is the same
 * seam §61 records: *"the curve was right, the caller was right about two seats, and the defect
 * lived in the join."* This file measures the join, from the placement a real six-fighter match
 * produces to the coins, trophies and XP that reach the profile.
 *
 * ── WHAT IT PRICES ──────────────────────────────────────────────────────────
 *
 *   §A  the two payment paths, side by side, for every place at every seat count.
 *   §B  slot 0's REAL place distribution, taken from an `sx_census.mjs --json` corpus, priced
 *       both ways — so the error is a per-match number and not a worked example.
 *   §C  🚨 THE CONTROL. At two seats the two paths must be **identical**, place for place, at
 *       every standing. If they differ at N=2, §A and §B are measuring an arithmetic mistake in
 *       this file rather than a seat-count defect, and every number above is void.
 *   §D  the CALL-SITE census: which arities of `recordPlacement` / `applyMatchPlacement` are
 *       reachable from `src/`, counted from the tree rather than remembered.
 *
 * ── The bridge ──────────────────────────────────────────────────────────────
 * `src/ui/**` cannot be imported by a Node instrument — its imports are extension-less and
 * resolve only under Vite/tsc (a standing finding, `DECISIONS §61`). One esbuild entry
 * re-exports `profile.ts` AND `game/economy/index.ts` together, deliberately: two separate
 * bundles would give two module instances of the economy and identity comparisons would be
 * false for two copies of the same source. Copied from `nw_profile.mjs`, which owns this rule.
 *
 *   node tools/tmp/sx_pay.mjs --src <tree>/src [--census <sx_census --json output>]
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SRC = resolve(String(arg('--src', `${ROOT}/src`)));
const CENSUS = arg('--census', null);

function buildBridge() {
  const dir = mkdtempSync(join(tmpdir(), 'sx-pay-'));
  const entry = join(dir, 'entry.ts');
  writeFileSync(entry, [
    `export * from ${JSON.stringify(join(SRC, 'ui/screens/profile.ts'))};`,
    `export * from ${JSON.stringify(join(SRC, 'game/economy/index.ts'))};`,
    `export { MIN_FIGHTERS, MAX_FIGHTERS } from ${JSON.stringify(join(SRC, 'game/state.ts'))};`,
  ].join('\n'));
  const out = join(dir, 'bridge.mjs');
  execFileSync(join(ROOT, 'node_modules/.bin/esbuild'), [
    entry, '--bundle', '--format=esm', '--platform=node', '--log-level=error', `--outfile=${out}`,
  ], { stdio: 'inherit' });
  return { dir, out };
}

const bridge = buildBridge();
const M = await import(bridge.out);
rmSync(bridge.dir, { recursive: true, force: true });

const { PlayerProfile, MIN_FIGHTERS, MAX_FIGHTERS } = M;

let pass = 0, fail = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   - ${label}${detail ? `   ${detail}` : ''}`); }
  else { fail++; console.log(`  FAIL - ${label}${detail ? `\n         ${detail}` : ''}`); }
};

/**
 * A fresh profile parked at a chosen trophy standing, so the grace band is exercised rather
 * than assumed. `applyMatchPlacement` prices the LOSS TERM against the player's OWN trophies —
 * §61's fix — so "what does 6th of six cost" has no answer without a standing.
 */
function profileAt(trophies) {
  const p = new PlayerProfile();
  p.data.economy.trophies = trophies;
  return p;
}
const snap = (p) => ({ trophies: p.data.economy.trophies, coins: p.data.economy.coins, xp: p.data.xp });
const pay = (trophies, fn) => {
  const p = profileAt(trophies);
  const before = snap(p);
  fn(p);
  const after = snap(p);
  return { dt: after.trophies - before.trophies, dc: after.coins - before.coins, dx: after.xp - before.xp };
};

/** THE SHIPPED JOIN, exactly as `src/ui/screens/matchScreen.ts:onPhase` calls it. */
const shippedPath = (won) => (p) => p.recordResult(won);
/** WHAT THE CURVE EXISTS FOR. */
const curvePath = (place, seats) => (p) => p.recordPlacement(place, seats);

if (IS_MAIN) {
  console.log(`SX_PAY — the join from a real six-fighter placement to the payout`);
  console.log(`src ${SRC}   seats ${MIN_FIGHTERS}..${MAX_FIGHTERS}\n`);

  const STANDINGS = [0, 500, 3000];

  // ── §A ────────────────────────────────────────────────────────────────────
  console.log('§A  WHAT EACH PLACE IS WORTH — the curve vs the path the game actually calls');
  for (const T of STANDINGS) {
    console.log(`\n    at ${T} trophies`);
    for (const seats of [2, 4, 6]) {
      const rows = [];
      for (let place = 0; place < seats; place++) {
        const a = pay(T, curvePath(place, seats));
        const b = pay(T, shippedPath(place === 0));
        rows.push({ place, a, b });
      }
      console.log(`      seats ${seats}`);
      console.log(`        place            ${rows.map((r) => String(r.place + 1).padStart(8)).join('')}`);
      console.log(`        curve  trophies  ${rows.map((r) => String(r.a.dt).padStart(8)).join('')}`);
      console.log(`        SHIPPED trophies ${rows.map((r) => String(r.b.dt).padStart(8)).join('')}`);
      console.log(`        curve  coins     ${rows.map((r) => String(r.a.dc).padStart(8)).join('')}`);
      console.log(`        SHIPPED coins    ${rows.map((r) => String(r.b.dc).padStart(8)).join('')}`);
      console.log(`        curve  xp        ${rows.map((r) => String(r.a.dx).padStart(8)).join('')}`);
      console.log(`        SHIPPED xp       ${rows.map((r) => String(r.b.dx).padStart(8)).join('')}`);
    }
  }

  // ── §C, run BEFORE §B's verdict so a broken comparison cannot produce a headline ──
  console.log('\n§C  THE CONTROL — at two seats the two paths must be IDENTICAL');
  let twoSeatSame = true;
  const diffs2 = [];
  for (const T of STANDINGS) for (const place of [0, 1]) {
    const a = pay(T, curvePath(place, 2));
    const b = pay(T, shippedPath(place === 0));
    if (a.dt !== b.dt || a.dc !== b.dc || a.dx !== b.dx) { twoSeatSame = false; diffs2.push(`T=${T} place=${place} curve=${JSON.stringify(a)} shipped=${JSON.stringify(b)}`); }
  }
  ok('two seats: the shipped join and the curve agree exactly', twoSeatSame, diffs2.join('; '));

  // And the control's own control: at SIX seats they must DISAGREE somewhere, or §A is
  // reporting a difference that does not exist and this whole file is vacuous.
  let sixSeatDiffers = false;
  for (const T of STANDINGS) for (let place = 0; place < 6; place++) {
    const a = pay(T, curvePath(place, 6));
    const b = pay(T, shippedPath(place === 0));
    if (a.dt !== b.dt || a.dc !== b.dc || a.dx !== b.dx) sixSeatDiffers = true;
  }
  ok('six seats: they DISAGREE (so §A is measuring something real)', sixSeatDiffers);

  // ── §B ────────────────────────────────────────────────────────────────────
  console.log('\n§B  PRICED OVER A REAL PLACE DISTRIBUTION');
  if (!CENSUS || !existsSync(CENSUS)) {
    console.log(`    (skipped: pass --census <sx_census --json output>)`);
  } else {
    const c = JSON.parse(readFileSync(CENSUS, 'utf8'));
    const seats = c.n;
    const places = c.rows.map((r) => r.place[0] - 1);   // slot 0 is the LOCAL seat; 0-based
    const hist = Array.from({ length: seats }, (_, p) => places.filter((x) => x === p).length);
    console.log(`    corpus: ${places.length} matches at ${seats} seats (arm ${c.arm})`);
    console.log(`    slot 0 finished   ${hist.map((v, i) => `${i + 1}st:${v}`).join('  ')}`);
    for (const T of STANDINGS) {
      let ct = 0, cc = 0, cx = 0, st = 0, sc = 0, sx = 0;
      for (const place of places) {
        const a = pay(T, curvePath(place, seats));
        const b = pay(T, shippedPath(place === 0));
        ct += a.dt; cc += a.dc; cx += a.dx;
        st += b.dt; sc += b.dc; sx += b.dx;
      }
      const n = places.length;
      console.log(`    at ${String(T).padStart(4)} trophies:  curve ${(ct / n).toFixed(2)} tr / ${(cc / n).toFixed(1)} coins / ${(cx / n).toFixed(1)} xp`
        + `   ·   SHIPPED ${(st / n).toFixed(2)} tr / ${(sc / n).toFixed(1)} coins / ${(sx / n).toFixed(1)} xp`
        + `   ·   ERROR ${((st - ct) / n).toFixed(2)} tr / ${((sc - cc) / n).toFixed(1)} coins / ${((sx - cx) / n).toFixed(1)} xp per match`);
    }
  }

  // ── §D ────────────────────────────────────────────────────────────────────
  console.log('\n§D  CALL-SITE CENSUS — counted from the tree, not remembered');
  const hits = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!p.endsWith('.ts')) continue;
      const text = readFileSync(p, 'utf8');
      for (const [i, line] of text.split('\n').entries()) {
        if (/^\s*[*/]/.test(line)) continue;                         // skip doc comments
        if (/\b(recordPlacement|recordResult|applyMatchPlacement|applyMatchResult)\s*\(/.test(line)) {
          hits.push({ file: p.slice(SRC.length + 1), line: i + 1, text: line.trim() });
        }
      }
    }
  };
  walk(SRC);
  for (const h of hits) console.log(`    ${h.file}:${h.line}  ${h.text}`);
  // ⚠️ THE FIRST VERSION OF THIS ROW PRINTED `ok` WITH A DETAIL DESCRIBING THE FAILURE.
  // It counted `recordPlacement(place: number, seats: number): LastMatch {` — the DECLARATION
  // — as a caller. A declaration is not a call site, and the two are one regex apart. Kept as
  // a comment rather than deleted because it is `AGENT-BRIEF` §4.4 in miniature: the guard was
  // green and its own evidence line said the opposite.
  const DEFINERS = ['ui/screens/profile.ts', 'game/economy/state.ts', 'net/lobby.ts'];
  const callers = hits.filter((h) => !DEFINERS.includes(h.file));
  const seatAware = callers.filter((h) => /recordPlacement\s*\(/.test(h.text));
  console.log(`    → ${callers.length} call site(s) outside the definitions: `
    + `${callers.map((h) => `${h.file}:${h.line}`).join(', ') || 'none'}`);
  ok('a payout call site outside the economy passes a real seat count above two',
    seatAware.length > 0,
    `${callers.length} reachable payout call site(s), ${seatAware.length} seat-aware — every one resolves to`
    + ` ${MIN_FIGHTERS} seats, so the 3–6 seat curve is UNREACHABLE from the shipped game`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
