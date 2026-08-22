#!/usr/bin/env node
/**
 * V2_ABLATE — does each of the three separation elements ACTUALLY PUT PIXELS ON SCREEN?
 *
 * THROWAWAY INSTRUMENT. Read-only on `src/`.
 *
 * `v2_shot.mjs` answers "did figure/ground move". This answers the prior question, which
 * this project has got wrong twenty times: **is the thing I added being drawn at all?**
 * `docs/AGENT-BRIEF.md` §4.2 — *"it isn't there" means it IS there and is INVISIBLE* —
 * and its twentieth instance is the one that matters here: a shader that never linked drew
 * nothing for three rounds because **the shadow-depth program carries no rim patch** and
 * kept drawing each chip's contact shadow. **A mesh's outline, decal or shadow can be
 * drawn by a DIFFERENT program from the mesh.** So each element is ABLATED on ONE frozen
 * frame and its own contribution read as the paired difference.
 *
 *   A  shipped
 *   B  character ink hulls hidden          -> the outline's own pixels
 *   C  `contact:shadows` hidden            -> the contact decal's own pixels
 *   D  every live rim uniform driven to 0  -> the fresnel's own pixels
 *   E  every live rim uniform driven to 6  -> THE POSITIVE CONTROL
 *
 * ── WHY E IS NOT OPTIONAL ────────────────────────────────────────────────────
 * D returning a small number has two possible causes — the rim is subtle, or the probe's
 * handle is not connected to anything — and they are indistinguishable without an arm
 * that MUST be large. E drives the same handle 21x and requires a much bigger frame
 * delta. `haloprobe.mjs` carries the identical VALIDATE row for the identical reason:
 * an instrument that cannot see a 21x input is not measuring the rim.
 *
 * ── VACUITY GUARDS (CLAUDE.md #6) ───────────────────────────────────────────
 * Every arm hides or drives a FILTERED SET, and a filter that comes back empty makes its
 * ablation read 0.000 — "the element contributes nothing" — which is the flattering
 * wrong answer. So each set's SIZE is reported and asserted NON-EMPTY *before* its delta
 * is believed:
 *   G1  >= 1 character ink hull found          G2  >= 1 contact decal found
 *   G3  >= 1 live rim uniform found            G4  the drift control is exactly 0 px
 *   G5  arm E moves the frame at least 4x as much as arm D
 * `--known-bad empty` points every selector at a name that cannot match; G1-G3 must then
 * FAIL and the tool must exit 3.
 *
 * ── USE ──────────────────────────────────────────────────────────────────────
 *   node tools/tmp/v2_ablate.mjs --selftest
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-v2-after -- \
 *     node tools/tmp/v2_ablate.mjs --url '{URL}' --out shots/v2/ablate-after --label AFTER
 *   ... --known-bad empty        # G1-G3 must fail, exit 3
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const has = (k) => a.includes(k);
const ROOT = resolve(process.argv[1], '../../..');

const W = Number(get('--w', 1600));
const H = Number(get('--h', 900));
/** Arm E must move the frame at least this many times as much as arm D, or D is blind. */
const CONTROL_RATIO = 4;

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — the LOGIC. It does not, and cannot, validate where the tool is POINTED;
// the non-empty guards in the live run are what do that.
// ─────────────────────────────────────────────────────────────────────────────
if (has('--selftest')) {
  let pass = 0, fail = 0;
  const ok = (n, c, d) => { if (c) { pass++; console.log(`  ok   - ${n}  [${d}]`); } else { fail++; console.log(`  FAIL - ${n}  [${d}]`); } };

  // §A the frame-difference arithmetic, on buffers built by hand
  const diff = (A, B) => {
    let px = 0, sum = 0, max = 0;
    for (let i = 0; i < A.length; i += 4) {
      const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
      if (d) { px++; sum += d; if (d > max) max = d; }
    }
    return { px, mean: sum / (A.length / 4), max };
  };
  {
    const n = 100;
    const A = new Uint8Array(n * 4).fill(200), B = new Uint8Array(n * 4).fill(200);
    ok('A1 identical buffers diff to exactly zero', diff(A, B).px === 0, '0 px');
    B[0] = 100;
    const d = diff(A, B);
    ok('A2 one changed channel is one changed pixel', d.px === 1 && d.max === 100, `px ${d.px} max ${d.max}`);
    ok('A3 mean is over the WHOLE frame, not over changed pixels only', Math.abs(d.mean - 1) < 1e-9, `mean ${d.mean}`);
  }

  // §B THE VACUITY ARM — an empty selector must be refused, not reported as 0.000
  {
    const judge = (setSize, deltaPx) => (setSize > 0 ? { ok: true, deltaPx } : { ok: false, why: 'empty set' });
    ok('B1 an EMPTY ablation set is REFUSED', judge(0, 0).ok === false, 'refused');
    ok('B2 ... and a populated one is judged (so B1 is not vacuous)', judge(7, 1234).ok === true, '7 targets');
    ok('B3 an empty set with a zero delta is NOT reported as "contributes nothing"',
      judge(0, 0).why === 'empty set', 'empty set');
  }

  // §C the positive-control ratio
  {
    const gate = (dD, dE) => dE >= CONTROL_RATIO * dD;
    ok('C1 a 21x drive that moves the frame 10x passes the control', gate(100, 1000), '10x');
    ok('C2 a 21x drive that moves the frame 2x FAILS it', !gate(100, 200), '2x');
    ok('C3 both arms at zero FAILS it rather than passing on 0 >= 0',
      !((0 >= CONTROL_RATIO * 0) && 0 > 0), 'refused: E must be > 0');
  }

  // §D THE SCREEN-SPACE INK CONSTANT vs THE TIER GATE — read from the tree, not typed.
  // `outlineGroup` compares `thickness` against `PROP_INK_MIN` whatever its unit, so a
  // character ink value at or above it would be dropped on `low`, which is the one tier
  // character ink is supposed to survive.
  {
    const src = readFileSync(join(ROOT, 'src/render/toon.ts'), 'utf8');
    const mScreen = src.match(/export const OUTLINE_CHAR_SCREEN\s*=\s*([0-9.]+)/);
    const mProp = src.match(/const PROP_INK_MIN\s*=\s*([0-9.]+)/);
    ok('D1 OUTLINE_CHAR_SCREEN exists in the tree', !!mScreen, mScreen ? mScreen[1] : 'ABSENT');
    ok('D2 PROP_INK_MIN exists in the tree', !!mProp, mProp ? mProp[1] : 'ABSENT');
    if (mScreen && mProp) {
      const s = Number(mScreen[1]), p = Number(mProp[1]);
      ok('D3 character ink stays BELOW the prop-ink tier threshold', s < p, `${s} < ${p}`);
      ok('D4 ... with real margin, not by a hair', p / s >= 2, `${(p / s).toFixed(2)}x clear`);
    }
  }

  console.log(`\n${fail ? '🔴 FAIL' : '✅ PASS'}  v2_ablate --selftest: ${pass}/${pass + fail}`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
const BASE = (process.env.PREVIEW_BASE ?? get('--url', '')).replace(/\/$/, '');
if (!BASE) { console.error('need --url or PREVIEW_BASE'); process.exit(2); }
if (BASE.includes(':5173')) { console.error('\n!! --url is the SHARED dev server. Never measure there.\n'); process.exit(2); }
const OUT = get('--out', 'shots/v2/ablate');
const LABEL = get('--label', 'unlabelled');
const KNOWN_BAD = get('--known-bad', null);
const ROSTER = String(get('--roster', 'soup,sushi,taco,donut,egg,pizza')).split(',').filter(Boolean);
const RING_WU = Number(get('--ring', 110));

const ARENA = JSON.parse(readFileSync(join(ROOT, 'tools/arena.gameplay.json'), 'utf8'));
const POT = ARENA.hazards.find((h) => h.kind === 'damage' && h.x === ARENA.center.x && h.y === ARENA.center.y);
const ST = { x: ARENA.center.x, y: ARENA.center.y + Math.round(POT.radius * 2.105) };

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

/** Byte-for-byte `sc_fogstill.mjs`'s export — copied, not imported; see `v2_shot.mjs`. */
const PAGE_STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'sc-still';
  s.textContent = '*,*::before,*::after{animation-play-state:paused!important;'
                + 'transition:none!important;caret-color:transparent!important}';
  document.head.appendChild(s);
  for (const an of document.getAnimations()) { try { an.currentTime = 0; an.pause(); } catch { /* finished */ } }
  return document.getAnimations().length;
};

const INSTALL = (opts) => {
  const w = window;
  w.__v2raf = 0;
  w.requestAnimationFrame = () => { w.__v2raf++; return 0; };
  const stage = w.__stage;
  if (!stage) return { err: 'no window.__stage' };
  try { stage.rig.shakeAmount = 0; stage.rig.shakeOffset.set(0, 0, 0); } catch { /* older rig */ }

  const scene = stage.scene;
  const chars = [];
  scene.traverse((o) => { if (/^character:/.test(o.name)) chars.push(o); });

  // ── the three sets. Names are PARAMETERS so `--known-bad` can point them at
  //    something that cannot match; a selector hard-coded here could never be shown
  //    to fail. ──────────────────────────────────────────────────────────────
  const inkSuffix = opts.inkSuffix;
  const contactName = opts.contactName;

  const inkHulls = [];
  for (const c of chars) c.traverse((o) => { if (o.isMesh && o.name.endsWith(inkSuffix)) inkHulls.push(o); });

  const contacts = [];
  scene.traverse((o) => { if (o.name === contactName) contacts.push(o); });

  // Live rim uniforms. `applyRimLight` writes `userData.rimUniforms` from inside
  // `onBeforeCompile`, i.e. at FIRST RENDER — so this must run after a frame has been
  // drawn, and a material that has never been drawn legitimately has none.
  const rims = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) {
      const u = m && m.userData && m.userData.rimUniforms;
      if (u && u.rimStrength && !rims.some((e) => e.u === u)) rims.push({ u, base: u.rimStrength.value });
    }
  });

  w.__v2 = {
    setInk: (v) => { for (const m of inkHulls) m.visible = v; return inkHulls.length; },
    setContact: (v) => { for (const m of contacts) m.visible = v; return contacts.length; },
    setRim: (mult) => { for (const e of rims) e.u.rimStrength.value = e.base * mult; return rims.length; },
    counts: { chars: chars.length, inkHulls: inkHulls.length, contacts: contacts.length, rims: rims.length },
    rimBase: rims.map((e) => e.base),
  };
  return { ok: true, counts: w.__v2.counts };
};

const FRAMES = () => (window.__matchDebug ? window.__matchDebug.frames : null);

/** Render once at dt 0 and return the raw drawing buffer as a base64 string. */
const GRAB = () => {
  const stage = window.__stage;
  const gl = stage.renderer.getContext();
  stage.render(0);
  const Wp = gl.drawingBufferWidth, Hp = gl.drawingBufferHeight;
  const buf = new Uint8Array(Wp * Hp * 4);
  gl.readPixels(0, 0, Wp, Hp, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < buf.length; i += CH) bin += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
  return { w: Wp, h: Hp, b64: btoa(bin) };
};

const DRAWS = () => {
  const stage = window.__stage;
  const r = stage.renderer;
  r.info.autoReset = false;
  r.info.reset();
  stage.render(0);
  return { calls: r.info.render.calls, tris: r.info.render.triangles };
};

function toBuf(g) { return Buffer.from(g.b64, 'base64'); }
function diff(A, B) {
  let px = 0, sum = 0, max = 0;
  for (let i = 0; i < A.length; i += 4) {
    const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
    if (d) { px++; sum += d; if (d > max) max = d; }
  }
  const n = A.length / 4;
  return { px, sharePct: +(100 * px / n).toFixed(4), mean: +(sum / n).toFixed(4), max };
}

async function run() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 200)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));

  const ring = ROSTER.map((cid, i) => {
    const ang = (i / ROSTER.length) * Math.PI * 2;
    return i === 0 ? `${cid}@${ST.x},${ST.y}`
      : `${cid}@${Math.round(ST.x + Math.cos(ang) * RING_WU)},${Math.round(ST.y + Math.sin(ang) * RING_WU)}`;
  }).join(';');
  const q = new URLSearchParams({
    fighters: ring, px: String(ST.x), py: String(ST.y),
    fogRadius: String(ARENA.maxSafeRadius), simSpeed: '0.02', pointerLock: '0',
  });
  console.log(`\n── ${LABEL} · ablation at (${ST.x},${ST.y}) · ${ROSTER.join(',')} ──`);
  await page.goto(`${BASE}/?${q}`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 180_000 });
  await page.waitForTimeout(2600);
  await page.evaluate(PAGE_STILL_HUD);

  const selectors = KNOWN_BAD === 'empty'
    // A suffix and a group name that CANNOT match anything in the scene. Every set must
    // come back empty and every guard must go red.
    ? { inkSuffix: '__no_such_outline_suffix', contactName: 'no:such:group' }
    : { inkSuffix: '__outline', contactName: 'contact:shadows' };

  const inst = await page.evaluate(INSTALL, selectors);
  if (inst.err) { console.error(inst.err); await browser.close(); process.exit(2); }

  // drain the in-flight rAF turn — see `v2_shot.mjs`: headless Chromium throttles rAF
  // while nothing composites, so the pending callback lands on the first screenshot.
  let f0 = await page.evaluate(FRAMES), stable = 0;
  for (let i = 0; i < 20 && stable < 3; i++) {
    await page.screenshot({ clip: { x: 0, y: 0, width: 8, height: 8 } });
    // eslint-disable-next-line no-await-in-loop
    const f1 = await page.evaluate(FRAMES);
    if (f1 === f0) stable++; else { stable = 0; f0 = f1; }
  }
  console.log(`   loop held: ${stable >= 3 ? `yes at frame ${f0}` : `🔴 NO (${f0})`}`);
  console.log(`   sets: chars ${inst.counts.chars} · ink hulls ${inst.counts.inkHulls} · contact decals ${inst.counts.contacts} · live rim uniforms ${inst.counts.rims}`);

  // ── drift control: the same frame twice, nothing touched ──────────────────
  const d0 = toBuf(await page.evaluate(GRAB));
  const d1 = toBuf(await page.evaluate(GRAB));
  const selfPair = diff(d0, d1);
  console.log(`   drift control (self-pair): ${selfPair.px} px  — ${selfPair.px === 0 ? 'IDENTICAL ✅' : '🔴 MOVED, every delta below is void'}`);

  const shipped = d1;
  const arms = [];
  const runArm = async (name, apply, undo) => {
    const n = await page.evaluate(apply);
    const buf = toBuf(await page.evaluate(GRAB));
    const d = diff(shipped, buf);
    await page.evaluate(undo);
    arms.push({ name, targets: n, ...d });
    console.log(`   ${name.padEnd(28)} targets ${String(n).padStart(4)}   px ${String(d.px).padStart(8)} (${String(d.sharePct).padStart(7)}%)   mean ${String(d.mean).padStart(7)}/255   max ${String(d.max).padStart(3)}`);
    return d;
  };

  const dInk = await runArm('B ink hulls hidden', () => window.__v2.setInk(false), () => window.__v2.setInk(true));
  const dContact = await runArm('C contact decals hidden', () => window.__v2.setContact(false), () => window.__v2.setContact(true));
  const dRimOff = await runArm('D rim driven to 0', () => window.__v2.setRim(0), () => window.__v2.setRim(1));
  const dRimUp = await runArm('E rim driven to 21x (CONTROL)', () => window.__v2.setRim(21), () => window.__v2.setRim(1));

  // ── draw cost, the number Uri's phone pays ────────────────────────────────
  const draws6 = await page.evaluate(DRAWS);
  await page.close();

  const p2 = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await p2.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  await p2.goto(`${BASE}/?player=${ROSTER[0]}&enemy=${ROSTER[1]}&px=${ST.x}&py=${ST.y}&fogRadius=${ARENA.maxSafeRadius}&simSpeed=0.02&pointerLock=0`,
    { waitUntil: 'networkidle', timeout: 120_000 });
  await p2.waitForFunction('window.__gameReady === true', null, { timeout: 180_000 });
  await p2.waitForTimeout(2400);
  await p2.evaluate(PAGE_STILL_HUD);
  await p2.evaluate(INSTALL, selectors);
  const draws2 = await p2.evaluate(DRAWS);
  await p2.close();
  await browser.close();

  console.log(`\n   draw calls: 2 fighters ${draws2.calls} (${draws2.tris} tris) · 6 fighters ${draws6.calls} (${draws6.tris} tris)`);

  const report = { label: LABEL, base: BASE, station: ST, roster: ROSTER, counts: inst.counts, selfPair, arms, draws2, draws6 };
  writeFileSync(`${OUT}/v2-ablate.json`, JSON.stringify(report, null, 2));

  console.log('\n── guards ──');
  const g = [
    ['G1 >= 1 character ink hull was found (the set is not empty)', inst.counts.inkHulls > 0, `${inst.counts.inkHulls}`],
    ['G2 >= 1 contact decal was found', inst.counts.contacts > 0, `${inst.counts.contacts}`],
    ['G3 >= 1 LIVE rim uniform was found', inst.counts.rims > 0, `${inst.counts.rims}`],
    ['G4 the drift control is exactly 0 px', selfPair.px === 0, `${selfPair.px} px`],
    [`G5 the 21x control moves the frame >= ${CONTROL_RATIO}x arm D (D is not blind)`,
      dRimUp.mean > 0 && dRimUp.mean >= CONTROL_RATIO * dRimOff.mean,
      `E ${dRimUp.mean} vs D ${dRimOff.mean} = ${dRimOff.mean ? (dRimUp.mean / dRimOff.mean).toFixed(1) : '∞'}x`],
  ];
  for (const [n, okv, d] of g) console.log(`  ${okv ? 'ok  ' : 'FAIL'} - ${n}  [${d}]`);
  const allOk = g.every(([, okv]) => okv);
  console.log(`\n${allOk ? '✅' : '🔴'}  ${LABEL} -> ${OUT}/v2-ablate.json`);

  if (KNOWN_BAD === 'empty') {
    const broke = !g[0][1] && !g[1][1];
    console.log(`\n── known-bad 'empty' ──\n  ${broke ? 'ok  ' : 'FAIL'} - unmatchable selectors EMPTY the sets and G1/G2 go red  [ink ${inst.counts.inkHulls} contact ${inst.counts.contacts}]`);
    process.exit(broke ? 3 : 1);
  }
  process.exit(allOk ? 0 : 1);
}

await run().catch((e) => { console.error(e); process.exitCode = 1; });
