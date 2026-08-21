#!/usr/bin/env node
/**
 * BB_BLOCK — the acceptance rig for "a projectile hits whoever it strikes".
 *
 * `sim.ts:stepProjectiles` resolved every projectile against `state.fighters[p.targetId]`
 * and flew through everybody else. **At two seats that is the same sentence** — the only
 * living opponent IS the target — so the defect is unreachable below three fighters and
 * all 638 pre-existing assertions in `src/game/sim.test.mjs` passed throughout, including
 * §35(f), which asserted the gap *by reading `rules.ts` fields* and could never have gone
 * red. `MAX_FIGHTERS` is 6 and Uri plays six-player.
 *
 * This is the ranged half of `3483d23` (`tools/tmp/mv_multi.mjs`), whose own commit
 * message named it as the remaining half, and it answers the same three questions the
 * same way — by measurement, not by reading the diff:
 *
 *   --knownbad   Does the new guard FAIL on the bug it guards against?  Rebuilds the
 *                PRE-FIX sim from the shipped source with ONE asserted substitution, runs
 *                the REAL `sim.test.mjs` against it, and requires §36's marked rows to go
 *                red while its controls stay green.
 *   --bitid      Does anything change at TWO seats?  110 real all-AI matchups stepped
 *                through both sims tick for tick, comparing a full `Object.keys` state
 *                digest AND the whole event stream. This is what makes the change safe to
 *                land under the 110-cell corpus every published balance number rests on.
 *   --census     What does it actually DO at six?  Per ranged weapon, how many shots hit
 *                somebody OTHER than the fighter they were aimed at, on both trees. That
 *                is the mechanism number — the PRICE in placement is `nf_ffa`, and the two
 *                are never printed together.
 *
 * ── 🚨 HOW THE PRE-FIX SIM IS BUILT, AND WHY IT IS NOT A WORKTREE ────────────
 *
 * A detached worktree of the commit before the fix is the honest pre-fix tree and is what
 * was used while the fix was developed. It is the WRONG mechanism for a committed rig: the
 * SHA it would have to name goes stale on the next rebase, and a known-bad that silently
 * stops reproducing the bug is the vacuity trap this repo has been bitten by repeatedly.
 * So the pre-fix sim is built by copying `src/` and making ONE substitution in `sim.ts`:
 *
 *     if (!isLivingOpponentOf(f, owner)) continue;
 *  -> if (f !== state.fighters[p.targetId]) continue;
 *
 * which reduces the victim scan to the single slot the old hit test read, leaving the
 * distance comparison, the `hitRadius` it is compared against, the damage call and the
 * event byte-identical. (The retarget branch below it becomes unreachable by construction,
 * exactly as it is at two seats.)
 * ⚠️ **THE SUBSTITUTION IS ASSERTED TO HAVE APPLIED EXACTLY ONCE.** An anchor that stopped
 * matching would produce a "pre-fix" tree that is simply the fixed tree; every known-bad
 * row would go green and the rig would report a passing guard while testing nothing.
 *
 *   node tools/tmp/bb_block.mjs --knownbad
 *   node tools/tmp/bb_block.mjs --bitid
 *   node tools/tmp/bb_block.mjs --census --matches 24
 *   node tools/tmp/bb_block.mjs --selftest      # all three, and the rig's own controls
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

/**
 * The one line the fix added, and the one line that reproduces the defect.
 *
 * ⚠️ **THE `hp > 0` CLAUSE IS LOAD-BEARING AND WAS MISSING FROM THE FIRST DRAFT OF THIS
 * SUBSTITUTION — the `--bitid` arm caught it, which is the arm working.** The shipped
 * pre-fix line was `if (target.hp > 0 && Math.hypot(…) < hitRadius)`, so a substitution
 * that only narrowed the scan to `p.targetId` built a sim that shot CORPSES — more
 * permissive than the code it claims to reproduce. It diverged from the real sim at two
 * seats (hamburger vs donut, tick 1455, events), which would have been read as the FIX
 * breaking N=2 bit-identity rather than as the rig being wrong. A known-bad has to be the
 * bug, not a different bug.
 */
const FIX_ANCHOR = '    if (!isLivingOpponentOf(f, owner)) continue;';
const PREFIX_LINE = '    if (f !== state.fighters[p.targetId] || f.hp <= 0) continue; // BB_BLOCK KNOWN-BAD: the pre-fix single-target resolution';

/**
 * Copy `src/` into a temp dir and revert the projectile victim scan to its pre-fix,
 * single-target form. Returns `{ dir, simDir }`; the caller owns the cleanup.
 *
 * The whole of `src/` is copied rather than just `game/`, because `sim.ts` imports
 * `../arena/types.ts` and `../units.ts` by relative path — a `game/`-only copy resolves
 * those against the ORIGINAL tree and would measure a hybrid.
 */
export function buildPreFixTree() {
  const dir = mkdtempSync(join(tmpdir(), 'bb-prefix-'));
  cpSync(join(ROOT, 'src'), join(dir, 'src'), { recursive: true });
  const simPath = join(dir, 'src/game/sim.ts');
  const before = readFileSync(simPath, 'utf8');
  const hits = before.split(FIX_ANCHOR).length - 1;
  if (hits !== 1) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(
      `bb_block: the known-bad anchor matched ${hits} times, expected exactly 1.\n`
      + `  anchor: ${FIX_ANCHOR}\n`
      + '  A pre-fix tree that is not pre-fix would turn every known-bad row green.',
    );
  }
  const after = before.replace(FIX_ANCHOR, PREFIX_LINE);
  if (after === before) throw new Error('bb_block: the substitution changed nothing');
  writeFileSync(simPath, after);
  return { dir, simDir: join(dir, 'src/game') };
}

const rmTree = (t) => { if (t) rmSync(t.dir, { recursive: true, force: true }); };

// ─────────────────────────────────────────────────────────────────────────────
// --knownbad : run the REAL suite against the pre-fix sim
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The §35/§36 rows that are claims about the FIX and must therefore be red on the pre-fix
 * tree. Rows not named here — every non-vacuity row, (d), (f2), (g) — are the fixture
 * checks, the over-fix control, the owner exclusion and the two-seat reduction, and they
 * pass on BOTH trees on purpose: a section where those moved too would have changed the
 * experiment rather than the sim.
 */
const MUST_FAIL = [
  '(f) 🔴 …and a body that steps into the line TAKES the volley',   // §35, the REVERSED row
  '(b) 🔴 a body that steps into the line TAKES the shot',
  '(c) 🔴 a shot fired past its target strikes the bystander',
  '(e) 🔴 the corpse is passed THROUGH and the identical living body BLOCKS',
  '(f) 🔴 exactly ONE fighter is damaged, and it is the NEARER one',
  '(h) 🔴 every peck lands on the body it struck',
];
/** …and these must be GREEN on the pre-fix tree, or the rig broke the fixture, not the sim. */
const MUST_PASS = [
  '(a) the press really spawned a projectile, and it is aimed at slot 1',
  '(d) a body 1.5x its hit radius off the line is MISSED',
  '(f2) …and it damages nobody — a projectile does not strike the fighter that fired it',
  '(g) at TWO seats the shot damages exactly ONE fighter',
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
 * A full digest of everything the sim owns, walked with `Object.keys` so a field added
 * later is compared automatically rather than being silently dropped.
 *
 * ⚠️ THE PROJECTILES ARE WALKED FIELD BY FIELD HERE, NOT COUNTED. `mv_multi`'s digest
 * carries `state.projectiles.length` only, which is right for a MELEE change and blind to
 * this one: `p.targetId` is a projectile field this fix can now write mid-flight, and a
 * digest that counted projectiles would compare equal across exactly the divergence being
 * looked for. `weapon` is dropped because it is a module-level singleton object shared by
 * both sims and `JSON.stringify` would walk the whole weapon table per projectile per tick.
 */
function digest(state) {
  const f = state.fighters.map((x) => JSON.stringify(x, Object.keys(x).sort()));
  const pr = state.projectiles.map((p) => {
    const keys = Object.keys(p).filter((k) => k !== 'weapon').sort();
    return `${p.weapon?.key ?? '?'}|${JSON.stringify(p, keys)}`;
  });
  return JSON.stringify({
    e: state.elapsed, p: state.phase, w: state.winner, wi: state.winnerId,
    t: state.timeRemaining, r: state.safeRadius,
    sp: state.splats.length, tr: state.trailMarks.length,
    pr, f,
  });
}

/** Every matchup, both orders, run all-AI so no scripted driver is in the loop. */
function matchupList(CHARACTER_IDS) {
  const out = [];
  for (const a of CHARACTER_IDS) for (const b of CHARACTER_IDS) if (a !== b) out.push([a, b]);
  return out;
}

function lockstep(A, B, arena, a, b, maxTicks) {
  const seat = (S) => S.createMatch(arena, [
    { characterId: a, spawn: arena.playerSpawn, controller: 'ai' },
    { characterId: b, spawn: arena.enemySpawn, controller: 'ai' },
  ]);
  const sa = seat(A);
  const sb = seat(B);
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
// THE SIX-SEAT CENSUS: how often does a shot hit somebody it was not aimed at?
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
 * Over `matches` six-seat all-AI matches: for every ranged hit, was the victim the fighter
 * the shot was AIMED at, or a body it flew into?
 *
 * ⚠️ **THE ATTRIBUTION IS THE WHOLE OF THIS TOOL AND THE FIRST TWO VERSIONS WERE WRONG IN
 * THE SAME DIRECTION — TOWARDS AGREEING WITH THEMSELVES.**
 *
 *   1. Reading `p.targetId` at the hit says *"aimed at its victim"* for every shot in the
 *      game, because `sim.ts` RETARGETS on the strike so `peckHits` latches. Zero strays,
 *      forever, by construction.
 *   2. Accumulating every aim an owner ever had over the whole match is barely better: after
 *      a few seconds every fighter is in that owner's set, so "stray" degenerates into
 *      "victim this shooter never once aimed at", which almost nothing is.
 *
 * What is asked instead is a ONE-TICK question with a one-tick answer: **at the START of
 * the tick, was this victim the aim of any live projectile this attacker owns?**
 * `state.projectiles` is snapshotted before the step and the classification uses only that
 * snapshot. `hit-landed` carries no projectile id, which is why the question is posed per
 * (attacker, victim) rather than per projectile.
 *
 * ⚠️ A shot that SPAWNS AND STRIKES INSIDE ONE TICK has no pre-step snapshot to appear in
 * and would be misread as a stray. Those are counted separately as `sameTick` and printed,
 * rather than folded into either column — a residual you can see is worth more than a
 * cleverer rule you cannot check.
 *
 * ⚠️ **AND THE PRE-FIX COLUMN IS NOT EVIDENCE THAT THIS RIG WORKS.** Pre-fix, `stray` is 0
 * BY CONSTRUCTION — a projectile can only hit its own target — so a completely blind census
 * would print the identical column. `censusControl()` is the arm that makes the shipped
 * column mean anything: it drives the §36(b) geometry, where the answer is known to be one
 * stray, through this exact classifier.
 */
export async function runCensus(simDir, { matches = 24, n = 6 } = {}) {
  const S = await loadSim(simDir);
  const { CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS } = S.RULES;
  const arena = loadArena(MATCH_DURATION_MS);
  const rangedKeys = new Set();
  for (const id of CHARACTER_IDS) {
    for (const w of CHARACTERS[id].weapons) if (w.type === 'ranged') rangedKeys.add(`${id}.${w.key}`);
  }
  const maxTicks = Math.ceil((MATCH_DURATION_MS * 1.6 + 20000) / 16.667);
  const rows = new Map(); // 'char.weapon' -> { aimed, stray, sameTick }
  const NIL = Array.from({ length: n }, () => null);
  for (let m = 0; m < matches; m++) {
    const spawns = spawnRing(arena, n, (m % 6) * 0.19);
    const roster = Array.from({ length: n }, (_, i) => ({
      characterId: CHARACTER_IDS[(m * n + i) % CHARACTER_IDS.length],
      spawn: spawns[i],
      controller: 'ai',
    }));
    const st = S.createMatch(arena, roster);
    for (let t = 0; t < maxTicks && st.phase !== 'ended'; t++) {
      const liveAims = new Map(); // ownerId -> Set(targetId), AS OF THE START OF THIS TICK
      for (const p of st.projectiles) {
        if (!liveAims.has(p.ownerId)) liveAims.set(p.ownerId, new Set());
        liveAims.get(p.ownerId).add(p.targetId);
      }
      for (const e of S.stepMatch(st, 16.667, NIL)) {
        if (e.type !== 'hit-landed' || e.source?.kind !== 'weapon') continue;
        const key = `${st.fighters[e.source.attackerId]?.characterId}.${e.source.weaponKey}`;
        if (!rangedKeys.has(key)) continue;
        const row = rows.get(key) ?? { aimed: 0, stray: 0, sameTick: 0 };
        const aims = liveAims.get(e.source.attackerId);
        if (aims === undefined) row.sameTick++;
        else if (aims.has(e.targetId)) row.aimed++;
        else row.stray++;
        rows.set(key, row);
      }
    }
  }
  return [...rows.entries()]
    .map(([k, v]) => ({ key: k, ...v, total: v.aimed + v.stray + v.sameTick }))
    .sort((a, b) => b.stray - a.stray || a.key.localeCompare(b.key));
}

/**
 * POSITIVE CONTROL — the census must be ABLE to report a stray.
 *
 * Six seats, one Mustard shot aimed at slot 1, a body stepping into the line after the
 * press: `sim.test.mjs` §36(b)'s geometry, where the right answer is known independently.
 * Run through the SAME classifier as the census. On the shipped sim it must read one
 * stray and no aimed hit; on the pre-fix sim it must read nothing at all, because there
 * the shot flies through. Without this arm a `0` in the census column is indistinguishable
 * from a rig that cannot see a stray.
 */
export async function censusControl(simDir) {
  const S = await loadSim(simDir);
  const { CHARACTERS } = S.RULES;
  const idx = CHARACTERS.hotdog.weapons.findIndex((w) => w.key === 'Mustard');
  const W = CHARACTERS.hotdog.weapons[idx];
  const ARENA = {
    id: 'bb_ctl', displayName: 'bb_ctl', width: 8000, height: 8000,
    center: { x: 4000, y: 4000 }, maxSafeRadius: 1e6,
    playerSpawn: { x: 3000, y: 4000 }, enemySpawn: { x: 5000, y: 4000 },
    cover: [], hazards: [], build: () => null, update: () => {},
  };
  const C = ARENA.center;
  const st = S.createMatch(ARENA, [
    { characterId: 'hotdog', spawn: { x: C.x, y: C.y }, controller: 'human' },
    { characterId: 'hamburger', spawn: { x: C.x + W.range * 0.85, y: C.y }, controller: 'human' },
    { characterId: 'hamburger', spawn: { x: C.x - W.range * 4, y: C.y }, controller: 'human' },
    ...Array.from({ length: 3 }, (_, i) => ({
      characterId: 'hamburger', spawn: { x: C.x - W.range * (6 + i), y: C.y + W.range * (2 + i) }, controller: 'human',
    })),
  ]);
  st.phase = 'playing';
  for (const f of st.fighters) { f.hp = 1e7; f.maxHp = 1e7; }
  st.fighters[0].facing = { x: 1, y: 0 };
  const IDLE = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  const idle = st.fighters.map(() => IDLE);
  const press = idle.slice();
  press[0] = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, selectedWeapon: idx, attack: true };
  S.stepMatch(st, 16.667, press);
  const spawned = st.projectiles.length;
  const aimedAt = st.projectiles.map((p) => p.targetId).join(',');
  st.fighters[2].x = C.x + W.range * 0.35;
  st.fighters[2].y = C.y;
  let aimed = 0, stray = 0, sameTick = 0;
  for (let t = 0; t < 300 && st.projectiles.length > 0; t++) {
    const liveAims = new Map();
    for (const p of st.projectiles) {
      if (!liveAims.has(p.ownerId)) liveAims.set(p.ownerId, new Set());
      liveAims.get(p.ownerId).add(p.targetId);
    }
    for (const e of S.stepMatch(st, 16.667, idle)) {
      if (e.type !== 'hit-landed' || e.source?.kind !== 'weapon') continue;
      const aims = liveAims.get(e.source.attackerId);
      if (aims === undefined) sameTick++;
      else if (aims.has(e.targetId)) aimed++;
      else stray++;
    }
  }
  return { spawned, aimedAt, aimed, stray, sameTick };
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const wantAll = args.selftest === true;
  if (args.knownbad || wantAll) {
    const r = runKnownBad();
    console.log('── KNOWN-BAD: the REAL suite against the PRE-FIX sim ──');
    console.log(`   ${r.summary}`);
    for (const { n, v } of r.failed) console.log(`   ${v === 'FAIL' ? 'ok  ' : 'BAD '} must FAIL: ${v.padEnd(6)} ${n}`);
    for (const { n, v } of r.passed) console.log(`   ${v === 'PASS' ? 'ok  ' : 'BAD '} must PASS: ${v.padEnd(6)} ${n}`);
    const bad = r.failed.filter((x) => x.v !== 'FAIL').length + r.passed.filter((x) => x.v !== 'PASS').length;
    console.log(`   => ${bad === 0 ? 'GUARD VALIDATED' : `${bad} ROW(S) WRONG — the guard is not a guard`}`);
    if (bad !== 0) process.exitCode = 1;
  }
  if (args.bitid || wantAll) {
    const r = await runBitId({ limit: args.limit ? Number(args.limit) : Infinity });
    console.log('── BIT-IDENTITY at TWO seats, shipped vs pre-fix ──');
    console.log(`   ${r.n} matchups, ${r.diverged.length} diverged`);
    for (const d of r.diverged.slice(0, 10)) console.log(`   ${d.a} vs ${d.b}: tick ${d.tick} (${d.why})`);
    if (r.diverged.length !== 0) process.exitCode = 1;
  }
  if (args.census || wantAll) {
    const matches = args.matches ? Number(args.matches) : 18;
    const tree = buildPreFixTree();
    let after, before;
    try {
      after = await runCensus(join(ROOT, 'src/game'), { matches });
      before = await runCensus(tree.simDir, { matches });
    } finally { rmTree(tree); }
    const beforeBy = new Map(before.map((r) => [r.key, r]));
    console.log(`── SIX-SEAT CENSUS, ${matches} matches: hits on a body the shot was NOT aimed at ──`);
    console.log('   weapon                 shipped aimed/stray/same    pre-fix aimed/stray/same');
    let sAfter = 0, sBefore = 0, tAfter = 0, kAfter = 0, kBefore = 0;
    for (const r of after) {
      const b = beforeBy.get(r.key) ?? { aimed: 0, stray: 0, sameTick: 0 };
      sAfter += r.stray; sBefore += b.stray; tAfter += r.total; kAfter += r.sameTick; kBefore += b.sameTick;
      console.log(`   ${r.key.padEnd(22)} ${String(r.aimed).padStart(6)}/${String(r.stray).padStart(4)}/${String(r.sameTick).padEnd(4)}   `
        + `${String(b.aimed).padStart(6)}/${String(b.stray).padStart(4)}/${String(b.sameTick).padEnd(4)}`);
    }
    console.log(`   TOTAL: shipped ${sAfter} stray of ${tAfter} ranged hits (${(100 * sAfter / (tAfter || 1)).toFixed(2)}%) `
      + `· pre-fix ${sBefore} stray (0 BY CONSTRUCTION — not evidence)`);
    // ⚠️ THE SAME-TICK BUCKET IS WHERE A STRAY COULD HIDE, SO ITS TWO TOTALS ARE PRINTED
    // SIDE BY SIDE. A hit in a projectile's own spawn tick means the victim was inside
    // `hitRadius` of the muzzle, which bots reach constantly; those hits carry no pre-step
    // snapshot to classify against. If the two trees produce the same COUNT there, the
    // bucket is hiding no divergence — which is a weaker statement than classifying them,
    // and is said as such rather than dressed up.
    console.log(`   unattributable same-tick (victim inside hitRadius of the muzzle): shipped ${kAfter}, pre-fix ${kBefore}`);
    // 🚨 THE ARM THAT MAKES THE COLUMN ABOVE MEAN ANYTHING. A blind rig prints the same
    // zeros. `CLAUDE.md` #6: an instrument not shown able to produce the answer it is
    // looking for has not been validated.
    const cShip = await censusControl(join(ROOT, 'src/game'));
    const treeC = buildPreFixTree();
    let cPre;
    try { cPre = await censusControl(treeC.simDir); } finally { rmTree(treeC); }
    // ⚠️ THE PRE-FIX ARM IS `aimed=1`, NOT `0`, AND WRITING `0` HERE FIRST IS WHY THIS
    // COMMENT EXISTS. Pre-fix the shot flies THROUGH the blocker and lands on the fighter
    // it was aimed at — one hit, correctly classified as aimed. Requiring 0 would have
    // demanded the control produce NO hit on a tree where a hit is the right answer, i.e.
    // it would have failed for being right. Both arms must be non-empty and must differ in
    // exactly the classified column; that is the whole content of the control.
    const ok = cShip.spawned === 1 && cShip.sameTick === 0 && cPre.sameTick === 0
      && cShip.stray === 1 && cShip.aimed === 0
      && cPre.stray === 0 && cPre.aimed === 1;
    console.log(`   CONTROL (§36(b) geometry, answer known): shipped aimed=${cShip.aimed} stray=${cShip.stray} same=${cShip.sameTick} `
      + `(spawned ${cShip.spawned}, aimed at [${cShip.aimedAt}]) · pre-fix aimed=${cPre.aimed} stray=${cPre.stray} `
      + `=> ${ok ? 'the census CAN see a stray, and the two trees differ in exactly that column' : 'CENSUS BLIND — the column above is meaningless'}`);
    if (!ok) process.exitCode = 1;
  }
}

if (IS_MAIN) await main();
