#!/usr/bin/env node
/**
 * ARENA-LITERAL GUARD — the gate `gatecount` structurally cannot be.
 *
 * ── The gap it fills ────────────────────────────────────────────────────────
 *
 * `6631446` changed two constants (`ARENA_W/H`, 1400×1000 → 2800×2000). Everything
 * derived from them was right that commit; every literal COPY of the old geometry began
 * describing a map that does not exist. **Eleven were found one at a time, each by
 * accident, and four of the eleven were GREEN THE WHOLE TIME** — `valuescan --selftest`
 * 105/105 with 14 of 18 stations in the wrong quadrant and 11 inside a `CoverBox`;
 * `np_nfighter` 62/62 with its measuring ring 1,077 wu off centre.
 *
 * 🚨 **`gatecount` cannot see this class by construction.** It checks that a gate's
 * *count* matches its documented count. It has nothing to say about whether the gate is
 * **pointed anywhere real** — and a mis-aimed fixture keeps its count perfectly.
 *
 * ⚠️ **AND "IS THIS COORDINATE LEGAL?" CANNOT SEE IT EITHER**, which is why nobody
 * noticed for a day: the 1× playfield is exactly the **NW quadrant** of the ×4 one, so
 * every 1× point is still a legal ×4 point. The three detectors that DO work are the
 * three arms below — the exact 1× scalars, one-quadrant clustering, and standing inside
 * a prop.
 *
 * ── Use ─────────────────────────────────────────────────────────────────────
 *   node tools/tmp/al_guard.mjs              # the gate: exit 1 on any unacknowledged hit
 *   node tools/tmp/al_guard.mjs --selftest   # every arm proved against a known-bad
 *   node tools/tmp/al_sweep.mjs              # the readable census behind it
 *
 * Offline, no browser, ~1 s. Reads only tracked files and `tools/arena.gameplay.json`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROOT, MAP_1X, MAXR_1X, MAXR_RETIRED_X4, SELF_EXCLUDED, isRetiredX4Scalar,
  loadArena, scanFiles, extract, classify,
  addressesShippedArena, coverAt, quadrant, isDocFile,
} from './al_lib.mjs';

const IS_MAIN = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   - ${name}`); }
  else { fail++; console.log(`  FAIL - ${name}${detail ? `\n         ${detail}` : ''}`); }
};

/**
 * ── THE ACKNOWLEDGEMENT LIST ────────────────────────────────────────────────
 *
 * Every entry is a hit the guard would otherwise fail on, with the reason it is not a
 * defect **or** the reason it is not being fixed here. Keyed `file:line:CODE` is
 * deliberately NOT used — line numbers move — so it is keyed `file:CODE` plus a
 * `value` predicate where the file legitimately holds several.
 *
 * 🚨 **THE LIST MAY ONLY SHRINK.** §E below asserts the acknowledged
 * count against a recorded number (`ACK_BUDGET`), so adding an entry is a visible, deliberate act and
 * a *new* stale literal in an unacknowledged file is red on the first run.
 *
 * ⚠️ Note what is NOT here: the eleven fixtures of DECISIONS §60/§64/§65, and the twelve
 * found by this pass. They are FIXED, not acknowledged.
 */
const ACK = [
  // ── (0) DOCUMENTATION that QUOTES the defect, and a known-bad FIXTURE ───────
  //
  // 🚨 These are the entries §M judges, and §M exists because markdown is masked as prose
  // (`al_lib.commentMask`) and would otherwise be invisible to every arm. A `.md` cannot
  // be a mis-aimed fixture — nothing in it runs — but it CAN carry a stale coordinate that
  // the next agent copies, so it is adjudicated here rather than waved through.
  { file: 'docs/LESSONS.md', code: '1X-SCALAR', why:
    'the §18 lesson written ABOUT this class quotes `tools/match-play.mjs`\'s historical '
    + '`ARENA={w:1400,h:1000,cx:700,cy:500,maxR:890}` VERBATIM, on one line, in the sentence that '
    + 'explains it was the worst instance. The house style requires a reversed assertion to keep its '
    + 'old wording; failing the quote would put this guard in direct conflict with that, and the '
    + 'predictable outcome of that conflict is the guard being switched off.' },
  { file: 'docs/LESSONS.md', code: '1X-PAIR', why:
    'the same line: the 1× size (1400×1000) and the 1× centre (700,500) inside the same quoted '
    + 'literal. §E kills both entries the moment that sentence is rewritten, so the exemption cannot '
    + 'outlive the quote it exempts.' },
  { file: 'tools/tmp/lit_clockguard.mjs', code: '1X-SCALAR', why:
    'a KNOWN-BAD FIXTURE STRING, not an aim: `maskAt(\'await p.goto(`http://localhost:4321/'
    + '?fogRadius=850`)\')` is the control proving `//` in a URL is a scheme separator and not a '
    + 'comment. It is the same situation as `al_lib`/`al_sweep`/`al_guard`, which `scanFiles` '
    + 'excludes because they describe the 1× map ON PURPOSE — but excluding the whole file would '
    + 'blind this guard to the rest of it, so it is acknowledged by CODE instead. ⚠️ ROUTED to the '
    + 'owner: the literal is incidental to what that control proves (any radius works), so replacing '
    + '850 with a radius that is not a retired scalar would retire this entry. Peer-owned file; not '
    + 'mine to edit. ⚠️ THIS ADVICE USED TO READ "replacing 850 with 1985", which would have swapped '
    + 'a 1x fossil for a x4 one — 1985 is itself retired (see al_lib:MAXR_RETIRED_X4), and the entry '
    + 'would have gone on looking discharged. Name the derivation, never a number.' },

  // ── (1) FACTS OF THE MAP, not defects ───────────────────────────────────────
  // `boiling_pot` is centred on the arena centre, so ANY fixture aimed at the exact
  // centre is "inside cover". Asserted, not assumed: `--selftest`'s last control checks
  // `coverAt(centre).kind === 'boiling_pot'`, so if the pot ever moves these four stop
  // being excusable and the ACK entries go dead (§E catches that too).
  { file: 'tools/arena-scan.mjs', code: 'IN-COVER', why:
    'CENTRE (1400,1000) is the arena centre and the pot is centred on it by design.' },
  { file: 'tools/tmp/h49_chips.mjs', code: 'IN-COVER', why:
    'CENTER (1400,1000) is the arena centre; the cast is laid on a 190 wu RING about it, and every '
    + 'one of the six ring points is clear of cover — the centre itself is never stood on.' },
  { file: 'tools/tmp/lu_sudden.mjs', code: 'IN-COVER', why:
    'a declared `let CENTRE = {1400,1000}` placeholder that the file replaces with a live read before '
    + 'any arm runs, and says so on the line.' },
  { file: 'tools/tmp/mg_look.mjs', code: 'IN-COVER', why:
    'the `hub` station IS the pot — that is what it is named for and what it photographs.' },
  { file: 'tools/tmp/sp_place.mjs', code: 'IN-COVER', why:
    '§E`s `p = {317,211}` is an ARBITRARY point proving `mirror()` is an involution about the centre. '
    + 'Pure arithmetic; it is never stood on, so standability does not apply to it.' },

  // ── (2) SYNTHETIC FIXTURES in a peer-owned file ────────────────────────────
  { file: 'src/game/sim.test.mjs', code: '1X-PAIR', why:
    'nine `makeArena({width: 1400, height: 1000, …})` SYNTHETIC arenas — a corridor, a U-pocket, an '
    + 'open field — for unit-testing pure sim logic. 1400x1000 there means "a convenient rectangle", '
    + 'not "the arena"; each carries its own cover list and is self-consistent. Peer-owned; not mine.' },
  { file: 'src/game/sim.test.mjs', code: '1X-SCALAR', why:
    'four `maxSafeRadius: 993` on those same synthetic arenas, several of them deliberately labelled '
    + '"the shipped kitchen`s 1x value" in a scale-invariance proof. Peer-owned; not mine.' },

  // ── (3) REAL, ENUMERATED, ROUTED — NOT fixed here, and the reason is a number ─
  //
  // 63 one-shot analysis probes across 45 files still carry the 1x `maxSafeRadius`
  // (850 / 993) in their page URL, and 18 of them additionally teleport the fighter to a
  // 1x station that is inside a `CoverBox`. They are NOT gates: the five that WERE
  // registered gates (`aoband`, `cs_charcontact`, `hc_occluders`, `hw_burner`, `lu_land`)
  // were re-aimed in this pass, as were the fixtures (`simfix`, `limbmatch`,
  // `gradechroma`, `tier_colour`, `sc_fogstill`, `ap_view`, `mg_look`, `h49_chips`,
  // `journey`, `arena-scan`, `match-play`, `match-sim`).
  //
  // ⚠️ These are frozen rather than fixed **on a stated risk, not on fatigue**: their
  // recorded outputs are historical measurements, and `tools/scan/colour-baseline.json`
  // carries these very coordinates in its provenance. Re-aiming the probes without
  // re-baselining is precisely the *"re-baselining against a dark violet arena and never
  // knowing why"* hazard `match.ts:applyQaSetup` spends thirty lines warning about. The
  // debt is now ENUMERATED and CANNOT GROW: §E pins the list length, so a 64th entry is
  // a deliberate, visible act and any NEW stale literal in an unlisted file is red on
  // the first run.
  ...[
    'tools/tmp/ao_ab.mjs', 'tools/tmp/aotune.mjs',
    'tools/tmp/ap_reach.mjs', 'tools/tmp/arena_rimcensus.mjs',
    'tools/tmp/arena_shadow_ab.mjs', 'tools/tmp/caphex.mjs',
    'tools/tmp/contactshadow.mjs', 'tools/tmp/contrastab.mjs',
    'tools/tmp/cs_conserr.mjs', 'tools/tmp/cs_decalprobe.mjs',
    'tools/tmp/flashread.mjs', 'tools/tmp/greasekey.mjs',
    'tools/tmp/haloprobe.mjs', 'tools/tmp/hc_probe.mjs',
    'tools/tmp/head_shot.mjs', 'tools/tmp/hud_fit.mjs',
    'tools/tmp/hud_hue.mjs', 'tools/tmp/hudshare.mjs',
    'tools/tmp/livecover_probe.mjs', 'tools/tmp/lu_occlude.mjs',
    'tools/tmp/matcover.mjs', 'tools/tmp/matvar.mjs',
    'tools/tmp/p1_castmat.mjs', 'tools/tmp/p1_drawcost.mjs',
    'tools/tmp/p1_floorlever.mjs', 'tools/tmp/p1_matresp.mjs',
    'tools/tmp/p1_rimlook.mjs', 'tools/tmp/p1_rimreach.mjs',
    'tools/tmp/p2_decalab.mjs', 'tools/tmp/p2_padcensus.mjs',
    'tools/tmp/p2_sidecheck.mjs', 'tools/tmp/p4_coverdensity.mjs',
    'tools/tmp/padsweep.mjs', 'tools/tmp/perspcheck.mjs',
    'tools/tmp/postablate.mjs', 'tools/tmp/rimcheck.mjs',
    'tools/tmp/sd_lab.mjs', 'tools/tmp/selfweapon_probe.mjs',
    'tools/tmp/shadowprobe.mjs', 'tools/tmp/stationshot.mjs',
    'tools/tmp/stunlock_probe.mjs', 'tools/tmp/valuelift_price.mjs',
    'tools/tmp/vl_facing.mjs', 'tools/tmp/vl_recon.mjs',
    'tools/tmp/whomat.mjs',
  ].map((file) => ({ file, code: '1X-SCALAR', why:
    'ROUTED: one-shot analysis probe holding the 1x maxSafeRadius (850/993) in its page URL. Not a '
    + 'gate; re-aiming it would re-baseline a recorded measurement. See the block comment above.' })),
  ...[
    'tools/tmp/contrastab.mjs', 'tools/tmp/cs_decalprobe.mjs',
    'tools/tmp/haloprobe.mjs', 'tools/tmp/head_shot.mjs',
    'tools/tmp/hud_hue.mjs', 'tools/tmp/hudshare.mjs',
    'tools/tmp/lu_occlude.mjs', 'tools/tmp/matvar.mjs',
    'tools/tmp/p1_castmat.mjs', 'tools/tmp/p1_drawcost.mjs',
    'tools/tmp/p1_floorlever.mjs', 'tools/tmp/p1_matresp.mjs',
    'tools/tmp/p1_rimlook.mjs', 'tools/tmp/p1_rimreach.mjs',
    'tools/tmp/postablate.mjs', 'tools/tmp/rimcheck.mjs',
    'tools/tmp/vl_facing.mjs', 'tools/tmp/vl_recon.mjs',
  ].map((file) => ({ file, code: 'IN-COVER', why:
    'ROUTED: one-shot analysis probe whose page URL or station table stands the fighter in a prop at '
    + 'a 1x coordinate. Not a gate; see the block comment above.' })),
];

/**
 * Recorded size of ACK. It may go DOWN freely; going UP is a deliberate, visible act.
 * ⚠️ 70 → 73 on 2026-08-12, and this is what "deliberate and visible" is supposed to look
 * like: +2 for `docs/LESSONS.md`, which §M now judges and no arm judged before (so this is
 * coverage ARRIVING, not debt), and +1 for `lit_clockguard`'s control string, a genuinely
 * new hit that landed with `b203329` and is routed to its owner in the entry itself.
 */
const ACK_BUDGET = 73;

function acknowledged(rel, code) {
  return ACK.some((a) => a.file === rel && a.code === code);
}

// ── the census, shared with al_sweep so the two cannot disagree ─────────────

function collect() {
  const arena = loadArena();
  const files = scanFiles();
  const rows = [];
  for (const rel of files) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const ctx = { shipped: addressesShippedArena(text) };
    for (const h of extract(rel, text)) {
      rows.push({ ...h, shipped: ctx.shipped, flags: classify(arena, h, ctx) });
    }
  }
  return { arena, files, rows };
}

// ── the arms ────────────────────────────────────────────────────────────────

function run() {
  const { arena, files, rows } = collect();
  console.log(`al_guard — arena ${arena.w}×${arena.h}, centre (${arena.cx},${arena.cy}), `
    // ⚠️ OLD WORDING, KEPT WITH THE REASON, BECAUSE IT WAS FALSE AND IT WAS FALSE HERE:
    //    > "`maxSafeRadius` is printed AS DUMPED and labelled so, because on 2026-08-12 the
    //    > dump's 1985 no longer matches what `rules.ts:fogOpeningRadiusFor` derives under
    //    > `6d5c4d6`'s 150 s clock (1792 — `ax_layout --selftest` reports the gap)."
    // Every clause of that is now wrong, and two of them were wrong when written. The dump is
    // NOT 1985 (`56aa864` refreshed it); `fogOpeningRadiusFor` does not derive 1792 (it returns
    // the half-diagonal — 1792 is the DEAD `round(halfDiag / (1 − 6000/T))` formula's output on
    // the 150 s clock); and `ax_layout --selftest` reports no gap (`c858e3e` turned that row
    // into an identity, and it is green). See `al_lib:MAXR_RETIRED_X4`.
    //
    // ⚠️ **IT IS STILL PRINTED AS DUMPED**, and that part was and is right: `loadArena`
    // cross-checks the dump against `shared.ts` on ARENA_W/H **only**, so no arm here verifies
    // this number. NOT tightened into a throw, and NOT re-derived here either — a second copy
    // of the derivation is the `ax_layout` defect `c858e3e` removed, which agreed by
    // construction until the clock moved. **The assertion exists and it is somebody else's:**
    // `ax_layout --selftest` — *"the shipped dump's maxSafeRadius is the one `rules.ts`
    // derives (a stale dump fails HERE, not silently inside every fixture built from it)"*.
    // No arm here reads it — the 1× arm compares against `MAXR_1X`, cover/spawns come from the
    // same dump, and §X compares against `MAXR_RETIRED_X4`.
    + `maxSafeRadius ${arena.maxSafeRadius} (as dumped — verified by \`ax_layout --selftest\`, not here), `
    + `half-diagonal ${arena.halfDiagonal.toFixed(2)}`);
  console.log(`${files.length} tracked text files · ${rows.length} candidates extracted by syntactic role\n`);

  // §S — THE INSTRUMENT ITSELF. Everything below filters; a filter over an empty set
  // passes vacuously, and three controls went vacuous exactly that way in one session.
  console.log('§S — the guard can still SEE. (a filter over an empty set passes.)');
  check('the corpus is non-empty', files.length > 300, `${files.length} files`);
  check('candidates were extracted at all', rows.length > 200, `${rows.length} candidates`);
  const roles = new Set(rows.map((r) => r.role));
  check('every extractor role is represented — pos / dim / centre / radius',
    ['pos', 'dim', 'radius'].every((r) => roles.has(r)), [...roles].join(','));
  // The four station tables that started this. If the table extractor regresses (it has
  // twice, on bracket anchoring), these go to zero and the whole IN-COVER arm silently
  // stops covering the files it exists for.
  const tables = new Map();
  for (const r of rows) if (r.table) tables.set(`${r.file}:${r.table}`, (tables.get(`${r.file}:${r.table}`) ?? 0) + 1);
  for (const [key, min] of [['tools/arena-scan.mjs:STATIONS', 10], ['tools/tmp/valuescan.mjs:STATIONS', 10],
    ['tools/tmp/simfix.mjs:STATIONS', 10], ['tools/tmp/limbmatch.mjs:STATIONS', 3]]) {
    check(`the extractor still finds ${key} (≥${min} rows)`, (tables.get(key) ?? 0) >= min, `${tables.get(key) ?? 0} rows`);
  }
  const shippedPos = rows.filter((r) => r.role === 'pos' && r.shipped && !r.inComment);
  check('there are shipped-arena positions to judge legality on', shippedPos.length > 40, `${shippedPos.length}`);
  // §M judges markdown only. Markdown is masked as prose end to end, so if `.md` ever falls
  // out of `scanFiles` (:109) BOTH of these go to zero and §M would then pass over an empty
  // set — the `[].every()` vacuity, which is the exact class this whole guard was built for.
  // These two are the non-emptiness assertion rule 6 demands BEFORE the filter runs.
  const mdFiles = files.filter(isDocFile);
  const mdRows = rows.filter((r) => isDocFile(r.file));
  check('the corpus still includes markdown at all (else §M is vacuous)', mdFiles.length >= 5, `${mdFiles.length} .md files`);
  check('candidates were extracted FROM markdown (else §M is vacuous)', mdRows.length >= 4, `${mdRows.length} candidates`);

  /**
   * 🚨 PROSE IS COUNTED, NEVER FAILED — and that is a design decision, not a loophole.
   *
   * This project REQUIRES a reversed assertion to keep its old wording: *"change it and
   * keep the old wording above it with the reason — done five times this session, never
   * deleted."* Every fix in this pass therefore quotes the 1× literal it replaced. A
   * guard that failed on those would be in direct conflict with the convention, and the
   * predictable outcome of that conflict is the guard being switched off. So comment
   * hits are reported as a number and the arms judge CODE.
   *
   * ⚠️ The cost is real and is stated rather than hidden: `fogRing.ts:207` was **a wrong
   * constant justified by a wrong comment**, and this guard would have caught the
   * constant and not the sentence. Stale prose is a live defect class here; it is simply
   * not one an automated arm can separate from a deliberate historical quote.
   *
   * 🚨 **AND UNTIL 2026-08-12 THIS PARAGRAPH WAS TRUE OF `//` COMMENTS AND FALSE OF
   * MARKDOWN**, because `al_lib.commentMask` tested `text.slice(0, 0)` — the empty string —
   * so no `.md` line was ever masked and `docs/LESSONS.md:1028` failed §A and §B for
   * quoting the very defect §18 describes. Markdown is now prose end to end. The coverage
   * that buys is not simply given away: **§M** below judges the markdown set against the
   * SAME acknowledgement list, so a stale coordinate in a doc is red and an adjudicated
   * quote is green.
   */
  const prose = rows.filter((r) => r.inComment && r.flags.length);
  const code = rows.filter((r) => !r.inComment);
  const docHits = prose.filter((r) => isDocFile(r.file));
  console.log(`(${prose.length} flagged literals sit in COMMENTS — counted, not failed; see the note in §A. `
    + `${docHits.length} of them are in MARKDOWN and are judged by §M. `
    + `The arms below judge ${code.length} code candidates.)`);

  // §A — no literal equal to a 1× characteristic SCALAR, in an arena role.
  console.log('\n§A — no 1× scalar (maxSafeRadius 850/890/993, FIELD_OUTER 1500, half-diagonal ~860)');
  const scalarHits = code.filter((r) => r.flags.some((f) => f.code === '1X-SCALAR') && !acknowledged(r.file, '1X-SCALAR'));
  check(`0 unacknowledged 1× scalars (${MAXR_1X.join('/')} · ${MAP_1X.fieldOuter} · ~${MAP_1X.halfDiagonal})`,
    scalarHits.length === 0, scalarHits.map((r) => `${r.file}:${r.line}  ${r.value}  ${r.why}`).join('\n         '));

  // §B — no self-declared arena OBJECT holding the 1× size or centre.
  console.log('\n§B — no self-declared arena at 1400×1000 or centred (700,500)');
  const pairHits = code.filter((r) => r.flags.some((f) => f.code === '1X-PAIR') && !acknowledged(r.file, '1X-PAIR'));
  check('0 unacknowledged 1× arena objects', pairHits.length === 0,
    pairHits.map((r) => `${r.file}:${r.line}  (${r.value})  ${r.why}`).join('\n         '));

  // §C — every fixture point is on legal ground.
  console.log('\n§C — no fixture point inside a CoverBox or outside the playfield');
  const oob = code.filter((r) => r.flags.some((f) => f.code === 'OOB') && !acknowledged(r.file, 'OOB'));
  check('0 fixture points outside the playfield', oob.length === 0,
    oob.map((r) => `${r.file}:${r.line}  (${r.value})`).join('\n         '));
  const inCover = code.filter((r) => r.flags.some((f) => f.code === 'IN-COVER') && !acknowledged(r.file, 'IN-COVER'));
  check('0 fixture points inside a CoverBox', inCover.length === 0,
    inCover.map((r) => `${r.file}:${r.line}  (${r.value})  ${r.flags.find((f) => f.code === 'IN-COVER').detail}`).join('\n         '));

  // §D — no fixture TABLE confined to one quadrant.
  // This is the arm that would have caught `valuescan` (18/0/0/0), `arena-scan`
  // (18/2/2/0) and `simfix` (18/0/0/0) in ONE run each, and it is the only arm that can:
  // every one of those coordinates was individually legal.
  console.log('\n§D — no fixture table confined to a single quadrant of the map');
  const byFile = new Map();
  for (const r of shippedPos) {
    if (!byFile.has(r.file)) byFile.set(r.file, []);
    byFile.get(r.file).push(r);
  }
  const tablesJudged = [...byFile].filter(([, l]) => l.length >= 5);
  check('there are multi-station files to judge coverage on', tablesJudged.length >= 3, `${tablesJudged.length} files`);
  const oneQuad = [];
  for (const [file, list] of tablesJudged) {
    const q = { NW: 0, NE: 0, SW: 0, SE: 0 };
    for (const r of list) q[quadrant(arena, r.value[0], r.value[1])]++;
    const empty = Object.values(q).filter((n) => n === 0).length;
    if (empty >= 3 && !acknowledged(file, 'ONE-QUADRANT')) oneQuad.push(`${file}  ${JSON.stringify(q)}`);
  }
  check('0 files with ≥5 stations all in one quadrant', oneQuad.length === 0, oneQuad.join('\n         '));

  /**
   * §M — THE PRICE OF MASKING MARKDOWN, PAID RATHER THAN POCKETED.
   *
   * §A/§B/§C judge `code` and markdown is now entirely `prose`, so without this arm the fix
   * to `commentMask` would have bought a green run by **blinding the guard to every `.md` in
   * the repo** — the same defect wearing the opposite sign, and a worse one, because a doc is
   * what the next agent copies a coordinate OUT of.
   *
   * The arm: a flagged literal in a documentation file must be **adjudicated**, i.e. appear
   * on `ACK` under its own code. That is the one signal available. ⚠️ It is emphatically NOT
   * "the literal is inside backticks" or "the sentence is past tense": both were considered
   * and neither survives contact — `docs/LESSONS.md:1028`'s deliberate quote and a stale doc
   * coordinate look **identical** by either test, since this project's house style is to keep
   * old values beside new ones on purpose. A guard that guesses here cries wolf, and a guard
   * that cries wolf gets switched off.
   *
   * 🚨 **The implementation that FAILS this arm is the obvious fix**: mask markdown as prose
   * and stop. §KB-M plants `match-play`'s arena object in a `.md` that nobody has
   * acknowledged, proves the mask hides it from §A/§B, and requires §M to catch it anyway.
   */
  console.log('\n§M — a 1× literal in a DOCUMENT is counted by the arms above and adjudicated here');
  const mdUnack = [];
  for (const r of docHits) {
    for (const f of r.flags) {
      if (!acknowledged(r.file, f.code)) mdUnack.push(`${r.file}:${r.line}  [${f.code}] ${f.detail}\n           ${r.text.slice(0, 120)}`);
    }
  }
  check('0 unacknowledged 1× literals in markdown (add an ACK entry with the reason, or fix the doc)',
    mdUnack.length === 0, mdUnack.join('\n         '));

  // §E — the guard's own budget. The acknowledgement list may shrink, never grow silently.
  console.log('\n§E — the acknowledgement list is a shrinking budget, not a dumping ground');
  check(`ACK holds ≤ ${ACK_BUDGET} entries (today ${ACK.length})`, ACK.length <= ACK_BUDGET, `${ACK.length}`);
  check('every ACK entry carries a reason', ACK.every((a) => a.why && a.why.length > 30));
  // An acknowledgement for a file that no longer produces the hit is dead weight, and a
  // dead ACK entry is how a real defect gets waved through later under an old excuse.
  // ⚠️ `docHits` is in this union and MUST be: markdown moved out of `code` when it became
  // prose, so reading `code` alone would have reported both `docs/LESSONS.md` entries as
  // dead the moment they were added — a guard failing on its own new coverage. This is the
  // §E half of the §M change and the two only make sense together.
  const live = new Set([...code, ...docHits].flatMap((r) => r.flags.map((f) => `${r.file}:${f.code}`)));
  const dead = ACK.filter((a) => !live.has(`${a.file}:${a.code}`)).map((a) => `${a.file}:${a.code}`);
  check('0 ACK entries that no longer match anything (they would hide a future defect)',
    dead.length === 0, dead.join(', '));

  // §F — the arena dump this guard reads is itself current. Asserted in `loadArena`,
  // restated here so a reader sees it was checked rather than assumed.
  console.log('\n§F — the guard\'s own input');
  check('tools/arena.gameplay.json agrees with src/arena/shared.ts on ARENA_W/H',
    arena.w > 0 && arena.h > 0, `${arena.w}×${arena.h}`);
  check('the 1× map and the shipped map are actually different (else every arm is vacuous)',
    arena.w !== MAP_1X.w || arena.h !== MAP_1X.h, `${arena.w}×${arena.h} vs ${MAP_1X.w}×${MAP_1X.h}`);

  // §X — the retired ×4 opening ring, and the three files this guard exempts from itself.
  retiredArm(arena, rows);

  console.log(`\n${fail === 0 ? '✅ PASS' : '🔴 FAIL'}  al_guard: ${pass} passed, ${fail} failed\n`);
  return fail;
}

/**
 * ── §X — THE RETIRED ×4 OPENING RING ────────────────────────────────────────
 *
 * 🚨 **WHY THIS ARM EXISTS: TWO SENTENCES IN THIS FILE SET STATED A RETIRED `maxSafeRadius`
 * AS FACT, AND NOTHING IN THE REPO COULD SEE THEM.** `al_lib:is1xScalar` said
 * `fogOpeningRadiusFor` *"now derives 1792"* (it derives the half-diagonal; 1792 is the DEAD
 * formula's output) and this file said the dump *"says 1985"* (`56aa864` refreshed it). Asked
 * "what assertion would have caught this?", the answer was **none**, for two structural
 * reasons that are worth naming because neither is a bug in the checkers:
 *
 *   1. `al_lib.scanFiles` drops `al_lib`/`al_sweep`/`al_guard` WHOLESALE — they describe the
 *      1× map on purpose — so the guard is blind to itself by construction, and both
 *      falsehoods landed inside that exemption.
 *   2. `rc_prose` is the gate for *"prose that states a superseded constant as fact"*, and its
 *      corpus is **four hand-listed `src/` files** (`AUDIT`). It reads nothing under `tools/`.
 *
 * ⚠️ **AND THE CATALOGUE ITSELF WAS HALF-EMPTY.** `is1xScalar` knows 850/890/993 — the 1×
 * map's retired rings — and nothing about the ×4 map's, so a file holding **1985** is invisible
 * to every arm. Measured 2026-08-12 over `scanFiles()`: **24 radius-role hits in 14 files**,
 * three of them a `const MAX_SAFE_RADIUS = 1985` that other code computes from
 * (`simfix`, `sc_fogstill`, `valuescan`), while `tools/arena-scan.mjs:409` — the file all three
 * name as their source — has already been re-derived.
 *
 * ── WHY IT IS HARD ON THREE FILES AND A PRINTED CENSUS ON THE REST ──────────
 * Wiring `isRetiredX4Scalar` into `classify` would fail this gate on ~24 hits in peer-owned
 * files. That is the permanently-red-gate failure the ACK block above was written to remove:
 * a gate that is red for somebody else's file gets switched off, and then it guards nothing.
 * So the assertion binds where this file set is the owner, and the rest is ROUTED, printed
 * with file and line so the routing is actionable rather than a number.
 *
 * ⚠️ **A PRINTED CENSUS IS NOT A GUARD** (`sp_gate --endgame` was report-only and stayed false
 * straight through the commit that falsified it). So the census does not stand alone: X3 fires
 * the detector at a PLANTED known-bad through the same code path, so the census reading zero
 * can never be confused with the detector having stopped working.
 *
 * ── 🚨 WHAT THIS ARM DOES **NOT** COVER, MEASURED RATHER THAN ASSUMED ───────
 * The whole arm was proved both ways by planting into the real `al_lib.mjs` and requiring a
 * red run (exit 1), then restoring. **Two lines were planted and only ONE was caught:**
 *
 *   caught   a commented-out `const MAX_SAFE_RADIUS = <a MAXR_RETIRED_X4 value>;`
 *                                                          → X2 red, al_guard exit 1
 *   MISSED   the prose sentence *"`fogOpeningRadiusFor` now derives <the dead formula's
 *            output>, which `ax_layout --selftest` reports as a gap against the dump"*
 *                                                          → nothing fired
 *
 * ⚠️ **AND NOTE HOW THIS BLOCK IS WRITTEN.** The first draft of it quoted the planted line
 * verbatim, X2 went red on it, and that is the arm being right: **inside these three files a
 * retired ring may not appear in a syntactic role even inside a quotation.** There is no
 * blockquote exemption here, deliberately — `rc_prose` needs one because it scans files whose
 * job is something else, whereas these three exist to HOLD the catalogue, and the catalogue is
 * `MAXR_RETIRED_X4`. Name the symbol; an exemption is a way to buy green.
 *
 * The missed line **is the exact sentence this pass was dispatched to fix.** `extract` works
 * by SYNTACTIC ROLE — a named constant, a `fog:` column, a `?fogRadius=` param — and free
 * prose has no role, so §X sees a retired ring only where something could compute from it.
 * That half matters most (it is how `simfix`/`sc_fogstill`/`valuescan` came to hold a
 * `const MAX_SAFE_RADIUS` that is 264.5 wu wrong) and it is the half this arm binds.
 *
 * **The prose half is `rc_prose`'s subject and it is not pointed here.** That tool already
 * solves the hard part — a superseded figure is legal if it sits on a `>` blockquote line, so
 * the house rule about keeping old wording is not banned — but its corpus is four hand-listed
 * `src/` files (`AUDIT`) and it reads nothing under `tools/`. Widening it is a `rc_prose.mjs`
 * change and is ROUTED, not attempted here. ⚠️ **Do not "fix" that by scanning these three
 * files for a bare `1985`**: they discuss retired values as data on purpose, `gatecount`
 * priced the identical widening at **16 false positives for 1 true one** on the real
 * documents, and a guard that cries wolf gets switched off.
 */
function retiredArm(arena, rows) {
  console.log('\n§X — the RETIRED ×4 opening ring (al_lib:MAXR_RETIRED_X4), and the files this guard exempts from itself');

  // X0 — non-emptiness FIRST. Everything below filters, and a filter over an empty set passes.
  const scanned = new Set(scanFiles());
  const missing = SELF_EXCLUDED.filter((f) => !fs.existsSync(path.join(ROOT, f)));
  check('X0  the three self-excluded files all exist and are all genuinely OUT of the corpus '
    + '(if one drifts back in, §A fails on its 1× data and this arm is double-counting)',
  missing.length === 0 && SELF_EXCLUDED.every((f) => !scanned.has(f)),
  `missing=[${missing.join(',')}] inCorpus=[${SELF_EXCLUDED.filter((f) => scanned.has(f)).join(',')}]`);

  const selfRows = [];
  for (const rel of SELF_EXCLUDED) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const h of extract(rel, text)) selfRows.push(h);
  }
  check('X1  the extractor actually reaches those three files (else X2 is vacuous)',
    selfRows.length > 10, `${selfRows.length} candidates`);

  // X2 — the hard assertion. THIS file set's own files may not carry a retired ×4 ring in a
  // syntactic role — code or comment, since a commented-out constant is still copied. ⚠️ NOT
  // free prose: see the "what this does not cover" block in the header, which is measured.
  const selfHits = selfRows.filter((h) => isRetiredX4Scalar(h.role, h.value));
  check('X2  0 retired ×4 opening rings in a SYNTACTIC ROLE in the self-excluded files '
    + '(code or comment; free prose is rc_prose\'s and is not pointed here)',
  selfHits.length === 0,
    selfHits.map((h) => `${h.file}:${h.line} [${h.value}] ${h.text.slice(0, 90)}`).join('\n         '));

  // X3 — the detector, on a planted known-bad, through the same path X2 uses. Without this,
  // "0 hits" and "the detector is broken" are the same reading.
  const plantBad = extract('tools/tmp/al_lib.mjs',
    `// __matchArena\nconst MAX_SAFE_RADIUS = ${MAXR_RETIRED_X4[0]};\n`)
    .filter((h) => isRetiredX4Scalar(h.role, h.value));
  const plantGood = extract('tools/tmp/al_lib.mjs',
    `// __matchArena\nconst MAX_SAFE_RADIUS = loadArena().maxSafeRadius;\n`)
    .filter((h) => isRetiredX4Scalar(h.role, h.value));
  check('X3  KNOWN-BAD  a planted `const MAX_SAFE_RADIUS = <retired>` IS flagged by the same '
    + 'detector X2 runs — so a clean X2 is a measurement, not a dead code path',
  plantBad.length === 1, `${plantBad.length} hits`);
  check('X3b CONTROL  the derived form of the same line is flagged by nothing',
    plantGood.length === 0, `${plantGood.length} hits`);

  // X4 — the catalogue is about a value that is actually retired. If someone ever sets the
  // opening ring BACK to one of these, this arm would be condemning the shipped answer.
  check('X4  every retired value really is retired — none of them is the dumped maxSafeRadius',
    !MAXR_RETIRED_X4.includes(arena.maxSafeRadius)
      && !MAXR_RETIRED_X4.some((v) => MAXR_1X.includes(v)),
    `dump ${arena.maxSafeRadius} vs [${MAXR_RETIRED_X4.join(', ')}]`);

  // ── the ROUTED census over everything else. Printed, never failed — see the header. ──
  const routed = rows.filter((h) => isRetiredX4Scalar(h.role, h.value));
  const byFile = new Map();
  for (const h of routed) byFile.set(h.file, (byFile.get(h.file) ?? 0) + 1);
  console.log(`  ROUTED (printed, not failed — peer-owned files): ${routed.length} retired-ring `
    + `hits in ${byFile.size} files`);
  for (const h of routed) {
    console.log(`         ${h.file}:${h.line} [${h.value}]${h.inComment ? ' (comment)' : ''}  ${h.text.slice(0, 88)}`);
  }
}

// ── the selftest: every arm proved against a known-bad ──────────────────────

/**
 * 🚨 A GUARD THAT HAS NOT BEEN SHOWN TO FAIL ON THE BUG IT GUARDS AGAINST IS NOT A GUARD.
 *
 * Each case below is a REAL defect from this repo's history, fed to the same `extract` +
 * `classify` the gate uses, with the arm it must trip. ⚠️ And each is paired with a
 * CONTROL — the fixed version of the same text — which must NOT trip, because an arm that
 * fires on everything is as useless as one that fires on nothing. Seven controls in one
 * session here could not distinguish their own two arms; that is what the pairing is for.
 */
function selftest() {
  const arena = loadArena();
  const ctx = { shipped: true };
  const codes = (rel, text) => {
    const out = new Set();
    for (const h of extract(rel, text)) for (const f of classify(arena, h, ctx)) out.add(f.code);
    return out;
  };

  /**
   * 🚨 **THE FIXTURE RADIUS IS INTERPOLATED FROM THE DUMP, AND IT USED TO BE THE LITERAL
   * `1985`.** Seven of the strings below carried it — including the CONTROL on the very case
   * named *"`MAX_SAFE_RADIUS = 993`, the newest of the three 1× values"*, whose "fixed form"
   * was therefore **the next generation's fossil**: `6d5c4d6` retired 1985 the same way 45 s
   * retired 993, and because `is1xScalar` only knows the 1× values the control went on
   * passing while endorsing a stale number. That is this file's own subject matter, inside
   * this file's own controls, and §X is what found it.
   *
   * ⚠️ Interpolating is not cosmetic and it is not the same as picking a newer literal: the
   * fixture is TEXT handed to the extractor, never code anyone ships, so the only thing a
   * literal can do here is age. `RADIUS` is what the dump says today, whatever that is.
   * ⚠️ Where the fixture is about a POSITION rather than a scalar, the radius is incidental
   * and the row's `expect` does not mention it — but a fossil in an incidental slot is still
   * a fossil the next agent copies, which is exactly how three of the 24 routed hits below
   * became a `const MAX_SAFE_RADIUS` that other code computes from.
   */
  const RADIUS = arena.maxSafeRadius;

  const CASES = [
    { name: 'match-play\'s ARENA literal (the 1× size, centre AND maxR in one object)',
      bad: 'const ARENA = { w: 1400, h: 1000, cx: 700, cy: 500, maxR: 890 };',
      good: 'const ARENA = await readArena(page);',
      expect: ['1X-PAIR', '1X-SCALAR'] },
    { name: 'fogRing\'s FIELD_OUTER_UNITS = 1500 (justified by the 1× half-diagonal)',
      bad: 'const FIELD_OUTER_RADIUS = 1500;',
      good: 'const FIELD_OUTER_RADIUS = ARENA_HALF_DIAGONAL * 1.15;',
      expect: ['1X-SCALAR'] },
    { name: 'sc_fogstill\'s MAX_SAFE_RADIUS = 993 — the NEWEST of the three 1× values',
      bad: 'const MAX_SAFE_RADIUS = 993;',
      good: `const MAX_SAFE_RADIUS = ${RADIUS};`,
      expect: ['1X-SCALAR'] },
    { name: 'limbmatch\'s object-form station table, pot_south inside a prep_counter',
      bad: `const STATIONS = {\n  pot_south: { x: 700, y: 640, fog: ${RADIUS} },\n};`,
      good: `const STATIONS = {\n  pot_south: { x: 1400, y: 1200, fog: ${RADIUS} },\n};`,
      expect: ['IN-COVER'] },
    { name: 'arena-scan/valuescan\'s array-of-objects table, west_lane inside a freezer',
      bad: `const STATIONS = [\n  { id: 'west_lane', x: 340, y: 500, fog: ${RADIUS} },\n];`,
      good: `const STATIONS = [\n  { id: 'west_lane', x: 600, y: 1000, fog: ${RADIUS} },\n];`,
      expect: ['IN-COVER'] },
    { name: 'simfix\'s positional-tuple table',
      bad: 'const STATIONS = [\n  [\'west_lane\', 340, 500, 890],\n];',
      good: `const STATIONS = [\n  ['west_lane', 600, 1000, ${RADIUS}],\n];`,
      expect: ['IN-COVER', '1X-SCALAR'] },
    { name: 'a probe URL teleporting the fighter into a prop',
      bad: `await p.goto(\`\${BASE}/?player=hamburger&px=340&py=500&fogRadius=${RADIUS}\`);`,
      good: `await p.goto(\`\${BASE}/?player=hamburger&px=600&py=1000&fogRadius=${RADIUS}\`);`,
      expect: ['IN-COVER'] },
    // ⚠️ THE CONTROL HERE WAS WRONG ON THE FIRST RUN AND THE SELFTEST SAID SO. It was
    // `const CENTER = { x: 1400, y: 1000 };` — the *correct* answer — and it tripped
    // `IN-COVER`, because `boiling_pot` is centred on the arena centre by design. The
    // right control is not "a better literal", it is **no literal at all**: reading the
    // centre live is exactly the fix `np_nfighter` took (DECISIONS §65, *"centre is now
    // read live and `resolveCenter` throws rather than defaulting"*).
    { name: 'h49_chips / np_nfighter\'s measuring ring centred on the 1× centre',
      bad: 'const CENTER = { x: 700, y: 500 };',
      good: 'const CENTER = ARENA_DUMP.center;',
      expect: ['IN-COVER'] },
    { name: 'a fixture point off the map entirely',
      bad: 'const PIN = { x: 3400, y: 500 };',
      good: 'const PIN = { x: 2400, y: 500 };',
      expect: ['OOB'] },
  ];

  console.log('§KB — every arm, against the real defect it exists for, and its fixed CONTROL\n');
  check('there are known-bad cases to run (an empty case list passes vacuously)', CASES.length >= 8, `${CASES.length}`);
  for (const c of CASES) {
    const got = codes('tools/tmp/kb_fixture.mjs', `// __matchArena\n${c.bad}\n`);
    const gotGood = codes('tools/tmp/kb_fixture.mjs', `// __matchArena\n${c.good}\n`);
    check(`KNOWN-BAD  ${c.name}`, c.expect.every((e) => got.has(e)),
      `expected ${c.expect.join('+')}, got ${[...got].join(',') || '(nothing)'}`);
    check(`  CONTROL  the fixed form of the same line trips nothing`, gotGood.size === 0,
      `got ${[...gotGood].join(',')}`);
  }

  // The quadrant arm cannot be exercised by a one-line fixture, so it gets its own.
  console.log('\n§KB-D — the one-quadrant arm, which is the only one that can see a table of individually-LEGAL points\n');
  const mk = (pts) => `// __matchArena\nconst STATIONS = [\n${pts.map(([x, y], i) => `  ['s${i}', ${x}, ${y}, ${RADIUS}],`).join('\n')}\n];`;
  const quadOf = (text) => {
    const q = { NW: 0, NE: 0, SW: 0, SE: 0 };
    const hs = extract('tools/tmp/kb_fixture.mjs', text).filter((h) => h.role === 'pos');
    for (const h of hs) q[quadrant(arena, h.value[0], h.value[1])]++;
    return { q, n: hs.length };
  };
  const badQ = quadOf(mk([[300, 200], [400, 300], [500, 400], [600, 500], [700, 600], [800, 700]]));
  check('the known-bad table was extracted at all (6 rows)', badQ.n === 6, `${badQ.n}`);
  check('KNOWN-BAD  six individually-LEGAL points that are all NW → 3 empty quadrants',
    Object.values(badQ.q).filter((n) => n === 0).length === 3, JSON.stringify(badQ.q));
  const goodQ = quadOf(mk([[300, 810], [600, 1000], [1140, 940], [2200, 500], [2240, 1600], [1400, 1450]]));
  check('CONTROL  the migrated table covers all four', goodQ.n === 6
    && Object.values(goodQ.q).every((n) => n > 0), JSON.stringify(goodQ.q));

  /**
   * §KB-M — THE ARM THAT STOPS THE MARKDOWN FIX FROM BEING A BLINDFOLD.
   *
   * `al_lib.commentMask` masks `.md` end to end, which takes every documentation hit out of
   * `code` and therefore out of §A/§B/§C. **Name the implementation that fails this arm:**
   * the one-line version of that fix — mask markdown, stop there, enjoy the green run. It
   * passes every other check in this file and silently stops guarding 11 tracked documents.
   *
   * So the fixture below is `match-play`'s real arena object planted in a `.md` that nobody
   * has adjudicated, and it is asserted THREE ways, because any one alone is satisfiable by
   * a wrong implementation:
   *   M1  the same text in a `.mjs` still trips §A/§B — so the fixture is genuinely defective
   *       and M2 is not passing because the extractor stopped working.
   *   M2  in a `.md` it is masked, i.e. §A/§B really are blind to it — the loss is real.
   *   M3  §M catches it anyway, because `docs/kb_fixture.md` is on no ACK entry.
   *   M4  CONTROL: the identical text in an ACKNOWLEDGED document does NOT trip §M — an arm
   *       that fires on everything is as useless as one that fires on nothing, and without
   *       this the ACK lookup could be ignored entirely and M3 would still pass.
   */
  console.log('\n§KB-M — the markdown arm: masking `.md` must not be a way of buying a green run\n');
  const MD_BAD = 'const ARENA = { w: 1400, h: 1000, cx: 700, cy: 500, maxR: 890 };';
  const mdFlags = (rel) => extract(rel, `// __matchArena\n${MD_BAD}\n`)
    .flatMap((h) => classify(arena, h, ctx).map((f) => ({ rel, code: f.code, inComment: h.inComment })));
  const asCode = mdFlags('tools/tmp/kb_fixture.mjs');
  const asDoc = mdFlags('docs/kb_fixture.md');
  check('M1  POSITIVE CONTROL  the same literal in a `.mjs` is still a §A/§B hit in CODE — so the '
    + 'fixture really is defective and M2 is not passing by extractor failure',
  asCode.length >= 2 && asCode.every((f) => !f.inComment), JSON.stringify(asCode.map((f) => f.code)));
  check('M2  the `.md` form is MASKED as prose — §A/§B/§C genuinely cannot see it, which is the '
    + 'coverage §M has to replace',
  asDoc.length >= 2 && asDoc.every((f) => f.inComment), JSON.stringify(asDoc.map((f) => f.code)));
  check('M3  KNOWN-BAD  §M catches it anyway: an UNACKNOWLEDGED document carrying a 1× literal',
    asDoc.some((f) => !acknowledged(f.rel, f.code)), `${asDoc.filter((f) => !acknowledged(f.rel, f.code)).length} unadjudicated`);
  const asAckedDoc = mdFlags('docs/LESSONS.md');
  check('M4  CONTROL  the identical text in an ACKNOWLEDGED document trips nothing — §M consults '
    + 'ACK rather than failing on every document it sees',
  asAckedDoc.length >= 2 && asAckedDoc.every((f) => acknowledged(f.rel, f.code)),
  JSON.stringify(asAckedDoc.map((f) => `${f.code}:${acknowledged(f.rel, f.code)}`)));

  // And the negative control the whole design rests on: legality alone is BLIND here.
  const legal = coverAt(arena, 700, 600);
  check('CONTROL  a 1× point can be perfectly legal ground on the ×4 map — which is WHY '
    + '"is it legal?" was never going to find this class', legal === null, `coverAt(700,600) = ${legal?.kind ?? 'null'}`);
  // The fact behind the two `IN-COVER` acknowledgements, asserted rather than asserted-in-prose.
  const potAtCentre = coverAt(arena, arena.cx, arena.cy);
  check('CONTROL  the arena CENTRE is inside `boiling_pot` by design — the reason two ACK '
    + 'entries exist, checked rather than claimed', potAtCentre?.kind === 'boiling_pot',
  `coverAt(${arena.cx},${arena.cy}) = ${potAtCentre?.kind ?? 'null'}`);

  console.log(`\n${fail === 0 ? '✅ PASS' : '🔴 FAIL'}  al_guard --selftest: ${pass} passed, ${fail} failed\n`);
  return fail;
}

if (IS_MAIN) {
  const f = process.argv.includes('--selftest') ? selftest() : run();
  process.exitCode = f ? 1 : 0;
}
