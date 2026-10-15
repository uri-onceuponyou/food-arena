#!/usr/bin/env node
/**
 * BH_MOVE_KIT — can every medikit `combat.ts:dropMedikits` places actually be collected?
 * Review-phase probe (2026-10-15). READ-ONLY; imports `--src-root` (default: the clean
 * worktree of HEAD). Writes only under shots/rv/bugs/move/.
 *
 * For every legal death point on an 8 wu lattice and 72 facings, it reproduces the drop rule
 * (clamp to [r, W-r], then fall back to the death point if the kit's r x r box overlaps any
 * CoverBox) and asks whether ANY legal fighter centre lies within `MEDIKIT.pickupRadius` of
 * the kit (`stepMedikits` collects on `hypot(f - kit) <= pickupRadius`).
 *
 * Known-bad (`--selftest`): a fixture with a 30 wu gap between two boxes — wide enough for the
 * 26 wu kit box, too narrow for a 42 wu body — must report uncollectable drops; a fixture
 * with only a single box must report none.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO = resolve(new URL('../..', import.meta.url).pathname);
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (!a.startsWith('--')) continue; const n = process.argv[i + 1]; if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = n; i++; } }
const SRC_ROOT = resolve(String(args['src-root'] ?? (existsSync('/private/tmp/fa-rv-head/src/game/sim.ts') ? '/private/tmp/fa-rv-head' : REPO)));
const OUT_DIR = resolve(String(args.out ?? `${REPO}/shots/rv/bugs/move`));
const ARENA_PATH = resolve(String(args.arena ?? `${SRC_ROOT}/tools/arena.gameplay.json`));
mkdirSync(OUT_DIR, { recursive: true });
const R = await import(`${SRC_ROOT}/src/game/rules.ts`);
const { boxesOverlap } = await import(`${SRC_ROOT}/src/game/movement.ts`);
const { PLAYER_SIZE, MEDIKIT } = R;
const HALF = PLAYER_SIZE / 2;

function census(A, step = 8, angles = 72) {
  const inCover = (x, y) => A.cover.some((o) => Math.abs(x - o.x) < (PLAYER_SIZE + o.w) / 2 && Math.abs(y - o.y) < (PLAYER_SIZE + o.h) / 2);
  const legal = (x, y) => x >= HALF && x <= A.width - HALF && y >= HALF && y <= A.height - HALF && !inCover(x, y);
  const r = MEDIKIT.pickupRadius;
  const collectable = (kx, ky) => {
    for (let dx = -r; dx <= r; dx += 1) for (let dy = -r; dy <= r; dy += 1) {
      if (dx * dx + dy * dy > r * r) continue;
      if (legal(kx + dx, ky + dy)) return true;
    }
    return false;
  };
  let drops = 0, fallback = 0, bad = 0; const badPts = [];
  for (let x = HALF; x <= A.width - HALF; x += step) for (let y = HALF; y <= A.height - HALF; y += step) {
    if (!legal(x, y)) continue;
    for (let k = 0; k < angles; k++) {
      const a = (k / angles) * 2 * Math.PI;
      let kx = Math.min(A.width - r, Math.max(r, x + Math.cos(a) * MEDIKIT.popDistance));
      let ky = Math.min(A.height - r, Math.max(r, y + Math.sin(a) * MEDIKIT.popDistance));
      if (A.cover.some((b) => boxesOverlap(kx, ky, r, r, b.x, b.y, b.w, b.h))) { kx = x; ky = y; fallback++; }
      drops++;
      if (!collectable(kx, ky)) { bad++; if (badPts.length < 20) badPts.push({ death: [x, y], kit: [+kx.toFixed(1), +ky.toFixed(1)] }); }
    }
  }
  return { drops, fallback, bad, badPts };
}

function fixture(cover) { return { width: 600, height: 400, cover, hazards: [] }; }
if (args.selftest) {
  const gap = census(fixture([{ x: 200, y: 200, w: 100, h: 200 }, { x: 330, y: 200, w: 100, h: 200 }]), 4, 72); // 30 wu gap x 250..280
  const one = census(fixture([{ x: 300, y: 200, w: 100, h: 100 }]), 4, 72);
  console.log(`${gap.bad > 0 ? 'PASS' : 'FAIL'}  known-bad 30 wu gap: ${gap.bad} uncollectable of ${gap.drops}`);
  console.log(`${one.bad === 0 ? 'PASS' : 'FAIL'}  control single box: ${one.bad} uncollectable of ${one.drops}`);
  process.exitCode = gap.bad > 0 && one.bad === 0 ? 0 : 1;
} else {
  const A = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
  const t0 = Date.now();
  const r = census(A, Number(args.step ?? 8), Number(args.angles ?? 72));
  console.log(`src-root ${SRC_ROOT}\n${r.drops} simulated drops (${r.fallback} fell back to the death point) · ${r.bad} UNCOLLECTABLE  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  for (const p of r.badPts) console.log(`  ${JSON.stringify(p)}`);
  writeFileSync(`${OUT_DIR}/kit_census.json`, JSON.stringify({ srcRoot: SRC_ROOT, ...r }, null, 2));
}
