#!/usr/bin/env node
/**
 * qc_cycle — does the character screen survive N context loss/restore cycles UNCHANGED?
 *
 * ── Why N and not 1 ────────────────────────────────────────────────────────────
 * `CLAUDE.md` rule 4's eighteenth case: a restored WebGL context came back **15.65
 * luma darker, permanently, while looking entirely plausible**. `stage.ts`
 * `onContextRestored` was written to close exactly that, and `qc_ctx.mjs` measures
 * ONE forced cycle coming back bit-identical. One cycle is not the claim that
 * matters. A handler that rebuilds the environment map without releasing the old one,
 * or that double-registers, is a SLOW version of the same bug — it looks perfect on
 * cycle 1 and is 15 luma down by cycle 8. On a phone this is not hypothetical: iOS
 * drops a context every time the tab is backgrounded under memory pressure, and Uri
 * navigates in and out of this screen every time he plays.
 *
 * ── What is asserted ───────────────────────────────────────────────────────────
 *   * SELF-PAIR first. Two captures with nothing between them must differ by EXACTLY
 *     0 px, or nothing below is quotable. (Virtual rAF clock + `animation: none`;
 *     see `qc_ctx.mjs`'s header for what each is worth.)
 *   * POINTING. The crop must be shown to MOVE when the clock is nudged, or a column
 *     of zeros is indistinguishable from a crop aimed at a static margin.
 *   * Per cycle: the loss and the restore are both SEEN, the panel is bit-identical
 *     to the pre-loss frame, and `renderer.info.memory` does not grow.
 *
 * ⚠️ SwiftShader restores a context; an iPhone's driver may not restore it the same
 * way, or at all. A green run here is evidence the HANDLER is right, not evidence
 * that Uri's device recovers.
 *
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-qc -- node tools/tmp/qc_cycle.mjs --url {URL}
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const base = get('--url', process.env.PREVIEW_BASE || '').replace(/\/$/, '');
const CYCLES = Number(get('--cycles', '6'));
const BURST = Number(get('--burst', '30'));
const OUT = get('--out', 'tools/tmp/qc_cycle');
const DEV = { width: 393, height: 852, dpr: 3 };
const HMR_STUB = 'const noop=()=>{};export const createHotContext=()=>({accept:noop,'
  + 'acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,'
  + 'decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;'
  + 'export const removeStyle=noop;export const ErrorOverlay=class{};export default {};';
const CLOCK = `(() => {
  const Q = { vt: 0, burst: 0, frames: 0, lost: 0, restored: 0 };
  window.__qc = Q;
  const realRAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) {
    return realRAF(() => {
      if (Q.burst > 0) { Q.vt += 1000 / 60; Q.burst--; Q.frames++; }
      cb(Q.vt);
    });
  };
  // Counted page-side on the WINDOW, not per canvas: \`stage.ts\` broadcasts a
  // \`fa:webglcontextlost\`/\`restored\` CustomEvent for exactly this kind of observer,
  // and it is the app's own signal rather than a second guess at it.
  addEventListener('fa:webglcontextlost', () => { Q.lost++; });
  addEventListener('fa:webglcontextrestored', () => { Q.restored++; });
})();`;

let PASS = 0; let FAIL = 0; const failures = [];
const ok = (c, label, detail = '') => {
  if (c) { PASS++; console.log(`  PASS  ${label}${detail ? `   ${detail}` : ''}`); }
  else { FAIL++; failures.push(`${label} ${detail}`); console.log(`  FAIL  ${label}${detail ? `   ${detail}` : ''}`); }
  return c;
};
async function raw(buf) {
  const r = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { d: r.data, w: r.info.width, h: r.info.height };
}
async function diff(A, B) {
  const x = await raw(A); const y = await raw(B);
  if (x.w !== y.w || x.h !== y.h) return { diffPx: -1, sizeMismatch: `${x.w}x${x.h} vs ${y.w}x${y.h}` };
  let n = 0; let mx = 0; let sa = 0; let sb = 0;
  for (let i = 0; i < x.w * x.h; i++) {
    const o = i * 3;
    const d0 = Math.abs(x.d[o] - y.d[o]); const d1 = Math.abs(x.d[o + 1] - y.d[o + 1]);
    const d2 = Math.abs(x.d[o + 2] - y.d[o + 2]);
    if (d0 || d1 || d2) { n++; mx = Math.max(mx, d0, d1, d2); }
    sa += 0.2126 * x.d[o] + 0.7152 * x.d[o + 1] + 0.0722 * x.d[o + 2];
    sb += 0.2126 * y.d[o] + 0.7152 * y.d[o + 1] + 0.0722 * y.d[o + 2];
  }
  const px = x.w * x.h;
  return { diffPx: n, maxChan: mx, px, lumaA: +(sa / px).toFixed(3), lumaB: +(sb / px).toFixed(3),
    lumaDelta: +((sb - sa) / px).toFixed(3) };
}

if (!base) { console.error('qc_cycle: no --url and no PREVIEW_BASE.'); process.exit(2); }
await mkdir(OUT, { recursive: true });
const settle = await import('./settle.mjs');
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({
  viewport: { width: DEV.width, height: DEV.height },
  deviceScaleFactor: DEV.dpr, hasTouch: true, isMobile: true,
});
await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
await page.addInitScript(CLOCK);
const rows = [];
try {
  await page.goto(`${base}/?screen=characters`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction('window.__screenReady === true', null, { timeout: 180_000 });
  await settle.waitForRoster(page, { timeout: 600_000 }).catch(() => {});
  await settle.settleScreen(page, { label: 'characters', timeout: 180_000 }).catch(() => {});
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;}' });
  await page.evaluate((n) => { window.__qc.burst = n; }, BURST);
  await page.waitForFunction(() => window.__qc.burst === 0, null, { timeout: 60_000 });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

  const rect = await page.evaluate(() => {
    const st = window.__stage; const r = st.canvas.getBoundingClientRect(); const d = window.devicePixelRatio;
    return { left: Math.round(r.left * d), top: Math.round(r.top * d),
      width: Math.round(r.width * d), height: Math.round(r.height * d) };
  });
  const snap = async (name) => {
    const full = await page.screenshot({ timeout: 180_000 });
    const panel = await sharp(full).extract(rect).png().toBuffer();
    await writeFile(`${OUT}/${name}.png`, panel);
    return panel;
  };
  const mem = () => page.evaluate(() => {
    const st = window.__stage;
    return { geometries: st.renderer.info.memory.geometries, textures: st.renderer.info.memory.textures,
      programs: st.renderer.info.programs?.length ?? null,
      ratio: st.renderer.getPixelRatio(), bufW: st.canvas.width, bufH: st.canvas.height,
      lost: window.__qc.lost, restored: window.__qc.restored };
  });

  console.log(`\n── drift control ──`);
  const g0 = await snap('00-baseline');
  const g0b = await snap('00-baseline-pair');
  const d0 = await diff(g0, g0b);
  console.log(`  self-pair: ${d0.diffPx} px of ${d0.px}  maxChan ${d0.maxChan}`);
  const licensed = ok(d0.diffPx === 0, 'self-pair is EXACTLY 0 px — licenses every row below', `${d0.diffPx}`);

  console.log(`\n── pointing ──`);
  await page.evaluate(() => { window.__qc.burst = 12; });
  await page.waitForFunction(() => window.__qc.burst === 0, null, { timeout: 60_000 });
  const nudged = await snap('00-nudged');
  const dn = await diff(g0b, nudged);
  ok(dn.diffPx > 0, 'the crop is POINTED at the 3D stage — a 12-frame nudge moves it', `${dn.diffPx} px`);
  // Restore the phase by rebuilding it from zero would need a remount; instead the
  // baseline for the cycles below is the NUDGED frame, which is a real frame at a
  // known phase. Every cycle is compared against it, so the phase cancels.
  const baseline = nudged;
  const m0 = await mem();
  console.log(`  baseline: ${JSON.stringify(m0)}`);

  console.log(`\n── ${CYCLES} loss/restore cycles ──`);
  for (let i = 1; i <= CYCLES; i++) {
    // eslint-disable-next-line no-await-in-loop
    const r = await page.evaluate(async () => {
      const st = window.__stage;
      const ext = st.renderer.getContext().getExtension('WEBGL_lose_context');
      if (!ext) return { ok: false };
      ext.loseContext();
      await new Promise((res) => setTimeout(res, 350));
      const sawLost = st.contextLost === true;
      ext.restoreContext();
      await new Promise((res) => setTimeout(res, 2500));
      return { ok: true, sawLost, back: st.contextLost === false };
    });
    // eslint-disable-next-line no-await-in-loop
    const after = await snap(`cycle-${String(i).padStart(2, '0')}`);
    // eslint-disable-next-line no-await-in-loop
    const d = await diff(baseline, after);
    // eslint-disable-next-line no-await-in-loop
    const m = await mem();
    rows.push({ cycle: i, ...r, ...d, ...m });
    console.log(`  cycle ${String(i).padStart(2)}  lost=${r.sawLost} back=${r.back}`
      + `  diff ${String(d.diffPx).padStart(7)} px  maxChan ${String(d.maxChan).padStart(3)}`
      + `  luma ${d.lumaB} (delta ${d.lumaDelta})`
      + `  geo ${m.geometries} tex ${m.textures} prog ${m.programs}`
      + `  ratio ${m.ratio} buf ${m.bufW}x${m.bufH}  events ${m.lost}/${m.restored}`);
  }

  console.log('\n── verdict ──');
  if (!licensed) {
    console.log('  ⚠️ NOT QUOTABLE — the self-pair was not 0.');
  } else {
    // FILTERED SET -> ASSERT NON-EMPTY FIRST (CLAUDE.md rule 6: `[].every()` is true,
    // and that vacuity has fired at least seven times in this repo).
    ok(rows.length === CYCLES, `all ${CYCLES} cycles ran`, `${rows.length}`);
    ok(rows.length > 0 && rows.every((r) => r.sawLost && r.back),
      'every cycle both LOST and CAME BACK', `${rows.filter((r) => r.sawLost && r.back).length}/${rows.length}`);
    ok(rows.length > 0 && rows.every((r) => r.diffPx === 0),
      'every restored frame is BIT-IDENTICAL to the pre-loss frame',
      rows.map((r) => r.diffPx).join(','));
    const memGrew = rows[rows.length - 1].textures - rows[0].textures;
    ok(memGrew <= 0, 'the restore handler does not leak textures across cycles',
      `${rows[0].textures} -> ${rows[rows.length - 1].textures}`);
    ok(rows.length > 0 && rows.every((r) => r.ratio === m0.ratio && r.bufW === m0.bufW && r.bufH === m0.bufH),
      'the drawing buffer and pixel ratio survive every restore',
      `${m0.bufW}x${m0.bufH}@${m0.ratio}`);
  }
} finally {
  await page.close().catch(() => {});
  await browser.close().catch(() => {});
}
await writeFile(`${OUT}/rows.json`, JSON.stringify(rows, null, 2));
console.log(`\n${FAIL === 0 ? 'ALL PASS' : `${FAIL} FAIL`}  (${PASS} pass)`);
failures.forEach((f) => console.log(`  - ${f}`));
process.exitCode = FAIL ? 1 : 0;
