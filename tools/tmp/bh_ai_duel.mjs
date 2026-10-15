#!/usr/bin/env node
/**
 * BH_AI_DUEL — the shipped DUEL (slot 0 scripted player `smart2`, slot 1 `stepAI`) over the
 * 110-matchup grid, on the SHIPPED fog radius (the dump's 1720.47, asserted equal to
 * `rules.ts:fogOpeningRadiusFor`), recording what the bot does in sudden death.
 *
 * One sim per process, because `scripted_player.mjs` resolves `pressValue` from `--sim` on
 * argv (its own header explains why a second sim in the same process is refused). Pair two
 * runs with `--compare a.json b.json`.
 *
 *   node tools/tmp/bh_ai_duel.mjs --sim /private/tmp/fa-rv-head/src/game --seeds 4 --json a.json
 *   node tools/tmp/bh_ai_duel.mjs --sim <patched>/src/game --seeds 4 --json b.json
 *   node tools/tmp/bh_ai_duel.mjs --compare a.json b.json
 *
 * Read-only on the repo. Seed formula and decision loop are `roster_lab.mjs`'s, unchanged.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const args = (() => {
  const out = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) continue;
    const k = a[i].slice(2);
    if (k === 'compare') { out.compare = [a[i + 1], a[i + 2]]; i += 2; continue; }
    out[k] = a[i + 1] !== undefined && !a[i + 1].startsWith('--') ? a[++i] : true;
  }
  return out;
})();

if (args.compare) {
  const [A, B] = args.compare.map((p) => JSON.parse(readFileSync(p, 'utf8')));
  const byKey = new Map(B.rows.map((r) => [r.key, r]));
  let n = 0, sd = 0, winnerMoved = 0, anyMoved = 0, sdWinnerMoved = 0;
  const moved = [];
  for (const a of A.rows) {
    const b = byKey.get(a.key);
    if (!b) throw new Error(`compare: ${a.key} missing from B`);
    n++;
    if (a.reachedSd) sd++;
    const differs = a.winner !== b.winner || a.playMs !== b.playMs || a.hpLeft.player !== b.hpLeft.player || a.hpLeft.enemy !== b.hpLeft.enemy;
    if (differs) anyMoved++;
    if (a.winner !== b.winner) { winnerMoved++; if (a.reachedSd) sdWinnerMoved++; if (moved.length < 20) moved.push(`${a.key}: ${a.winner} -> ${b.winner} (SD ${a.reachedSd}, playMs ${a.playMs} -> ${b.playMs})`); }
  }
  console.log(`paired rows ${n} · reached SD in A ${sd} · rows whose outcome differs at all ${anyMoved} · WINNER changed ${winnerMoved} (of which reached SD in A: ${sdWinnerMoved})`);
  for (const m of moved) console.log(`   ${m}`);
  process.exit(0);
}

const SIM = String(args.sim ?? '/private/tmp/fa-rv-head/src/game');
const DRIVER = String(args.driver ?? '/private/tmp/fa-rv-head/tools/tmp/scripted_player.mjs');
const { createMatch, stepMatch } = await import(`${SIM}/sim.ts`);
const R = await import(`${SIM}/rules.ts`);
const { createScriptedPlayer, rng } = await import(DRIVER);
const { CHARACTERS, CHARACTER_IDS, REACH, MATCH_DURATION_MS } = R;

const RAW = JSON.parse(readFileSync(String(args.arena ?? '/private/tmp/fa-rv-head/tools/arena.gameplay.json'), 'utf8'));
const derived = R.fogOpeningRadiusFor(Math.hypot(RAW.width / 2, RAW.height / 2));
if (Math.abs(derived - RAW.maxSafeRadius) > 1e-6) throw new Error(`dump radius ${RAW.maxSafeRadius} != shipped ${derived}`);
const arena = { ...RAW, build: () => null, update: () => {} };
const DT = 16.667;
const SEEDS = Number(args.seeds ?? 4);
const POLICY = String(args.policy ?? 'smart2');
const driver = createScriptedPlayer({ CHARACTERS, REACH, arena });

function runMatch(playerId, enemyId, seed) {
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + POLICY.length);
  const state = createMatch(arena, playerId, enemyId);
  const decide = driver.POLICY_FNS[POLICY](rnd);
  const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });
  let winner = null, countdownMs = null, endedAt = null;
  let reachedSd = false, aliveAtSd = 0, sdBotPresses = 0, sdBotTicks = 0, sdBotPot = 0, sdPlayerPresses = 0;
  let preBotPresses = 0, preBotTicks = 0;
  while (state.phase !== 'ended' && state.elapsed < MATCH_DURATION_MS * 1.6 + 20000) {
    const evs = stepMatch(state, DT, loop.next(state, DT));
    for (const ev of evs) {
      if (ev.type === 'match-started') countdownMs = state.elapsed;
      else if (ev.type === 'match-ended') { winner = ev.winner; endedAt = state.elapsed; }
    }
    if (state.phase === 'playing' || endedAt === state.elapsed) {
      const sd = R.suddenDeathActive(state.timeRemaining);
      const playMs = MATCH_DURATION_MS - state.timeRemaining;
      const bot = state.fighters[1];
      const p = evs.filter((e) => (e.type === 'weapon-fired' || e.type === 'cast-started') && e.fighterId === 1).length;
      if (sd) {
        if (!reachedSd) { reachedSd = true; aliveAtSd = state.fighters.filter((f) => f.alive).length; }
        if (bot.alive) { sdBotTicks++; sdBotPresses += p; }
        sdPlayerPresses += evs.filter((e) => (e.type === 'weapon-fired' || e.type === 'cast-started') && e.fighterId === 0).length;
        for (const e of evs) if (e.type === 'hit-landed' && e.targetId === 1 && e.source.kind === 'hazard') sdBotPot += e.amount;
      } else if (playMs >= MATCH_DURATION_MS - 30000 && bot.alive) { preBotTicks++; preBotPresses += p; }
    }
  }
  return {
    key: `${playerId}|${enemyId}|${seed}`, winner,
    playMs: countdownMs === null ? 0 : Math.round((endedAt ?? state.elapsed) - countdownMs),
    reachedSd, aliveAtSd, sdBotPresses, sdBotTicks, sdBotPot, sdPlayerPresses, preBotPresses, preBotTicks,
    hpLeft: { player: state.fighters[0].hp, enemy: state.fighters[1].hp },
  };
}

const rows = [];
const t0 = Date.now();
for (const p of CHARACTER_IDS) for (const e of CHARACTER_IDS) {
  if (p === e) continue;
  for (let s = 0; s < SEEDS; s++) rows.push(runMatch(p, e, s));
}
const sdRows = rows.filter((r) => r.reachedSd);
const sum = (f) => sdRows.reduce((a, r) => a + f(r), 0);
console.log(`bh_ai_duel sim=${SIM} policy=${POLICY} seeds=${SEEDS} rows=${rows.length} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
console.log(`  reached sudden death: ${sdRows.length}/${rows.length} (${(100 * sdRows.length / rows.length).toFixed(1)}%) · both alive at the trigger: ${sdRows.filter((r) => r.aliveAtSd === 2).length}`);
console.log(`  in those rows — bot presses/s in the 15 s BEFORE SD: ${(sum((r) => r.preBotPresses) / (sum((r) => r.preBotTicks) * DT / 1000)).toFixed(3)} · DURING SD: ${(sum((r) => r.sdBotPresses) / Math.max(1e-9, sum((r) => r.sdBotTicks) * DT / 1000)).toFixed(3)} · player presses in SD ${sum((r) => r.sdPlayerPresses)} · bot pot dmg in SD ${sum((r) => r.sdBotPot)}`);
const wins = rows.filter((r) => r.winner === 'player').length;
console.log(`  player win ${(100 * wins / rows.length).toFixed(1)}%  ·  player win in SD rows ${sdRows.length ? (100 * sdRows.filter((r) => r.winner === 'player').length / sdRows.length).toFixed(1) : 'n/a'}%`);
if (args.json) { writeFileSync(String(args.json), JSON.stringify({ sim: SIM, rows })); console.log(`  wrote ${args.json}`); }
