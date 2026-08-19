#!/usr/bin/env node
/**
 * gatecount — the guard on the gate battery's own documented counts.
 *
 *   node tools/tmp/gatecount.mjs             # docs check + run every OFFLINE gate + diff. exit 1 on any fault
 *   node tools/tmp/gatecount.mjs --docs-only # the docs half only (~30ms, no gates run)
 *   node tools/tmp/gatecount.mjs --selftest  # the known-bad-input proofs. Run this before believing the tool
 *   node tools/tmp/gatecount.mjs --list      # what is registered OFFLINE, what is SKIPped and why
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * Six documented gate counts went stale in ONE session, and every one was found by an agent
 * tripping over it rather than by a check:
 *
 *     valuescan --selftest   doc 57   actual 78 (now 105)
 *     arena-scan --selftest  doc 78   actual 105
 *     driver_guard           doc 49   actual 60 (now 86)
 *     economy.test.mjs       doc 220  actual 227
 *     audio-probe --mode all doc 389  actual 427
 *     audio-probe identity   doc 77   actual 78
 *
 * Twice the SAME FILE disagreed with itself — `docs/TOOLS.md` carried `economy 173` in its
 * quick-start block and `220` in its gate table; `driver_guard` had two table rows with
 * different numbers. **Either copy could be "confirmed" by reading the other.**
 *
 * The root cause was never the individual numbers. It was that they lived in THREE places
 * (CLAUDE.md's gate block, TOOLS.md's quick-start, TOOLS.md's gate table) with no single source.
 *
 * ─── SO THE FIX IS A COLLAPSE, NOT A CHECK ──────────────────────────────────
 * `docs/TOOLS.md`'s **GATE BATTERY table is now the single source**, and its `expect` column is
 * machine-read. CLAUDE.md's block and TOOLS.md's quick-start carry **no counts at all** — they
 * point here. A check that has to be run is weaker than a duplication that cannot exist, so this
 * tool's first job is not to compare copies but to **prove there is only one**:
 *
 *   1. DUP     — any count-bearing mention of a gate outside its canonical table row is a fault,
 *                *even when it agrees*. Today's agreeing copy is next month's stale one; both of
 *                the same-file disagreements above began life agreeing.
 *   2. ROW     — the same gate command appearing on two table rows.
 *   3. ARITY   — the table row's integer count and the registry's measured vector must be the same
 *                length. You cannot add a number to the doc without this tool noticing.
 *   4. UNREG   — a table row in neither the OFFLINE nor the SKIP registry. A new gate cannot be
 *                silently unchecked.
 *   5. MISMATCH— the documented number is not the measured one.
 *   6. UNPARSEABLE — a gate's output no longer matches its pattern. **This FAILS LOUDLY.** A gate
 *                whose format drifts and quietly stops being checked is the `driver_guard`
 *                coverage-shrank bug again (docs/LESSONS.md §13).
 *
 * ─── WHAT THIS TOOL DELIBERATELY DOES NOT DO ────────────────────────────────
 * It runs **no browser gate**. Peers measure on the GPU in this tree and load contention corrupts
 * *their* numbers, not ours. Browser gates are listed in SKIP with a reason and printed in the
 * table as SKIP rows — **visible, never omitted**, because an invisible gap is the bug above.
 * `audio-probe --mode live`'s countdown checks are proven pre-existing flake (untouched HEAD gave
 * 29/29, 27/29, 26/29 on three consecutive runs), which is a second reason it is not run here.
 *
 * ─── THE SELFTEST, AND WHY IT IS SHAPED THIS WAY (docs/LESSONS.md §13) ──────
 * `sentinel`'s `selfPair` was `holds({a, b: a})` — zero for ANY pure function. It proved
 * determinism and asserted nothing for its whole life. A guard has two ways to be worthless: it
 * can fail to fail on the bug, or it can be **tautological**. So every assertion below is paired
 * with the implementation that FAILS it, named in its own label, and every refusal test is
 * accompanied by a positive control — otherwise a checker that always screams would "pass" every
 * refusal test in the file.
 *
 * `--selftest` runs on FIXTURES. It was additionally validated by mutating the REAL `CLAUDE.md`
 * and `docs/TOOLS.md` in memory, ten ways, with an unmutated control first — the fixture world
 * could always be the thing that is wrong:
 *
 *     CONTROL  unmutated real files ................................. clean
 *     table's sim count 253 -> 254 ................................. MISMATCH
 *     sim.test.mjs's output format changed ......................... UNPARSEABLE
 *     CLAUDE.md regains "# 253" .................................... DUP
 *     CLAUDE.md regains an AGREEING "(32/32)" ...................... DUP
 *     a new gate row in neither registry ........................... UNREG
 *     driver_guard's row duplicated at 49 (the real defect) ........ ROW
 *     a doc row gains an integer nothing measures .................. ARITY
 *     the `gatecount: historical` marker removed ................... DUP
 *     the gate table deleted outright .............................. throws
 *
 * ─── EXACTLY WHAT "REFUSES A SECOND COPY" MEANS, MEASURED 2026-08-12 ────────
 * 🚨 Three documents and this header all claimed more than the tool does, so the claim is now
 * written next to the numbers that bound it. **Two files, path-named mentions, a two-line window:**
 *
 *   SCOPE.   Exactly two documents are read — `CLAUDE.md` and `docs/TOOLS.md`. **NOT
 *            `docs/STATE.md`, NOT `docs/AGENT-BRIEF.md`, not `docs/LESSONS.md`.** `docs/STATE.md`
 *            already carried an unpoliced gate count while three files said it could not.
 *   HANDLE.  A line is only examined if it contains the gate's **`.mjs` PATH** (`findDuplicateCopies`
 *            line 1: `if (!lines[i].includes(p)) continue`). A count beside a **bare tool name**
 *            (`` `ic_spec` prints 24 ``) names no path and is invisible.
 *   WINDOW.  That line and the next. A count three or more lines from the name is not seen.
 *
 * ⚠️ **AND THE OLD WORDING HERE, KEPT WITH THE REASON, WAS A MEASUREMENT THAT HAD GONE STALE:**
 * *"measured on the real files, two lines produce exactly one hit and it is a genuine historical
 * quote."* It produced **ZERO** hits by 2026-08-12. The one hit was `CLAUDE.md`'s `17/17` quote; the
 * paragraph around it grew until the name and the count were **19 lines apart**, the scan stopped
 * reaching it, and its `gatecount: historical` marker went **decorative** — suppressing nothing,
 * while looking exactly like it was suppressing something. Fixed by naming the path on the marker's
 * own line, and §G now asserts that it is still load-bearing.
 *
 * ⚠️ **WIDENING WAS PRICED BEFORE IT WAS REJECTED**, on the real `CLAUDE.md` / `docs/TOOLS.md` /
 * `docs/STATE.md` / `docs/AGENT-BRIEF.md`, counting true vs false positives:
 *
 *     paths, 2 files, window 1  (SHIPPED) ....  0 hits
 *     paths, 2 files, window 3 / window 6 ....  0 hits          — widening the WINDOW buys nothing
 *     paths, + STATE + BRIEF, window 1 .......  1 hit,  0 true  — "`healAmount` 25 → **18**"
 *     paths, + STATE + BRIEF, window 3 .......  2 hits, 0 true  — + "**2800**", the arena width
 *     BARE NAMES, 2 files, same line only ....  3 hits, 0 true  — all three the camera pitch **58**
 *     BARE NAMES, + STATE + BRIEF, window 1 .. 17 hits, 1 true  — pitch, heal, ρ, rule numbers…
 *
 * The one true positive a bare-name scan finds (`docs/STATE.md`'s `ic_spec` count) costs sixteen
 * false ones, and these documents are full of historical numbers **on purpose** — the house style
 * is to keep old values beside new ones. A guard that cries wolf gets switched off, and then it
 * guards nothing. So the tool stayed narrow and **the claim was narrowed to match it** in
 * `CLAUDE.md`, `docs/STATE.md`, `docs/AGENT-BRIEF.md` and `docs/TOOLS.md`.
 *
 * ⚠️ One claim that was made about this tool and is **FALSE**, recorded so it is not re-derived:
 * *"the guard would not have caught the defect it exists to commemorate."* The real pre-`d9788eb`
 * line was ``  `tools/tmp/sentinel.mjs` (17/17) encodes this: MOVES, HOLDS, `` — path and count on
 * ONE line. Fed to `check()` it produces `DUP`. §G3 runs that exact line; §B4 has always asserted
 * its shape.
 */

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TOOLS_MD = 'docs/TOOLS.md';
const CLAUDE_MD = 'CLAUDE.md';

/**
 * 🚨 THE ENTIRE SCOPE OF THE DUPLICATE SCAN, NAMED SO IT CAN BE ASSERTED.
 *
 * It used to be an anonymous two-element array literal inside `check()`, which made the scope a
 * fact nobody could check and four documents claimed wrongly — `docs/STATE.md` said *"`gatecount`
 * refuses a second copy even one that agrees"* about **itself** while carrying an unpoliced gate
 * count. Adding a document here obliges you to update the wording in `CLAUDE.md`,
 * `docs/TOOLS.md`, `docs/STATE.md` and `docs/AGENT-BRIEF.md`; `--selftest` §G5 is the tripwire.
 */
export const SCANNED_DOCS = [TOOLS_MD, CLAUDE_MD];

/* ══════════════════════════════════════════════════════════════════════════
   PURE PARSERS — every one is exercised by --selftest against a broken input
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Integers in a doc cell, in order.
 *
 * ⚠️ A decimal is NOT two integers. `PASS, **0.00wu**` must yield [] — a naive /\d+/g yields
 * [0, 0, 0] and would then demand the aspect gate measure three numbers. Selftest §A2.
 */
export function intsOf(cell) {
  return [...String(cell).matchAll(/(?<![\d.])\d+(?![\d.])/g)].map((m) => Number(m[0]));
}

/** Canonical form of a gate command, so `node x.mjs`, `` `x.mjs` `` and `PREVIEW_BASE=… node x.mjs` are one key. */
export function normCmd(s) {
  return String(s)
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .replace(/^\s*PREVIEW_BASE=\S+\s+/, '')
    .replace(/^\s*node\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The GATE BATTERY table out of docs/TOOLS.md.
 *
 * Throws if the header is absent. An implementation that returned [] on a missing header would
 * report "0 mismatches" on a doc whose table had been deleted — the loudest possible silent pass.
 * Selftest §A6.
 */
export function parseGateTable(md) {
  const lines = md.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\|\s*gate\s*\|\s*expect\s*\|/i.test(lines[i])) { start = i; break; }
  }
  if (start < 0) throw new Error('gatecount: no `| gate | expect |` table found — the single source is GONE');
  const rows = [];
  for (let i = start + 2; i < lines.length; i++) {
    const ln = lines[i];
    if (!ln.startsWith('|')) break;
    const cells = ln.split('|').slice(1, -1);
    if (cells.length < 2) continue;
    rows.push({
      raw: ln,
      line: i + 1,
      gateCell: cells[0].trim(),
      expectCell: cells[1].trim(),
      coversCell: (cells[2] ?? '').trim(),
      key: normCmd(cells[0]),
      ints: intsOf(cells[1]),
    });
  }
  if (!rows.length) throw new Error('gatecount: the gate table has a header and no rows');
  return { rows, headerLine: start + 1 };
}

/**
 * Count-like evidence on a line. Deliberately ANCHORED, not "any digit near the word".
 *
 * An over-eager matcher is its own failure mode: a guard that fires on every prose mention gets
 * switched off, and then guards nothing. §B3 is the false-positive control — a plain prose
 * mention with no count must NOT be reported.
 */
const COUNT_NEAR = [
  /#\s*\**(\d+)\b/,                                                  // bash comment:  "# 253"
  /\*\*(\d+)\*\*/,                                                   // a bolded bare number
  /\b(\d+)\s+(?:assertions?|passed|checks?|pass\b|selftest\b|live\b)/i,
  /\b(\d+)\/(\d+)\b/,                                                // "32/32", "43/43"
];

export function countEvidence(line) {
  for (const re of COUNT_NEAR) {
    const m = re.exec(line);
    if (m) return m[0].trim();
  }
  return null;
}

/** The `.mjs` (or `.test.mjs`) path a gate key runs, or null for things like `npx tsc --noEmit`. */
export function scriptPathOf(key) {
  const m = /(^|\s)([\w./-]+\.mjs)(\s|$)/.exec(key);
  return m ? m[2] : null;
}

/**
 * Deliberate historical quote — `CLAUDE.md`'s note that this line once carried a stale `17/17` is
 * a record, not a live count. Annotated exemptions are visible in a diff; a silent blind spot is not.
 */
const HISTORICAL = 'gatecount: historical';

/**
 * Every count-bearing mention of a registered gate that is NOT its canonical table row.
 *
 * `exempt` is a Set of `file:line` — the canonical rows. Everything else that names the script and
 * carries a count **within a two-line window** is a second copy: the count is usually on the same
 * line (`# 253`, `(32/32)`) but markdown prose wraps, so the line after counts too.
 *
 * Reported whether or not it agrees — see the header.
 *
 * 🚨 **THE HANDLE IS THE `.mjs` PATH, WHICH IS THE TOOL'S BIGGEST BLIND SPOT AND ITS ONLY DEFENCE
 * AGAINST NOISE.** `lines[i].includes(p)` below is the whole filter: a count beside a **bare tool
 * name** is never examined. That is deliberate and priced — see the widening table in the file
 * header (bare names cost 16 false positives for 1 true one on the real documents) — but it is a
 * blind spot, not a guarantee, and §G4 asserts it explicitly so it is visible rather than
 * discovered. The window is TWO lines for the same reason.
 *
 * ⚠️ **THE OLD WORDING HERE, KEPT WITH THE REASON:** *"Measured on the real `CLAUDE.md` and
 * `docs/TOOLS.md`, a two-line window produces exactly one hit and it is a genuine historical
 * quote."* True when written, **zero hits by 2026-08-12** — the quote's paragraph grew until its
 * tool name was 19 lines from its count. A measurement quoted in a docstring ages exactly like a
 * gate count in a doc, which is the thing this entire file exists to prevent.
 */
export function findDuplicateCopies(files, gateKeys, exempt) {
  const paths = gateKeys.map((k) => [k, scriptPathOf(k)]).filter(([, p]) => p);
  const out = [];
  for (const { name, text } of files) {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (exempt.has(`${name}:${i + 1}`)) continue;      // a canonical row: skip its whole window
      for (const [key, p] of paths) {
        if (!lines[i].includes(p)) continue;
        for (let w = 0; w <= 1; w++) {
          const ln = lines[i + w];
          if (ln === undefined) break;
          if (w > 0 && exempt.has(`${name}:${i + w + 1}`)) break;   // don't read the next gate's row
          if (lines[i].includes(HISTORICAL) || ln.includes(HISTORICAL)) break;
          const ev = countEvidence(ln);
          if (ev) { out.push({ at: `${name}:${i + w + 1}`, key, evidence: ev, line: ln.trim() }); break; }
        }
      }
    }
  }
  return out;
}

/**
 * Pull the measured vector out of a gate's stdout.
 *
 * Refuses — never guesses — in three ways, each with a selftest fixture:
 *   no match      → UNPARSEABLE (§C2 empty, §C3 format changed, §C5 another gate's summary)
 *   decoy digits  → UNPARSEABLE, NOT the decoy (§C4: "driver rev 4" must not read as 4)
 *   two conflicting summary lines → AMBIGUOUS (§C6)
 */
export function parseGateOutput(text, re) {
  const clean = String(text).replace(/\[[0-9;]*m/g, '');
  const rx = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  const hits = [...clean.matchAll(rx)].map((m) => m.slice(1).map(Number));
  if (hits.length === 0) return { ok: false, why: 'UNPARSEABLE', values: null };
  const first = JSON.stringify(hits[0]);
  if (hits.some((h) => JSON.stringify(h) !== first)) {
    return { ok: false, why: 'AMBIGUOUS', values: null, hits };
  }
  return { ok: true, values: hits[0] };
}

/* ══════════════════════════════════════════════════════════════════════════
   REGISTRY
   ══════════════════════════════════════════════════════════════════════════ */

// "N passed, 0 failed" as a whole line. Leading indent tolerated (burger_lab indents its summary);
// the shape is otherwise exact, so a changed format still fails loudly — see §C3. Verified to
// match EXACTLY ONCE on every tool registered against it; a second, different match is AMBIGUOUS.
const S = /^\s*(\d+) passed, \d+ failed\s*$/m;
const SLASH_ASSERT = /^\s*\d+\/(\d+) assertions passed\s*$/m;

/** probe: argv (after `node`), and a regex whose CAPTURE GROUPS are the measured vector. */
const pr = (argv, re) => ({ argv, re });

/**
 * OFFLINE — cheap, no browser, no snapshot. Ordered roughly by cost.
 * `probes` concatenate: their capture groups, in order, are compared elementwise with the doc
 * row's integers. Same length required (ARITY), so a number added to the doc cannot go unchecked.
 */
const OFFLINE = [
  { key: 'src/game/sim.test.mjs',                probes: [pr(['src/game/sim.test.mjs'], S)] },
  { key: 'src/game/economy/economy.test.mjs',    probes: [pr(['src/game/economy/economy.test.mjs'], S)] },
  { key: 'tools/arena-scan.mjs --selftest',      probes: [pr(['tools/arena-scan.mjs', '--selftest'], S)] },
  { key: 'tools/tmp/valuescan.mjs --selftest',   probes: [pr(['tools/tmp/valuescan.mjs', '--selftest'], S)] },
  { key: 'tools/tmp/haloprobe.mjs --selftest',   probes: [pr(['tools/tmp/haloprobe.mjs', '--selftest'], S)] },
  { key: 'tools/tmp/lu_occlude.mjs --selftest', probes: [pr(['tools/tmp/lu_occlude.mjs', '--selftest'], S)] },
  { key: 'tools/tmp/lu2_qafog.mjs --selftest', probes: [pr(['tools/tmp/lu2_qafog.mjs', '--selftest'], S)] },
  { key: 'tools/tmp/lu2_offscreen.mjs --selftest', probes: [pr(['tools/tmp/lu2_offscreen.mjs', '--selftest'], S)] },
  { key: 'tools/tmp/kx_seatfair.mjs --selftest', probes: [pr(['tools/tmp/kx_seatfair.mjs', '--selftest'], S)] },
  { key: 'tools/tmp/kx_fogcover.mjs --selftest', probes: [pr(['tools/tmp/kx_fogcover.mjs', '--selftest'], S)] },
  { key: 'tools/tmp/wm_gate.mjs --selftest', probes: [pr(['tools/tmp/wm_gate.mjs', '--selftest'], S)] },
  { key: 'tools/tmp/rc_prose.mjs', probes: [pr(['tools/tmp/rc_prose.mjs'], /(\d+)\/\d+ checks passed/)] },
  { key: 'tools/tmp/nk_neckgate.mjs --selftest', probes: [pr(['tools/tmp/nk_neckgate.mjs', '--selftest'], /(\d+) pass, \d+ fail/)] },
  { key: 'tools/tmp/xr_repro.mjs --selftest', probes: [pr(['tools/tmp/xr_repro.mjs', '--selftest'], /selftest (\d+) pass \/ \d+ fail/)] },
  { key: 'tools/tmp/xr_plate.mjs --selftest', probes: [pr(['tools/tmp/xr_plate.mjs', '--selftest'], /selftest (\d+) pass \/ \d+ fail/)] },
  { key: 'tools/tmp/p5_dlprobe.mjs',             probes: [pr(['tools/tmp/p5_dlprobe.mjs'], S)] },
  { key: 'tools/match-sim.mjs --selftest',       probes: [pr(['tools/match-sim.mjs', '--selftest'], SLASH_ASSERT)] },
  { key: 'tools/tmp/level_lab.mjs --selftest',   probes: [pr(['tools/tmp/level_lab.mjs', '--selftest'], SLASH_ASSERT)] },
  { key: 'tools/tmp/kit_lab.mjs --selftest',     probes: [pr(['tools/tmp/kit_lab.mjs', '--selftest'], SLASH_ASSERT)] },
  { key: 'tools/tmp/pc_lab.mjs --selftest',      probes: [pr(['tools/tmp/pc_lab.mjs', '--selftest'], S)] },
  { key: 'tools/tmp/roster_lab.mjs --selftest',  probes: [pr(['tools/tmp/roster_lab.mjs', '--selftest'], SLASH_ASSERT)] },
  // Registered OFFLINE despite 6 browser references in the file: `--selftest` returns in 0.15 s and
  // never reaches `runCapture`. Timed before registering, after `hw_ord`/`hw_burner` were put on
  // this path while IGNORING `--selftest` entirely and made gatecount boot a GPU probe every run.
  { key: 'tools/tmp/sp_place.mjs --selftest', probes: [pr(['tools/tmp/sp_place.mjs', '--selftest'], /^\s*PASS\s+(\d+) passed, \d+ failed\s*$/m)] },
  { key: 'tools/tmp/sp_gate.mjs --selftest',  probes: [pr(['tools/tmp/sp_gate.mjs', '--selftest'], /^\s*PASS\s+(\d+) passed, \d+ failed\s*$/m)] },
  { key: 'tools/tmp/ap_reach.mjs --selftest', probes: [pr(['tools/tmp/ap_reach.mjs', '--selftest'], /^\s*PASS\s+(\d+) passed, \d+ failed\s*$/m)] },
  { key: 'tools/tmp/s49_mutants.mjs', probes: [pr(['tools/tmp/s49_mutants.mjs'], S)] },
  // Sudden death (`DECISIONS §2`). Offline, ~2 s. Its own known-bad battery is six patched
  // sims, each required to break exactly the claim it names.
  { key: 'tools/tmp/sd_lab.mjs --selftest', probes: [pr(['tools/tmp/sd_lab.mjs', '--selftest'], S)] },
  { key: 'tools/tmp/da_census.mjs --selftest', probes: [pr(['tools/tmp/da_census.mjs', '--selftest'], S)] },
  // ⚠️ NOT `S`. This tool appends its own wall-clock to the count line (`27 passed, 0 failed
  //    wall 58.1s`), and `S` anchors on `$`. Matched with `\b` instead so a trailing note cannot
  //    make a healthy gate read as UNPARSEABLE. Third pattern I have mis-written this session by
  //    not looking at the tool's RAW BYTES first.
  { key: 'tools/tmp/nf_ffa.mjs --selftest', probes: [pr(['tools/tmp/nf_ffa.mjs', '--selftest'], /^\s*(\d+) passed, \d+ failed\b/m)] },
  { key: 'tools/tmp/nc_measure.mjs --selftest', probes: [pr(['tools/tmp/nc_measure.mjs', '--selftest'], S)] },
  /**
   * ── THE FOUR NETCODE GATES (`DECISIONS §52`/`§57`) ──────────────────────────────────
   *
   * All four are pure Node — no `playwright` import, no browser reference, no `git`
   * shell-out — and were TIMED before registering, which is the `hw_ord` lesson: 0.26 s
   * (`nw_wire`), 2.58 s (`nw_stack`), 10.26 s (`nw_delta`), 0.07 s (`nw_profile`).
   *
   * ⚠️ **THE PATTERN IS UNANCHORED AT THE START, DELIBERATELY.** Their summary line begins
   * with an emoji — `✅  nw_wire: 67/67 checks passed` — so `^` cannot be used. Read off the
   * RAW BYTES of a real run rather than guessed (the third mis-written pattern in this file
   * came from not doing that), and checked for ambiguity: `<tool>: n/n checks passed`
   * matches **exactly once** in each tool's whole output.
   *
   * ⚠️ **NUMERATOR, NOT DENOMINATOR** — `hc_occluders`'s rule. `SLASH_ASSERT` would take the
   * denominator, and then a `12/67` run would satisfy a documented 67: a failing gate
   * reported as an intact one.
   *
   * ⚠️ **`--selftest` IS INERT IN ALL FOUR** — none of them reads it (`nw_wire`/`nw_delta`
   * take `--sizes`, `nw_stack` takes `--latency`, `nw_profile` reads no argv at all), so a
   * bare run and this key measure the same battery. Recorded because `hw_ord`/`hw_burner`
   * were registered OFFLINE on exactly this assumption when it was FALSE for them and the
   * flag was hiding a GPU probe. Here it hides nothing; verified by running both forms.
   */
  { key: 'tools/tmp/nw_wire.mjs --selftest',    probes: [pr(['tools/tmp/nw_wire.mjs', '--selftest'], /nw_wire: (\d+)\/\d+ checks passed/m)] },
  { key: 'tools/tmp/nw_stack.mjs --selftest',   probes: [pr(['tools/tmp/nw_stack.mjs', '--selftest'], /nw_stack: (\d+)\/\d+ checks passed/m)] },
  { key: 'tools/tmp/nw_delta.mjs --selftest',   probes: [pr(['tools/tmp/nw_delta.mjs', '--selftest'], /nw_delta: (\d+)\/\d+ checks passed/m)] },
  { key: 'tools/tmp/nw_profile.mjs --selftest', probes: [pr(['tools/tmp/nw_profile.mjs', '--selftest'], /nw_profile: (\d+)\/\d+ checks passed/m)] },
  { key: 'tools/tmp/r2_probe.mjs --selftest', probes: [pr(['tools/tmp/r2_probe.mjs', '--selftest'], S)] },
  // Three probes because the doc cell states three numbers — known / new / stale. ARITY exists to
  // make that correspondence mandatory: a cell cannot gain a number that nothing measures.
  { key: 'tools/tmp/r2_probe.mjs --mode anchor', probes: [
    pr(['tools/tmp/r2_probe.mjs', '--mode', 'anchor'], /^(\d+) known bounding-box fallback/m),
    pr(['tools/tmp/r2_probe.mjs', '--mode', 'anchor'], /known bounding-box fallback\(s\), (\d+) new/m),
    pr(['tools/tmp/r2_probe.mjs', '--mode', 'anchor'], /, (\d+) stale\./m),
  ] },
  { key: 'tools/tmp/ey_pacman.mjs --selftest', probes: [pr(['tools/tmp/ey_pacman.mjs', '--selftest'], /^ey_pacman selftest: (\d+)\/\d+\s*$/m)] },
  { key: 'tools/tmp/cf_taper.mjs --selftest', probes: [pr(['tools/tmp/cf_taper.mjs', '--selftest'], /^cf_taper --selftest: (\d+) pass, \d+ fail/m)] },
  // ⚠️ `tools/tmp/hm_audit.mjs --selftest` was registered here at 12 and is GONE — the file
  //    was RETIRED 2026-08-11, the `perf_tier.mjs` precedent four rows above the SKIP list's
  //    end. Two independent reasons, and neither is "it went red":
  //      (a) ITS PURPOSE IS DISCHARGED. It existed to PRICE the projectile-retirement
  //          options; `DECISIONS §50b`/`af35362` shipped the target-frame option, and its
  //          closed form `reach = range − S·flight + hitRadius` is a property of the OLD
  //          rule, so a table computed from that arithmetic now prints the old answer with
  //          total confidence on a tree where it is false.
  //      (b) ITS STAGING WAS STRUCTURALLY FRAGILE. `--rules` substituted on LITERAL SOURCE
  //          STRINGS (`p.traveled += Math.hypot(moveX, moveY);` and the `p.traveled >=
  //          w.range` test), both rewritten by that pass, so it threw `matched 0 times,
  //          refusing to guess`. It refused loudly rather than measuring an unpatched sim,
  //          which is the correct behaviour and also the end of the road for that method.
  //    `tools/tmp/tf_reach.mjs` SUBSUMES the measuring half and is registered below: it
  //    MEASURES the sim instead of computing a law, and prints the closed form beside it as
  //    a control. Nothing imported `hm_audit` — every other mention of it is prose.
  //    §F1 asserts every OFFLINE probe points at a file that EXISTS, so the deletion and
  //    its de-registration had to land together or not at all.
  //
  // ── THE RANGED PASS'S OWN INSTRUMENTS (`DECISIONS §50b`/`§63`) ────────────────────────
  // Both offline and fast — timed before registering (the `hw_ord` lesson): 0.8 s and 0.2 s.
  // Neither imports playwright; both guard their CLI on `import.meta.main`.
  // ⚠️ NUMERATOR, not `SLASH_ASSERT`'s denominator — `hc_occluders`'s rule.
  { key: 'tools/tmp/tf_reach.mjs --selftest', probes: [pr(['tools/tmp/tf_reach.mjs', '--selftest'], /^\s*(\d+)\/\d+ assertions passed\s*$/m)] },
  { key: 'tools/tmp/tf_bitid.mjs --selftest', probes: [pr(['tools/tmp/tf_bitid.mjs', '--selftest'], /^\s*(\d+)\/\d+ assertions passed\s*$/m)] },
  { key: 'tools/tmp/dup_census.mjs --selftest', probes: [pr(['tools/tmp/dup_census.mjs', '--selftest'], /^\s*(\d+)\/\d+ selftest arms passed\s*$/m)] },
  // ── THE THREE GUARDS THAT WERE INVISIBLE TO THIS TOOL UNTIL 2026-08-12 ────────────────
  // `al_guard`, `n2_geom` and `sx_fog` were all committed and appeared ZERO times in
  // docs/TOOLS.md. This tool reads the gate table and never enumerates `tools/tmp/`, so a
  // tool that was never REGISTERED is invisible to the one check that would notice it
  // rotting — and `al_guard` is specifically the guard against the class that hid the ×4
  // map change for a session. An unregistered guard is a guard that dies quietly.
  //
  // ⚠️ OLD, KEPT WITH THE REASON — this is the reversal, not a deletion:
  //    *"`al_guard`'s BARE run is the live gate and is NOT registered: it exits 1 at HEAD on two
  //    hits in `docs/LESSONS.md:1028`, where the lesson about the stale-1×-literal class quotes
  //    the historical defect verbatim. Registering it would make this tool permanently red for a
  //    reason that is not a stale count."*
  //    That was the right call while it was true, and the underlying cause has now been FIXED
  //    rather than waived: `al_lib.commentMask` tested `text.slice(0, 0)` — the empty string — so
  //    the markdown half of its own contract never ran and no `.md` line was ever masked. Markdown
  //    is prose now, `al_guard` §M adjudicates it against `ACK`, and the bare run is **22 passed,
  //    0 failed**. It is registered here because an UNREGISTERED guard is a guard that dies
  //    quietly — the note three lines up says exactly that about `al_guard` itself.
  //    ⚠️ Consequence, stated rather than discovered: a NEW stale 1× literal anywhere in `src`,
  //    `tools` or `docs` now turns THIS tool red. That is the intent. `gatecount` reports it as
  //    `GATE-FAIL`, and the fix is in the flagged file or in `al_guard`'s `ACK`, never here.
  // ⚠️ NOT `S`: the summary is prefixed (`✅ PASS  al_guard: 22 passed, 0 failed`), so `^` cannot
  //    be used, and the pattern must NOT be able to read the `--selftest` line — checked: the
  //    literal `al_guard: ` never appears in a `--selftest` run (it prints `al_guard --selftest: `)
  //    and matches exactly once in a bare run.
  { key: 'tools/tmp/al_guard.mjs', probes: [pr(['tools/tmp/al_guard.mjs'], /al_guard: (\d+) passed, \d+ failed/)] },
  //    `--selftest` is what proves the arms still FAIL on the bugs they guard: 9 known-bads
  //    re-injected verbatim, each paired with the fixed form of the same line, plus §KB-M, which
  //    is the arm that stops the markdown fix above from being a blindfold.
  // ⚠️ NOT `S`: al_guard prefixes its summary (`✅ PASS  al_guard --selftest: N passed, …`),
  //    so `^` cannot be used. Read off a real run's raw bytes and checked for ambiguity —
  //    the pattern matches EXACTLY ONCE in the whole output.
  { key: 'tools/tmp/al_guard.mjs --selftest', probes: [pr(['tools/tmp/al_guard.mjs', '--selftest'], /al_guard --selftest: (\d+) passed, \d+ failed/)] },
  // Two rows, two different questions, both offline (0.8 s / 1.1 s; no playwright import, no
  // browser, no snapshot — `rg_lib` shells `esbuild` only, and was TIMED before registering,
  // which is the `hw_ord` lesson). `--knownbad sort` is the live cast battery `nk_neckgate`
  // already cites; `--selftest` is the fault battery that proves it can go red.
  { key: 'tools/tmp/n2_geom.mjs --knownbad sort', probes: [pr(['tools/tmp/n2_geom.mjs', '--knownbad', 'sort'], S)] },
  { key: 'tools/tmp/n2_geom.mjs --selftest',      probes: [pr(['tools/tmp/n2_geom.mjs', '--selftest'], S)] },
  { key: 'tools/tmp/rg_neckz.mjs --selftest', probes: [pr(['tools/tmp/rg_neckz.mjs', '--selftest'], /^\s*(\d+) pass, \d+ fail\s*$/m)] },
  { key: 'tools/tmp/rg_taper.mjs --selftest', probes: [pr(['tools/tmp/rg_taper.mjs', '--selftest'], /^\s*(\d+) pass, \d+ fail\s*$/m)] },
  { key: 'tools/tmp/rg_gap.mjs --selftest',   probes: [pr(['tools/tmp/rg_gap.mjs', '--selftest'], /^\s*(\d+) pass, \d+ fail\s*$/m)] },
  { key: 'tools/tmp/rg_solid.mjs --selftest', probes: [pr(['tools/tmp/rg_solid.mjs', '--selftest'], /^\s*(\d+) pass, \d+ fail\s*$/m)] },
  { key: 'tools/tmp/ir_outclaim.mjs --selftest',      probes: [pr(['tools/tmp/ir_outclaim.mjs', '--selftest'], S)] },
  { key: 'tools/tmp/ir_ladder_anchors.mjs --selftest', probes: [pr(['tools/tmp/ir_ladder_anchors.mjs', '--selftest'], S)] },
  { key: 'tools/tmp/ir_pathsweep.mjs --selftest',     probes: [pr(['tools/tmp/ir_pathsweep.mjs', '--selftest'], S)] },
  { key: 'tools/tmp/ax_layout.mjs --selftest', probes: [pr(['tools/tmp/ax_layout.mjs', '--selftest'], SLASH_ASSERT)] },
  // The ×4 arena that SHIPPED, as opposed to `ax_layout`'s candidate scalings. Offline and
  // ~1 s: no browser reference in the file, timed before registering (the `hw_ord` lesson).
  { key: 'tools/tmp/x4_layout.mjs --selftest', probes: [pr(['tools/tmp/x4_layout.mjs', '--selftest'], /^\s*PASS\s+(\d+) passed, \d+ failed\s*$/m)] },
  // NUMERATOR, not `SLASH_ASSERT`'s denominator — same reason as `hc_occluders` below. This
  // gate's whole subject is a set of numbers that are close to ZERO ("search buys nothing"),
  // and a partially-failing selftest reported as intact is the one failure mode that would
  // let a wrong zero through.
  { key: 'tools/tmp/as_cost.mjs --selftest', probes: [pr(['tools/tmp/as_cost.mjs', '--selftest'], /^\s*(\d+)\/\d+ assertions passed\s*$/m)] },
  { key: 'tools/tmp/cb_rig.mjs --selftest',    probes: [pr(['tools/tmp/cb_rig.mjs', '--selftest'], /^cb_rig --selftest: (\d+)\/\d+ passed/m)] },
  { key: 'tools/tmp/dc_guard.mjs --selftest',  probes: [pr(['tools/tmp/dc_guard.mjs', '--selftest'], /^dc_guard selftest: (\d+)\/\d+ pass/m)] },
  { key: 'tools/tmp/ic_collect.mjs --selftest', probes: [pr(['tools/tmp/ic_collect.mjs', '--selftest'], /^ic_collect selftest (\d+) pass \/ \d+ fail/m)] },
  { key: 'tools/tmp/icon_score.mjs --selftest', probes: [pr(['tools/tmp/icon_score.mjs', '--selftest'], /^selftest (\d+) pass \/ \d+ fail/m)] },
  { key: 'tools/tmp/ic_spec.mjs --selftest',   probes: [pr(['tools/tmp/ic_spec.mjs', '--selftest'], /^ic_spec selftest (\d+) pass \/ \d+ fail/m)] },
  { key: 'tools/tmp/ic_pair.mjs --selftest',   probes: [pr(['tools/tmp/ic_pair.mjs', '--selftest'], /^ic_pair selftest (\d+) pass \/ \d+ fail/m)] },
  // ⚠️ Its whole output carries exactly ONE `n/n` line (checked: 1 match), so the bare
  //    ratio pattern is unambiguous here and would be AMBIGUOUS in most other tools.
  { key: 'tools/tmp/sc2_icons.mjs --selftest', probes: [pr(['tools/tmp/sc2_icons.mjs', '--selftest'], /^\s*(\d+)\/\d+\s*$/m)] },
  { key: 'tools/tmp/ac_engage.mjs --selftest', probes: [pr(['tools/tmp/ac_engage.mjs', '--selftest'], S)] },
  { key: 'tools/tmp/ac_homing.mjs --selftest', probes: [pr(['tools/tmp/ac_homing.mjs', '--selftest'], S)] },
  { key: 'tools/tmp/bl_vitals_gate.mjs --selftest', probes: [pr(['tools/tmp/bl_vitals_gate.mjs', '--selftest'], SLASH_ASSERT)] },
  // ⚠️ `tools/tmp/hc_occluders.mjs --selftest` was registered OFFLINE here and has MOVED TO
  //    SKIP — **it launches Chromium** (`const { chromium } = await import('playwright')`),
  //    so it was booting a GPU probe on every `gatecount` run. Exactly the `hw_ord` /
  //    `hw_burner` defect, which this file already records two ways, and it presented the
  //    same way: `GATE-FAIL … exited 1` inside a full battery run, against **exit 0 on three
  //    consecutive standalone runs of the same worktree**. A count that only fails under
  //    contention reads as doc drift and gets "fixed" in the doc.
  //    The numerator note below is kept with it, because it is still the right pattern for
  //    whoever runs it: `SLASH_ASSERT` takes the denominator, which would let `hc_occluders
  //    3/4` satisfy a documented 4 — a failing guard reported as an intact one, in the guard
  //    for the silent-occluder class.
  { key: 'tools/tmp/conceal_lab.mjs --selftest', probes: [pr(['tools/tmp/conceal_lab.mjs', '--selftest'], S)] },
  { key: 'tools/tmp/burger_lab.mjs --selftest',  probes: [pr(['tools/tmp/burger_lab.mjs', '--selftest'], S)] },
  { key: 'tools/tmp/driver_guard.mjs',           probes: [pr(['tools/tmp/driver_guard.mjs'], /^driver_guard: (\d+) passed, \d+ failed/m)] },
  { key: 'tools/tmp/cs_charcontact.mjs --selftest', probes: [pr(['tools/tmp/cs_charcontact.mjs', '--selftest'], /cs_charcontact --selftest\s+(\d+)\/\d+/m)] },
  { key: 'tools/tmp/ds_inventory.mjs --selftest', probes: [pr(['tools/tmp/ds_inventory.mjs', '--selftest'], /(\d+) passed, \d+ failed/m)] },
  { key: 'tools/tmp/ds_neutral.mjs --selftest',   probes: [pr(['tools/tmp/ds_neutral.mjs', '--selftest'], /(\d+) passed, \d+ failed/m)] },
  { key: 'tools/tmp/clonetoon_test.mjs',         probes: [pr(['tools/tmp/clonetoon_test.mjs'], /^PASS\s+clonetoon_test: (\d+) passed, \d+ failed/m)] },
  { key: 'tools/tmp/kneeprice.mjs --selftest',   probes: [pr(['tools/tmp/kneeprice.mjs', '--selftest'], /^PASS\s+kneeprice selftest: (\d+) passed, \d+ failed/m)] },
  { key: 'tools/tmp/limbmatch.mjs --selftest',   probes: [pr(['tools/tmp/limbmatch.mjs', '--selftest'], /^selftest: (\d+) pass, \d+ fail\s*$/m)] },
  { key: 'tools/tmp/sepscan.mjs --selftest',     probes: [pr(['tools/tmp/sepscan.mjs', '--selftest'], /^selftest: (\d+) pass, \d+ fail\s*$/m)] },
  { key: 'tools/tmp/aoband.mjs --selftest',      probes: [pr(['tools/tmp/aoband.mjs', '--selftest'], /^aoband --selftest\s+\d+\/(\d+)\s*$/m)] },
  { key: 'tools/tmp/review_gate_validate.mjs',   probes: [pr(['tools/tmp/review_gate_validate.mjs'], /^\d+\/(\d+) gate checks passed\s*$/m)] },
  { key: 'tools/tmp/capture_audit.mjs --selftest', probes: [pr(['tools/tmp/capture_audit.mjs', '--selftest'], /^\d+\/(\d+) classifier checks passed\s*$/m)] },
  { key: 'tools/tmp/capture_audit.mjs',          probes: [pr(['tools/tmp/capture_audit.mjs'], /^(\d+)\/(\d+) owned files meet their obligation\s+·\s+(\d+) assessed css-immune/m)] },
  { key: 'tools/tmp/snapsweep.mjs --selftest',   probes: [pr(['tools/tmp/snapsweep.mjs', '--selftest'], /^\d+\/(\d+) age-parser checks passed\s*$/m)] },
  { key: 'tools/shoot.mjs --selftest',           probes: [pr(['tools/shoot.mjs', '--selftest'], /^\d+\/(\d+) selftest checks passed\s*$/m)] },
  // Two runs, two documented numbers: `--selftest` proves the four assertion KINDS against
  // instruments broken that way; the bare run is the live battery. Doc cell: "32 + 16 live".
  { key: 'tools/tmp/sentinel.mjs', probes: [
      pr(['tools/tmp/sentinel.mjs', '--selftest'], /^\d+\/(\d+) sentinel checks passed\s*$/m),
      pr(['tools/tmp/sentinel.mjs'], /^\d+\/(\d+) sentinels passed\s*$/m),
  ] },
  // Self-application. `--selftest` spawns nothing, so there is no recursion.
  { key: 'tools/tmp/gatecount.mjs --selftest',   probes: [pr(['tools/tmp/gatecount.mjs', '--selftest'], /^gatecount --selftest: (\d+) passed, \d+ failed\s*$/m)] },
];

/**
 * SKIP — documented gates this tool does not run, each with a REASON.
 * A skip with an empty reason is refused (§D7): "skipped" without a why is how a gate stops
 * being checked and nobody notices.
 */
const SKIP = [
  ['npx tsc --noEmit',                     'non-numeric', 'verdict is "clean" — no count to compare'],
  ['tools/verify-head.mjs',                'non-numeric', 'verdict is OK/FAIL; also builds the whole committed tree'],
  ['tools/aspect.mjs',                     'browser',     'needs a snapshot URL and a GL context'],
  // The weapon-promise pair. `--selftest` is OFFLINE above (24 arms); these two are not.
  ['tools/tmp/wm_gate.mjs --ratchet',      'non-numeric', "verdict is 'fault set unchanged' vs NEW/FIXED lines — the COUNT is in wm_ledger.json, whose sha field is the thing that must match, not an integer here"],
  ['tools/tmp/wi_guard.mjs',               'browser',     'renders 27 bespoke impacts at two pitches; PREVIEW_BASE required, ~3.5 min'],
  ['tools/tmp/menu_accept.mjs',            'browser',     '5 viewports through a real page'],
  ['tools/tmp/menu_accept_portrait.mjs',   'browser',     'portrait viewports through a real page'],
  ['tools/tmp/input_accept.mjs',           'browser',     'real CDP key/mouse events'],
  ['tools/tmp/shop_accept.mjs',            'browser',     'reads displayed prices off the DOM'],
  ['tools/tmp/name_accept.mjs',            'browser',     'types into the real name field'],
  ['tools/tmp/chip_probe.mjs',             'browser',     '6 viewports × 2 states'],
  // ⚠️ Keyed on the FULL command as the table writes it, args included — the SKIP registry matches
  // the row string, not the script path. Keying it on `tools/tmp/ic_plate.mjs` alone produced
  // `UNREG ... --selftest --url <snapshot>`, which reads like a missing registration rather than a
  // near-miss on a key. Compare `tools/audio-probe.mjs --mode all` below.
  ['tools/tmp/ic_plate.mjs --selftest --url <snapshot>', 'browser', 'renders the delivered-size fixture against a snapshot; its known-bad input is the harness AS IT HISTORICALLY SHIPPED'],
  ['tools/perf.mjs --mode navselftest', 'browser', 'runs a control arm AND a real page.reload() arm in one invocation — the proof that the reload guard fires'],
  // ⚠️ These two IGNORE `--selftest` entirely — neither file contains the string — and run the real
  // probe against PREVIEW_BASE. Registered OFFLINE by mistake, which made gatecount boot a GPU
  // probe on every run; they then hung under six-agent contention where they had passed at 18-25s.
  // Their 5/5 is about the INSTRUMENT (self-pair 0 px, drift bounded, ablation positive-or-BLIND),
  // so the count is stable regardless of what the sweep finds — which is exactly why it looked
  // like a well-behaved offline count.
  ['tools/tmp/hw_ord.mjs --selftest',    'browser', 'renderOrder choice for a transparent ground-stack material; ignores --selftest, runs the real probe'],
  ['tools/tmp/hw_burner.mjs --selftest', 'browser', 'the burner ablation with its positive control; ignores --selftest, runs the real probe'],
  ['tools/tmp/hc_occluders.mjs --selftest', 'browser', 'the silent-occluder sweep — it imports playwright and launches Chromium; registered OFFLINE by mistake until 2026-08-11, where it read exit 0 standalone and GATE-FAIL inside a contended battery run'],
  ['tools/tmp/bw_brow.mjs --selftest', 'browser', 'column-wise brow-to-eye gap and eye-region ink share, ablated through the shipped render path'],
  ['tools/tmp/si_gap.mjs --selftest',  'browser', 'delivered geometry of a shadowed CSS declaration on the live element'],
  ['tools/tmp/si_fit.mjs --selftest',  'browser', 'what a larger icon costs its host — line box, overflow, tap target'],
  ['tools/tmp/si_pair.mjs --selftest', 'browser', 'paired plate that can vary SIZE per arm; ic_pair structurally cannot'],
  ['tools/tmp/ft_faces.mjs --selftest', 'browser', 'text-overflow census + font rulers across 5 screens x 4 viewports'],
  ['tools/tmp/ft_glyphs.mjs --selftest --url <snapshot>', 'browser', 'which codepoints a loaded face actually DRAWS — the question a network waterfall cannot ask'],
  ['tools/tmp/ft_basepath.mjs --dist <dist> --base /food-arena/', 'browser', '@font-face url() at a non-root base; ab_basepath structurally cannot see it'],
  ['tools/tmp/p2_bgcross.mjs --selftest', 'browser', 'projectile legibility across the surfaces it actually crosses; 8 controls incl. an exact null'],
  ['tools/tmp/pj_probe.mjs --selftest', 'browser', 'projectile legibility by same-frame ablation; known-bad is a sculpt painted the background\'s own measured colour'],
  // ⚠️ BROWSER, and it could not be anything else: its acceptance test is "N renders of ONE frozen
  // frame are bit-identical", which needs a real `Stage.render()` and a real GL context. Its
  // known-bad arm installs the PRE-FIX `CameraRig.update` body over the live one and requires the
  // same comparison to drift — so this is one of the few gates whose failure mode is proved against
  // the code that actually shipped rather than against a synthetic mutant.
  ['tools/tmp/sk_shake.mjs --selftest', 'browser', 'frozen-frame bit-identity with camera shake ACTIVE, plus the dt>0 positive control; needs a real Stage.render() and a GL context'],
  ['tools/tmp/h49_ab.mjs --ref <sha>', 'browser', 'the §49f 2-fighter identity battery; overlays ONLY hud.ts so a peer mid-edit in src/game cannot leak in'],
  ['tools/tmp/h49_chips.mjs', 'browser', 'the chip rail above two seats, in BOTH DOM states — the touch state is the one that caught a real overlap'],
  ['tools/tmp/lu_sudden.mjs', 'browser', 'the sudden-death HUD: copy, the hidden chevron and the SEAT-SCALED ring floor, at N=2 and N=6; needs a live sim and reaches the state through fogRadius=0'],
  ['tools/tmp/rc_card.mjs --url <snapshot>', 'browser', 'the six-player result card: placement, loser ORDER and the payout chips, rendered through the real hud.ts against a recorded oracle; needs a live match and a GL context'],
  ['tools/tmp/lu_land.mjs', 'browser', 'the landscape-phone control layout: corner, centre column, hint/tray clearance, touch floor, safe-area insets, and a REAL CDP touch to prove the resting hints are transient'],
  ['tools/tmp/np_ab.mjs',        'browser', 'the N=2 presentation identity battery: 4 served arms, 9 compared fields, per-file tree control, roster-swap known-bad'],
  ['tools/tmp/np_nfighter.mjs', 'browser', 'N=3..6 presentation self-consistency + slot-swap known-bad'],
  ['tools/tmp/sd_feelevent.mjs', 'browser', 'the sudden-death feel event through the shipped event stream'],
  // ⚠️ Keyed on the FULL row string, args included — the SKIP registry matches the row, not the
  // script path (see the `ic_plate` note above; keying on the path alone reads as UNREG).
  // BROWSER by behaviour, not by name: `import { chromium } from 'playwright'`, and its verdict
  // is mean luma off a real `renderer.domElement.toDataURL`. It has no `--selftest`; the two
  // assertions are a CONTRACT (one absolute positive control, one ratio row) rather than a
  // sample, so the count is stable — verified 2 passed / 0 failed on 2026-08-12 against a
  // snapshot of a detached worktree of 072f245.
  ['tools/tmp/sx_fog.mjs --url <snapshot> --src-root <tree>', 'browser', 'does the sudden-death canopy actually reach the ×4 arena\'s corners — measured in PIXELS, where kx_fogcover measures the geometry; launches Chromium and reads the canvas back'],
  ['tools/tmp/x4_shot.mjs', 'browser', 'photographs a real 3/4/6-fighter opening on the arena\'s own ×4 spawns; its verdict is a set of PNGs plus a phase/HP census, not a number'],
  // ⚠️ SLOWEST browser gate registered here — over ten minutes on a contended box. Its
  //    selftest is AGGREGATE and needs the WHOLE 23-weapon sweep: one weapon exercises the
  //    "picture changed" side and has nothing to assert on the null side, and vice versa,
  //    so `--chars`/`--weapon` make it INVALID rather than merely narrower.
  ['tools/tmp/hl_sweep.mjs --selftest', 'browser', 'weapon-halo sweep + 8 controls; its aggregate selftest needs one halo on EACH side of --split (0.53 since 2026-08-11 — 0.75 selected 0 of 33 after 50c5272). ⚠️ STILL INVALID on SWAP, which fails on every weapon measured'],
  ['tools/tmp/sc2_manifest.mjs', 'browser', 'Add-to-Home-Screen manifest at 3 bases + 5 known-bad/control rows. Its NO-MANIFEST control is an ABLATION of the shipped build, not a pure-HEAD tree — it was the latter until 2026-08-11 and went 3-of-54 RED the moment 92e794a landed the manifest'],
  ['tools/tmp/sc2_screen.mjs', 'browser', 'what a standalone home-screen launch changes about the frame — the guaranteed radius is unchanged, so aspect.mjs structurally cannot see it'],
  ['tools/perf.mjs --mode tierselftest', 'browser', 'the known-bad input for `--device mobile`: arm A reproduces the pre-4be0733 bug (`high`), B is the fix (`low`), C a tablet (`medium`), D the desktop control'],
  ['tools/tmp/ab_basepath.mjs --selftest', 'browser', 'four vite builds plus a real page per cell; verdict is a PASS/FAIL matrix, not a count'],
  // ⚠️ `tools/tmp/perf_tier.mjs --mode navselftest` was registered here and is GONE — the
  //    file was deleted 2026-08-11 (a verbatim copy of `perf.mjs` that had diverged twice;
  //    `perf.mjs --query <q>` subsumes it). Its reason was 'the same reload-guard proof for
  //    the CLONE of perf.mjs'. §F2 asserts every SKIP entry points at a file that EXISTS, so
  //    leaving this row would have failed gatecount's own selftest — which is the check that
  //    makes a deletion and its registration land together or not at all.
  // ⚠️ SKIP for a SECOND reason on top of "browser", and it is the interesting one: its checked
  // count is NOT STABLE UNDER GPU CONTENTION. Observed `0 of 24` with "no verdict: 0" on one run
  // while five agents were rendering, against `0 of 57` with "no verdict: 3" on three consecutive
  // quiet runs. 24 + 0 != 60, so that run silently examined 36 fewer icons and still printed a
  // clean verdict. A count that shrinks under load would be documented as drift by `gatecount`
  // and "fixed" by editing the doc — so it gets no documented number at all until the flake is
  // understood. Same reasoning as `audio-probe --mode live` two rows up.
  ['tools/tmp/ic_contrast.mjs',            'browser',     'ablation: is the icon actually painted. ⚠️ checked count varies under GPU contention (24 vs 57 observed) — deliberately NOT given a documented number'],
  ['tools/audio-probe.mjs --mode all',     'browser',     'OfflineAudioContext lives in a page; and --mode live is PROVEN flake (29/29, 27/29, 26/29 on untouched HEAD)'],
  ['tools/tmp/quality_api.mjs',            'browser',     'render tiers, needs a GL context'],
  ['tools/tmp/dpr_probe.mjs',              'browser',     'DPR cap, needs a GL context'],
  ['tools/perf.mjs --mode leak',           'browser',     'counts live GL contexts across round trips'],
  ['tools/tmp/settle_validate.mjs',        'browser',     'the shared PAINT condition, measured on a snapshot'],
  ['tools/tmp/rarity_aa.mjs',              'browser',     'WCAG from rendered pixels'],
  ['tools/tmp/rebind_accept.mjs',          'browser',     'real key events against sim state'],
  ['tools/tmp/touchfeel.mjs',              'browser',     'synthetic touch streams'],
  ['tools/tmp/nav_history_probe.mjs',      'browser',     'router + history through a real page'],
  ['tools/tmp/glloss_probe.mjs',           'browser',     'forces a real WEBGL_lose_context'],
  ['tools/tmp/trail_probe.mjs',            'browser',     'same-frame ablation in the shipped render'],
  ['tools/tmp/floorprobe.mjs',             'browser',     'the floor measured in the shipped render'],
  ['tools/tmp/chars_metrics.mjs',          'browser',     'ALL CLEAN battery, WCAG from pixels'],
  ['tools/tmp/screen_metrics.mjs',         'browser',     'ALL CLEAN battery, WCAG from pixels'],
  ['tools/tmp/home_metrics.mjs',           'browser',     'WCAG from pixels'],
  ['tools/tmp/limbcheck.mjs',              'browser',     'per-joint delivered pixels; and its expect cell is prose'],
  ['tools/tmp/cw_conceal_view.mjs',        'browser',     'concealment on rendered pixels: blip, HP pill, 3D model'],
  ['tools/tmp/cw_verify_knownbad.mjs',     'browser',     'ablates arena_probe --verify against a derived pre-fix ref'],
  ['tools/tmp/tt_flatrim.mjs',             'browser',     'compiles real GL programs and reads delivered pixels back off the drawing buffer'],
];

/* ══════════════════════════════════════════════════════════════════════════
   THE CHECK
   ══════════════════════════════════════════════════════════════════════════ */

/** Injectable so --selftest can drive the whole pipeline on fixture output without running gates. */
const realExec = (argv) => {
  const r = spawnSync('node', argv, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, stdout: (r.stdout ?? '') + (r.stderr ?? '') };
};

export function check({ toolsMd, claudeMd, offline = OFFLINE, skip = SKIP, exec = realExec, run = true }) {
  const faults = [];
  const rows = [];
  const { rows: docRows, headerLine } = parseGateTable(toolsMd);

  // ── ROW: the same command on two table rows ─────────────────────────────
  const seen = new Map();
  for (const r of docRows) {
    if (seen.has(r.key)) {
      faults.push({
        kind: 'ROW', key: r.key,
        msg: `two table rows for one gate (lines ${seen.get(r.key).line} and ${r.line}) — either could be "confirmed" by reading the other`,
      });
    } else seen.set(r.key, r);
  }

  // ── UNREG / SKIP-REASON ─────────────────────────────────────────────────
  const offByKey = new Map(offline.map((o) => [normCmd(o.key), o]));
  const skipByKey = new Map(skip.map((s) => [normCmd(s[0]), { reason: s[1], why: s[2] }]));
  for (const [key, meta] of skipByKey) {
    if (!meta.reason || !meta.why) faults.push({ kind: 'SKIP-REASON', key, msg: 'skipped with no reason — an invisible gap is exactly the bug this tool exists for' });
  }
  for (const r of docRows) {
    if (!offByKey.has(r.key) && !skipByKey.has(r.key)) {
      faults.push({ kind: 'UNREG', key: r.key, msg: `table row at line ${r.line} is in neither the OFFLINE nor the SKIP registry — a new gate cannot be silently unchecked` });
    }
  }
  for (const key of offByKey.keys()) {
    if (!seen.has(key)) faults.push({ kind: 'UNDOC', key, msg: 'registered OFFLINE but has no row in the gate table' });
  }

  // ── DUP: any count-bearing copy outside the canonical row ───────────────
  const exempt = new Set(docRows.map((r) => `${TOOLS_MD}:${r.line}`));
  const allKeys = [...new Set([...docRows.map((r) => r.key), ...offByKey.keys(), ...skipByKey.keys()])];
  const textOf = { [TOOLS_MD]: toolsMd, [CLAUDE_MD]: claudeMd };
  const dups = findDuplicateCopies(
    SCANNED_DOCS.map((name) => ({ name, text: textOf[name] })),
    allKeys, exempt,
  );
  for (const d of dups) {
    const row = seen.get(d.key);
    const docInts = row ? row.ints.join('/') : '(no row)';
    faults.push({
      kind: 'DUP', key: d.key,
      msg: `second copy at ${d.at} — "${d.evidence}" vs the table's ${docInts}. Agreement today is not a defence: both same-file disagreements on record began life agreeing.`,
    });
  }

  // ── ARITY + MISMATCH, by running the offline gates ──────────────────────
  for (const r of docRows) {
    const off = offByKey.get(r.key);
    if (!off) {
      const sk = skipByKey.get(r.key);
      rows.push({ key: r.key, doc: r.ints, actual: null, verdict: 'SKIP', note: sk ? `${sk.reason}: ${sk.why}` : 'unregistered', ms: 0 });
      continue;
    }
    const nGroups = off.probes.reduce((n, p) => n + countGroups(p.re), 0);
    if (nGroups !== r.ints.length) {
      faults.push({
        kind: 'ARITY', key: r.key,
        msg: `the table row has ${r.ints.length} integer(s) [${r.ints.join(', ')}] but the registry measures ${nGroups}. Either the doc gained a number nothing checks, or a probe stopped covering one.`,
      });
      rows.push({ key: r.key, doc: r.ints, actual: null, verdict: 'ARITY', note: `doc ${r.ints.length} vs probes ${nGroups}`, ms: 0 });
      continue;
    }
    if (!run) { rows.push({ key: r.key, doc: r.ints, actual: null, verdict: 'not-run', note: '--docs-only', ms: 0 }); continue; }

    const t0 = Date.now();
    const measured = [];
    let bad = null;
    for (const p of off.probes) {
      const res = exec(p.argv);
      if (res.status !== 0) { bad = { kind: 'GATE-FAIL', note: `\`node ${p.argv.join(' ')}\` exited ${res.status}` }; break; }
      const parsed = parseGateOutput(res.stdout, p.re);
      if (!parsed.ok) { bad = { kind: parsed.why, note: `\`node ${p.argv.join(' ')}\` output does not match ${p.re}` }; break; }
      measured.push(...parsed.values);
    }
    const ms = Date.now() - t0;
    if (bad) {
      faults.push({ kind: bad.kind, key: r.key, msg: bad.note });
      rows.push({ key: r.key, doc: r.ints, actual: null, verdict: bad.kind, note: bad.note, ms });
      continue;
    }
    const same = measured.length === r.ints.length && measured.every((v, i) => v === r.ints[i]);
    if (!same) {
      faults.push({ kind: 'MISMATCH', key: r.key, msg: `docs/TOOLS.md:${r.line} says [${r.ints.join(', ')}], the tree says [${measured.join(', ')}]` });
    }
    rows.push({ key: r.key, doc: r.ints, actual: measured, verdict: same ? 'OK' : 'MISMATCH', note: '', ms });
  }

  // ── the battery-size claim ("There are now N") ───────────────────────────
  const claim = /There are now\s+\**(\d+)\**/.exec(toolsMd);
  if (!claim) {
    faults.push({ kind: 'SIZE', key: TOOLS_MD, msg: 'the battery header no longer states its own size ("There are now N") — that sentence is itself a documented count' });
  } else if (Number(claim[1]) !== docRows.length) {
    faults.push({ kind: 'SIZE', key: TOOLS_MD, msg: `the header claims ${claim[1]} gates, the table has ${docRows.length} rows` });
  }

  return { rows, faults, docRows, headerLine };
}

function countGroups(re) {
  return new RegExp(re.source + '|').exec('').length - 1;
}

/* ══════════════════════════════════════════════════════════════════════════
   SELFTEST — every assertion names the implementation that FAILS it
   ══════════════════════════════════════════════════════════════════════════ */

function selftest() {
  let pass = 0, fail = 0;
  const ok = (cond, label, detail = '') => {
    if (cond) { pass++; console.log(`  ✓ ${label}${detail ? '   ' + detail : ''}`); }
    else { fail++; console.log(`  ✗ ${label}${detail ? '   ' + detail : ''}`); }
  };
  const H = (t) => console.log(`\n── ${t} ──`);

  /* ─ §A  doc parsing ─────────────────────────────────────────────────── */
  H('§A  the table parser  (fails: a parser that shrugs at malformed docs)');
  const goodTable = [
    '| gate | expect | covers |',
    '|---|---|---|',
    '| `node src/game/sim.test.mjs` | **253** | sim |',
    '| `node tools/aspect.mjs` | PASS, **0.00wu** | fairness |',
    '| `node tools/tmp/capture_audit.mjs` | **43/43 owned** · 15 css-immune | roles |',
    '',
    'There are now **3**',
  ].join('\n');
  const t = parseGateTable(goodTable);
  ok(t.rows.length === 3, 'A1  POSITIVE CONTROL: a well-formed table parses to 3 rows', `got ${t.rows.length}`);
  ok(JSON.stringify(intsOf('PASS, **0.00wu**')) === '[]',
     'A2  a DECIMAL is not two integers — `0.00wu` yields []', `naive /\\d+/g yields [${'0.00wu'.match(/\d+/g)}]`);
  ok(JSON.stringify(intsOf('**43/43 owned** · 15 css-immune')) === '[43,43,15]',
     'A3  every integer in the expect cell is part of the contract', JSON.stringify(intsOf('**43/43 owned** · 15 css-immune')));
  ok(normCmd('`PREVIEW_BASE=<snapshot> node tools/tmp/menu_accept.mjs`') === 'tools/tmp/menu_accept.mjs',
     'A4  `node `, backticks and PREVIEW_BASE= normalise to ONE key', normCmd('`PREVIEW_BASE=<snapshot> node tools/tmp/menu_accept.mjs`'));
  {
    // The literal driver_guard shape: ONE table, the same gate on two rows, different numbers.
    const dupTable = [
      '| gate | expect | covers |', '|---|---|---|',
      '| `node tools/tmp/driver_guard.mjs` | **49** | no 14th copy |',
      '| `node tools/tmp/driver_guard.mjs` | **86** | no 14th copy |',
      '', 'There are now **2**',
    ].join('\n');
    const r = check({
      toolsMd: dupTable, claudeMd: '', offline: [],
      skip: [['tools/tmp/driver_guard.mjs', 'test', 'fixture']], run: false,
    });
    ok(r.faults.some((f) => f.kind === 'ROW'),
       'A5  REFUSES two table rows for one gate — the literal driver_guard 49-vs-86 shape', kinds(r));
  }
  {
    let threw = false;
    try { parseGateTable('# a doc with no gate table at all\n\nprose\n'); } catch { threw = true; }
    ok(threw, 'A6  THROWS when the table is gone, rather than reporting "0 mismatches"');
  }

  /* ─ §B  the collapse guard ──────────────────────────────────────────── */
  H('§B  one source only  (fails: a checker that merely COMPARES copies)');
  const base = [
    '| gate | expect | covers |',
    '|---|---|---|',
    '| `node src/game/sim.test.mjs` | **253** | sim |',
    '| `node tools/tmp/sentinel.mjs` | **32** + 16 live | meta |',
    '',
    'There are now **2**',
  ].join('\n');
  const skipTwo = [['src/game/sim.test.mjs', 'test', 'fixture'], ['tools/tmp/sentinel.mjs', 'test', 'fixture']];
  {
    const claude = 'node src/game/sim.test.mjs                # 218\n';
    const r = check({ toolsMd: base, claudeMd: claude, offline: [], skip: skipTwo, run: false });
    ok(r.faults.some((f) => f.kind === 'DUP'),
       'B1  KNOWN-BAD: a second copy that DISAGREES (218 vs 253) is refused', kinds(r));
  }
  {
    const claude = 'node src/game/sim.test.mjs                # 253\n';
    const r = check({ toolsMd: base, claudeMd: claude, offline: [], skip: skipTwo, run: false });
    ok(r.faults.some((f) => f.kind === 'DUP'),
       'B2  KNOWN-BAD: a second copy that AGREES is refused TOO — this is the whole point', kinds(r));
  }
  {
    const claude = 'Run `node src/game/sim.test.mjs` before you push. See docs/TOOLS.md.\n';
    const r = check({ toolsMd: base, claudeMd: claude, offline: [], skip: skipTwo, run: false });
    ok(!r.faults.some((f) => f.kind === 'DUP'),
       'B3  FALSE-POSITIVE CONTROL: a prose mention with NO count is not a copy', kinds(r));
  }
  {
    const claude = 'a guard that has not failed is not a guard. `tools/tmp/sentinel.mjs` (32/32) encodes this.\n';
    const r = check({ toolsMd: base, claudeMd: claude, offline: [], skip: skipTwo, run: false });
    ok(r.faults.some((f) => f.kind === 'DUP'),
       'B4  KNOWN-BAD: an inline "(32/32)" in prose is a copy — it is how CLAUDE.md carried a stale 17/17', kinds(r));
  }
  {
    const toolsWithCopy = base.replace('There are now **2**',
      'node src/game/sim.test.mjs            # 253\n\nThere are now **2**');
    const r = check({ toolsMd: toolsWithCopy, claudeMd: '', offline: [], skip: skipTwo, run: false });
    ok(r.faults.some((f) => f.kind === 'DUP'),
       'B5  KNOWN-BAD: the copy in the SAME file (quick-start vs gate table) is refused', kinds(r));
  }
  {
    // Markdown prose wraps, so a count can land on the line AFTER the one naming the tool.
    const claude = 'the meta-guard is `tools/tmp/sentinel.mjs`, which\nencodes 32 selftest assertions.\n';
    const r = check({ toolsMd: base, claudeMd: claude, offline: [], skip: skipTwo, run: false });
    ok(r.faults.some((f) => f.kind === 'DUP'),
       'B6  KNOWN-BAD: a WRAPPED copy — path on one line, count on the next — is caught', kinds(r));
  }
  {
    const claude = `the meta-guard is \`tools/tmp/sentinel.mjs\`, which <!-- ${HISTORICAL} -->\nonce carried a stale 17/17 here.\n`;
    const r = check({ toolsMd: base, claudeMd: claude, offline: [], skip: skipTwo, run: false });
    ok(!r.faults.some((f) => f.kind === 'DUP'),
       'B7  the `gatecount: historical` marker exempts a deliberate quote — visible in a diff, unlike a blind spot', kinds(r));
  }
  {
    const claude = 'and `tools/tmp/sentinel.mjs` is the meta-guard # 99\n';
    const r = check({ toolsMd: base, claudeMd: claude, offline: [], skip: skipTwo, run: false });
    ok(r.faults.some((f) => f.kind === 'DUP'),
       'B8  MARKER CONTROL: without the marker the same shape IS refused, so B7 is not vacuous', kinds(r));
  }
  {
    // Two adjacent canonical rows: row N's window must not read row N+1's count as a copy.
    const r = check({ toolsMd: base, claudeMd: '', offline: [], skip: skipTwo, run: false });
    ok(!r.faults.some((f) => f.kind === 'DUP'),
       'B9  FALSE-POSITIVE CONTROL: adjacent table rows do not read each other as duplicate copies', kinds(r));
  }

  /* ─ §C  output parsing ──────────────────────────────────────────────── */
  H('§C  output parsing  (fails: a generic /\\d+/ scrape, and any silent skip)');
  ok(parseGateOutput('\n253 passed, 0 failed\n', S).values[0] === 253,
     'C1  POSITIVE CONTROL: the real summary line parses to 253');
  ok(parseGateOutput('', S).why === 'UNPARSEABLE',
     'C2  KNOWN-BAD: EMPTY output is UNPARSEABLE — never 0, never a silent skip');
  ok(parseGateOutput('Tests: 253 ok, 0 bad\n', S).why === 'UNPARSEABLE',
     'C3  KNOWN-BAD: a CHANGED format fails loudly — a gate cannot quietly stop being checked');
  {
    const decoy = 'driver_guard finished  (driver rev 4)\n';
    const r = parseGateOutput(decoy, /^driver_guard: (\d+) passed, \d+ failed/m);
    ok(r.why === 'UNPARSEABLE', 'C4  KNOWN-BAD: a decoy digit ("driver rev 4") is refused, not read as the count',
       JSON.stringify(r.values));
  }
  ok(parseGateOutput('32/32 sentinel checks passed\n', S).why === 'UNPARSEABLE',
     'C5  KNOWN-BAD: ANOTHER gate\'s summary line does not satisfy this gate\'s pattern');
  ok(parseGateOutput('253 passed, 0 failed\n...\n218 passed, 0 failed\n', S).why === 'AMBIGUOUS',
     'C6  KNOWN-BAD: two conflicting summary lines are AMBIGUOUS, not "take the last one"');
  ok(countGroups(/^(\d+)\/(\d+) owned files\s+·\s+(\d+) css/m) === 3,
     'C7  the arity of a probe is read off its capture groups', String(countGroups(/^(\d+)\/(\d+) owned\s+(\d+)/m)));

  /* ─ §D  verdicts ────────────────────────────────────────────────────── */
  H('§D  verdicts  (fails: a tool that always passes, and one that always fails)');
  const one = (expectCell, exec, probes) => check({
    toolsMd: `| gate | expect | covers |\n|---|---|---|\n| \`node fx.mjs\` | ${expectCell} | x |\n\nThere are now **1**`,
    claudeMd: '',
    offline: [{ key: 'fx.mjs', probes: probes ?? [pr(['fx.mjs'], S)] }],
    skip: [], exec,
  });
  {
    const r = one('**253**', () => ({ status: 0, stdout: '253 passed, 0 failed\n' }));
    ok(r.faults.length === 0 && r.rows[0].verdict === 'OK',
       'D1  POSITIVE CONTROL: doc 253 vs measured 253 is OK and exits clean', kinds(r));
  }
  {
    const r = one('**220**', () => ({ status: 0, stdout: '227 passed, 0 failed\n' }));
    ok(r.faults.some((f) => f.kind === 'MISMATCH'),
       'D2  KNOWN-BAD: the REAL economy defect (doc 220, tree 227) is refused', kinds(r));
  }
  {
    const r = one('**78**', () => ({ status: 0, stdout: '105 passed, 0 failed\n' }));
    ok(r.faults.some((f) => f.kind === 'MISMATCH'),
       'D3  KNOWN-BAD: the REAL valuescan defect (doc 78, tree 105) is refused', kinds(r));
  }
  {
    const r = one('**27** + 9 control', () => ({ status: 0, stdout: '27 passed, 0 failed\n' }));
    ok(r.faults.some((f) => f.kind === 'ARITY'),
       'D4  KNOWN-BAD: doc carries 2 numbers, the registry measures 1 → ARITY. This is the coverage-shrink guard', kinds(r));
  }
  {
    const r = one('**253**', () => ({ status: 1, stdout: '253 passed, 0 failed\n' }));
    ok(r.faults.some((f) => f.kind === 'GATE-FAIL'),
       'D5  KNOWN-BAD: a NON-ZERO exit is a fault even though the count matches', kinds(r));
  }
  {
    const r = check({
      toolsMd: '| gate | expect | covers |\n|---|---|---|\n| `node brand_new.mjs` | **9** | x |\n\nThere are now **1**',
      claudeMd: '', offline: [], skip: [], run: false,
    });
    ok(r.faults.some((f) => f.kind === 'UNREG'),
       'D6  KNOWN-BAD: a table row in NEITHER registry is refused — a new gate cannot arrive unchecked', kinds(r));
  }
  {
    const r = check({
      toolsMd: '| gate | expect | covers |\n|---|---|---|\n| `node x.mjs` | **1** | x |\n\nThere are now **1**',
      claudeMd: '', offline: [], skip: [['x.mjs', '', '']], run: false,
    });
    ok(r.faults.some((f) => f.kind === 'SKIP-REASON'),
       'D7  KNOWN-BAD: a SKIP with no reason is refused — "skipped" without a why is how gates go dark', kinds(r));
  }
  {
    const r = check({
      toolsMd: '| gate | expect | covers |\n|---|---|---|\n| `node x.mjs` | **1** | x |\n\nThere are now **1**',
      claudeMd: '', offline: [{ key: 'gone.mjs', probes: [pr(['gone.mjs'], S)] }],
      skip: [['x.mjs', 'test', 'fixture']], run: false,
    });
    ok(r.faults.some((f) => f.kind === 'UNDOC'),
       'D8  KNOWN-BAD: a gate the tool RUNS but the table never documents is refused', kinds(r));
  }
  {
    const r = one('**253**', () => ({ status: 0, stdout: '253 passed, 0 failed\n' }));
    const bad = { ...r };
    void bad;
    const r2 = check({
      toolsMd: `| gate | expect | covers |\n|---|---|---|\n| \`node fx.mjs\` | **253** | x |\n\nThere are now **7**`,
      claudeMd: '', offline: [{ key: 'fx.mjs', probes: [pr(['fx.mjs'], S)] }], skip: [],
      exec: () => ({ status: 0, stdout: '253 passed, 0 failed\n' }),
    });
    ok(r2.faults.some((f) => f.kind === 'SIZE'),
       'D9  KNOWN-BAD: the header\'s own "There are now N" is a documented count too, and 7 ≠ 1 rows', kinds(r2));
  }

  /* ─ §E  end to end ──────────────────────────────────────────────────── */
  H('§E  end-to-end on a fixture world  (fails: any of the above in combination)');
  const world = (over = {}) => {
    const toolsMd = over.toolsMd ?? [
      '| gate | expect | covers |', '|---|---|---|',
      '| `node a.mjs` | **10** | a |',
      '| `node b.mjs --selftest` | **20** | b |',
      '| `node c.mjs` | **30** | browser one |',
      '', 'There are now **3**',
    ].join('\n');
    return check({
      toolsMd,
      claudeMd: over.claudeMd ?? 'Run the gates. See docs/TOOLS.md.\n',
      offline: [
        { key: 'a.mjs', probes: [pr(['a.mjs'], S)] },
        { key: 'b.mjs --selftest', probes: [pr(['b.mjs', '--selftest'], S)] },
      ],
      skip: [['c.mjs', 'browser', 'fixture browser gate']],
      exec: over.exec ?? ((argv) => ({ status: 0, stdout: `${argv[0] === 'a.mjs' ? 10 : 20} passed, 0 failed\n` })),
    });
  };
  {
    const r = world();
    ok(r.faults.length === 0, 'E1  POSITIVE CONTROL: a consistent world is clean', kinds(r));
    ok(r.rows.find((x) => x.key === 'c.mjs').verdict === 'SKIP',
       'E2  the browser gate is printed as a VISIBLE SKIP row, not omitted');
  }
  {
    const r = world({ toolsMd: [
      '| gate | expect | covers |', '|---|---|---|',
      '| `node a.mjs` | **11** | a |',
      '| `node b.mjs --selftest` | **20** | b |',
      '| `node c.mjs` | **30** | browser one |',
      '', 'There are now **3**',
    ].join('\n') });
    ok(r.faults.length === 1 && r.faults[0].kind === 'MISMATCH' && r.faults[0].key === 'a.mjs',
       'E3  KNOWN-BAD: one bumped doc number flags EXACTLY that row and nothing else', kinds(r));
  }
  {
    const r = world({ exec: (argv) => argv[0] === 'a.mjs'
      ? ({ status: 0, stdout: 'a.mjs: all good!\n' })
      : ({ status: 0, stdout: '20 passed, 0 failed\n' }) });
    ok(r.faults.some((f) => f.kind === 'UNPARSEABLE' && f.key === 'a.mjs'),
       'E4  KNOWN-BAD: a gate whose OUTPUT FORMAT changed fails loudly instead of dropping out of coverage', kinds(r));
  }
  {
    const r = world({ claudeMd: 'node a.mjs   # 10\n' });
    ok(r.faults.some((f) => f.kind === 'DUP' && f.key === 'a.mjs'),
       'E5  KNOWN-BAD: reintroducing the count into CLAUDE.md is caught BEFORE any gate runs', kinds(r));
  }
  {
    const r = world({ exec: () => ({ status: 0, stdout: '10 passed, 0 failed\n' }) });
    ok(r.faults.some((f) => f.kind === 'MISMATCH' && f.key === 'b.mjs --selftest'),
       'E6  MUTATION CONTROL: making both gates return a\'s count breaks exactly b — the probes are not aliased', kinds(r));
  }

  /* ─ §F  the registry is honest about the real tree ──────────────────── */
  H('§F  the shipped registry  (fails: a registry that drifted from the repo)');
  {
    const missing = OFFLINE.flatMap((o) => o.probes.map((p) => p.argv[0])).filter((f) => !existsSync(join(ROOT, f)));
    ok(missing.length === 0, 'F1  every OFFLINE probe points at a file that exists', missing.join(', ') || 'all present');
  }
  {
    const missing = SKIP.map((s) => scriptPathOf(normCmd(s[0]))).filter((p) => p && !existsSync(join(ROOT, p)));
    ok(missing.length === 0, 'F2  every SKIP entry points at a file that exists', missing.join(', ') || 'all present');
  }
  {
    const dup = OFFLINE.map((o) => normCmd(o.key)).filter((k, i, a) => a.indexOf(k) !== i);
    ok(dup.length === 0, 'F3  no gate is registered twice in OFFLINE', dup.join(', ') || 'none');
  }
  {
    const both = OFFLINE.map((o) => normCmd(o.key)).filter((k) => SKIP.some((s) => normCmd(s[0]) === k));
    ok(both.length === 0, 'F4  no gate is both OFFLINE and SKIPped', both.join(', ') || 'none');
  }
  {
    const bad = SKIP.filter((s) => !s[1] || !s[2]);
    ok(bad.length === 0, 'F5  every SKIP carries a reason and an explanation', bad.map((s) => s[0]).join(', ') || 'none');
  }

  /* ─ §G  the LIVE documents, not a fixture world ─────────────────────────── */
  /**
   * 🚨 §A–§F all run on fixtures, and a fixture world can be the thing that is wrong.
   *
   * Every arm here reads the REAL `CLAUDE.md` and `docs/TOOLS.md`, because the three defects
   * this section was written for were all invisible to a fixture:
   *   • the `gatecount: historical` marker had gone **decorative** — it suppressed nothing, and
   *     §B7/§B8 kept passing because they build their own two-line fixture where it does work;
   *   • the file header carried a **measurement** ("exactly one hit") that had decayed to zero;
   *   • the tool's blind spot — a count beside a BARE tool name — was stated nowhere and
   *     asserted nowhere, so nobody could tell a blind spot from a guarantee.
   *
   * ⚠️ Note the shape: G1 and G2 are a PAIR. G1 alone is satisfied by a tool that reports
   * nothing ever; G2 alone is satisfied by a tool that reports everything. Neither means
   * anything without the other, which is the `selfPair` lesson (`docs/LESSONS.md` §13).
   */
  H('§G  the REAL documents  (fails: an exemption marker that has quietly gone decorative)');
  const realTools = readFileSync(join(ROOT, TOOLS_MD), 'utf8');
  const realClaude = readFileSync(join(ROOT, CLAUDE_MD), 'utf8');
  const dupsIn = (claude) => check({ toolsMd: realTools, claudeMd: claude, run: false })
    .faults.filter((f) => f.kind === 'DUP');
  {
    ok(dupsIn(realClaude).length === 0,
       'G1  CONTROL: the shipped CLAUDE.md + TOOLS.md carry no duplicate count',
       dupsIn(realClaude).map((d) => d.msg.slice(0, 60)).join(' | ') || 'clean');
  }
  {
    const stripped = realClaude.replace(`<!-- ${HISTORICAL} -->`, '');
    ok(stripped !== realClaude, 'G2a the `gatecount: historical` marker is still present in CLAUDE.md');
    ok(dupsIn(stripped).length > 0,
       'G2  KNOWN-BAD: with the marker STRIPPED the same file DUPs — i.e. the marker is LOAD-BEARING, '
       + 'not decorative. This arm was RED on 2026-08-12: the marker had drifted 19 lines from the '
       + 'tool name it exempts and was suppressing nothing',
       dupsIn(stripped).map((d) => d.at ?? d.msg.slice(0, 60)).join(' | ') || 'NO DUP — the marker is inert again');
  }
  {
    // The literal pre-d9788eb line, recovered with `git show 66af944:CLAUDE.md`.
    const historical = '   it guards against is not a guard.** `tools/tmp/sentinel.mjs` (17/17) encodes this: MOVES, HOLDS,\n   ORDERS, SELF-PAIR.\n';
    ok(dupsIn(historical).length > 0,
       'G3  KNOWN-BAD: the REAL stale line this tool commemorates — path and count on ONE line — is '
       + 'refused. It was claimed this tool could not catch its own founding defect; it can',
       dupsIn(historical).map((d) => d.evidence ?? d.msg.slice(0, 50)).join(' | ') || 'NO DUP');
  }
  {
    // The stated blind spot, asserted rather than left to be discovered — with the positive
    // control beside it, because "no hit" is also what a broken scan returns.
    const bare = 'the meta-guard `sentinel` encodes 32 selftest assertions.\n';
    const path = 'the meta-guard `tools/tmp/sentinel.mjs` encodes 32 selftest assertions.\n';
    ok(dupsIn(bare).length === 0 && dupsIn(path).length > 0,
       'G4  THE BLIND SPOT, ASSERTED: a count beside a BARE tool name is NOT reported, while the '
       + 'identical sentence naming the .mjs PATH is. Deliberate — bare names measured 16 false '
       + 'positives for 1 true one on the real docs — but it is a limit, not a guarantee',
       `bare ${dupsIn(bare).length}, path ${dupsIn(path).length}`);
  }
  {
    /**
     * G5 — A DOCUMENT MAY CLAIM IT IS POLICED **IF AND ONLY IF** IT IS ONE OF THE TWO READ.
     *
     * ⚠️ The first version of this arm asked whether the string `STATE.md` appears in this
     * tool's source. That was a **prose sniff, not a test**: it went red the moment the header
     * above started *naming* the file it does not read, which is the fix. Rewritten as a
     * biconditional over the actual scanned set, so it stays correct in BOTH directions — if
     * `docs/STATE.md` is ever added to `check()`'s inputs, this arm demands the claim come back.
     *
     * The falsifier is the tree as it stood on 2026-08-12: `docs/STATE.md:72` asserted
     * *"`gatecount` refuses a second copy even one that agrees"* about itself, while line 143
     * carried an unpoliced gate count and the tool had never opened the file.
     */
    ok(SCANNED_DOCS.length === 2 && SCANNED_DOCS.includes(TOOLS_MD) && SCANNED_DOCS.includes(CLAUDE_MD),
       'G5  SCOPE, ASSERTED: the duplicate scan reads EXACTLY `docs/TOOLS.md` + `CLAUDE.md`. Adding '
       + 'a third obliges four documents to be re-worded, and this arm is the tripwire',
       SCANNED_DOCS.join(' + '));
    // The exact sentence that was false. Kept verbatim rather than as a regex: a loose pattern
    // over prose is what made the FIRST version of this arm go red on the fix that repaired it.
    const OLD_FALSE_CLAIM = '**Do not copy a count into this file** — `gatecount` refuses a second copy even one that agrees';
    const stateMd = readFileSync(join(ROOT, 'docs/STATE.md'), 'utf8');
    ok(!stateMd.includes(OLD_FALSE_CLAIM),
       'G6  KNOWN-BAD, REGRESSION: docs/STATE.md must not re-assert that `gatecount` polices IT. '
       + 'That sentence shipped for a session while STATE.md:143 carried an unpoliced gate count '
       + 'and this tool had never opened the file',
       stateMd.includes(OLD_FALSE_CLAIM) ? 'the false claim is back' : 'absent');
    ok(/`ic_spec` prints/.test(stateMd),
       'G7  CONTROL: the count G6 is about is still IN docs/STATE.md — otherwise G6 would be '
       + 'passing because there is nothing left to be wrong about, which is this repo\'s own '
       + '`[].every()` vacuity class');
  }

  console.log(`\ngatecount --selftest: ${pass} passed, ${fail} failed`);
  return fail === 0 ? 0 : 1;
}

const kinds = (r) => r.faults.map((f) => f.kind).join(',') || '(clean)';

/* ══════════════════════════════════════════════════════════════════════════
   CLI
   ══════════════════════════════════════════════════════════════════════════ */

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) process.exit(selftest());

  if (argv.includes('--list')) {
    console.log('OFFLINE (run here):');
    for (const o of OFFLINE) console.log(`  ${o.key}`);
    console.log('\nSKIP (documented, not run here):');
    for (const [k, reason, why] of SKIP) console.log(`  ${k.padEnd(38)} ${reason.padEnd(12)} ${why}`);
    process.exit(0);
  }

  const run = !argv.includes('--docs-only');
  const toolsMd = readFileSync(join(ROOT, TOOLS_MD), 'utf8');
  const claudeMd = readFileSync(join(ROOT, CLAUDE_MD), 'utf8');
  const t0 = Date.now();
  const { rows, faults } = check({ toolsMd, claudeMd, run });

  console.log(`\n── GATE COUNTS: docs/TOOLS.md's gate table vs the tree ${run ? '' : '(docs only)'} ──\n`);
  const W = 46;
  console.log(`${'gate'.padEnd(W)} ${'doc'.padStart(12)} ${'actual'.padStart(12)}  verdict`);
  console.log('─'.repeat(W + 40));
  for (const r of rows) {
    const doc = r.doc.length ? r.doc.join('/') : '—';
    const act = r.actual ? r.actual.join('/') : '—';
    const mark = r.verdict === 'OK' ? '✓' : r.verdict === 'SKIP' || r.verdict === 'not-run' ? '·' : '✗';
    const ms = r.ms > 1000 ? `  ${(r.ms / 1000).toFixed(1)}s` : '';
    console.log(`${mark} ${r.key.padEnd(W - 2)} ${doc.padStart(12)} ${act.padStart(12)}  ${r.verdict}${r.note ? '  — ' + r.note : ''}${ms}`);
  }

  const okN = rows.filter((r) => r.verdict === 'OK').length;
  const skipN = rows.filter((r) => r.verdict === 'SKIP').length;
  console.log('\n' + '─'.repeat(W + 40));
  if (faults.length === 0) {
    console.log(`gatecount: ${okN} verified, ${skipN} skipped (browser / non-numeric), 0 faults   ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    process.exit(0);
  }
  console.log(`gatecount: ${faults.length} FAULT(S)   ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
  for (const f of faults) console.log(`  ✗ ${f.kind.padEnd(12)} ${f.key}\n      ${f.msg}`);
  console.log('');
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
