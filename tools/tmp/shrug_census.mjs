#!/usr/bin/env node
/**
 * HOW OFTEN IS A STATUS ACTUALLY SHRUGGED OFF? — and can the director tell?
 *
 * Two questions, and neither can be answered by reading `combat.ts`.
 *
 *  1. **Frequency.** A cue is worth building if the moment recurs. `docs/LESSONS.md`
 *     §2: probe before you loop. So this runs the REAL `src/game/sim.ts` over all 110
 *     matchups (the same Node trick `audio_census.mjs` uses — the cached arena, ~20 ms
 *     a match) and counts refusals per match, per effect, and by who was refused.
 *
 *  2. **Whether the discriminant the director would use is CORRECT.** `applyDamage`
 *     emits an identical `hit-landed` whether the status landed or bounced, and the
 *     director sees the state AFTER the step, so it cannot use the pre-hit snapshot
 *     `vfx.ts` has. The proposed test is:
 *
 *         refused  <=>  target.status.<until> - state.elapsed  <  <DURATION>
 *
 *     because a status that LANDS sets `until = elapsed + DURATION` exactly, and one
 *     that is refused leaves an older timestamp behind. This scores it against the
 *     ground truth — a snapshot taken BEFORE the step, which is what `combat.ts`
 *     itself compares against — and reports every disagreement.
 *
 *   node tools/tmp/shrug_census.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const ARENA_CACHE = `${ROOT}/tools/arena.gameplay.json`;
if (!existsSync(ARENA_CACHE)) {
  console.error('No arena cache. Run once:  node tools/match-sim.mjs --refresh-arena --url $URL');
  process.exit(1);
}
const { createMatch, stepMatch } = await import(`${ROOT}/src/game/sim.ts`);
const { CHARACTERS, CHARACTER_IDS, STUN_DURATION_MS, SLOW_DURATION_MS, STUN_GRACE_MS, SLOW_GRACE_MS } =
  await import(`${ROOT}/src/game/rules.ts`);
const { statusReadyAt } = await import(`${ROOT}/src/game/combat.ts`);

const ARENA = { ...JSON.parse(readFileSync(ARENA_CACHE, 'utf8')), build: () => null, update: () => {} };
const DT = 16.667;

/** The aggressive policy from `audio_census.mjs`, trimmed to what this needs. */
function makePlayer() {
  return (state) => {
    const p = state.player;
    const e = state.enemy;
    let dx = e.x - p.x, dy = e.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const m = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
    const q = (v) => (v > 0.35 ? 1 : v < -0.35 ? -1 : 0);
    const ws = CHARACTERS[p.characterId].weapons;
    let slot = null, best = -Infinity;
    ws.forEach((w, i) => {
      if (w.type === 'self') return;
      if (state.elapsed - p.lastUsed[i] < w.cooldown) return;
      if (d > (w.range ?? Infinity)) return;
      if ((w.damage ?? 0) > best) { best = w.damage ?? 0; slot = i; }
    });
    return { move: { x: q(dx / m), y: q(dy / m) }, aim: { x: dx / d, y: dy / d },
             selectedWeapon: slot ?? 0, attack: slot !== null };
  };
}

const DUR = { stun: STUN_DURATION_MS, slow: SLOW_DURATION_MS };
const FIELD = { stun: 'stunnedUntil', slow: 'slowedUntil' };

function runMatch(a, b) {
  const state = createMatch(ARENA, a, b);
  const act = makePlayer();
  const out = { landed: { stun: 0, slow: 0 }, refused: { stun: 0, slow: 0 },
                refusedOnPlayer: 0, refusedOnEnemy: 0, disagreements: 0, statusHits: 0 };
  let guard = 0;
  while (state.phase !== 'ended' && guard++ < 20000) {
    // GROUND TRUTH: what `combat.ts` will compare against on this tick, captured
    // before it runs. `statusReadyAt` is imported, not re-derived.
    const pre = {
      player: { stun: statusReadyAt(state.player, 'stun'), slow: statusReadyAt(state.player, 'slow') },
      enemy: { stun: statusReadyAt(state.enemy, 'stun'), slow: statusReadyAt(state.enemy, 'slow') },
    };
    const preElapsed = state.elapsed;
    const events = stepMatch(state, DT, act(state));
    for (const ev of events) {
      if (ev.type !== 'hit-landed') continue;
      if (ev.effect !== 'stun' && ev.effect !== 'slow') continue;
      out.statusHits++;
      const target = state[ev.targetRole];
      // The director's discriminant, on the state it will actually be handed.
      const post = target.status[FIELD[ev.effect]] - state.elapsed < DUR[ev.effect];
      // The truth. `applyDamage` compares `state.elapsed` (already advanced by this
      // step) against the readiness computed from the PRE-step timers.
      const truth = state.elapsed < pre[ev.targetRole][ev.effect];
      if (post !== truth) out.disagreements++;
      if (truth) {
        out.refused[ev.effect]++;
        if (ev.targetRole === 'player') out.refusedOnPlayer++; else out.refusedOnEnemy++;
      } else {
        out.landed[ev.effect]++;
      }
    }
    if (preElapsed === state.elapsed && state.phase === 'ended') break;
  }
  return out;
}

const totals = { landed: { stun: 0, slow: 0 }, refused: { stun: 0, slow: 0 },
                 refusedOnPlayer: 0, refusedOnEnemy: 0, disagreements: 0, statusHits: 0 };
const perMatch = [];
let matches = 0;
for (const a of CHARACTER_IDS) {
  for (const b of CHARACTER_IDS) {
    if (a === b) continue;
    const r = runMatch(a, b);
    matches++;
    perMatch.push(r.refused.stun + r.refused.slow);
    totals.landed.stun += r.landed.stun; totals.landed.slow += r.landed.slow;
    totals.refused.stun += r.refused.stun; totals.refused.slow += r.refused.slow;
    totals.refusedOnPlayer += r.refusedOnPlayer; totals.refusedOnEnemy += r.refusedOnEnemy;
    totals.disagreements += r.disagreements;
    totals.statusHits += r.statusHits;
  }
}

perMatch.sort((x, y) => x - y);
const mean = perMatch.reduce((s, v) => s + v, 0) / perMatch.length;
const pct = (n, d) => (d ? ((100 * n) / d).toFixed(1) : '0.0') + '%';

console.log(`\n${matches} matchups, aggressive policy, ${DT.toFixed(3)} ms tick\n`);
console.log(`  status-carrying hits             ${totals.statusHits}`);
console.log(`  landed    stun ${String(totals.landed.stun).padStart(5)}   slow ${String(totals.landed.slow).padStart(5)}`);
console.log(`  REFUSED   stun ${String(totals.refused.stun).padStart(5)}   slow ${String(totals.refused.slow).padStart(5)}` +
  `   = ${pct(totals.refused.stun + totals.refused.slow, totals.statusHits)} of every status-carrying hit`);
console.log(`  refused on the local player ${totals.refusedOnPlayer}, on the enemy ${totals.refusedOnEnemy}`);
console.log(`  per match: mean ${mean.toFixed(1)}, median ${perMatch[Math.floor(perMatch.length / 2)]}, ` +
  `min ${perMatch[0]}, max ${perMatch[perMatch.length - 1]}, ` +
  `zero-refusal matches ${perMatch.filter((v) => v === 0).length}/${matches}`);
console.log(`\n  DISCRIMINANT: "until - elapsed < DURATION" disagreed with the truth ` +
  `${totals.disagreements} times out of ${totals.statusHits} status hits (${pct(totals.disagreements, totals.statusHits)})`);
console.log(`  (STUN_DURATION_MS=${STUN_DURATION_MS} STUN_GRACE_MS=${STUN_GRACE_MS} ` +
  `SLOW_DURATION_MS=${SLOW_DURATION_MS} SLOW_GRACE_MS=${SLOW_GRACE_MS})`);
