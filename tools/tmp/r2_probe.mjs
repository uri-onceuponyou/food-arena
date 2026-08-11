#!/usr/bin/env node
/**
 * r2_probe — the three 3D FACTS this rig pass is about, computed offline on the real
 * cast, with no browser and no GPU.
 *
 * THROWAWAY. READ-ONLY on `src/`. Measurement instrument; changes no game code.
 *
 * ── WHY OFFLINE ──────────────────────────────────────────────────────────────
 * All three questions below are questions about GEOMETRY, and `rg_lib.mjs` already
 * builds the whole cast in node in ~200 ms. A rendered frame cannot answer any of
 * them: two surfaces 4 cm apart and two surfaces touching produce the same
 * silhouette from most angles, and the one camera that shows the difference
 * (`charStage.ts`'s pitch 20) is exactly the camera the offline rasteriser
 * `rg_solid.mjs` is documented to be wrong about, by up to 35x.
 *
 * ⚠️ **So the rule for this file is: it computes 3D facts, and every PIXEL claim
 * still has to come from an ablated capture through the shipped path.** A gap of
 * 0.047 m is a fact at every camera; how many pixels of daylight it delivers is not.
 *
 * ── MODE `shoulder` — IS THERE DAYLIGHT BETWEEN THE ARM AND THE BODY ─────────
 * `sushi.ts` caps its maki-roll torso at `min(torsoH * 0.46, shoulderWidth -
 * armRadius * 1.15)` and then builds its own upper arm at `size.radius * 0.88`, so
 * the roll's surface and the arm's INNER surface are separated by a gap that no
 * per-character `shoulderWidth` tune can close — widening the shoulder moves BOTH
 * terms. This mode measures that gap as a length, on all eleven, without assuming
 * which of the two `min` arms binds (on sushi it is the FIRST, `torsoH * 0.46`, so
 * the brief's `armRadius * (1.15 - 0.88)` derivation is the wrong branch and the
 * real number is larger).
 *
 * The measurement is a ray along the horizontal line from the body's own vertical
 * axis out through the shoulder pivot, at each of `--rows` heights spanning the
 * upper arm, in the SHIPPED REST POSE:
 *
 *     gap(y) = (first ARM surface) - (last BODY surface), both as distance from the axis
 *
 * Positive is daylight. Negative means the arm is inside the body, which is the
 * normal and correct state for a limb emerging from a mass.
 *
 * ⚠️ **THE RAYS ARE FIRED FROM TWO DIFFERENT ENDS** — see `shoulderProfile`. A first
 * version forced `DoubleSide` on every material and fired both from the axis; it
 * passed four synthetic selftests and disagreed with the shipped geometry on hotdog
 * by 0.23 m.
 *
 * ── MODE `bridge` — WHAT `ChibiRig.fitShoulders()` WILL DO, PER SIDE ────────
 * One row at `--f` of the upper arm below the pivot, which is the row the rig
 * measures, in the rig's own torso-local frame. This is the preview of the fit.
 *
 * ── MODE `anchor` — WHO IS ON `massAnchor`'s BOUNDING-BOX FALLBACK ──────────
 * A fallback anchor is a point on NO SURFACE — for a non-convex mass the bounding
 * box is not an approximation of the geometry, it is a place the geometry is not.
 * Donut has two, both icing drips at a BACK azimuth of a torus, where the ray fired
 * through the mass's own centre runs down the hole and touches nothing at any height.
 *
 * The mode gates on an ALLOWLIST: those two are named with their cause, anything new
 * FAILS, and a listed entry that stops firing also FAILS so the list cannot go stale.
 * ⚠️ A "search for a nearby surface" recovery was built and reverted — see
 * `massAnchor` for the render that killed it.
 *
 * ── MODE `neck` — THE `neckFraction: 0` MIGRATION ARITHMETIC ────────────────
 * `25d5579` established that a neck column the food mass does not hide is a defect,
 * and that `taco.ts` opted out with `neckFraction: 0` plus a compensation that left
 * R and `headCentreY` identical to six figures. That compensation is not magic, it
 * is two lines of algebra, and this mode prints it for every character:
 *
 *     R      = (height * headFraction - 2 * gap / (1 + headMount)) / 2
 *     centre = torsoTopY + gap + R * headMount
 *   so with gap -> 0 and R, centre held:
 *     headFraction' = 2R / height          headMount' = headMount + gap / R
 *
 * The migration is then VERIFIED by building a second real `ChibiRig` with those
 * numbers and comparing `headRadius` and `headCentreY` — see `--selftest`.
 *
 * ── USE ──────────────────────────────────────────────────────────────────────
 *   node tools/tmp/r2_probe.mjs --mode shoulder    # the gap profile, 9 rows per side
 *   node tools/tmp/r2_probe.mjs --mode bridge      # what fitShoulders() will build
 *   node tools/tmp/r2_probe.mjs --mode neck        # the per-character migration list
 *   node tools/tmp/r2_probe.mjs --mode anchor      # the fallback gate (exit 1 on new/stale)
 *   node tools/tmp/r2_probe.mjs --selftest
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { REPO, ALL_IDS, ARCHETYPE, captureWarnings, arg, flag, num, writeOut } from './rg_lib.mjs';

const MODE = arg('--mode', 'shoulder');
const IDS = arg('--ids', 'all') === 'all' ? ALL_IDS : arg('--ids', '').split(',').filter(Boolean);
const ROWS = num('--rows', 9);
const JSON_OUT = arg('--json', null);

/**
 * The same one-file esbuild bundle `rg_lib.buildBundle()` makes, plus the two
 * `appendages.ts` exports this pass needs (`massAnchor`, `massAnchorLog`).
 *
 * A local copy rather than an extra export on `rg_lib.mjs`, because that file is not
 * in this agent's owned set — one owner per file, and a two-line convenience is not
 * worth a second owner in a file ten other tools import.
 */
async function loadR2() {
  const dir = mkdtempSync(path.join(tmpdir(), 'r2-'));
  const entry = path.join(dir, 'entry.ts');
  const q = (p) => JSON.stringify(path.join(REPO, p));
  writeFileSync(entry, [
    `export { createCharacter } from ${q('src/characters/registry')};`,
    `export { ChibiRig } from ${q('src/characters/rig')};`,
    `export { bodyType, withoutNeck } from ${q('src/characters/bodies')};`,
    `export { massAnchor, massAnchorLog, localBounds } from ${q('src/characters/appendages')};`,
    "export * as THREE from 'three';",
  ].join('\n'));
  const out = path.join(dir, 'bundle.mjs');
  const esbuild = path.join(REPO, 'node_modules/.bin/esbuild');
  if (!existsSync(esbuild)) throw new Error(`esbuild not found at ${esbuild}`);
  execFileSync(esbuild, [entry, '--bundle', '--format=esm', '--platform=node',
    `--alias:three=${path.join(REPO, 'node_modules/three')}`,
    `--outfile=${out}`, '--log-level=error'], { cwd: REPO, stdio: ['ignore', 'inherit', 'inherit'] });
  return import('file://' + out);
}

const mod = await loadR2();
const THREE = mod.THREE;

const LIMB_JOINTS = new Set(['shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'handL', 'handR',
  'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR']);

function isGhost(m) {
  const a = Array.isArray(m.material) ? m.material : [m.material];
  return a.length > 0 && a.every((x) => !!x && x.transparent === true && (x.opacity ?? 1) < 0.9);
}
function underLimb(o) { for (let n = o; n; n = n.parent) if (LIMB_JOINTS.has(n.name)) return true; return false; }
function collect(root, pred) {
  const out = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if ((o.name || '').endsWith('__outline')) return;
    if (isGhost(o)) return;
    if (pred(o)) out.push(o);
  });
  return out;
}
/**
 * The gap between the body's surface and the arm's inner surface at one shoulder,
 * as a function of height. `rig` must already be posed with current world matrices.
 *
 * 🚨 **THE THREE RAYS ARE FIRED FROM TWO DIFFERENT ENDS, AND THAT IS THE WHOLE
 * MEASUREMENT.** `three` honours `material.side`, and the shipped cast is
 * `FrontSide`, so:
 *
 *   · a ray fired from the body AXIS outward NEVER sees the body — every wall it
 *     would cross faces away from it — but DOES see the arm's INNER face, which is
 *     exactly the surface wanted;
 *   · a ray fired from OUTSIDE inward sees the body's OUTER face first, and the
 *     arm's OUTER face first.
 *
 * ⚠️ **A FIRST VERSION FORCED `DoubleSide` ON EVERY MATERIAL AND MEASURED BOTH FROM
 * THE AXIS. It passed four synthetic selftests and disagreed with the shipped
 * geometry on hotdog by 0.23 m** — reporting +0.221 m of daylight where the
 * two-ended version reports −0.011 m (attached), and where the shipped lobby render
 * plainly shows the bun meeting the arm. The cause is that "the last body surface
 * inside the arm" is not the body's silhouette edge once a ray is crossing walls in
 * both directions: it picks whichever interior wall happens to be last. The
 * two-ended scheme is the one `ChibiRig.fitShoulders()` uses, so the instrument and
 * the implementation now ask the geometry the same question.
 */
function shoulderProfile(rig, side, rows) {
  const j = rig.joints;
  const torso = j.torso;
  torso.updateWorldMatrix(true, true);
  const body = collect(j.body, (m) => !underLimb(m) && m !== rig.pelvisMesh
    && !(m.name || '').startsWith('shoulder_bridge_'));
  const arm = collect(j['shoulder' + side], () => true);
  // ⚠️ TORSO-LOCAL, not world, and that matters: `shoulderL/R` sit at
  // `(±shoulderWidth, shoulderY, 0)` in the torso's own frame, so in that frame the
  // ray is exactly ±x and the body axis is x = 0 — which is the frame
  // `ChibiRig.fitShoulders()` builds in. Measuring on a world-horizontal ray instead
  // asks a slightly different question (the rest pose tilts the torso 0.05 rad in z
  // plus the character's `lean`) and the two disagreed on taco by enough to flip its
  // verdict. The instrument now asks the implementation's question.
  const sgn = side === 'L' ? -1 : 1;
  const L = rig.metrics.shoulderWidth;
  const rc = new THREE.Raycaster();
  const upper = rig.metrics.upperArmLength;
  const span = L * 4 + 2;
  const from = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const shoot = (targets, y, outward) => {
    from.set(outward ? 0 : sgn * span, y, 0);
    dir.set(outward ? sgn : -sgn, 0, 0);
    rc.set(torso.localToWorld(from.clone()), dir.clone().transformDirection(torso.matrixWorld).normalize());
    rc.near = 0; rc.far = span * 1.2;
    const h = rc.intersectObjects(targets, false)[0];
    if (!h) return null;
    return { d: outward ? h.distance : span - h.distance, o: h.object };
  };
  const prof = [];
  for (let i = 0; i < rows; i++) {
    // From the shoulder pivot DOWN one upper arm. The pivot row itself is skipped: a
    // lathe's top ring sits exactly AT the joint origin, so a horizontal ray at that
    // height grazes a point and reports the arm as infinitely thin.
    const f = (i + 1) / (rows + 1);
    const y = rig.metrics.shoulderY - upper * f;
    const ai = shoot(arm, y, true);
    const bo = shoot(body, y, false);
    const ao = shoot(arm, y, false);
    const armInner = ai ? ai.d : null;
    const bodyOuter = bo ? bo.d : null;
    const armOuter = ao ? ao.d : null;
    prof.push({
      f: +f.toFixed(3), y: +y.toFixed(4),
      body: bodyOuter === null ? null : +bodyOuter.toFixed(4),
      armInner: armInner === null ? null : +armInner.toFixed(4),
      armR: armInner === null || armOuter === null ? null : +((armOuter - armInner) * 0.5).toFixed(4),
      gap: armInner === null || bodyOuter === null ? null : +(armInner - bodyOuter).toFixed(4),
      via: bo ? (bo.o.name || '(unnamed)') : '-',
    });
  }
  return { L: +L.toFixed(4), prof };
}

function build(id) {
  const { value, warns } = captureWarnings(() => mod.createCharacter(id));
  const rig = value.rig;
  rig.restPose();
  rig.joints.root.updateWorldMatrix(true, true);
  return { ch: value, rig, warns };
}

// ── shoulder ────────────────────────────────────────────────────────────────
if (MODE === 'shoulder') {
  const out = [];
  console.log('char         arch      side  |S-axis|   maxGap  at f   minGap   rows>0   via');
  for (const id of IDS) {
    const { rig } = build(id);
    for (const side of ['L', 'R']) {
      const { L, prof } = shoulderProfile(rig, side, ROWS);
      const gaps = prof.filter((p) => p.gap !== null);
      const maxg = gaps.length ? Math.max(...gaps.map((p) => p.gap)) : NaN;
      const ming = gaps.length ? Math.min(...gaps.map((p) => p.gap)) : NaN;
      const at = gaps.length ? gaps[gaps.map((p) => p.gap).indexOf(maxg)] : null;
      const pos = gaps.filter((p) => p.gap > 0).length;
      console.log(`${id.padEnd(12)} ${ARCHETYPE[id].padEnd(9)} ${side}     ${L.toFixed(4)}  ${fmt(maxg)}  ${at ? at.f.toFixed(2) : ' -- '}  ${fmt(ming)}   ${pos}/${gaps.length}    ${at ? at.via : '-'}`);
      out.push({ id, side, L, maxGap: maxg, minGap: ming, positiveRows: pos, rows: gaps.length, prof });
    }
  }
  if (JSON_OUT) console.log('\nwrote', writeOut(JSON_OUT, out));
}

// ── bridge ──────────────────────────────────────────────────────────────────
// The SAME arithmetic `ChibiRig.fitShoulders()` runs, re-implemented here against
// the SHIPPED `FrontSide` materials so the two can disagree.
//
// 🚨 THE TWO RAYS ARE CAST FROM OPPOSITE ENDS ON PURPOSE, AND IT IS NOT A STYLE
// CHOICE. `three` honours `material.side`, so a ray fired from the body AXIS never
// sees the body (every wall faces away from it) but DOES see the arm's inner face,
// and a ray fired from OUTSIDE sees the body's outer face first. Getting this
// backwards returns `null` and reads as "there is no body there".
if (MODE === 'bridge') {
  console.log('char         side  pivot   bodyOuter  armInner   gap      armR    gap/armR  via');
  const out = [];
  const F = num('--f', 0.15);
  for (const id of IDS) {
    const { rig } = build(id);
    for (const side of ['L', 'R']) {
      // One row, at the height `fitShoulders()` measures: `--f` of the upper arm
      // below the pivot. `rows = round(1/F) - 1` puts row 0 at exactly `F`.
      const rows = Math.max(1, Math.round(1 / F) - 1);
      const { L, prof } = shoulderProfile(rig, side, rows);
      const p = prof[0];
      const ratio = p.gap === null || !p.armR ? null : p.gap / p.armR;
      out.push({ id, side, L, f: p.f, ...p, ratio });
      console.log(`${id.padEnd(12)} ${side}     ${L.toFixed(3)}   ${p.body === null ? '  --  ' : p.body.toFixed(4)}    ${p.armInner === null ? '  --  ' : p.armInner.toFixed(4)}   ${p.gap === null ? '  --  ' : (p.gap >= 0 ? '+' : '') + p.gap.toFixed(4)}  ${p.armR === null ? '  --  ' : p.armR.toFixed(4)}  ${ratio === null ? '  --  ' : (ratio >= 0 ? ' ' : '') + ratio.toFixed(2)}     ${p.via}`);
    }
  }
  if (JSON_OUT) console.log('\nwrote', writeOut(JSON_OUT, out));
}

// ── anchor ──────────────────────────────────────────────────────────────────
if (MODE === 'anchor') {
  // ── THE ALLOWLIST IS THE GATE, AND IT IS NOW EMPTY ─────────────────────────
  // A box fallback is a point on NO SURFACE — `taco.ts` calls it a build failure at
  // its own call site and it is right.
  //
  // WAS, and kept per `CLAUDE.md`'s rule on reversed assertions:
  //   { id: 'donut', azimuth:  '2.83', height01: '0.48',
  //     why: 'icing drip at the BACK of a torus — the ray runs down the hole' },
  //   { id: 'donut', azimuth: '-2.70', height01: '0.40', why: 'the mirror of the above' },
  // — *"Two exist on HEAD and both are donut's, so a bare 'exit non-zero on any
  // fallback' would be a gate that fails on the shipped tree, i.e. a gate nobody can
  // add to the battery."* True when written. **Both were fixed in `donut.ts` by moving
  // those drips from 0.90pi / -0.86pi to ±0.62pi**, an azimuth where the ring exists
  // — swept at construction time, 41 azimuths x 7 heights, see that file — so the
  // entries went STALE and this gate correctly FAILED until they were removed. That
  // is the allowlist doing exactly what it was built to do.
  //
  // The list stays as a mechanism rather than being deleted: the cast is at ZERO box
  // fallbacks, so any new one is a real defect and must fail. Add an entry only with
  // the cause and the fix written next to it, and expect to remove it again.
  const KNOWN = [];
  const seen = [];
  let unexpected = 0;
  for (const id of IDS) {
    const { warns } = build(id);
    const lines = warns.filter((w) => w.includes('[appendages]'));
    console.log(`${id.padEnd(12)} BOX-FALLBACK=${lines.length}`);
    for (const w of lines) {
      const m = /azimuth (-?[\d.]+) height01 ([\d.]+)/.exec(w);
      const k = KNOWN.find((x) => x.id === id && m && x.azimuth === m[1] && x.height01 === m[2]);
      if (k) { seen.push(k); console.log(`   KNOWN  ${w}\n          ^ ${k.why}`); }
      else { unexpected++; console.log(`   🔴 NEW  ${w}`); }
    }
  }
  const stale = KNOWN.filter((k) => !seen.includes(k));
  for (const k of stale) console.log(`\n🔴 STALE allowlist entry — ${k.id} azimuth ${k.azimuth} no longer falls back. Remove it.`);
  console.log(`\n${seen.length} known bounding-box fallback(s), ${unexpected} new, ${stale.length} stale.`);
  // Printed only when there is something to fix. It used to print unconditionally and
  // named donut's two drips, which is stale advice now that they are fixed — a tool
  // that keeps prescribing a completed fix is the same class as a stale count.
  if (unexpected) {
    console.log('FIX (character files, not this one): ask for the appendage at an azimuth and height '
      + 'where that mass EXISTS. A torus has no surface on its own hole axis at ANY height, and a '
      + 'height search finds the hole\'s inner lip — built, rendered, reverted (see `massAnchor`).');
  }
  if (unexpected || stale.length) process.exit(1);
}

// ── neck ────────────────────────────────────────────────────────────────────
if (MODE === 'neck') {
  const out = [];
  console.log('char         arch      neckFrac   gap m      R        headMount  ->  headFraction\'  headMount\'');
  for (const id of IDS) {
    const { rig } = build(id);
    const m = rig.metrics;
    const gap = m.neckGap;
    const R = m.headRadius;
    const hm = (m.headCentreY - m.torsoTopY - gap) / R;      // the AUTHORED headMount, re-derived
    // Printed from `withoutNeck()` itself, not re-derived here — a migration list a
    // reader has to trust a second implementation of is a migration list with a bug
    // in it. `--selftest` proves the two agree on every character.
    const mig = mod.withoutNeck({
      height: m.height, headFraction: m.headFraction, headMount: hm,
      neckFraction: gap / m.height,
    });
    const hf2 = mig.headFraction;
    const hm2 = mig.headMount;
    const row = {
      id, arch: ARCHETYPE[id], neckFraction: +(gap / m.height).toFixed(6), gap: +gap.toFixed(6),
      R: +R.toFixed(6), headMount: +hm.toFixed(6),
      headFraction2: +hf2.toFixed(6), headMount2: +hm2.toFixed(6),
      builtColumn: gap > 0,
    };
    out.push(row);
    console.log(`${id.padEnd(12)} ${ARCHETYPE[id].padEnd(9)} ${row.neckFraction.toFixed(4)}   ${gap.toFixed(4)}   ${R.toFixed(4)}   ${hm.toFixed(6)}   ->  ${hf2.toFixed(6)}      ${hm2.toFixed(6)}${gap > 0 ? '   <- BUILDS A COLUMN' : ''}`);
  }
  if (JSON_OUT) console.log('\nwrote', writeOut(JSON_OUT, out));
}

function fmt(v) { return Number.isNaN(v) ? '   --  ' : (v >= 0 ? '+' : '') + v.toFixed(4); }

// ── selftest ────────────────────────────────────────────────────────────────
// 🚨 EVERY ASSERTION BELOW NAMES AN IMPLEMENTATION THAT WOULD FAIL IT. An assertion
// no implementation can fail is a comment with a tick next to it.
if (flag('--selftest')) {
  let pass = 0, fail = 0;
  const T = (name, fn) => {
    try { fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}: ${e.message}`); }
  };
  const near = (a, b, tol, what) => {
    if (!(Math.abs(a - b) <= tol)) throw new Error(`${what}: ${a} vs ${b} (tol ${tol})`);
  };

  console.log('r2_probe selftests');

  // ── The gap measurement, against a rig whose answer is known by construction ──
  // A body cylinder of radius `br` on the axis and an arm capsule of radius `ar`
  // centred at x = sw. The daylight is exactly `sw - ar - br`, and that is a number
  // this probe must reproduce — a probe that returned the ARM's radius, or the
  // distance to the arm CENTRE, or the far wall, all fail here.
  const synth = (sw, br, ar, opts = {}) => {
    const rig = new mod.ChibiRig({
      palette: { limb: '#888888', hand: '#888888', foot: '#888888' },
      proportions: mod.bodyType('standard', { shoulderWidth: sw, armRadius: ar }),
      jointsOnly: true,
    });
    const S = rig.joints.shoulderL.position.y;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(br, br, 4, 48, 1),
      new THREE.MeshBasicMaterial());
    body.name = 'synth_body';
    body.position.y = S - (opts.bodyDrop ?? 0);
    rig.joints.torso.add(body);
    for (const side of ['L', 'R']) {
      const a = new THREE.Mesh(new THREE.CylinderGeometry(ar, ar, 2, 48, 1), new THREE.MeshBasicMaterial());
      a.name = 'synth_arm';
      a.position.y = -1 + 0.0;
      rig.joints['shoulder' + side].add(a);
    }
    rig.joints.root.updateWorldMatrix(true, true);
    return rig;
  };

  T('gap == sw - ar - br by construction', () => {
    const sw = 0.50, br = 0.22, ar = 0.10;
    const rig = synth(sw, br, ar);
    const { prof } = shoulderProfile(rig, 'L', 5);
    const g = prof.filter((p) => p.gap !== null).map((p) => p.gap);
    if (!g.length) throw new Error('no rows measured at all');
    for (const v of g) near(v, sw - ar - br, 2e-3, 'gap');
  });

  T('POISON: moving the arm out by d moves the gap by exactly d', () => {
    const sw = 0.50, br = 0.22, ar = 0.10, d = 0.037;
    const a = shoulderProfile(synth(sw, br, ar), 'L', 5).prof.find((p) => p.gap !== null).gap;
    const b = shoulderProfile(synth(sw + d, br, ar), 'L', 5).prof.find((p) => p.gap !== null).gap;
    near(b - a, d, 2e-3, 'delta');
  });

  T('POISON: widening the body by d closes the gap by exactly d', () => {
    const sw = 0.50, br = 0.22, ar = 0.10, d = 0.031;
    const a = shoulderProfile(synth(sw, br, ar), 'L', 5).prof.find((p) => p.gap !== null).gap;
    const b = shoulderProfile(synth(sw, br + d, ar), 'L', 5).prof.find((p) => p.gap !== null).gap;
    near(a - b, d, 2e-3, 'delta');
  });

  T('KNOWN-BAD: a body that swallows the arm reads NEGATIVE, not 0 and not null', () => {
    const rig = synth(0.30, 0.60, 0.10);
    const g = shoulderProfile(rig, 'L', 5).prof.filter((p) => p.gap !== null).map((p) => p.gap);
    if (!g.length) throw new Error('measured nothing where the arm is fully buried');
    if (!g.every((v) => v < -0.05)) throw new Error(`expected all-negative, got ${g.join(', ')}`);
  });

  T('KNOWN-BAD: an axis-origin ray CANNOT see a FrontSide body — hence two ray ends', () => {
    // The reason `shoulderProfile` fires the body ray from OUTSIDE. If this ever
    // starts hitting, `three` changed its side handling and the header note — and
    // `ChibiRig.fitShoulders()`, which relies on the same fact — are both stale.
    const rig = synth(0.50, 0.22, 0.10);
    const j = rig.joints;
    const S = new THREE.Vector3().setFromMatrixPosition(j.shoulderL.matrixWorld);
    const T2 = new THREE.Vector3().setFromMatrixPosition(j.torso.matrixWorld);
    const axis = new THREE.Vector3(T2.x, S.y, T2.z);
    const u = new THREE.Vector3().subVectors(S, axis); u.y = 0; u.normalize();
    const body = collect(j.body, (m) => !underLimb(m));
    for (const m of body) { const a = Array.isArray(m.material) ? m.material : [m.material]; for (const mm of a) mm.side = THREE.FrontSide; }
    const rc = new THREE.Raycaster(axis.clone(), u.clone(), 0, 10);
    if (rc.intersectObjects(body, false).length !== 0) throw new Error('FrontSide ray HIT — the two-ended scheme is now unnecessary, and this note is wrong');
  });

  T('the arm RADIUS is recovered, not assumed', () => {
    // `armR` is (outer - inner)/2 from two rays fired from opposite ends. A version
    // that fired both from the axis returned 0 on nine of eleven characters, because
    // `FrontSide` gives exactly ONE hit per convex mesh from inside.
    const ar = 0.10;
    const p = shoulderProfile(synth(0.50, 0.22, ar), 'L', 5).prof[0];
    near(p.armR, ar, 2e-3, 'armR');
  });

  // ── `ChibiRig.fitShoulders()`: the branch that BUILDS, and the three that REFUSE ──
  // No shipped character reaches the "gap too wide" branch (worst is sushi at 0.90x
  // the arm's radius), so it is proved here or not at all — an untaken branch that
  // has never been shown to fire is not a guard.
  const fitted = (sw, br, ar, opts = {}) => {
    const rig = synth(sw, br, ar, opts);
    rig.fitShoulders();
    return rig;
  };

  // Parameters chosen so `gap / armR` lands INSIDE the build window (1.17x against
  // the 1.5x refusal): 0.50 - 0.12 - 0.24 = 0.14 m of daylight on a 0.12 m arm.
  const BUILD = [0.50, 0.24, 0.12];
  T('fitShoulders BUILDS across the daylight and stops at the arm axis', () => {
    const [sw, br, ar] = BUILD;
    const rig = fitted(sw, br, ar);
    const b = rig.shoulderBridge.L;
    if (!b) throw new Error('no bridge built on a 0.18 m gap');
    const innerX = Math.abs(b.position.x) - b.scale.x;
    const outerX = Math.abs(b.position.x) + b.scale.x;
    near(outerX, sw, 2e-3, 'outer end at the pivot');
    near(innerX, br - ar * 0.5, 3e-3, 'inner end half an arm-radius inside the body');
  });

  T('the bridge is NEVER wider than the arm it belongs to', () => {
    const ar = BUILD[2];
    const b = fitted(...BUILD).shoulderBridge.L;
    if (!b) throw new Error('no bridge');
    if (b.scale.y > ar + 2e-3 || b.scale.z > ar + 2e-3) {
      throw new Error(`bridge radius ${b.scale.y} exceeds the arm's ${ar}`);
    }
  });

  T('KNOWN-BAD: an already-attached arm gets NO bridge', () => {
    // Body radius past the arm's inner face: gap is negative, nothing to bridge.
    const rig = fitted(0.30, 0.28, 0.10);
    if (rig.shoulderBridge.L || rig.shoulderBridge.R) throw new Error('built a bridge over a negative gap');
  });

  T('KNOWN-BAD: a gap wider than 1.5x the arm radius is REFUSED, not bridged', () => {
    // 0.60 pivot against a 0.10 body and a 0.05 arm: gap 0.45 = 9x the arm radius.
    // A bridge here would be a new limb segment growing out of the torso.
    const rig = fitted(0.60, 0.10, 0.05);
    if (rig.shoulderBridge.L || rig.shoulderBridge.R) throw new Error('bridged a 9x gap instead of refusing');
  });

  T('KNOWN-BAD: no body on the shoulder ray is REFUSED', () => {
    // The body is moved far below the probe row, so the ray finds nothing — taco's
    // real situation, where the torso fold ends 0.04 m under the shoulder pivot.
    const rig = fitted(BUILD[0], BUILD[1], BUILD[2], { bodyDrop: 3.0 });
    if (rig.shoulderBridge.L || rig.shoulderBridge.R) throw new Error('bridged to a body that is not there');
  });

  T('fitShoulders RESTORES the pose it borrows', () => {
    // It calls `restPose()` to measure, because nothing is ever RENDERED at identity.
    // Leaving that pose behind would move every `massAnchor` anchor on every
    // character — `solveArmClearance()` records the same trap.
    const rig = synth(...BUILD);
    const before = Object.values(rig.joints).map((g) => g.rotation.toArray().join(','));
    rig.fitShoulders();
    const after = Object.values(rig.joints).map((g) => g.rotation.toArray().join(','));
    for (let i = 0; i < before.length; i++) {
      if (before[i] !== after[i]) throw new Error(`joint ${i} left posed: ${before[i]} -> ${after[i]}`);
    }
  });

  T('fitShoulders is idempotent — a second dressLimbs() cannot double it', () => {
    const rig = fitted(...BUILD);
    const n = () => { let c = 0; rig.joints.torso.traverse((o) => { if ((o.name || '').startsWith('shoulder_bridge_')) c++; }); return c; };
    const first = n();
    rig.fitShoulders();
    if (n() !== first) throw new Error(`bridge count went ${first} -> ${n()}`);
  });

  // ── The neck migration, verified by BUILDING the migrated rig ───────────────
  T('withoutNeck() holds R and headCentreY to 1e-9 on every archetype', () => {
    const P = { limb: '#888', hand: '#888', foot: '#888' };
    for (const arch of ['stout', 'standard', 'lanky']) {
      const props = mod.bodyType(arch);
      const m = new mod.ChibiRig({ palette: P, proportions: props, jointsOnly: true }).metrics;
      if (!(m.neckGap > 0)) throw new Error(`${arch} has no neck gap — nothing to migrate`);
      const mig = new mod.ChibiRig({ palette: P, proportions: mod.withoutNeck(props), jointsOnly: true }).metrics;
      near(mig.headRadius, m.headRadius, 1e-9, `${arch} R`);
      near(mig.headCentreY, m.headCentreY, 1e-9, `${arch} headCentreY`);
      if (mig.neckGap !== 0) throw new Error(`${arch} still has a gap`);
    }
  });

  T('withoutNeck() holds R and headCentreY on every REAL character', () => {
    // The archetypes are the easy case. A character's own tweaks — sushi's
    // `headMount: 0.50` and `torsoFraction: 0.31`, hotdog's `height` — are where a
    // re-derived formula goes wrong, which is the whole reason this is a function.
    // The proportions are read back off the BUILT rig rather than re-declared here,
    // so this cannot drift from what the character files actually pass.
    const P = { limb: '#888', hand: '#888', foot: '#888' };
    for (const id of ALL_IDS) {
      const { rig } = build(id);
      const m = rig.metrics;
      if (!(m.neckGap > 0)) continue;
      const headMount = (m.headCentreY - m.torsoTopY - m.neckGap) / m.headRadius;
      const props = {
        height: m.height, headFraction: m.headFraction, headMount,
        neckFraction: m.neckGap / m.height, torsoFraction: m.torsoHeight / m.height,
        legFraction: m.legLength / m.height, footClearance: m.ankleY / m.legLength,
      };
      // ⚠️ `stance` HAS TO COME ALONG, and finding out why is worth the line:
      // `RigStance.splay` moves `hipY` (the constructor solves the hip line from the
      // SPLAYED leg chain), `hipY` moves `torsoTopY`, and `headCentreY` is measured
      // from there. Reconstructing burrito's proportions without its stance
      // reproduced R exactly and put `headCentreY` **0.079 m** out — which would have
      // read as a `withoutNeck` bug and is not one.
      const a = new mod.ChibiRig({ palette: P, proportions: props, stance: rig.stance, jointsOnly: true }).metrics;
      near(a.headRadius, m.headRadius, 1e-9, `${id} reconstruction R`);
      near(a.headCentreY, m.headCentreY, 1e-9, `${id} reconstruction headCentreY`);
      const b = new mod.ChibiRig({ palette: P, proportions: mod.withoutNeck(props), stance: rig.stance, jointsOnly: true }).metrics;
      near(b.headRadius, m.headRadius, 1e-9, `${id} migrated R`);
      near(b.headCentreY, m.headCentreY, 1e-9, `${id} migrated headCentreY`);
    }
  });

  T('withoutNeck() is a no-op on a body that already has no neck', () => {
    const P = { limb: '#888', hand: '#888', foot: '#888' };
    const props = mod.bodyType('stub');
    const a = new mod.ChibiRig({ palette: P, proportions: props, jointsOnly: true }).metrics;
    const b = new mod.ChibiRig({ palette: P, proportions: mod.withoutNeck(props), jointsOnly: true }).metrics;
    near(b.headRadius, a.headRadius, 0, 'STUB R');
    near(b.headCentreY, a.headCentreY, 0, 'STUB headCentreY');
  });

  T('KNOWN-BAD: the NAIVE migration (drop the gap, keep headFraction) misses R', () => {
    // The trap the burrito file paid four rounds for: `R = height * headFraction / 2`
    // is false whenever there is a neck. A migration that only sets `neckFraction: 0`
    // must therefore MOVE the head, and this asserts it moves by a visible amount —
    // if it did not, the compensation above would be unnecessary and this whole
    // migration list would be noise.
    const m0 = new mod.ChibiRig({
      palette: { limb: '#888', hand: '#888', foot: '#888' },
      proportions: mod.bodyType('lanky'), jointsOnly: true,
    }).metrics;
    const m1 = new mod.ChibiRig({
      palette: { limb: '#888', hand: '#888', foot: '#888' },
      proportions: mod.bodyType('lanky', { neckFraction: 0 }), jointsOnly: true,
    }).metrics;
    if (Math.abs(m1.headRadius - m0.headRadius) < 1e-3) throw new Error('naive drop left R unchanged');
    if (Math.abs(m1.headCentreY - m0.headCentreY) < 1e-3) throw new Error('naive drop left the head centre unchanged');
  });

  // ── massAnchor's fallback, and what makes it a fallback ─────────────────────
  T('NO character is on the bounding-box fallback', () => {
    // ⚠️ TWO PREVIOUS WORDINGS, BOTH KEPT per CLAUDE.md's rule on reversed assertions,
    // because the difference between them is the whole lesson:
    //
    //   1. *"TWO anchors relocate to a real surface, ZERO fall back to the box"* —
    //      PASSED, against a height search inside `massAnchor` that was later reverted
    //      for putting both of donut's drips inside its own hole. Green test, worse
    //      render.
    //   2. *"donut is the ONLY character on the bounding-box fallback, and it has
    //      TWO"* — correct while the defect was live, and it FAILED the moment the
    //      defect was actually fixed. That failure is this assertion working: it
    //      pinned a shipped-tree FACT, and the fact changed.
    //
    // The fix that changed it is in `donut.ts`, not here: those two drips moved from
    // 0.90pi / -0.86pi to ±0.62pi, an azimuth where the ring exists. So the cast is at
    // ZERO and the assertion can finally say what it always wanted to.
    let n = 0;
    for (const id of ALL_IDS) {
      const { warns } = build(id);
      const c = warns.filter((w) => w.includes('[appendages] NO MASS')).length;
      if (c) throw new Error(`${id} has ${c} bounding-box fallback(s) — an anchor on NO SURFACE`);
      n += c;
    }
    if (n !== 0) throw new Error(`cast total ${n}, expected 0`);
  });

  T('KNOWN-BAD: the fallback is RECORDED, not just logged', () => {
    // The search must not be able to hide a genuine miss. A ray fired at a mass that
    // is not there at ANY height has to reach the fallback, log it as `fallback`, and
    // return `hit: false` — which is what `taco.ts` calls a build failure. Proved on
    // an EMPTY root, because no shipped character produces this state any more and an
    // untaken branch that has never fired is not a guard.
    const empty = new THREE.Group();
    empty.name = 'r2_empty_probe';
    const box = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
    const before = mod.massAnchorLog().length;
    const r = mod.massAnchor(empty, box, { azimuth: 0, height01: 0.5 });
    if (r.hit) throw new Error('reported a hit against an empty root');
    if (r.exact) throw new Error('reported exact against an empty root');
    const added = mod.massAnchorLog().slice(before);
    if (added.length !== 1 || added[0].kind !== 'fallback') {
      throw new Error(`expected exactly one 'fallback' log entry, got ${JSON.stringify(added)}`);
    }
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
