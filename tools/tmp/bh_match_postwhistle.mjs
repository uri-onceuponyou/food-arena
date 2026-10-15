#!/usr/bin/env node
/**
 * bh_match_postwhistle — WHAT THE SHIPPED LOOP DOES AFTER `phase === 'ended'`.
 *
 * Review-phase probe (2026-10-15, match-lifecycle bug hunt). Read-only on the tree: it
 * imports the sim from a directory (default: the clean detached worktree of 1090046) and
 * writes JSON only where `--json` points.
 *
 * ── The question ────────────────────────────────────────────────────────────
 * `sim.ts:stepMatch` runs `stepProjectiles` "every tick regardless of match phase —
 * faithfully reproducing the prototype … projectiles keep flying and can still land damage
 * for ONE EXTRA TICK after a match technically ends". `game/match.ts:GameSession.loop`
 * never stops calling `stepMatch` once the match is over: the result card stays up until
 * the player presses something, and the loop steps the sim on every one of those frames.
 * So in the SHIPPED game a projectile in flight at the whistle keeps flying for the rest
 * of its life and can still hit — and kill — fighters, the declared winner included, while
 * the VICTORY card is on screen. Every balance instrument (`nf_ffa`, `roster_lab`,
 * `match-sim`) stops at the end tick, so none of them can see this.
 *
 * This probe plays real all-AI matches through the real sim on the shipped arena dump,
 * seated exactly as the shipped roster path seats them (no `spawn` passed, so
 * `defaultSpawn` resolves slot i to the arena's own spawns), and then KEEPS STEPPING for
 * `--post` ms after the whistle at the same dt — which is what the browser does — and
 * records every event that lands after the end.
 *
 * ⚠️ Slot 0 is driven by the sim's AI, as a stand-in for the human. The phenomenon is a
 * property of what is in the air at the whistle, not of who steered slot 0.
 *
 * ── Controls (run with --selftest) ──────────────────────────────────────────
 *  §K known-bad: a hand-built ended match with a live projectile aimed at the winner. The
 *     probe's own counter MUST report a post-whistle hit (and a death at low HP). If it
 *     cannot see the planted case, it cannot see the real one.
 *  §C control: the same planted state with the projectile list emptied at the whistle —
 *     MUST report zero. Proves the count comes from the projectile and nothing else.
 *
 * Usage:
 *   node tools/tmp/bh_match_postwhistle.mjs --selftest
 *   node tools/tmp/bh_match_postwhistle.mjs --n 2,3,4,5,6 --post 8000 --json shots/rv/bugs/match/postwhistle.json
 *   node tools/tmp/bh_match_postwhistle.mjs --sim <patched dir>   # fix arm
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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

const SIM = String(args.sim ?? '/private/tmp/fa-rv-head/src/game');
const { createMatch, stepMatch } = await import(`${SIM}/sim.ts`);
const RULES = await import(`${SIM}/rules.ts`);
const { CHARACTER_IDS, CHARACTERS } = RULES;
const { brawlRoster } = await import(`${SIM}/../ui/screens/brawl.ts`);

const ARENA_PATH = String(args.arena ?? '/private/tmp/fa-rv-head/tools/arena.gameplay.json');
function loadArena() {
  const d = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
  // `maxSafeRadius` is taken from the dump AS IS: it is 1720.465…, which is the shipped
  // `arena/shared.ts:MAX_SAFE_RADIUS` (`fogOpeningRadiusFor(ARENA_HALF_DIAGONAL)`).
  return { ...d, build: () => null, update: () => {} };
}

const DT = Number(args.dt ?? 16.667);
const POST_MS = Number(args.post ?? 8000);
const HARD_CAP = 150000 * 1.6 + 20000;

/**
 * Play one match to the whistle, then keep stepping like `GameSession.loop` does.
 * Returns a per-match record of everything that landed after the end.
 */
export function runOne(arena, roster, { post = POST_MS, dt = DT, clearAtEnd = false } = {}) {
  // No `spawn`: `sim.ts:defaultSpawn` resolves slot i from the arena, exactly as the
  // shipped roster path (`match.ts:newMatch`) does.
  const cfgs = roster.map((characterId) => ({ characterId, controller: 'ai' }));
  const state = createMatch(arena, cfgs);
  const n = state.fighters.length;
  const inputs = new Array(n).fill(null);
  let endTick = -1, tick = 0, winnerId = null, endedAtMs = null;
  const rec = {
    roster, n, winnerId: null, ending: null, endMs: null,
    sameTick: { hits: [], deaths: [] },
    later: { hits: [], deaths: [], firstHitAfterMs: null, lastHitAfterMs: null },
    projAtEnd: 0, projLastAliveAfterMs: 0, postTicksWithProjectiles: 0,
  };
  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    const evs = stepMatch(state, dt, inputs);
    let afterEnd = false;
    for (const ev of evs) {
      if (ev.type === 'match-ended') { afterEnd = true; winnerId = ev.winnerId; continue; }
      if (!afterEnd) continue;
      if (ev.type === 'hit-landed') rec.sameTick.hits.push({ target: ev.targetId, amount: ev.amount, src: ev.source.kind });
      if (ev.type === 'death') rec.sameTick.deaths.push(ev.fighterId);
    }
    tick++;
  }
  if (state.phase !== 'ended') { rec.ending = 'UNRESOLVED'; return rec; }
  endTick = tick;
  endedAtMs = state.elapsed;
  rec.winnerId = winnerId;
  rec.ending = state.timeRemaining > 0 ? 'knockout' : 'timeout';
  rec.endMs = Math.round(state.elapsed);
  rec.projAtEnd = state.projectiles.length;
  if (clearAtEnd) state.projectiles.length = 0;
  // ── THE RESULT CARD IS UP. The shipped loop keeps calling stepMatch every frame. ──
  while (state.elapsed - endedAtMs < post) {
    const evs = stepMatch(state, dt, inputs);
    const after = state.elapsed - endedAtMs;
    if (state.projectiles.length > 0) { rec.postTicksWithProjectiles++; rec.projLastAliveAfterMs = after; }
    for (const ev of evs) {
      if (ev.type === 'hit-landed') {
        rec.later.hits.push({ target: ev.targetId, amount: Math.round(ev.amount * 100) / 100, src: ev.source.kind, afterMs: Math.round(after), winner: ev.targetId === winnerId });
        if (rec.later.firstHitAfterMs === null) rec.later.firstHitAfterMs = Math.round(after);
        rec.later.lastHitAfterMs = Math.round(after);
      }
      if (ev.type === 'death') rec.later.deaths.push({ id: ev.fighterId, afterMs: Math.round(after), winner: ev.fighterId === winnerId });
      if (ev.type === 'match-ended') rec.later.secondMatchEnded = true;
    }
    tick++;
  }
  const w = state.fighters[winnerId];
  rec.winnerAliveAtWhistleTickEnd = rec.sameTick.deaths.includes(winnerId) ? false : true;
  rec.winnerAliveAfterPost = !!(w && w.alive);
  rec.winnerHpAfterPost = w ? Math.round(w.hp * 100) / 100 : null;
  return rec;
}

function summarise(rows) {
  const s = {
    matches: rows.length,
    unresolved: rows.filter((r) => r.ending === 'UNRESOLVED').length,
    sameTickWinnerDeath: rows.filter((r) => r.sameTick.deaths.includes(r.winnerId)).length,
    laterAnyHit: rows.filter((r) => r.later.hits.length > 0).length,
    laterHitOnWinner: rows.filter((r) => r.later.hits.some((h) => h.winner)).length,
    laterWinnerDeath: rows.filter((r) => r.later.deaths.some((d) => d.winner)).length,
    laterAnyDeath: rows.filter((r) => r.later.deaths.length > 0).length,
    slot0WinsThenDiesLater: rows.filter((r) => r.winnerId === 0 && r.later.deaths.some((d) => d.id === 0)).length,
    slot0WinsThenHitLater: rows.filter((r) => r.winnerId === 0 && r.later.hits.some((h) => h.target === 0)).length,
    slot0Wins: rows.filter((r) => r.winnerId === 0).length,
    projAtEndMatches: rows.filter((r) => r.projAtEnd > 0).length,
    maxProjLastAliveAfterMs: Math.max(0, ...rows.map((r) => r.projLastAliveAfterMs)),
    maxLaterHitAfterMs: Math.max(0, ...rows.map((r) => r.later.lastHitAfterMs ?? 0)),
    secondMatchEnded: rows.filter((r) => r.later.secondMatchEnded).length,
  };
  return s;
}

function selftest() {
  const arena = loadArena();
  let ok = true;
  const check = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${detail}`); if (!cond) ok = false; };

  // §K — plant a match that has JUST ended with a projectile in flight at the winner.
  const plant = (clear) => {
    const st = createMatch(arena, [{ characterId: 'hamburger', controller: 'ai' }, { characterId: 'taco', controller: 'ai' }]);
    // Fast-forward the countdown with no one moving.
    while (st.phase === 'countdown') stepMatch(st, DT, [null, null]);
    // Find a projectile weapon on taco and fire it at hamburger from 100 wu, then end the match
    // by hand exactly as `applyDamage`'s victor block does, with taco dead.
    const a = st.fighters[0], b = st.fighters[1];
    b.x = a.x + 100; b.y = a.y;
    b.facing = { x: -1, y: 0 };
    const wi = CHARACTERS.taco.weapons.findIndex((w) => w.type === 'ranged' && !w.homing && (w.range ?? 0) >= 120 && (w.damage ?? 0) > 0);
    if (wi < 0) throw new Error('selftest: taco has no projectile weapon');
    // Fire through the real path so the projectile is a real one.
    const evs = [];
    st.fighters[1].lastUsed[wi] = -1e9;
    // attemptAttack via a single AI-free step: drive slot 1 as a human for one tick.
    b.controller = 'human';
    stepMatch(st, 1, [null, { move: { x: 0, y: 0 }, aim: { x: -1, y: 0 }, selectedWeapon: wi, attack: true }]);
    b.controller = 'ai';
    const inFlight = st.projectiles.length;
    // The whistle: taco dies, hamburger wins (what `applyDamage` writes).
    b.hp = 0; b.alive = false; b.deaths = 1;
    st.phase = 'ended'; st.winner = a.role; st.winnerId = a.id;
    a.hp = Math.min(a.hp, 1);
    if (clear) st.projectiles.length = 0;
    const later = { hits: 0, deaths: 0 };
    for (let t = 0; t < 300; t++) {
      for (const ev of stepMatch(st, DT, [null, null])) {
        if (ev.type === 'hit-landed') later.hits++;
        if (ev.type === 'death') later.deaths++;
      }
    }
    return { inFlight, later, winnerAlive: a.alive };
  };
  const k = plant(false);
  check('§K planted projectile exists at the whistle', k.inFlight > 0, `inFlight=${k.inFlight}`);
  check('§K known-bad: post-whistle hit on the winner is SEEN', k.later.hits > 0, JSON.stringify(k.later));
  check('§K known-bad: the winner dies after the whistle', k.later.deaths > 0 && k.winnerAlive === false, `winnerAlive=${k.winnerAlive}`);
  const c = plant(true);
  check('§C control: projectiles cleared at the whistle -> zero post-whistle hits', c.later.hits === 0 && c.later.deaths === 0, JSON.stringify(c.later));
  console.log(ok ? 'SELFTEST OK' : 'SELFTEST FAILED');
  process.exit(ok ? 0 : 1);
}

if (IS_MAIN) {
  if (args.selftest) selftest();
  const arena = loadArena();
  const ns = String(args.n ?? '2,6').split(',').map(Number);
  const limit = args.limit ? Number(args.limit) : Infinity;
  const out = { sim: SIM, dt: DT, postMs: POST_MS, byN: {} };
  for (const n of ns) {
    const rows = [];
    let k = 0;
    for (const p of CHARACTER_IDS) {
      for (const e of CHARACTER_IDS) {
        if (p === e) continue;
        if (k++ >= limit) break;
        const roster = n === 2 ? [p, e] : brawlRoster(p, e, n);
        rows.push(runOne(arena, roster));
      }
    }
    const s = summarise(rows);
    out.byN[n] = { summary: s, rows };
    console.log(`N=${n}`, JSON.stringify(s));
  }
  if (args.json) writeFileSync(String(args.json), JSON.stringify(out, null, 1));
}
