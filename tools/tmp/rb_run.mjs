#!/usr/bin/env node
/**
 * RB_RUN — stage N candidates, measure each with `roster_lab`, print one table.
 *
 * A roster rebalance is a search, and a search on this project costs ~100 s of CPU per
 * 8-seed candidate. This runs them CONCURRENTLY against a FROZEN control and prints the
 * two quantities `CLAUDE.md` #10 requires side by side and never added together:
 *
 *   AGGREGATE player win     resolution floor ~9 pp. Context, never a result.
 *   PAIRED per-matchup       identical seeds, EXACT for those seeds.
 *   roster range / settled   the quantities this pass is judged on.
 *
 * ⚠️ THE CONTROL IS A FROZEN STAGE, NOT THE WORKING TREE. `stage_weapon.mjs`'s own header
 * records why: peers save constantly, and a candidate measured against a live baseline
 * puts a peer's mid-flight edit on exactly one side of the comparison. `--control` stages
 * a zero-pair copy first and every candidate is paired against THAT.
 *
 *   node tools/tmp/rb_run.mjs --out DIR --seeds 8 --control
 *   node tools/tmp/rb_run.mjs --out DIR --seeds 8 --cand 'name:burrito.Swarm.cooldown=4500'
 *   node tools/tmp/rb_run.mjs --out DIR --seeds 8 --file cands.txt --jobs 5
 *
 * A candidate line is `name: pair pair pair`. `#` comments and blank lines are skipped.
 */
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const execFileP = promisify(execFile);
const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const args = (() => {
  const o = { cand: [] };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    const k = a.slice(2);
    if (n === undefined || n.startsWith('--')) o[k] = true;
    else if (k === 'cand') { o.cand.push(n); i++; }
    else { o[k] = n; i++; }
  }
  return o;
})();

const OUT = String(args.out ?? '');
if (!OUT) { console.error('rb_run: --out DIR is required'); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const SEEDS = String(args.seeds ?? 8);
const JOBS = Number(args.jobs ?? 5);
const POLICIES = String(args.policies ?? 'smart2,chase');
const CTL_JSON = join(OUT, `ctl${SEEDS}.json`);
const CTL_DIR = join(OUT, 'stage_control');

const stage = (dir, pairs) =>
  execFileP(process.execPath, [join(ROOT, 'tools/tmp/rb_stage.mjs'), dir, ...pairs], { cwd: ROOT, maxBuffer: 1 << 26 });

function rosterLab({ simDir, json, baseline, log }) {
  return new Promise((res, rej) => {
    const a = [join(ROOT, 'tools/tmp/roster_lab.mjs'), '--seeds', SEEDS, '--policies', POLICIES, '--json', json];
    if (simDir) a.push('--sim', simDir);
    if (baseline) a.push('--baseline', baseline);
    const p = spawn(process.execPath, a, { cwd: ROOT });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('close', (c) => {
      if (log) writeFileSync(log, out);
      c === 0 ? res(out) : rej(new Error(`roster_lab exit ${c}\n${out.slice(-2000)}`));
    });
  });
}

// ── the control ─────────────────────────────────────────────────────────────
if (args.control || !existsSync(CTL_JSON) || !existsSync(join(OUT, 'ctl.log'))) {
  console.log(`staging + measuring the FROZEN control at ${SEEDS} seeds …`);
  await stage(CTL_DIR, []);
  const out = await rosterLab({ simDir: join(CTL_DIR, 'game'), json: CTL_JSON });
  writeFileSync(join(OUT, 'ctl.log'), out);
  for (const l of out.split('\n')) if (/aggregate player win|SETTLED MATCH|roster strength mean/.test(l)) console.log(`  ${l.trim()}`);
  if (args.control && !args.cand.length && !args.file) process.exit(0);
}

// ── candidates ──────────────────────────────────────────────────────────────
const lines = [...args.cand];
if (args.file) {
  for (const l of readFileSync(String(args.file), 'utf8').split('\n')) {
    const t = l.trim();
    if (t && !t.startsWith('#')) lines.push(t);
  }
}
const cands = lines.map((l) => {
  const c = l.indexOf(':');
  return { name: l.slice(0, c).trim(), pairs: l.slice(c + 1).trim().split(/\s+/).filter(Boolean) };
});

const rows = [];
let next = 0;
async function worker() {
  for (;;) {
    const i = next++;
    if (i >= cands.length) return;
    const { name, pairs } = cands[i];
    const dir = join(OUT, `stage_${name}`);
    try {
      await stage(dir, pairs);
      const out = await rosterLab({
        simDir: join(dir, 'game'), json: join(OUT, `rl_${name}.json`),
        baseline: CTL_JSON, log: join(OUT, `rl_${name}.log`),
      });
      rows[i] = { name, pairs, out };
      console.log(`  done ${name}`);
    } catch (e) {
      rows[i] = { name, pairs, err: String(e).split('\n').slice(0, 3).join(' | ') };
      console.log(`  FAIL ${name}: ${rows[i].err}`);
    }
  }
}
console.log(`\n${cands.length} candidates · ${JOBS} concurrent · ${SEEDS} seeds`);
await Promise.all(Array.from({ length: Math.min(JOBS, cands.length) }, worker));

// ── report ──────────────────────────────────────────────────────────────────
function parse(out) {
  const per = {};
  let pol = null;
  for (const l of out.split('\n')) {
    const m = l.match(/POLICY (\w+) ── \d+ matches · aggregate player win ([\d.]+)%/);
    if (m) { pol = m[1].toLowerCase(); per[pol] = { agg: Number(m[2]) }; continue; }
    if (!pol) continue;
    const s = l.match(/SETTLED MATCHUPS (\d+)\/(\d+)/);
    if (s) { per[pol].settled = Number(s[1]); continue; }
    const r = l.match(/roster strength mean [\d.]+% · sd ([\d.]+)pp.*= ([\d.]+)pp/);
    if (r) { per[pol].sd = Number(r[1]); per[pol].range = Number(r[2]); continue; }
    const d = l.match(/max \|Δ\| ([+\-\d.]+)pp · mean \|Δ\| ([+\-\d.]+)pp · (\d+)\/(\d+) matchups moved/);
    if (d) { per[pol].maxD = Number(d[1]); per[pol].meanD = Number(d[2]); per[pol].moved = Number(d[3]); }
  }
  return per;
}
const ctlOut = readFileSync(join(OUT, 'ctl.log'), 'utf8');
const ctl = parse(ctlOut);
const pols = POLICIES.split(',');

console.log(`\n╔══ RB_RUN ══ ${SEEDS} seeds · paired against the FROZEN control`);
console.log(`║ ⚠️ AGGREGATE floor ~9 pp — context only. PAIRED deltas are exact FOR THESE SEEDS.`);
for (const pol of pols) {
  console.log(`\n══ ${pol.toUpperCase()} ══  control: range ${ctl[pol].range}pp · settled ${ctl[pol].settled}/110 · sd ${ctl[pol].sd} · agg ${ctl[pol].agg}%`);
  console.log(`  ${'candidate'.padEnd(22)}${'range'.padStart(8)}${'Δrange'.padStart(8)}${'settled'.padStart(9)}${'sd'.padStart(7)}${'agg%'.padStart(8)}${'moved'.padStart(8)}${'max|Δ|'.padStart(9)}`);
  for (const r of rows) {
    if (!r) continue;
    if (r.err) { console.log(`  ${r.name.padEnd(22)}  ERROR ${r.err}`); continue; }
    const p = parse(r.out)[pol];
    console.log(`  ${r.name.padEnd(22)}${p.range.toFixed(1).padStart(8)}${(p.range - ctl[pol].range).toFixed(1).padStart(8)}` +
      `${`${p.settled}/110`.padStart(9)}${p.sd.toFixed(1).padStart(7)}${p.agg.toFixed(1).padStart(8)}${String(p.moved ?? '-').padStart(8)}${String(p.maxD ?? '-').padStart(9)}`);
  }
}

// Per-character strength deltas: the table that says WHO moved, which is the only way to
// tell a candidate that compressed the roster from one that merely moved it.
function strengths(out) {
  const s = {};
  let pol = null;
  for (const l of out.split('\n')) {
    const m = l.match(/POLICY (\w+) ──/);
    if (m) { pol = m[1].toLowerCase(); s[pol] = {}; continue; }
    const c = l.match(/^\s{2}(\w+)\s+\w+\s+[\d.]+%\s+[\d.]+%\.\.[\d.]+%\s+[\d.]+%\s+[\d.]+%\.\.[\d.]+%\s+([\d.]+)%/);
    if (c && pol) s[pol][c[1]] = Number(c[2]);
  }
  return s;
}
const cs = strengths(ctlOut);
for (const pol of pols) {
  const ids = Object.keys(cs[pol]).sort((a, b) => cs[pol][b] - cs[pol][a]);
  console.log(`\n── ${pol.toUpperCase()} per-character strength (control, then Δ per candidate)`);
  console.log(`  ${'char'.padEnd(13)}${'ctl'.padStart(7)}${rows.filter((r) => r && !r.err).map((r) => r.name.slice(0, 8).padStart(9)).join('')}`);
  for (const id of ids) {
    const ds = rows.filter((r) => r && !r.err).map((r) => {
      const v = strengths(r.out)[pol][id];
      const d = v - cs[pol][id];
      return `${d >= 0 ? '+' : ''}${d.toFixed(1)}`.padStart(9);
    }).join('');
    console.log(`  ${id.padEnd(13)}${cs[pol][id].toFixed(1).padStart(7)}${ds}`);
  }
}
console.log('');
