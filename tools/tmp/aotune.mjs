#!/usr/bin/env node
/**
 * AO TUNE — separate the CONTACT the critics asked for from the ACNE it arrives with.
 *
 * Six critics named "no contact shadow, no depth" as the top defect on four of five
 * elements. `stage.ts` has an SSAO pass, it is OFF, and the recorded reason it is off
 * is a critic in the opposite direction ("one directionless blob"). Turning it back on
 * measures well and LOOKS WRONG, which is exactly why non-negotiable #3 exists:
 *
 *   AO on vs AO off, hamburger + hotdog at pot_south, paired on one frozen frame
 *     contact 2-8 px outside the silhouette   -0.03798
 *     the same ground 14-26 px out            -0.01072
 *     gradient                                -0.02726     <- the thing being asked for
 *     hero dLedge                    0.0920 -> 0.1180      +28%
 *     value steps @0.10                6.50 -> 7.50
 *   ...and every tile grout line in the arena grows a heavy black speckled fringe
 *   (`shots/halo/ao/floor_ab.png`). The numbers are good and the frame is worse.
 *
 * So the question is not "is AO worth it" but "can the contact be kept while the acne
 * is removed", and that needs a metric for each, measured separately:
 *
 *   CONTACT  mean darkening in the 2-8 px band outside the hero's matte, minus the
 *            same ground 14-26 px out. Low-frequency, localised at the base. Paired
 *            against an AO-OFF frame on the SAME frozen frame, so the floor's own
 *            baked decals, the cast shadow and the grade all cancel exactly.
 *
 *   ACNE     mean |Laplacian| of that same difference map, over open ground far from
 *            the hero. This is the whole trick: contact darkening is smooth, so its
 *            second derivative is near zero; seam speckle is high-frequency by
 *            definition, so its second derivative is large. One number separates the
 *            two effects that a single "mean darkening" figure cannot tell apart —
 *            and "mean darkening" is exactly what the earlier round rejected AO on.
 *
 *   HAZE     mean darkening over that same far region. The "broad low-frequency
 *            dimming of the whole floor" the earlier round named. Kept as its own
 *            column so a candidate cannot trade acne for haze unnoticed.
 *
 * ⚠️ SSAO is ablated by its BLEND OPACITY. `BlendFunction.SKIP` is 9 in postprocessing
 * and `0` is ADD (`docs/LESSONS.md` §12), so nothing here touches a blend function.
 * Every row is image-diff guarded against the AO-off frame; a row reporting dMean
 * 0.0000 did nothing whatever its label says.
 *
 *   node tools/tmp/headserve.mjs --overlay src/render -- \
 *     node tools/tmp/aotune.mjs --out shots/aotune
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { VL, VL_SRC } from './valuelib.mjs';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const has = (k) => a.includes(k);
const BASE = process.env.PREVIEW_BASE ?? process.env.HEADSERVE_URL ?? get('--url', null);
const OUT = get('--out', 'shots/aotune');
const IDS = get('--ids', 'hamburger').split(',');
const STATION = get('--station', 'pot_south');
const STATIONS = { pot_south: { x: 700, y: 640, fog: 850 }, spawn_west: { x: 160, y: 500, fog: 850 } };

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

function selftest() {
  let pass = 0, fail = 0;
  const ck = (n, got, want, eps) => {
    const ok = typeof want === 'number' ? Math.abs(got - want) <= (eps ?? 1e-9) : got === want;
    if (ok) { pass++; console.log(`  ✓ ${n.padEnd(52)} ${JSON.stringify(got)}`); }
    else { fail++; console.log(`  ✗ ${n.padEnd(52)} got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
  };
  console.log('\nAOTUNE SELFTEST — the acne / contact separation, derived by hand\n');
  const W = 41, H = 41;
  const lap = (f, mask) => {
    let s = 0, n = 0;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const j = y * W + x;
      if (mask && !mask[j]) continue;
      s += Math.abs(4 * f[j] - f[j - 1] - f[j + 1] - f[j - W] - f[j + W]); n++;
    }
    return n ? s / n : 0;
  };
  // 1. A CONSTANT field has zero Laplacian — a uniform haze must not read as acne.
  const flat = new Float64Array(W * H).fill(-0.04);
  ck('uniform darkening: |Laplacian| is 0', lap(flat), 0);
  // 2. A LINEAR ramp also has zero Laplacian — a smooth contact gradient must not
  //    read as acne either. This is the assertion that makes the metric a SEPARATOR
  //    rather than just an energy measure.
  const ramp = new Float64Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ramp[y * W + x] = -0.002 * x;
  ck('linear gradient: |Laplacian| is 0', +lap(ramp).toFixed(12), 0, 1e-12);
  // 3. A one-pixel checker is pure high frequency. Amplitude A gives |4A-(-4A)| = 8A
  //    at every interior pixel.
  const chk = new Float64Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) chk[y * W + x] = ((x + y) % 2 ? 1 : -1) * 0.05;
  ck('1px checker at +/-0.05 reads 8 x 0.05', +lap(chk).toFixed(9), 0.4, 1e-9);
  // 4. A single dark LINE — the tile-seam case — reads high, and a wide soft band of
  //    the same depth reads far lower. Hand-derived: the isolated line contributes
  //    |4A| at the line and |A| at each of its two neighbour rows.
  const line = new Float64Array(W * H);
  for (let x = 0; x < W; x++) line[20 * W + x] = -0.10;
  const band = new Float64Array(W * H);
  for (let y = 12; y <= 28; y++) for (let x = 0; x < W; x++) band[y * W + x] = -0.10;
  ck('a 1px seam reads high', lap(line) > 0.005, true);
  // ⚠️ WRITTEN FIRST AS "a 17px band of the same depth reads LOWER", AND THAT IS FALSE.
  // Both shapes have exactly two horizontal edges, and this metric is an EDGE-DENSITY
  // measure, so they read the SAME (0.01026 each, by hand: 39 px x 0.4 over 39x39).
  // The limitation is real and is stated in the header rather than asserted away: a few
  // clean seams and a speckle field of the same edge count are indistinguishable HERE.
  // What makes the metric usable is the REGION — it is only ever evaluated on open
  // ground 40+ px from the hero, where a correct AO has nothing to draw at all, so any
  // reading is spurious by construction.
  ck('a 17px band of the SAME depth reads the SAME — edge density, not width',
    +lap(band).toFixed(6), +lap(line).toFixed(6), 1e-6);
  ck('...and both have the same mean darkening sign', Math.sign(line[20 * W + 5]), Math.sign(band[20 * W + 5]));
  // 4b. SPECKLE at the same mean darkening reads far higher than a few clean lines,
  //     which is the discrimination the metric is actually relied on for.
  const speck = new Float64Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x * 7 + y * 13) % 11 === 0) speck[y * W + x] = -0.10;
  let mLine = 0, mSpeck = 0;
  for (let j = 0; j < W * H; j++) { mLine += line[j]; mSpeck += speck[j]; }
  ck('speckle and seams carry comparable mean darkening',
    Math.abs(mSpeck / (W * H)) > Math.abs(mLine / (W * H)) * 0.5, true);
  ck('...and speckle reads MUCH higher on |Laplacian|', lap(speck) > lap(line) * 3, true);
  // 5. Band means, the contact side.
  const mask = new Uint8Array(W * H);
  for (let y = 15; y <= 25; y++) for (let x = 15; x <= 25; x++) mask[y * W + x] = 1;
  const dist = VL.distanceField(mask, W, H, 32);
  const f = new Float64Array(W * H);
  for (let j = 0; j < W * H; j++) f[j] = mask[j] ? 0 : (dist[j] <= 8 ? -0.04 : -0.01);
  let ns = 0, nn = 0, fs = 0, fn = 0;
  for (let j = 0; j < W * H; j++) {
    if (mask[j]) continue;
    if (dist[j] >= 2 && dist[j] <= 8) { ns += f[j]; nn++; }
    else if (dist[j] >= 14 && dist[j] <= 26) { fs += f[j]; fn++; }
  }
  ck('near band reads the near value', +(ns / nn).toFixed(9), -0.04, 1e-9);
  ck('far band reads the far value', +(fs / fn).toFixed(9), -0.01, 1e-9);
  ck('contact gradient is their difference', +(ns / nn - fs / fn).toFixed(9), -0.03, 1e-9);
  console.log(`\n${pass} passed, ${fail} failed`);
  return fail === 0 ? 0 : 1;
}
if (has('--selftest')) process.exit(selftest());

const CAPTURE = (opts) => {
  const stage = window.__stage;
  const r = stage.renderer, scene = stage.scene, cam = stage.rig.camera, gl = r.getContext();
  const W = r.domElement.width, H = r.domElement.height;
  const VLl = window.VL;
  const read = () => {
    const b = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b);
    const o = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++) o.set(b.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    return o;
  };

  const passes = stage.composer ? stage.composer.passes : [];
  const fx = passes.flatMap((p) => p.effects ?? []);
  const ssao = fx.find((e) => e.name === 'SSAOEffect') ?? null;
  if (!ssao) return { error: 'no SSAOEffect in the chain — stage.ts is not built with ao' };
  const M = ssao.ssaoMaterial;
  const S0 = {
    opacity: ssao.blendMode.opacity.value,
    bias: M.bias, fade: M.fade, intensity: M.intensity,
    minRadiusScale: M.minRadiusScale, samples: M.samples, rings: M.rings,
    radius: ssao.radius,
  };

  // hero matte from the DIRECT render (post chain bypassed)
  const casts = [];
  scene.traverse((o) => { if (/^character:/.test(o.name || '')) casts.push(o); });
  const topOf = (o) => { let n = o; while (n.parent && n.parent !== scene) n = n.parent; return n; };
  const savedBg = scene.background, savedShadow = r.shadowMap.enabled, savedAlpha = r.getClearAlpha();
  let hidden = [];
  const hide = (keep) => { hidden = []; for (const k of scene.children) { if (keep.has(k)) continue; if (k.visible) { hidden.push(k); k.visible = false; } } };
  const show = () => { for (const k of hidden) k.visible = true; hidden = []; };
  let mask = null;
  try {
    let best = null;
    for (const c of casts) {
      hide(new Set([topOf(c)]));
      const others = [];
      for (const o of casts) { if (o !== c && topOf(o) === topOf(c) && o.visible) { others.push(o); o.visible = false; } }
      scene.background = null; r.shadowMap.enabled = false; r.autoClear = true; r.setRenderTarget(null);
      r.setClearColor(0x000000, 1); r.clear(true, true, true); r.render(scene, cam);
      const A = read();
      r.setClearColor(0xffffff, 1); r.clear(true, true, true); r.render(scene, cam);
      const B = read();
      const m = new Uint8Array(W * H);
      let n = 0;
      for (let i = 0, j = 0; i < A.length; i += 4, j++) {
        m[j] = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) < 32 ? 1 : 0;
        n += m[j];
      }
      for (const o of others) o.visible = true;
      show();
      if (c.name === 'character:' + opts.playerId && n > 0) { best = { m, n }; break; }
      if (!best || n > best.n) best = { m, n };
    }
    mask = best.m;
  } finally {
    show(); scene.background = savedBg; r.shadowMap.enabled = savedShadow; r.setClearColor(0x000000, savedAlpha);
  }
  const dist = VLl.distanceField(mask, W, H, 64);

  const lumaOf = (px) => {
    const l = new Float32Array(W * H);
    for (let j = 0, i = 0; j < W * H; j++, i += 4) l[j] = VLl.luma(px[i], px[i + 1], px[i + 2]);
    return l;
  };
  const restore = () => {
    ssao.blendMode.opacity.value = S0.opacity;
    M.bias = S0.bias; M.fade = S0.fade; M.intensity = S0.intensity;
    M.minRadiusScale = S0.minRadiusScale;
    if (M.samples !== S0.samples) M.samples = S0.samples;
    if (M.rings !== S0.rings) M.rings = S0.rings;
    try { ssao.radius = S0.radius; } catch (e) { /* older builds */ }
  };
  const shot = (apply) => {
    restore();
    if (apply) apply(ssao, M);
    stage.render(0); stage.render(0);
    const px = read();
    return { px, luma: lumaOf(px) };
  };

  const off = shot((e) => { e.blendMode.opacity.value = 0; });

  const CFG = [
    ['A0 as configured', null],
    ['B1 bias 0.10', (e, m) => { m.bias = 0.10; }],
    ['B2 bias 0.20', (e, m) => { m.bias = 0.20; }],
    ['B3 bias 0.35', (e, m) => { m.bias = 0.35; }],
    ['C1 bias 0.20 fade 0.06', (e, m) => { m.bias = 0.20; m.fade = 0.06; }],
    ['C2 bias 0.20 minRad 0.5', (e, m) => { m.bias = 0.20; m.minRadiusScale = 0.5; }],
    ['D1 bias 0.20 radius 0.14', (e, m) => { m.bias = 0.20; try { e.radius = 0.14; } catch (x) { /* */ } }],
    ['D2 bias 0.20 radius 0.25', (e, m) => { m.bias = 0.20; try { e.radius = 0.25; } catch (x) { /* */ } }],
    ['E1 B2 + intensity 1.5', (e, m) => { m.bias = 0.20; m.intensity = 1.5; }],
    ['F1 bias 0.35 radius 0.25 int 1.8', (e, m) => { m.bias = 0.35; m.intensity = 1.8; try { e.radius = 0.25; } catch (x) { /* */ } }],
  ];

  const rows = [];
  const keep = {};
  for (const [label, apply] of CFG) {
    const s = shot(apply);
    const d = new Float64Array(W * H);
    for (let j = 0; j < W * H; j++) d[j] = s.luma[j] - off.luma[j];
    let ns = 0, nn = 0, fs = 0, fn = 0, hs = 0, hn = 0, ls = 0, ln = 0;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const j = y * W + x;
      if (mask[j]) continue;
      const dd = dist[j];
      if (dd >= 2 && dd <= 8) { ns += d[j]; nn++; }
      else if (dd >= 14 && dd <= 26) { fs += d[j]; fn++; }
      if (dd >= 40) {
        hs += d[j]; hn++;
        ls += Math.abs(4 * d[j] - d[j - 1] - d[j + 1] - d[j - W] - d[j + W]); ln++;
      }
    }
    let dm = 0, dmax = 0;
    for (let i = 0; i < s.px.length; i += 4) {
      const q = Math.max(Math.abs(s.px[i] - off.px[i]), Math.abs(s.px[i + 1] - off.px[i + 1]), Math.abs(s.px[i + 2] - off.px[i + 2]));
      dm += q; if (q > dmax) dmax = q;
    }
    const contactNear = nn ? ns / nn : 0, contactFar = fn ? fs / fn : 0;
    rows.push({
      label,
      contactNear: +contactNear.toFixed(5), contactFar: +contactFar.toFixed(5),
      contact: +(contactNear - contactFar).toFixed(5),
      haze: +(hn ? hs / hn : 0).toFixed(5),
      acne: +(ln ? ls / ln : 0).toFixed(6),
      ratio: ln && ls ? +Math.abs((contactNear - contactFar) / (ls / ln)).toFixed(2) : null,
      dMean: +(dm / (s.px.length / 4)).toFixed(4), dMax: dmax,
    });
    keep[label] = s.px;
  }
  restore();
  stage.render(0);

  // crops of the open floor, for looking at
  const cropOf = (px) => {
    const [cx, cy, cw, ch] = opts.crop;
    const rgb = new Uint8Array(cw * ch * 3);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const si = ((cy + y) * W + (cx + x)) * 4, di = (y * cw + x) * 3;
      rgb[di] = px[si]; rgb[di + 1] = px[si + 1]; rgb[di + 2] = px[si + 2];
    }
    let str = '';
    for (let i = 0; i < rgb.length; i += 8192) str += String.fromCharCode.apply(null, rgb.subarray(i, i + 8192));
    return btoa(str);
  };
  const pngs = { 'OFF (no AO)': cropOf(off.px) };
  for (const k of opts.pngOf) if (keep[k]) pngs[k] = cropOf(keep[k]);

  return { W, H, settings: S0, maskPx: mask.reduce((x, y) => x + y, 0), rows, pngs, crop: opts.crop };
};

if (!BASE) { console.error('PREVIEW_BASE unset — run under headserve.mjs'); process.exit(2); }
await mkdir(OUT, { recursive: true });
const st = STATIONS[STATION];
const browser = await chromium.launch({ args: LAUNCH_ARGS });
for (const id of IDS) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await page.addInitScript({ content: VL_SRC });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  page.on('pageerror', (e) => console.error('  PAGEERROR', String(e).slice(0, 200)));
  await page.goto(`${BASE}/?player=${id}&enemy=donut&px=${st.x}&py=${st.y}&fogRadius=${st.fog}&simSpeed=0.02&pointerLock=0`,
    { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
  await page.waitForTimeout(900);
  const res = await page.evaluate(CAPTURE, {
    playerId: id,
    crop: [420, 560, 760, 330],
    pngOf: ['A0 as configured', 'B2 bias 0.20', 'B3 bias 0.35', 'F1 bias 0.35 radius 0.25 int 1.8'],
  });
  if (res.error) { console.error(res.error); process.exit(1); }
  console.log(`\nAO TUNE — ${id} @ ${STATION}   shipped SSAO: ${JSON.stringify(res.settings)}`);
  console.log('config                       contactNear contactFar  contact     haze      acne  contact/acne | dMean dMax');
  for (const r of res.rows) {
    console.log(`${r.label.padEnd(28)}${r.contactNear.toFixed(5).padStart(11)}${r.contactFar.toFixed(5).padStart(11)}` +
      `${r.contact.toFixed(5).padStart(9)}${r.haze.toFixed(5).padStart(9)}${r.acne.toFixed(6).padStart(10)}` +
      `${String(r.ratio).padStart(14)} | ${String(r.dMean).padStart(6)}${String(r.dMax).padStart(5)}`);
  }
  const [, , cw, ch] = res.crop;
  const names = Object.keys(res.pngs);
  const tiles = [];
  for (let i = 0; i < names.length; i++) {
    const f = join(OUT, `${id}.${i}.png`);
    await sharp(Buffer.from(res.pngs[names[i]], 'base64'), { raw: { width: cw, height: ch, channels: 3 } }).png().toFile(f);
    tiles.push({ input: f, left: 0, top: i * (ch + 6) });
  }
  await sharp({ create: { width: cw, height: names.length * (ch + 6), channels: 3, background: { r: 10, g: 10, b: 10 } } })
    .composite(tiles).png().toFile(join(OUT, `${id}.sheet.png`));
  console.log(`sheet rows, top to bottom: ${names.join('  |  ')}`);
  await writeFile(join(OUT, `${id}.json`), JSON.stringify(res.rows, null, 2));
  await page.close();
}
await browser.close();
