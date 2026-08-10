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
 * ⚠️ A COLOURWAY VARIANT IS PARAMETERS TO SHIPPED ART. `fills` substitutes hex values
 * into the `fill=` attributes `src/ui/icons/*.ts` already writes, so it cannot drift
 * from the icon set and a winner hands over as three numbers.
 *
 * ── AND THAT WAS NOT ENOUGH, BECAUSE THE ANSWER WAS "COLOUR IS NOT THE LEVER" ────
 * `a77ff30` ran the `boxBurger` colourway question this file was built for and got
 * **Δ = 0 of 3 across three colourways, twin floor clean** — every judge gave all three
 * the same answer. A tool that can only vary colour cannot ask the next question, which
 * is geometric: boxBurger is the only box whose clasp contrasts more with its LID than
 * its FRONT, and at 11.83 px it has no visible lid at all.
 *
 * So a variant may also carry `svg` — replacement markup for the glyph's interior, the
 * mechanism `icon_legibility.html` already had for `--forgery`. That IS new art, and the
 * honesty property `fills` got for free now has to be earned back on hand-over:
 *
 *   `--handover coin=B,medal=B` asserts that the icon's SHIPPED tile and the named
 *   variant tile render BYTE-IDENTICAL PIXELS. Run it after pasting a winner into
 *   `src/ui/icons/`: if the paste drifted by one coordinate, the hashes differ and the
 *   render exits 1. A variant that won and a variant that shipped are then the same
 *   drawing by measurement rather than by care.
 *
 * `--subject a,b,c` puts several independent A/B questions on ONE plate. Each is scored
 * only against its own tiles and one judge's mood cancels for every subject at once.
 *
 * 🚨 BUT THEY ARE NOT INDEPENDENT, AND THAT WAS MEASURED THE FIRST TIME IT WAS TRIED.
 * A PAIRED PLATE CANCELS THE JUDGE. IT DOES NOT CANCEL THE PLATE'S OWN COMPOSITION.
 * In a forced-choice round a wrong answer is only available while no tile has claimed it.
 * `egg` had scored 0/3 named "a gold coin" x3; on a plate that also carried a REDRAWN
 * coin that is unmistakably a coin, `egg` scored 3/3 in BOTH arms and its Δ was measured
 * against a ceiling that the round itself had created. The finding stands (Δ +0, do not
 * ship) but the round could not have shown a gain.
 * → **Do not put a subject on the same plate as a fix to the thing it is mistaken for.**
 * Measure it against an UNCHANGED field, or read its Δ as bounded above by 0.
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

/** Every name the plan carries more than one NON-TWIN tile for — i.e. every A/B question
 *  on this plate. Derived from the plan rather than from `key.subject`, because a plate
 *  may now carry several independent subjects and a delta quoted for the wrong one is
 *  exactly the answer-sheet class of bug this file was written to stop. */
function subjectsOf(key) {
  if (key.subjects?.length) return key.subjects;
  if (key.subject) return [key.subject];
  const n = new Map();
  for (const p of key.plan) if (!p.twin) n.set(p.name, (n.get(p.name) ?? 0) + 1);
  return [...n].filter(([, c]) => c >= 2).map(([k]) => k);
}

function printScore(key, runs) {
  const { perVariant, twinRows } = scorePaired(key, runs);
  const subjects = subjectsOf(key);
  const isSub = (n) => subjects.includes(n);
  console.log(`PAIRED ROUND — subject(s) ${subjects.join(', ')}, ${runs.length} judge(s), 1 plate, ${key.plan.length} tiles\n`);
  console.log('TILE'.padEnd(26) + 'HIT/SEEN'.padEnd(11) + 'wrong answers');
  const rows = [...perVariant.values()].sort((x, y) => (isSub(x.name) ? -1 : 1) - (isSub(y.name) ? -1 : 1)
    || x.name.localeCompare(y.name) || String(x.variant).localeCompare(String(y.variant)));
  for (const v of rows) {
    const wrong = [...v.given.entries()].sort((p, q) => q[1] - p[1]).map(([k, n]) => `${k} x${n}`).join(', ');
    console.log(`${v.name}${v.variant === '-' ? '' : ` [${v.variant}]`}${v.twin ? ` (twin ${v.twin})` : ''}`.padEnd(26)
      + `${v.hit}/${v.n}`.padEnd(11) + wrong);
  }

  // ── The paired delta. EXACT within this round, and a different quantity from a
  //    between-round delta. CLAUDE.md #10 — never conflate them.
  console.log('\nPAIRED DELTA (same judge, same plate, same round — exact):');
  for (const s of subjects) {
    const vs = rows.filter((v) => v.name === s && !v.twin);
    if (vs.length < 2) { console.log(`  ${s}: only ${vs.length} variant tile(s) — NO PAIRED DELTA EXISTS`); continue; }
    const base = vs[0];
    for (const v of vs.slice(1)) {
      const d = v.hit - base.hit;
      console.log(`  ${s.padEnd(12)} [${base.variant}] ${base.hit}/${base.n}  ->  [${v.variant}] ${v.hit}/${v.n}   Δ ${d >= 0 ? '+' : ''}${d} of ${v.n}`);
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
const subjects = (a.subject ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const seed = a.seed ?? '7';
const cols = Number(a.cols ?? 8);
const CELL = Number(a.cell ?? 92);
const tag = a.tag ?? `pair-${subjects.join('-')}-s${seed}`;
if (!subjects.length) { console.error('usage: ic_pair.mjs --subject <icon[,icon...]> --variants <json> [--twins a,b] [--handover icon=ID] --url <u>'); process.exit(2); }

const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const allVariants = JSON.parse(readFileSync(a.variants, 'utf8'));
for (const s of subjects) if (!allVariants[s]) { console.error(`no variants declared for "${s}" in ${a.variants}`); process.exit(2); }

/** ── `--arms slow=A,D,E;boxBurger=A,D` — which declared arms this ROUND draws. ──
 *  The variants file is a growing RECORD: an arm that lost stays in it, with the number
 *  that killed it, so the next pass does not rebuild it. A round should not have to draw
 *  the whole record. Two reasons this is not cosmetic:
 *   * a decided arm on the plate is a tile of judge attention spent on a settled question;
 *   * once a winner has been pasted into `src/ui/icons/`, the shipped arm and the winning
 *     arm are the SAME PIXELS, and the "variants must differ" control correctly refuses
 *     the round. Selecting arms is the honest way to drop the duplicate; `--handover` is
 *     for the case where proving they are identical IS the point. */
for (const spec2 of (a.arms ?? '').split(';').map((s) => s.trim()).filter(Boolean)) {
  const [n, ids] = spec2.split('=');
  const want = (ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!allVariants[n]) { console.error(`--arms names "${n}", which has no variants declared`); process.exit(2); }
  const missing = want.filter((id) => !allVariants[n].some((v) => v.id === id));
  if (missing.length) { console.error(`--arms ${n}: no such arm(s) ${missing.join(',')}`); process.exit(2); }
  allVariants[n] = allVariants[n].filter((v) => want.includes(v.id));
}

/** ── HAND-OVER: `--handover coin=B` ────────────────────────────────────────────
 *  Asserts that the icon AS SHIPPED and variant B render byte-identical pixels on this
 *  plate. A geometry variant is real artwork, so unlike a `fills` swap it has to be
 *  copied into `src/ui/icons/` by hand — and a hand copy is a transcription, which is
 *  the failure mode this whole directory of tools exists because of. The variant that
 *  was judged and the drawing that ships are the same drawing by MEASUREMENT here. */
const handover = new Map((a.handover ?? '').split(',').filter(Boolean).map((s) => {
  const [n, id] = s.split('=');
  return [n.trim(), (id ?? '').trim()];
}));

/** The plate is each subject's variants + the rest of the registry as distractors. A
 *  judge shown only boxes and gifts is being told the answer is a box or a gift; the
 *  round has to look like a normal round. */
const twins = (a.twins ?? '').split(',').filter(Boolean);
const context = (a.context ?? Object.keys(spec.icons).join(',')).split(',').filter((n) => spec.icons[n]);

const plan = [];
for (const s of subjects) {
  for (const v of allVariants[s]) {
    plan.push({ name: s, variant: v.id, fills: v.fills ?? null, svg: v.svg ?? null, note: v.note ?? '' });
  }
}
for (const n of context) {
  if (subjects.includes(n)) continue;
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
const variantTiles = new Map();
for (const s of subjects) {
  const vt = declared.filter((d) => d.name === s);
  variantTiles.set(s, vt);
  if (vt.length !== allVariants[s].length) faults.push(`${s}: ${vt.length} variant tiles, expected ${allVariants[s].length}`);
}

mkdirSync(out, { recursive: true });
const shot = join(out, `${tag}.png`);
await page.locator('#grid').screenshot({ path: shot });
const bb = await page.locator('#grid').boundingBox();

// ── SAME ART OR NOT, read off the shot itself. ───────────────────────────────
//
// ⚠️ WAS A BYTE-IDENTITY HASH, AND IT REFUSED A VALID ROUND. Kept in words because the
// rule it encoded has been reversed rather than deleted: `tileHash()` summed the plate
// rect and required twin hashes to be EQUAL. The first multi-subject plate came back
// `lock: twin tiles differ in PIXELS` on artwork that is the same DOM node built twice —
// and the two tiles were verified, by measurement, to sit at identical sub-pixel phase
// (`plate {x:116.5,y:108}` and `{x:208.5,y:476}`, both .5/.0). On a 2-row plate of
// nothing but `lock` the same two positions are byte-identical; on the 848×848 plate they
// are not. Chromium composites a large layer in tiles, and an antialiased edge that
// crosses a tile boundary lands ±1 differently. **That is a property of the raster, not
// of the art**, and a control that fails on the raster is a control that stops the round
// for the wrong reason. It was never shown to PASS on a real plate before being trusted.
//
// So the predicate is now a bound, and the bound is MEASURED rather than chosen —
// `AGENT-BRIEF.md` §4.5. On the plate that exposed this, over the same 73 tiles:
//
//     identical art (3 twin pairs)      0.58% / 0.73% / 1.16% of plate pixels, max chan 18 / 29 / 46
//     different art (7 A-vs-B pairs)    13.30% .. 23.55%,                      max chan 102 .. 234
//
// An order of magnitude apart on BOTH axes, with nothing in between. The bound sits in
// the gap and is not near either edge.
//
// And it has a POSITIVE CONTROL that runs on every plate rather than in a selftest: the
// SAME predicate is required to FAIL for every declared variant pair. A round in which
// "identical" and "different" cannot be told apart cannot be scored, and says so.
const SAME_ART = { pct: 2.0, chan: 64 };
const sharp = (await import('sharp')).default;
const buf = await sharp(readFileSync(shot)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
/** Per-channel max difference and the share of plate pixels that differ at all. */
const tileDiff = (d1, d2) => {
  const m1 = measured.find((x) => x.i === d1.i), m2 = measured.find((x) => x.i === d2.i);
  const w = Math.round(Math.min(m1.plateRect.w, m2.plateRect.w));
  const h = Math.round(Math.min(m1.plateRect.h, m2.plateRect.h));
  const ax = Math.round(m1.plateRect.x - bb.x), ay = Math.round(m1.plateRect.y - bb.y);
  const bx = Math.round(m2.plateRect.x - bb.x), by = Math.round(m2.plateRect.y - bb.y);
  let n = 0, mx = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ia = ((ay + y) * buf.info.width + ax + x) * 3;
      const ib = ((by + y) * buf.info.width + bx + x) * 3;
      let m = 0;
      for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(buf.data[ia + c] - buf.data[ib + c]));
      if (m > 0) n++;
      if (m > mx) mx = m;
    }
  }
  return { pct: +(100 * n / (w * h)).toFixed(2), chan: mx };
};
const sameArt = (d) => d.pct <= SAME_ART.pct && d.chan <= SAME_ART.chan;
const fmt = (d) => `${d.pct}% of plate px differ, max channel ${d.chan}`;
const artRows = [];
/** ⚠️ A HAND-OVER PAIR IS EXEMPT FROM THE "must differ" CONTROL, AND ONLY THAT PAIR.
 *  Once a winning variant has been pasted into `src/ui/icons/`, the shipped arm and the
 *  variant arm are SUPPOSED to be the same pixels — that is the whole assertion. Running
 *  both controls over the same pair would make a correct hand-over impossible to state.
 *  Every other pair on the plate still has to separate, so the round keeps its positive
 *  control; a plate whose ONLY subject is a hand-over has none and is a verification
 *  render, not a judged round. */
const handoverPair = new Set();
for (const [n, id] of handover) {
  const shippedIds = (allVariants[n] ?? []).filter((v) => !v.svg && !v.fills).map((v) => v.id);
  for (const s of shippedIds) handoverPair.add(`${n}|${[s, id].sort().join('|')}`);
}
// POSITIVE CONTROL, on this plate, this run: every declared variant pair must be
// SEPARABLE by the same predicate the twins are held to. If it cannot separate art that
// differs by construction, its verdict on the twins means nothing.
for (const s of subjects) {
  const vt = variantTiles.get(s);
  for (let i = 0; i < vt.length; i++) {
    for (let j = i + 1; j < vt.length; j++) {
      const d = tileDiff(vt[i], vt[j]);
      if (handoverPair.has(`${s}|${[vt[i].variant, vt[j].variant].sort().join('|')}`)) continue;
      artRows.push(`DIFFER  ${s} [${vt[i].variant}] vs [${vt[j].variant}]  ${fmt(d)}${sameArt(d) ? '  ← 🔴 SAME' : ''}`);
      if (sameArt(d)) faults.push(`${s}: variants [${vt[i].variant}] and [${vt[j].variant}] are indistinguishable to the twin predicate (${fmt(d)}) — this round cannot answer anything`);
    }
  }
}
for (const n of twins) {
  const ts = declared.filter((d) => d.name === n);
  if (ts.length !== 2) continue;
  const d = tileDiff(ts[0], ts[1]);
  artRows.push(`SAME    ${n} twins #${ts[0].i}/#${ts[1].i}  ${fmt(d)}${sameArt(d) ? '' : '  ← 🔴 DIFFER'}`);
  if (!sameArt(d)) faults.push(`${n}: twin tiles are NOT the same art (${fmt(d)}, bound ${SAME_ART.pct}% / ${SAME_ART.chan})`);
}

// ── HAND-OVER. The shipped tile must BE the variant that won. ───────────────
const handoverRows = [];
for (const [n, id] of handover) {
  const ts = variantTiles.get(n);
  if (!ts) { faults.push(`--handover ${n}=${id}: "${n}" is not a subject on this plate`); continue; }
  // The SHIPPED arm is the declared variant that overrides nothing — it draws whatever
  // `src/ui/icons/` currently contains, which is the thing being checked.
  const shippedIds = allVariants[n].filter((v) => !v.svg && !v.fills).map((v) => v.id);
  const base = ts.find((d) => shippedIds.includes(d.variant));
  const want = ts.find((d) => d.variant === id);
  if (!base) { faults.push(`--handover ${n}=${id}: no SHIPPED (unmodified) arm on this plate to compare against`); continue; }
  if (!want) { faults.push(`--handover ${n}=${id}: no variant "${id}"`); continue; }
  const d = tileDiff(base, want);
  handoverRows.push(`${n}: shipped #${base.i} vs [${id}] #${want.i}  ${fmt(d)}  ${sameArt(d) ? 'SAME ART ✅' : 'DRIFTED 🔴'}`);
  if (!sameArt(d)) faults.push(`--handover ${n}=${id}: the SHIPPED art does not render the judged variant (${fmt(d)}) — the paste drifted`);
}

writeFileSync(join(out, `${tag}.key.json`), JSON.stringify({
  url: target, subjects, seed, plate: shot, mode: 'paired', spec: specPath,
  variants: Object.fromEntries(subjects.map((s) => [s, allVariants[s].map((v) => ({
    id: v.id, note: v.note ?? '', fills: v.fills ?? null, svg: v.svg ?? null,
  }))])),
  twins, handover: Object.fromEntries(handover), plan: finalPlan,
  tiles: declared.map((d) => ({ i: d.i, name: d.name })),   // icon_score-compatible
  verified: faults.length === 0,
}, null, 2));

await browser.close();
console.log(`wrote ${shot}  ${Math.round(bb.width)}x${Math.round(bb.height)}px  ${declared.length} tiles`);
for (const s of subjects) console.log(`variants of ${s}: ${variantTiles.get(s).map((d) => `#${d.i} [${d.variant}]`).join(', ')}`);
console.log(`twin controls: ${twins.map((n) => `${n} #${declared.filter((d) => d.name === n).map((d) => d.i).join('/')}`).join(', ') || 'NONE — this round has no measured floor'}`);
console.log(`\nART IDENTITY (bound: same art ⇔ ≤${SAME_ART.pct}% of plate px differ AND ≤${SAME_ART.chan}/255 max channel):`);
for (const r of artRows) console.log(`  ${r}`);
for (const r of handoverRows) console.log(`hand-over  ${r}`);
if (errs.length) console.log('CONSOLE ERRORS:\n' + errs.join('\n'));
if (faults.length) { console.log('\n🔴 PAIRED PLATE INVALID:\n  ' + faults.join('\n  ')); process.exit(1); }
console.log('\n✅ every declared variant pair separates; every twin pair does not.');
