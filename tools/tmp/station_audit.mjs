#!/usr/bin/env node
/**
 * Is every `arena-scan` station on legal, REACHABLE ground?
 *
 * Two different failure modes, and the colour baseline has been hit by both:
 *   * INSIDE COVER — `?px=/?py=` does not validate, so the camera centres on a player
 *     buried in a freezer. Four of eighteen stations were like this after 60c5b92.
 *   * SEALED — legal to stand on, but in a pocket no fighter can ever walk to. Three
 *     stations were like this before 60c5b92, so the baseline contained frames shot
 *     from ground the game cannot reach.
 *
 * Prints the verdict for a candidate list so a station set can be checked before it is
 * measured rather than after. `tools/arena-scan.mjs` now runs the same two tests at
 * startup and refuses to scan on a failure — this is the standalone version, useful
 * when choosing replacements.
 *
 *   node tools/tmp/station_audit.mjs
 *   node tools/tmp/station_audit.mjs --at 430,420 --at 1150,420
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const A = JSON.parse(readFileSync(`${ROOT}/tools/arena.gameplay.json`, 'utf8'));
const PLAYER_SIZE = 42;
const argv = process.argv.slice(2);

const blocked = (x, y) => A.cover.find((c) =>
  Math.abs(x - c.x) < PLAYER_SIZE / 2 + c.w / 2 && Math.abs(y - c.y) < PLAYER_SIZE / 2 + c.h / 2);

// 2wu lattice flood from the enemy spawn, same rule the nav grid uses for diagonals.
const L = 2;
const cols = Math.floor(A.width / L), rows = Math.floor(A.height / L);
const half = PLAYER_SIZE / 2;
const legal = new Uint8Array(cols * rows);
for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
  const x = (gx + 0.5) * L, y = (gy + 0.5) * L;
  legal[gy * cols + gx] = (x >= half && x <= A.width - half && y >= half && y <= A.height - half && !blocked(x, y)) ? 1 : 0;
}
const seen = new Uint8Array(cols * rows);
const q = new Int32Array(cols * rows);
let h = 0, t = 0;
const s0 = Math.min(rows - 1, Math.floor(A.enemySpawn.y / L)) * cols + Math.min(cols - 1, Math.floor(A.enemySpawn.x / L));
q[t++] = s0; seen[s0] = 1;
while (h < t) {
  const c = q[h++], cx = c % cols, cy = (c - cx) / cols;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    if (!ox && !oy) continue;
    const nx = cx + ox, ny = cy + oy;
    if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
    const ni = ny * cols + nx;
    if (!legal[ni] || seen[ni]) continue;
    if (ox && oy && (!legal[cy * cols + nx] || !legal[ny * cols + cx])) continue;
    seen[ni] = 1; q[t++] = ni;
  }
}
const reachable = (x, y) => {
  const gx = Math.min(cols - 1, Math.max(0, Math.floor(x / L)));
  const gy = Math.min(rows - 1, Math.max(0, Math.floor(y / L)));
  return !!seen[gy * cols + gx];
};

// The station list, read out of arena-scan itself so the audit cannot drift from it.
const src = readFileSync(`${ROOT}/tools/arena-scan.mjs`, 'utf8');
const block = /const STATIONS = \[([\s\S]*?)\n\];/.exec(src)[1];
const GREASE = A.hazards.find((z) => z.kind === 'slow' && z.y > 500) ?? { x: 560, y: 900 };
const WATER = A.hazards.find((z) => z.kind === 'slow' && z.y < 500) ?? { x: 840, y: 100 };
const ev = (e) => Function('GREASE', 'WATER', `"use strict"; return (${e});`)(GREASE, WATER);
const stations = [];
for (const m of block.matchAll(/\{\s*id:\s*'([^']+)',\s*x:\s*([^,]+),\s*y:\s*([^,]+),/g)) {
  stations.push({ id: m[1], x: ev(m[2]), y: ev(m[3]) });
}
for (const a of argv.reduce((acc, f, i) => (f === '--at' ? [...acc, argv[i + 1]] : acc), [])) {
  const [x, y] = a.split(',').map(Number);
  stations.push({ id: `candidate(${x},${y})`, x, y });
}

console.log(`\n== STATION AUDIT — layout ${A.cover.length} cover boxes, spawns (${A.playerSpawn.x},${A.playerSpawn.y})/(${A.enemySpawn.x},${A.enemySpawn.y})`);
console.log(`   flood: ${t} of ${cols * rows} lattice nodes reachable from the enemy spawn\n`);
console.log(`   ${'station'.padEnd(18)}${'x'.padStart(6)}${'y'.padStart(6)}   verdict`);
let bad = 0;
for (const s of stations) {
  const b = blocked(s.x, s.y);
  const r = reachable(s.x, s.y);
  let v = 'ok';
  if (b) { v = `INSIDE COVER ${b.kind}@(${b.x},${b.y}) ${b.w}x${b.h}`; bad++; }
  else if (!r) { v = 'SEALED — legal ground nothing can walk to'; bad++; }
  console.log(`   ${s.id.padEnd(18)}${String(s.x).padStart(6)}${String(s.y).padStart(6)}   ${v}`);
}
console.log(`\n   ${bad} of ${stations.length} stations would be measured from unusable ground\n`);
void execFileSync;
process.exit(bad ? 1 : 0);
