#!/usr/bin/env node
/**
 * BH_AI_TRACE — print one bot's decision inputs, tick by tick, inside one six-seat census
 * match of `bh_ai_six.mjs` (same roster/rotation/spawn construction). Read-only.
 *
 *   node tools/tmp/bh_ai_trace.mjs --roster 0 --rot 3 --bot 4 --from 15000 --to 22000 [--every 10]
 */
import { readFileSync } from 'node:fs';

const args = (() => {
  const out = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) continue;
    const k = a[i].slice(2);
    out[k] = a[i + 1] !== undefined && !a[i + 1].startsWith('--') ? a[++i] : true;
  }
  return out;
})();
const SIM = String(args.sim ?? '/private/tmp/fa-rv-head/src/game');
const { createMatch, stepMatch } = await import(`${SIM}/sim.ts`);
const R = await import(`${SIM}/rules.ts`);
const S = await import(`${SIM}/state.ts`);
const M = await import(`${SIM}/movement.ts`);
const AI = await import(`${SIM}/ai.ts`);
const RAW = JSON.parse(readFileSync(String(args.arena ?? '/private/tmp/fa-rv-head/tools/arena.gameplay.json'), 'utf8'));
const ARENA = { ...RAW, build: () => null, update: () => {} };
const DT = Number(args.dt ?? 16.667);
const N = Number(args.n ?? 6);
const ids = R.CHARACTER_IDS;
const ri = Number(args.roster ?? 0);
const rot = Number(args.rot ?? 0);
const BOT = Number(args.bot ?? 1);
const FROM = Number(args.from ?? 0);
const TO = Number(args.to ?? 1e9);
const EVERY = Number(args.every ?? 6);
const roster = Array.from({ length: N }, (_, j) => ids[(ri + j) % ids.length]);
const configs = roster.map((_, seat) => ({ characterId: roster[(seat + rot) % roster.length], controller: 'ai', spawn: ARENA.spawns[seat] }));
const st = createMatch(ARENA, configs);
console.log('seats', configs.map((c, i) => `${i}:${c.characterId}`).join(' '));
const inputs = new Array(N).fill(null);
let k = 0;
const f2 = (v) => Math.round(v);
while (st.phase !== 'ended' && st.elapsed < 200000) {
  const f = st.fighters[BOT];
  const now = st.elapsed;
  let line = null;
  if (st.phase === 'playing' && f.alive && now >= FROM && now <= TO && k % EVERY === 0) {
    const tgt = S.nearestLivingOpponent(st, f);
    const vis = tgt ? M.isVisibleFrom(f.x, f.y, tgt.x, tgt.y, st.arena, st, tgt) : null;
    const cell = tgt ? st.sightings[S.sightingIndex(f.id, tgt.id, N)] : null;
    const dc = Math.hypot(f.x - ARENA.center.x, f.y - ARENA.center.y);
    const kits = st.medikits.map((m) => `${f2(Math.hypot(m.x - f.x, m.y - f.y))}wu exp${f2(m.expiresAt - now)}`).join(',');
    const fleeing = f.hp < f.maxHp * R.AI_FLEE_HP_FRACTION;
    line = `t=${f2(now)} pos=(${f2(f.x)},${f2(f.y)}) hp=${f.hp.toFixed(1)}/${f.maxHp.toFixed(0)}${fleeing ? ' FLEE' : ''} tgt=${tgt?.id}${tgt ? `(${f2(tgt.x)},${f2(tgt.y)}) sep=${f2(Math.hypot(tgt.x - f.x, tgt.y - f.y))} vis=${vis} belief=(${f2(cell.x)},${f2(cell.y)})@${f2(cell.at)}` : ''} dC=${f2(dc)} R=${f2(st.safeRadius)} kits=[${kits}] lock=${S.movementLocked(f, now)} slow=${now < f.status.slowedUntil} push=${f.push?.remaining?.toFixed?.(1)}`;
  }
  const pre = { x: st.fighters[BOT].x, y: st.fighters[BOT].y };
  const ev = stepMatch(st, DT, inputs);
  k++;
  if (line) {
    const pressed = ev.filter((e) => (e.type === 'weapon-fired' || e.type === 'cast-started') && e.fighterId === BOT).map((e) => e.weaponKey);
    const moved = Math.hypot(st.fighters[BOT].x - pre.x, st.fighters[BOT].y - pre.y);
    console.log(`${line} moved=${moved.toFixed(2)}${pressed.length ? ' PRESS ' + pressed.join('+') : ''}`);
  }
}
console.log('end', st.phase, 'winner', st.winnerId, 'elapsed', f2(st.elapsed));
