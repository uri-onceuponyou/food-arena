#!/usr/bin/env node
/**
 * ONE-SHOT CODEMOD — replace hand-typed CSS values with the `--ds-*` tokens they are
 * already equal (or nearest) to, inside the stylesheet template literal of ONE file.
 *
 * ── Why a codemod and not ninety Edit calls ────────────────────────────────────
 * `ds_inventory` says the number to steer an adoption wave by is TOKEN COVERAGE, and
 * coverage only moves one declaration at a time. `home.ts` and `characterSelect.ts`
 * carry 217 tracked declarations between them and 9 of them point at a token. Doing
 * that by hand is where a transcription error gets introduced into a stylesheet nobody
 * re-reads.
 *
 * ── 🚨 THE THREE TRAPS THIS FILE EXISTS TO NOT FALL INTO ───────────────────────
 *  1. **A CSS COMMENT IS PROSE, AND THIS REPO'S COMMENTS QUOTE CSS.** `home.ts` has
 *     `The 'font-size: 0.7rem' below IS under theme.ts's 0.72rem floor` in a comment,
 *     recording a measurement. A regex over the file rewrites that sentence and
 *     destroys the record. So the pass is a state machine that SKIPS `/* ... *\/`
 *     entirely and only ever rewrites text it has proved is a declaration.
 *  2. **A BACKTICK ANYWHERE IN THE LITERAL 500s THE DEV SERVER FOR EVERY AGENT.**
 *     CLAUDE.md's non-negotiable, bitten four times. No replacement value here contains
 *     one, and `--selftest` asserts that the output of every mapping is backtick-free —
 *     an assertion that would fail if someone added a clever template to the table.
 *  3. **`${}` IS A JS SUBSTITUTION, NOT CSS.** Rewriting inside one produces valid CSS
 *     and invalid TypeScript. Substitutions are skipped with the comments.
 *
 * ── What it will NOT do, on purpose ───────────────────────────────────────────
 * `box-shadow` and `font-size` are NOT in the table. Both need a judgement the table
 * cannot encode: a shadow has to be assigned an ELEVATION (is this thing a chip or a
 * panel?) and a size has to be assigned a RUNG (is this a label or a numeral?) — and
 * assigning every 0.7rem to the same rung is precisely the "one size jittered 26 ways"
 * defect, re-typed as a token. Those two are hand-edited, per site, with the meaning in
 * front of the reader.
 *
 * ── Instrument validation (CLAUDE.md non-negotiable #6) ───────────────────────
 * `--selftest` runs the transform over synthetic sources whose answers are known by
 * construction, INCLUDING the known-bad inputs a naive implementation gets wrong:
 * a matching value inside a comment, a matching value inside `${}`, a value on a
 * property NOT in the table, a comment containing an unbalanced quote, and a value that
 * is a substring of a longer one (`2px` inside `12px`). A guard that has not been shown
 * to FAIL on the bug it guards against is not a guard.
 *
 * Usage:
 *   node tools/tmp/da_tokenise.mjs --selftest
 *   node tools/tmp/da_tokenise.mjs src/ui/screens/home.ts --dry
 *   node tools/tmp/da_tokenise.mjs src/ui/screens/home.ts --write
 */

import { readFile, writeFile } from 'node:fs/promises';

/**
 * THE TABLE. Keyed by property, then by the exact authored value.
 *
 * Every rung is `theme.ts`'s, and every mapping is either an EXACT equality or a
 * documented snap to the nearest rung. The snaps are listed rather than hidden, because
 * a snap is a geometry change and this pass is not pixel-neutral:
 *
 *   radius   10 / 11 / 13 / 14px -> 12px   (the working radius, mode of the 10-14 band)
 *            18px                -> 16px   (the panel radius)
 *            2px                 ->  3px   (the inner-clip radius)
 *   stroke   2.5px               ->  2px   (theme.ts: "2.5px is drift", n=16, one file)
 *   track    0.05 / 0.06em       -> 0.04em  0.1 / 0.11em -> 0.09em
 */
export const TABLE = {
  radius: {
    props: ['border-radius', 'border-top-left-radius', 'border-top-right-radius',
      'border-bottom-left-radius', 'border-bottom-right-radius', 'border-start-start-radius',
      'border-start-end-radius', 'border-end-start-radius', 'border-end-end-radius'],
    map: {
      '999px': 'var(--ds-r-pill)',
      '50%': 'var(--ds-r-round)',
      '18px': 'var(--ds-r-3)',
      '16px': 'var(--ds-r-3)',
      '14px': 'var(--ds-r-2)',
      '13px': 'var(--ds-r-2)',
      '12px': 'var(--ds-r-2)',
      '11px': 'var(--ds-r-2)',
      '10px': 'var(--ds-r-2)',
      '3px': 'var(--ds-r-1)',
      '2px': 'var(--ds-r-1)',
    },
  },
  borderWidth: {
    props: ['border-width', 'border-top-width', 'border-bottom-width', 'border-left-width', 'border-right-width'],
    map: {
      '4px': 'var(--ds-stroke-3)',
      '3px': 'var(--ds-stroke-2)',
      '2.5px': 'var(--ds-stroke-1)',
      '2px': 'var(--ds-stroke-1)',
    },
  },
  /** The shorthand. Only the WIDTH atom moves; style and colour are left alone, because
   *  a colour is a design decision and the ink line is already a token. */
  border: {
    props: ['border', 'border-top', 'border-bottom', 'border-left', 'border-right', 'border-block', 'border-inline'],
    prefix: {
      '4px ': 'var(--ds-stroke-3) ',
      '3px ': 'var(--ds-stroke-2) ',
      '2.5px ': 'var(--ds-stroke-1) ',
      '2px ': 'var(--ds-stroke-1) ',
    },
  },
  fontWeight: {
    props: ['font-weight'],
    map: { '900': 'var(--ds-w-black)', '800': 'var(--ds-w-bold)', '700': 'var(--ds-w-body)' },
  },
  letterSpacing: {
    props: ['letter-spacing'],
    map: {
      '0.12em': 'var(--ds-track-caps)',
      '0.11em': 'var(--ds-track-caps)',
      '0.1em': 'var(--ds-track-caps)',
      '0.09em': 'var(--ds-track-caps)',
      '0.06em': 'var(--ds-track)',
      '0.05em': 'var(--ds-track)',
      '0.04em': 'var(--ds-track)',
      '0.03em': 'var(--ds-track)',
      '0.02em': 'var(--ds-track-tight)',
      '0.01em': 'var(--ds-track-tight)',
    },
  },
};

const PROP_TO_ENTRY = new Map();
for (const entry of Object.values(TABLE)) for (const p of entry.props) PROP_TO_ENTRY.set(p, entry);

/**
 * Rewrite the declarations in a CSS string.
 *
 * The scanner is deliberately dumb about CSS and careful about the two things that can
 * hurt: it copies `/* ... *\/` and `${ ... }` through verbatim and never inspects them,
 * and it only considers text between a `{`/`;` and the next `;`/`}` as a declaration.
 */
export function tokeniseCss(css) {
  let out = '';
  const hits = [];
  let i = 0;
  let buf = '';                 // the current declaration candidate
  const flush = () => {
    if (!buf) return;
    const m = /^(\s*)([-a-zA-Z]+)(\s*:\s*)([\s\S]*)$/.exec(buf);
    if (m) {
      const [, lead, prop, colon, rawVal] = m;
      const entry = PROP_TO_ENTRY.get(prop);
      // A value carrying a `${}` was copied through by the scanner and never reaches
      // here as a whole; guard anyway, because a partial rewrite is worse than none.
      if (entry && !rawVal.includes('${') && !rawVal.includes('`')) {
        const val = rawVal.trim();
        let next = null;
        if (entry.map && Object.hasOwn(entry.map, val)) next = entry.map[val];
        else if (entry.prefix) {
          for (const [k, v] of Object.entries(entry.prefix)) {
            if (val.startsWith(k)) { next = v + val.slice(k.length); break; }
          }
        }
        if (next !== null && next !== val) {
          hits.push({ prop, from: val, to: next });
          buf = `${lead}${prop}${colon}${next}`;
        }
      }
    }
    out += buf;
    buf = '';
  };

  while (i < css.length) {
    // A CSS comment. Copied verbatim, never inspected. This is trap 1.
    if (css.startsWith('/*', i)) {
      flush();
      const end = css.indexOf('*/', i + 2);
      const stop = end < 0 ? css.length : end + 2;
      out += css.slice(i, stop);
      i = stop;
      continue;
    }
    // A JS substitution. Copied verbatim. This is trap 3.
    if (css.startsWith('${', i)) {
      const end = css.indexOf('}', i + 2);
      const stop = end < 0 ? css.length : end + 1;
      buf += css.slice(i, stop);
      i = stop;
      continue;
    }
    const ch = css[i];
    if (ch === ';' || ch === '{' || ch === '}') {
      flush();
      out += ch;
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  flush();
  return { css: out, hits };
}

/** Split a TS source at the first `const CSS = \`` and transform only the literal. */
export function tokeniseSource(src) {
  const marker = /const CSS\s*=\s*`/.exec(src);
  if (!marker) return { src, hits: [], found: false };
  const start = marker.index + marker[0].length;
  const end = src.lastIndexOf('`');
  if (end <= start) return { src, hits: [], found: false };
  const { css, hits } = tokeniseCss(src.slice(start, end));
  return { src: src.slice(0, start) + css + src.slice(end), hits, found: true };
}

// ── Selftest ──────────────────────────────────────────────────────────────────

function selftest() {
  let pass = 0; let fail = 0;
  const t = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) pass++; else fail++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`}`);
  };

  // The happy path, and it asserts the OUTPUT rather than the hit count — a transform
  // that reported a hit and wrote nothing would pass a count-only check.
  t('a plain declaration is rewritten',
    tokeniseCss('.a { border-radius: 999px; }').css,
    '.a { border-radius: var(--ds-r-pill); }');

  // KNOWN-BAD 1: the same value INSIDE A COMMENT. `home.ts` records measurements this
  // way and a regex over the file destroys them.
  t('a matching value inside a comment is untouched',
    tokeniseCss('/* was border-radius: 999px, see the note */ .a { color: red; }').css,
    '/* was border-radius: 999px, see the note */ .a { color: red; }');
  t('a comment before a real declaration does not stop the real one',
    tokeniseCss('/* border-radius: 999px */ .a { border-radius: 999px; }').hits.length, 1);

  // KNOWN-BAD 2: a `${}` substitution. Rewriting inside one makes valid CSS and invalid
  // TypeScript.
  t('a value inside a substitution is untouched',
    tokeniseCss('.a { background: ${PORTRAIT_BG_CSS}; border-radius: 999px; }').css,
    '.a { background: ${PORTRAIT_BG_CSS}; border-radius: 999px; }'.replace('999px', 'var(--ds-r-pill)'));

  // KNOWN-BAD 3: a property NOT in the table whose value happens to match one that is.
  // `top: 3px` must not become a stroke token.
  t('an untabled property is untouched',
    tokeniseCss('.a { top: 3px; padding: 999px; }').hits.length, 0);

  // KNOWN-BAD 4: SUBSTRING. `12px` contains `2px`; a naive replace turns
  // `border-radius: 12px` into `1var(--ds-r-1)`.
  t('12px is not treated as 2px',
    tokeniseCss('.a { border-radius: 12px; }').css,
    '.a { border-radius: var(--ds-r-2); }');

  // KNOWN-BAD 5: the SHORTHAND. Only the width atom moves; the colour survives.
  t('the border shorthand moves only its width',
    tokeniseCss('.a { border: 3px solid var(--ink); }').css,
    '.a { border: var(--ds-stroke-2) solid var(--ink); }');
  t('a non-matching border shorthand is untouched',
    tokeniseCss('.a { border: 1px dashed red; }').hits.length, 0);

  // KNOWN-BAD 6: a MULTI-VALUE declaration on a tabled property must not be half-eaten.
  // `border-radius: 46% 46% 4% 4% / 30% ...` is home.ts's alcove and has no token.
  t('a multi-value radius with no exact match is untouched',
    tokeniseCss('.a { border-radius: 46% 46% 4% 4% / 30% 30% 2% 2%; }').hits.length, 0);

  // KNOWN-BAD 7: NO BACKTICK MAY EVER BE EMITTED. CLAUDE.md's non-negotiable; bitten
  // four times. This asserts the TABLE, so it fails the moment someone adds a clever
  // template value to it rather than only when a file happens to break.
  {
    const vals = [];
    for (const e of Object.values(TABLE)) {
      for (const v of Object.values(e.map ?? {})) vals.push(v);
      for (const v of Object.values(e.prefix ?? {})) vals.push(v);
    }
    t('no replacement value contains a backtick or a substitution',
      vals.filter((v) => v.includes('`') || v.includes('${')).length, 0);
  }

  // KNOWN-BAD 8: an UNTERMINATED comment must not swallow the file silently AND must
  // not throw. It copies the remainder through, which loses conversions and loses
  // nothing else.
  t('an unterminated comment is copied, not crashed on',
    tokeniseCss('.a { border-radius: 999px; } /* oops').css,
    '.a { border-radius: var(--ds-r-pill); } /* oops');

  // KNOWN-BAD 9: SOURCE SPLITTING. Everything before `const CSS = \`` is markup and
  // TypeScript, and an inline `style="border-radius:999px"` there must survive.
  {
    const src = 'const html = \'<i style="border-radius: 999px">\';\nconst CSS = `\n.a { border-radius: 999px; }\n`;\n';
    const r = tokeniseSource(src);
    t('only the stylesheet literal is transformed',
      [r.hits.length, r.src.includes('style="border-radius: 999px"')], [1, true]);
  }
  t('a file with no stylesheet literal is a no-op', tokeniseSource('const x = 1;').found, false);

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
if (argv.includes('--selftest')) selftest();
else {
  const file = argv.find((a) => !a.startsWith('--'));
  if (!file) { console.error('da_tokenise: need a file path'); process.exit(2); }
  const src = await readFile(file, 'utf8');
  const r = tokeniseSource(src);
  if (!r.found) { console.error(`da_tokenise: no "const CSS = \`" in ${file}`); process.exit(2); }
  const by = new Map();
  for (const h of r.hits) {
    const k = `${h.prop}: ${h.from} -> ${h.to}`;
    by.set(k, (by.get(k) ?? 0) + 1);
  }
  console.log(`\n${file} — ${r.hits.length} declarations would move to a token\n`);
  for (const [k, n] of [...by].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}x  ${k}`);
  if (argv.includes('--write')) {
    await writeFile(file, r.src);
    console.log(`\n  WRITTEN. Re-run tsc and menu_accept.\n`);
  } else {
    console.log('\n  (dry run — pass --write to apply)\n');
  }
}
