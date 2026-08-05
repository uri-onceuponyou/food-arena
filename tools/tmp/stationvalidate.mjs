/**
 * THROWAWAY — answer one question: are `valuescan`'s dl stations inside a prop?
 *
 * `arena-scan.mjs` validates its own station list against the cover table and a
 * reachability flood (it added that guard after 60c5b92 left four stations inside
 * props). `valuescan.mjs` copied the station NAMES but not the corrected
 * coordinates. This re-runs arena-scan's own test on both lists, from the same
 * layout dump, so the two answers are directly comparable.
 */
import { readFile } from 'node:fs/promises';
const dump = JSON.parse(await readFile('tools/arena.gameplay.json', 'utf8'));
const COVER = dump.cover;
const ARENA_W = 1400, ARENA_H = 1000;
const PLAYER_SIZE = 42;           // arena-scan: fighter footprint
const CLEARANCE = 24 + PLAYER_SIZE / 2;

function coverAt(x, y, pad) {
  for (const c of COVER) {
    if (Math.abs(x - c.x) <= c.w / 2 + PLAYER_SIZE / 2 + pad &&
        Math.abs(y - c.y) <= c.h / 2 + PLAYER_SIZE / 2 + pad) return c;
  }
  return null;
}
function report(label, stations) {
  console.log(`\n${label}`);
  for (const [id, [x, y]] of Object.entries(stations)) {
    const out = [];
    if (x < 20 || x > ARENA_W - 20 || y < 20 || y > ARENA_H - 20) out.push('OUTSIDE PLAYFIELD');
    const box = coverAt(x, y, CLEARANCE - PLAYER_SIZE / 2);
    if (box) out.push(`INSIDE COVER (${box.x},${box.y}) ${box.w}x${box.h}`);
    // how deep, in wu, is the overlap on each axis (0 = just touching the clearance band)
    if (box) {
      const dx = (box.w / 2 + PLAYER_SIZE / 2) - Math.abs(x - box.x);
      const dy = (box.h / 2 + PLAYER_SIZE / 2) - Math.abs(y - box.y);
      out.push(`overlap dx=${dx.toFixed(0)} dy=${dy.toFixed(0)} wu (>0 on BOTH = the body is in the box, not merely near it)`);
    }
    console.log(`  ${id.padEnd(12)} (${String(x).padStart(4)},${String(y).padStart(4)})  ${out.length ? out.join('  ') : 'clear'}`);
  }
}
report('valuescan --mode dl stations (tools/tmp/valuescan.mjs)', {
  pot_south: [700, 640], pantry_sw: [270, 665], pantry_ne: [1150, 330],
  freezer_se: [1000, 700], freezer_nw: [430, 240],
});
report('floorprobe stations (tools/tmp/floorprobe.mjs)', {
  west_choke: [400, 500], west_lane: [340, 500], spawn_west: [160, 500],
  pantry_ne: [1150, 330], pot_south: [700, 640],
});
report('arena-scan stations of the SAME NAMES (tools/arena-scan.mjs) — the collision-validated list', {
  pot_south: [700, 640], pantry_sw: [400, 800], pantry_ne: [1150, 420],
  freezer_se: [1000, 580], freezer_nw: [430, 420],
});
