#!/usr/bin/env node
/**
 * RC_PROSE — PROSE THAT STATES A SUPERSEDED CONSTANT AS FACT.
 *
 * ## Why a gate for comments
 *
 * The map went x4 on 2026-08-11 and the clock went 180 s -> 45 s before it. `277e680`
 * found the 1x map surviving in **twelve** more places, five of them registered gates.
 * Four survivors were left after that sweep and they are all PROSE — a markup placeholder
 * and three comment sentences — so nothing executable was wrong and nothing could go red:
 *
 *   * `ui/hud.ts` shipped `3:00` as the clock's markup placeholder on a **45 s** match;
 *   * `audio/sounds.ts` and `audio/director.ts` both stated `maxSafeRadius` **993** as
 *     current, on a map whose derived opening radius is **1985**.
 *
 * A wrong number in a comment is not harmless here: this project's comments are its primary
 * record, `CLAUDE.md` says so, and every one of those sentences was written as a
 * MEASUREMENT. The next reader has no way to tell a measurement from a fossil.
 *
 * ## 🚨 HOW IT AVOIDS BANNING THE HOUSE STYLE
 *
 * The house rule is *"when an assertion encodes a rule that has been reversed, change it and
 * keep the old wording above it with the reason"* — so the old numbers are SUPPOSED to still
 * be in the file. A grep for `993` would therefore fail on a correctly-fixed file, which is
 * the fastest possible way to get a gate deleted.
 *
 * So the test is not "is the number present" but **"is it QUOTED"**: a superseded figure must
 * sit on a markdown blockquote line (`>`), which is how every kept-old-wording block in this
 * repo is already written. `--arm stale` proves the classifier can tell the two apart by
 * unquoting one, and §D proves it is not vacuous by requiring both classes to actually occur.
 *
 * ## The truth comes from the SOURCE, not from this file
 *
 * Every expected value is imported through an esbuild bridge (`nw_profile.mjs`'s pattern —
 * `src/ui/**` cannot be imported by Node, but `src/game/**` and `src/arena/**` can be
 * bundled). **No expected number is written down here**, which is the same discipline
 * `gatecount.mjs` enforces on the docs: today's agreeing copy is next month's stale one.
 *
 * ## Use
 *
 *   node tools/tmp/rc_prose.mjs
 *   node tools/tmp/rc_prose.mjs --selftest      # every known-bad must turn its row red
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const argv = process.argv.slice(2);
const ARM = (() => {
  const i = argv.indexOf('--arm');
  return i >= 0 ? argv[i + 1] : 'base';
})();

/** The constants, from the modules that own them. */
function loadConstants() {
  const dir = mkdtempSync(join(tmpdir(), 'rc-prose-'));
  const entry = join(dir, 'entry.mjs');
  writeFileSync(entry, [
    `export { MATCH_DURATION_MS, MIN_SAFE_RADIUS, SUDDEN_DEATH_MS, minSafeRadiusFor } from ${JSON.stringify(join(ROOT, 'src/game/rules.ts'))};`,
    `export { MAX_SAFE_RADIUS } from ${JSON.stringify(join(ROOT, 'src/arena/shared.ts'))};`,
  ].join('\n'));
  const out = join(dir, 'bridge.mjs');
  execFileSync(join(ROOT, 'node_modules/.bin/esbuild'), [
    entry, '--bundle', '--format=esm', '--platform=node', '--log-level=error', `--outfile=${out}`,
  ], { stdio: 'inherit' });
  return { dir, out };
}

const rows = [];
const check = (name, pass, evidence) => {
  rows.push({ name, pass: !!pass, evidence });
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${name}${evidence ? ` — ${evidence}` : ''}`);
  return !!pass;
};

/**
 * Is this line a QUOTED historical figure, or a live claim?
 *
 * The repo's kept-old-wording blocks are markdown blockquotes inside the comment — `*   >`
 * or `//   >`. Everything else is the file speaking in its own voice.
 */
const isQuoted = (line) => /^\s*(\*|\/\/)?\s*>/.test(line);

/** `formatDuration`'s shape, derived from the constant rather than typed in. */
const mmss = (ms) => {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * A live sentence that states a superseded MATCH CLOCK, in the one shape these files
 * actually use: **a duration written as a fraction of the match** — *"30 s of 45 s"*,
 * *"25.1 s of a 45 s clock"*, *"13.3s of a 45s match"*.
 *
 * ## Why this class was missing, and why it is the one that just moved
 *
 * §B chases the RADIUS because the map went x4. `6d5c4d6` moved the other axis:
 * `MATCH_DURATION_MS` 45 s -> 150 s. Every sentence that quantified something as a share of
 * the clock is now wrong by 3.3x — *"12 s of alarm is a quarter of a 45 s match"* is 8% of
 * this one — and none of it is a coordinate, an identifier or a radius, so neither the
 * repo-wide 1x literal sweep nor §B can see any of it. That is the same gap this file was
 * built for; it just had one axis in it.
 *
 * ## The two ways this could have been unusable, and what is done instead
 *
 *   * **Naming the superseded numbers.** Matching `45` or `30` would be this file hardcoding
 *     exactly what it exists to ban, and would go stale on the next clock. So the test is
 *     *"is the denominator today's clock?"*, read from `rules.ts`.
 *   * **Firing on correct prose.** A bare seconds figure is not a clock — `src/ui/hud.ts`
 *     legitimately says *"a mean match length of 19.6s"*, and a checker that cannot tell a
 *     measurement from a constant gets switched off. Two narrowings: the figure must be the
 *     DENOMINATOR of an `X of Y` fraction, and it must be inside a plausible match-clock
 *     window. `19.6` is excluded by the window; `180` — the clock before 45 — is inside it
 *     and IS flagged, correctly, because a sentence saying *"on the 45s clock it arrives
 *     while there is still a fight going on"* teaches a reader the wrong clock.
 *
 * The same exemptions as §B apply and for the same reasons: a line that also states TODAY'S
 * clock is a history sentence and cannot mislead, and `file.ts:123` is a citation.
 *
 * @param line   one source line
 * @param nowSeconds  `MATCH_DURATION_MS / 1000`
 * @returns the superseded denominators on this line, as written
 */
function staleClockHits(line, nowSeconds) {
  const deRef = line.replace(/\.(ts|mjs|js):\d+/g, '');
  if (new RegExp(`\\b${nowSeconds}\\b`).test(deRef)) return [];
  const out = [];
  const re = /\bof (?:a |an |the )?(\d+(?:\.\d+)?)\s*s(?:ec|ecs|econd|econds)?\b/g;
  let m;
  while ((m = re.exec(deRef)) !== null) {
    const v = Number(m[1]);
    // 30..600 s brackets every clock this game has shipped (180 -> 45 -> 150) with room
    // either side, and excludes the sub-30 s durations these files measure and quote.
    if (v >= 30 && v <= 600 && v !== nowSeconds) out.push(m[1]);
  }
  return out;
}

async function main() {
  const bridge = loadConstants();
  const K = await import(bridge.out);
  rmSync(bridge.dir, { recursive: true, force: true });

  const read = (p) => readFileSync(join(ROOT, p), 'utf8');
  const nowRadius = Math.round(K.MAX_SAFE_RADIUS);
  const nowClock = mmss(K.MATCH_DURATION_MS);
  console.log(`  constants: MAX_SAFE_RADIUS=${nowRadius}  MATCH_DURATION_MS=${K.MATCH_DURATION_MS} (${nowClock})`
    + `  ringFloor(6)=${K.minSafeRadiusFor(6).toFixed(2)}  SUDDEN_DEATH_MS=${K.SUDDEN_DEATH_MS}`);

  // ── §A the clock placeholder ────────────────────────────────────────────────
  let hud = read('src/ui/hud.ts');
  if (ARM === 'clock') hud = hud.replace(/data-el="timer">[^<]*</, 'data-el="timer">3:00<');
  const placeholder = /data-el="timer">([^<]*)</.exec(hud)?.[1] ?? null;
  check('the clock placeholder is the real match duration',
    placeholder === nowClock, `markup "${placeholder}" vs MATCH_DURATION_MS ${nowClock}`);

  // ── §B superseded radii, in the files that quote them ───────────────────────
  // Any line naming `maxSafeRadius` (or the HUD's own ring wording) alongside a number
  // that is not today's must be a QUOTED historical line. `993` is named explicitly as
  // well: it is the exact fossil `277e680` chased through twelve files, and a sentence can
  // state it without the word `maxSafeRadius` anywhere near it.
  const AUDIT = ['src/audio/sounds.ts', 'src/audio/director.ts', 'src/ui/hud.ts', 'src/game/match.ts'];
  const nowSeconds = K.MATCH_DURATION_MS / 1000;
  let quotedSeen = 0;
  let quotedClockSeen = 0;
  let liveOffenders = [];
  let liveClockOffenders = [];
  for (const f of AUDIT) {
    let body = read(f);
    // KNOWN-BAD: put the old sentence back, unquoted, exactly as it shipped.
    if (ARM === 'stale' && f === 'src/audio/director.ts') {
      body = body.replace('   * `sawRingAboveFloor` still guards',
        '   * The shipped arena is 993 wu against a 140 wu floor.\n   * `sawRingAboveFloor` still guards');
    }
    body.split('\n').forEach((line, i) => {
      // ⚠️ TWO EXEMPTIONS, BOTH FOUND BY THIS GATE FIRING ON CORRECT PROSE. Neither
      // weakens it against the four defects it was built for — none of those lines carries
      // the current radius, and none of them was a source reference.
      //
      //   * A line that ALSO states TODAY'S value cannot mislead: *"890 -> 993 -> 1985"*
      //     is the history of one derived number, which is exactly what the house style
      //     asks for. Banning it would make the rule unwritable.
      //   * `fogRing.ts:533` is a FILE AND LINE, not a radius. The first version flagged it
      //     because the sentence around it says "safeRadiusUnits" — a checker that cannot
      //     tell a citation from a measurement will eventually be switched off.
      // ── the CLOCK arm, same two exemptions, same quoted/live split ──────────
      {
        const clock = staleClockHits(line, nowSeconds);
        if (clock.length) {
          if (isQuoted(line)) quotedClockSeen++;
          else liveClockOffenders.push(`${f}:${i + 1} [${clock.join(',')}s]`);
        }
      }
      const deRef = line.replace(/\.(ts|mjs|js):\d+/g, '');
      if (deRef.includes(String(nowRadius))) return;
      const nums = deRef.match(/\b\d{3,4}(?:\.\d+)?\b/g) ?? [];
      const namesRadius = /maxSafeRadius|safe ?radius|opening ring/i.test(deRef);
      const hits = nums.filter((n) => {
        const v = Number(n);
        if (n === '993') return true;                       // the fossil, by name
        return namesRadius && Number.isInteger(v) && v !== nowRadius && v >= 500 && v <= 4000;
      });
      if (!hits.length) return;
      if (isQuoted(line)) quotedSeen++;
      else liveOffenders.push(`${f}:${i + 1} [${hits.join(',')}]`);
    });
  }
  check('no live sentence states a superseded safe radius',
    liveOffenders.length === 0,
    liveOffenders.length ? liveOffenders.slice(0, 4).join('  ') : `${AUDIT.length} files clean`);
  // ⚠️ THE REMEDY IS IN THE EVIDENCE STRING ON PURPOSE. This arm's likeliest failure mode is
  // being switched off for firing on prose someone believes is fine — and the commonest such
  // case is a superseded figure quoted INLINE (`"6.34 s of a 45 s match"`) rather than on a
  // blockquote line. `isQuoted` is blockquote-only, deliberately and identically to the radius
  // arm above, because `CLAUDE.md`'s house style IS the blockquote; so the answer is to move
  // the sentence rather than to widen the classifier, and saying so here costs nothing.
  check('no live sentence states a superseded MATCH CLOCK',
    liveClockOffenders.length === 0,
    liveClockOffenders.length
      ? `${liveClockOffenders.length} sites, clock is now ${nowSeconds}s: ${liveClockOffenders.slice(0, 8).join('  ')}`
        + '  — fix by restating on today\'s clock, or by moving the old sentence onto a'
        + ' blockquote line (`*   >`) as the house style asks'
      : `${AUDIT.length} files clean at ${nowSeconds}s`);

  // ── §C the classifier is not vacuous ───────────────────────────────────────
  // 🚨 A FILTER THAT EMPTIES ITS OWN SET PASSES EVERY ASSERTION OVER IT. Three controls
  // went vacuous in one session for exactly this. §B is only meaningful if superseded
  // figures ARE present and ARE being classified — so require the quoted class to be
  // non-empty, and prove both branches of `isQuoted` on fixed inputs.
  check('superseded figures are present and classified as quoted',
    quotedSeen > 0, `${quotedSeen} quoted historical lines`);
  check('superseded CLOCK figures are present and classified as quoted',
    quotedClockSeen > 0, `${quotedClockSeen} quoted historical clock lines`);
  // 🚨 THE CLOCK DETECTOR IS PROVED ON FIXED INPUTS, NOT ON THE CORPUS — because the corpus
  // row above is RED today (`src/ui/hud.ts` and both `src/audio/**` files carry the 45 s
  // clock), and a `--arm` known-bad that plants a defect into an already-red row proves
  // nothing at all. A row cannot be shown to go red by a plant if it was never green: that is
  // the vacuous-control failure with the roles reversed. So the four branches are exercised
  // directly, and every one of them is a real mistake this detector has to survive.
  check('the clock detector tells a stale clock from today\'s, and a measurement from a clock',
    staleClockHits(' * ring to zero at `SUDDEN_DEATH_MS` = **30 s of 45 s**', 150).length === 1
      && staleClockHits(' * 25 s of hold out of a 150 s match', 150).length === 0
      && staleClockHits(' * the zone edge was off the card against a mean match length of 19.6s', 150).length === 0
      && staleClockHits(' * 12 s of alarm was a quarter of a 45 s match; the clock is 150 s now', 150).length === 0,
    'stale x1 hit, current/short-measurement/history x3 clean');
  check('the quoted/live classifier distinguishes its two arms',
    isQuoted(' *   > *"maxSafeRadius 993"*') === true
      && isQuoted(' //   > the old 993') === true
      && isQuoted(' * The shipped arena is 993 wu') === false
      && isQuoted('const r = 993;') === false,
    'quoted x2 true, live x2 false');

  const failed = rows.filter((r) => !r.pass).length;
  console.log(`\nrc_prose: ${rows.length - failed}/${rows.length} checks passed (arm=${ARM})`);
  return failed;
}

const SELFTEST = [
  { arm: 'clock', mustFail: 'the clock placeholder is the real match duration' },
  { arm: 'stale', mustFail: 'no live sentence states a superseded safe radius' },
];

async function selftest() {
  const self = resolve(new URL(import.meta.url).pathname);
  const { spawnSync } = await import('node:child_process');
  let bad = 0;
  for (const t of SELFTEST) {
    const r = spawnSync(process.execPath, [self, '--arm', t.arm], { encoding: 'utf8' });
    const line = (r.stdout ?? '').split('\n').find((l) => l.includes(t.mustFail));
    const red = !!line && line.trim().startsWith('FAIL');
    console.log(`  ${red ? 'ok  ' : 'FAIL'} known-bad --arm ${t.arm}: "${t.mustFail}" is ${red ? 'RED' : 'GREEN'}`);
    if (!red) bad++;
  }
  console.log(`\nrc_prose --selftest: ${SELFTEST.length - bad}/${SELFTEST.length} known-bads turned their row red`);
  return bad;
}

if (IS_MAIN) {
  const code = argv.includes('--selftest') ? await selftest() : await main();
  process.exit(code === 0 ? 0 : 1);
}

export { isQuoted, mmss };
