#!/usr/bin/env node
/** Spawns placed diagonally opposite at a chosen radius from the arena centre — off the
 *  pot, off the walls, symmetric. `make_gap_arena.mjs`'s on-axis placement put both
 *  fighters either in a cover pocket (gap 600 -> 0% engaged, a placement artefact) or on
 *  top of the boiling pot (gap 250 -> 35-58% hazard damage). This avoids both. */
import { readFileSync, writeFileSync } from 'node:fs';
const [radius, out] = process.argv.slice(2);
const A = JSON.parse(readFileSync('/Users/uribishansky/claude-code/food-arena/tools/tmp/arena.frozen.json', 'utf8'));
const R = await import('/Users/uribishansky/claude-code/food-arena/src/game/rules.ts');
const h = R.PLAYER_SIZE / 2;
const HAZ = A.hazards.find((z) => z.kind === 'damage');
const free = (x, y) => x > 60 && y > 60 && x < A.width - 60 && y < A.height - 60
  && !A.cover.some((c) => Math.abs(x - c.x) < h + c.w / 2 && Math.abs(y - c.y) < h + c.h / 2)
  && (!HAZ || Math.hypot(x - HAZ.x, y - HAZ.y) > HAZ.radius + 60);
const cx = A.center.x, cy = A.center.y;
function find(baseAng) {
  for (let dA = 0; dA <= 0.6; dA += 0.04) for (const s of [1, -1]) for (let dr = 0; dr <= 90; dr += 5) for (const rs of [1, -1]) {
    const a = baseAng + s * dA, r = Number(radius) + rs * dr;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (free(x, y)) return { x: Math.round(x), y: Math.round(y) };
  }
  throw new Error('no free spawn');
}
A.playerSpawn = find(Math.PI * 0.8);
A.enemySpawn = find(-Math.PI * 0.2);
writeFileSync(out, JSON.stringify(A, null, 2));
console.error(`r=${radius} gap ${Math.round(Math.hypot(A.playerSpawn.x - A.enemySpawn.x, A.playerSpawn.y - A.enemySpawn.y))}wu  ` +
  `${JSON.stringify(A.playerSpawn)} ${JSON.stringify(A.enemySpawn)}`);
