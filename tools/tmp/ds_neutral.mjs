#!/usr/bin/env node
/**
 * PIXEL-NEUTRALITY PROOF for a shared component layer that ships UNUSED.
 *
 * ── What this has to prove, and why the obvious test is not enough ─────────────
 * The design-system layer added to `src/ui/screens/theme.ts` introduces tokens and
 * `.ds-*` component classes that NO screen references yet. Five screens are owned by
 * five other agents, and a foundation that silently restyles all five while their
 * owners are asleep is how this project loses a night. So the claim is:
 *
 *     NOTHING RENDERS DIFFERENTLY, on any screen, at any viewport.
 *
 * The obvious test is a before/after screenshot diff. It is necessary and it is NOT
 * sufficient, for two independent reasons this repo has already paid for:
 *
 *  1. THE SCREENS ARE NOT DETERMINISTIC. `home` and `characters` both host a live
 *     WebGL stage with an idle animation, `.fa-rays` spins on a 90s loop, and
 *     `fa-btn-pulse` breathes at 1.8s. Two captures of the SAME tree differ. A raw
 *     "0 pixels changed" assertion is therefore impossible to satisfy honestly, and
 *     any tolerance picked to make it pass would be a guessed tolerance — exactly what
 *     CLAUDE.md non-negotiable #4 forbids. The answer is a DRIFT CONTROL: capture the
 *     unmodified tree TWICE and let its own before-vs-before diff set the floor.
 *
 *  2. A PIXEL DIFF CANNOT SEE A STYLE THAT DID NOT HAPPEN TO PAINT. An off-screen
 *     scrolled row, a hover state, a modal behind a tap — all carry computed styles
 *     and none is in the frame. §6b: a metric with a carve-out that large is measuring
 *     the minority of the picture.
 *
 * So the PRIMARY instrument is a COMPUTED-STYLE CENSUS: every element in the menu tree,
 * every property a stylesheet edit could move, read out of `getComputedStyle` and
 * compared key-for-key. It is exact, deterministic, animation-immune, and it covers
 * elements the camera cannot see. The pixel diff is the backstop that catches anything
 * the census forgot to ask for.
 *
 * ── The A/B has to land on ONE frozen tree ────────────────────────────────────
 * Peers are live in `src/render/`, `src/characters/` and `src/arena/` right now, so
 * "before" and "after" taken against two separate snapshots are two different trees and
 * the diff is meaningless (LESSONS §5). Run this under `tools/tmp/snap_hold.mjs` with
 * `--swap src/ui/screens/theme.ts`: everything freezes, my one file stays symlinked to
 * the live tree, and the ONLY thing that moves between the two runs is the edit.
 *
 * ── Instrument validation (CLAUDE.md non-negotiable #6) ───────────────────────
 * `--selftest` proves the comparator FAILS on a known-bad input: two censuses that
 * differ in exactly one property of one element must be reported as differing, and a
 * census compared with itself must report zero. A comparator that cannot fail is not a
 * comparator (LESSONS §13's self-pair trap: `holds({a, b: a})` proves determinism and
 * nothing else, so the self-pair here also asserts the KNOWN value, zero).
 *
 * Usage:
 *   node tools/tmp/ds_neutral.mjs --selftest
 *   node tools/tmp/ds_neutral.mjs --url <snapshot> --out shots/ds --label before
 *   node tools/tmp/ds_neutral.mjs --url <snapshot> --out shots/ds --label control
 *   ... edit theme.ts ...
 *   node tools/tmp/ds_neutral.mjs --url <snapshot> --out shots/ds --label after
 *   node tools/tmp/ds_neutral.mjs --compare shots/ds before after --control control
 */

import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { settleScreen, captureSettled } from './settle.mjs';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

/** Landscape desktop, the tight landscape phone, and portrait — the same three
 *  `screen_metrics` uses, so a failure here is comparable with a failure there. */
const VIEWPORTS = [
  { name: 'desktop', w: 1600, h: 900 },
  { name: 'phone-land', w: 844, h: 390 },
  { name: 'phone-portrait', w: 430, h: 932 },
];

/** The five screens whose owners must not be disturbed. */
const SCREENS = ['home', 'characters', 'trophies', 'shop', 'settings'];

/**
 * Every property a STYLESHEET edit could move. Deliberately broad — the cost of an
 * extra key is one string per element, and the cost of a missing key is a silent
 * regression on someone else's screen.
 *
 * `all` is not usable: `getComputedStyle` exposes ~340 longhands and many carry
 * animation-phase values (`transform` mid-`fa-btn-pulse`, `opacity` mid-fade) that
 * differ between two captures of the SAME tree, which would make the census as noisy
 * as the pixels and destroy its whole advantage. Animation-phase properties are
 * therefore excluded ON PURPOSE and the pixel diff covers them.
 */
const PROPS = [
  'border-radius', 'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius',
  'box-shadow', 'text-shadow',
  'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing',
  'line-height', 'text-transform', 'text-align', 'white-space',
  'color', 'background-color', 'background-image',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-style',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'display', 'position', 'flex-direction', 'align-items', 'justify-content',
  'flex-grow', 'flex-shrink', 'flex-basis', 'gap', 'row-gap', 'column-gap',
  'grid-template-columns', 'grid-template-rows',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'overflow-x', 'overflow-y', 'z-index', 'pointer-events', 'visibility',
  '-webkit-text-stroke-width', '-webkit-text-stroke-color', 'paint-order',
  'mix-blend-mode', 'filter', 'backdrop-filter', 'text-overflow', 'appearance',
];

/** A populated profile, so the five screens render their full content rather than a
 *  first-run skeleton. An empty save costs ~1 critic point (LESSONS §3) and, here,
 *  costs COVERAGE: an empty trophy road has no claimable nodes and an empty shop has
 *  no owned rows, so a neutrality proof taken on one proves nothing about them. */
const SEED_PROFILE = {
  name: 'Chef',
  wins: 40,
  losses: 22,
  xp: 4180,
  selected: 'hamburger',
  economy: {
    trophies: 3170,
    bestTrophies: 3170,
    coins: 4210,
    gems: 96,
    containers: { chest: 2, hamburgerBox: 1, pineappleBox: 0, redBox: 0, fireBox: 0 },
    claimed: [
      10, 25, 42, 60, 85, 107, 130, 160, 190, 220, 260, 300, 345, 400, 455, 510, 580,
      650, 725, 815, 905, 1000, 1105, 1220, 1340, 1485, 1630, 1780, 1980, 2190, 2400,
    ],
    unlocked: ['hamburger'],
    winsTowardChest: 1,
    lastMatch: null,
    seed: 12345,
    rolls: 7,
  },
};

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const k = a.slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true;
    else { out[k] = n; i++; }
  }
  return out;
}

// ── Census ────────────────────────────────────────────────────────────────────

/**
 * Read every tracked property off every element under `.fa-root`.
 *
 * The KEY for an element must be stable across two page loads and must not depend on
 * anything the edit could change. A CSS-path built from tag + class list + sibling
 * index is stable (the DOM is rebuilt identically from the same seeded profile) and is
 * also self-describing, which matters because the failure report has to name the
 * element an owner would have to go and look at.
 *
 * The custom properties are censused SEPARATELY and deliberately: the whole point of
 * a token layer is that it ADDS custom properties, so `--ds-*` appearing on `.fa-root`
 * is expected and must not be reported as drift, whereas any PRE-EXISTING custom
 * property changing value is exactly the failure mode to catch (aliasing
 * `--radius-surface` to a token is the one edit in this pass that could do it).
 */
function censusFn(props) {
  const root = document.querySelector('.fa-root');
  if (!root) return null;
  const out = {};
  const seen = new Map();
  const key = (el) => {
    const parts = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const tag = n.tagName.toLowerCase();
      const cls = [...n.classList].sort().join('.');
      const sibs = n.parentElement ? [...n.parentElement.children].indexOf(n) : 0;
      parts.unshift(`${tag}${cls ? `.${cls}` : ''}[${sibs}]`);
      if (n.classList.contains('fa-root')) break;
    }
    let k = parts.join('>');
    const n2 = (seen.get(k) ?? 0) + 1;
    seen.set(k, n2);
    if (n2 > 1) k += `#${n2}`;
    return k;
  };
  const all = [root, ...root.querySelectorAll('*')];
  for (const el of all) {
    const cs = getComputedStyle(el);
    const rec = {};
    for (const p of props) rec[p] = cs.getPropertyValue(p);
    out[key(el)] = rec;
  }
  // Pre-existing custom properties, read off `.fa-root` where they are declared. Read
  // by NAME rather than enumerated, because `getComputedStyle` does not enumerate
  // custom properties in Chromium and a silent empty list would be a check that cannot
  // fail (LESSONS §13).
  const CUSTOM = [
    '--ink', '--ink-2', '--cream', '--panel', '--gold', '--mustard', '--mustard-hi',
    '--gold-shadow', '--ketchup', '--tomato', '--lettuce', '--water', '--ketchup-ink',
    '--water-ink', '--tap', '--gap', '--gutter', '--radius-surface',
    '--fa-safe-t', '--fa-safe-r', '--fa-safe-b', '--fa-safe-l',
  ];
  const rootCS = getComputedStyle(root);
  const custom = {};
  for (const c of CUSTOM) custom[c] = rootCS.getPropertyValue(c).trim();
  return { elements: out, custom, count: all.length };
}

/**
 * Compare two censuses. Returns every difference, with the element key and property.
 *
 * `addedKeys` / `removedKeys` are reported separately from `changed`, because an
 * element appearing or disappearing is a STRUCTURAL change (someone edited markup)
 * and a property moving is a STYLE change, and conflating them would hide which of
 * the two happened.
 */
export function diffCensus(a, b) {
  const diffs = [];
  const ka = new Set(Object.keys(a.elements));
  const kb = new Set(Object.keys(b.elements));
  const added = [...kb].filter((k) => !ka.has(k));
  const removed = [...ka].filter((k) => !kb.has(k));
  for (const k of ka) {
    if (!kb.has(k)) continue;
    const ra = a.elements[k];
    const rb = b.elements[k];
    for (const p of Object.keys(ra)) {
      if (ra[p] !== rb[p]) diffs.push({ el: k, prop: p, a: ra[p], b: rb[p] });
    }
  }
  const customDiffs = [];
  for (const c of Object.keys(a.custom ?? {})) {
    if ((a.custom[c] ?? '') !== (b.custom?.[c] ?? '')) {
      customDiffs.push({ prop: c, a: a.custom[c], b: b.custom?.[c] });
    }
  }
  return { diffs, added, removed, customDiffs, elementsA: a.count, elementsB: b.count };
}

/** The key a control-derived noise entry is stored under. Element AND property, never
 *  element alone: a component whose `box-shadow` animates is not thereby licensed to
 *  change its `border-radius`, and a per-element excuse would grant exactly that. */
export const noiseKey = (screen, vp, el, prop) => `${screen}|${vp}|${el}|${prop}`;

/** Split diffs into the ones the control excuses and the ones it does not. */
export function filterNoisy(diffs, noisy, screen, vp) {
  const real = []; const excused = [];
  for (const d of diffs) (noisy.has(noiseKey(screen, vp, d.el, d.prop)) ? excused : real).push(d);
  return { real, excused };
}

// ── Pixel diff ────────────────────────────────────────────────────────────────

/** Per-pixel comparison of two PNGs. Returns the count over each threshold and the
 *  mean absolute difference. Threshold 0 is "any change at all". */
export async function diffPng(pathA, pathB) {
  const [a, b] = await Promise.all([
    sharp(pathA).raw().toBuffer({ resolveWithObject: true }),
    sharp(pathB).raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
    return { sizeMismatch: true, a: `${a.info.width}x${a.info.height}`, b: `${b.info.width}x${b.info.height}` };
  }
  const ch = a.info.channels;
  const n = a.data.length;
  let over0 = 0; let over2 = 0; let over8 = 0; let over32 = 0; let sum = 0; let max = 0;
  const px = a.info.width * a.info.height;
  for (let i = 0; i < n; i += ch) {
    let d = 0;
    for (let c = 0; c < Math.min(3, ch); c++) d = Math.max(d, Math.abs(a.data[i + c] - b.data[i + c]));
    sum += d;
    if (d > max) max = d;
    if (d > 0) over0++;
    if (d > 2) over2++;
    if (d > 8) over8++;
    if (d > 32) over32++;
  }
  return {
    pixels: px,
    maxDelta: max,
    meanDelta: +(sum / px).toFixed(4),
    pctOver0: +((100 * over0) / px).toFixed(3),
    pctOver2: +((100 * over2) / px).toFixed(3),
    pctOver8: +((100 * over8) / px).toFixed(3),
    pctOver32: +((100 * over32) / px).toFixed(3),
  };
}

// ── Capture ───────────────────────────────────────────────────────────────────

async function captureOne(page, base, screen, vp, outDir, label) {
  const url = `${base}/?screen=${screen}&hold=600000&pointerLock=0`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(
    `window.__screen === ${JSON.stringify(screen)} && window.__screenReady === true`,
    null, { timeout: 90_000 },
  );
  // `__screenReady` is set in the same tick the curtain drops and is NOT a paint.
  await settleScreen(page, { label: `${screen}@${vp.name}` });
  // Past any hint fade / progress tween, so both sides measure the steady state.
  await page.waitForTimeout(3200);

  const shot = `${outDir}/${label}-${screen}-${vp.name}.png`;
  await captureSettled(page, { path: shot, label: `${screen}@${vp.name}`, tool: 'ds_neutral' });
  const census = await page.evaluate(censusFn, PROPS);
  return { screen, vp: vp.name, shot, census };
}

async function runCapture(args) {
  const base = args.url ?? process.env.PREVIEW_BASE;
  if (!base) throw new Error('need --url (or PREVIEW_BASE)');
  const outDir = resolve(args.out ?? 'shots/ds');
  const label = args.label ?? 'run';
  await mkdir(outDir, { recursive: true });
  const vps = args.vp ? VIEWPORTS.filter((v) => String(args.vp).split(',').includes(v.name)) : VIEWPORTS;
  const screens = args.screens ? String(args.screens).split(',') : SCREENS;

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const records = [];
  for (const vp of vps) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
    await page.addInitScript((profile) => {
      try { localStorage.setItem('food-arena.profile.v1', JSON.stringify(profile)); } catch { /* private mode */ }
    }, SEED_PROFILE);
    for (const screen of screens) {
      // eslint-disable-next-line no-await-in-loop
      const r = await captureOne(page, base, screen, vp, outDir, label);
      records.push(r);
      console.log(`  captured ${screen}@${vp.name}  ${r.census ? `${r.census.count} elements` : 'NO ROOT'}`);
    }
    // eslint-disable-next-line no-await-in-loop
    await page.close();
  }
  await browser.close();
  await writeFile(`${outDir}/census-${label}.json`, JSON.stringify({ label, base, records }, null, 2));
  console.log(`\n  wrote ${outDir}/census-${label}.json  (${records.length} captures)\n`);
}

// ── Compare ───────────────────────────────────────────────────────────────────

async function runCompare(args) {
  const [dir, labelA, labelB] = args._;
  const control = args.control ?? null;
  const root = resolve(dir);
  const load = async (l) => JSON.parse(await readFile(`${root}/census-${l}.json`, 'utf8'));
  const A = await load(labelA);
  const B = await load(labelB);
  const C = control ? await load(control) : null;

  console.log(`\nPIXEL-NEUTRALITY — ${labelA} vs ${labelB}${control ? `  (drift control: ${labelA} vs ${control})` : ''}\n`);

  /**
   * THE CONTROL DEFINES THE NOISE SET — it is not a tolerance anyone guessed.
   *
   * Two captures of the SAME unedited tree are not bit-identical, and the census says
   * exactly where: `home.ts` animates a glow on the road button, so its `box-shadow`
   * reads a different phase in every capture. Measured on this build, that is the ONLY
   * moving pair — 13 of 15 screen/viewport combinations came back byte-identical
   * across two independent runs and the other 2 moved one property of one element.
   *
   * So a (element, property) pair that MOVED IN THE CONTROL is known-noisy and a diff
   * there proves nothing; a pair that did NOT move in the control is stationary on this
   * build, and a diff there is a real regression. That bound is derived from the tree
   * itself rather than picked to make the answer come out right — CLAUDE.md
   * non-negotiable #4: a drift control rather than a guessed tolerance.
   */
  const noisy = new Set();
  if (C) {
    for (const ra of A.records) {
      const rc = C.records.find((r) => r.screen === ra.screen && r.vp === ra.vp);
      if (!rc) continue;
      for (const d of diffCensus(ra.census, rc.census).diffs) noisy.add(noiseKey(ra.screen, ra.vp, d.el, d.prop));
    }
    console.log(`  control-derived noise set: ${noisy.size} (element, property) pairs move between two captures of the UNEDITED tree`);
    for (const k of noisy) console.log(`    ${k.split('|').slice(0, 2).join('@')}  ${k.split('|')[3]}  on .${k.split('|')[2].split('>').pop()}`);
    console.log('');
  }

  let styleFailures = 0;
  const pixelRows = [];
  for (const ra of A.records) {
    const rb = B.records.find((r) => r.screen === ra.screen && r.vp === ra.vp);
    if (!rb) { console.log(`  !! missing in ${labelB}: ${ra.screen}@${ra.vp}`); styleFailures++; continue; }
    const d = diffCensus(ra.census, rb.census);
    const { real, excused: exc } = filterNoisy(d.diffs, noisy, ra.screen, ra.vp);
    const excused = exc.length;
    const bad = real.length + d.added.length + d.removed.length + d.customDiffs.length;
    if (bad) styleFailures++;
    console.log(`  ${ra.screen}@${ra.vp}`);
    console.log(`    computed-style census   ${ra.census.count} elements   ${real.length} property diffs`
      + `${excused ? ` (+${excused} inside the control's own noise set)` : ''}`
      + `, ${d.added.length} added, ${d.removed.length} removed, ${d.customDiffs.length} token diffs  ${bad ? '<<< NOT NEUTRAL' : 'IDENTICAL'}`);
    for (const x of real.slice(0, 12)) console.log(`      ${x.prop}: "${x.a}" -> "${x.b}"   on ${x.el}`);
    if (real.length > 12) console.log(`      ... and ${real.length - 12} more`);
    for (const x of d.customDiffs) console.log(`      TOKEN ${x.prop}: "${x.a}" -> "${x.b}"`);
    for (const x of d.added.slice(0, 6)) console.log(`      ADDED   ${x}`);
    for (const x of d.removed.slice(0, 6)) console.log(`      REMOVED ${x}`);

    // eslint-disable-next-line no-await-in-loop
    const px = await diffPng(ra.shot, rb.shot);
    let ctl = null;
    if (C) {
      const rc = C.records.find((r) => r.screen === ra.screen && r.vp === ra.vp);
      // eslint-disable-next-line no-await-in-loop
      if (rc) ctl = await diffPng(ra.shot, rc.shot);
    }
    /**
     * THE TRIANGLE, because a one-sided test against a single control is unsound.
     *
     * The first version of this verdict flagged a capture whenever
     * `after` differed from `before` by more than `control` did — and it fired on 5 of
     * 15 with differences like max 230 vs 229 and 0.911% vs 0.807%. With n=1 on each
     * arm that comparison is a coin flip under PERFECT neutrality, which makes it a
     * check that fails half the time for no reason: the mirror image of a check that
     * cannot fail, and just as useless.
     *
     * The sound question with two unedited captures is whether the edited one lands
     * OUTSIDE the cloud they span: is `after` further from BOTH `before` and `control`
     * than those two are from each other? If it sits nearer to either of them than
     * they sit to one another, it is inside the sampling noise.
     *
     * ⚠️ Its limit, stated rather than buried: a 2-point cloud is the smallest cloud
     * there is, and this test has no power to detect a change smaller than the animation
     * phase. That is precisely why the CENSUS is the primary instrument here and the
     * pixels are the backstop — LESSONS 6b read backwards, a real change can be
     * invisible to a statistic, so the statistic is not allowed to be the whole answer.
     */
    let ctl2 = null;
    if (C) {
      const rc = C.records.find((r) => r.screen === ra.screen && r.vp === ra.vp);
      // eslint-disable-next-line no-await-in-loop
      if (rc) ctl2 = await diffPng(rc.shot, rb.shot);
    }
    pixelRows.push({ screen: ra.screen, vp: ra.vp, px, ctl, ctl2 });
    const f = (o) => (o ? `max ${String(o.maxDelta).padStart(3)}  mean ${String(o.meanDelta).padStart(7)}  >8: ${String(o.pctOver8).padStart(6)}%  >32: ${String(o.pctOver32).padStart(6)}%` : '-');
    console.log(`    pixels  ${labelA}->${control ?? '?'}  NO EDIT CROSSED   ${f(ctl)}`);
    console.log(`    pixels  ${labelA}->${labelB}   ${f(px)}`);
    console.log(`    pixels  ${control ?? '?'}->${labelB}   ${f(ctl2)}`);
    console.log('');
  }

  console.log('── VERDICT ──');
  console.log(`  computed-style census: ${styleFailures === 0 ? 'IDENTICAL on every screen and viewport — NEUTRAL' : `${styleFailures} screen/viewport combinations MOVED`}`);
  if (C) {
    // OUTSIDE THE CLOUD on a statistic = further from BOTH unedited captures than they
    // are from each other. `meanDelta` is the statistic, because `maxDelta` is a single
    // pixel and saturates at 253 on any frame containing the WebGL stage.
    const outside = pixelRows.filter((r) => r.ctl && r.ctl2 && !r.ctl.sizeMismatch
      && Math.min(r.px.meanDelta, r.ctl2.meanDelta) > r.ctl.meanDelta);
    console.log(`  pixel diff, triangle test: ${outside.length === 0
      ? `all ${pixelRows.length} captures sit INSIDE the cloud the two unedited captures span`
      : `${outside.length} captures land outside it — ${outside.map((r) => `${r.screen}@${r.vp}`).join(', ')}`}`);
    console.log('    (the two unedited captures are the floor. A frame nearer to either of them');
    console.log('     than they are to each other is indistinguishable from re-shooting the SAME');
    console.log('     tree — the strongest claim a pixel diff can make about a page carrying a live');
    console.log('     WebGL stage, a 90s spinning ray field and a 1.8s pulsing CTA.)');
    console.log('    ⚠️ n=1 per arm. This test has no power below the animation phase, which is');
    console.log('       why the CENSUS above is the primary instrument and this is the backstop.');
  } else {
    console.log('  ⚠️ NO DRIFT CONTROL SUPPLIED — the pixel numbers above have no floor and');
    console.log('     must not be quoted. Re-run with --control <label>.');
  }
  console.log('');
  await writeFile(`${root}/neutrality-${labelA}-${labelB}.json`, JSON.stringify({ labelA, labelB, control, styleFailures, pixelRows }, null, 2));
  process.exit(styleFailures === 0 ? 0 : 1);
}

// ── Selftest ──────────────────────────────────────────────────────────────────

async function selftest() {
  let pass = 0; let fail = 0;
  const t = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) pass++; else fail++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`}`);
  };

  const base = {
    count: 2,
    custom: { '--ink': '#1a1224', '--radius-surface': '16px' },
    elements: {
      'div.fa-root[0]': { 'border-radius': '0px', 'box-shadow': 'none', color: 'rgb(26, 18, 36)' },
      'div.fa-root[0]>button.fa-btn[1]': { 'border-radius': '999px', 'box-shadow': 'rgba(0,0,0,0.35) 0px 4px 0px', color: 'rgb(26, 18, 36)' },
    },
  };
  const clone = () => JSON.parse(JSON.stringify(base));

  // SELF-PAIR, with the identity asserted — not merely "the two runs agree". A
  // comparator that returned a constant would pass "a === a"; it cannot pass "a === a
  // AND the answer is exactly zero diffs".
  t('self-pair is exactly zero', (() => { const d = diffCensus(base, clone()); return [d.diffs.length, d.added.length, d.removed.length, d.customDiffs.length]; })(), [0, 0, 0, 0]);

  // KNOWN-BAD 1: one property of one element moves by 1px. Must be caught, and must
  // name the element and the property.
  {
    const b = clone();
    b.elements['div.fa-root[0]>button.fa-btn[1]']['border-radius'] = '998px';
    const d = diffCensus(base, b);
    t('1px radius change on one element is caught, with its name',
      [d.diffs.length, d.diffs[0].prop, d.diffs[0].el.endsWith('button.fa-btn[1]')],
      [1, 'border-radius', true]);
  }

  // KNOWN-BAD 2: a shadow alpha moves from .35 to .34 — the exact drift this whole
  // pass is about. A comparator that normalised whitespace or rounded would miss it.
  {
    const b = clone();
    b.elements['div.fa-root[0]>button.fa-btn[1]']['box-shadow'] = 'rgba(0,0,0,0.34) 0px 4px 0px';
    t('a 0.01 shadow-alpha change is caught', diffCensus(base, b).diffs.length, 1);
  }

  // KNOWN-BAD 3: a PRE-EXISTING token changes value. This is the specific hazard of
  // aliasing `--radius-surface` to a new token, so it gets its own assertion.
  {
    const b = clone();
    b.custom['--radius-surface'] = '12px';
    const d = diffCensus(base, b);
    t('a pre-existing token changing value is caught', [d.diffs.length, d.customDiffs.length, d.customDiffs[0].prop], [0, 1, '--radius-surface']);
  }

  // KNOWN-BAD 4: structure changes (an element appears). Reported as ADDED, not as a
  // property diff — conflating the two would hide which of the two happened.
  {
    const b = clone();
    b.elements['div.fa-root[0]>div.ds-badge[2]'] = { 'border-radius': '999px', 'box-shadow': 'none', color: 'rgb(0, 0, 0)' };
    const d = diffCensus(base, b);
    t('an added element is ADDED, not a property diff', [d.diffs.length, d.added.length], [0, 1]);
  }

  // KNOWN-BAD 5: THE NOISE SET MUST NOT OVER-EXCUSE. This is the dangerous new
  // mechanism in this tool — an excuse list is exactly the shape of guard that passes
  // loudly and forever if it is too wide. The control excuses one PROPERTY of one
  // element; the same element's OTHER properties, and the same property on a DIFFERENT
  // element or viewport, must all still fail.
  {
    const noisy = new Set([noiseKey('home', 'desktop', 'button.home-track', 'box-shadow')]);
    const diffs = [
      { el: 'button.home-track', prop: 'box-shadow', a: '1', b: '2' },      // excused
      { el: 'button.home-track', prop: 'border-radius', a: '1', b: '2' },   // NOT excused
      { el: 'button.other', prop: 'box-shadow', a: '1', b: '2' },           // NOT excused
    ];
    const same = filterNoisy(diffs, noisy, 'home', 'desktop');
    const otherVp = filterNoisy(diffs, noisy, 'home', 'phone-land');
    t('noise set excuses exactly one (element, property) pair',
      [same.real.length, same.excused.length, same.real.map((r) => r.prop)],
      [2, 1, ['border-radius', 'box-shadow']]);
    t('noise set does NOT carry across viewports', [otherVp.real.length, otherVp.excused.length], [3, 0]);
  }

  // KNOWN-BAD 6: the PIXEL comparator must fail on a known-different image and report
  // zero on an identical one. Built as real PNGs so the sharp path is exercised.
  {
    const dir = resolve('tools/tmp');
    const mk = async (p, rgb) => sharp({ create: { width: 8, height: 8, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } }).png().toFile(p);
    const p1 = `${dir}/__ds_n1.png`; const p2 = `${dir}/__ds_n2.png`; const p3 = `${dir}/__ds_n3.png`;
    await mk(p1, [100, 100, 100]);
    await mk(p2, [100, 100, 100]);
    await mk(p3, [100, 100, 105]);
    const same = await diffPng(p1, p2);
    const diff = await diffPng(p1, p3);
    t('pixel diff: identical images report exactly 0', [same.maxDelta, same.pctOver0], [0, 0]);
    t('pixel diff: a 5-level change is caught', [diff.maxDelta, diff.pctOver2, diff.pctOver8], [5, 100, 0]);
    const { unlink } = await import('node:fs/promises');
    await Promise.all([unlink(p1), unlink(p2), unlink(p3)]);
  }

  // KNOWN-BAD 7: a size mismatch must be REFUSED, not silently compared. A comparator
  // that compared the overlapping region would report "neutral" for a layout that
  // changed the whole page size.
  {
    const dir = resolve('tools/tmp');
    const p1 = `${dir}/__ds_n4.png`; const p2 = `${dir}/__ds_n5.png`;
    await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toFile(p1);
    await sharp({ create: { width: 8, height: 9, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toFile(p2);
    t('pixel diff refuses a size mismatch', (await diffPng(p1, p2)).sizeMismatch, true);
    const { unlink } = await import('node:fs/promises');
    await Promise.all([unlink(p1), unlink(p2)]);
  }

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const args = parseArgs(process.argv);
if (args.selftest) await selftest();
else if (args.compare) await runCompare({ ...args, _: [args.compare === true ? args._[0] : args.compare, ...args._] });
else await runCapture(args);
