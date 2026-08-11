#!/usr/bin/env node
/**
 * FONT CENSUS — what faces the app actually loads, and what breaks when it cannot.
 *
 * ── The defect this exists for ────────────────────────────────────────────────
 * `index.html` used to carry a Google Fonts `<link>`. It was the ONLY external request
 * the game made. `docs/APP.md` §8 measured what happens when it is unreachable:
 * `document.fonts.size` 33 -> 0, the whole UI falls to the platform sans, and the home
 * screen's weapon caption CLIPS — "Tomato Toss –" re-wraps and the leading "T" is cut
 * off at the left edge of its pill. That is a real layout defect that NO SHIPPED GATE
 * SEES, because every gate runs with the network up.
 *
 * This tool is that gate. It answers three separate questions, and they are separate on
 * purpose because a change can fix one and break another:
 *
 *   1. WHICH FACES exist and which actually LOAD (`document.fonts`, plus the real
 *      network requests). Google serves 33 `@font-face` rules for
 *      `Rubik:700;800;900 + Heebo:400;600;800` — 11 distinct binaries behind them,
 *      because both families are VARIABLE and one file backs all three weights. Knowing
 *      which of the 11 the app ever asks for is the whole subsetting decision.
 *   2. WHETHER TEXT OVERFLOWS ITS BOX, per element, everywhere — not just on the one
 *      caption somebody happened to look at. Wider fallback metrics push text out of
 *      fixed-size pills all over a game UI.
 *   3. WHAT IT LOOKS LIKE. A PNG per cell, because CLAUDE.md #3: the clip was found by
 *      comparing images, not numbers, and a number that agrees with a wrong picture is
 *      still wrong.
 *
 * ── `--offline` is a REAL block, not a URL filter ─────────────────────────────
 * Every request whose host is not loopback is ABORTED, so this measures the app with no
 * internet at all — which is the configuration a wrapped app ships in, and is strictly
 * stronger than blocking `fonts.gstatic.com` by name. `data:` and `blob:` pass, because
 * they never leave the process.
 *
 * ── INSTRUMENT VALIDATION (CLAUDE.md non-negotiable #6) ───────────────────────
 * `--selftest` runs the overflow detector against a synthetic page with FOUR known
 * cells and asserts the verdict for each, so the detector is shown to FAIL on the bug
 * it guards against before any of its answers are believed:
 *
 *   fits           text narrower than its box            -> 0 overflow
 *   clipped-left   text wider than a centred box         -> overflow on BOTH edges
 *   clipped-right  text wider than a left-aligned box    -> overflow on the RIGHT
 *   scrolled       overflow:hidden with a long word      -> caught via scrollWidth too
 *
 * A detector that reports 0 on all four would pass a naive "it returned a number" check
 * and is exactly the failure `sentinel` calls a check that cannot fail.
 *
 * ⚠️ AND THE REAL KNOWN-BAD INPUT IS THE TREE ITSELF. Before the fonts were bundled,
 * `--offline` on this app had to come back with `fonts.size 0` and a non-empty overflow
 * set. If it ever comes back clean on a tree with no local fonts, the tool is lying.
 * `--expect-fonts N` / `--expect-clean` turn those into exit codes.
 *
 * Usage:
 *   node tools/tmp/ft_faces.mjs --selftest
 *   node tools/tmp/ft_faces.mjs --url <snapshot> --out shots/ft --label online
 *   node tools/tmp/ft_faces.mjs --url <snapshot> --out shots/ft --label offline --offline
 *   node tools/tmp/ft_faces.mjs --compare shots/ft online offline
 */

import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { settleScreen, captureSettled } from './settle.mjs';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

/** The same five screens `da_census` walks, so a finding here is comparable there. */
const SCREENS = ['home', 'characters', 'trophies', 'shop', 'settings'];

/** 844x390 first: it is the tight landscape phone where the caption clip was FOUND,
 *  and the one an app ships at. Desktop and portrait come along because a fallback
 *  metric change moves text at every width, not just the tight one. */
const VIEWPORTS = [
  { name: 'phone-land', w: 844, h: 390 },
  { name: 'desktop', w: 1600, h: 900 },
  { name: 'phone-portrait', w: 430, h: 932 },
];

/** A populated save, so the five screens render their real content rather than a
 *  first-run skeleton — an empty shop has no rows and an empty road no claimed nodes,
 *  and text that never renders cannot be measured for overflow. Copied from
 *  `da_census.mjs` verbatim so both tools measure the same app. */
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

// ── The page-side probe ───────────────────────────────────────────────────────

/**
 * Read the font set and the text-overflow census out of the live document.
 *
 * OVERFLOW is measured against the CONTENT box, from the text's own client rects, and
 * not from `scrollWidth`. Both are reported, because they see different things:
 *
 *   - `scrollWidth - clientWidth` sees a scrollable overflow, and is BLIND to text that
 *     escapes a `overflow: visible` box (the common case in this UI: pills that let
 *     their text spill rather than scroll).
 *   - Range client rects see the ink, and are blind to nothing — but they also see
 *     LEGITIMATE spill (a deliberately oversized numeral, a badge that overhangs).
 *
 * So neither is a verdict on its own. The verdict comes from COMPARING two arms: the
 * set of overflowing elements with fonts present is the baseline, and anything that
 * appears or grows without them is the defect. That is a drift control, not a guessed
 * tolerance (CLAUDE.md #4).
 */
function probeFn() {
  const faces = [];
  document.fonts.forEach((f) => {
    faces.push({
      family: f.family,
      weight: f.weight,
      style: f.style,
      status: f.status,
      // First range only: enough to name the subset, short enough to read in a report.
      range: String(f.unicodeRange || '').split(',')[0].trim(),
    });
  });

  const root = document.querySelector('.fa-root');
  const overflow = [];
  const key = (el) => {
    const parts = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const tag = n.tagName.toLowerCase();
      const cls = [...n.classList].sort().join('.');
      const id = n.id ? `#${n.id}` : '';
      const sibs = n.parentElement ? [...n.parentElement.children].indexOf(n) : 0;
      parts.unshift(`${tag}${id}${cls ? `.${cls}` : ''}[${sibs}]`);
      if (n.classList.contains('fa-root')) break;
    }
    return parts.join('>');
  };

  const scan = (scope) => {
    const all = [scope, ...scope.querySelectorAll('*')];
    for (const el of all) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const box = el.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue;

      // The CONTENT box: the border box minus border and padding on each side.
      const px = (v) => parseFloat(v) || 0;
      const L = box.left + px(cs.borderLeftWidth) + px(cs.paddingLeft);
      const R = box.right - px(cs.borderRightWidth) - px(cs.paddingRight);
      const T = box.top + px(cs.borderTopWidth) + px(cs.paddingTop);
      const B = box.bottom - px(cs.borderBottomWidth) - px(cs.paddingBottom);

      let over = { l: 0, r: 0, t: 0, b: 0 };
      let text = '';
      let lines = 0;
      for (const node of el.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        if (!node.textContent.trim()) continue;
        const rng = document.createRange();
        rng.selectNodeContents(node);
        const rects = [...rng.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
        lines += rects.length;
        text += node.textContent;
        for (const r of rects) {
          over.l = Math.max(over.l, L - r.left);
          over.r = Math.max(over.r, r.right - R);
          over.t = Math.max(over.t, T - r.top);
          over.b = Math.max(over.b, r.bottom - B);
        }
      }
      const scrollX = el.scrollWidth - el.clientWidth;
      const scrollY = el.scrollHeight - el.clientHeight;
      const worst = Math.max(over.l, over.r, over.t, over.b);
      // 0.5px: below one CSS pixel is sub-pixel rounding in the rect arithmetic, not
      // ink outside a box. Stated rather than tuned — it is the smallest unit the
      // layout engine can express, not a number picked to make an answer come out.
      const scrollable = cs.overflowX !== 'visible' || cs.overflowY !== 'visible';
      if (worst > 0.5 || (scrollable && (scrollX > 0.5 || scrollY > 0.5))) {
        overflow.push({
          el: key(el),
          l: +over.l.toFixed(2), r: +over.r.toFixed(2),
          t: +over.t.toFixed(2), b: +over.b.toFixed(2),
          scrollX: +scrollX.toFixed(2), scrollY: +scrollY.toFixed(2),
          lines,
          text: text.trim().slice(0, 60),
          box: `${box.width.toFixed(1)}x${box.height.toFixed(1)}`,
        });
      }
    }
  };
  if (root) scan(root);

  // The one element `docs/APP.md` §8 names, reported explicitly so the headline number
  // never has to be dug out of a list.
  const cap = document.querySelector('.fa-home .home-kit-cap');
  let caption = null;
  if (cap) {
    const b = cap.getBoundingClientRect();
    const rng = document.createRange();
    rng.selectNodeContents(cap);
    const rects = [...rng.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    caption = {
      text: cap.textContent.trim(),
      box: `${b.width.toFixed(1)}x${b.height.toFixed(1)}`,
      lineBoxes: rects.length,
      inkLeft: rects.length ? +Math.min(...rects.map((r) => r.left - b.left)).toFixed(2) : null,
      inkRight: rects.length ? +Math.max(...rects.map((r) => b.right - r.right)).toFixed(2) : null,
      font: getComputedStyle(cap).fontFamily,
      // The measured width of a known string in the ACTUAL rendered face. This is the
      // single number that says "the metrics moved" and it cannot be faked by a
      // fallback that happens to declare the same family name.
      probeWidth: (() => {
        const s = document.createElement('span');
        s.textContent = 'Tomato Toss – Slows enemies down';
        s.style.cssText = 'position:fixed;left:-9999px;top:0;white-space:nowrap;'
          + `font:${getComputedStyle(cap).font}`;
        document.body.appendChild(s);
        const w = s.getBoundingClientRect().width;
        s.remove();
        return +w.toFixed(2);
      })(),
    };
  }

  /**
   * A FACE-INDEPENDENT metrics probe: the same two strings measured in each family at a
   * fixed size. If the bundled faces are the same binaries Google served, these numbers
   * are IDENTICAL to the CDN arm; if anything about the face changed (a different
   * version, a wrong weight, a synthesised bold) they move. It runs on every screen, so
   * it is also the cheap check that a screen did not somehow get a different face.
   *
   * ⚠️ THE RULER MEASURES WHAT IS AVAILABLE, NOT WHAT THE PAGE USES, and that is a real
   * distinction it has already produced a scary-looking number for. On
   * `home@phone-portrait` the page renders NO Heebo at all — `loaded` is `Rubik/800,
   * Rubik/900` in every arm — so in the CDN arm the ruler's own Heebo spans were the
   * FIRST thing to ask for Heebo, `font-display: swap` handed them the fallback, and the
   * face arrived after the measurement. Self-hosted, `heebo-latin` is PRELOADED, so it is
   * already there and the ruler reads the real face. The cell therefore reports "the FACE
   * changed" for Heebo on a screen whose Heebo usage is zero, and its `overflow` set is
   * byte-identical. That is the preload working, not the page moving. **Read a ruler
   * difference together with `loaded` and `overflow` before calling it a regression.**
   */
  const ruler = {};
  for (const fam of ['Rubik', 'Heebo']) {
    for (const w of [400, 600, 700, 800, 900]) {
      const s = document.createElement('span');
      s.textContent = 'Handgloves 0123456789 – …';
      s.style.cssText = `position:fixed;left:-9999px;top:0;white-space:nowrap;font-size:100px;font-weight:${w};font-family:'${fam}',sans-serif`;
      document.body.appendChild(s);
      ruler[`${fam}-${w}`] = +s.getBoundingClientRect().width.toFixed(2);
      s.remove();
    }
  }
  // The control: a family that does NOT exist, so it is the platform sans at the same
  // size. If a real family's ruler EQUALS this, that family did not load — which is the
  // whole "it is rendering and invisible" question asked of type (CLAUDE.md #4).
  {
    const s = document.createElement('span');
    s.textContent = 'Handgloves 0123456789 – …';
    s.style.cssText = 'position:fixed;left:-9999px;top:0;white-space:nowrap;font-size:100px;font-weight:800;font-family:\'__fa_no_such_family__\',sans-serif';
    document.body.appendChild(s);
    ruler['FALLBACK-800'] = +s.getBoundingClientRect().width.toFixed(2);
    s.remove();
  }

  return { fontsSize: document.fonts.size, faces, overflow, caption, ruler };
}

// ── Capture ───────────────────────────────────────────────────────────────────

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/i;

async function runCapture(args) {
  const base = args.url ?? process.env.PREVIEW_BASE;
  if (!base) throw new Error('need --url (or PREVIEW_BASE)');
  const outDir = resolve(args.out ?? 'shots/ft');
  const label = args.label ?? 'run';
  const offline = !!args.offline;
  await mkdir(outDir, { recursive: true });

  const vps = args.vp ? VIEWPORTS.filter((v) => String(args.vp).split(',').includes(v.name)) : VIEWPORTS;
  const screens = args.screens ? String(args.screens).split(',') : SCREENS;

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const records = [];
  const blocked = new Set();

  for (const vp of vps) {
    const mkPage = async () => {
      const p = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
      await p.addInitScript((profile) => {
        try { localStorage.setItem('food-arena.profile.v1', JSON.stringify(profile)); } catch { /* private mode */ }
      }, SEED_PROFILE);
      if (offline) {
        // A REAL block: everything that is not loopback is aborted. Not a name filter —
        // the app must survive having no internet, not merely no Google.
        await p.route('**/*', (route) => {
          const u = new URL(route.request().url());
          if (u.protocol === 'data:' || u.protocol === 'blob:' || LOOPBACK.test(u.hostname)) return route.continue();
          blocked.add(`${u.origin}${u.pathname}`);
          return route.abort();
        });
      }
      return p;
    };

    let pageRef = { page: await mkPage() };
    for (const screen of screens) {
      const fontReqs = [];
      const onResp = (r) => {
        const u = r.url();
        if (/\.woff2?(\?|$)|\.ttf(\?|$)|fonts\.googleapis|fonts\.gstatic/.test(u)) {
          fontReqs.push({ url: u.replace(base, ''), status: r.status() });
        }
      };
      pageRef.page.on('response', onResp);
      let rec = null;
      for (let attempt = 1; attempt <= 4 && !rec; attempt++) {
        try {
          const url = `${base}/?screen=${screen}&hold=600000&pointerLock=0`;
          // eslint-disable-next-line no-await-in-loop
          await pageRef.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
          // eslint-disable-next-line no-await-in-loop
          await pageRef.page.waitForFunction(
            `window.__screen === ${JSON.stringify(screen)} && window.__screenReady === true`,
            null, { timeout: 90_000 },
          );
          // eslint-disable-next-line no-await-in-loop
          await settleScreen(pageRef.page, { label: `${screen}@${vp.name}` });
          // Past the hint fade and any progress tween, so both arms read steady state.
          // eslint-disable-next-line no-await-in-loop
          await pageRef.page.waitForTimeout(2400);
          // `document.fonts.ready` is what makes the two arms comparable: without it the
          // online arm can be measured mid-swap and report fallback metrics that are
          // real for 80 ms and wrong forever after.
          // eslint-disable-next-line no-await-in-loop
          await pageRef.page.evaluate(() => document.fonts.ready);
          const shot = `${outDir}/${label}-${screen}-${vp.name}.png`;
          // eslint-disable-next-line no-await-in-loop
          await captureSettled(pageRef.page, { path: shot, label: `${screen}@${vp.name}`, tool: 'ft_faces' });
          // eslint-disable-next-line no-await-in-loop
          const data = await pageRef.page.evaluate(probeFn);
          rec = { screen, vp: vp.name, shot, fontReqs, ...data };
        } catch (e) {
          if (!/Execution context was destroyed|Target closed|Timeout|crash/i.test(String(e && e.message))) throw e;
          console.log(`    attempt ${attempt}/4 for ${screen}@${vp.name} lost its renderer — new page`);
          try { pageRef.page.off('response', onResp); await pageRef.page.close(); } catch { /* gone */ }
          // eslint-disable-next-line no-await-in-loop
          pageRef.page = await mkPage();
          pageRef.page.on('response', onResp);
        }
      }
      if (!rec) throw new Error(`could not capture ${screen}@${vp.name}`);
      pageRef.page.off('response', onResp);
      records.push(rec);
      console.log(`  ${screen}@${vp.name}  fonts.size=${rec.fontsSize}`
        + `  loaded=${rec.faces.filter((f) => f.status === 'loaded').length}`
        + `  fontReqs=${rec.fontReqs.length}`
        + `  overflow=${rec.overflow.length}`
        + (rec.caption ? `  caption lines=${rec.caption.lineBoxes} inkLeft=${rec.caption.inkLeft}` : ''));
    }
    await pageRef.page.close();
  }
  await browser.close();

  if (offline) {
    console.log(`\n  BLOCKED (non-loopback requests the app attempted): ${blocked.size}`);
    for (const b of blocked) console.log(`    ${b}`);
  }

  await writeFile(`${outDir}/ft-${label}.json`,
    JSON.stringify({ label, base, offline, blocked: [...blocked], records }, null, 2));
  console.log(`\n  wrote ${outDir}/ft-${label}.json  (${records.length} captures)\n`);

  // Assertions, opt-in, so this can be a REPORT in exploration and a GATE in acceptance.
  let bad = 0;
  if (args['expect-fonts'] !== undefined) {
    const want = Number(args['expect-fonts']);
    for (const r of records) {
      if (r.fontsSize < want) { console.log(`  FAIL ${r.screen}@${r.vp}: fonts.size ${r.fontsSize} < ${want}`); bad++; }
    }
  }
  if (args['expect-no-external']) {
    if (blocked.size) { console.log(`  FAIL: ${blocked.size} external request(s) attempted`); bad++; }
  }
  if (args['expect-fonts'] !== undefined || args['expect-no-external']) {
    console.log(bad ? `\n  ${bad} assertion(s) FAILED\n` : '\n  all assertions PASS\n');
    process.exitCode = bad ? 1 : 0;
  }
}

// ── Compare ───────────────────────────────────────────────────────────────────

function cmpOverflow(a, b) {
  const A = new Map(a.map((o) => [o.el, o]));
  const B = new Map(b.map((o) => [o.el, o]));
  const appeared = [...B.values()].filter((o) => !A.has(o.el));
  const gone = [...A.values()].filter((o) => !B.has(o.el));
  const grew = [];
  for (const [k, oa] of A) {
    const ob = B.get(k);
    if (!ob) continue;
    const wa = Math.max(oa.l, oa.r, oa.t, oa.b);
    const wb = Math.max(ob.l, ob.r, ob.t, ob.b);
    if (wb - wa > 0.5) grew.push({ el: k, from: +wa.toFixed(2), to: +wb.toFixed(2), text: ob.text });
  }
  return { appeared, gone, grew };
}

async function runCompare(args) {
  const [dir, labelA, labelB] = args._;
  const root = resolve(dir);
  const load = async (l) => JSON.parse(await readFile(`${root}/ft-${l}.json`, 'utf8'));
  const A = await load(labelA);
  const B = await load(labelB);
  console.log(`\nFONT CENSUS — ${labelA} -> ${labelB}\n`);
  let issues = 0;
  for (const ra of A.records) {
    const rb = B.records.find((r) => r.screen === ra.screen && r.vp === ra.vp);
    if (!rb) { console.log(`  !! missing in ${labelB}: ${ra.screen}@${ra.vp}`); issues++; continue; }
    const { appeared, gone, grew } = cmpOverflow(ra.overflow, rb.overflow);
    const rulerDiffs = Object.keys(ra.ruler ?? {}).filter((k) => Math.abs((ra.ruler[k] ?? 0) - (rb.ruler?.[k] ?? 0)) > 0.01);
    const capDiff = ra.caption && rb.caption
      ? (ra.caption.lineBoxes !== rb.caption.lineBoxes || Math.abs(ra.caption.probeWidth - rb.caption.probeWidth) > 0.01)
      : false;
    const clean = !appeared.length && !grew.length && !rulerDiffs.length && !capDiff;
    console.log(`  ${ra.screen}@${ra.vp}   fonts.size ${ra.fontsSize} -> ${rb.fontsSize}`
      + `   overflow ${ra.overflow.length} -> ${rb.overflow.length}`
      + `   ${clean ? 'IDENTICAL' : '<<< MOVED'}`);
    for (const k of rulerDiffs) console.log(`      RULER ${k}: ${ra.ruler[k]} -> ${rb.ruler?.[k]}  (the FACE changed)`);
    if (capDiff) {
      console.log(`      CAPTION lines ${ra.caption.lineBoxes} -> ${rb.caption.lineBoxes}`
        + `   probeWidth ${ra.caption.probeWidth} -> ${rb.caption.probeWidth}`
        + `   inkLeft ${ra.caption.inkLeft} -> ${rb.caption.inkLeft}`);
    }
    for (const o of appeared.slice(0, 8)) console.log(`      NEW OVERFLOW  l=${o.l} r=${o.r} b=${o.b}  "${o.text}"  on ${o.el}`);
    if (appeared.length > 8) console.log(`      ... and ${appeared.length - 8} more`);
    for (const o of grew.slice(0, 8)) console.log(`      GREW ${o.from} -> ${o.to}  "${o.text}"  on ${o.el}`);
    for (const o of gone.slice(0, 4)) console.log(`      (fixed) l=${o.l} r=${o.r}  "${o.text}"`);
    if (!clean) issues++;
  }
  console.log(`\n  ${issues ? `${issues} cell(s) MOVED` : 'every cell identical'}\n`);
  process.exitCode = args.strict && issues ? 1 : 0;
}

// ── Selftest ──────────────────────────────────────────────────────────────────

/**
 * The detector against four KNOWN cells. Two must be clean and two must be caught, and
 * the two that must be caught differ in HOW they overflow — a centred box spills on both
 * edges, a left-aligned one only on the right. A detector that only looked at
 * `scrollWidth` sees NEITHER of the `overflow: visible` cells, which is why it exists.
 */
const SELFTEST_HTML = `<!doctype html><meta charset="utf-8">
<style>
  body { margin:0; font:16px/1.2 monospace; }
  .fa-root { width: 600px; }
  .cell { width: 120px; height: 24px; border: 2px solid #000; padding: 0 6px; margin: 8px; }
  #fits { text-align:center; }
  /* Flex-centred, which is how most pills in this UI centre their label — and unlike
     'text-align:center' it genuinely spills on BOTH edges. Measured while writing this:
     Chromium gives a centre-aligned BLOCK's overflow entirely to the end edge (l=0,
     r=244.86), so a selftest built on 'text-align' would have asserted a left spill that
     the platform never produces and been "fixed" by weakening the detector. */
  #clipped-left { display:flex; justify-content:center; align-items:center; white-space:nowrap; }
  #clipped-right { text-align:left; white-space:nowrap; }
  #scrolled { overflow:hidden; white-space:nowrap; }
</style>
<div class="fa-root">
  <div class="cell" id="fits">ok</div>
  <div class="cell" id="clipped-left">Tomato Toss - Slows enemies down a lot</div>
  <div class="cell" id="clipped-right">Tomato Toss - Slows enemies down a lot</div>
  <div class="cell" id="scrolled">Tomato Toss - Slows enemies down a lot</div>
</div>`;

/**
 * THE STATIC HALF — no browser, and it is the half that catches the cheapest disaster.
 *
 * Three facts about the tree, each of which has a way of going wrong silently:
 *
 *  1. `index.html` and `preview.html` declare BYTE-IDENTICAL `@font-face` blocks. Two
 *     copies of a font stack that drift is how a measurement harness starts rendering a
 *     different typeface from the app with nothing to show for it.
 *  2. Every file a `src: url()` names EXISTS in `public/fonts/`. A typo there is the
 *     project's most-repeated failure — it is not "missing", it renders as the platform
 *     sans and looks like a design choice.
 *  3. No ORPHANS: every `.woff2` in `public/fonts/` is referenced. An unreferenced font
 *     is payload shipped to every player for nothing.
 *
 * Each is asserted against a deliberately-broken copy as well, so none of them is a
 * check that cannot fail.
 */
function faceBlocks(html) {
  return (html.match(/@font-face\s*\{[^}]*\}/g) ?? [])
    .map((b) => b.replace(/\s+/g, ' ').trim());
}

async function staticChecks() {
  const checks = [];
  const ok = (name, cond, detail) => checks.push({ name, cond, detail });
  const { readFileSync, readdirSync, existsSync } = await import('node:fs');

  /**
   * ⚠️ COMMENTS ARE STRIPPED FIRST, and skipping that made this tool report a false
   * failure on its very first run: `preview.html`'s comment explains that it deliberately
   * carries no `<link rel="preload">`, and a naive `/rel="preload"/` match found the
   * PROSE. A checker that reads documentation as code is the same family of mistake as
   * judging a description instead of an image.
   */
  const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
  const idx = strip(readFileSync('index.html', 'utf8'));
  const pre = strip(readFileSync('preview.html', 'utf8'));
  const a = faceBlocks(idx);
  const b = faceBlocks(pre);

  ok('index.html declares @font-face rules at all', a.length > 0, `${a.length} rules`);
  ok('preview.html declares the same COUNT', a.length === b.length, `${a.length} vs ${b.length}`);
  ok('the two blocks are byte-identical after whitespace normalisation',
    a.join('\n') === b.join('\n'),
    a.join('\n') === b.join('\n') ? 'identical' : 'DRIFTED');
  // ARMS DIFFER: mutate one copy and require the comparator to notice.
  const mutated = a.map((s, i) => (i === 0 ? s.replace('700', '750') : s));
  ok('a ONE-TOKEN drift is detected (known-bad input)',
    mutated.join('\n') !== b.join('\n'), 'weight 700 -> 750 in rule 1');

  const refs = new Set([...idx.matchAll(/url\('\/fonts\/([^']+)'\)/g)].map((m) => m[1]));
  ok('at least one font file is referenced', refs.size > 0, [...refs].join(', '));
  for (const f of refs) ok(`referenced file exists: ${f}`, existsSync(`public/fonts/${f}`), `public/fonts/${f}`);
  ok('a NON-EXISTENT reference would be caught', !existsSync('public/fonts/__no_such_font__.woff2'), 'control');

  const onDisk = existsSync('public/fonts') ? readdirSync('public/fonts').filter((f) => f.endsWith('.woff2')) : [];
  const orphans = onDisk.filter((f) => !refs.has(f));
  ok('no orphan .woff2 in public/fonts', orphans.length === 0, orphans.length ? orphans.join(', ') : `${onDisk.length} files, all referenced`);

  // The preloads live in index.html ONLY, and each must name a file that is also
  // @font-face'd — a preload of something no rule uses is a wasted request that the
  // browser will warn about and nobody will read.
  const pl = [...idx.matchAll(/rel="preload"[^>]*href="\/fonts\/([^"]+)"/g)].map((m) => m[1]);
  ok('every preload is also declared in an @font-face', pl.every((f) => refs.has(f)), pl.join(', ') || 'none');
  ok('every preload carries crossorigin (fonts are ALWAYS fetched in CORS mode; without it the preload is discarded and the font is fetched twice)',
    [...idx.matchAll(/rel="preload"[^>]*>/g)].every((m) => /crossorigin/.test(m[0])), `${pl.length} preloads`);
  ok('preview.html carries NO preload (it renders no UI type; a preload there is 65KB per tool run for nothing)',
    !/rel="preload"/.test(pre), 'absent');

  return checks;
}

async function runSelftest() {
  const staticC = await staticChecks();
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent(SELFTEST_HTML);
  const data = await page.evaluate(probeFn);
  await browser.close();

  const by = new Map(data.overflow.map((o) => [o.el.split('>').pop(), o]));
  const find = (id) => [...by.entries()].find(([k]) => k.includes(id))?.[1] ?? null;

  const checks = [];
  const ok = (name, cond, detail) => { checks.push({ name, cond, detail }); };

  const fits = find('fits');
  ok('fits: no overflow reported', fits === null, fits ? JSON.stringify(fits) : 'absent');

  const cl = find('clipped-left');
  ok('clipped-left: caught', cl !== null, cl ? `l=${cl.l} r=${cl.r}` : 'MISSED');
  ok('clipped-left: spills on BOTH edges', !!cl && cl.l > 1 && cl.r > 1, cl ? `l=${cl.l} r=${cl.r}` : 'n/a');

  const cr = find('clipped-right');
  ok('clipped-right: caught', cr !== null, cr ? `l=${cr.l} r=${cr.r}` : 'MISSED');
  ok('clipped-right: spills on the RIGHT only', !!cr && cr.r > 1 && cr.l <= 0.5, cr ? `l=${cr.l} r=${cr.r}` : 'n/a');

  const sc = find('scrolled');
  ok('scrolled: caught via scrollWidth', sc !== null && sc.scrollX > 1, sc ? `scrollX=${sc.scrollX}` : 'MISSED');

  // SELF-PAIR: the comparator against itself must be EXACTLY empty. `holds({a,b:a})`
  // proves determinism and nothing else, so this also asserts the known value.
  const self = cmpOverflow(data.overflow, data.overflow);
  ok('self-pair: 0 appeared, 0 grew (EXACT)',
    self.appeared.length === 0 && self.grew.length === 0 && self.gone.length === 0,
    `${self.appeared.length}/${self.grew.length}/${self.gone.length}`);

  // ARMS DIFFER: the comparator must MOVE when one side is deliberately broken.
  const broken = data.overflow.filter((o) => !o.el.includes('clipped-left'));
  const moved = cmpOverflow(broken, data.overflow);
  ok('arms differ: removing one row is reported as APPEARED',
    moved.appeared.length === 1, `${moved.appeared.length} appeared`);

  // The ruler must SEPARATE a present family from an absent one. On a bare page with no
  // @font-face at all, every named family IS the fallback — so this asserts the control
  // works, i.e. that a family which did not load reads identical to the fallback.
  ok('ruler control: an absent family measures as the fallback',
    Math.abs((data.ruler['Rubik-800'] ?? 0) - (data.ruler['FALLBACK-800'] ?? -1)) < 0.01,
    `Rubik-800=${data.ruler['Rubik-800']} FALLBACK-800=${data.ruler['FALLBACK-800']}`);

  const all = [...staticC, ...checks];
  console.log('\nft_faces --selftest\n');
  console.log('  ── the tree (no browser) ───────────────────────────────────────────');
  let fails = 0;
  for (const c of staticC) {
    if (!c.cond) fails++;
    console.log(`  ${c.cond ? 'PASS' : 'FAIL'}  ${c.name}   (${c.detail})`);
  }
  console.log('\n  ── the overflow detector, against four known cells ─────────────────');
  for (const c of checks) {
    if (!c.cond) fails++;
    console.log(`  ${c.cond ? 'PASS' : 'FAIL'}  ${c.name}   (${c.detail})`);
  }
  console.log(`\n  ${all.length - fails}/${all.length}\n`);
  process.exitCode = fails ? 1 : 0;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const args = parseArgs(process.argv);
if (args.selftest) await runSelftest();
else if (args.compare) await runCompare({ ...args, _: [args.compare, ...args._] });
else await runCapture(args);
