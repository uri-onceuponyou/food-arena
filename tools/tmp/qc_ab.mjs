#!/usr/bin/env node
/**
 * qc_ab — the character screen's 3D panel, captured identically on any tree.
 *
 * `qc_ctx.mjs` answers "is it the same after a round trip". This answers the other
 * half of *"or something else changed"*: **is it the same as the build Uri liked?**
 * One arm per commit, each on its own detached worktree, each capture at an
 * IDENTICAL animation phase, so two arms can be diffed byte for byte.
 *
 * ── Everything that makes two arms comparable ───────────────────────────────────
 *   * iPhone 15 Pro emulation: 393x852 CSS, deviceScaleFactor 3, touch+mobile — so
 *     `quality.ts:detectTier` sees `screen.width` 393 and returns `low`, which is the
 *     tier Uri's device actually gets. Verified per arm and printed.
 *   * A VIRTUAL rAF CLOCK. `shell.ts:431` derives dt from the rAF timestamp;
 *     `charStage.ts:update` accrues `elapsed` off dt and drives the turntable sway
 *     and the idle pose from it. The clock is frozen from before the first module
 *     runs, so `elapsed` is 0 for every instance ever built, and is then advanced by
 *     EXACTLY `--burst` frames of 1/60 s before the shutter. Both arms therefore sit
 *     at the same `elapsed` by construction rather than by luck.
 *   * CSS STILLED with `animation: none`, not `animation-play-state: paused`. Paused
 *     freezes at whatever phase was reached, which differs between arms; `none` snaps
 *     to the un-animated base style, which does not. Measured cost of NOT doing this:
 *     a self-pair 200 ms apart differed on **609,208 px of 3,013,524 (20.22%)**, all
 *     of it DOM (a rotating background sunburst, the FIGHT button's pulse, a shine
 *     sweep on three roster tiles) with the 3D panel already stable.
 *   * PROVENANCE. Each arm prints the byte length the dev server returns for a marker
 *     module, because `docs/AGENT-BRIEF.md` §3's worst failure is two arms silently
 *     reading one tree and agreeing perfectly.
 *
 * ⚠️ SwiftShader is not a phone. The COUNTS (tier, drawing buffer, pixel ratio) are
 * hardware independent; the PIXELS are only ever compared arm to arm, never quoted as
 * what Uri sees.
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-x -- node tools/tmp/qc_ab.mjs --url {URL} --tag SHA
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const base = get('--url', process.env.PREVIEW_BASE || '').replace(/\/$/, '');
const TAG = get('--tag', 'arm');
const BURST = Number(get('--burst', '30'));
const OUT = get('--out', 'tools/tmp/qc_ab');
const DEV = { width: 393, height: 852, dpr: 3 };

const HMR_STUB = 'const noop=()=>{};export const createHotContext=()=>({accept:noop,'
  + 'acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,'
  + 'decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;'
  + 'export const removeStyle=noop;export const ErrorOverlay=class{};export default {};';

// Same virtual clock as `qc_ctx.mjs`. Duplicated rather than imported on purpose:
// `qc_ctx.mjs` runs `main()` at module scope and importing it would launch a browser
// (`docs/AGENT-BRIEF.md` §3 — three tools here shipped without an IS_MAIN guard and
// importing one printed a live sweep report).
const CLOCK = `(() => {
  const Q = { vt: 0, burst: 0, frames: 0 };
  window.__qc = Q;
  const realRAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) {
    return realRAF(() => {
      if (Q.burst > 0) { Q.vt += 1000 / 60; Q.burst--; Q.frames++; }
      cb(Q.vt);
    });
  };
})();`;

if (!base) { console.error('qc_ab: no --url and no PREVIEW_BASE.'); process.exit(2); }
await mkdir(OUT, { recursive: true });
const settle = await import('./settle.mjs');

// ── provenance, before anything is measured ────────────────────────────────────
// Two markers with OPPOSITE expectations. A dev server answers every unknown path
// with index.html, so a bare 200 proves nothing — the byte length is what separates
// "the module is here" from "you got the SPA fallback".
const prov = {};
for (const m of ['/src/render/stage.ts', '/src/ui/screens/charStage.ts',
  '/src/render/quality.ts', '/src/nonexistent-control.ts']) {
  try { const r = await fetch(base + m); prov[m] = r.ok ? (await r.text()).length : `HTTP ${r.status}`; }
  catch (e) { prov[m] = `ERR ${e.message}`; }
}

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({
  viewport: { width: DEV.width, height: DEV.height },
  deviceScaleFactor: DEV.dpr, hasTouch: true, isMobile: true,
});
await page.route('**/@vite/client*', (r) => r.fulfill({
  status: 200, contentType: 'text/javascript', body: HMR_STUB,
}));
await page.addInitScript(CLOCK);

const rec = { tag: TAG, base, provenance: prov, screens: {} };
try {
  await page.goto(`${base}/?screen=home`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await settle.settleScreen(page, { label: 'home', timeout: 180_000 }).catch(() => {});

  const capture = async (name) => {
    await page.addStyleTag({
      content: '*,*::before,*::after{animation:none!important;transition:none!important;}',
    }).catch(() => {});
    await page.evaluate((n) => { window.__qc.burst = n; }, BURST);
    await page.waitForFunction(() => window.__qc.burst === 0, null, { timeout: 60_000 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const info = await page.evaluate(() => {
      const st = window.__stage;
      const r = st ? st.canvas.getBoundingClientRect() : null;
      const d = window.devicePixelRatio;
      return {
        tier: window.__renderTier ?? null,
        dpr: d,
        screenEdge: Math.min(window.screen?.width ?? 0, window.screen?.height ?? 0),
        pixelRatio: st ? st.renderer.getPixelRatio() : null,
        bufW: st ? st.canvas.width : null, bufH: st ? st.canvas.height : null,
        cssW: r ? +r.width.toFixed(2) : null, cssH: r ? +r.height.toFixed(2) : null,
        pitchDeg: st?.rig?.pitchDeg ?? null,
        yawDeg: st ? +st.rig.yawDeg.toFixed(6) : null,
        fovDeg: st?.rig?.camera?.fov ?? null,
        camPos: st ? [st.rig.camera.position.x, st.rig.camera.position.y, st.rig.camera.position.z]
          .map((v) => +v.toFixed(4)) : null,
        rect: r ? {
          left: Math.round(r.left * d), top: Math.round(r.top * d),
          width: Math.round(r.width * d), height: Math.round(r.height * d),
        } : null,
      };
    });
    const full = await page.screenshot({ timeout: 180_000 });
    await writeFile(`${OUT}/${TAG}-${name}-page.png`, full);
    if (info.rect && info.rect.width > 1) {
      const panel = await sharp(full).extract(info.rect).png().toBuffer();
      await writeFile(`${OUT}/${TAG}-${name}-panel.png`, panel);
      const st = await sharp(panel).stats();
      info.panelMean = +(st.channels.slice(0, 3).reduce((s, c) => s + c.mean, 0) / 3).toFixed(3);
      info.panelStdev = +Math.max(...st.channels.slice(0, 3).map((c) => c.stdev)).toFixed(3);
    }
    rec.screens[name] = info;
    console.log(`  ${name.padEnd(12)} tier=${info.tier} dpr=${info.dpr} ratio=${info.pixelRatio}`
      + `  buf ${info.bufW}x${info.bufH}  css ${info.cssW}x${info.cssH}`
      + `  pitch=${info.pitchDeg} yaw=${info.yawDeg} fov=${info.fovDeg}`
      + `  panel mean=${info.panelMean} stdev=${info.panelStdev}`);
  };

  console.log(`\n── ${TAG} ──`);
  console.log(`  provenance: ${JSON.stringify(prov)}`);
  await capture('home');
  await page.evaluate(() => window.__shell.navigate({ name: 'characters' }));
  await page.waitForFunction('window.__screenReady === true', null, { timeout: 120_000 });
  await settle.waitForRoster(page, { timeout: 600_000 }).catch(() => {});
  await settle.settleScreen(page, { label: 'characters', timeout: 180_000 }).catch(() => {});
  await capture('characters');
} finally {
  await page.close().catch(() => {});
  await browser.close().catch(() => {});
}
await writeFile(`${OUT}/${TAG}.json`, JSON.stringify(rec, null, 2));
console.log(`  -> ${OUT}/${TAG}.json`);
