#!/usr/bin/env node
/**
 * BB_SLAM — the acceptance rig for "the Giant Lollipop catches almost everything on
 * screen, and nothing like the whole map".
 *
 * Uri, 2026-08-21, answering `DECISIONS §81(a)`:
 *
 *   > *"If the question is whether the giant should catch everything in the visible
 *   > screen, the answer is almost, but it shouldn't catch everything in the map."*
 *
 * `REACH.ultimateSlam` was **400 wu**, authored, and explicitly *"anchored to the ARENA,
 * not to the weapon ladder"*. It is now `GUARANTEED_VISIBLE_RADIUS - BODY_LENGTH` =
 * **157.22 wu** — the disc every supported aspect ratio is guaranteed to show, less one
 * body length of margin.
 *
 *   --agree      🚨 THE ONE THAT MATTERS. `rules.ts:GUARANTEED_VISIBLE_RADIUS` and
 *                `render/camera.ts:FAIR_PLAY.radiusUnits` are TWO STATEMENTS OF ONE RULE
 *                in two files — this project's most expensive defect class. This imports
 *                BOTH and requires them equal TO THE BIT, and carries its own known-bad:
 *                a perturbed camera derivation must make the check go RED.
 *                `sim.test.mjs` cannot do this — importing `camera.ts` pulls in `three`,
 *                and the known-bad rigs copy `src/` to a temp dir with no `node_modules`,
 *                so a `three` import there would break every one of them. §37(b) source-
 *                scans instead; this is the strong form.
 *   --knownbad   Rebuilds the PRE-CHANGE sim (slam back to 400) from the shipped source
 *                with ONE asserted substitution and runs the REAL `sim.test.mjs` against
 *                it. §37's rows, §19(f)'s reach row and §33(o)'s reversed wind-up row must
 *                all go RED; the non-vacuity rows must stay GREEN.
 *   --reach      What the constant does, in the units the answer was given in: the slam's
 *                radius against the guaranteed-visible disc, the arena diagonal, the next
 *                longest weapon, and the endgame chord — both trees.
 *
 *   node tools/tmp/bb_slam.mjs --agree
 *   node tools/tmp/bb_slam.mjs --knownbad
 *   node tools/tmp/bb_slam.mjs --reach
 *   node tools/tmp/bb_slam.mjs --selftest     # all three
 */

import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const args = (() => {
  const o = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true;
    else { o[a.slice(2)] = n; i++; }
  }
  return o;
})();

// ─────────────────────────────────────────────────────────────────────────────
// THE PRE-CHANGE TREE
// ─────────────────────────────────────────────────────────────────────────────

const SLAM_ANCHOR = '  ultimateSlam: GUARANTEED_VISIBLE_RADIUS - BODY_LENGTH,';
const SLAM_PREV = '  ultimateSlam: 400, // BB_SLAM KNOWN-BAD: the authored, arena-anchored value';

/** Copy `src/` and put `REACH.ultimateSlam` back to its authored 400. */
export function buildPreChangeTree({ patchCamera = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'bb-slam-'));
  cpSync(join(ROOT, 'src'), join(dir, 'src'), { recursive: true });
  const rulesPath = join(dir, 'src/game/rules.ts');
  const before = readFileSync(rulesPath, 'utf8');
  const hits = before.split(SLAM_ANCHOR).length - 1;
  if (hits !== 1) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(`bb_slam: the slam anchor matched ${hits} times, expected exactly 1.\n  anchor: ${SLAM_ANCHOR}`);
  }
  writeFileSync(rulesPath, before.replace(SLAM_ANCHOR, SLAM_PREV));
  if (patchCamera) {
    // The known-bad for `--agree`: perturb the CAMERA's derivation only. If the equality
    // check cannot notice this, it is not checking anything.
    const camPath = join(dir, 'src/render/camera.ts');
    const cam = readFileSync(camPath, 'utf8');
    const CAM_ANCHOR = 'const MAX_THREAT_REACH = MAX_WEAPON_RANGE + HIT_RADIUS_VS_PLAYER;';
    const n = cam.split(CAM_ANCHOR).length - 1;
    if (n !== 1) {
      rmSync(dir, { recursive: true, force: true });
      throw new Error(`bb_slam: the camera anchor matched ${n} times, expected exactly 1`);
    }
    writeFileSync(camPath, cam.replace(CAM_ANCHOR,
      'const MAX_THREAT_REACH = MAX_WEAPON_RANGE + HIT_RADIUS_VS_PLAYER + 1; // BB_SLAM KNOWN-BAD'));
  }
  return { dir, simDir: join(dir, 'src/game') };
}

const rmTree = (t) => { if (t) rmSync(t.dir, { recursive: true, force: true }); };

// ─────────────────────────────────────────────────────────────────────────────
// --agree
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ A TEMP-DIR COPY OF `src/` CANNOT IMPORT `three`, so the known-bad arm gets a
 * `node_modules` SYMLINK — the same thing `verify-head.mjs` does to its `git archive`
 * export, and for the same reason. Without it the perturbed arm would throw on a missing
 * import and the row would go "red" for a reason that has nothing to do with the check.
 */
async function radiiFrom(dir) {
  const rules = await import(`${dir}/src/game/rules.ts`);
  const camera = await import(`${dir}/src/render/camera.ts`);
  return { rules: rules.GUARANTEED_VISIBLE_RADIUS, camera: camera.FAIR_PLAY.radiusUnits,
    slam: rules.REACH.ultimateSlam, body: rules.BODY_LENGTH };
}

export async function runAgree() {
  const live = await radiiFrom(ROOT);
  // KNOWN-BAD: perturb the camera's derivation by 1 wu and require the equality to break.
  const tree = buildPreChangeTree({ patchCamera: true });
  let bad;
  try {
    execFileSync('ln', ['-sfn', join(ROOT, 'node_modules'), join(tree.dir, 'node_modules')]);
    bad = await radiiFrom(tree.dir);
  } finally { rmTree(tree); }
  return {
    live, bad,
    agrees: live.rules === live.camera,
    knownBadCaught: bad.rules !== bad.camera,
    slamOk: live.slam === live.rules - live.body,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// --knownbad : run the REAL suite against the PRE-CHANGE sim
// ─────────────────────────────────────────────────────────────────────────────

const MUST_FAIL = [
  '(a) …and the slam is that radius less ONE BODY LENGTH',
  '(a) …and it does NOT reach the whole map',
  '(c) …and covering it would now FIT on screen',
  '`lollipop.Giant` has NO wind-up — and the shrink has made one AFFORDABLE',
];
const MUST_PASS = [
  '(a) the guaranteed-visible radius is the ladder ceiling',
  '(b) 🔴 `render/camera.ts` still derives its radius from the SAME three terms',
  '(c) the slam is STILL excluded from `ENDGAME_STANDOFF`',
  'the slam still out-reaches every other weapon, so "beyond" names a real gap',
  '(d) the slam is STILL the widest area in the game',
  'the slam lands beyond every other weapon\'s reach, unaimed, and stuns',
];

export function runKnownBad() {
  const tree = buildPreChangeTree();
  let out;
  try {
    out = execFileSync(process.execPath, [join(tree.simDir, 'sim.test.mjs')], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    out = String(e.stdout ?? '') + String(e.stderr ?? '');
  } finally { rmTree(tree); }
  const lines = out.split('\n');
  const verdict = (needle) => {
    const l = lines.find((x) => x.includes(needle));
    if (!l) return 'ABSENT';
    return l.trimStart().startsWith('ok -') ? 'PASS' : 'FAIL';
  };
  return {
    failed: MUST_FAIL.map((n) => ({ n, v: verdict(n) })),
    passed: MUST_PASS.map((n) => ({ n, v: verdict(n) })),
    summary: lines.find((l) => / passed, \d+ failed$/.test(l)) ?? '(no summary line)',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// --reach
// ─────────────────────────────────────────────────────────────────────────────

export async function runReach(dir) {
  const r = await import(`${dir}/src/game/rules.ts`);
  const arena = JSON.parse(readFileSync(join(ROOT, 'tools/arena.gameplay.json'), 'utf8'));
  const diag = Math.hypot(arena.width, arena.height);
  const others = Object.values(r.CHARACTERS).flatMap((d) => d.weapons.filter((w) => !w.giantSlam).map((w) => w.range ?? 0));
  const slam = r.REACH.ultimateSlam;
  return {
    slam,
    visible: r.GUARANTEED_VISIBLE_RADIUS,
    ofVisible: slam / r.GUARANTEED_VISIBLE_RADIUS,
    diag,
    ofMap: slam / diag,
    nextLongest: Math.max(...others),
    xNext: slam / Math.max(...others),
    standoffIfCovered: slam + Math.max(r.HIT_RADIUS_VS_PLAYER, r.HIT_RADIUS_VS_ENEMY),
    ring6: r.minSafeRadiusFor(6),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const all = args.selftest === true;
  if (args.agree || all) {
    const r = await runAgree();
    console.log('── AGREE: rules.ts vs render/camera.ts, the SAME rule in two files ──');
    console.log(`   rules.GUARANTEED_VISIBLE_RADIUS ${r.live.rules}   camera.FAIR_PLAY.radiusUnits ${r.live.camera}   equal=${r.agrees}`);
    console.log(`   REACH.ultimateSlam ${r.live.slam} === ${r.live.rules} - ${r.live.body}  ${r.slamOk}`);
    console.log(`   KNOWN-BAD (camera reach +1 wu): rules ${r.bad.rules} vs camera ${r.bad.camera} — caught=${r.knownBadCaught}`);
    const ok = r.agrees && r.slamOk && r.knownBadCaught;
    console.log(`   => ${ok ? 'ONE RULE, TWO FILES, IN AGREEMENT — and the check can fail' : 'FAULT'}`);
    if (!ok) process.exitCode = 1;
  }
  if (args.knownbad || all) {
    const r = runKnownBad();
    console.log('── KNOWN-BAD: the REAL suite against the PRE-CHANGE sim (slam back to 400) ──');
    console.log(`   ${r.summary}`);
    for (const { n, v } of r.failed) console.log(`   ${v === 'FAIL' ? 'ok  ' : 'BAD '} must FAIL: ${v.padEnd(6)} ${n}`);
    for (const { n, v } of r.passed) console.log(`   ${v === 'PASS' ? 'ok  ' : 'BAD '} must PASS: ${v.padEnd(6)} ${n}`);
    const bad = r.failed.filter((x) => x.v !== 'FAIL').length + r.passed.filter((x) => x.v !== 'PASS').length;
    console.log(`   => ${bad === 0 ? 'GUARD VALIDATED' : `${bad} ROW(S) WRONG — the guard is not a guard`}`);
    if (bad !== 0) process.exitCode = 1;
  }
  if (args.reach || all) {
    const now = await runReach(ROOT);
    const tree = buildPreChangeTree();
    let was;
    try { was = await runReach(tree.dir); } finally { rmTree(tree); }
    console.log('── REACH, in the units the answer was given in ──');
    const row = (label, a, b, f = (x) => x.toFixed(2)) =>
      console.log(`   ${label.padEnd(38)} ${String(f(a)).padStart(10)}   was ${String(f(b)).padStart(10)}`);
    row('slam radius (wu)', now.slam, was.slam);
    row('  as a share of the guaranteed disc', now.ofVisible, was.ofVisible, (x) => `${(100 * x).toFixed(1)}%`);
    row('  as a share of the arena diagonal', now.ofMap, was.ofMap, (x) => `${(100 * x).toFixed(1)}%`);
    row('  x the next longest weapon', now.xNext, was.xNext, (x) => `${x.toFixed(2)}x`);
    row('standoff IF the exemption were deleted', now.standoffIfCovered, was.standoffIfCovered);
    row('  vs the guaranteed disc', now.visible, was.visible);
    row('minSafeRadiusFor(6) — UNCHANGED here', now.ring6, was.ring6);
  }
}

if (IS_MAIN) await main();
