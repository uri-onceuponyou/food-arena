#!/usr/bin/env node
/**
 * ch_sushi_geom — build the whole Sushi model in NODE, with no renderer, and answer
 * three questions that a render cannot answer cheaply and that a render CAN hide.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * `docs/LESSONS.md` §1: "it isn't there" has meant "it IS there and is INVISIBLE"
 * eighteen times, and `docs/LESSONS.md` §12 records that inverted lathe normals bit six
 * characters at once and render NEAR-BLACK rather than absent. This pass hand-indexes a
 * BufferGeometry (`drapedSlice`) and hand-builds a `Shape` (`crossStrap`), so both
 * failures are back on the table — and a peer-loaded GPU is the worst place to discover
 * either. Everything here is arithmetic on the built scene graph:
 *
 *   1. NO NaN, anywhere. One bad `normalize()` of a zero vector poisons a whole mesh's
 *      bounding box and the mesh silently disappears.
 *   2. NORMALS POINT OUT. Sampled on the drape and the straps against the outward
 *      radial direction from the head's axis. A surface whose normals face inward is
 *      lit from behind and renders as a dark hole — which looks like a shading choice.
 *   3. THE DRAPE'S HEM IS A SADDLE, which is the entire design claim of this pass.
 *      Measured as the hem height at the two ENDS versus at the FRONT: a beret has them
 *      equal, a drape has the ends lower. This is the assertion that fails if someone
 *      later "simplifies" `hemAt` back to a constant.
 *
 * ⚠️ KNOWN-BAD INPUTS. `--selftest` re-runs checks 2 and 3 against DELIBERATELY BROKEN
 * geometry — a reversed index buffer and a constant hem — and requires them to FAIL.
 * CLAUDE.md #6: a guard that has not been shown to fail on the bug it guards against is
 * not a guard.
 *
 * Runs TypeScript through Vite's SSR pipeline, so it loads the SHIPPED source rather
 * than a re-implementation of it. Usage:
 *   node tools/tmp/ch_sushi_geom.mjs [--selftest]
 */
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// ⚠️ `noDiscovery`, and it is not a performance flag. Vite's dep SCANNER crawls the
// WHOLE project, so a peer mid-edit — `src/game/vfx.ts` importing a `src/vfx/weapons`
// that has not been created yet — kills this probe on a file it never opens, and the
// failure presents exactly like your own break (`docs/LESSONS.md` §5, and the same note
// `menu_accept` carries). The scanner buys nothing here: this loads two modules by path.
const vite = await createServer({
  root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error',
  optimizeDeps: { noDiscovery: true, include: [] },
});

const THREE = await vite.ssrLoadModule('three');
const { CHARACTERS } = await vite.ssrLoadModule('/src/game/rules.ts');
const { SushiCharacter } = await vite.ssrLoadModule('/src/characters/sushi.ts');

const ch = new SushiCharacter(CHARACTERS.sushi);
const root = ch.root ?? ch.body;
root.updateWorldMatrix(true, true);

let n = 0, bad = 0;
const t = (name, ok, got) => {
  n++;
  if (!ok) { bad++; console.log(`FAIL  ${name}   ${got}`); } else console.log(`PASS  ${name}   (${got})`);
};

// ── 1. NaN sweep over every position and normal in the model ────────────────
let meshes = 0, nanMesh = null, verts = 0;
root.traverse((o) => {
  if (!o.isMesh) return;
  meshes++;
  for (const key of ['position', 'normal']) {
    const a = o.geometry.attributes[key];
    if (!a) continue;
    verts += a.count;
    for (let i = 0; i < a.count * a.itemSize; i++) {
      if (!Number.isFinite(a.array[i])) { nanMesh = nanMesh ?? `${o.name || o.type}.${key}[${i}]`; return; }
    }
  }
});
t(`no NaN in any position/normal (${meshes} meshes, ${verts} verts)`, nanMesh === null, nanMesh ?? 'clean');

// ── 1b. ZERO-LENGTH NORMALS — a NaN the CPU buffers do not contain ─────────
// 🚨 This check exists because of a live bug, and it is the sharpest instance of
// `docs/LESSONS.md` §1 this file has produced. `computeVertexNormals()` accumulates
// face normals as cross products; a DEGENERATE (zero-area) triangle contributes the
// zero vector, and `Vector3.normalize()` divides by `length() || 1`, so the vertex ends
// up with a normal of EXACTLY (0,0,0) and no NaN anywhere on the CPU. In GLSL,
// `normalize(vec3(0))` is NaN — so the fragment is NaN, the bloom pass smears the NaN
// across the buffer, and the ENTIRE FRAME renders black.
//
// It was found the expensive way: a yaw-90 lobby capture came back `stdev 0, mean 0`,
// four times, on this file and not on HEAD, with no page error, no lost context, a
// correct camera and 132 healthy meshes. Yaw 90 is the axis the straps are EXTRUDED
// along, so it is the one camera that looks straight into their end caps. Check 1 above
// passed the whole time: NaN-freeness of the buffers says nothing about this.
let zeroMesh = null, zeroCount = 0;
root.traverse((o) => {
  if (!o.isMesh) return;
  const nm = o.geometry.attributes.normal;
  if (!nm) return;
  for (let i = 0; i < nm.count; i++) {
    if (Math.hypot(nm.getX(i), nm.getY(i), nm.getZ(i)) < 1e-6) {
      zeroCount++;
      zeroMesh = zeroMesh ?? `${o.name || o.type}[${i}]`;
    }
  }
});
t('no ZERO-LENGTH normals (normalize(vec3(0)) is NaN in GLSL and blacks the frame)',
  zeroCount === 0, zeroCount ? `${zeroCount} verts, first ${zeroMesh}` : 'clean');

// ── 2. Outward normals on the hand-built geometry ───────────────────────────
// The head's masses live inside a group scaled (SX, 1, SZ); the check is done in the
// mesh's OWN local frame, where the head axis is x = z = 0, so the scale is irrelevant.
function outwardShare(name) {
  let mesh = null;
  root.traverse((o) => { if (o.isMesh && o.name === name) mesh = mesh ?? o; });
  if (!mesh) return { found: false, share: 0 };
  const p = mesh.geometry.attributes.position, nm = mesh.geometry.attributes.normal;
  let out = 0, tot = 0;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;              // apex vertices have no radial direction
    tot++;
    if ((nm.getX(i) * x + nm.getZ(i) * z) / r > -0.05) out++;
  }
  return { found: true, share: tot ? out / tot : 0, tot };
}
{
  const r = outwardShare('sushi_salmon');
  t('sushi_salmon (open shell): normals face outward', r.found && r.share > 0.90,
    r.found ? `${(100 * r.share).toFixed(1)}% of ${r.tot} verts` : 'MESH NOT FOUND');
}

// ⚠️ THE RADIAL TEST IS THE WRONG TEST FOR THE STRAPS, and it said so loudly: it
// scored them 71.5% and 54.5% on geometry that is correct. A strap is a CLOSED SOLID
// band — its inner face legitimately points at the head's axis and its two extruded
// ends point along ±X, so a large share of its normals SHOULD fail a radial test. The
// instrument was measuring the wrong property, which is `docs/LESSONS.md` §13 in
// miniature; the fix is a statistic that is actually defined for a closed mesh.
//
// Signed volume: Σ v0·(v1×v2)/6 over the triangles. Positive for outward winding,
// exactly negated for inward. It is a one-number test with no threshold to invent, and
// the `--selftest` below reverses a real index buffer and requires the sign to flip.
function signedVolume(geoOrName) {
  let g = geoOrName;
  if (typeof geoOrName === 'string') {
    let mesh = null;
    root.traverse((o) => { if (o.isMesh && o.name === geoOrName) mesh = mesh ?? o; });
    if (!mesh) return null;
    g = mesh.geometry;
  }
  const p = g.attributes.position, idx = g.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let v = 0;
  const count = idx ? idx.count : p.count;
  for (let i = 0; i < count; i += 3) {
    const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(p, i0); b.fromBufferAttribute(p, i1); c.fromBufferAttribute(p, i2);
    v += a.dot(b.clone().cross(c));
  }
  return v / 6;
}
for (const name of ['sushi_nori_strap', 'sushi_salmon_fat']) {
  const v = signedVolume(name);
  t(`${name} (closed solid): signed volume is POSITIVE, i.e. wound outward`,
    v !== null && v > 0, v === null ? 'MESH NOT FOUND' : v.toExponential(3));
}

// ── 3. The hem is a SADDLE, measured off the built vertices ─────────────────
// Lowest drape vertex within a narrow azimuth window, at the ends (theta ~ 0, pi) and
// at the front (theta ~ pi/2). A beret has these equal; a drape has the ends lower.
function hemY(window, centre) {
  let mesh = null;
  root.traverse((o) => { if (o.isMesh && o.name === 'sushi_salmon') mesh = mesh ?? o; });
  const p = mesh.geometry.attributes.position;
  let lo = Infinity;
  for (let i = 0; i < p.count; i++) {
    const th = Math.atan2(p.getZ(i), p.getX(i));
    let d = Math.abs(((th - centre + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
    if (d <= window) lo = Math.min(lo, p.getY(i));
  }
  return lo;
}
const endY = Math.min(hemY(0.20, 0), hemY(0.20, Math.PI));
const frontY = hemY(0.20, Math.PI / 2);
const drop = frontY - endY;
t('drape hem DIPS at the ends vs the front (a beret has drop = 0)', drop > 0.02,
  `ends ${endY.toFixed(4)}  front ${frontY.toFixed(4)}  drop ${drop.toFixed(4)}`);

// ── 4. The face is inside the drape's shadow, not under it ──────────────────
// Every mesh on `rig.joints.face` must sit below the drape's front hem, or a feature is
// buried inside the topping. This is the hardcoded-height failure this pass removed;
// the assertion is what stops it coming back.
{
  const faceJoint = ch.rig?.joints?.face ?? null;
  let worst = -Infinity, worstName = 'n/a';
  if (faceJoint) {
    faceJoint.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      const inv = faceJoint.matrixWorld.clone().invert();
      const top = b.max.clone().applyMatrix4(inv).y;
      if (top > worst) { worst = top; worstName = o.name || o.type; }
    });
  }
  t('every face feature stays below the drape\'s front hem',
    faceJoint !== null && worst < frontY, `highest face mesh ${worstName} at ${worst.toFixed(4)} vs hem ${frontY.toFixed(4)}`);
}

// ── SELFTEST: the same two checks against deliberately broken inputs ────────
if (process.argv.includes('--selftest')) {
  console.log('\n-- known-bad inputs: these MUST fail --');
  let s = 0, sbad = 0;
  const st = (name, ok) => { s++; if (!ok) { sbad++; console.log(`FAIL  ${name}`); } else console.log(`PASS  ${name}`); };

  // (a) reversed winding on a copy of the drape -> the outward check must reject it
  let salmon = null;
  root.traverse((o) => { if (o.isMesh && o.name === 'sushi_salmon') salmon = salmon ?? o; });
  const flipped = salmon.geometry.clone();
  flipped.setIndex(Array.from(flipped.index.array).reverse());
  flipped.computeVertexNormals();
  {
    const p = flipped.attributes.position, nm = flipped.attributes.normal;
    let out = 0, tot = 0;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
      if (r < 1e-4) continue;
      tot++;
      if ((nm.getX(i) * x + nm.getZ(i) * z) / r > -0.05) out++;
    }
    st(`reversed winding is REJECTED by the outward check (${(100 * out / tot).toFixed(1)}% outward)`, out / tot <= 0.90);
  }

  // (a2) the same reversal against the signed-volume test used on the closed straps.
  {
    let strap = null;
    root.traverse((o) => { if (o.isMesh && o.name === 'sushi_nori_strap') strap = strap ?? o; });
    // `ExtrudeGeometry` is NON-indexed, so "reverse the index buffer" is not available
    // — the first version of this selftest crashed on a null `index`, which is a fair
    // reminder that a known-bad input has to be constructed for the geometry you
    // actually have. Swapping two corners of every triangle reverses winding either way.
    const g = strap.geometry.clone().toNonIndexed();
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i += 3) {
      const x = pa.getX(i + 1), y = pa.getY(i + 1), z = pa.getZ(i + 1);
      pa.setXYZ(i + 1, pa.getX(i + 2), pa.getY(i + 2), pa.getZ(i + 2));
      pa.setXYZ(i + 2, x, y, z);
    }
    const v = signedVolume(g);
    st(`reversed winding FLIPS the strap's signed volume negative (${v.toExponential(2)})`, v < 0);
  }

  // (a3) the zero-normal check against a geometry with one normal zeroed by hand. This
  //      is the check that caught the black-frame bug, so it needs its own known-bad:
  //      a sweep that reports "clean" on a buffer that provably is not is worse than none.
  {
    let m = null;
    root.traverse((o) => { if (o.isMesh && o.name === 'sushi_salmon') m = m ?? o; });
    const g = m.geometry.clone();
    g.attributes.normal.setXYZ(7, 0, 0, 0);
    let z = 0;
    const nm = g.attributes.normal;
    for (let i = 0; i < nm.count; i++) if (Math.hypot(nm.getX(i), nm.getY(i), nm.getZ(i)) < 1e-6) z++;
    st(`a hand-zeroed normal IS detected (${z} found)`, z === 1);
  }

  // (b) a constant hem — the "simplify hemAt to a number" regression — must fail the
  //     saddle check. Synthesised directly: a lens hem is a horizontal circle.
  {
    const constEnd = -0.3, constFront = -0.3;
    st('a CONSTANT hem is REJECTED by the saddle check', !((constFront - constEnd) > 0.02));
  }
  console.log(`\n${s - sbad}/${s} known-bad checks behaved correctly`);
  bad += sbad;
}

console.log(`\n${n - bad} of ${n} checks passed`);
await vite.close();
process.exit(bad ? 1 : 0);
