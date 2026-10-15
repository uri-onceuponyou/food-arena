#!/usr/bin/env node
// bh_combat_corpus — real AI-vs-AI matches on the shipped kitchen, instrumented for the combat
// review. Every seat is the sim's own `ai.ts` (N-aware, symmetric), exactly as `nf_ffa` drives
// it. After `match-ended` the probe KEEPS STEPPING for `--post` ms, because that is what
// `match.ts:GameSession.loop` does: it calls `stepMatch` every frame regardless of phase, and the
// result card is drawn over a sim that is still running.
//
// What it counts (all EXACT — the sim has no RNG):
//   * post-end damage: `hit-landed` events in ticks AFTER the one that emitted `match-ended`,
//     and `death` events among them — split by whether the victim is the DECLARED WINNER;
//   * same-tick winner deaths: the declared winner dies inside the very tick that named it;
//   * Shiitake overkill: reflected amount vs what the victim actually lost (needs --items);
//   * Ring Spin swings that land while Donut stands on its own trail (the missing boost).
//
// Usage:
//   node tools/tmp/bh_combat_corpus.mjs --n 2 [--post 3000] [--items shiitake] [--root <tree>]
//   node tools/tmp/bh_combat_corpus.mjs --n 6 --rosters 60 [--post 3000]
import { loadSim, kitchenArena, argv } from './bh_combat_lib.mjs';
import { writeFileSync } from 'node:fs';

const S = await loadSim(argv('root', undefined));
const { CHARACTER_IDS, CHARACTERS, MATCH_DURATION_MS } = S.rules;
const N = Number(argv('n', 2));
const POST_MS = Number(argv('post', 3000));
const ITEMS = argv('items', '') ? String(argv('items')).split(',') : [];
const ROSTERS = Number(argv('rosters', 60));
const DT = Number(argv('dt', 16.667));
const OUT = argv('out', null);
const CAP = MATCH_DURATION_MS * 1.6 + 20000;
const arena = kitchenArena();

function rosterList() {
  const ids = CHARACTER_IDS;
  const out = [];
  if (N === 2) {
    for (const a of ids) for (const b of ids) if (a !== b) out.push([a, b]);
    return out;
  }
  // Every C(11, N) combination, evenly subsampled to ROSTERS distinct rosters, each rotated by
  // its own index so no character is pinned to one seat (kitchen spawns are fixed, not a ring).
  const combos = [];
  const rec = (start, acc) => {
    if (acc.length === N) { combos.push(acc.slice()); return; }
    for (let i = start; i < ids.length; i++) { acc.push(ids[i]); rec(i + 1, acc); acc.pop(); }
  };
  rec(0, []);
  const step = combos.length / Math.min(ROSTERS, combos.length);
  for (let r = 0; r < Math.min(ROSTERS, combos.length); r++) {
    const c = combos[Math.floor(r * step)];
    const rot = r % N;
    out.push(c.slice(rot).concat(c.slice(0, rot)));
  }
  return out;
}

function runOne(roster) {
  const configs = roster.map((characterId, i) => ({
    characterId, controller: 'ai',
    spawn: N === 2 ? undefined : { x: arena.spawns[i].x, y: arena.spawns[i].y },
    items: ITEMS.length ? ITEMS : undefined,
  }));
  const st = S.sim.createMatch(arena, configs);
  const inputs = new Array(N).fill(null);
  let endTick = -1, tick = 0, endedAt = null;
  const r = {
    roster: roster.join('>'), winnerId: null, sameTickWinnerDeath: false, sameTickCause: null,
    postHits: 0, postHitsOnWinner: 0, postDeaths: 0, postWinnerDeath: false, postLastHitMs: 0, postHitSources: {},
    overkillReflects: 0, overkillExcess: 0, reflects: 0,
    ringOnTrail: 0, ringHits: 0,
    disposals: 0, disposalsInsideCover: 0, frozenVictims: 0, posthumousKills: 0, posthumousKillsOfLeftovers: 0,
  };
  const trapped = new Map(); // victim id -> {x,y,since}
  let lastVictimLoss = null; // for pairing a reflection with the hit it mirrors
  while (st.elapsed < CAP) {
    const hpBefore = st.fighters.map((f) => f.hp);
    // Ring Spin on-trail census: is Donut on its own trail at the instant it could swing?
    const donutOnTrail = st.fighters.map((f) => f.characterId === 'donut' && S.combat.isOnOwnTrail(st, f));
    const evs = S.sim.stepMatch(st, DT, inputs);
    tick++;
    const ended = endTick >= 0;
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      if (e.type === 'match-ended' && endTick < 0) {
        endTick = tick; endedAt = st.elapsed; r.winnerId = e.winnerId;
        // anything AFTER this event in the same tick that kills the winner?
        for (let j = i + 1; j < evs.length; j++) {
          const f = evs[j];
          if (f.type === 'death' && f.fighterId === e.winnerId) {
            r.sameTickWinnerDeath = true;
            const prevHit = evs.slice(i + 1, j).reverse().find((h) => h.type === 'hit-landed' && h.targetId === e.winnerId);
            r.sameTickCause = prevHit ? (prevHit.source.itemId ? `item:${prevHit.source.itemId}` : prevHit.source.kind + (prevHit.source.weaponKey ? `:${prevHit.source.weaponKey}` : '')) : 'unknown';
          }
        }
      }
      if (e.type === 'hit-landed') {
        const s = e.source;
        if (s.kind === 'weapon' && s.itemId === 'shiitake') {
          r.reflects++;
          if (lastVictimLoss && lastVictimLoss.amount > lastVictimLoss.lost + 1e-9) {
            r.overkillReflects++;
            r.overkillExcess += e.amount - lastVictimLoss.lost;
          }
        } else {
          lastVictimLoss = { amount: e.amount, lost: hpBefore[e.targetId] - st.fighters[e.targetId].hp };
        }
        if (s.kind === 'weapon' && !s.itemId) {
          const att = st.fighters[s.attackerId];
          if (att && att.characterId === 'donut' && s.weaponKey === 'Ring') {
            r.ringHits++;
            if (donutOnTrail[s.attackerId]) r.ringOnTrail++;
          }
        }
        if (ended) {
          r.postHits++;
          if (e.targetId === r.winnerId) r.postHitsOnWinner++;
          r.postLastHitMs = Math.max(r.postLastHitMs, st.elapsed - endedAt);
          const key = s.kind === 'weapon' ? (s.itemId ? `item:${s.itemId}` : `weapon:${s.weaponKey}`) : s.kind;
          r.postHitSources[key] = (r.postHitSources[key] ?? 0) + 1;
        }
      }
      if (e.type === 'item-hit' && e.itemId === 'disposal') {
        r.disposals++;
        const v = st.fighters[e.targetId];
        const size = v.size;
        if (arena.cover.some((o) => S.movement.boxesOverlap(v.x, v.y, size, size, o.x, o.y, o.w, o.h))) { r.disposalsInsideCover++; trapped.set(v.id, { x: v.x, y: v.y, since: st.elapsed, aliveUntil: st.elapsed, freed: false }); }
      }
      if (e.type === 'death') {
        // a kill credited to a fighter that was ALREADY dead (projectile / peck still in flight)
        const prevHit = evs.slice(0, i).reverse().find((h) => h.type === 'hit-landed' && h.targetId === e.fighterId);
        const att = prevHit && prevHit.source.kind === 'weapon' ? st.fighters[prevHit.source.attackerId] : null;
        if (att && att.id !== e.fighterId && att.deaths > 0 && !att.alive) {
          r.posthumousKills++;
          if (st.fighters[e.fighterId].item.revivesLeft > 0) r.posthumousKillsOfLeftovers++;
        }
      }
      if (e.type === 'death' && ended) {
        r.postDeaths++;
        if (e.fighterId === r.winnerId) r.postWinnerDeath = true;
      }
    }
    for (const [vid, tp] of trapped) {
      const v = st.fighters[vid];
      if (tp.freed || !v.alive) continue;
      if (Math.hypot(v.x - tp.x, v.y - tp.y) > 0.5) tp.freed = true; else tp.aliveUntil = st.elapsed;
    }
    if (endTick >= 0 && st.elapsed - endedAt >= POST_MS) break;
  }
  for (const [, tp] of trapped) if (!tp.freed && tp.aliveUntil - tp.since >= 2000) r.frozenVictims++;
  r.endedAtMs = endedAt;
  r.winnerAliveAtEnd = r.winnerId !== null ? st.fighters[r.winnerId].alive : null;
  return r;
}

const rosters = rosterList();
const rows = [];
const t0 = Date.now();
for (const ro of rosters) rows.push(runOne(ro));
const sum = (f) => rows.reduce((a, r) => a + f(r), 0);
const count = (f) => rows.filter(f).length;
const agg = {
  N, matches: rows.length, items: ITEMS, postMs: POST_MS,
  unresolved: count((r) => r.winnerId === null),
  matchesWithPostEndHits: count((r) => r.postHits > 0),
  postEndHits: sum((r) => r.postHits),
  matchesWithPostEndHitsOnWinner: count((r) => r.postHitsOnWinner > 0),
  winnerKilledAfterEnd: count((r) => r.postWinnerDeath),
  winnerKilledSameTick: count((r) => r.sameTickWinnerDeath),
  winnerDeadAfterPost: count((r) => r.winnerAliveAtEnd === false),
  maxPostHitDelayMs: Math.max(0, ...rows.map((r) => r.postLastHitMs)),
  postHitSources: rows.reduce((a, r) => { for (const [k, v] of Object.entries(r.postHitSources)) a[k] = (a[k] ?? 0) + v; return a; }, {}),
  sameTickCauses: rows.filter((r) => r.sameTickWinnerDeath).reduce((a, r) => { a[r.sameTickCause] = (a[r.sameTickCause] ?? 0) + 1; return a; }, {}),
  reflects: sum((r) => r.reflects), overkillReflects: sum((r) => r.overkillReflects), overkillExcessHp: +sum((r) => r.overkillExcess).toFixed(2),
  ringHits: sum((r) => r.ringHits), ringHitsOnOwnTrail: sum((r) => r.ringOnTrail),
  disposals: sum((r) => r.disposals), disposalsInsideCover: sum((r) => r.disposalsInsideCover), disposalVictimsNeverMovedAgain: sum((r) => r.frozenVictims),
  matchesWithAFrozenVictim: count((r) => r.frozenVictims > 0),
  posthumousKills: sum((r) => r.posthumousKills), posthumousKillsOfLeftoversHolders: sum((r) => r.posthumousKillsOfLeftovers),
  wallSeconds: +((Date.now() - t0) / 1000).toFixed(1),
};
console.log(JSON.stringify(agg, null, 2));
const ex = rows.filter((r) => r.postWinnerDeath || r.sameTickWinnerDeath).slice(0, 8);
if (ex.length) console.log('examples:', JSON.stringify(ex.map((r) => ({ roster: r.roster, winner: r.winnerId, sameTick: r.sameTickWinnerDeath && r.sameTickCause, postDeath: r.postWinnerDeath, src: r.postHitSources })), null, 0));
if (OUT) writeFileSync(String(OUT), JSON.stringify({ agg, rows }, null, 1));
