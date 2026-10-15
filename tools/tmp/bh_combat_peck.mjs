#!/usr/bin/env node
// bh_combat_peck — Egg's Hatch! keeps pecking its victim from wherever the chick LANDED.
//
// sim.ts:stepProjectiles' peck branch (grep `if (w.peckHits && p.arrived)`) applies
// `applyDamage(target, …)` every `peckInterval` with NO distance test, and never moves the
// projectile: `p.x/p.y` stay at the strike point. `vfx.ts` draws every live projectile at
// `p.x/p.y` (grep `syncPool<Projectile>(`), so the chick is drawn where it hit while the pecks
// land on a victim that has walked away. Card: "a chick bursts out, pecking for damage".
//
// Arms: STILL — the victim stands still after the hit (control: pecks land at distance ~hit
// radius). RUN — the victim runs away at full speed right after the first hit.
//
// Usage: node tools/tmp/bh_combat_peck.mjs [--root <tree>]
import { loadSim, fixtureArena, seatMatch, input, weaponIndex, argv, DT } from './bh_combat_lib.mjs';

const S = await loadSim(argv('root', undefined));

function run(victimRuns) {
  const st = seatMatch(S, fixtureArena(), [
    { characterId: 'egg', x: 1000, y: 1000, facing: { x: 1, y: 0 } },
    { characterId: 'sushi', x: 1100, y: 1000 },
  ]);
  const wi = weaponIndex(S, 'egg', 'Hatch');
  const V = st.fighters[1];
  let struck = false;
  const pecks = [];
  let lastChick = null;
  for (let t = 0; t < 3000; t += DT) {
    const live = st.projectiles.find((q) => q.weapon.key === 'Hatch');
    if (live) lastChick = { x: live.x, y: live.y };
    const evs = S.sim.stepMatch(st, DT, [
      input({ aim: { x: 1, y: 0 }, weapon: wi, attack: t === 0 }),
      struck && victimRuns ? input({ move: { x: 1, y: 0 } }) : null,
    ]);
    for (const e of evs) {
      if (e.type === 'hit-landed' && e.targetId === 1 && e.source.weaponKey === 'Hatch') {
        // The chick is drawn at the projectile's position; on the final peck the projectile is
        // removed in the same step, so its last drawn position (start of this step) is used.
        const p = st.projectiles.find((q) => q.weapon.key === 'Hatch') ?? lastChick;
        pecks.push({ t: Math.round(t), amount: e.amount, chickToVictim: p ? +Math.hypot(V.x - p.x, V.y - p.y).toFixed(1) : null, hitRadius: V.hitRadius });
        struck = true;
      }
    }
  }
  return pecks;
}

const still = run(false), runAway = run(true);
console.log('STILL victim:', JSON.stringify(still));
console.log('RUN   victim:', JSON.stringify(runAway));
const far = runAway.filter((p) => typeof p.chickToVictim === 'number' && p.chickToVictim > p.hitRadius);
console.log(`pecks landing while the drawn chick is farther than the victim's hit radius: ${far.length} of ${runAway.length}`);
console.log(far.length ? 'VERDICT: pecks land at a distance from the drawn projectile (latched, position never follows).' : 'VERDICT: pecks only land in contact.');
