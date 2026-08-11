#!/usr/bin/env node
/**
 * n2_geom — WHERE IS THE AIR? The 3D vertical gap between the top of a character's
 * BODY geometry and the bottom of its HEAD geometry, with the neck column excluded.
 *
 * THROWAWAY. READ-ONLY on `src/`. Measurement instrument; changes no game code.
 *
 * ── WHY ─────────────────────────────────────────────────────────────────────
 * `nm_island.mjs` answers "is the head a separate island?" through the shipped
 * renderer. It is the verdict and it costs a browser and two captures per arm. It is
 * useless for DESIGN, because it reports a count and not a distance: it cannot say
 * how far short the torso falls, so it cannot tell you what to change.
 *
 * This is the design-space half. It builds the shipped character off the shipped
 * files, walks every mesh, and reports the world-space Y extents on each side of the
 * joint. `withoutNeck()` holds R, `headCentreY`, `torsoTopY` and every other metric
 * IDENTICAL (`nm_neck.mjs --against`, 11/11), so **the shipped tree with
 * `neck_column`/`neck_collar` excluded IS the migrated geometry** — no source edit is
 * needed to price the migration.
 *
 * ⚠️ A POSITIVE Y GAP IS NOT AUTOMATICALLY A VISIBLE SPLIT and a zero one is not
 * automatically a join. The camera looks DOWN, so a body part far forward in Z can
 * project over a gap that exists in Y, and two masses that touch in Y can still be
 * separated on screen if they miss each other in X. `nm_island` remains the verdict;
 * this is what you steer with between verdicts.
 *
 * ── KNOWN-BAD INPUTS (CLAUDE.md #6) ─────────────────────────────────────────
 *   `--knownbad lift`   lifts the `head` joint by `--dy` and requires the reported
 *                       gap to grow by exactly that much (1e-9). A gap metric that
 *                       does not move when the head moves is measuring nothing.
 *   `--knownbad sort`   the two characters this pass owns must report a POSITIVE gap
 *                       and the two that shipped the migration (soup, pizza) must
 *                       report a NON-positive one, on the same run. That is the
 *                       discrimination the whole instrument claims; if it cannot
 *                       reproduce the split that `nm_island` measured in pixels, its
 *                       numbers are not about the same defect.
 *
 * ── USE ─────────────────────────────────────────────────────────────────────
 *   node tools/tmp/n2_geom.mjs --ids hotdog,sushi
 *   node tools/tmp/n2_geom.mjs --ids hotdog --parts        # every mesh, sorted
 *   node tools/tmp/n2_geom.mjs --knownbad lift --dy 0.6
 *   node tools/tmp/n2_geom.mjs --knownbad sort
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { REPO, ALL_IDS, captureWarnings, arg, flag, num, writeOut } from './rg_lib.mjs';

const IDS = arg('--ids', 'hotdog,sushi') === 'all' ? ALL_IDS
  : arg('--ids', 'hotdog,sushi').split(',').map((s) => s.trim()).filter(Boolean);
const PARTS = flag('--parts');
const DY = num('--dy', 0.6);
const KNOWNBAD = arg('--knownbad', null);
const JSONOUT = arg('--json', null);

/**
 * The rig's own column and collar — the two meshes `withoutNeck()` deletes.
 *
 * ⚠️ THE OUTLINE SHELL IS A SEPARATE MESH WITH A SUFFIXED NAME, AND IT IS RENDERED.
 * A first version keyed on the exact name, so `neck_column__outline` — an INFLATED
 * copy of the column, i.e. the tallest thing on the body — was bucketed as body
 * geometry and burrito's "body top" came back as the column it was supposed to be
 * excluding. Strip the suffix before classifying; keep the shell in the extents,
 * because it draws pixels and the defect is measured in pixels.
 */
const NECK_MESHES = new Set(['neck_column', 'neck_collar']);
const baseName = (n) => String(n).replace(/__(no_)?outline$/, '');

/**
 * Local bundle, same shape as `nm_neck.mjs`'s. `rg_lib.buildBundle` exists but its
 * entry does not export `THREE`, and a Box3 needs the SAME THREE instance the rig
 * built its geometry with.
 */
async function loadCast() {
  const dir = mkdtempSync(path.join(tmpdir(), 'n2-'));
  const entry = path.join(dir, 'entry.ts');
  const q = (p) => JSON.stringify(path.join(REPO, p));
  writeFileSync(entry, [
    `export * as THREE from 'three';`,
    `export { createCharacter } from ${q('src/characters/registry')};`,
  ].join('\n'));
  const out = path.join(dir, 'bundle.mjs');
  const esbuild = path.join(REPO, 'node_modules/.bin/esbuild');
  if (!existsSync(esbuild)) throw new Error(`esbuild not found at ${esbuild}`);
  execFileSync(esbuild, [entry, '--bundle', '--format=esm', '--platform=node',
    `--alias:three=${path.join(REPO, 'node_modules/three')}`,
    `--outfile=${out}`, '--log-level=error'], { cwd: REPO, stdio: ['ignore', 'inherit', 'inherit'] });
  return import('file://' + out);
}

const mod = await loadCast();
const THREE = mod.THREE;

/**
 * Build one character and bucket every mesh into `head` / `body` / `neck`.
 * `lift` displaces the `head` joint first — the known-bad.
 */
function measure(id, lift = 0) {
  const { value } = captureWarnings(() => mod.createCharacter(id));
  const rig = value.rig;
  rig.restPose();
  if (lift) rig.joints.head.position.y += lift;
  rig.joints.root.updateWorldMatrix(true, true);

  const headJoint = rig.joints.head;
  const isUnder = (o, ancestor) => {
    for (let p = o; p; p = p.parent) if (p === ancestor) return true;
    return false;
  };

  const rows = [];
  rig.joints.root.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry) return;
    const box = new THREE.Box3().setFromObject(o);
    if (!isFinite(box.min.y) || box.isEmpty()) return;
    const side = NECK_MESHES.has(baseName(o.name)) ? 'neck' : (isUnder(o, headJoint) ? 'head' : 'body');
    rows.push({
      name: o.name || '(unnamed)', side,
      yMin: box.min.y, yMax: box.max.y,
      xMin: box.min.x, xMax: box.max.x, zMin: box.min.z, zMax: box.max.z,
    });
  });

  const body = rows.filter((r) => r.side === 'body');
  const head = rows.filter((r) => r.side === 'head');
  const neck = rows.filter((r) => r.side === 'neck');
  const bodyTop = body.length ? Math.max(...body.map((r) => r.yMax)) : NaN;
  const headBot = head.length ? Math.min(...head.map((r) => r.yMin)) : NaN;
  const m = rig.metrics;
  // The WHOLE figure, because a join fixed by growing the head downward is only free
  // if the character's overall height did not move — `H`/`headFraction` are tuned to
  // land the top of the food mass at the cast's standard height, and a silent 0.03 m
  // there is an apparent-size change wearing a structure fix's clothes.
  const figTop = Math.max(...rows.map((r) => r.yMax));
  const figBot = Math.min(...rows.map((r) => r.yMin));
  return {
    id, rows, body, head, neck, figTop, figBot,
    bodyTop, headBot, gap: headBot - bodyTop,
    bodyTopBy: body.slice().sort((a, b) => b.yMax - a.yMax)[0]?.name ?? '—',
    headBotBy: head.slice().sort((a, b) => a.yMin - b.yMin)[0]?.name ?? '—',
    colTop: neck.length ? Math.max(...neck.map((r) => r.yMax)) : NaN,
    torsoTopY: m.torsoTopY, headCentreY: m.headCentreY, headRadius: m.headRadius,
    neckGap: m.neckGap, neckRadius: m.neckRadius, torsoHeight: m.torsoHeight,
    torsoWidth: m.torsoWidth, shoulderWidth: m.shoulderWidth,
  };
}

// ── --knownbad lift ─────────────────────────────────────────────────────────
if (KNOWNBAD === 'lift') {
  console.log(`KNOWN-BAD: does the reported gap follow the head? head +${DY} m must add exactly ${DY} to it.\n`);
  let bad = 0;
  for (const id of IDS) {
    const a = measure(id, 0);
    const b = measure(id, DY);
    const moved = b.gap - a.gap;
    const ok = Math.abs(moved - DY) < 1e-9;
    console.log(`${id.padEnd(12)} gap ${a.gap.toFixed(6)} -> ${b.gap.toFixed(6)}   Δ ${moved.toFixed(9)}   ${ok ? '✓' : '🔴'}`);
    if (!ok) bad++;
  }
  console.log(bad ? `\n🔴 KNOWN-BAD FAILED on ${bad}` : '\n✓ the gap tracks the head exactly.');
  process.exit(bad ? 1 : 0);
}

// ── --knownbad sort ─────────────────────────────────────────────────────────
if (KNOWNBAD === 'sort') {
  console.log('KNOWN-BAD: this instrument must reproduce the split nm_island measured in PIXELS.\n'
    + '  hotdog, sushi  (reverted, head became its own island)   gap MUST be > 0\n'
    + '  soup,   pizza  (migrated and shipped, 1 component)      gap MUST be <= 0\n');
  let bad = 0;
  for (const [id, want] of [['hotdog', '>'], ['sushi', '>'], ['soup', '<='], ['pizza', '<=']]) {
    const r = measure(id, 0);
    const ok = want === '>' ? r.gap > 0 : r.gap <= 0;
    console.log(`${id.padEnd(12)} gap ${r.gap.toFixed(6)}  (want ${want} 0)  body top ${r.bodyTop.toFixed(4)} by ${r.bodyTopBy}`
      + `   head bottom ${r.headBot.toFixed(4)} by ${r.headBotBy}   ${ok ? '✓' : '🔴'}`);
    if (!ok) bad++;
  }
  console.log(bad ? `\n🔴 KNOWN-BAD FAILED on ${bad}` : '\n✓ the gap sorts the cast the way the pixels did.');
  process.exit(bad ? 1 : 0);
}

// ── report ──────────────────────────────────────────────────────────────────
const out = {};
for (const id of IDS) {
  const r = measure(id, 0);
  out[id] = {
    gap: r.gap, bodyTop: r.bodyTop, bodyTopBy: r.bodyTopBy, headBot: r.headBot, headBotBy: r.headBotBy,
    torsoTopY: r.torsoTopY, headCentreY: r.headCentreY, headRadius: r.headRadius,
    neckGap: r.neckGap, neckRadius: r.neckRadius, colTop: r.colTop,
    torsoHeight: r.torsoHeight, torsoWidth: r.torsoWidth, shoulderWidth: r.shoulderWidth,
  };
  console.log(`\n── ${id} ──────────────────────────────────────────────────────`);
  console.log(`  R ${r.headRadius.toFixed(6)}   headCentreY ${r.headCentreY.toFixed(6)}   torsoTopY ${r.torsoTopY.toFixed(6)}`);
  console.log(`  neckGap ${r.neckGap.toFixed(6)}   neckRadius ${r.neckRadius.toFixed(6)}   column reaches y ${r.colTop.toFixed(6)}`);
  console.log(`  torsoHeight ${r.torsoHeight.toFixed(6)}  torsoWidth ${r.torsoWidth.toFixed(6)}  shoulderWidth ${r.shoulderWidth.toFixed(6)}`);
  console.log(`  BODY top     ${r.bodyTop.toFixed(6)}  (${r.bodyTopBy})`);
  console.log(`  HEAD bottom  ${r.headBot.toFixed(6)}  (${r.headBotBy})`);
  console.log(`  FIGURE  y ${r.figBot.toFixed(6)} .. ${r.figTop.toFixed(6)}   height ${(r.figTop - r.figBot).toFixed(6)}`);
  console.log(`  🔴 AIR GAP once the column goes: ${r.gap.toFixed(6)} m`
    + `   = ${(r.gap / r.headRadius).toFixed(4)} R   = ${(r.gap / r.torsoHeight).toFixed(4)} torsoH`);
  if (PARTS) {
    const top = r.body.slice().sort((a, b) => b.yMax - a.yMax).slice(0, 10);
    const bot = r.head.slice().sort((a, b) => a.yMin - b.yMin).slice(0, 10);
    console.log('  body, highest 10:');
    for (const p of top) console.log(`    ${p.name.padEnd(28)} yMax ${p.yMax.toFixed(4)}  x[${p.xMin.toFixed(3)},${p.xMax.toFixed(3)}]  z[${p.zMin.toFixed(3)},${p.zMax.toFixed(3)}]`);
    console.log('  head, lowest 10:');
    for (const p of bot) console.log(`    ${p.name.padEnd(28)} yMin ${p.yMin.toFixed(4)}  x[${p.xMin.toFixed(3)},${p.xMax.toFixed(3)}]  z[${p.zMin.toFixed(3)},${p.zMax.toFixed(3)}]`);
  }
}
if (JSONOUT) console.log(`\n${writeOut(JSONOUT, out)}`);
