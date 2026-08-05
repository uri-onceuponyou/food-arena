#!/usr/bin/env node
/**
 * POT BURN AREA — how much STANDABLE ground is actually inside `POT.dangerRadius`?
 *
 * `arena/hazards.ts` now registers the pot as a SOLID CoverBox (`POT.bodyRadius * 2`
 * = 104x104) because a fighter inside the mesh was 0.0% visible. That fix is correct
 * and it silently shrank the hazard: `movement.ts:tryMove` refuses any destination
 * whose 42wu body overlaps the box, so the burn ring (r = POT.dangerRadius = 95) is
 * now mostly INSIDE ground you cannot stand on. This measures what is left.
 */
import { readFileSync } from 'node:fs';
const ROOT = '/Users/uribishansky/claude-code/food-arena';
const R = await import(`${ROOT}/src/game/rules.ts`);
const A = JSON.parse(readFileSync(`${ROOT}/tools/tmp/arena.frozen.json`, 'utf8'));
const { POT, PLAYER_SIZE } = R;
const C = A.center;
const h = PLAYER_SIZE / 2;
const inCover = (x, y) => A.cover.some((c) => Math.abs(x - c.x) < h + c.w / 2 && Math.abs(y - c.y) < h + c.h / 2);

const STEP = 0.5;
let burn = 0, burnStandable = 0;
for (let x = C.x - POT.dangerRadius; x <= C.x + POT.dangerRadius; x += STEP) {
  for (let y = C.y - POT.dangerRadius; y <= C.y + POT.dangerRadius; y += STEP) {
    if (Math.hypot(x - C.x, y - C.y) >= POT.dangerRadius) continue;
    burn++;
    if (!inCover(x, y)) burnStandable++;
  }
}
const potBox = A.cover.find((c) => c.kind === 'boiling_pot');
console.log(`pot CoverBox            ${potBox ? `${potBox.w}x${potBox.h} at (${potBox.x},${potBox.y}) kind=${potBox.kind}` : 'NONE'}`);
console.log(`POT.bodyRadius ${POT.bodyRadius}  dangerRadius ${POT.dangerRadius}  fighter half-size ${h}`);
console.log(`burn disc area          ${(burn * STEP * STEP).toFixed(0)} wu²`);
console.log(`  of which STANDABLE    ${(burnStandable * STEP * STEP).toFixed(0)} wu²  = ${((burnStandable / burn) * 100).toFixed(1)}% of the burn disc`);
console.log(`closest standable centre to the pot, by bearing:`);
for (const deg of [0, 15, 30, 45, 60, 75, 90]) {
  const a = (deg * Math.PI) / 180;
  let r = 0;
  for (r = 0; r < 200; r += 0.25) {
    if (!inCover(C.x + Math.cos(a) * r, C.y + Math.sin(a) * r)) break;
  }
  console.log(`   ${String(deg).padStart(3)}°  nearest standable r = ${r.toFixed(1)}wu   ${r < POT.dangerRadius ? `BURNS (band ${(POT.dangerRadius - r).toFixed(1)}wu wide)` : 'NEVER BURNS from this bearing'}`);
}
