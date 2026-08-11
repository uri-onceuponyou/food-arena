#!/usr/bin/env node
/**
 * IS THE POT'S BURNER INVISIBLE, OR IS IT ENCLOSED? — a §1 probe with a POSITIVE CONTROL.
 *
 * `2f05202` measured `kpal:flame` and `kpal:flameCore` at **0 delivered px** when ablated
 * to #FF00FF at opacity 1, at both `arena-scan` stations that exist to put the pot in
 * frame, while `pot_steam` moved 2,394-4,332 px in the same captures. It deliberately did
 * NOT call that a bug: *"it is not established that the flame is meant to be visible at
 * 58 degrees."* Right call — but 0 px is also what a probe that is not working returns,
 * and `docs/AGENT-BRIEF.md` §4.2 is explicit that a 0 result needs a control that MOVES.
 *
 * ── THE ARMS ────────────────────────────────────────────────────────────────
 *   base        the frame as shipped
 *   ablate      both burner materials forced to magenta at opacity 1. If this is 0 px the
 *               burner reaches the screen never — but on its own that is consistent with
 *               "the probe does not work", so:
 *   strip       `pot_solid` (base + body + rim + broth + handles, all opaque) hidden. The
 *               burner is left exactly as shipped. Whatever appears is what the pot was
 *               covering.
 *   strip+abl   POSITIVE CONTROL, and the whole point. Same ablation, same materials, same
 *               everything — with the opaque cylinder out of the way. If THIS moves and
 *               `ablate` did not, then the ablation works, the geometry is on screen, and
 *               the cause is CONTAINMENT rather than a broken instrument or a hidden mesh.
 *               If this is also 0, the finding is "the mesh is not drawn at all" and it is
 *               a different bug with a different owner.
 *
 * Containment is a claim about geometry, so it is also stated as arithmetic at the call
 * site in `src/arena/hazards.ts` (`bodyR` 2.6 m, flame cone radius 1.09 m, pot body a
 * cylinder of radius 2.60 spanning y 0.06..2.53). This probe is what makes that
 * arithmetic a measurement instead of a plausible paragraph.
 *
 *   node tools/tmp/headserve.mjs -- node tools/tmp/hw_burner.mjs --out shots/hw/burner
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg('url', process.env.PREVIEW_BASE ?? 'http://localhost:5173');
const OUT = arg('out', 'shots/hw/burner');
const W = 1600, H = 900;
/** The two `tools/arena-scan.mjs` stations whose whole purpose is to frame the pot. */
// ⚠️ RE-AIMED FOR THE ×4 MAP, 2026-08-11 (`6631446` took the arena 1400×1000 →
// 2800×2000; these defaults did not follow). **`pot_south=700:640` sat inside a `prep_counter`.**
// Coordinates are `tools/arena-scan.mjs`'s current, --selftest-validated stations for
// the same ids, and `fogRadius` is the shipped `maxSafeRadius` 1985 — the old 993 was
// the 1× value, which puts a death-zone wall through the frame. `tools/tmp/al_guard.mjs`
// fails on the old values.
const STATIONS = (arg('stations', 'pot_south=1400:1200,pot_diagonal=1140:940')).split(',').map((s) => {
  const [id, xy] = s.split('='); const [x, y] = xy.split(':').map(Number); return { id, x, y };
});
const MATS = (arg('mats', 'kpal:flame,kpal:flameCore')).split(',');

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;

/** Collect the burner materials by NAME and the opaque pot shell by object name, and
 *  record the world bounding boxes so the containment arithmetic is measured, not typed.
 *  Colours are saved as `Color` CLONES — `getHex()`/`setHex()` round-trips through 8-bit
 *  sRGB while three stores linear, which manufactured a 28 px "finding" once already. */
const PREP = `(matNames) => {
  const st = window.__stage; st.scene.updateMatrixWorld(true);
  const mats = new Map(); const solids = []; const box = (o) => {
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    return { name: o.name, minY: +bb.min.y.toFixed(3), maxY: +bb.max.y.toFixed(3),
             r: +(Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2).toFixed(3) };
  };
  const burners = [];
  st.scene.traverse((o) => {
    if (o.name === 'pot_solid') solids.push(o);
    if (!o.isMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) if (m && matNames.includes(m.name)) {
      if (!mats.has(m.uuid)) mats.set(m.uuid, { m, saved: { color: m.color ? m.color.clone() : null, opacity: m.opacity } });
      burners.push(box(o));
    }
  });
  const shell = [];
  for (const s of solids) s.traverse((o) => { if (o.isMesh) shell.push(box(o)); });
  window.__hwB = { mats: [...mats.values()], solids };
  return { burners, shell, nMats: mats.size, nSolids: solids.length };
}`;
const SET = `(mag, strip) => {
  const S = window.__hwB;
  for (const e of S.mats) {
    if (e.m.color) { if (mag) e.m.color.setHex(0xFF00FF); else e.m.color.copy(e.saved.color); }
    e.m.opacity = mag ? 1 : e.saved.opacity;
    e.m.needsUpdate = true;
  }
  for (const s of S.solids) s.visible = !strip;
  window.__stage.render(0);
}`;

async function raw(p) { const { data, info } = await sharp(p).raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height, ch: info.channels }; }
async function diff(pa, pb) {
  const A = await raw(pa), B = await raw(pb); const n = A.w * A.h;
  let changed = 0, sum = 0, max = 0;
  for (let i = 0; i < n; i++) {
    const o = i * A.ch;
    const d = Math.max(Math.abs(A.data[o] - B.data[o]), Math.abs(A.data[o + 1] - B.data[o + 1]), Math.abs(A.data[o + 2] - B.data[o + 2]));
    if (d > 0) { changed++; sum += d; if (d > max) max = d; }
  }
  return { changed, total: sum, maxDelta: max };
}

const browser = await chromium.launch({ args: LAUNCH_ARGS });
await mkdir(OUT, { recursive: true });
const results = [];
let geom = null;
for (const S of STATIONS) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=${S.x}&py=${S.y}&fogRadius=1985&simSpeed=0.02&pointerLock=0`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(`(${PREP})(${JSON.stringify(MATS)})`);
  if (!geom) geom = info;
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
  await page.waitForTimeout(300);
  const canvas = page.locator('canvas').first();
  const shot = async (tag, mag, strip) => {
    await page.evaluate(`(${SET})(${mag}, ${strip})`);
    await page.waitForTimeout(120);
    const f = `${OUT}/${S.id}_${tag}.png`;
    await canvas.screenshot({ path: f, timeout: 90000 });
    return f;
  };
  const base = await shot('base', false, false);
  const base2 = await shot('base2', false, false);
  const abl = await shot('ablate', true, false);
  const strip = await shot('strip', false, true);
  const stripAbl = await shot('strip_ablate', true, true);
  const ret = await shot('ret', false, false);
  results.push({
    id: S.id,
    self: await diff(base, base2),
    drift: await diff(base, ret),
    ablate: await diff(base, abl),
    strip: await diff(base, strip),
    stripAblate: await diff(strip, stripAbl),
  });
  await page.close();
}
await browser.close();

console.log(`\nTHE GEOMETRY, read off the live scene (world units, r = half the wider horizontal extent)`);
console.log('  BURNER');
for (const b of geom.burners) console.log(`    ${b.name.padEnd(30)} r ${String(b.r).padStart(6)}   y ${String(b.minY).padStart(7)} .. ${b.maxY}`);
console.log('  OPAQUE POT SHELL (pot_solid)');
for (const b of geom.shell) console.log(`    ${b.name.padEnd(30)} r ${String(b.r).padStart(6)}   y ${String(b.minY).padStart(7)} .. ${b.maxY}`);

console.log(`\nDELIVERED PIXELS  (${W}x${H} = ${(W * H).toLocaleString()} px, exact diff)`);
console.log('  station        self  drift   ABLATE vs base       strip vs base        ABLATE vs strip  (the POSITIVE CONTROL)');
for (const r of results) {
  const c = (d) => `${String(d.changed).padStart(8)}px d${String(d.total).padStart(8)}`;
  console.log(`  ${r.id.padEnd(13)} ${String(r.self.changed).padStart(5)} ${String(r.drift.changed).padStart(6)}  ${c(r.ablate)}  ${c(r.strip)}  ${c(r.stripAblate)}`);
}

let fail = 0;
const ok = (nm, cond, got) => { if (cond) console.log(`  ok   ${nm}`); else { fail++; console.log(`  FAIL ${nm}   got ${got}`); } };
console.log('\nCHECKS');
ok('both burner materials were found and driven', geom.nMats === MATS.length, `${geom.nMats} of ${MATS.length}`);
ok('the opaque pot shell was found and can be hidden', geom.nSolids > 0, geom.nSolids);
ok('self-pair 0 px at every station — "no change" is distinguishable from "cannot see change"', results.every((r) => r.self.changed === 0), results.map((r) => r.self.changed).join(','));
ok('RETURN drift 0 px at every station — the arms are comparable', results.every((r) => r.drift.changed === 0), results.map((r) => r.drift.changed).join(','));
ok('POSITIVE CONTROL: with the shell hidden the ablation MOVES the frame at every station', results.every((r) => r.stripAblate.changed > 0), results.map((r) => r.stripAblate.changed).join(','));
// Not a pass/fail: this is the finding, and it is printed as a verdict rather than gated,
// because "the burner should be visible" is a design call and not this probe's to make.
console.log('\nVERDICT');
for (const r of results) {
  const v = r.ablate.changed === 0 && r.stripAblate.changed > 0
    ? `ENCLOSED — 0 delivered px as shipped, ${r.stripAblate.changed} px with the opaque shell hidden. The burner is drawn, and the pot contains it.`
    : r.ablate.changed === 0 ? 'NOT DRAWN AT ALL — even with the shell hidden the ablation is 0 px. Different bug, different owner.'
      : `VISIBLE — ${r.ablate.changed} px delivered as shipped.`;
  console.log(`  ${r.id.padEnd(13)} ${v}`);
}
console.log(`\nhw_burner  ${5 - fail}/5`);
console.log(`wrote ${OUT}/`);
process.exit(fail ? 1 : 0);
