#!/usr/bin/env node
/**
 * THE DELIVERED SPEC — one file that says, per icon, the box and the plate it SHIPS on.
 *
 * ── Why this is a separate tool and not four copies of a `for` loop ──────────
 * `ic_delivered.mjs` measures 1728 rendered nodes. Turning that into "what should a
 * blind tile look like" is a SELECTION, and the selection was written inline inside
 * `ic_plate.mjs`. That inline rule had a defect nobody could see because it was never
 * printed as a table:
 *
 *     boxFire is `occluded: true` at EVERY `tr-odds-title` occurrence — desk, land AND
 *     phone — because it is the fourth row of the drop-rates sheet and sits under the
 *     sheet's own clip. So "smallest VISIBLE occurrence" fell through to the shop card
 *     and gave it 36.8 px, while its three siblings were taken from the odds sheet at
 *     14.39 px.
 *
 * The four boxes ship IN ONE ROW OF ONE SHEET at one size. The round whose entire
 * question was "do the four boxes separate from each other and from `gift`?" therefore
 * drew one of them **2.56x larger than the other three**. That is not a weak
 * measurement of the box family; it is a measurement of a screen this game does not
 * have — the same fault, one level up, that `cc34026` found in the hand-transcribed CSS.
 *
 * ── The rule, and why it is allowed to use an occluded row ──────────────────
 * Occlusion invalidates a COLOUR SAMPLE. It does not invalidate a BOUNDING BOX.
 * `ic_delivered.mjs` introduced the occlusion test for one reason, stated in its own
 * comments: a row sampled through a scrim reports the scrim's colour (`boxBurger` came
 * back on rgb(30, 11, 10) — near-black — at `land/trophies/odds`, where the photograph
 * shows white). Layout is not sampled; `getBoundingClientRect()` on a clipped node is
 * the same number it would be if you scrolled to it.
 *
 * So the spec is built per SITE — one `(viewport, screen, host class)` — rather than per
 * row:
 *
 *   size   from the row, occluded or not.
 *   plate  from the row's OWN pixel sample if it was unoccluded and visible;
 *          otherwise from the CO-SITED SIBLINGS' samples at the same site;
 *          otherwise the site is UNUSABLE and is skipped entirely.
 *   ink    the outline colour, from computed style — valid under occlusion.
 *
 * Then per icon: the SMALLEST usable site wins. Smallest is a real shipped condition and
 * it is the harshest, so a glyph that reads here reads everywhere it ships.
 *
 * ── What that recovers ─────────────────────────────────────────────────────
 * Four of the five icons the previous pass had to draw at a 20 px cream fallback are
 * measurable after all, and three of them were being drawn WRONG:
 *
 *     heal      13.8 px on the `chars-fact` INK PILL, cream outline   (was 20 px, dark-on-cream:
 *                                                                      inverted, like `range`)
 *     puffer    23.19 px on white                                      (was 20 px on cream)
 *     lollipop  26 px on #EFEAF7, the HUD weapon plate                 (was 20 px on cream)
 *     party     40 px on white, a trophy-road node                     (was 20 px on cream)
 *
 * `flag` stays unmeasured: it is `neverRendered` — it needs a COMPLETED trophy road, so
 * it is unreachable on a normal profile. It is marked `unmeasured` in the output and any
 * verdict quoting it must say so.
 *
 *   node tools/tmp/ic_spec.mjs shots/ic/delivered.json shots/ic/lollipop.json \
 *        --out shots/ic/spec.json
 *   node tools/tmp/ic_spec.mjs --selftest
 *
 * Several delivered files may be merged: a sweep that had to force a state (a specific
 * match, a specific character) is still a measurement of the same screens.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

/** True only when this file is the process entry point.
 *
 *  `ic_plate.mjs` imports `LEGACY_HARNESS` from here to build its known-bad input. That
 *  import ran this file's `--selftest` branch, because the branch tested
 *  `process.argv[2]` — which belonged to `ic_plate`, not to this module — and then called
 *  `process.exit()`. `ic_plate --selftest` therefore printed ic_spec's selftest and
 *  stopped. A module that reads the process's arguments cannot also be a library. */
const IS_MAIN = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

/** The historically-shipped harness condition, kept ONLY as a known-bad input.
 *  `icon_legibility.html` sized every tile from three hand-transcribed CSS classes and
 *  plated every one of them dark-on-cream. This is that condition, verbatim, so it can
 *  be fed to the verifier and REQUIRED to fail. Nothing reads it for a real plate. */
export const LEGACY_HARNESS = { px: 20, bg: 'rgb(255, 243, 222)', outline: '#1a1224', filter: '' };

const rgb = (s) => {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(String(s));
  return m ? [Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3])] : null;
};
const med = (v) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

/**
 * Build the spec from one or more `ic_delivered.mjs` outputs.
 *
 * Exported so `--selftest` can drive it with synthetic rows, which is the only way the
 * site rule can be shown to FAIL on the inputs it exists for. CLAUDE.md #6.
 */
export function buildSpec(files) {
  const rows = [];
  for (const f of files) {
    const d = typeof f === 'string' ? JSON.parse(readFileSync(f, 'utf8')) : f;
    for (const r of d.rows) if (r.name && r.name !== '?') rows.push(r);
  }

  // ── Site plates. A site is one (viewport, screen, host class). ─────────────
  // Only UNOCCLUDED, VISIBLE rows with a pixel sample contribute. An occluded row's
  // own `bgPix` is discarded even though it exists — that is the whole point.
  const sitePlate = new Map();
  for (const r of rows) {
    if (!r.vis || r.occluded || !r.bgPix) continue;
    const k = `${r.vp}/${r.screen}::${r.host}`;
    (sitePlate.get(k) ?? sitePlate.set(k, []).get(k)).push(rgb(r.bgPix));
  }
  const plateOf = new Map();
  for (const [k, list] of sitePlate) {
    const ok = list.filter(Boolean);
    if (!ok.length) continue;
    // Per-channel median across co-sited siblings. One sibling landing on a border
    // cannot move the site's answer, exactly as inside `ic_delivered.mjs`.
    const p = [0, 1, 2].map((c) => med(ok.map((v) => v[c])));
    // The site must AGREE with itself. `chars-equip is-equipped` is green and
    // `chars-equip` is not, so a host class that spans two plates is not one site and
    // must not be averaged into a colour neither of them has.
    const spread = Math.max(...ok.map((v) => Math.max(...v.map((c, i) => Math.abs(c - p[i])))));
    if (spread > 16) continue;
    plateOf.set(k, { rgb: p, n: ok.length, spread });
  }

  const best = new Map();
  const skipped = [];
  for (const r of rows) {
    const site = `${r.vp}/${r.screen}::${r.host}`;
    const own = r.vis && !r.occluded && r.bgPix ? rgb(r.bgPix) : null;
    const inherited = plateOf.get(site);
    const plate = own ?? inherited?.rgb ?? null;
    if (!plate) { skipped.push(`${r.name} @ ${site}`); continue; }
    const px = +Math.min(r.w, r.h).toFixed(2);
    const cand = {
      name: r.name, px,
      bg: `rgb(${plate[0]}, ${plate[1]}, ${plate[2]})`,
      outline: r.outline || '#1a1224',
      filter: r.filter || '',
      ink: r.ink ?? null,
      where: `${r.vp}/${r.screen}`, host: r.host,
      plateSource: own ? 'own-pixels' : 'co-sited-siblings',
      // Declared so a report can never quote one of these as if it had been seen.
      viaOccluded: !(r.vis && !r.occluded),
    };
    const cur = best.get(r.name);
    // Smallest wins. On a tie, a row that was ITSELF unoccluded beats one that leans on
    // its siblings, and an own-pixel plate beats an inherited one.
    const better = !cur
      || cand.px < cur.px - 0.01
      || (Math.abs(cand.px - cur.px) <= 0.01
        && ((!cand.viaOccluded && cur.viaOccluded)
          || (cand.viaOccluded === cur.viaOccluded && cand.plateSource === 'own-pixels' && cur.plateSource !== 'own-pixels')));
    if (better) best.set(r.name, cand);
  }
  return { spec: best, skipped };
}

/** Registry keys, read from source — an icon nothing routes to still shows up. */
function registryNames() {
  if (!existsSync('src/ui/icons/ui.ts')) return null;
  const src = readFileSync('src/ui/icons/ui.ts', 'utf8') + readFileSync('src/ui/icons/food.ts', 'utf8');
  const out = new Set();
  for (const m of src.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*):\s*(`|box\()/gm)) out.add(m[1]);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — the site rule, against inputs built to break it.
//
// Every case below is a real defect this rule was written for, reduced to the two or
// three rows that cause it. `CLAUDE.md` #6: a guard that has not been shown to FAIL on
// the bug it guards against is not a guard — and `AGENT-BRIEF.md` §4.4: ask of every
// assertion what implementation would fail it. Each case names that implementation.
// ─────────────────────────────────────────────────────────────────────────────
if (IS_MAIN && process.argv[2] === '--selftest') {
  let pass = 0, fail = 0;
  const check = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}\n        got  ${JSON.stringify(got)}`
      + (ok ? '' : `\n        want ${JSON.stringify(want)}`));
    ok ? pass++ : fail++;
  };
  const row = (o) => ({
    vp: 'desk', screen: 's', host: 'h', name: 'x', w: 20, h: 20,
    vis: true, occluded: false, bgPix: 'rgb(255, 255, 255)', outline: '#1a1224',
    filter: '', ink: { w: 16, h: 16 }, ...o,
  });
  const spec = (rows) => buildSpec([{ rows }]).spec;

  // 1. THE boxFire CASE. Occluded everywhere at the small site; siblings are not.
  //    Fails on: "smallest VISIBLE occurrence" (returns 36.8, the shop card).
  {
    const s = spec([
      row({ name: 'boxFire', w: 14.39, h: 14.39, vis: false, occluded: true, bgPix: null, screen: 'odds', host: 'tr-odds-title' }),
      row({ name: 'boxRed', w: 14.39, h: 14.39, screen: 'odds', host: 'tr-odds-title' }),
      row({ name: 'boxFire', w: 36.8, h: 36.8, screen: 'shop', host: 'shop-card-em' }),
    ]);
    check('occluded row supplies SIZE, co-sited sibling supplies PLATE',
      [s.get('boxFire').px, s.get('boxFire').bg, s.get('boxFire').plateSource],
      [14.39, 'rgb(255, 255, 255)', 'co-sited-siblings']);
    check('...and the family then matches size',
      s.get('boxFire').px === s.get('boxRed').px, true);
  }

  // 2. AN OCCLUDED ROW'S OWN SAMPLE IS NEVER USED. The real value it produced was
  //    rgb(30, 11, 10) for a white sheet. Fails on: any rule that reads `bgPix`
  //    without checking `occluded` — which is what "it has a pixel sample" looks like.
  {
    const s = spec([
      row({ name: 'a', w: 11, h: 11, vis: true, occluded: true, bgPix: 'rgb(30, 11, 10)', screen: 'o', host: 'clipped' }),
      row({ name: 'a', w: 20, h: 20, bgPix: 'rgb(255, 255, 255)' }),
    ]);
    check('an occluded row with its own sample is REFUSED, not preferred for being smaller',
      [s.get('a').px, s.get('a').bg], [20, 'rgb(255, 255, 255)']);
  }

  // 3. A SITE WITH NO CLEAN SAMPLE AT ALL IS SKIPPED, not defaulted.
  //    Fails on: falling back to a hardcoded plate (which is exactly the 20 px cream
  //    fallback that produced five unquotable verdicts).
  {
    const { spec: s, skipped } = buildSpec([{ rows: [
      row({ name: 'b', w: 9, h: 9, vis: true, occluded: true, bgPix: 'rgb(9, 9, 9)', screen: 'z', host: 'dark' }),
      row({ name: 'b', w: 25, h: 25 }),
    ] }]);
    check('a site with no unoccluded sample is skipped', s.get('b').px, 25);
    check('...and the skip is REPORTED, not silent', skipped.length > 0, true);
  }

  // 4. POLARITY IS CARRIED. `range` ships cream-on-ink; every plate ever judged drew it
  //    dark-on-cream. Fails on: any rule that takes the outline from a default.
  {
    const s = spec([row({ name: 'range', w: 13.8, h: 13.8, bgPix: 'rgb(26, 18, 36)', outline: '#FFF3DE' })]);
    check('polarity survives: cream outline on an ink plate',
      [s.get('range').bg, s.get('range').outline], ['rgb(26, 18, 36)', '#FFF3DE']);
  }

  // 5. A HOST CLASS SPANNING TWO PLATES IS NOT ONE SITE. `chars-equip` is white and
  //    `chars-equip is-equipped` is green; averaging them yields a colour neither has.
  //    Fails on: taking the mean/median of a site without checking it agrees.
  {
    const { spec: s } = buildSpec([{ rows: [
      row({ name: 'c', w: 11, h: 11, screen: 'q', host: 'span', bgPix: 'rgb(255, 255, 255)' }),
      row({ name: 'd', w: 11, h: 11, screen: 'q', host: 'span', bgPix: 'rgb(20, 20, 20)' }),
      row({ name: 'e', w: 11, h: 11, vis: false, occluded: true, bgPix: null, screen: 'q', host: 'span' }),
      row({ name: 'e', w: 30, h: 30 }),
    ] }]);
    check('a disagreeing site lends nothing, so the occluded member falls through', s.get('e').px, 30);
    check('...but its own unoccluded members keep their OWN samples',
      [s.get('c').bg, s.get('d').bg], ['rgb(255, 255, 255)', 'rgb(20, 20, 20)']);
  }

  // 6. AN ICON WITH NO ROWS IS ABSENT, not 20 px cream. That absence is what makes
  //    `flag` unquotable, and it has to survive into the output as a hole.
  check('an unrendered icon is absent from the spec', spec([row({ name: 'x' })]).has('flag'), false);

  // 7. SMALLEST WINS AMONG USABLE SITES.
  {
    const s = spec([row({ name: 'f', w: 30, h: 30 }), row({ name: 'f', w: 12, h: 12, screen: 't' })]);
    check('smallest usable site wins', s.get('f').px, 12);
  }

  // 8. Non-square boxes are measured on the SHORT side — a 40x12 pill is a 12 px icon.
  check('a non-square box is measured on its short side', spec([row({ name: 'g', w: 40, h: 12 })]).get('g').px, 12);

  // ── POSITIVE CONTROL on the real measurement, if it is present. ────────────
  // A checker that only ever runs on fixtures proves the fixtures, not the tree.
  if (existsSync('shots/ic/delivered.json')) {
    const { spec: s } = buildSpec(['shots/ic/delivered.json']);
    check('REAL TREE: range is 13.8 px, cream on ink',
      [s.get('range').px, s.get('range').bg, s.get('range').outline],
      [13.8, 'rgb(26, 18, 36)', '#FFF3DE']);
    check('REAL TREE: all four boxes land on ONE size',
      new Set(['boxBurger', 'boxRed', 'boxPineapple', 'boxFire'].map((n) => s.get(n).px)).size, 1);
    check('REAL TREE: heal is recovered from an occluded row at 13.8 px, cream on ink',
      [s.get('heal').px, s.get('heal').outline, s.get('heal').viaOccluded],
      [13.8, '#FFF3DE', true]);
    check('REAL TREE: nothing is 20 px cream, the old fallback',
      [...s.values()].filter((v) => v.px === 20 && v.bg === LEGACY_HARNESS.bg).length, 0);
  }

  console.log(`\nic_spec selftest ${pass} pass / ${fail} fail`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
if (IS_MAIN) {
const args = process.argv.slice(2);
const files = args.filter((s) => !s.startsWith('--') && args[args.indexOf(s) - 1] !== '--out');
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'shots/ic/spec.json';
if (!files.length) {
  console.error('usage: ic_spec.mjs <delivered.json...> [--out shots/ic/spec.json]');
  process.exit(2);
}

const { spec, skipped } = buildSpec(files);
const registry = registryNames();
const unmeasured = registry ? [...registry].filter((n) => !spec.has(n)).sort() : [];

const obj = Object.fromEntries([...spec.entries()].sort((a, b) => a[1].px - b[1].px));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({
  sources: files,
  built: new Date().toISOString(),
  /** ⚠️ CONSUMERS MUST REFUSE TO PLATE THESE, not default them. */
  unmeasured,
  icons: obj,
}, null, 2));

console.log(`DELIVERED SPEC  (${spec.size} icons, ${files.length} source sweep${files.length > 1 ? 's' : ''})\n`);
console.log('ICON'.padEnd(15) + 'px'.padStart(7) + '  ' + 'PLATE'.padEnd(19) + 'OUTLINE'.padEnd(9)
  + 'POL'.padEnd(6) + 'SITE'.padEnd(30) + 'plate from');
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
for (const [n, v] of Object.entries(obj)) {
  const dark = lum(rgb(v.bg)) < 128;
  console.log(
    n.padEnd(15) + v.px.toFixed(2).padStart(7) + '  ' + v.bg.padEnd(19) + v.outline.padEnd(9)
    + (dark ? 'INVERT' : 'normal').padEnd(6)
    + `${v.where}/${v.host}`.slice(0, 29).padEnd(30)
    + (v.plateSource === 'own-pixels' ? 'own' : 'siblings') + (v.viaOccluded ? ' (occluded row: size only)' : ''),
  );
}
console.log(`\nUNMEASURED — never rendered on any swept screen, MUST NOT be plated (${unmeasured.length}): ${unmeasured.join(', ') || 'none'}`);
console.log(`sites skipped for having no clean plate: ${skipped.length}`);
console.log(`\nwrote ${out}`);
}
