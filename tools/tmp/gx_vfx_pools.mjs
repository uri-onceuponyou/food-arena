#!/usr/bin/env node
/**
 * GX_VFX_POOLS — does the VFX layer's fixed-pool / uncapped-transient design hold at
 * SIX seats? (VFX audit, review phase; read-only on src/.)
 *
 * The question is a six-seat one by construction (AGENT-BRIEF §4b): `vfx.ts` draws every
 * generic beat out of fixed pools — PARTICLE_POOL_SIZE 96, RING_POOL_SIZE 16,
 * WEDGE_POOL_SIZE 10 (melee arcs AND every impact's star decal share it) — and every
 * `alloc*` STEALS the slot closest to death when none is free. Bespoke weapon hooks add
 * `Object3D`s through `spawnTransientObject`, which has NO cap. At two seats neither can
 * bind much; at six it might. This measures, on the shipped code, per alloc call:
 *   - calls, steals (no free slot), and how far through its life the stolen slot was
 *     (a steal at life 0.2 is an effect cut off at 20% of its authored length)
 *   - live transient count and live visible VFX meshes, max and mean
 *   - draw calls with and without `vfx_layer`, sampled every `--sampleEvery` frames
 *
 * Rendering is stubbed between samples (`stage.render` no-op) so the sim + VFX update
 * run at full rate without paying for SwiftShader every frame; sampled frames render
 * twice (with/without the layer) through the real `stage.render(0)`.
 *
 * Known-bad / controls: the same run at TWO seats (`--fighters` with 2 entries is
 * refused by match.ts, so the control is the legacy `player`/`enemy` form placed close).
 * The counting wrappers are validated in-page before the run: a forced exhaustion
 * (allocating PARTICLE_POOL_SIZE+5 particles back to back) must report exactly 5 steals.
 *
 * Usage:
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-head -- \
 *     node tools/tmp/gx_vfx_pools.mjs --url '{URL}' --out shots/rv/audit/vfx/pools
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}
const args = parseArgs(process.argv);
const BASE = args.url ?? process.env.PREVIEW_BASE;
const OUT = args.out ?? 'shots/rv/audit/vfx/pools';
const W = 1600, H = 900;
const STEP_MS = 1000 / 60;
const SECONDS = Number(args.seconds ?? 20);
const SAMPLE_EVERY = Number(args.sampleEvery ?? 30);
const log = (...a) => console.log(...a);
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const SCENARIOS = [
  { tag: 'six_A', q: { fighters: 'donut@1530,1000;taco@1575,922;hamburger@1665,922;lollipop@1710,1000;waterbottle@1665,1078;sushi@1575,1078' } },
  { tag: 'six_B', q: { fighters: 'pizza@1530,1000;soup@1575,922;burrito@1665,922;egg@1710,1000;hotdog@1665,1078;hamburger@1575,1078' } },
  { tag: 'duel_donut_taco', q: { player: 'donut', enemy: 'taco', px: '2360', py: '1250' } },
  { tag: 'duel_pizza_soup', q: { player: 'pizza', enemy: 'soup', px: '2360', py: '1250' } },
];

async function run(browser, sc) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.setDefaultTimeout(240_000);
  page.on('pageerror', (e) => log('PAGEERROR:', String(e).slice(0, 200)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance);
    const realRaf = window.requestAnimationFrame.bind(window);
    const base = realNow();
    let manual = false; let virt = 0; const q = [];
    window.__clk = {
      manual() { if (!manual) { virt = realNow() - base; manual = true; } },
      qlen() { return q.length; },
      pump(n, ms) { for (let i = 0; i < n; i++) { virt += ms; const cbs = q.splice(0); for (const cb of cbs) cb(virt); } },
    };
    performance.now = () => (manual ? virt : realNow() - base);
    window.requestAnimationFrame = (cb) => { if (manual) { q.push(cb); return q.length; } return realRaf(cb); };
  });
  const qs = new URLSearchParams({ pointerLock: '0', screen: 'match', ...sc.q });
  await page.goto(`${BASE}/?${qs}`, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 240_000 });
  // Manual clock + stubbed draw from here on; the countdown is pumped, not waited out
  // (a real-time six-seat countdown timed out at 180 s under load 84).
  await page.evaluate(() => {
    window.__clk.manual();
    const stage = window.__stage;
    window.__realRender = stage.render.bind(stage);
    stage.render = (dt) => stage.rig.update(dt);
  });

  const selftest = await page.evaluate(() => {
    const L = window.__vfxLayer;
    const origSync = L.sync.bind(L);
    L.sync = (s) => { window.__st = s; return origSync(s); };
    const stats = {};
    const wrap = (name, poolName) => {
      const orig = L[name].bind(L);
      stats[name] = { calls: 0, steals: 0, stolenLifeFrac: [] };
      L[name] = (...a) => {
        const pool = L[poolName];
        const free = pool.some((p) => !p.active);
        const st = stats[name];
        st.calls++;
        if (!free) {
          st.steals++;
          // the slot about to be reused is the one closest to death
          let best = -1; for (const p of pool) best = Math.max(best, p.life / p.maxLife);
          st.stolenLifeFrac.push(best);
        }
        return orig(...a);
      };
    };
    wrap('allocParticle', 'particles');
    wrap('allocRing', 'rings');
    wrap('allocWedge', 'wedges');
    window.__poolStats = stats;
    // ── SELF-TEST: forced exhaustion must report exactly N+5-N = 5 steals ──
    const n = L.particles.length;
    for (const p of L.particles) { p.active = false; }
    for (let i = 0; i < n + 5; i++) { const s = L.allocParticle(); s.active = true; s.life = 0; s.maxLife = 10; }
    const got = stats.allocParticle.steals;
    for (const p of L.particles) { p.active = false; p.sprite.visible = false; }
    stats.allocParticle.calls = 0; stats.allocParticle.steals = 0; stats.allocParticle.stolenLifeFrac = [];
    return { poolSize: n, rings: L.rings.length, wedges: L.wedges.length, forcedSteals: got };
  });
  log(`   [${sc.tag}] selftest: pool=${selftest.poolSize} rings=${selftest.rings} wedges=${selftest.wedges} forcedSteals=${selftest.forcedSteals} (expect 5)`);

  // pump the countdown away (draw already stubbed), then reset the counters so only
  // live-play allocations are counted. First wait until the game's loop is IN the manual
  // queue — its pending real-rAF callback can lag under load, and pumping an empty queue
  // advances nothing.
  await page.waitForFunction(() => window.__clk.qlen() > 0, null, { timeout: 120_000, polling: 100 });
  for (let i = 0; i < 400; i++) {
    const phase = await page.evaluate(() => { window.__clk.pump(5, 50); return window.__st?.phase ?? null; });
    if (phase === 'playing') break;
  }
  await page.evaluate(() => {
    for (const s of Object.values(window.__poolStats)) { s.calls = 0; s.steals = 0; s.stolenLifeFrac = []; }
  });

  // drive slot 0 toward its nearest opponent with attack held; cycle weapons
  const total = Math.round((SECONDS * 1000) / STEP_MS);
  const samples = [];
  let mouseDown = false; let lastKey = null; const held = new Set();
  const setKeys = async (mx, my) => {
    const want = new Set();
    if (mx < 0) want.add('KeyA'); if (mx > 0) want.add('KeyD'); if (my < 0) want.add('KeyW'); if (my > 0) want.add('KeyS');
    for (const k of held) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  };
  const perFrame = [];
  for (let fr = 0; fr < total; fr += 3) {
    const r = await page.evaluate(() => {
      const f = window.__st?.fighters ?? [];
      const L = window.__vfxLayer;
      let vis = 0;
      L.group.traverse((o) => { if ((o.isMesh || o.isSprite) && o.visible) { let p = o; let shown = true; while (p) { if (!p.visible) { shown = false; break; } p = p.parent; } if (shown) vis++; } });
      return {
        f: f.map((x) => ({ x: x.x, y: x.y, alive: x.alive })), scr: window.__vfxDebugScreen?.slots ?? null,
        transients: L.transientEffects.length, visible: vis,
        activeParticles: L.particles.filter((p) => p.active).length,
        activeRings: L.rings.filter((p) => p.active).length,
        activeWedges: L.wedges.filter((p) => p.active).length,
        alive: f.filter((x) => x.alive).length, elapsed: window.__st?.elapsed,
      };
    });
    perFrame.push(r);
    const me = r.f[0];
    let tgt = -1, best = Infinity;
    r.f.forEach((o, i) => { if (i === 0 || !o.alive) return; const d = Math.hypot(o.x - me.x, o.y - me.y); if (d < best) { best = d; tgt = i; } });
    if (me?.alive && tgt >= 0) {
      const e = r.f[tgt];
      const toward = (tx, ty) => [tx > me.x + 12 ? 1 : tx < me.x - 12 ? -1 : 0, ty > me.y + 12 ? 1 : ty < me.y - 12 ? -1 : 0];
      let mx, my;
      if (best < 65) [mx, my] = toward(me.x + (me.x - e.x), me.y + (me.y - e.y));
      else if (best > 120) [mx, my] = toward(e.x, e.y);
      else { const sx = e.x > me.x ? 1 : -1; const sy = e.y > me.y ? 1 : -1; mx = -sy; my = sx; }
      await setKeys(mx, my);
      const s = r.scr?.[tgt];
      if (s) await page.mouse.move(Math.max(2, Math.min(W - 2, s.x)), Math.max(2, Math.min(H - 2, s.y)));
      if (!mouseDown) { await page.mouse.down(); mouseDown = true; }
      const k = [2, 3, 4, 1][Math.floor((fr * STEP_MS) / 1300) % 4];
      if (k !== lastKey) { await page.keyboard.press(`Digit${k}`); lastKey = k; }
    }
    if (fr % SAMPLE_EVERY === 0) {
      const d = await page.evaluate(() => {
        const stage = window.__stage; const R = stage.renderer; const layer = stage.scene.getObjectByName('vfx_layer');
        const count = () => { R.info.autoReset = false; R.info.reset(); window.__realRender(0); const c = R.info.render.calls; const t = R.info.render.triangles; R.info.autoReset = true; return { c, t }; };
        // ⚠️ WARM FIRST. The first real render after a stretch of stubbed frames can carry
        // a shadow-map refresh (`scheduleShadowUpdate` fingerprints moved casters) that the
        // very next render does not — so counting [with, without] in that order charged
        // the whole shadow pass to the VFX layer. Found by reading the first run's numbers
        // against the duel control; this render is uncounted.
        window.__realRender(0);
        const withL = count();
        layer.visible = false; const without = count(); layer.visible = true;
        // STABILITY control: the same state counted again must equal `withL`.
        const again = count();
        return { calls: withL.c, callsNoVfx: without.c, callsAgain: again.c, tris: withL.t, trisNoVfx: without.t };
      });
      samples.push({ fr, ...d, transients: r.transients, visible: r.visible, alive: r.alive });
    }
    await page.evaluate((ms) => window.__clk.pump(3, ms), STEP_MS);
  }
  for (const k of held) await page.keyboard.up(k);
  if (mouseDown) await page.mouse.up();
  const stats = await page.evaluate(() => window.__poolStats);
  // a last real render as a picture of the state
  await page.evaluate(() => { window.__stage.render = window.__realRender; });
  await page.evaluate((ms) => window.__clk.pump(1, ms), STEP_MS);
  await page.screenshot({ path: `${OUT}/${sc.tag}_end.png` });
  await page.close();

  const summ = (k) => { const v = perFrame.map((x) => x[k]); return { max: Math.max(...v), mean: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) }; };
  const steal = (s) => ({ calls: s.calls, steals: s.steals, stealRate: s.calls ? +(s.steals / s.calls).toFixed(3) : 0,
    medianStolenLifeFrac: s.stolenLifeFrac.length ? +s.stolenLifeFrac.sort((a, b) => a - b)[Math.floor(s.stolenLifeFrac.length / 2)].toFixed(2) : null,
    minStolenLifeFrac: s.stolenLifeFrac.length ? +Math.min(...s.stolenLifeFrac).toFixed(2) : null });
  const vfxCalls = samples.map((s) => s.calls - s.callsNoVfx);
  const res = {
    tag: sc.tag, selftest, seconds: SECONDS,
    particles: steal(stats.allocParticle), rings: steal(stats.allocRing), wedges: steal(stats.allocWedge),
    activeParticles: summ('activeParticles'), activeRings: summ('activeRings'), activeWedges: summ('activeWedges'),
    transients: summ('transients'), visibleVfxObjects: summ('visible'),
    vfxDrawCalls: { max: Math.max(...vfxCalls), mean: +(vfxCalls.reduce((a, b) => a + b, 0) / vfxCalls.length).toFixed(1) },
    totalDrawCalls: { max: Math.max(...samples.map((s) => s.calls)), mean: +(samples.reduce((a, s) => a + s.calls, 0) / samples.length).toFixed(1) },
    unstableSamples: samples.filter((s) => s.callsAgain !== undefined && s.callsAgain !== s.calls).length,
    samples,
  };
  log(`   [${sc.tag}] particles ${JSON.stringify(res.particles)}`);
  log(`   [${sc.tag}] rings ${JSON.stringify(res.rings)} wedges ${JSON.stringify(res.wedges)}`);
  log(`   [${sc.tag}] activeParticles ${JSON.stringify(res.activeParticles)} transients ${JSON.stringify(res.transients)} visibleVfx ${JSON.stringify(res.visibleVfxObjects)}`);
  log(`   [${sc.tag}] vfxDrawCalls ${JSON.stringify(res.vfxDrawCalls)} totalDrawCalls ${JSON.stringify(res.totalDrawCalls)} unstableSamples ${res.unstableSamples}/${samples.length}`);
  return res;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const results = [];
  try {
    const only = args.only ? String(args.only).split(',') : null;
    for (const sc of SCENARIOS) {
      if (only && !only.includes(sc.tag)) continue;
      log(`\n── ${sc.tag} ──`);
      results.push(await run(browser, sc));
    }
  } finally { await browser.close(); }
  writeFileSync(`${OUT}/pools.json`, JSON.stringify(results, null, 2));
  log(`done -> ${OUT}/pools.json`);
}
await main().catch((e) => { console.error(e); process.exitCode = 1; });
