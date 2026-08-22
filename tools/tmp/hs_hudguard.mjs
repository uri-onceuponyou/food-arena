#!/usr/bin/env node
/**
 * HS_HUDGUARD — the shared assertion that a frame about to be scored CONTAINS THE HUD.
 *
 * ## What this is for, and what it is NOT a second copy of
 *
 * `tools/tmp/wt_hudshot.mjs` (`9274f62`) already established the capture path: the
 * SHIPPED app route `/?player=…&enemy=…&seats=N` mounts the real `src/ui/hud.ts` over
 * the real arena with REAL sim state, so nothing has to be synthesised and
 * `src/preview.ts` does not have to grow a `piece=match`. That argument was re-derived
 * here and it holds — see `## THE CAPTURE PATH` below. This file does not duplicate it.
 *
 * What was MISSING is the guard. `wt_hudshot` asserted, but:
 *
 *   1. 🚨 **IT WAS POINTED AT A SELECTOR THAT DOES NOT EXIST.** It read
 *      `document.querySelector('.hud') ?? document.body`. There is no element with the
 *      class token `hud` anywhere in `src/` — `hud.ts` builds `<div class="hud-root">`.
 *      So the selector never matched, the `?? document.body` fallback swallowed it, and
 *      `hudCoverage` measured EVERY VISIBLE ELEMENT IN THE DOCUMENT while reporting a
 *      number called "HUD covers x% of frame". A HUD-less page has a body too, so the
 *      arm could never have gone red: it is `[].every()` wearing a different hat — the
 *      fallback is what guarantees the set is non-empty regardless of the truth.
 *      → Fixed here, and the fallback is DELETED rather than repaired. A guard whose
 *        miss-path is a default value is not a guard.
 *   2. It asserted AFTER `writeFile(png)`. A refused frame still sat on disk where a
 *      packet builder could pick it up.
 *   3. Its `--selftest` only exercised `hudCoverage`, a pure function. Nothing proved
 *      the HUD-presence arms FIRE. Per `CLAUDE.md` rule 6: *"`--selftest` validates a
 *      tool's LOGIC. It never validates where the tool is POINTED."* Both halves are
 *      here: `--selftest` (logic) and `--known-bad-live` (pointing).
 *   4. `q1_capture.mjs` — the arena PACKET tool — photographs the HUD by luck. It
 *      shoots the same shipped route, so its frames do carry one, but nothing in it
 *      asserts that. A regression that unmounted the HUD would have produced a silently
 *      HUD-less packet and every arm would have stayed green.
 *
 * ## THE CAPTURE PATH — why no `piece=match` and no `&hud=1`
 *
 * Re-derived rather than accepted. `src/preview.ts` routes `piece==='arena'` to
 * `mountArena()`, which adds arena + character models to a bare `Stage` and never
 * constructs a HUD — so the `wt_shot`/`wt_ablate`/`cz_shot`/`cam_shoot`/`wt_probe`
 * family IS structurally HUD-less, exactly as reported. But `q1_capture.mjs` does not
 * use `preview.html` at all: it drives `/?player=…` and `settle.mjs`'s `captureSettled`
 * shoots `page` (not `locator('canvas')`), so the DOM HUD is composited in. Verified on
 * the pixels, not on the source: `shots/q1/cap/match_donut_taco_00.png` carries both
 * nameplates, both HP bars, the clock, the zone strip, two floating pills, a weapon
 * slot and the radar.
 *
 * So a synthetic `MatchState` behind a new preview piece would be a WEAKER instrument
 * (HP and clock chosen by a tool author rather than by the sim) bolted onto a file whose
 * every historical packet depends on `piece=arena` rendering exactly what it renders
 * today. The path already exists. What it lacked was this.
 *
 * ## THE ARMS — and the ORDER is the whole design
 *
 *   A ROOT-EXISTS     `.hud-root` matched. No fallback. A miss is RED, never a default.
 *   B ROOT-NON-EMPTY  the root has ≥1 descendant. Asserted BEFORE any ratio over it.
 *   C ROWS            `.hud-fighter` count EQUALS the seats asked for (wt_hudshot's arm,
 *                     kept: a ">0" test cannot see a seat count the app ignored).
 *   D PILLS-EXIST     ≥1 `.hud-float` in the DOM. **The set is asserted non-empty BEFORE
 *                     it is filtered**, which is the entire point of this file.
 *   E PILLS-SHOWN     of those, ≥1 is actually displayed (a rect with area). This is the
 *                     INTERLOCK. Without it, arm G below is vacuous.
 *   F PILL-IN-SHOT    ≥1 shown pill INTERSECTS the viewport. `hud.ts:updateFloatingBars`
 *                     clamps x into frame but only floors y, so a pill CAN sit below the
 *                     bottom edge — this arm is not decorative.
 *   G ALL-SHOWN-IN    `shown.every(inViewport)`. 🚨 **DELIBERATELY VACUOUS ON AN EMPTY
 *                     SET, AND PRINTED THAT WAY.** `[].every()` is `true`. It is kept
 *                     precisely so `--known-bad-live` can show it standing GREEN while E
 *                     is red, which is what that failure looks like in the wild.
 *   H FURNITURE       clock, zone strip, weapon bar and radar each present — the other
 *                     named mid-frame furniture the plates carry.
 *   I COVERAGE        HUD share of the frame, computed only after the rect set is
 *                     asserted non-empty, and floored so a hairline HUD is caught.
 *
 * ## SELECTOR-REAL — the arm that would have caught the `.hud` bug
 *
 * Every selector is checked to LITERALLY APPEAR in `src/ui/hud.ts` before the browser is
 * opened. `.hud` would have failed this instantly. This is the cheap general form of the
 * defect: a selector typo is invisible at runtime the moment anything downstream has a
 * fallback, and stale-but-legal is this repo's most expensive bug class.
 *
 *   node tools/tmp/hs_hudguard.mjs --selftest          # LOGIC — offline, no browser
 *   node tools/tmp/hs_hudguard.mjs --verify <dir>      # audit a packet dir's sidecars
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-hs -- \
 *     node tools/tmp/hs_hudguard.mjs --known-bad-live --url '{URL}'   # POINTING
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes('--' + k);

// ═════════════════════════════════════════════════════════════════════════════
// THE SELECTORS — and the source token each one must be found in
// ═════════════════════════════════════════════════════════════════════════════

/**
 * `sel` is what the browser queries; `token` is what must literally appear in
 * `src/ui/hud.ts`. They are separate fields on purpose: `.hud-root` queries a CLASS
 * TOKEN, and the bug this file exists to prevent is a selector whose token is not the
 * one the source writes. Comparing the selector to itself would prove nothing.
 */
export const HUD_SELECTORS = {
  root: { sel: '.hud-root', token: 'hud-root', what: 'the HUD root' },
  row: { sel: '.hud-fighter', token: 'hud-fighter', what: 'per-fighter nameplate rows' },
  pill: { sel: '.hud-float', token: 'hud-float', what: 'floating name+HP pills' },
  clock: { sel: '.hud-clock', token: 'hud-clock', what: 'the match clock' },
  zone: { sel: '[data-el="zone-bar"]', token: 'data-el="zone-bar"', what: 'the zone strip' },
  weapon: { sel: '.hud-weapon-slot', token: 'hud-weapon-slot', what: 'the weapon bar' },
  radar: { sel: '.hud-radar', token: 'hud-radar', what: 'the radar' },
};

/**
 * Assert every selector above is a thing `src/ui/hud.ts` actually builds.
 *
 * Returns `{ ok, checks }`. `src` is a PARAMETER so `--selftest` can hand it a source
 * that is known not to contain them — a guard that can only ever see today's file
 * cannot be shown to fail.
 */
export function verifySelectors(src) {
  if (typeof src !== 'string' || src.length === 0) {
    throw new Error('hs_hudguard: empty source — nothing to verify selectors against');
  }
  const checks = Object.entries(HUD_SELECTORS).map(([key, s]) => ({
    arm: 'SELECTOR-REAL',
    name: `${key} (${s.sel})`,
    ok: src.includes(s.token),
    detail: src.includes(s.token) ? `token "${s.token}" found in source` : `🚨 token "${s.token}" IS NOT IN src/ui/hud.ts`,
  }));
  return { ok: checks.every((c) => c.ok), checks };
}

// ═════════════════════════════════════════════════════════════════════════════
// THE BROWSER PROBE
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Runs INSIDE the page. Self-contained — it closes over nothing, and takes the selector
 * table as its argument so the Node side stays the single source of it.
 *
 * ⚠️ It reports facts and judges NOTHING. All the deciding is in `judgeHud`, which is
 * pure and therefore testable against a known-bad without a browser.
 */
export function hudProbeFn(S) {
  const rootEl = document.querySelector(S.root.sel);
  const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
  const canvas = document.querySelector('canvas');
  const pills = Array.from(document.querySelectorAll(S.pill.sel)).map((el) => {
    const r = box(el);
    const cs = getComputedStyle(el);
    return {
      ...r,
      shown: r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden',
    };
  });
  // Every visible descendant box of the ROOT — used for coverage. Full-bleed tints
  // (.hud-fogedge is the viewport) are dropped: they are not furniture, and counting
  // one would report ~100% coverage on a frame with no readouts at all.
  const rects = rootEl
    ? Array.from(rootEl.querySelectorAll('*'))
      .filter((n) => n instanceof HTMLElement && n.offsetParent !== null)
      .map(box)
      .filter((r) => r.width > 1 && r.height > 1 && r.width < innerWidth * 0.98)
    : [];
  const count = (sel) => document.querySelectorAll(sel).length;
  return {
    rootFound: !!rootEl,
    rootDescendants: rootEl ? rootEl.querySelectorAll('*').length : 0,
    // Rule 4: an element can render BEHIND another. If the canvas were a DESCENDANT of
    // the root, a tool that hides the root to get a HUD-off control would also blank the
    // scene — the exact trap recorded on character-select. Measured, not assumed.
    canvasInsideRoot: !!(rootEl && canvas && rootEl.contains(canvas)),
    rows: count(S.row.sel),
    pills,
    furniture: {
      clock: count(S.clock.sel),
      zone: count(S.zone.sel),
      weapon: count(S.weapon.sel),
      radar: count(S.radar.sel),
    },
    rects,
    viewport: { w: innerWidth, h: innerHeight },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// COVERAGE
// ═════════════════════════════════════════════════════════════════════════════

/** Union area of a rect list as a fraction of w*h. THROWS on an empty list. */
export function rectCoverage(rects, w, h) {
  if (!Array.isArray(rects) || rects.length === 0) {
    throw new Error('hs_hudguard: no rects — nothing to measure coverage over');
  }
  if (!(w > 0 && h > 0)) throw new Error(`hs_hudguard: degenerate viewport ${w}x${h}`);
  const grid = new Uint8Array(w * h);
  let n = 0;
  for (const r of rects) {
    const x0 = Math.max(0, Math.floor(r.x)); const x1 = Math.min(w, Math.ceil(r.x + r.width));
    const y0 = Math.max(0, Math.floor(r.y)); const y1 = Math.min(h, Math.ceil(r.y + r.height));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const p = y * w + x; if (!grid[p]) { grid[p] = 1; n++; } }
  }
  return { px: n, frac: +(n / (w * h)).toFixed(5) };
}

// ═════════════════════════════════════════════════════════════════════════════
// THE JUDGE — pure, so it can be shown to fail without a GPU
// ═════════════════════════════════════════════════════════════════════════════

const intersects = (r, vp) => r.x + r.width > 0 && r.y + r.height > 0 && r.x < vp.w && r.y < vp.h;

/**
 * @param dom   a `hudProbeFn` record
 * @param opts  { seats?: number, minCoverage?: number }
 * @returns     { ok, checks: [{ arm, name, ok, detail }], coverage }
 *
 * Every check carries the NUMBER it decided on. A green tick with no number is a
 * comment, not a measurement.
 */
export function judgeHud(dom, opts = {}) {
  const minCov = opts.minCoverage ?? 0.01;
  const checks = [];
  const add = (arm, name, ok, detail) => { checks.push({ arm, name, ok: !!ok, detail }); return !!ok; };

  if (!dom || typeof dom !== 'object') throw new Error('hs_hudguard: no probe record to judge');
  const vp = dom.viewport ?? { w: 0, h: 0 };

  // A — no fallback. A miss is red, not a default.
  const aOk = add('A ROOT-EXISTS', HUD_SELECTORS.root.sel, dom.rootFound === true,
    dom.rootFound ? 'matched' : `🚨 ${HUD_SELECTORS.root.sel} matched NOTHING — the HUD did not mount (or the selector is stale)`);

  // B — non-empty BEFORE any ratio is taken over the root's children.
  add('B ROOT-NON-EMPTY', 'root has descendants', aOk && dom.rootDescendants >= 1,
    `${dom.rootDescendants} descendants`);

  // Structural fact, reported so a HUD-off control cannot be built on a wrong assumption.
  add('  CANVAS-SIBLING', 'canvas is NOT inside the HUD root', dom.canvasInsideRoot === false,
    dom.canvasInsideRoot ? '🚨 canvas is a DESCENDANT of the HUD root — hiding the root blanks the scene' : 'canvas is a sibling; the root can be hidden without blanking the scene');

  // C — equality with the seat count, not ">0".
  if (opts.seats != null) {
    add('C ROWS', `.hud-fighter === seats(${opts.seats})`, dom.rows === opts.seats,
      `${dom.rows} rows vs ${opts.seats} seats`);
  } else {
    add('C ROWS', '.hud-fighter >= 2 (MIN_FIGHTERS)', dom.rows >= 2, `${dom.rows} rows`);
  }

  // ── D/E/F/G: the non-empty-before-you-filter sequence. ─────────────────────
  const pills = Array.isArray(dom.pills) ? dom.pills : [];
  const dOk = add('D PILLS-EXIST', `${HUD_SELECTORS.pill.sel} in the DOM`, pills.length >= 1,
    `${pills.length} pills`);

  // 🚨 THE INTERLOCK. `shown` is a FILTERED set, so it is asserted non-empty HERE,
  // before arm G quantifies over it. Delete this line and G goes green on a HUD whose
  // pills are all display:none — which is a non-empty HUD that appears in no photograph.
  const shown = pills.filter((p) => p.shown);
  const eOk = add('E PILLS-SHOWN', 'the FILTERED set is NON-EMPTY', dOk && shown.length >= 1,
    `${shown.length} of ${pills.length} pills displayed`);

  const inShot = shown.filter((p) => intersects(p, vp));
  add('F PILL-IN-SHOT', '>=1 shown pill INTERSECTS the viewport', eOk && inShot.length >= 1,
    `${inShot.length} of ${shown.length} shown pills inside ${vp.w}x${vp.h}`);

  // G is the vacuity exhibit. It is NOT gated on E, deliberately.
  const gVacuous = shown.length === 0;
  add('G ALL-SHOWN-IN', 'shown.every(inViewport)  ← vacuous on an empty set', shown.every((p) => intersects(p, vp)),
    gVacuous ? '⚠️ TRUE BY VACUITY — 0 shown pills; [].every() is true. Arm E is what catches this.' : `${inShot.length}/${shown.length}`);

  // H — the rest of the named furniture.
  const fu = dom.furniture ?? {};
  for (const [k, sel] of [['clock', HUD_SELECTORS.clock], ['zone', HUD_SELECTORS.zone], ['weapon', HUD_SELECTORS.weapon], ['radar', HUD_SELECTORS.radar]]) {
    add('H FURNITURE', `${k} (${sel.sel})`, (fu[k] ?? 0) >= 1, `${fu[k] ?? 0} node(s)`);
  }

  // I — coverage, only after the rect set is known non-empty.
  let coverage = null;
  const rects = Array.isArray(dom.rects) ? dom.rects : [];
  if (rects.length === 0) {
    add('I COVERAGE', 'rect set NON-EMPTY', false, '🚨 0 visible HUD rects — nothing to measure over');
  } else {
    coverage = rectCoverage(rects, vp.w, vp.h);
    add('I COVERAGE', `HUD covers >= ${(minCov * 100).toFixed(1)}% of frame`, coverage.frac >= minCov,
      `${(coverage.frac * 100).toFixed(2)}% (${coverage.px}px of ${vp.w * vp.h})`);
  }

  return { ok: checks.every((c) => c.ok), checks, coverage };
}

/** Human-readable. Returns the number of failed arms. */
export function printChecks(res, indent = '  ') {
  let bad = 0;
  for (const c of res.checks) {
    if (!c.ok) bad++;
    console.log(`${indent}${c.ok ? 'ok  ' : 'FAIL'} ${c.arm.padEnd(18)} ${c.name.padEnd(46)} ${c.detail}`);
  }
  return bad;
}

/**
 * Probe a live Playwright page and judge it. THROWS unless `opts.enforce === false`.
 * Call this BEFORE the PNG is written — a refused frame must not exist on disk.
 */
export async function assertHudInFrame(page, opts = {}) {
  const dom = await page.evaluate(hudProbeFn, HUD_SELECTORS);
  const res = judgeHud(dom, opts);
  if (!res.ok && opts.enforce !== false) {
    printChecks(res);
    throw new Error(`hs_hudguard: HUD ABSENT OR INCOMPLETE — refusing to save a frame that a critic would score as having no interface (${res.checks.filter((c) => !c.ok).map((c) => c.arm).join(', ')})`);
  }
  return { dom, res };
}

/** The block a capture sidecar must carry for `--verify` to accept it. */
export function hudSidecar(dom, res) {
  return {
    guard: 'tools/tmp/hs_hudguard.mjs',
    ok: res.ok,
    rows: dom.rows,
    pillsTotal: dom.pills.length,
    pillsShown: dom.pills.filter((p) => p.shown).length,
    pillsInShot: dom.pills.filter((p) => p.shown && intersects(p, dom.viewport)).length,
    coverageFrac: res.coverage ? res.coverage.frac : null,
    furniture: dom.furniture,
    failedArms: res.checks.filter((c) => !c.ok).map((c) => `${c.arm}: ${c.detail}`),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// --verify : a PACKET directory may not contain a HUD-less frame
// ═════════════════════════════════════════════════════════════════════════════

/**
 * @param entries `[{ file, sidecar }]` — sidecar may be null (no sidecar at all).
 *
 * ⚠️ NON-EMPTY FIRST. A directory with no PNGs at all must FAIL, not pass. That is the
 * `[].every()` shape at the packet level, and it is how a build script that quietly
 * globbed the wrong directory ships a green run with nothing in it.
 */
export function verifyPacket(entries) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ arm: 'PACKET', name, ok: !!ok, detail });
  add('NON-EMPTY  the directory contains frames', entries.length > 0, `${entries.length} png(s)`);
  for (const e of entries) {
    if (!e.sidecar) { add(e.file, false, '🚨 no .capture.json sidecar — provenance unknown'); continue; }
    if (!e.sidecar.hud) { add(e.file, false, '🚨 sidecar carries NO hud block — captured by a tool that never checked'); continue; }
    add(e.file, e.sidecar.hud.ok === true,
      e.sidecar.hud.ok === true
        ? `rows ${e.sidecar.hud.rows} · pills in shot ${e.sidecar.hud.pillsInShot} · HUD ${((e.sidecar.hud.coverageFrac ?? 0) * 100).toFixed(2)}%`
        : `🚨 ${(e.sidecar.hud.failedArms ?? ['unknown']).join('; ')}`);
  }
  return { ok: checks.every((c) => c.ok), checks };
}

function readPacket(dir) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  return files.map((f) => {
    const sc = join(dir, `${f}.capture.json`);
    let sidecar = null;
    if (existsSync(sc)) { try { sidecar = JSON.parse(readFileSync(sc, 'utf8')); } catch { sidecar = null; } }
    return { file: f, sidecar };
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// SELFTEST — the LOGIC half. Every arm shown to MOVE and to HOLD.
// ═════════════════════════════════════════════════════════════════════════════

/** A record that passes everything, used as the base every known-bad mutates. */
function goodDom() {
  return {
    rootFound: true,
    rootDescendants: 64,
    canvasInsideRoot: false,
    rows: 6,
    pills: [
      { x: 300, y: 300, width: 90, height: 22, shown: true },
      { x: 700, y: 420, width: 90, height: 22, shown: true },
    ],
    furniture: { clock: 1, zone: 1, weapon: 4, radar: 1 },
    rects: [{ x: 0, y: 0, width: 400, height: 60 }, { x: 300, y: 300, width: 90, height: 22 }],
    viewport: { w: 1300, h: 740 },
  };
}

function selftest() {
  let pass = 0; let fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`  ok   ${name}${detail ? '  ' + detail : ''}`); }
    else { fail++; console.log(`  FAIL ${name}  ${detail}`); }
  };
  const armOf = (res, prefix) => res.checks.find((c) => c.arm.startsWith(prefix));

  console.log('§A  HOLDS — a complete HUD passes every arm');
  const good = judgeHud(goodDom(), { seats: 6 });
  ok('A1 the good record is ok', good.ok === true, good.ok ? '' : good.checks.filter((c) => !c.ok).map((c) => c.arm).join(','));
  ok('A2 coverage was computed', good.coverage !== null && good.coverage.frac > 0, `frac=${good.coverage?.frac}`);

  console.log('\n§B  KNOWN-BAD — every arm is shown to FIRE on the bug it guards');
  // B1 the HUD never mounted. This is the defect the whole file exists for.
  const b1 = judgeHud({ ...goodDom(), rootFound: false, rootDescendants: 0, rows: 0, pills: [], rects: [] }, { seats: 6 });
  ok('B1 ROOT-EXISTS fires when .hud-root matched nothing', b1.ok === false && armOf(b1, 'A ').ok === false);
  ok('B1 …and COVERAGE refuses rather than returning 0', armOf(b1, 'I ').ok === false, armOf(b1, 'I ').detail);

  // B2 an EMPTY root — the shape a fallback to document.body hides.
  const b2 = judgeHud({ ...goodDom(), rootDescendants: 0 }, { seats: 6 });
  ok('B2 ROOT-NON-EMPTY fires on a root with 0 descendants', b2.ok === false && armOf(b2, 'B ').ok === false);

  // B3 seat count silently ignored.
  const b3 = judgeHud({ ...goodDom(), rows: 2 }, { seats: 6 });
  ok('B3 ROWS fires when the app honoured 2 of 6 seats', b3.ok === false && armOf(b3, 'C ').ok === false, armOf(b3, 'C ').detail);

  // B4 🚨 THE VACUITY ARM. Pills EXIST but none is displayed. Arm G — the `.every()` —
  //    must stand GREEN, and arm E must be what goes red. If E is ever deleted, this
  //    test fails, which is the point.
  const b4 = judgeHud({ ...goodDom(), pills: goodDom().pills.map((p) => ({ ...p, shown: false })) }, { seats: 6 });
  ok('B4 PILLS-EXIST still passes (the pills are in the DOM)', armOf(b4, 'D ').ok === true, armOf(b4, 'D ').detail);
  ok('B4 PILLS-SHOWN fires — the filtered set is empty', armOf(b4, 'E ').ok === false, armOf(b4, 'E ').detail);
  ok('B4 🚨 the .every() arm is GREEN BY VACUITY, as documented', armOf(b4, 'G ').ok === true, armOf(b4, 'G ').detail);
  ok('B4 the overall verdict is still REFUSED', b4.ok === false, 'E is the interlock that saves it');

  // B5 a non-empty, displayed HUD parked outside the frame.
  const b5 = judgeHud({ ...goodDom(), pills: goodDom().pills.map((p) => ({ ...p, x: -9999, y: -9999 })) }, { seats: 6 });
  ok('B5 PILL-IN-SHOT fires on pills parked at (-9999,-9999)', armOf(b5, 'F ').ok === false, armOf(b5, 'F ').detail);
  ok('B5 …and PILLS-SHOWN still passes, so F is not double-counting E', armOf(b5, 'E ').ok === true);
  ok('B5 …and the .every() arm ALSO fires here (set is non-empty)', armOf(b5, 'G ').ok === false, 'G only lies on an EMPTY set');

  // B6 a pill below the bottom edge — the case hud.ts's x-clamp does NOT cover.
  const b6 = judgeHud({ ...goodDom(), pills: goodDom().pills.map((p) => ({ ...p, y: 900 })) }, { seats: 6 });
  ok('B6 PILL-IN-SHOT fires on a pill below the bottom edge', armOf(b6, 'F ').ok === false, armOf(b6, 'F ').detail);

  // B7 furniture.
  const b7 = judgeHud({ ...goodDom(), furniture: { clock: 1, zone: 0, weapon: 4, radar: 1 } }, { seats: 6 });
  ok('B7 FURNITURE fires on a missing zone strip', b7.ok === false && b7.checks.some((c) => c.arm.startsWith('H ') && !c.ok));

  // B8 a hairline HUD — non-empty, on screen, and invisible in a photograph.
  const b8 = judgeHud({ ...goodDom(), rects: [{ x: 0, y: 0, width: 3, height: 3 }] }, { seats: 6 });
  ok('B8 COVERAGE fires on a hairline HUD (9px of 962000)', armOf(b8, 'I ').ok === false, armOf(b8, 'I ').detail);

  // B9 the canvas-descendant trap.
  const b9 = judgeHud({ ...goodDom(), canvasInsideRoot: true }, { seats: 6 });
  ok('B9 CANVAS-SIBLING fires when the canvas is inside the HUD root', b9.ok === false);

  console.log('\n§C  rectCoverage — MOVES, HOLDS, and REFUSES an empty set');
  let threw = false; try { rectCoverage([], 10, 10); } catch { threw = true; }
  ok('C1 NON-EMPTY an empty rect list THROWS rather than returning 0', threw);
  let threw2 = false; try { rectCoverage([{ x: 0, y: 0, width: 1, height: 1 }], 0, 0); } catch { threw2 = true; }
  ok('C2 NON-EMPTY a 0x0 viewport THROWS rather than dividing by zero', threw2);
  ok('C3 MOVES one 5x4 rect in 10x10 is 0.20', rectCoverage([{ x: 0, y: 0, width: 5, height: 4 }], 10, 10).frac === 0.2);
  ok('C4 HOLDS two IDENTICAL rects still cover 0.20, not 0.40',
    rectCoverage([{ x: 0, y: 0, width: 5, height: 4 }, { x: 0, y: 0, width: 5, height: 4 }], 10, 10).frac === 0.2);
  ok('C5 an off-frame rect is CLIPPED, not counted whole',
    rectCoverage([{ x: 8, y: 8, width: 100, height: 100 }], 10, 10).px === 4);

  console.log('\n§D  SELECTOR-REAL — against the REAL src/ui/hud.ts, and against a known-bad');
  const repo = resolve(arg('repo', process.cwd()));
  const realSrc = readFileSync(join(repo, 'src/ui/hud.ts'), 'utf8');
  const real = verifySelectors(realSrc);
  ok('D1 every shipped selector is a token src/ui/hud.ts writes', real.ok === true,
    real.checks.filter((c) => !c.ok).map((c) => c.name).join(',') || `${real.checks.length} selectors`);
  // The known-bad is the ACTUAL historical bug: `.hud`, which `wt_hudshot` queried and
  // `?? document.body` hid. It must be reported as absent from the real source.
  ok('D2 🚨 the historical `.hud` selector is NOT in src/ui/hud.ts',
    !/class(Name)?\s*=\s*["']hud["']/.test(realSrc) && !realSrc.includes('class="hud"'),
    'this is the bug that made hudCoverage measure document.body');
  const bad = verifySelectors('export function createHud() { root.innerHTML = `<div class="nope"></div>`; }');
  ok('D3 verifySelectors FIRES on a source that builds none of them', bad.ok === false,
    `${bad.checks.filter((c) => !c.ok).length}/${bad.checks.length} arms red`);
  let threw3 = false; try { verifySelectors(''); } catch { threw3 = true; }
  ok('D4 NON-EMPTY an empty source THROWS rather than passing every arm', threw3);

  console.log('\n§E  verifyPacket — the packet-level [].every()');
  const okSide = { hud: { ok: true, rows: 6, pillsInShot: 5, coverageFrac: 0.18 } };
  ok('E1 HOLDS a packet of guarded frames passes',
    verifyPacket([{ file: 'a.png', sidecar: okSide }, { file: 'b.png', sidecar: okSide }]).ok === true);
  ok('E2 🚨 NON-EMPTY an EMPTY directory FAILS rather than passing vacuously',
    verifyPacket([]).ok === false, 'every() over no frames is true — this is the interlock');
  ok('E3 fires on a frame with no sidecar at all',
    verifyPacket([{ file: 'a.png', sidecar: null }]).ok === false);
  ok('E4 fires on a sidecar from a tool that never checked the HUD',
    verifyPacket([{ file: 'a.png', sidecar: { tool: 'wt_shot', painted: true } }]).ok === false);
  ok('E5 fires on a frame the guard REFUSED',
    verifyPacket([{ file: 'a.png', sidecar: { hud: { ok: false, failedArms: ['A ROOT-EXISTS: matched nothing'] } } }]).ok === false);

  console.log(`\n${pass} pass, ${fail} fail`);
  return fail === 0 ? 0 : 1;
}

// ═════════════════════════════════════════════════════════════════════════════
// --known-bad-live : the POINTING half. A selftest never validates where a tool AIMS.
// ═════════════════════════════════════════════════════════════════════════════

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

/**
 * Drive the SHIPPED match route four times against one browser:
 *
 *   CONTROL             untouched            → the guard must PASS
 *   KB-ROOT             `.hud-root` removed  → A/B/C/D/I must fire
 *   KB-PILLS-HIDDEN     pills display:none   → D passes, E fires, **G stands GREEN**
 *   KB-PILLS-OFFSCREEN  pills translated out → D/E pass, F fires
 *
 * 🚨 Every sabotage is planted where the bug CAN EXPRESS ITSELF: on a live match page
 * with a real HUD mounted and pills that really are being positioned every frame. A
 * known-bad staged somewhere the symptom cannot occur is green for the wrong reason.
 */
async function knownBadLive(base) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const seats = Number(arg('seats', '6'));
  const results = [];
  const load = async (sabotage) => {
    const page = await browser.newPage({ viewport: { width: 1300, height: 740 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => console.error('  PAGEERROR', String(e).slice(0, 160)));
    const q = new URLSearchParams({
      player: 'hamburger', enemy: 'donut', px: '1400', py: '1000',
      fogRadius: '1200', simSpeed: '0.30', pointerLock: '0', seats: String(seats),
    });
    await page.goto(`${base}/?${q}`, { waitUntil: 'networkidle', timeout: 180_000 });
    await page.waitForFunction('window.__gameReady === true', null, { timeout: 180_000 });
    await page.waitForTimeout(Number(arg('settle', '9000')));
    if (sabotage) await sabotage(page);
    await page.waitForTimeout(400);
    const dom = await page.evaluate(hudProbeFn, HUD_SELECTORS);
    await page.close();
    return judgeHud(dom, { seats });
  };
  const armOf = (res, p) => res.checks.find((c) => c.arm.startsWith(p));

  console.log(`\n── CONTROL (untouched, seats=${seats}) — the guard must PASS ──`);
  const control = await load(null);
  printChecks(control);
  results.push(['CONTROL', control.ok === true, 'must PASS']);

  console.log('\n── KB-ROOT: `.hud-root` removed from the live page — must REFUSE ──');
  const kbRoot = await load(async (p) => { await p.evaluate((s) => document.querySelector(s)?.remove(), HUD_SELECTORS.root.sel); });
  printChecks(kbRoot);
  results.push(['KB-ROOT refused', kbRoot.ok === false, 'must REFUSE']);
  results.push(['KB-ROOT arm A fired', armOf(kbRoot, 'A ').ok === false, 'ROOT-EXISTS']);
  results.push(['KB-ROOT arm I refused rather than reporting 0%', armOf(kbRoot, 'I ').ok === false, 'COVERAGE']);

  console.log('\n── KB-PILLS-HIDDEN: pills display:none — a NON-EMPTY HUD in no photograph ──');
  const kbHid = await load(async (p) => { await p.addStyleTag({ content: `${HUD_SELECTORS.pill.sel}{display:none!important}` }); });
  printChecks(kbHid);
  results.push(['KB-PILLS-HIDDEN refused', kbHid.ok === false, 'must REFUSE']);
  results.push(['KB-PILLS-HIDDEN arm D still PASSES', armOf(kbHid, 'D ').ok === true, 'the pills are still in the DOM']);
  results.push(['KB-PILLS-HIDDEN arm E fired', armOf(kbHid, 'E ').ok === false, 'the INTERLOCK']);
  results.push(['🚨 KB-PILLS-HIDDEN arm G stood GREEN BY VACUITY', armOf(kbHid, 'G ').ok === true, '[].every() — this is what E exists to catch']);

  console.log('\n── KB-PILLS-OFFSCREEN: pills translated to (-9999,-9999) — must REFUSE ──');
  const kbOff = await load(async (p) => { await p.addStyleTag({ content: `${HUD_SELECTORS.pill.sel}{transform:translate(-9999px,-9999px)!important}` }); });
  printChecks(kbOff);
  results.push(['KB-PILLS-OFFSCREEN refused', kbOff.ok === false, 'must REFUSE']);
  results.push(['KB-PILLS-OFFSCREEN arm E still PASSES', armOf(kbOff, 'E ').ok === true, 'they are displayed, just not in frame']);
  results.push(['KB-PILLS-OFFSCREEN arm F fired', armOf(kbOff, 'F ').ok === false, 'PILL-IN-SHOT']);

  await browser.close();
  console.log('\n══ KNOWN-BAD-LIVE VERDICT ══');
  let bad = 0;
  for (const [name, okv, why] of results) { if (!okv) bad++; console.log(`  ${okv ? 'ok  ' : 'FAIL'} ${name.padEnd(52)} ${why}`); }
  console.log(bad === 0 ? '\nhs_hudguard known-bad-live: ALL PASS — the guard is pointed at a real HUD and fires on three real sabotages'
    : `\nhs_hudguard known-bad-live: ${bad} FAIL`);
  return bad === 0 ? 0 : 1;
}

// ═════════════════════════════════════════════════════════════════════════════

const isMain = (() => {
  try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();

if (isMain) {
  if (has('selftest')) process.exit(selftest());
  if (has('verify')) {
    const dir = arg('verify');
    if (!dir || !existsSync(dir)) { console.error(`hs_hudguard --verify: no such directory ${dir}`); process.exit(2); }
    const res = verifyPacket(readPacket(dir));
    console.log(`hs_hudguard --verify ${dir}`);
    const bad = printChecks(res);
    console.log(bad === 0 ? 'PACKET OK — every frame carries a HUD the guard accepted' : `PACKET REFUSED — ${bad} problem(s)`);
    process.exit(bad === 0 ? 0 : 3);
  }
  if (has('known-bad-live')) {
    const BASE = (arg('url') ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
    if (!BASE) { console.error('hs_hudguard: --known-bad-live needs --url or PREVIEW_BASE'); process.exit(2); }
    if (/:5173(\/|$)/.test(BASE)) { console.error('hs_hudguard: --url is the SHARED dev server. Never measure there.'); process.exit(2); }
    process.exit(await knownBadLive(BASE));
  }
  console.error('hs_hudguard: use --selftest | --verify <dir> | --known-bad-live --url <base>');
  process.exit(2);
}
