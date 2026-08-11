#!/usr/bin/env node
/**
 * mg_probe.mjs — CAN THE ARENA PROPS BE MERGED, AND INTO HOW FEW DRAWABLES?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  WHY THIS EXISTS
 * ═══════════════════════════════════════════════════════════════════════════
 * `pf_census.mjs` proved WHERE a phone frame goes: 613 of 942 draws are the arena
 * props (118 main + 495 shadow) and there are 1,924 prop drawables for 111 props.
 * The patch on the table is "merge the static props by material". Before writing
 * a line of it, three facts have to be established and none of them is guessable:
 *
 *   1. **WHICH PROP MESHES ACTUALLY MOVE.** `toon.ts`'s own merge contract says
 *      "ONLY VALID FOR A GROUP WHOSE PARTS NEVER MOVE RELATIVE TO EACH OTHER."
 *      The pot boils, the ambient update animates something every frame, and a
 *      merge that freezes a moving part is a silent visual bug that no draw-call
 *      number would show. So this SAMPLES `matrixWorld` over N frames of a live
 *      match and reports every prop mesh whose transform changed — measured, not
 *      assumed from reading the builders.
 *
 *   2. **HOW MANY DISTINCT MERGE BUCKETS THERE ARE.** A merged mesh has exactly
 *      one material and one pair of shadow flags, so the bucket key must be
 *      (material, castShadow, receiveShadow) — merging across a castShadow
 *      boundary would either add shadows that were never there or delete ones
 *      that were. Reported per strategy so the choice is made on a number.
 *
 *   3. **WHAT MERGING COSTS ON THE GPU.** `InstancedMesh`-style whole-map merging
 *      destroys frustum culling: today 118 of ~1,924 prop drawables survive the
 *      cull in the main pass, so a single arena-wide merged mesh would submit
 *      EVERY prop triangle every frame. This reports the triangle totals for each
 *      strategy so that trade is priced rather than discovered later.
 *
 * ── VALIDATION (`--selftest`) ───────────────────────────────────────────────
 * A guard not shown to FAIL on the bug it guards against is not a guard
 * (CLAUDE.md 6). Three known-bad inputs, all against the live page:
 *   1. MOVER-INJECT — a mesh is added under `arena_props` and its position is
 *      advanced by the probe between samples. The movement scan MUST list it.
 *      A scan that samples one frame, or compares an object to itself, fails.
 *   2. STILL-CONTROL — the same injected mesh, NOT moved, must NOT be listed.
 *      A scan with a floating-point tolerance bug flags everything and fails.
 *   3. BUCKET-INJECT — two meshes sharing one material but differing ONLY in
 *      `castShadow` must produce TWO buckets, not one. A key that ignores the
 *      shadow flags passes every count and fails here.
 *
 * ── USAGE ───────────────────────────────────────────────────────────────────
 *   PH_SCRATCH=<dir> node tools/tmp/ph_serve.mjs --start --ref <sha>   # once
 *   PH_SCRATCH=<dir> node tools/tmp/mg_probe.mjs
 *   PH_SCRATCH=<dir> node tools/tmp/mg_probe.mjs --selftest
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const flag = (k) => argv.includes(`--${k}`);

const SCRATCH = process.env.PH_SCRATCH ?? join(tmpdir(), 'fa-ph');
const STATE = join(SCRATCH, 'ph-serve.json');
function baseUrl() {
  const u = arg('url', null);
  if (u) return u;
  if (!existsSync(STATE)) {
    console.error('mg_probe: no ph_serve running. PH_SCRATCH=<dir> node tools/tmp/ph_serve.mjs --start');
    process.exit(2);
  }
  return JSON.parse(readFileSync(STATE, 'utf8')).url;
}

const MATCH = '/?player=hamburger&enemy=donut';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15'
  + ' (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

// ─────────────────────────────────────────────────────────────────────────────
// Page-side, installed via addInitScript so it exists before the app boots.
// Exactly one `page.evaluate` per measurement and it is LAST where it matters —
// `page.evaluate()` grants transient user activation (AGENT-BRIEF §3).
// ─────────────────────────────────────────────────────────────────────────────
const HOOK = `
(() => {
  const stage = () => (window.__stages ? [...window.__stages].find((s) => !s.offscreen) : null) || window.__stage;
  window.__mgStage = stage;

  function propsRoot() {
    const st = stage(); if (!st) return null;
    let found = null;
    st.scene.traverse((o) => { if (!found && o.name === 'arena_props') found = o; });
    return found;
  }
  window.__mgProps = propsRoot;

  /** Stable identity for a mesh across samples: three's monotonic Object3D.id. */
  function snapshotMatrices() {
    const root = propsRoot(); if (!root) return null;
    const st = stage();
    st.scene.updateMatrixWorld(true);
    const out = {};
    root.traverse((o) => {
      const e = o.matrixWorld.elements;
      out[o.id] = [e[12], e[13], e[14], e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]];
    });
    return out;
  }
  window.__mgSnap = snapshotMatrices;

  /**
   * Also snapshot the GEOMETRY of every prop mesh — a caster whose position
   * buffer is rewritten in place moves nothing in its matrix, and merging it
   * would freeze it just as dead. Cheap fingerprint: vertex count + a checksum
   * over a fixed stride of the position attribute.
   */
  function snapshotGeo() {
    const root = propsRoot(); if (!root) return null;
    const out = {};
    root.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const p = o.geometry.getAttribute('position');
      if (!p) { out[o.id] = 'nopos'; return; }
      let s = 0;
      const step = Math.max(1, Math.floor(p.count / 64));
      for (let i = 0; i < p.count; i += step) s = (s * 31 + Math.round(p.getX(i) * 1e4) + Math.round(p.getY(i) * 1e4) * 7 + Math.round(p.getZ(i) * 1e4) * 13) | 0;
      out[o.id] = p.count + ':' + s;
    });
    return out;
  }
  window.__mgGeo = snapshotGeo;

  /** Full structural census of the props subtree. */
  window.__mgCensus = function () {
    const root = propsRoot(); if (!root) return null;
    const st = stage();
    st.scene.updateMatrixWorld(true);
    const props = [];
    const meshes = [];
    for (const child of root.children) {
      const entry = { name: child.name || child.type, id: child.id, meshes: 0, tris: 0, buckets: new Set() };
      child.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const g = o.geometry;
        const tris = g ? (g.index ? g.index.count : (g.getAttribute('position') ? g.getAttribute('position').count : 0)) / 3 : 0;
        const key = mats.map((m) => (m ? m.uuid : 'null')).join('+')
          + '|c' + (o.castShadow ? 1 : 0) + '|r' + (o.receiveShadow ? 1 : 0);
        entry.meshes++; entry.tris += tris; entry.buckets.add(key);
        const wp = new (window.__mgTHREE_Vector3 || Object)();
        meshes.push({
          id: o.id, prop: child.name || child.type, name: o.name || o.type,
          bucket: key,
          mat: mats[0] ? (mats[0].name || mats[0].type) + '#' + (mats[0].color ? mats[0].color.getHexString() : '-') : 'none',
          matUuid: mats[0] ? mats[0].uuid : 'null',
          cast: !!o.castShadow, recv: !!o.receiveShadow,
          transparent: !!(mats[0] && mats[0].transparent),
          renderOrder: o.renderOrder | 0,
          tris,
          x: o.matrixWorld.elements[12], z: o.matrixWorld.elements[14],
          frustumCulled: o.frustumCulled !== false,
          kids: o.children.length, visible: o.visible !== false,
          attrs: o.geometry ? Object.keys(o.geometry.attributes).sort().join(',') : '',
          det: (() => { const e = o.matrixWorld.elements;
            return e[0]*(e[5]*e[10]-e[6]*e[9]) - e[4]*(e[1]*e[10]-e[2]*e[9]) + e[8]*(e[1]*e[6]-e[2]*e[5]); })(),
          skinned: !!o.isSkinnedMesh, instanced: !!o.isInstancedMesh, points: !!o.isPoints, sprite: !!o.isSprite,
        });
      });
      entry.buckets = [...entry.buckets];
      props.push(entry);
    }
    let objects = 0;
    root.traverse(() => { objects++; });
    return { props, meshes, objects, children: root.children.length };
  };

  /**
   * THE WORLD-SPACE TRIANGLE SOUP OF THE PROPS, as an order-independent checksum.
   *
   * A pixel diff can say two frames differ; it cannot say whether the GEOMETRY
   * differs or the rasteriser merely resolved a tie differently. This can. Every
   * prop triangle is transformed to world space, quantised to 0.1 mm — two orders of
   * magnitude coarser than float32 noise at this arena's 140 m extent (8.4 um) and
   * three orders finer than anything visible — keyed with its MATERIAL and its
   * WINDING, hashed, and summed. Summation is commutative, so draw order, graph
   * shape and bucket order cannot change the result: two arenas with the same
   * triangles in the same places out of the same materials return the same number,
   * and any triangle that moved, flipped, vanished or changed material does not.
   */
  window.__mgSoup = function () {
    const root = propsRoot(); if (!root) return null;
    stage().scene.updateMatrixWorld(true);
    const Q = 1e4, QN = 1e3;
    let tris = 0, hPos = 0, hNorm = 0, verts = 0;
    // Order-independent float64 moments alongside the quantised hash. The hash answers
    // "are they bit-for-bit the same rounded to 0.1 mm", which a single vertex sitting
    // on a rounding boundary can break for a 1e-9 reason. These answer "by HOW MUCH",
    // which is the question that decides whether a hash mismatch matters.
    let sx = 0, sy = 0, sz = 0, sabs = 0, sq = 0;
    const fnv = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
    root.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const g = o.geometry;
      const p = g.getAttribute('position'); const n = g.getAttribute('normal');
      if (!p) return;
      const e = o.matrixWorld.elements;
      const tx = (x, y, z) => [e[0]*x+e[4]*y+e[8]*z+e[12], e[1]*x+e[5]*y+e[9]*z+e[13], e[2]*x+e[6]*y+e[10]*z+e[14]];
      // normal matrix = inverse-transpose of the upper 3x3; for the rigid+scale
      // transforms this arena uses, transforming and renormalising is enough.
      const nrm = (x, y, z) => { const a = e[0]*x+e[4]*y+e[8]*z, b = e[1]*x+e[5]*y+e[9]*z, c = e[2]*x+e[6]*y+e[10]*z;
        const L = Math.hypot(a, b, c) || 1; return [a/L, b/L, c/L]; };
      const idx = g.index;
      const count = idx ? idx.count : p.count;
      const mat = Array.isArray(o.material) ? o.material.map((m) => m.uuid).join('+') : (o.material ? o.material.uuid : 'none');
      verts += p.count;
      for (let i = 0; i < p.count; i++) {
        const w = tx(p.getX(i), p.getY(i), p.getZ(i));
        sx += w[0]; sy += w[1]; sz += w[2];
        sabs += Math.abs(w[0]) + Math.abs(w[1]) + Math.abs(w[2]);
        sq += w[0] * w[0] + w[1] * w[1] + w[2] * w[2];
      }
      for (let t = 0; t + 2 < count; t += 3) {
        const ids = [0, 1, 2].map((k) => (idx ? idx.getX(t + k) : t + k));
        const P = ids.map((i) => tx(p.getX(i), p.getY(i), p.getZ(i)).map((v) => Math.round(v * Q)));
        const N = n ? ids.map((i) => nrm(n.getX(i), n.getY(i), n.getZ(i)).map((v) => Math.round(v * QN))) : [[0,0,0],[0,0,0],[0,0,0]];
        // Rotate so the lexicographically smallest vertex leads: order-independent
        // across index permutations, but WINDING-SENSITIVE, which is the point.
        const keys = P.map((v) => v.join(','));
        let s = 0; for (let k = 1; k < 3; k++) if (keys[k] < keys[s]) s = k;
        const rot = [s, (s + 1) % 3, (s + 2) % 3];
        hPos = (hPos + fnv(mat + '|' + rot.map((k) => keys[k]).join(';'))) >>> 0;
        hNorm = (hNorm + fnv(rot.map((k) => N[k].join(',')).join(';'))) >>> 0;
        tris++;
      }
    });
    return { tris, verts, hPos, hNorm, sx, sy, sz, sabs, sq };
  };

  /** Whole-scene object/draw context so the props share is reported honestly. */
  window.__mgScene = function () {
    const st = stage(); if (!st) return null;
    let objects = 0, meshes = 0;
    st.scene.traverse((o) => { objects++; if (o.isMesh) meshes++; });
    const r = st.renderer;
    return {
      objects, meshes,
      tier: (window.__quality && window.__quality.tier) || null,
      detected: (window.__quality && window.__quality.detected) || null,
      buffer: [r.domElement.width, r.domElement.height],
      calls: r.info.render.calls, tris: r.info.render.triangles,
      shadowsOn: r.shadowMap.enabled, shadowAuto: r.shadowMap.autoUpdate,
    };
  };
})()`;

async function boot(url, { headless = true, suffix = '' } = {}) {
  const browser = await chromium.launch({
    headless,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true, userAgent: UA_IPHONE,
  });
  await ctx.addInitScript(HOOK);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
  await page.goto(url + MATCH + suffix, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 120_000 });
  await page.waitForFunction(`document.querySelector('.hud-countdown')?.style.display === 'none'`,
    null, { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(700);
  return { browser, page, errs };
}

/** Sample matrices + geometry fingerprints over `frames` real animation frames. */
async function movementScan(page, frames) {
  const a = await page.evaluate('({ m: window.__mgSnap(), g: window.__mgGeo() })');
  await page.evaluate(`new Promise((res) => { let n = ${frames}; const t = () => (--n <= 0 ? res(1) : requestAnimationFrame(t)); requestAnimationFrame(t); })`);
  const b = await page.evaluate('({ m: window.__mgSnap(), g: window.__mgGeo() })');
  const movedM = [];
  for (const id of Object.keys(a.m)) {
    const x = a.m[id], y = b.m[id];
    if (!y) continue;
    for (let i = 0; i < x.length; i++) {
      if (Math.abs(x[i] - y[i]) > 1e-9) { movedM.push(Number(id)); break; }
    }
  }
  const movedG = [];
  for (const id of Object.keys(a.g)) if (b.g[id] !== undefined && b.g[id] !== a.g[id]) movedG.push(Number(id));
  return { movedM, movedG, sampled: Object.keys(a.m).length };
}

function bucketStats(meshes, keyOf) {
  const m = new Map();
  for (const x of meshes) {
    const k = keyOf(x);
    if (!m.has(k)) m.set(k, { n: 0, tris: 0 });
    const e = m.get(k); e.n++; e.tris += x.tris;
  }
  return m;
}

async function main() {
  const url = baseUrl();
  const frames = Number(arg('frames', 90));
  const { browser, page, errs } = await boot(url);
  try {
    const scene = await page.evaluate('window.__mgScene()');
    const census = await page.evaluate('window.__mgCensus()');
    if (!census) { console.error('mg_probe: no `arena_props` group found — is this a match?'); process.exit(1); }
    const move = await movementScan(page, frames);

    console.log(`\n══ mg_probe — ${url}   tier ${scene.tier} (detected ${scene.detected}) · buffer ${scene.buffer.join('x')}`);
    console.log(`   scene: ${scene.objects.toLocaleString()} objects · ${scene.meshes.toLocaleString()} drawables · shadows ${scene.shadowsOn ? 'ON' : 'off'} (autoUpdate ${scene.shadowAuto})`);
    console.log(`   arena_props: ${census.children} top-level props · ${census.objects.toLocaleString()} objects · ${census.meshes.length.toLocaleString()} drawables`
      + ` · ${Math.round(census.meshes.reduce((s, m) => s + m.tris, 0)).toLocaleString()} triangles`);

    const movedSet = new Set([...move.movedM, ...move.movedG]);
    const movedMeshes = census.meshes.filter((m) => movedSet.has(m.id));
    console.log(`\n── MOVEMENT SCAN over ${frames} frames (${move.sampled} objects sampled) ────────────────`);
    console.log(`   matrixWorld changed: ${move.movedM.length}   geometry rewritten in place: ${move.movedG.length}`);
    const byProp = new Map();
    for (const m of movedMeshes) byProp.set(m.prop, (byProp.get(m.prop) || 0) + 1);
    // A moving CONTAINER makes its whole subtree move; report the top-level props.
    const movedProps = new Set();
    for (const id of movedSet) {
      const m = census.meshes.find((x) => x.id === id);
      if (m) movedProps.add(m.prop);
    }
    if (movedProps.size === 0) console.log('   NOTHING under arena_props moves. Every prop is mergeable.');
    else {
      console.log(`   ${movedProps.size} top-level prop(s) contain a moving part:`);
      for (const [p, n] of [...byProp].sort((a, b) => b[1] - a[1])) console.log(`      ${p.padEnd(28)} ${n} moving drawables`);
    }
    const staticMeshes = census.meshes.filter((m) => !movedProps.has(m.prop));
    const excluded = census.meshes.filter((m) => movedProps.has(m.prop));
    console.log(`   => mergeable drawables: ${staticMeshes.length.toLocaleString()} of ${census.meshes.length.toLocaleString()}`
      + `   (excluded whole props: ${[...movedProps].join(', ') || 'none'})`);

    // ── Structural facts that constrain the merge ────────────────────────────
    const odd = staticMeshes.filter((m) => m.skinned || m.instanced || m.points || m.sprite);
    const transp = staticMeshes.filter((m) => m.transparent);
    const ro = new Set(staticMeshes.map((m) => m.renderOrder));
    console.log(`\n── CONSTRAINTS ────────────────────────────────────────────────────────────`);
    console.log(`   non-plain drawables (skinned/instanced/points/sprite): ${odd.length}`);
    console.log(`   transparent drawables: ${transp.length}   distinct renderOrder values: ${[...ro].sort((a, b) => a - b).join(', ')}`);
    const noCast = staticMeshes.filter((m) => !m.cast).length;
    console.log(`   castShadow true/false: ${staticMeshes.length - noCast} / ${noCast}`);
    const withKids = staticMeshes.filter((m) => m.kids > 0);
    const hidden = staticMeshes.filter((m) => !m.visible);
    const mirrored = staticMeshes.filter((m) => m.det < 0);
    console.log(`   meshes WITH child objects: ${withKids.length}   invisible: ${hidden.length}   mirrored (det<0): ${mirrored.length}`);
    const attrSigs = new Map();
    for (const m of staticMeshes) attrSigs.set(m.attrs, (attrSigs.get(m.attrs) || 0) + 1);
    console.log(`   attribute signatures: ${[...attrSigs].map(([k, n]) => `${k}=${n}`).join('  ')}`);

    // ── Strategies ──────────────────────────────────────────────────────────
    console.log(`\n── MERGE STRATEGIES (bucket = material + castShadow + receiveShadow) ──────`);
    const strategies = [
      ['global   (one arena-wide mesh per bucket)', (m) => m.bucket],
      ['per-prop (one mesh per bucket per prop)   ', (m) => m.prop + '|' + m.bucket],
    ];
    for (const cell of [200, 350, 500, 700, 1000]) {
      strategies.push([`cell ${String(cell).padStart(4)}wu                             `,
        (m) => `${Math.floor(m.x / (cell / 20))},${Math.floor(m.z / (cell / 20))}|${m.bucket}`]);
    }
    for (const [label, keyOf] of strategies) {
      const b = bucketStats(staticMeshes, keyOf);
      const drawables = b.size + excluded.length;
      console.log(`   ${label}  →  ${String(b.size).padStart(5)} merged + ${excluded.length} kept = ${String(drawables).padStart(5)} drawables`
        + `   (from ${census.meshes.length.toLocaleString()}, ${(100 - (drawables / census.meshes.length) * 100).toFixed(1)}% fewer)`);
    }

    // Distinct materials actually used by static props.
    const mats = new Map();
    for (const m of staticMeshes) {
      if (!mats.has(m.matUuid)) mats.set(m.matUuid, { label: m.mat, n: 0, tris: 0 });
      const e = mats.get(m.matUuid); e.n++; e.tris += m.tris;
    }
    console.log(`\n── TOP MATERIALS BY DRAWABLE COUNT (${mats.size} distinct across static props) ──`);
    for (const e of [...mats.values()].sort((a, b) => b.n - a.n).slice(0, 18)) {
      console.log(`   ${String(e.n).padStart(5)} drawables  ${String(Math.round(e.tris)).padStart(7)} tris   ${e.label}`);
    }

    if (errs.length) console.log(`\n   ⚠️ page errors: ${errs.slice(0, 3).join(' | ')}`);
  } finally {
    await browser.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// --selftest: three known-bad inputs.
// ─────────────────────────────────────────────────────────────────────────────
async function selftest() {
  const url = baseUrl();
  const { browser, page } = await boot(url);
  let pass = 0, fail = 0;
  const check = (name, ok, detail) => {
    console.log(`   ${ok ? 'PASS' : '🚨 FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
    ok ? pass++ : fail++;
  };
  try {
    console.log('\n══ mg_probe --selftest ══');

    // 1+2. MOVER-INJECT and STILL-CONTROL, in one page, distinguished only by
    // whether the probe advances the object between samples.
    const ids = await page.evaluate(`(() => {
      const THREE_MeshCtor = window.__mgProps().children.find((c) => { let f = null; c.traverse((o) => { if (!f && o.isMesh) f = o; }); return f; });
      let proto = null; window.__mgProps().traverse((o) => { if (!proto && o.isMesh) proto = o; });
      const mover = proto.clone(); mover.name = 'mg_selftest_mover';
      const still = proto.clone(); still.name = 'mg_selftest_still';
      window.__mgProps().add(mover); window.__mgProps().add(still);
      window.__mgSelftest = { mover, still, proto };
      return { mover: mover.id, still: still.id, proto: proto.id };
    })()`);
    const before = await page.evaluate('({ m: window.__mgSnap(), g: window.__mgGeo() })');
    await page.evaluate('window.__mgSelftest.mover.position.x += 3');
    await page.evaluate(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`);
    const after = await page.evaluate('({ m: window.__mgSnap(), g: window.__mgGeo() })');
    const changed = (id) => {
      const a = before.m[id], b = after.m[id];
      if (!a || !b) return null;
      return a.some((v, i) => Math.abs(v - b[i]) > 1e-9);
    };
    check('1. MOVER-INJECT: a moved mesh is detected', changed(ids.mover) === true,
      `mover id ${ids.mover} changed=${changed(ids.mover)}`);
    check('2. STILL-CONTROL: an untouched clone is NOT detected', changed(ids.still) === false,
      `still id ${ids.still} changed=${changed(ids.still)}`);

    // 3. BUCKET-INJECT: same material, different castShadow → two buckets.
    await page.evaluate(`(() => {
      const p = window.__mgSelftest.proto;
      const a = p.clone(); a.name = 'mg_bucket_a'; a.castShadow = true;
      const b = p.clone(); b.name = 'mg_bucket_b'; b.castShadow = false;
      a.material = p.material; b.material = p.material;
      const g = new (p.constructor)(p.geometry, p.material); // keep ctor generic
      window.__mgProps().add(a); window.__mgProps().add(b);
      window.__mgSelftest.bucketA = a; window.__mgSelftest.bucketB = b;
    })()`);
    const c2 = await page.evaluate('window.__mgCensus()');
    const ba = c2.meshes.find((m) => m.name === 'mg_bucket_a');
    const bb = c2.meshes.find((m) => m.name === 'mg_bucket_b');
    check('3. BUCKET-INJECT: same material, different castShadow → 2 buckets',
      !!ba && !!bb && ba.bucket !== bb.bucket && ba.matUuid === bb.matUuid,
      ba && bb ? `${ba.bucket} vs ${bb.bucket}` : 'injected meshes not found');

    console.log(`\n   ${pass}/${pass + fail} selftests pass`);
    if (fail) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

/**
 * --soup: prove the batched arena is the SAME arena, at the geometry level.
 *
 * Two page loads of ONE bundle, `?merge=0` apart, each reporting the world-space
 * triangle-soup checksum. Equal checksums mean every prop triangle is in the same
 * place, wound the same way, out of the same material — which is a strictly stronger
 * statement than any pixel diff, and the only one that separates "the rasteriser
 * resolved a tie differently" from "the geometry moved".
 *
 * ⚠️ Known-bad built in: a third arm nudges one merged mesh by 0.5 mm — five times
 * the quantum — and the checksum MUST change. A checksum that cannot fail is a
 * comment with a tick next to it (AGENT-BRIEF §4.4).
 */
async function soup() {
  const url = baseUrl();
  const out = {};
  for (const [label, suffix, mutate] of [
    ['batched', '', null],
    ['unbatched', '&merge=0', null],
    ['batched+0.5mm', '', 'window.__mgProps().children.find((c) => c.isMesh).position.x += 0.0005'],
  ]) {
    const { browser, page } = await boot(url, { suffix });
    try {
      if (mutate) await page.evaluate(mutate);
      out[label] = await page.evaluate('window.__mgSoup()');
      const g = await page.evaluate('window.__mgCensus()');
      out[label].drawables = g.meshes.length;
    } finally { await browser.close(); }
  }
  console.log('\n══ mg_probe --soup — world-space triangle soup, per arm ══');
  for (const [k, v] of Object.entries(out)) {
    console.log(`   ${k.padEnd(14)} drawables ${String(v.drawables).padStart(5)}   tris ${String(v.tris).padStart(7)}   verts ${String(v.verts).padStart(7)}`
      + `   hPos ${v.hPos.toString(16).padStart(8, '0')}   hNorm ${v.hNorm.toString(16).padStart(8, '0')}`);
  }
  const B = out.batched, U = out.unbatched;
  const rel = (a, b) => (b === 0 ? 0 : Math.abs(a - b) / Math.abs(b));
  console.log(`\n   float64 moments over every prop vertex in WORLD space (metres):`);
  for (const k of ['sx', 'sy', 'sz', 'sabs', 'sq']) {
    console.log(`      ${k.padEnd(5)} batched ${B[k].toFixed(6).padStart(16)}   unbatched ${U[k].toFixed(6).padStart(16)}`
      + `   Δ ${(B[k] - U[k]).toExponential(3).padStart(11)}   rel ${rel(B[k], U[k]).toExponential(2)}`);
  }
  console.log(`      mean |Δ| per vertex if all of Δsabs sat in one axis: ${(Math.abs(B.sabs - U.sabs) / B.verts).toExponential(2)} m`);
  // ⚠️ THE HASH ALONE IS THE WRONG VERDICT AND THE FIRST VERSION USED IT.
  // Baking a world matrix into a float32 vertex buffer re-rounds every coordinate, and
  // at this arena's 140 m extent one float32 ulp is 8.3e-6 m — so a vertex sitting on a
  // 0.1 mm rounding boundary flips its quantised key for a reason six orders of
  // magnitude below anything visible. The hash therefore says DIFFERENT for a merge
  // that is numerically exact, which is a guard that cannot pass and is worth nothing.
  // The verdict is: same counts, and a mean deviation inside float32's own noise.
  const ULP = 140 * Math.pow(2, -24);        // one float32 ulp at the arena's extent
  const dev = Math.abs(B.sabs - U.sabs) / B.verts;
  const counts = B.tris === U.tris && B.verts === U.verts;
  const same = counts && dev < ULP * 5;
  const kb = out['batched+0.5mm'];
  const moved = kb.hPos !== B.hPos && Math.abs(kb.sabs - B.sabs) / B.verts > dev * 10;
  console.log(`\n   one float32 ulp at this arena's 140 m extent: ${ULP.toExponential(2)} m`);
  console.log(`   GEOMETRY IDENTITY: ${same ? '✅' : '🚨'} counts ${counts ? 'match' : 'DIFFER'}; `
    + `mean per-vertex deviation ${dev.toExponential(2)} m = ${(dev / ULP).toFixed(2)} ulp`);
  console.log(`   KNOWN-BAD:         ${moved ? '✅' : '🚨'} a 0.5 mm nudge moves the checksum AND the moments `
    + `(${(Math.abs(kb.sabs - B.sabs) / B.verts).toExponential(2)} m/vertex, ${(Math.abs(kb.sabs - B.sabs) / B.verts / dev).toFixed(0)}x the merge's)`);
  if (!same || !moved) process.exitCode = 1;
}

const IS_MAIN = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (IS_MAIN) {
  (flag('selftest') ? selftest() : flag('soup') ? soup() : main()).catch((e) => { console.error(e); process.exit(1); });
}
