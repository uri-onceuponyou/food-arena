#!/usr/bin/env node
/**
 * A copy of the frozen arena with the two spawns pulled toward each other, so the
 * constant audit's conclusions can be re-checked against the SHORTER match the arena
 * agent is currently building (docs/STATE.md PART 2 #11: 1,080 wu gap, 64% dead time).
 * Everything else — cover, hazards, ring — is untouched.
 */
import { readFileSync, writeFileSync } from 'node:fs';
const [gapWanted, out] = process.argv.slice(2);
const A = JSON.parse(readFileSync('/Users/uribishansky/claude-code/food-arena/tools/tmp/arena.frozen.json', 'utf8'));
const R = await import('/Users/uribishansky/claude-code/food-arena/src/game/rules.ts');
const h = R.PLAYER_SIZE / 2;
const free = (x, y) => !A.cover.some((c) => Math.abs(x - c.x) < h + c.w / 2 && Math.abs(y - c.y) < h + c.h / 2);
const cx = A.center.x, cy = A.center.y;
function place(sign) {
  const want = Number(gapWanted) / 2;
  for (let dy = 0; dy <= 400; dy += 10) {
    for (const s of [1, -1]) {
      for (let dr = 0; dr <= 200; dr += 5) {
        for (const rs of [1, -1]) {
          const x = cx + sign * (want + rs * dr), y = cy + s * dy;
          if (x > 60 && x < A.width - 60 && y > 60 && y < A.height - 60 && free(x, y)) return { x: Math.round(x), y: Math.round(y) };
        }
      }
    }
  }
  throw new Error('no free spawn');
}
A.playerSpawn = place(-1);
A.enemySpawn = place(1);
writeFileSync(out, JSON.stringify(A, null, 2));
console.error(`gap ${Math.round(Math.hypot(A.playerSpawn.x - A.enemySpawn.x, A.playerSpawn.y - A.enemySpawn.y))}wu  ${JSON.stringify(A.playerSpawn)} ${JSON.stringify(A.enemySpawn)} -> ${out}`);
