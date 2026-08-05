#!/usr/bin/env node
/**
 * THE THREE BAKED COPIES OF THE KEY LIGHT'S AZIMUTH MUST AGREE WITH THE KEY.
 *
 * `src/arena` bakes the key's ground direction into three separate places, because
 * `src/render/lighting.ts` belongs to a different owner and the number is copied rather
 * than imported:
 *
 *   src/arena/shared.ts   SHADOW_DIR         the offset/ramp on every prop contact decal
 *   src/arena/apron.ts    SHADOW_X/SHADOW_Y  the kerb contact band + every grounding quad
 *   src/arena/floor.ts    the `along` term   the whole arena's baked "one sun direction"
 *
 * All three have now been stale TWICE, and the second time they were stale they had the
 * WRONG SIGN on Z — the key moved to the far side of the camera axis (`086ff5f`) and
 * every baked offset in the arena kept pushing away from the viewer. Nothing here draws
 * a hard edge, so nothing failed and nothing looked obviously wrong, which is precisely
 * `docs/LESSONS.md` §1: it was rendering, and it was invisible.
 *
 * This is a static guard: it reads `KEY_OFFSET` out of `lighting.ts` and the three
 * constants out of their own files, and fails if any of them disagrees by more than
 * `--tol` degrees (default 2).
 *
 * It is a SOURCE check on purpose. A runtime check would need a browser, would only
 * cover whichever station it happened to load, and could not see `floor.ts`'s ramp at
 * all — that number is consumed inside an instanced-colour loop and never appears in
 * the scene graph.
 *
 *   node tools/tmp/bakedaz.mjs
 *   node tools/tmp/bakedaz.mjs --selftest
 */
import { readFile } from 'node:fs/promises';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const has = (k) => process.argv.includes('--' + k);
const TOL = Number(arg('tol', 2));

const deg = (x, z) => (Math.atan2(z, x) * 180) / Math.PI;
const angleBetween = (ax, az, bx, bz) => {
  const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
  const c = Math.min(1, Math.max(-1, (ax * bx + az * bz) / (la * lb)));
  return (Math.acos(c) * 180) / Math.PI;
};

/** `new THREE.Vector3(a, b, c)` on the KEY_OFFSET line. */
export function parseKeyOffset(src) {
  const m = src.match(/KEY_OFFSET\s*=\s*new THREE\.Vector3\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/);
  if (!m) throw new Error('lighting.ts: could not find KEY_OFFSET');
  return { x: Number(m[1]), y: Number(m[2]), z: Number(m[3]) };
}
/** `const KEY_X = <n>, KEY_Z = <n>;` — the form both arena copies now use. */
export function parseArenaKey(src, file) {
  // Anchored to the start of a line: an unanchored match would happily read a
  // COMMENTED-OUT copy and report the arena as correct. `verify-head`'s import checker
  // and the CSS backtick lint both shipped that exact bug once (`docs/LESSONS.md` §9).
  const m = src.match(/^[ \t]*const KEY_X\s*=\s*(-?[\d.]+)\s*,\s*KEY_Z\s*=\s*(-?[\d.]+)\s*;/m);
  if (!m) throw new Error(`${file}: could not find "const KEY_X = .., KEY_Z = ..;"`);
  return { x: Number(m[1]), z: Number(m[2]) };
}
/** `const along = ((wx - CENTER.x) * <a> + (wy - CENTER.y) * <b>) / 700;` */
export function parseFloorAlong(src) {
  const m = src.match(/^[ \t]*const along\s*=\s*\(\(wx - CENTER\.x\)\s*\*\s*(-?[\d.]+)\s*\+\s*\(wy - CENTER\.y\)\s*\*\s*(-?[\d.]+)\)/m);
  if (!m) throw new Error('floor.ts: could not find the `along` ramp');
  return { x: Number(m[1]), z: Number(m[2]) };
}

if (has('selftest')) {
  let pass = 0, fail = 0;
  const ok = (n, c, g) => { if (c) pass++; else { fail++; console.log(`  FAIL ${n}  got ${g}`); } };
  const near = (a, b, t = 1e-9) => Math.abs(a - b) <= t;
  const k = parseKeyOffset('export const KEY_OFFSET = new THREE.Vector3(29.98, 28.32, -18.01);');
  ok('parses KEY_OFFSET', k.x === 29.98 && k.y === 28.32 && k.z === -18.01, JSON.stringify(k));
  const a = parseArenaKey('const KEY_X = 29.98, KEY_Z = -18.01;\n', 'x');
  ok('parses the arena pair', a.x === 29.98 && a.z === -18.01, JSON.stringify(a));
  const f = parseFloorAlong('      const along = ((wx - CENTER.x) * 0.857 + (wy - CENTER.y) * -0.515) / 700;');
  ok('parses the floor ramp', f.x === 0.857 && f.z === -0.515, JSON.stringify(f));
  ok('angleBetween identical', near(angleBetween(1, 0, 2, 0), 0), angleBetween(1, 0, 2, 0));
  ok('angleBetween right angle', near(angleBetween(1, 0, 0, 1), 90, 1e-9), angleBetween(1, 0, 0, 1));
  // The historical bug, restated as a test: the pre-086ff5f pair must FAIL against the
  // shipped key. A guard that passes on the defect it guards against is not a guard.
  ok('the stale (16.35, 4.69) pair is 47 deg out and would FAIL',
    Math.abs(angleBetween(16.35, 4.69, 29.98, -18.01) - 47.0) < 0.2,
    angleBetween(16.35, 4.69, 29.98, -18.01));
  ok('and its Z sign is inverted relative to the key', 4.69 * -18.01 < 0, 'same sign');
  // A parser that silently matches a COMMENT would defeat the whole check.
  let threw = false;
  try { parseArenaKey('const OTHER = 1;\n', 'x'); } catch { threw = true; }
  ok('refuses a file with no constant rather than guessing', threw, 'did not throw');
  let threw2 = false;
  try { parseArenaKey('// const KEY_X = 1, KEY_Z = 2;\n', 'x'); } catch { threw2 = true; }
  ok('a COMMENTED-OUT copy does not satisfy the check', threw2, 'matched a comment');
  const live = parseArenaKey('// const KEY_X = 1, KEY_Z = 2;\nconst KEY_X = 3, KEY_Z = 4;\n', 'x');
  ok('and the live one still parses past a commented one', live.x === 3 && live.z === 4, JSON.stringify(live));
  console.log(`\nbakedaz --selftest  ${pass}/${pass + fail}`);
  process.exit(fail ? 1 : 0);
}

const key = parseKeyOffset(await readFile('src/render/lighting.ts', 'utf8'));
const rows = [
  { file: 'src/arena/shared.ts', label: 'SHADOW_DIR', ...parseArenaKey(await readFile('src/arena/shared.ts', 'utf8'), 'shared.ts') },
  { file: 'src/arena/apron.ts', label: 'SHADOW_X/Y', ...parseArenaKey(await readFile('src/arena/apron.ts', 'utf8'), 'apron.ts') },
  { file: 'src/arena/floor.ts', label: 'along ramp', ...parseFloorAlong(await readFile('src/arena/floor.ts', 'utf8')) },
];

console.log(`key light  offset (${key.x}, ${key.y}, ${key.z})   azimuth ${deg(key.x, key.z).toFixed(2)} deg   elevation ${((Math.atan2(key.y, Math.hypot(key.x, key.z)) * 180) / Math.PI).toFixed(2)} deg`);
console.log('\nfile                     what          azimuth      delta');
let worst = 0;
for (const r of rows) {
  const d = angleBetween(r.x, r.z, key.x, key.z);
  worst = Math.max(worst, d);
  console.log(`${r.file.padEnd(24)} ${r.label.padEnd(13)} ${deg(r.x, r.z).toFixed(2).padStart(7)} deg  ${d.toFixed(2).padStart(6)} deg  ${d <= TOL ? 'OK' : 'STALE'}`);
}
console.log(`\nworst disagreement ${worst.toFixed(2)} deg against a tolerance of ${TOL}`);
process.exit(worst <= TOL ? 0 : 1);
