#!/usr/bin/env node
/**
 * TUN_BITID — is the sim BYTE-IDENTICAL with the override layer installed and nothing set?
 *
 * `DECISIONS-FOR-URI.md` §76. The override layer touched ~90 literals in `rules.ts` and
 * `economy/tuning.ts`. The claim that has to be true before any of it can land is:
 *
 *   > **With no override set, `tune('K', v, spec)` returns `v` and nothing else happens.**
 *
 * That claim is trivially plausible and this repo's record on trivially plausible claims is
 * poor, so it is measured over the whole 110-matchup corpus in lockstep against a DETACHED
 * WORKTREE of the pre-change commit — a tree that contains no `src/game/tuning/` at all.
 *
 *   git worktree add --detach /tmp/fa-tun-head <sha>
 *   ln -s "$PWD/node_modules" /tmp/fa-tun-head/node_modules
 *   ln -s "$PWD/reference"    /tmp/fa-tun-head/reference
 *
 *   node tools/tmp/tun_bitid.mjs --selftest
 *   node tools/tmp/tun_bitid.mjs --ref /tmp/fa-tun-head/src/game --seeds 4
 *   node tools/tmp/tun_bitid.mjs --ref /tmp/fa-tun-head/src/game --seeds 4 --expect diverge \
 *     # with FA_TUNING set — see THE POSITIVE ARM below
 *
 * ── 🚨 WHY THIS IS A FORK OF `csx_bitid` AND NOT A RUN OF IT ───────────────
 *
 * `csx_bitid` partitions on "does this matchup contain a cast weapon" and REQUIRES the cast
 * arm to diverge. Under this change **nothing diverges**, so that tool would report `FAIL —
 * the feature never fired` on a perfect result. The serialisation, the lockstep driver and the
 * `fighterOf`/`stateOf` shape are inherited verbatim, because they are validated and because
 * a second differ blind to a field the first one names is exactly the vacuity this repo keeps
 * catching (`state.ts:591`; `csx_bitid`'s own header on `cast`).
 *
 * ── 🚨 THE POSITIVE ARM IS NOT OPTIONAL ───────────────────────────────────
 *
 * `docs/AGENT-BRIEF.md` §3 records the most dangerous null available here: an A/B that reads
 * the same tree for both arms returns byte-identical numbers on every column, **which reads
 * exactly like "the change did nothing"**. An override layer that silently ignored every
 * override would produce a PERFECT null arm. So the run has two arms and they are checked in
 * OPPOSITE directions:
 *
 *   · `--expect same`     (default, no `FA_TUNING`)  — every matchup bit-identical
 *   · `--expect diverge`  (with a real `FA_TUNING`)  — the corpus must MOVE
 *
 * `--both` runs the pair as child processes and reports one verdict, because two commands
 * whose second one is easy to forget is how a null arm gets quoted on its own.
 *
 * ⚠️ The tuned arm's set must reach the SIM rather than merely the hash. `PLAYER_SPEED` is
 * read by `movement.ts` on every tick of every match, so it moves the whole corpus; a set of
 * one per-weapon cooldown would move only the matchups containing that weapon and would make
 * "how many diverged" uninterpretable.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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
const REF_DIR = String(args.ref ?? SIM_DIR);
const EXPECT = String(args.expect ?? 'same');
const SEEDS = Number(args.seeds ?? 4);
const DT = Number(args.dt ?? 16.667);
const POLICY = String(args.policy ?? 'smart2');

// ─────────────────────────────────────────────────────────────────────────────
// --both — the pair, so the null arm cannot be quoted alone
// ─────────────────────────────────────────────────────────────────────────────
if (import.meta.main && args.both) {
  const base = ['--ref', REF_DIR, '--seeds', String(SEEDS), '--policy', POLICY];
  const tuned = String(args.set ?? '{"PLAYER_SPEED":0.09}');
  const run = (extra, env) => {
    try {
      execFileSync(process.execPath, [new URL(import.meta.url).pathname, ...base, ...extra], {
        cwd: ROOT, env: { ...process.env, ...env }, stdio: 'inherit',
      });
      return true;
    } catch { return false; }
  };
  console.log('\n═══ ARM 1/2 — NULL: overrides OFF, must be BIT-IDENTICAL ═══');
  const a = run(['--expect', 'same'], { FA_TUNING: 'off' });
  console.log(`\n═══ ARM 2/2 — POSITIVE CONTROL: ${tuned}, must DIVERGE ═══`);
  const b = run(['--expect', 'diverge'], { FA_TUNING: tuned });
  console.log(`\n>> ${a && b
    ? 'PASS — the layer is inert when unset AND live when set. Neither half means anything alone.'
    : `FAIL — null arm ${a ? 'ok' : 'RED'}, positive control ${b ? 'ok' : 'RED'}.`}\n`);
  process.exit(a && b ? 0 : 1);
}

if (!existsSync(`${REF_DIR}/sim.ts`)) {
  console.error(`tun_bitid: no sim.ts at ${REF_DIR} — build the worktree first (see the header).`);
  process.exit(2);
}

const A = { ...(await import(`${REF_DIR}/sim.ts`)), RULES: await import(`${REF_DIR}/rules.ts`) };
const B = { ...(await import(`${SIM_DIR}/sim.ts`)), RULES: await import(`${SIM_DIR}/rules.ts`) };

const { CHARACTERS, CHARACTER_IDS, REACH, MATCH_DURATION_MS } = B.RULES;

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
const ARENA_DATA = existsSync(ARENA_PATH) ? JSON.parse(readFileSync(ARENA_PATH, 'utf8')) : null;
if (!ARENA_DATA) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
// The opening ring comes from the SHIPPED derivation, never a copied formula — `cst_interrupt`
// records what the copied one cost (1792 instead of 1720.47, and 47 live copies still in tree).
const openingRadius = B.RULES.fogOpeningRadiusFor(Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2));
const arena = { ...ARENA_DATA, maxSafeRadius: openingRadius, build: () => null, update: () => {} };

const DRIVER_FLAGS = parseDriverFlags(args);
const driver = createScriptedPlayer({ CHARACTERS, REACH, arena, ...DRIVER_FLAGS });

// ─────────────────────────────────────────────────────────────────────────────
// The comparison — `fighterOf`/`projOf`/`stateOf` are `csx_bitid`'s, field for field.
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️ Listed explicitly rather than `JSON.stringify(s)`: `DECISIONS §52` records that
// `MatchState` does not survive a JSON round trip — `-Infinity` sentinels flatten to `null`,
// so several fields would compare EQUAL between an arm that had them and one that did not.
// ⚠️ And `cast == null ? 'idle' : …` collapses "no such field" and "the field is null" to one
// token, because they are the same state of the world. `csx_bitid` measured what happens
// otherwise: 720 of 720 null-arm matches "diverged" on tick 1 with an EMPTY event set — the
// differ reporting the EXISTENCE of a field rather than any behaviour of it.

const fighterOf = (f) => [
  f.id, f.hp, f.maxHp, f.x, f.y, f.facing.x, f.facing.y, f.deaths, f.alive,
  f.trailDropTimer, f.lastDamagedAt, f.regenTimer, f.fogTimer,
  String(f.status.slowedUntil), String(f.status.stunnedUntil),
  f.lastUsed.join(','), f.concealed, f.revealedUntil, f.terrainSlowFactor,
  // eslint-disable-next-line eqeqeq -- `== null` is deliberate: it covers `undefined` too.
  f.cast == null ? 'idle' : `${f.cast.weaponIndex}@${f.cast.startedAt}->${f.cast.resolvesAt}`,
].join('|');

const projOf = (p) => [
  p.id, p.ownerId, p.targetId, p.weapon.key, p.x, p.y, p.vx, p.vy, p.traveled, p.damage,
  p.arrived, p.peckTimer, p.hitsSoFar,
].join('|');

const stateOf = (s) => [
  s.phase, s.elapsed, s.timeRemaining, s.safeRadius, s.winnerId ?? 'none', s.nextId,
  s.fighters.map(fighterOf).join(';'),
  s.projectiles.map(projOf).join(';'),
  s.trailMarks.map((m) => `${m.id},${m.ownerId},${m.x},${m.y},${m.expiresAt},${m.damagedMask}`).join(';'),
  s.splats.map((sp) => `${sp.id},${sp.x},${sp.y},${sp.expiresAt}`).join(';'),
].join('\n');

const eventsOf = (evs) => evs.map((e) => JSON.stringify(e)).join('\n');

/**
 * One matchup, both arms, in lockstep.
 *
 * ⚠️ ONE input object, built from the BASELINE arm, is fed to both — so the arms cannot
 * diverge through the driver even in principle, and a divergence is always the sim's.
 */
function lockstep(playerId, enemyId, seed) {
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + POLICY.length);
  const decide = driver.POLICY_FNS[POLICY](rnd);
  const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });

  const sa = A.createMatch(arena, playerId, enemyId);
  const sb = B.createMatch(arena, playerId, enemyId);

  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;
  let tick = 0;
  while (sa.phase !== 'ended' && sa.elapsed < HARD_CAP) {
    const input = loop.next(sa, DT);
    const ea = A.stepMatch(sa, DT, input);
    const eb = B.stepMatch(sb, DT, input);
    tick++;
    if (eventsOf(ea) !== eventsOf(eb) || stateOf(sa) !== stateOf(sb)) {
      const kinds = [...new Set([...ea, ...eb].map((e) => e.type))].join(',');
      return { diverged: true, tick, ticks: tick, kinds };
    }
  }
  return { diverged: false, tick: null, ticks: tick, kinds: '' };
}

// ═════════════════════════════════════════════════════════════════════════════
// --selftest — a comparator that cannot report a difference is worthless
// ═════════════════════════════════════════════════════════════════════════════
if (import.meta.main && args.selftest) {
  let pass = 0; let fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };
  console.log(`\n══ tun_bitid SELFTEST ══  ref ${REF_DIR}\n                          sim ${SIM_DIR}`);

  const pair = (mutate) => {
    const rnd = rng(7919 + 'sushi'.length * 131 + 'donut'.length * 17 + POLICY.length);
    const decide = driver.POLICY_FNS[POLICY](rnd);
    const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: 60, rnd });
    const s1 = A.createMatch(arena, 'sushi', 'donut');
    const s2 = A.createMatch(arena, 'sushi', 'donut');
    for (let i = 0; i < 600 && s1.phase !== 'ended'; i++) {
      if (mutate) mutate(i, s2);
      const input = loop.next(s1, DT);
      const e1 = A.stepMatch(s1, DT, input);
      const e2 = A.stepMatch(s2, DT, input);
      if (eventsOf(e1) !== eventsOf(e2) || stateOf(s1) !== stateOf(s2)) return i;
    }
    return null;
  };

  ok('SELF-PAIR: the reference tree against itself never diverges', pair(null) === null,
    `first divergence ${pair(null)}`);
  ok('KNOWN-BAD: a 1 HP poke on tick 200 is caught on that tick',
    pair((i, s) => { if (i === 200) s.fighters[1].hp -= 1; }) === 200);
  ok('KNOWN-BAD: a sub-pixel POSITION nudge on tick 120 is caught',
    pair((i, s) => { if (i === 120) s.fighters[0].x += 1e-9; }) === 120);
  ok('KNOWN-BAD: a `cast`-ONLY difference on tick 150 is caught on that tick',
    pair((i, s) => { if (i === 150) s.fighters[0].cast = { weaponIndex: 0, startedAt: 1, resolvesAt: 2 }; }) === 150);

  // 🚨 THE ROW THIS TOOL EXISTS FOR: the two trees must be DISTINGUISHABLE at all. If the ref
  // resolved to the working tree — `AGENT-BRIEF` §3's `rg_lib` trap — every run would report a
  // perfect null and mean nothing.
  ok('the two arms are DIFFERENT TREES, so a null result is informative',
    REF_DIR !== SIM_DIR, `${REF_DIR} vs ${SIM_DIR}`);
  ok('…and the reference tree has NO override layer, which is what makes it a baseline',
    !existsSync(`${REF_DIR}/tuning/registry.ts`), `${REF_DIR}/tuning`);

  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

// ═════════════════════════════════════════════════════════════════════════════
// the run
// ═════════════════════════════════════════════════════════════════════════════
if (import.meta.main) {
  if (REF_DIR === SIM_DIR) {
    console.error('tun_bitid: --ref equals --sim, so both arms are the same tree. Refusing: the result would be a guaranteed null that means nothing.');
    process.exit(2);
  }
  // ⚠️ `index.ts`, not `store.ts`: the hash is GUARDED until the registry has finished
  // populating (`store.ts:effectiveOverrideEntries` throws), because a hash taken mid-boot
  // would canonicalise against a partial default table and could call a tuned set "stock" —
  // the one failure the whole mechanism exists to prevent. Importing the barrel seals it.
  // Same module URLs as `B.RULES`, so this is the same instance, not a second registry.
  const store = await import(`${SIM_DIR}/tuning/index.ts`);
  const t0 = Date.now();
  const rows = [];
  for (const p of CHARACTER_IDS) {
    for (const e of CHARACTER_IDS) {
      if (p === e) continue;
      for (let s = 0; s < SEEDS; s++) rows.push({ ...lockstep(p, e, s), p, e, s });
    }
  }
  const diverged = rows.filter((r) => r.diverged);
  const ticks = rows.reduce((a, r) => a + r.ticks, 0);

  console.log(`\n══ TUN_BITID ══  ${rows.length} matches · policy ${POLICY} · ${SEEDS} seeds · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`   ref     ${REF_DIR}   (no override layer)`);
  console.log(`   sim     ${SIM_DIR}`);
  console.log(`   arena   ${arena.width}x${arena.height} maxSafeRadius ${arena.maxSafeRadius}`);
  console.log(`   TUNING  hash ${store.tuningSetHash()} · source ${store.tuningSource()}`);
  console.log(`   expect  ${EXPECT.toUpperCase()}\n`);
  console.log(`   matches            ${rows.length}`);
  console.log(`   ticks compared     ${ticks.toLocaleString()}`);
  console.log(`   DIVERGED           ${diverged.length}`);
  for (const r of diverged.slice(0, 6)) console.log(`     ${r.p} vs ${r.e} seed ${r.s} @ tick ${r.tick} (${r.kinds})`);

  // ⚠️ The tuned arm is checked against a FLOOR, not against "at least one". `PLAYER_SPEED` is
  // read every tick of every match, so a set that moved it and produced two divergences would
  // mean something is swallowing the override in most matchups — a partial failure that
  // "> 0" would report as success.
  const verdict = EXPECT === 'diverge'
    ? diverged.length >= rows.length * 0.9
    : diverged.length === 0;

  console.log(`\n   >> ${verdict
    ? (EXPECT === 'diverge'
      ? 'PASS — the override reached the sim in ≥90% of matchups. The null arm is therefore informative.'
      : 'PASS — every matchup is bit-identical with the layer installed and unset.')
    : (EXPECT === 'diverge'
      ? `FAIL — only ${diverged.length}/${rows.length} moved. An override that does not reach the sim makes the null arm VACUOUS.`
      : 'FAIL — the layer is not inert. See the rows above.')}\n`);
  process.exit(verdict ? 0 : 1);
}
