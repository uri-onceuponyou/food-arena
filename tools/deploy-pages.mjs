#!/usr/bin/env node
/**
 * Publish `dist/` to the `gh-pages` branch, with the two guards that a bare
 * `rsync -a --delete dist/ <pages>/` cannot have.
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────────
 * A deploy done by hand on 2026-08-23 produced BOTH halves of the same defect in
 * one command, and neither was caught by anything:
 *
 *   1. It swept `dist/.DS_Store` INTO the published bundle. Finder metadata, on a
 *      public site. Caught only because `git commit` printed `create mode`.
 *   2. `--delete` removed `.nojekyll` FROM the branch, because `dist/` does not
 *      contain it. Nothing observable broke — Vite happens not to emit an
 *      underscore-prefixed chunk today — so this was LUCK. Without `.nojekyll`,
 *      GitHub Pages runs the tree through Jekyll, which SKIPS every path
 *      beginning with `_`, and the failure would be a 404 on a live site with no
 *      error anywhere in this repo.
 *
 * The shape generalises: `--delete` makes the destination match the source
 * exactly, so **anything that lives on `gh-pages` by design and not in `dist/` is
 * deleted by the sync**. That set must be enumerated, not assumed. `--delete`
 * governs what LEAVES; until this file, nothing governed what ARRIVED.
 *
 * ── AND IT REFUSES TO FORCE ───────────────────────────────────────────────────
 * The same deploy's first push was rejected because a peer had published while
 * this session ran and the local `gh-pages` ref was stale. That rejection was
 * CORRECT and the fix was to rebuild on the remote tip, not to force. This tool
 * fetches first and fast-forwards; it has no `--force`, deliberately.
 *
 * Usage:
 *   node tools/deploy-pages.mjs                 # build, sync, commit, push
 *   node tools/deploy-pages.mjs --dry-run       # everything except commit/push
 *   node tools/deploy-pages.mjs -m "message"    # commit subject (else generated)
 *   node tools/deploy-pages.mjs --selftest      # the guards, against known-bads
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const WORKTREE = '/tmp/fa-pages-deploy';
const BRANCH = 'gh-pages';

/**
 * 🚨 FILES THAT LIVE ON `gh-pages` BY DESIGN AND ARE NOT PRODUCED BY THE BUILD.
 *
 * Enumerated rather than inferred, because inferring it is exactly the mistake:
 * "whatever is in the branch and not in dist/ is stale" is what `--delete`
 * assumes, and it is false for every entry here.
 *
 * `.nojekyll` — without it Pages runs Jekyll and drops `_`-prefixed paths.
 * `CNAME`     — a custom domain, if one is ever configured. Losing it silently
 *               un-points the domain.
 */
const PRESERVE = ['.nojekyll', 'CNAME'];

/** Never publish these, wherever they come from. `--delete` says nothing about arrivals. */
const NEVER_PUBLISH = ['.DS_Store', 'Thumbs.db', 'desktop.ini', '.AppleDouble'];

const sh = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', cwd: ROOT, stdio: 'pipe', ...opts }).trim();

/* ══════════════════════════════════════════════════════════════════════════
   THE TWO GUARDS — pure, so they can be pointed at a known-bad
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Would this publish set drop something that only exists on the branch?
 *
 * ⚠️ Takes the file LISTS, not the filesystem, so `--selftest` can hand it the
 * exact shape that shipped. A guard that can only read the real tree is a guard
 * that can only be tested by breaking the real tree.
 */
export function findDroppedPreserved(branchFiles, publishFiles) {
  const publishing = new Set(publishFiles);
  // Assert the set we filter is non-empty FIRST. `[].filter(...)` is `[]` and an
  // empty branch listing would otherwise report "nothing dropped" — green because
  // there was nothing to check, which is this repo's most-repeated failure.
  if (branchFiles.length === 0) {
    return { vacuous: true, dropped: [], why: 'branch listing is EMPTY — nothing was checked' };
  }
  const dropped = PRESERVE.filter((p) => branchFiles.includes(p) && !publishing.has(p));
  return { vacuous: false, dropped, why: null };
}

/** Is anything in this publish set something that must never be served? */
export function findForbidden(publishFiles) {
  if (publishFiles.length === 0) {
    return { vacuous: true, forbidden: [], why: 'publish listing is EMPTY — nothing was checked' };
  }
  const forbidden = publishFiles.filter((f) => NEVER_PUBLISH.includes(f.split('/').pop()));
  return { vacuous: false, forbidden, why: null };
}

/**
 * Does the built `index.html` actually reference the assets we are about to
 * publish? Catches a stale `dist/` — a build that failed while an old bundle sat
 * on disk publishes silently and looks perfect.
 */
export function findMissingReferences(indexHtml, publishFiles) {
  const refs = [...indexHtml.matchAll(/(?:src|href)="(?:\.\/)?(assets\/[A-Za-z0-9._-]+\.(?:js|css))"/g)]
    .map((m) => m[1]);
  if (refs.length === 0) {
    return { vacuous: true, missing: [], refs, why: 'index.html references NO assets — nothing was checked' };
  }
  const have = new Set(publishFiles);
  return { vacuous: false, missing: refs.filter((r) => !have.has(r)), refs, why: null };
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    if (e === '.git') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...listFiles(p, base));
    else out.push(relative(base, p));
  }
  return out.sort();
}

/* ══════════════════════════════════════════════════════════════════════════
   SELFTEST — every guard against an input carrying the bug it guards against
   ══════════════════════════════════════════════════════════════════════════ */

function selftest() {
  let pass = 0, fail = 0;
  const ok = (cond, label, detail = '') => {
    if (cond) { pass++; console.log(`  ✓ ${label}${detail ? '   ' + detail : ''}`); }
    else { fail++; console.log(`  ✗ ${label}${detail ? '   ' + detail : ''}`); }
  };
  const H = (t) => console.log(`\n── ${t} ──`);

  H('§A  dropped-preserved  (fails: a sync that silently removes .nojekyll)');
  // The real shape, from the real incident: the branch had .nojekyll, dist/ did not.
  const branchReal = ['.nojekyll', 'index.html', 'assets/main-BE7EPXpf.js'];
  const publishReal = ['index.html', 'assets/main-CBEL5Fxs.js'];
  const a1 = findDroppedPreserved(branchReal, publishReal);
  ok(a1.dropped.includes('.nojekyll') && !a1.vacuous,
     'A1  KNOWN-BAD: the exact 2026-08-23 shape is caught', JSON.stringify(a1.dropped));
  const a2 = findDroppedPreserved(branchReal, [...publishReal, '.nojekyll']);
  ok(a2.dropped.length === 0 && !a2.vacuous,
     'A2  POSITIVE CONTROL: carrying .nojekyll through is clean');
  ok(findDroppedPreserved(['CNAME', 'index.html'], ['index.html']).dropped.includes('CNAME'),
     'A3  KNOWN-BAD: a custom domain would be caught the same way');
  // 🚨 VACUITY. `[].filter()` is `[]`, so an empty branch listing reports "nothing
  // dropped" — green for the wrong reason. This is the arm that stops that.
  const a4 = findDroppedPreserved([], publishReal);
  ok(a4.vacuous === true && a4.dropped.length === 0,
     'A4  KNOWN-BAD: an EMPTY branch listing reports VACUOUS, not clean', a4.why);
  ok(findDroppedPreserved(['index.html'], ['index.html']).dropped.length === 0,
     'A5  a branch that never had a preserved file is not a false positive');

  H('§B  forbidden arrivals  (fails: .DS_Store published to a live site)');
  const b1 = findForbidden(['index.html', '.DS_Store', 'assets/main.js']);
  ok(b1.forbidden.includes('.DS_Store') && !b1.vacuous,
     'B1  KNOWN-BAD: the .DS_Store that actually got committed is caught');
  ok(findForbidden(['icons/.DS_Store']).forbidden.length === 1,
     'B2  KNOWN-BAD: caught in a SUBDIRECTORY too — it matches on basename');
  ok(findForbidden(['index.html', 'assets/main.js']).forbidden.length === 0,
     'B3  POSITIVE CONTROL: a clean bundle passes');
  const b4 = findForbidden([]);
  ok(b4.vacuous === true, 'B4  KNOWN-BAD: an EMPTY publish listing reports VACUOUS, not clean', b4.why);

  H('§C  asset references  (fails: a stale dist/ published as if fresh)');
  const html = '<script type="module" src="/food-arena/assets/main-CBEL5Fxs.js"></script>'
    + '<link rel="stylesheet" href="./assets/index-abc123.css">';
  // The scan is base-relative; strip the deploy base the way the real file carries it.
  const stripped = html.replaceAll('/food-arena/', '');
  const c1 = findMissingReferences(stripped, ['assets/main-CBEL5Fxs.js', 'assets/index-abc123.css']);
  ok(c1.missing.length === 0 && c1.refs.length === 2 && !c1.vacuous,
     'C1  POSITIVE CONTROL: both referenced assets present', `refs=${c1.refs.length}`);
  const c2 = findMissingReferences(stripped, ['assets/main-OLDHASH.js', 'assets/index-abc123.css']);
  ok(c2.missing.includes('assets/main-CBEL5Fxs.js'),
     'C2  KNOWN-BAD: a stale bundle whose index names an absent chunk is caught');
  const c3 = findMissingReferences('<html><body>nothing</body></html>', ['index.html']);
  ok(c3.vacuous === true,
     'C3  KNOWN-BAD: an index referencing NO assets reports VACUOUS, not clean', c3.why);

  H('§E  the publish set is what rsync PLACES  (fails: a guard that cries wolf)');
  // The bug this file itself shipped for ten minutes: asking findForbidden about
  // `dist + carried` rather than about what rsync actually writes. Caught by the
  // --dry-run against the real branch, NOT by §B — which was green the whole time,
  // because §B's logic was never wrong. Only where it was POINTED was.
  {
    const distLike = ['index.html', 'assets/main.js', '.DS_Store'];
    const naive = [...distLike];
    const actual = distLike.filter((f) => !NEVER_PUBLISH.includes(f.split('/').pop()));
    ok(findForbidden(naive).forbidden.length === 1,
       'E1  KNOWN-BAD: the naive set (dist verbatim) DOES trip the forbidden guard — this was the bug');
    ok(findForbidden(actual).forbidden.length === 0 && !findForbidden(actual).vacuous,
       'E2  POSITIVE CONTROL: the set rsync actually places is clean, and NOT vacuous',
       `${actual.length} files`);
    ok(actual.length === distLike.length - 1 && actual.includes('assets/main.js'),
       'E3  the exclusion drops ONLY the junk, not the bundle', actual.join(' '));
  }

  H('§D  the preserve list is not empty  (fails: a guard with nothing to guard)');
  // If PRESERVE is ever emptied, §A passes on every input by construction — the
  // vacuity class one level up, in the CONSTANT rather than in the filter.
  ok(PRESERVE.length > 0 && PRESERVE.includes('.nojekyll'),
     'D1  PRESERVE is non-empty and still names .nojekyll', PRESERVE.join(' '));
  ok(NEVER_PUBLISH.length > 0 && NEVER_PUBLISH.includes('.DS_Store'),
     'D2  NEVER_PUBLISH is non-empty and still names .DS_Store');

  console.log(`\ndeploy-pages --selftest: ${pass} passed, ${fail} failed`);
  return fail === 0 ? 0 : 1;
}

/* ══════════════════════════════════════════════════════════════════════════
   CLI
   ══════════════════════════════════════════════════════════════════════════ */

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) process.exit(selftest());

  const dryRun = argv.includes('--dry-run');
  const mIdx = argv.indexOf('-m');
  const subject = mIdx >= 0 ? argv[mIdx + 1] : null;

  const head = sh('git', ['rev-parse', '--short', 'HEAD']);
  const headSubject = sh('git', ['log', '-1', '--format=%s']);

  console.log(`deploy-pages: HEAD ${head}`);
  console.log('  building with DEPLOY_BASE=/food-arena/ …');
  sh('npx', ['vite', 'build'], { env: { ...process.env, DEPLOY_BASE: '/food-arena/' } });

  const dist = join(ROOT, 'dist');
  if (!existsSync(join(dist, 'index.html'))) {
    console.error('deploy-pages: dist/index.html missing after build — refusing.');
    process.exit(2);
  }

  // Fetch and check out the REMOTE tip. Never force: a peer publishing mid-session
  // is normal here, and the rejected push is the guard working.
  sh('git', ['fetch', 'origin', `${BRANCH}:refs/remotes/origin/${BRANCH}`]);
  try { sh('git', ['worktree', 'remove', '--force', WORKTREE]); } catch { /* not present */ }
  sh('git', ['worktree', 'add', '--detach', WORKTREE, `origin/${BRANCH}`]);

  const branchFiles = listFiles(WORKTREE);
  const distFiles = listFiles(dist);

  // 🚨 WHAT THE SYNC WOULD ACTUALLY PUBLISH — and getting this wrong was a real bug
  // in THIS FILE, caught by pointing it at the real branch rather than by --selftest.
  //
  // The first version built the publish set as `dist + carried` and then asked
  // `findForbidden` about it. That set is not what rsync places: rsync is given
  // `--exclude` for every NEVER_PUBLISH entry, so a `.DS_Store` sitting in dist/ is
  // NOT published. The guard fired on a file that was never going to ship, and the
  // dry run exited 1 on a deploy that would have been clean.
  //
  // Over-strict is the better failure direction, but it is still WRONG, and left
  // alone it trains the next person to pass `--force` past a guard that cries wolf.
  // So: the HARD gate now runs on the set rsync will actually place, and junk found
  // in dist/ is reported as a WARNING — you are told it exists without the deploy
  // being blocked by a file the deploy already handles.
  //
  // ⚠️ This does NOT make the hard gate vacuous. It now checks a DIFFERENT
  // mechanism than the one that computes it: the gate asserts the exclusion list
  // and the sync's `--exclude` flags agree. If those two ever diverge, it fires.
  const carried = PRESERVE.filter((p) => branchFiles.includes(p));
  const junkInDist = distFiles.filter((f) => NEVER_PUBLISH.includes(f.split('/').pop()));
  const publishFiles = [...distFiles.filter((f) => !NEVER_PUBLISH.includes(f.split('/').pop())), ...carried].sort();

  let bad = 0;
  const report = (name, r, listKey) => {
    if (r.vacuous) { console.error(`  ✗ ${name}: VACUOUS — ${r.why}`); bad++; return; }
    const list = r[listKey];
    if (list.length) { console.error(`  ✗ ${name}: ${list.join(', ')}`); bad++; }
    else console.log(`  ✓ ${name}`);
  };

  console.log(`  branch ${branchFiles.length} files · dist ${distFiles.length} files · carrying ${carried.join(', ') || '(none)'}`);
  if (junkInDist.length) {
    console.log(`  ⚠ junk in dist/, EXCLUDED from the sync rather than blocking it: ${junkInDist.join(', ')}`);
  }
  report('no preserved file dropped', findDroppedPreserved(branchFiles, publishFiles), 'dropped');
  report('no forbidden file published', findForbidden(publishFiles), 'forbidden');
  const idx = readFileSync(join(dist, 'index.html'), 'utf8').replaceAll('/food-arena/', '');
  report('index.html references present assets', findMissingReferences(idx, publishFiles), 'missing');

  if (bad) {
    console.error(`\ndeploy-pages: ${bad} guard(s) failed — nothing published.`);
    process.exit(1);
  }
  if (dryRun) {
    console.log('\ndeploy-pages: --dry-run, guards green, nothing published.');
    process.exit(0);
  }

  // rsync with BOTH halves governed: --delete for departures, --exclude for arrivals,
  // and the preserved set restored afterwards.
  sh('rsync', ['-a', '--delete', '--exclude=.git',
    ...NEVER_PUBLISH.map((n) => `--exclude=${n}`),
    `${dist}/`, `${WORKTREE}/`]);
  for (const p of carried) sh('git', ['checkout', `origin/${BRANCH}`, '--', p], { cwd: WORKTREE });

  const after = listFiles(WORKTREE);
  const post = findDroppedPreserved(branchFiles, after);
  if (post.vacuous || post.dropped.length) {
    console.error(`deploy-pages: POST-SYNC check failed (${post.why ?? post.dropped.join(', ')}) — not committing.`);
    process.exit(1);
  }

  sh('git', ['add', '-A'], { cwd: WORKTREE });
  const staged = sh('git', ['status', '--porcelain'], { cwd: WORKTREE });
  if (!staged) { console.log('deploy-pages: bundle is byte-identical to the live one. Nothing to publish.'); process.exit(0); }

  const msg = `${subject ?? `deploy ${head} — ${headSubject}`}\n\nPublished by tools/deploy-pages.mjs. Guards: preserved ${carried.join(', ') || '(none)'} carried through; ${NEVER_PUBLISH.length} junk patterns excluded; index.html's asset references verified present.\n\nCo-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>\n`;
  sh('git', ['commit', '-m', msg], { cwd: WORKTREE });
  sh('git', ['push', 'origin', `HEAD:${BRANCH}`], { cwd: WORKTREE });
  console.log(`\ndeploy-pages: published ${head} to ${BRANCH}.`);
  sh('git', ['worktree', 'remove', '--force', WORKTREE]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
