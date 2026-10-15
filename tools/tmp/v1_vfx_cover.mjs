#!/usr/bin/env node
/**
 * V1_VFX_COVER — how much of each fighter's BODY is covered by effects, and for how long?
 * (Graphics campaign V1, docs/REVAMP.md §5: "no effect may cover its own fighter's body for
 * longer than a hit flash — measure on the crop".)
 *
 * Frame-stepped six-seat ring at the hub (virtual clock — the `gx_vfx_cap.mjs` pump), AI on
 * every seat but the local one. Every `--every` ms of game time for `--seconds`, ONE frozen
 * instant is rendered three ways, shake zeroed:
 *   full    as shipped
 *   novfx   the whole `vfx_layer` hidden            -> what the effects changed
 *   body    the characters rendered ALONE vs an empty frame -> where each fighter's body is
 *           (not "full minus characters": that also removes their shadows, and every ground
 *           effect over a shadow then counts as covering the body)
 * A fighter's BODY is the set of moved px (characters-alone vs empty) within 1.6 character-heights of its
 * projected position, assigned to the nearest fighter. COVERED = body px that also move when the
 * VFX layer is hidden. Per fighter it reports the covered fraction per sample and the LONGEST
 * RUN of consecutive samples with more than `--thresh` (25%) of the body covered.
 *
 * `--slow <slot>` applies ONE weapon slow to that seat at the first sample (status.slowedUntil
 * = now + `--slowMs`) — the status telegraph is the effect this exists to catch (REVAMP §2.5:
 * "status turns fighters into pale ghosts"). Known-bad: the same run on `d1b2621`, where the
 * slow tint sat over the head for the whole slow.
 * Non-empty is asserted before any fraction is taken (a fighter with 0 body px is reported,
 * not averaged in).
 *
 *   node tools/tmp/sx_snap.mjs --root <tree> -- node tools/tmp/v1_vfx_cover.mjs --url '{URL}' \
 *     --out <dir> [--seconds 4 --every 100 --slow 1 --slowMs 2500 --thresh 0.25]
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]; if (!a.startsWith('--')) continue;
  const nx = process.argv[i + 1]; if (nx === undefined || nx.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = nx; i++; }
}
const BASE = args.url ?? process.env.PREVIEW_BASE;
const OUT = args.out ?? 'shots/rv/v1/cover';
const SECONDS = Number(args.seconds ?? 4), EVERY = Number(args.every ?? 100);
const SLOW = args.slow === undefined ? 1 : Number(args.slow), SLOW_MS = Number(args.slowMs ?? 2500);
const THRESH = Number(args.thresh ?? 0.25);
const FIGHTERS = args.fighters ?? 'donut@1530,1000;taco@1575,922;hamburger@1665,922;lollipop@1710,1000;waterbottle@1665,1078;sushi@1575,1078';
const W = 1280, H = 720, STEP_MS = 1000 / 60;
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.setDefaultTimeout(240_000);
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 200)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  await page.addInitScript(() => {
    const realNow = performance.now.bind(performance); const realRaf = window.requestAnimationFrame.bind(window);
    const base = realNow(); let manual = false; let virt = 0; const q = [];
    window.__clk = { manual() { if (!manual) { virt = realNow() - base; manual = true; } }, qlen: () => q.length,
      pump(n, ms) { for (let i = 0; i < n; i++) { virt += ms; const cbs = q.splice(0); for (const cb of cbs) { try { cb(virt); } catch (e) { console.error(e); } } } } };
    performance.now = () => (manual ? virt : realNow() - base);
    window.requestAnimationFrame = (cb) => { if (manual) { q.push(cb); return q.length; } return realRaf(cb); };
  });
  await page.goto(`${BASE}/?screen=match&pointerLock=0&fogRadius=1700&fighters=${encodeURIComponent(FIGHTERS)}`, { waitUntil: 'networkidle' });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 240_000 });
  await page.evaluate(() => {
    window.__clk.manual();
    const layer = window.__vfxLayer; const orig = layer.sync.bind(layer);
    layer.sync = (s) => { window.__st = s; return orig(s); };
    const st = window.__stage; window.__realRender = st.render.bind(st);
    st.render = (dt) => st.rig.update(dt);
  });
  await page.waitForFunction(() => window.__clk.qlen() > 0, null, { timeout: 120_000, polling: 100 });
  for (let i = 0; i < 400; i++) {
    const ph = await page.evaluate(() => { window.__clk.pump(5, 50); return window.__st?.phase ?? null; });
    if (ph === 'playing') break;
  }
  await page.evaluate((ms) => window.__clk.pump(30, ms), STEP_MS);
  if (SLOW >= 0) await page.evaluate(([slot, ms]) => { const f = window.__st.fighters[slot]; f.status.slowedUntil = window.__st.elapsed + ms; }, [SLOW, SLOW_MS]);

  const n = Math.round((SECONDS * 1000) / EVERY);
  const series = [];
  for (let k = 0; k < n; k++) {
    const shot = await page.evaluate(() => {
      const stage = window.__stage; const rig = stage.rig;
      rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0); rig.apply();
      const grab = () => { window.__realRender(0); const cv = document.createElement('canvas'); cv.width = stage.canvas.width; cv.height = stage.canvas.height; cv.getContext('2d').drawImage(stage.canvas, 0, 0); return cv.toDataURL('image/png'); };
      const full = grab();
      const layer = stage.scene.getObjectByName('vfx_layer');
      layer.visible = false; const novfx = grab(); layer.visible = true;
      // BODY MASK without shadows or effects: render the characters ALONE (every other
      // renderable hidden, a flat background) and an EMPTY frame the same way; the body is
      // what differs. Hiding the characters from the full frame instead would also remove
      // their cast SHADOWS, and every ground effect over a shadow would count as "covering
      // the body" — the first version of this tool did exactly that.
      const roots = new Set(); stage.scene.traverse((o) => { if (o.name.startsWith('character:')) roots.add(o); });
      const underChar = (o) => { for (let q = o; q; q = q.parent) if (roots.has(q)) return true; return false; };
      // ⚠️ LAYERS, NOT `visible`: the stage re-shows some ground pieces on every render (the
      // seat rings came back in the first chars-alone frame and put the ground around every
      // fighter's feet into its "body"). A camera that does not see layer 30 cannot draw them.
      const others = []; stage.scene.traverse((o) => { if ((o.isMesh || o.isSprite || o.isLine || o.isPoints) && !underChar(o)) others.push([o, o.layers.mask]); });
      const bg = stage.scene.background; stage.scene.background = null;
      for (const [o] of others) o.layers.set(30);
      const charsOnly = grab();
      const masks = [...roots].map((r) => r.layers.mask);
      const hideRoot = (r, m) => r.traverse((q) => { q.layers.mask = m; });
      const saved = []; for (const r of roots) r.traverse((q) => saved.push([q, q.layers.mask]));
      for (const r of roots) hideRoot(r, 1 << 30);
      const nochar = grab();
      for (const [q, m] of saved) q.layers.mask = m;
      for (const [o, m] of others) o.layers.mask = m;
      stage.scene.background = bg;
      void masks;
      const cam = rig.camera; const st = window.__st;
      const fs = st.fighters.map((f) => { const v = cam.position.clone().set(f.x * 0.05, 1.0, f.y * 0.05).project(cam);
        const top = cam.position.clone().set(f.x * 0.05, 2.1, f.y * 0.05).project(cam);
        const foot = cam.position.clone().set(f.x * 0.05, 0, f.y * 0.05).project(cam);
        return { alive: f.alive, sx: (v.x + 1) / 2 * stage.canvas.width, sy: (1 - v.y) / 2 * stage.canvas.height,
          hpx: Math.abs(top.y - foot.y) / 2 * stage.canvas.height, slowed: st.elapsed < f.status.slowedUntil }; });
      return { full, novfx, nochar, charsOnly, fs, t: st.elapsed };
    });
    const dec = async (url) => (await sharp(Buffer.from(url.split(',')[1], 'base64')).removeAlpha().raw().toBuffer({ resolveWithObject: true }));
    const [A, V, C, O] = await Promise.all([dec(shot.full), dec(shot.novfx), dec(shot.nochar), dec(shot.charsOnly)]);
    const { width: w, height: h } = A.info;
    const body = shot.fs.map(() => 0), cov = shot.fs.map(() => 0);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      // C = the EMPTY frame (nothing but background), O = characters alone.
      const dc = Math.abs(O.data[i] - C.data[i]) + Math.abs(O.data[i + 1] - C.data[i + 1]) + Math.abs(O.data[i + 2] - C.data[i + 2]);
      if (dc < 24) continue;
      let best = -1, bd = Infinity;
      shot.fs.forEach((f, j) => { if (!f.alive) return; const d = Math.hypot(x - f.sx, y - f.sy); if (d < f.hpx * 1.6 && d < bd) { bd = d; best = j; } });
      if (best < 0) continue;
      body[best]++;
      const dv = Math.abs(A.data[i] - V.data[i]) + Math.abs(A.data[i + 1] - V.data[i + 1]) + Math.abs(A.data[i + 2] - V.data[i + 2]);
      if (dv >= 24) cov[best]++;
    }
    series.push({ t: Math.round(shot.t), body, frac: body.map((b, j) => (b > 0 ? +(cov[j] / b).toFixed(3) : null)), slowed: shot.fs.map((f) => f.slowed) });
    if (k === Math.min(5, n - 1) || k === Math.min(25, n - 1)) {
      for (const nm of ['full', 'novfx', 'charsOnly']) writeFileSync(`${OUT}/s${k}_${nm}.png`, Buffer.from(shot[nm].split(',')[1], 'base64'));
    }
    await page.evaluate(([steps, ms]) => window.__clk.pump(steps, ms), [Math.max(1, Math.round(EVERY / STEP_MS)), STEP_MS]);
  }
  await browser.close();

  const nF = series[0].body.length;
  const summary = [];
  for (let j = 0; j < nF; j++) {
    const fr = series.map((s) => s.frac[j]);
    const valid = fr.filter((v) => v !== null);
    let run = 0, longest = 0;
    for (const v of fr) { if (v !== null && v > THRESH) { run++; longest = Math.max(longest, run); } else run = 0; }
    const slowedSamples = series.filter((s) => s.slowed[j]);
    const fs = slowedSamples.map((s) => s.frac[s === null ? 0 : j]).filter((v) => v !== null);
    summary.push({ slot: j, samples: valid.length, meanCovered: valid.length ? +(valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(3) : null,
      longestRunMs: longest * EVERY, slowedSamples: slowedSamples.length,
      meanCoveredWhileSlowed: fs.length ? +(fs.reduce((a, b) => a + b, 0) / fs.length).toFixed(3) : null });
  }
  writeFileSync(`${OUT}/cover.json`, JSON.stringify({ args: { SECONDS, EVERY, SLOW, SLOW_MS, THRESH, FIGHTERS }, summary, series }, null, 1));
  for (const s of summary) console.log(JSON.stringify(s));
  if (summary.every((s) => s.samples === 0)) { console.log('FAIL: no fighter body pixels in any sample — the mask is empty, nothing was measured'); process.exitCode = 1; }
}
await main().catch((e) => { console.error(e); process.exitCode = 1; });
