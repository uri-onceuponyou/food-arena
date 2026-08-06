#!/usr/bin/env node
/**
 * 🖥️ DELIVERED PIXELS, WITHOUT A GPU — a software rasteriser over the real cast.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * `docs/LESSONS.md` §1 is this project's most expensive lesson: eighteen times, the
 * thing that "wasn't there" was rendering and INVISIBLE. The instrument that closes
 * it is delivered-vs-possible pixels per part — `charprobe.mjs` in `docs/TOOLS.md`,
 * which found nine characters' limbs buried inside their own bodies.
 *
 * **`charprobe.mjs` no longer exists on disk and is in no commit.** It was a
 * throwaway that outlived its file. `limbcheck.mjs` inherits its method but only
 * measures the twelve LIMB JOINTS, and the mass this pass adds — a PELVIS parented to
 * `hips` — is not one of them. So the close-out the brief demands ("close out on
 * DELIVERED pixels per character") had no instrument.
 *
 * This is that instrument, rebuilt to run offline:
 *   · Z-buffer rasterisation of the real `three` scene graph, in node.
 *   · Per-pixel OWNERSHIP, so an occluder is NAMED rather than guessed — the thing
 *     `ca_neckprobe.mjs` had to be written to add, and which turned "the neck is
 *     invisible" into "the neck is 86% occluded BY THE CHARACTER'S OWN FOOD MASS".
 *   · No browser, no SwiftShader, no snapshot server, no contention with the five
 *     other agents currently measuring on this machine. A full cast sweep is ~6 s
 *     against ~8 minutes.
 *
 * ── What it is NOT ───────────────────────────────────────────────────────────
 * It rasterises GEOMETRY. There is no shading, no light, no shadow, no post chain and
 * no anti-aliasing. So it answers "is this mass reachable by the camera?" exactly, and
 * says NOTHING about whether the result is legible once lit — a part can deliver 100%
 * of its pixels and still be invisible because it is the same value as what is behind
 * it, which is `docs/LESSONS.md` §1 case 18. **Pair it with a real render; do not
 * substitute it for one.**
 *
 * ⚠️ `__outline` meshes are skipped. They are BackSide shells sitting just outside
 * their parent, so with backface culling they contribute nothing, and without it they
 * would occlude everything. Skipping them changes a footprint by ~1 px of edge.
 *
 * ── Validate before believing (CLAUDE.md non-negotiable #6) ───────────────────
 *   node tools/tmp/rg_solid.mjs --selftest
 * Known-bad inputs include: a part moved BEHIND a known occluder must read 0.000; the
 * same part moved in FRONT must read 1.000; a part with no geometry must be absent
 * rather than silently 0; and the projection must place a known world point on the
 * screen pixel computed by hand.
 *
 * Usage:
 *   node tools/tmp/rg_solid.mjs                       # cast sweep at the SHIPPED camera
 *   node tools/tmp/rg_solid.mjs --parts pelvis_mesh --verbose
 *   node tools/tmp/rg_solid.mjs --selftest
 *   node tools/tmp/rg_solid.mjs --png shots/rg/       # write an ownership map per character
 */
import { loadCast, captureWarnings, writeOut, ALL_IDS, ARCHETYPE, arg, flag, num, list } from './rg_lib.mjs';

// ── The SHIPPED view ──────────────────────────────────────────────────────────
// `render/camera.ts:265` — pitch 58 deg below horizontal, fov 34. `limbcheck` measures
// the PREVIEW's 22 deg and the brief is explicit that the ranking does not survive
// between them (idle passes go 8/11 -> 0/11), so 58 is the default here and the pitch
// is a parameter so the two can be compared rather than confused.
const PITCH = num('--pitch', 58);
const FOV = num('--fov', 34);
// `sim.ts` gives the player facing {x:1,y:0}; the model is yawed to match. Exact
// profile is where the two legs are one behind the other, which is the facing that
// hides anything thin in X and shows anything with depth in Z.
const YAW = num('--yaw', 90);
const W = num('--w', 512), H = num('--h', 640);
const IDS = list('--ids', ALL_IDS.join(','));
const T = num('--t', 1.5);
const MOVE = num('--move', 0);
const VERBOSE = flag('--verbose');

/** Parts reported by default: the new pelvis mass plus the limb set for context. */
const DEFAULT_PARTS = ['pelvis_mesh', 'torso_mesh', 'neck_column', 'neck_collar'];

// ── Rasteriser ────────────────────────────────────────────────────────────────
/**
 * Gather every drawable triangle in world space, tagged with the name of the mesh and
 * of the nearest NAMED ancestor joint, so ownership can be reported at either level.
 */
function collect(THREE, root) {
  const tris = [];
  const v = new THREE.Vector3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    if (o.visible === false) return;
    if ((o.name || '').endsWith('__outline')) return;
    let anc = o, joint = '';
    while (anc) { if (anc.name && anc.name !== o.name) { joint = anc.name; break; } anc = anc.parent; }
    const g = o.geometry;
    const pos = g.attributes.position;
    const idx = g.index;
    const n = idx ? idx.count : pos.count;
    const P = new Float64Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
    }
    const name = o.name || '(unnamed)';
    for (let i = 0; i < n; i += 3) {
      const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
      tris.push([P[a * 3], P[a * 3 + 1], P[a * 3 + 2], P[b * 3], P[b * 3 + 1], P[b * 3 + 2],
        P[c * 3], P[c * 3 + 1], P[c * 3 + 2], name, joint]);
    }
  });
  return tris;
}

/**
 * A camera that frames the model's bounding box, pitched and yawed as the shipped
 * view. Framing is derived from the model so every character fills the same share of
 * the frame — otherwise a tall character would be measured at a different pixel
 * density from a short one and the ratios would not be comparable.
 */
function makeCamera(THREE, box) {
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.62;
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 200);
  const dist = radius / Math.tan(THREE.MathUtils.degToRad(FOV) / 2) * 1.15;
  const p = THREE.MathUtils.degToRad(PITCH), y = THREE.MathUtils.degToRad(YAW);
  cam.position.set(
    c.x + dist * Math.cos(p) * Math.sin(y),
    c.y + dist * Math.sin(p),
    c.z + dist * Math.cos(p) * Math.cos(y)
  );
  cam.lookAt(c);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

/**
 * Rasterise to a z-buffer with per-pixel ownership.
 * `only` restricts drawing to triangles whose mesh name matches — that is the
 * "isolate" pass, and running it through the SAME rasteriser as the full pass is what
 * makes delivered/footprint a like-for-like ratio rather than two different measurements.
 */
function raster(THREE, tris, cam, only = null) {
  const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  const e = vp.elements;
  const zbuf = new Float64Array(W * H).fill(Infinity);
  const own = new Int32Array(W * H).fill(-1);
  const names = [], nameIdx = new Map();
  const sx = new Float64Array(3), sy = new Float64Array(3), sz = new Float64Array(3);
  for (let ti = 0; ti < tris.length; ti++) {
    const t = tris[ti];
    if (only && !only(t[9], t[10])) continue;
    let behind = false;
    for (let k = 0; k < 3; k++) {
      const x = t[k * 3], y = t[k * 3 + 1], z = t[k * 3 + 2];
      const cw = e[3] * x + e[7] * y + e[11] * z + e[15];
      if (cw <= 1e-6) { behind = true; break; }
      const cx = e[0] * x + e[4] * y + e[8] * z + e[12];
      const cy = e[1] * x + e[5] * y + e[9] * z + e[13];
      const cz = e[2] * x + e[6] * y + e[10] * z + e[14];
      sx[k] = (cx / cw * 0.5 + 0.5) * W;
      sy[k] = (1 - (cy / cw * 0.5 + 0.5)) * H;
      sz[k] = cz / cw;
    }
    if (behind) continue;
    // Backface cull. This is what makes `__outline` shells harmless in principle and
    // what keeps a closed mesh's interior from writing over its own front face.
    const area = (sx[1] - sx[0]) * (sy[2] - sy[0]) - (sx[2] - sx[0]) * (sy[1] - sy[0]);
    if (area <= 0) continue;
    let key = nameIdx.get(t[9]);
    if (key === undefined) { key = names.length; names.push(t[9]); nameIdx.set(t[9], key); }
    const x0 = Math.max(0, Math.floor(Math.min(sx[0], sx[1], sx[2])));
    const x1 = Math.min(W - 1, Math.ceil(Math.max(sx[0], sx[1], sx[2])));
    const y0 = Math.max(0, Math.floor(Math.min(sy[0], sy[1], sy[2])));
    const y1 = Math.min(H - 1, Math.ceil(Math.max(sy[0], sy[1], sy[2])));
    if (x1 < x0 || y1 < y0) continue;
    const inv = 1 / area;
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const cxp = px + 0.5, cyp = py + 0.5;
        const w0 = ((sx[1] - sx[0]) * (cyp - sy[0]) - (cxp - sx[0]) * (sy[1] - sy[0])) * inv;
        const w1 = ((cxp - sx[0]) * (sy[2] - sy[0]) - (sx[2] - sx[0]) * (cyp - sy[0])) * inv;
        if (w0 < 0 || w1 < 0 || w0 + w1 > 1) continue;
        const w2 = 1 - w0 - w1;
        const z = sz[0] * w2 + sz[2] * w0 + sz[1] * w1;
        const o = py * W + px;
        if (z < zbuf[o]) { zbuf[o] = z; own[o] = key; }
      }
    }
  }
  return { own, names, zbuf };
}

/** Delivered / footprint / occluders for a set of part names. */
function measure(THREE, root, parts) {
  const tris = collect(THREE, root);
  const box = new THREE.Box3().setFromObject(root);
  const cam = makeCamera(THREE, box);
  const full = raster(THREE, tris, cam);
  const present = new Set(tris.map((t) => t[9]));
  const out = {};
  for (const part of parts) {
    if (!present.has(part)) { out[part] = null; continue; }
    const iso = raster(THREE, tris, cam, (n) => n === part);
    const key = iso.names.indexOf(part);
    let footprint = 0;
    const occl = new Map();
    let delivered = 0;
    const fullKey = full.names.indexOf(part);
    for (let i = 0; i < iso.own.length; i++) {
      if (iso.own[i] !== key) continue;
      footprint++;
      if (full.own[i] === fullKey) delivered++;
      else {
        const by = full.names[full.own[i]] ?? '(background)';
        occl.set(by, (occl.get(by) ?? 0) + 1);
      }
    }
    out[part] = {
      footprint, delivered,
      ratio: footprint ? delivered / footprint : 0,
      occluders: [...occl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
    };
  }
  out.__total = full.own.reduce((n, v) => n + (v >= 0 ? 1 : 0), 0);
  return out;
}

// ── Selftest ──────────────────────────────────────────────────────────────────
async function selftest(mod) {
  const { THREE, ChibiRig, bodyType } = mod;
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`  ok   ${name}${detail ? '  ' + detail : ''}`); }
    else { fail++; console.log(`  FAIL ${name}  ${detail}`); }
  };

  // A hand-built scene with a known answer: a small PROBE quad and a big WALL quad.
  const scene = new THREE.Group();
  const probe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshBasicMaterial());
  probe.name = 'probe';
  const wall = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 0.2), new THREE.MeshBasicMaterial());
  wall.name = 'wall';
  scene.add(probe, wall);

  // Camera looks from +y/+z down at the origin at the shipped pitch. "Behind the wall"
  // means further from the camera along its view direction.
  const camDir = (() => {
    const box = new THREE.Box3().setFromObject(scene);
    const cam = makeCamera(THREE, box);
    return new THREE.Vector3().subVectors(cam.position, box.getCenter(new THREE.Vector3())).normalize();
  })();

  const at = (obj, d) => { obj.position.copy(camDir).multiplyScalar(d); scene.updateMatrixWorld(true); };
  wall.position.set(0, 0, 0); wall.lookAt(camDir); scene.updateMatrixWorld(true);

  at(probe, -0.9);
  let m = measure(THREE, scene, ['probe']);
  ok('KNOWN-BAD: a part BEHIND an occluder delivers 0.000 of its footprint',
    m.probe.footprint > 100 && m.probe.ratio === 0,
    `footprint=${m.probe.footprint} delivered=${m.probe.delivered}`);
  ok('KNOWN-BAD: ...and the occluder is NAMED, not guessed',
    m.probe.occluders[0]?.[0] === 'wall', `occluder=${m.probe.occluders[0]?.[0]}`);

  at(probe, 0.9);
  m = measure(THREE, scene, ['probe']);
  ok('KNOWN-GOOD: the SAME part in FRONT delivers 1.000 — so the test above is about depth, not about the part',
    m.probe.ratio === 1, `ratio=${m.probe.ratio.toFixed(3)} footprint=${m.probe.footprint}`);

  m = measure(THREE, scene, ['does_not_exist']);
  ok('ABSENT: a part with no geometry reports null, NOT a silent 0.000 — a missing mesh and a buried one are different bugs',
    m.does_not_exist === null);

  // Projection sanity against a hand-computed answer: a point at the look-at centre
  // must land on the centre pixel.
  const box = new THREE.Box3().setFromObject(scene);
  const cam = makeCamera(THREE, box);
  const c = box.getCenter(new THREE.Vector3()).project(cam);
  ok('PROJECTION: the look-at point lands on the centre pixel',
    Math.abs(c.x) < 1e-6 && Math.abs(c.y) < 1e-6, `ndc=(${c.x.toFixed(6)}, ${c.y.toFixed(6)})`);

  // The rasteriser must see the pelvis at all on a plain rig — if it cannot, every
  // number about the pelvis below is meaningless.
  const rig = new ChibiRig({ palette: { limb: 0x888888, hand: 0xcccccc, foot: 0x222222 },
    proportions: bodyType('standard', {}) });
  rig.restPose();
  const rm = measure(THREE, rig.joints.root, ['pelvis_mesh', 'torso_mesh']);
  ok('LIVE: the rig builds a pelvis mesh and the rasteriser finds it',
    rm.pelvis_mesh !== null && rm.pelvis_mesh.footprint > 0,
    `footprint=${rm.pelvis_mesh?.footprint}`);
  ok('LIVE: ...and turning it OFF makes it disappear — so a nonzero reading is caused by the knob',
    (() => {
      const off = new ChibiRig({ palette: { limb: 0x888888, hand: 0xcccccc, foot: 0x222222 },
        proportions: bodyType('standard', { pelvisScale: 0 }) });
      off.restPose();
      return measure(THREE, off.joints.root, ['pelvis_mesh']).pelvis_mesh === null;
    })());

  console.log(`\n  ${pass} pass, ${fail} fail`);
  return fail === 0;
}

// ── main ──────────────────────────────────────────────────────────────────────
const mod = await loadCast();
if (flag('--selftest')) {
  console.log('rg_solid selftest — known-bad inputs first\n');
  process.exit((await selftest(mod)) ? 0 : 1);
}

const { createCharacter, THREE } = mod;
const PARTS = list('--parts', DEFAULT_PARTS.join(','));
const rows = [];
const { warns } = captureWarnings(() => {
  for (const id of IDS) {
    const c = createCharacter(id);
    c.rig.animate({ elapsed: T, move01: MOVE });
    rows.push({ id, archetype: ARCHETYPE[id], m: measure(THREE, c.rig.joints.root, PARTS) });
  }
});

console.log(`delivered pixels at the SHIPPED view — pitch ${PITCH}deg, fov ${FOV}, yaw ${YAW}, ${W}x${H}, t=${T}s move=${MOVE}`);
console.log('ratio = delivered / own-footprint. `-` = the part does not exist on this character.\n');
const w = Math.max(...PARTS.map((p) => p.length), 12);
console.log('char         arch      ' + PARTS.map((p) => p.padEnd(w + 12)).join('') + 'silhouette');
console.log('-'.repeat(30 + PARTS.length * (w + 12) + 10));
for (const r of rows) {
  const cells = PARTS.map((p) => {
    const v = r.m[p];
    if (!v) return '-'.padEnd(w + 12);
    return `${v.delivered}/${v.footprint} ${v.ratio.toFixed(3)}`.padEnd(w + 12);
  });
  console.log(`${r.id.padEnd(12)} ${String(r.archetype).padEnd(9)} ${cells.join('')}${r.m.__total}`);
  if (VERBOSE) {
    for (const p of PARTS) {
      const v = r.m[p];
      if (v && v.ratio < 1 && v.occluders.length) {
        console.log(`      ${p}: occluded by ${v.occluders.map(([n, k]) => `${n} ${k}`).join(', ')}`);
      }
    }
  }
}
console.log('-'.repeat(30 + PARTS.length * (w + 12) + 10));
for (const p of PARTS) {
  const vs = rows.map((r) => r.m[p]).filter(Boolean);
  if (!vs.length) { console.log(`${p}: absent on all ${rows.length}`); continue; }
  const d = vs.reduce((s, v) => s + v.delivered, 0), f = vs.reduce((s, v) => s + v.footprint, 0);
  const dead = vs.filter((v) => v.ratio < 0.05).length;
  console.log(`${p}: ${d}/${f} = ${(d / f).toFixed(3)} across ${vs.length} characters; ${dead} below 0.05 (dead geometry)`);
}
if (warns.length) console.log(`\n${[...new Set(warns)].length} distinct constructor warnings suppressed from the table (not from the tree)`);
const jsonOut = arg('--json', null);
if (jsonOut) console.log('\nwrote ' + writeOut(jsonOut, { generated: new Date().toISOString(), PITCH, FOV, YAW, W, H, T, MOVE, rows }));
