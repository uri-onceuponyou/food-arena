#!/usr/bin/env node
/**
 * The other half of the pot acceptance test: what a fighter can actually REACH.
 *
 * `?px=`/`?py=` deliberately do not validate against cover, so the pixel probe
 * (`tools/tmp/potvis.mjs`) can park a fighter inside the pot and film it — which
 * means the pixel probe alone cannot tell you the fix worked. This one asks the
 * sim's own rule, `movement.ts:boxesOverlap`, over a 1wu grid:
 *
 *   - can a fighter's CENTRE stand inside the pot's visual body (the invisibility
 *     zone) at all?
 *   - how much of the damage disc is still standable, i.e. does the mechanic live?
 *   - what is the closest and furthest a standable fighter can be from the centre?
 *
 * Usage: node tools/tmp/potreach.mjs <arena.json> [<arena.json> ...]
 */
import { readFileSync } from 'node:fs';

const FIGHTER = 42;   // rules.ts PLAYER_SIZE / ENEMY_SIZE
const BODY_R = 52;    // POT.bodyRadius
const DANGER_R = 95;  // POT.dangerRadius
const CX = 700, CY = 500;

const blocked = (x, y, cover) =>
  cover.some((o) => Math.abs(x - o.x) < (FIGHTER + o.w) / 2 && Math.abs(y - o.y) < (FIGHTER + o.h) / 2);

for (const path of process.argv.slice(2)) {
  const a = JSON.parse(readFileSync(path, 'utf8'));
  let bodyStandable = 0, bodyTotal = 0;
  let dangerStandable = 0, dangerTotal = 0;
  let minD = Infinity, maxD = 0;
  for (let x = CX - 140; x <= CX + 140; x++) {
    for (let y = CY - 140; y <= CY + 140; y++) {
      const d = Math.hypot(x - CX, y - CY);
      const free = !blocked(x, y, a.cover);
      if (d < BODY_R) { bodyTotal++; if (free) bodyStandable++; }
      if (d < DANGER_R) {
        dangerTotal++;
        if (free) {
          dangerStandable++;
          if (d < minD) minD = d;
          if (d > maxD) maxD = d;
        }
      }
    }
  }
  console.log(`\n${path}`);
  console.log(`  fighter centre can stand INSIDE the pot body (r<${BODY_R}):  ${bodyStandable}/${bodyTotal} cells = ${(bodyStandable / bodyTotal * 100).toFixed(1)}%`);
  console.log(`  fighter centre can stand inside the DAMAGE disc (r<${DANGER_R}): ${dangerStandable}/${dangerTotal} cells = ${(dangerStandable / dangerTotal * 100).toFixed(1)}%`);
  console.log(`  hazard STILL FIRES: ${dangerStandable > 0 ? 'YES' : 'NO — mechanic deleted'}`);
  console.log(`  closest standable centre to the pot: ${Number.isFinite(minD) ? minD.toFixed(1) : '—'}wu   furthest inside the disc: ${maxD.toFixed(1)}wu`);
}
