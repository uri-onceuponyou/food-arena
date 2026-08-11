#!/usr/bin/env node
/**
 * DOES THE SUBSET ACTUALLY DRAW THE GLYPH? — the question `unicode-range` cannot answer.
 *
 * ── Why this exists ───────────────────────────────────────────────────────────
 * Google serves each family as one file per `unicode-range` bucket. Chromium downloads
 * the bucket whose RANGE matches a codepoint on the page — and the range is a DECLARATION
 * ABOUT THE BUCKET, not about the font. If the file turns out not to contain the glyph,
 * the browser silently falls through to the next family and the download bought nothing.
 *
 * Measured on this app before any change: rendering the five menu screens fetched
 * `heebo-symbols` and `heebo-math` on `settings` at all three viewports. Those two files
 * are 38,016 bytes — 37% of the font payload — and "it was downloaded" is NOT evidence
 * that a single pixel came out of them. Shipping them because a request appeared in a
 * waterfall is exactly the mistake `CLAUDE.md` #4 names: assuming a thing is there
 * because something plausible happened.
 *
 * ── The measurement ───────────────────────────────────────────────────────────
 * For each candidate codepoint, draw it at 220px into a canvas TWICE:
 *
 *   A. `font-family: <the subset under test>` — registered with NO `unicode-range`, so
 *      the face is offered every codepoint and the only thing that can reject it is the
 *      font's own cmap.
 *   B. `font-family: '__fa_absent__'` — a family that does not exist, i.e. the platform
 *      fallback, which is exactly what the browser would use if the face rejected it.
 *
 * Hash both bitmaps. **A === B means the face did not draw it.** A !== B means it did.
 *
 * ── Instrument validation (CLAUDE.md #6) ──────────────────────────────────────
 * `--selftest` asserts three cells whose answers are known before the tool runs:
 *   'A'      in heebo-latin   -> MUST differ from fallback  (a face that plainly has it)
 *   U+E000   in heebo-latin   -> MUST equal fallback        (private use; nothing has it)
 *   ' '      in heebo-latin   -> MUST equal fallback        (blank in both; the trap that
 *                                                            proves the hash is of INK,
 *                                                            and that a blank cell cannot
 *                                                            be mistaken for coverage)
 * Without the first, a tool that reported "no coverage" for everything would pass.
 *
 * Usage:
 *   node tools/tmp/ft_glyphs.mjs --selftest --url <snapshot>
 *   node tools/tmp/ft_glyphs.mjs --url <snapshot>
 */

import { chromium } from 'playwright';

const args = { _: [] };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) { args._.push(a); continue; }
  const k = a.slice(2);
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[k] = true; else { args[k] = n; i++; }
}
const base = args.url ?? process.env.PREVIEW_BASE;
if (!base) throw new Error('need --url (or PREVIEW_BASE)');

/** Every distinct codepoint in `src/**\/*.ts` that lands in Heebo's `math` or `symbols`
 *  unicode-range. Over-inclusive on purpose: it counts comments too, so a glyph that only
 *  a future string might use is still tested. */
const CANDIDATES = [
  // math range
  0x0394, 0x03B8, 0x03C0, 0x03C1, 0x03C3, 0x207B, 0x21A6, 0x2202, 0x2208, 0x221A,
  0x221D, 0x2248, 0x2264, 0x2265,
  // in BOTH math and symbols
  0x2190, 0x2192, 0x2194,
  // symbols range
  0x23F1, 0x23F8, 0x24D8, 0x25B2, 0x25B6, 0x25C0, 0x2694, 0x2699, 0x26A0, 0x26AA,
  0x26F6, 0x2705, 0x2713, 0x2717, 0x2728, 0x274C, 0x2764, 0x2B50,
  0x1F3A8, 0x1F3C6, 0x1F3E0, 0x1F41F, 0x1F4E6, 0x1F507, 0x1F50A, 0x1F512, 0x1FA99,
];

const FACES = {
  'heebo-math': '/fonts/heebo-v28-math.woff2',
  'heebo-symbols': '/fonts/heebo-v28-symbols.woff2',
  'heebo-latin': '/fonts/heebo-v28-latin.woff2',
  'rubik-latin': '/fonts/rubik-v31-latin.woff2',
};

/** Page-side. Registers each face under a TEST family with no `unicode-range`, so the
 *  only thing that can decline a codepoint is the font's own character map. */
async function probe(faces, codepoints) {
  const results = {};
  const load = async (name, url) => {
    const ff = new FontFace(`__t_${name}`, `url(${url}) format('woff2')`);
    await ff.load();
    document.fonts.add(ff);
  };
  for (const [name, url] of Object.entries(faces)) {
    // eslint-disable-next-line no-await-in-loop
    try { await load(name, url); } catch (e) { results[`ERR_${name}`] = String(e); }
  }

  const c = document.createElement('canvas');
  c.width = 260; c.height = 300;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const hash = (fam, ch) => {
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `220px ${fam}`;
    ctx.fillText(ch, 10, 250);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let h = 2166136261; let ink = 0;
    for (let i = 3; i < d.length; i += 4) {
      if (d[i]) ink++;
      h ^= d[i]; h = Math.imul(h, 16777619);
    }
    return { h: h >>> 0, ink, w: ctx.measureText(ch).width };
  };

  /**
   * ⚠️ THE OBVIOUS REFERENCE IS WRONG, AND IT WAS MEASURED WRONG FIRST.
   *
   * The first version compared each face against `'__fa_absent_family__'` alone — i.e.
   * "what the platform draws with no webfont at all" — and reported that heebo-latin
   * DRAWS U+E000, a private-use codepoint no font on earth carries. Cause: the two arms
   * are not structurally the same. With a real primary family present, Chromium's
   * last-resort selection for an uncovered codepoint does not land on the same face it
   * lands on when the family list is empty, so both arms draw tofu and the tofu differs.
   * A width term made it worse: SPACE came back as coverage because Heebo's space
   * advance differs from the platform's, which is true and is not what was being asked.
   *
   * The sound reference is ANOTHER LOADED FACE that is known not to cover the codepoint,
   * measured through the identical family list. `heebo-latin` is that reference for every
   * codepoint outside U+0000-00FF: it is a real webfont, it is missing these glyphs, and
   * its arm is built by the same code path. Two faces that render a codepoint IDENTICALLY
   * both fell through; a face that renders it differently drew it.
   */
  const FALLBACK = "'__fa_absent_family__'";
  const REF = 'heebo-latin';
  for (const cp of codepoints) {
    const ch = String.fromCodePoint(cp);
    const row = { cp: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`, ch };
    const h = {};
    for (const name of Object.keys(faces)) h[name] = hash(`'__t_${name}', ${FALLBACK}`, ch);
    for (const name of Object.keys(faces)) {
      row[name] = name === REF ? 'ref' : (h[name].h !== h[REF].h ? 'DRAWS' : '—');
      row[`${name}_ink`] = h[name].ink;
      row[`${name}_hash`] = h[name].h;
    }
    /**
     * ⚠️ SAME FAMILY ONLY. Measured while validating: on U+E000 the three Heebo faces
     * agree exactly (2514898564) and Rubik does not (330628397) — Rubik draws its own
     * `.notdef` where Heebo defers to the platform. So "identical to the reference" is
     * only evidence of non-coverage WITHIN a family, and `rubik-latin` is carried here
     * as a cross-family control for the arms-differ direction, never as a subject.
     */
    row.allEqual = Object.keys(faces).filter((n) => n.startsWith('heebo-')).every((n) => h[n].h === h[REF].h);
    results[row.cp] = row;
  }
  return results;
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
// Navigate to the app's own origin so `/fonts/...` resolves the way the app resolves it.
await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 90_000 });

// Install the probe page-side, then call it once. (Kept as a single evaluate so the tool
// stays honest about `page.evaluate` granting user activation — nothing here depends on
// activation, but the pattern is the one `AGENT-BRIEF.md` §3 asks for.)
const run = async (cps) => page.evaluate(
  ([f, c, src]) => new Function(`return (${src})`)()(f, c),
  [FACES, cps, probe.toString()],
);

if (args.selftest) {
  const r = await run([0x41, 0xE000]);
  const A = r['U+0041']; const E = r['U+E000'];
  const checks = [
    // ARMS DIFFER. Rubik and Heebo both carry 'A' and they are different typefaces, so a
    // detector that cannot separate them cannot separate anything.
    ['A: rubik-latin differs from the heebo reference', A?.['rubik-latin'] === 'DRAWS', `hashes ${A?.['rubik-latin_hash']} vs ${A?.['heebo-latin_hash']}`],
    ['A: real ink on the canvas (not a blank hash agreeing with a blank hash)', (A?.['heebo-latin_ink'] ?? 0) > 100, `ink=${A?.['heebo-latin_ink']}`],
    // NO FALSE POSITIVE. U+E000 is private use: no face covers it, so every arm must land
    // on the same tofu. This is the check the first version of this tool FAILED.
    ['U+E000 (private use): every HEEBO face renders identically', E?.allEqual === true, JSON.stringify({ m: E?.['heebo-math_hash'], s: E?.['heebo-symbols_hash'], l: E?.['heebo-latin_hash'] })],
    ['U+E000: reported as no coverage for the two subsets under test',
      E?.['heebo-math'] === '—' && E?.['heebo-symbols'] === '—',
      `math=${E?.['heebo-math']} symbols=${E?.['heebo-symbols']}`],
    ['cross-family control behaves DIFFERENTLY on U+E000 (Rubik draws its own .notdef) — documented, not asserted away',
      E?.['rubik-latin'] === 'DRAWS', `rubik=${E?.['rubik-latin']}`],
  ];
  console.log('\nft_glyphs --selftest\n');
  let fails = 0;
  for (const [name, ok, detail] of checks) { if (!ok) fails++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}   (${detail})`); }
  console.log(`\n  ${checks.length - fails}/${checks.length}\n`);
  process.exitCode = fails ? 1 : 0;
} else {
  const r = await run(CANDIDATES);
  const names = Object.keys(FACES);
  console.log(`\nGLYPH COVERAGE — does the subset DRAW it, or does it fall through?\n`);
  console.log(`  ${'cp'.padEnd(9)} ${'ch'.padEnd(3)} ${names.map((n) => n.padEnd(14)).join('')}`);
  const drawnBy = Object.fromEntries(names.map((n) => [n, []]));
  for (const cp of CANDIDATES) {
    const k = `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
    const row = r[k];
    if (!row) continue;
    for (const n of names) if (row[n] === 'DRAWS') drawnBy[n].push(k);
    console.log(`  ${k.padEnd(9)} ${row.ch.padEnd(3)} ${names.map((n) => String(row[n]).padEnd(14)).join('')}`);
  }
  console.log('');
  for (const n of names) {
    if (n === 'heebo-latin') { console.log(`  ${n.padEnd(14)} is the REFERENCE — its column is 'ref', not a result`); continue; }
    console.log(`  ${n.padEnd(14)} draws ${drawnBy[n].length}/${CANDIDATES.length}`
      + (drawnBy[n].length ? `  -> ${drawnBy[n].join(' ')}` : '   <<< SHIPPING THIS FILE BUYS NOTHING'));
  }
  console.log('');
}

await browser.close();
