#!/usr/bin/env node
/**
 * DP_COST — what `ContactAOEffect` costs, at 1 and at 6 fighters, on the PHONE tier.
 *
 * Uri plays on an iPhone 15 Pro. `5aa4655` exists because 928 draw calls was too many,
 * and this project's standing rule is that a beautiful frame which drops his framerate
 * is a regression. So the effect has to be priced before it ships, on the tier he gets.
 *
 * ── WHAT THIS CAN AND CANNOT TELL YOU, STATED FIRST ────────────────────────────────
 *
 *   DRAW CALLS and TRIANGLES are EXACT (`CLAUDE.md` rule 10) and they are the number
 *   that matters most here, because the whole design of this effect is "no second
 *   geometry pass". A `NormalPass`-based SSAO adds +72.9% to +80.6% of draws on this
 *   tier; this must add ZERO, and zero is a claim a counter can settle.
 *
 *   FRAME TIME CANNOT BE MEASURED FOR A PHONE FROM HERE, and reporting it as if it
 *   could would be the exact failure `docs/LESSONS.md` §13 is about. Chromium here runs
 *   ANGLE on SwiftShader — a SOFTWARE rasteriser on the CPU. A change that costs only
 *   FILL (12 depth taps per pixel, no extra geometry) is precisely the kind SwiftShader
 *   exaggerates worst, because a real tile-based mobile GPU runs those taps in parallel
 *   across hundreds of cores and SwiftShader runs them on a handful of threads. The
 *   number below is therefore reported as an UPPER BOUND on the relative fill cost, and
 *   labelled as one. It is useful for one thing only: if the ratio were, say, 3x, the
 *   effect would be too expensive on any hardware and that would be worth knowing
 *   without a phone.
 *
 *   ⚠️ `renderer.info` RESETS AT THE START OF EVERY `renderer.render()`, and a composer
 *   calls that once per PASS — so anything read after a composed frame is the LAST pass,
 *   not the frame. `autoReset` is set false and the counters are reset explicitly.
 *
 * ── THE ARMS ──────────────────────────────────────────────────────────────────────
 *
 * AO is ablated by `intensity = 0`, which the shader makes an exact identity, NOT by
 * removing the effect — removing it would also remove the composer's depth texture and
 * its per-frame depth blit, so the two arms would differ by more than the shader.
 *
 *   ship        the effect as configured
 *   ao0         the same chain with intensity 0  -> isolates the SHADER
 *   shipAgain   the first arm again -> THIS INSTRUMENT'S OWN DRIFT, printed next to the
 *               delta it is supposed to resolve. On this harness it is the same size,
 *               which is the result: the ms column cannot resolve this change and says
 *               so rather than reporting the sign of a coin flip.
 *
 * ⚠️ The DEPTH ATTACHMENT's own cost is NOT isolated here. Both arms carry it, so the ms
 * delta is the shader alone; the attachment (one depth texture, one blitFramebuffer per
 * frame) is only visible against a build with no depth effect at all, which is the BEFORE
 * worktree and a different page load — not a paired arm. Stated rather than implied.
 *
 * ⚠️ Seating N fighters at the arena's own spawns puts most of them OFF CAMERA, and
 * `8ca7a46` records N=2/3/6 coming back byte-identical because of exactly that — which
 * reads as "fighters are free". `?fighters=6` is the same trap by another route: measured
 * here it produced TWO contact decals, so an "N=6" row would have been an N=2 row with a
 * 6 in the label. The roster is a RING around the player, radius and rotation searched
 * against the shipped cover boxes, and the run THROWS rather than falling back.
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-dp-B -- \
 *     node tools/tmp/dp_cost.mjs --url '{URL}' --out tools/tmp/dp_cost
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
const OUT = get('--out', 'tools/tmp/dp_cost');
const REPS = Number(get('--reps', 30));

const PAGE_SRC = String.raw`
window.__dpc = (() => {
  const st = window.__stage;
  if (!st) throw new Error('no Stage on this route');
  st.renderer.info.autoReset = false;
  return {
    st,
    counts() { st.renderer.info.reset(); st.render(1/60); const r = st.renderer.info.render;
      return { draws: r.calls, tris: r.triangles }; },
    /** MEDIAN of REPS renders. A mean is hostage to one GC pause; a median is not. */
    time(reps) {
      const xs = [];
      for (let i = 0; i < reps; i++) { const t = performance.now(); st.render(1/60); xs.push(performance.now() - t); }
      xs.sort((p, q) => p - q);
      return { median: xs[Math.floor(xs.length/2)], p10: xs[Math.floor(xs.length*0.1)],
               p90: xs[Math.floor(xs.length*0.9)], n: xs.length };
    },
    buffer() { const c = st.renderer.domElement; return { w: c.width, h: c.height }; },
    tier: (window.__quality && window.__quality.tier) || window.__renderTier || null,
    fx: () => (st.composer ? st.composer.passes.flatMap((p) => p.effects || []).map((e) => e.name) : []),
  };
})();
`;

async function seat(page, n) {
  return page.evaluate((want) => {
    const st = window.__dpc.st;
    let seen = 0, inFrame = 0;
    st.scene.traverse((o) => {
      if ((o.name || '') !== 'contact:decal' || !o.visible) return;
      seen++;
      const v = o.getWorldPosition(new o.position.constructor()); v.project(st.rig.camera);
      if (v.x > -1 && v.x < 1 && v.y > -1 && v.y < 1 && v.z < 1) inFrame++;
    });
    return { want, seen, inFrame };
  }, n);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const dump = JSON.parse(await readFile(new URL('../arena.gameplay.json', import.meta.url), 'utf8'));
  const fog = Math.ceil(dump.maxSafeRadius) + 1;
  const hub = dump.spawns[4];
  // 🚨 THE ARENA'S OWN SIX SPAWNS ARE THE WRONG ROSTER FOR A COST NUMBER AND THE WRONG
  // ANSWER LOOKS RIGHT — `8ca7a46` measured N=2/3/6 byte-identical on that roster because
  // five of the six were off camera. `?fighters=6` is the same trap: measured here, it
  // put TWO contact decals in the scene, so an "N=6" row would have been an N=2 row with
  // a 6 in the label. The roster below is a RING around the player, radius and rotation
  // searched against the shipped cover boxes, and it THROWS rather than falling back.
  const CAST = ['hamburger', 'donut', 'hotdog', 'pizza', 'taco', 'sushi'];
  const inCover = (x, y) => (dump.cover || []).some((b) =>
    Math.abs(x - b.x) <= b.w / 2 + 22 && Math.abs(y - b.y) <= b.h / 2 + 22);
  const ring = (n) => {
    for (let R = 100; R <= 280; R += 10) {
      for (let deg = 0; deg < 360; deg += 5) {
        const pts = [{ x: hub.x, y: hub.y }];
        let ok = true;
        for (let i = 1; i < n; i++) {
          const th = (deg + (i - 1) * 360 / (n - 1)) * Math.PI / 180;
          const x = Math.round(hub.x + R * Math.cos(th)), y = Math.round(hub.y + R * Math.sin(th));
          if (x < 60 || y < 60 || x > dump.width - 60 || y > dump.height - 60 || inCover(x, y)) { ok = false; break; }
          pts.push({ x, y });
        }
        if (ok) { ring.lastR = R; ring.lastDeg = deg; return pts; }
      }
    }
    throw new Error(`no clear ${n}-seat ring around the hub at any radius 100-280 wu`);
  };
  const roster = (n) => {
    const pts = ring(n);
    if (pts.length !== n) throw new Error(`ring returned ${pts.length} seats, wanted ${n}`);
    console.log(`  roster N=${n}: ring R=${ring.lastR} wu, rotation ${ring.lastDeg} deg`);
    return CAST.slice(0, n).map((id, i) => `${id}@${pts[i].x},${pts[i].y}`).join(';');
  };
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const rows = [];
  try {
    for (const n of [1, 6]) {
      // 844x390 @ DPR2 is the iPhone 15 Pro's CSS viewport; `low` is what it resolves to.
      const page = await browser.newPage({ viewport: { width: 844, height: 390 },
        deviceScaleFactor: 2, hasTouch: true, isMobile: true });
      page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
      await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
      const q = new URLSearchParams({ px: String(hub.x), py: String(hub.y), fogRadius: String(fog),
        simSpeed: '0.01', pointerLock: '0', tier: 'low' });
      if (n > 1) q.set('fighters', roster(n)); else { q.set('player', 'hamburger'); q.set('enemy', 'donut'); }
      await page.goto(`${BASE}/?${q}`, { waitUntil: 'networkidle', timeout: 90_000 });
      await page.waitForFunction('window.__gameReady === true', null, { timeout: 90_000 });
      await page.waitForTimeout(900);
      await page.evaluate(() => {
        for (const an of document.getAnimations()) { try { an.pause(); an.currentTime = 0; } catch { /* ignore */ } }
        window.requestAnimationFrame = () => 0;
      });
      await page.waitForTimeout(250);
      await page.evaluate(() => { const st = window.__stage; try { st.rig.shakeAmount = 0; st.rig.shakeOffset.set(0,0,0); st.rig.apply(); } catch { /* ignore */ } });
      await page.evaluate(PAGE_SRC);

      const s = await seat(page, n);
      // ⚠️ NON-EMPTY FIRST, and it is a real risk here: `fighters=6` seats at the arena's
      // own spawns, which are metres apart, so a player-centred camera can hold ONE.
      // The N=6 row is only a six-fighter row if six are actually being drawn.
      if (s.seen < n) throw new Error(`asked for ${n} fighters, the scene holds ${s.seen} contact decals — the row would be mislabelled`);

      const r = await page.evaluate(({ reps }) => {
        const d = window.__dpc, ao = d.st.contactAO;
        if (!ao) throw new Error('no contactAO on this build — the ablation arm would be a false zero');
        const shipped = ao.intensity;
        const out = {};
        // 🚨 THE SHADOW PASS IS CONDITIONAL AND MAKES A NAIVE COUNT INCOMPARABLE ACROSS
        // ARMS. `Stage.scheduleShadowUpdate` re-renders the shadow map only when a
        // fingerprint of the frustum and the casters changes, so on a FROZEN frame it
        // draws no shadow pass at all — and whether it fires can differ between two
        // reads of the same frame. Forced on every arm so all rows are one quantity.
        const dirty = () => { d.st.renderer.shadowMap.needsUpdate = true;
          if (typeof d.st.markShadowsDirty === 'function') d.st.markShadowsDirty(); };
        ao.intensity = shipped; dirty(); d.counts();
        dirty(); out.ship = { ...d.counts(), ...d.time(reps) };
        ao.intensity = 0; dirty(); d.counts();
        dirty(); out.ao0 = { ...d.counts(), ...d.time(reps) };
        ao.intensity = shipped; dirty(); d.counts();
        dirty(); out.shipAgain = { ...d.counts(), ...d.time(reps) };
        return { ...out, buffer: d.buffer(), tier: d.tier, fx: d.fx() };
      }, { reps: REPS });

      rows.push({ n, seen: s.seen, inFrame: s.inFrame, ...r });
      console.log(`\n  N=${n}  tier ${r.tier}  buffer ${r.buffer.w}x${r.buffer.h}  decals ${s.seen} (in frame ${s.inFrame})`);
      console.log(`    fx: ${r.fx.join(' -> ')}`);
      console.log(`    draws   AO on ${r.ship.draws}   AO off ${r.ao0.draws}   `
        + (r.ship.draws === r.ao0.draws ? '✅ EXACTLY EQUAL' : `🔴 +${r.ship.draws - r.ao0.draws}`));
      console.log(`    tris    AO on ${r.ship.tris}   AO off ${r.ao0.tris}   `
        + (r.ship.tris === r.ao0.tris ? '✅ EXACTLY EQUAL' : `🔴 +${r.ship.tris - r.ao0.tris}`));
      console.log(`    ms/frame (SwiftShader UPPER BOUND, not a phone)  AO on ${r.ship.median.toFixed(2)} `
        + `[p10 ${r.ship.p10.toFixed(2)} p90 ${r.ship.p90.toFixed(2)}]   AO off ${r.ao0.median.toFixed(2)} `
        + `[p10 ${r.ao0.p10.toFixed(2)} p90 ${r.ao0.p90.toFixed(2)}]   ratio ${(r.ship.median / r.ao0.median).toFixed(3)}x`);
      console.log(`    repeat of the AO-on arm: ${r.shipAgain.median.toFixed(2)} ms — the drift in this instrument, `
        + `${Math.abs(r.shipAgain.median - r.ship.median).toFixed(2)} ms`);
      await page.close();
    }
  } finally { await browser.close(); }
  if (!rows.length) throw new Error('no row produced — vacuous');
  await writeFile(`${OUT}/cost.json`, JSON.stringify({ base: BASE, reps: REPS, rows }, null, 1));
  console.log(`\nwrote ${OUT}/cost.json`);
}

const IS_MAIN = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (IS_MAIN) await main();
