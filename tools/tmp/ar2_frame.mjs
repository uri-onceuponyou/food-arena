#!/usr/bin/env node
/**
 * AR2_FRAME — what does ONE shipped match frame actually CONTAIN, in world units?
 *
 * ## Why this exists
 *
 * The Q1 blind round scores the arena off `shots/q1/cap/match_donut_taco_*.png`, and six
 * critics have independently called that frame *"a flat tiled plane with no props"*. Before
 * spending a pass on the floor, this answers a prior question that nothing in the toolchain
 * asked: **WHICH 4% OF THE ARENA IS THAT FRAME, AND WHAT IS EXCLUDED FROM IT BY RULE?**
 *
 * `tools/arena-scan.mjs`'s own header records the answer to half of it — *"at 16:9 the match
 * camera shows halfWidth 289.4 wu and near/far 199.2 wu, i.e. ~579 x 398 wu of ground"* — on
 * a 2800 x 2000 arena. That is **4.11%** of the map per frame. This tool measures the other
 * half: for a given `?px/?py`, which of the arena's OWN declared `cover` and `concealment`
 * boxes can possibly be in shot.
 *
 * The quad is **unprojected from the live camera**, not recomputed from `fairView`'s scalars,
 * because a recomputation is a second source of truth for framing and this repo has been
 * bitten by exactly that (`arena-scan`: *"`frameMode:'ground'` frames viewWidthUnits/sin(pitch),
 * not viewWidthUnits"*). Four screen corners are raycast onto the y=0 plane through the
 * renderer's own camera; `fairView` is dumped alongside as a cross-check, never as the input.
 *
 * ## KNOWN-BAD VALIDATION — `--selftest`, and it does NOT need a browser
 *
 * `CLAUDE.md` #6: a guard not shown to FAIL on the bug it guards against is not a guard, and
 * `[].every()` returns `true`. The box/quad intersection is the only piece of logic here, so
 * it is factored out and exercised against planted inputs:
 *
 *   MOVES     a box AT the quad centre is reported IN; the same box 5,000 wu away is OUT.
 *   EDGE      a box whose nearest corner is 1 wu inside is IN; 1 wu outside is OUT.
 *   NON-EMPTY every arm asserts the candidate set it filters is non-empty FIRST, so a
 *             fixture that stops producing boxes fails loudly instead of passing vacuously.
 *
 * ## Use
 *
 *   node tools/tmp/ar2_frame.mjs --selftest
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-ar2 -- \
 *     node tools/tmp/ar2_frame.mjs --url '{URL}' --out tools/tmp/ar2_out
 *
 * Stations default to the Q1 capture anchor plus a spread across the map; override with
 * `--stations id:x:y,id:x:y`. Coordinates are DERIVED from `src/arena/shared.ts`'s ARENA_W /
 * ARENA_H at run time (`--dims`) rather than retyped, because the 1x playfield is exactly the
 * NW quadrant of the x4 one and every stale coordinate is still a LEGAL one (`al_guard`).
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { argv as procArgv } from 'node:process';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const has = (k) => argv.includes('--' + k);

/**
 * 🚨 IS-MAIN GUARD. `docs/AGENT-BRIEF.md` §3: three tools here made a function importable —
 * the right instinct — and silently made the whole CLI path run on import. Importing
 * `snapsweep.mjs` printed a live sweep; importing `da_census.mjs` fell through into
 * `runCapture` and, with `PREVIEW_BASE` set (which it IS inside every `with_snapshot` child),
 * would launch Chromium. `ar2_sweep.mjs` imports `boxInQuad` from this file, so without this
 * guard running the sweep inside a snapshot would launch a browser and walk five stations.
 */
const IS_MAIN = (() => {
  try { return realpathSync(procArgv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();

// ── ARENA DIMS: read from the source of truth, never retyped ────────────────────────────
function readDims() {
  const src = readFileSync(new URL('../../src/arena/shared.ts', import.meta.url), 'utf8');
  const num = (name) => {
    const m = src.match(new RegExp(`export const ${name} = (\\d+(?:\\.\\d+)?);`));
    if (!m) throw new Error(`ar2_frame: could not read ${name} from src/arena/shared.ts`);
    return Number(m[1]);
  };
  const W = num('ARENA_W'), H = num('ARENA_H');
  return { W, H, cx: W / 2, cy: H / 2 };
}

/**
 * Does an axis-aligned box (centre x,y, full extents w,h) overlap the convex ground quad?
 * Separating-axis on the quad's four edges plus the box's two axes. Exact for convex/AABB.
 */
export function boxInQuad(box, quad) {
  const bx = [box.x - box.w / 2, box.x + box.w / 2];
  const by = [box.y - box.h / 2, box.y + box.h / 2];
  const boxPts = [[bx[0], by[0]], [bx[1], by[0]], [bx[1], by[1]], [bx[0], by[1]]];
  const axes = [[1, 0], [0, 1]];
  for (let i = 0; i < quad.length; i++) {
    const a = quad[i], b = quad[(i + 1) % quad.length];
    axes.push([-(b[1] - a[1]), b[0] - a[0]]);
  }
  for (const [ax, ay] of axes) {
    const len = Math.hypot(ax, ay) || 1;
    const nx = ax / len, ny = ay / len;
    let bmin = Infinity, bmax = -Infinity, qmin = Infinity, qmax = -Infinity;
    for (const [px, py] of boxPts) { const d = px * nx + py * ny; bmin = Math.min(bmin, d); bmax = Math.max(bmax, d); }
    for (const [px, py] of quad) { const d = px * nx + py * ny; qmin = Math.min(qmin, d); qmax = Math.max(qmax, d); }
    if (bmax < qmin || qmax < bmin) return false;
  }
  return true;
}

/** Shoelace area of a polygon, in wu². */
export function quadArea(quad) {
  let s = 0;
  for (let i = 0; i < quad.length; i++) {
    const a = quad[i], b = quad[(i + 1) % quad.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

// ── SELFTEST ────────────────────────────────────────────────────────────────────────────
if (IS_MAIN && has('selftest')) {
  let pass = 0, fail = 0;
  const check = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} - ${label}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
    ok ? pass++ : fail++;
  };
  const dims = readDims();
  console.log(`\n§A — the fixture is real (ARENA_W/H read from shared.ts: ${dims.W}x${dims.H})`);
  check('ARENA_W is the x4 map, not the retired 1x one', dims.W > 1400 && dims.H > 1000, true);

  // A 579 x 398 quad centred on the map centre, i.e. the shipped match window.
  const q = (cx, cy, w = 579, h = 398) => [
    [cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2],
  ];
  const quad = q(dims.cx, dims.cy);

  console.log('\n§B — MOVES: the detector separates in from out');
  const planted = [
    { id: 'centre', x: dims.cx, y: dims.cy, w: 120, h: 120 },
    { id: 'far', x: dims.cx + 5000, y: dims.cy, w: 120, h: 120 },
  ];
  check('the candidate set is NON-EMPTY before filtering', planted.length > 0, true);
  check('a box AT the quad centre is IN', boxInQuad(planted[0], quad), true);
  check('KNOWN-BAD: the same box 5,000 wu away is OUT', boxInQuad(planted[1], quad), false);

  console.log('\n§C — EDGE: the bound is the bound, to the world unit');
  const halfW = 579 / 2;
  const inBox = { x: dims.cx + halfW + 60 - 1, y: dims.cy, w: 120, h: 120 };
  const outBox = { x: dims.cx + halfW + 60 + 1, y: dims.cy, w: 120, h: 120 };
  check('nearest edge 1 wu inside -> IN', boxInQuad(inBox, quad), true);
  check('nearest edge 1 wu outside -> OUT', boxInQuad(outBox, quad), false);

  console.log('\n§D — a NON-AXIS-ALIGNED quad (the real camera never gives a rectangle)');
  const trap = [[1000, 800], [1800, 800], [1900, 1200], [900, 1200]];
  check('trapezoid area is positive and finite', quadArea(trap) > 0 && Number.isFinite(quadArea(trap)), true);
  check('a box inside the trapezoid is IN', boxInQuad({ x: 1400, y: 1000, w: 100, h: 100 }, trap), true);
  check('KNOWN-BAD: a box beyond the SLANTED edge is OUT', boxInQuad({ x: 880, y: 830, w: 40, h: 40 }, trap), false);
  check('CONTROL: the same box moved inside that edge is IN', boxInQuad({ x: 1000, y: 830, w: 40, h: 40 }, trap), true);

  console.log(`\n${fail ? '🔴 FAIL' : '✅ PASS'}  ar2_frame --selftest: ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

// ── LIVE RUN ────────────────────────────────────────────────────────────────────────────
if (!IS_MAIN) {
  // Imported for `boxInQuad` / `quadArea` / `readDims`. Everything below is the CLI.
} else {
const BASE = arg('url', process.env.PREVIEW_BASE ?? '');
if (!BASE) { console.error('ar2_frame: --url or PREVIEW_BASE required (never :5173)'); process.exit(2); }
const OUT = arg('out', 'tools/tmp/ar2_out');
const W = Number(arg('w', 1600)), H = Number(arg('h', 900));
const DIMS = readDims();
/**
 * `--pitch <deg>` overrides `CameraRig.pitchDeg`. `CLAUDE.md` #3: there are TWO shipped
 * cameras and they expose different defects — the match's 58° (`render/camera.ts`) and the
 * lobby's 20° (`ui/screens/charStage.ts:451`), and a shallow look is the better DETECTOR for
 * anything foreshortening hides. The lobby camera never shows the arena, so this is not "the
 * other shipped camera"; it is the shallow DETECTOR applied to arena geometry, and the shipped
 * 58° stays the artefact. Default is unset — the shipped pitch, untouched.
 *
 * `--drift` captures every station TWICE in one page and byte-compares. `CLAUDE.md` #4: a
 * non-zero number needs a drift control, and shake re-randomises on every `render()`.
 */
const PITCH = arg('pitch', '');
const DRIFT = has('drift');
/** Extra query, e.g. `--extra '&seats=6'` for the six-fighter draw-call arm. */
const EXTRA = arg('extra', '');

const DEFAULT_STATIONS = [
  // The Q1 capture anchor, verbatim from shots/q1/cap/capture-report.json.
  ['q1_anchor', 1560, 1000],
  // Derived, never retyped: quarter points of the shipped map.
  ['nw_quarter', Math.round(DIMS.W * 0.25), Math.round(DIMS.H * 0.25)],
  ['ne_quarter', Math.round(DIMS.W * 0.75), Math.round(DIMS.H * 0.25)],
  ['w_mid', Math.round(DIMS.W * 0.20), Math.round(DIMS.H * 0.50)],
  ['n_mid', Math.round(DIMS.W * 0.50), Math.round(DIMS.H * 0.22)],
];
const STATIONS = (arg('stations', '') || '')
  ? arg('stations', '').split(',').map((s) => { const [id, x, y] = s.split(':'); return [id, Number(x), Number(y)]; })
  : DEFAULT_STATIONS;

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const { chromium } = await import('playwright');
const browser = await chromium.launch({ args: [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
const rows = [];
for (const [id, px, py] of STATIONS) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  const url = `${BASE}/?player=hamburger&enemy=donut&px=${px}&py=${py}&fogRadius=1720&simSpeed=0.02&pointerLock=0${EXTRA}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
  await page.waitForTimeout(1500);

  const res = await page.evaluate((pitch) => {
    const stage = window.__stage, arena = window.__matchArena;
    if (!stage) return { error: 'no __stage' };
    if (!arena) return { error: 'no __matchArena' };
    if (pitch) { stage.rig.pitchDeg = Number(pitch); stage.render?.(0); }
    const cam = stage.rig.camera;
    // Camera shake re-randomises on every render(); zero it before anything is read.
    if (stage.rig.shake) { try { stage.rig.shake.x = 0; stage.rig.shake.y = 0; } catch { /* not a vector */ } }
    cam.updateMatrixWorld(true);

    // Unproject four screen corners onto the y=0 ground plane, through the LIVE camera.
    const WORLD_SCALE = 0.05;
    const org = cam.position.clone();
    const corner = (ndcx, ndcy) => {
      const v = new cam.position.constructor(ndcx, ndcy, 0.5);
      v.unproject(cam);
      const dir = v.sub(org).normalize();
      if (Math.abs(dir.y) < 1e-9) return null;
      const t = -org.y / dir.y;
      if (t <= 0) return null;
      return [(org.x + dir.x * t) / WORLD_SCALE, (org.z + dir.z * t) / WORLD_SCALE];
    };
    const quad = [corner(-1, 1), corner(1, 1), corner(1, -1), corner(-1, -1)];

    // ── DRAW CALLS, and the naive read is WRONG. ────────────────────────────────
    // `renderer.info` resets at the START of every `render()`, so reading it from a
    // `page.evaluate` between frames returns whatever the LAST internal pass happened to
    // draw — this returned `calls: 1` before the reset/render pair below was added, which
    // reads exactly like "the arena draws nothing". Freeze the counter, drive ONE frame,
    // then read. `5aa4655` took the phone from 928 draws to 423 and that merge is a hard
    // constraint on anything this file is used to justify.
    const info = stage.renderer.info;
    info.autoReset = false;
    info.reset();
    stage.render?.(1 / 60);
    const drawFrame = { calls: info.render.calls, triangles: info.render.triangles };
    info.autoReset = true;
    // 🚨 NON-VACUOUS CONTROL: a "six fighters" draw-call arm that actually seated two is a
    // control that cannot fail. Report the count the sim really has, from the live state.
    // Counted off the HUD's own per-fighter plates (`hud.ts:842`, class string asserted
    // byte-for-byte there) plus the floating pills — the sim's fighter list is not published.
    const fighterCount = document.querySelectorAll('.hud-fighter').length || null;
    return { drawFrame, fighterCount,
      quad,
      fairView: window.__fairView ? window.__fairView() : null,
      pitchDeg: stage.rig.pitchDeg,
      arena: {
        id: arena.id, width: arena.width, height: arena.height,
        center: arena.center, maxSafeRadius: arena.maxSafeRadius,
        cover: arena.cover.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h, kind: c.kind })),
        concealment: (arena.concealment ?? []).map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h, kind: c.kind })),
      },
      programs: stage.renderer.info.programs?.length ?? null,
    };
  }, PITCH);

  if (res.error) { console.error(`✗ ${id}: ${res.error}`); await page.close(); continue; }
  if (res.quad.some((p) => p === null)) { console.error(`✗ ${id}: a screen corner does not meet the ground plane`); await page.close(); continue; }

  const suffix = PITCH ? `_p${PITCH}` : '';
  await page.locator('canvas').screenshot({ path: `${OUT}/${id}${suffix}.png` });
  let drift = null;
  if (DRIFT) {
    await page.waitForTimeout(400);
    await page.locator('canvas').screenshot({ path: `${OUT}/${id}${suffix}.drift.png` });
    const a = readFileSync(`${OUT}/${id}${suffix}.png`), b = readFileSync(`${OUT}/${id}${suffix}.drift.png`);
    drift = { bytesA: a.length, bytesB: b.length, identical: a.equals(b) };
    console.log(`   drift control ${id}: ${drift.identical ? 'IDENTICAL (0 bytes differ)' : '⚠ DIFFERS — every number below carries this'}`);
  }
  await page.close();

  const quad = res.quad;
  const area = quadArea(quad);
  // 🚨 NON-EMPTY BEFORE FILTERING — `[].filter(...).length === 0` is indistinguishable from
  // "the arena declares no boxes", and the second is the interesting failure.
  if (res.arena.cover.length === 0) { console.error(`✗ ${id}: arena declares ZERO cover boxes — every count below would be vacuous`); process.exitCode = 1; }
  if (res.arena.concealment.length === 0) { console.error(`✗ ${id}: arena declares ZERO concealment boxes — §29a is NOT placed on this tree`); process.exitCode = 1; }
  const coverIn = res.arena.cover.filter((c) => boxInQuad(c, quad));
  const concealIn = res.arena.concealment.filter((c) => boxInQuad(c, quad));
  const arenaArea = res.arena.width * res.arena.height;

  // The full box LISTS, written once, so `ar2_sweep.mjs` slides the same quad over the same
  // measured data instead of re-deriving either. Written from the FIRST station only and
  // asserted identical on every later one — a per-station arena would invalidate the sweep.
  if (rows.length === 0) {
    writeFileSync(`${OUT}/ar2_boxes.json`, JSON.stringify({
      arenaId: res.arena.id, width: res.arena.width, height: res.arena.height,
      center: res.arena.center, maxSafeRadius: res.arena.maxSafeRadius,
      cover: res.arena.cover, concealment: res.arena.concealment,
    }, null, 1));
  } else {
    const prev = JSON.parse(readFileSync(`${OUT}/ar2_boxes.json`, 'utf8'));
    if (prev.cover.length !== res.arena.cover.length || prev.concealment.length !== res.arena.concealment.length) {
      console.error(`✗ ${id}: the arena's box lists differ between stations — the sweep would be invalid`);
      process.exitCode = 1;
    }
  }

  rows.push({
    id, px, py, quad, areaWu2: area, shareOfArena: area / arenaArea,
    pitchDeg: res.pitchDeg, fairView: res.fairView,
    coverTotal: res.arena.cover.length, coverInFrame: coverIn.length, coverKinds: coverIn.map((c) => c.kind),
    concealTotal: res.arena.concealment.length, concealInFrame: concealIn.length, drift,
    draws: res.draws, arena: { width: res.arena.width, height: res.arena.height, center: res.arena.center, maxSafeRadius: res.arena.maxSafeRadius },
  });
  console.log(`✓ ${id} @(${px},${py})  ground ${area.toFixed(0)} wu² = ${(100 * area / arenaArea).toFixed(2)}% of map` +
    `  cover ${coverIn.length}/${res.arena.cover.length}  conceal ${concealIn.length}/${res.arena.concealment.length}` +
    `  DRAWS ${res.drawFrame.calls} · tris ${res.drawFrame.triangles} · fighters ${res.fighterCount ?? '?'}`);
}

await browser.close();
writeFileSync(`${OUT}/ar2_frame.json`, JSON.stringify({ base: BASE, viewport: [W, H], dims: DIMS, rows }, null, 1));
console.log(`\nwrote ${OUT}/ar2_frame.json  (${rows.length} stations)`);
} // end IS_MAIN
