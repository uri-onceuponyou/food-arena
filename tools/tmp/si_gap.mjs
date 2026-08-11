#!/usr/bin/env node
/**
 * WHAT DOES THE SHADOWED `gap: 1px` ACTUALLY BUY? — the measurement before the decision.
 *
 * ── The question, and why "move it below the 560 block" is not the obvious answer ──
 * `dc_guard` reports two CASCADE faults in `characterSelect.ts`, and they are one
 * declaration in longhand:
 *
 *     :1136  @media (max-height: 460px) { .fa-chars .chars-stats { gap: 1px } }
 *     :1195  @media (max-height: 560px) { .fa-chars .chars-stats { flex-direction: row;
 *                                                                  gap: var(--ds-s1) } }
 *
 * A media query adds no specificity, so at ≤460 both match and the later block wins:
 * delivered 3px against a declared 1px. The file has already solved this trap once
 * (`:1219`, placed BELOW the 560 block on purpose), so the reflex is to move this one
 * below too.
 *
 * 🔴 THAT REFLEX IS WRONG UNTIL MEASURED, BECAUSE THE AXIS TURNED UNDER THE DECLARATION.
 * The base rule is `flex-direction: column`. `gap: 1px` was authored FOR THAT COLUMN —
 * its own block's comment bills it in VERTICAL pixels ("the notched landscape budget",
 * "the first ability row's BOX cut by 16.39px"). The 560 block turns the same element
 * into `flex-direction: row`, so at ≤460 the surviving axis is HORIZONTAL. A 1px
 * horizontal gap between three stat tiles does not buy one pixel of the budget the
 * declaration was written to pay.
 *
 * So this tool asks the only question that decides it: measured on the real screen, at
 * the viewports where both queries are live, what moves when the gap goes 3px -> 1px?
 *
 *   VERTICAL   `.chars-stats` height, `.chars-detail` overflow, and the first ability
 *              row's clearance — the D3 budget, the thing the 1px was written to buy.
 *   HORIZONTAL each `.chars-stat` cell width, and whether any `.ds-row-label` is
 *              actually truncating (the D2 defect, which the 560 block already paid for
 *              once with `letter-spacing: var(--ds-track-tight)`).
 *
 * ⚠️ The delta is taken by MUTATING THE LIVE RULE, not by editing the file — same page,
 * same fonts, same layout pass, one variable. `getComputedStyle` is read back after the
 * mutation so the tool proves it changed the thing it names rather than assuming it.
 *
 *   node tools/tmp/si_gap.mjs --url <snapshot> [--out shots/si/gap]
 *
 * KNOWN-BAD INPUT (`--selftest`, offline): `decide()` is fed three synthetic outcomes —
 * a purely-horizontal move, a move with real vertical relief, and a move that truncates
 * a label — and must return DELETE, KEEP and REJECT respectively. A tool whose verdict
 * function has only ever seen the real data cannot be shown to discriminate.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Viewports where BOTH `(max-height: 460px)` and `(max-height: 560px)` are live.
 *  844x390 is the tightest supported screen and the one `ud_defects` measured D3 on;
 *  852x393 is the other landscape phone in `menu_accept`'s list; 852x460 is the
 *  viewport `dc_guard` derives from the loser's own condition bound. */
const VPS = [
  { w: 844, h: 390 },
  { w: 852, h: 393 },
  { w: 852, h: 460 },
];

/**
 * The verdict, as a pure function of the measured move, so `--selftest` can drive it.
 *
 * DELETE  the move is horizontal-only — no vertical relief anywhere — so the
 *         declaration cannot pay the budget it was authored for and re-ordering it
 *         would ship a 1px horizontal gap nobody asked for.
 * KEEP    it buys real vertical space; move it BELOW the 560 block, the way `:1219`
 *         already does.
 * REJECT  applying it makes something worse (a label starts truncating). Delete, and
 *         say what would have broken.
 */
export function decide(m) {
  const vertical = m.some((r) => r.dStatsH < -0.5 || r.dDetailOverflow < -0.5 || r.dAbilityClear > 0.5);
  const truncates = m.some((r) => r.after.labelOverflow > 0.5 && r.before.labelOverflow <= 0.5);
  if (truncates) return 'REJECT';
  if (vertical) return 'KEEP';
  return 'DELETE';
}

if (process.argv.includes('--selftest')) {
  const base = { dStatsH: 0, dDetailOverflow: 0, dAbilityClear: 0, before: { labelOverflow: 0 }, after: { labelOverflow: 0 } };
  const cases = [
    ['horizontal-only', [{ ...base }], 'DELETE'],
    ['buys 4px of stats height', [{ ...base, dStatsH: -4 }], 'KEEP'],
    ['buys ability clearance', [{ ...base, dAbilityClear: 3.2 }], 'KEEP'],
    ['buys overflow relief', [{ ...base, dDetailOverflow: -9 }], 'KEEP'],
    ['starts truncating a label', [{ ...base, after: { labelOverflow: 2.1 } }], 'REJECT'],
    ['truncation beats vertical', [{ ...base, dStatsH: -4, after: { labelOverflow: 2.1 } }], 'REJECT'],
    ['already truncating, unchanged', [{ ...base, before: { labelOverflow: 3 }, after: { labelOverflow: 3 } }], 'DELETE'],
    ['sub-floor vertical is not vertical', [{ ...base, dStatsH: -0.2 }], 'DELETE'],
  ];
  let bad = 0;
  for (const [name, m, want] of cases) {
    const got = decide(m);
    const ok = got === want;
    if (!ok) bad++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(34)} -> ${got} (want ${want})`);
  }
  console.log(bad ? `\n${bad} SELFTEST FAILURE(S)` : `\n${cases.length}/${cases.length} selftests pass`);
  process.exit(bad ? 1 : 0);
}

const a = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[i + 1];
}
const url = (a.url ?? '').replace(/\/$/, '');
if (!url) { console.error('usage: node tools/tmp/si_gap.mjs --url <snapshot> [--out shots/si/gap]'); process.exit(2); }
const out = a.out ?? 'shots/si/gap';

/** One page-side read. Everything the verdict needs, in one layout pass. */
const MEASURE = () => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: +b.x.toFixed(2), y: +b.y.toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2) }; };
  const stats = document.querySelector('.fa-chars .chars-stats');
  const detail = document.querySelector('.fa-chars .chars-detail');
  const ability = document.querySelector('.fa-chars .chars-ability');
  if (!stats || !detail) return { error: 'no .chars-stats / .chars-detail' };
  const cs = getComputedStyle(stats);
  const cells = [...stats.querySelectorAll('.chars-stat')].map(r);
  // D2: a label that has to be ellipsised. `scrollWidth - clientWidth` is the run that
  // does not fit; it is 0 when the text fits, whatever the ellipsis rule says.
  const labels = [...stats.querySelectorAll('.ds-row-label')].map((el) => ({
    text: el.textContent.trim(),
    over: +(el.scrollWidth - el.clientWidth).toFixed(2),
    w: +el.getBoundingClientRect().width.toFixed(2),
  }));
  const dRect = r(detail);
  return {
    gapDelivered: `${cs.rowGap} / ${cs.columnGap}`,
    flexDirection: cs.flexDirection,
    flexWrap: cs.flexWrap,
    stats: r(stats),
    cells,
    labels,
    labelOverflow: Math.max(0, ...labels.map((l) => l.over)),
    // Vertical budget, three ways.
    detailOverflow: +(detail.scrollHeight - detail.clientHeight).toFixed(2),
    detail: dRect,
    // D3: how much of the FIRST ability row's box clears the panel's own bottom edge.
    // Positive = the whole row is inside; negative = it is being sliced.
    abilityClear: ability ? +((dRect.y + dRect.h) - (r(ability).y + r(ability).h)).toFixed(2) : null,
    ability: ability ? r(ability) : null,
  };
};

const browser = await chromium.launch();
mkdirSync(resolve(out), { recursive: true });
const rows = [];
for (const vp of VPS) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
  await page.goto(`${url}/?screen=characters&hold=600000&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction('window.__screen === "characters" && window.__screenReady === true', null, { timeout: 90_000 });
  await page.waitForTimeout(1800);

  const before = await page.evaluate(MEASURE);
  await page.screenshot({ path: resolve(out, `chars-${vp.w}x${vp.h}-gap3.png`) });

  // ── THE ONE VARIABLE. Injected as its own sheet so the delivered value is what a
  //    re-ordered 460 block would deliver, and read BACK so the tool proves it moved.
  await page.evaluate(() => {
    const s = document.createElement('style');
    s.id = 'si-gap-probe';
    s.textContent = '@media (max-height: 460px) { .fa-chars .chars-stats { gap: 1px; } }';
    document.head.appendChild(s);
  });
  await page.waitForTimeout(250);
  const after = await page.evaluate(MEASURE);
  await page.screenshot({ path: resolve(out, `chars-${vp.w}x${vp.h}-gap1.png`) });
  await page.close();

  rows.push({
    vp: `${vp.w}x${vp.h}`, before, after,
    dStatsH: +(after.stats.h - before.stats.h).toFixed(2),
    dStatsW: +(after.stats.w - before.stats.w).toFixed(2),
    dCellW: +(after.cells[0].w - before.cells[0].w).toFixed(2),
    dDetailOverflow: +(after.detailOverflow - before.detailOverflow).toFixed(2),
    dAbilityClear: after.abilityClear === null || before.abilityClear === null
      ? 0 : +(after.abilityClear - before.abilityClear).toFixed(2),
  });
}
await browser.close();

let faults = 0;
console.log(`\nsi_gap — what the shadowed \`gap: 1px\` would buy   (${url})\n`);
for (const r of rows) {
  const b = r.before; const f = r.after;
  console.log(`── ${r.vp} ──  direction ${b.flexDirection}, wrap ${b.flexWrap}`);
  console.log(`   delivered gap   ${b.gapDelivered}   ->   ${f.gapDelivered}`);
  if (b.gapDelivered === f.gapDelivered) { console.log('   🔴 THE PROBE DID NOT CHANGE THE GAP — this run measures nothing'); faults++; }
  console.log(`   .chars-stats    ${b.stats.w} x ${b.stats.h}   ->   ${f.stats.w} x ${f.stats.h}      Δh ${r.dStatsH}   Δw ${r.dStatsW}`);
  console.log(`   stat cell w     ${b.cells.map((c) => c.w).join(' / ')}   ->   ${f.cells.map((c) => c.w).join(' / ')}      Δ ${r.dCellW}`);
  console.log(`   label overflow  ${b.labels.map((l) => `${l.text}:${l.over}`).join('  ')}   ->   ${f.labels.map((l) => `${l.text}:${l.over}`).join('  ')}`);
  console.log(`   detail overflow ${b.detailOverflow}   ->   ${f.detailOverflow}      Δ ${r.dDetailOverflow}`);
  console.log(`   ability clear   ${b.abilityClear}   ->   ${f.abilityClear}      Δ ${r.dAbilityClear}\n`);
}
const verdict = decide(rows);
console.log(`VERDICT: ${verdict}`);
console.log({
  DELETE: '  the move is HORIZONTAL-ONLY. The declaration cannot pay the vertical budget\n'
    + '  its own block bills it against, so re-ordering it would ship a narrower gap that\n'
    + '  buys nothing the author asked for. Delete it and keep the reason.',
  KEEP: '  it buys real vertical space — move it BELOW the 560 block, like :1219.',
  REJECT: '  applying it truncates a label that fits today. Delete it.',
}[verdict]);

writeFileSync(resolve(out, 'si_gap.json'), JSON.stringify({ url, rows, verdict }, null, 1));
process.exit(faults ? 1 : 0);
