#!/usr/bin/env node
/**
 * THE FOUR NAMED TARGETS OF THE DESIGN-SYSTEM ADOPTION WAVE, AS NUMBERS.
 *
 * The brief for this pass names four measured defects. Three of them are geometry and
 * one is a distribution, and none of them is something a screenshot answers — which is
 * why they get an instrument before anything is edited (CLAUDE.md #5: probe before you
 * loop; #10: state the floor before acting on a change).
 *
 *   T1  STAT ROW      ours 52 device px tall against a reference 86, and our icon is a
 *                     33x33 px 1.7px-stroke `fill:none` LINE GLYPH against a ~72x70
 *                     filled tinted TILE. Reported as the row box and the icon box.
 *   T2  ROSTER CARD   ours 280x242 dp against 510x440 — 0.30x the area.
 *   T3  TYPE SCALE    91 of 102 authored font-sizes land in ONE cluster. The RENDERED
 *                     version of that: what share of the visible type on a screen sits
 *                     inside a single 1.33x-wide window of size.
 *   T4  HIERARCHY     home's secondary control is 0.91x the PRIMARY's area where the
 *                     reference's is 0.25x — a 3.6x inversion.
 *
 * ── WHY A 1.33x WINDOW, and why it is not a threshold anyone picked ────────────
 * 1.33 is not a taste value: it is the width of the cluster the audit actually found
 * ("8 of 10 measured font sizes inside 9.6-12.8px, a 1.33x range with eight steps in
 * it"). 12.8 / 9.6 = 1.333. So the metric asks the audit's own question back: how much
 * of the screen's type still fits in a window that size. The window is slid over the
 * observed sizes and the WORST (densest) position is reported, so the number cannot be
 * gamed by moving one run across an arbitrary boundary.
 *
 * ⚠️ WHAT THIS DOES NOT MEASURE. It counts SPREAD, not hierarchy. Type scattered at
 * random across seven sizes scores perfectly and is not a design system; the ladder has
 * to be assigned by MEANING, which no counter can see (LESSONS §6b — the same carve-out
 * `ds_inventory` states about tidiness). Read the PNG.
 *
 * ── Instrument validation (CLAUDE.md non-negotiable #6) ───────────────────────
 * `--selftest` runs the two pure functions against inputs whose answers are known by
 * construction, INCLUDING the ones a naive implementation gets wrong:
 *   * every run the same size            -> share 1.000 (the defect, at its limit)
 *   * runs spread one per ladder step    -> share = the largest step's own weight
 *   * a window boundary case             -> 9.6 and 12.8 are INSIDE the same window
 *     (a `<` instead of `<=` reports 0.5 here, which is the bug this catches)
 *   * area ratio on a known pair of boxes
 * A guard not shown to FAIL on the bug it guards against is not a guard.
 *
 * ⚠️ THIS IS A REPORT, NOT A GATE, and it exits 0 on any value. The gates for this pass
 * are `menu_accept`, `menu_accept_portrait`, `ud_defects`, `screen_metrics`,
 * `home_metrics`, `chars_metrics` and `rarity_aa`.
 *
 * Usage:
 *   node tools/tmp/da_geom.mjs --selftest
 *   node tools/tmp/da_geom.mjs --url <snapshot> --json shots/da/geom-before.json
 *   node tools/tmp/da_geom.mjs --compare shots/da/geom-before.json shots/da/geom-after.json
 */

import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { settleScreen } from './settle.mjs';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

/** The viewports the two screens actually ship at. 852x480 is included because it is
 *  where `ud_defects` measured the left flank's slack at 24.95px — the one place a
 *  taller stat row can clip — and a geometry report taken only where there is headroom
 *  cannot see the failure this pass risks. */
const VIEWPORTS = [
  { name: 'desktop', w: 1600, h: 900 },
  { name: 'tablet', w: 1024, h: 768 },
  { name: 'phone-852x480', w: 852, h: 480 },
  { name: 'phone-844x390', w: 844, h: 390 },
];

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

// ── Pure functions, so they can be selftested without a browser ────────────────

/**
 * T3. The share of rendered type that fits inside ONE 1.33x-wide window of font size.
 *
 * `runs` is `[{ size, chars }]`. Weighted by CHARACTERS and not by run count, because a
 * screen with thirty 11px labels and one 32px title has a type scale on paper and none
 * on screen — the eye weighs area, and characters are the cheapest honest proxy for it
 * that does not need a rasteriser.
 *
 * The window is slid to its densest position rather than anchored, so the answer does
 * not depend on where anyone chose to put a boundary.
 */
export function clusterShare(runs, ratio = 12.8 / 9.6) {
  const rs = runs.filter((r) => r.size > 0 && r.chars > 0);
  const total = rs.reduce((s, r) => s + r.chars, 0);
  if (!total) return { share: null, total: 0, window: null };
  let best = 0; let bestLo = null;
  for (const anchor of rs) {
    const lo = anchor.size;
    // `<=` on BOTH ends: 9.6 and 12.8 are the two ends of the audit's own cluster and
    // both are inside it. A `<` here reports 0.5 on the selftest's boundary case.
    const hi = lo * ratio;
    let w = 0;
    for (const r of rs) if (r.size >= lo - 1e-9 && r.size <= hi + 1e-9) w += r.chars;
    if (w > best) { best = w; bestLo = lo; }
  }
  return {
    share: +(best / total).toFixed(4),
    total,
    window: bestLo === null ? null : [+bestLo.toFixed(2), +(bestLo * ratio).toFixed(2)],
  };
}

/** T4. Area ratio of two boxes, secondary over primary. */
export function areaRatio(secondary, primary) {
  if (!secondary || !primary || primary.w <= 0 || primary.h <= 0) return null;
  return +((secondary.w * secondary.h) / (primary.w * primary.h)).toFixed(3);
}

// ── In-page probe ─────────────────────────────────────────────────────────────

function probeFn() {
  const root = document.querySelector('.fa-root');
  if (!root) return null;
  const dpr = window.devicePixelRatio || 1;
  const box = (n) => {
    if (!n) return null;
    const r = n.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    return { w: +r.width.toFixed(1), h: +r.height.toFixed(1), dw: +(r.width * dpr).toFixed(1), dh: +(r.height * dpr).toFixed(1) };
  };
  const vis = (n) => {
    const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    const r = n.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // T1 — the stat row and the glyph inside its icon slot. `.fa-stat` is the wrapper on
  // BOTH screens before and after this pass, which is what makes the two comparable;
  // the icon is looked up as "whatever carries the glyph", so the same query answers for
  // the old bare `<svg>` in a label and the new `.ds-tile--stat`.
  const statRows = [...root.querySelectorAll('.fa-stat')].filter(vis).map((n) => {
    const tile = n.querySelector('.ds-tile');
    const glyph = n.querySelector('svg, .fa-ic');
    return {
      row: box(n),
      tile: box(tile),
      glyph: box(glyph),
      label: box(n.querySelector('.ds-row-label, .fa-stat-label')),
      val: box(n.querySelector('.ds-row-val, .fa-stat-val')),
      // Layout, not size: does the label sit ABOVE the value or BESIDE it? The named
      // fix is a stacking change, and a height that grew without the stack is the wrong
      // fix passing the wrong test.
      stacked: (() => {
        const l = n.querySelector('.ds-row-label, .fa-stat-label');
        const v = n.querySelector('.ds-row-val, .fa-stat-val');
        if (!l || !v) return null;
        const lr = l.getBoundingClientRect(); const vr = v.getBoundingClientRect();
        return lr.bottom <= vr.top + 1;
      })(),
      hasBar: !!n.querySelector('.fa-stat-track, .ds-bar'),
    };
  });

  // T2 — roster cards.
  const cards = [...root.querySelectorAll('.chars-card[data-char]')].filter(vis).map(box);

  // T4 — the loud control and every other control on the screen, so the ratio is a
  // relationship and not two crops (theme.ts: "no crop of either button could have
  // found it").
  const primary = root.querySelector('.fa-btn--primary, .ds-btn--primary');
  const controls = [...root.querySelectorAll('button')].filter(vis).map((n) => ({
    cls: (typeof n.className === 'string' ? n.className : '').trim(),
    text: (n.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 20),
    ...box(n),
  })).filter((c) => c.w);

  // T3 — every visible text run and its rendered size. Text nodes only: an element's
  // `textContent` would count a parent's whole subtree at the PARENT's size, which is
  // how a nested label silently votes twice.
  const runs = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const s = (t.textContent ?? '').trim();
    if (!s) continue;
    const p = t.parentElement;
    if (!p || !vis(p)) continue;
    const cs = getComputedStyle(p);
    runs.push({
      size: +parseFloat(cs.fontSize).toFixed(2),
      weight: cs.fontWeight,
      chars: s.length,
      cls: (typeof p.className === 'string' ? p.className : '').split(' ')[0] || p.tagName.toLowerCase(),
      text: s.slice(0, 18),
    });
  }

  return {
    vw: window.innerWidth, vh: window.innerHeight, dpr,
    statRows, cards, runs,
    primary: primary ? { cls: primary.className, ...box(primary) } : null,
    controls,
  };
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function capture(base, out) {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const records = [];
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
    await page.addInitScript((profile) => {
      try { localStorage.setItem('food-arena.profile.v1', JSON.stringify(profile)); } catch { /* private mode */ }
    }, SEED_PROFILE);
    for (const screen of ['home', 'characters']) {
      // eslint-disable-next-line no-await-in-loop
      await page.goto(`${base}/?screen=${screen}&hold=600000&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      // eslint-disable-next-line no-await-in-loop
      await page.waitForFunction(`window.__screen === ${JSON.stringify(screen)} && window.__screenReady === true`, null, { timeout: 90_000 });
      // eslint-disable-next-line no-await-in-loop
      await settleScreen(page, { label: `${screen}@${vp.name}` });
      // eslint-disable-next-line no-await-in-loop
      await page.waitForTimeout(1200);
      // eslint-disable-next-line no-await-in-loop
      const r = await page.evaluate(probeFn);
      records.push({ screen, vp: vp.name, ...r });
      console.log(`  probed ${screen}@${vp.name}  ${r ? `${r.statRows.length} stat rows, ${r.cards.length} cards, ${r.runs.length} text runs` : 'NO ROOT'}`);
    }
    // eslint-disable-next-line no-await-in-loop
    await page.close();
  }
  await browser.close();
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify({ base, records }, null, 2));
  console.log(`\n  wrote ${out}\n`);
  report({ records });
}

function rowsOf(rec) {
  const r = rec.statRows[0];
  return r ?? null;
}

function report(data, prev = null) {
  const find = (rec) => (prev ? prev.records.find((p) => p.screen === rec.screen && p.vp === rec.vp) : null);
  const fmt = (n, d = 1) => (n === null || n === undefined ? '  -  ' : n.toFixed(d));
  const arrow = (a, b, d = 1) => (a === null || a === undefined || b === null || b === undefined ? '' : `  ${a.toFixed(d)} -> ${b.toFixed(d)}`);

  console.log('\n── T1  STAT ROW  (device px; the audit measured ours 52 tall, the reference 86) ──');
  console.log('  screen      viewport         row h   tile         glyph        label-above-value   bar?');
  for (const rec of data.records) {
    const s = rowsOf(rec); if (!s) continue;
    const p = find(rec) ? rowsOf(find(rec)) : null;
    const tile = s.tile ?? s.glyph;
    const ptile = p ? (p.tile ?? p.glyph) : null;
    console.log(`  ${rec.screen.padEnd(11)} ${rec.vp.padEnd(15)} ${fmt(s.row?.dh)}${p ? arrow(p.row?.dh, s.row?.dh) : ''}`
      + `   ${tile ? `${fmt(tile.dw)}x${fmt(tile.dh)}` : '-'}${ptile ? ` (was ${fmt(ptile.dw)}x${fmt(ptile.dh)})` : ''}`
      + `   ${s.glyph ? `${fmt(s.glyph.dw)}x${fmt(s.glyph.dh)}` : '-'}`
      + `   ${s.stacked === null ? '-' : (s.stacked ? 'STACKED' : 'beside')}`
      + `   ${s.hasBar ? 'bar' : 'no bar'}`);
  }

  console.log('\n── T2  ROSTER CARD  (device px; the audit measured ours 280x242, the reference 510x440) ──');
  for (const rec of data.records) {
    if (!rec.cards.length) continue;
    const a = rec.cards.reduce((s, c) => s + c.dw * c.dh, 0) / rec.cards.length;
    const p = find(rec);
    const pa = p && p.cards.length ? p.cards.reduce((s, c) => s + c.dw * c.dh, 0) / p.cards.length : null;
    console.log(`  ${rec.screen.padEnd(11)} ${rec.vp.padEnd(15)} n=${String(rec.cards.length).padStart(2)}  `
      + `${fmt(rec.cards[0].dw)}x${fmt(rec.cards[0].dh)}  mean area ${Math.round(a)} dp²`
      + `${pa ? `  (was ${Math.round(pa)}, x${(a / pa).toFixed(2)})` : ''}`
      + `   vs reference 510x440 = 224400 dp²  -> ${(a / 224400).toFixed(2)}x`);
  }

  console.log('\n── T3  TYPE SPREAD  (share of rendered characters inside ONE 1.33x window of size) ──');
  for (const rec of data.records) {
    const c = clusterShare(rec.runs);
    const p = find(rec) ? clusterShare(find(rec).runs) : null;
    const sizes = [...new Set(rec.runs.map((r) => r.size))].sort((a, b) => a - b);
    console.log(`  ${rec.screen.padEnd(11)} ${rec.vp.padEnd(15)} share ${c.share === null ? '-' : c.share.toFixed(3)}`
      + `${p && p.share !== null ? ` (was ${p.share.toFixed(3)})` : ''}`
      + `   window ${c.window ? `${c.window[0]}-${c.window[1]}px` : '-'}`
      + `   ${sizes.length} distinct sizes ${sizes.length ? `${sizes[0]}-${sizes[sizes.length - 1]}px` : ''}`);
  }

  console.log('\n── T4  HIERARCHY  (secondary control area / primary control area; reference 0.25x) ──');
  for (const rec of data.records) {
    if (!rec.primary) continue;
    const others = rec.controls
      .filter((c) => !/fa-btn--primary|ds-btn--primary/.test(c.cls))
      .sort((a, b) => b.w * b.h - a.w * a.h);
    const biggest = others[0];
    const p = find(rec);
    const pr = p && p.primary ? (() => {
      const o = p.controls.filter((c) => !/fa-btn--primary|ds-btn--primary/.test(c.cls)).sort((a, b) => b.w * b.h - a.w * a.h)[0];
      return o ? areaRatio(o, p.primary) : null;
    })() : null;
    const ratio = biggest ? areaRatio(biggest, rec.primary) : null;
    console.log(`  ${rec.screen.padEnd(11)} ${rec.vp.padEnd(15)} primary ${fmt(rec.primary.w, 0)}x${fmt(rec.primary.h, 0)}`
      + `   loudest other ${biggest ? `${fmt(biggest.w, 0)}x${fmt(biggest.h, 0)} "${biggest.text}"` : '-'}`
      + `   ratio ${ratio === null ? '-' : ratio.toFixed(3)}${pr !== null ? ` (was ${pr.toFixed(3)})` : ''}`);
  }
  console.log('');
}

// ── Census-derived mode ───────────────────────────────────────────────────────

/**
 * THE SAME FOUR TARGETS, READ OUT OF `da_census`'s COMPUTED-STYLE CAPTURES.
 *
 * ── Why this exists, and it is not a shortcut ─────────────────────────────────
 * `da_census` already reads `width`, `height`, `min-height` and `font-size` off EVERY
 * element of both trees, on ONE held snapshot, with the two files under test symlinked
 * live. That is a strictly better A/B than re-probing: the before and the after were
 * captured against the same frozen peers' work, and re-running the browser now would
 * measure a tree four hours of peer commits later. `docs/LESSONS.md` §5 is exactly this
 * — single-owner file sets stop write conflicts and do nothing about measurement.
 *
 * ⚠️ WHAT IT CANNOT DO, stated rather than buried: the census stores no TEXT, so the
 * type-spread number here is weighted by ELEMENT and not by character. That is a
 * different quantity from the live probe's and the two must never be quoted as one
 * (CLAUDE.md #10 on aggregate-vs-paired). It is reported as `elements`, not `chars`.
 */
function fromCensus(A, B) {
  const pick = (rec, re) => Object.entries(rec.census.elements).filter(([k]) => re.test(k));
  const num = (v) => { const f = parseFloat(v); return Number.isFinite(f) ? f : null; };

  console.log('\n── T1  STAT ROW  (CSS px, from the computed-style census) ──');
  console.log('  screen      viewport         row h            icon tile w x h         label-above-value');
  for (const rb of B.records) {
    const ra = A.records.find((r) => r.screen === rb.screen && r.vp === rb.vp);
    if (!ra) continue;
    const rowB = pick(rb, /fa-stat/)[0];
    const rowA = ra ? pick(ra, /fa-stat/)[0] : null;
    if (!rowB) continue;
    const tileB = pick(rb, /ds-tile/)[0];
    // BEFORE, the icon was a bare <svg> inside `.fa-stat-label` and has no class of its
    // own in the key, so it is found by its parent instead. Reported as `-` when the
    // capture has no such element, never as 0 — a zero would read as "we measured it".
    const glyphA = rowA ? `${rowA[1]['font-size']} glyph in a label` : '-';
    console.log(`  ${rb.screen.padEnd(11)} ${rb.vp.padEnd(15)} `
      + `${rowA ? `${num(rowA[1].height)} -> ` : ''}${num(rowB[1].height)}`
      + `        ${tileB ? `${num(tileB[1].width)} x ${num(tileB[1].height)}` : '-'} (was ${glyphA})`);
  }

  console.log('\n── T3  TYPE SPREAD  (distinct RENDERED font sizes, and the share of ELEMENTS in one 1.33x window) ──');
  for (const rb of B.records) {
    const ra = A.records.find((r) => r.screen === rb.screen && r.vp === rb.vp);
    if (!ra) continue;
    const sizes = (rec) => Object.values(rec.census.elements)
      .map((e) => num(e['font-size'])).filter((v) => v && v > 0)
      .map((v) => ({ size: v, chars: 1 }));
    const sa = sizes(ra); const sb = sizes(rb);
    const ca = clusterShare(sa); const cb = clusterShare(sb);
    const da = [...new Set(sa.map((r) => r.size))].sort((x, y) => x - y);
    const db = [...new Set(sb.map((r) => r.size))].sort((x, y) => x - y);
    console.log(`  ${rb.screen.padEnd(11)} ${rb.vp.padEnd(15)} share ${ca.share?.toFixed(3)} -> ${cb.share?.toFixed(3)}`
      + `   distinct ${da.length} -> ${db.length}`
      + `   range ${da[0]}-${da[da.length - 1]}px -> ${db[0]}-${db[db.length - 1]}px`);
  }

  console.log('\n── T4  HIERARCHY  (secondary control area / primary control area; reference 0.25x) ──');
  for (const rb of B.records) {
    const ra = A.records.find((r) => r.screen === rb.screen && r.vp === rb.vp);
    if (!ra) continue;
    const box = (rec, re) => {
      const hits = pick(rec, re);
      if (!hits.length) return null;
      const e = hits[0][1];
      const w = num(e.width); const h = num(e.height);
      return w && h ? { w, h } : null;
    };
    const pa = box(ra, /fa-btn--primary/); const pb = box(rb, /fa-btn--primary/);
    // The secondary is named per screen rather than "the biggest other button", because
    // on `characters` the biggest other button is the ROSTER CARD, which is not a
    // control competing with the CTA — an automatic pick would have measured that and
    // reported a meaningless ratio.
    const sel = rb.screen === 'home' ? /home-change/ : /chars-lv-btn/;
    const sa = box(ra, sel); const sb = box(rb, sel);
    if (!pa || !pb) continue;
    console.log(`  ${rb.screen.padEnd(11)} ${rb.vp.padEnd(15)} `
      + `primary ${pa.w}x${pa.h} -> ${pb.w}x${pb.h}   `
      + `secondary ${sa ? `${sa.w}x${sa.h}` : '-'} -> ${sb ? `${sb.w}x${sb.h}` : '-'}   `
      + `ratio ${sa ? areaRatio(sa, pa)?.toFixed(3) : '-'} -> ${sb ? areaRatio(sb, pb)?.toFixed(3) : '-'}`);
  }
  console.log('');
}

// ── Selftest ──────────────────────────────────────────────────────────────────

function selftest() {
  let pass = 0; let fail = 0;
  const t = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) pass++; else fail++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`}`);
  };

  // KNOWN-BAD 1: THE DEFECT AT ITS LIMIT. Every run the same size must score 1.000. A
  // metric that cannot report the defect it exists to measure is not a metric.
  t('all runs one size -> share 1.000',
    clusterShare([{ size: 11, chars: 10 }, { size: 11, chars: 30 }]).share, 1);

  // KNOWN-BAD 2: THE BOUNDARY. 9.6 and 12.8 are the two ends of the audit's own cluster
  // and are INSIDE the same window; a `<` instead of `<=` reports 0.5 here.
  t('9.6 and 12.8 are one window',
    clusterShare([{ size: 9.6, chars: 5 }, { size: 12.8, chars: 5 }]).share, 1);

  // KNOWN-BAD 3: just outside must NOT be counted. Without this the check above would
  // pass for an implementation that put everything in one window unconditionally.
  t('12.81 against 9.6 is OUTSIDE the window',
    clusterShare([{ size: 9.6, chars: 5 }, { size: 12.81, chars: 5 }]).share, 0.5);

  // KNOWN-BAD 4: WEIGHTED BY CHARACTERS, not by run count. Thirty 11px labels and one
  // 32px title is the defect; counting runs would score it 0.5 and call it healthy.
  t('weighting is by characters, not by run count',
    clusterShare([{ size: 11, chars: 300 }, { size: 32, chars: 5 }]).share, 0.9836);

  // KNOWN-BAD 5: the window slides. Anchored at the smallest size, this input scores
  // 1/3; the densest window is the upper pair.
  t('the window slides to its densest position',
    clusterShare([{ size: 8, chars: 1 }, { size: 20, chars: 1 }, { size: 24, chars: 1 }]).share, 0.6667);

  // KNOWN-BAD 6: empty / zero-size input must be null, not NaN and not 0. A metric that
  // silently returns 0 for "no data" reads as a perfect score.
  t('no runs -> null, not 0', clusterShare([]).share, null);
  t('zero-size runs are dropped', clusterShare([{ size: 0, chars: 9 }]).share, null);

  // KNOWN-BAD 7: the area ratio, on boxes whose answer is known by construction, and on
  // a degenerate primary that must refuse rather than divide by zero.
  t('area ratio 100x44 over 300x78', areaRatio({ w: 100, h: 44 }, { w: 300, h: 78 }), 0.188);
  t('area ratio refuses a zero-area primary', areaRatio({ w: 100, h: 44 }, { w: 0, h: 78 }), null);
  t('area ratio refuses a missing box', areaRatio(null, { w: 300, h: 78 }), null);

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };

if (argv.includes('--selftest')) selftest();
else if (argv.includes('--from-census')) {
  const i = argv.indexOf('--from-census');
  const [a, b] = [argv[i + 1], argv[i + 2]];
  const A = JSON.parse(await readFile(a, 'utf8'));
  const B = JSON.parse(await readFile(b, 'utf8'));
  console.log(`\nDESIGN-SYSTEM ADOPTION — the named targets, from the computed-style census\n  before: ${a}\n  after:  ${b}`);
  fromCensus(A, B);
  process.exit(0);
} else if (argv.includes('--compare')) {
  const i = argv.indexOf('--compare');
  const [a, b] = [argv[i + 1], argv[i + 2]];
  const A = JSON.parse(await readFile(a, 'utf8'));
  const B = JSON.parse(await readFile(b, 'utf8'));
  console.log(`\nDESIGN-SYSTEM ADOPTION — the four named targets\n  before: ${a}\n  after:  ${b}`);
  report(B, A);
  process.exit(0);
} else {
  const base = arg('--url', process.env.PREVIEW_BASE);
  if (!base) { console.error('da_geom: --url or PREVIEW_BASE required (snapshot only)'); process.exit(2); }
  await capture(base, arg('--json', 'shots/da/geom.json'));
}
