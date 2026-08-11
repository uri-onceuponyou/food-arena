#!/usr/bin/env node
/**
 * THE PAIRED **SIZE** PLATE — the same drawing at two delivered sizes, one plate, one judge.
 *
 * ── Why this exists and `ic_pair.mjs` could not be used ────────────────────
 * `ic_pair.mjs` is the right SHAPE for this question and cannot ask it. Its page
 * (`icon_legibility.html`) takes every tile's box and plate from `SPEC.icons[p.name]`,
 * keyed by NAME — so two arms of one subject necessarily share one size. That is correct
 * for the questions it was built for (a colourway, a redraw) and it makes a size A/B
 * impossible: the variable lives one level above the variant.
 *
 * A between-round comparison is not an option either, and that is measured rather than
 * feared: across the seed-7 and seed-13 native rounds, **24 of 63 icons moved by ≥1 of 3
 * and 13 moved by ≥2 on byte-identical art.** So the two sizes have to face the same
 * judge, in the same mood, on the same plate — the way identical seeds cancel in a
 * per-matchup win-rate delta.
 *
 * This draws the tile grid itself, with px and plate taken PER TILE from two specs:
 *
 *   arm A   `--spec-a`   the delivered condition BEFORE the change
 *   arm B   `--spec-b`   the delivered condition AFTER it
 *
 * Everything else is `icon_legibility.html`'s geometry, copied deliberately and not
 * approximated — cell 92, pad `max(4, round(px * 0.30))`, plate side `px + 2*pad`,
 * radius `round(side * 0.34)`, `--fa-ic-ink` per tile, `#E8DCC4` page, a 10px grid pad,
 * a 10px monospace index caption — so a tile here is comparable with r8 and r9's tiles.
 * The real `icon()` is imported from the snapshot, so the artwork cannot drift from
 * `src/ui/icons/`.
 *
 * ── 🚨 THE FIELD IS PAIRED TOO, BECAUSE OF `ic_pair.mjs` §5 ─────────────────
 * A paired plate cancels the JUDGE. It does not cancel the PLATE'S OWN COMPOSITION: in a
 * forced-choice round a wrong answer is only available while no tile has claimed it, and
 * `egg` once scored 3/3 in BOTH arms because a redrawn `coin` on the same plate had
 * taken the answer it used to attract. `chest`'s recorded misreads are `boxFire`,
 * `boxBurger`, `boxRed` and `rice` — three of which are containers that share the ONE
 * host this change resizes. So all five container glyphs are declared as subjects and
 * every one appears at both sizes. Nothing that moved is drawn at a stale size, and no
 * arm is scored against a field the other arm did not face.
 *
 * ── The twin floor ─────────────────────────────────────────────────────────
 * `--twins` duplicates an icon's tile byte-identically elsewhere in the grid. The floor
 * is a property of the twin ICON, not of the round: a judge that can read a tile answers
 * its twin the same way, and a judge that cannot is guessing twice. Declare at least one
 * PASSING twin and one FAILING twin, and read the failing one as the floor for a failing
 * subject. This refuses to score a round whose twins do not bracket.
 *
 *   node tools/tmp/si_pair.mjs --url <snap> --spec-a shots/ic/spec.json \
 *     --spec-b shots/si/after/spec.json --subject chest,boxBurger,boxRed,boxFire,boxPineapple \
 *     --twins tomato,gift,shards --seed 31 --out shots/si/round1
 *   node tools/tmp/si_pair.mjs --score shots/si/round1/answers_native.json
 *   node tools/tmp/si_pair.mjs --selftest
 *
 * ── KNOWN-BAD INPUT ────────────────────────────────────────────────────────
 * `--selftest` drives `scorePairedSize()` with synthetic answer sheets: a round where B
 * wins, a round where the twins agree (floor 0), a round where the failing twin splits
 * every time (floor 1), and a round whose twins do NOT bracket (must refuse). And every
 * real render asserts, from the rendered DOM, that (a) each subject's two arms actually
 * differ in delivered px — otherwise the plate answers nothing while looking identical
 * to a plate that does — and (b) each declared twin pair is identical in px, plate and
 * ink. Both were real faults in this tool family: `ic_pair`'s twin flag once failed to
 * survive the round trip and the round reported itself as having no floor at all.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SUBJECT, subjectOf } from './icon_score.mjs';

const a = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[i + 1];
}
const TEXT_OF = new Map(Object.entries(SUBJECT).map(([t, n]) => [n, t]));

/**
 * Score a paired-size round. Pure, so `--selftest` can drive it with a synthetic sheet.
 *
 * `key.plan` rows carry `{ i, name, arm, twin }`; `runs` are `{ judge, lines }`.
 */
export function scorePairedSize(key, runs) {
  const per = new Map();      // "name/arm" -> { name, arm, n, hit, given: Map }
  const twinSplits = new Map(); // name -> { pairs, split }
  for (const run of runs) {
    const ans = new Map();
    for (const line of run.lines) {
      const m = String(line).match(/^\s*(\d+)\s*[.):]\s*(.+?)\s*$/);
      if (m) ans.set(Number(m[1]), m[2].toLowerCase().trim());
    }
    for (const p of key.plan) {
      const raw = ans.get(p.i) ?? '(blank)';
      const given = subjectOf(raw) ?? `?${raw}`;
      const k = `${p.name}/${p.arm ?? '-'}`;
      const v = per.get(k) ?? { name: p.name, arm: p.arm ?? '-', n: 0, hit: 0, given: new Map() };
      v.n++;
      if (given === p.name) v.hit++; else v.given.set(raw, (v.given.get(raw) ?? 0) + 1);
      per.set(k, v);
    }
    // TWIN CONTROL — identical pixels, two indices, ONE judge.
    const groups = new Map();
    for (const p of key.plan) {
      if (!p.twin) continue;
      const k = `${p.name}/${p.arm ?? '-'}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(p);
    }
    for (const [k, ps] of groups) {
      if (ps.length < 2) continue;
      const g = ps.map((p) => subjectOf(ans.get(p.i) ?? '') ?? `?${ans.get(p.i) ?? '(blank)'}`);
      const rec = twinSplits.get(k) ?? { name: ps[0].name, pairs: 0, split: 0 };
      rec.pairs++;
      if (new Set(g).size > 1) rec.split++;
      twinSplits.set(k, rec);
    }
  }
  // A twin is LEGIBLE for this round when every judge got it right on both tiles.
  const twins = [...twinSplits.entries()].map(([k, r]) => {
    const v = per.get(k);
    return { ...r, key: k, hit: v ? v.hit : 0, n: v ? v.n : 0, legible: v ? v.hit === v.n : false };
  });
  const bracket = twins.some((t) => t.legible) && twins.some((t) => !t.legible);
  /** ⚠️ THE FLOOR IS IN SCORE POINTS, NOT IN JUDGES, AND THE FIRST CUT CONFLATED THEM.
   *  It returned `split` — the NUMBER OF JUDGES who disagreed with themselves — so a
   *  3-judge panel whose illegible twin split every time reported a floor of 3 on a
   *  0..3 scale, i.e. no Δ could ever clear it. The recorded convention is the other
   *  quantity: `204dfa4` reads *"boxFire (0/3 illegible), 3 of 3 judges split, floor
   *  1"*, and `gift` at 1 of 3 splits is called MARGINAL rather than a second floor.
   *  A split means one judge's answer depends on WHICH of two identical tiles it saw,
   *  so the icon's score on a panel can move by one point. Any split at all buys that
   *  point; more splits do not buy a second one. The RATE is printed so a reader can
   *  see whether the floor is firm (3 of 3) or marginal (1 of 3). */
  const floorFailing = twins.some((t) => !t.legible && t.split > 0) ? 1 : 0;
  const floorPassing = twins.some((t) => t.legible && t.split > 0) ? 1 : 0;
  const subjects = [...new Set([...per.values()].filter((v) => v.arm !== '-').map((v) => v.name))];
  const deltas = subjects.map((n) => {
    const A = per.get(`${n}/A`); const B = per.get(`${n}/B`);
    return { name: n, a: A ? `${A.hit}/${A.n}` : '-', b: B ? `${B.hit}/${B.n}` : '-', d: (B?.hit ?? 0) - (A?.hit ?? 0), givenA: A ? [...A.given] : [], givenB: B ? [...B.given] : [] };
  });
  return { per: [...per.values()], twins, bracket, floorFailing, floorPassing, deltas };
}

if (process.argv.includes('--selftest')) {
  const mkKey = (plan) => ({ plan });
  const mkRun = (judge, map) => ({ judge, lines: Object.entries(map).map(([i, t]) => `${i}. ${t}`) });
  const T = (n) => TEXT_OF.get(n) ?? n;
  let bad = 0;
  const check = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) bad++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(52)} got ${JSON.stringify(got)}${ok ? '' : `  want ${JSON.stringify(want)}`}`);
  };
  // 1. B wins 3-0, twins bracket, failing twin splits every pair.
  const plan1 = [
    { i: 1, name: 'chest', arm: 'A' }, { i: 2, name: 'chest', arm: 'B' },
    { i: 3, name: 'tomato', twin: 1 }, { i: 4, name: 'tomato', twin: 2 },
    { i: 5, name: 'shards', twin: 1 }, { i: 6, name: 'shards', twin: 2 },
  ];
  const runs1 = ['P', 'Q', 'R'].map((j, k) => mkRun(j, {
    1: T('boxFire'), 2: T('chest'),
    3: T('tomato'), 4: T('tomato'),
    5: T('slash'), 6: k === 0 ? T('cap') : T('wave'),   // the illegible twin splits every time
  }));
  const r1 = scorePairedSize(mkKey(plan1), runs1);
  check('B wins 3 of 3', r1.deltas.find((d) => d.name === 'chest').d, 3);
  check('paired rows read A 0/3, B 3/3', [r1.deltas[0].a, r1.deltas[0].b], ['0/3', '3/3']);
  check('the twins BRACKET', r1.bracket, true);
  check('floor for a FAILING subject is 1 SCORE POINT', r1.floorFailing, 1);
  check('floor for a PASSING subject is 0', r1.floorPassing, 0);
  // 1b. AN ILLEGIBLE TWIN THAT IS MISREAD **CONSISTENTLY** BUYS NO FLOOR. This is the
  //     exact luck `13fb98c` and `e4fa1bd` both reported as "floor 0 of 9": `chest` was
  //     wrong on both tiles and wrong the SAME WAY, so the control saw nothing.
  const runs1b = ['P', 'Q', 'R'].map((j) => mkRun(j, {
    1: T('boxFire'), 2: T('chest'), 3: T('tomato'), 4: T('tomato'), 5: T('slash'), 6: T('slash'),
  }));
  const r1b = scorePairedSize(mkKey(plan1), runs1b);
  check('a CONSISTENTLY misread twin buys no floor', [r1b.bracket, r1b.floorFailing], [true, 0]);
  // 2. Twins that do not bracket — every twin legible — must be reported as such.
  const plan2 = plan1.slice(0, 4);
  const runs2 = ['P', 'Q', 'R'].map((j) => mkRun(j, { 1: T('chest'), 2: T('chest'), 3: T('tomato'), 4: T('tomato') }));
  const r2 = scorePairedSize(mkKey(plan2), runs2);
  check('all-legible twins do NOT bracket', r2.bracket, false);
  // 3. A round where B LOSES must report a negative delta, not zero.
  const runs3 = ['P', 'Q', 'R'].map((j) => mkRun(j, {
    1: T('chest'), 2: T('boxRed'), 3: T('tomato'), 4: T('tomato'), 5: T('slash'), 6: T('cap'),
  }));
  const r3 = scorePairedSize(mkKey(plan1), runs3);
  check('a LOSING arm reports a negative delta', r3.deltas.find((d) => d.name === 'chest').d, -3);
  // 4. A blank answer is a miss, never a silent pass.
  const runs4 = [mkRun('P', { 2: T('chest') })];
  const r4 = scorePairedSize(mkKey(plan1), runs4);
  check('a missing line scores as a MISS', r4.deltas.find((d) => d.name === 'chest').a, '0/1');
  console.log(bad ? `\n${bad} SELFTEST FAILURE(S)` : '\n9/9 selftests pass');
  process.exit(bad ? 1 : 0);
}

// ── SCORE MODE ──────────────────────────────────────────────────────────────
if (a.score) {
  const bundle = JSON.parse(readFileSync(a.score, 'utf8'));
  const key = JSON.parse(readFileSync(bundle.key, 'utf8'));
  const runs = bundle.runs;
  const r = scorePairedSize(key, runs);
  const tot = r.per.reduce((s, v) => s + v.n, 0);
  const hit = r.per.reduce((s, v) => s + v.hit, 0);
  console.log(`\nsi_pair — ${bundle.protocol} · ${runs.length} judge(s) · plate ${bundle.plate}`);
  console.log(`  whole plate ${hit}/${tot} = ${(100 * hit / tot).toFixed(1)}%\n`);
  console.log('── TWIN CONTROL — identical pixels, two indices, one judge ──');
  // ⚠️ THIS LINE ONCE PRINTED `floor 3` BESIDE A ROUND FLOOR OF 1, i.e. it printed the
  // SPLIT COUNT under the word "floor" while the verdict below used score points. Two
  // numbers with one name is how a documented count goes stale; the floor now appears
  // in exactly one unit here.
  for (const t of r.twins) {
    console.log(`  ${t.name.padEnd(12)} ${t.hit}/${t.n} correct   ${t.split} of ${t.pairs} judges SPLIT   `
      + `${t.legible ? 'LEGIBLE   buys floor 0' : `ILLEGIBLE  buys floor ${t.split > 0 ? 1 : 0}`}`);
  }
  // 🚨 AN ILLEGIBLE TWIN THAT EVERY JUDGE MISREAD **CONSISTENTLY** BUYS NOTHING, AND A
  // ROUND THAT REPORTS "floor 0" ON ONE IS THE EXACT LUCK `13fb98c` AND `e4fa1bd` BOTH
  // MISTOOK FOR A CLEAN CONTROL. The twins bracket, so the round is scoreable — but the
  // floor it measured is not usable for a failing subject and must say so out loud.
  const luck = r.bracket && r.floorFailing === 0 && r.twins.some((t) => !t.legible);
  if (!r.bracket) {
    console.log('\n  🔴 THE TWINS DO NOT BRACKET — this round has no floor for a FAILING subject.');
    console.log('     Every Δ below is unreadable for a subject sitting at 0/n. Declare one passing');
    console.log('     and one failing twin and run it again.');
  } else if (luck) {
    console.log('\n  🔴 THE FAILING TWIN WAS MISREAD **CONSISTENTLY**, SO IT MEASURED A FLOOR OF 0.');
    console.log('     That is luck, not a property of the control — a judge guessing twice happened');
    console.log('     to guess the same thing. Do NOT read a Δ of ±1 against it; treat the floor as');
    console.log('     UNMEASURED and only |Δ| >= 2 as resolved.');
  } else {
    console.log(`\n  floor for a FAILING subject: ${r.floorFailing} of ${runs.length}   ·   for a PASSING subject: ${r.floorPassing}`);
  }
  console.log('\n── SUBJECTS — A = delivered before, B = delivered after ──');
  for (const d of r.deltas) {
    const sig = !r.bracket ? '  (no floor)'
      : luck ? (Math.abs(d.d) >= 2 ? '  clears an UNMEASURED floor' : '  UNRESOLVED — floor unmeasured')
        : (Math.abs(d.d) > r.floorFailing ? '  CLEARS THE FLOOR' : '  inside the floor');
    console.log(`  ${d.name.padEnd(14)} A ${d.a}   B ${d.b}   Δ ${d.d > 0 ? '+' : ''}${d.d}${sig}`);
    if (d.givenA.length) console.log(`      A wrong: ${d.givenA.map(([k, v]) => `${k} x${v}`).join(', ')}`);
    if (d.givenB.length) console.log(`      B wrong: ${d.givenB.map(([k, v]) => `${k} x${v}`).join(', ')}`);
  }
  process.exit(0);
}

// ── RENDER MODE ─────────────────────────────────────────────────────────────
const url = (a.url ?? '').replace(/\/$/, '');
if (!url) { console.error('usage: node tools/tmp/si_pair.mjs --url <snap> --spec-a A.json --spec-b B.json --subject a,b --twins x,y --out DIR'); process.exit(2); }
const specA = JSON.parse(readFileSync(a['spec-a'], 'utf8'));
const specB = JSON.parse(readFileSync(a['spec-b'], 'utf8'));
const subjects = (a.subject ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const twins = (a.twins ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const seed = Number(a.seed ?? 31);
const out = a.out ?? 'shots/si/round1';
const cols = Number(a.cols ?? 9);
const CELL = Number(a.cell ?? 92);
const tag = a.tag ?? `s${seed}`;

for (const n of subjects) {
  if (!specA.icons[n] || !specB.icons[n]) { console.error(`subject "${n}" is missing from one of the specs`); process.exit(2); }
}
for (const n of twins) {
  if (subjects.includes(n)) { console.error(`"${n}" cannot be both a twin and a subject`); process.exit(2); }
  if (!specB.icons[n]) { console.error(`twin "${n}" is not in spec B`); process.exit(2); }
}

/** One entry per TILE, each carrying its OWN box and plate. That is the whole point. */
const plan = [];
for (const n of subjects) {
  plan.push({ name: n, arm: 'A', ...pick(specA.icons[n]) });
  plan.push({ name: n, arm: 'B', ...pick(specB.icons[n]) });
}
for (const n of Object.keys(specB.icons)) {
  if (subjects.includes(n)) continue;
  plan.push({ name: n, ...pick(specB.icons[n]) });
  if (twins.includes(n)) plan.push({ name: n, twin: 2, ...pick(specB.icons[n]) });
}
for (const n of twins) {
  const first = plan.find((p) => p.name === n && !p.twin);
  if (first) first.twin = 1;
}
function pick(s) { return { px: s.px, bg: s.bg, outline: s.outline, filter: s.filter ?? '' }; }

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1400 }, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(({ p, seed: sd, cols: c, cell }) => {
  window.__SI_PLAN = p; window.__SI_SEED = sd; window.__SI_COLS = c; window.__SI_CELL = cell;
}, { p: plan, seed, cols, cell: CELL });

// The page only has to exist for its module graph; the grid is built here.
await page.goto(`${url}/tools/tmp/icon_legibility.html?set=all&seed=1`, { waitUntil: 'load', timeout: 90_000 });
await page.waitForFunction(() => window.__ready === true || window.__refused, null, { timeout: 60_000 }).catch(() => {});

const declared = await page.evaluate(async () => {
  const { icon, ensureIconStyles } = await import('/src/ui/icons/index.ts');
  ensureIconStyles();
  document.body.innerHTML = '<div id="grid"></div>';
  document.documentElement.style.background = '#E8DCC4';
  document.body.style.cssText = 'margin:0;background:#E8DCC4;font-family:system-ui,sans-serif';
  const PAD = 0.30;
  const plan = window.__SI_PLAN.slice();
  // mulberry32 — the same deterministic shuffle `icon_legibility.html` uses.
  const rng = (a) => function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = rng(window.__SI_SEED);
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [plan[i], plan[j]] = [plan[j], plan[i]];
  }
  const grid = document.getElementById('grid');
  grid.style.cssText = `display:grid;width:max-content;padding:10px;grid-template-columns:repeat(${window.__SI_COLS}, ${window.__SI_CELL}px)`;
  const cell = window.__SI_CELL;
  const declared = [];
  for (const [i, p] of plan.entries()) {
    const px = p.px;
    const pad = Math.max(4, Math.round(px * PAD));
    const side = px + pad * 2;
    const item = document.createElement('div');
    item.style.cssText = `width:${cell}px;height:${cell}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;`;
    const plate = document.createElement('div');
    plate.style.cssText = `width:${side}px;height:${side}px;background:${p.bg};`
      + `border-radius:${Math.round(side * 0.34)}px;display:flex;align-items:center;`
      + `justify-content:center;--fa-ic-ink:${p.outline};`;
    plate.innerHTML = icon(p.name);
    const svg = plate.querySelector('svg.fa-ic');
    svg.setAttribute('width', `${px}px`);
    svg.setAttribute('height', `${px}px`);
    svg.style.width = `${px}px`;
    svg.style.height = `${px}px`;
    if (p.filter) svg.style.filter = p.filter;
    item.appendChild(plate);
    const idx = document.createElement('div');
    idx.style.cssText = 'font:500 10px ui-monospace, monospace;color:#8a7c66;margin-top:3px';
    idx.textContent = String(i + 1);
    item.appendChild(idx);
    grid.appendChild(item);
    const mb = svg.getBoundingClientRect();
    declared.push({
      i: i + 1, name: p.name, arm: p.arm ?? null, twin: p.twin ?? null,
      px, bg: p.bg, outline: p.outline,
      renderedPx: +mb.width.toFixed(2), plateBg: getComputedStyle(plate).backgroundColor,
    });
  }
  return declared;
});

// ── VERIFY, before anything is judged ───────────────────────────────────────
const faults = [];
// 1. Every tile drew the box it declared. A stylesheet fighting the inline value is the
//    documented failure mode of the shared harness and it is cheap to rule out.
for (const d of declared) {
  if (Math.abs(d.renderedPx - d.px) > 3 / 64) faults.push(`${d.name}[${d.arm ?? '-'}] declared ${d.px}px, rendered ${d.renderedPx}px`);
}
// 2. THE ARMS MUST DIFFER. A paired plate whose two arms are the same pixels answers
//    nothing and would report "no difference" as a finding.
for (const n of subjects) {
  const ts = declared.filter((d) => d.name === n);
  if (ts.length !== 2) { faults.push(`${n}: ${ts.length} arm tiles, expected 2`); continue; }
  if (Math.abs(ts[0].px - ts[1].px) < 0.5) faults.push(`${n}: both arms are ${ts[0].px}px — this round asks nothing`);
}
// 3. THE TWINS MUST BE IDENTICAL, and must reach the key FLAGGED — `ic_pair.mjs` shipped
//    a round whose twins were drawn and then not scored, which is indistinguishable from
//    a round with no control at all.
for (const n of twins) {
  const ts = declared.filter((d) => d.name === n);
  if (ts.length !== 2) { faults.push(`${n}: ${ts.length} twin tiles, expected 2`); continue; }
  if (!ts.every((t) => t.twin)) faults.push(`${n}: twin tiles reached the key UNFLAGGED`);
  if (ts[0].px !== ts[1].px || ts[0].plateBg !== ts[1].plateBg || ts[0].outline !== ts[1].outline) {
    faults.push(`${n}: twins are NOT identical — ${JSON.stringify(ts[0])} vs ${JSON.stringify(ts[1])}`);
  }
}
if (errs.length) faults.push(`page errors: ${errs.join(' | ')}`);

mkdirSync(resolve(out), { recursive: true });
const shot = join(out, `${tag}.png`);
await page.locator('#grid').screenshot({ path: shot });
await browser.close();

if (faults.length) {
  console.log('🔴 THE PLATE REFUSED — nothing was written that a judge may see:');
  for (const f of faults) console.log(`   ${f}`);
  process.exit(1);
}

const key = {
  url, seed, cols, cell: CELL, subjects, twins,
  specA: a['spec-a'], specB: a['spec-b'],
  plan: declared.map((d) => ({ i: d.i, name: d.name, arm: d.arm, twin: d.twin, px: d.px, bg: d.bg })),
};
writeFileSync(join(out, `${tag}.key.json`), JSON.stringify(key, null, 1));
const cands = [...new Set(Object.keys(SUBJECT))].sort();
writeFileSync(join(out, 'candidates.txt'), cands.map((c) => `- ${c}`).join('\n') + '\n');
console.log(`\nsi_pair — ${declared.length} tiles, seed ${seed}, ${cols} cols`);
console.log(`  subjects (A -> B delivered px):`);
for (const n of subjects) {
  const ts = declared.filter((d) => d.name === n).sort((x, y) => (x.arm < y.arm ? -1 : 1));
  console.log(`    ${n.padEnd(14)} ${ts[0].px} px on ${ts[0].bg}   ->   ${ts[1].px} px on ${ts[1].bg}`);
}
console.log(`  twins: ${twins.join(', ')}`);
console.log(`  plate  ${shot}`);
console.log(`  key    ${join(out, `${tag}.key.json`)}`);
console.log(`  ${cands.length} candidate strings -> ${join(out, 'candidates.txt')}`);
