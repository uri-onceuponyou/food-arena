#!/usr/bin/env node
/**
 * 🔴 IS THE NECK COLUMN IN FRONT OF THE FACE? — the axis three taco rounds missed.
 *
 * ── The question, and why the existing table asks the wrong one ───────────────
 * `rig.ts` carried a table of DELIVERED NECK PIXELS measured at the MATCH camera
 * (pitch 58) and read the shortfall as a defect: *"86% of it never reaches the
 * screen ... the widening that would fix it is 2.1x to 3.5x"*. Taco's row (782 of
 * 2168 delivered) was the largest in the table and was therefore read as the
 * healthiest.
 *
 * **It was the sickest.** Uri, on taco: *"No mouth, seems like a hat or something."*
 * The 782 pixels ARE the hat. A neck that reaches the screen is a neck that is
 * standing in front of the head it is supposed to be behind.
 *
 * So the quantity that matters is not "how many pixels does the column deliver" but
 * **"is the column BEHIND the mass above it?"** — a 3D fact, true or false at every
 * camera, which is what `CLAUDE.md` #3 means by fixing the geometry rather than the
 * appearance at one pitch.
 *
 * ── The arithmetic ───────────────────────────────────────────────────────────
 * A camera pitched `p` below horizontal sits forward and above. A ray from a point
 * toward it rises `tan(p)` per metre travelled toward the viewer, so a mass vertex
 * `V` occludes a column point `P` only when
 *
 *     V.z  >=  P.z + (V.y - P.y) / tan(p)
 *
 * i.e. every metre of HEIGHT above the column costs `1/tan(p)` metres of DEPTH.
 * That factor is **0.625 at the match camera's 58 deg and 2.747 at the lobby's 20** —
 * the lobby demands 4.4x more overhang, which is exactly why the defect is visible
 * there and not here, and why a table measured at 58 cannot see it.
 *
 * `clearanceAt` below is `max over the mass of (V.z - P.z - (V.y - P.y)/tan p)`,
 * restricted to the mass ABOVE the probe point and within the column's own half-width
 * in x. **Negative means the column's front edge is exposed at that pitch**, and its
 * magnitude is the metres of forward overhang the mass is short by. `bandExposure`
 * sweeps that probe down the column's whole built extent and reports the share of it
 * that nothing covers.
 *
 * `faceZ - r` is the same fact with the pitch term dropped: the pure "does the face
 * out-reach the column" comparison that taco's own note quotes as +0.017 against
 * +0.171.
 *
 * ── ⚠️ THIS IS AN ORTHOGRAPHIC MODEL. THE SHIPPED CAPTURE IS THE TRUTH ────────
 * The formula assumes every ray leaves at exactly `p`, and the shipped cameras are
 * PERSPECTIVE. So this is a MECHANISM tool: it tells you the metres of overhang a
 * mass is short by and which axis to spend them on. It does not tell you how many
 * pixels reach the screen.
 *
 * 🚨 **AND NEITHER DOES `rg_solid` AT THE LOBBY CAMERA — measured, this pass.** That
 * tool frames the model's own bounding box; `charStage` does not, and at a shallow
 * pitch the look-at point decides which surfaces face the camera. On burrito's neck
 * column `rg_solid --pitch 20 --yaw 0` reports **1151 of 1732 px, 0.665 delivered**;
 * ablating the column to `#FF00FF` and capturing through `cr2_shot` — the real
 * renderer on the real stage — measures **0 px**, and this tool independently says
 * `exp@20 = 0.000`. Two of the three agree and the rasteriser is the odd one out.
 * **For any claim about the lobby, ablate and capture.** `rg_solid` remains correct
 * at the match camera, which is what it was written and selftested for.
 *
 * ── Hypothetical columns ─────────────────────────────────────────────────────
 * A character with `neckFraction: 0` builds no column, and reporting `-` for it would
 * hide the finding — taco is exactly that character, and it is where the defect was
 * found. So the column radius is RECONSTRUCTED from the rig's own formula whenever
 * one is absent, and the row is marked `hyp`. That is a prediction about what the
 * character would get if it opted in, which is precisely the decision the next
 * character author faces.
 *
 * Usage:
 *   node tools/tmp/rg_neckz.mjs                 # all 11, both pitches
 *   node tools/tmp/rg_neckz.mjs --selftest      # known-bad inputs
 *   node tools/tmp/rg_neckz.mjs --json out.json
 */
import { loadCast, captureWarnings, writeOut, ALL_IDS, ARCHETYPE, arg, flag, num, list } from './rg_lib.mjs';

const LOBBY = num('--lobby', 20);   // charStage.ts:451
const MATCH = num('--match', 58);   // render/camera.ts:265
const IDS = list('--ids', ALL_IDS.join(','));

/**
 * The rig's own column radius, RE-DERIVED so a character that opted out can still be
 * priced. Mirrors `rig.ts`'s constructor exactly; if that formula moves, the selftest
 * below fails, because it checks this against a rig that really built one.
 */
function columnRadius(m, neckRatio = 0.42) {
  const half = m.hasTorso ? Math.min(m.torsoWidth * 0.5, m.headRadius) : m.headRadius;
  return half * neckRatio;
}

/**
 * Every world-space TRIANGLE of `root`, skipping outline shells (BackSide duplicates
 * that sit OUTSIDE their parent and would report a phantom 1-2 cm of extra reach) and
 * skipping the neck parts themselves (a column cannot occlude itself).
 *
 * 🚨 TRIANGLES, NOT VERTICES, AND THE FIRST VERSION OF THIS TOOL USED VERTICES AND
 * FAILED ITS OWN SELFTEST. `cb_rig.mjs` recorded the identical fault a pass earlier:
 * *"a vertex slab cannot see a low-tessellation body — the stick is
 * `CylinderGeometry(r,r,h,16,1)`, vertices at its two END RINGS and nowhere else"*.
 * A mass whose triangles span the column but whose VERTICES all sit outside its
 * half-width contributes nothing to a vertex scan, so the tool reports `n/a` — a
 * missing occluder — for a mass that is plainly overhead. Two of this cast's heads
 * are lathes and one is a box.
 */
function massTris(THREE, root, skip) {
  const out = [];
  const v = new THREE.Vector3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    if (o.visible === false) return;
    if ((o.name || '').endsWith('__outline')) return;
    for (let n = o; n; n = n.parent) if (skip.has(n.name)) return;
    const g = o.geometry;
    const pos = g.attributes.position;
    const idx = g.index;
    const P = new Float64Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
    }
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i + 2 < n; i += 3) {
      const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
      out.push([
        [P[a * 3], P[a * 3 + 1], P[a * 3 + 2]],
        [P[b * 3], P[b * 3 + 1], P[b * 3 + 2]],
        [P[c * 3], P[c * 3 + 1], P[c * 3 + 2]],
        o.name || '(unnamed)',
      ]);
    }
  });
  return out;
}

/** Sutherland-Hodgman clip of a convex polygon against `dot(n, p) >= d`. */
function clipHalf(poly, n, d) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = n[0] * a[0] + n[1] * a[1] + n[2] * a[2] - d;
    const db = n[0] * b[0] + n[1] * b[1] + n[2] * b[2] - d;
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  return out;
}

/**
 * `max(V.z - r - (V.y - yP)/tan p)` over the mass restricted to the slab
 * `|x| <= r` and `y >= yP`, for a probe point `P = (0, yP, +r)` on the column's front.
 *
 * The objective is AFFINE and the three constraints are half-spaces, so the maximum
 * over the clipped convex polygon is attained at one of its VERTICES — the clip is
 * therefore exact, not a sampling approximation.
 *
 * ⚠️ **WHICH POINT ON THE COLUMN YOU PROBE IS THE WHOLE ANSWER, AND THE FIRST
 * VERSION PROBED THE EASIEST ONE.** Occlusion needs `Δy/tan p` of forward overhang,
 * so a probe HIGH on the column (small Δy to the head above it) is cheap to cover and
 * a probe at its BASE is expensive. Probing only the top said "burrito's column is
 * covered by +0.1024 m" while `rg_solid` — rasterising the same tree at the same pitch
 * — delivered **66.5%** of that column's own footprint to the screen. The band is
 * therefore swept, and both ends are reported.
 */
function clearanceAt(tris, P, r, pitchDeg) {
  const inv = 1 / Math.tan((pitchDeg * Math.PI) / 180);
  let best = -Infinity, bestY = 0, bestZ = 0, bestName = null;
  for (const t of tris) {
    let poly = [t[0], t[1], t[2]];
    poly = clipHalf(poly, [1, 0, 0], P[0] - r); if (poly.length < 3) continue;
    poly = clipHalf(poly, [-1, 0, 0], -(P[0] + r)); if (poly.length < 3) continue;
    poly = clipHalf(poly, [0, 1, 0], P[1]); if (poly.length < 3) continue;
    for (const p of poly) {
      const c = p[2] - P[2] - (p[1] - P[1]) * inv;
      if (c > best) { best = c; bestY = p[1]; bestZ = p[2]; bestName = t[3]; }
    }
  }
  return { clearance: best === -Infinity ? NaN : best, atY: bestY, atZ: bestZ, by: bestName };
}

/**
 * Sweep the column's exposed band from its base (`yBase`, the top of the torso) to its
 * top (`yBase + gap`, the bottom of the head mass) and report the fraction of it that
 * no mass reaches over, plus the worst clearance on the band.
 *
 * `exposed` is the number to compare against `rg_solid`'s delivered ratio; `worst` is
 * the metres of forward overhang the mass is short by at the column's base.
 */
function bandExposure(THREE, tris, neck, yLo, yHi, r, pitchDeg, N = 17) {
  let exposedSamples = 0, worst = Infinity, worstBy = null;
  const v = new THREE.Vector3();
  neck.updateWorldMatrix(true, true);
  for (let i = 0; i <= N; i++) {
    // ⚠️ The probe point is taken through the NECK JOINT'S OWN WORLD MATRIX, not
    // assumed to be on the rig axis. `restPose()` puts `lean` on the torso, which
    // rotates the neck joint back in z by up to 3 cm — on burrito that alone was the
    // difference between "covered by +0.095 m" and `rg_solid`'s 66.5% delivered.
    v.set(0, yLo + ((yHi - yLo) * i) / N, r).applyMatrix4(neck.matrixWorld);
    const c = clearanceAt(tris, [v.x, v.y, v.z], r, pitchDeg);
    const val = Number.isNaN(c.clearance) ? -Infinity : c.clearance;
    if (val < 0) exposedSamples++;
    if (val < worst) { worst = val; worstBy = c.by; }
  }
  return { exposed: exposedSamples / (N + 1), worst, worstBy };
}

/** The old, WRONG method — kept so the selftest can require it to fail. */
function clearanceByVertex(tris, yTop, r, pitchDeg) {
  const inv = 1 / Math.tan((pitchDeg * Math.PI) / 180);
  let best = -Infinity;
  for (const t of tris) {
    for (let k = 0; k < 3; k++) {
      const p = t[k];
      if (p[1] <= yTop || Math.abs(p[0]) > r) continue;
      const c = p[2] - r - (p[1] - yTop) * inv;
      if (c > best) best = c;
    }
  }
  return best === -Infinity ? NaN : best;
}

/** Front-most z of the geometry under a named joint (the face features). */
function frontZ(THREE, joint) {
  if (!joint) return NaN;
  let max = -Infinity;
  const v = new THREE.Vector3();
  joint.updateWorldMatrix(true, true);
  joint.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    if ((o.name || '').endsWith('__outline')) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (v.z > max) max = v.z;
    }
  });
  return max === -Infinity ? NaN : max;
}

// ── Selftest ──────────────────────────────────────────────────────────────────
async function selftest(mod) {
  const { THREE, ChibiRig, bodyType, createCharacter } = mod;
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`  ok   ${name}${detail ? '  ' + detail : ''}`); }
    else { fail++; console.log(`  FAIL ${name}  ${detail}`); }
  };

  // 1. KNOWN-BAD: a slab that does NOT overhang must read negative, and the SAME slab
  //    pushed forward must read positive. If both read the same, the pitch term is
  //    not being applied and every number below is decoration.
  {
    const g = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 0.4), new THREE.MeshBasicMaterial());
    slab.name = 'slab';
    g.add(slab);
    const R = 0.171, Y = 1.0;
    slab.position.set(0, Y + 0.3, 0);            // directly above, no overhang
    g.updateMatrixWorld(true);
    const flat = clearanceAt(massTris(THREE, g, new Set()), [0, Y, R], R, 20).clearance;
    slab.position.set(0, Y + 0.3, 1.2);          // pushed well forward
    g.updateMatrixWorld(true);
    const fwd = clearanceAt(massTris(THREE, g, new Set()), [0, Y, R], R, 20).clearance;
    ok('KNOWN-BAD: a mass with no forward overhang reads NEGATIVE clearance',
      flat < 0, `clearance=${flat.toFixed(4)}`);
    ok('KNOWN-GOOD: the SAME mass pushed 1.2 m forward reads POSITIVE',
      fwd > 0, `clearance=${fwd.toFixed(4)}`);
    ok('...and the difference is exactly the 1.2 m it moved',
      Math.abs(fwd - flat - 1.2) < 1e-9, `delta=${(fwd - flat).toFixed(6)}`);
  }

  // 2. 🚨 THE KNOWN-BAD THAT KILLED THE FIRST IMPLEMENTATION, kept as a permanent
  //    gate. A 1 m box has no vertex within 0.171 m of the axis, so the VERTEX method
  //    reports `n/a` — "no mass overhead" — for a slab sitting directly on top of the
  //    column. `cb_rig.mjs` hit the identical fault on a 16-segment cylinder.
  //    **This test REQUIRES the old method to fail**, per `CLAUDE.md` #6.
  {
    const g = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 0.4), new THREE.MeshBasicMaterial());
    slab.name = 'slab';
    slab.position.set(0, 1.3, 0);
    g.add(slab); g.updateMatrixWorld(true);
    const tris = massTris(THREE, g, new Set());
    const good = clearanceAt(tris, [0, 1.0, 0.171], 0.171, 20).clearance;
    const bad = clearanceByVertex(tris, 1.0, 0.171, 20);
    ok('KNOWN-BAD METHOD: the vertex scan reports n/a for a mass plainly overhead',
      Number.isNaN(bad), `vertex=${bad}`);
    ok('...and the triangle clip finds it — so the clip is what is being tested',
      Number.isFinite(good), `clip=${good.toFixed(4)}`);
  }

  // 3. KNOWN-BAD: the pitch term must MATTER. The same geometry at 58 deg must read
  //    higher than at 20, by exactly (cot20 - cot58) * height. A tool that reports one
  //    number for both pitches is measuring the raw z gap and calling it occlusion —
  //    the exact error the `rig.ts` table made.
  {
    const g = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1, 0.01, 0.01), new THREE.MeshBasicMaterial());
    slab.name = 'slab';
    slab.position.set(0, 1.5, 0);
    g.add(slab); g.updateMatrixWorld(true);
    const tris = massTris(THREE, g, new Set());
    const c20 = clearanceAt(tris, [0, 1.0, 0.2], 0.2, 20).clearance;
    const c58 = clearanceAt(tris, [0, 1.0, 0.2], 0.2, 58).clearance;
    const dy = 1.5 - 0.005 - 1.0;
    const predicted = dy * (1 / Math.tan((20 * Math.PI) / 180) - 1 / Math.tan((58 * Math.PI) / 180));
    ok('PITCH: 58 deg is more forgiving than 20 by exactly dy*(cot20 - cot58)',
      Math.abs((c58 - c20) - predicted) < 1e-6,
      `d=${(c58 - c20).toFixed(5)} predicted=${predicted.toFixed(5)}`);
  }

  // 4. KNOWN-BAD: a mass OFF TO THE SIDE of the column cannot occlude it. Dropping the
  //    |x| clip is the most plausible way to write this tool wrong — it would report a
  //    shoulder as a chin.
  {
    const g = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial());
    slab.name = 'slab';
    slab.position.set(3.0, 1.3, 2.0);            // far to the side, far forward
    g.add(slab); g.updateMatrixWorld(true);
    const c = clearanceAt(massTris(THREE, g, new Set()), [0, 1.0, 0.171], 0.171, 20).clearance;
    ok('KNOWN-BAD: a mass beside the column, not over it, is NOT counted',
      Number.isNaN(c), `clearance=${c}`);
  }

  // 4. The re-derived column radius must equal the one the rig really builds. This is
  //    what makes a `hyp` row trustworthy — it is the rig's formula, checked against
  //    the rig.
  {
    const pr = bodyType('standard', {});
    const rig = new ChibiRig({ palette: { limb: 0x888888, hand: 0xcccccc, foot: 0x222222 }, proportions: pr });
    ok('DERIVATION: the reconstructed column radius equals the rig\'s own neckRadius',
      Math.abs(columnRadius(rig.metrics, pr.neckRatio ?? 0.42) - rig.metrics.neckRadius) < 1e-12,
      `${columnRadius(rig.metrics, pr.neckRatio ?? 0.42).toFixed(6)} vs ${rig.metrics.neckRadius.toFixed(6)}`);
  }

  // 5. LIVE, against an answer that is already committed: `25665f9` records taco's
  //    reconstructed column at **z = +0.171**, the number three rendered rounds paid
  //    for. The character has since dropped its column, so this exercises the `hyp`
  //    path — and if the rig's radius formula ever moves, this is what says so.
  {
    const c = createCharacter('taco');
    c.rig.restPose();
    const m = c.rig.metrics;
    const r = m.neckRadius > 0 ? m.neckRadius : columnRadius(m);
    ok('LIVE: taco\'s reconstructed column radius reproduces the committed 0.171 m',
      Math.abs(r - 0.171) < 0.004, `r=${r.toFixed(4)}`);
  }

  // 6. LIVE, and it is the point of the whole tool: a real character with a real
  //    column must be MORE exposed at the lobby camera than at the match camera. If
  //    this ever came out the other way the sign convention is inverted and every
  //    conclusion drawn from the table flips.
  {
    const c = createCharacter('soup');
    c.rig.restPose();
    const m = c.rig.metrics;
    const tris = massTris(THREE, c.rig.joints.root, new Set(['neck_column', 'neck_collar']));
    const b20 = bandExposure(THREE, tris, c.rig.joints.neck, 0, m.neckGap, m.neckRadius, 20);
    const b58 = bandExposure(THREE, tris, c.rig.joints.neck, 0, m.neckGap, m.neckRadius, 58);
    ok('LIVE: a built column is more exposed at the LOBBY pitch than at the MATCH pitch',
      b20.worst < b58.worst, `worst@20=${b20.worst.toFixed(4)} < worst@58=${b58.worst.toFixed(4)}`);
  }

  console.log(`\n  ${pass} pass, ${fail} fail`);
  return fail === 0;
}

// ── main ──────────────────────────────────────────────────────────────────────
const mod = await loadCast();
if (flag('--selftest')) {
  console.log('rg_neckz selftest — known-bad inputs first\n');
  process.exit((await selftest(mod)) ? 0 : 1);
}

const { createCharacter, THREE } = mod;
const SKIP = new Set(['neck_column', 'neck_collar']);
const rows = [];
const { warns } = captureWarnings(() => {
  for (const id of IDS) {
    const c = createCharacter(id);
    c.rig.restPose();
    const m = c.rig.metrics;
    const built = m.neckGap > 0;
    const r = built ? m.neckRadius : columnRadius(m);
    const tris = massTris(THREE, c.rig.joints.root, SKIP);
    // The band is the column's REAL local extent, taken from the rig's own
    // construction: `col.position.y = gap*0.5`, height `gap + 2*over`, with
    // `over = max(gap*0.55, nr*0.5)` — so it runs from `-over` to `gap + over` in the
    // neck joint's frame. The base is the point HARDEST to cover, and using the
    // nominal gap alone would silently exclude the overshoot that actually shows.
    const over = Math.max(m.neckGap * 0.55, r * 0.5);
    rows.push({
      id, archetype: ARCHETYPE[id], built, r, gap: m.neckGap,
      faceFrontZ: frontZ(THREE, c.rig.joints.face),
      lobby: bandExposure(THREE, tris, c.rig.joints.neck, -over, m.neckGap + over, r, LOBBY),
      match: bandExposure(THREE, tris, c.rig.joints.neck, -over, m.neckGap + over, r, MATCH),
    });
  }
});

console.log(`NECK-COLUMN OCCLUSION, as a 3D fact — lobby pitch ${LOBBY}, match pitch ${MATCH}`);
console.log('`exp` = share of the column\'s exposed band that NO mass reaches over at that pitch.');
console.log('`worst` = metres of forward overhang the mass is short by, at the column\'s base.');
console.log('`hyp` = the character builds no column; the radius is re-derived from the rig\'s formula.\n');
console.log('char         arch      col r    face z   faceZ-r   exp@20    worst@20   exp@58    worst@58  built');
console.log('-'.repeat(101));
const f = (v, n = 4) => (Number.isNaN(v) || !Number.isFinite(v) ? '  n/a   ' : (v >= 0 ? '+' : '') + v.toFixed(n));
for (const r of rows) {
  console.log(
    `${r.id.padEnd(12)} ${String(r.archetype).padEnd(9)} ` +
    `${r.r.toFixed(4).padStart(7)}  ${f(r.faceFrontZ).padStart(8)}  ${f(r.faceFrontZ - r.r).padStart(8)}  ` +
    `${r.lobby.exposed.toFixed(3).padStart(6)}  ${f(r.lobby.worst).padStart(9)}  ` +
    `${r.match.exposed.toFixed(3).padStart(6)}  ${f(r.match.worst).padStart(9)}  ${r.built ? 'yes' : 'hyp'}`
  );
}
console.log('-'.repeat(101));
const exp20 = rows.filter((r) => r.lobby.exposed > 0);
const exp58 = rows.filter((r) => r.match.exposed > 0);
console.log(`ANY EXPOSURE at the LOBBY camera: ${exp20.length}/${rows.length} — ${exp20.map((r) => r.id).join(', ') || 'none'}`);
console.log(`ANY EXPOSURE at the MATCH camera: ${exp58.length}/${rows.length} — ${exp58.map((r) => r.id).join(', ') || 'none'}`);
const behind = rows.filter((r) => r.faceFrontZ < r.r);
console.log(`FACE BEHIND the column front (taco's mechanism): ${behind.length}/${rows.length} — ${behind.map((r) => r.id).join(', ') || 'none'}`);
if (warns.length) console.log(`\n${[...new Set(warns)].length} distinct constructor warnings suppressed from the table (not from the tree)`);
const jsonOut = arg('--json', null);
if (jsonOut) console.log('\nwrote ' + writeOut(jsonOut, { generated: new Date().toISOString(), LOBBY, MATCH, rows }));
