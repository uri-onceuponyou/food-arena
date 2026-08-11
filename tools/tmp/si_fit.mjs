#!/usr/bin/env node
/**
 * WHAT CAN EACH SITE AFFORD? — the cost of giving a glyph more delivered pixels.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * `chest` and `boxBurger` have the same signature across every round ever run:
 * **0/3 native on every arm ever drawn, 3/3 magnified.** Six drawing variables moved
 * `boxBurger` by Δ +0 each; both of `chest`'s in-file variables are spent. Two glyphs
 * failing identically at 11.0–11.8 px and passing at magnification is a DELIVERED SIZE
 * result, and the delivered size is set in `src/ui/screens/`, not in `src/ui/icons/`.
 *
 * Pooled over the two most recent native panels (r8 + r9, shipped arms only, joined to
 * `shots/ic/spec.json`'s delivered px), the population says where the floor is:
 *
 *     < 12 px   16 icons   59.8 %      14 – 17 px    4 icons   95.8 %
 *    12 – 14    11 icons   72.7 %      17 – 21       4 icons   96.7 %
 *
 * ⚠️ That is a population trend and not a controlled experiment — bigger sites may host
 * simpler glyphs. It is read as "aim for ≥16 px", never as "16 px guarantees a read".
 * `characterSelect.ts:1047` had already reached the same conclusion from the other end
 * and shipped the same mechanism: *"the glyph runs a little larger than its own text.
 * 11px was measured to be below the floor for any mark with internal structure."*
 *
 * ── What it measures, and why each number is a COST and not a decoration ────
 * Giving an icon more pixels at a text-sized site spends something. This prints what:
 *
 *   host box        the `<svg>` itself — did the change deliver the px it claims?
 *   line box        the host's height — a taller line can push a fixed-height bar
 *   ellipsis        `scrollWidth - clientWidth` on the runs that can truncate
 *                   (`.tr-nextval` is `overflow:hidden; text-overflow:ellipsis`)
 *   scroller        `.tr-inventory` and the odds sheet absorb width/height by scrolling;
 *                   a scroller that STARTS scrolling is a real cost and is reported
 *   clipping        any icon whose rect leaves its nearest clipping ancestor
 *
 *   node tools/tmp/si_fit.mjs --url <snapshot> [--css tools/tmp/si_fit.css] [--out shots/si/fit]
 *   node tools/tmp/si_fit.mjs --selftest
 *
 * ── KNOWN-BAD INPUT ────────────────────────────────────────────────────────
 * `--selftest` drives `costOf()` with synthetic rows: a free move, a move that starts an
 * ellipsis, a move that grows a fixed-height bar, and a move that clips. It must return
 * FREE / TRUNCATES / GROWS / CLIPS respectively. And on every real run the tool asserts
 * the injected sheet actually MOVED the delivered px — a candidate that changes nothing
 * would otherwise print "free" for every site, which is the same answer as "perfect".
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Every site whose delivered px is at or under the 16 px floor for `chest` or
 *  `boxBurger`, plus the two hosts that bound them from above. Taken from
 *  `ic_delivered.mjs`'s sweep, not transcribed from CSS. */
const SITES = [
  { sel: '.fa-tr .tr-odds .fa-ic', host: '.fa-tr .tr-odds', screen: 'trophies', name: 'tr-odds' },
  { sel: '.fa-tr .tr-inv-empty .fa-ic', host: '.fa-tr .tr-inv-empty', screen: 'trophies', name: 'tr-inv-empty' },
  { sel: '.fa-tr .tr-nextval .fa-ic', host: '.fa-tr .tr-nextval', screen: 'trophies', name: 'tr-nextval' },
  { sel: '.fa-tr .tr-odds-title .fa-ic', host: '.fa-tr .tr-odds-title', screen: 'trophies', name: 'tr-odds-title', needsOdds: true },
];

/** Runs that can truncate, and the boxes a taller line could burst. */
const ELLIPSIS = ['.fa-tr .tr-nextval', '.fa-tr .tr-inv-empty', '.fa-tr .tr-odds', '.fa-tr .tr-odds-title'];
const SCROLLERS = ['.fa-tr .tr-inventory', '.fa-tr .tr-sheet-scroll', '.fa-tr .tr-road'];
/** ⚠️ `.tr-nextline` WAS IN THIS LIST AND IT MADE THE TOOL SAY `GROWS` ON EVERY ROW OF
 *  ITS FIRST RUN, INCLUDING SITES ON THE OTHER SIDE OF THE SCREEN.
 *  `.tr-nextline` is the line box that CONTAINS `.tr-nextval`; growing the glyph inside
 *  it grows that line, which is the intended effect and not a cost. Because `dFixedH` is
 *  a MAX over this list and is reported per site-row, one intended growth condemned all
 *  21 rows — a verdict that is wrong in the direction that looks careful.
 *  What belongs here is only a box whose growth SPENDS SOMEONE ELSE'S SPACE: the bottom
 *  bar (a `min-height: var(--tap)` bar shared with the inventory row) and the hero
 *  (which takes its height out of the road below it). `.tr-nextline` is still measured
 *  and printed, as INFO. */
const FIXED = ['.fa-tr .tr-bottom', '.fa-tr .tr-hero'];
const INFO = ['.fa-tr .tr-nextline', '.fa-tr .tr-body'];

const VPS = [
  { w: 844, h: 390, tag: 'land' },
  { w: 1280, h: 800, tag: 'desk' },
  { w: 390, h: 844, tag: 'phone' },
];

/** The verdict for one site's move, as a pure function so `--selftest` can drive it. */
export function costOf(r) {
  if (r.clipped) return 'CLIPS';
  if (r.after.ellipsis > 0.5 && r.before.ellipsis <= 0.5) return 'TRUNCATES';
  if (r.dFixedH > 0.5) return 'GROWS';
  return 'FREE';
}

if (process.argv.includes('--selftest')) {
  const base = { clipped: false, before: { ellipsis: 0 }, after: { ellipsis: 0 }, dFixedH: 0 };
  const cases = [
    ['no cost at all', base, 'FREE'],
    ['starts an ellipsis', { ...base, after: { ellipsis: 9 } }, 'TRUNCATES'],
    ['already truncating', { ...base, before: { ellipsis: 9 }, after: { ellipsis: 12 } }, 'FREE'],
    ['bursts a fixed bar', { ...base, dFixedH: 4 }, 'GROWS'],
    ['leaves its clip', { ...base, clipped: true }, 'CLIPS'],
    ['clipping outranks truncation', { ...base, clipped: true, after: { ellipsis: 9 } }, 'CLIPS'],
    ['sub-pixel growth is not growth', { ...base, dFixedH: 0.2 }, 'FREE'],
  ];
  let bad = 0;
  for (const [n, r, want] of cases) {
    const got = costOf(r);
    if (got !== want) bad++;
    console.log(`  ${got === want ? 'ok  ' : 'FAIL'} ${n.padEnd(32)} -> ${got} (want ${want})`);
  }
  console.log(bad ? `\n${bad} SELFTEST FAILURE(S)` : `\n${cases.length}/${cases.length} selftests pass`);
  process.exit(bad ? 1 : 0);
}

const a = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[i + 1];
}
const url = (a.url ?? '').replace(/\/$/, '');
if (!url) { console.error('usage: node tools/tmp/si_fit.mjs --url <snapshot> [--css f.css] [--out shots/si/fit]'); process.exit(2); }
const out = a.out ?? 'shots/si/fit';
const cssPath = a.css ?? 'tools/tmp/si_fit.css';
const CSS = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : '';
if (!CSS.trim()) { console.error(`no candidate CSS at ${cssPath}`); process.exit(2); }

const MEASURE = ({ sites, ellipsis, scrollers, fixed }) => {
  const rect = (el) => { const b = el.getBoundingClientRect(); return { w: +b.width.toFixed(2), h: +b.height.toFixed(2), x: +b.x.toFixed(2), y: +b.y.toFixed(2) }; };
  /** The intersection of every clipping ancestor's rect — the region this node can
   *  actually be seen in. `ic_delivered.mjs` uses the same construction and says why:
   *  `elementFromPoint` is a HIT TEST, not a paint query, and `pointer-events: none`
   *  makes a painted wrapper invisible to it. */
  const clipBox = (el) => {
    let box = { l: 0, t: 0, r: innerWidth, b: innerHeight };
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.overflow === 'visible' && cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const b = n.getBoundingClientRect();
      box = { l: Math.max(box.l, b.left), t: Math.max(box.t, b.top), r: Math.min(box.r, b.right), b: Math.min(box.b, b.bottom) };
    }
    return box;
  };
  const o = { sites: {}, ellipsis: {}, scrollers: {}, fixed: {} };
  for (const s of sites) {
    const els = [...document.querySelectorAll(s.sel)];
    const hosts = [...document.querySelectorAll(s.host)];
    if (!els.length) { o.sites[s.name] = null; continue; }
    const clipped = els.some((el) => {
      const b = el.getBoundingClientRect(); const c = clipBox(el);
      return b.left < c.l - 0.5 || b.top < c.t - 0.5 || b.right > c.r + 0.5 || b.bottom > c.b + 0.5;
    });
    o.sites[s.name] = { n: els.length, px: +els[0].getBoundingClientRect().width.toFixed(2), hostH: hosts.length ? +hosts[0].getBoundingClientRect().height.toFixed(2) : null, hostW: hosts.length ? +hosts[0].getBoundingClientRect().width.toFixed(2) : null, clipped };
  }
  for (const sel of ellipsis) {
    const el = document.querySelector(sel);
    o.ellipsis[sel] = el ? +(el.scrollWidth - el.clientWidth).toFixed(2) : null;
  }
  for (const sel of scrollers) {
    const el = document.querySelector(sel);
    o.scrollers[sel] = el ? { x: +(el.scrollWidth - el.clientWidth).toFixed(2), y: +(el.scrollHeight - el.clientHeight).toFixed(2) } : null;
  }
  for (const sel of fixed) {
    const el = document.querySelector(sel);
    o.fixed[sel] = el ? rect(el).h : null;
  }
  return o;
};

const browser = await chromium.launch();
mkdirSync(resolve(out), { recursive: true });
const report = [];
let faults = 0;

for (const vp of VPS) {
  for (const openOdds of [false, true]) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    await page.goto(`${url}/?screen=trophies&hold=600000&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForFunction('window.__screen === "trophies" && window.__screenReady === true', null, { timeout: 90_000 });
    await page.waitForTimeout(1600);
    if (openOdds) {
      await page.click('[data-el="oddsbtn"]').catch(() => {});
      await page.waitForTimeout(700);
    }
    const args = { sites: SITES, ellipsis: ELLIPSIS, scrollers: SCROLLERS, fixed: [...FIXED, ...INFO] };
    const before = await page.evaluate(MEASURE, args);
    await page.screenshot({ path: resolve(out, `tr-${vp.tag}${openOdds ? '-odds' : ''}-before.png`) });

    await page.evaluate((css) => {
      const s = document.createElement('style'); s.id = 'si-fit-probe'; s.textContent = css;
      document.head.appendChild(s);
    }, CSS);
    await page.waitForTimeout(300);
    const after = await page.evaluate(MEASURE, args);
    await page.screenshot({ path: resolve(out, `tr-${vp.tag}${openOdds ? '-odds' : ''}-after.png`) });
    await page.close();

    for (const s of SITES) {
      const b = before.sites[s.name]; const f = after.sites[s.name];
      if (!b || !f) continue;
      const hostSel = ELLIPSIS.find((e) => s.host === e) ?? null;
      const dFixedH = Math.max(...FIXED.map((k) => (before.fixed[k] == null || after.fixed[k] == null ? 0 : after.fixed[k] - before.fixed[k])));
      report.push({
        vp: `${vp.tag}${openOdds ? '/odds' : ''}`, site: s.name, n: b.n,
        px: b.px, pxAfter: f.px, dPx: +(f.px - b.px).toFixed(2),
        hostH: b.hostH, hostHAfter: f.hostH,
        before: { ellipsis: hostSel ? (before.ellipsis[hostSel] ?? 0) : 0 },
        after: { ellipsis: hostSel ? (after.ellipsis[hostSel] ?? 0) : 0 },
        clipped: f.clipped && !b.clipped,
        dFixedH: +dFixedH.toFixed(2),
        scrollers: Object.fromEntries(SCROLLERS.map((k) => [k, [before.scrollers[k], after.scrollers[k]]])),
        boxes: Object.fromEntries([...FIXED, ...INFO].map((k) => [k, [before.fixed[k], after.fixed[k]]])),
      });
    }
  }
}
await browser.close();

console.log(`\nsi_fit — what each site can afford   (${url})\n  candidate: ${cssPath}\n`);
console.log('  vp          site            n   delivered px       host h        ellipsis        cost');
for (const r of report) {
  const cost = costOf(r);
  if (cost !== 'FREE') faults++;
  console.log(`  ${r.vp.padEnd(11)} ${r.site.padEnd(15)} ${String(r.n).padStart(2)}  `
    + `${String(r.px).padStart(6)} -> ${String(r.pxAfter).padStart(6)}  `
    + `${String(r.hostH).padStart(6)} -> ${String(r.hostHAfter).padStart(6)}  `
    + `${String(r.before.ellipsis).padStart(6)} -> ${String(r.after.ellipsis).padStart(6)}   ${cost}`);
}
// KNOWN-BAD GUARD: a candidate that moves nothing prints FREE everywhere, which reads
// exactly like a perfect candidate. Require the sheet to have actually moved a site.
const moved = report.filter((r) => Math.abs(r.dPx) > 0.5);
console.log(`\n  ${moved.length} of ${report.length} site-rows MOVED by >0.5 px`);
if (!moved.length) { console.log('  🔴 the candidate sheet changed NOTHING — this run measures nothing'); faults++; }

console.log('\n  boxes (height, before -> after)   [* = judged as a COST, the rest is INFO]:');
for (const k of [...FIXED, ...INFO]) {
  const rows = report.filter((r) => r.boxes[k][0] != null);
  if (!rows.length) { console.log(`    ${k.padEnd(26)} not present`); continue; }
  const uniq = [...new Set(rows.map((r) => `${r.vp}: ${r.boxes[k][0]} -> ${r.boxes[k][1]}`))];
  console.log(`    ${(FIXED.includes(k) ? '* ' : '  ') + k.padEnd(24)} ${uniq.join('   ')}`);
}

console.log('\n  scrollers (overflow x / y, before -> after):');
for (const k of SCROLLERS) {
  const rows = report.filter((r) => r.scrollers[k][0]);
  if (!rows.length) { console.log(`    ${k.padEnd(28)} not present`); continue; }
  const uniq = [...new Set(rows.map((r) => `${r.vp}: ${r.scrollers[k][0].x}/${r.scrollers[k][0].y} -> ${r.scrollers[k][1].x}/${r.scrollers[k][1].y}`))];
  console.log(`    ${k.padEnd(28)} ${uniq.join('   ')}`);
}
console.log(`\n${faults ? `${faults} NON-FREE ROW(S)` : 'every site is FREE'}`);
writeFileSync(resolve(out, 'si_fit.json'), JSON.stringify({ url, css: CSS, report }, null, 1));
process.exit(0);
