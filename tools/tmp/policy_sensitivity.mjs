#!/usr/bin/env node
/**
 * How much of a pacing number is the LAYOUT, and how much is the scripted player?
 *
 * Built to test two claims that are on record and that the `smart` policy fix calls into
 * question. Both come from the commit message of 60c5b92, which is the source every peer
 * is currently reasoning from:
 *
 *   A. "Two layouts with the SAME 1140 wu route scored 8.8 s and 15.1 s on nothing but
 *       which prop stopped the strafe." — i.e. the broken policy is hypersensitive to
 *       layout noise, and the corrected one is not.
 *   B. "Spawn separation held at 1080 wu, by measurement. Swept 1080/1000/920/840/760:
 *       dead time does not improve (56.6/55.6/58.9/58.1/57.6%)." — a real design decision
 *       taken on the broken policy's dead-time figures.
 *
 * Method. Perturb ONE thing at a time on the committed layout, re-run all 110 matchups
 * through `tools/match-sim.mjs --layout`, and report how far the headline moves. The sim
 * itself is pinned with `--sim-ref` so a peer's live `rules.ts` edit cannot leak in.
 *
 *   --jitter   N cover-jitter variants (each box moved by a seeded +/-J wu). Route length
 *              is very nearly preserved, so the SPREAD across variants is pure layout
 *              noise. A policy whose answer swings under it is not measuring the layout.
 *   --spawns   Re-runs claim B's spawn-gap sweep under every policy revision.
 *
 *   node tools/tmp/policy_sensitivity.mjs --jitter 6 --sim-ref 349a047
 *   node tools/tmp/policy_sensitivity.mjs --spawns  --sim-ref 349a047
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(`--${n}`) ? (argv[argv.indexOf(`--${n}`) + 1] ?? true) : d);
const SIM_REF = String(flag('sim-ref', 'HEAD'));
const POLICIES = ['smart-losfirst', 'smart-navfix', 'smart'];
const BASE = JSON.parse(readFileSync(join(ROOT, 'tools/arena.gameplay.json'), 'utf8'));
const DIR = mkdtempSync(join(tmpdir(), 'fa-polsens-'));

/** Deterministic PRNG — a sensitivity number taken from an unseeded shuffle is not a
 *  measurement, it is an anecdote. */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function sweep(layout, policy, tag) {
  const p = join(DIR, `${tag}.json`);
  writeFileSync(p, JSON.stringify(layout));
  const out = join(DIR, `${tag}.${policy}.out.json`);
  execFileSync('node', [join(ROOT, 'tools/match-sim.mjs'), '--layout', p, '--sim-ref', SIM_REF,
    '--all-matchups', '--policy', policy, '--out', out], { encoding: 'utf8', cwd: ROOT });
  const all = JSON.parse(readFileSync(out, 'utf8'));
  const n = all.length;
  const avg = (f) => all.reduce((a, r) => a + f(r), 0) / n;
  return {
    contact: avg((r) => r.timeToContactPlayMs ?? 0) / 1000,
    dead: avg((r) => r.deadFrac),
    offFair: avg((r) => r.enemyOffFairFrac),
    match: avg((r) => r.playMs) / 1000,
    win: all.filter((r) => r.outcome === 'player').length / n,
  };
}

const stat = (xs) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
  return { m, sd, min: Math.min(...xs), max: Math.max(...xs) };
};

// ── A. layout noise ─────────────────────────────────────────────────────────
if (argv.includes('--jitter')) {
  const N = Number(flag('jitter', 6)) || 6;
  const J = Number(flag('amp', 40));
  console.log(`\n== LAYOUT-NOISE SENSITIVITY — ${N} variants, every cover box moved by +/-${J}wu (seeded), sim=${SIM_REF}`);
  console.log(`   Route length is essentially unchanged, so any spread here is the INSTRUMENT reacting to`);
  console.log(`   scenery rather than to the map. Lower spread = the number is about the layout.\n`);
  const variants = [];
  for (let v = 0; v < N; v++) {
    const r = rng(1000 + v);
    variants.push({
      tag: `v${v}`,
      layout: {
        ...BASE,
        cover: BASE.cover.map((c) => ({
          ...c,
          x: Math.round(Math.min(BASE.width - 60, Math.max(60, c.x + (r() * 2 - 1) * J))),
          y: Math.round(Math.min(BASE.height - 60, Math.max(60, c.y + (r() * 2 - 1) * J))),
        })),
      },
    });
  }
  const res = {};
  for (const pol of POLICIES) {
    res[pol] = variants.map((v) => sweep(v.layout, pol, `${v.tag}`));
  }
  const cols = ['contact', 'dead', 'offFair', 'match'];
  console.log(`   ${'policy'.padEnd(16)}${cols.map((c) => `${c} mean`.padStart(14) + 'spread'.padStart(10)).join('')}`);
  for (const pol of POLICIES) {
    let line = pol.padEnd(16);
    for (const c of cols) {
      const s = stat(res[pol].map((x) => x[c]));
      const scale = c === 'dead' || c === 'offFair' ? 100 : 1;
      line += (s.m * scale).toFixed(2).padStart(14) + `+/-${(s.sd * scale).toFixed(2)}`.padStart(10);
    }
    console.log(`   ${line}`);
  }
  console.log(`\n   'spread' is the standard deviation ACROSS layout variants. contact/match in seconds, dead/offFair in pp.\n`);
}

// ── B. the spawn-gap sweep, re-run ──────────────────────────────────────────
if (argv.includes('--spawns')) {
  // The committed spawns are point-symmetric about centre and 110wu off the centre line.
  // Hold the geometry and vary ONLY the gap, exactly as 60c5b92's sweep describes.
  const cx = BASE.center.x, cy = BASE.center.y;
  const dx = BASE.playerSpawn.x - cx, dy = BASE.playerSpawn.y - cy;
  const baseGap = 2 * Math.hypot(dx, dy);
  const gaps = String(flag('gaps', '1102,1000,920,840,760')).split(',').map(Number);
  console.log(`\n== SPAWN-GAP SWEEP RE-RUN — committed gap ${baseGap.toFixed(0)}wu, sim=${SIM_REF}`);
  console.log(`   60c5b92 concluded from this sweep that "dead time does not improve" as the gap shrinks,`);
  console.log(`   and held the separation. That conclusion was taken on policy rev 1.\n`);
  console.log(`   ${'gap'.padStart(6)}  ${'policy'.padEnd(16)}${'contact'.padStart(9)}${'dead'.padStart(9)}${'offFair'.padStart(9)}${'match'.padStart(9)}${'win'.padStart(8)}`);
  for (const g of gaps) {
    const k = g / baseGap;
    const layout = {
      ...BASE,
      playerSpawn: { x: Math.round(cx + dx * k), y: Math.round(cy + dy * k) },
      enemySpawn: { x: Math.round(cx - dx * k), y: Math.round(cy - dy * k) },
    };
    for (const pol of POLICIES) {
      const s = sweep(layout, pol, `g${g}`);
      console.log(`   ${String(g).padStart(6)}  ${pol.padEnd(16)}${s.contact.toFixed(2).padStart(9)}${(s.dead * 100).toFixed(1).padStart(9)}${(s.offFair * 100).toFixed(1).padStart(9)}${s.match.toFixed(2).padStart(9)}${(s.win * 100).toFixed(1).padStart(8)}`);
    }
    console.log('');
  }
}

if (!argv.includes('--jitter') && !argv.includes('--spawns')) {
  console.log('nothing to do: pass --jitter [N] and/or --spawns');
}
