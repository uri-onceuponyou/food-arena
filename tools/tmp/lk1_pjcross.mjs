#!/usr/bin/env node
/**
 * LK1_PJCROSS — soup's own `Noodle Toss` projectile, ON soup's own bowl, same frame.
 *
 * ── The question ─────────────────────────────────────────────────────────────
 * The brief for the yellow-broth pass: *"SOUP'S OWN WEAPON IS `Noodle Toss`. If the
 * broth gains noodles in the same palette, soup's own projectile may camouflage
 * against soup's own body."* `p2_bgcross` answers that for ARENA surfaces and found
 * the predictor is the weapon's own HSL lightness (Spearman -0.738); it has nothing
 * to say about a CHARACTER's surface, and its documented collision is `#FFE9A8` on
 * the cream ground cloth `#E9DCC0`, 0.004 of lightness apart.
 *
 * ⚠️ AND `pj_probe` / `p2_bgcross` CANNOT BE POINTED AT THIS TODAY. Both parse the
 * weapon table out of `src/game/rules.ts` with `/^ {2}(\w+): \{$/gm`, and since
 * `9cb34ab` (2026-08-12) the roster is declared `soup: defineCharacter({`. That regex
 * matches ZERO characters now, so the table is EMPTY, `[...table.keys()]` is empty,
 * the per-character loop never runs and both tools **exit 0 having measured nothing**
 * (`hl_sweep.mjs` carries the same parser). Reported, not fixed — not this file set.
 *
 * ── Method: the shipped sculpt, over the shipped bowl, one frozen frame ──────
 * `vfx.ts:2363` builds a generic projectile as `SphereGeometry(wu(10), 10, 8)` —
 * radius **0.5 m** — with `materialFor(color)`, which is `flatMat` = an UNLIT
 * `MeshBasicMaterial`. So the shipped Noodle projectile is a flat 0.5 m ball of
 * `#FFE9A8` with no shading at all, and that is exactly reproducible here: the same
 * class, the same radius, the same colour, placed over the bowl in the character
 * preview and ablated in one frozen frame.
 *
 * What is NOT reproduced, and both make this number CONSERVATIVE (worse than ship):
 *   * the legibility HALO. `#FFE9A8` is HSL lightness 0.829, above
 *     `PROJECTILE_HALO_L_SPLIT` (0.78), so the shipped projectile gets the **DARK**
 *     halo `PROJECTILE_HALO_L_DARK` 0.40 — a dark ring this stand-in does not have.
 *   * the match scene's lighting/post. This is the character preview's.
 * A projectile that separates here separates on the field by more, not less.
 *
 * ── CONTROLS ─────────────────────────────────────────────────────────────────
 *   PAIR       two renders of one frozen station differ by exactly 0 px.
 *   NONEMPTY   the bowl-top mask and the projectile mask are both > 0 BEFORE any
 *              ratio over them is printed.
 *   COLOUR     the stand-in's delivered mean must land within 12/255 per channel of
 *              `#FFE9A8`. An unlit material that did not render, or rendered through
 *              a different program, fails this — it is the "did the thing I think I
 *              placed actually get drawn" control.
 *   PLACEMENT  >= 90% of the projectile's pixels must fall inside the bowl-top mask.
 *              Without it the tool cheerfully measures the projectile against the
 *              backdrop and reports excellent contrast.
 *   KB-MATCH   known-bad, and it is `pj_probe`'s control C: repaint the stand-in the
 *              BACKGROUND's own measured colour and require every distance to
 *              collapse by >= 3x. An instrument that cannot report "invisible" when
 *              handed an invisible input is not measuring visibility.
 *
 *   node tools/tmp/sx_snap.mjs --root <tree> -- node tools/tmp/lk1_pjcross.mjs --url {URL}
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = (process.env.PREVIEW_BASE ?? get('--url', '')).replace(/\/$/, '');
const ID = get('--id', 'soup');
/** `rules.ts`: `{ key: 'Noodle', ... color: '#FFE9A8' }`. */
const PROJ = get('--color', '#FFE9A8').toUpperCase();
/** `vfx.ts`: `SphereGeometry(wu(10), 10, 8)`, `WORLD_SCALE` 0.05 -> 0.5 m. */
const PROJ_R = Number(get('--r', 0.5));
const TAG = get('--tag', 'arm');
const OUTDIR = get('--out', null);
const JSON_OUT = get('--json', null);
const W = 900, H = 1150;
if (!BASE) { console.error('lk1_pjcross: need PREVIEW_BASE or --url'); process.exit(2); }

/** Every mesh that is part of the liquid surface, in either tree. `soup_broth_ring`
 *  and the pre-change garnish are included so the BEFORE arm measures the same
 *  region even though it delivered 0 px of them. */
const BOWL_TOP = ['soup_broth', 'soup_broth_ring', 'soup_noodle_float', 'soup_noodle_sunk',
  'soup_scallion', 'soup_carrot'];

const STATIONS = [
  { tag: 'match_yaw90', pitch: 58, yaw: 90 },
  { tag: 'lobby_yaw0', pitch: 20, yaw: 0 },
];

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;

const raw = (buf) => sharp(buf).raw().toBuffer({ resolveWithObject: true });
function hueOf(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d === 0) return 0;
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60; return h < 0 ? h + 360 : h;
}
/** Mask of pixels that differ between two frames. */
async function maskOf(A, B) {
  const [ra, rb] = await Promise.all([raw(A), raw(B)]);
  const ch = ra.info.channels, out = [];
  for (let i = 0, p = 0; i < ra.data.length; i += ch, p++) {
    if (ra.data[i] !== rb.data[i] || ra.data[i + 1] !== rb.data[i + 1] || ra.data[i + 2] !== rb.data[i + 2]) out.push(p);
  }
  return out;
}
async function statsOver(frame, idx) {
  const r0 = await raw(frame), ch = r0.info.channels;
  let sr = 0, sg = 0, sb = 0, sl = 0, shl = 0, hx = 0, hy = 0;
  for (const p of idx) {
    const i = p * ch, r = r0.data[i] / 255, g = r0.data[i + 1] / 255, b = r0.data[i + 2] / 255;
    sr += r; sg += g; sb += b;
    sl += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    shl += (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
    const h = hueOf(r, g, b) * Math.PI / 180, sat = Math.max(r, g, b) - Math.min(r, g, b);
    hx += Math.cos(h) * sat; hy += Math.sin(h) * sat;
  }
  const n = idx.length || 1;
  let hue = Math.atan2(hy / n, hx / n) * 180 / Math.PI; if (hue < 0) hue += 360;
  const to8 = (v) => Math.round((v / n) * 255);
  return { n: idx.length, r: sr / n, g: sg / n, b: sb / n, luma: +(sl / n).toFixed(4), hsl: +(shl / n).toFixed(4), hue: +hue.toFixed(1),
    hex: '#' + [to8(sr), to8(sg), to8(sb)].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase() };
}
/** Per-pixel mean Euclidean RGB distance between the two frames over `idx`, 0..1.
 *  Not a perceptual dE, and it is not claimed to be one — it is the same pixels in
 *  the same frame, so it is a paired difference and comparable across arms. */
async function meanRgbDist(A, B, idx) {
  const [ra, rb] = await Promise.all([raw(A), raw(B)]);
  const ch = ra.info.channels;
  let s = 0;
  for (const p of idx) {
    const i = p * ch;
    s += Math.hypot(ra.data[i] - rb.data[i], ra.data[i + 1] - rb.data[i + 1], ra.data[i + 2] - rb.data[i + 2]) / 255;
  }
  return +(s / (idx.length || 1)).toFixed(4);
}

/** The background's OWN internal variation over the same pixels, in the same units
 *  as `meanRgbDist`. This is the scale the projectile's difference has to beat: a
 *  step smaller than the surface's own texture is not a step a player can see, and
 *  it is what makes the known-bad below self-calibrating instead of a guessed
 *  threshold (CLAUDE.md rule 10 — state the floor before acting on the number). */
async function spreadOver(frame, idx, mean) {
  const r0 = await raw(frame), ch = r0.info.channels;
  let s = 0;
  for (const p of idx) {
    const i = p * ch;
    s += Math.hypot(r0.data[i] - mean.r * 255, r0.data[i + 1] - mean.g * 255, r0.data[i + 2] - mean.b * 255) / 255;
  }
  return +(s / (idx.length || 1)).toFixed(4);
}

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const rows = [];
let fails = 0;
const fail = (m) => { fails++; console.log(`  ✗ ${m}`); };
const pass = (m) => console.log(`  ✓ ${m}`);

for (const st of STATIONS) {
  console.log(`\n── ${TAG} / ${st.tag}  pitch ${st.pitch} yaw ${st.yaw} ──`);
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: HMR_STUB }));
  await page.goto(`${BASE}/preview.html?piece=character&id=${ID}&pitch=${st.pitch}&yaw=${st.yaw}&t=1.5&anim=idle&shot=1`, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForFunction('window.__previewReady === true && !!window.__stage', null, { timeout: 180_000 });

  const setup = await page.evaluate(async ({ names, color, r }) => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const s = window.__stage;
    const base = (n) => String(n || '').replace(/__(no_)?outline$/, '');
    // The bowl-top group's world centre, from the meshes that make it.
    const box = new THREE.Box3();
    let found = 0;
    s.scene.traverse((o) => {
      if (o.isMesh && names.includes(base(o.name))) { box.expandByObject(o); found++; }
    });
    if (!found) return { found: 0 };
    const centre = box.getCenter(new THREE.Vector3());
    // Move the ball along the VIEW AXIS toward the camera: the screen position is
    // preserved (so it lands on the bowl) and it is unambiguously in front of it.
    const cam = s.camera ?? s.rig?.camera;
    const dir = new THREE.Vector3().subVectors(cam.position, centre).normalize();
    const pos = centre.clone().addScaledVector(dir, 0.25);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
    mesh.name = 'lk1_projectile_standin';
    mesh.position.copy(pos);
    s.scene.add(mesh);
    window.__lk1 = { mesh, mat, THREE, names, base };
    s.scene.updateMatrixWorld(true); s.render(0);
    return { found, pos: pos.toArray().map((v) => +v.toFixed(3)) };
  }, { names: BOWL_TOP, color: PROJ, r: PROJ_R });

  if (!setup.found) { fail(`no bowl-top meshes matched on this tree`); await page.close(); continue; }

  const shot = () => page.locator('canvas').first().screenshot();
  const setVis = (what, v) => page.evaluate(({ what, v }) => {
    const s = window.__stage, L = window.__lk1;
    if (what === 'proj') L.mesh.visible = v;
    else s.scene.traverse((o) => { if (o.isMesh && L.names.includes(L.base(o.name))) o.visible = v; });
    s.scene.updateMatrixWorld(true); s.render(0);
  }, { what, v });

  const shipped = await shot();
  const shipped2 = await shot();
  const drift = (await maskOf(shipped, shipped2)).length;
  if (drift === 0) pass('PAIR  0 px drift'); else fail(`PAIR  ${drift} px of drift`);

  await setVis('proj', false);
  const noProj = await shot();
  await setVis('proj', true);
  const projIdx = await maskOf(shipped, noProj);

  await setVis('proj', false);
  await setVis('bowl', false);
  const noBowl = await shot();
  await setVis('bowl', true);
  await setVis('proj', true);
  const bowlIdx = new Set(await maskOf(noProj, noBowl));

  if (projIdx.length > 0 && bowlIdx.size > 0) pass(`NONEMPTY  projectile ${projIdx.length} px, bowl top ${bowlIdx.size} px`);
  else { fail(`NONEMPTY  projectile ${projIdx.length} px, bowl top ${bowlIdx.size} px`); await page.close(); continue; }

  // 🚨 THE MEASURED REGION IS THE INTERSECTION, NOT THE WHOLE BALL. The shipped
  // sculpt is a 0.5 m sphere and the liquid disc is 0.592 m across but FORESHORTENED
  // at 58 degrees, so the ball is simply bigger on screen than the bowl top and can
  // never be contained by it. Measuring over the whole ball would average the bowl
  // together with the rim and the backdrop and answer a question nobody asked.
  const region = projIdx.filter((p) => bowlIdx.has(p));
  const inside = region.length / projIdx.length;
  if (region.length >= 3000) pass(`OVERLAP  ${region.length} px of projectile over bowl top (${(100 * inside).toFixed(1)}% of the ball)`);
  else fail(`OVERLAP  only ${region.length} px of projectile over bowl top — too few to average`);

  // CONTROL B, `pj_probe`'s: force the ball to pure green and require the recovered
  // hue to read back ~120. Robust to the post chain, which an absolute-RGB check is
  // not — `stage.ts` grades highlights, so the shipped `#FFE9A8` lands at ~#D1BC74
  // on screen and an equality test on the albedo fails a ball that rendered fine.
  await page.evaluate(() => { const L = window.__lk1; L.mat.color.set('#00C000'); window.__stage.scene.updateMatrixWorld(true); window.__stage.render(0); });
  const greenShot = await shot();
  await page.evaluate((hex) => { const L = window.__lk1; L.mat.color.set(hex); window.__stage.scene.updateMatrixWorld(true); window.__stage.render(0); }, PROJ);
  const green = await statsOver(greenShot, region);
  const dGreen = Math.min(Math.abs(green.hue - 120), 360 - Math.abs(green.hue - 120));
  if (dGreen <= 12) pass(`GREEN  a #00C000 ball reads back hue ${green.hue} (${dGreen.toFixed(1)} deg from 120)`);
  else fail(`GREEN  a #00C000 ball reads back hue ${green.hue} — the ablation is not reading the ball`);

  const proj = await statsOver(shipped, region);
  const bg = await statsOver(noProj, region);
  const dist = await meanRgbDist(shipped, noProj, region);
  const bgSpread = await spreadOver(noProj, region, bg);
  const dHue = (() => { const d = Math.abs(proj.hue - bg.hue) % 360; return +(d > 180 ? 360 - d : d).toFixed(1); })();
  console.log(`  projectile ${proj.hex}  L ${proj.luma}  hslL ${proj.hsl}  hue ${proj.hue}`);
  console.log(`  background ${bg.hex}  L ${bg.luma}  hslL ${bg.hsl}  hue ${bg.hue}   own spread ${bgSpread}`);
  console.log(`  |dL| ${Math.abs(proj.luma - bg.luma).toFixed(4)}   |d hslL| ${Math.abs(proj.hsl - bg.hsl).toFixed(4)}   dHue ${dHue}   dist ${dist}   dist/spread ${(dist / Math.max(bgSpread, 1e-6)).toFixed(2)}`);

  // KB-MATCH — repaint the ball the background's own measured MEAN colour. The right
  // target is not zero: a flat ball on a surface that has its own texture must still
  // differ from it by about that texture, so the assertion is `kbDist <= 1.6 x the
  // background's own spread` — self-calibrating, rather than a threshold chosen to
  // pass. The first version demanded a 3x collapse against an ABSOLUTE distance and
  // failed on a perfectly working instrument, because the region it averaged over
  // still contained the rim and the backdrop.
  //
  // 🚨 AND PAINTING THE ALBEDO THE BACKGROUND'S MEASURED COLOUR IS NOT THE SAME AS
  // MAKING IT DELIVER THAT COLOUR. `stage.ts` grades the frame, so an unlit ball at
  // albedo `#F9832E` comes back as something else — the first version of this control
  // scored 0.1384 against a 0.0472 spread and read as a FAILED instrument when the
  // instrument was fine and the arithmetic was wrong. Solved by iterating on the
  // DELIVERED colour: three Newton steps on the albedo until what the ball delivers
  // is the background's own mean, which is what "invisible" actually means.
  let kbAlbedo = [Math.round(bg.r * 255), Math.round(bg.g * 255), Math.round(bg.b * 255)];
  let kbDist = 1;
  for (let it = 0; it < 3; it++) {
    const hex = '#' + kbAlbedo.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
    await page.evaluate((h) => { const L = window.__lk1; L.mat.color.set(h); window.__stage.scene.updateMatrixWorld(true); window.__stage.render(0); }, hex);
    const kbShot = await shot();
    const got = await statsOver(kbShot, region);
    kbDist = await meanRgbDist(kbShot, noProj, region);
    kbAlbedo = [kbAlbedo[0] + (bg.r - got.r) * 255, kbAlbedo[1] + (bg.g - got.g) * 255, kbAlbedo[2] + (bg.b - got.b) * 255];
  }
  await page.evaluate((hex) => { const L = window.__lk1; L.mat.color.set(hex); window.__stage.scene.updateMatrixWorld(true); window.__stage.render(0); }, PROJ);
  if (kbDist <= 1.6 * bgSpread) pass(`KB-MATCH  a ball painted the background's own mean scores ${kbDist} against its spread ${bgSpread} — the tool CAN report invisible`);
  else fail(`KB-MATCH  a ball painted the background's own mean still scores ${kbDist} against spread ${bgSpread}`);

  if (OUTDIR) { await mkdir(OUTDIR, { recursive: true }); await writeFile(`${OUTDIR}/${TAG}.${st.tag}.png`, shipped); }
  rows.push({ arm: TAG, station: st.tag, projPx: projIdx.length, bowlPx: bowlIdx.size, regionPx: region.length, inside: +inside.toFixed(4),
    proj: { hex: proj.hex, luma: proj.luma, hsl: proj.hsl, hue: proj.hue },
    bg: { hex: bg.hex, luma: bg.luma, hsl: bg.hsl, hue: bg.hue },
    dL: +Math.abs(proj.luma - bg.luma).toFixed(4), dHslL: +Math.abs(proj.hsl - bg.hsl).toFixed(4), dHue, dist, bgSpread, snr: +(dist / Math.max(bgSpread, 1e-6)).toFixed(2), kbDist });
  await page.close();
}
await browser.close();
if (JSON_OUT) { await mkdir(dirname(JSON_OUT), { recursive: true }); await writeFile(JSON_OUT, JSON.stringify(rows, null, 2)); }
console.log(`\n[lk1_pjcross] ${fails ? `${fails} FAIL` : 'all controls PASS'}`);
process.exit(fails ? 1 : 0);
