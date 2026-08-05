#!/usr/bin/env node
/**
 * Candidate arena layouts, as data.
 *
 * Writes a dumped-arena JSON (the exact shape `tools/arena.gameplay.json` has) for a
 * parameterised layout, so `arena_probe.mjs --layout <file>` can score a geometry idea
 * in seconds instead of a browser refresh plus an edit-compile-measure round trip.
 *
 * The parameters are the ONLY things that vary; everything else — arena size, the pot,
 * 180 degree point symmetry — is structural and is enforced here rather than trusted:
 * `pair()` emits a prop and its point-symmetric twin from one call, so a candidate
 * cannot accidentally be asymmetric.
 *
 *   node tools/tmp/arena_cand.mjs --name A --out /tmp/cand-A.json [--set k=v ...]
 *   node tools/tmp/arena_cand.mjs --list
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const RULES = await import(`${ROOT}/src/game/rules.ts`);
const { POT, PUDDLE_SLOW_FACTOR, MATCH_DURATION_MS } = RULES;

const W = 1400, H = 1000;
const C = { x: W / 2, y: H / 2 };
const FOG_FIRST_CONTACT_S = 6;
const MAX_SAFE_RADIUS = Math.round(Math.hypot(W / 2, H / 2) / (1 - (FOG_FIRST_CONTACT_S * 1000) / MATCH_DURATION_MS));

function parseArgs(argv) {
  const out = { set: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const n = argv[i + 1];
    if (k === 'set') { out.set.push(n); i++; continue; }
    if (n === undefined || n.startsWith('--')) out[k] = true;
    else { out[k] = n; i++; }
  }
  return out;
}
const args = parseArgs(process.argv);

/** Defaults describe the SHIPPED layout exactly — so `--name current` round-trips. */
const DEFAULTS = {
  spawnX: 160, spawnY: 500,
  // stove islands: offset from centre, and box size
  islandDX: 175, islandDY: 150, islandW: 170, islandH: 90,
  // lane pots — absolute anchor of the first of the pair
  lanePotX: 700, lanePotY: 258, lanePotSize: 55, lanePots: 1,
  // spice carts — absolute anchor of the first of the pair
  cartX: 525, cartY: 500, cartSize: 50, carts: 1,
  // freezers
  freezerX: 230, freezerY: 190, freezerW: 230, freezerH: 190,
  // pantry cluster (NE / SW)
  herbX: 1120, herbY: 150, crateX: 1230, crateY: 140, sackX: 1175, sackY: 235,
  // prep stations
  prepX: 340, prepDY: 80, prepW: 160, prepH: 55,
  // supply barrels
  barrelAX: 250, barrelAY: 500, barrelBX: 460, barrelBY: 500, barrels: 1,
  // service counters
  svcY: 170, svcW: 150, svcH: 70,
};

const P = { ...DEFAULTS };
for (const s of args.set) {
  const [k, v] = String(s).split('=');
  if (!(k in P)) { console.error(`unknown param ${k}`); process.exit(2); }
  P[k] = Number(v);
}

function build(p) {
  const cover = [];
  /** A prop and its 180-degree twin, from one call. Symmetry cannot be forgotten. */
  const pair = (x, y, w, h, kind) => {
    cover.push({ x, y, w, h, kind });
    cover.push({ x: W - x, y: H - y, w, h, kind });
  };
  const one = (x, y, w, h, kind) => cover.push({ x, y, w, h, kind });

  // hub islands — two symmetric pairs
  pair(C.x - p.islandDX, C.y - p.islandDY, p.islandW, p.islandH, 'stove_island');
  pair(C.x + p.islandDX, C.y - p.islandDY, p.islandW, p.islandH, 'stove_island');
  if (p.lanePots) pair(p.lanePotX, p.lanePotY, p.lanePotSize, p.lanePotSize, 'stacked_pots');
  if (p.carts) pair(p.cartX, p.cartY, p.cartSize, p.cartSize, 'spice_cart');

  pair(p.freezerX, p.freezerY, p.freezerW, p.freezerH, 'freezer');
  pair(p.herbX, p.herbY, 90, 90, 'herb_crate');
  pair(p.crateX, p.crateY, 80, 80, 'produce_crate_tall');
  pair(p.sackX, p.sackY, 110, 70, 'flour_sacks');

  pair(p.prepX, C.y - p.prepDY, p.prepW, p.prepH, 'prep_counter');
  pair(p.prepX, C.y + p.prepDY, p.prepW, p.prepH, 'prep_counter');

  if (p.barrels) {
    pair(p.barrelAX, p.barrelAY, 60, 50, 'supply_barrel');
    pair(p.barrelBX, p.barrelBY, 48, 46, 'supply_barrel');
  }

  pair(C.x, p.svcY, p.svcW, p.svcH, 'sink_counter');
  one(C.x, C.y, POT.bodyRadius * 2, POT.bodyRadius * 2, 'boiling_pot');

  return {
    id: 'kitchen', displayName: 'The Kitchen',
    width: W, height: H, center: C, maxSafeRadius: MAX_SAFE_RADIUS,
    playerSpawn: { x: p.spawnX, y: p.spawnY },
    enemySpawn: { x: W - p.spawnX, y: H - p.spawnY },
    cover,
    hazards: [
      { x: C.x, y: C.y, radius: POT.dangerRadius, kind: 'damage', damage: POT.damage, tickMs: POT.tickMs },
      { x: 560, y: 900, radius: 50, kind: 'slow', slowFactor: PUDDLE_SLOW_FACTOR },
      { x: W - 560, y: H - 900, radius: 50, kind: 'slow', slowFactor: PUDDLE_SLOW_FACTOR },
    ],
  };
}

const out = build(P);
const path = String(args.out ?? '/tmp/cand.json');
writeFileSync(path, JSON.stringify(out, null, 2));
console.error(`${path}  ${out.cover.length} cover  spawnGap ${W - 2 * P.spawnX}`);
