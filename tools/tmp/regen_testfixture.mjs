#!/usr/bin/env node
/** Dry-run of the assertion I intend to add to sim.test.mjs, on its OWN synthetic
 *  fixture (never the shipped arena — see sim.test.mjs section 14's note on why). */
import { resolve } from 'node:path';
const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const SIM = String(process.argv[2] ?? `${ROOT}/src/game`);
const { createMatch, stepMatch } = await import(`${SIM}/sim.ts`);
const R = await import(`${SIM}/rules.ts`);

function makeArena({ cover = [], hazards = [], width = 1400, height = 1000, maxSafeRadius = 993 } = {}) {
  return { id: 'test-fixture', displayName: 'Test Fixture Arena', width, height,
    center: { x: width / 2, y: height / 2 }, maxSafeRadius,
    playerSpawn: { x: 200, y: 200 }, enemySpawn: { x: width - 200, y: height - 200 },
    cover, hazards, build() { return {}; } };
}
const arena = makeArena({ cover: [
  { x: 500, y: 500, w: 180, h: 60 },
  { x: 900, y: 500, w: 180, h: 60 },
  { x: 700, y: 260, w: 60, h: 180 },
  { x: 700, y: 740, w: 60, h: 180 },
] });

/** Fight, then break contact — the behaviour out-of-combat regen exists to reward. */
function hitAndRun() {
  return (st) => {
    const p = st.player, e = st.enemy;
    const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
    const ws = R.CHARACTERS[p.characterId].weapons;
    let slot = null, bestDmg = -Infinity;
    ws.forEach((w, i) => {
      if (w.type === 'self') return;
      if (st.elapsed - p.lastUsed[i] < w.cooldown) return;
      if (d > (w.range ?? Infinity)) return;
      if ((w.damage ?? 0) > bestDmg) { bestDmg = w.damage ?? 0; slot = i; }
    });
    // Close while healthy, disengage while hurt. Deterministic, no RNG.
    const hurt = p.hp < p.maxHp * 0.7;
    const sgn = hurt ? -1 : 1;
    const q = (v) => (v > 0.35 ? 1 : v < -0.35 ? -1 : 0);
    return { move: { x: q((sgn * (e.x - p.x)) / d), y: q((sgn * (e.y - p.y)) / d) },
      aim: { x: e.x - p.x, y: e.y - p.y }, selectedWeapon: slot ?? 0, attack: slot !== null && !hurt };
  };
}

let fightersWithRegen = 0, totalFighters = 0, regenHp = 0, matches = 0;
for (const id of R.CHARACTER_IDS) {
  const st = createMatch(arena, id, 'donut');
  const act = hitAndRun();
  const got = { player: 0, enemy: 0 };
  let since = Infinity, input = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  while (st.phase !== 'ended' && st.elapsed < R.MATCH_DURATION_MS + 6000) {
    if (since >= 150) { input = act(st); since = 0; }
    const evs = stepMatch(st, 16.667, input); since += 16.667;
    for (const ev of evs) {
      if (ev.type !== 'heal' || ev.amount > R.REGEN_AMOUNT) continue;
      const selfFired = evs.some((x) => x.type === 'weapon-fired' && x.fighterRole === ev.fighterRole
        && R.CHARACTERS[st[ev.fighterRole].characterId].weapons.find((w) => w.key === x.weaponKey)?.type === 'self');
      if (!selfFired) got[ev.fighterRole] += ev.amount;
    }
  }
  matches++;
  for (const role of ['player', 'enemy']) { totalFighters++; if (got[role] > 0) fightersWithRegen++; regenHp += got[role]; }
}
console.log(`REGEN_DELAY_MS=${R.REGEN_DELAY_MS}  ->  ${fightersWithRegen}/${totalFighters} fighters regened across ${matches} matches, ${regenHp} HP total`);
