#!/usr/bin/env node
/**
 * DP_AB — price `ContactAOEffect` and the vignette on ONE FROZEN FRAME.
 *
 * Every row below is a live uniform write on the SAME rendered frame, so no row can be
 * content drift: the sim is frozen, rAF is stopped, CSS animations are paused, camera
 * shake is zeroed, and the run opens and closes with a self-pair that must be
 * BIT-IDENTICAL. If it is not, nothing in the table is a measurement.
 *
 * ── WHAT IT SEPARATES, AND WHY A WHOLE-FRAME NUMBER CANNOT ─────────────────────────
 *
 * A depth AO has exactly two failure modes and they move the same headline number in
 * the same direction:
 *
 *   CONTACT   darkening in a band just outside a standing object's silhouette. This is
 *             the thing Uri asked for ("objects darken where they meet the floor").
 *   ACNE      darkening on thin creases the eye reads as ink — here, the floor's own
 *             tile seams. `stage.ts` has paid for this once already: the previous SSAO
 *             revival grew "a heavy black speckled fringe" on every grout line.
 *
 * Both raise "share of pixels below V 0.45". So the tool separates them GEOMETRICALLY,
 * off the delta between the ablated and the live frame:
 *
 *   deltaMean   mean darkening over the whole frame, 0..255
 *   darkShare   share of the frame that darkened by more than 2 codes. This is the arm
 *               that can FALSIFY the design rather than tune it: the estimator claims
 *               to be exactly zero on a plane at any tilt, and the frame is ~60% open
 *               floor, so a `darkShare` heading toward 1 would mean the plane-
 *               invariance is not real and the pass is dimming the ground — which is
 *               the specific defect that scored this element 3/10 last time.
 *   thinShare   share of the darkened pixels that sit on a THIN structure — measured by
 *               a 3x3 morphological erosion of the darkened mask. A 1-2 px grout line
 *               erodes to nothing; a contact band around a barrel does not. So
 *               `thinShare` near 1 is an ink pass and near 0 is a contact pass.
 *
 * ⚠️ NEITHER NUMBER CAN SEE WHAT A CROP CAN. The tool writes a full screenshot per row
 * and the calling agent is expected to READ them (`docs/AGENT-BRIEF.md` §4.1). The
 * first sweep this tool ran had a perfectly healthy table and grout lines that had
 * turned to ink.
 *
 * ── VALIDATION (CLAUDE.md rule 6) ─────────────────────────────────────────────────
 *
 *   §S1  the self-pair, twice, top and tail — bit-identical or the run is void.
 *   §S2  ablation by `intensity = 0` must move the frame. If it does not, the effect is
 *        inert and every row is a false zero. ⚠️ Ablating by `blendMode.opacity` is
 *        REFUSED by name: this effect is on `BlendFunction.SRC`, whose shader is
 *        `return src;` and never reads opacity, so that recipe is a guaranteed zero.
 *   §S3  the known-bad: `intensity = 4, radius = 1.2` must move a LOT more than
 *        shipped. An arm that only ever says "yes it moved" cannot see a knob that
 *        moved the wrong way.
 *   §S4  every filtered set is asserted NON-EMPTY before a mean is taken over it, and
 *        the subject is asserted in frame.
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-dp-B -- \
 *     node tools/tmp/dp_ab.mjs --url '{URL}' --out tools/tmp/dp_sweep
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = (get('--url', null) ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173').replace(/\/$/, '');
const OUT = get('--out', 'tools/tmp/dp_sweep');
const STATION = get('--station', 'hub');

// The rows. `null` for a knob means "leave it at the shipped value".
const ROWS = [
  { id: 'shipped', ao: {} },
  { id: 'ablated', ao: { intensity: 0 } },
  { id: 'r.75_b.44', ao: { radius: 0.75, bias: 0.44 } },
  { id: 'r.60_b.55', ao: { radius: 0.60, bias: 0.55 } },
  { id: 'r.45_b.73', ao: { radius: 0.45, bias: 0.73 } },
  { id: 'r.60_i1.3', ao: { radius: 0.60, bias: 0.55, intensity: 1.3 } },
  { id: 'r.45_i1.5', ao: { radius: 0.45, bias: 0.73, intensity: 1.5 } },
  { id: 'r.75_i1.2', ao: { radius: 0.75, bias: 0.44, intensity: 1.2 } },
  { id: 'KNOWNBAD', ao: { intensity: 4, radius: 1.2, bias: 0 } },
  { id: 'shipped2', ao: {} },
];

const PAGE_SRC = String.raw`
window.__dpab = (() => {
  const st = window.__stage;
  if (!st) throw new Error('no Stage on this route');
  const gl = st.renderer.getContext(), cv = st.renderer.domElement;
  const W = cv.width, H = cv.height;
  st.renderer.info.autoReset = false;
  const read = () => { const p = new Uint8Array(W*H*4); gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,p); return p; };
  const shot = () => { st.renderer.info.reset(); st.render(1/60); return read(); };
  const V = (p,i) => Math.max(p[i], Math.max(p[i+1], p[i+2])) / 255;
  return {
    st, W, H, shot,
    counts: () => { st.renderer.info.reset(); st.render(1/60); const r = st.renderer.info.render;
      return { draws: r.calls, tris: r.triangles }; },
    /** Bit difference, and the DARKENING delta (positive where B is darker than A). */
    delta(A, B) {
      let sum = 0, n = 0, mx = 0, hit = 0;
      const mask = new Uint8Array(W*H);
      for (let p = 0, i = 0; p < W*H; p++, i += 4) {
        const la = 0.2126*A[i] + 0.7152*A[i+1] + 0.0722*A[i+2];
        const lb = 0.2126*B[i] + 0.7152*B[i+1] + 0.0722*B[i+2];
        const d = la - lb;                        // > 0 means B is DARKER
        if (d > mx) mx = d;
        if (d > 2) { mask[p] = 1; hit++; }
        sum += Math.max(0, d); n++;
      }
      // 3x3 erosion: a pixel survives only if all 8 neighbours are also darkened. A
      // 1-2 px ink line does not survive; a contact band does.
      let thick = 0;
      for (let y = 1; y < H-1; y++) for (let x = 1; x < W-1; x++) {
        const p = y*W + x;
        if (!mask[p]) continue;
        if (mask[p-1] && mask[p+1] && mask[p-W] && mask[p+W]
          && mask[p-W-1] && mask[p-W+1] && mask[p+W-1] && mask[p+W+1]) thick++;
      }
      return { deltaMean: sum/n, deltaMax: mx, darkShare: hit/n,
               thinShare: hit ? 1 - thick/hit : null, nDark: hit };
    },
    /** Percentile of HSV V and the sub-0.45 share over a horizontal band. */
    band(px, y0, y1) {
      const s0 = Math.max(0, Math.round(y0*H)), s1 = Math.min(H, Math.round(y1*H));
      const r0 = H - s1, r1 = H - s0;             // gl.readPixels is bottom-up
      if (r1 <= r0) return { n: 0 };
      const hist = new Float64Array(256);
      let n = 0, below = 0, lSum = 0, cSum = 0, sSum = 0;
      for (let y = r0; y < r1; y++) for (let x = 0; x < W; x++) {
        const i = (y*W + x)*4;
        const r = px[i], g = px[i+1], b = px[i+2];
        const mx2 = r>g ? (r>b?r:b) : (g>b?g:b), mn = r<g ? (r<b?r:b) : (g<b?g:b);
        hist[mx2]++; if (mx2/255 < 0.45) below++;
        lSum += (0.2126*r + 0.7152*g + 0.0722*b)/255;
        cSum += (mx2-mn)/255; sSum += mx2 === 0 ? 0 : (mx2-mn)/mx2;
        n++;
      }
      if (n === 0) return { n: 0 };
      let acc = 0, p10 = 1;
      for (let k = 0; k < 256; k++) { acc += hist[k]; if (acc >= 0.10*n) { p10 = k/255; break; } }
      return { n, vP10: p10, belowV45: below/n, meanLuma: lSum/n, meanChroma: cSum/n, meanSat: sSum/n };
    },
  };
})();
`;

async function main() {
  await mkdir(OUT, { recursive: true });
  const dump = JSON.parse(await readFile(new URL('../arena.gameplay.json', import.meta.url), 'utf8'));
  const fog = Math.ceil(dump.maxSafeRadius) + 1;
  const S = { hub: dump.spawns[4], spawn_sw: dump.spawns[0], spawn_ne: dump.spawns[2] }[STATION];
  if (!S) throw new Error(`unknown station ${STATION}`);

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const rows = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
    await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
    const q = new URLSearchParams({ player: 'hamburger', enemy: 'donut', px: String(S.x), py: String(S.y),
      fogRadius: String(fog), simSpeed: '0.01', pointerLock: '0' });
    await page.goto(`${BASE}/?${q}`, { waitUntil: 'networkidle', timeout: 90_000 });
    await page.waitForFunction('window.__gameReady === true', null, { timeout: 90_000 });
    await page.waitForFunction("document.querySelector('.hud-countdown')?.style.display === 'none'", null, { timeout: 90_000 }).catch(() => {});
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      for (const an of document.getAnimations()) { try { an.pause(); an.currentTime = 0; } catch { /* ignore */ } }
      window.requestAnimationFrame = () => 0;
    });
    await page.waitForTimeout(250);
    await page.evaluate(() => { const st = window.__stage; try { st.rig.shakeAmount = 0; st.rig.shakeOffset.set(0,0,0); st.rig.apply(); } catch { /* older rig */ } });
    await page.evaluate(PAGE_SRC);

    // §S4 — the subject must be in shot, and the effect must EXIST, before anything.
    const pre = await page.evaluate(() => {
      const st = window.__dpab.st;
      let decals = 0, inFrame = 0;
      st.scene.traverse((o) => {
        if ((o.name || '') !== 'contact:decal' || !o.visible) return;
        decals++;
        const v = o.getWorldPosition(new o.position.constructor()); v.project(st.rig.camera);
        if (v.x > -1 && v.x < 1 && v.y > -1 && v.y < 1 && v.z < 1) inFrame++;
      });
      const fx = st.composer ? st.composer.passes.flatMap((p) => p.effects || []).map((e) => e.name) : [];
      return { decals, inFrame, fx, hasAO: !!st.contactAO, aoFirst: fx[0] === 'ContactAOEffect' };
    });
    console.log(`  effects: ${pre.fx.join(' -> ')}`);
    console.log(`  contactAO present ${pre.hasAO}   runs FIRST ${pre.aoFirst}   subject in frame ${pre.inFrame}/${pre.decals}`);
    if (!pre.hasAO) throw new Error('no ContactAOEffect on this build — every row below would be a false zero');
    if (pre.inFrame < 1) throw new Error('NO subject in frame — refusing to measure a photograph of the floor');

    // §S1 — the self-pair.
    const selfPair = await page.evaluate(() => {
      const d = window.__dpab; const A = d.shot(), B = d.shot();
      return d.delta(A, B);
    });
    const pairOk = selfPair.deltaMax === 0 && selfPair.nDark === 0;
    console.log(`  §S1 self-pair: max ${selfPair.deltaMax}  darkened ${selfPair.nDark}px  `
      + (pairOk ? '✅ BIT-IDENTICAL' : '🔴 DRIFTS — the table below is not a measurement'));
    if (!pairOk) throw new Error('self-pair drifted');

    const res = await page.evaluate(({ rows: R }) => {
      const d = window.__dpab, ao = d.st.contactAO;
      const shipped = { intensity: ao.intensity, radius: ao.radius, bias: ao.bias };
      // The ABLATED frame is the reference every delta is taken against.
      ao.intensity = 0;
      const OFF = d.shot();
      const out = [];
      for (const row of R) {
        ao.intensity = row.ao.intensity !== undefined ? row.ao.intensity : shipped.intensity;
        ao.radius = row.ao.radius !== undefined ? row.ao.radius : shipped.radius;
        ao.bias = row.ao.bias !== undefined ? row.ao.bias : shipped.bias;
        const px = d.shot();
        out.push({ id: row.id, knobs: { i: ao.intensity, r: ao.radius, b: ao.bias },
          ...d.delta(OFF, px), band: d.band(px, 0.35, 0.62), full: d.band(px, 0, 1) });
      }
      ao.intensity = shipped.intensity; ao.radius = shipped.radius; ao.bias = shipped.bias;
      const back = d.shot();
      return { out, offBand: d.band(OFF, 0.35, 0.62), offFull: d.band(OFF, 0, 1),
        counts: d.counts(), restored: d.delta(OFF, back) };
    }, { rows: ROWS });

    console.log(`\n  AO OFF (the reference):  band vP10 ${res.offBand.vP10.toFixed(3)}  <V.45 ${(100*res.offBand.belowV45).toFixed(2)}%`
      + `   full vP10 ${res.offFull.vP10.toFixed(3)}  <V.45 ${(100*res.offFull.belowV45).toFixed(2)}%\n`);
    console.log('  row          i     r     b     dMean  dMax  dark%   thin%   band vP10  <V.45   meanC   meanS');
    for (const r of res.out) {
      if (!r.band.n) throw new Error(`${r.id}: EMPTY band — vacuous`);
      rows.push(r);
      console.log(`  ${r.id.padEnd(11)} ${r.knobs.i.toFixed(2)}  ${r.knobs.r.toFixed(2)}  ${r.knobs.b.toFixed(2)}`
        + `  ${r.deltaMean.toFixed(3).padStart(6)} ${String(Math.round(r.deltaMax)).padStart(4)}`
        + `  ${(100*r.darkShare).toFixed(2).padStart(5)}%  ${r.thinShare === null ? '  n/a' : (100*r.thinShare).toFixed(1).padStart(5)}%`
        + `    ${r.band.vP10.toFixed(3)}   ${(100*r.band.belowV45).toFixed(2).padStart(5)}%  ${r.band.meanChroma.toFixed(3)}  ${r.band.meanSat.toFixed(3)}`);
    }

    // §S2 / §S3 — the ablation must move the frame, and the known-bad must move it more.
    const ship = rows.find((r) => r.id === 'shipped');
    const abl = rows.find((r) => r.id === 'ablated');
    const bad = rows.find((r) => r.id === 'KNOWNBAD');
    const ship2 = rows.find((r) => r.id === 'shipped2');
    console.log(`\n  §S2 ablation is an EXACT identity: ${abl.deltaMax === 0 && abl.nDark === 0 ? '✅' : '🔴 ' + abl.deltaMax}`);
    console.log(`  §S2 shipped MOVES the frame: ${ship.nDark > 0 ? `✅ ${ship.nDark} px` : '🔴 ZERO — the effect is inert'}`);
    console.log(`  §S3 known-bad moves MORE than shipped: ${bad.deltaMean > ship.deltaMean * 1.5 ? `✅ ${bad.deltaMean.toFixed(3)} vs ${ship.deltaMean.toFixed(3)}` : '🔴'}`);
    console.log(`  §S1 tail self-pair (shipped vs shipped2): ${ship.deltaMean === ship2.deltaMean ? '✅ identical rows' : '🔴 the sweep drifted'}`);
    console.log(`  restore to shipped is bit-identical to row 1: ${res.restored.deltaMean === ship.deltaMean ? '✅' : '⚠️ ' + res.restored.deltaMean}`);
    console.log(`  draws ${res.counts.draws}  tris ${res.counts.tris}`);

    // Crops for the eye. `docs/AGENT-BRIEF.md` §4.1 — the numbers above cannot see
    // whether the grout lines turned to ink.
    for (const row of ROWS) {
      await page.evaluate(({ k, shipped }) => {
        const ao = window.__dpab.st.contactAO;
        ao.intensity = k.intensity !== undefined ? k.intensity : shipped.i;
        ao.radius = k.radius !== undefined ? k.radius : shipped.r;
        ao.bias = k.bias !== undefined ? k.bias : shipped.b;
        window.__dpab.shot();
      }, { k: row.ao, shipped: { i: rows[0].knobs.i, r: rows[0].knobs.r, b: rows[0].knobs.b } });
      await page.screenshot({ path: `${OUT}/${STATION}_${row.id}.png` });
    }
    await page.close();
  } finally { await browser.close(); }
  await writeFile(`${OUT}/sweep_${STATION}.json`, JSON.stringify({ station: STATION, base: BASE, rows }, null, 1));
  console.log(`wrote ${OUT}/sweep_${STATION}.json`);
}

const IS_MAIN = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (IS_MAIN) await main();
