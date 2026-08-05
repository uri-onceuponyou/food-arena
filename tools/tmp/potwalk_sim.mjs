#!/usr/bin/env node
/**
 * Walk a fighter into the pot from 16 directions using the REAL `movement.ts`
 * (`moveToward`, which is what both `sim.ts` and `ai.ts` call), and report:
 *
 *   - the closest the fighter's centre ever gets to the pot centre
 *   - whether it ever ends up inside the pot's visual body (the invisibility zone)
 *   - whether it ever ends up inside `POT.dangerRadius` (the mechanic)
 *
 * Node-level rather than through the browser deliberately: this exercises the exact
 * collision function the game uses, with per-axis sliding and detour commitment
 * intact, and takes the renderer, focus and key handling out of the question.
 *
 * Usage: node tools/tmp/potwalk_sim.mjs <arena.json> [<arena.json> ...]
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const { moveToward } = await import(`${ROOT}/src/game/movement.ts`);
const RULES = await import(`${ROOT}/src/game/rules.ts`);

const CX = 700, CY = 500;
const BODY_R = RULES.POT.bodyRadius;
const DANGER_R = RULES.POT.dangerRadius;
const SPEED = RULES.CHARACTERS.hamburger.speed ?? 3;

for (const path of process.argv.slice(2)) {
  const dump = JSON.parse(readFileSync(path, 'utf8'));
  const arena = { width: dump.width, height: dump.height, cover: dump.cover };
  let worstMin = Infinity, insideBody = 0, insideDanger = 0;
  const rows = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const start = { x: CX + Math.cos(a) * 220, y: CY + Math.sin(a) * 220 };
    const f = { x: start.x, y: start.y, size: RULES.PLAYER_SIZE, detourSign: 0 };
    let minD = Infinity, sawBody = false, sawDanger = false;
    for (let t = 0; t < 600; t++) {
      const dx = CX - f.x, dy = CY - f.y;
      const m = Math.hypot(dx, dy) || 1;
      moveToward(f, dx / m, dy / m, SPEED, arena, CX, CY);
      const d = Math.hypot(f.x - CX, f.y - CY);
      if (d < minD) minD = d;
      if (d < BODY_R) sawBody = true;
      if (d < DANGER_R) sawDanger = true;
    }
    if (sawBody) insideBody++;
    if (sawDanger) insideDanger++;
    worstMin = Math.min(worstMin, minD);
    rows.push(`${(a * 180 / Math.PI).toFixed(0).padStart(4)}deg  closest ${minD.toFixed(1).padStart(6)}wu  ${sawBody ? 'ENTERED THE POT BODY' : 'never entered the body'}  ${sawDanger ? '· burned' : '· NEVER BURNED'}`);
  }
  console.log(`\n${path}   (speed ${SPEED}wu/tick, 600 ticks, 16 approach angles)`);
  for (const r of rows) console.log('  ' + r);
  console.log(`  => entered the pot body from ${insideBody}/16 directions; reached the damage radius from ${insideDanger}/16; absolute closest approach ${worstMin.toFixed(1)}wu`);
}
