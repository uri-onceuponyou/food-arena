#!/usr/bin/env node
/**
 * MV_MULTI — the acceptance rig for "a melee swing hits EVERY opponent in its arc".
 *
 * `combat.ts:deliverWeapon` resolved its whole melee branch against a single
 * `nearestLivingOpponent`. **At two seats that is the same sentence** — the nearest
 * opponent is the only opponent — so the defect is unreachable below three fighters and
 * all 621 pre-existing assertions in `src/game/sim.test.mjs` passed throughout. `wm_gate`
 * records it as `multi-target` MISSING on `lollipop.Giant` (`cone: 360`, `giantSlam`,
 * *"hits the whole map, making everyone dizzy"* — it hit one fighter).
 *
 * This file answers the three questions a fix like that has to answer, and it answers each
 * one by MEASUREMENT rather than by reading the diff:
 *
 *   --knownbad   Does the new guard FAIL on the bug it guards against?  It rebuilds the
 *                PRE-FIX sim from the shipped source with one surgical substitution, runs
 *                the REAL `sim.test.mjs` against it, and requires §35's marked rows to go
 *                red. A guard that has not been shown to fail is not a guard.
 *   --bitid      Does anything change at TWO seats?  110 real all-AI matchups stepped
 *                through both sims tick for tick, comparing a full state digest AND the
 *                whole event stream. This is what makes the change safe to land under a
 *                110-cell balance corpus that every published number in the repo rests on.
 *   --census     What does it actually DO at six?  Per melee weapon, the distribution of
 *                victims per swing, on both trees. This is the PRICE, in the units the
 *                change is denominated in.
 *
 * ── 🚨 HOW THE PRE-FIX SIM IS BUILT, AND WHY IT IS NOT A WORKTREE ────────────
 *
 * A detached worktree of the commit before the fix is the honest pre-fix tree and it is
 * what was used while the fix was being developed. It is the WRONG mechanism for a
 * committed rig: the SHA it would have to name goes stale on the next rebase, and a
 * known-bad that silently stops reproducing the bug is the vacuity trap this repo has been
 * bitten by at least seven times. So the pre-fix sim is built by copying `src/` and making
 * ONE substitution in `combat.ts`:
 *
 *     if (!isLivingOpponentOf(victim, attacker)) continue;   ->   if (victim !== target) continue;
 *
 * which reduces the loop to the single `nearestLivingOpponent` the old branch resolved
 * against, leaving the three geometry tests, the damage call and the event byte-identical.
 * ⚠️ **THE SUBSTITUTION IS ASSERTED TO HAVE APPLIED EXACTLY ONCE.** An anchor that stops
 * matching would produce a "pre-fix" tree that is simply the fixed tree, every known-bad
 * row would go green, and the rig would report a passing guard while testing nothing —
 * which is precisely how three of this project's instruments were caught.
 *
 * ── WHAT THIS TOOL DOES NOT MEASURE ──────────────────────────────────────────
 *
 * The six-seat BALANCE price is `tools/tmp/nf_ffa.mjs` (mean placement, resolution floor
 * 0.978 places at N=6), not this. A victim census is a mechanism number; it says a swing
 * now reaches four fighters, not what that is worth. The two are never printed together.
 *
 *   node tools/tmp/mv_multi.mjs --knownbad
 *   node tools/tmp/mv_multi.mjs --bitid
 *   node tools/tmp/mv_multi.mjs --census --matches 24
 *   node tools/tmp/mv_multi.mjs --selftest      # all three, and the rig's own controls
 */

import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

// `docs/AGENT-BRIEF.md` §3: three tools here ran their whole CLI path on import, one of
// which would have killed every snapshot server on the box. Guard the main path.
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

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

// ─────────────────────────────────────────────────────────────────────────────
// THE PRE-FIX TREE
// ─────────────────────────────────────────────────────────────────────────────

/** The one line the fix added, and the one line that reproduces the defect. */
const FIX_ANCHOR = '      if (!isLivingOpponentOf(victim, attacker)) continue;';
const PREFIX_LINE = '      if (victim !== target) continue; // MV_MULTI KNOWN-BAD: the pre-fix single-target branch';

/**
 * Copy `src/` into a temp dir and revert the melee loop to its pre-fix, single-target
 * form. Returns `{ dir, simDir }`; the caller owns the cleanup.
 *
 * The whole of `src/` is copied rather than just `game/`, because `sim.ts` imports
 * `../arena/types.ts` and `../units.ts` by relative path — a `game/`-only copy resolves
 * those against the ORIGINAL tree and would measure a hybrid.
 */
export function buildPreFixTree() {
  const dir = mkdtempSync(join(tmpdir(), 'mv-prefix-'));
  cpSync(join(ROOT, 'src'), join(dir, 'src'), { recursive: true });
  const combatPath = join(dir, 'src/game/combat.ts');
  const before = readFileSync(combatPath, 'utf8');
  const hits = before.split(FIX_ANCHOR).length - 1;
  if (hits !== 1) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(
      `mv_multi: the known-bad anchor matched ${hits} times, expected exactly 1.\n`
      + `  anchor: ${FIX_ANCHOR}\n`
      + '  A pre-fix tree that is not pre-fix would turn every known-bad row green.',
    );
  }
  writeFileSync(combatPath, before.replace(FIX_ANCHOR, PREFIX_LINE));
  return { dir, simDir: join(dir, 'src/game') };
}

const rmTree = (t) => { if (t) rmSync(t.dir, { recursive: true, force: true }); };

// ─────────────────────────────────────────────────────────────────────────────
// --knownbad : run the REAL suite against the pre-fix sim
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The §35 rows that are claims about the FIX and must therefore be red on the pre-fix
 * tree. Rows not named here — (a), (d), (f), (g) — are the non-vacuity, the over-fix
 * control, the scope statement and the two-seat reduction, and they pass on BOTH trees on
 * purpose: a section where those moved too would have changed the experiment.
 */
const MUST_FAIL = [
  '(b) 🔴 a 360-degree slam damages EVERY opponent inside its range',
  '(c) 🔴 victims resolve in SLOT order',
  '(e) 🔴 the slam hits the four survivors and steps over the corpse',
  // Not marked 🔴 in the suite because it reads as an over-fix CONTROL, but it is a claim
  // about the fix too: pre-fix the wedge connects with the nearest fighter only.
  'swing hits BOTH fighters inside its wedge',
];
/** …and these must be GREEN on the pre-fix tree, or the rig broke the fixture, not the sim. */
const MUST_PASS = [
  '(a) the fixture really seats SIX',
  '(d) the directional fixture really does put TWO inside the arc',
  '(g) at TWO seats the same 360-degree slam damages exactly ONE fighter',
];

export function runKnownBad() {
  const tree = buildPreFixTree();
  let out;
  try {
    out = execFileSync(process.execPath, [join(tree.simDir, 'sim.test.mjs')], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    out = String(e.stdout ?? '') + String(e.stderr ?? '');
  } finally {
    rmTree(tree);
  }
  const lines = out.split('\n');
  const verdict = (needle) => {
    const l = lines.find((x) => x.includes(needle));
    if (!l) return 'ABSENT';
    return l.trimStart().startsWith('ok -') ? 'PASS' : 'FAIL';
  };
  return {
    out,
    failed: MUST_FAIL.map((n) => ({ n, v: verdict(n) })),
    passed: MUST_PASS.map((n) => ({ n, v: verdict(n) })),
    summary: lines.find((l) => / passed, \d+ failed$/.test(l)) ?? '(no summary line)',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE TWO-SEAT BIT-IDENTITY ARM
// ─────────────────────────────────────────────────────────────────────────────

const ARENA_PATH = join(ROOT, 'tools/arena.gameplay.json');
const FOG_FIRST_CONTACT_MS = 6000; // arena/shared.ts FOG_FIRST_CONTACT_S

async function loadSim(simDir) {
  const sim = await import(`${simDir}/sim.ts`);
  const rules = await import(`${simDir}/rules.ts`);
  const state = await import(`${simDir}/state.ts`);
  return { ...sim, RULES: rules, STATE: state };
}

function loadArena(MATCH_DURATION_MS) {
  const d = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
  const halfDiag = Math.hypot(d.width / 2, d.height / 2);
  return {
    ...d,
    maxSafeRadius: Math.round(halfDiag / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS)),
    build: () => null,
    update: () => {},
  };
}

/**
 * A full digest of everything the sim owns, walked with `Object.keys` so a field that is
 * added later is compared automatically rather than being silently dropped — the trap
 * `Fighter.cast`'s own doc records (`conceal_lab --bitid` walks state the same way and an
 * accessor or an absent key compares equal).
 */
function digest(state) {
  const f = state.fighters.map((x) => JSON.stringify(x, Object.keys(x).sort()));
  return JSON.stringify({
    e: state.elapsed, p: state.phase, w: state.winner, wi: state.winnerId,
    t: state.timeRemaining, r: state.safeRadius,
    sp: state.splats.length, tr: state.trailMarks.length, pr: state.projectiles.length,
    f,
  });
}

/** Every matchup, both orders, run all-AI so no scripted driver is in the loop. */
function matchupList(CHARACTER_IDS) {
  const out = [];
  for (const a of CHARACTER_IDS) for (const b of CHARACTER_IDS) if (a !== b) out.push([a, b]);
  return out;
}

/**
 * Step one two-seat match through BOTH sims in lockstep and return the first tick at which
 * either the state digest or the event stream diverges, or `null`.
 *
 * ⚠️ Lockstep rather than run-then-compare: a divergence at tick 400 of a 9,000-tick match
 * would otherwise be reported as "the whole match differs", which says nothing about what
 * caused it.
 */
function lockstep(A, B, arena, a, b, maxTicks) {
  const sa = A.createMatch(arena, [
    { characterId: a, spawn: arena.playerSpawn, controller: 'ai' },
    { characterId: b, spawn: arena.enemySpawn, controller: 'ai' },
  ]);
  const sb = B.createMatch(arena, [
    { characterId: a, spawn: arena.playerSpawn, controller: 'ai' },
    { characterId: b, spawn: arena.enemySpawn, controller: 'ai' },
  ]);
  const NIL = [null, null];
  for (let t = 0; t < maxTicks; t++) {
    const ea = A.stepMatch(sa, 16.667, NIL);
    const eb = B.stepMatch(sb, 16.667, NIL);
    if (JSON.stringify(ea) !== JSON.stringify(eb)) return { tick: t, why: 'events' };
    if (digest(sa) !== digest(sb)) return { tick: t, why: 'state' };
    if (sa.phase === 'ended' && sb.phase === 'ended') return null;
  }
  return null;
}

export async function runBitId({ limit = Infinity } = {}) {
  const tree = buildPreFixTree();
  try {
    const A = await loadSim(join(ROOT, 'src/game'));
    const B = await loadSim(tree.simDir);
    const arena = loadArena(A.RULES.MATCH_DURATION_MS);
    const maxTicks = Math.ceil((A.RULES.MATCH_DURATION_MS * 1.6 + 20000) / 16.667);
    const pairs = matchupList(A.RULES.CHARACTER_IDS).slice(0, limit);
    const diverged = [];
    for (const [a, b] of pairs) {
      const d = lockstep(A, B, arena, a, b, maxTicks);
      if (d) diverged.push({ a, b, ...d });
    }
    return { n: pairs.length, diverged };
  } finally {
    rmTree(tree);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// THE SIX-SEAT VICTIM CENSUS
// ─────────────────────────────────────────────────────────────────────────────

function spawnRing(arena, n, phase = 0) {
  const cx = arena.center.x, cy = arena.center.y;
  const r = Math.hypot(arena.playerSpawn.x - cx, arena.playerSpawn.y - cy);
  const a0 = Math.atan2(arena.playerSpawn.y - cy, arena.playerSpawn.x - cx);
  return Array.from({ length: n }, (_, i) => {
    const a = a0 + phase + (i * 2 * Math.PI) / n;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

/**
 * How many DISTINCT fighters each melee swing damaged, over `matches` six-seat all-AI
 * matches. Keyed `char.weapon`.
 *
 * A melee weapon resolves synchronously inside one `stepMatch`, so every victim of one
 * swing arrives in the same returned event array; grouping by `attackerId|weaponKey`
 * within a tick therefore reconstructs the swing exactly. Cooldowns make two swings of the
 * same weapon by the same fighter in one tick impossible, which is what makes the grouping
 * a bijection rather than a heuristic. Ranged weapons are excluded by looking the key up in
 * `CHARACTERS`, never by guessing from the event.
 */
export async function runCensus(simDir, { matches = 24, n = 6 } = {}) {
  const S = await loadSim(simDir);
  const { CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS } = S.RULES;
  const arena = loadArena(MATCH_DURATION_MS);
  const meleeKeys = new Set();
  for (const id of CHARACTER_IDS) {
    for (const w of CHARACTERS[id].weapons) if (w.type === 'melee') meleeKeys.add(`${id}.${w.key}`);
  }
  const hist = new Map(); // 'char.weapon' -> [count of swings with 1 victim, 2, 3, ...]
  const maxTicks = Math.ceil((MATCH_DURATION_MS * 1.6 + 20000) / 16.667);
  const NIL = Array.from({ length: n }, () => null);

  for (let m = 0; m < matches; m++) {
    // A deterministic sweep over the roster: match `m` seats characters
    // m, m+1, … m+n-1 (mod 11). No RNG anywhere — `rules.ts` records that the sim
    // contains zero randomness and that this underwrites every balance number here.
    const ids = Array.from({ length: n }, (_, i) => CHARACTER_IDS[(m + i) % CHARACTER_IDS.length]);
    const spawns = spawnRing(arena, n, (m / matches) * Math.PI * 2);
    const state = S.createMatch(arena, ids.map((characterId, i) => ({
      characterId, spawn: spawns[i], controller: 'ai',
    })));
    for (let t = 0; t < maxTicks && state.phase !== 'ended'; t++) {
      const evs = S.stepMatch(state, 16.667, NIL);
      const bySwing = new Map();
      for (const ev of evs) {
        if (ev.type !== 'hit-landed' || ev.source?.kind !== 'weapon') continue;
        const attacker = state.fighters[ev.source.attackerId];
        const tag = `${attacker.characterId}.${ev.source.weaponKey}`;
        if (!meleeKeys.has(tag)) continue;
        const k = `${ev.source.attackerId}|${ev.source.weaponKey}`;
        if (!bySwing.has(k)) bySwing.set(k, { tag, victims: new Set() });
        bySwing.get(k).victims.add(ev.targetId);
      }
      for (const { tag, victims } of bySwing.values()) {
        if (!hist.has(tag)) hist.set(tag, []);
        const h = hist.get(tag);
        const v = victims.size;
        h[v] = (h[v] ?? 0) + 1;
      }
    }
  }
  const rows = [...hist.entries()].map(([tag, h]) => {
    const swings = h.reduce((a, x) => a + (x ?? 0), 0);
    const victims = h.reduce((a, x, i) => a + (x ?? 0) * i, 0);
    const multi = h.reduce((a, x, i) => a + (i >= 2 ? (x ?? 0) : 0), 0);
    return { tag, swings, victims, multi, max: h.length - 1, mean: swings ? victims / swings : 0, h };
  }).sort((a, b) => b.multi - a.multi || a.tag.localeCompare(b.tag));
  return { rows, matches, n };
}

// ─────────────────────────────────────────────────────────────────────────────
if (IS_MAIN) {
  const want = (k) => args[k] === true || args.selftest === true;
  let bad = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`);
    else { bad++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };

  console.log('══ MV_MULTI ══  a melee swing hits every opponent in its arc');

  if (args.selftest) {
    // ── THE RIG'S OWN CONTROLS ────────────────────────────────────────────────
    // The known-bad tree is the whole instrument. If it is not actually pre-fix, every
    // row below is decoration — so the substitution is proved from BOTH ends before it is
    // used: it must apply exactly once, and it must be absent from the tree afterwards.
    console.log('\n── CONTROLS on the known-bad tree ──');
    const tree = buildPreFixTree();
    const patched = readFileSync(join(tree.simDir, 'combat.ts'), 'utf8');
    const shipped = readFileSync(join(ROOT, 'src/game/combat.ts'), 'utf8');
    ok('the SHIPPED tree carries the fix anchor exactly once (else the rig is aimed at nothing)',
      shipped.split(FIX_ANCHOR).length - 1 === 1);
    ok('the KNOWN-BAD tree does NOT carry it, and does carry the pre-fix line',
      !patched.includes(FIX_ANCHOR) && patched.includes(PREFIX_LINE));
    ok('…and nothing else in the melee branch moved — one line differs, and only one',
      shipped.split('\n').filter((l, i) => l !== patched.split('\n')[i]).length === 1);
    rmTree(tree);
  }

  if (want('knownbad')) {
    console.log('\n── KNOWN-BAD: the real sim.test.mjs, run against the PRE-FIX sim ──');
    const r = runKnownBad();
    console.log(`   pre-fix suite: ${r.summary.trim()}`);
    for (const { n, v } of r.failed) ok(`RED on the pre-fix tree: ${n}…`, v === 'FAIL', `(${v})`);
    for (const { n, v } of r.passed) ok(`green on BOTH trees:      ${n}…`, v === 'PASS', `(${v})`);
  }

  if (want('bitid')) {
    console.log('\n── BIT-IDENTITY at TWO seats: 110 all-AI matchups, lockstep, state AND events ──');
    const r = await runBitId({ limit: args.limit ? Number(args.limit) : Infinity });
    ok('the corpus is NON-EMPTY (a zero-matchup run would pass vacuously)', r.n >= 110, `${r.n} matchups`);
    ok('no matchup diverges in state or in the event stream',
      r.diverged.length === 0,
      r.diverged.slice(0, 3).map((d) => `${d.a}>${d.b} tick ${d.tick} (${d.why})`).join(' · '));
  }

  if (want('census')) {
    const matches = Number(args.matches ?? 24);
    console.log(`\n── SIX-SEAT VICTIM CENSUS: ${matches} all-AI matches, N=6 ──`);
    const after = await runCensus(join(ROOT, 'src/game'), { matches });
    const tree = buildPreFixTree();
    let before;
    try { before = await runCensus(tree.simDir, { matches }); } finally { rmTree(tree); }
    const beforeBy = new Map(before.rows.map((r) => [r.tag, r]));
    console.log('   weapon                swings   victims/swing        multi-victim swings');
    console.log('                                  before -> after      before -> after   max');
    for (const r of after.rows) {
      const b = beforeBy.get(r.tag) ?? { mean: 0, multi: 0, swings: 0, max: 0 };
      console.log(
        `   ${r.tag.padEnd(20)} ${String(r.swings).padStart(5)}   `
        + `${b.mean.toFixed(3)} -> ${r.mean.toFixed(3)}     `
        + `${String(b.multi).padStart(5)} -> ${String(r.multi).padStart(5)}   ${r.max}`,
      );
    }
    ok('the census is NON-EMPTY — melee swings really happened in these matches',
      after.rows.length > 0 && after.rows.some((r) => r.swings > 0),
      `${after.rows.length} weapons, ${after.rows.reduce((a, r) => a + r.swings, 0)} swings`);
    ok('the PRE-FIX tree reports exactly ONE victim per swing, everywhere (the control)',
      before.rows.every((r) => r.max <= 1),
      before.rows.filter((r) => r.max > 1).map((r) => r.tag).join(' '));
    ok('…and the SHIPPED tree reports more than one somewhere (else the fix changed nothing at six)',
      after.rows.some((r) => r.max >= 2),
      after.rows.filter((r) => r.max >= 2).map((r) => `${r.tag}:${r.max}`).join(' '));
  }

  if (!args.knownbad && !args.bitid && !args.census && !args.selftest) {
    console.log('\n   usage: --knownbad | --bitid [--limit N] | --census [--matches N] | --selftest');
  }
  if (bad > 0) { console.log(`\n   ${bad} FAULT(S)`); process.exit(1); }
  console.log('\n   OK');
}
