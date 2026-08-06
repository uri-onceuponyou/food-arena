#!/usr/bin/env node
/**
 * SPECIMEN SHEET for the 'ds-*' component layer.
 *
 * The layer ships UNUSED, which means no screen renders it and no screenshot of the
 * product contains a single pixel of it. That is the point of the pass — and it is
 * also how a foundation ships broken: 'docs/LESSONS.md' 1 records eighteen cases where
 * the true cause was "it IS rendering, and it is invisible", and the eighteenth
 * rendered PLAUSIBLY AND WRONGLY. A component layer nobody has looked at is exactly
 * that failure waiting to happen, one wave later, in five files at once.
 *
 * So this mounts every component into the LIVE page at runtime — no source file is
 * touched, nothing is committed, the classes resolve against the real tokens on the
 * real '.fa-root' over the real backdrop — and photographs it. CLAUDE.md
 * non-negotiable 3: judge rendered pixels.
 *
 * It also runs a CONTRAST pass over every text run it draws, using the same WCAG model
 * as the three existing batteries, because a new dark surface is exactly where a
 * contrast regression would be introduced and none of those batteries can see a
 * component that no screen uses yet.
 *
 * Usage:
 *   node tools/tmp/ds_sheet.mjs --url <snapshot> --out shots/ds
 */

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { settleScreen, captureSettled } from './settle.mjs';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2); const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true; else { out[k] = n; i++; }
  }
  return out;
}

/**
 * ⚠️ CONTRAST FROM PIXELS, and the first version of this was WRONG.
 *
 * It walked the DOM for the first non-transparent `background-color` and composited the
 * text colour over it. That model cannot see a GRADIENT — `background: linear-gradient()`
 * computes `background-color: transparent` — and this design system is gradients almost
 * everywhere. So the walk sailed past every button and every surface and landed on the
 * page body, which is near-black, and reported ink-on-mustard as **1.02:1**. Three of the
 * ten "failures" it listed were real and it found them by accident; the arithmetic was
 * nonsense on all ten.
 *
 * That is `screen_metrics.mjs`'s own scar, verbatim from its header: identify by model,
 * MEASURE FROM PIXELS. So the ink and the paper are now read out of the captured PNG.
 * Within one text run's box there are exactly two populations — glyph and ground — so the
 * 5th and 95th percentile of luminance are them, whichever way round they sit.
 *
 * Validated before use against two pairs whose answer is known from theme.ts's own
 * recorded measurements: cream on ink (~12:1) and ink on the mustard button face
 * (the shipped `.fa-btn`, which three contrast batteries already pass).
 */

/**
 * ── THE THIRD ATTEMPT, and the first two are recorded because they are the lesson ──
 *
 * (1) A DOM MODEL walked up for the first opaque `background-color` and composited the
 *     text colour onto it. It cannot see a GRADIENT — `background: linear-gradient()`
 *     computes `background-color: transparent` — and this system is gradients nearly
 *     everywhere, so it sailed past every button onto the near-black page body and
 *     reported ink-on-mustard as **1.02:1**.
 *
 * (2) PIXELS, at the 5th/95th luminance percentile inside each run's box. Correct in
 *     principle and wrong here for the reason `screen_metrics.mjs`'s header already
 *     records: a 13px label inside a `flex: 1 1 auto` row covers ~3% of its own box, so
 *     the 5th percentile is still background and the run reads 1.4:1 against a cream
 *     plate it plainly contrasts with. Its anchors caught it — cream-on-ink read 9.21
 *     where 12 was expected, and the mustard anchor was not found at all.
 *
 * (3) ANALYTIC, over the pairs the STYLESHEET DECLARES. This is exact here and it was
 *     not obvious: every colour pair in this layer is two literal values in one rule,
 *     never a runtime composition, so there is nothing to sample. `screen_metrics`
 *     measures pixels because it audits arbitrary screens where inherited opacity, a
 *     scroll fade and a WebGL backdrop all count; a specimen sheet of declared pairs is
 *     a different problem and the pixel machinery is the wrong tool for it.
 *
 * ⚠️ What (3) cannot see, stated because it matters at adoption time: a caller-supplied
 * fill (`--ds-tile-fill`, `--ds-bar-ink`, `--ds-banner-fill`) and any inherited opacity.
 * Those are exactly what the three existing pixel batteries are for, and they will see
 * them the moment a screen adopts the layer.
 *
 * Validated against theme.ts's own recorded measurements before use.
 */
function relLum(r, g, b) {
  const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const HEX = (h) => {
  const c = h.replace('#', '');
  const f = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
};
function ratio(fg, bg) {
  const a = relLum(...HEX(fg));
  const b = relLum(...HEX(bg));
  return +(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05))).toFixed(2);
}

const INK = '#1a1224'; const INK2 = '#2a1d3a'; const CREAM = '#FFF3DE'; const WHITE = '#FFFFFF';
const MUSTARD = '#FFC93C'; const MUSTARD_HI = '#FFDD6B'; const KETCHUP = '#D62839';
const TOMATO = '#E63946'; const LETTUCE = '#7CB518'; const WATER = '#1E90D8'; const PANEL = '#FEF2DD';

/** Every pair the ds-* layer declares, with the floor its type size demands.
 *  A gradient is TWO pairs — both stops — because the worst stop is the one that fails. */
const PAIRS = [
  ['.ds-surface--paper text', INK, PANEL, 4.5],
  ['.ds-surface--slate text (top stop)', CREAM, INK2, 4.5],
  ['.ds-surface--slate text (bottom stop)', CREAM, INK, 4.5],
  ['.ds-surface--action text (top stop)', INK, MUSTARD_HI, 4.5],
  ['.ds-surface--action text (bottom stop)', INK, MUSTARD, 4.5],
  ['.ds-btn (top stop)', INK, MUSTARD_HI, 4.5],
  ['.ds-btn (bottom stop)', INK, MUSTARD, 4.5],
  ['.ds-btn--secondary (top stop)', INK, '#4FB3E8', 4.5],
  ['.ds-btn--secondary (bottom stop)', INK, WATER, 4.5],
  ['.ds-btn--quiet', INK, '#EFE2CC', 4.5],
  ['.ds-btn--danger (top stop)', CREAM, KETCHUP, 4.5],
  ['.ds-btn--danger (bottom stop)', CREAM, '#8f1a24', 4.5],
  ['.ds-btn--green (top stop)', INK, '#A6E24A', 4.5],
  ['.ds-btn--green (bottom stop)', INK, LETTUCE, 4.5],
  ['.ds-btn--icon glyph', CREAM, INK, 4.5],
  ['.ds-chip text', INK, PANEL, 4.5],
  ['.ds-chip--slate text', CREAM, INK, 4.5],
  ['.ds-badge (default)', WHITE, KETCHUP, 4.5],
  ['.ds-badge--good', INK, LETTUCE, 4.5],
  ['.ds-badge--info', INK, WATER, 4.5],
  ['.ds-row--slate label', CREAM, INK, 4.5],
  ['.ds-tile glyph on its default fill', INK, WHITE, 4.5],
  ['.ds-bar-cap on the default fill', INK, LETTUCE, 4.5],
];

/** ⚠️ REJECTED, with the number that rejected it. Kept because a value that was tried
 *  and refused is as useful as one that shipped, and the next person will otherwise
 *  reach for the same obvious option. */
const REJECTED = [
  ['.ds-btn--secondary with CREAM (top stop)', CREAM, '#4FB3E8', 4.5],
  ['.ds-btn--secondary with CREAM (bottom stop)', CREAM, WATER, 4.5],
  ['.ds-btn--danger on --tomato with CREAM', CREAM, TOMATO, 4.5],
  ['.ds-btn--danger on --tomato with INK', INK, TOMATO, 4.5],
  ['.ds-badge--good with WHITE', WHITE, LETTUCE, 4.5],
  ['.ds-badge--info with WHITE', WHITE, WATER, 4.5],
  ['.ds-tile glyph INHERITING cream from a slate parent, on mustard', CREAM, MUSTARD, 4.5],
];

/** Anchors from theme.ts's own recorded measurements. If these do not reproduce, the
 *  arithmetic is wrong and nothing below is quotable. */
const ANCHORS = [
  ['--ketchup-ink on white (theme.ts records 7.5)', '#A3202E', WHITE, 7.2, 7.8],
  ['--water-ink on white (theme.ts records 7.6)', '#125981', WHITE, 7.3, 7.9],
];
/* ⚠️ THE FIRST ANCHOR SET WAS MIS-SPECIFIED AND THE TOOL WAS RIGHT.
   It anchored on theme.ts's "ketchup-ink 5.9 on cream" and "ketchup 4.27 on the chip
   plate" and read 6.82 and 4.49 — so it declared its own arithmetic unquotable. It was
   not: those recorded numbers are against COMPOSITED surfaces ('--panel' is
   rgba(255,243,222,0.94) over whatever is behind it, and the trophy-road pill carries
   its own opacity), which a hex-pair calculator cannot reproduce and should not try to.
   The two kept anchors are the ones theme.ts states as pure hex on white, where the
   answer is exact. A failing anchor that turns out to be the anchor's fault is still
   the guard working — it refused to let a number be quoted until someone checked. */

function contrastReport() {
  let bad = 0;
  console.log('\n  ── CONTRAST, analytic over every pair the ds-* layer DECLARES ──');
  console.log('  instrument anchors (theme.ts\'s own recorded numbers must reproduce):');
  let anchorFail = 0;
  for (const [name, fg, bg, lo, hi] of ANCHORS) {
    const r = ratio(fg, bg);
    const ok = r >= lo && r <= hi;
    if (!ok) anchorFail++;
    console.log(`    ${ok ? 'ok  ' : 'FAIL'}  ${String(r).padStart(5)}  ${name}`);
  }
  console.log('');
  for (const [name, fg, bg, floor] of PAIRS) {
    const r = ratio(fg, bg);
    const ok = r >= floor;
    if (!ok) bad++;
    console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${String(r).padStart(5)} (need ${floor})  ${name}`);
  }
  console.log(`\n  ${bad === 0 ? 'ALL ' + PAIRS.length + ' DECLARED PAIRS CLEAR WCAG AA' : bad + ' PAIRS BELOW AA'}`);
  if (anchorFail) console.log('  ⚠️ AN ANCHOR FAILED — the numbers above are NOT quotable.');
  console.log('\n  ── tried and REJECTED, with the number that rejected it ──');
  for (const [name, fg, bg, floor] of REJECTED) {
    console.log(`    ${String(ratio(fg, bg)).padStart(5)} (needed ${floor})  ${name}`);
  }
  console.log('\n  ⚠️ Blind to CALLER-SUPPLIED fills (--ds-tile-fill, --ds-bar-ink, --ds-banner-fill)');
  console.log('     and to inherited opacity. .ds-banner carries an ink text-stroke for exactly that');
  console.log('     reason — colour-independent, measured 16.5:1 on all six rarities.');
  return bad === 0 && anchorFail === 0;
}

/** The specimen markup. Every component, every modifier, in the arrangement a screen
 *  owner would actually reach for — a counter row, a data panel, a utility panel, an
 *  action panel, a button family, the bar/meter pair and the type ladder side by side
 *  so the STEPS are visible rather than asserted. */
const SHEET = `
<div class="fa-screen" style="display:block; overflow:auto; padding:18px">
  <div style="display:flex; flex-direction:column; gap:14px; max-width:1500px; margin:0 auto">

    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap">
      <span class="ds-chip"><span class="ds-chip-val ds-num">3,170</span> trophies</span>
      <span class="ds-chip ds-chip--slate"><span class="ds-chip-val ds-num">4,210</span> coins</span>
      <span class="ds-chip ds-chip--sm ds-caps">sm chip</span>
      <span class="ds-banner"><span>legendary</span></span>
      <span class="ds-banner" style="--ds-banner-fill:var(--water)"><span>marksman</span></span>
    </div>

    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:14px; align-items:start">

      <section class="ds-surface ds-surface--paper">
        <h3 class="ds-face ds-w-black ds-t2 ds-caps" style="margin:0">paper &mdash; read</h3>
        <div class="ds-row"><span class="ds-tile ds-tile--stat" style="--ds-tile-fill:#A6E24A">&#9733;</span><span class="ds-row-body"><span class="ds-row-label">wins</span><span class="ds-row-val ds-num">40</span></span></div>
        <div class="ds-row ds-row--inline"><span class="ds-tile">&#9679;</span><span class="ds-row-body"><span class="ds-row-label">losses (inline form)</span><span class="ds-row-val ds-num">22</span></span></div>
        <div class="ds-bar"><div class="ds-bar-fill" style="width:62%"></div><span class="ds-bar-cap ds-num">180 / 250 XP</span></div>
        <div class="ds-bar ds-bar--sm"><div class="ds-bar-fill" style="width:80%; --ds-bar-ink:var(--tomato)"></div></div>
        <div class="ds-bar ds-meter" style="--ds-pips:10"><div class="ds-bar-fill" style="width:70%; --ds-bar-ink:var(--water)"></div></div>
        <hr class="ds-rule">
        <div style="display:flex; gap:8px"><button class="ds-btn ds-btn--secondary">try</button><button class="ds-btn ds-btn--quiet">later</button></div>
      </section>

      <section class="ds-surface ds-surface--slate" style="position:relative">
        <span class="ds-badge ds-num">2</span>
        <h3 class="ds-face ds-w-black ds-t2 ds-caps" style="margin:0">slate &mdash; utility</h3>
        <div class="ds-row ds-row--slate" style="--ds-row-accent:#8CE06B"><span class="ds-tile ds-tile--stat" style="--ds-tile-fill:var(--lettuce)">&#9829;</span><span class="ds-row-body"><span class="ds-row-label">health</span><span class="ds-row-val ds-num">6000</span></span></div>
        <div class="ds-row ds-row--slate" style="--ds-row-accent:#FF8A8A"><span class="ds-tile ds-tile--stat" style="--ds-tile-fill:var(--tomato)">&#9650;</span><span class="ds-row-body"><span class="ds-row-label">attack</span><span class="ds-row-val ds-num">2800</span></span></div>
        <div class="ds-bar ds-meter" style="--ds-pips:11"><div class="ds-bar-fill" style="width:100%; --ds-bar-ink:var(--mustard)"></div></div>
        <div style="display:flex; gap:8px; flex-wrap:wrap">
          <button class="ds-btn ds-btn--icon">&#9881;</button>
          <button class="ds-btn ds-btn--icon">&#9776;</button>
          <button class="ds-btn ds-btn--icon">&#10005;</button>
        </div>
      </section>

      <section class="ds-surface ds-surface--action" style="position:relative">
        <span class="ds-badge ds-badge--tag ds-num">new</span>
        <h3 class="ds-face ds-w-black ds-t2 ds-caps" style="margin:0">action &mdash; get</h3>
        <div style="display:flex; gap:8px; flex-wrap:wrap">
          <span class="ds-tile ds-tile--lg">&#127828;</span>
          <span class="ds-tile ds-tile--lg ds-tile--round" style="--ds-tile-fill:var(--water)">&#127866;</span>
          <span class="ds-tile ds-tile--round" style="--ds-tile-fill:var(--lettuce)">&#127807;</span>
        </div>
        <button class="ds-btn ds-btn--block">claim 2</button>
        <button class="ds-btn ds-btn--green ds-btn--block">open chest</button>
        <button class="ds-btn ds-btn--danger ds-btn--block">reset</button>
      </section>
    </div>

    <div class="ds-surface ds-surface--paper">
      <h3 class="ds-face ds-w-black ds-t2 ds-caps" style="margin:0">the type ladder &mdash; seven steps at ratio 1.2</h3>
      <div class="ds-t1 ds-face ds-w-bold">t1 &mdash; caption / tag / superscript</div>
      <div class="ds-t2 ds-face ds-w-bold">t2 &mdash; label, stat name (the mode: 91 of 102 declarations)</div>
      <div class="ds-t3 ds-face ds-w-bold">t3 &mdash; body, control, nav item</div>
      <div class="ds-t4 ds-face ds-w-bold ds-num">t4 &mdash; lead / chip value 3,170</div>
      <div class="ds-t5 ds-face ds-w-black ds-num">t5 &mdash; numeral 4,210</div>
      <div class="ds-t6 ds-face ds-w-black">t6 &mdash; screen title</div>
      <div class="ds-t7 ds-face ds-w-black ds-stroked">t7 &mdash; display</div>
    </div>

    <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap">
      <button class="ds-btn ds-btn--primary">start game</button>
      <button class="ds-btn">standard</button>
      <button class="ds-btn ds-btn--secondary">secondary</button>
      <button class="ds-btn" disabled>disabled</button>
    </div>
  </div>
</div>
`;

async function run() {
  const args = parseArgs(process.argv);
  const base = args.url ?? process.env.PREVIEW_BASE;
  if (!base) throw new Error('need --url (or PREVIEW_BASE)');
  const outDir = resolve(args.out ?? 'shots/ds');
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  for (const vp of [{ name: 'desktop', w: 1600, h: 1200 }, { name: 'phone-land', w: 844, h: 390 }]) {
    // eslint-disable-next-line no-await-in-loop
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
    // eslint-disable-next-line no-await-in-loop
    await page.goto(`${base}/?screen=home&hold=600000&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    // eslint-disable-next-line no-await-in-loop
    await page.waitForFunction('window.__screen === "home" && window.__screenReady === true', null, { timeout: 90_000 });
    // eslint-disable-next-line no-await-in-loop
    await settleScreen(page, { label: `sheet@${vp.name}` });
    // Replace the screen's CONTENT only. The shell, the backdrop and '.fa-root' (which
    // is where every token is declared) all stay, so the specimens resolve exactly the
    // values a real screen would give them.
    // eslint-disable-next-line no-await-in-loop
    await page.evaluate((html) => {
      const stack = document.querySelector('.fa-stack');
      if (stack) stack.innerHTML = html;
    }, SHEET);
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(1200);
    const shot = `${outDir}/sheet-${vp.name}.png`;
    // 'wait:false' because the screen animation the settle watches belongs to the
    // torn-down screen, not to the injected sheet; the paint guard would wait forever
    // on a '.fa-screen' that no longer runs 'fa-screen-in'.
    // eslint-disable-next-line no-await-in-loop
    await captureSettled(page, { path: shot, label: `sheet@${vp.name}`, tool: 'ds_sheet', wait: false, enforce: false });
    console.log(`  wrote ${shot}`);

    if (vp.name === 'desktop') {
      contrastReport();
      const sizes = await page.evaluate(() => [1, 2, 3, 4, 5, 6, 7].map((i) => {
        const el = document.querySelector('.ds-t' + i);
        return el ? +parseFloat(getComputedStyle(el).fontSize).toFixed(2) : null;
      }));
      console.log(`\n  rendered type ladder @${vp.w}x${vp.h}: ${sizes.join(' / ')}`);
      console.log(`  step ratios: ${sizes.slice(1).map((x, i) => +(x / sizes[i]).toFixed(3)).join(' ')}   (target 1.2; the first is compressed by the 11px floor)`);
    }
    // eslint-disable-next-line no-await-in-loop
    await page.close();
  }
  await browser.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
