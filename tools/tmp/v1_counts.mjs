#!/usr/bin/env node
/**
 * V1_COUNTS — draw calls, triangles and the SHADOW-CASTER census, at 2 and 6 fighters.
 *
 * ## Why this exists rather than `tools/perf.mjs --mode counts`
 *
 * `perf.mjs` is the validated draw-call instrument and this file does not replace it —
 * run both. But `perf.mjs`'s scene table is a fixed list of URLs and the shipped match
 * entry is 1v1, so it cannot express *"and now the same frame at six fighters"*, which
 * is the seat count `docs/HANDOVER.md` calls this project's dominant defect class. It
 * also reports draw calls and triangles and has nothing to say about **which meshes are
 * in the shadow pass**, which is the quantity item 1 of this round actually moves.
 *
 * ## 🚨 THE NUMBER THIS ROUND IS TEMPTED TO QUOTE IS THE WRONG ONE
 *
 * `src/arena/floor.ts` draws its whole ground-debris field as **two `InstancedMesh`es**.
 * So cutting 80% of the chips cannot save 80% of anything a draw-call counter can see:
 * two instanced meshes are two draws whether they hold 7,000 instances or 700, and
 * clearing `castShadow` removes exactly **two more** from the shadow pass. A report that
 * leads with "draw calls fell" is describing a rounding error.
 *
 * What actually moves is **shadow-pass geometry**: every instance is re-transformed and
 * rasterised into the shadow map, so the cost is `instances x triangles`, and that is
 * the column this tool exists to print. Draw calls are printed beside it precisely so
 * the small number is visible rather than quietly omitted.
 *
 * ## The counters, and where each comes from
 *
 *   drawCalls   GL-level, by wrapping `drawElements`/`drawArrays` and their instanced
 *               forms on both context prototypes. `renderer.info.render.calls` is NOT
 *               used: it resets at the start of every `renderer.render()` and the post
 *               chain calls that once per pass, so it reports the LAST pass, not the
 *               frame. (`perf.mjs` records the same finding; this is the same fix.)
 *   frameTris   GL-level triangles, same wrappers, instanced draws multiplied by their
 *               instance count.
 *   shadowTris  Scene-level: for every visible mesh with `castShadow`, its triangle
 *               count times its instance count. This is what the depth pass rasterises.
 *   casters     How many of those meshes there are, and how many INSTANCES they carry —
 *               the two are wildly different here and only the second is the cost.
 *
 * ## The known-bad, and why it is not vacuous
 *
 * `--known-bad` clears `castShadow` on the `ground_chip_*` meshes at runtime and
 * re-censuses. `shadowTris` MUST fall, and it must fall by exactly the chips' own
 * contribution. Without that arm every number below is satisfied by a traversal that
 * silently matched nothing — `[].reduce((a,b)=>a+b,0)` is `0`, which looks like a clean
 * frame. The census therefore also asserts, before anything else, that the mesh list is
 * NON-EMPTY and that at least one `ground_chip_*` mesh was found on the BEFORE tree.
 *
 * ⚠️ That last assertion is deliberately a WARNING, not a failure, because this tool is
 * run on the AFTER tree too and a round that deleted the layer outright would be a legal
 * outcome. It prints `chipMeshes` either way; a reader comparing two runs sees it.
 *
 * ## Use
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-v1-before -- \
 *     node tools/tmp/v1_counts.mjs --url '{URL}' --tag before --out tools/tmp/v1_counts_before.json
 *   node tools/tmp/v1_counts.mjs --selftest      # the arithmetic, no browser
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes('--' + k);

const BASE = String(arg('url', process.env.PREVIEW_BASE ?? 'http://localhost:5173')).replace(/\/$/, '');
const TAG = String(arg('tag', 'run'));
const OUT = arg('out', null);
const FRAMES = Number(arg('frames', 70));
const W = 1280, H = 720;
const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

// ─────────────────────────────────────────────────────────────────────────────
// page-side instrumentation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stage registry — lifted verbatim in spirit from `perf.mjs`. `window.__stage` is a
 * single slot and the LAST constructed stage wins, so on any menu route a probe reads
 * `thumbs.ts`'s disposed offscreen generator. Every route this tool visits is a match,
 * so it would work without this; it is here so the tool does not become wrong the day
 * someone points it at a menu.
 */
const INIT = `
window.__onScreen = function (stage) {
  const c = stage && stage.canvas;
  if (!c || !c.isConnected) return false;
  const r = c.getBoundingClientRect();
  return r.width > 1 && r.height > 1 && r.right > 0 && r.bottom > 0 &&
         r.left < window.innerWidth && r.top < window.innerHeight;
};
(function () {
  const stages = [];
  window.__stages = stages;
  Object.defineProperty(window, '__stage', {
    configurable: true,
    get() {
      const live = stages.filter((s) => !s.disposed);
      return live.filter(window.__onScreen).pop() || live.pop() || stages[stages.length - 1];
    },
    set(v) { if (v && !stages.includes(v)) stages.push(v); },
  });
})();
(function () {
  const P = { draws: 0, tris: 0 };
  window.__v1 = P;
  for (const name of ['WebGL2RenderingContext', 'WebGLRenderingContext']) {
    const K = window[name];
    if (!K) continue;
    const proto = K.prototype;
    const oDE = proto.drawElements, oDA = proto.drawArrays;
    proto.drawElements = function (mode, count, type, off) {
      P.draws++; if (mode === 4) P.tris += count / 3;
      return oDE.call(this, mode, count, type, off);
    };
    proto.drawArrays = function (mode, first, count) {
      P.draws++; if (mode === 4) P.tris += count / 3;
      return oDA.call(this, mode, first, count);
    };
    if (proto.drawElementsInstanced) {
      const o = proto.drawElementsInstanced;
      proto.drawElementsInstanced = function (mode, count, type, off, inst) {
        P.draws++; if (mode === 4) P.tris += (count / 3) * inst;
        return o.call(this, mode, count, type, off, inst);
      };
    }
    if (proto.drawArraysInstanced) {
      const o = proto.drawArraysInstanced;
      proto.drawArraysInstanced = function (mode, first, count, inst) {
        P.draws++; if (mode === 4) P.tris += (count / 3) * inst;
        return o.call(this, mode, first, count, inst);
      };
    }
  }
})();
`;

/** Scene-level shadow census. Returns raw rows; the verdict is computed in node. */
const CENSUS = `(() => {
  const st = window.__stage;
  if (!st || !st.scene) return { error: 'no stage' };
  const rows = [];
  let meshes = 0;
  st.scene.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    // Visibility is inherited; a hidden PARENT hides the mesh and it never reaches the
    // shadow pass. Checking only o.visible would count meshes that cost nothing.
    let p = o, vis = true;
    while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
    const g = o.geometry;
    const verts = g && g.index ? g.index.count : (g && g.attributes && g.attributes.position ? g.attributes.position.count : 0);
    const inst = o.isInstancedMesh ? o.count : 1;
    rows.push({
      name: o.name || '(unnamed)',
      cast: !!o.castShadow, receive: !!o.receiveShadow, visible: vis,
      instanced: !!o.isInstancedMesh, inst,
      tris: verts / 3,
    });
  });
  return { meshes, rows };
})()`;

const CLEAR_CHIP_SHADOWS = `(() => {
  let n = 0;
  window.__stage.scene.traverse((o) => {
    if (o.isMesh && String(o.name).startsWith('ground_chip') && o.castShadow) { o.castShadow = false; n++; }
  });
  return n;
})()`;

// ─────────────────────────────────────────────────────────────────────────────
// arithmetic (selftestable without a browser)
// ─────────────────────────────────────────────────────────────────────────────

/** Roll a census payload into totals. Every filter asserts its own input first. */
export function summarise(census) {
  if (census.error) throw new Error(`census: ${census.error}`);
  const rows = census.rows ?? [];
  if (rows.length === 0) throw new Error('census returned ZERO meshes — the traversal is blind, not the scene empty');
  const live = rows.filter((r) => r.visible);
  if (live.length === 0) throw new Error('census returned zero VISIBLE meshes — a filter over [] passes');
  const casters = live.filter((r) => r.cast);
  const chips = rows.filter((r) => r.name.startsWith('ground_chip'));
  const sum = (a, f) => a.reduce((t, r) => t + f(r), 0);
  return {
    meshes: rows.length,
    visibleMeshes: live.length,
    casterMeshes: casters.length,
    casterInstances: sum(casters, (r) => r.inst),
    shadowTris: Math.round(sum(casters, (r) => r.tris * r.inst)),
    chipMeshes: chips.length,
    chipInstances: sum(chips, (r) => r.inst),
    chipCasting: chips.filter((r) => r.cast).length,
    chipShadowTris: Math.round(sum(chips.filter((r) => r.cast), (r) => r.tris * r.inst)),
  };
}

export function stats(series) {
  if (!Array.isArray(series) || series.length === 0) throw new Error('empty series');
  const s = [...series].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
  return { n: s.length, min: s[0], median: q(0.5), mean: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2), max: s[s.length - 1] };
}

// ─────────────────────────────────────────────────────────────────────────────
// selftest — the arithmetic only. It does NOT validate where the tool is pointed.
// ─────────────────────────────────────────────────────────────────────────────
function selftest() {
  let pass = 0, fail = 0;
  const ck = (n, ok, d = '') => { if (ok) { pass++; console.log(`  ok   ${n}  ${d}`); } else { fail++; console.log(`  FAIL ${n}  ${d}`); } };

  // §A the vacuity guards fire
  let threw = false;
  try { summarise({ rows: [] }); } catch { threw = true; }
  ck('an EMPTY mesh list throws rather than reporting a clean frame', threw);
  threw = false;
  try { summarise({ rows: [{ name: 'x', cast: true, visible: false, inst: 1, tris: 10 }] }); } catch { threw = true; }
  ck('an all-INVISIBLE mesh list throws (a filter over [] passes)', threw);

  // §B instances multiply
  const c = {
    rows: [
      { name: 'ground_chip_pebble', cast: true, visible: true, instanced: true, inst: 1000, tris: 20 },
      { name: 'ground_chip_shard', cast: true, visible: true, instanced: true, inst: 500, tris: 4 },
      { name: 'counter_body', cast: true, visible: true, instanced: false, inst: 1, tris: 12 },
      { name: 'floor_tile', cast: false, visible: true, instanced: true, inst: 800, tris: 2 },
    ],
  };
  const s = summarise(c);
  ck('shadowTris multiplies instances', s.shadowTris === 1000 * 20 + 500 * 4 + 12, `${s.shadowTris}`);
  ck('casterInstances counts instances, not meshes', s.casterInstances === 1501, `${s.casterInstances}`);
  ck('casterMeshes counts meshes, not instances', s.casterMeshes === 3, `${s.casterMeshes}`);
  ck('chipInstances found', s.chipInstances === 1500, `${s.chipInstances}`);

  // §C KNOWN-BAD: clearing the chips must MOVE shadowTris. If the delta is zero the
  // census is not seeing the chips and every "after" number would be flattering.
  const cleared = JSON.parse(JSON.stringify(c));
  for (const r of cleared.rows) if (r.name.startsWith('ground_chip')) r.cast = false;
  const s2 = summarise(cleared);
  ck('KNOWN-BAD: clearing chip castShadow DROPS shadowTris', s2.shadowTris < s.shadowTris,
    `${s.shadowTris} -> ${s2.shadowTris}`);
  ck('KNOWN-BAD: it drops by EXACTLY the chips\' own contribution',
    s.shadowTris - s2.shadowTris === s.chipShadowTris, `${s.shadowTris - s2.shadowTris} vs ${s.chipShadowTris}`);
  ck('KNOWN-BAD: the non-chip casters are UNTOUCHED', s2.shadowTris === 12, `${s2.shadowTris}`);

  // §D a mesh whose PARENT is hidden is not a caster
  const hidden = { rows: [{ name: 'a', cast: true, visible: false, inst: 100, tris: 20 }, { name: 'b', cast: true, visible: true, inst: 1, tris: 3 }] };
  ck('an invisible caster contributes nothing', summarise(hidden).shadowTris === 3);

  // §E stats
  const st = stats([5, 1, 3, 9, 3]);
  ck('stats median/min/max', st.median === 3 && st.min === 1 && st.max === 9, JSON.stringify(st));

  console.log(`\n  ${pass} pass  ${fail} fail`);
  return fail === 0 ? 0 : 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// the run
// ─────────────────────────────────────────────────────────────────────────────

const RING = 190;
const ROSTER6 = ['hamburger', 'donut', 'taco', 'burrito', 'egg', 'lollipop'];

/** Six seats on a ring about the arena's OWN centre, read from the running game. */
function rosterParam(center, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push(`${ROSTER6[i]}@${Math.round(center.x + Math.cos(a) * RING)},${Math.round(center.y + Math.sin(a) * RING)}`);
  }
  return out.join(';');
}

async function openMatch(browser, url) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.addInitScript(INIT);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 120_000 });
  // The countdown is a real frame but it is not the frame a player spends the match in,
  // and `CLAUDE.md`'s vacuity list records a demo staged inside it "where nothing moves".
  await page.waitForFunction(
    () => document.querySelector('.hud-countdown')?.style.display === 'none', null, { timeout: 120_000 },
  ).catch(() => console.log('    (countdown selector never settled — measuring anyway)'));
  return page;
}

async function sample(page, frames) {
  const out = await page.evaluate(async (n) => {
    const P = window.__v1;
    const rows = [];
    let d = P.draws, t = P.tris;
    await new Promise((res) => {
      let i = 0;
      const tick = () => {
        rows.push([P.draws - d, P.tris - t]);
        d = P.draws; t = P.tris;
        if (++i >= n) return res();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return rows;
  }, frames);
  // Drop the first five: the first delta spans everything since page load, and the next
  // few carry the shadow map's first full build.
  const body = out.slice(5);
  return { draws: stats(body.map((r) => r[0])), tris: stats(body.map((r) => Math.round(r[1]))) };
}

async function main() {
  const browser = await chromium.launch({ args: LAUNCH });
  const report = { tag: TAG, base: BASE, viewport: { W, H }, frames: FRAMES, arms: {} };
  try {
    // Centre from the LIVE game, never typed — `np_nfighter.mjs`'s finding: a retyped
    // centre put a six-seat ring 1,077 wu into the NW quadrant and still passed.
    const p0 = await openMatch(browser, `${BASE}/?player=hamburger&enemy=donut&pointerLock=0&simSpeed=1`);
    const arena = await p0.evaluate(() => ({ ...window.__matchArena.center }));
    if (!Number.isFinite(arena.x)) throw new Error('could not read window.__matchArena.center');
    console.log(`  arena centre (live): (${arena.x}, ${arena.y})`);

    // ── ARM 1: the shipped 1v1 ────────────────────────────────────────────────
    console.log('\n── N=2 (the shipped match) ──');
    const s2 = await sample(p0, FRAMES);
    const c2 = summarise(await p0.evaluate(CENSUS));
    console.log(`  draws/frame  ${JSON.stringify(s2.draws)}`);
    console.log(`  tris/frame   ${JSON.stringify(s2.tris)}`);
    console.log(`  casters      ${c2.casterMeshes} meshes / ${c2.casterInstances} instances / ${c2.shadowTris} shadow tris`);
    console.log(`  chips        ${c2.chipMeshes} meshes / ${c2.chipInstances} instances / casting=${c2.chipCasting} / ${c2.chipShadowTris} shadow tris`);
    if (c2.chipMeshes === 0) console.log('  ⚠️  no ground_chip_* mesh found — either the layer is gone or the name changed');

    // ── the known-bad, on the live scene ──────────────────────────────────────
    const cleared = await p0.evaluate(CLEAR_CHIP_SHADOWS);
    const c2b = summarise(await p0.evaluate(CENSUS));
    const kbOk = c2.chipShadowTris === 0
      ? c2b.shadowTris === c2.shadowTris
      : c2b.shadowTris === c2.shadowTris - c2.chipShadowTris && c2b.shadowTris < c2.shadowTris;
    console.log(`  KNOWN-BAD    cleared castShadow on ${cleared} chip mesh(es): shadowTris ${c2.shadowTris} -> ${c2b.shadowTris}  ${kbOk ? 'OK' : 'FAILED — the census cannot see the chips'}`);
    report.knownBad = { clearedMeshes: cleared, before: c2.shadowTris, after: c2b.shadowTris, ok: kbOk };
    await p0.close();

    // ── ARM 2: six seats ──────────────────────────────────────────────────────
    console.log('\n── N=6 ──');
    const url6 = `${BASE}/?fighters=${encodeURIComponent(rosterParam(arena, 6))}&fogRadius=900&pointerLock=0&simSpeed=1`;
    const p6 = await openMatch(browser, url6);
    const seats = await p6.evaluate(() => window.__vfxDebugFighters?.slots?.length ?? null);
    if (seats !== 6) console.log(`  ⚠️  the page reports ${seats} seats, not 6 — the N=6 arm is NOT six fighters`);
    else console.log('  seats: 6 (confirmed page-side, not assumed from the URL)');
    const s6 = await sample(p6, FRAMES);
    const c6 = summarise(await p6.evaluate(CENSUS));
    console.log(`  draws/frame  ${JSON.stringify(s6.draws)}`);
    console.log(`  tris/frame   ${JSON.stringify(s6.tris)}`);
    console.log(`  casters      ${c6.casterMeshes} meshes / ${c6.casterInstances} instances / ${c6.shadowTris} shadow tris`);
    console.log(`  chips        ${c6.chipMeshes} meshes / ${c6.chipInstances} instances / casting=${c6.chipCasting} / ${c6.chipShadowTris} shadow tris`);
    await p6.close();

    report.arms = { n2: { seats: 2, ...s2, census: c2 }, n6: { seats, ...s6, census: c6 } };
  } finally {
    await browser.close();
  }
  if (OUT) {
    mkdirSync(dirname(resolve(OUT)), { recursive: true });
    writeFileSync(resolve(OUT), JSON.stringify(report, null, 2));
    console.log(`\n  wrote ${OUT}`);
  }
  return report.knownBad?.ok === false ? 1 : 0;
}

if (has('selftest')) process.exit(selftest());
else process.exit(await main());
