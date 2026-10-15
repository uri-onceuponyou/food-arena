#!/usr/bin/env node
/**
 * b1_audio — B6's red/green: the documented inaudible-voice cull, on the REAL `MatchAudio`.
 *
 * `proximity.ts:SFX_INAUDIBLE_GAIN` says *"below this gain a voice is not scheduled at all"*,
 * and on `2b2e792` nothing read it: every placed voice reached `engine.play` whatever its gain
 * (the review measured 43.6% of six-seat voices below the cull), and the director's single
 * regen throttle was spent by far, SILENT regen — so the local player's own regen, 200 ms
 * later, did not play. Both only express at three or more seats; at two everything is near.
 *
 * The director is bundled with esbuild from `--root` (default: this tree), so the same file
 * runs RED against a clean HEAD worktree and GREEN against the fix:
 *
 *   node tools/tmp/b1_audio.mjs --root /private/tmp/fa-b1-head    # expect FAIL rows
 *   node tools/tmp/b1_audio.mjs                                   # expect all PASS
 *
 * The engine is a RECORDER (every `play` call, with its options) — the observable is "was a
 * voice scheduled", which is exactly what the cull promises about, and it needs no audio.
 *
 *   U  six hand-placed seats, one event at a time, listener at slot 0:
 *      U1 a cast 1,500 wu away schedules NOTHING              (HEAD: one voice at gain 0)
 *      U2 CONTROL a cast 100 wu away schedules exactly one, at the curve's gain
 *      U3 a far seat's silent regen does NOT eat the throttle: the local regen 200 ms later plays
 *      U4 CONTROL the throttle still holds two AUDIBLE regen ticks 200 ms apart to one voice
 *      U5 a far third party's death schedules nothing          (HEAD: a Critical voice at gain 0)
 *      U6 CONTROL your OWN death, with the ear moved 1,500 wu away, still plays at gain 1
 *      U7 a hit between two far seats schedules nothing
 *   C  corpus: real all-AI six-seat matches — zero voices below the cull, with the placed
 *      voices that remain asserted non-empty first (`[].every()` is true).
 */
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const HERE = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const TREE = resolve(String(flag('root', HERE)));
const MATCHES = Number(flag('matches', 6));

const dir = mkdtempSync(join(tmpdir(), 'b1-audio-'));
const entry = join(dir, 'entry.ts');
writeFileSync(entry, [
  `export { createMatch, stepMatch } from ${JSON.stringify(`${TREE}/src/game/sim.ts`)};`,
  `export { MatchAudio } from ${JSON.stringify(`${TREE}/src/audio/director.ts`)};`,
  `export * as RULES from ${JSON.stringify(`${TREE}/src/game/rules.ts`)};`,
  `export * as PROX from ${JSON.stringify(`${TREE}/src/proximity.ts`)};`,
].join('\n'));
const out = join(dir, 'bundle.mjs');
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { createMatch, stepMatch, MatchAudio, RULES, PROX } = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

const CULL = PROX.SFX_INAUDIBLE_GAIN;
const ARENA = JSON.parse(readFileSync(`${HERE}/tools/arena.gameplay.json`, 'utf8'));
let pass = 0; let fail = 0;
const check = (name, ok, detail) => {
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail !== undefined ? `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
};
console.log(`b1_audio — tree ${TREE} · SFX_INAUDIBLE_GAIN ${CULL}`);

// ── U: one event at a time on a hand-placed six-seat state ─────────────────────────
const mkEngine = () => { const rec = []; return { rec, play(_s, o = {}) { rec.push({ ...o }); return true; } }; };
const ids = RULES.CHARACTER_IDS;
// Slot 0 = the local seat/ear at (600, 600). Slot 1 near (100 wu). Slots 2-5 far.
const POS = [[600, 600], [700, 600], [2100, 600], [2100, 1500], [2300, 1700], [600, 1900]];
const mkState = () => {
  const st = createMatch(ARENA, POS.map(([x, y], i) => ({ characterId: ids[i % ids.length], controller: 'ai', spawn: { x, y }, level: RULES.LEVEL_MIN })));
  st.phase = 'playing';
  return st;
};
const st0 = mkState();
const dist = (i) => Math.hypot(st0.fighters[i].x - st0.fighters[0].x, st0.fighters[i].y - st0.fighters[0].y);
check('NON-VACUITY: six seats; slot 1 inside SFX_FULL_WU, slots 3-5 beyond SFX_FADE_WU (the curve reads 0 there)',
  st0.fighters.length === 6 && dist(1) < PROX.SFX_FULL_WU && [3, 4, 5].every((i) => dist(i) > PROX.SFX_FADE_WU),
  st0.fighters.map((_, i) => Math.round(dist(i))).join(' '));

/** A fresh director and recorder, primed so the once-per-match bed / ring latch are spent. */
const fresh = () => {
  const eng = mkEngine();
  const md = new MatchAudio(eng);
  const st = mkState();
  md.handleEvents([], st);
  eng.rec.length = 0;
  return { eng, md, st };
};
const roleOf = (i) => (i === 0 ? 'player' : 'enemy');
const weaponOf = (st, i) => RULES.CHARACTERS[st.fighters[i].characterId].weapons[0];
const castBy = (st, i) => ({ type: 'weapon-fired', fighterRole: roleOf(i), fighterId: i, weaponKey: weaponOf(st, i).key });
const keyed = (rec, prefix) => rec.filter((o) => typeof o.key === 'string' && o.key.startsWith(prefix));

{
  const { eng, md, st } = fresh();
  md.handleEvents([castBy(st, 3)], st);
  const casts = keyed(eng.rec, 'cast:');
  check('U1 a cast 1,500 wu from the ear schedules NO voice', casts.length === 0, casts);
}
{
  const { eng, md, st } = fresh();
  md.handleEvents([castBy(st, 1)], st);
  const casts = keyed(eng.rec, 'cast:');
  const want = PROX.proximityGain(dist(1), PROX.SFX_FULL_WU, PROX.SFX_FADE_WU);
  check('U2 CONTROL: a cast 100 wu away schedules exactly one voice, at the curve\'s gain', casts.length === 1 && casts[0].gain === want,
    { casts, want });
}
{
  const { eng, md, st } = fresh();
  const R = RULES.REGEN_AMOUNT;
  st.elapsed = 10_000;
  md.handleEvents([{ type: 'heal', fighterRole: roleOf(3), fighterId: 3, amount: R }], st);
  st.elapsed += 200;
  md.handleEvents([{ type: 'heal', fighterRole: roleOf(0), fighterId: 0, amount: R }], st);
  const heals = keyed(eng.rec, 'heal');
  check('U3 a far seat\'s SILENT regen does not spend the throttle: the local regen 200 ms later plays (audibly)',
    heals.length === 1 && heals[0].gain >= CULL, heals);
}
{
  const { eng, md, st } = fresh();
  const R = RULES.REGEN_AMOUNT;
  st.elapsed = 10_000;
  md.handleEvents([{ type: 'heal', fighterRole: roleOf(0), fighterId: 0, amount: R }], st);
  st.elapsed += 200;
  md.handleEvents([{ type: 'heal', fighterRole: roleOf(1), fighterId: 1, amount: R }], st);
  const heals = keyed(eng.rec, 'heal');
  check('U4 CONTROL: two AUDIBLE regen ticks 200 ms apart still voice once — the throttle survives', heals.length === 1, heals);
}
{
  const { eng, md, st } = fresh();
  md.handleEvents([{ type: 'death', fighterRole: roleOf(4), fighterId: 4 }], st);
  const deaths = eng.rec.filter((o) => o.key === undefined && o.pan !== undefined);
  check('U5 a third party\'s death 2,000 wu away schedules NO voice (it was a Critical voice at gain 0)', deaths.length === 0, deaths);
}
{
  const { eng, md, st } = fresh();
  md.setListener(3);
  md.handleEvents([{ type: 'death', fighterRole: roleOf(0), fighterId: 0 }], st);
  const deaths = eng.rec.filter((o) => o.key === undefined && o.pan !== undefined);
  check('U6 CONTROL: YOUR death with the ear moved 1,500 wu away still plays, at gain 1', deaths.length === 1 && deaths[0].gain === 1, deaths);
}
{
  const { eng, md, st } = fresh();
  const w = weaponOf(st, 3);
  md.handleEvents([{ type: 'hit-landed', targetRole: roleOf(4), targetId: 4, amount: 9, effect: null,
    source: { kind: 'weapon', weaponKey: w.key, weaponName: w.name, attackerId: 3 },
    x: st.fighters[4].x, y: st.fighters[4].y }], st);
  const hits = keyed(eng.rec, 'impact:');
  check('U7 a hit between two far seats schedules NO impact voice', hits.length === 0, hits);
}

// ── C: real six-seat matches ────────────────────────────────────────────────────
{
  const N = 6;
  let plays = 0; let below = 0; let placedAudible = 0;
  const byKey = {};
  for (let m = 0; m < MATCHES; m++) {
    const roster = Array.from({ length: N }, (_, k) => ids[(m + k * 3) % ids.length]);
    const st = createMatch(ARENA, roster.map((c, s) => ({ characterId: c, controller: 'ai', spawn: ARENA.spawns[s], level: RULES.LEVEL_MIN })));
    const eng = mkEngine();
    const md = new MatchAudio(eng);
    const inputs = new Array(N).fill(null);
    while (st.phase !== 'ended' && st.elapsed < RULES.MATCH_DURATION_MS * 2) md.handleEvents(stepMatch(st, 1000 / 60, inputs), st);
    for (const o of eng.rec) {
      plays++;
      if (typeof o.gain === 'number' && o.gain < CULL) { below++; const k = String(o.key ?? '(death)').split(':')[0]; byKey[k] = (byKey[k] ?? 0) + 1; }
      if (typeof o.gain === 'number' && o.gain >= CULL && o.gain < 1 && o.pan !== undefined) placedAudible++;
    }
  }
  check(`C NON-VACUITY: ${MATCHES} real six-seat matches scheduled voices, including audible PLACED ones`, plays > 100 && placedAudible > 0,
    { plays, placedAudible });
  check('C no voice is scheduled below SFX_INAUDIBLE_GAIN', below === 0, { below, share: plays ? `${(100 * below / plays).toFixed(1)}%` : '-', byKey });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
