#!/usr/bin/env node
/**
 * ir_outclaim — ONE WRITER PER OUTPUT DIRECTORY, enforced instead of assumed.
 *
 *   node tools/tmp/ir_outclaim.mjs --selftest        # the known-bad-input proofs
 *   node tools/tmp/ir_outclaim.mjs --show <dir>      # who owns <dir> right now
 *
 * ─── WHY THIS EXISTS: THREE AGENTS, ONE NIGHT, TWO TREES ────────────────────
 * `valuescan --mode gate` recomputes in two phases — `--mode chars` writes `chars.json`,
 * `--mode dl` writes `dl.json` — into a directory that defaulted to a SHARED `shots/vl`.
 * On 2026-08-09/10 a peer's run landed in that directory *between* another agent's two
 * phases. Twice. The two files then described two different trees:
 *
 *     agent A   chars.json srcId X   dl.json srcId Y      -> gate REFUSED
 *     agent B   same shape, same night                    -> gate REFUSED
 *     agent C   used a private --out and was fine, then flagged the shared default as
 *               "a cross-agent collision waiting to corrupt a baseline" — and STILL
 *               could not fully opt out, because it could not kill its own stray
 *               process and one run finished into the shared directory anyway.
 *
 * `valuescan`'s `srcId` provenance check is the only reason those were three near-misses
 * instead of three silently wrong answers: it refused rather than reporting a mixed-tree
 * number. **That check is not what this file replaces.** `srcId` catches the corruption
 * AFTER hours of SwiftShader have been spent; this catches the collision BEFORE the first
 * page boots. Both stay. `docs/LESSONS.md` §13 — an instrument that reports a plausible
 * wrong number is worse than none, and one that reports the right refusal three hours
 * late is merely expensive.
 *
 * ─── WHY A CLAIM AND NOT A PER-PROCESS DEFAULT PATH ─────────────────────────
 * The obvious fix — default `--out` to `shots/vl/pid-<pid>` — was rejected AFTER being
 * written out, because it breaks the pipeline shape peers are running right now:
 *
 *     node …valuescan --mode chars && node …valuescan --mode dl && node …valuescan --mode gate --reuse
 *
 * Three processes, three pids, three different default directories, and the third one
 * refuses with "cannot read the gate's inputs". That converts a rare collision into a
 * guaranteed failure for everybody, which is the strictly worse trade. A claim leaves
 * every existing invocation working when no peer is live, and refuses — with the exact
 * flag to pass — only when one is.
 *
 * ─── THE CLAIM ──────────────────────────────────────────────────────────────
 * `<dir>/.ir-owner.json`, written by any WRITING mode, holding pid, a run id, the tool,
 * the argv, the host and the claimant's own OS-reported start time. A later writer:
 *
 *     no file .......................... TAKE   (FREE)
 *     file names OUR pid ............... TAKE   (SELF)      — phase 2 of one process
 *     file names a DEAD pid ............ TAKE   (STALE)     — a killed run must not wedge the dir
 *     file names a RECYCLED pid ........ TAKE   (RECYCLED)  — pid matches, start time does not
 *     file names a LIVE foreign pid .... REFUSE (LIVE)      — the bug above
 *     file is unparseable .............. REFUSE (CORRUPT)   — cannot know, so do not guess
 *     file was written on another host . REFUSE (FOREIGN_HOST) — liveness is unknowable
 *
 * ⚠️ PID REUSE IS A REAL FALSE-REFUSAL SOURCE and is handled rather than ignored: the
 * claim records `psStart`, the claimant's start time as `ps` reports it, and a pid whose
 * start time no longer matches is treated as STALE. Where `ps` is unavailable the field
 * is `null`, the check degrades to bare pid liveness, and `--show` prints `psStart null`
 * so the weaker mode is visible instead of assumed.
 *
 * ⚠️ AND THE RACE IS NOT ZERO. Two processes that read an empty directory in the same
 * instant can both take it. The write uses `wx` (exclusive create) so the loser sees the
 * winner's file, which shrinks the window to the gap between `stat` and `open` — but it
 * does not close it. Stated because an unstated limit is how these bugs happen.
 *
 * ─── READS ARE WARNED, WRITES ARE REFUSED ───────────────────────────────────
 * Deliberate asymmetry. A write into a claimed directory destroys a peer's file. A read
 * of one cannot: a torn read fails `JSON.parse`, a complete read from a different tree is
 * caught by `srcId`, and a complete read from the SAME tree is the same measurement. So
 * `claimDir` refuses and `warnIfClaimed` prints. Making reads refuse as well was tried and
 * dropped — it would have failed the one agent who was already doing the right thing.
 */
import { readFileSync, writeFileSync, unlinkSync, openSync, closeSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hostname } from 'node:os';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

export const CLAIM_FILE = '.ir-owner.json';

/**
 * The claimant's start time as the OS reports it, used ONLY to tell a live pid from a
 * recycled one. `null` on any failure — an unavailable `ps` must degrade the check, never
 * break the tool it guards.
 */
export function psStart(pid) {
  try {
    const out = execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8', timeout: 4000 });
    const s = out.trim();
    return s === '' ? null : s;
  } catch { return null; }
}

/** Does this pid exist? `EPERM` means it exists and is not ours to signal. */
export function pidAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (e) { return e.code === 'EPERM'; }
}

/**
 * THE WHOLE DECISION, PURE, so `--selftest` can drive every branch without spawning a
 * process or touching a disk. Everything impure — reading the file, asking the OS whether
 * a pid is alive — is injected.
 *
 * @param existing  null (no claim) | the parsed claim | the string 'CORRUPT'
 * @param env       { pid, host, isAlive(pid), startOf(pid) }
 * @returns { take, code, why }
 */
export function decideClaim(existing, env) {
  const { pid, host, isAlive, startOf } = env;
  if (existing == null) return { take: true, code: 'FREE', why: 'no claim on the directory' };
  if (existing === 'CORRUPT' || typeof existing !== 'object' || typeof existing.pid !== 'number') {
    return { take: false, code: 'CORRUPT', why: 'the claim file is unreadable, so its owner is unknowable' };
  }
  if (existing.host && existing.host !== host) {
    return { take: false, code: 'FOREIGN_HOST', why: `claimed on host ${existing.host}, and liveness cannot be checked across hosts` };
  }
  if (existing.pid === pid) return { take: true, code: 'SELF', why: 'this process already owns it' };
  if (!isAlive(existing.pid)) {
    return { take: true, code: 'STALE', why: `pid ${existing.pid} is gone — a killed run must not wedge the directory` };
  }
  // The pid is live. Is it the SAME process that claimed, or a recycled number?
  // A null on either side means `ps` could not answer; that is not evidence of reuse, so
  // the live pid stands and we refuse. Refusing on missing evidence is the safe direction
  // here — the cost is typing `--out`, the cost of the other direction is a peer's run.
  const nowStart = startOf(existing.pid);
  if (existing.psStart && nowStart && existing.psStart !== nowStart) {
    return { take: true, code: 'RECYCLED', why: `pid ${existing.pid} is live but started at ${nowStart}, not ${existing.psStart} — the number was reused` };
  }
  return { take: false, code: 'LIVE', why: `pid ${existing.pid} is live and holds this directory` };
}

/** Read the claim, or `null`, or the sentinel `'CORRUPT'`. Never throws. */
export function readClaim(dir) {
  const p = join(dir, CLAIM_FILE);
  if (!existsSync(p)) return null;
  try {
    const v = JSON.parse(readFileSync(p, 'utf8'));
    return (v && typeof v === 'object') ? v : 'CORRUPT';
  } catch { return 'CORRUPT'; }
}

function writeClaim(dir, claim) {
  const p = join(dir, CLAIM_FILE);
  // `wx` first so a peer that created it a millisecond ago is seen rather than clobbered.
  try { const fd = openSync(p, 'wx'); closeSync(fd); } catch { /* it exists; we decided we may take it */ }
  writeFileSync(p, JSON.stringify(claim, null, 2));
}

/**
 * Claim `dir` for writing, or return the refusal. Impure. Callers should print `refusal`
 * and exit non-zero — the message already names the flag that resolves it.
 *
 * @returns { ok: true, claim } | { ok: false, code, refusal, existing }
 */
export function claimDir(dir, { tool, mode, flag = '--out' } = {}) {
  mkdirSync(dir, { recursive: true });
  const existing = readClaim(dir);
  const d = decideClaim(existing, {
    pid: process.pid, host: hostname(), isAlive: pidAlive, startOf: psStart,
  });
  if (!d.take) {
    const e = existing === 'CORRUPT' ? null : existing;
    const lines = [
      `✗ REFUSED — ${dir} is claimed by another run (${d.code}).`,
      `  ${d.why}`,
      e ? `  owner: pid ${e.pid}  tool ${e.tool}  mode ${e.mode}  run ${e.runId}  since ${e.startedAt}`
        : `  owner: ${join(dir, CLAIM_FILE)} could not be parsed`,
      e && e.argv ? `  their argv: ${e.argv.join(' ')}` : null,
      '',
      `  Two runs writing one directory is how a two-phase measurement ends up describing`,
      `  two different trees. Write somewhere else:`,
      `      ${flag} ${dir.replace(/\/$/, '')}/$(date +%H%M%S)-$$`,
      d.code === 'CORRUPT' || d.code === 'FOREIGN_HOST'
        ? `  …or delete ${join(dir, CLAIM_FILE)} once you have established nothing is writing there.`
        : `  …or, if you are certain that run is dead, pass --force-claim.`,
    ].filter((l) => l !== null);
    return { ok: false, code: d.code, refusal: lines.join('\n'), existing: e };
  }
  const claim = {
    tool: tool ?? 'unknown', mode: mode ?? null, pid: process.pid, runId: randomUUID().slice(0, 8),
    host: hostname(), psStart: psStart(process.pid), startedAt: new Date().toISOString(),
    argv: process.argv.slice(1),
  };
  writeClaim(dir, claim);
  // Release on the way out, but ONLY if the file still names our run — a peer that took
  // the directory over after we exited must not have its claim deleted by our handler.
  const release = () => {
    try {
      const cur = readClaim(dir);
      if (cur && cur !== 'CORRUPT' && cur.runId === claim.runId) unlinkSync(join(dir, CLAIM_FILE));
    } catch { /* releasing is best-effort; a leftover claim is handled as STALE */ }
  };
  process.on('exit', release);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sig, () => { release(); process.exit(130); });
  }
  return { ok: true, claim, code: d.code };
}

/**
 * The READ side. Never refuses — see the asymmetry note in the header — but a reader
 * whose inputs are being rewritten underneath it should say so out loud.
 * @returns the live foreign claim, or null
 */
export function warnIfClaimed(dir, label = 'this directory') {
  const existing = readClaim(dir);
  if (!existing || existing === 'CORRUPT') return null;
  if (existing.pid === process.pid) return null;
  if (existing.host && existing.host !== hostname()) return null;
  if (!pidAlive(existing.pid)) return null;
  console.warn(`\n⚠️ ${label} (${dir}) is being WRITTEN RIGHT NOW by pid ${existing.pid}`
    + ` (${existing.tool} --mode ${existing.mode}, run ${existing.runId}, since ${existing.startedAt}).`);
  console.warn('   Reading it is not corrupting — the provenance audit below still has to pass — but the');
  console.warn('   files may change under you mid-read. Prefer a directory nothing else is writing.\n');
  return existing;
}

// ─────────────────────────────────────────────────────────────────────────────
// --selftest — every branch against an input whose answer is not in dispute.
//
// `docs/LESSONS.md` §13: a guard that has not been shown to FAIL on the bug it guards
// against is not a guard, and a guard can also be TAUTOLOGICAL. So every refusal below
// is paired with the acceptance that differs from it by exactly one field — a decider
// that always refused would pass every refusal test in this file and fail its pair.
// ─────────────────────────────────────────────────────────────────────────────
function selftest() {
  let pass = 0, fail = 0;
  const check = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) { pass++; console.log(`  ✓ ${name.padEnd(68)} ${JSON.stringify(got)}`); }
    else { fail++; console.log(`  ✗ ${name.padEnd(68)} got ${JSON.stringify(got)}  want ${JSON.stringify(want)}`); }
  };
  console.log('\nSELFTEST — the claim decision, on inputs whose answer is derivable by hand\n');

  const ME = 4242, HOST = 'thishost';
  const env = (alive, starts = {}) => ({
    pid: ME, host: HOST,
    isAlive: (p) => alive.includes(p),
    startOf: (p) => starts[p] ?? null,
  });
  const claim = (o) => ({ tool: 'valuescan', mode: 'dl', pid: 9001, runId: 'abcd1234', host: HOST, psStart: 'Mon Aug 10 01:00:00 2026', startedAt: '2026-08-10T01:00:00Z', argv: [], ...o });

  console.log('A. THE BUG: a live foreign writer holds the directory');
  {
    const d = decideClaim(claim({}), env([9001], { 9001: 'Mon Aug 10 01:00:00 2026' }));
    check('THE BUG — live foreign pid is REFUSED', [d.take, d.code], [false, 'LIVE']);
    // The pair. Same input, one field changed: the pid is no longer alive.
    const e = decideClaim(claim({}), env([]));
    check('its PAIR — the same claim with a DEAD pid is taken', [e.take, e.code], [true, 'STALE']);
  }

  console.log('B. A run must not wedge a directory it will never write to again');
  {
    check('no claim at all', (() => { const d = decideClaim(null, env([])); return [d.take, d.code]; })(), [true, 'FREE']);
    const d = decideClaim(claim({ pid: ME }), env([ME]));
    check('OUR OWN pid — phase 2 of a two-phase run', [d.take, d.code], [true, 'SELF']);
    // Without this branch `--mode gate` would refuse itself between chars and dl.
    check('…and it is taken even though our own pid is very much alive', d.take, true);
  }

  console.log('C. PID REUSE — the false-refusal source, handled rather than ignored');
  {
    const recycled = decideClaim(claim({}), env([9001], { 9001: 'Mon Aug 10 09:30:00 2026' }));
    check('THE BUG — pid live but started LATER: the number was reused', [recycled.take, recycled.code], [true, 'RECYCLED']);
    const same = decideClaim(claim({}), env([9001], { 9001: 'Mon Aug 10 01:00:00 2026' }));
    check('its PAIR — same start time is the SAME process, refused', [same.take, same.code], [false, 'LIVE']);
    // Missing evidence is not evidence. `ps` unavailable must not be read as "recycled",
    // or the guard silently switches itself off on any host without `ps`.
    const noPs = decideClaim(claim({ psStart: null }), env([9001], { 9001: 'Mon Aug 10 09:30:00 2026' }));
    check('claim written with NO psStart degrades to bare liveness, still refuses', [noPs.take, noPs.code], [false, 'LIVE']);
    const noNow = decideClaim(claim({}), env([9001], {}));
    check('`ps` unable to answer NOW degrades to bare liveness, still refuses', [noNow.take, noNow.code], [false, 'LIVE']);
  }

  console.log('D. UNKNOWABLE OWNERS are refused, not guessed at');
  {
    check('a corrupt claim file', (() => { const d = decideClaim('CORRUPT', env([])); return [d.take, d.code]; })(), [false, 'CORRUPT']);
    check('a claim that is not an object', (() => { const d = decideClaim(7, env([])); return [d.take, d.code]; })(), [false, 'CORRUPT']);
    check('a claim with no pid field', (() => { const d = decideClaim({ tool: 'x' }, env([])); return [d.take, d.code]; })(), [false, 'CORRUPT']);
    const fh = decideClaim(claim({ host: 'otherbox' }), env([]));
    check('THE BUG — a claim from another host: pid 9001 there is meaningless here', [fh.take, fh.code], [false, 'FOREIGN_HOST']);
    // The pair: identical claim, our host, dead pid — taken. So FOREIGN_HOST is the host
    // check firing and not the liveness check.
    const ph = decideClaim(claim({ host: HOST }), env([]));
    check('its PAIR — same claim on OUR host with a dead pid is taken', [ph.take, ph.code], [true, 'STALE']);
  }

  console.log('E. NOT TAUTOLOGICAL — the decider distinguishes, it does not just say no');
  {
    // A decider hard-wired to `take:false` passes every refusal above. A decider hard-wired
    // to `take:true` passes every acceptance. Neither passes this.
    const codes = [
      decideClaim(null, env([])).code,
      decideClaim(claim({ pid: ME }), env([ME])).code,
      decideClaim(claim({}), env([])).code,
      decideClaim(claim({}), env([9001], { 9001: 'other' })).code,
      decideClaim(claim({}), env([9001], { 9001: 'Mon Aug 10 01:00:00 2026' })).code,
      decideClaim('CORRUPT', env([])).code,
      decideClaim(claim({ host: 'otherbox' }), env([])).code,
    ];
    check('seven inputs produce seven distinct codes', codes,
      ['FREE', 'SELF', 'STALE', 'RECYCLED', 'LIVE', 'CORRUPT', 'FOREIGN_HOST']);
    check('and they are not all the same verdict',
      new Set([decideClaim(null, env([])).take, decideClaim(claim({}), env([9001], { 9001: 'Mon Aug 10 01:00:00 2026' })).take]).size, 2);
  }

  console.log('F. THE REAL FILESYSTEM PATH — claim, re-claim, release');
  {
    const dir = join(process.env.TMPDIR || '/tmp', `ir_outclaim_selftest_${process.pid}`);
    const a = claimDir(dir, { tool: 'selftest', mode: 'A' });
    check('a fresh directory is claimed', [a.ok, a.code], [true, 'FREE']);
    const onDisk = readClaim(dir);
    check('the claim on disk names THIS pid', onDisk.pid, process.pid);
    const b = claimDir(dir, { tool: 'selftest', mode: 'B' });
    check('the same process re-claims it (two phases, one run)', [b.ok, b.code], [true, 'SELF']);
    // THE KNOWN-BAD INPUT, on the real disk: forge a claim naming a pid that is certainly
    // alive and is certainly not us — pid 1. `psStart` is written as null so the recycle
    // branch cannot fire and the refusal is the LIVE branch, which is the one under test.
    writeFileSync(join(dir, CLAIM_FILE), JSON.stringify({
      tool: 'peer', mode: 'dl', pid: 1, runId: 'deadbeef', host: hostname(),
      psStart: null, startedAt: '2026-08-10T01:00:00Z', argv: ['peer'],
    }));
    const c = claimDir(dir, { tool: 'selftest', mode: 'C' });
    check('THE BUG on a real disk — a live foreign owner (pid 1) REFUSES', [c.ok, c.code], [false, 'LIVE']);
    check('the refusal names the flag that resolves it', c.refusal.includes('--out'), true);
    check('…and the directory still belongs to the peer, not to us', readClaim(dir).runId, 'deadbeef');
    // The pair on the real disk: an unquestionably dead pid. 0x7FFFFFFF is above every
    // platform's pid_max, so `kill(pid,0)` cannot find it.
    writeFileSync(join(dir, CLAIM_FILE), JSON.stringify({
      tool: 'peer', mode: 'dl', pid: 2147483647, runId: 'deadbeef', host: hostname(),
      psStart: null, startedAt: '2026-08-10T01:00:00Z', argv: ['peer'],
    }));
    const e = claimDir(dir, { tool: 'selftest', mode: 'E' });
    check('its PAIR on a real disk — a dead owner is taken over', [e.ok, e.code], [true, 'STALE']);
    check('pidAlive agrees: pid 1 alive, pid 2147483647 not', [pidAlive(1), pidAlive(2147483647)], [true, false]);
    try { unlinkSync(join(dir, CLAIM_FILE)); } catch {}
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  return fail === 0 ? 0 : 1;
}

// ⚠️ THE ENTIRE CLI IS BEHIND THE main-MODULE TEST, and that is not tidiness. The first
// draft read `process.argv` unconditionally at module scope, so `valuescan --selftest`
// — which IMPORTS this file — matched `--selftest` here, ran THIS selftest, and
// `process.exit`ed before valuescan's own assertions had run. A gate that silently
// substitutes a different gate's result for its own is the `driver_guard` coverage-shrank
// shape again (docs/LESSONS.md §13). Caught by running the gate battery, not by review.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) process.exit(selftest());
  else if (argv.includes('--show')) {
    const dir = argv[argv.indexOf('--show') + 1];
    const c = readClaim(dir);
    if (!c) console.log(`${dir}: unclaimed`);
    else if (c === 'CORRUPT') console.log(`${dir}: claim file is UNPARSEABLE`);
    else console.log(`${dir}: pid ${c.pid} ${pidAlive(c.pid) ? 'LIVE' : 'DEAD'}  ${c.tool} --mode ${c.mode}  run ${c.runId}  since ${c.startedAt}  psStart ${c.psStart}`);
  } else {
    console.error('usage: ir_outclaim.mjs --selftest | --show <dir>');
    process.exit(2);
  }
}
