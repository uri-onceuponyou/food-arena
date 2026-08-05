#!/usr/bin/env node
/**
 * MATCH TIMELINE RECORDER — the input half of `tools/tmp/audio_mix.mjs`.
 *
 * Every audio measurement on this project so far renders ONE sound in ISOLATION.
 * `--mode identity` proves the sounds differ from each other; `--mode depth` proves each
 * has layers. A player hears neither of those things: they hear a MIX, produced by a real
 * event stream, through the retrigger throttle, the voice budget, the distance/pan gains
 * and the soft clip, all at once.
 *
 * This file produces the INPUT to that measurement and nothing else: it runs the real
 * `src/game/sim.ts` in Node (the same trick `tools/match-sim.mjs` and
 * `tools/tmp/audio_census.mjs` use) and records, for every tick,
 *
 *   * the `GameEvent[]` the sim emitted, and
 *   * exactly the `MatchState` fields `director.ts` reads — no more, so the recording
 *     cannot accidentally carry gameplay state into an audio measurement.
 *
 * The recording is then replayed IDENTICALLY into every render arm, which is what makes
 * an A/B mean anything: the arms differ only in the audio change under test, never in
 * what happened in the match.
 *
 *   node tools/tmp/audio_mix_record.mjs --player pizza --enemy taco --out /tmp/t.json
 *
 * `-Infinity` is not JSON, and `status.stunnedUntil` starts there. It is encoded as the
 * string "-inf" and restored on the other side; a silent coercion to `null` would make
 * every first status hit read as a REFUSAL, which is exactly the class of instrument bug
 * this pass exists to avoid.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const ARENA_CACHE = `${ROOT}/tools/arena.gameplay.json`;

const { createMatch, stepMatch } = await import(`${ROOT}/src/game/sim.ts`);
const RULES = await import(`${ROOT}/src/game/rules.ts`);
const { CHARACTERS, MATCH_DURATION_MS } = RULES;

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

if (!existsSync(ARENA_CACHE)) {
  console.error(`No arena cache. Run once:  node tools/match-sim.mjs --refresh-arena --url $URL`);
  process.exit(1);
}
const ARENA = { ...JSON.parse(readFileSync(ARENA_CACHE, 'utf8')), build: () => null, update: () => {} };

const DT = Number(args.dt ?? 16.667);

/** JSON-safe encode of a number that may be ±Infinity. */
const enc = (v) => (v === -Infinity ? '-inf' : v === Infinity ? '+inf' : v);

/**
 * A hand on the controls. Copied from `audio_census.mjs` rather than imported, because
 * that file is a script with top-level side effects; the policy is six lines and the
 * duplication is cheaper than the coupling.
 */
export function makePlayer(policy) {
  let detourUntil = -1;
  let detourSign = 1;
  const hist = [];
  return (state) => {
    const p = state.player;
    const e = state.enemy;
    if (policy === 'idle') return { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
    hist.push({ t: state.elapsed, x: p.x, y: p.y });
    while (hist.length && state.elapsed - hist[0].t > 1500) hist.shift();
    if (state.elapsed > detourUntil && hist.length > 4 && state.elapsed - hist[0].t > 1200) {
      if (Math.hypot(p.x - hist[0].x, p.y - hist[0].y) < 24) {
        detourUntil = state.elapsed + 700;
        detourSign = -detourSign;
      }
    }
    let dx = e.x - p.x;
    let dy = e.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (state.elapsed < detourUntil) { const t = dx; dx = -dy * detourSign; dy = t * detourSign; }
    const m = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
    const q = (v) => (v > 0.35 ? 1 : v < -0.35 ? -1 : 0);
    const ws = CHARACTERS[p.characterId].weapons;
    let slot = null; let bestDmg = -Infinity;
    ws.forEach((w, i) => {
      if (w.type === 'self') return;
      if (state.elapsed - p.lastUsed[i] < w.cooldown) return;
      if (d > (w.range ?? Infinity)) return;
      if ((w.damage ?? 0) > bestDmg) { bestDmg = w.damage ?? 0; slot = i; }
    });
    return {
      move: { x: q(dx / m), y: q(dy / m) },
      aim: { x: (e.x - p.x) / d, y: (e.y - p.y) / d },
      selectedWeapon: slot ?? 0,
      attack: slot !== null,
    };
  };
}

/** One fighter, reduced to exactly the fields `director.ts` reads. */
function snapFighter(f) {
  return {
    role: f.role, characterId: f.characterId,
    x: f.x, y: f.y, hp: f.hp, maxHp: f.maxHp, alive: f.alive,
    status: { stunnedUntil: enc(f.status.stunnedUntil), slowedUntil: enc(f.status.slowedUntil) },
  };
}

export function record(playerId, enemyId, policy = 'smart', opts = {}) {
  const state = createMatch(ARENA, playerId, enemyId);
  const act = makePlayer(policy);
  const ticks = [];
  const maxTicks = Math.ceil((MATCH_DURATION_MS * 1.4 + 8000) / DT);
  let n = 0;
  while (n < maxTicks) {
    n++;
    const events = stepMatch(state, DT, act(state));
    if (opts.immortal && state.phase === 'playing') {
      state.player.hp = state.player.maxHp;
      state.enemy.hp = state.enemy.maxHp;
    }
    ticks.push({
      t: state.elapsed,
      phase: state.phase,
      safeRadius: state.safeRadius,
      player: snapFighter(state.player),
      enemy: snapFighter(state.enemy),
      ev: events,
    });
    if (state.phase === 'ended') break;
  }
  // A few quiet ticks after the end, so the last voice's tail is inside the render.
  return { playerId, enemyId, policy, dt: DT, ticks, endedAt: state.elapsed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const tl = record(String(args.player ?? 'pizza'), String(args.enemy ?? 'taco'), String(args.policy ?? 'smart'), {
    immortal: !!args.immortal,
  });
  const voiced = tl.ticks.reduce((a, t) => a + t.ev.length, 0);
  console.log(`recorded ${tl.playerId} vs ${tl.enemyId}: ${tl.ticks.length} ticks, ${voiced} events, ends at ${(tl.endedAt / 1000).toFixed(2)}s`);
  if (args.out) { writeFileSync(String(args.out), JSON.stringify(tl)); console.log(`wrote ${args.out}`); }
}
