#!/usr/bin/env node
/**
 * CLOCK-LITERAL GUARD — `al_guard` for the stale-TIME class.
 *
 * ── Why a sibling of `al_guard` and not a row inside it ─────────────────────
 *
 * `al_guard` exists because `6631446` doubled `ARENA_W/H` and every literal COPY of the
 * old geometry began describing a map that does not exist — invisibly, because **the 1×
 * playfield is exactly the NW quadrant of the ×4 one, so every stale coordinate stayed a
 * LEGAL coordinate.** Eleven were found one at a time by accident; a sweep then found
 * twelve more.
 *
 * `MATCH_DURATION_MS` and `SUDDEN_DEATH_MS` are about to move the same way (45 s → 150 s,
 * 30 s → 135 s). A stale TIME literal is worse than a stale coordinate for the identical
 * reason and one more:
 *
 *   * **"Is this a legal value?" cannot see it.** 45 000 is a perfectly legal number of
 *     milliseconds on a 150 s clock, exactly as (700,500) was a legal point on the ×4 map.
 *   * **A stale coordinate is at least still ON the map. A stale clock is a WRONG UNIT.**
 *     `progress = 1 − timeRemaining / 45000` on a 150 s match is not "slightly off"; it
 *     runs 3.33× fast and every radius, timestamp and percentage derived from it inherits
 *     the factor. Nothing type-checks a millisecond.
 *
 * 🚨 **AND `gatecount` CANNOT SEE THIS CLASS EITHER** — it checks that a gate's count
 * matches its documented count, and a gate whose whole model of the schedule is stale
 * keeps its count perfectly. `tools/tmp/lu2_qafog.mjs` is the proof: it declares its own
 * `MATCH_DURATION_MS`/`SUDDEN_DEATH_REMAINING_MS`/`MAX_SAFE_RADIUS`, derives all nine of
 * its assertions from those three, and is therefore **self-consistent and unfalsifiable**.
 * After the clock moves it will still print 9/9 while every number in it is fiction.
 *
 * ── The four arms, and what implementation would fail each ──────────────────
 *
 *   §A  REPLICA CONSTANTS — 33 files declare their own `const MATCH_DURATION_MS = …` /
 *       `FOG_FIRST_CONTACT_MS = 6000` / `MAX_SAFE_RADIUS = 1985`. Each must equal the
 *       live one. FAILS ON: any file whose copy did not follow `rules.ts`/`shared.ts`.
 *   §B  RATIO LITERALS — `arena-scan.mjs`'s `MAX_SAFE_RADIUS * (15000 / 45000)` and
 *       `cv_sheet.mjs`'s `1 - 6000 / 45000` re-type the schedule as a fraction. FAILS ON:
 *       a denominator that is not today's `MATCH_DURATION_MS`, or a numerator that is not
 *       today's `SUDDEN_DEATH_REMAINING_MS` / `FOG_FIRST_CONTACT_S × 1000`.
 *   §C  THE REACHABLE FOG BAND — every literal `?fogRadius=n` in the tree must be a radius
 *       a match actually holds, computed from the LIVE constants:
 *       `n > max(minSafeRadiusFor(2), maxR × SUDDEN_DEATH_REMAINING_MS / MATCH_DURATION_MS)`.
 *       Below it, `match.ts:applyQaSetup` snaps to sudden death **with a console warning
 *       and no error** — the station does not fail, it silently photographs a different
 *       frame. FAILS ON: `fogRadius=400`, which is what `arena-scan`'s `fog_late` shipped.
 *   §D  THE SCHEDULE SHAPE — `applyQaSetup` inverts `applyWorldTick`'s ring formula by
 *       hand (`timeRemaining = MATCH_DURATION_MS × wantR/maxR`). That inversion is the
 *       single point through which **every `?fogRadius=` station in the repo** depends on
 *       the schedule being LINEAR IN TIME. Uri's new schedule opens with a ~25 s HOLD, and
 *       a hold is **not invertible** — every t in [0, 25 s] has the same radius. FAILS ON:
 *       either formula changing shape, which is exactly what the hold requires.
 *
 * ── Deliberately frozen numbers are NOT defects ─────────────────────────────
 * `rules.ts:193`'s `MAX_SAFE_RADIUS = 545` documents itself as *"HISTORICAL RECORD…
 * Nothing imports this"*. §E's ACK list carries it with that reason and asserts the entry
 * is still LIVE, so if it ever acquires a consumer the acknowledgement goes dead and says so.
 *
 * ── Use ─────────────────────────────────────────────────────────────────────
 *   node tools/tmp/lit_clockguard.mjs            # the gate: exit 1 on any unacknowledged hit
 *   node tools/tmp/lit_clockguard.mjs --selftest # every arm proved against a known-bad + control
 *   node tools/tmp/lit_clockguard.mjs --census   # the readable enumeration behind it
 *
 * Offline, no browser, ~2 s (one esbuild bundle). Reads only tracked files.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
/**
 * ⚠️ `realpathSync` IS LOAD-BEARING, AND ITS ABSENCE COST THIS FILE A SILENT PASS.
 *
 * The first version compared `pathToFileURL(resolve(argv[1]))` against `import.meta.url`,
 * which is `rc_prose.mjs`'s shape. Run from a detached worktree at `/tmp/fa-lit-<sha>` on
 * macOS that is **false** — `/tmp` is a symlink to `/private/tmp`, so `argv[1]` keeps the
 * symlink and `import.meta.url` does not. The gate printed **nothing at all and exited 0**:
 * the single worst failure mode an instrument has, because it is indistinguishable from a
 * pass in a log. CLAUDE.md rule 8's clean-tree recipe puts every worktree under `/tmp`, so
 * this affects any gate run the documented way.
 */
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(realpathSync(resolve(process.argv[1]))).href === pathToFileURL(realpathSync(fileURLToPath(import.meta.url))).href;
const argv = process.argv.slice(2);

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   - ${name}`); }
  else { fail++; console.log(`  FAIL - ${name}${detail ? `\n         ${detail}` : ''}`); }
  return !!ok;
};

// ─────────────────────────────────────────────────────────────────────────────
// THE TRUTH COMES FROM THE SOURCE. No expected number is written down in this file,
// for the reason `gatecount` enforces on the docs: today's agreeing copy is next
// month's stale one. (`rc_prose.mjs`'s esbuild bridge, reused.)
// ─────────────────────────────────────────────────────────────────────────────
export function loadConstants() {
  const dir = mkdtempSync(join(tmpdir(), 'lit-clock-'));
  const entry = join(dir, 'entry.mjs');
  writeFileSync(entry, [
    'export { MATCH_DURATION_MS, SUDDEN_DEATH_MS, SUDDEN_DEATH_REMAINING_MS, MIN_SAFE_RADIUS,'
    + ` minSafeRadiusFor } from ${JSON.stringify(join(ROOT, 'src/game/rules.ts'))};`,
    'export { MAX_SAFE_RADIUS, FOG_FIRST_CONTACT_S, ARENA_W, ARENA_H, ARENA_HALF_DIAGONAL }'
    + ` from ${JSON.stringify(join(ROOT, 'src/arena/shared.ts'))};`,
  ].join('\n'));
  const out = join(dir, 'bridge.mjs');
  execFileSync(join(ROOT, 'node_modules/.bin/esbuild'), [
    entry, '--bundle', '--format=esm', '--platform=node', '--log-level=error', `--outfile=${out}`,
  ], { stdio: 'inherit' });
  return { dir, out };
}

/** Everything the arms judge against, in one object so the selftest can substitute it. */
export function scheduleOf(K) {
  const lowestScheduled = Math.max(
    K.minSafeRadiusFor(2),
    K.MAX_SAFE_RADIUS * (K.SUDDEN_DEATH_REMAINING_MS / K.MATCH_DURATION_MS),
  );
  return {
    MATCH_DURATION_MS: K.MATCH_DURATION_MS,
    SUDDEN_DEATH_MS: K.SUDDEN_DEATH_MS,
    SUDDEN_DEATH_REMAINING_MS: K.SUDDEN_DEATH_REMAINING_MS,
    MAX_SAFE_RADIUS: K.MAX_SAFE_RADIUS,
    FOG_FIRST_CONTACT_S: K.FOG_FIRST_CONTACT_S,
    FOG_FIRST_CONTACT_MS: K.FOG_FIRST_CONTACT_S * 1000,
    lowestScheduled,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE ACKNOWLEDGEMENT LIST — deliberately frozen numbers, with the reason.
// 🚨 IT MAY ONLY SHRINK (§E pins the length). A frozen historical number reported as
// a defect wastes exactly the attention this guard exists to buy, and an ACK entry
// that no longer matches anything is how a real defect gets waved through later.
// ─────────────────────────────────────────────────────────────────────────────
const ACK = [
  { file: 'src/game/rules.ts', code: 'REPLICA', name: 'MAX_SAFE_RADIUS', why:
    'HISTORICAL RECORD and it says so on the line above: "Nothing imports this." 545 is the '
    + 'prototype\'s figure for its 900x600 arena and has had no consumer since 1400x1000. The '
    + 'LIVE opening radius is `arena/shared.ts`\'s derived export of the same name.' },
  { file: 'tools/tmp/lu2_qafog.mjs', code: 'FOG-SNAP', why:
    'this file\'s whole subject is the snap. Its `STATIONS` rows are PAIRS — `old` is the URL a '
    + 'tool shipped before the migration and IS navigated to, deliberately, so the report can '
    + 'show the old station landing in sudden death beside the new one landing in a ring. A '
    + 'guard that flagged these would be flagging the known-bad input that proves the guard.' },

  // ── REAL, LIVE, ROUTED — NOT fixed here, and the reason is OWNERSHIP, not doubt ──
  //
  // These two are genuine defects and they were ENUMERATED BY NAME fifteen days before this
  // guard existed. `game/match.ts:947`, inside the warning `applyQaSetup` prints:
  //
  //   > *"several shipped instruments ask for radii that no longer exist — `hudshot`
  //   >  (260/300), `hud_fogedge` (300), `hud_accept`'s danger station (300),
  //   >  **`kbdverdict` / `input_accept` (545)** and `arena-scan`'s colour-baseline
  //   >  stations (200/400/420) all predate `DECISIONS §2`."*
  //
  // Every other tool on that list was migrated. These two were not, and **nothing went red
  // for fifteen days** — which is the entire thesis of this file: `input_accept` is a
  // registered gate and its documented count is unaffected by the frame it photographs.
  // They are ACKNOWLEDGED rather than fixed because they belong to another agent's file set
  // (`CLAUDE.md` rule 9), and the fix is executable, so the release valve does not cover it.
  { file: 'tools/tmp/input_accept.mjs', code: 'FOG-SNAP', why:
    'ROUTED, NOT FIXED: `?fogRadius=545` predates DECISIONS §2 and snaps to sudden death — the '
    + 'fighter is burning 50 HP/s while the keyboard suite measures it. Named in match.ts:947 and '
    + 'never migrated. Peer-owned file; reported to the orchestrator instead of edited.' },
  { file: 'tools/tmp/kbdverdict.mjs', code: 'FOG-SNAP', why:
    'ROUTED, NOT FIXED: same 545 as input_accept, at three sites, one of which is the reporter\'s '
    + 'verbatim URL and must NOT be changed at all — it is evidence. Named in match.ts:947. '
    + 'Peer-owned file; reported to the orchestrator instead of edited.' },
];
/** Recorded size of ACK. It may go DOWN freely; going UP is a deliberate, visible act. */
const ACK_BUDGET = 4;

// ─────────────────────────────────────────────────────────────────────────────
// THE CENSUS — pure functions over text, so every arm is provable on a fixture.
// ─────────────────────────────────────────────────────────────────────────────

/** Files this guard reads: tracked source under `src/` and `tools/`. */
export function corpus() {
  const out = spawnSync('git', ['-C', ROOT, 'ls-files', 'src', 'tools'], { encoding: 'utf8' });
  if (out.status !== 0) throw new Error(`git ls-files failed: ${out.stderr}`);
  return out.stdout.split('\n').filter((f) => /\.(ts|mts|mjs|js)$/.test(f));
}

/**
 * PER-CHARACTER COMMENT MASK.
 *
 * ⚠️ THE FIRST VERSION TESTED `/^\s*(\*|\/\/)/` ON THE LINE — the shape `al_guard` and
 * `rc_prose` both use — AND IT PRODUCED THREE FALSE POSITIVES ON ITS FIRST REAL RUN.
 * A block comment's CONTINUATION lines are not required to start with `*`, and
 * `hud_fogedge.mjs:54` is a prose sentence indented under `/* ── … ──` with no leading
 * marker at all. A guard whose first three hits are its own detector being wrong is a
 * guard that gets switched off, so the mask tracks `/* … *\/` state instead.
 *
 * 🚨 AND `//` INSIDE A URL IS NOT A COMMENT. `http://localhost:4321/?fogRadius=850` would
 * blind the arm to every station in a `page.goto` if `//` were taken literally — the exact
 * "a fix emptied the filtered set" vacuity this repo has recorded three times. A `//`
 * preceded by `:` is therefore a scheme separator, not a comment opener. `--selftest`
 * proves both halves.
 */
export function commentMask(text) {
  const mask = new Array(text.length).fill(false);
  let block = false;
  let line = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\n') { line = false; mask[i] = false; continue; }
    if (block) {
      mask[i] = true;
      if (c === '*' && text[i + 1] === '/') { mask[i + 1] = true; i++; block = false; }
      continue;
    }
    if (line) { mask[i] = true; continue; }
    if (c === '/' && text[i + 1] === '*') { block = true; mask[i] = true; mask[i + 1] = true; i++; continue; }
    if (c === '/' && text[i + 1] === '/' && text[i - 1] !== ':') { line = true; mask[i] = true; continue; }
    mask[i] = false;
  }
  return mask;
}

const SCHEDULE_NAMES = [
  'MATCH_DURATION_MS', 'SUDDEN_DEATH_MS', 'SUDDEN_DEATH_REMAINING_MS',
  'MAX_SAFE_RADIUS', 'FOG_FIRST_CONTACT_S', 'FOG_FIRST_CONTACT_MS',
];
const DECL_RE = new RegExp(
  String.raw`^\s*(?:export\s+)?const\s+(${SCHEDULE_NAMES.join('|')})\s*=\s*([\d_]+)\s*;`, 'gm',
);

/** §A — every file that re-declares a schedule constant as a bare number. */
export function replicaDecls(rel, text) {
  const rows = [];
  for (const m of text.matchAll(DECL_RE)) {
    const line = text.slice(0, m.index).split('\n').length;
    rows.push({ file: rel, line, name: m[1], value: Number(m[2].replace(/_/g, '')) });
  }
  return rows;
}

/**
 * §B — a numeric fraction of the clock, written out.
 *
 * Only pairs whose DENOMINATOR is a plausible whole-second millisecond duration
 * (>= 10 000 and a multiple of 1 000) are candidates; that keeps audio band edges,
 * pixel counts and price ladders out. Comment lines are extracted too, because
 * `arena-scan` states the same fraction in prose three lines above the code and both
 * go stale together — but §B only FAILS on code (see the note in the arm).
 */
const RATIO_RE = /(\d{3,6})\s*\/\s*(\d{4,7})\b/g;
export function ratioLiterals(rel, text) {
  const mask = commentMask(text);
  const rows = [];
  const starts = lineStarts(text);
  for (const m of text.matchAll(RATIO_RE)) {
    const num = Number(m[1]);
    const den = Number(m[2]);
    if (den < 10_000 || den % 1000 !== 0) continue;
    const { line, raw } = locate(text, starts, m.index);
    rows.push({ file: rel, line, num, den, text: raw.trim().slice(0, 110), inComment: mask[m.index] });
  }
  return rows;
}

/** §C — every literal `?fogRadius=<n>` a tool asks the app for. */
const FOG_RE = /fogRadius=(\d+)/g;
export function fogRequests(rel, text) {
  const mask = commentMask(text);
  const rows = [];
  const starts = lineStarts(text);
  for (const m of text.matchAll(FOG_RE)) {
    const { line, raw } = locate(text, starts, m.index);
    rows.push({
      file: rel, line, value: Number(m[1]),
      text: raw.trim().slice(0, 110), inComment: mask[m.index],
    });
  }
  return rows;
}

function lineStarts(text) {
  const out = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') out.push(i + 1);
  return out;
}
function locate(text, starts, index) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= index) lo = mid; else hi = mid - 1;
  }
  const end = text.indexOf('\n', starts[lo]);
  return { line: lo + 1, raw: text.slice(starts[lo], end === -1 ? text.length : end) };
}

/**
 * §D — the two halves of the ring schedule, as SHAPES.
 *
 * `sim.ts` maps time → radius; `match.ts:applyQaSetup` maps radius → time. They are
 * hand-written inverses of each other and nothing couples them. This arm asserts both
 * are still the LINEAR forms this guard knows how to reason about, so that the moment
 * either grows a hold, a knee or a step, the row goes red and a human re-derives the
 * inversion instead of ~50 capture stations silently photographing a different radius.
 */
export const SHAPE_SITES = [
  { file: 'src/game/sim.ts', label: 'forward: progress is linear in the clock',
    needle: 'const progress = 1 - state.timeRemaining / MATCH_DURATION_MS;' },
  { file: 'src/game/sim.ts', label: 'forward: radius is linear in progress',
    needle: 'state.arena.maxSafeRadius * (1 - progress)' },
  { file: 'src/game/match.ts', label: 'inverse: the QA fraction is radius/maxR',
    needle: 'clamp(wantR / maxR, 0, 1)' },
  { file: 'src/game/match.ts', label: 'inverse: the QA clock is that fraction of the duration',
    needle: 'this.state.timeRemaining = MATCH_DURATION_MS * frac;' },
];
export function shapeHolds(site, text) { return text.includes(site.needle); }

// ─────────────────────────────────────────────────────────────────────────────
// THE GATE
// ─────────────────────────────────────────────────────────────────────────────

function collect() {
  const files = corpus();
  const decls = [];
  const ratios = [];
  const fogs = [];
  for (const rel of files) {
    const text = readFileSync(join(ROOT, rel), 'utf8');
    decls.push(...replicaDecls(rel, text));
    ratios.push(...ratioLiterals(rel, text));
    fogs.push(...fogRequests(rel, text));
  }
  return { files, decls, ratios, fogs };
}

const acked = (file, code, name) => ACK.some((a) => a.file === file && a.code === code
  && (a.name === undefined || a.name === name));

function run(S, data) {
  const { files, decls, ratios, fogs } = data;
  console.log(`lit_clockguard — clock ${S.MATCH_DURATION_MS} ms · sudden death at ${S.SUDDEN_DEATH_MS} ms `
    + `(${S.SUDDEN_DEATH_REMAINING_MS} ms left) · opening ring ${S.MAX_SAFE_RADIUS} wu `
    + `· first contact ${S.FOG_FIRST_CONTACT_S} s · lowest scheduled fog ${S.lowestScheduled.toFixed(2)} wu`);
  console.log(`${files.length} tracked source files · ${decls.length} replica declarations · `
    + `${ratios.length} clock fractions · ${fogs.length} literal fogRadius requests\n`);

  // §S — THE INSTRUMENT ITSELF. Everything below FILTERS, and a filter over an empty set
  // passes vacuously — that trap fired three times in three files in one session here.
  console.log('§S — the guard can still SEE (a filter over an empty set passes)');
  check('the corpus is non-empty', files.length > 300, `${files.length} files`);
  check('replica declarations were extracted at all', decls.length >= 20, `${decls.length}`);
  check('clock fractions were extracted at all', ratios.length >= 2, `${ratios.length}`);
  check('literal fogRadius requests were extracted at all', fogs.length >= 30, `${fogs.length}`);
  check('the extractor still finds the four owning declarations',
    ['src/game/rules.ts', 'src/arena/shared.ts'].every((f) => decls.some((d) => d.file === f)),
    decls.filter((d) => d.file.startsWith('src/')).map((d) => `${d.file}:${d.name}`).join(' '));

  // §A — every replica of a schedule constant equals the live one.
  console.log('\n§A — no file carries its own, disagreeing copy of a schedule constant');
  const stale = decls.filter((d) => !acked(d.file, 'REPLICA', d.name)
    && d.file !== 'src/arena/shared.ts' && d.file !== 'src/game/rules.ts'
    && S[d.name] !== undefined && d.value !== S[d.name]);
  check(`0 replica constants disagree with rules.ts / shared.ts (${decls.length} judged)`,
    stale.length === 0,
    stale.map((d) => `${d.file}:${d.line}  ${d.name} = ${d.value}  (live ${S[d.name]})`).join('\n         '));
  // The two owning files are judged separately: rules.ts and shared.ts DEFINE these, so a
  // mismatch there is not "a stale copy", it is the constant itself moving.
  const owners = decls.filter((d) => (d.file === 'src/game/rules.ts' || d.file === 'src/arena/shared.ts')
    && !acked(d.file, 'REPLICA', d.name));
  check('the owning declarations are the ones the bridge loaded',
    owners.every((d) => S[d.name] === d.value),
    owners.map((d) => `${d.file}:${d.line} ${d.name}=${d.value} vs ${S[d.name]}`).join('  '));

  // §B — a fraction of the clock, written as two numbers.
  console.log('\n§B — no hand-written fraction of the clock disagrees with the clock');
  const badRatio = ratios.filter((r) => {
    if (r.den !== S.MATCH_DURATION_MS) return true;
    return r.num !== S.SUDDEN_DEATH_REMAINING_MS && r.num !== S.FOG_FIRST_CONTACT_MS;
  });
  const badCode = badRatio.filter((r) => !r.inComment);
  check(`0 code fractions whose denominator is not the clock or whose numerator is neither `
    + `SUDDEN_DEATH_REMAINING_MS (${S.SUDDEN_DEATH_REMAINING_MS}) nor FOG_FIRST_CONTACT (${S.FOG_FIRST_CONTACT_MS})`,
  badCode.length === 0,
  badCode.map((r) => `${r.file}:${r.line}  ${r.num}/${r.den}   ${r.text}`).join('\n         '));
  // 🚨 PROSE IS COUNTED, NEVER FAILED — the same design decision `al_guard` §A documents.
  // This project REQUIRES a reversed assertion to keep its old wording, so the superseded
  // fraction is SUPPOSED to still be in the file. The cost is real and is stated rather
  // than hidden: `arena-scan.mjs` states `15000/45000` in prose three lines above the code
  // and this arm would catch the code and not the sentence. `rc_prose.mjs` is the gate for
  // the sentence; it audits radii, not the clock, so that half is still uncovered — see
  // the report.
  console.log(`         (${badRatio.length - badCode.length} of ${ratios.length} fractions sit in COMMENTS `
    + '— counted, not failed; `rc_prose.mjs` owns prose)');

  // §C — every literal fog request is a radius a match actually holds.
  console.log('\n§C — every literal ?fogRadius= is inside the band the schedule reaches');
  // ⚠️ 0 is the CANONICAL way to ask for sudden death (`match.ts:950`), not a snap victim.
  // Above `maxSafeRadius` is safe too: `applyQaSetup` clamps DOWN to maxR, which is the
  // opening ring — the request degrades to "the widest ring there is". Only BELOW bites,
  // and it bites silently.
  const judged = fogs.filter((f) => !f.inComment && f.value !== 0);
  check('there are fog requests left to judge after filtering comments and the canonical 0',
    judged.length >= 20, `${judged.length} of ${fogs.length}`);
  const snapped = judged.filter((f) => f.value <= S.lowestScheduled && !acked(f.file, 'FOG-SNAP'));
  check(`0 live requests at or below ${S.lowestScheduled.toFixed(2)} wu (they snap to sudden death `
    + 'with a console warning and NO error)', snapped.length === 0,
  snapped.map((f) => `${f.file}:${f.line}  fogRadius=${f.value}   ${f.text}`).join('\n         '));

  // §D — the schedule shape the QA inversion assumes.
  console.log('\n§D — the ring schedule is still LINEAR, which is what applyQaSetup inverts');
  for (const site of SHAPE_SITES) {
    const text = readFileSync(join(ROOT, site.file), 'utf8');
    check(`${site.file} — ${site.label}`, shapeHolds(site, text),
      `expected to find: ${site.needle}`);
  }

  // §E — the acknowledgement budget.
  console.log('\n§E — the acknowledgement list is a shrinking budget, not a dumping ground');
  check(`ACK holds <= ${ACK_BUDGET} entries (today ${ACK.length})`, ACK.length <= ACK_BUDGET, `${ACK.length}`);
  check('every ACK entry carries a reason', ACK.every((a) => a.why && a.why.length > 30));
  const live = new Set([
    ...decls.map((d) => `${d.file}:REPLICA:${d.name}`),
    ...fogs.filter((f) => !f.inComment && f.value !== 0 && f.value <= S.lowestScheduled)
      .map((f) => `${f.file}:FOG-SNAP:undefined`),
  ]);
  const dead = ACK.filter((a) => !live.has(`${a.file}:${a.code}:${a.name}`)).map((a) => `${a.file}:${a.code}`);
  check('0 ACK entries that no longer match anything (they would hide a future defect)',
    dead.length === 0, dead.join(', '));

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  lit_clockguard: ${pass} passed, ${fail} failed\n`);
  return fail;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE CENSUS — the readable enumeration behind the gate.
// ─────────────────────────────────────────────────────────────────────────────
function census(S, { decls, ratios, fogs }) {
  const by = new Map();
  for (const d of decls) {
    if (!by.has(d.name)) by.set(d.name, []);
    by.get(d.name).push(d);
  }
  console.log('── REPLICA CONSTANTS ──');
  for (const [name, list] of [...by].sort()) {
    console.log(`  ${name}  live=${S[name] ?? '(not a schedule constant)'}  ${list.length} declarations`);
    for (const d of list) {
      const mark = acked(d.file, 'REPLICA', d.name) ? 'ACK ' : (S[name] !== undefined && d.value !== S[name] ? 'STALE' : 'ok  ');
      console.log(`    ${mark} ${d.file}:${d.line} = ${d.value}`);
    }
  }
  console.log('\n── CLOCK FRACTIONS ──');
  for (const r of ratios) console.log(`  ${r.inComment ? 'prose' : 'CODE '} ${r.file}:${r.line}  ${r.num}/${r.den}   ${r.text}`);
  console.log('\n── LITERAL fogRadius REQUESTS (live code only) ──');
  const live = fogs.filter((f) => !f.inComment);
  const hist = new Map();
  for (const f of live) hist.set(f.value, (hist.get(f.value) ?? 0) + 1);
  for (const [v, n] of [...hist].sort((a, b) => a[0] - b[0])) {
    const verdict = v === 0 ? 'canonical sudden death'
      : v <= S.lowestScheduled ? `SNAPS (<= ${S.lowestScheduled.toFixed(2)})`
        : v > S.MAX_SAFE_RADIUS ? `clamped down to maxR ${S.MAX_SAFE_RADIUS}`
          : `headroom ${(S.MATCH_DURATION_MS * (v / S.MAX_SAFE_RADIUS) - S.SUDDEN_DEATH_REMAINING_MS).toFixed(0)} ms of sim`;
    console.log(`  fogRadius=${String(v).padStart(5)}  x${String(n).padStart(3)}  ${verdict}`);
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE SELFTEST — every arm against the defect it exists for, each paired with a
// CONTROL. 🚨 A guard that has not been shown to FAIL on the bug it guards against is
// not a guard; an arm that fires on everything is as useless as one that fires on nothing.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uri's announced schedule, 2026-08-12, used ONLY as a hypothetical inside the selftest
 * so the arms can be shown to MOVE when the constants move. It is deliberately not an
 * expectation anywhere in the gate: when it lands, the bridge will read it from
 * `rules.ts` like everything else.
 *
 *   0:00 ── 25 s hold ── ring closes ── 120 s floor ── 135 s sudden death ── 150 s whistle
 */
const ANNOUNCED = { MATCH_DURATION_MS: 150_000, SUDDEN_DEATH_MS: 135_000 };

function selftest(S) {
  console.log('§KB — every arm, against the defect it exists for, and its CONTROL\n');

  // The post-change schedule, derived the same way the gate derives today's.
  const future = {
    ...S,
    ...ANNOUNCED,
    SUDDEN_DEATH_REMAINING_MS: ANNOUNCED.MATCH_DURATION_MS - ANNOUNCED.SUDDEN_DEATH_MS,
  };
  future.lowestScheduled = Math.max(140, future.MAX_SAFE_RADIUS
    * (future.SUDDEN_DEATH_REMAINING_MS / future.MATCH_DURATION_MS));

  // ── §A ────────────────────────────────────────────────────────────────────
  const declText = 'const MATCH_DURATION_MS = 45_000;\nconst FOG_FIRST_CONTACT_MS = 6000;\n';
  const got = replicaDecls('tools/tmp/kb_fixture.mjs', declText);
  check('KNOWN-BAD §A  a tool\'s own `MATCH_DURATION_MS = 45_000` is extracted with its value',
    got.length === 2 && got[0].name === 'MATCH_DURATION_MS' && got[0].value === 45_000,
    JSON.stringify(got));
  check('KNOWN-BAD §A  …and is STALE against the announced 150 s clock',
    got.some((d) => future[d.name] !== undefined && d.value !== future[d.name]),
    `45000 vs ${future.MATCH_DURATION_MS}`);
  check('  CONTROL §A  the same declaration is CLEAN against today\'s constants',
    got.every((d) => S[d.name] === undefined || d.value === S[d.name]),
    got.map((d) => `${d.name}=${d.value} vs ${S[d.name]}`).join(' '));
  // ⚠️ AND THE EXTRACTOR MUST NOT FIRE ON EVERYTHING: a same-named local that is not a
  // bare number, and an unrelated constant, must both be invisible to it.
  check('  CONTROL §A  a derived declaration and an unrelated constant are NOT extracted',
    replicaDecls('x.mjs', 'const MATCH_DURATION_MS = K.MATCH_DURATION_MS;\nconst FOG_TICK_MS = 300;\n').length === 0);

  // ── §B ────────────────────────────────────────────────────────────────────
  const ratioText = 'const LOWEST_SCHEDULED_FOG = MAX_SAFE_RADIUS * (15000 / 45000);\n';
  const rs = ratioLiterals('tools/tmp/kb_fixture.mjs', ratioText);
  check('KNOWN-BAD §B  `MAX_SAFE_RADIUS * (15000 / 45000)` is extracted as 15000/45000',
    rs.length === 1 && rs[0].num === 15000 && rs[0].den === 45000, JSON.stringify(rs));
  check('KNOWN-BAD §B  …and is STALE against the announced clock (denominator is not 150 000)',
    rs[0].den !== future.MATCH_DURATION_MS);
  check('  CONTROL §B  it is CLEAN today (15 000 left of a 45 000 ms match)',
    rs[0].den === S.MATCH_DURATION_MS && rs[0].num === S.SUDDEN_DEATH_REMAINING_MS);
  check('  CONTROL §B  an audio band edge and a price ladder are NOT extracted',
    ratioLiterals('x.mjs', 'const EB = [[2000, 6000], [6000, 16000]];\nconst p = 3200 / 900;\n').length === 0,
    JSON.stringify(ratioLiterals('x.mjs', 'const EB = [[2000, 6000], [6000, 16000]];\nconst p = 3200 / 900;\n')));

  // ── THE COMMENT MASK, which is §B's and §C's only filter ──────────────────
  // 🚨 THIS IS HERE BECAUSE IT WAS WRONG ON THE FIRST REAL RUN, AND A FILTER THAT IS
  // WRONG IN EITHER DIRECTION IS FATAL TO BOTH ARMS: too greedy and it EMPTIES the set
  // the assertion runs over (the `[].every()` vacuity, three times in one session here);
  // too shy and the arm's first three hits are its own false positives.
  const maskAt = (text, needle) => commentMask(text)[text.indexOf(needle)];
  check('KNOWN-BAD mask  a block-comment CONTINUATION line with no leading `*` is a comment '
    + '(hud_fogedge.mjs:54\'s shape — the first version missed it)',
  maskAt('/* ── THE DANGER STATION ──\n   It read `fogRadius=300` and was\n*/\n', 'fogRadius=300') === true);
  check('  CONTROL mask  `//` inside a URL is a scheme separator, NOT a comment — '
    + 'treating it as one would blind §C to every page.goto in the repo',
  maskAt('await p.goto(`http://localhost:4321/?fogRadius=850`);\n', 'fogRadius=850') === false);
  check('  CONTROL mask  a trailing `// …` after real code IS a comment, and the code before it is not',
    maskAt('const a = 1; // fogRadius=300\n', 'fogRadius=300') === true
      && maskAt('const a = 1; // note\n', 'const a') === false);

  // ── §C ────────────────────────────────────────────────────────────────────
  // The real defect: `arena-scan`'s `fog_late` shipped `fog: 400` and was silently
  // photographing a sudden-death wash instead of a nearly-closed ring.
  const fogText = 'await p.goto(`${BASE}/?px=740&py=1000&fogRadius=400`);\n'
    + 'await p.goto(`${BASE}/?px=740&py=1000&fogRadius=1985`);\n';
  const fr = fogRequests('tools/tmp/kb_fixture.mjs', fogText);
  check('KNOWN-BAD §C  both fog requests are extracted', fr.length === 2 && fr[0].value === 400);
  check('KNOWN-BAD §C  fog_late\'s pre-§2 400 wu is REFUSED today',
    fr[0].value <= S.lowestScheduled, `400 vs ${S.lowestScheduled.toFixed(2)}`);
  check('  CONTROL §C  the opening ring is ACCEPTED — the arm is not refusing the whole table',
    fr[1].value > S.lowestScheduled, `1985 vs ${S.lowestScheduled.toFixed(2)}`);
  // 🚨 THE ARM THAT PROVES THE BAND IS DERIVED AND NOT PINNED. On the announced schedule
  // sudden death takes 10% of the clock instead of 33%, so the band bottom drops from
  // 661.67 to ~198 wu and 400 becomes a radius a match genuinely holds again. A guard
  // that had 661.67 written into it would still be refusing it, forever.
  check('  CONTROL §C  the SAME 400 wu is ACCEPTED on the announced schedule — the band is '
    + 'derived from the constants, not pinned',
  400 > future.lowestScheduled, `400 vs ${future.lowestScheduled.toFixed(2)} (was ${S.lowestScheduled.toFixed(2)})`);

  // ── §D ────────────────────────────────────────────────────────────────────
  const simText = readFileSync(join(ROOT, 'src/game/sim.ts'), 'utf8');
  const linear = SHAPE_SITES[1];
  check('  CONTROL §D  the linear ring formula is found in the shipped sim.ts', shapeHolds(linear, simText));
  // The known-bad is Uri's own schedule: a HOLD. Every t in [0, hold] has the same radius,
  // so `applyQaSetup`'s `timeRemaining = MATCH_DURATION_MS x wantR/maxR` stops being an
  // inverse and every ?fogRadius= station gets a different frame on the first tick.
  const held = simText.replace(linear.needle,
    'state.arena.maxSafeRadius * (1 - Math.max(0, progress - HOLD_FRACTION) / (1 - HOLD_FRACTION))');
  check('KNOWN-BAD §D  a HOLD in the ring schedule makes the shape row go red',
    !shapeHolds(linear, held));

  console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}  lit_clockguard --selftest: ${pass} passed, ${fail} failed\n`);
  return fail;
}

if (IS_MAIN) {
  const bridge = loadConstants();
  const K = await import(bridge.out);
  rmSync(bridge.dir, { recursive: true, force: true });
  const S = scheduleOf(K);
  let f;
  if (argv.includes('--selftest')) f = selftest(S);
  else if (argv.includes('--census')) f = census(S, collect());
  else f = run(S, collect());
  process.exitCode = f ? 1 : 0;
}
