#!/usr/bin/env node
/**
 * WHAT DOES EACH TRANSPARENT DEPTH-WRITER ACTUALLY COST? — the class sweep with a
 * DELIVERED-PIXEL measurement attached to every hit.
 *
 * `tools/tmp/hc_occluders.mjs` answers "which materials are authored wrong". It is a
 * static predicate over the scene graph and it is the right gate. It cannot answer the
 * question that decides what to DO about each hit, which is: how many pixels does this
 * particular depth write bury, and does clearing the flag move the frame TOWARD a
 * correct render or away from one? Both halves turned out to matter — see the dust.
 *
 * ── THREE ARMS, BECAUSE TWO GIVE THE WRONG ANSWER ───────────────────────────
 * A transparent surface that writes depth hard-REJECTS whatever is drawn after it and
 * behind it. Clearing `depthWrite` is the obvious fix and it is only half of one,
 * because the draw ORDER is a separate decision: `renderOrder` dominates three's
 * back-to-front distance sort, so a surface parked at `renderOrder 0` is drawn FIRST in
 * the transparent pass and, once it no longer writes depth, is simply PAINTED OVER by
 * every later transparent surface — including ones physically behind it.
 *
 *   a1  shipped                                  transparent + depthWrite:true
 *   b   depthWrite:false, renderOrder unchanged   the naive fix
 *   c   depthWrite:false + renderOrder above the whole ground stack
 *
 * `c` is the arm that is correct with respect to the ground stack: it blends instead of
 * rejecting AND it keeps the right z-order. Whichever of `a1`/`b` is closer to `c` is
 * the one to keep, and that is a pixel count rather than an opinion.
 *
 * ── THE CONTROLS, AND WHY EACH ONE IS LOAD-BEARING ──────────────────────────
 * One page load, `requestAnimationFrame` frozen (the technique `tier_colour.mjs` uses
 * and `render/quality.ts` documents), so the ONLY thing that may change the frame is the
 * flag under test. Then, per material:
 *
 *   SELF-PAIR    two captures with nothing touched — must be 0 differing pixels. An
 *                instrument that cannot tell "no change" from "cannot see change" makes
 *                every null result below worthless.
 *   RETURN       the flag put back — must be 0 vs a1, or the arms are not comparable.
 *   ABLATION     the material forced to #FF00FF at opacity 1 — the frame must MOVE.
 *                `docs/LESSONS.md` §1's twentieth case: a convincing render is not
 *                evidence the thing renders. ⚠️ **A material whose ablation delivers 0
 *                pixels is BLIND, not innocent** — it draws nothing in this frame, so
 *                its 0 px answer says nothing at all, and it is labelled BLIND.
 *
 * ⚠️ The arena's dust field is seeded from an UNSEEDED `Math.random()`
 * (`src/arena/apron.ts` records it as this harness's known noise floor), so a two-page-
 * load A/B of anything near it cannot work. Everything here is same-page, same frozen
 * frame, one flag. `--loads N` repeats the whole experiment on fresh loads, which is how
 * the seed's spread gets reported instead of one draw being quoted as the answer.
 *
 * `--vfx` fires a spread of ground VFX through `window.__vfxSpawnTest` before the
 * freeze. Those decals are the largest transparent surfaces the game ever puts on the
 * floor and are exactly what a depth write can punch a hole in, so this is the
 * WORST-CASE arm, not the typical one.
 *
 *   node tools/tmp/headserve.mjs -- node tools/tmp/gl_occl_ab.mjs --loads 3 --vfx
 *   node tools/tmp/gl_occl_ab.mjs --url <snapshot> --only kpal:dust --out shots/gl/x
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const has = (k) => process.argv.includes('--' + k);
const BASE = arg('url', process.env.PREVIEW_BASE ?? 'http://localhost:5173');
const OUT = arg('out', 'shots/gl/occl');
const STATION = arg('station', '560:900');
const FOG = arg('fog', '993');
const LOADS = Number(arg('loads', '1'));
const ONLY = arg('only', null);
const VFX = has('vfx');
/** The `c` arm's renderOrder. 8 clears every GROUND transparent in the live census
 *  (puddle halo 1.0, body 1.2, surf 1.4, wet rim 1.6, contact decal 2, hazard glow 2,
 *  VFX rings up to 6, fog curtain 6/7) and stays under the airborne sprites at 10/11. */
const ORD = Number(arg('ord', '8'));
const W = 1600, H = 900;

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;

/**
 * Every transparent depth-writing MATERIAL in the live scene, grouped by material
 * identity — not by mesh. The material is what carries the defect and what a fix would
 * edit, and several of these are shared across meshes (`M.chalk` draws three chalkboard
 * lines, `kpal:dust` one instanced field of 40).
 */
const FIND = `() => {
  const st = window.__stage; st.scene.updateMatrixWorld(true);
  const byMat = new Map();
  st.scene.traverse((o) => {
    if (!(o.isMesh || o.isInstancedMesh || o.isSprite) || !o.visible) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || m.transparent !== true || m.depthWrite !== true) continue;
      let g = byMat.get(m.uuid);
      if (!g) { g = { mat: m, objs: [], name: m.name || m.type, type: m.type }; byMat.set(m.uuid, g); }
      g.objs.push(o);
    }
  });
  window.__glGroups = [...byMat.values()];
  return window.__glGroups.map((g, i) => {
    // Saved BEFORE anything is touched. Several of these opacities are animated per
    // frame (steam, hazard wisps), so this is the frozen value, not an authored one —
    // never read a pooled/animated material's "initial" state after the fact.
    // See the note above SET: the colour is saved as a CLONE, never as a hex integer.
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
    return { i, name: g.name, type: g.type, meshes: g.objs.length, drawn: n,
             opacity: +g.mat.opacity.toFixed(3), renderOrder: g.objs[0].renderOrder,
             yMin: +lo.toFixed(3), yMax: +hi.toFixed(3),
             objNames: [...new Set(g.objs.map((o) => o.name || '(unnamed)'))].slice(0, 3).join(',') };
  });
}`;

/**
 * Drives exactly one group, one knob at a time. Nothing else in the page is touched.
 *
 * ⚠️ THE COLOUR IS RESTORED FROM A CLONE, NEVER FROM A HEX INTEGER. `getHex()` /
 * `setHex()` round-trip through 8-bit sRGB while three stores colour in the LINEAR
 * working space, so hex is lossy. The first version saved/restored hex and left the
 * frame 28 px away from baseline at maxD 1 — a pure quantisation artefact that was
 * printed as `kpal:chalk`'s occlusion cost, identically on all three loads, which is
 * exactly what a real finding looks like. The RETURN control is what caught it.
 */
const SET = `(i, mode, ord) => {
  const g = window.__glGroups[i], m = g.mat, s = g.saved;
  const mag = mode === 'mag' || mode === 'magOff';
  if (m.color) { if (mag) m.color.setHex(0xFF00FF); else m.color.copy(s.color); }
  m.opacity = mag ? 1 : s.opacity;
  m.depthWrite = (mode === 'off' || mode === 'magOff' || mode === 'ord') ? false : s.depthWrite;
  g.objs.forEach((o, k) => { o.renderOrder = mode === 'ord' ? ord : s.renderOrder[k]; });
  m.needsUpdate = true;
  window.__stage.render(0);
}`;

/** Worst-case arm: paint the floor around the fighter with the biggest transparent
 *  surfaces the game owns. Fired BEFORE the freeze so the effects are built and alive. */
const SPAWN_VFX = `(cx, cy) => {
  const f = window.__vfxSpawnTest; if (!f) return 0;
  let n = 0;
  for (const [dx, dy] of [[0,0],[70,0],[-70,0],[0,70],[0,-70],[50,50],[-50,50],[50,-50],[-50,-50]]) { f('impact', cx + dx, cy + dy, 18, '#FFC93C'); n++; }
  f('giantSlam', cx, cy, 18, '#FFC93C'); n++;
  f('meleeArc', cx, cy, 18, '#FFC93C'); n++;
  f('death', cx + 90, cy + 90, 18, '#FFC93C'); n++;
  return n;
}`;

async function raw(p) {
  const { data, info } = await sharp(p).raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, ch: info.channels };
}
/** Differing-pixel count. Deliberately EXACT (any channel differing at all): the whole
 *  point is delivered pixels, and a tolerance here would hide the answer. */
async function diff(pa, pb, outPath) {
  const A = await raw(pa), B = await raw(pb);
  const n = A.w * A.h;
  const mask = outPath ? Buffer.alloc(n * 3) : null;
  let changed = 0, sum = 0, max = 0, x0 = A.w, x1 = -1, y0 = A.h, y1 = -1;
  for (let i = 0; i < n; i++) {
    const o = i * A.ch;
    const d = Math.max(Math.abs(A.data[o] - B.data[o]), Math.abs(A.data[o + 1] - B.data[o + 1]), Math.abs(A.data[o + 2] - B.data[o + 2]));
    if (d > 0) {
      changed++; sum += d; if (d > max) max = d;
      const x = i % A.w, y = (i / A.w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (mask) { mask[i * 3] = 255; mask[i * 3 + 2] = 255; }
    }
  }
  if (mask && changed) await sharp(mask, { raw: { width: A.w, height: A.h, channels: 3 } }).png().toFile(outPath);
  // ⚠️ `total` (the summed absolute channel delta), not `changed`, is what the verdict
  // compares. Counting differing pixels conflates a 183-level change with a 1-level one
  // and gets the answer backwards: `hazard:wisp#5` reads 1067 px shipped-vs-flag-only
  // and 1173 px flag-only-vs-correct, which by COUNT says the flag barely helps — while
  // the mean deltas are 88.6 and 3.0, i.e. the flag is the entire effect and the
  // renderOrder is a rounding-level refinement. Count says where; total says how much.
  return { changed, pct: +(100 * changed / n).toFixed(4), meanDelta: changed ? +(sum / changed).toFixed(1) : 0,
           total: sum, maxDelta: max, bbox: changed ? [x0, y0, x1, y1] : null };
}

const [sx, sy] = STATION.split(':').map(Number);
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const loads = [];
let groups = null;
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
    groups = found;
    console.log(`\nTHE CLASS, as it is in the running scene: ${found.length} transparent depth-writing materials`);
    console.log('  #  material              type                meshes drawn  opacity  rOrd   world y            objects');
    for (const g of found) {
      console.log(`  ${String(g.i).padStart(2)}  ${g.name.slice(0, 20).padEnd(20)} ${g.type.padEnd(19)} ${String(g.meshes).padStart(6)} ${String(g.drawn).padStart(5)} ${String(g.opacity).padStart(8)} ${String(g.renderOrder).padStart(5)}   ${(g.yMin + ' .. ' + g.yMax).padEnd(18)} ${g.objNames}`);
    }
    if (ONLY) console.log(`  (--only ${ONLY}: probing ${targets.length} of them)`);
  }

  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  await page.waitForTimeout(300);
  const canvas = page.locator('canvas').first();
  const shot = async (name, i, mode) => {
    await page.evaluate(`(${SET})(${i}, '${mode}', ${ORD})`);
    await page.waitForTimeout(120);
    await canvas.screenshot({ path: `${dir}/${name}.png`, timeout: 90000 });
  };
  // ⚠️ EVERY MATERIAL GETS ITS OWN ADJACENT BASELINE, and that is not tidiness.
  // A first version diffed all twelve materials against ONE baseline taken at the top of
  // the run, and its RETURN control failed with a residue that GREW monotonically down
  // the list — 70, 93, 130, 344, 386, 435... at the pot station while reading a clean 0
  // at the grease station. Restoring the flag was exact (proved below: `drift` is
  // measured with the flag already back), so the residue is the FRAME drifting under a
  // frozen `requestAnimationFrame`, not a leak from this tool — and the cause is
  // something on screen at the pot and not at the grease puddle. Unattributed, and
  // therefore CONTROLLED FOR rather than assumed away: each material is bracketed by its
  // own base/base2 self-pair and its own return, and nothing below is compared across
  // blocks. `drift` is that block's noise floor, and a cost at or under it is not a cost.
  const rows = [];
  for (const g of targets) {
    const tag = g.name.replace(/[^A-Za-z0-9]+/g, '_') + '_' + g.i;
    await shot(`${tag}_base`, g.i, 'on');
    await shot(`${tag}_base2`, g.i, 'on');
    await shot(`${tag}_b`, g.i, 'off');
    await shot(`${tag}_c`, g.i, 'ord');
    await shot(`${tag}_m1`, g.i, 'mag');
    await shot(`${tag}_m2`, g.i, 'magOff');
    await shot(`${tag}_ret`, g.i, 'on');
    const B = `${dir}/${tag}_base.png`;
    rows.push({
      g,
      self: await diff(B, `${dir}/${tag}_base2.png`, null),
      drift: await diff(B, `${dir}/${tag}_ret.png`, `${dir}/${tag}_mask_drift.png`),
      abl: await diff(B, `${dir}/${tag}_m1.png`, null),
      flag: await diff(B, `${dir}/${tag}_b.png`, `${dir}/${tag}_mask_flag.png`),
      aVc: await diff(B, `${dir}/${tag}_c.png`, `${dir}/${tag}_mask_a_vs_c.png`),
      bVc: await diff(`${dir}/${tag}_b.png`, `${dir}/${tag}_c.png`, `${dir}/${tag}_mask_b_vs_c.png`),
    });
  }
  await page.close();
  loads.push({ load, dir, nvfx, rows });
}
await browser.close();

console.log(`\nDELIVERED PIXELS  (${W}x${H} = ${(W * H).toLocaleString()} px; exact — any channel differing by >=1)${VFX ? '   [--vfx WORST CASE]' : ''}`);
for (const L of loads) {
  console.log(`\n  load ${L.load}${VFX ? `  (${L.nvfx} VFX spawned)` : ''}`);
  console.log('    material            #  self  drift  ablation   FLAG-ONLY cost           base-vs-c      b-vs-c    verdict');
  for (const r of L.rows) {
    // Every claim below is made against THIS block's own drift floor, never against 0,
    // and the verdict compares SUMMED delta, not pixel counts. See `diff`.
    const v = r.abl.changed === 0 ? 'BLIND — draws nothing in this frame'
      : r.flag.total <= r.drift.total ? 'no cost above this block\'s drift floor'
        : r.aVc.total === r.bVc.total ? 'tie'
          : r.aVc.total < r.bVc.total ? 'SHIPPED is closer to correct' : 'clearing the flag is closer';
    const cell = (d) => `${String(d.changed).padStart(6)}px x${String(d.meanDelta).padStart(5)}`;
    console.log(`    ${r.g.name.slice(0, 18).padEnd(18)} ${String(r.g.i).padStart(2)} ${String(r.self.changed).padStart(5)} ${String(r.drift.changed).padStart(6)} ${String(r.abl.changed).padStart(9)}  ${cell(r.flag)} maxD ${String(r.flag.maxDelta).padStart(3)}  ${cell(r.aVc)} ${cell(r.bVc)}   ${v}`);
  }
}

if (LOADS > 1) {
  console.log('\nACROSS LOADS — flag-only cost vs that block\'s drift floor');
  const keys = [...new Set(loads.flatMap((L) => L.rows.map((r) => r.g.name + '#' + r.g.i)))];
  for (const k of keys) {
    const rs = loads.map((L) => L.rows.find((r) => r.g.name + '#' + r.g.i === k)).filter(Boolean);
    const f = rs.map((r) => r.flag.changed), d = rs.map((r) => r.drift.changed);
    const t = rs.map((r) => r.flag.total);
    const nBlind = rs.filter((r) => r.abl.changed === 0).length;
    const over = rs.filter((r) => r.abl.changed > 0 && r.flag.total > r.drift.total).length;
    console.log(`  ${k.padEnd(24)} flag px ${f.join(',').padEnd(14)} summed delta ${t.join(',').padEnd(16)} drift ${d.join(',').padEnd(8)} ${over}/${rs.length} above floor${nBlind ? `, ${nBlind} BLIND` : ''}`);
  }
}

let fail = 0;
const ok = (nm, cond, got) => { if (cond) console.log(`  ok   ${nm}`); else { fail++; console.log(`  FAIL ${nm}   got ${got}`); } };
const every = (f) => loads.every((L) => L.rows.every(f));
console.log('\nCHECKS');
ok('the sweep found something to probe', groups && groups.length > 0, groups ? groups.length : 0);
ok('every block\'s self-pair is 0 — "no change" is distinguishable from "cannot see change"', every((r) => r.self.changed === 0), loads.flatMap((L) => L.rows.map((r) => r.self.changed)).join(','));
ok('every block states a drift floor, and no claim is made under it', true, '');
ok('every material is either ABLATION-POSITIVE or explicitly labelled BLIND', true, '');
ok('at least one material moved the frame under ablation', loads.some((L) => L.rows.some((r) => r.abl.changed > 0)), '');
console.log(`\ngl_occl_ab  ${5 - fail}/5`);
console.log(`\nwrote ${OUT}/load*/`);
process.exit(fail ? 1 : 0);
