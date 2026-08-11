#!/usr/bin/env node
/**
 * Serve a PRISTINE `git archive HEAD` and run a command against it.
 *
 * `tools/snapshot.mjs` freezes the WORKING TREE, which is the right tool when you are
 * measuring your own uncommitted change. It is the wrong tool when the question is
 * "does the shipped game do X", because three peers are mid-edit in `hud.ts`,
 * `home.ts` and `arena-scan.mjs` right now and `home.ts` is ON the shipped path.
 *
 * Usage — the command runs with PREVIEW_BASE set, and the server dies with it:
 *
 *   node tools/tmp/headserve.mjs -- node tools/tmp/kbdverdict.mjs
 *   node tools/tmp/headserve.mjs --ref 36ee0a6 -- node tools/tmp/input_accept.mjs
 *
 * ─────────────────────────────────────────────────────────────────────────────────
 * 🚨 `--ref` DEFAULTS TO `HEAD`, AND `HEAD` IS RESOLVED **PER INVOCATION**.
 *
 * This tool protects you from a peer's UNCOMMITTED edits. It does NOT protect you from
 * a peer's COMMITTED ones, and in a six-agent fan-out those are the common case. Each
 * invocation runs its own `git archive`, so two arms of one A/B started 25 minutes
 * apart are two DIFFERENT TREES whenever anyone pushed in between.
 *
 * That is not hypothetical. Reconstructed in `1a5b808` from the commit clock against an
 * `arena-scan` run's own output timestamps: FOUR peer commits landed inside one
 * three-arm comparison, including `rig.ts` (shipped path) and six character files, so
 * the arm labelled "HEAD" and the arm labelled "HEAD again — the DRIFT CONTROL" were
 * measuring different games. The pass had to be re-run pinned before its claim stood.
 *
 * 🔵 **SO: FOR ANY A/B, ANY DRIFT CONTROL, AND ANY BASELINE YOU WILL STORE, PASS AN
 *    EXPLICIT IMMUTABLE SHA — `--ref 36ee0a6` — TO EVERY ARM, AND READ THE BANNER BACK.**
 *
 * The banner prints the RESOLVED 40-char commit, not the ref you typed, precisely so
 * that reading it back is a real check. `--ref HEAD` is legal and prints a loud warning:
 * it is fine for a single self-contained measurement, never for a second arm.
 *
 * The resolved identity is also exported to the child so a tool can RECORD what it
 * measured instead of asking git for `HEAD` again later and getting a different answer:
 *
 *   HEADSERVE_SHA      resolved 40-char commit, or '' in --worktree mode
 *   HEADSERVE_REF      the ref string as typed ('HEAD', '36ee0a6', ...)
 *   HEADSERVE_MODE     'ref' | 'worktree'
 *   HEADSERVE_OVERLAY  comma-joined --overlay paths, '' when there are none.
 *                      ⚠️ NON-EMPTY MEANS THE SERVED TREE IS NOT THAT COMMIT. Anything
 *                      storing provenance must say so rather than claim the SHA.
 * ─────────────────────────────────────────────────────────────────────────────────
 *
 * Passing `--worktree` serves the working tree instead (same contract, so the same
 * probe can be pointed at both without editing it). ⚠️ A working tree is not a commit
 * and is not reproducible — never store a baseline taken through it.
 *
 * `--overlay <path>` copies ONE working-tree path over the pristine checkout. That is
 * the combination this investigation needed: HEAD everywhere (three peers are mid-edit
 * in `hud.ts`, `home.ts` and `arena-scan.mjs`) plus exactly the files under test.
 *
 *   node tools/tmp/headserve.mjs --overlay src/game/match.ts -- node tools/tmp/input_accept.mjs
 *
 * Why a wrapper rather than `URL=$(... --json)`: that documented idiom DEADLOCKS here.
 * The node process stays alive holding its Vite child, so its stdout never EOFs and the
 * command substitution never returns. Running the measurement as a CHILD of the server
 * process sidesteps both that and `docs/LESSONS.md` §12's "snapshot servers die with the
 * shell that started them".
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, symlinkSync, existsSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import net from 'node:net';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
if (sep < 0) {
  console.error('usage: node tools/tmp/headserve.mjs [--ref <ref>] [--worktree] -- <cmd> [args...]');
  process.exit(2);
}
const flags = argv.slice(0, sep);
const cmd = argv.slice(sep + 1);
const useWorktree = flags.includes('--worktree');
const refIdx = flags.indexOf('--ref');
const ref = refIdx >= 0 ? flags[refIdx + 1] : 'HEAD';
const overlays = flags.reduce((acc, f, i) => (f === '--overlay' ? [...acc, flags[i + 1]] : acc), []);

/**
 * Resolve the ref to an immutable commit ONCE, up front, and archive THAT.
 *
 * Previously `git archive ${ref}` ran with the symbolic name, so the tree served was
 * whatever `HEAD` pointed at the moment this process reached the archive call. Pinning
 * here does not stop a peer pushing — nothing can — but it makes the served tree a
 * stated 40-char fact that the banner prints and the child can read back, which is what
 * turns "I think both arms were the same tree" into something checkable.
 */
let sha = '';
if (!useWorktree) {
  const r = spawnSync('git', ['-C', ROOT, 'rev-parse', '--verify', `${ref}^{commit}`], { encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout.trim()) {
    console.error(`headserve: cannot resolve --ref ${ref}: ${(r.stderr || '').trim()}`);
    process.exit(1);
  }
  sha = r.stdout.trim();
  if (ref === 'HEAD') {
    console.warn(
      '\n  ⚠ headserve: --ref defaults to HEAD, which is resolved PER INVOCATION.\n' +
      `    This run pinned it to ${sha.slice(0, 7)}, but a second arm started later resolves it AGAIN.\n` +
      '    For any A/B, drift control or stored baseline, pass the SHA explicitly to EVERY arm:\n' +
      `      node tools/tmp/headserve.mjs --ref ${sha.slice(0, 7)} -- <cmd>\n` +
      '    (1a5b808: four peer commits landed inside one three-arm comparison.)\n',
    );
  }
}

const dir = mkdtempSync(join(tmpdir(), useWorktree ? 'fa-wt-' : 'fa-head-'));

if (useWorktree) {
  for (const entry of ['src', 'tools', 'public', 'index.html', 'preview.html', 'package.json', 'tsconfig.json']) {
    const from = join(ROOT, entry);
    if (existsSync(from)) cpSync(from, join(dir, entry), { recursive: true, dereference: false });
  }
  for (const cfg of ['vite.config.ts', 'vite.config.js', 'vite.config.mjs']) {
    if (existsSync(join(ROOT, cfg))) cpSync(join(ROOT, cfg), join(dir, cfg));
  }
} else {
  // `git archive` writes exactly what is COMMITTED — the artefact a player would get.
  const r = spawnSync('bash', ['-c', `git -C "${ROOT}" archive ${sha} | tar -x -C "${dir}"`], { stdio: 'inherit' });
  if (r.status !== 0) { rmSync(dir, { recursive: true, force: true }); process.exit(1); }
}

for (const rel of overlays) {
  const from = join(ROOT, rel);
  if (!existsSync(from)) { console.error(`--overlay: no such path: ${rel}`); rmSync(dir, { recursive: true, force: true }); process.exit(1); }
  cpSync(from, join(dir, rel), { recursive: true, dereference: false });
}

symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'), 'dir');

const port = await new Promise((res, rej) => {
  const srv = net.createServer();
  srv.on('error', rej);
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => res(port)); });
});

const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
  cwd: dir, stdio: 'ignore',
});

const url = `http://localhost:${port}`;
let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try { vite.kill('SIGTERM'); } catch { /* gone */ }
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(143); });
process.on('exit', cleanup);

const deadline = Date.now() + 90_000;
let up = false;
while (Date.now() < deadline && !up) {
  up = await new Promise((res) => {
    const sock = net.connect(port, '127.0.0.1');
    sock.on('connect', () => { sock.destroy(); res(true); });
    sock.on('error', () => res(false));
    setTimeout(() => { sock.destroy(); res(false); }, 500);
  });
  if (!up) await new Promise((r) => setTimeout(r, 400));
}
if (!up) { console.error(`headserve: vite did not come up on ${port}`); cleanup(); process.exit(1); }

// The banner prints the RESOLVED commit, never the ref as typed — reading it back is
// only a check if the two can disagree.
console.log(`headserve: serving ${useWorktree ? 'WORKING TREE (not a commit — do not store a baseline from this)' : `git ${sha}${ref !== sha ? ` (--ref ${ref})` : ''}`}${overlays.length ? ` + live ${overlays.join(', ')}  ⚠ NOT that commit` : ''} at ${url}\n`);

const child = spawn(cmd[0], cmd.slice(1), {
  cwd: ROOT,
  stdio: 'inherit',
  env: {
    ...process.env,
    PREVIEW_BASE: url,
    HEADSERVE_URL: url,
    // Provenance, so a child can record WHAT IT MEASURED rather than asking git for
    // `HEAD` afterwards — by then a peer may have moved it. See the header.
    HEADSERVE_SHA: sha,
    HEADSERVE_REF: useWorktree ? '' : ref,
    HEADSERVE_MODE: useWorktree ? 'worktree' : 'ref',
    HEADSERVE_OVERLAY: overlays.join(','),
  },
});
/**
 * ── THE CHECK THAT WOULD HAVE CAUGHT 1a5b808 BY ITSELF ──────────────────────────
 *
 * Pinning makes THIS arm reproducible. It cannot make a comparison of two arms sound,
 * because the other arm is a different process. What CAN be detected, here, for free, is
 * the precondition for that failure: **HEAD moved while the measurement was running.**
 * Four peer commits landed inside one three-arm comparison and nobody noticed for hours;
 * a run that says so on the way out turns that into a fact on the terminal.
 *
 * Only reported when the ref was symbolic. A run pinned to a SHA is immune by
 * construction, and printing a warning it does not need is how warnings get ignored.
 *
 * `HEADSERVE_TEST_START_HEAD` is a documented test hook, and it exists because a guard
 * that has never been shown to FAIL is not a guard (CLAUDE.md rule 6) — and the only
 * honest way to make this one fire on demand is to move HEAD, which is the one thing an
 * agent must never do in a shared checkout. It overrides the remembered start commit and
 * nothing else.
 */
const headAtStart = process.env.HEADSERVE_TEST_START_HEAD
  || spawnSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout?.trim() || '';

function reportHeadDrift() {
  if (useWorktree || ref !== 'HEAD' || !headAtStart) return;
  const now = spawnSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout?.trim() || '';
  if (!now || now === headAtStart) return;
  const log = spawnSync('git', ['-C', ROOT, 'log', '--oneline', `${headAtStart}..${now}`], { encoding: 'utf8' }).stdout?.trim();
  console.error('\n  🚨 headserve: HEAD MOVED WHILE THIS RUN WAS MEASURING.');
  console.error(`     started at ${headAtStart.slice(0, 7)}, now ${now.slice(0, 7)}. This arm is fine — it was`);
  console.error(`     pinned to ${sha.slice(0, 7)} for its whole life. ANY OTHER ARM STARTED WITH \`--ref HEAD\``);
  console.error('     BEFORE OR AFTER THIS ONE MEASURED A DIFFERENT TREE. Landed meanwhile:');
  for (const line of (log || '').split('\n').filter(Boolean)) console.error(`       ${line}`);
  console.error(`     Re-run every arm with \`--ref ${sha.slice(0, 7)}\` before quoting a comparison.\n`);
}

child.on('exit', (code, sig) => { reportHeadDrift(); cleanup(); process.exit(sig ? 1 : (code ?? 1)); });
