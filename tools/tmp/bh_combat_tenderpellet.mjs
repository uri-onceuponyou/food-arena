#!/usr/bin/env node
// bh_combat_tenderpellet — Tenderiser counts every PELLET as a "consecutive attack". Uri's words:
// "each consecutive ATTACK on the same character increases the damage by 1.3 up to x6"; the card
// says "Every hit on the same target hits harder than the last". A 5-pellet press is five hits, so
// one press climbs five rungs. DESIGN question (attack vs hit), quantified here.
// Usage: node tools/tmp/bh_combat_tenderpellet.mjs [--root <tree>]
import { loadSim, fixtureArena, seatMatch, input, weaponIndex, argv, DT } from './bh_combat_lib.mjs';
const S = await loadSim(argv('root', undefined));
for (const [char, key] of [['donut', 'Sprinkles'], ['sushi', 'Rice'], ['taco', 'Filling']]) {
  for (const items of [[], ['tenderiser']]) {
    const st = seatMatch(S, fixtureArena(), [
      { characterId: char, x: 1000, y: 1000, facing: { x: 1, y: 0 }, items },
      { characterId: 'pizza', x: 1030, y: 1000, maxHp: 10000 },
      { characterId: 'soup', x: 1800, y: 1800 },
    ]);
    const wi = weaponIndex(S, char, key);
    const w = S.rules.CHARACTERS[char].weapons[wi];
    const perPress = [];
    for (let press = 0; press < 2; press++) {
      let sum = 0;
      const t0 = st.elapsed;
      for (let t = 0; t < w.cooldown + 300; t += DT) {
        const evs = S.sim.stepMatch(st, DT, [input({ aim: { x: 1, y: 0 }, weapon: wi, attack: t === 0 }), null, null]);
        for (const e of evs) if (e.type === 'hit-landed' && e.targetId === 1) sum += e.amount;
      }
      perPress.push(+sum.toFixed(2));
    }
    console.log(`${char}.${key} (${w.pellets ?? 1} x ${w.damage})  items=${JSON.stringify(items)}  press1=${perPress[0]} press2=${perPress[1]}`);
  }
}
