#!/usr/bin/env node
/**
 * V1_TILESWEEP — the AUTHORED -> RENDERED saturation transfer for the stone field,
 * measured on the shipped frame instead of guessed from a comment.
 *
 * ## Why this exists
 *
 * `src/arena/shared.ts`'s palette block states the transfer as prose: *"rendered HSV
 * saturation lands about +0.10 to +0.15 above authored"*. Round 3 of item 1 has to land
 * the ground's RENDERED saturation on a target read off the reference plates, and an
 * additive +0.13 and a multiplicative x1.83 both reproduce the one point we have
 * (authored 0.158 -> rendered 0.290, `matcover`) while disagreeing by **0.15** at the
 * value this round is choosing. That is larger than the entire move. So the curve is
 * measured at seven points in ONE browser session, on the live shipped frame, before a
 * constant is written into `floor.ts`.
 *
 * A live material override is the right instrument here for the same reason
 * `tools/tmp/simfix.mjs` exists: it prices a palette change as a number rather than as a
 * request, and every arm shares one boot, one camera and one sim state, so the only
 * thing that differs between arms is the constant under test.
 *
 * ⚠️ **A live override is a PROBE, not the ship.** The chosen value is re-measured on a
 * real rebuild in a detached worktree, because an override cannot prove that editing
 * `floor.ts` reaches the same material.
 *
 * ## THE GUARDS, AND WHAT EACH ONE IS PINNED TO
 *
 *   FOUND        the two stone meshes are located BY NAME (`floor_stones_light` /
 *                `floor_stones_dark`) and the set is asserted NON-EMPTY before anything
 *                is measured over it. `[].every()` returns true, and `AGENT-BRIEF §3`:
 *                an UNNAMED mesh is invisible to every diagnostic here.
 *   IN-SHOT      the stone field must actually cover a large share of the frame. An arm
 *                that photographs the sky and reports PASS is this round's named failure
 *                mode; measured as the share of pixels that MOVE under the ablation.
 *   ABLATION     before the sweep, the field is set to an unmissable colour and the frame
 *                must MOVE by a large margin. If it does not, the lever is not the lever
 *                and every number after it is a description of something else.
 *   SELF-PAIR    the first value is rendered TWICE and the two readbacks must be
 *                byte-identical. Camera shake re-randomises on every `render()`
 *                (`CameraRig.update` scales the DECAY by dt and not the randomisation),
 *                so the shake is zeroed explicitly rather than hoped about.
 *   RESTORE      the original colours are restored and the final frame must return to
 *                byte-identity with the first. A sweep that cannot get back is a sweep
 *                whose later arms carry the earlier ones.
 *
 * Use:
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-v1r3-before -- \
 *     node tools/tmp/v1_tilesweep.mjs --url '{URL}' --out tools/tmp/v1_sweep
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import sharp from 'sharp';

const ROOT = resolve(process.argv[1], '../../..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg('url', process.env.PREVIEW_BASE);
if (!BASE) { console.error('need --url or PREVIEW_BASE'); process.exit(2); }
if (/:5173(\/|$)/.test(BASE)) { console.error('\n!! --url is the SHARED dev server. Never measure there.\n'); process.exit(2); }
const OUT = resolve(ROOT, arg('out', 'tools/tmp/v1_sweep'));
mkdirSync(OUT, { recursive: true });

// The station is DERIVED, never retyped: `tools/arena.gameplay.json`'s centre plus an
// offset in the pot's own radius, exactly as `q1_capture.mjs --preflight` validates it.
const gameplay = JSON.parse(readFileSync(join(ROOT, 'tools/arena.gameplay.json'), 'utf8'));
const CX = gameplay.center?.x, CY = gameplay.center?.y;
if (!Number.isFinite(CX) || !Number.isFinite(CY)) { console.error('could not derive arena centre from tools/arena.gameplay.json'); process.exit(2); }
// The pot is the `damage` hazard standing ON the centre — found, never retyped.
const pot = (gameplay.hazards ?? []).find((h) => h.kind === 'damage' && h.x === CX && h.y === CY);
if (!pot) { console.error('could not find the centre pot hazard in tools/arena.gameplay.json'); process.exit(2); }
const POTR = pot.radius;
const PX = Math.round(CX + 1.684 * POTR), PY = Math.round(CY);
// 🚨 AND THE FOG RADIUS IS DERIVED TOO — THIS LINE SHIPPED A 1x LITERAL AND `al_guard`
// CAUGHT IT. The first version copied `matcover.mjs`'s URL literal verbatim: 850, which is
// the **1x map's** maxSafeRadius; the map has been 2800x2000 since `6631446` and the real
// figure is 1720.465. It is the exact class `CLAUDE.md` warns about — the 1x playfield is
// the NW quadrant of the x4 one, so a stale scalar is still a LEGAL scalar and no
// legality check can see it. This file's own header boasted about deriving the station
// while the radius beside it was retyped.
// ⚠️ It did not move the SHAPE of the sweep — all seven arms shared one radius and the
// station is 160 wu from centre, far inside 850 — but the fixture was wrong and a wrong
// fixture keeps its numbers perfectly.
const FOG = gameplay.maxSafeRadius;
if (!Number.isFinite(FOG)) { console.error('could not derive maxSafeRadius from tools/arena.gameplay.json'); process.exit(2); }

// Candidate albedos. Constructed by holding the MAX CHANNEL (HSV value) and the HUE and
// moving only S — the exact single-variable change the round-2 critic prescribed. The
// first entry is the SHIPPED pair, so arm 0 is the control and must reproduce the
// untouched capture.
const VALUES = (arg('values', '0.158,0.220,0.260,0.300,0.340,0.380,0.420')).split(',').map(Number);
function build(maxc, k, S) { const d = maxc * S; const g = Math.round(maxc - d); const b = Math.round(g - k * d); return [maxc, g, b]; }
const hexOf = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('').toUpperCase();
const pairFor = (S) => ({
  light: hexOf(build(120, -0.368421, S)),          // #78656C's own max and hue
  dark: hexOf(build(113, -0.388889, S)),           // #715F66's own max and hue
  joint: hexOf(build(120, -0.368421, S).map((v) => Math.round(v * 0.871))),  // round 2's authored 1.147 luma ratio
});

// 🚨 THE AUTHORED HEX IS NOT WHAT THE MATERIAL HOLDS AT RUNTIME, AND THIS PROBE'S FIRST
// VERSION WAS WRONG BECAUSE OF IT. `kitchen.ts:1295` calls `shared.ts`'s
// `liftArenaValue(root)`, which walks EVERY arena material once and rewrites its colour
// as V' = V^0.72 with the RGB ratios preserved (`ARENA_VALUE_GAMMA`). So the live
// `floor_stones_light` material reads **#947D85**, not `floor.ts`'s `#78656C` — measured,
// and it is why arm 0 of the first run did not reproduce the shipped frame and the
// RESTORE guard went red. The lift is a UNIFORM RGB scale, so it moves value ONLY: hue
// and HSV saturation come through it untouched, which is exactly why holding the authored
// max channel is still the right construction. A live override has to apply the lift
// itself, because the override happens AFTER `liftArenaValue` has already run.
const ARENA_VALUE_GAMMA = 0.72;
function lift(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const v = Math.max(r, g, b);
  if (v <= 0.02) return hex;
  const k = Math.pow(v, ARENA_VALUE_GAMMA) / v;
  return hexOf([r, g, b].map((c) => Math.round(Math.min(1, c * k) * 255)));
}
const liftedPair = (S) => { const p = pairFor(S); return { light: lift(p.light), dark: lift(p.dark), joint: lift(p.joint), authored: p }; };

const browser = await chromium.launch({ args: [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
// 🚨 HOLD rAF, and install it via addInitScript so it is in place BEFORE the app takes
// its own reference. Two renders 400 ms apart are not the same frame otherwise, and the
// SELF-PAIR arm below correctly refused to sweep until this was here.
await page.addInitScript(() => {
  const real = window.requestAnimationFrame.bind(window);
  let held = null;
  window.requestAnimationFrame = (cb) => { if (held !== null) { held = cb; return -1; } return real(cb); };
  window.__v1Raf = { stop() { if (held === null) held = false; }, start() { const cb = held; held = null; if (typeof cb === 'function') real(cb); } };
});
await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=${PX}&py=${PY}&fogRadius=${FOG}&simSpeed=0.02&pointerLock=0`,
  { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });
await page.waitForTimeout(1500);

await page.evaluate(() => window.__v1Raf.stop());
await page.waitForTimeout(400);

const setup = await page.evaluate(() => {
  const stage = window.__stage;
  if (!stage) return { error: 'no window.__stage' };
  if (stage.renderer.setAnimationLoop) stage.renderer.setAnimationLoop(null);
  // Stash the ORIGINAL colours as FLOATS, per material uuid. RESTORE writes these back
  // rather than re-deriving the lift offline: `liftArenaValue` writes un-quantised floats
  // and this file's `lift()` rounds to 8 bits, so a re-derived restore lands a hair away
  // and the guard reports DIFFERS forever. A guard that always fires gets switched off
  // (`3230abf`), and this one has already earned its keep — it is what caught the lift.
  window.__v1Orig = [];
  stage.scene.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === 'floor_stones_light' || o.name === 'floor_stones_dark' || o.name === 'floor_base') {
      window.__v1Orig.push({ name: o.name, r: o.material.color.r, g: o.material.color.g, b: o.material.color.b });
    }
  });
  // Zero the shake: `CameraRig.update()` re-randomises it on EVERY render.
  const rig = stage.rig;
  for (const k of ['shake', 'shakeAmp', 'shakeMag', 'trauma', 'shakeStrength']) if (typeof rig?.[k] === 'number') rig[k] = 0;
  const found = [];
  stage.scene.traverse((o) => { if (o.isMesh && (o.name === 'floor_stones_light' || o.name === 'floor_stones_dark')) found.push(o.name); });
  const mats = [];
  stage.scene.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === 'floor_stones_light' || o.name === 'floor_stones_dark') mats.push({ name: o.name, hex: '#' + o.material.color.getHexString().toUpperCase(), matName: o.material.name });
  });
  return { found, mats, w: stage.renderer.domElement.width, h: stage.renderer.domElement.height };
});
if (setup.error) { console.error(setup.error); await browser.close(); process.exit(1); }
// FOUND — asserted NON-EMPTY before anything is measured over the set.
if (setup.found.length === 0) { console.error('FOUND: no floor_stones_* mesh in the scene — the lever does not exist here'); await browser.close(); process.exit(1); }
console.log(`  station (${PX},${PY}) derived from centre (${CX},${CY}) + 1.684x potR ${POTR}`);
console.log(`  FOUND ${setup.found.length} stone mesh(es): ${setup.found.join(', ')}`);
for (const m of setup.mats) console.log(`     ${m.name.padEnd(20)} material "${m.matName}" color ${m.hex}`);

// One render + readback, downsampled 2x, returned as base64 RGB. The full-res buffer is
// 5.76 MB per arm and seven of those through the CDP bridge is minutes of nothing.
async function shoot(setColors) {
  return await page.evaluate(({ setColors }) => {
    const stage = window.__stage;
    const targets = [];
    stage.scene.traverse((o) => { if (o.isMesh && (o.name === 'floor_stones_light' || o.name === 'floor_stones_dark')) targets.push(o); });
    const echo = [];
    if (setColors === 'restore') {
      const orig = window.__v1Orig;
      stage.scene.traverse((o) => {
        if (!o.isMesh) return;
        const e = orig.find((x) => x.name === o.name);
        if (!e) return;
        o.material.color.setRGB(e.r, e.g, e.b); o.material.needsUpdate = true;
        echo.push({ name: o.name, set: 'ORIGINAL', readBack: '#' + o.material.color.getHexString().toUpperCase() });
      });
    } else if (setColors) {
      for (const o of targets) {
        const hex = o.name === 'floor_stones_light' ? setColors.light : setColors.dark;
        o.material.color.set(hex); o.material.needsUpdate = true;
        echo.push({ name: o.name, set: hex, readBack: '#' + o.material.color.getHexString().toUpperCase() });
      }
      if (setColors.joint) {
        stage.scene.traverse((o) => { if (o.isMesh && o.name === 'floor_base') { o.material.color.set(setColors.joint); o.material.needsUpdate = true; echo.push({ name: o.name, set: setColors.joint, readBack: '#' + o.material.color.getHexString().toUpperCase() }); } });
      }
    }
    stage.render(0.0);
    const r = stage.renderer, gl = r.getContext();
    const W = r.domElement.width, H = r.domElement.height;
    const buf = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    // 2x box downsample AND vertical flip (readPixels is bottom-up) in one pass.
    const w2 = W >> 1, h2 = H >> 1;
    const out = new Uint8Array(w2 * h2 * 3);
    for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
      const sy = H - 1 - (y * 2);
      let R = 0, G = 0, B = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const p = ((sy - dy) * W + (x * 2 + dx)) * 4;
        R += buf[p]; G += buf[p + 1]; B += buf[p + 2];
      }
      const q = (y * w2 + x) * 3;
      out[q] = R >> 2; out[q + 1] = G >> 2; out[q + 2] = B >> 2;
    }
    let s = ''; const CH = 0x8000;
    for (let i = 0; i < out.length; i += CH) s += String.fromCharCode.apply(null, out.subarray(i, i + CH));
    return { w: w2, h: h2, b64: btoa(s), echo };
  }, { setColors });
}

// ── statistics, identical definitions to tools/tmp/v1_sat.mjs ────────────────
function frameStats(px, w, h) {
  const N = w * h; const sH = new Uint32Array(1001);
  const HB = 24, SB = 8, VB = 8;
  const hist = new Float64Array(HB * SB * VB), sSum = new Float64Array(hist.length), vSum = new Float64Array(hist.length);
  let sTot = 0, vTot = 0;
  for (let i = 0; i < N; i++) {
    const r = px[i * 3], g = px[i * 3 + 1], b = px[i * 3 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const s = mx === 0 ? 0 : d / mx, v = mx / 255;
    sH[Math.round(s * 1000)]++; sTot += s; vTot += v;
    let hue = 0;
    if (d) { hue = 60 * (mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? ((b - r) / d + 2) : ((r - g) / d + 4)); }
    const sb = Math.min(SB - 1, Math.floor(s * SB));
    const hb = sb === 0 ? 0 : Math.min(HB - 1, Math.floor(hue / 15));
    const vb = Math.min(VB - 1, Math.floor(v * VB));
    const idx = (hb * SB + sb) * VB + vb;
    hist[idx]++; sSum[idx] += s; vSum[idx] += v;
  }
  const pct = (p) => { let a = 0; for (let i = 0; i <= 1000; i++) { a += sH[i]; if (a >= N * p) return i / 1000; } return 1; };
  const used = new Uint8Array(hist.length); const masses = [];
  for (let m = 0; m < 3; m++) {
    let best = -1, bc = 0;
    for (let i = 0; i < hist.length; i++) if (!used[i] && hist[i] > bc) { bc = hist[i]; best = i; }
    if (best < 0 || bc === 0) break;
    const vb0 = best % VB, sb0 = Math.floor(best / VB) % SB, hb0 = Math.floor(best / (SB * VB));
    let c = 0, ss = 0, vv = 0;
    for (let dh = -1; dh <= 1; dh++) for (let ds = -1; ds <= 1; ds++) for (let dv = -1; dv <= 1; dv++) {
      const sb = sb0 + ds, vb = vb0 + dv; if (sb < 0 || sb >= SB || vb < 0 || vb >= VB) continue;
      const hb = sb0 === 0 && sb === 0 ? 0 : (hb0 + dh + HB) % HB;
      const idx = (hb * SB + sb) * VB + vb; if (used[idx]) continue;
      used[idx] = 1; c += hist[idx]; ss += sSum[idx]; vv += vSum[idx];
    }
    if (c > 0) masses.push({ share: c / N, s: ss / c, v: vv / c });
  }
  return { sP25: pct(0.25), sP50: pct(0.50), sP90: pct(0.90), sMean: sTot / N, vMean: vTot / N, masses };
}
const decode = (r) => ({ px: Buffer.from(r.b64, 'base64'), w: r.w, h: r.h, echo: r.echo });
const movedShare = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 12) n++; return n / (a.length / 3); };
const f3 = (x) => x.toFixed(3);

// ── ABLATION + SELF-PAIR, before any number is believed ──────────────────────
const base = decode(await shoot(null));
const base2 = decode(await shoot(null));
const identical = Buffer.compare(base.px, base2.px) === 0;
console.log(`  SELF-PAIR  same state rendered twice: ${identical ? 'BYTE-IDENTICAL' : '*** DIFFERS ***'}`);
if (!identical) { console.error('  refusing to sweep on a frame that will not hold still'); await browser.close(); process.exit(1); }
const abl = decode(await shoot({ light: '#00FF00', dark: '#00FF00' }));
// 🚨 SET != READ-BACK would mean the hex written into `floor.ts` is not the hex the
// material ends up holding, and every calibration below would be off by that transform.
for (const e of abl.echo ?? []) console.log(`  ECHO       ${e.name.padEnd(20)} set ${e.set} -> reads ${e.readBack}${e.set === e.readBack ? '' : '   *** ASYMMETRIC ***'}`);
const ablShare = movedShare(base.px, abl.px);
console.log(`  ABLATION   stone field to an unmissable green moves ${(ablShare * 100).toFixed(1)}% of the frame`);
if (ablShare < 0.15) { console.error('  IN-SHOT FAILED: the stone field is not a large part of this frame — the sweep would describe something else'); await browser.close(); process.exit(1); }

const rows = [];
for (const S of VALUES) {
  const pair = liftedPair(S);
  const r = decode(await shoot(pair));
  const st = frameStats(r.px, r.w, r.h);
  rows.push({ S, authored: pair.authored, applied: { light: pair.light, dark: pair.dark, joint: pair.joint }, ...st });
  await sharp(r.px, { raw: { width: r.w, height: r.h, channels: 3 } }).png().toFile(join(OUT, `tile_S${S.toFixed(3)}.png`));
  console.log(`  S=${S.toFixed(3)} authored ${pair.authored.light}/${pair.authored.dark} (lifted ${pair.light}/${pair.dark})  ->  frame p25 ${f3(st.sP25)}  p50 ${f3(st.sP50)}  p90 ${f3(st.sP90)}  Vmean ${f3(st.vMean)}   mass#1 ${(st.masses[0].share * 100).toFixed(1)}% @ S ${f3(st.masses[0].s)} V ${f3(st.masses[0].v)}`);
}

// ── RESTORE: get back to the shipped pair and require byte-identity with arm 0 ──
const back = decode(await shoot('restore'));
const restored = Buffer.compare(base.px, back.px) === 0;
console.log(`  RESTORE    original floats written back: ${restored ? 'BYTE-IDENTICAL to the control' : '*** DIFFERS — later arms carried earlier ones ***'}`);

writeFileSync(join(OUT, 'sweep.json'), JSON.stringify({ station: [PX, PY], selfPair: identical, ablationShare: ablShare, restored, rows }, null, 2));
console.log(`\n  wrote ${join(OUT, 'sweep.json')} and ${rows.length} PNGs`);
await browser.close();
