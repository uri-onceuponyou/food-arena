#!/usr/bin/env node
/**
 * THE ORDERING HALF — which `renderOrder` does a transparent ground-rooted surface want,
 * given that clearing `depthWrite` has already been decided?
 *
 * ⚠️ THIS IS NOT A SECOND `gl_occl_ab`. `tools/tmp/gl_occl_ab.mjs` is the class sweep and
 * it is the authority on the FLAG: which materials are transparent depth-writers, what
 * each one buries in delivered pixels, and whether clearing the flag moves the frame
 * toward a correct render. Its verdict is taken as given here. What it cannot express is
 * the arm this file exists for, because its `SET` has exactly five modes and none of them
 * is **`depthWrite` LEFT TRUE with a raised `renderOrder`**:
 *
 *     gl_occl_ab   on = (dw true, ro orig)   off = (dw false, ro orig)   ord = (dw false, ro N)
 *
 * That missing arm is the whole dust question. `2f05202` measured `M.dust` and found the
 * obvious fix BACKWARDS — shipped is 3.4x to 5.4x CLOSER to correct than `depthWrite:false`
 * alone, because with no depth write the mote at `renderOrder 0` is simply painted over by
 * the decal drawn after it — and routed "the dust needs `renderOrder`, NOT the flag". The
 * flag lives in `src/arena/shared.ts` and the `renderOrder` lives on the mesh in
 * `src/arena/ambient.ts`, so the only arm that is actually SHIPPABLE from `ambient.ts` is
 * the one gl_occl_ab has no mode for. Measuring the arm you can ship is not optional.
 *
 * ── THE ARMS ────────────────────────────────────────────────────────────────
 *     a     dw true,  ro orig     SHIPPED
 *     b     dw false, ro orig     the naive fix (gl_occl_ab's `off`)
 *     c3    dw false, ro 3        clears the GROUND stack (max renderOrder 2) and nothing else
 *     c8    dw false, ro 8        clears the ground stack AND the VFX rings AND the fog
 *     d8    dw true,  ro 8        renderOrder ONLY — the arm that is shippable for dust
 *
 * `--ref` names the arm every other arm's distance is reported against (default `c8`,
 * which is gl_occl_ab's own `ord` arm at its own default, so the two tools' numbers are
 * comparable). Distance is SUMMED CHANNEL DELTA, never pixel count: a 183-level change and
 * a 3-level change are the same number of pixels and opposite verdicts (gl_occl_ab's
 * second self-caught fault).
 *
 * ── CONTROLS, ALL FOUR LOAD-BEARING, ALL COPIED DELIBERATELY ────────────────
 * One page load, `requestAnimationFrame` frozen, one knob at a time, per-material block:
 *   SELF-PAIR  two captures with nothing touched — must be 0 px, or every null below is
 *              "cannot see change" wearing "no change"'s clothes.
 *   DRIFT      the arm restored — the block's own noise floor. No claim is made under it.
 *              ⚠️ Colour is restored from a `Color` CLONE, never `getHex()`/`setHex()`:
 *              hex round-trips through 8-bit sRGB while three stores linear, and that
 *              manufactured a 28 px "finding" identically on three loads.
 *   ABLATION   the material forced to #FF00FF at opacity 1; the frame MUST move.
 *              ⚠️ A 0 px ablation is BLIND, not innocent, and is labelled.
 *   C3-vs-C8   printed on its own, because if the two candidate orders are pixel-identical
 *              at this station then this station cannot choose between them and saying so
 *              is the finding.
 *
 *   node tools/tmp/headserve.mjs -- node tools/tmp/hw_ord.mjs --only hazard:wisp --out shots/hw/ord
 *   node tools/tmp/hw_ord.mjs --url <snap> --only kpal:dust --station 700:640 --vfx
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const has = (k) => process.argv.includes('--' + k);
const BASE = arg('url', process.env.PREVIEW_BASE ?? 'http://localhost:5173');
const OUT = arg('out', 'shots/hw/ord');
const STATION = arg('station', '700:640');
const FOG = arg('fog', '993');
const LOADS = Number(arg('loads', '1'));
const ONLY = arg('only', null);
const REF = arg('ref', 'c8');
const VFX = has('vfx');
const W = 1600, H = 900;

/** dw: the `depthWrite` this arm forces. ro: the `renderOrder`, or null for "as authored".
 *  `a` MUST stay first — it is the block baseline every other arm is diffed against. */
const ARMS = [
  { id: 'a', dw: true, ro: null, note: 'SHIPPED' },
  { id: 'b', dw: false, ro: null, note: 'flag only' },
  { id: 'c3', dw: false, ro: 3, note: 'flag + ro 3  (clears the ground stack only)' },
  { id: 'c8', dw: false, ro: 8, note: 'flag + ro 8  (clears ground + VFX + fog)' },
  { id: 'd8', dw: true, ro: 8, note: 'ro ONLY      (the arm shippable from ambient.ts)' },
];

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;

/** Same grouping as gl_occl_ab: by MATERIAL identity, because the material carries the
 *  flag and several are shared across meshes. Saved state is captured BEFORE anything is
 *  touched — steam and the hazard wisps have their opacity written every frame, so this is
 *  the frozen value and never an authored one. */
const FIND = `() => {
  const st = window.__stage; st.scene.updateMatrixWorld(true);
  const byMat = new Map();
  st.scene.traverse((o) => {
    if (!(o.isMesh || o.isInstancedMesh || o.isSprite) || !o.visible) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || m.transparent !== true || m.depthWrite !== true) continue;
      let g = byMat.get(m.uuid);
      if (!g) { g = { mat: m, objs: [], name: m.name || m.type }; byMat.set(m.uuid, g); }
      g.objs.push(o);
    }
  });
  window.__hwGroups = [...byMat.values()];
  return window.__hwGroups.map((g, i) => {
    g.saved = { depthWrite: g.mat.depthWrite, color: g.mat.color ? g.mat.color.clone() : null,
                opacity: g.mat.opacity, renderOrder: g.objs.map((o) => o.renderOrder) };
    let lo = Infinity, hi = -Infinity, n = 0;
    for (const o of g.objs) {
      n += o.isInstancedMesh ? o.count : 1;
      if (o.isInstancedMesh) {
        const e = o.instanceMatrix.array;
        for (let k = 0; k < o.count; k++) { const y = e[k * 16 + 13]; if (y < lo) lo = y; if (y > hi) hi = y; }
      } else {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
        if (bb.min.y < lo) lo = bb.min.y; if (bb.max.y > hi) hi = bb.max.y;
      }
    }
    return { i, name: g.name, meshes: g.objs.length, drawn: n, renderOrder: g.objs[0].renderOrder,
             opacity: +g.mat.opacity.toFixed(3), yMin: +lo.toFixed(3), yMax: +hi.toFixed(3),
             objNames: [...new Set(g.objs.map((o) => o.name || '(unnamed)'))].slice(0, 2).join(',') };
  });
}`;

/** One group, one arm. `mag` is the ablation (colour + opacity forced), `restore` puts
 *  everything back from the clone. Nothing else in the page is touched. */
const SET = `(i, dw, ro, mag) => {
  const g = window.__hwGroups[i], m = g.mat, s = g.saved;
  if (m.color) { if (mag) m.color.setHex(0xFF00FF); else m.color.copy(s.color); }
  m.opacity = mag ? 1 : s.opacity;
  m.depthWrite = dw;
  g.objs.forEach((o, k) => { o.renderOrder = ro === null ? s.renderOrder[k] : ro; });
  m.needsUpdate = true;
  window.__stage.render(0);
}`;

const SPAWN_VFX = `(cx, cy) => {
  const f = window.__vfxSpawnTest; if (!f) return 0;
  let n = 0;
  for (const [dx, dy] of [[0,0],[70,0],[-70,0],[0,70],[0,-70],[50,50],[-50,50],[50,-50],[-50,-50]]) { f('impact', cx + dx, cy + dy, 18, '#FFC93C'); n++; }
  f('giantSlam', cx, cy, 18, '#FFC93C'); n++;
  f('meleeArc', cx, cy, 18, '#FFC93C'); n++;
  return n;
}`;

async function raw(p) {
  const { data, info } = await sharp(p).raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, ch: info.channels };
}
/** Exact — any channel differing at all. `total` is the verdict quantity; `changed` only
 *  says WHERE. Counting pixels conflates a 183-level change with a 3-level one. */
async function diff(pa, pb, outPath) {
  const A = await raw(pa), B = await raw(pb);
  const n = A.w * A.h;
  const mask = outPath ? Buffer.alloc(n * 3) : null;
  let changed = 0, sum = 0, max = 0;
  for (let i = 0; i < n; i++) {
    const o = i * A.ch;
    const d = Math.max(Math.abs(A.data[o] - B.data[o]), Math.abs(A.data[o + 1] - B.data[o + 1]), Math.abs(A.data[o + 2] - B.data[o + 2]));
    if (d > 0) {
      changed++; sum += d; if (d > max) max = d;
      if (mask) { mask[i * 3] = 255; mask[i * 3 + 2] = 255; }
    }
  }
  if (mask && changed) await sharp(mask, { raw: { width: A.w, height: A.h, channels: 3 } }).png().toFile(outPath);
  return { changed, meanDelta: changed ? +(sum / changed).toFixed(1) : 0, total: sum, maxDelta: max };
}

const [sx, sy] = STATION.split(':').map(Number);
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const loads = [];
let census = null;
for (let load = 0; load < LOADS; load++) {
  const dir = `${OUT}/load${load}`;
  await mkdir(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=${sx}&py=${sy}&fogRadius=${FOG}&simSpeed=0.02&pointerLock=0`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
  await page.waitForTimeout(1500);

  let nvfx = 0;
  if (VFX) { nvfx = await page.evaluate(`(${SPAWN_VFX})(${sx}, ${sy})`); await page.waitForTimeout(400); }
  const found = await page.evaluate(`(${FIND})()`);
  const targets = found.filter((g) => !ONLY || g.name === ONLY);
  if (load === 0) {
    census = found;
    console.log(`\nTRANSPARENT DEPTH-WRITERS IN THE LIVE SCENE: ${found.length}`);
    console.log('   #  material              meshes drawn  opacity  rOrd   world y');
    for (const g of found) console.log(`  ${String(g.i).padStart(2)}  ${g.name.slice(0, 20).padEnd(20)} ${String(g.meshes).padStart(6)} ${String(g.drawn).padStart(5)} ${String(g.opacity).padStart(8)} ${String(g.renderOrder).padStart(5)}   ${g.yMin} .. ${g.yMax}  ${g.objNames}`);
    console.log(`  probing ${targets.length}${ONLY ? ` (--only ${ONLY})` : ''}, ref arm = ${REF}`);
  }

  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  await page.waitForTimeout(300);
  const canvas = page.locator('canvas').first();
  const shot = async (file, i, dw, ro, mag) => {
    await page.evaluate(`(${SET})(${i}, ${dw}, ${ro === null ? 'null' : ro}, ${!!mag})`);
    await page.waitForTimeout(120);
    await canvas.screenshot({ path: file, timeout: 90000 });
  };

  const rows = [];
  for (const g of targets) {
    const tag = g.name.replace(/[^A-Za-z0-9]+/g, '_') + '_' + g.i;
    const f = (s) => `${dir}/${tag}_${s}.png`;
    // Every arm is bracketed by THIS block's own baseline / self-pair / drift. Nothing is
    // compared across blocks — gl_occl_ab found the frame drifting under a frozen rAF at
    // the pot station, unattributed and therefore controlled for rather than assumed away.
    await shot(f('a'), g.i, true, null, false);
    await shot(f('a2'), g.i, true, null, false);
    for (const A of ARMS.slice(1)) await shot(f(A.id), g.i, A.dw, A.ro, false);
    await shot(f('mag'), g.i, true, null, true);
    await shot(f('ret'), g.i, true, null, false);
    const arms = {};
    for (const A of ARMS) arms[A.id] = await diff(f('a'), f(A.id), A.id === 'a' ? null : `${dir}/${tag}_mask_${A.id}.png`);
    const vsRef = {};
    for (const A of ARMS) vsRef[A.id] = await diff(f(A.id), f(REF), null);
    rows.push({
      g, tag,
      self: await diff(f('a'), f('a2'), null),
      drift: await diff(f('a'), f('ret'), null),
      abl: await diff(f('a'), f('mag'), null),
      arms, vsRef,
      c3vc8: await diff(f('c3'), f('c8'), `${dir}/${tag}_mask_c3_vs_c8.png`),
    });
  }
  await page.close();
  loads.push({ load, dir, nvfx, rows });
}
await browser.close();

console.log(`\nARMS  (${W}x${H} = ${(W * H).toLocaleString()} px, exact diff; "d" = SUMMED channel delta, the verdict quantity)`);
for (const A of ARMS) console.log(`    ${A.id.padEnd(4)} dw ${String(A.dw).padEnd(5)} ro ${A.ro === null ? 'orig' : String(A.ro).padEnd(4)}   ${A.note}`);
for (const L of loads) {
  console.log(`\n  load ${L.load}${VFX ? `  (${L.nvfx} VFX spawned)` : ''}${'   station ' + STATION}`);
  console.log(`    material            #  self drift ablation  ${ARMS.slice(1).map((A) => (A.id + ' vs a').padStart(15)).join('')}   ${('dist to ' + REF).padStart(46)}`);
  for (const r of L.rows) {
    const cell = (d) => `${String(d.changed).padStart(7)}px d${String(d.total).padStart(6)}`;
    const dist = ARMS.filter((A) => A.id !== REF).map((A) => `${A.id}:${r.vsRef[A.id].total}`).join(' ');
    const blind = r.abl.changed === 0 ? '  ⚠️ BLIND — draws nothing in this frame' : '';
    console.log(`    ${r.g.name.slice(0, 18).padEnd(18)} ${String(r.g.i).padStart(2)} ${String(r.self.changed).padStart(5)} ${String(r.drift.changed).padStart(5)} ${String(r.abl.changed).padStart(8)}  ${ARMS.slice(1).map((A) => cell(r.arms[A.id])).join('')}   ${dist.padStart(46)}${blind}`);
  }
  console.log(`\n    c3 vs c8 — can this station tell the two candidate orders apart at all?`);
  for (const r of L.rows) console.log(`      ${r.g.name.slice(0, 18).padEnd(18)} ${String(r.g.i).padStart(2)}  ${String(r.c3vc8.changed).padStart(7)} px  summed ${String(r.c3vc8.total).padStart(7)}  maxD ${String(r.c3vc8.maxDelta).padStart(3)}  drift ${r.drift.total}${r.c3vc8.total <= r.drift.total ? '   INDISTINGUISHABLE at or under this block\'s drift floor' : ''}`);
}

let fail = 0;
const ok = (nm, cond, got) => { if (cond) console.log(`  ok   ${nm}`); else { fail++; console.log(`  FAIL ${nm}   got ${got}`); } };
const every = (f) => loads.every((L) => L.rows.every(f));
console.log('\nCHECKS');
ok('the census found something to probe', census && census.length > 0, census ? census.length : 0);
ok('every block\'s self-pair is 0 px — "no change" is distinguishable from "cannot see change"', every((r) => r.self.changed === 0), loads.flatMap((L) => L.rows.map((r) => r.self.changed)).join(','));
ok('every block\'s RETURN drift is at or under its self-pair + 32 summed — the arms are comparable', every((r) => r.drift.total <= r.self.total + 32), loads.flatMap((L) => L.rows.map((r) => r.drift.total)).join(','));
ok('arm a is its own baseline and reads exactly 0 — the diff is wired to the arm it names', every((r) => r.arms.a.changed === 0 && r.arms.a.total === 0), '');
ok('at least one probed material moved the frame under ablation (the rest are labelled BLIND)', loads.some((L) => L.rows.some((r) => r.abl.changed > 0)), '');
console.log(`\nhw_ord  ${5 - fail}/5`);
console.log(`\nwrote ${OUT}/load*/`);
process.exit(fail ? 1 : 0);
