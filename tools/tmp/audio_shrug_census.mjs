#!/usr/bin/env node
/**
 * SHRUG-OFF CENSUS — how often is a status actually REFUSED in a real match?
 *
 * `combat.ts`'s grace rule means a stun or slow that hits a target already inside its
 * own status window (or the 500 ms grace after it) is silently discarded: the hit still
 * lands, still deals full damage, and still emits the same `hit-landed`. `vfx.ts` gives
 * that moment a ring pop. Audio was asked whether it deserves a cue too — and the
 * question "does it deserve one" is a RATE question first: a cue on a thing that happens
 * 40 times a match is noise, and a cue on a thing that happens twice is information.
 *
 * Same harness as `audio_census.mjs` (real `src/game/sim.ts` in Node against the cached
 * arena), so a full matchup costs ~20 ms.
 *
 * The discriminant is EXACT, not a re-derivation of the predicate: `applyDamage` is the
 * only writer of `status.stunnedUntil` / `slowedUntil` and writes them ONLY when the
 * status is accepted, so a step in which the timestamp did not move is a step in which
 * every status event it carried was refused. Where one step carries several status hits
 * on the same target, at most one of them can have been the writer.
 *
 * ── THE DRIVER IS IMPORTED, AND IT USED TO BE A STALE COPY ─────────────────
 *
 * The hand on the controls was a verbatim hand-copy of `audio_census.mjs`'s, which was
 * itself a stale copy of `tools/match-sim.mjs`'s scripted player: the stuck detector ran
 * during the COUNTDOWN, when `sim.ts:movePlayer` is never called, so it read "1.5 s of
 * walking, 0 wu covered", latched a perpendicular detour and walked it SIDEWAYS at the
 * whistle (`docs/LESSONS.md` §5). A REFUSAL RATE is a rate per unit of engagement, so a
 * driver that changes when engagement starts changes the number this file exists to
 * print.
 *
 * It now comes from `tools/tmp/scripted_player.mjs`. `--nav-countdown-bug
 * --decide-during-countdown` reproduce the pre-fix walk. `smart` here NEVER meant the
 * `smart` decision tree — it meant a chase that holds fire out of range — so it is kept
 * as an explicit ALIAS (to `smart2`, which carries the same firing discipline) rather
 * than silently re-pointed.
 *
 *   node tools/tmp/audio_shrug_census.mjs
 *   node tools/tmp/audio_shrug_census.mjs --policy idle
 *   node tools/tmp/audio_shrug_census.mjs --sim /tmp/frozen/src/game
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createScriptedPlayer, parseDriverFlags, DRIVER_REV } from './scripted_player.mjs';

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

/** `--sim <dir>` freezes the sim; without it a peer's half-saved `src/game/` lands in a run. */
const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
const ARENA_CACHE = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const { CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, REACH } = await import(`${SIM_DIR}/rules.ts`);

const DT = Number(args.dt ?? 16.667);
const POLICY = String(args.policy ?? 'smart');
/** 0 = decide every tick, which is what this file has always done. */
const REACT_MS = Number(args.react ?? 0);

if (!existsSync(ARENA_CACHE)) {
  console.error(`No arena cache at ${ARENA_CACHE}. Run once:  node tools/match-sim.mjs --refresh-arena --url $URL`);
  process.exit(1);
}
const ARENA = { ...JSON.parse(readFileSync(ARENA_CACHE, 'utf8')), build: () => null, update: () => {} };

const DRIVER_FLAGS = parseDriverFlags(args);
const DRIVER = createScriptedPlayer({
  CHARACTERS, REACH, arena: ARENA,
  hazard: (ARENA.hazards ?? []).find((h) => h.kind === 'damage') ?? null,
  ...DRIVER_FLAGS,
});
if (DRIVER.isHistorical) {
  console.log('\n  \u26a0\ufe0f  HISTORICAL DRIVER — reproducing a defect fixed on 2026-08-05. These numbers are NOT current.\n');
}

/**
 * The same hand on the controls `audio_census.mjs` uses — which is now the SHARED one.
 * `smart` and `flee` are ALIASES kept so no recorded figure changes meaning silently;
 * see the header. `--legacy-smart-as <policy>` re-points `smart` for a sweep.
 */
const POLICY_ALIAS = { smart: String(args['legacy-smart-as'] ?? 'smart2'), flee: 'kite', smartTree: 'smart' };
const resolvePolicy = (p) => POLICY_ALIAS[p] ?? p;

function makePlayer(policy) {
  const name = resolvePolicy(policy);
  const fn = DRIVER.POLICY_FNS[name];
  if (!fn) throw new Error(`unknown policy ${policy} -> ${name} (have: ${DRIVER.POLICY_NAMES.join(', ')})`);
  const loop = DRIVER.createDecisionLoop({ decide: fn(null), reactBase: REACT_MS, reactJit: 0, rnd: null });
  return (state) => loop.next(state, DT);
}

const KEY = { stun: 'stunnedUntil', slow: 'slowedUntil' };

/**
 * FIDELITY OF THE SHIPPED DISCRIMINANT.
 *
 * The ground truth above is computed per SIM STEP. `director.ts` cannot be: it is handed
 * one batch of events per rendered FRAME, and a frame at 30 fps with `simSpeed=3` can
 * contain a dozen steps. Inside one batch it sees only "did the timestamp move at all",
 * so a batch in which a stun LANDED and a later stun was REFUSED reads as one landing
 * and the refusal is silent.
 *
 * This is the same limitation `vfx.ts` has (its snapshot is also one frame old), which
 * is what keeps the ring pop and the sound agreeing. What it costs is measured here
 * rather than hand-waved: replay the same matches with N steps per batch and count the
 * refusals the shipped rule would MISS and the ones it would INVENT.
 */
function batchFidelity(playerId, enemyId, policy, batchSize) {
  const state = createMatch(ARENA, playerId, enemyId);
  const act = makePlayer(policy);
  let truth = 0, seen = 0, missed = 0, invented = 0;
  const maxTicks = Math.ceil((MATCH_DURATION_MS * 1.4 + 8000) / DT);
  let ticks = 0;
  while (ticks < maxTicks) {
    // One rendered frame: `batchSize` sim steps, then one call to the director.
    const atBatchStart = {
      player: state.player.status.stunnedUntil,
      enemy: state.enemy.status.stunnedUntil,
    };
    const batch = [];
    let ended = false;
    for (let i = 0; i < batchSize && !ended; i++, ticks++) {
      const before = {
        player: state.player.status.stunnedUntil,
        enemy: state.enemy.status.stunnedUntil,
      };
      const evs = stepMatch(state, DT, act(state));
      const wrote = {
        player: state.player.status.stunnedUntil !== before.player,
        enemy: state.enemy.status.stunnedUntil !== before.enemy,
      };
      for (const ev of evs) {
        if (ev.type !== 'hit-landed' || ev.effect !== 'stun') continue;
        // Ground truth, per step.
        const landed = wrote[ev.targetRole];
        if (landed) wrote[ev.targetRole] = false;
        batch.push({ target: ev.targetRole, truthRefused: !landed });
        if (!landed) truth++;
      }
      if (state.phase === 'ended') ended = true;
    }
    // The shipped rule, per batch.
    const unclaimed = {
      player: state.player.status.stunnedUntil !== atBatchStart.player,
      enemy: state.enemy.status.stunnedUntil !== atBatchStart.enemy,
    };
    for (const b of batch) {
      let refused;
      if (unclaimed[b.target]) { unclaimed[b.target] = false; refused = false; }
      else refused = true;
      if (refused) seen++;
      if (b.truthRefused && !refused) missed++;
      if (!b.truthRefused && refused) invented++;
    }
    if (ended) break;
  }
  return { truth, seen, missed, invented };
}

function runMatch(playerId, enemyId, policy) {
  const state = createMatch(ARENA, playerId, enemyId);
  const act = makePlayer(policy);
  const out = {
    landed: { stun: 0, slow: 0 },
    refused: { stun: 0, slow: 0 },
    refusedByTarget: { player: 0, enemy: 0 },
    refusedStunByTarget: { player: 0, enemy: 0 },
    /** Gaps between consecutive refusals, ms — how bunched the cue would be. */
    refusalGaps: [],
    stunRefusalGaps: [],
    lastRefusalAt: null,
    lastStunRefusalAt: null,
    durationMs: 0,
  };
  const maxTicks = Math.ceil((MATCH_DURATION_MS * 1.4 + 8000) / DT);
  for (let ticks = 0; ticks < maxTicks; ticks++) {
    const before = {
      player: { stun: state.player.status.stunnedUntil, slow: state.player.status.slowedUntil },
      enemy: { stun: state.enemy.status.stunnedUntil, slow: state.enemy.status.slowedUntil },
    };
    const events = stepMatch(state, DT, act(state));
    const wrote = {
      player: {
        stun: state.player.status.stunnedUntil !== before.player.stun,
        slow: state.player.status.slowedUntil !== before.player.slow,
      },
      enemy: {
        stun: state.enemy.status.stunnedUntil !== before.enemy.stun,
        slow: state.enemy.status.slowedUntil !== before.enemy.slow,
      },
    };
    for (const ev of events) {
      if (ev.type !== 'hit-landed') continue;
      if (ev.effect !== 'stun' && ev.effect !== 'slow') continue;
      const eff = ev.effect;
      if (wrote[ev.targetRole][eff]) {
        // The writer. Exactly one per target per effect per step.
        wrote[ev.targetRole][eff] = false;
        out.landed[eff]++;
      } else {
        out.refused[eff]++;
        out.refusedByTarget[ev.targetRole]++;
        if (out.lastRefusalAt !== null) out.refusalGaps.push(state.elapsed - out.lastRefusalAt);
        out.lastRefusalAt = state.elapsed;
        if (eff === 'stun') {
          out.refusedStunByTarget[ev.targetRole]++;
          if (out.lastStunRefusalAt !== null) out.stunRefusalGaps.push(state.elapsed - out.lastStunRefusalAt);
          out.lastStunRefusalAt = state.elapsed;
        }
      }
    }
    out.durationMs = state.elapsed;
    if (state.phase === 'ended') break;
  }
  void KEY;
  return out;
}

const totals = {
  landed: { stun: 0, slow: 0 },
  refused: { stun: 0, slow: 0 },
  refusedByTarget: { player: 0, enemy: 0 },
  matches: 0,
  durationMs: 0,
  gaps: [],
  stunGaps: [],
  refusedStunByTarget: { player: 0, enemy: 0 },
  worstStun: null,
  worst: null,
};
const perMatch = [];
for (const p of CHARACTER_IDS) {
  for (const e of CHARACTER_IDS) {
    if (p === e) continue;
    const r = runMatch(p, e, POLICY);
    totals.matches++;
    totals.durationMs += r.durationMs;
    for (const k of ['stun', 'slow']) {
      totals.landed[k] += r.landed[k];
      totals.refused[k] += r.refused[k];
    }
    totals.refusedByTarget.player += r.refusedByTarget.player;
    totals.refusedByTarget.enemy += r.refusedByTarget.enemy;
    totals.gaps.push(...r.refusalGaps);
    totals.stunGaps.push(...r.stunRefusalGaps);
    totals.refusedStunByTarget.player += r.refusedStunByTarget.player;
    totals.refusedStunByTarget.enemy += r.refusedStunByTarget.enemy;
    if (!totals.worstStun || r.refused.stun > totals.worstStun.ref) {
      totals.worstStun = { p, e, ref: r.refused.stun, s: r.durationMs / 1000 };
    }
    const ref = r.refused.stun + r.refused.slow;
    perMatch.push({ p, e, ref, land: r.landed.stun + r.landed.slow, s: r.durationMs / 1000 });
    if (!totals.worst || ref > totals.worst.ref) totals.worst = { p, e, ref, s: r.durationMs / 1000 };
  }
}

const ref = totals.refused.stun + totals.refused.slow;
const land = totals.landed.stun + totals.landed.slow;
const mins = totals.durationMs / 60000;
const sorted = [...totals.gaps].sort((a, b) => a - b);
const pct = (q) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : NaN);
const withRef = perMatch.filter((m) => m.ref > 0).length;

console.log(`policy=${POLICY} -> ${resolvePolicy(POLICY)}  matches=${totals.matches}  total sim time=${mins.toFixed(1)} min  ·  driver rev ${DRIVER_REV}${DRIVER.isHistorical ? '  ⚠️ HISTORICAL' : ''}  ·  sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}`);
console.log(`status hits:        landed ${land}  (stun ${totals.landed.stun}, slow ${totals.landed.slow})`);
console.log(`                   REFUSED ${ref}  (stun ${totals.refused.stun}, slow ${totals.refused.slow})`);
console.log(`refusal share:      ${((100 * ref) / Math.max(1, ref + land)).toFixed(1)}% of all status hits`);
console.log(`rate:               ${(ref / Math.max(1e-9, mins)).toFixed(1)} refusals / minute of play`);
console.log(`per match:          ${(ref / totals.matches).toFixed(1)} mean, worst ${totals.worst.ref} (${totals.worst.p} vs ${totals.worst.e}, ${totals.worst.s.toFixed(1)}s)`);
console.log(`matches with any:   ${withRef}/${totals.matches}`);
console.log(`target of refusal:  player ${totals.refusedByTarget.player}, enemy ${totals.refusedByTarget.enemy}`);
console.log(`gap between refusals (ms):  p10 ${pct(0.1)}  p50 ${pct(0.5)}  p90 ${pct(0.9)}  min ${sorted[0] ?? NaN}`);
const under250 = sorted.filter((g) => g < 250).length;
console.log(`gaps under 250 ms:  ${under250}/${sorted.length} (${((100 * under250) / Math.max(1, sorted.length)).toFixed(1)}%) — these would be one perceived sound, not two`);

// ── The same numbers for STUN REFUSALS ALONE ────────────────────────────────
const sref = totals.refused.stun;
const ssorted = [...totals.stunGaps].sort((a, b) => a - b);
const spct = (q) => (ssorted.length ? ssorted[Math.min(ssorted.length - 1, Math.floor(q * ssorted.length))] : NaN);
const sUnder = ssorted.filter((g) => g < 700).length;
console.log('');
console.log(`STUN refusals only: ${sref} total  ·  ${(sref / Math.max(1e-9, mins)).toFixed(2)} / minute  ·  ${(sref / totals.matches).toFixed(2)} per match`);
console.log(`  worst match:      ${totals.worstStun.ref} (${totals.worstStun.p} vs ${totals.worstStun.e}, ${totals.worstStun.s.toFixed(1)}s)`);
console.log(`  target:           player ${totals.refusedStunByTarget.player}, enemy ${totals.refusedStunByTarget.enemy}`);
console.log(`  gaps (ms):        p10 ${spct(0.1)?.toFixed?.(0)}  p50 ${spct(0.5)?.toFixed?.(0)}  p90 ${spct(0.9)?.toFixed?.(0)}  min ${ssorted[0]?.toFixed?.(0)}`);
console.log(`  gaps under 700 ms: ${sUnder}/${ssorted.length}`);

// ── What the SHIPPED per-frame rule would actually voice ────────────────────
console.log('');
console.log('director fidelity — stun refusals the per-frame rule finds, vs the per-step truth');
console.log('  steps/frame   truth   voiced   missed   invented');
for (const bs of [1, 3, 6, 12]) {
  const t = { truth: 0, seen: 0, missed: 0, invented: 0 };
  for (const p of CHARACTER_IDS) {
    for (const e of CHARACTER_IDS) {
      if (p === e) continue;
      const r = batchFidelity(p, e, POLICY, bs);
      t.truth += r.truth; t.seen += r.seen; t.missed += r.missed; t.invented += r.invented;
    }
  }
  console.log(`  ${String(bs).padStart(11)}   ${String(t.truth).padStart(5)}   ${String(t.seen).padStart(6)}   ` +
    `${String(t.missed).padStart(6)}   ${String(t.invented).padStart(8)}`);
}
