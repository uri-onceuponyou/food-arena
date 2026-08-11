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
  let quotedSeen = 0;
  let liveOffenders = [];
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

  // ── §C the classifier is not vacuous ───────────────────────────────────────
  // 🚨 A FILTER THAT EMPTIES ITS OWN SET PASSES EVERY ASSERTION OVER IT. Three controls
  // went vacuous in one session for exactly this. §B is only meaningful if superseded
  // figures ARE present and ARE being classified — so require the quoted class to be
  // non-empty, and prove both branches of `isQuoted` on fixed inputs.
  check('superseded figures are present and classified as quoted',
    quotedSeen > 0, `${quotedSeen} quoted historical lines`);
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
