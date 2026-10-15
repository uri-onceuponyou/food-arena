#!/usr/bin/env node
// bh_combat_ratedt — periodic damage/heal timers that RESET to 0 on fire (fog, pot, regen) drop
// the remainder, so their real rate depends on the dt the caller steps with. The shipped loop's
// hit-stop catch-up produces 66.7 ms steps at 60 fps, 133 ms at 30 fps, 200 ms at 20 fps.
// Measures HP/s for: the ring fog (fogTimer), the pot (hazardTimers), regen (regenTimer).
// Usage: node tools/tmp/bh_combat_ratedt.mjs [--root <tree>]
import { loadSim, fixtureArena, seatMatch, argv } from './bh_combat_lib.mjs';
const S = await loadSim(argv('root', undefined));
const R = S.rules;
function rate(kind, dt) {
  const arena = kind === 'fog' ? fixtureArena({ maxSafeRadius: 10 }) : kind === 'pot'
    ? fixtureArena({ hazards: [{ x: 1000, y: 1000, radius: 95, kind: 'damage', damage: 8, tickMs: 250 }] })
    : fixtureArena();
  const st = seatMatch(S, arena, [
    { characterId: 'pizza', x: kind === 'fog' ? 1500 : 1000, y: 1000, maxHp: 100000 },
    { characterId: 'soup', x: 1900, y: 1900, maxHp: 100000 },
    { characterId: 'egg', x: 100, y: 1900, maxHp: 100000 },
  ]);
  if (kind === 'fog') st.safeRadius = 10;   // stepMatch recomputes it from the schedule — pin below
  const F = st.fighters[0];
  if (kind === 'regen') { F.hp = 1000; F.lastDamagedAt = -1e9; }
  const h0 = F.hp, T = 12000;
  for (let t = 0; t < T; t += dt) {
    S.sim.stepMatch(st, dt, [null, null, null]);
    if (kind === 'fog') { st.safeRadius = 10; }
  }
  return Math.abs(F.hp - h0) / (T / 1000);
}
for (const kind of ['fog', 'pot', 'regen']) {
  const nominal = kind === 'fog' ? R.FOG_DAMAGE * 1000 / R.FOG_TICK_MS : kind === 'pot' ? 8 * 1000 / 250 : R.REGEN_AMOUNT * 1000 / R.REGEN_TICK_MS;
  const row = [16.667, 33.333, 66.667, 100, 133.333, 200].map((dt) => `${dt.toFixed(0)}ms:${rate(kind, dt).toFixed(2)}`);
  console.log(`${kind.padEnd(5)} nominal ${nominal.toFixed(2)} HP/s  measured ${row.join('  ')}`);
}
