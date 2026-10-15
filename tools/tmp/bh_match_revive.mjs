#!/usr/bin/env node
/**
 * bh_match_revive — IS A LEFTOVERS RESURRECTION REACHABLE IN A REAL MATCH, AND IS THE
 * RESURRECTED FIGHTER AN ACTIVE ONE?
 *
 * Review-phase probe (2026-10-15, match-lifecycle bug hunt). Read-only on the tree.
 *
 * The render half of the defect is in `game/match.ts` + `characters/types.ts`: a `death`
 * event calls `model.play('death')`, which sets `deathT = 0`; nothing ever sets it back
 * (`play('idle'|'run')` only writes `state`), and `handleEvents` has no `item-revived`
 * case. So a fighter the sim stands back up keeps the topple pose — body rotated ~0.42pi
 * (rig: ~0.48pi) and sunk — for the rest of the match. That half is measured in the
 * browser (`bh_match_browser.mjs` §R). THIS half answers the two questions a reviewer must
 * ask before calling it a bug a player can meet:
 *   1. does a revive actually happen in real play (not just in §42's hand-built fixture)?
 *   2. after it, does the fighter MOVE and FIRE — i.e. is the corpse-pose a body the
 *      player is actively driving around the arena?
 *
 * Seating is the shipped roster path (`brawlRoster`, no `spawn`, the arena's own six).
 * Slot 0 carries `leftovers` (the local seat is the only seat a loadout reaches — bots equip
 * nothing) and is driven by the sim's AI as a stand-in for the human.
 *
 * Control (--selftest): the same corpus WITHOUT the item must produce zero revives — the
 * count comes from the item and nothing else. Known-bad: a hand-built 4-seat kill chain
 * (slot 1 kills slot 0, slot 2 kills slot 1) MUST produce exactly one `item-revived`.
 *
 *   node tools/tmp/bh_match_revive.mjs --selftest
 *   node tools/tmp/bh_match_revive.mjs --n 4,5,6 --json shots/rv/bugs/match/revive.json
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
const { applyDamage } = await import(`${SIM}/combat.ts`);
const { CHARACTER_IDS, CHARACTERS } = await import(`${SIM}/rules.ts`);
const { brawlRoster } = await import(`${SIM}/../ui/screens/brawl.ts`);
const ARENA_PATH = String(args.arena ?? '/private/tmp/fa-rv-head/tools/arena.gameplay.json');
const arena = { ...JSON.parse(readFileSync(ARENA_PATH, 'utf8')), build: () => null, update: () => {} };
const DT = 16.667;
const HARD_CAP = 150000 * 1.6 + 20000;

function runOne(roster, withItem) {
  const cfgs = roster.map((characterId, slot) => ({
    characterId, controller: 'ai',
    ...(slot === 0 && withItem ? { items: ['leftovers'] } : {}),
  }));
  const st = createMatch(arena, cfgs);
  const inputs = new Array(st.fighters.length).fill(null);
  const rec = { roster, revived: false, revivedAtMs: null, movedAfterWu: 0, firedAfter: 0, hitsDealtAfter: 0,
    diedAgain: false, place0: null, winnerId: null, deaths0: 0 };
  let last = null;
  while (st.phase !== 'ended' && st.elapsed < HARD_CAP) {
    const evs = stepMatch(st, DT, inputs);
    const f0 = st.fighters[0];
    if (rec.revived && f0.alive && last) {
      rec.movedAfterWu += Math.hypot(f0.x - last.x, f0.y - last.y);
    }
    last = { x: f0.x, y: f0.y };
    for (const ev of evs) {
      if (ev.type === 'item-revived' && ev.fighterId === 0) { rec.revived = true; rec.revivedAtMs = Math.round(st.elapsed); }
      if (!rec.revived) continue;
      if (ev.type === 'weapon-fired' && ev.fighterId === 0) rec.firedAfter++;
      if (ev.type === 'hit-landed' && ev.source.kind === 'weapon' && ev.source.attackerId === 0) rec.hitsDealtAfter++;
      if (ev.type === 'death' && ev.fighterId === 0) rec.diedAgain = true;
      if (ev.type === 'match-ended') rec.winnerId = ev.winnerId;
    }
  }
  rec.deaths0 = st.fighters[0].deaths;
  rec.movedAfterWu = Math.round(rec.movedAfterWu);
  if (rec.winnerId === null) rec.winnerId = st.winnerId;
  return rec;
}

function corpus(n, withItem, limit = Infinity) {
  const rows = [];
  let k = 0;
  for (const p of CHARACTER_IDS) for (const e of CHARACTER_IDS) {
    if (p === e || k++ >= limit) continue;
    rows.push(runOne(brawlRoster(p, e, n), withItem));
  }
  const rev = rows.filter((r) => r.revived);
  return {
    n, withItem, matches: rows.length, revives: rev.length,
    revivedThenMoved: rev.filter((r) => r.movedAfterWu > 50).length,
    revivedThenFired: rev.filter((r) => r.firedAfter > 0).length,
    revivedThenWon: rev.filter((r) => r.winnerId === 0).length,
    medianMovedAfterWu: rev.length ? rev.map((r) => r.movedAfterWu).sort((a, b) => a - b)[Math.floor(rev.length / 2)] : null,
    rows: rev,
  };
}

function selftest() {
  let ok = true;
  const check = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${detail}`); if (!cond) ok = false; };
  // Known-bad: the hand-built kill chain MUST revive slot 0.
  const st = createMatch(arena, ['hamburger', 'donut', 'taco', 'egg'].map((characterId, i) => ({
    characterId, controller: 'ai', ...(i === 0 ? { items: ['leftovers'] } : {}),
  })));
  while (st.phase === 'countdown') stepMatch(st, DT, [null, null, null, null]);
  const src = (attackerId) => ({ kind: 'weapon', weaponKey: CHARACTERS[st.fighters[attackerId].characterId].weapons[0].key,
    weaponName: 'x', attackerId });
  const evs = [];
  applyDamage(st, st.fighters[0], 9999, null, src(1), evs);   // slot 1 kills slot 0
  applyDamage(st, st.fighters[1], 9999, null, src(2), evs);   // slot 2 kills slot 1 -> slot 0 gets up
  const revived = evs.filter((e) => e.type === 'item-revived');
  check('known-bad: a 4-seat kill chain revives the Leftovers holder', revived.length === 1 && st.fighters[0].alive,
    `item-revived x${revived.length}, alive=${st.fighters[0].alive}, hp=${st.fighters[0].hp}`);
  check('the match is still live after the revive', st.phase === 'playing', st.phase);
  // Control: no item, no revive, over a real corpus slice.
  const ctl = corpus(4, false, 22);
  check('control: no item -> zero revives in 22 real 4-seat matches', ctl.revives === 0, `revives=${ctl.revives}`);
  console.log(ok ? 'SELFTEST OK' : 'SELFTEST FAILED');
  process.exit(ok ? 0 : 1);
}

if (IS_MAIN) {
  if (args.selftest) selftest();
  const ns = String(args.n ?? '4,6').split(',').map(Number);
  const limit = args.limit ? Number(args.limit) : Infinity;
  const out = { sim: SIM, byN: {} };
  for (const n of ns) {
    const c = corpus(n, true, limit);
    out.byN[n] = c;
    const { rows, ...s } = c;
    console.log(`N=${n}`, JSON.stringify(s));
  }
  if (args.json) writeFileSync(String(args.json), JSON.stringify(out, null, 1));
}
