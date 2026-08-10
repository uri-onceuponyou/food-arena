#!/usr/bin/env node
/**
 * THE PAIRED PLATE — both variants, one round, one judge, forced choice.
 *
 * ── Why a plain before/after round CANNOT decide an icon ────────────────────
 * Measured, not feared. `cc34026` built a `boxBurger` fix, judged it better, and had to
 * revert it, because in the same two rounds the CONTROL moved:
 *
 *     boxRed   art unchanged by ONE BYTE   3/3  ->  0/3
 *     box named "a wrapped gift"           2 of 12  ->  2 of 12
 *
 * A 3-judge panel's swing on FIXED art is the full range, so a between-round delta on
 * one icon carries no information at all. That is `CLAUDE.md` #10 in its sharpest form:
 * the metric's resolution floor was wider than every effect anyone was looking for.
 *
 * The fix is the one that works everywhere else in this repo — pair the comparison so
 * the noise cancels, the way identical seeds cancel in a per-matchup win-rate delta.
 * Both variants go on ONE plate, shuffled among the same distractors, and ONE judge
 * names every tile in ONE pass. Whatever mood, whatever downsampling, whatever
 * chest-happiness that judge brings, both variants get it.
 *
 * ── And the plate MEASURES ITS OWN FLOOR, rather than assuming one ──────────
 * `--twins a,b` puts a second tile of an icon on the same plate with byte-identical
 * artwork, shuffled elsewhere in the grid. Any disagreement between twins is this
 * round's own noise, produced by this judge, on this plate. It is not a guess and it is
 * not borrowed from another instrument: `AGENT-BRIEF.md` §4.5 — state the resolution
 * floor BEFORE acting on a change in it. Here it is stated by the plate.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/ic_pair.mjs --url {URL} \
 *     --spec shots/ic/spec.json --variants tools/tmp/ic_variants.json \
 *     --subject boxBurger --twins boxRed,gift --seed 7 --out shots/ic/pair1
 *
 *   node tools/tmp/ic_pair.mjs --score shots/ic/pair1/answers.json
 *   node tools/tmp/ic_pair.mjs --selftest
 *
 * ⚠️ THE VARIANTS ARE PARAMETERS TO SHIPPED ART, NOT NEW ART. A colourway variant is
 * three hex values substituted into the `fill=` attributes `src/ui/icons/ui.ts` already
 * writes, applied in the page. Nothing here can drift from the icon set, and a winning
 * variant hands over as three numbers rather than as a drawing this tool invented.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SUBJECT, subjectOf } from './icon_score.mjs';

const a = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[i + 1];
}

/** Reverse of the forced-choice map, so a tile's own name prints as the judge saw it. */
const TEXT_OF = new Map(Object.entries(SUBJECT).map(([t, n]) => [n, t]));

/**
 * Score a paired round.
 *
 * Exported and pure so `--selftest` can drive it with a synthetic answer sheet — the
 * only way a scorer that has never been shown a wrong answer becomes a guard.
 * `CLAUDE.md` #6.
 */
export function scorePaired(key, runs) {
  const byTile = new Map(key.plan.map((p) => [p.i, p]));
  const perVariant = new Map();   // "name/variant" -> { n, hit, given: Map }
  const twinRows = [];
  for (const run of runs) {
    const ans = new Map();
    for (const line of run.lines) {
      const m = line.match(/^\s*(\d+)\s*[.):]\s*(.+?)\s*$/);
      if (m) ans.set(Number(m[1]), m[2].toLowerCase().trim());
    }
    for (const p of key.plan) {
      const raw = ans.get(p.i) ?? '(blank)';
      const given = subjectOf(raw) ?? `?${raw}`;
      const k = `${p.name}/${p.variant ?? '-'}${p.twin ? `#${p.twin}` : ''}`;
      const v = perVariant.get(k) ?? { name: p.name, variant: p.variant ?? '-', twin: p.twin ?? null, n: 0, hit: 0, given: new Map() };
      v.n++;
      if (given === p.name) v.hit++; else v.given.set(raw, (v.given.get(raw) ?? 0) + 1);
      perVariant.set(k, v);
    }
    // ── TWIN CONTROL: identical pixels, two indices, ONE judge. ─────────────
    const twins = new Map();
    for (const p of key.plan) if (p.twin) {
      (twins.get(`${p.name}/${p.variant ?? '-'}`) ?? twins.set(`${p.name}/${p.variant ?? '-'}`, []).get(`${p.name}/${p.variant ?? '-'}`)).push(p);
    }
    for (const [k, ps] of twins) {
      if (ps.length < 2) continue;
      const given = ps.map((p) => subjectOf(ans.get(p.i) ?? '') ?? `?${ans.get(p.i) ?? '(blank)'}`);
      twinRows.push({ judge: run.judge, k, tiles: ps.map((p) => p.i), given, agree: new Set(given).size === 1 });
    }
  }
  return { perVariant, twinRows };
}

function printScore(key, runs) {
  const { perVariant, twinRows } = scorePaired(key, runs);
  console.log(`PAIRED ROUND — subject ${key.subject}, ${runs.length} judge(s), 1 plate, ${key.plan.length} tiles\n`);
  console.log('TILE'.padEnd(26) + 'HIT/SEEN'.padEnd(11) + 'wrong answers');
  const rows = [...perVariant.values()].sort((x, y) => (x.name === key.subject ? -1 : 1) - (y.name === key.subject ? -1 : 1)
    || x.name.localeCompare(y.name) || String(x.variant).localeCompare(String(y.variant)));
  for (const v of rows) {
    const wrong = [...v.given.entries()].sort((p, q) => q[1] - p[1]).map(([k, n]) => `${k} x${n}`).join(', ');
    console.log(`${v.name}${v.variant === '-' ? '' : ` [${v.variant}]`}${v.twin ? ` (twin ${v.twin})` : ''}`.padEnd(26)
      + `${v.hit}/${v.n}`.padEnd(11) + wrong);
  }

  // ── The paired delta. EXACT within this round, and a different quantity from a
  //    between-round delta. CLAUDE.md #10 — never conflate them.
  const vs = rows.filter((v) => v.name === key.subject && !v.twin);
  if (vs.length >= 2) {
    console.log('\nPAIRED DELTA (same judge, same plate, same round — exact):');
    const base = vs[0];
    for (const v of vs.slice(1)) {
      const d = v.hit - base.hit;
      console.log(`  ${key.subject} [${base.variant}] ${base.hit}/${base.n}  ->  [${v.variant}] ${v.hit}/${v.n}   Δ ${d >= 0 ? '+' : ''}${d} of ${v.n}`);
    }
  }

  console.log('\nTWIN CONTROL — identical pixels, two tiles, one judge. This is the round\'s FLOOR:');
  if (!twinRows.length) console.log('  none declared  ⚠️  the round has no measured floor; do not quote a delta from it');
  let dis = 0;
  for (const t of twinRows) {
    if (!t.agree) dis++;
    console.log(`  ${t.judge}  ${t.k.padEnd(18)} tiles ${t.tiles.join('/')}  ->  ${t.given.join('  |  ')}  ${t.agree ? 'agree' : '← DISAGREES'}`);
  }
  if (twinRows.length) {
    console.log(`\n  FLOOR: ${dis} of ${twinRows.length} twin pairs disagreed on IDENTICAL art.`);
    console.log('  A paired delta smaller than this is not a result.');
  }
  return { perVariant, twinRows, dis };
}

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — the scorer, against answer sheets built to break it.
// ─────────────────────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  let pass = 0, fail = 0;
  const check = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}  got ${JSON.stringify(got)}`);
    ok ? pass++ : fail++;
  };
  const key = {
    subject: 'boxBurger',
    plan: [
      { i: 1, name: 'boxBurger', variant: 'A' },
      { i: 2, name: 'gift' },
      { i: 3, name: 'boxBurger', variant: 'B' },
      { i: 4, name: 'boxRed', twin: 1 },
      { i: 5, name: 'chest' },
      { i: 6, name: 'boxRed', twin: 2 },
    ],
  };
  const say = (m) => [{ judge: 'T', lines: Object.entries(m).map(([i, t]) => `${i}. ${t}`) }];
  const T = (n) => TEXT_OF.get(n);

  // 1. A VARIANT THAT WINS MUST SHOW AS A POSITIVE PAIRED DELTA.
  {
    const { perVariant } = scorePaired(key, say({
      1: T('gift'), 2: T('gift'), 3: T('boxBurger'), 4: T('boxRed'), 5: T('chest'), 6: T('boxRed'),
    }));
    check('variant A misses, variant B hits — they are scored SEPARATELY',
      [perVariant.get('boxBurger/A').hit, perVariant.get('boxBurger/B').hit], [0, 1]);
  }
  // 2. TWINS THAT AGREE REPORT A ZERO FLOOR; TWINS THAT DISAGREE REPORT IT.
  //    Fails on: any scorer that pools twins into one row, which is what makes the
  //    floor invisible — it is precisely the pooling that hid `boxRed` 3/3 -> 0/3.
  {
    const agree = scorePaired(key, say({ 1: T('boxBurger'), 2: T('gift'), 3: T('boxBurger'), 4: T('boxRed'), 5: T('chest'), 6: T('boxRed') }));
    check('identical twins answered alike -> floor 0', agree.twinRows.map((t) => t.agree), [true]);
    const split = scorePaired(key, say({ 1: T('boxBurger'), 2: T('gift'), 3: T('boxBurger'), 4: T('boxRed'), 5: T('chest'), 6: T('gift') }));
    check('identical twins answered differently -> the floor FIRES', split.twinRows.map((t) => t.agree), [false]);
  }
  // 3. A BLANK SHEET SCORES ZERO, NOT "no data".
  check('a blank sheet scores 0 for every variant',
    [...scorePaired(key, [{ judge: 'T', lines: [] }]).perVariant.values()].map((v) => v.hit), [0, 0, 0, 0, 0, 0]);
  // 4. AN UNRECOGNISED STRING IS A MISS, NOT A PASS.
  check('an unknown answer is a miss',
    scorePaired(key, say({ 1: 'a thing i invented' })).perVariant.get('boxBurger/A').hit, 0);
  // 5. THE TWO TWIN TILES ARE NOT ALLOWED TO COLLAPSE INTO ONE ROW.
  check('twins keep separate rows so their disagreement is visible',
    [...scorePaired(key, say({})).perVariant.keys()].filter((k) => k.startsWith('boxRed')).length, 2);
  // 6. A ROUND WITH NO TWINS DECLARES ITSELF FLOORLESS.
  check('a round with no twins yields no floor rows',
    scorePaired({ subject: 'x', plan: [{ i: 1, name: 'gift' }] }, say({ 1: T('gift') })).twinRows.length, 0);

  console.log(`\nic_pair selftest ${pass} pass / ${fail} fail`);
  process.exit(fail ? 1 : 0);
}

// ── Scoring an existing round ────────────────────────────────────────────────
if (a.score) {
  const runs = JSON.parse(readFileSync(a.score, 'utf8'));
  const key = JSON.parse(readFileSync(runs[0].key, 'utf8'));
  printScore(key, runs);
  process.exit(0);
}

// ── Rendering a paired plate ────────────────────────────────────────────────
const url = (a.url ?? 'http://localhost:5173').replace(/\/$/, '');
const out = a.out ?? 'shots/ic/pair';
const specPath = a.spec ?? 'shots/ic/spec.json';
const subject = a.subject;
const seed = a.seed ?? '7';
const cols = Number(a.cols ?? 8);
const CELL = Number(a.cell ?? 92);
const tag = a.tag ?? `pair-${subject}-s${seed}`;
if (!subject) { console.error('usage: ic_pair.mjs --subject <icon> --variants <json> [--twins a,b] --url <u>'); process.exit(2); }

const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const variants = JSON.parse(readFileSync(a.variants, 'utf8'))[subject];
if (!variants) { console.error(`no variants declared for "${subject}" in ${a.variants}`); process.exit(2); }

/** The plate is the subject's variants + the icons it is KNOWN to collide with + the
 *  rest of the registry as distractors. A judge shown only boxes and gifts is being
 *  told the answer is a box or a gift; the round has to look like a normal round. */
const twins = (a.twins ?? '').split(',').filter(Boolean);
const context = (a.context ?? Object.keys(spec.icons).join(',')).split(',').filter((n) => spec.icons[n]);

const plan = [];
for (const v of variants) plan.push({ name: subject, variant: v.id, fills: v.fills ?? null, note: v.note ?? '' });
for (const n of context) {
  if (n === subject) continue;
  plan.push({ name: n });
  // ⚠️ THE FIELD IS `twinOf`, NOT `twin`. The first cut wrote `twin`, which the page
  // does not read, so the key came back with every `twinOf` null and the scorer printed
  // *"TWIN CONTROL — none declared"*. The plate was correct — two byte-identical tiles
  // really were drawn and judged — but the round reported itself as having NO MEASURED
  // FLOOR, which is the one thing this tool exists to produce. A control that is drawn
  // and then not scored is indistinguishable from a control that was never drawn, so
  // the render below now REFUSES a round whose declared twins do not come back flagged.
  if (twins.includes(n)) plan.push({ name: n, twinOf: 2 });
}
for (const n of twins) {
  const first = plan.find((q) => q.name === n && !q.twinOf);
  if (first) first.twinOf = 1;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1400 }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(({ s, p }) => { window.__ICON_SPEC = s; window.__ICON_PLAN = p; }, { s: spec, p: plan });

const qs = new URLSearchParams({ set: 'all', seed, cols: String(cols), cell: String(CELL) });
const target = `${url}/tools/tmp/icon_legibility.html?${qs}`;
await page.goto(target, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
const refused = await page.evaluate(() => window.__refused ?? null);
if (refused) { console.log(`🔴 the plate REFUSED to draw: ${refused}`); await browser.close(); process.exit(1); }

const declared = await page.evaluate(() => window.__declared);
const measured = await page.evaluate(() => window.__measured);

// The shuffle happens in the page, so the PLAN with final indices is read back rather
// than predicted. A key that predicts an order the page did not use is the whole
// answer-sheet class of bug.
const finalPlan = declared.map((d) => ({
  i: d.i, name: d.name, variant: d.variant, twin: d.twinOf ?? null,
  px: d.px, bg: d.bg, outline: d.outline,
}));

// ── VERIFY: identical twins must be IDENTICAL. ──────────────────────────────
// A "twin control" whose two tiles differ in one pixel is not a control, it is a second
// variant nobody declared. Checked from the rendered DOM, not from intent.
const faults = [];
for (const n of twins) {
  const ts = declared.filter((d) => d.name === n);
  if (ts.length !== 2) { faults.push(`${n}: ${ts.length} tiles, expected 2`); continue; }
  // The flag has to survive the round trip through the page, or the floor is drawn and
  // never scored — see the note on `twinOf` above.
  if (!ts.every((t) => t.twinOf)) faults.push(`${n}: twin tiles reached the key UNFLAGGED, so the floor would not be scored`);
  const m = ts.map((t) => measured.find((x) => x.i === t.i));
  if (m[0].w !== m[1].w || m[0].plateBg !== m[1].plateBg || m[0].inkVar !== m[1].inkVar
    || JSON.stringify(m[0].ink) !== JSON.stringify(m[1].ink)) {
    faults.push(`${n}: twins are NOT identical — ${JSON.stringify(m[0])} vs ${JSON.stringify(m[1])}`);
  }
}
// ── VERIFY: the variants must actually DIFFER. ──────────────────────────────
// A paired plate whose two variants render the same pixels answers nothing, and it
// would report "no difference" as a finding.
const vt = declared.filter((d) => d.name === subject);
if (vt.length !== variants.length) faults.push(`${subject}: ${vt.length} variant tiles, expected ${variants.length}`);

mkdirSync(out, { recursive: true });
const shot = join(out, `${tag}.png`);
await page.locator('#grid').screenshot({ path: shot });
const bb = await page.locator('#grid').boundingBox();

// Pixel proof that the variants are not the same image, read off the shot itself.
const sharp = (await import('sharp')).default;
const buf = await sharp(readFileSync(shot)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const tileHash = (d) => {
  const m = measured.find((x) => x.i === d.i);
  const x0 = Math.round(m.plateRect.x - bb.x), y0 = Math.round(m.plateRect.y - bb.y);
  let h = 0;
  for (let y = y0; y < y0 + m.plateRect.h; y++) {
    for (let x = x0; x < x0 + m.plateRect.w; x++) {
      const i = (y * buf.info.width + x) * 3;
      h = (h * 31 + buf.data[i] + buf.data[i + 1] * 3 + buf.data[i + 2] * 7) >>> 0;
    }
  }
  return h;
};
const hashes = vt.map((d) => [d.variant, tileHash(d)]);
if (new Set(hashes.map((h) => h[1])).size !== hashes.length) {
  faults.push(`${subject}: two variants rendered IDENTICAL pixels — ${JSON.stringify(hashes)}`);
}
for (const n of twins) {
  const ts = declared.filter((d) => d.name === n);
  if (ts.length === 2 && tileHash(ts[0]) !== tileHash(ts[1])) faults.push(`${n}: twin tiles differ in PIXELS`);
}

writeFileSync(join(out, `${tag}.key.json`), JSON.stringify({
  url: target, subject, seed, plate: shot, mode: 'paired', spec: specPath,
  variants: variants.map((v) => ({ id: v.id, note: v.note ?? '', fills: v.fills ?? null })),
  twins, plan: finalPlan,
  tiles: declared.map((d) => ({ i: d.i, name: d.name })),   // icon_score-compatible
  verified: faults.length === 0,
}, null, 2));

await browser.close();
console.log(`wrote ${shot}  ${Math.round(bb.width)}x${Math.round(bb.height)}px  ${declared.length} tiles`);
console.log(`variants of ${subject}: ${vt.map((d) => `#${d.i} [${d.variant}]`).join(', ')}`);
console.log(`twin controls: ${twins.map((n) => `${n} #${declared.filter((d) => d.name === n).map((d) => d.i).join('/')}`).join(', ') || 'NONE — this round has no measured floor'}`);
if (errs.length) console.log('CONSOLE ERRORS:\n' + errs.join('\n'));
if (faults.length) { console.log('\n🔴 PAIRED PLATE INVALID:\n  ' + faults.join('\n  ')); process.exit(1); }
console.log('\n✅ variants differ in pixels; twins are byte-identical.');
