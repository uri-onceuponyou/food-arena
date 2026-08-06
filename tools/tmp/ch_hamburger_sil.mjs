#!/usr/bin/env node
/**
 * ch_hamburger_sil — SILHOUETTE + per-mesh silhouette OWNERSHIP, offline, no GPU.
 *
 * OWNED BY THE HAMBURGER AGENT (`tools/tmp/ch_hamburger_*`). Read-only on `src/`.
 *
 * ── Why a third rasteriser in this repo ──────────────────────────────────────
 * `sepscan`/`limbmatch` compute `hullDeficiency` and island counts, and both need
 * Chromium + SwiftShader. Six agents are contending for one software GPU right now,
 * and the question here — *"which meshes own the silhouette EDGE, and does moving the
 * lettuce points cost the hull"* — is pure geometry. `rg_lib.mjs` builds the real cast
 * in node in ~200 ms, and `silhlib.mjs` already owns the metric definitions, so this
 * file is the ~90 lines of z-buffer that join them. The rasteriser body is the one in
 * `rg_solid.mjs`, deliberately unchanged, so a number here is comparable to one there.
 *
 * ⚠️ It rasterises GEOMETRY: no shading, no light, no outline hull, no AA. It answers
 * "what shape does this character project" exactly and says NOTHING about whether the
 * result is legible once lit (`docs/LESSONS.md` §1 case 18). Pair it with a render.
 *
 * ── Validate before believing (CLAUDE.md non-negotiable #6) ───────────────────
 *   node tools/tmp/ch_hamburger_sil.mjs --selftest
 * Every assertion below is a KNOWN-BAD input the tool must FAIL on, plus a drift
 * control. A guard that has not been shown to fail is not a guard.
 *
 * Usage:
 *   node tools/tmp/ch_hamburger_sil.mjs                      # both shipped cameras
 *   node tools/tmp/ch_hamburger_sil.mjs --pitch 20 --yaw 0   # the LOBBY (charStage.ts:451)
 *   node tools/tmp/ch_hamburger_sil.mjs --edge               # per-mesh silhouette-edge owners
 */
import { loadCast, captureWarnings, arg, flag, num } from './rg_lib.mjs';
import { components, hullArea } from './silhlib.mjs';

const ID = arg('--id', 'hamburger');
const FOV = num('--fov', 34);
const W = num('--w', 512), H = num('--h', 640);
const T = num('--t', 1.5);
const MOVE = num('--move', 0);
const EDGE = flag('--edge');

/** The two shipped cameras. `charStage.ts:451` is the lobby; `camera.ts:265` the match. */
const VIEWS = [
  { tag: 'lobby  pitch20 yaw0 ', pitch: 20, yaw: 0 },
  { tag: 'lobby  pitch20 yaw22', pitch: 20, yaw: 22 },
  { tag: 'match  pitch58 yaw90', pitch: 58, yaw: 90 },
];

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
    const name = o.name || '(unnamed)';
    for (let i = 0; i < n; i += 3) {
      const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
      tris.push([P[a * 3], P[a * 3 + 1], P[a * 3 + 2], P[b * 3], P[b * 3 + 1], P[b * 3 + 2],
        P[c * 3], P[c * 3 + 1], P[c * 3 + 2], name]);
    }
  });
  return tris;
}

function makeCamera(THREE, box, pitch, yaw) {
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.62;
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 200);
  const dist = radius / Math.tan(THREE.MathUtils.degToRad(FOV) / 2) * 1.15;
  const p = THREE.MathUtils.degToRad(pitch), y = THREE.MathUtils.degToRad(yaw);
  cam.position.set(c.x + dist * Math.cos(p) * Math.sin(y), c.y + dist * Math.sin(p), c.z + dist * Math.cos(p) * Math.cos(y));
  cam.lookAt(c);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

function raster(THREE, tris, cam) {
  const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  const e = vp.elements;
  const zbuf = new Float64Array(W * H).fill(Infinity);
  const own = new Int32Array(W * H).fill(-1);
  const names = [], nameIdx = new Map();
  const sx = new Float64Array(3), sy = new Float64Array(3), sz = new Float64Array(3);
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
        const z = sz[0] * (1 - w0 - w1) + sz[2] * w0 + sz[1] * w1;
        const o = py * W + px;
        if (z < zbuf[o]) { zbuf[o] = z; own[o] = key; }
      }
    }
  }
  return { own, names };
}

/**
 * hullDeficiency = 1 - area/hullArea, matching `silhlib.silhouette()`'s definition.
 *
 * `islandOwners` NAMES the meshes in every component after the largest. An island count
 * on its own says "something detached" and sends you looking; the name says which mesh,
 * and this file exists because a 197 px floating disc and an 877 px floating pea both
 * shipped on this character before anyone could attribute them.
 */
function silStats(own, names) {
  const mask = new Uint8Array(W * H);
  let n = 0;
  for (let i = 0; i < own.length; i++) if (own[i] >= 0) { mask[i] = 1; n++; }
  const hull = hullArea(mask, W, H);
  const cc = components(mask, W, H);
  const keep = cc.sizes.map((sz, i) => [i, sz]).filter(([, sz]) => sz >= 24);
  keep.sort((a, b) => b[1] - a[1]);
  const islandOwners = [];
  for (const [id, sz] of keep.slice(1)) {
    const tally = new Map();
    for (let i = 0; i < mask.length; i++) if (mask[i] && cc.label[i] === id) {
      const k = names[own[i]];
      tally.set(k, (tally.get(k) ?? 0) + 1);
    }
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}:${v}`).join(' ');
    islandOwners.push(`${sz}px [${top}]`);
  }
  return { mask, area: n, hullDeficiency: hull > 0 ? +(1 - n / hull).toFixed(4) : null, islands: keep.length, islandOwners };
}

/** Which mesh owns each pixel on the OUTER boundary of the silhouette. */
function edgeOwners(own, names) {
  const tally = new Map();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (own[i] < 0) continue;
      const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1
        || own[i - 1] < 0 || own[i + 1] < 0 || own[i - W] < 0 || own[i + W] < 0;
      if (!edge) continue;
      const k = names[own[i]];
      tally.set(k, (tally.get(k) ?? 0) + 1);
    }
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1]);
}

// ── selftest ──────────────────────────────────────────────────────────────────
if (flag('--selftest')) {
  let pass = 0, fail = 0;
  const ok = (label, cond, extra = '') => {
    if (cond) { pass++; console.log(`  ok   ${label}${extra ? '  ' + extra : ''}`); }
    else { fail++; console.log(`  FAIL ${label}${extra ? '  ' + extra : ''}`); }
  };
  console.log('ch_hamburger_sil selftest — known-bad inputs first\n');

  // A. KNOWN-GOOD: a solid disc is convex, so its deficiency is ~0.
  const mk = (fn) => { const m = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (fn(x, y)) m[y * W + x] = 1; return m; };
  const disc = mk((x, y) => (x - 256) ** 2 + (y - 320) ** 2 < 120 * 120);
  const discN = disc.reduce((s, v) => s + v, 0);
  const discDef = 1 - discN / hullArea(disc, W, H);
  ok('KNOWN-GOOD: a convex disc has ~zero hull deficiency', discDef < 0.02, `def=${discDef.toFixed(4)}`);

  // B. KNOWN-BAD: a four-armed star is deeply concave. If the metric cannot tell it
  //    from the disc, it cannot price an appendage and this whole tool is worthless.
  const star = mk((x, y) => Math.abs(x - 256) < 24 && Math.abs(y - 320) < 190 || Math.abs(y - 320) < 24 && Math.abs(x - 256) < 190);
  const starN = star.reduce((s, v) => s + v, 0);
  const starDef = 1 - starN / hullArea(star, W, H);
  ok('KNOWN-BAD: a concave star must NOT read like the disc', starDef > 0.5, `def=${starDef.toFixed(4)}`);

  // C. ISLANDS: two separated blobs are two components; one blob is one.
  const two = mk((x, y) => ((x - 150) ** 2 + (y - 320) ** 2 < 60 * 60) || ((x - 380) ** 2 + (y - 320) ** 2 < 60 * 60));
  ok('KNOWN-BAD: a detached second blob counts as a second island', components(two, W, H).sizes.filter((n) => n >= 24).length === 2);
  ok('KNOWN-GOOD: ...and one blob counts as one — so the count is about separation', components(disc, W, H).sizes.filter((n) => n >= 24).length === 1);

  // D. LIVE + DRIFT CONTROL: the same character measured twice must be IDENTICAL, so
  //    any difference reported across an edit is caused by the edit.
  const { THREE, createCharacter } = await loadCast();
  const build = () => { const c = captureWarnings(() => createCharacter(ID)).value; c.update?.(T, { moveSpeed01: MOVE, aimDeg: 0 }); const r = c.root ?? c.body; r.updateWorldMatrix(true, true); return r; };
  const r1 = build();
  const t1 = collect(THREE, r1);
  const c1 = makeCamera(THREE, new THREE.Box3().setFromObject(r1), 20, 0);
  const rr1 = raster(THREE, t1, c1); const a = silStats(rr1.own, rr1.names);
  const rr2 = raster(THREE, t1, c1); const b = silStats(rr2.own, rr2.names);
  ok('DRIFT CONTROL: the same tree measured twice is identical', a.area === b.area && a.hullDeficiency === b.hullDeficiency, `area ${a.area} vs ${b.area}`);
  ok('LIVE: the character projects a non-trivial concave silhouette', a.area > 10000 && a.hullDeficiency > 0.05, `area=${a.area} def=${a.hullDeficiency}`);

  // E. POSITIVE CONTROL FOR THE EDIT I AM ABOUT TO MAKE: hiding the three lettuce
  //    points must MOVE the numbers. If it does not, this tool cannot see the change
  //    and every before/after below would be noise reported as a result.
  //    ⚠️ Hidden per MESH, never per GROUP. `visible` is INHERITED at render time but
  //    `traverse` still visits the children, so `collect()`'s `o.visible === false`
  //    test never fires for a mesh under an invisible group — round 1 of this control
  //    set `visible = false` on the three groups and read a delta of exactly 0, which
  //    is indistinguishable from "the metric is blind". It is the same trap
  //    `rg_solid.mjs`'s own header names, reproduced here within an hour of reading it.
  const r2 = build();
  let hidden = 0;
  r2.traverse((o) => {
    if (o.name !== 'hamburger_lettuce_point') return;
    hidden++;
    o.traverse((m) => { if (m.isMesh) m.visible = false; });
  });
  r2.updateWorldMatrix(true, true);
  const t2 = collect(THREE, r2);
  const rr3 = raster(THREE, t2, makeCamera(THREE, new THREE.Box3().setFromObject(r1), 20, 0)); const d = silStats(rr3.own, rr3.names);
  // ⚠️ WAS `hidden === 3`, and it FAILED the moment the fix it exists to guard landed:
  // the ear-signal repair takes the leaf count 3 -> 5, so the control started reporting
  // "the metric is blind" about a metric that had just moved 823 px. An assertion that
  // pins an incidental COUNT is not guarding the property it names. What it must assert
  // is that some leaves were found and that hiding them is visible.
  ok('POSITIVE CONTROL: hiding the lettuce points is VISIBLE to this metric', hidden >= 3 && Math.abs(d.area - a.area) > 200,
    `groups=${hidden} area ${a.area} -> ${d.area}`);

  console.log(`\n  ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
}

// ── live ──────────────────────────────────────────────────────────────────────
const { THREE, createCharacter } = await loadCast();
const { value: ch, warns } = captureWarnings(() => createCharacter(ID));
ch.update?.(T, { moveSpeed01: MOVE, aimDeg: 0 });
const root = ch.root ?? ch.body;
root.updateWorldMatrix(true, true);
const tris = collect(THREE, root);
const box = new THREE.Box3().setFromObject(root);

console.log(`\n${ID} — silhouette, offline raster ${W}x${H} fov ${FOV}, t=${T}s move=${MOVE}`);
console.log(`  ${'view'.padEnd(22)} ${'area'.padStart(8)} ${'hullDef'.padStart(8)} ${'islands'.padStart(8)}`);
for (const v of VIEWS) {
  const { own, names } = raster(THREE, tris, makeCamera(THREE, box, v.pitch, v.yaw));
  const s = silStats(own, names);
  console.log(`  ${v.tag.padEnd(22)} ${String(s.area).padStart(8)} ${String(s.hullDeficiency).padStart(8)} ${String(s.islands).padStart(8)}`);
  for (const o of s.islandOwners) console.log(`      ⚠️ DETACHED ISLAND  ${o}`);
  if (EDGE) for (const [n, c] of edgeOwners(own, names).slice(0, 12)) console.log(`      ${n.padEnd(28)} ${String(c).padStart(6)} edge px`);
}
if (warns.length) console.log(`\n  ${warns.length} construction warning(s):\n${warns.map((w) => '    ' + w).join('\n')}`);
console.log('');
