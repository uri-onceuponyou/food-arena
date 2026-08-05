#!/usr/bin/env node
/**
 * BEFORE/AFTER A/B — HEAD's sim.ts + combat.ts against the working tree's, both driven
 * by the SAME rules.ts, the same arena and the same scripted player.
 *
 * Staged by:
 *   rm -rf /tmp/simab && mkdir -p /tmp/simab/game /tmp/simab/arena
 *   cp src/game/*.ts /tmp/simab/game/ ; cp src/arena/types.ts /tmp/simab/arena/
 *   git show HEAD:src/game/sim.ts    > /tmp/simab/game/sim.ts
 *   git show HEAD:src/game/combat.ts > /tmp/simab/game/combat.ts
 *
 * Holding rules.ts constant across both sides is the point: it isolates the LOGIC
 * change (trail cap, melee cone, timeout, ring floor) from the CONSTANT change
 * (45 s clock), which are two separate claims and were measured separately.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const NEW = await import(`${ROOT}/src/game/sim.ts`);
const OLD = await import('/tmp/simab/game/sim.ts');
const R = await import(`${ROOT}/src/game/rules.ts`);
const ARENA_DATA = JSON.parse(readFileSync(`${ROOT}/tools/arena.gameplay.json`, 'utf8'));

const HALF_DIAG = Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2);
const maxSafeRadius = Math.round(HALF_DIAG / (1 - 6000 / R.MATCH_DURATION_MS));
const arena = { ...ARENA_DATA, maxSafeRadius, build: () => null, update: () => {} };

const DT = 16.667;
const IDS = R.CHARACTER_IDS;
const noInput = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function makeChasePolicy() {
  let flip = 1, lastCheck = 0, lastPos = null;
  return (st) => {
    const p = st.player, e = st.enemy;
    const d = dist(p, e);
    let best = null, bestDmg = -Infinity;
    R.CHARACTERS[p.characterId].weapons.forEach((w, i) => {
      if (w.type === 'self') return;
      if (st.elapsed - p.lastUsed[i] < w.cooldown) return;
      if (d > (w.range ?? Infinity)) return;
      if ((w.damage ?? 0) > bestDmg) { bestDmg = w.damage ?? 0; best = i; }
    });
    if (st.elapsed - lastCheck > 1200) {
      if (lastPos && Math.hypot(p.x - lastPos.x, p.y - lastPos.y) < 40) flip = -flip;
      lastPos = { x: p.x, y: p.y }; lastCheck = st.elapsed;
    }
    const ang = Math.atan2(e.y - p.y, e.x - p.x) + (flip < 0 ? Math.PI / 2 : 0);
    const q = (v) => (v > 0.35 ? 1 : v < -0.35 ? -1 : 0);
    return {
      move: { x: q(Math.cos(ang)), y: q(Math.sin(ang)) },
      aim: { x: e.x - p.x, y: e.y - p.y },
      selectedWeapon: best ?? 0,
      attack: best !== null,
    };
  };
}

function measure(mod, label) {
  let worstTick = 0, worstTickEvents = 0, worstSecond = 0, totalTrail = 0;
  let meleeHits = 0, meleeHitsCoincident = 0, trailMatches = 0;
  let lens = [], playerWins = 0, noEnd = 0, fogDmg = 0, allDmg = 0;

  for (const p of IDS) {
    for (const e of IDS) {
      if (p === e) continue;
      const st = mod.createMatch(arena, p, e);
      const decide = makeChasePolicy();
      let input = noInput, since = Infinity;
      const win = [];
      const isTrail = p === 'donut' || e === 'donut';
      if (isTrail) trailMatches++;
      while (st.phase !== 'ended' && st.elapsed < R.MATCH_DURATION_MS + 30_000) {
        if (since >= 150) { input = decide(st); since = 0; }
        const d0 = dist(st.player, st.enemy);
        const preP = { ...st.player }, preE = { ...st.enemy };
        const evs = mod.stepMatch(st, DT, input);
        since += DT;

        let tickTrail = 0, tickTrailEvents = 0;
        for (const ev of evs) {
          if (ev.type !== 'hit-landed') continue;
          allDmg += ev.amount;
          if (ev.source.kind === 'fog') fogDmg += ev.amount;
          if (ev.source.kind === 'trail') { tickTrail += ev.amount; tickTrailEvents++; }
          if (ev.source.kind === 'weapon') {
            const owner = ev.targetRole === 'enemy' ? preP : preE;
            const w = R.CHARACTERS[owner.characterId].weapons.find((ww) => ww.key === ev.source.weaponKey);
            if (w && w.type === 'melee') { meleeHits++; if (d0 < 1e-6) meleeHitsCoincident++; }
          }
        }
        totalTrail += tickTrail;
        if (tickTrail > worstTick) { worstTick = tickTrail; worstTickEvents = tickTrailEvents; }
        win.push({ t: st.elapsed, d: tickTrail });
        while (win.length && st.elapsed - win[0].t > 1000) win.shift();
        worstSecond = Math.max(worstSecond, win.reduce((a, w) => a + w.d, 0));
      }
      lens.push(R.MATCH_DURATION_MS - st.timeRemaining);
      if (st.phase !== 'ended') noEnd++;
      else if (st.winner === 'player') playerWins++;
    }
  }
  lens.sort((a, b) => a - b);
  return {
    label, worstTick, worstTickEvents, worstSecond,
    trailPerMatch: totalTrail / trailMatches,
    meleeHits, meleeHitsCoincident,
    meanLen: lens.reduce((a, b) => a + b, 0) / lens.length,
    maxLen: lens[lens.length - 1],
    playerWinPct: (playerWins / lens.length) * 100,
    noEnd, fogShare: (fogDmg / allDmg) * 100,
  };
}

const a = measure(OLD, 'HEAD');
const b = measure(NEW, 'fixed');

console.log(`\n══ A/B: HEAD's sim.ts+combat.ts vs the fix ══  same rules.ts (clock ${R.MATCH_DURATION_MS / 1000}s), ` +
  `same arena (maxSafeRadius ${maxSafeRadius}), same scripted player, 110 matchups each\n`);
const row = (name, f, unit = '') =>
  console.log(`   ${name.padEnd(46)} ${String(f(a)).padStart(10)} ${unit.padEnd(6)} -> ${String(f(b)).padStart(10)} ${unit}`);
row('WORST single-tick trail damage', (r) => r.worstTick.toFixed(0), 'HP');
row('  ...hit events in that tick', (r) => r.worstTickEvents);
row('WORST 1-second trail damage', (r) => r.worstSecond.toFixed(0), 'HP/s');
row('trail damage per donut match', (r) => r.trailPerMatch.toFixed(1), 'HP');
row('melee hits landed', (r) => r.meleeHits);
row('  ...of those, at EXACTLY zero separation', (r) => r.meleeHitsCoincident);
row('matches that never ended', (r) => r.noEnd);
row('mean match length', (r) => (r.meanLen / 1000).toFixed(1), 's');
row('longest match', (r) => (r.maxLen / 1000).toFixed(1), 's');
row('player win rate', (r) => r.playerWinPct.toFixed(1), '%');
row('closing fog share of all damage', (r) => r.fogShare.toFixed(1), '%');
console.log('');
