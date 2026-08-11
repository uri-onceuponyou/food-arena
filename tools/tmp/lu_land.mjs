#!/usr/bin/env node
/**
 * LANDSCAPE HUD ACCEPTANCE — the controls are out of the centre of play, and stayed
 * reachable while getting there.
 *
 * `tools/tmp/lu_occlude.mjs` answers "how much of the guaranteed view does a control
 * hide". It is a MEASUREMENT and it is deliberately not a gate: it needs a live match,
 * it takes minutes, and the number it prints is a continuum. This is the gate — cheap,
 * boolean, and about the properties that must not silently come back.
 *
 * ── WHAT IT ASSERTS, AND THE DEFECT EACH ROW GUARDS ─────────────────────────
 *   A  CORNER      The tray's right edge is within a gutter of the frame's right edge,
 *                  and its bottom within a gutter of the bottom. The defect: someone
 *                  "tidies" the rule back to `left: 50%` and the tray is centred again.
 *   B  CENTRE      No PERSISTENT control's rect intersects the CENTRE COLUMN — the
 *                  middle third of the width, below the top bar. This is the reference
 *                  pattern stated as an assertion: corners for controls, centre kept
 *                  clear.
 *                  ⚠️ THE TWO RESTING HINTS ARE EXEMPT, AND THE EXEMPTION IS EARNED BY
 *                  ROW H, NOT BY THIS COMMENT. At 667x375 the geometry is genuinely
 *                  over-constrained: the aim hint is 92px wide and there are 74px
 *                  between the centre third (ends x=445) and the tray's 12px clearance
 *                  (starts x=519), so it cannot both clear the band and clear the
 *                  buttons. Exempting it would be a fudge if the hint were chrome — it
 *                  is not: it is `pointer-events: none` and it is removed for the rest
 *                  of the match by the first touch in its own zone. H proves that with
 *                  a real finger. If H ever fails, B's exemption is void and this
 *                  battery says so on the next line.
 *   H  TRANSIENT   A real touch in each zone permanently removes that zone's hint. This
 *                  is what makes B's exemption a measurement rather than an excuse.
 *   C  NO OVERLAP  The aim stick's resting hint (ring AND label) does not intersect the
 *                  tray. These live in two different files and two different
 *                  stylesheets, so nothing but a check couples them — and the first cut
 *                  of this pass shipped an 18px collision between them.
 *   D  TOUCH FLOOR Every weapon slot is at least 44x44 CSS px. The tray moved corner-ward
 *                  to buy clearance; buying it by shrinking the buttons instead would be
 *                  a different, worse change that looks identical in a screenshot.
 *   E  INSETS      Every control is inside the safe-area insets, with a notch injected.
 *                  A landscape phone puts its notch on a SIDE, which is the edge the
 *                  tray now hugs — so this is the row this pass created the risk for.
 *   F  REACH       The tray is inside the aim thumb's half of the screen (`ZONE_SPLIT`),
 *                  i.e. the thumb that must reach it is the one it is next to.
 *   G  UNCHANGED   With `fa-touch-capable` OFF the tray is still bottom-centre, to the
 *                  pixel. Desktop and every existing headless probe are untouched by
 *                  construction, and that is what keeps `menu_accept` out of this.
 *
 * ── KNOWN-BAD INPUT (`CLAUDE.md` §6) ────────────────────────────────────────
 * `--known-bad` re-runs the whole battery with the tray forced back to one row at
 * bottom-centre by an inline style. A, B and F MUST fail there. If they pass, the
 * assertions are tautologies and the run exits non-zero saying so — a guard that has
 * not been shown to fail on the bug it guards against is not a guard.
 *
 *   node tools/tmp/headserve.mjs --ref <sha> --overlay src/ui/hud.ts --overlay src/game/touch.ts -- \
 *     node tools/tmp/lu_land.mjs
 *   node tools/tmp/lu_land.mjs --url <snapshot> --known-bad
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv.slice(2);
const has = (k) => a.includes(k);
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = (get('--url', process.env.PREVIEW_BASE) ?? 'http://localhost:5188').replace(/\/$/, '');
const SAVE = get('--save', null);

const VPS = [
  { tag: 'ph-844', w: 844, h: 390 },
  { tag: 'ph-667', w: 667, h: 375 },
  { tag: 'ph-932', w: 932, h: 430 },
  { tag: 'ph-740', w: 740, h: 360 },
];
/** A landscape phone wears its notch on a SIDE. Injected on the left, which is where a
 *  right-handed landscape grip usually puts it, plus a home-indicator inset at the bottom. */
const NOTCH = { l: 44, r: 0, t: 0, b: 21 };
const GUTTER = 40;   // how far from an edge a control may sit and still count as "in the corner"
const TOUCH_MIN = 44;

let pass = 0, fail = 0;
const rows = [];
const check = (name, ok, detail = '') => {
  if (ok) pass++; else fail++;
  rows.push({ name, ok, detail });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} - ${name}${detail ? `   ${detail}` : ''}`);
};

const overlap = (a, b) => {
  if (!a || !b) return null;
  const x = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const y = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return x > 0.5 && y > 0.5 ? { x: Math.round(x), y: Math.round(y) } : null;
};

async function probe(browser, vp, { touch, notch, knownBad }) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  // ⚠️ RE-AIMED 2026-08-11. WAS `px=340&py=500&fogRadius=850` — the 1× map's `west_lane`
  // and the 1× `maxSafeRadius`. On the shipped 2800×2000 map that point is **inside a
  // `freezer` CoverBox** and **1,172 wu from centre against an 850 wu ring**, so this
  // registered gate has been photographing a fighter buried in a prop, in the death zone.
  await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=600&py=1000&fogRadius=1985&simSpeed=0.02&pointerLock=0`,
    { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 120_000 });
  await page.waitForFunction(() => window.__matchDebug?.phase === 'playing', null, { timeout: 120_000 });
  await page.evaluate(([t, n]) => {
    // `isMobile: true` already sets `fa-touch-capable` via `(pointer: coarse)`; the
    // OFF arm has to take it away again, which is the only way to read arm G.
    const cl = document.documentElement.classList;
    if (t) cl.add('fa-touch-capable', 'fa-touch');
    else cl.remove('fa-touch-capable', 'fa-touch');
    if (n) {
      const s = document.documentElement.style;
      s.setProperty('--fa-safe-l', `${n.l}px`); s.setProperty('--fa-safe-r', `${n.r}px`);
      s.setProperty('--fa-safe-t', `${n.t}px`); s.setProperty('--fa-safe-b', `${n.b}px`);
    }
  }, [touch, notch]);
  await page.waitForTimeout(500);
  if (knownBad) {
    await page.evaluate(() => {
      const el = document.querySelector('.hud-weapons');
      if (el) el.setAttribute('style', 'position:absolute;left:50%;right:auto;top:auto;bottom:18px;'
        + 'transform:translateX(-50%);display:flex;flex-direction:row;flex-wrap:nowrap;gap:10px;width:auto;height:auto;');
    });
    await page.waitForTimeout(250);
  }
  const out = await page.evaluate(() => {
    const one = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    const many = (s) => [...document.querySelectorAll(s)].map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }).filter((r) => r.width > 0 && r.height > 0);
    return {
      vw: window.innerWidth, vh: window.innerHeight,
      tray: one('.hud-weapons'), slots: many('.hud-weapon-slot'),
      hintRing: one('.tch-hint--aim .tch-hint-ring'), hintLabel: one('.tch-hint--aim .tch-hint-label'),
      hintAim: one('.tch-hint--aim'), hintMove: one('.tch-hint--move'),
      radar: one('.hud-radar'), topbar: one('.hud-topbar'), mute: one('.hud-mute'),
      capable: document.documentElement.classList.contains('fa-touch-capable'),
    };
  });
  // ── H: a REAL finger in each zone, over CDP, then re-read the hints ───────
  // 🚨 NOT a synthetic click and NOT a class flip. `touch.ts` adds `is-used` from its
  // own `touchstart` handler, and only for a touch that `ownsTarget` accepts — so
  // anything short of a dispatched touch point would be testing this probe, not the
  // game. The plants are inside each zone and away from every control.
  let hintsAfter = null;
  if (touch && !knownBad) {
    const cdp = await ctx.newCDPSession(page);
    const f = (x, y, id) => ({ x: Math.round(x), y: Math.round(y), id, radiusX: 12, radiusY: 12, force: 1 });
    const mv = { x: vp.w * 0.28, y: vp.h * 0.55 };
    const am = { x: vp.w * 0.60, y: vp.h * 0.45 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [f(mv.x, mv.y, 1)] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [f(mv.x, mv.y, 1), f(am.x, am.y, 2)] });
    await page.waitForTimeout(200);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => {});
    await page.waitForTimeout(200);
    hintsAfter = await page.evaluate(([m, a2]) => {
      const st = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).display : 'missing'; };
      return {
        move: st('.tch-hint--move'), aim: st('.tch-hint--aim'),
        moveTarget: (document.elementFromPoint(m.x, m.y) || {}).tagName ?? null,
        aimTarget: (document.elementFromPoint(a2.x, a2.y) || {}).tagName ?? null,
      };
    }, [mv, am]);
  }
  if (SAVE) { await mkdir(SAVE, { recursive: true }); await page.screenshot({ path: `${SAVE}/${vp.tag}${touch ? '-touch' : '-desk'}${knownBad ? '-knownbad' : ''}.png` }); }
  await ctx.close();
  return { ...out, hintsAfter, errs };
}

async function run() {
  const browser = await chromium.launch({ args: LAUNCH });
  const knownBad = has('--known-bad');
  if (knownBad) console.log('⚠️  --known-bad: the tray is FORCED back to one row at bottom-centre. A, B and F must FAIL.\n');
  const badArms = [];

  for (const vp of VPS) {
    const t = `[${vp.tag} ${vp.w}x${vp.h}]`;
    const s = await probe(browser, vp, { touch: true, notch: NOTCH, knownBad });
    console.log(`${t} touch, notch l${NOTCH.l}/b${NOTCH.b}`);
    if (s.errs.length) console.log(`       ⚠️ page errors: ${s.errs.slice(0, 2).join(' | ')}`);
    if (!s.capable) { check(`${t} the touch arm really has fa-touch-capable`, false); continue; }

    // A — CORNER
    const rightGap = s.vw - (s.tray.x + s.tray.width);
    const bottomGap = s.vh - (s.tray.y + s.tray.height);
    const cornerOk = rightGap <= GUTTER + NOTCH.r && bottomGap <= GUTTER + NOTCH.b;
    check(`${t} A the tray is in the bottom-right corner`, cornerOk,
      `right gap ${Math.round(rightGap)}px, bottom gap ${Math.round(bottomGap)}px, allowed <= ${GUTTER + NOTCH.r}/${GUTTER + NOTCH.b}`);
    badArms.push({ arm: 'A', vp: vp.tag, ok: cornerOk });

    // B — CENTRE COLUMN CLEAR, below the top bar
    const band = { x: s.vw / 3, y: (s.topbar?.y ?? 0) + (s.topbar?.height ?? 0), width: s.vw / 3, height: s.vh };
    band.height = s.vh - band.y;
    const intruders = [];
    // Persistent chrome only — see the header on why the two hints are exempt and what
    // row H has to prove for that exemption to stand.
    for (const [name, r] of [['tray', s.tray], ['radar', s.radar], ['mute', s.mute]]) {
      const o = overlap(band, r);
      if (o) intruders.push(`${name} ${o.x}x${o.y}`);
    }
    const centreOk = intruders.length === 0;
    check(`${t} B no persistent control sits in the centre column below the top bar`, centreOk,
      centreOk ? `band x ${Math.round(band.x)}..${Math.round(band.x + band.width)}` : intruders.join(', '));
    badArms.push({ arm: 'B', vp: vp.tag, ok: centreOk });

    // H — the exemption B leans on, proved with a real finger rather than claimed.
    // Deliberately NOT run in the --known-bad arm: H is about the HINTS, which that arm
    // does not touch, so a fail there would be noise pretending to be a finding.
    if (!knownBad) {
      const ha = s.hintsAfter;
      const gone = ha && ha.move === 'none' && ha.aim === 'none';
      check(`${t} H one real touch in each zone removes BOTH resting hints for good`, !!gone,
        ha ? `move ${ha.move}, aim ${ha.aim} (plants hit ${ha.moveTarget}/${ha.aimTarget})` : 'no touch arm ran');
      if (!gone) check(`${t} B's hint exemption is VOID because H failed`, false,
        'a hint that outlives its first touch is persistent chrome and must clear the centre column');
    }

    // C — hint clear of the tray
    const oRing = overlap(s.hintRing, s.tray);
    const oLabel = overlap(s.hintLabel, s.tray);
    check(`${t} C the aim hint (ring and label) does not touch the tray`, !oRing && !oLabel,
      `${oRing ? `ring ${oRing.x}x${oRing.y}` : 'ring clear'}, ${oLabel ? `label ${oLabel.x}x${oLabel.y}` : 'label clear'}`);

    // D — touch floor
    const small = s.slots.filter((r) => r.width < TOUCH_MIN || r.height < TOUCH_MIN);
    check(`${t} D every weapon slot is at least ${TOUCH_MIN}x${TOUCH_MIN} px`, small.length === 0,
      `${s.slots.length} slots, smallest ${Math.min(...s.slots.map((r) => Math.min(r.width, r.height)))}px`);

    // E — safe-area insets
    const outside = [];
    for (const [name, r] of [['tray', s.tray], ['radar', s.radar], ['aim hint', s.hintAim], ['move hint', s.hintMove], ['mute', s.mute]]) {
      if (!r) continue;
      if (r.x < NOTCH.l - 0.5 || r.x + r.width > s.vw - NOTCH.r + 0.5
        || r.y < NOTCH.t - 0.5 || r.y + r.height > s.vh - NOTCH.b + 0.5) {
        outside.push(`${name} ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    check(`${t} E every control is inside the safe-area insets`, outside.length === 0, outside.join('; '));

    // F — the tray is on the aim thumb's side
    const onRight = s.tray.x >= s.vw * 0.5;
    check(`${t} F the tray is inside the aim thumb's half (ZONE_SPLIT 0.5)`, onRight,
      `tray left ${Math.round(s.tray.x)}, half ${Math.round(s.vw * 0.5)}`);
    badArms.push({ arm: 'F', vp: vp.tag, ok: onRight });

    // G — desktop unchanged
    const d = await probe(browser, vp, { touch: false, notch: null, knownBad: false });
    const centred = Math.abs((d.tray.x + d.tray.width / 2) - d.vw / 2);
    check(`${t} G with fa-touch-capable OFF the tray is still bottom-centre`, centred <= 0.5 && d.tray.y + d.tray.height < d.vh,
      `centre off by ${centred.toFixed(2)}px, bottom gap ${Math.round(d.vh - (d.tray.y + d.tray.height))}px`);
    console.log('');
  }

  // Same canonical shape as every other gate here — the count starts the line, so
  // gatecount's regex can read it if this is ever promoted out of SKIP.
  console.log(`\n${pass} passed, ${fail} failed`);

  if (knownBad) {
    // 🚨 THE ROW THAT MAKES THE OTHERS MEAN SOMETHING. A, B and F are about WHERE the
    // tray is; forced back to bottom-centre they must all fail. Any that passes is a
    // tautology, and a tautological guard is a comment with a tick next to it.
    const survivors = badArms.filter((r) => r.ok);
    console.log('');
    if (survivors.length) {
      console.log(`🚨 TAUTOLOGICAL: ${survivors.length} of ${badArms.length} location assertions PASSED `
        + `on the known-bad tray — ${survivors.map((r) => `${r.arm}@${r.vp}`).join(', ')}`);
      process.exit(1);
    }
    console.log(`✓ all ${badArms.length} location assertions FAILED on the known-bad tray, as they must`);
    process.exit(0);
  }
  process.exit(fail ? 1 : 0);
}

await run();
