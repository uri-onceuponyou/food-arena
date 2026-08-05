#!/usr/bin/env node
/**
 * MATCH SHAPE, PAIRED — the silence structure of a match, per matchup and on a FROZEN sim.
 *
 * ── Why this exists rather than `audio_mix.mjs --shape` ─────────────────────────
 *
 * `--shape` produced the audio pillar's headline finding: *"mean play length 9.60 s, and
 * the mean gap between the start whistle and the first combat sound is 6.55 s — 69.9% of
 * the match, in one unbroken silence"*. That number is quoted in
 * `docs/DECISIONS-FOR-URI.md` §7 and §17 and it is the stated justification for the
 * kitchen ambience bed that shipped in `35bd115`. Two things were wrong with the way it
 * could be checked:
 *
 *   1. It is an AGGREGATE over 121 matchups and nothing underneath it was ever printed.
 *      `docs/LESSONS.md` §5: `roster_table`'s aggregate moved 0.8 pp — inside the noise
 *      floor — while 58 of 110 individual matchups moved, max 34.4 pp. An instrument can
 *      be right about the number you are watching and wrong about every number underneath
 *      it, so this prints the PAIRED per-matchup delta as well as the mean.
 *   2. `audio_mix.mjs` takes `CHARACTER_IDS` from the WORKING TREE while the recording
 *      comes from wherever `--sim` points. A 90%-isolated instrument invites you to trust
 *      the 10% that isn't (§5 again). Everything here comes from one `--sim`.
 *
 * The computation is `modeShape`'s, restated so it can be pointed at a frozen tree — and
 * `--validate` asserts that this restatement agrees with `audio_mix.mjs --shape` to the
 * last printed decimal on the same input. Run it before believing anything below.
 *
 *   node tools/tmp/audio_shape.mjs --sim /tmp/frozen/src/game --arena /tmp/frozen/tools/arena.gameplay.json
 *   node tools/tmp/audio_shape.mjs --json /tmp/a.json
 *   node tools/tmp/audio_shape.mjs --json /tmp/b.json --baseline /tmp/a.json   # paired delta
 *
 * The driver flags of `audio_mix_record.mjs` all apply, because the recording is its:
 *   --nav-countdown-bug --decide-during-countdown   reproduce the pre-2026-08-05 driver
 *   --legacy-smart-as <policy>                      what this family's `smart` resolves to
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { record, resolvePolicy, DRIVER_FLAGS, DRIVER_REV } from './audio_mix_record.mjs';

const argv = process.argv.slice(2);
const get = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const has = (k) => argv.includes(k);

const SIM_DIR = String(get('--sim', new URL('../../src/game', import.meta.url).pathname));
const RULES = await import(`${SIM_DIR}/rules.ts`);
const POLICY = String(get('--policy', 'smart'));

/**
 * `MatchAudio.handleEvent`'s voice count, mirrored — the same mirror `audio_census.mjs`
 * and `audio_mix.mjs` carry, and `tools/audio-probe.mjs --mode coverage` asserts the
 * mirror agrees with `director.ts` on which kinds are voiced.
 */
const voicesFor = (ev) => {
  switch (ev.type) {
    case 'countdown-tick': case 'match-started': case 'match-ended':
    case 'weapon-fired': case 'heal': case 'death': return 1;
    case 'projectile-destroyed': return ev.reason === 'hit-cover' ? 1 : 0;
    case 'hit-landed': return 1 + (ev.targetRole === 'player' && ev.source.kind !== 'fog' ? 1 : 0);
    default: return 0;
  }
};

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (xs, q) => { const a = [...xs].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.round(q * (a.length - 1)))]; };

function shape() {
  const rows = [];
  for (const p of RULES.CHARACTER_IDS) for (const e of RULES.CHARACTER_IDS) {
    const tl = record(p, e, POLICY);
    let startAt = null, endAt = null; const vt = []; let nv = 0;
    for (const t of tl.ticks) for (const ev of t.ev) {
      if (ev.type === 'match-started') startAt = t.t;
      if (ev.type === 'match-ended') endAt = t.t;
      const v = voicesFor(ev);
      if (v > 0 && ev.type !== 'match-started' && ev.type !== 'countdown-tick' && startAt !== null && t.t > startAt) { vt.push(t.t); nv += v; }
    }
    if (startAt === null || endAt === null) continue;
    const play = endAt - startAt;
    const first = vt.length ? vt[0] - startAt : play;
    let gap = first, prev = startAt;
    for (const t of vt) { gap = Math.max(gap, t - prev); prev = t; }
    gap = Math.max(gap, endAt - prev);
    // 25 ms bins, a voice held "on" for 300 ms — `modeShape`'s definition, verbatim.
    const bins = Math.max(1, Math.ceil(play / 25)); const on = new Uint8Array(bins);
    for (const t of vt) { const s = Math.floor((t - startAt) / 25); for (let i = s; i < Math.min(bins, s + 12); i++) on[i] = 1; }
    rows.push({ k: `${p}>${e}`, p, e, play, first, gap, nv, duty: on.reduce((a, b) => a + b, 0) / bins });
  }
  return rows;
}

const rows = shape();
const f = (k) => rows.map((r) => r[k]);
const frac = rows.map((r) => r.first / r.play);

const out = {
  n: rows.length, policy: POLICY, resolvedPolicy: resolvePolicy(POLICY),
  driverRev: DRIVER_REV, driverFlags: DRIVER_FLAGS, sim: SIM_DIR,
  playMean: mean(f('play')), playMedian: pct(f('play'), 0.5), playMax: pct(f('play'), 1),
  firstMean: mean(f('first')), firstMedian: pct(f('first'), 0.5), firstMin: pct(f('first'), 0), firstMax: pct(f('first'), 1),
  silentFrac: mean(frac),
  gapMean: mean(f('gap')), gapMedian: pct(f('gap'), 0.5),
  dutyMean: mean(f('duty')), dutyMedian: pct(f('duty'), 0.5), dutyP90: pct(f('duty'), 0.9),
  voicesMean: mean(f('nv')),
  rows: Object.fromEntries(rows.map((r) => [r.k, { play: r.play, first: r.first, gap: r.gap, duty: r.duty, nv: r.nv }])),
};

console.log(`\n══ match SHAPE · ${out.n} matchups · policy ${POLICY} -> ${out.resolvedPolicy} · driver rev ${DRIVER_REV}${DRIVER_FLAGS.navCountdownBug || DRIVER_FLAGS.decideDuringCountdown ? '  ⚠️ HISTORICAL' : ''} ══`);
console.log(`   sim ${SIM_DIR}\n`);
console.log(`play length                    mean ${(out.playMean / 1000).toFixed(2)}s   median ${(out.playMedian / 1000).toFixed(2)}s   max ${(out.playMax / 1000).toFixed(2)}s`);
console.log(`match-start -> 1st combat sound mean ${(out.firstMean / 1000).toFixed(2)}s   median ${(out.firstMedian / 1000).toFixed(2)}s   min ${(out.firstMin / 1000).toFixed(2)}s   max ${(out.firstMax / 1000).toFixed(2)}s`);
console.log(`  as a fraction of the match    mean ${(out.silentFrac * 100).toFixed(1)}%`);
console.log(`longest silent gap in the match mean ${(out.gapMean / 1000).toFixed(2)}s   median ${(out.gapMedian / 1000).toFixed(2)}s`);
console.log(`DUTY CYCLE (any voice in 300ms) mean ${(out.dutyMean * 100).toFixed(1)}%   median ${(out.dutyMedian * 100).toFixed(1)}%   p90 ${(out.dutyP90 * 100).toFixed(1)}%`);
console.log(`voices requested per match      mean ${out.voicesMean.toFixed(1)}`);

// ── PAIRED. The aggregate above and the per-matchup delta below are different
//    quantities and must never be added together (`docs/LESSONS.md` §5).
const BASE = get('--baseline', null);
if (BASE && existsSync(BASE)) {
  const b = JSON.parse(readFileSync(BASE, 'utf8'));
  const keys = Object.keys(out.rows).filter((k) => b.rows[k]);
  const d = (k, field) => out.rows[k][field] - b.rows[k][field];
  const movedFirst = keys.filter((k) => Math.abs(d(k, 'first')) > 1e-9);
  const movedPlay = keys.filter((k) => Math.abs(d(k, 'play')) > 1e-9);
  const maxFirst = keys.reduce((a, k) => (Math.abs(d(k, 'first')) > Math.abs(d(a, 'first')) ? k : a), keys[0]);
  const maxDuty = keys.reduce((a, k) => (Math.abs(d(k, 'duty')) > Math.abs(d(a, 'duty')) ? k : a), keys[0]);
  console.log(`\n── PAIRED vs ${BASE}  (rev ${b.driverRev ?? 'UNSTAMPED = pre-fix'} ${JSON.stringify(b.driverFlags ?? {})}, policy ${b.resolvedPolicy ?? '?'})`);
  console.log(`   first-sound gap   ${movedFirst.length}/${keys.length} matchups moved · mean Δ ${((out.firstMean - b.firstMean) / 1000).toFixed(2)}s · mean |Δ| ${(mean(keys.map((k) => Math.abs(d(k, 'first')))) / 1000).toFixed(2)}s · worst ${maxFirst} ${(d(maxFirst, 'first') / 1000).toFixed(2)}s`);
  console.log(`   play length       ${movedPlay.length}/${keys.length} moved · mean Δ ${((out.playMean - b.playMean) / 1000).toFixed(2)}s`);
  console.log(`   duty cycle        mean Δ ${((out.dutyMean - b.dutyMean) * 100).toFixed(1)} pp · worst ${maxDuty} ${(d(maxDuty, 'duty') * 100).toFixed(1)} pp`);
  console.log(`   silent fraction   ${(b.silentFrac * 100).toFixed(1)}% -> ${(out.silentFrac * 100).toFixed(1)}%  (Δ ${((out.silentFrac - b.silentFrac) * 100).toFixed(1)} pp)`);
}

if (has('--json')) { writeFileSync(String(get('--json', '/tmp/shape.json')), JSON.stringify(out, null, 2)); console.log(`\nwrote ${get('--json')}`); }
console.log('');
