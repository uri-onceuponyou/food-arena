#!/usr/bin/env node
// bh_combat_disposecast — Disposal relocates a fighter MID-WIND-UP, so the wind-up resolves
// somewhere its telegraph was never drawn.
//
// state.ts:ActiveCast: "a telegraph drawn where the caster stands at the press cannot lie about
// where the effect lands" — true only while nothing writes x/y during a cast. movement.ts:stepPush
// calls refusing to displace a `movementLocked` fighter "a CORRECTNESS REQUIREMENT, NOT A BALANCE
// CHOICE" for exactly this reason. `placeFighterAt` (Disposal's positional write, "the only other
// writer of x/y in the sim") has no such refusal. vfx.ts:spawnCastTelegraph draws the telegraph
// ONCE at the `cast-started` position and never reads sim state again.
//
// Setup (N=3; Disposal's own minAlive is 3): seat 0 holds Disposal; seat 1 is a Water Bottle that
// opens Mega Splash (castMs 1400) facing seat 0; seat 2 stands far away. Seat 0 presses Disposal
// 300 ms into the wind-up. We report where the cast started and where the slam resolved.
//
// Usage: node tools/tmp/bh_combat_disposecast.mjs [--root <tree>]
import { loadSim, fixtureArena, seatMatch, input, weaponIndex, argv, DT } from './bh_combat_lib.mjs';

const S = await loadSim(argv('root', undefined));
const MEGA = weaponIndex(S, 'waterbottle', 'Mega');

function run(dispose) {
  const st = seatMatch(S, fixtureArena(), [
    { characterId: 'hamburger', x: 1000, y: 1000, facing: { x: 1, y: 0 }, items: ['disposal'] },
    { characterId: 'waterbottle', x: 1060, y: 1000, facing: { x: -1, y: 0 } },
    { characterId: 'soup', x: 1600, y: 1400 },
  ]);
  const WB = st.fighters[1];
  let castAt = null, firedAt = null, disposedTo = null;
  const hits = [];
  for (let t = 0; t < 2500; t += DT) {
    const ins = [null, null, null];
    if (t === 0) ins[1] = input({ aim: { x: -1, y: 0 }, weapon: MEGA, attack: true });
    if (dispose && Math.abs(t - 300) < DT / 2) ins[0] = input({ aim: { x: 1, y: 0 }, useItem: 0 });
    const evs = S.sim.stepMatch(st, DT, ins);
    for (const e of evs) {
      if (e.type === 'cast-started' && e.fighterId === 1) castAt = { x: WB.x, y: WB.y };
      if (e.type === 'item-hit' && e.itemId === 'disposal') disposedTo = { x: +e.x.toFixed(1), y: +e.y.toFixed(1), castStillOpen: WB.cast !== null };
      if (e.type === 'weapon-fired' && e.fighterId === 1 && e.weaponKey === 'Mega') firedAt = { x: +WB.x.toFixed(1), y: +WB.y.toFixed(1), t: Math.round(t) };
      if (e.type === 'hit-landed' && e.source.weaponKey === 'Mega') hits.push({ seat: e.targetId, amount: e.amount });
    }
  }
  return { castAt, disposedTo, firedAt, hits, moved: castAt && firedAt ? +Math.hypot(firedAt.x - castAt.x, firedAt.y - castAt.y).toFixed(1) : null };
}

const ctl = run(false), sub = run(true);
console.log('CONTROL (no Disposal):', JSON.stringify(ctl));
console.log('SUBJECT (Disposal at 300 ms into the 1400 ms wind-up):', JSON.stringify(sub));
const bug = sub.disposedTo?.castStillOpen && sub.moved > 0;
console.log(bug ? `VERDICT: BUG — the wind-up stayed open through the relocation and resolved ${sub.moved} wu from where its telegraph was drawn.` : 'VERDICT: the cast cannot be relocated.');
process.exit(ctl.moved === 0 ? 0 : 2);
