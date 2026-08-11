#!/usr/bin/env node
/**
 * THE REPRODUCIBILITY PLATE — the SHIPPED icon set, one tile per icon, N seeds.
 *
 * ── Why this exists next to `ic_pair.mjs` rather than inside it ──────────────
 * `ic_pair` answers *"is variant B better than variant A"* and structurally cannot draw
 * a plate with no variants on it: `--subject` is required and every control it runs (the
 * "variants must differ" positive control, the paired delta) is defined over variant
 * pairs. The question here is a different one and it is prior to every A/B this project
 * has ever run:
 *
 *   **How many independent panels does a PER-ICON score need before it reproduces?**
 *
 * That needs the plate held byte-identical in ART and varied only in SHUFFLE, judged by
 * many independent judges, so the two noise sources can be separated:
 *
 *   σ²_judge   two judges disagree about the same tile on the same plate
 *   σ²_plate   the same icon scores differently on a differently-shuffled plate,
 *              because in a forced-choice round a wrong answer is only available while
 *              no earlier tile has claimed it (`ic_pair.mjs` header, and `67373e5` §4:
 *              *"these four glyphs are one pool of curved-mark answers and which of them
 *              scores is largely which got there first"*)
 *
 * A judge-count derived from σ²_judge alone is the answer to the wrong question, because
 * historically an "independent panel" has always meant a NEW PLATE as well as new judges.
 *
 * ── What it draws ───────────────────────────────────────────────────────────
 * One tile per icon in the spec, plus declared `--twins` a second time with byte-identical
 * art. The twins are the round's own floor and they must BRACKET: at least one that is
 * legible (its two tiles get the same answer) and at least one that is not. That rule is
 * `ic_pair.mjs`'s, restated here because a floor measured only on legible twins reports 0
 * and does not apply to the failing subjects every icon pass is actually aimed at.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/xr_plate.mjs --url {URL} \
 *     --spec shots/ic/spec-r11.json --seeds 101,102,103 --twins gift,tomato,chest,stun \
 *     --out shots/ic/xr
 *   node tools/tmp/xr_plate.mjs --selftest
 *
 * ⚠️ EVERY PLATE IS THE SAME 63 ICONS. Only the shuffle differs. If the icon SET differed
 * between plates the between-plate term would be confounded with content and the whole
 * decomposition would be meaningless — so the tool refuses a run whose plates do not
 * carry identical name multisets.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const IS_MAIN = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

const a = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[i + 1];
}

/**
 * Build the plan the harness injects. Pure, so the selftest can drive it without a
 * browser — the shuffle happens in the page and is read back, never predicted here.
 */
export function buildPlan(names, twins, forge = new Map()) {
  const plan = [];
  for (const n of names) {
    plan.push({ name: n, twinOf: twins.includes(n) ? 1 : undefined, forgeFrom: forge.get(n) });
    if (twins.includes(n)) plan.push({ name: n, twinOf: 2 });
  }
  return plan;
}

/**
 * The multiset of names a plan draws. Two plates are comparable only if these are equal;
 * an unequal pair means the between-plate variance is confounded with content.
 */
export function nameMultiset(plan) {
  const m = new Map();
  for (const p of plan) m.set(p.name, (m.get(p.name) ?? 0) + 1);
  return [...m.entries()].sort((x, y) => x[0].localeCompare(y[0]));
}

// ── KNOWN-BAD INPUT ─────────────────────────────────────────────────────────
// CLAUDE.md #6. A plan builder that silently drops a twin, or a comparability check that
// cannot see an unequal set, is exactly the "confident wrong answer" class. Both halves:
// things that must be REFUSED and things that must be ACCEPTED.
if (IS_MAIN && 'selftest' in a) {
  let pass = 0, fail = 0;
  const check = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}  got ${JSON.stringify(got)}`);
    ok ? pass++ : fail++;
  };
  const NAMES = ['gift', 'tomato', 'chest', 'stun', 'coin'];
  const plan = buildPlan(NAMES, ['gift', 'chest']);
  // ── THE FORGERY ARM. `--forge home=lock` draws `lock`'s pixels in `home`'s tile while
  //    the key still says `home`, so a collision exists BY CONSTRUCTION. It is the
  //    known-bad input for the JUDGE POOL: a pool that reads pixels must name the SOURCE
  //    and score the tile wrong; a pool that is somehow reading position, order or the
  //    key would name `home`. CLAUDE.md #6 — the pipeline had a twin control and a
  //    row-slip control and never a control that could fail on the judges themselves.
  const forged = buildPlan(NAMES, [], new Map([['coin', 'tomato']]));
  check('a forged tile keeps the KEY name and carries the SOURCE art',
    forged.filter((p) => p.name === 'coin').map((p) => p.forgeFrom), ['tomato']);
  check('nothing else is forged', forged.filter((p) => p.forgeFrom).length, 1);
  check('an unforged plan carries no forgeFrom at all', plan.every((p) => p.forgeFrom === undefined), true);
  check('one tile per icon plus one extra per twin', plan.length, 7);
  check('each twin has BOTH flags set, or the floor is drawn and never scored',
    plan.filter((p) => p.name === 'gift').map((p) => p.twinOf), [1, 2]);
  check('a non-twin carries no flag', plan.filter((p) => p.name === 'coin').map((p) => p.twinOf ?? null), [null]);
  // The comparability predicate, both directions.
  check('identical plans are comparable',
    JSON.stringify(nameMultiset(plan)) === JSON.stringify(nameMultiset(buildPlan(NAMES, ['gift', 'chest']))), true);
  check('a plate missing an icon is REFUSED as incomparable',
    JSON.stringify(nameMultiset(plan)) === JSON.stringify(nameMultiset(buildPlan(NAMES.slice(1), ['gift', 'chest']))), false);
  check('a plate with a DIFFERENT twin set is REFUSED as incomparable',
    JSON.stringify(nameMultiset(plan)) === JSON.stringify(nameMultiset(buildPlan(NAMES, ['gift', 'tomato']))), false);
  // A shuffle must not change the multiset — that is what makes seeds comparable at all.
  const shuffled = [...plan].reverse();
  check('a reshuffle of the SAME plan is still comparable',
    JSON.stringify(nameMultiset(plan)) === JSON.stringify(nameMultiset(shuffled)), true);
  console.log(`\nxr_plate selftest ${pass} pass / ${fail} fail`);
  process.exit(fail ? 1 : 0);
}

if (!IS_MAIN) { /* imported: expose buildPlan/nameMultiset only */ } else {

const url = (a.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173').replace(/\/$/, '');
const specPath = a.spec ?? 'shots/ic/spec-r11.json';
const out = a.out ?? 'shots/ic/xr';
const seeds = (a.seeds ?? '101,102,103').split(',').map((s) => s.trim()).filter(Boolean);
const twins = (a.twins ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const cols = Number(a.cols ?? 8);
const CELL = Number(a.cell ?? 92);

const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const names = Object.keys(spec.icons);
for (const t of twins) if (!spec.icons[t]) { console.error(`--twins names "${t}", which the spec does not carry`); process.exit(2); }
if (!twins.length) { console.error('🔴 --twins is REQUIRED: a round without a measured floor cannot be quoted'); process.exit(2); }

/** `--forge home=lock,fish=egg` — see the selftest's forgery arm for why this exists. */
const forge = new Map((a.forge ?? '').split(',').filter(Boolean).map((s) => {
  const [n, src] = s.split('=');
  return [n.trim(), (src ?? '').trim()];
}));
for (const [n, src] of forge) {
  if (!spec.icons[n]) { console.error(`--forge names "${n}", which the spec does not carry`); process.exit(2); }
  if (!src) { console.error(`--forge ${n}= has no source icon`); process.exit(2); }
  if (twins.includes(n)) { console.error(`--forge ${n}: an icon cannot be both a twin control and a forgery`); process.exit(2); }
}

const plan = buildPlan(names, twins, forge);
mkdirSync(out, { recursive: true });

const { chromium } = await import('playwright');
const sharp = (await import('sharp')).default;
const browser = await chromium.launch();

/** Same measured bound as `ic_pair.mjs`. See its header for why `hard` (pixels that moved
 *  by more than one antialiasing step) is the axis and raw `pct` is only a diagnostic:
 *  identical `chest` twins measured 6.93% on `pct` while genuinely different art measured
 *  2.89%, so the ordering INVERTED on that axis. */
const SAME_ART = { hard: 1.2, aa: 24, chan: 64 };

const faults = [];
const manifest = [];
const multisets = [];

for (const seed of seeds) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1400 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(({ s, p }) => { window.__ICON_SPEC = s; window.__ICON_PLAN = p; }, { s: spec, p: plan });
  const qs = new URLSearchParams({ set: 'all', seed, cols: String(cols), cell: String(CELL) });
  const target = `${url}/tools/tmp/icon_legibility.html?${qs}`;
  await page.goto(target, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  const refused = await page.evaluate(() => window.__refused ?? null);
  if (refused) { faults.push(`seed ${seed}: the plate REFUSED to draw — ${refused}`); await page.close(); continue; }

  const declared = await page.evaluate(() => window.__declared);
  const measured = await page.evaluate(() => window.__measured);
  const shot = join(out, `p${seed}.png`);
  await page.locator('#grid').screenshot({ path: shot });
  const bb = await page.locator('#grid').boundingBox();

  // ── The twins must be the SAME ART, read off the shot rather than from intent.
  const buf = await sharp(readFileSync(shot)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const tileDiff = (d1, d2) => {
    const m1 = measured.find((x) => x.i === d1.i), m2 = measured.find((x) => x.i === d2.i);
    const w = Math.round(Math.min(m1.plateRect.w, m2.plateRect.w));
    const h = Math.round(Math.min(m1.plateRect.h, m2.plateRect.h));
    const ax = Math.round(m1.plateRect.x - bb.x), ay = Math.round(m1.plateRect.y - bb.y);
    const bx = Math.round(m2.plateRect.x - bb.x), by = Math.round(m2.plateRect.y - bb.y);
    let n = 0, hard = 0, mx = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ia = ((ay + y) * buf.info.width + ax + x) * 3;
      const ib = ((by + y) * buf.info.width + bx + x) * 3;
      let m = 0;
      for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(buf.data[ia + c] - buf.data[ib + c]));
      if (m > 0) n++;
      if (m > SAME_ART.aa) hard++;
      if (m > mx) mx = m;
    }
    return { pct: +(100 * n / (w * h)).toFixed(2), hard: +(100 * hard / (w * h)).toFixed(2), chan: mx };
  };
  const twinRows = [];
  for (const n of twins) {
    const ts = declared.filter((d) => d.name === n);
    if (ts.length !== 2) { faults.push(`seed ${seed}: ${n} drew ${ts.length} tiles, expected 2`); continue; }
    if (!ts.every((t) => t.twinOf)) faults.push(`seed ${seed}: ${n} twin tiles reached the key UNFLAGGED — the floor would be drawn and never scored`);
    const d = tileDiff(ts[0], ts[1]);
    const same = d.hard <= SAME_ART.hard && d.chan <= SAME_ART.chan;
    twinRows.push(`${n} #${ts[0].i}/#${ts[1].i}  ${d.hard}% hard (${d.pct}% any), max chan ${d.chan}  ${same ? 'SAME' : '← 🔴 DIFFER'}`);
    if (!same) faults.push(`seed ${seed}: ${n} twins are NOT the same art (${d.hard}% hard, chan ${d.chan})`);
  }

  const finalPlan = declared.map((d) => ({ i: d.i, name: d.name, twin: d.twinOf ?? null, forgeFrom: d.forgeFrom ?? null, px: d.px, bg: d.bg, outline: d.outline }));
  // A forgery that did not reach the page is a control that was never run, and it would
  // read as "the judges got it right", i.e. as a PASS. Checked from the rendered DOM.
  for (const [n, src] of forge) {
    const d = declared.find((x) => x.name === n);
    if (!d) faults.push(`seed ${seed}: forged icon ${n} is not on the plate`);
    else if (d.forgeFrom !== src) faults.push(`seed ${seed}: ${n} came back with forgeFrom=${d.forgeFrom}, expected ${src} — the forgery did not reach the page`);
  }
  multisets.push([seed, JSON.stringify(nameMultiset(finalPlan))]);
  writeFileSync(join(out, `p${seed}.key.json`), JSON.stringify({
    url: target, seed, plate: shot, mode: 'plain', spec: specPath, twins,
    forge: Object.fromEntries(forge),
    plan: finalPlan, tiles: declared.map((d) => ({ i: d.i, name: d.name })),
  }, null, 2) + '\n');
  manifest.push({ seed, plate: shot, tiles: declared.length, w: Math.round(bb.width), h: Math.round(bb.height) });
  console.log(`seed ${seed}  ${shot}  ${Math.round(bb.width)}x${Math.round(bb.height)}  ${declared.length} tiles`);
  for (const r of twinRows) console.log(`   twin  ${r}`);
  if (errs.length) faults.push(`seed ${seed}: console errors — ${errs.join(' | ')}`);
  await page.close();
}

// ── COMPARABILITY. Different plates must be the SAME icons in a different order.
const distinct = new Set(multisets.map(([, m]) => m));
if (distinct.size > 1) faults.push(`the ${seeds.length} plates do not carry identical name multisets — the between-plate term would be confounded with CONTENT`);

// ── SHUFFLE. Two seeds that produce the SAME order are one plate drawn twice, and would
//    report a between-plate variance of zero for a reason that has nothing to do with
//    icons. Checked rather than assumed.
const orders = manifest.map(({ seed }) => JSON.parse(readFileSync(join(out, `p${seed}.key.json`), 'utf8')).plan.map((p) => p.name).join(','));
for (let i = 0; i < orders.length; i++) for (let j = i + 1; j < orders.length; j++) {
  if (orders[i] === orders[j]) faults.push(`seeds ${seeds[i]} and ${seeds[j]} produced the SAME tile order — they are one plate, not two`);
}

writeFileSync(join(out, 'manifest.json'), JSON.stringify({ spec: specPath, twins, seeds, plates: manifest }, null, 2) + '\n');
await browser.close();
if (faults.length) { console.log('\n🔴 PLATE SET INVALID:\n  ' + faults.join('\n  ')); process.exit(1); }
console.log(`\n✅ ${seeds.length} plates, identical icon multiset, distinct orders, every twin pair byte-identical to the measured bound.`);

}
