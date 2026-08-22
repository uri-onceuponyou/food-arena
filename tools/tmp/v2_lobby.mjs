#!/usr/bin/env node
/**
 * V2_LOBBY — the SHIPPED character-select screen, captured, because the preview
 * harness is not it and the difference changed a decision.
 *
 * THROWAWAY INSTRUMENT. Read-only on `src/`.
 *
 * ## Why this exists
 *
 * `tools/tmp/cm_shot.mjs`'s `lobby` arm reports itself as "the camera Uri judges", and
 * it is — `charStage.ts` ships pitch 20 and so does that tool. But it renders through
 * the **character PREVIEW path** with its own backdrop (`BG = '3d2b21'`, a flat brown)
 * and an open ground plane that recedes to the frame edge. `charStage.ts` ships
 * something else: a **cyclorama wall** that stops the ground at a fixed horizon, put
 * there deliberately ("with a wall to stop against there is nothing to hide"), plus a
 * deep-blue floor.
 *
 * That distinction became load-bearing on 2026-08-22. Raising the Fresnel rim's peak
 * (`toon.ts` `RIM_STRENGTH`) moved `cm_shot`'s lobby arm by **+0.041 of mean buffer
 * value** and turned its receding ground blue — a Fresnel term goes to its full peak on
 * ANY surface seen edge-on, and an open plane has a lot of edge-on. The obvious reading
 * is "the rim raise wrecks the lobby". The obvious reading is about a tool's backdrop
 * unless the SHIPPED screen is captured, and this file is what captures it.
 *
 * ⚠️ The same run also proved the attribution the other way: a third tree carrying ONLY
 * the shadow hunks reads `cm_shot` lobby mean **0.3457** against the before tree's
 * **0.3457** — bit-for-bit the same decision, so none of that move is the shadow.
 *
 * ## What it asserts before believing a pixel
 *
 *   G1  the router landed on the screen that was ASKED for, read from the app's own
 *       screen name — `menu_accept.mjs` records that an unknown `?screen=` silently
 *       lands on home, which would otherwise be captured as a perfectly good lobby.
 *   G2  the drawing buffer is NOT blank — asserted on `gl.readPixels`, never on a DOM
 *       flag. `window.__screenReady` is a flag and a flag is not a paint.
 *   G3  a `character:*` node is in the scene, so the frame contains the subject rather
 *       than an empty stage.
 *   G4  the drift control is byte-identical across two captures 450 ms apart, with the
 *       HUD's CSS animations stilled (they run on the document timeline, not rAF).
 *
 * `--known-bad blank` clears the drawing buffer and G2/G4 must then FAIL, exit 3.
 *
 * ## Use
 *
 *   node tools/tmp/v2_lobby.mjs --selftest
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-x -- \
 *     node tools/tmp/v2_lobby.mjs --url '{URL}' --out shots/v2/lobby_before --label BEFORE
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const has = (k) => a.includes(k);

const BASE = (process.env.PREVIEW_BASE ?? get('--url', '')).replace(/\/$/, '');
const OUT = get('--out', 'shots/v2/lobby');
const LABEL = get('--label', 'unlabelled');
const KNOWN_BAD = get('--known-bad', null);
const W = Number(get('--w', 1280));
const H = Number(get('--h', 800));
/**
 * ⚠️ THE SCREEN IS CALLED `characters`, NOT `select`, AND G1 IS HOW THAT WAS FOUND.
 * `src/main.ts` routes `?screen=characters`; an UNKNOWN value falls through to the
 * title card, which auto-continues — so `?screen=select` landed on `opening`, drew a
 * perfectly good frame with one character in it, and would have been captured as "the
 * lobby" by any tool that only checked that something painted. G1 read the app's own
 * route name and said so. That is the whole reason it is not a comment.
 */
const SCREEN = get('--screen', 'characters');

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

/**
 * Mean and stdev of a raw RGBA buffer's luma, plus the share of pixels whose BLUE
 * channel exceeds RED by more than 20. That last one is the whole point: the failure
 * this tool exists to detect is "a pale-blue Fresnel term washing a large receding
 * surface", and a mean cannot tell that apart from "the scene got brighter".
 */
export function bufStats(rgba) {
  let n = 0, s = 0, s2 = 0, blue = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    s += L; s2 += L * L; n++;
    if (b > r + 20 && b > g) blue++;
  }
  if (!n) return null;
  const mean = s / n;
  return { n, mean, sd: Math.sqrt(Math.max(0, s2 / n - mean * mean)), blueShare: blue / n };
}

if (has('--selftest')) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log(`  ok   - ${name}  [${detail}]`); }
    else { fail++; console.log(`  FAIL - ${name}  [${detail}]`); }
  };
  const mk = (px) => { const b = new Uint8Array(px.length * 4); px.forEach((p, j) => { b[j * 4] = p[0]; b[j * 4 + 1] = p[1]; b[j * 4 + 2] = p[2]; b[j * 4 + 3] = 255; }); return b; };

  // §A the arithmetic, by hand
  const grey = bufStats(mk(Array.from({ length: 100 }, () => [128, 128, 128])));
  ok('A1 flat grey 128 reads mean 128/255', Math.abs(grey.mean - 128 / 255) < 1e-9, `${grey.mean}`);
  // ⚠️ NOT `=== 0`, and the selftest is what found that. `sqrt(E[x^2] - E[x]^2)` on a
  // constant field returns **4.28e-8**, not zero, in float64 — catastrophic
  // cancellation between two nearly equal sums. G2 below originally read `sd === 0`
  // and would therefore NEVER have fired on a real cleared buffer: the guard against a
  // blank frame was itself blank. Both use the same 1e-6.
  ok('A2 ...and stdev is zero to 1e-6 (NOT exactly 0 — see the note)', grey.sd < 1e-6, `${grey.sd}`);
  ok('A3 ...and blueShare 0 — grey is not blue', grey.blueShare === 0, `${grey.blueShare}`);

  // §B the blue arm must FIRE, and must not fire on things that merely got brighter
  const blue = bufStats(mk(Array.from({ length: 100 }, () => [60, 90, 160])));
  ok('B1 a blue-dominant field reads blueShare 1', blue.blueShare === 1, `${blue.blueShare}`);
  const bright = bufStats(mk(Array.from({ length: 100 }, () => [200, 200, 200])));
  ok('B2 a BRIGHTER grey does not read as blue', bright.blueShare === 0 && bright.mean > grey.mean,
    `blue=${bright.blueShare} mean ${grey.mean.toFixed(3)}->${bright.mean.toFixed(3)}`);
  const warm = bufStats(mk(Array.from({ length: 100 }, () => [160, 90, 60])));
  ok('B3 a WARM field does not read as blue', warm.blueShare === 0, `${warm.blueShare}`);
  // the exact boundary, both sides, so the >20 margin is asserted rather than assumed
  ok('B4 b = r+20 is NOT blue (strictly greater)', bufStats(mk([[100, 100, 120]])).blueShare === 0, 'b=r+20');
  ok('B5 b = r+21 IS blue', bufStats(mk([[100, 100, 121]])).blueShare === 1, 'b=r+21');

  // §C the vacuity arm — an empty buffer must not summarise as a clean zero
  ok('C1 an EMPTY buffer returns null, not a tidy 0', bufStats(new Uint8Array(0)) === null, 'null');
  // §D a half/half field: the mean is the average and the share is exactly a half.
  const half = bufStats(mk(Array.from({ length: 100 }, (_, j) => (j < 50 ? [60, 90, 160] : [160, 90, 60]))));
  ok('D1 a 50/50 blue/warm field reads blueShare 0.5', Math.abs(half.blueShare - 0.5) < 1e-9, `${half.blueShare}`);
  ok('D2 ...and its mean sits between the two', half.mean > 0 && half.sd > 0, `mean ${half.mean.toFixed(4)} sd ${half.sd.toFixed(4)}`);

  console.log(`\n${fail ? '🔴' : '✅'} selftest ${pass}/${pass + fail}`);
  process.exit(fail ? 1 : 0);
}

if (!BASE) { console.error('v2_lobby: need PREVIEW_BASE or --url'); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'v2l-still';
  s.textContent = '*,*::before,*::after{animation-play-state:paused!important;'
                + 'transition:none!important;caret-color:transparent!important}';
  document.head.appendChild(s);
  for (const an of document.getAnimations()) { try { an.currentTime = 0; an.pause(); } catch { /* finished */ } }
  return document.getAnimations().length;
};

/** rAF held AND the shake zeroed — a frozen frame is not a frozen camera. */
const FREEZE = (blank) => {
  const w = window;
  w.__v2lraf = 0;
  w.requestAnimationFrame = () => { w.__v2lraf++; return 0; };
  const stage = w.__stage;
  if (stage) { try { stage.rig.shakeAmount = 0; stage.rig.shakeOffset.set(0, 0, 0); } catch { /* older rig */ } }
  if (blank && stage) {
    const gl = stage.renderer.getContext();
    stage.render = () => { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); };
  }
  return { ok: true, hasStage: !!stage };
};

const READ = (statsSrc) => {
  const w = window;
  const stage = w.__stage;
  if (!stage) return { err: 'no window.__stage on this screen' };
  const gl = stage.renderer.getContext();
  stage.render(0);
  const Wp = gl.drawingBufferWidth, Hp = gl.drawingBufferHeight;
  const buf = new Uint8Array(Wp * Hp * 4);
  gl.readPixels(0, 0, Wp, Hp, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  // eslint-disable-next-line no-new-func
  const stats = new Function(`${statsSrc}; return bufStats(arguments[0]);`)(buf);
  let h = 0x811c9dc5;
  for (let i = 0; i < buf.length; i++) h = ((h ^ buf[i]) * 16777619) >>> 0;
  const chars = [];
  stage.scene.traverse((o) => { if (/^character:/.test(o.name)) chars.push(o.name); });
  return { stats, sha: `${h.toString(16)}-${buf.length}`, wp: Wp, hp: Hp, chars: chars.length };
};

/**
 * ⚠️ THE HANDLE IS `window.__screen`, NOT `__screenName`. The first version of this
 * tool guessed `__screenName`, read `null`, and duly raised G1 on a run that had in
 * fact landed on the right screen — a guard firing for the wrong reason, which is the
 * same defect class as a guard that cannot fire at all. `tools/tmp/settle.mjs:119` is
 * the authority (`typeof window.__screen === 'string'`) and it is where this was read
 * from rather than guessed a second time.
 */
const SCREEN_NAME = () => (typeof window.__screen === 'string' ? window.__screen : null);

async function run() {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 200)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  await page.goto(`${BASE}/?screen=${SCREEN}`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForTimeout(3200);

  const faults = [];
  const name = await page.evaluate(SCREEN_NAME);
  // G1 — the router landed where it was asked to. An unknown `?screen=` lands on home.
  if (name !== SCREEN) faults.push(`G1 asked for '${SCREEN}', the app reports '${name}' — this is not the screen that was requested`);

  const nAnims = await page.evaluate(STILL_HUD);
  await page.evaluate(FREEZE, KNOWN_BAD === 'blank');
  // drain the in-flight rAF callback: the stub cannot cancel one already scheduled
  for (let i = 0; i < 6; i++) await page.screenshot({ clip: { x: 0, y: 0, width: 8, height: 8 } });

  const src = bufStats.toString();
  const a1 = await page.evaluate(READ, src);
  if (a1.err) { faults.push(`READ: ${a1.err}`); }
  await page.waitForTimeout(450);
  const a2 = await page.evaluate(READ, src);

  // G2 — not blank, asserted on the buffer
  const blank = !a1.stats || a1.stats.sd < 1e-6;
  if (blank) faults.push('G2 the drawing buffer is FLAT — nothing drew, and every number below would be about a cleared buffer');
  // G3 — the subject is in the scene
  if (!a1.chars) faults.push('G3 NO character:* node in the scene — this is an empty stage, not a lobby');
  // G4 — drift
  const identical = a1.sha === a2.sha;
  if (!identical) faults.push(`G4 drift control MOVED (${a1.sha} != ${a2.sha}) — every pixel number here is void`);

  const png = `${OUT}/${SCREEN}.png`;
  await page.screenshot({ path: png });

  const report = {
    label: LABEL, base: BASE, screen: name, viewport: [W, H], hudAnimations: nAnims,
    stats: a1.stats, sha: a1.sha, chars: a1.chars, driftIdentical: identical, png, faults,
  };
  writeFileSync(`${OUT}/v2-lobby.json`, JSON.stringify(report, null, 2));
  await browser.close();

  console.log(`\n── ${LABEL} · screen '${name}' · ${a1.wp}x${a1.hp} ──`);
  if (a1.stats) {
    console.log(`   mean ${a1.stats.mean.toFixed(4)}  sd ${a1.stats.sd.toFixed(4)}  blueShare ${a1.stats.blueShare.toFixed(4)}  chars ${a1.chars}`);
  }
  console.log(`   drift control: ${identical ? 'IDENTICAL ✅' : '🔴 MOVED'}`);
  for (const f of faults) console.log(`   🔴 ${f}`);

  if (KNOWN_BAD === 'blank') {
    const broke = faults.some((f) => /^G2|^G4/.test(f));
    console.log(`\n── known-bad 'blank' ──\n  ${broke ? 'ok  ' : 'FAIL'} - clearing the drawing buffer FAILS G2/G4`);
    process.exit(broke ? 3 : 1);
  }
  console.log(`\n${faults.length ? '🔴' : '✅'}  ${LABEL} -> ${OUT}/v2-lobby.json`);
  process.exit(faults.length ? 1 : 0);
}

await run().catch((e) => { console.error(e); process.exitCode = 1; });
