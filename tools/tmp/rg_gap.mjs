#!/usr/bin/env node
/**
 * 🦵 "THE LEGS ARE DETACHED FROM THE BODY" — measured, on the silhouette.
 *
 * ── The finding ──────────────────────────────────────────────────────────────
 * Uri, on three separate character sheets: *"the legs are disconnected from the body"*
 * (hamburger), *"same issue with legs detached from torso"* (donut), *"legs — same
 * issue, I'll stop relating to the leg issue, **it's on all characters so far**"*
 * (taco). Three of three, spanning STOUT, STUB and STANDARD.
 *
 * ── Why `delivered / footprint` IS THE WRONG METRIC FOR IT, and this cost a pass ──
 * The obvious close-out is the one `charprobe`/`limbcheck` use: what share of a part's
 * own footprint reaches the screen. Run against the pelvis mass added to fix this, it
 * says **0.204 across the cast, three characters under 0.05, pizza exactly 0.000** —
 * i.e. "80% dead geometry, do not ship".
 *
 * **That verdict is wrong, and the reason is worth writing down.** A pelvis pixel that
 * lands on top of the torso delivers nothing *and costs nothing* — the body was
 * already there. The pixels that matter are the ones that land on BACKGROUND, because
 * those are the ones closing the gap Uri can see. A part can be 95% "dead" by the
 * delivered/footprint metric and still be the entire fix.
 *
 * So this tool measures **FILL**: pixels the part adds to the character's own
 * silhouette. It is a strictly paired A/B on ONE built character — the mesh is
 * rendered, then hidden, then rendered again — so the drift control is 0.0000 by
 * construction rather than by assertion, and nothing about the tree can move between
 * the two halves.
 *
 * It also reports the thing the fill is FOR:
 *   · `crotch`   — background pixels enclosed between the two legs and the body. The
 *                  literal hole Uri is looking at.
 *   · `bridgeL/R`— the width, in pixels, of the narrowest connection between each
 *                  leg and the body mass, scanned across the hip band. **0 means that
 *                  leg is a separate island: detached, not merely thin.**
 *
 * ── RESOLUTION FLOOR ─────────────────────────────────────────────────────────
 * Both halves rasterise the same geometry through the same code path at the same
 * camera, so a difference of **1 pixel is real**. There is no noise term. What there
 * IS is a framing dependency: the camera is fitted to the model's bounding box, so
 * hiding a mesh that touches the box would move the camera. `--freeze-frame` (on by
 * default) computes the box ONCE, with the part visible, and reuses it for both halves.
 * Without it, hamburger's fill moves by 4%.
 *
 * ── Validate before believing (CLAUDE.md non-negotiable #6) ───────────────────
 *   node tools/tmp/rg_gap.mjs --selftest
 *
 * Usage:
 *   node tools/tmp/rg_gap.mjs                      # cast sweep of the pelvis
 *   node tools/tmp/rg_gap.mjs --part torso_mesh
 *   node tools/tmp/rg_gap.mjs --sweep 0,0.6,1,1.4,2
 */
import { loadCast, captureWarnings, writeOut, ALL_IDS, ARCHETYPE, arg, flag, num, list } from './rg_lib.mjs';

const PITCH = num('--pitch', 58);
const FOV = num('--fov', 34);
const YAW = num('--yaw', 90);
const W = num('--w', 512), H = num('--h', 640);
const IDS = list('--ids', ALL_IDS.join(','));
const T = num('--t', 1.5);
const MOVE = num('--move', 0);
const PART = arg('--part', 'pelvis_mesh');

function collect(THREE, root) {
  const tris = [];
  const v = new THREE.Vector3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    if (o.visible === false) return;
    if ((o.name || '').endsWith('__outline')) return;
    const g = o.geometry, pos = g.attributes.position, idx = g.index;
    const n = idx ? idx.count : pos.count;
    const P = new Float64Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
    }
    // Tag: which of the three silhouette regions this triangle belongs to. `leg`
    // covers everything below the hip joint on each side; `body` is everything else.
    let tag = 'body';
    let a = o;
    while (a) {
      if (a.name === 'hipL' || a.name === 'kneeL' || a.name === 'footL') { tag = 'legL'; break; }
      if (a.name === 'hipR' || a.name === 'kneeR' || a.name === 'footR') { tag = 'legR'; break; }
      a = a.parent;
    }
    for (let i = 0; i < n; i += 3) {
      const x = idx ? idx.getX(i) : i, y = idx ? idx.getX(i + 1) : i + 1, z = idx ? idx.getX(i + 2) : i + 2;
      tris.push([P[x * 3], P[x * 3 + 1], P[x * 3 + 2], P[y * 3], P[y * 3 + 1], P[y * 3 + 2],
        P[z * 3], P[z * 3 + 1], P[z * 3 + 2], o.name || '(unnamed)', tag]);
    }
  });
  return tris;
}

function makeCamera(THREE, box) {
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.62;
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 200);
  const dist = radius / Math.tan(THREE.MathUtils.degToRad(FOV) / 2) * 1.15;
  const p = THREE.MathUtils.degToRad(PITCH), y = THREE.MathUtils.degToRad(YAW);
  cam.position.set(c.x + dist * Math.cos(p) * Math.sin(y), c.y + dist * Math.sin(p),
    c.z + dist * Math.cos(p) * Math.cos(y));
  cam.lookAt(c);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

/** Silhouette + region map. `mask[i]` = 0 background, 1 body, 2 legL, 3 legR. */
function raster(THREE, tris, cam) {
  const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  const e = vp.elements;
  const zbuf = new Float64Array(W * H).fill(Infinity);
  const mask = new Uint8Array(W * H);
  const sx = new Float64Array(3), sy = new Float64Array(3), sz = new Float64Array(3);
  const TAG = { body: 1, legL: 2, legR: 3 };
  for (const t of tris) {
    let behind = false;
    for (let k = 0; k < 3; k++) {
      const x = t[k * 3], y = t[k * 3 + 1], z = t[k * 3 + 2];
      const cw = e[3] * x + e[7] * y + e[11] * z + e[15];
      if (cw <= 1e-6) { behind = true; break; }
      sx[k] = ((e[0] * x + e[4] * y + e[8] * z + e[12]) / cw * 0.5 + 0.5) * W;
      sy[k] = (1 - ((e[1] * x + e[5] * y + e[9] * z + e[13]) / cw * 0.5 + 0.5)) * H;
      sz[k] = (e[2] * x + e[6] * y + e[10] * z + e[14]) / cw;
    }
    if (behind) continue;
    const area = (sx[1] - sx[0]) * (sy[2] - sy[0]) - (sx[2] - sx[0]) * (sy[1] - sy[0]);
    if (area <= 0) continue;
    const tag = TAG[t[10]];
    const x0 = Math.max(0, Math.floor(Math.min(sx[0], sx[1], sx[2])));
    const x1 = Math.min(W - 1, Math.ceil(Math.max(sx[0], sx[1], sx[2])));
    const y0 = Math.max(0, Math.floor(Math.min(sy[0], sy[1], sy[2])));
    const y1 = Math.min(H - 1, Math.ceil(Math.max(sy[0], sy[1], sy[2])));
    const inv = 1 / area;
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const cxp = px + 0.5, cyp = py + 0.5;
        const w0 = ((sx[1] - sx[0]) * (cyp - sy[0]) - (cxp - sx[0]) * (sy[1] - sy[0])) * inv;
        const w1 = ((cxp - sx[0]) * (sy[2] - sy[0]) - (sx[2] - sx[0]) * (cyp - sy[0])) * inv;
        if (w0 < 0 || w1 < 0 || w0 + w1 > 1) continue;
        const z = sz[0] * (1 - w0 - w1) + sz[2] * w0 + sz[1] * w1;
        const o = py * W + px;
        if (z < zbuf[o]) { zbuf[o] = z; mask[o] = tag; }
      }
    }
  }
  return mask;
}

/**
 * Background pixels ENCLOSED by the figure — the literal hole between the legs.
 * Flood-fill from the border; anything background and unreached is enclosed.
 */
function enclosed(mask) {
  const seen = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) { stack.push(x, (H - 1) * W + x); }
  for (let y = 0; y < H; y++) { stack.push(y * W, y * W + W - 1); }
  while (stack.length) {
    const o = stack.pop();
    if (seen[o] || mask[o]) continue;
    seen[o] = 1;
    const x = o % W, y = (o / W) | 0;
    if (x > 0) stack.push(o - 1);
    if (x < W - 1) stack.push(o + 1);
    if (y > 0) stack.push(o - W);
    if (y < H - 1) stack.push(o + W);
  }
  let n = 0;
  for (let i = 0; i < W * H; i++) if (!mask[i] && !seen[i]) n++;
  return n;
}

/**
 * Narrowest connection, in pixels, between a leg region and the body region.
 *
 * Scanned ROW BY ROW: for each row that contains leg pixels, how many of that row's
 * leg pixels have a body pixel directly above them (within `reach` rows)? The minimum
 * over the rows that span the top of the leg is the bridge. **0 = the leg is a
 * separate island in the silhouette — detached, not merely thin.**
 */
function bridge(mask, legTag, reach = 3) {
  let firstRow = -1;
  for (let y = 0; y < H && firstRow < 0; y++) {
    for (let x = 0; x < W; x++) if (mask[y * W + x] === legTag) { firstRow = y; break; }
  }
  if (firstRow < 0) return null;
  let best = Infinity;
  for (let y = firstRow; y < Math.min(H, firstRow + 12); y++) {
    let n = 0, any = 0;
    for (let x = 0; x < W; x++) {
      if (mask[y * W + x] !== legTag) continue;
      any++;
      for (let d = 1; d <= reach; d++) {
        const o = (y - d) * W + x;
        if (y - d >= 0 && (mask[o] === 1 || mask[o] === legTag)) { n++; break; }
      }
    }
    if (any) best = Math.min(best, n);
  }
  return best === Infinity ? null : best;
}

function measureOne(THREE, root, partName, freezeBox = null) {
  const targets = [];
  root.traverse((o) => { if (o.isMesh && o.name === partName) targets.push(o); });
  const box = freezeBox ?? new THREE.Box3().setFromObject(root);
  const cam = makeCamera(THREE, box);

  const on = raster(THREE, collect(THREE, root), cam);
  for (const t of targets) t.visible = false;
  const off = raster(THREE, collect(THREE, root), cam);
  for (const t of targets) t.visible = true;

  let silOn = 0, silOff = 0, fill = 0;
  for (let i = 0; i < W * H; i++) {
    if (on[i]) silOn++;
    if (off[i]) silOff++;
    if (on[i] && !off[i]) fill++;
  }
  return {
    present: targets.length > 0,
    silOn, silOff, fill,
    fillShare: silOn ? fill / silOn : 0,
    crotchOn: enclosed(on), crotchOff: enclosed(off),
    bridgeLOn: bridge(on, 2), bridgeROn: bridge(on, 3),
    bridgeLOff: bridge(off, 2), bridgeROff: bridge(off, 3),
  };
}

// ── Selftest ──────────────────────────────────────────────────────────────────
async function selftest(mod) {
  const { THREE, ChibiRig, bodyType } = mod;
  let pass = 0, fail = 0;
  const ok = (n, c, d = '') => { if (c) { pass++; console.log(`  ok   ${n}${d ? '  ' + d : ''}`); } else { fail++; console.log(`  FAIL ${n}  ${d}`); } };

  // `enclosed` against a hand-built answer: a ring encloses its own hole exactly.
  const m = new Uint8Array(W * H);
  const cx = W / 2, cy = H / 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = Math.hypot(x - cx, y - cy);
    if (r < 100 && r > 60) m[y * W + x] = 1;
  }
  let inner = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.hypot(x - cx, y - cy) <= 60) inner++;
  ok('ENCLOSED: a ring reports its hole, to within the rasterisation of the circle',
    Math.abs(enclosed(m) - inner) < inner * 0.02, `got ${enclosed(m)} expected ~${inner}`);
  const solid = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Math.hypot(x - cx, y - cy) < 100) solid[y * W + x] = 1;
  ok('ENCLOSED: KNOWN-GOOD — a solid disc of the same size encloses NOTHING', enclosed(solid) === 0);
  const openRing = m.slice();
  for (let y = 0; y < H; y++) for (let x = cx; x < W; x++) openRing[y * W + x] = 0;
  ok('ENCLOSED: KNOWN-BAD — a ring cut open leaks, so the fill is reachable and reports 0',
    enclosed(openRing) === 0);

  // `bridge` against a hand-built answer.
  const b = new Uint8Array(W * H);
  for (let y = 100; y < 140; y++) for (let x = 200; x < 300; x++) b[y * W + x] = 1;   // body
  for (let y = 140; y < 200; y++) for (let x = 230; x < 260; x++) b[y * W + x] = 2;   // leg, attached
  ok('BRIDGE: an attached leg reports its full width', bridge(b, 2) === 30, `got ${bridge(b, 2)}`);
  const d = new Uint8Array(W * H);
  for (let y = 100; y < 140; y++) for (let x = 200; x < 300; x++) d[y * W + x] = 1;
  for (let y = 160; y < 220; y++) for (let x = 230; x < 260; x++) d[y * W + x] = 2;   // 20px gap
  ok('BRIDGE: KNOWN-BAD — a leg with 20 px of background above it reports 0, i.e. DETACHED',
    bridge(d, 2) === 0, `got ${bridge(d, 2)}`);

  // Paired A/B on a real rig. The drift control has to be exactly 0.
  const rig = new ChibiRig({ palette: { limb: 0x888888, hand: 0xcccccc, foot: 0x222222 },
    proportions: bodyType('standard', {}) });
  rig.restPose();
  const r1 = measureOne(THREE, rig.joints.root, 'pelvis_mesh');
  const r2 = measureOne(THREE, rig.joints.root, 'pelvis_mesh');
  ok('DRIFT CONTROL: the same measurement twice is IDENTICAL, so a difference below is caused by the change',
    r1.fill === r2.fill && r1.silOn === r2.silOn, `fill ${r1.fill} vs ${r2.fill}`);
  ok('PAIRED A/B: hiding the pelvis is REVERSIBLE — the silhouette returns to its "on" value',
    r1.silOn === r2.silOn);
  // ── ⚠️ THIS ASSERTION IS THE REVERSE OF THE ONE FIRST WRITTEN, AND THE REVERSAL IS THE FINDING ──
  // It was: "LIVE: the pelvis adds silhouette on a default rig — a nonzero fill exists
  // to be measured". It FAILED, with fill = 0 px of a 40,807 px silhouette, and the
  // tool was right: the pelvis mass added to fix "the legs are detached from the body"
  // sits ENTIRELY INSIDE the silhouette it was meant to extend. Across the real cast it
  // is 0.08% of the figure at the match camera and 0.33% at the lobby camera, and it
  // changes ZERO of the 22 leg-attachment bridge measurements.
  //
  // Kept as an assertion in this direction so that if someone later makes the pelvis
  // actually reach the outline, THIS test fails and forces the number to be re-read.
  ok('LIVE: the default-rig pelvis is fully INSIDE the existing silhouette — fill is 0, which is why it cannot fix a visible gap',
    r1.present && r1.fill === 0, `fill=${r1.fill}px of ${r1.silOn}px silhouette`);
  // Positive control, so the assertion above is not just "the tool always says 0".
  // Displace the same mesh well clear of the body: the fill must become large.
  ok('POSITIVE CONTROL: the SAME mesh moved clear of the body reports a large fill — so a 0 above means "inside", not "blind"',
    (() => {
      let p = null;
      rig.joints.root.traverse((o) => { if (o.isMesh && o.name === 'pelvis_mesh') p = o; });
      if (!p) return false;
      const y0 = p.position.y;
      p.position.y = y0 - rig.metrics.hipY * 1.6;
      const moved = measureOne(THREE, rig.joints.root, 'pelvis_mesh');
      p.position.y = y0;
      return moved.fill > 500;
    })());
  const none = measureOne(THREE, rig.joints.root, 'no_such_mesh');
  ok('ABSENT: a part that does not exist reports present=false and fill 0, not a silent 0',
    none.present === false && none.fill === 0);

  console.log(`\n  ${pass} pass, ${fail} fail`);
  return fail === 0;
}

// ── main ──────────────────────────────────────────────────────────────────────
const mod = await loadCast();
if (flag('--selftest')) {
  console.log('rg_gap selftest — known-bad inputs first\n');
  process.exit((await selftest(mod)) ? 0 : 1);
}

const { createCharacter, THREE } = mod;
const rows = [];
captureWarnings(() => {
  for (const id of IDS) {
    const c = createCharacter(id);
    c.rig.animate({ elapsed: T, move01: MOVE });
    rows.push({ id, archetype: ARCHETYPE[id], ...measureOne(THREE, c.rig.joints.root, PART) });
  }
});

console.log(`"${PART}" as a SILHOUETTE FILL — pitch ${PITCH}deg yaw ${YAW}, ${W}x${H}, t=${T}s move=${MOVE}`);
console.log('fill = px the part adds to the character\'s own silhouette (paired A/B, drift control 0 by construction).');
console.log('bridge = narrowest px connecting each leg to the body. 0 = that leg is a separate island.\n');
console.log('char         arch       silhouette   fill    fill%    crotch off->on    bridgeL off->on   bridgeR off->on');
console.log('-'.repeat(112));
let tFill = 0, tSil = 0;
for (const r of rows) {
  if (!r.present) { console.log(`${r.id.padEnd(12)} ${String(r.archetype).padEnd(10)} (part absent)`); continue; }
  tFill += r.fill; tSil += r.silOn;
  const bn = (v) => (v === null ? ' -- ' : String(v).padStart(4));
  console.log(
    `${r.id.padEnd(12)} ${String(r.archetype).padEnd(10)} ${String(r.silOn).padStart(8)}  ` +
    `${String(r.fill).padStart(6)}  ${(r.fill / r.silOn * 100).toFixed(2).padStart(6)}%   ` +
    `${String(r.crotchOff).padStart(6)} ->${String(r.crotchOn).padStart(6)}     ` +
    `${bn(r.bridgeLOff)} ->${bn(r.bridgeLOn)}      ${bn(r.bridgeROff)} ->${bn(r.bridgeROn)}`
  );
}
console.log('-'.repeat(112));
console.log(`cast: ${tFill} px of new silhouette on ${tSil} px of figure = ${(tFill / tSil * 100).toFixed(2)}%`);
const detachedOff = rows.filter((r) => r.bridgeLOff === 0 || r.bridgeROff === 0).length;
const detachedOn = rows.filter((r) => r.bridgeLOn === 0 || r.bridgeROn === 0).length;
console.log(`legs reading as SEPARATE ISLANDS (bridge 0): ${detachedOff} characters without the part -> ${detachedOn} with it`);
const jsonOut = arg('--json', null);
if (jsonOut) console.log('\nwrote ' + writeOut(jsonOut, { generated: new Date().toISOString(), PART, PITCH, YAW, T, MOVE, rows }));
