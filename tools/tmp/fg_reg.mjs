/**
 * fg_reg — WHERE IS EACH FOG CUE DRAWN, versus where the damage actually starts.
 *
 * Offline. No browser, no GPU, no snapshot server. It runs the shipped `createFogRing`
 * and the shipped `CameraRig`, then asks one question of every vertex the renderer would
 * have drawn: **which point of the GROUND does this vertex land on top of, from this
 * camera?** For a vertex at height y that is exact and closed-form — the ray from the
 * camera through it hits y = 0 at
 *
 *     G = C + (V - C) * Cy / (Cy - Vy)
 *
 * i.e. a homothety about the camera's ground position with ratio Cy/(Cy - Vy). No small
 * angle assumption, no orthographic assumption; this is the perspective answer.
 *
 * ── ARMS (this is the known-bad battery, CLAUDE.md #6) ────────────────────────────
 *
 *   null      canopy forced to y = 0, translation removed. A cue ON the ground cannot be
 *             mis-registered, so EVERY row must read 0.000 wu of error. If it does not,
 *             the projection is wrong and nothing below it means anything.
 *   flat      canopy at its shipped height, translation REMOVED. The raw parallax error.
 *   shipped   exactly what `fogRing.ts:update()` does today.
 *   flipped   the shipped translation with its SIGN REVERSED.
 *   exact     the canopy placed by the closed-form inverse (a homothety, not a
 *             translation): centre = (1-k)*(C - O) + O, radius = k*r, k = (Cy - h)/Cy.
 *             THIS IS WHAT "NO REGISTRATION ERROR" LOOKS LIKE IN THE TABLE. Every row
 *             must read 0.000 wu. It is the positive control, and it is also the fix.
 *
 * Usage:  node tools/tmp/fg_reg.mjs [--pitch 58] [--aspect 1.7778] [--json out.json]
 *         node tools/tmp/fg_reg.mjs --selftest
 */
import { loadShipped, REPO } from './fg_lib.mjs';
import { writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const flag = (n, d) => {
  const i = argv.indexOf('--' + n);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const has = (n) => argv.includes('--' + n);

const S = await loadShipped();
const { THREE } = S;
const M = S.WORLD_SCALE;                 // metres per world unit, read from src/units.ts
const toWU = (m) => m / M;

// ─────────────────────────────────────────────────────────────────────────────
// Ring extraction — off the real BufferGeometry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every concentric ring of an annulus mesh: world radius (m), baked alpha, height (m).
 *
 * `SEG` is module-private in `fogRing.ts`, so it is RECOVERED rather than transcribed —
 * as the run length of constant (radius, alpha). ⚠️ Positions are a **Float32Array**, so
 * a same-ring radius wobbles by ~1e-5 m; an exact-equality run detector returned SEG = 1
 * and every row came back `null`, which the selftest then read as a 12 wu error. The
 * tolerance is relative for that reason, and the equal-run-length assertion below is what
 * makes the recovery falsifiable instead of assumed.
 */
function readAnnulus(mesh, root) {
  root.updateMatrixWorld(true);
  const pos = mesh.geometry.attributes.position;
  const col = mesh.geometry.attributes.color;
  const n = pos.count;
  const radAt = (i) => Math.hypot(pos.getX(i), pos.getZ(i));
  const same = (a, b) => Math.abs(radAt(a) - radAt(b)) <= 1e-4 * Math.max(1, radAt(a))
    && Math.abs(col.getW(a) - col.getW(b)) < 1e-6;
  const starts = [0];
  for (let i = 1; i < n; i++) if (!same(i, starts[starts.length - 1])) starts.push(i);
  const lens = starts.map((s, k) => (k + 1 < starts.length ? starts[k + 1] : n) - s);
  if (lens.length === 0) throw new Error('readAnnulus: no rings');
  if (new Set(lens).size !== 1) throw new Error(`readAnnulus: ragged ring runs ${lens.join(',')} on ${mesh.name}`);
  const seg = lens[0];
  const rings = starts.map((s, r) => {
    const v = new THREE.Vector3(pos.getX(s), pos.getY(s), pos.getZ(s)).applyMatrix4(mesh.matrixWorld);
    return { localR: radAt(s), alpha: col.getW(s), y: v.y, seg, idx: r };
  });
  return { rings, seg, pos, mesh };
}

/** Project every vertex of ring `r` to the ground and return the polygon (Vector2 xz). */
function ringGroundPolygon(ann, r, C) {
  const { pos, seg, mesh } = ann;
  // The original run detector returned SEG = 1 (Float32 radius wobble) and every ray
  // then missed a one-vertex "polygon". A degenerate ring must be loud, not empty.
  if (!(seg >= 8)) throw new Error(`ringGroundPolygon: recovered SEG=${seg}, geometry not read correctly`);
  const out = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < seg; i++) {
    const k = r * seg + i;
    v.set(pos.getX(k), pos.getY(k), pos.getZ(k)).applyMatrix4(mesh.matrixWorld);
    const t = C.y / (C.y - v.y);            // exact: ray C -> v hits y = 0 here
    out.push(new THREE.Vector2(C.x + (v.x - C.x) * t, C.z + (v.z - C.z) * t));
  }
  return out;
}

/** Where a closed ground polygon crosses the ray from O in direction d. Metres. */
function rayHit(poly, O, d) {
  let best = null;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ex = b.x - a.x, ey = b.y - a.y;
    const den = d.x * ey - d.y * ex;
    if (Math.abs(den) < 1e-12) continue;
    const qx = a.x - O.x, qy = a.y - O.y;
    const s = (qx * ey - qy * ex) / den;      // along the ray
    const u = (qx * d.y - qy * d.x) / den;    // along the edge
    if (u < -1e-9 || u > 1 + 1e-9 || s <= 0) continue;
    if (best === null || s < best) best = s;
  }
  return best;
}

/** A circle at height y, radius rm, centred on `centre` (Vector2 xz) -> apparent ground radius. */
function circleApparent(centre, rm, y, C, O, d, segments = 256) {
  const poly = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const wx = centre.x + Math.cos(t) * rm, wz = centre.y + Math.sin(t) * rm;
    const k = C.y / (C.y - y);
    poly.push(new THREE.Vector2(C.x + (wx - C.x) * k, C.z + (wz - C.z) * k));
  }
  return rayHit(poly, O, d);
}

// ─────────────────────────────────────────────────────────────────────────────

const CENTER_WU = S.CENTER;
const O = new THREE.Vector2(CENTER_WU.x * M, CENTER_WU.y * M);

/** Directions, in world XZ. yaw = 0 puts the camera at +z from its target. */
const ARCS = {
  NEAR: new THREE.Vector2(0, 1),   // boundary between camera and centre — BOTTOM of frame
  FAR: new THREE.Vector2(0, -1),   // boundary beyond centre — TOP of frame
  SIDE: new THREE.Vector2(1, 0),   // screen-left/right
};

function buildRig(pitchDeg, aspect) {
  const rig = new S.CameraRig({ pitchDeg, yawDeg: 0, frameMode: 'fair' });
  rig.setAspect(aspect);
  return rig;
}

/**
 * One (radius, arc) cell. The player stands ON the boundary at that arc, which is the
 * only position at which the question "has the fog reached me" is even being asked.
 */
function measure(radiusWU, arcName, pitchDeg, aspect, arm) {
  const d = ARCS[arcName];
  const rig = buildRig(pitchDeg, aspect);
  const playerWU = { x: CENTER_WU.x + d.x * radiusWU, y: CENTER_WU.y + d.y * radiusWU };
  rig.snapTo(playerWU.x * M, playerWU.y * M);
  const C = rig.camera.position.clone();

  const fog = S.createFogRing(CENTER_WU);
  fog.update(radiusWU, 12.0, true, rig);

  const named = {};
  fog.root.traverse((o) => { if (o.isMesh) named[o.name] = o; });
  const ground = named['fog_edge__no_outline'];
  const canopy = named['fog_canopy__no_outline'];
  const wall = named['fog_curtain__no_outline'];
  if (!ground || !canopy || !wall) throw new Error('fog meshes not found: ' + Object.keys(named));

  // Record the SHIPPED canopy placement before any arm rewrites it.
  const shippedCanopyPos = canopy.position.clone();
  const h = shippedCanopyPos.y;
  const back = Math.hypot(shippedCanopyPos.x, shippedCanopyPos.z);

  const k = (C.y - h) / C.y;
  if (arm === 'null') { canopy.position.set(0, 0, 0); canopy.scale.set(1, 1, 1); }
  else if (arm === 'flat') { canopy.position.set(0, h, 0); canopy.scale.set(1, 1, 1); }
  else if (arm === 'shipped') { /* untouched */ }
  else if (arm === 'flipped') { canopy.position.set(-shippedCanopyPos.x, h, -shippedCanopyPos.z); }
  else if (arm === 'exact') {
    canopy.position.set((1 - k) * (C.x - O.x), h, (1 - k) * (C.z - O.y));
    canopy.scale.set(k, 1, k);
  } else throw new Error('unknown arm ' + arm);
  fog.root.updateMatrixWorld(true);

  const gAnn = readAnnulus(ground, fog.root);
  const cAnn = readAnnulus(canopy, fog.root);

  const rows = [];
  const push = (cue, alpha, apparentM, trueOffsetWU, idx = null, worldR = 1) => {
    // A null crossing is a BROKEN measurement, not a zero. It must never be quietly
    // arithmetic'd into an error number — that is exactly how the first selftest read
    // 12.00 wu on an arm that had produced no data at all. The ONE legitimate null is a
    // ring whose radius `setRadius`'s `Math.max(0, …)` has clamped to zero: at sudden
    // death every negative-offset ring collapses to a point and has no crossing to find.
    rows.push({
      cue, alpha, idx, authoredOffsetWU: trueOffsetWU,
      apparentWU: apparentM === null ? null : toWU(apparentM) - radiusWU,
      // No crossing is a GEOMETRIC FACT at radius 0 — every ring collapses to a small
      // circle that the translation has pushed clean off the ray from the arena centre.
      // It is never a silent zero: `fmt` prints `off` and no arithmetic touches it.
      offRay: apparentM === null,
      worldR,
    });
  };

  for (const r of gAnn.rings) {
    const app = rayHit(ringGroundPolygon(gAnn, r.idx, C), O, d);
    push(`crest r${r.idx}`, r.alpha, app, toWU(r.localR) - radiusWU, r.idx, r.localR);
  }
  for (const r of cAnn.rings) {
    const app = rayHit(ringGroundPolygon(cAnn, r.idx, C), O, d);
    push(`canopy r${r.idx}`, r.alpha, app, toWU(r.localR) - radiusWU, r.idx, r.localR);
  }

  // Alpha thresholds INSIDE the canopy's first gradient (r0 alpha 0 -> r1 alpha a1),
  // interpolated in radius exactly as the rasteriser interpolates vertex colour.
  const c0 = cAnn.rings[0], c1 = cAnn.rings[1];
  const centre2 = new THREE.Vector2(O.x + canopy.position.x, O.y + canopy.position.z);
  // ⚠️ The canopy's height is read back off the mesh AFTER the arm has rewritten it.
  // Using the shipped 3.2 m here made the `null` arm (canopy forced to y = 0) report the
  // shipped arm's numbers on these two rows — a control that silently copied its treatment.
  const hNow = canopy.position.y;
  for (const a of [0.10, 0.30]) {
    const f = (a - c0.alpha) / (c1.alpha - c0.alpha);
    const rm = (c0.localR + (c1.localR - c0.localR) * f) * (canopy.scale.x);
    const app = circleApparent(centre2, rm, hNow, C, O, d);
    push(`canopy a=${a.toFixed(2)}`, a, app, toWU(rm / canopy.scale.x) - radiusWU, null, rm);
  }

  // Curtain: a cylinder of radius `scale.x`, base at y = 0, top at y = scale.y.
  const wallR = wall.scale.x, wallH = wall.scale.y;
  const wc = new THREE.Vector2(O.x, O.y);
  push('wall base', 0.82, circleApparent(wc, wallR, 0, C, O, d), toWU(wallR) - radiusWU, null, wallR);
  push('wall top', 0.0, circleApparent(wc, wallR, wallH, C, O, d), toWU(wallR) - radiusWU, null, wallR);

  fog.dispose();
  return {
    radiusWU, arc: arcName, arm,
    cameraHeightM: C.y,
    cameraDistM: rig.groundWindow().distanceM,
    canopyHeightM: h,
    canopyBackM: back,
    wallHeightM: wallH,
    rows,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The shipped schedule — derived, never round numbers
// ─────────────────────────────────────────────────────────────────────────────

function schedule() {
  const T = S.MATCH_DURATION_MS, R0 = S.MAX_SAFE_RADIUS;
  const at = (tSec) => {
    const remaining = T - tSec * 1000;
    if (S.suddenDeathActive(remaining)) return { t: tSec, R: S.SUDDEN_DEATH_RADIUS, note: 'SUDDEN DEATH' };
    const progress = 1 - remaining / T;
    return { t: tSec, R: Math.max(S.minSafeRadiusFor(2), R0 * (1 - progress)), note: '' };
  };
  return [0, 6, 12, 18, 24, 29.9, 30].map(at);
}

// ─────────────────────────────────────────────────────────────────────────────

function selftest() {
  const R = 926.33;
  let fails = 0;
  const checks = [];
  // 1. NULL arm: a cue lying ON the ground has zero parallax by construction.
  for (const arc of ['NEAR', 'FAR', 'SIDE']) {
    const m = measure(R, arc, 58, 16 / 9, 'null');
    const canopyRows = m.rows.filter((r) => r.cue.startsWith('canopy r'));
    if (canopyRows.length === 0) { checks.push(['NON-EMPTY canopy rows', 'FAIL (empty set)']); fails++; continue; }
    const worst = Math.max(...canopyRows.map((r) => Math.abs(r.apparentWU - r.authoredOffsetWU)));
    checks.push([`null arm ${arc}: |apparent - authored|`, worst.toFixed(6) + ' wu', worst < 1e-6 ? 'PASS' : 'FAIL']);
    if (!(worst < 1e-6)) fails++;
  }
  // 2. EXACT arm: the closed-form placement must register perfectly at every arc.
  for (const arc of ['NEAR', 'FAR', 'SIDE']) {
    const m = measure(R, arc, 58, 16 / 9, 'exact');
    const rows = m.rows.filter((r) => r.cue.startsWith('canopy r'));
    if (rows.length === 0) { checks.push(['NON-EMPTY canopy rows', 'FAIL (empty set)']); fails++; continue; }
    const worst = Math.max(...rows.map((r) => Math.abs(r.apparentWU - r.authoredOffsetWU)));
    checks.push([`exact arm ${arc}: |apparent - authored|`, worst.toFixed(6) + ' wu', worst < 0.5 ? 'PASS' : 'FAIL']);
    if (!(worst < 0.5)) fails++;
  }
  // 3. DISCRIMINATION: the instrument must SEPARATE shipped from exact. A guard that
  //    cannot fail is not a guard.
  const shipped = measure(R, 'FAR', 58, 16 / 9, 'shipped');
  const exact = measure(R, 'FAR', 58, 16 / 9, 'exact');
  const sErr = Math.abs(shipped.rows.find((r) => r.cue === 'canopy r0').apparentWU - 12);
  const eErr = Math.abs(exact.rows.find((r) => r.cue === 'canopy r0').apparentWU - 12);
  checks.push(['discrimination shipped vs exact', `${sErr.toFixed(2)} vs ${eErr.toFixed(2)} wu`, sErr > 20 * Math.max(eErr, 0.05) ? 'PASS' : 'FAIL']);
  if (!(sErr > 20 * Math.max(eErr, 0.05))) fails++;
  // 4. SIGN: flipped must beat shipped by a wide margin, or the sign claim is wrong.
  const flipped = measure(R, 'FAR', 58, 16 / 9, 'flipped');
  const fErr = Math.abs(flipped.rows.find((r) => r.cue === 'canopy r0').apparentWU - 12);
  checks.push(['flipped beats shipped', `${fErr.toFixed(2)} vs ${sErr.toFixed(2)} wu`, fErr < sErr / 3 ? 'PASS' : 'FAIL']);
  if (!(fErr < sErr / 3)) fails++;

  for (const c of checks) console.log(c.join('  |  '));
  console.log(fails === 0 ? '\nSELFTEST PASS' : `\nSELFTEST FAIL (${fails})`);
  process.exitCode = fails === 0 ? 0 : 1;
}

function fmt(n, w = 9, dp = 2) {
  return (n === null || n === undefined ? '   n/a' : n.toFixed(dp)).padStart(w);
}

function main() {
  const pitch = Number(flag('pitch', '58'));
  const aspect = Number(flag('aspect', String(16 / 9)));
  const arms = (flag('arms', 'shipped')).split(',');
  const sched = schedule();

  console.log(`# fog cue registration — pitch ${pitch} deg, aspect ${aspect.toFixed(4)}`);
  console.log(`# WORLD_SCALE ${M} m/wu · CHARACTER_HEIGHT ${S.CHARACTER_HEIGHT} m · PLAYER_SIZE ${S.PLAYER_SIZE} wu`);
  console.log(`# MAX_SAFE_RADIUS ${S.MAX_SAFE_RADIUS} · MIN_SAFE_RADIUS ${S.MIN_SAFE_RADIUS} · minSafeRadiusFor(6) ${S.minSafeRadiusFor(6).toFixed(2)}`);
  console.log(`# FOG_DAMAGE ${S.FOG_DAMAGE} / ${S.FOG_TICK_MS} ms = ${(S.FOG_DAMAGE * 1000 / S.FOG_TICK_MS).toFixed(0)} HP/s`);
  console.log('');

  const out = [];
  for (const arm of arms) {
    for (const arc of ['NEAR', 'FAR', 'SIDE']) {
      console.log(`\n## arm=${arm}  arc=${arc}   (apparent ground offset from the TRUE damage line, wu)`);
      const cells = sched.map((s) => measure(s.R, arc, pitch, aspect, arm));
      out.push(...cells);
      const cueNames = cells[0].rows.map((r) => r.cue);
      const head = ['cue'.padEnd(16), 'alpha'.padStart(6), ...sched.map((s) => `${s.R.toFixed(0)}wu`.padStart(9))];
      console.log(head.join(' '));
      console.log('-'.repeat(head.join(' ').length));
      console.log(['TRUE DAMAGE LINE'.padEnd(16), '-'.padStart(6), ...sched.map(() => fmt(0))].join(' '));
      for (let i = 0; i < cueNames.length; i++) {
        const alpha = cells[0].rows[i].alpha;
        console.log([cueNames[i].padEnd(16), alpha.toFixed(2).padStart(6),
          ...cells.map((c) => fmt(c.rows[i].apparentWU))].join(' '));
      }
      console.log(['authored offset'.padEnd(16), ''.padStart(6)].join(' ') + '  ' +
        cells[0].rows.map((r) => `${r.cue}=${r.authoredOffsetWU.toFixed(1)}`).join(' '));
      console.log(`camera: height ${cells[0].cameraHeightM.toFixed(2)} m, dist ${cells[0].cameraDistM.toFixed(2)} m` +
        ` · canopy y ${cells[0].canopyHeightM.toFixed(2)} m, back ${cells[0].canopyBackM.toFixed(3)} m (${toWU(cells[0].canopyBackM).toFixed(1)} wu)` +
        ` · wall h ${cells.map((c) => c.wallHeightM.toFixed(2)).join('/')} m`);
    }
  }
  const j = flag('json', null);
  if (j) writeFileSync(j, JSON.stringify(out, null, 1));
}

if (has('selftest')) selftest(); else main();
