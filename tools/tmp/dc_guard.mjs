#!/usr/bin/env node
/**
 * DESIGN-SYSTEM COMPONENT GUARD — the three defects the adoption pass found by READING
 * A PNG, turned into checks that fail.
 *
 * `git log -1 f5a6229` lists six defects and is explicit that **no assertion saw three
 * of them**. `menu_accept` (361 checks) and `ud_defects` both passed a trophy-road bar
 * that was rendering an EMPTY TRACK. That is CLAUDE.md #4 — "assume it is rendering and
 * INVISIBLE" — for the twenty-first time, and the reason none of the batteries caught it
 * is structural rather than accidental: they audit SCREENS. A shared component layer's
 * defect only becomes visible on a screen once somebody adopts it, and coverage on
 * `screens/` went 21.4% -> 36.8% in one pass, so "the next adopter" is not hypothetical.
 *
 * ── The three checks, and the known-bad input for each ────────────────────────
 *
 * 1. FILL RENDERS.  `.ds-bar-fill` declares `height: 100%` and takes its width from the
 *    caller, and declared NO `display`. An INLINE box ignores both. The fill in
 *    `home.ts` is a `<span>`; adopting `.ds-bar` deleted that file's own
 *    `display: block` and the bar rendered as an empty track. `.ds-bar` itself has the
 *    same gap one level up and survives only because every current caller happens to be
 *    a flex ITEM, which blockifies it — a component that works only inside a flex parent
 *    is a trap, not a component. So the fixture mounts every track/fill pair as a
 *    `<span>` inside an ordinary BLOCK parent, which is the shape that burned us.
 *    KNOWN-BAD: the check removes the `display` declaration from the live CSSOM and
 *    REQUIRES the measurement to fail, then restores it and requires it to pass again.
 *
 * 2. CAPTION FITS.  `.fa-level-xp` (and its `.ds-*` twin `.ds-bar-cap`) is
 *    `position:absolute; inset:0` inside a track with `overflow:hidden` and declared no
 *    `white-space`. Lifting the level labels 9.92 -> 11.04px squeezed the track until
 *    the caption WRAPPED inside a 14px bar and was clipped through the middle of both
 *    lines. The fixture width is DERIVED, never guessed: measure the caption's own
 *    `scrollWidth` with nowrap on, then set the track 12px narrower, so overflow is
 *    guaranteed and wrapping is possible.
 *    KNOWN-BAD: remove `white-space` from the live CSSOM and REQUIRE two line boxes.
 *
 * 3. NO DEAD DECLARATION.  A media query adds NO SPECIFICITY, and this cost the
 *    adoption pass twice in one pass: a compact block written ABOVE its base rule
 *    (the base won, three `flex: 1 1 0` rows collapsed to ~8px), and a
 *    `@media (max-height: 460px)` rule written BEFORE an identical selector inside
 *    `@media (max-height: 560px)` — which delivered **2.44px of the 16.39px** it was
 *    written to move. Both are the same arithmetic: if rule A's media condition is a
 *    SUBSET of rule B's and A is written FIRST at equal specificity, A can never win
 *    anywhere, for any property they both declare.
 *    KNOWN-BAD: the exact 460-before-560 pair is a fixture, and it is validated TWICE —
 *    the static analyser must flag it, and a real browser must confirm the delivered
 *    value is the wrong one. A static rule nobody checked against a rendering is a
 *    theory.
 *
 * ⚠️ EVERY RENDER CHECK RUNS ITS OWN ABLATION IN-BAND, ON EVERY INVOCATION. If an
 * ablation PASSES, this tool exits non-zero with `TAUTOLOGICAL`. A guard that has not
 * been shown to fail on the bug it guards against is not a guard (CLAUDE.md #6), and
 * nineteen instruments were caught returning confident wrong answers in one session.
 *
 * ── What this does NOT cover, stated because a carve-out you cannot see is a lie ──
 *  * Check 3 keys on IDENTICAL normalised selector text. Two rules that differ in text
 *    but match the same elements at equal specificity (`.fa-home .home-stats` vs
 *    `.home-stats`) are not decidable statically and are not flagged. Both documented
 *    cases were identical selectors.
 *  * Cross-STYLESHEET ordering is out of scope: each screen injects its own `<style>`
 *    on first mount, so the order between two sheets depends on the player's navigation
 *    path. Selectors are screen-prefixed (`.fa-home`, `.fa-chars`), so within-sheet is
 *    where the trap lives. Analysis is per-sheet and deterministic.
 *  * `not`/`only` media prefixes and range syntax (`width <= 460px`) return UNKNOWN and
 *    are reported as such rather than silently treated as "no overlap".
 *
 * ── 🚨 FIVE WAYS THIS TOOL WAS CONFIDENTLY WRONG BEFORE IT WAS RIGHT ──────────
 * Recorded because "nineteen instruments were caught returning confident wrong answers
 * in one session" is not a warning about other people's tools. Every one of these was
 * caught by running the tool against the KNOWN-BAD pre-fix `theme.ts` and asking why it
 * was not screaming. Each is documented at its site as well.
 *
 *  1. THE FILL JUDGE WAS TAUTOLOGICAL ON ITS OWN BUG. It asked "is the fill 60% of the
 *     track's inner width?" An inline track collapses to width 0, so the fill was 0 of
 *     0 — which is 60% — and it printed `ok  0x24 in a 0x24 track` on the exact defect.
 *     A ratio cannot see a denominator that has itself collapsed. Judge against what the
 *     STYLESHEET DECLARED, not against what the broken element happens to report.
 *  2. THE WRAP FIXTURE MEASURED THE WRONG BOX. The caption is `position: absolute;
 *     inset: 0`, so its own rect is the TRACK's width (274px), never the text's (76px).
 *     The "derived" narrow track was 3.4x wider than the run it was meant to squeeze.
 *  3. THE LINE COUNT WAS TAKEN OVER A FLEX CONTAINER, which returns ONE rect however
 *     many lines it holds. Range over the TEXT NODE.
 *  4. THE CASCADE FIXTURE RAN AT 852x480, where `(max-height: 460px)` does not match at
 *     all — both orderings delivered the same value and the fixture proved nothing. It
 *     runs at 844x390, which is where the real defect was measured.
 *  5. THE RULE FINDER FOUND NOTHING, so all eight ablations reported ABSENT on
 *     declarations that were plainly present. Since CSS Nesting shipped, a plain
 *     `CSSStyleRule` in Chromium exposes a truthy empty `cssRules`, so "descend if it
 *     has children" skipped every style rule in the sheet.
 *
 * And one FALSE POSITIVE, which is the same failure pointing the other way: the cascade
 * check called `.chars-lv-gain { color }` and `.tr-soon { color }` defects. Both are
 * `.a, .b { … }` followed by `.b { … }` — base-then-specialise, correct CSS. The
 * suppression is narrow (same condition only) and has its own selftest proving the same
 * SHAPE under a strict subset is still flagged, because a suppression that swallows the
 * bug is worse than no check.
 *
 * Usage:
 *   node tools/tmp/dc_guard.mjs --selftest              # offline: the pure arithmetic
 *   node tools/tmp/dc_guard.mjs --url <snapshot> [--out shots/dc]
 */

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

/** The tight landscape phone the adoption pass's three PNG defects were all found at.
 *  852x480 and not 844x390: `ud_defects` measures 24.95px of slack in the left flank
 *  there against 32.78px at 844x390, so it is the viewport where a rung overflows. */
const VP = { w: 852, h: 480 };

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2); const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true; else { out[k] = n; i++; }
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════
// MEDIA CONDITION ALGEBRA — pure, and the whole of check 3's correctness
// ═════════════════════════════════════════════════════════════════════════════

/** Lengths only ever appear in px in this codebase's media queries; anything else is
 *  reported UNKNOWN rather than coerced, because a coerced unit is a wrong answer that
 *  looks like a right one. */
function toPx(raw) {
  const m = /^(-?[\d.]+)(px)?$/.exec(raw.trim());
  if (!m) return null;
  return parseFloat(m[1]);
}

/**
 * Parse `(max-height: 460px) and (orientation: portrait)` into a constraint list.
 *
 * Returns `{ ok, constraints }`. `ok:false` means this tool cannot reason about the
 * condition and every comparison involving it must return UNKNOWN — never `false`,
 * which would read as "these do not overlap" and silently drop a real fault.
 */
export function parseCondition(text) {
  const t = String(text || '').trim();
  if (t === '') return { ok: true, constraints: [] };            // no media = universe
  if (/\bnot\b|[<>]|,/.test(t)) return { ok: false, constraints: [] };
  const parts = t.split(/\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
  const constraints = [];
  for (let p of parts) {
    if (/^only$/i.test(p) || /^(screen|all)$/i.test(p)) continue;
    p = p.replace(/^only\s+/i, '').replace(/^(screen|all)\s+/i, '');
    const m = /^\(\s*([a-z-]+)\s*:\s*([^)]+)\)$/i.exec(p);
    if (!m) return { ok: false, constraints: [] };
    const feature = m[1].toLowerCase();
    const value = m[2].trim();
    const range = /^(min|max)-(.+)$/.exec(feature);
    if (range) {
      const px = toPx(value);
      if (px === null) return { ok: false, constraints: [] };
      constraints.push({ kind: range[1], axis: range[2], px });
    } else {
      constraints.push({ kind: 'eq', axis: feature, value: value.toLowerCase() });
    }
  }
  return { ok: true, constraints };
}

/**
 * Is every viewport matching A also matching B?  (A ⊆ B)
 *
 * Returns `true` / `false` / `null` (undecidable). The direction matters and is easy to
 * get backwards: `max-height: 460` ⊆ `max-height: 560`, because 460 is the TIGHTER
 * bound and therefore the SMALLER set. That is the exact pair that shipped broken.
 */
export function isSubset(a, b) {
  if (!a.ok || !b.ok) return null;
  for (const cb of b.constraints) {
    if (cb.kind === 'eq') {
      const ca = a.constraints.find((c) => c.kind === 'eq' && c.axis === cb.axis);
      if (!ca || ca.value !== cb.value) return false;
      continue;
    }
    const ca = a.constraints.find((c) => c.kind === cb.kind && c.axis === cb.axis);
    if (!ca) return false;
    if (cb.kind === 'max' && !(ca.px <= cb.px)) return false;
    if (cb.kind === 'min' && !(ca.px >= cb.px)) return false;
  }
  return true;
}

/** Normalised selector text, so `.a  >  .b` and `.a > .b` are one selector. */
export const normSel = (s) => String(s).replace(/\s+/g, ' ').replace(/\s*([>+~,])\s*/g, '$1').trim();

/**
 * Find declarations that can NEVER win.
 *
 * `rules` is a flat list in SOURCE ORDER: `{ order, selector, cond, decls, where }`,
 * where `decls` maps a longhand/shorthand property name to `{ value, important }`.
 *
 * A declaration of property P on selector S at index i is dead if some LATER index j
 * declares the same P on the same S and `cond(i) ⊆ cond(j)`, with the priority rules
 * that actually govern the cascade: `!important` beats non-important regardless of
 * order, so an important earlier declaration is not dead unless the later one is
 * important too.
 */
export function findDeadDecls(rules) {
  const dead = [];      // STRICT subset: a NARROWER intent, written first, can never win
  const shadowed = [];  // same condition: ordinary redeclaration, the cascade obeys the author's last word
  const unknown = [];
  const byOrder = [...rules].sort((x, y) => x.order - y.order);
  for (let i = 0; i < byOrder.length; i++) {
    const a = byOrder[i];
    for (let j = i + 1; j < byOrder.length; j++) {
      const b = byOrder[j];
      if (normSel(a.selector) !== normSel(b.selector)) continue;
      const shared = Object.keys(a.decls).filter((p) => p in b.decls);
      if (shared.length === 0) continue;
      const sub = isSubset(a.cond, b.cond);
      if (sub === null) {
        unknown.push({ selector: a.selector, a: a.where, b: b.where, props: shared });
        continue;
      }
      if (!sub) continue;
      const strict = JSON.stringify(a.cond.constraints) !== JSON.stringify(b.cond.constraints);
      for (const p of shared) {
        if (a.decls[p].important && !b.decls[p].important) continue;
        // Same value declared twice is redundant, not a defect that changes a pixel.
        if (a.decls[p].value === b.decls[p].value) continue;
        const rec = {
          selector: a.selector,
          prop: p,
          loser: { where: a.where, value: a.decls[p].value, cond: a.cond },
          winner: { where: b.where, value: b.decls[p].value },
          strict,
        };
        // ── THE ONE FALSE-POSITIVE CLASS, SUPPRESSED DELIBERATELY ──────────────
        // `.a, .b { color: X }` followed by `.b { color: Y }` under the SAME condition
        // is the base-then-specialise idiom, not a trap: the author wrote the general
        // case and then the exception, in that order, and the cascade delivers exactly
        // what they meant. Flagging it made the first run report `.chars-lv-gain` and
        // `.tr-soon` as defects when both are correct CSS. It is suppressed ONLY when
        // the condition is identical — under a strict subset the same shape IS the trap,
        // because the narrower rule is the one that loses.
        if (!strict && (a.groupSize ?? 1) > (b.groupSize ?? 1)) continue;
        (strict ? dead : shadowed).push(rec);
      }
      break; // one winner is enough to prove the earlier declaration dead
    }
  }
  return { dead, shadowed, unknown };
}

// ═════════════════════════════════════════════════════════════════════════════
// OFFLINE SELFTESTS — the pure arithmetic, against inputs whose answer is known
// ═════════════════════════════════════════════════════════════════════════════

function selftest() {
  const results = [];
  const t = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    results.push({ name, ok, got, want });
  };

  // ── parseCondition ────────────────────────────────────────────────────────
  t('parse: empty condition is the universe',
    parseCondition('').constraints.length, 0);
  t('parse: max-height', parseCondition('(max-height: 460px)').constraints,
    [{ kind: 'max', axis: 'height', px: 460 }]);
  t('parse: conjunction', parseCondition('(max-width: 900px) and (max-height: 500px)').constraints,
    [{ kind: 'max', axis: 'width', px: 900 }, { kind: 'max', axis: 'height', px: 500 }]);
  t('parse: non-range feature is an equality', parseCondition('(orientation: portrait)').constraints,
    [{ kind: 'eq', axis: 'orientation', value: 'portrait' }]);
  // KNOWN-BAD: `not` inverts the set. Coercing it would invert the verdict.
  t('parse: `not` is UNKNOWN, never a silent false', parseCondition('not all and (max-height: 460px)').ok, false);
  t('parse: range syntax is UNKNOWN', parseCondition('(400px <= width <= 700px)').ok, false);
  t('parse: a comma is a UNION and is UNKNOWN', parseCondition('(max-width: 400px), (min-width: 900px)').ok, false);
  t('parse: an em bound is UNKNOWN, not silently px', parseCondition('(max-height: 30em)').ok, false);

  // ── isSubset — the direction is the thing that ships broken ───────────────
  const C = (s) => parseCondition(s);
  t('subset: 460 ⊆ 560 (the shipped defect)', isSubset(C('(max-height: 460px)'), C('(max-height: 560px)')), true);
  t('subset: 560 ⊄ 460 (the fixed order)', isSubset(C('(max-height: 560px)'), C('(max-height: 460px)')), false);
  t('subset: anything ⊆ no-media', isSubset(C('(max-height: 460px)'), C('')), true);
  t('subset: no-media ⊄ a media block', isSubset(C(''), C('(max-height: 460px)')), false);
  t('subset: min- reverses the comparison', isSubset(C('(min-width: 900px)'), C('(min-width: 700px)')), true);
  t('subset: min- reversed the other way', isSubset(C('(min-width: 700px)'), C('(min-width: 900px)')), false);
  t('subset: a conjunction is tighter than either half',
    isSubset(C('(max-width: 900px) and (max-height: 500px)'), C('(max-width: 900px)')), true);
  t('subset: dropping a constraint is NOT a subset',
    isSubset(C('(max-width: 900px)'), C('(max-width: 900px) and (max-height: 500px)')), false);
  t('subset: different axes never overlap into a subset',
    isSubset(C('(max-width: 460px)'), C('(max-height: 560px)')), false);
  t('subset: an UNKNOWN condition poisons to null, never to false',
    isSubset(C('not all and (max-height: 460px)'), C('(max-height: 560px)')), null);

  // ── findDeadDecls — the two real defects, as fixtures ─────────────────────
  const R = (order, selector, condText, decls, groupSize) => ({
    order, selector, cond: parseCondition(condText),
    decls: Object.fromEntries(Object.entries(decls).map(([k, v]) => [k, typeof v === 'string' ? { value: v, important: false } : v])),
    where: condText ? `@media ${condText}` : '(no media)',
    groupSize: groupSize ?? 1,
  });

  // KNOWN-BAD 1 — `characterSelect.ts`: 460 written before 560. Measured: it moved
  // 2.44px of the 16.39px it was written to move.
  const badA = findDeadDecls([
    R(1, '.fa-chars .chars-card-name', '(max-height: 460px)', { 'font-size': 'var(--ds-t2)' }),
    R(2, '.fa-chars .chars-card-name', '(max-height: 560px)', { 'font-size': 'var(--ds-t3)' }),
  ]);
  t('dead: 460-before-560 is FLAGGED', badA.dead.length, 1);
  t('dead: ...and names the loser', badA.dead[0]?.prop, 'font-size');
  t('dead: ...and marks it a strict subset', badA.dead[0]?.strict, true);

  // The fix, which is the same two rules in the other order. Must be CLEAN.
  const goodA = findDeadDecls([
    R(1, '.fa-chars .chars-card-name', '(max-height: 560px)', { 'font-size': 'var(--ds-t3)' }),
    R(2, '.fa-chars .chars-card-name', '(max-height: 460px)', { 'font-size': 'var(--ds-t2)' }),
  ]);
  t('dead: 560-before-460 is CLEAN', goodA.dead.length, 0);

  // KNOWN-BAD 2 — `home.ts`: a compact block written ABOVE its base rule. The base has
  // no media condition at all, so it wins everywhere and the compact block is inert.
  const badB = findDeadDecls([
    R(1, '.fa-home .home-stats', '(max-height: 500px)', { 'flex-direction': 'row' }),
    R(2, '.fa-home .home-stats', '', { 'flex-direction': 'column' }),
  ]);
  t('dead: a media block above its own base rule is FLAGGED', badB.dead.length, 1);
  t('dead: ...and the winner is the unconditioned rule', badB.dead[0]?.winner.value, 'column');

  const goodB = findDeadDecls([
    R(1, '.fa-home .home-stats', '', { 'flex-direction': 'column' }),
    R(2, '.fa-home .home-stats', '(max-height: 500px)', { 'flex-direction': 'row' }),
  ]);
  t('dead: base above its own media block is CLEAN', goodB.dead.length, 0);

  // Disjoint properties are not a conflict at all.
  t('dead: disjoint properties are CLEAN', findDeadDecls([
    R(1, '.x', '(max-height: 460px)', { color: 'red' }),
    R(2, '.x', '(max-height: 560px)', { 'font-size': '12px' }),
  ]).dead.length, 0);

  // Different selectors are not a conflict.
  t('dead: different selectors are CLEAN', findDeadDecls([
    R(1, '.x', '(max-height: 460px)', { color: 'red' }),
    R(2, '.y', '(max-height: 560px)', { color: 'blue' }),
  ]).dead.length, 0);

  // `!important` beats source order, so the earlier declaration is NOT dead.
  t('dead: an earlier !important is NOT dead', findDeadDecls([
    R(1, '.x', '(max-height: 460px)', { color: { value: 'red', important: true } }),
    R(2, '.x', '(max-height: 560px)', { color: 'blue' }),
  ]).dead.length, 0);
  t('dead: ...but !important on BOTH restores source order', findDeadDecls([
    R(1, '.x', '(max-height: 460px)', { color: { value: 'red', important: true } }),
    R(2, '.x', '(max-height: 560px)', { color: { value: 'blue', important: true } }),
  ]).dead.length, 1);

  // The same VALUE twice is redundant, not a defect: no pixel differs either way.
  t('dead: an identical value twice is not reported', findDeadDecls([
    R(1, '.x', '(max-height: 460px)', { color: 'red' }),
    R(2, '.x', '(max-height: 560px)', { color: 'red' }),
  ]).dead.length, 0);

  // ── SHADOWED vs DEAD, and the false positive that forced the split ─────────
  // Same condition = the author's last word, delivered. Strict subset = the NARROWER
  // intent losing, which is always a mistake. Only the second is a fault.
  const sameCond = findDeadDecls([
    R(1, '.x', '', { color: 'red' }),
    R(2, '.x', '', { color: 'blue' }),
  ]);
  t('split: same-condition redeclaration is SHADOWED, not dead', [sameCond.dead.length, sameCond.shadowed.length], [0, 1]);
  const subCond = findDeadDecls([
    R(1, '.x', '(max-height: 460px)', { color: 'red' }),
    R(2, '.x', '(max-height: 560px)', { color: 'blue' }),
  ]);
  t('split: strict-subset ordering is DEAD, not shadowed', [subCond.dead.length, subCond.shadowed.length], [1, 0]);

  // KNOWN-BAD 3 — the FALSE POSITIVE this checker shipped in its first run. It called
  // `.fa-chars .chars-lv-gain { color: var(--ink) }` and `.fa-tr .tr-soon { color }`
  // defects; both are `.a, .b { … }` followed by `.b { … }`, which is base-then-
  // specialise and is correct CSS.
  t('false-positive: base-then-specialise under one condition is NOT reported', findDeadDecls([
    R(1, '.chars-lv-gain', '', { color: 'var(--ink)' }, 2),
    R(2, '.chars-lv-gain', '', { color: 'rgb(46, 125, 50)' }, 1),
  ]).shadowed.length, 0);
  // …but the same SHAPE under a strict subset is still the trap, and must survive the
  // suppression. A suppression that also swallows the bug is worse than no check.
  t('false-positive: ...but the same shape across conditions IS still flagged', findDeadDecls([
    R(1, '.chars-stats', '(max-height: 460px)', { gap: '1px' }, 2),
    R(2, '.chars-stats', '(max-height: 560px)', { gap: '3px' }, 1),
  ]).dead.length, 1);
  // And a group that GROWS is not the idiom — the specific rule came first.
  t('false-positive: a widening group is not the idiom and IS reported', findDeadDecls([
    R(1, '.x', '', { color: 'red' }, 1),
    R(2, '.x', '', { color: 'blue' }, 2),
  ]).shadowed.length, 1);

  // An UNKNOWN condition must surface as UNKNOWN, not vanish. A checker that silently
  // drops what it cannot parse reports "0 faults" on a file it never read.
  const unk = findDeadDecls([
    R(1, '.x', 'not all and (max-height: 460px)', { color: 'red' }),
    R(2, '.x', '(max-height: 560px)', { color: 'blue' }),
  ]);
  t('dead: an unparseable condition is reported UNKNOWN, not clean', unk.unknown.length, 1);
  t('dead: ...and is NOT counted as a fault', unk.dead.length, 0);

  // normSel
  t('normSel collapses whitespace', normSel('.a  >  .b'), normSel('.a>.b'));
  t('normSel does not merge different selectors', normSel('.a .b') === normSel('.a.b'), false);

  // SELF-PAIR, with the KNOWN value asserted — `holds({a, b: a})` alone proves
  // determinism and nothing else (LESSONS §13).
  t('self-pair: one rule alone can never be dead', findDeadDecls([R(1, '.x', '', { color: 'red' })]).dead.length, 0);

  const pass = results.filter((r) => r.ok).length;
  for (const r of results) {
    if (!r.ok) console.log(`  ✗ ${r.name}\n      got  ${JSON.stringify(r.got)}\n      want ${JSON.stringify(r.want)}`);
  }
  console.log(`\ndc_guard selftest: ${pass}/${results.length} pass`);
  return pass === results.length ? 0 : 1;
}

// ═════════════════════════════════════════════════════════════════════════════
// BROWSER SIDE
// ═════════════════════════════════════════════════════════════════════════════

/** Flatten every rule in every injected `<style>` into `{order, selector, cond, decls}`.
 *  Runs in the page so it reads the SHIPPED CSSOM rather than a parse of the source. */
const harvestFn = () => {
  const out = [];
  for (const el of document.querySelectorAll('style[id^="fa-"]')) {
    const sheet = el.sheet;
    if (!sheet) continue;
    let order = 0;
    const walk = (rules, cond) => {
      for (const rule of rules) {
        if (rule.type === CSSRule.MEDIA_RULE) {
          const inner = cond ? `${cond} and ${rule.conditionText}` : rule.conditionText;
          walk(rule.cssRules, inner);
          continue;
        }
        if (rule.type === CSSRule.SUPPORTS_RULE) { walk(rule.cssRules, cond); continue; }
        if (rule.type !== CSSRule.STYLE_RULE) continue;
        const decls = {};
        for (const p of rule.style) decls[p] = { value: rule.style.getPropertyValue(p), important: rule.style.getPropertyPriority(p) === 'important' };
        // A comma list is N independent rules for cascade purposes — but the SIZE of
        // the list is kept, because `.a, .b { … }` then `.b { … }` is base-then-
        // specialise and not a defect.
        const sels = rule.selectorText.split(',');
        for (const sel of sels) {
          out.push({ sheet: el.id, order: order++, selector: sel.trim(), condText: cond || '', decls, groupSize: sels.length });
        }
      }
    };
    walk(sheet.cssRules, '');
  }
  return out;
};

/**
 * Find a live CSSStyleRule by selector text, across the injected sheets.
 *
 * ⚠️ THE FIRST VERSION DESCENDED BEFORE IT MATCHED, and found NOTHING — every ablation
 * reported ABSENT on declarations that were plainly in the file. Since CSS Nesting
 * shipped, a plain `CSSStyleRule` in Chromium EXPOSES a `cssRules` property (an empty
 * `CSSRuleList`, which is truthy), so `if (r.cssRules) { descend; continue; }` skipped
 * every style rule in the sheet. Probed: `styleRuleHasCssRules: true`. Match first,
 * and descend only into a list that has something in it.
 */
const RULE_FINDER = `
  window.__dcFindRule = (sel) => {
    for (const el of document.querySelectorAll('style[id^="fa-"]')) {
      const sheet = el.sheet; if (!sheet) continue;
      const stack = [...sheet.cssRules];
      while (stack.length) {
        const r = stack.shift();
        if (r.selectorText && r.selectorText.split(',').map(s => s.trim()).includes(sel)) return r;
        if (r.cssRules && r.cssRules.length) stack.unshift(...r.cssRules);
      }
    }
    return null;
  };
`;

/** Track/fill pairs. Each is mounted as a `<span>` inside an ordinary BLOCK parent,
 *  which is the shape that shipped broken. `.fa-stat-*` is included even though
 *  character select now draws pips instead: the rule is live in `theme.ts` and a
 *  latent trap is still a trap. */
const FILLS = [
  { track: 'ds-bar ds-bar--sm', trackSel: '.ds-bar', fill: 'ds-bar-fill', fillSel: '.ds-bar-fill' },
  { track: 'ds-bar', trackSel: '.ds-bar', fill: 'ds-bar-fill', fillSel: '.ds-bar-fill' },
  { track: 'fa-level-track', trackSel: '.fa-level-track', fill: 'fa-level-fill', fillSel: '.fa-level-fill' },
  { track: 'fa-stat-track', trackSel: '.fa-stat-track', fill: 'fa-stat-fill', fillSel: '.fa-stat-fill' },
];

const CAPTIONS = [
  { track: 'ds-bar ds-bar--sm', cap: 'ds-bar-cap', capSel: '.ds-bar-cap', text: '180 / 250 XP' },
  { track: 'fa-level-track', cap: 'fa-level-xp', capSel: '.fa-level-xp', text: '180 / 250 XP' },
];

/** Mount the fixture into the real `.fa-root`, so every token resolves against the real
 *  cascade rather than a hand-rolled copy of it. */
const mountFn = ({ fills, captions }) => {
  document.getElementById('dc-fixture')?.remove();
  const root = document.querySelector('.fa-root');
  if (!root) return { error: 'no .fa-root' };
  const host = document.createElement('div');
  host.id = 'dc-fixture';
  host.style.cssText = 'position:fixed; left:8px; top:8px; width:300px; z-index:99999; background:#2a1d3a; padding:10px; border-radius:8px;';
  let html = '';
  fills.forEach((f, i) => {
    // An ordinary block parent — NOT a flex container. Every current caller happens to
    // be a flex item, which blockifies an inline child and hides the missing `display`.
    html += `<div class="dc-slot" data-fill="${i}" style="margin:6px 0"><span class="${f.track}"><span class="${f.fill}" style="width:60%"></span></span></div>`;
  });
  captions.forEach((c, i) => {
    html += `<div class="dc-cap" data-cap="${i}" style="margin:6px 0"><span class="${c.track}" style="display:block; position:relative"><span class="${c.cap}">${c.text}</span></span></div>`;
  });
  host.innerHTML = html;
  root.appendChild(host);
  return { ok: true };
};

const measureFillsFn = () => {
  const out = [];
  for (const slot of document.querySelectorAll('#dc-fixture .dc-slot')) {
    const track = slot.firstElementChild;
    const fill = track.firstElementChild;
    const tr = track.getBoundingClientRect();
    const fr = fill.getBoundingClientRect();
    const cs = getComputedStyle(track);
    const bw = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
    const bh = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const ps = getComputedStyle(slot);
    // The width a BLOCK-level track would take: its parent's content box.
    const parentW = +(slot.getBoundingClientRect().width
      - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight)
      - parseFloat(ps.borderLeftWidth) - parseFloat(ps.borderRightWidth)).toFixed(2);
    out.push({
      idx: +slot.dataset.fill,
      parentW,
      trackW: +tr.width.toFixed(2), trackH: +tr.height.toFixed(2),
      innerW: +(tr.width - bw).toFixed(2), innerH: +(tr.height - bh).toFixed(2),
      borderH: +bh.toFixed(2),
      // `auto` for an inline non-replaced box — the declared height was DISCARDED.
      cssHeight: cs.height,
      // ⚠️ Probed, not assumed: this tree is `box-sizing: border-box`, and Chromium's
      // computed `height` is then the BORDER box (14px on a 14px track with 2px
      // borders). Adding the borders to it was a 4px phantom failure on a correct
      // component — the first version reported "declared height DISCARDED (computed
      // 14px, rendered 14px)", which is a check disagreeing with its own evidence.
      boxSizing: cs.boxSizing,
      fillW: +fr.width.toFixed(2), fillH: +fr.height.toFixed(2),
      trackDisplay: cs.display, fillDisplay: getComputedStyle(fill).display,
    });
  }
  return out;
};

/**
 * One rect per LINE BOX — the only way to ask "did this wrap?" that does not depend on
 * guessing a line height.
 *
 * ⚠️ The range must be over the TEXT NODE, not over the caption element. The caption is
 * `display: flex`, and a range over a flex container's contents returns ONE rect for the
 * anonymous item however many lines it contains — the first version of this reported
 * `1 line` on a caption that was visibly wrapped.
 */
const measureCapsFn = () => {
  const out = [];
  for (const slot of document.querySelectorAll('#dc-fixture .dc-cap')) {
    const track = slot.firstElementChild;
    const cap = track.firstElementChild;
    const r = document.createRange();
    r.selectNodeContents(cap.firstChild);
    const rects = [...r.getClientRects()];
    const tr = track.getBoundingClientRect();
    out.push({
      idx: +slot.dataset.cap,
      lines: rects.length,
      textW: rects.length ? +Math.max(...rects.map((x) => x.width)).toFixed(2) : 0,
      textH: +rects.reduce((a, x) => a + x.height, 0).toFixed(2),
      trackW: +tr.width.toFixed(2), trackH: +tr.height.toFixed(2),
      capScrollH: cap.scrollHeight, capClientH: cap.clientHeight,
      whiteSpace: getComputedStyle(cap).whiteSpace,
    });
  }
  return out;
};

/**
 * Derive the fixture width from the caption's own metrics rather than guessing one.
 *
 * ⚠️ THE FIRST VERSION MEASURED THE WRONG BOX and the whole check was inert because of
 * it. The caption is `position: absolute; inset: 0`, so its own bounding rect is the
 * TRACK's width — 274px — and never the text's. Setting the track to 262px therefore
 * left a 76px text run in a 256px box with nothing to wrap, and the check passed on a
 * component with no `white-space` at all. The text node's client rect is the only box
 * that answers "how wide is this run", and the track goes 12px UNDER it, so a wrap is
 * guaranteed to be possible.
 */
const sizeCapsFn = () => {
  const out = [];
  for (const slot of document.querySelectorAll('#dc-fixture .dc-cap')) {
    const track = slot.firstElementChild;
    const cap = track.firstElementChild;
    const prev = cap.style.whiteSpace;
    cap.style.whiteSpace = 'nowrap';
    const r = document.createRange();
    r.selectNodeContents(cap.firstChild);
    const need = Math.ceil(r.getBoundingClientRect().width);
    cap.style.whiteSpace = prev;
    const w = Math.max(24, need - 12);
    track.style.width = `${w}px`;
    out.push({ idx: +slot.dataset.cap, need, width: w });
  }
  return out;
};

async function run(url, outDir) {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: VP.w, height: VP.h }, deviceScaleFactor: 1 });
  const faults = [];
  const notes = [];

  await page.goto(`${url}/?screen=home&hold=600000&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction('window.__screen === "home" && window.__screenReady === true', null, { timeout: 90_000 });
  await page.waitForTimeout(2500);
  await page.addScriptTag({ content: RULE_FINDER });

  // ── CHECK 3 (static) — dead declarations across every injected sheet ───────
  // ⚠️ ONE PAGE LOAD PER SCREEN, unconditionally. A screen's `<style>` is injected on
  // FIRST MOUNT, so a run that only visits `home` analyses three sheets and reports
  // "0 faults" for four files it never read. The first version guessed at a router hook
  // and fell back only when it saw fewer than two sheets — it saw three, so the
  // fallback never fired and four screens went unaudited while the tool printed CLEAN.
  const acc = new Map();
  for (const r of await page.evaluate(harvestFn)) acc.set(`${r.sheet}|${r.order}|${r.selector}`, r);
  for (const sc of ['characters', 'trophies', 'shop', 'settings']) {
    const p2 = await browser.newPage({ viewport: { width: VP.w, height: VP.h } });
    await p2.goto(`${url}/?screen=${sc}&hold=600000&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await p2.waitForFunction(`window.__screen === ${JSON.stringify(sc)} && window.__screenReady === true`, null, { timeout: 90_000 }).catch(() => {});
    await p2.waitForTimeout(1200);
    for (const r of await p2.evaluate(harvestFn)) acc.set(`${r.sheet}|${r.order}|${r.selector}`, r);
    await p2.close();
  }
  const harvested = [...acc.values()];
  const sheets = [...new Set(harvested.map((r) => r.sheet))].sort();
  // A sheet that never loaded is a file that was never audited, and printing CLEAN for
  // it is the failure mode above. Say so out loud.
  const WANT_SHEETS = ['fa-screen-styles', 'fa-home-styles', 'fa-chars-styles', 'fa-trophy-styles', 'fa-shop-styles', 'fa-settings-styles'];
  const missing = WANT_SHEETS.filter((s) => !sheets.includes(s));
  if (missing.length) faults.push({ check: 'COVERAGE', label: 'unloaded stylesheet', detail: `${missing.join(', ')} never injected — those files were NOT audited` });

  const bySheet = new Map();
  for (const r of harvested) {
    if (!bySheet.has(r.sheet)) bySheet.set(r.sheet, []);
    bySheet.get(r.sheet).push({
      order: r.order, selector: r.selector, cond: parseCondition(r.condText),
      decls: r.decls, groupSize: r.groupSize,
      where: r.condText ? `@media ${r.condText}` : '(no media)',
    });
  }
  const cascade = [];
  const cascadeShadowed = [];
  const cascadeUnknown = [];
  for (const [sheet, rules] of bySheet) {
    const { dead, shadowed, unknown } = findDeadDecls(rules);
    for (const d of dead) cascade.push({ sheet, ...d });
    for (const s of shadowed) cascadeShadowed.push({ sheet, ...s });
    for (const u of unknown) cascadeUnknown.push({ sheet, ...u });
  }

  // ── CHECK 3 (delivered vs declared, ON THE REAL SCREEN) ───────────────────
  // A static finding is a theory until a browser is asked what the element actually
  // gets. For every fault, load the owning screen at a viewport the LOSER's condition
  // matches and read the property off a live element. If the delivered value is the
  // loser's, the static analysis was wrong and must say so.
  const SHEET_SCREEN = {
    'fa-screen-styles': 'home', 'fa-home-styles': 'home', 'fa-chars-styles': 'characters',
    'fa-trophy-styles': 'trophies', 'fa-shop-styles': 'shop', 'fa-settings-styles': 'settings',
  };
  /** A viewport inside the loser's condition — derived from the bounds, never guessed. */
  const vpFor = (cond) => {
    let w = 852; let h = 480;
    for (const c of cond.constraints) {
      if (c.kind === 'max' && c.axis === 'width') w = Math.min(w, c.px);
      if (c.kind === 'max' && c.axis === 'height') h = Math.min(h, c.px);
      if (c.kind === 'min' && c.axis === 'width') w = Math.max(w, c.px);
      if (c.kind === 'min' && c.axis === 'height') h = Math.max(h, c.px);
    }
    return { w: Math.round(w), h: Math.round(h) };
  };
  const byProbe = new Map();
  for (const d of cascade) {
    const screen = SHEET_SCREEN[d.sheet];
    if (!screen) continue;
    const vp = vpFor(d.loser.cond);
    const k = `${screen}|${vp.w}x${vp.h}`;
    if (!byProbe.has(k)) byProbe.set(k, { screen, vp, items: [] });
    byProbe.get(k).items.push(d);
  }
  for (const { screen, vp, items } of byProbe.values()) {
    const p3 = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    await p3.goto(`${url}/?screen=${screen}&hold=600000&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await p3.waitForFunction(`window.__screen === ${JSON.stringify(screen)} && window.__screenReady === true`, null, { timeout: 90_000 }).catch(() => {});
    await p3.waitForTimeout(1500);
    const got = await p3.evaluate((list) => list.map(({ selector, prop }) => {
      const els = [...document.querySelectorAll(selector)];
      return { selector, prop, n: els.length, value: els.length ? getComputedStyle(els[0]).getPropertyValue(prop) : null };
    }), items.map((d) => ({ selector: d.selector, prop: d.prop })));
    items.forEach((d, i) => { d.delivered = got[i]; d.probeVp = `${vp.w}x${vp.h}`; });
    await p3.close();
  }

  // ── CHECK 3 (runtime) — the static rule must correspond to a real misdelivery ──
  // The 460-before-560 fixture, in the browser, AT A VIEWPORT BOTH CONDITIONS MATCH.
  // ⚠️ The first version ran it at 852x480 and both orderings delivered 12px, because
  // `(max-height: 460px)` does not match a 480px-tall viewport at all — the fixture was
  // measuring nothing and the "expected" answer would have been wrong either way. The
  // real defect was measured at 844x390, which is where both queries are live, so that
  // is where the fixture has to run.
  const cascadePage = await browser.newPage({ viewport: { width: 844, height: 390 } });
  await cascadePage.goto(`${url}/?screen=home&hold=600000&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await cascadePage.waitForTimeout(1200);
  const delivered = await cascadePage.evaluate(() => {
    const mk = (css) => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); return s; };
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-9999px;top:0';
    host.innerHTML = '<span class="dc-bad">x</span><span class="dc-good">x</span>';
    document.body.appendChild(host);
    const s = mk(`
      @media (max-height: 460px) { .dc-bad { font-size: 22px; } }
      @media (max-height: 560px) { .dc-bad { font-size: 12px; } }
      @media (max-height: 560px) { .dc-good { font-size: 12px; } }
      @media (max-height: 460px) { .dc-good { font-size: 22px; } }
    `);
    const bad = getComputedStyle(host.children[0]).fontSize;
    const good = getComputedStyle(host.children[1]).fontSize;
    host.remove(); s.remove();
    return { bad, good, innerHeight: window.innerHeight };
  });
  await cascadePage.close();

  // ── CHECKS 1 & 2 — the fixture, with in-band ablation ─────────────────────
  await page.evaluate(mountFn, { fills: FILLS, captions: CAPTIONS });
  const capSizes = await page.evaluate(sizeCapsFn);
  await page.waitForTimeout(200);

  const fillsBefore = await page.evaluate(measureFillsFn);
  const capsBefore = await page.evaluate(measureCapsFn);

  if (outDir) {
    await mkdir(resolve(outDir), { recursive: true });
    await page.screenshot({ path: resolve(outDir, 'dc-fixture.png'), clip: { x: 0, y: 0, width: 330, height: 320 } });
  }

  /**
   * ⚠️ THE FIRST VERSION OF THIS JUDGE WAS TAUTOLOGICAL ON EXACTLY THE BUG IT EXISTS
   * FOR, and it is recorded rather than quietly replaced. It asked only "is the fill
   * 60% of the track's OBSERVED inner width and as tall as its OBSERVED inner height".
   * An inline track collapses to width 0, so the fill was 0 of 0 — which is 60% — and
   * both the fill and the track reported the line-box height, so it passed with
   * `0x24 in a 0x24 track`. A ratio against an observed denominator cannot see a
   * denominator that has itself collapsed.
   *
   * So the judge now compares against what the STYLESHEET DECLARED:
   *   * a track occupies its parent's content width (block-level),
   *   * its used height equals its declared `height` plus borders — `getComputedStyle`
   *     returns `auto` for an inline box, which is the declaration being DISCARDED,
   *   * and only then is the fill 60% of a non-zero inner width, full inner height.
   */
  const judgeFill = (m) => {
    const f = FILLS[m.idx];
    const wantW = m.innerW * 0.6;
    const declaredH = parseFloat(m.cssHeight);
    const wantTrackH = declaredH + (m.boxSizing === 'border-box' ? 0 : m.borderH);
    const okTrackW = m.parentW > 0 && Math.abs(m.trackW - m.parentW) <= 0.5;
    const okTrackH = Number.isFinite(declaredH) && Math.abs(m.trackH - wantTrackH) <= 0.5;
    const okFillH = m.fillH >= m.innerH - 0.6;
    const okFillW = m.innerW > 1 && Math.abs(m.fillW - wantW) <= 1.0;
    return {
      ok: okTrackW && okTrackH && okFillH && okFillW,
      okTrackW, okTrackH, okFillH, okFillW,
      wantW: +wantW.toFixed(2), label: `${f.trackSel} > ${f.fillSel}`, ...m,
    };
  };
  const judgeCap = (m) => ({ ok: m.lines === 1, label: CAPTIONS[m.idx].capSel, ...m });

  for (const m of fillsBefore.map(judgeFill)) {
    if (!m.ok) {
      const why = [!m.okTrackW && `track is ${m.trackW}px wide in a ${m.parentW}px parent (display '${m.trackDisplay}')`,
        !m.okTrackH && `declared height was DISCARDED (computed height '${m.cssHeight}', rendered ${m.trackH}px)`,
        !m.okFillH && `fill is ${m.fillH}px tall in a ${m.innerH}px track`,
        !m.okFillW && `fill is ${m.fillW}px wide, wanted ≈${m.wantW} of a ${m.innerW}px inner track (fill display '${m.fillDisplay}')`].filter(Boolean);
      faults.push({ check: 'FILL', label: m.label, detail: why.join('; ') });
    }
  }
  for (const m of capsBefore.map(judgeCap)) {
    if (!m.ok) faults.push({ check: 'CAPTION', label: m.label, detail: `${m.lines} line boxes (${m.textH}px of text) in a ${m.trackH}px track at width ${m.trackW} (white-space '${m.whiteSpace}') — the overflow is CLIPPED through both lines` });
  }

  // ── ABLATION: remove the declaration the check exists to protect, and REQUIRE
  //    the measurement to fail. Then restore and require it to pass again.
  const ablate = async (sel, prop) => page.evaluate(([s, p]) => {
    const r = window.__dcFindRule(s);
    if (!r) return null;
    const prev = r.style.getPropertyValue(p);
    const prio = r.style.getPropertyPriority(p);
    r.style.removeProperty(p);
    return { prev, prio };
  }, [sel, prop]);
  const restore = async (sel, prop, saved) => page.evaluate(([s, p, v, prio]) => {
    const r = window.__dcFindRule(s);
    if (r && v) r.style.setProperty(p, v, prio);
  }, [sel, prop, saved?.prev, saved?.prio]);

  const ablations = [];
  const ablateAndRequireFailure = async (name, sel, prop, measure, judge, idxs) => {
    const saved = await ablate(sel, prop);
    if (!saved || !saved.prev) {
      ablations.push({ name, status: 'ABSENT', note: `'${prop}' is not declared on '${sel}' — nothing to ablate, so this check is UNVALIDATED` });
      faults.push({ check: 'ABLATION', label: `${sel} { ${prop} }`, detail: 'the declaration this check protects does not exist; the check is UNVALIDATED' });
      return;
    }
    await page.waitForTimeout(120);
    const after = (await page.evaluate(measure)).map(judge).filter((m) => idxs.includes(m.idx));
    const broke = after.filter((m) => !m.ok);
    await restore(sel, prop, saved);
    await page.waitForTimeout(120);
    const back = (await page.evaluate(measure)).map(judge).filter((m) => idxs.includes(m.idx));
    const restored = back.every((m) => m.ok);
    const status = broke.length === after.length && restored ? 'MOVES' : 'TAUTOLOGICAL';
    ablations.push({
      name, status, removed: `${prop}: ${saved.prev}`,
      broke: broke.length, of: after.length, restored,
      evidence: after.map((m) => (m.lines !== undefined ? `${m.lines} lines` : `${m.fillW}x${m.fillH}`)).join(', '),
    });
    if (status !== 'MOVES') {
      faults.push({ check: 'ABLATION', label: `${sel} { ${prop} }`, detail: `removing it broke ${broke.length}/${after.length} and restore ${restored ? 'worked' : 'FAILED'} — this check cannot fail on the bug it guards` });
    }
  };

  const fillIdxByTrack = (sel) => FILLS.map((f, i) => [f, i]).filter(([f]) => f.trackSel === sel).map(([, i]) => i);
  const fillIdxByFill = (sel) => FILLS.map((f, i) => [f, i]).filter(([f]) => f.fillSel === sel).map(([, i]) => i);
  const capIdx = (sel) => CAPTIONS.map((c, i) => [c, i]).filter(([c]) => c.capSel === sel).map(([, i]) => i);

  for (const sel of [...new Set(FILLS.map((f) => f.fillSel))]) {
    await ablateAndRequireFailure(`fill ${sel}`, sel, 'display', measureFillsFn, judgeFill, fillIdxByFill(sel));
  }
  for (const sel of [...new Set(FILLS.map((f) => f.trackSel))]) {
    await ablateAndRequireFailure(`track ${sel}`, sel, 'display', measureFillsFn, judgeFill, fillIdxByTrack(sel));
  }
  for (const sel of [...new Set(CAPTIONS.map((c) => c.capSel))]) {
    await ablateAndRequireFailure(`caption ${sel}`, sel, 'white-space', measureCapsFn, judgeCap, capIdx(sel));
  }

  await browser.close();

  // ── Report ────────────────────────────────────────────────────────────────
  console.log(`\ndc_guard @ ${VP.w}x${VP.h}   (${url})\n`);

  console.log('── 1/2  COMPONENT FIXTURE — track/fill and caption, in a BLOCK parent ──');
  for (const m of fillsBefore.map(judgeFill)) {
    console.log(`  ${m.ok ? 'ok  ' : 'FAIL'} ${m.label.padEnd(38)} track ${String(m.trackW).padStart(7)}x${String(m.trackH).padStart(5)} of ${m.parentW}px parent (declared h ${m.cssHeight}, display '${m.trackDisplay}')  fill ${String(m.fillW).padStart(7)}x${String(m.fillH).padStart(5)}  want w≈${m.wantW}`);
  }
  for (const m of capsBefore.map(judgeCap)) {
    const sz = capSizes.find((c) => c.idx === m.idx);
    console.log(`  ${m.ok ? 'ok  ' : 'FAIL'} ${m.label.padEnd(38)} ${m.lines} line box(es)  track ${m.trackW}x${m.trackH}  text needs ${sz?.need}px on one line  white-space '${m.whiteSpace}'`);
  }

  console.log('\n── 3  CASCADE — declarations that can never win ────────────────────────');
  console.log(`  sheets ${sheets.length ? sheets.join(', ') : [...bySheet.keys()].join(', ')}   rules ${harvested.length}`);
  console.log(`  runtime fixture @ innerHeight ${delivered.innerHeight}: 460-before-560 delivers ${delivered.bad} (declared 22px), 560-before-460 delivers ${delivered.good}`);
  if (delivered.bad !== '12px' || delivered.good !== '22px') {
    faults.push({ check: 'CASCADE-FIXTURE', label: 'delivered vs declared', detail: `expected bad=12px good=22px, got bad=${delivered.bad} good=${delivered.good} — the browser does not reproduce the documented misdelivery, so the static rule is unvalidated here` });
  }
  if (cascade.length === 0) console.log('  0 ordering faults');
  for (const d of cascade) {
    const del = d.delivered;
    console.log(`  FAULT ${d.sheet}  ${d.selector}  { ${d.prop} }`);
    console.log(`        ${d.loser.where} -> ${d.loser.value}   NEVER WINS (narrower condition, written FIRST)`);
    console.log(`        ${d.winner.where} -> ${d.winner.value}   written later, wider condition`);
    if (del) console.log(`        delivered @${d.probeVp}: '${del.value}' on ${del.n} live element(s)`);
    faults.push({
      check: 'CASCADE',
      label: `${d.sheet} ${d.selector} { ${d.prop} }`,
      detail: `${d.loser.where} '${d.loser.value}' can never win against ${d.winner.where} '${d.winner.value}'`
        + (del ? ` — delivered @${d.probeVp} on ${del.n} live element(s): '${del.value}'` : ''),
    });
    // If the browser DELIVERS the loser's value, the static analysis is wrong here and
    // the report must not claim a defect it cannot see.
    if (del && del.n > 0 && del.value.trim() === d.loser.value.trim()) {
      notes.push(`⚠️ REFUTED by the browser: ${d.selector} { ${d.prop} } delivers the loser's own value at ${d.probeVp}. The static rule is wrong for this case.`);
    }
  }
  if (cascadeShadowed.length) {
    console.log(`\n  ${cascadeShadowed.length} SHADOWED declaration(s) — dead, but the cascade delivers the author's last`);
    console.log('  word, so these are reported and are NOT faults:');
    for (const s of cascadeShadowed) {
      console.log(`    ${s.sheet}  ${s.selector} { ${s.prop} }  '${s.loser.value}' -> '${s.winner.value}' (${s.loser.where})`);
    }
  }
  for (const u of cascadeUnknown) {
    notes.push(`UNKNOWN condition, not analysed: ${u.sheet} ${u.selector} (${u.props.join(', ')}) ${u.a} vs ${u.b}`);
  }

  console.log('\n── ABLATIONS — every check, shown to FAIL on the bug it guards ─────────');
  for (const a of ablations) {
    console.log(`  ${a.status.padEnd(13)} ${a.name.padEnd(30)} ${a.removed ? `removed '${a.removed}' -> ${a.broke}/${a.of} broke, restore ${a.restored ? 'ok' : 'FAILED'}  [${a.evidence}]` : a.note}`);
  }

  for (const n of notes) console.log(`\n  note: ${n}`);

  console.log(`\n${faults.length === 0 ? 'ALL CLEAN' : `${faults.length} FAULT(S)`}`);
  for (const f of faults) console.log(`  ${f.check}  ${f.label}\n      ${f.detail}`);
  return faults.length === 0 ? 0 : 1;
}

const args = parseArgs(process.argv);
if (args.selftest) {
  process.exit(selftest());
} else if (args.url) {
  run(String(args.url).replace(/\/$/, ''), args.out ? String(args.out) : null)
    .then((c) => process.exit(c))
    .catch((e) => { console.error(e); process.exit(2); });
} else {
  console.log('usage: node tools/tmp/dc_guard.mjs --selftest | --url <snapshot> [--out shots/dc]');
  process.exit(2);
}
