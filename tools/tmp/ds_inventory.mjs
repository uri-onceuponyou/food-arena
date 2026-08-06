#!/usr/bin/env node
/**
 * DESIGN-SYSTEM INVENTORY — count every authored CSS value in `src/ui/`, by property
 * and by file, so "the menus look amateurish" has a number attached to it.
 *
 * ── Why this exists ────────────────────────────────────────────────────────────
 * Uri, on the shipped build: *"The character and scenery is a lot better. But the
 * text, menu boxes, icons, bars, etc still look amateurish."* The measured cause is
 * not any one screen's taste — it is that **there is no shared component language**.
 * Class prefixes are per-screen (`.fa-home`, `.fa-chars`, `.fa-tr`, `.fa-shop`,
 * `.fa-set`), every screen re-implements its own panel/button/bar, and the values each
 * one picks drift. This tool counts that drift.
 *
 * ── Why it PARSES rather than greps (LESSONS §9) ───────────────────────────────
 * Every stylesheet on this project lives inside a JS template literal, and this repo
 * has already been bitten four times by treating that as text. A regex over the file
 * cannot tell a CSS declaration from a string in a `data-*` attribute, from a comment,
 * or from a nested `${}` expression. So the extraction runs `ts.createSourceFile` and
 * pulls the template-literal NODES out of the AST; the CSS parse is then a small
 * hand-rolled brace/quote/comment state machine over that text, which is enough because
 * the input is known-good CSS (`menu_accept` already lints it) rather than arbitrary.
 *
 * ── What counts as "distinct" ──────────────────────────────────────────────────
 * The DECLARATION VALUE, normalised for whitespace and case only. `0 4px 0
 * rgba(0,0,0,.35)` and `0 4px 0 rgba(0,0,0,0.35)` are counted as ONE, because a
 * design system's job is to stop humans typing either of them — but `0 4px 0
 * rgba(0,0,0,.35)` and `0 5px 0 rgba(0,0,0,.35)` are TWO, because that 1px is exactly
 * the drift being measured. Multi-shadow declarations are counted whole (the
 * declaration is the thing an author writes) AND split into layers (reported
 * separately), because a stack of four shadows is one authoring decision but four
 * physical facts.
 *
 * ── ⚠️ WHAT THIS DOES NOT MEASURE, stated up front (LESSONS §6b) ───────────────
 * This counts TIDINESS. It does not count QUALITY. A stylesheet with exactly 4 radii,
 * 5 shadows and 7 sizes can still be ugly, and — §6b read backwards — the change that
 * actually fixes what Uri sees may not move any of these numbers at all. Specifically
 * blind to:
 *   * whether the values chosen are GOOD ones,
 *   * whether a component is used in the right PLACE,
 *   * FUNCTIONAL DIFFERENTIATION — a screen where every box is the same tidy panel
 *     scores PERFECTLY here and is precisely the defect the reference plates show
 *     (`bs_home` runs three distinct box treatments by job: dark utility, gold action,
 *     pill counter),
 *   * anything about type other than its size: rhythm, tracking, colour, hierarchy,
 *   * layout, spacing composition, icon quality, and every pixel of the result.
 * The close-out for those is the PNG, read by eye. This number is the floor, not the bar.
 *
 * ── Instrument validation (CLAUDE.md non-negotiable #6) ────────────────────────
 * `--selftest` runs the whole pipeline over synthetic sources whose answers are known
 * by construction, INCLUDING known-bad ones the naive implementations get wrong:
 * a backtick inside a CSS comment, a `${}` substitution, a `//`-comment containing a
 * fake declaration, a value inside a quoted string, and a duplicate value that must
 * count twice in occurrences and once in distincts. A guard that has not been shown to
 * FAIL on the bug it guards against is not a guard.
 *
 * Usage:
 *   node tools/tmp/ds_inventory.mjs --selftest
 *   node tools/tmp/ds_inventory.mjs                 # summary table
 *   node tools/tmp/ds_inventory.mjs --long          # + the full long tail
 *   node tools/tmp/ds_inventory.mjs --json out.json
 *   node tools/tmp/ds_inventory.mjs --gate          # exit 1 if a budget is exceeded
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';

const ROOT = resolve(process.argv[1], '../../..');
const UI_DIR = join(ROOT, 'src/ui');

/** Properties whose values we inventory. Longhand and shorthand both, because a
 *  system that only fixes `border-radius` while `border-top-left-radius` drifts has
 *  fixed nothing. */
const TRACKED = {
  radius: [
    'border-radius', 'border-top-left-radius', 'border-top-right-radius',
    'border-bottom-left-radius', 'border-bottom-right-radius',
  ],
  shadow: ['box-shadow'],
  textShadow: ['text-shadow'],
  fontSize: ['font-size'],
  fontWeight: ['font-weight'],
  letterSpacing: ['letter-spacing'],
  borderWidth: ['border-width', 'border-top-width', 'border-bottom-width', 'border-left-width', 'border-right-width'],
  border: ['border', 'border-top', 'border-bottom', 'border-left', 'border-right'],
  gap: ['gap', 'row-gap', 'column-gap'],
  padding: ['padding'],
};
const PROP_TO_GROUP = new Map();
for (const [g, props] of Object.entries(TRACKED)) for (const p of props) PROP_TO_GROUP.set(p, g);

/** Budgets a design system should hold to. Sourced from the brief's own targets. */
const BUDGET = { radius: 5, shadow: 8, fontSize: 9, fontWeight: 3 };

// ── Extraction ────────────────────────────────────────────────────────────────

/**
 * Every template-literal body in a TS source, via the real parser.
 *
 * `NoSubstitutionTemplateLiteral` gives `.text` directly. A `TemplateExpression`
 * (one with `${}` in it) is the concatenation of its head and each span's literal —
 * the substituted EXPRESSIONS are deliberately dropped, because a `${rgba(x,0.4)}`
 * is a value this inventory cannot resolve statically and guessing would be worse
 * than a known gap. Reported as `substitutions` so the gap is visible rather than
 * silent.
 */
export async function templateLiterals(src, path) {
  const { default: ts } = await import('typescript');
  const sf = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const errors = (sf.parseDiagnostics ?? []).length;
  const out = [];
  let subs = 0;
  const walk = (node) => {
    if (ts.isNoSubstitutionTemplateLiteral(node)) {
      out.push(node.text);
    } else if (ts.isTemplateExpression(node)) {
      let text = node.head.text;
      for (const span of node.templateSpans) { text += ' '; text += span.literal.text; subs++; }
      out.push(text);
    }
    ts.forEachChild(node, walk);
  };
  ts.forEachChild(sf, walk);
  return { texts: out, substitutions: subs, errors };
}

/**
 * Declarations out of a CSS string.
 *
 * A state machine, not a regex, for three reasons that all showed up in this file's
 * own inputs: `/* *​/` comments contain colons and semicolons; `url()` and
 * `rgba(0,0,0,.35)` contain commas that a naive split would break on; and
 * `content: ';'` contains a semicolon inside a quoted string. Depth is tracked so a
 * declaration inside `@media { .x { } }` is still seen (this project has several).
 *
 * Returns `{prop, value, line}` for every declaration, and `selectors` for context.
 */
export function cssDeclarations(css) {
  const decls = [];
  let i = 0;
  let buf = '';
  let line = 1;
  let depth = 0;
  const n = css.length;
  const flush = (startLine) => {
    const t = buf.trim();
    buf = '';
    if (!t) return;
    const c = t.indexOf(':');
    if (c < 0) return;
    const prop = t.slice(0, c).trim().toLowerCase();
    const value = t.slice(c + 1).trim();
    // `@media (min-width: 700px)` and friends are at-rule preludes, not declarations —
    // but those never reach here because a prelude is flushed by `{`, not by `;`.
    // A declaration lives inside a BLOCK. Requiring depth >= 1 is what stops an HTML
    // template literal's `&nbsp;`-terminated fragments and any stray top-level text
    // from being mistaken for CSS — the same class of false positive as §9's regex
    // guard that cried wolf and was then ignored.
    if (depth < 1) return;
    if (!prop || !value || prop.startsWith('@') || /[{}]/.test(prop)) return;
    decls.push({ prop, value, line: startLine, depth });
  };
  let declLine = 1;
  while (i < n) {
    const ch = css[i];
    if (ch === '\n') { line++; i++; buf += ch; continue; }
    // Comment
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const chunk = css.slice(i, end < 0 ? n : end + 2);
      for (const c of chunk) if (c === '\n') line++;
      i = end < 0 ? n : end + 2;
      continue;
    }
    // Quoted string — copied verbatim so a `;` or `:` inside it cannot terminate.
    if (ch === '"' || ch === "'") {
      const q = ch;
      let j = i + 1;
      while (j < n && css[j] !== q) { if (css[j] === '\\') j++; if (css[j] === '\n') line++; j++; }
      buf += css.slice(i, Math.min(j + 1, n));
      i = j + 1;
      continue;
    }
    // Parenthesised — copied verbatim (rgba, clamp, url, repeating-linear-gradient).
    if (ch === '(') {
      let j = i;
      let d = 0;
      while (j < n) {
        if (css[j] === '(') d++;
        else if (css[j] === ')') { d--; if (d === 0) break; }
        else if (css[j] === '\n') line++;
        j++;
      }
      buf += css.slice(i, Math.min(j + 1, n));
      i = j + 1;
      continue;
    }
    if (ch === '{') { depth++; buf = ''; declLine = line; i++; continue; }
    if (ch === '}') { flush(declLine); depth--; declLine = line; i++; continue; }
    if (ch === ';') { flush(declLine); declLine = line; i++; continue; }
    if (buf === '') declLine = line;
    buf += ch;
    i++;
  }
  return decls;
}

/**
 * ORPHANED PROSE — text that ended up OUTSIDE a comment and is silently eating a rule.
 *
 * ── Why this exists: it bit this pass, live ────────────────────────────────────
 * `docs/LESSONS.md` §9 names it and says the TypeScript parser CANNOT catch it,
 * "because it is valid TypeScript. Only a screenshot found it." Editing a comment in
 * `theme.ts` put four lines of prose after the block's close marker, which made them
 * CSS. The browser then discards an unparseable prelude AND the rule attached to it,
 * so `.ds-banner` would have vanished, `tsc` would have stayed clean, and nothing in the
 * ~25-gate battery looks at whether a rule survived parsing.
 *
 * A screenshot is not a general answer: this layer ships unused, so no product
 * screenshot contains it, and the same edit in any screen file would be caught only if
 * a human happened to look at the right element.
 *
 * The check: a comment's close marker is followed by a PRELUDE (everything up to the
 * next brace or semicolon). A real prelude is a selector or an at-rule and uses a
 * narrow character set. Prose does not: em-dashes, box-drawing rules, apostrophes,
 * warning signs and full sentences all fall outside it. Validated against known-bad
 * AND known-good inputs in `--selftest`, including the exact text that caused this.
 */
const SELECTOR_OK = /^[A-Za-z0-9_\-.#:>+~*[\]="'()\s,^$|@&/%]*$/;
/** Every bare element selector this codebase actually uses at the top level. A prelude
 *  part whose first token is none of these and does not start with a selector sigil is
 *  not a selector — it is prose. */
const TAGS = new Set(['html', 'body', 'div', 'span', 'button', 'section', 'aside', 'main',
  'header', 'footer', 'nav', 'p', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5',
  'h6', 'input', 'label', 'hr', 'svg', 'canvas', 'img', 'table', 'tr', 'td', 'th',
  'form', 'select', 'option', 'textarea', 'strong', 'em', 'small', 'b', 'i', 'from', 'to']);

export function orphanedProse(css) {
  const out = [];
  let i = 0;
  let line = 1;
  let depth = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '\n') { line++; i++; continue; }
    if (ch === '{') { depth++; i++; continue; }
    if (ch === '}') { depth--; i++; continue; }
    if (ch === '"' || ch === "'") {
      const q = ch; let j = i + 1;
      while (j < css.length && css[j] !== q) { if (css[j] === '\\') j++; if (css[j] === '\n') line++; j++; }
      i = j + 1; continue;
    }
    if (ch !== '/' || css[i + 1] !== '*') { i++; continue; }
    const at = i;
    const end = css.indexOf('*' + '/', at + 2);
    if (end < 0) { out.push({ line, text: 'UNTERMINATED comment' }); break; }
    for (let k = at; k < end; k++) if (css[k] === '\n') line++;
    // Text after a comment INSIDE a block is part of a declaration ("color: /* why */
    // red;") and is legitimate. Only a top-level prelude can eat a whole rule.
    if (depth > 0) { i = end + 2; continue; }
    let j = end + 2;
    let prelude = '';
    while (j < css.length && !'{};'.includes(css[j])) { prelude += css[j]; j++; }
    i = end + 2;
    // Two comments in a row are normal ("/* a */ /* b */ .sel {"), and the text between
    // this comment's end and the NEXT one's start is the only prelude this iteration
    // owns -- the outer loop reaches the next comment on a later pass. Without this cut
    // the guard reported 9 false positives on the real tree, every one of them an
    // adjacent comment pair, and a lint that cries wolf gets ignored (LESSONS 9).
    const cut = prelude.indexOf('/' + '*');
    const t = (cut >= 0 ? prelude.slice(0, cut) : prelude).trim();
    if (!t) continue;
    if (cut >= 0) continue;
    // (a) characters no selector can contain
    if (!SELECTOR_OK.test(t)) { out.push({ line, text: t.replace(/\s+/g, ' ').slice(0, 90) }); continue; }
    // (b) terminated by ; or } rather than { -- a selector is ALWAYS followed by a block
    if (j >= css.length || css[j] !== '{') { out.push({ line, text: t.replace(/\s+/g, ' ').slice(0, 90) }); continue; }
    // (c) a comma-separated part whose first token is neither a sigil nor a known tag.
    //     This is what catches PLAIN-ASCII prose, which (a) cannot see at all -- the
    //     first version of this guard was a unicode detector wearing a CSS guard's name,
    //     and its own known-bad test said so.
    const bad = t.split(',').some((part) => {
      const first = part.trim().split(/[\s>+~]+/)[0] ?? '';
      if (!first) return false;
      if (/^[.#:*[@&]/.test(first)) return false;
      return !TAGS.has(first.toLowerCase().replace(/[.#:[].*$/, ''));
    });
    if (bad) out.push({ line, text: t.replace(/\s+/g, ' ').slice(0, 90) });
  }
  return out;
}

/** Whitespace/case normalisation ONLY, plus `.35` -> `0.35`. Everything else is a
 *  real difference and is meant to be counted. */
export function normValue(v) {
  return v
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',')
    .replace(/(^|[\s,(])\.(\d)/g, '$10.$2')
    .trim()
    .toLowerCase();
}

/**
 * The LENGTH LITERALS inside a value — the ATOMS a scale is actually made of.
 *
 * Counting declarations alone over-counts wildly on this codebase, because almost every
 * size is a `clamp(0.7rem, 1.7vh, 0.95rem)`: three atoms, one declaration, and every
 * clamp triple is unique by construction, so 128 font-size declarations produce 102
 * "distinct values" while telling you nothing about which SIZES exist. Counting atoms
 * alone under-counts, because it throws away the fact that two authors picked different
 * triples around the same atoms. **Both are reported. Neither is the number.**
 *
 * `vh`/`vw`/`%` atoms are collected separately from absolute `px`/`rem`/`em` ones: a vh
 * coefficient is a RESPONSIVE SLOPE, not a step on a type scale, and mixing them makes
 * the tail look twice as long as it is.
 */
export function lengthAtoms(v) {
  const abs = [];
  const rel = [];
  const re = /(-?\d*\.?\d+)(px|rem|em|vh|vw|vmin|vmax|%)/g;
  let m;
  while ((m = re.exec(v))) {
    const unit = m[2];
    const num = String(parseFloat(m[1]));
    (unit === 'px' || unit === 'rem' || unit === 'em' ? abs : rel).push(`${num}${unit}`);
  }
  return { abs, rel };
}

/** Split a multi-layer shadow into its layers, respecting parens. */
export function shadowLayers(v) {
  const out = [];
  let d = 0; let cur = '';
  for (const ch of v) {
    if (ch === '(') d++;
    else if (ch === ')') d--;
    if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.map(normValue).filter(Boolean);
}

// ── Inventory ─────────────────────────────────────────────────────────────────

async function listUiSources(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await listUiSources(p));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out.sort();
}

export async function inventory(files) {
  /** group -> normValue -> { n, files: Map<file, n> } */
  const groups = new Map();
  /** group -> value -> count, for declarations that ONLY point at a token. Adoption,
   *  not drift: this number should go UP as the five screens adopt the layer. */
  const refs = new Map();
  /** Every custom-property DEFINITION in src/ui, by prefix. The token layer's own
   *  values are invisible to `groups` (a `--ds-e2` definition is not a `box-shadow`
   *  declaration), so without this the system could define fifty shadows and the
   *  counter would report zero. The design system's SIZE is literals + tokens. */
  const tokenDefs = new Map();
  /** Prose that escaped its comment and is now silently eating a CSS rule. */
  const orphans = [];
  const perFile = new Map();
  let totalDecls = 0;
  let totalSubs = 0;
  const shadowLayerBag = new Map();
  /** group -> atom -> count, for absolute and relative units separately. */
  const atomsAbs = new Map();
  const atomsRel = new Map();

  for (const f of files) {
    const src = await readFile(f, 'utf8');
    const { texts, substitutions } = await templateLiterals(src, f);
    totalSubs += substitutions;
    const short = relative(join(ROOT, 'src/ui'), f);
    let fileDecls = 0;
    for (const text of texts) {
      for (const o of orphanedProse(text)) orphans.push({ file: short, ...o });
      // Only bodies that are plausibly stylesheets. A template literal of HTML has
      // braces but no `prop: value;` pairs at depth >= 1; requiring a tracked property
      // is both cheap and exact, since an HTML string containing `font-size: 12px`
      // inside a style attribute IS authored CSS and SHOULD be counted.
      const decls = cssDeclarations(text);
      for (const d of decls) {
        if (d.prop.startsWith('--')) {
          const pre = d.prop.startsWith('--ds-') ? '--ds-*' : '--other';
          if (!tokenDefs.has(pre)) tokenDefs.set(pre, new Map());
          tokenDefs.get(pre).set(d.prop, normValue(d.value));
          continue;
        }
        const g = PROP_TO_GROUP.get(d.prop);
        if (!g) continue;
        totalDecls++; fileDecls++;
        const key = normValue(d.value);
        if (!groups.has(g)) { groups.set(g, new Map()); refs.set(g, new Map()); }
        const ref = isTokenRef(d.value);
        const bag = ref ? refs.get(g) : groups.get(g);
        if (!bag.has(key)) bag.set(key, { n: 0, files: new Map() });
        const e = bag.get(key);
        e.n++;
        e.files.set(short, (e.files.get(short) ?? 0) + 1);
        if (ref) continue;
        if (g === 'shadow') {
          for (const layer of shadowLayers(d.value)) {
            shadowLayerBag.set(layer, (shadowLayerBag.get(layer) ?? 0) + 1);
          }
        }
        const { abs, rel } = lengthAtoms(d.value);
        if (!atomsAbs.has(g)) { atomsAbs.set(g, new Map()); atomsRel.set(g, new Map()); }
        for (const a of abs) atomsAbs.get(g).set(a, (atomsAbs.get(g).get(a) ?? 0) + 1);
        for (const a of rel) atomsRel.get(g).set(a, (atomsRel.get(g).get(a) ?? 0) + 1);
      }
    }
    if (fileDecls) perFile.set(short, fileDecls);
  }
  return { groups, refs, tokenDefs, orphans, perFile, totalDecls, totalSubs, shadowLayerBag, atomsAbs, atomsRel };
}

/**
 * Strip every `var(--x, fallback)` group from a value, respecting nesting.
 *
 * ── Why this exists, and it is a CORRECTION to this tool's first version ───────
 * The first run of this inventory after the token layer landed reported the counts
 * going UP: font-size 102 -> 109 distinct, box-shadow 53 -> 64. Nothing had drifted.
 * The seven `.ds-tN { font-size: var(--ds-tN) }` rules and the eleven components that
 * say `box-shadow: var(--ds-e2)` were each counted as ANOTHER DISTINCT VALUE — so the
 * metric scored a design system as worse than the mess it replaces, and would have
 * scored every future adoption as a regression.
 *
 * That is `docs/LESSONS.md` 6b in its exact form: an acceptance test that measures
 * something adjacent to what you care about. The quantity that matters is how many
 * distinct LITERAL values a human typed; a declaration that only points at a token is
 * the opposite of drift and must be counted as such, or the metric fights the work.
 *
 * Caught before any number was quoted. The count it replaces was wrong, not the CSS.
 */
export function stripVars(v) {
  let out = '';
  let i = 0;
  while (i < v.length) {
    const at = v.indexOf('var(', i);
    if (at < 0) { out += v.slice(i); break; }
    out += v.slice(i, at);
    let d = 0; let j = at + 3;
    for (; j < v.length; j++) {
      if (v[j] === '(') d++;
      else if (v[j] === ')') { d--; if (d === 0) break; }
    }
    // The FALLBACK inside var(--x, 12px) is a real authored literal and is kept, so a
    // component hiding a hard-coded size in a fallback still shows up in the count.
    const inner = v.slice(at + 4, j);
    const comma = inner.indexOf(',');
    if (comma >= 0) out += ` ${inner.slice(comma + 1)} `;
    i = j + 1;
  }
  return out;
}

/** A value is a PURE TOKEN REFERENCE when nothing is left after the vars come out but
 *  whitespace, commas and structural keywords. `0 3px 0 var(--ds-lip)` is NOT one —
 *  the 3px is still a literal somebody typed. */
export function isTokenRef(v) {
  const rest = stripVars(v).replace(/[\s,]+/g, ' ').trim();
  if (!rest) return true;
  return rest.split(' ').every((w) => ['inset', 'solid', 'dashed', 'dotted', 'none', '0', '0px'].includes(w));
}

/**
 * Decompose every `font-size: clamp(min, slope, max)` into its three parts.
 *
 * This is the step that turns "102 distinct font sizes" from a scary number into an
 * actionable one. Every size on this project is authored as a clamp, and a clamp triple
 * is unique almost by construction — so the declaration count measures *how many times
 * somebody typed a clamp*, not how many SIZES exist. The sizes live in the MAX (what a
 * desktop renders) and the MIN (what a 390px-tall landscape phone renders); the middle
 * term is a responsive slope, not a step.
 *
 * Clustering the MAX at 0.06rem — roughly 1px at a 16px root — is what recovers the
 * scale. 0.06 was not chosen to make the answer pretty: it is the smallest gap that a
 * reader can distinguish at these sizes, and the histogram below has visible gaps wider
 * than it between clusters and nothing but ties inside them.
 */
export function typeClamps(bag) {
  const rows = [];
  for (const [val, e] of bag) {
    const m = /^clamp\(([^,]+),([^,]+),([^)]+)\)$/.exec(val);
    if (m) {
      rows.push({ min: m[1].trim(), slope: m[2].trim(), max: m[3].trim(), n: e.n, raw: val });
    } else {
      rows.push({ min: null, slope: null, max: val, n: e.n, raw: val });
    }
  }
  return rows;
}

const REM = (s) => {
  const m = /^(-?\d*\.?\d+)(rem|px|em)$/.exec(s ?? '');
  if (!m) return null;
  const v = parseFloat(m[1]);
  return m[2] === 'px' ? v / 16 : v; // `em` is context-dependent; treated as rem for clustering only
};

/** Greedy 1-D clustering on a sorted list of (value, weight), splitting at any gap
 *  wider than `tol`. Deterministic, and the split points are reported so the choice
 *  can be audited rather than trusted. */
export function cluster(points, tol) {
  const sorted = [...points].sort((a, b) => a.v - b.v);
  const out = [];
  let cur = null;
  for (const p of sorted) {
    if (cur && p.v - cur.last <= tol) { cur.items.push(p); cur.n += p.n; cur.last = p.v; }
    else { cur = { items: [p], n: p.n, last: p.v }; out.push(cur); }
  }
  return out.map((c) => {
    const mode = [...c.items].sort((a, b) => b.n - a.n || a.v - b.v)[0];
    return { lo: c.items[0].v, hi: c.last, n: c.n, mode: mode.v, members: c.items.map((i) => `${i.label}x${i.n}`) };
  });
}

// ── Reporting ─────────────────────────────────────────────────────────────────

function fmtTable(groups) {
  const rows = [];
  for (const [g, bag] of groups) {
    let occ = 0;
    for (const e of bag.values()) occ += e.n;
    rows.push({ group: g, distinct: bag.size, occurrences: occ, budget: BUDGET[g] ?? null });
  }
  rows.sort((a, b) => b.distinct - a.distinct);
  return rows;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();

  // `--dir <path>` inventories a DIFFERENT tree — used to score a git revision without
  // touching the working tree (never `git stash`; its blast radius is the whole repo
  // including peers' uncommitted work). Build the tree with `git archive` or
  // `git show <rev>:<path>` into a scratch dir and point this at it. Without it, a
  // before/after would be measured by two different versions of this tool, which is
  // the same error as comparing critic scores across two rubrics.
  let files = await listUiSources(args.includes('--dir') ? resolve(args[args.indexOf('--dir') + 1]) : UI_DIR);
  // `--scope <substr>` narrows to files whose path contains <substr>. `hud.ts` is the
  // single biggest contributor (189 declarations) and is a DIFFERENT surface — it is
  // the in-match HUD, not a menu — so `--scope screens` is how the menu-only figure is
  // reproduced. Both are reported in the write-up; neither is hidden.
  const si = args.indexOf('--scope');
  if (si >= 0 && args[si + 1]) files = files.filter((f) => f.includes(args[si + 1]));
  const inv = await inventory(files);
  const rows = fmtTable(inv.groups);

  if (inv.orphans.length) {
    console.log('\n🚨 ORPHANED PROSE — text after a */ that a browser will parse as CSS and DISCARD,');
    console.log('   taking the rule attached to it with it. tsc cannot see this (LESSONS §9).');
    for (const o of inv.orphans) console.log(`   ${o.file}:~${o.line}  ${o.text}`);
    console.log('');
  }
  console.log(`\nDESIGN-SYSTEM INVENTORY — ${files.length} files under src/ui/`);
  console.log(`  ${inv.totalDecls} tracked declarations, ${inv.totalSubs} \${} substitutions dropped (values not statically resolvable)\n`);
  console.log('  group          LITERALS  ATOMS(abs)  tokenRefs  occurrences  budget  verdict');
  for (const r of rows) {
    const a = inv.atomsAbs.get(r.group)?.size ?? 0;
    const nref = inv.refs.get(r.group)?.size ?? 0;
    const refOcc = [...(inv.refs.get(r.group)?.values() ?? [])].reduce((s, e) => s + e.n, 0);
    // `font-weight` has no length atoms at all (its values are unitless), so judging it
    // on the atom column would score it 0 and pass forever — a check that CANNOT fail
    // is not a check (LESSONS §13). Groups with no atoms are judged on declValues.
    const judged = a > 0 ? a : r.distinct;
    const v = r.budget === null ? '' : (judged <= r.budget ? 'OK' : `OVER by ${judged - r.budget}`);
    console.log(`  ${r.group.padEnd(14)} ${String(r.distinct).padStart(8)} ${String(a).padStart(11)} ${`${nref}/${refOcc}`.padStart(10)} ${String(r.occurrences + refOcc).padStart(12)} ${String(r.budget ?? '-').padStart(7)}  ${v}`);
  }
  console.log('   (LITERALS = distinct values with a hard-coded number in them — the drift, and the');
  console.log('    only column the budget judges. ATOMS = the length literals inside those, which is');
  console.log('    where a SCALE lives. tokenRefs = distinct/total declarations that ONLY point at a');
  console.log('    token: ADOPTION, not drift, and it must go UP as the screens take the layer up.');
  console.log('    ⚠️ The first version of this tool counted a tokenRef as another distinct value and');
  console.log('    scored the design system WORSE than the mess. See stripVars() for the correction.)');

  /**
   * TOKEN COVERAGE — the number an adoption wave should actually be steered by.
   *
   * The DISTINCT-literal count is the target, but it is a poor progress signal: it only
   * falls when the LAST user of a value converts. `999px` is typed in six files, so
   * converting five of them moves the distinct count by exactly zero while converting
   * 80% of the work. Steering on it would read every intermediate wave as a failure —
   * the same shape as LESSONS 13's "AI stalled: 0.0%", a metric that is perfectly true
   * and answers a narrower question than the one everyone believes it answers.
   *
   * Coverage moves on every conversion, so it is monotone in the work done.
   */
  let refO = 0; let litO = 0;
  for (const [g, bag] of inv.groups) {
    for (const e of bag.values()) litO += e.n;
    for (const e of (inv.refs.get(g)?.values() ?? [])) refO += e.n;
  }
  console.log(`\n  TOKEN COVERAGE  ${refO}/${refO + litO} tracked declarations point at a token (${((100 * refO) / (refO + litO)).toFixed(1)}%)`);
  console.log('    The distinct-literal column above only falls when the LAST user of a value');
  console.log('    converts, so it reads zero progress through an entire adoption wave. Steer on this.');

  let tokenTotal = 0;
  for (const [pre, m] of inv.tokenDefs) tokenTotal += m.size;
  console.log(`\n  custom properties DEFINED: ${[...inv.tokenDefs].map(([p, m]) => `${p} ${m.size}`).join(', ')}  (total ${tokenTotal})`);
  console.log('    A design system\'s SIZE is literals + tokens: hiding values behind a token name');
  console.log('    without deleting any would score perfectly on the literal column alone.');

  console.log(`\n  shadow LAYERS (a 4-layer declaration is 1 authoring decision, 4 physical facts): ${inv.shadowLayerBag.size} distinct`);

  console.log('\n  declarations by file:');
  for (const [f, n] of [...inv.perFile].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(4)}  ${f}`);
  }

  if (args.includes('--clamps')) {
    const bag = inv.groups.get('fontSize');
    const rows = typeClamps(bag);
    const clamped = rows.filter((r) => r.min !== null);
    const fixed = rows.filter((r) => r.min === null);
    console.log(`\n── FONT-SIZE CLAMP DECOMPOSITION — ${clamped.length} clamp triples, ${fixed.length} fixed sizes ──`);
    for (const part of ['min', 'max', 'slope']) {
      const b = new Map();
      for (const r of clamped) b.set(r[part], (b.get(r[part]) ?? 0) + r.n);
      const pts = [...b].map(([label, n]) => ({ label, n, v: part === 'slope' ? parseFloat(label) : REM(label) }))
        .filter((p) => Number.isFinite(p.v));
      const tol = part === 'slope' ? 0.12 : 0.06;
      const cl = cluster(pts, tol);
      console.log(`\n  ${part.toUpperCase()} — ${b.size} distinct, ${cl.length} clusters at tol ${tol}`);
      for (const c of cl) {
        console.log(`    n=${String(c.n).padStart(3)}  mode ${String(c.mode).padEnd(6)} span ${c.lo}..${c.hi}   ${c.members.join(' ')}`);
      }
    }
    const fb = new Map();
    for (const r of fixed) fb.set(r.max, (fb.get(r.max) ?? 0) + r.n);
    console.log(`\n  FIXED (non-clamp) sizes: ${[...fb].sort((a, b2) => b2[1] - a[1]).map(([v, n]) => `${v}x${n}`).join('  ')}`);
  }

  if (args.includes('--long')) {
    for (const [g, bag] of inv.groups) {
      const sorted = [...bag].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]));
      console.log(`\n── ${g.toUpperCase()} — ${bag.size} distinct ──`);
      for (const [val, e] of sorted) {
        const where = [...e.files].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f.replace(/\.ts$/, '')}x${n}`).join(' ');
        console.log(`  ${String(e.n).padStart(3)}  ${val.length > 74 ? `${val.slice(0, 71)}...` : val.padEnd(74)}  ${where}`);
      }
    }
    const sl = [...inv.shadowLayerBag].sort((a, b) => b[1] - a[1]);
    console.log(`\n── SHADOW LAYERS — ${sl.length} distinct ──`);
    for (const [val, n] of sl) console.log(`  ${String(n).padStart(3)}  ${val}`);

    for (const [g, bag] of inv.atomsAbs) {
      const sorted = [...bag].sort((a, b) => b[1] - a[1] || parseFloat(a[0]) - parseFloat(b[0]));
      console.log(`\n── ATOMS(abs) ${g} — ${bag.size} distinct ──`);
      console.log(`  ${sorted.map(([v, n]) => `${v}x${n}`).join('  ')}`);
      const rel = [...(inv.atomsRel.get(g) ?? [])].sort((a, b) => b[1] - a[1]);
      if (rel.length) console.log(`  rel: ${rel.map(([v, n]) => `${v}x${n}`).join('  ')}`);
    }
  }

  const jsonIdx = args.indexOf('--json');
  if (jsonIdx >= 0) {
    const out = args[jsonIdx + 1] ?? 'shots/ds/inventory.json';
    const payload = {
      files: files.map((f) => relative(ROOT, f)),
      totals: { declarations: inv.totalDecls, substitutionsDropped: inv.totalSubs },
      groups: Object.fromEntries([...inv.groups].map(([g, bag]) => [g, {
        distinct: bag.size,
        values: [...bag].sort((a, b) => b[1].n - a[1].n).map(([val, e]) => ({ value: val, n: e.n, files: Object.fromEntries(e.files) })),
      }])),
      shadowLayers: Object.fromEntries([...inv.shadowLayerBag].sort((a, b) => b[1] - a[1])),
      atomsAbs: Object.fromEntries([...inv.atomsAbs].map(([g, b]) => [g, Object.fromEntries([...b].sort((a, c) => c[1] - a[1]))])),
      atomsRel: Object.fromEntries([...inv.atomsRel].map(([g, b]) => [g, Object.fromEntries([...b].sort((a, c) => c[1] - a[1]))])),
      perFile: Object.fromEntries(inv.perFile),
    };
    await writeFile(resolve(ROOT, out), JSON.stringify(payload, null, 2));
    console.log(`\n  wrote ${out}`);
  }

  console.log('\n  ⚠️ THIS MEASURES TIDINESS, NOT QUALITY. See the header — it is blind to');
  console.log('     functional differentiation, which is what the reference plates actually do.\n');

  if (args.includes('--gate')) {
    const judgedOf = (r) => ((inv.atomsAbs.get(r.group)?.size ?? 0) > 0 ? inv.atomsAbs.get(r.group).size : r.distinct);
    const over = rows.filter((r) => r.budget !== null && judgedOf(r) > r.budget);
    if (over.length) {
      console.log(`GATE FAIL — ${over.map((r) => `${r.group} ${judgedOf(r)}>${r.budget}`).join(', ')}\n`);
      process.exit(1);
    }
    console.log('GATE PASS\n');
  }
}

// ── Selftest ──────────────────────────────────────────────────────────────────

/**
 * Known-BAD inputs first, because a guard that has not been shown to FAIL on the bug
 * it guards against is not a guard. Each case names the naive implementation it kills.
 */
async function selftest() {
  let pass = 0; let fail = 0;
  const t = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) pass++; else fail++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`}`);
  };

  // 1. A semicolon inside a quoted `content` must NOT split the declaration.
  //    Kills: `css.split(';')`.
  t('quoted semicolon does not split',
    cssDeclarations('.a { content: "x;y"; border-radius: 4px; }').map((d) => `${d.prop}=${d.value}`),
    ['content="x;y"', 'border-radius=4px']);

  // 2. A colon inside a comment must not become a declaration.
  //    Kills: a line-based `/(\w[\w-]*)\s*:\s*([^;]+)/g` sweep.
  t('comment is not a declaration',
    cssDeclarations('.a { /* border-radius: 999px; nope */ border-radius: 4px; }').map((d) => d.value),
    ['4px']);

  // 3. Commas inside rgba()/clamp() must not split a value.
  //    Kills: `value.split(',')` for shadow layers.
  t('rgba commas survive',
    cssDeclarations('.a { box-shadow: 0 4px 0 rgba(0,0,0,.35); }').map((d) => d.value),
    ['0 4px 0 rgba(0,0,0,.35)']);

  // 4. Multi-layer shadow splits into layers on TOP-LEVEL commas only.
  t('shadow layer split',
    shadowLayers('inset 0 3px 0 rgba(255,255,255,0.7), 0 7px 0 var(--gold-shadow), 0 10px 22px rgba(0,0,0,0.4)'),
    ['inset 0 3px 0 rgba(255,255,255,0.7)', '0 7px 0 var(--gold-shadow)', '0 10px 22px rgba(0,0,0,0.4)']);

  // 5. Normalisation collapses whitespace and leading-dot alpha, and NOTHING else.
  t('normValue collapses only formatting',
    [normValue('0 4px 0 rgba(0,0,0,.35)'), normValue('0  4px   0 RGBA(0, 0, 0, 0.35)')],
    ['0 4px 0 rgba(0,0,0,0.35)', '0 4px 0 rgba(0,0,0,0.35)']);
  // ...and does NOT collapse a real 1px difference, which is the drift being measured.
  t('normValue keeps a real 1px difference',
    normValue('0 5px 0 rgba(0,0,0,.35)') === normValue('0 4px 0 rgba(0,0,0,.35)'),
    false);

  // 6. Declarations nested inside an at-rule are still seen, and the at-rule PRELUDE
  //    (`@media (min-width: 700px)`) is not mistaken for a declaration.
  //    Kills: a depth-0-only parser, and a parser that flushes preludes.
  t('at-rule prelude is not a declaration',
    cssDeclarations('@media (min-width: 700px) { .a { font-size: 20px; } }').map((d) => `${d.prop}=${d.value}`),
    ['font-size=20px']);

  // 7. A backtick inside a CSS comment — the trap that has 500'd the dev server four
  //    times. The TS parser must still find the literal, and the CSS parser must not
  //    care. Built as a real source string.
  {
    const src = 'const CSS = `\n.a { /* a ' + String.fromCharCode(96) + ' tick */ border-radius: 4px; }\n`;';
    // Note: the above is deliberately NOT a valid escape of the backtick — it
    // terminates the literal early, which is EXACTLY the production bug. The parser
    // must report the resulting syntax error rather than silently returning nothing.
    const bad = await templateLiterals(src, 'x.ts');
    const good = await templateLiterals('const CSS = ' + String.fromCharCode(96) + '\n.a { /* a tick */ border-radius: 4px; }\n' + String.fromCharCode(96) + ';', 'x.ts');
    // The literal ends at the stray backtick, so the radius falls OUT of the stylesheet
    // and into (broken) code. Asserting only "the radius is missing" would also pass on
    // a parser that returned nothing at all, so the CONTROL is the same source with the
    // backtick removed: it must parse clean AND find the radius.
    t('stray backtick: errors > 0 and the radius is NOT in a literal',
      [bad.errors > 0, bad.texts.some((x) => x.includes('border-radius'))], [true, false]);
    t('control (no backtick): errors 0 and the radius IS found',
      [good.errors, good.texts.some((x) => x.includes('border-radius'))], [0, true]);
  }

  // 8. A `${}` substitution splits the literal; the surrounding CSS on BOTH sides is
  //    still parsed. Kills: taking only `node.head.text`.
  {
    const src = 'const CSS = `.a { color: ${c}; border-radius: 4px; }`;';
    const { texts, substitutions } = await templateLiterals(src, 'x.ts');
    const decls = cssDeclarations(texts.join('\n'));
    t('substitution keeps both sides', [substitutions, decls.some((d) => d.prop === 'border-radius')], [1, true]);
  }

  // 9. Duplicates: N occurrences, 1 distinct. Kills: a Set-only implementation that
  //    loses the long tail's weight, which is the whole evidential basis of the scale.
  {
    const decls = cssDeclarations('.a{border-radius:16px}.b{border-radius:16px}.c{border-radius:12px}');
    const bag = new Map();
    for (const d of decls) bag.set(normValue(d.value), (bag.get(normValue(d.value)) ?? 0) + 1);
    t('occurrences vs distinct', [decls.length, bag.size, bag.get('16px')], [3, 2, 2]);
  }

  // 10. KNOWN-BAD END-TO-END: a synthetic file with a value set known by construction.
  //     Two files, one duplicate across them, one longhand radius, one 4-layer shadow.
  {
    const tmp = join(ROOT, 'tools/tmp');
    const fileA = join(tmp, '__ds_selftest_a.ts');
    const fileB = join(tmp, '__ds_selftest_b.ts');
    const bt = String.fromCharCode(96);
    await writeFile(fileA, `const CSS = ${bt}\n.x { border-radius: 16px; box-shadow: 0 4px 0 #000; font-size: 12px; font-weight: 800; }\n.y { border-top-left-radius: 3px; font-size: 12px; }\n${bt};\n`);
    await writeFile(fileB, `const CSS = ${bt}\n.z { border-radius: 16px; box-shadow: inset 0 1px 0 #fff, 0 2px 0 #111; font-size: 14px; font-weight: 900; }\n${bt};\n`);
    const inv = await inventory([fileA, fileB]);
    const g = (k) => inv.groups.get(k);
    t('e2e distinct radii (16px x2 across files, 3px once) = 2', g('radius').size, 2);
    t('e2e radius occurrences = 3', [...g('radius').values()].reduce((a, e) => a + e.n, 0), 3);
    t('e2e 16px is attributed to BOTH files', [...g('radius').get('16px').files.keys()].length, 2);
    t('e2e distinct shadow DECLARATIONS = 2', g('shadow').size, 2);
    t('e2e distinct shadow LAYERS = 3', inv.shadowLayerBag.size, 3);
    t('e2e distinct font-size = 2', g('fontSize').size, 2);
    t('e2e distinct font-weight = 2', g('fontWeight').size, 2);
    const { unlink } = await import('node:fs/promises');
    await unlink(fileA); await unlink(fileB);
  }

  // 10b. ORPHANED PROSE. Known-bad is the EXACT text that escaped its comment in this
  //      pass; known-good is the same edit done correctly, plus every legitimate
  //      selector shape in this codebase — because a lint that cries wolf gets ignored
  //      (LESSONS §9's own regex guard was widened, false-positived, and was abandoned).
  {
    const bad = '.a { color: red }\n/* a note.\n   more note. */\n   ── ITS FILL COMES FROM THE CALLER ──\n   Measured, cream on --water reads 2.92:1. */\n.b { color: blue }';
    const good = '.a { color: red }\n/* a note.\n\n   ── ITS FILL COMES FROM THE CALLER ──\n   Measured, cream on --water reads 2.92:1. */\n.b { color: blue }';
    t('orphaned prose after a */ is caught', orphanedProse(bad).length, 1);
    t('the same text INSIDE the comment is clean', orphanedProse(good).length, 0);
  }
  t('legitimate selectors after a comment are clean', orphanedProse([
    '/* c */ .fa-root.is-ingame .fa-bg, .fa-dots { display: none }',
    '/* c */ .fa-scroll::-webkit-scrollbar-thumb { width: 8px }',
    '/* c */ @media (prefers-reduced-motion: reduce) { .a { animation: none } }',
    '/* c */ :root.fa-reduce-motion .fa-screen { animation: none }',
    '/* c */ .fa-tab:hover:not(.is-active) { background: red }',
    '/* c */ .ds-btn[disabled]:active { transform: none }',
    '/* c */ .chars-card[data-char] > *:nth-child(2) { color: red }',
    '/* c */ @keyframes fa-rays-spin { to { opacity: 1 } }',
  ].join('\n')).length, 0);
  // And the guard must FAIL on a real rule-eating case with no unicode in it at all —
  // otherwise it is only a unicode detector wearing a CSS guard's name.
  t('plain-ASCII prose after a */ is also caught', orphanedProse('/* c */ This sentence is not a selector; it is prose. .a { color: red }').length, 1);
  {
    // THE LIVE FILE must be clean. This is the assertion that would have caught the
    // real defect, so it is run against the real tree rather than a fixture.
    const src = await readFile(join(ROOT, 'src/ui/screens/theme.ts'), 'utf8');
    const { texts } = await templateLiterals(src, 'theme.ts');
    t('theme.ts has no orphaned prose', texts.flatMap((x) => orphanedProse(x)).length, 0);
  }

  // 11. TOKEN REFERENCES ARE NOT DRIFT. The bug this tool shipped with for one run:
  //     `font-size: var(--ds-t3)` was counted as another distinct font size, so the
  //     metric scored a design system as worse than the mess it replaces. Both halves
  //     are asserted — a pure reference is a reference, and a value with a literal
  //     still in it is NOT, however many vars sit beside it.
  t('a pure var() is a token reference', [isTokenRef('var(--ds-t3)'), isTokenRef('var(--ds-e2)'), isTokenRef('var(--ds-stroke-2) solid var(--ink)')], [true, true, true]);
  t('a literal beside a var is NOT a reference', [isTokenRef('0 3px 0 var(--ds-lip)'), isTokenRef('var(--ds-e3), inset 0 2px 0 rgba(255,255,255,0.9)')], [false, false]);
  t('a literal hidden in a var FALLBACK still counts', isTokenRef('var(--ds-tile-fill, 14px)'), false);
  t('stripVars leaves the surrounding literals', normValue(stripVars('0 3px 0 var(--ds-lip)')), '0 3px 0');
  {
    const bt = String.fromCharCode(96);
    const tmp = join(ROOT, 'tools/tmp/__ds_selftest_d.ts');
    await writeFile(tmp, `const CSS = ${bt}\n:root{--tok:12px}\n.a{border-radius:12px}.b{border-radius:var(--tok)}.c{border-radius:var(--tok)}\n${bt};\n`);
    const inv = await inventory([tmp]);
    const { unlink } = await import('node:fs/promises');
    await unlink(tmp);
    t('adopting a token moves the count from LITERALS to tokenRefs, and defines a token',
      [inv.groups.get('radius').size, inv.refs.get('radius').size, [...inv.refs.get('radius').values()][0].n, inv.tokenDefs.get('--other').size],
      [1, 1, 2, 1]);
  }

  // 12. MUTATION ANCHOR — the instrument must FAIL when fed a stylesheet that is
  //     obviously tidy but has drift injected. If this passes, the counter is not
  //     counting. (LESSONS §13: ask what implementation would FAIL this assertion.)
  {
    const bt = String.fromCharCode(96);
    const tmp = join(ROOT, 'tools/tmp/__ds_selftest_c.ts');
    const tidy = `const CSS = ${bt}\n.a{border-radius:16px}.b{border-radius:16px}.c{border-radius:16px}\n${bt};\n`;
    const drifted = `const CSS = ${bt}\n.a{border-radius:16px}.b{border-radius:15px}.c{border-radius:17px}\n${bt};\n`;
    await writeFile(tmp, tidy);
    const a = (await inventory([tmp])).groups.get('radius').size;
    await writeFile(tmp, drifted);
    const b = (await inventory([tmp])).groups.get('radius').size;
    const { unlink } = await import('node:fs/promises');
    await unlink(tmp);
    t('mutation anchor: tidy=1 distinct, drifted=3 distinct', [a, b], [1, 3]);
  }

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
