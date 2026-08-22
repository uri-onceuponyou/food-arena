#!/usr/bin/env node
/**
 * WT_ABLATE — which TERM of the puddle surface shader is painting the pool white?
 *
 * ## Why this exists
 *
 * Rounds 1 and 2 added five additive light terms to one pool (`hazards.ts`,
 * `patchPuddleFragment`: `faBand + faSky + faRip + faFoam + faShore`), each of them
 * measured on its own at the time it landed. Nothing has ever measured the SUM. At the
 * match camera the water pool now reads as frosted glass rather than liquid, and
 * "which of the five is doing that" is a question no existing tool here can answer:
 * every one of them is a `+` into the same `faL`.
 *
 * ## 🚨 THE EXISTING POOL MASK CANNOT SEE THIS DEFECT — IT IS HUE-CLASSIFIED
 *
 * `wt_vol.mjs` masks the pool with `hue in [178,224] AND s >= 0.24`. A pixel the sky
 * term has washed to near-white FAILS the saturation floor and drops OUT of the mask.
 * So the whiter the pool gets, the smaller the region the "is the pool too pale?"
 * question is asked over — the mask is blind to exactly the pixels the defect lives in.
 * That is `CLAUDE.md` #6's vacuity class wearing a different coat: not `[].every()`,
 * but a filter that removes the evidence before the assertion runs.
 *
 * → THE MASK HERE IS GEOMETRIC AND EXACT. One extra render arm makes the pool BODY
 *   flat opaque green with the surface overlay hidden, and the green pixels ARE the
 *   pool's screen disc. Nothing about the surface shading can move it, so every arm is
 *   measured over the identical region by construction rather than by promise.
 *
 * ## How the terms are reached without rebuilding
 *
 * `puddleSurfaceMaterial` closes over its uniform objects, so they are not on the
 * material. They ARE on `renderer.properties.get(material).uniforms` — three assigns
 * `materialProperties.uniforms = parameters.uniforms` after `onBeforeCompile` runs
 * (`three.module.js:16931`, read in the installed 0.180.0), and those are the same
 * `{value}` objects the closure holds. Setting one and re-rendering ablates a term in
 * about a millisecond, with no edit, no rebuild and no second snapshot.
 *
 * ## Rule 6 — MOVES, HOLDS, NON-EMPTY
 *
 *   NON-EMPTY  the uniform block must actually contain the names being driven, and the
 *              geometric mask must be non-empty, both asserted BEFORE any mean is taken.
 *   MOVES      every arm must change a non-trivial number of pixels. An arm that zeroes
 *              a term and changes NOTHING means the term is dead or the probe is
 *              pointed at the wrong material — either way the run is void, not "clean".
 *   HOLDS      a null arm re-renders and re-shoots with NO mutation at all and must
 *              come back at exactly 0 differing pixels, which is what makes every
 *              non-zero count above attributable to the mutation rather than to the
 *              capture path.
 *
 *   node tools/tmp/wt_ablate.mjs --selftest
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-wt3 -- \
 *     node tools/tmp/wt_ablate.mjs --url '{URL}' --out tools/tmp/wt_r3_abl
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { realpathSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { rgbToHsv } from './wt_shot.mjs';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes('--' + k);

async function raster(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

/** Same station extraction as `wt_shot` — derived from source, never retyped. */
function waterStation(repo) {
  const shared = readFileSync(`${repo}/src/arena/shared.ts`, 'utf8');
  const kitchen = readFileSync(`${repo}/src/arena/kitchen.ts`, 'utf8');
  const num = (src, re, what) => {
    const m = src.match(re);
    if (!m) throw new Error(`wt_ablate: could not read ${what} — the extractor is stale`);
    return Number(m[1]);
  };
  const W = num(shared, /export const ARENA_W\s*=\s*([\d.]+)/, 'ARENA_W');
  const H = num(shared, /export const ARENA_H\s*=\s*([\d.]+)/, 'ARENA_H');
  const sx = num(kitchen, /const puddleSouth = \{ x: ([\d.]+),/, 'puddleSouth.x');
  const sy = num(kitchen, /const puddleSouth = \{ x: [\d.]+, y: ([\d.]+),/, 'puddleSouth.y');
  return { water: { x: W - sx, y: H - sy }, grease: { x: sx, y: sy } };
}

/**
 * Green-screen mask -> boolean array. The mask arm paints the body pure green with
 * every light term off, so "is this pixel the pool" is a hue test with an enormous
 * margin rather than a threshold anyone has to defend.
 */
export function greenMask(img) {
  const { width: w, height: h, channels: ch } = img;
  const m = new Uint8Array(w * h);
  let n = 0;
  for (let p = 0, i = 0; p < w * h; p++, i += ch) {
    const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
    if (g > 110 && g > r + 55 && g > b + 55) { m[p] = 1; n++; }
  }
  return { m, n, w, h };
}

/** Mean luma, mean HSV saturation, and the washed-out fraction inside a mask. */
export function poolStats(img, mask, satWashed = 0.35) {
  if (mask.n === 0) throw new Error('wt_ablate: pool mask is EMPTY — nothing to average over');
  const ch = img.channels;
  let L = 0, S = 0, washed = 0;
  for (let p = 0, i = 0; p < mask.w * mask.h; p++, i += ch) {
    if (!mask.m[p]) continue;
    const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
    L += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const { s } = rgbToHsv(r, g, b);
    S += s;
    if (s < satWashed) washed++;
  }
  return { luma: +(L / mask.n).toFixed(2), sat: +(S / mask.n).toFixed(4), washedFrac: +(washed / mask.n).toFixed(4), n: mask.n };
}

/** Mean luma of the floor ring just OUTSIDE the mask — the surface the pool lies on. */
export function ringLuma(img, mask, band = 26) {
  const { w, h, m } = mask;
  const ch = img.channels;
  // Dilate the mask by `band` on a coarse grid, then take dilated-minus-mask.
  let L = 0, n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (m[p]) continue;
      let near = false;
      for (let dy = -band; dy <= band && !near; dy += 4) {
        for (let dx = -band; dx <= band && !near; dx += 4) {
          const yy = y + dy, xx = x + dx;
          if (yy < 0 || yy >= h || xx < 0 || xx >= w) continue;
          if (m[yy * w + xx]) near = true;
        }
      }
      if (!near) continue;
      const i = p * ch;
      L += 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
      n++;
    }
  }
  if (n === 0) throw new Error('wt_ablate: floor ring is EMPTY');
  return { luma: +(L / n).toFixed(2), n };
}

function diffPx(a, b) {
  const ch = a.channels;
  let d = 0;
  for (let i = 0; i < a.data.length; i += ch) {
    if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) d++;
  }
  return d;
}

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

/**
 * The page-side driver. Installed ONCE per page load; every arm is a call into it.
 * Returns the uniform names it can actually see so the caller can assert on them —
 * a probe that silently drives a name nothing reads is the "photographed the sky"
 * failure with better manners.
 */
const DRIVER = `
window.__wtAbl = (() => {
  const stage = window.__stage;
  if (!stage) throw new Error('no __stage');
  const surfName = 'puddle_water_surface__no_outline';
  let surf = null;
  stage.scene.traverse((o) => { if (o.name === surfName) surf = o; });
  if (!surf) throw new Error('surface mesh not found: ' + surfName);
  const group = surf.parent;
  let body = null;
  for (const c of group.children) if (c.name === 'puddle') body = c;
  if (!body) throw new Error('body mesh not found in the puddle group');
  const props = stage.renderer.properties;
  const draw = () => { stage.render(0); stage.render(0); stage.render(0); };
  draw();
  const u = () => props.get(surf.material).uniforms || {};
  const ub = () => props.get(body.material).uniforms || {};
  const saved = {};
  const snapshot = () => {
    const s = u(), b = ub();
    saved.fres = s.uPFres ? s.uPFres.value.clone() : null;
    saved.band = s.uPBand ? s.uPBand.value.clone() : null;
    saved.ripple = s.uPRipple ? s.uPRipple.value.clone() : null;
    saved.foam = s.uPFoam ? s.uPFoam.value.clone() : null;
    saved.bdepth = b.uBDepth ? b.uBDepth.value.clone() : null;
    saved.bodyColor = body.material.color.clone();
    saved.surfVisible = surf.visible;
    saved.bodyVisible = body.visible;
  };
  snapshot();
  return {
    names: { surf: Object.keys(u()), body: Object.keys(ub()) },
    draw,
    reset() {
      const s = u(), b = ub();
      if (saved.fres) s.uPFres.value.copy(saved.fres);
      if (saved.band) s.uPBand.value.copy(saved.band);
      if (saved.ripple) s.uPRipple.value.copy(saved.ripple);
      if (saved.foam) s.uPFoam.value.copy(saved.foam);
      if (saved.bdepth) b.uBDepth.value.copy(saved.bdepth);
      body.material.color.copy(saved.bodyColor);
      if (saved.mapImage && surf.material.map) { surf.material.map.image = saved.mapImage; surf.material.map.needsUpdate = true; saved.mapImage = null; }
      surf.visible = saved.surfVisible;
      body.visible = saved.bodyVisible;
      draw();
    },
    set(path, value) {
      const s = u(), b = ub();
      const map = { fres: s.uPFres, band: s.uPBand, ripple: s.uPRipple, foam: s.uPFoam, bdepth: b.uBDepth };
      const [k, comp] = path.split('.');
      if (!map[k]) throw new Error('no such uniform: ' + k);
      map[k].value[comp] = value;
      draw();
    },
    maskArm() {
      const b = ub();
      surf.visible = false;
      if (b.uBDepth) { b.uBDepth.value.x = 1; b.uBDepth.value.y = 1; b.uBDepth.value.w = 0; }
      body.material.color.setRGB(0, 1, 0);
      draw();
    },
    hide(which) { (which === 'surf' ? surf : body).visible = false; draw(); },
    // Clear the AUTHORED canvas to fully transparent without touching the material.
    // Swapping \`map = null\` would drop USE_MAP, and the patched fragment reads
    // \`vMapUv\` — the shader would fail to compile and the arm would measure a broken
    // program rather than an absent texture. Re-uploading the same-sized image keeps
    // the program identical by construction.
    clearMap() {
      const tex = surf.material.map;
      if (!tex || !tex.image) throw new Error('no authored map on the surface material');
      const c = document.createElement('canvas');
      c.width = tex.image.width; c.height = tex.image.height;
      saved.mapImage = tex.image;
      tex.image = c; tex.needsUpdate = true;
      draw();
    },
  };
})();
true;
`;

async function shootArm(page, out, name) {
  const buf = await page.locator('canvas').first().screenshot({ timeout: 120_000 });
  await writeFile(`${out}/${name}.png`, buf);
  return raster(buf);
}

async function selftest() {
  let fails = 0;
  const ok = (n, c, e = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${e}`); if (!c) fails++; };
  const plant = (px) => {
    const w = px.length, h = 1;
    const data = Buffer.alloc(w * h * 4);
    px.forEach((c, i) => { data[i * 4] = c[0]; data[i * 4 + 1] = c[1]; data[i * 4 + 2] = c[2]; data[i * 4 + 3] = 255; });
    return { data, width: w, height: h, channels: 4 };
  };
  // §A the green mask MOVES and HOLDS on planted pixels.
  const img = plant([[0, 255, 0], [120, 90, 140], [0, 255, 0], [255, 255, 255]]);
  const mk = greenMask(img);
  ok('A1 MOVES  pure green classifies', mk.n === 2, `n=${mk.n}`);
  ok('A2 HOLDS  white does NOT classify as pool', mk.m[3] === 0, '');
  ok('A3 HOLDS  a floor tile does NOT classify', mk.m[1] === 0, '');
  // §B NON-EMPTY guards fire rather than returning a number over nothing.
  ok('B1 poolStats throws on an empty mask', (() => {
    try { poolStats(img, { m: new Uint8Array(4), n: 0, w: 4, h: 1 }); return false; } catch { return true; }
  })(), '');
  ok('B2 ringLuma throws on an all-mask frame', (() => {
    try { ringLuma(img, { m: new Uint8Array([1, 1, 1, 1]), n: 4, w: 4, h: 1 }); return false; } catch { return true; }
  })(), '');
  // §C the washed-fraction arm is SEPARABLE — a saturated pool and a washed one must
  //    not return the same number, or the statistic cannot detect the defect it exists
  //    for. Planted, so this is a property of the code and not of a render.
  const sat = poolStats(plant([[20, 140, 210], [20, 140, 210]]), { m: new Uint8Array([1, 1]), n: 2, w: 2, h: 1 });
  const wash = poolStats(plant([[225, 240, 250], [225, 240, 250]]), { m: new Uint8Array([1, 1]), n: 2, w: 2, h: 1 });
  ok('C1 a saturated pool reads washedFrac 0', sat.washedFrac === 0, `s=${sat.sat}`);
  ok('C2 a washed pool reads washedFrac 1', wash.washedFrac === 1, `s=${wash.sat}`);
  ok('C3 ...and the two are far apart', wash.sat < 0.2 && sat.sat > 0.7, '');
  // §D the station extractor really parsed source and is on the x4 map.
  const st = waterStation(arg('repo', process.cwd()));
  ok('D1 water station parsed', st.water.x > 0 && st.water.y > 0, `${st.water.x},${st.water.y}`);
  ok('D2 not a 1x-map literal', st.grease.x > 1400 || st.grease.y > 1000, '');
  console.log(fails === 0 ? '\nwt_ablate selftest: ALL PASS' : `\nwt_ablate selftest: ${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
}

const isMain = (() => {
  try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();

if (isMain) {
  if (has('selftest')) await selftest();
  const BASE = (arg('url') ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
  if (!BASE) { console.error('wt_ablate: need --url or PREVIEW_BASE'); process.exit(2); }
  if (/:5173(\/|$)/.test(BASE)) { console.error('wt_ablate: --url is the SHARED dev server.'); process.exit(2); }
  const OUT = arg('out', 'tools/tmp/wt_abl');
  const T = Number(arg('t', '6.5'));
  const SPAN = Number(arg('span', '260'));
  const PITCH = Number(arg('pitch', '58'));
  const ST = waterStation(arg('repo', process.cwd())).water;
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: 1300, height: 740 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  await page.goto(`${BASE}/preview.html?piece=arena&chars=0&t=0.1`, { waitUntil: 'networkidle', timeout: 120_000 }).catch(() => {});

  const q = new URLSearchParams({ piece: 'arena', tx: String(ST.x), ty: String(ST.y), pitch: String(PITCH), t: String(T), chars: '0', shot: '1' });
  await page.goto(`${BASE}/preview.html?${q}`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForFunction('window.__previewReady === true', null, { timeout: 120_000 });
  await page.evaluate(({ span, pitch }) => {
    const s = window.__stage;
    s.rig.viewWidthUnits = span * Math.sin((pitch * Math.PI) / 180);
    s.rig.apply();
    s.render(0); s.render(0); s.render(0);
  }, { span: SPAN, pitch: PITCH });

  const names = await page.evaluate(DRIVER + '; window.__wtAbl.names;');
  console.log(`  uniforms reachable — surface: [${names.surf.join(', ')}]`);
  console.log(`  uniforms reachable — body:    [${names.body.join(', ')}]`);
  // NON-EMPTY, asserted before anything is driven.
  for (const need of ['uPFres', 'uPBand', 'uPRipple', 'uPFoam']) {
    if (!names.surf.includes(need)) { console.error(`wt_ablate: uniform ${need} NOT reachable — the probe is pointed at the wrong material`); process.exit(4); }
  }
  if (!names.body.includes('uBDepth')) { console.error('wt_ablate: uBDepth not reachable on the body'); process.exit(4); }

  const base = await shootArm(page, OUT, 'arm_baseline');

  // THE MASK ARM — geometric, exact, and it defines the region every other arm is
  // averaged over. Taken before any light term is touched so it cannot be influenced.
  //
  // 🚨 `--mask <png>` REUSES ONE MASK ACROSS TWO RUNS, AND AN A/B MUST USE IT. The mask
  // is a rendered green-screen arm, so it carries the frame's own antialiasing: two
  // runs of the identical tree came back 172179 px and 172206 px. That 27 px is small
  // against a pool of 172k, but a before/after that lets the REGION move is a
  // before/after where the denominator moved, which is the exact trap `wt_vol.mjs`
  // documents for its own hue mask. The geometry is untouched by any shading change,
  // so one mask is correct for both arms — and asserting the sizes match makes that a
  // check rather than a promise.
  await page.evaluate('window.__wtAbl.maskArm()');
  const maskImg = await shootArm(page, OUT, 'arm_mask');
  await page.evaluate('window.__wtAbl.reset()');
  const MASKPNG = arg('mask', null);
  const mask = greenMask(MASKPNG ? await raster(await (await import('node:fs/promises')).readFile(MASKPNG)) : maskImg);
  if (MASKPNG) {
    const own = greenMask(maskImg);
    console.log(`  mask supplied by --mask ${MASKPNG}: ${mask.n} px  (this run's own mask arm: ${own.n} px, delta ${own.n - mask.n})`);
    if (mask.w !== own.w || mask.h !== own.h) { console.error('wt_ablate: --mask is a different SIZE from this run\'s frames'); process.exit(4); }
  }
  if (mask.n === 0) { console.error('wt_ablate: the green mask arm produced NO pool pixels — the pool is not in shot'); process.exit(4); }
  console.log(`  geometric pool mask: ${mask.n} px of ${mask.w * mask.h} (${(100 * mask.n / (mask.w * mask.h)).toFixed(2)}% of frame)`);

  // HOLDS — the null arm. Re-render and re-shoot with no mutation at all.
  await page.evaluate('window.__wtAbl.draw()');
  const nullArm = await shootArm(page, OUT, 'arm_null');
  const nullDiff = diffPx(base, nullArm);
  console.log(`  NULL ARM (no mutation, re-rendered and re-shot): ${nullDiff} px differ  ${nullDiff === 0 ? 'EXACTLY ZERO' : '🚨 NON-ZERO — no arm below is attributable'}`);

  const ARMS = [
    ['sky0', 'fres.x', 0, 'the grazing sky reflection'],
    ['band0', 'fres.z', 0, 'the drifting specular band'],
    ['rip0', 'ripple.w', 0, 'the shore-parallel crests'],
    ['foam0', 'foam.x', 0, 'the foam flecks'],
    ['crest0', 'fres.w', 0, 'the crest gain on the sky term'],
  ];
  // ⚠️ AN ARM THAT ZEROED `uPBand.w` WAS RUN AND IS **NOT AN ABLATION** — kept per the
  // reversal rule because the result reads like a finding and is an artefact.
  // `faBand` is `smoothstep( uPBand.w, 0.0, x )`, i.e. edge0 ABOVE edge1 on purpose.
  // Setting `uPBand.w = 0` makes edge0 == edge1, which GLSL leaves UNDEFINED, and this
  // driver returned 1.0 everywhere: the pool came back +29.41 luma and 39.59% washed,
  // which would read as "the band is holding the pool DOWN". It is measuring a
  // degenerate smoothstep. The two visibility arms below answer the same question
  // (how much of the pool's brightness is the overlay at all) without touching a knob
  // whose zero is out of domain.
  const HIDE = [
    ['tex0', 'map', 'the AUTHORED canvas cleared to transparent — shader terms only'],
    ['surfoff', 'surf', 'the whole surface overlay hidden — the pool BODY alone'],
    ['bodyoff', 'body', 'the body hidden — the overlay alone over the bare floor'],
  ];

  const bStats = poolStats(base, mask);
  const ring = ringLuma(base, mask);
  const rows = [{ arm: 'baseline', ...bStats, diffPx: 0, note: '' }];
  console.log(`\n  BASELINE  pool luma ${bStats.luma}  sat ${bStats.sat}  washed(sat<0.35) ${(bStats.washedFrac * 100).toFixed(2)}%   floor ring luma ${ring.luma}  pool-floor ${(bStats.luma - ring.luma).toFixed(2)}`);
  let dead = 0;
  for (const [name, path, value, note] of ARMS) {
    await page.evaluate(({ path, value }) => window.__wtAbl.set(path, value), { path, value });
    const img = await shootArm(page, OUT, `arm_${name}`);
    await page.evaluate('window.__wtAbl.reset()');
    const s = poolStats(img, mask);
    const d = diffPx(base, img);
    if (d < 500) dead++;
    console.log(`  ${name.padEnd(8)} ${String(d).padStart(7)} px moved   luma ${String(s.luma).padStart(6)} (${(s.luma - bStats.luma).toFixed(2)})   sat ${s.sat} (${(s.sat - bStats.sat).toFixed(4)})   washed ${(s.washedFrac * 100).toFixed(2)}%   — ${note}${d < 500 ? '  🚨 DEAD ARM' : ''}`);
    rows.push({ arm: name, path, ...s, diffPx: d, note });
  }
  for (const [name, which, note] of HIDE) {
    if (which === 'map') await page.evaluate('window.__wtAbl.clearMap()');
    else await page.evaluate((w) => window.__wtAbl.hide(w), which);
    const img = await shootArm(page, OUT, `arm_${name}`);
    await page.evaluate('window.__wtAbl.reset()');
    const s = poolStats(img, mask);
    const d = diffPx(base, img);
    if (d < 500) dead++;
    console.log(`  ${name.padEnd(8)} ${String(d).padStart(7)} px moved   luma ${String(s.luma).padStart(6)} (${(s.luma - bStats.luma).toFixed(2)})   sat ${s.sat} (${(s.sat - bStats.sat).toFixed(4)})   washed ${(s.washedFrac * 100).toFixed(2)}%   — ${note}${d < 500 ? '  🚨 DEAD ARM' : ''}`);
    rows.push({ arm: name, hide: which, ...s, diffPx: d, note });
  }
  console.log(dead === 0 ? '\n  MOVES: every arm changed the frame.' : `\n  🚨 ${dead} arm(s) changed almost nothing — either the term is dead or this probe is pointed wrong.`);

  await writeFile(`${OUT}/ablate.json`, JSON.stringify({ pitch: PITCH, span: SPAN, t: T, station: ST, maskPx: mask.n, ringLuma: ring.luma, nullDiff, rows }, null, 2));
  await browser.close();
  process.exit(nullDiff === 0 && dead === 0 ? 0 : 5);
}
