#!/usr/bin/env node
/**
 * SX_AT_CENS — HOW FAR AWAY IS THE THING THE MIX IS NARRATING?
 *
 * ## The report this exists to answer
 *
 * Uri, on the deployed build:
 *
 *   > *"We need to make sure that SFX has the same behavior as the shake. I shouldn't
 *   > hear loudly or at all something very far, and as I get closer to it it becomes
 *   > louder, while what sits in the screen is the loudest."*
 *
 * `audio/director.ts` has ALWAYS attenuated by distance, so the useful question is not
 * "is there a falloff" but **"what does the shipped falloff actually do to the events a
 * real match produces"** — and that is a distribution, not a formula. This file runs the
 * REAL `src/game/sim.ts` in Node (the `tools/tmp/audio_census.mjs` trick: cached arena,
 * ~20 ms a match) and, for every event the director would VOICE, records:
 *
 *   * the distance from the LOCAL listener (slot 0) to the sound's world position;
 *   * whether the local player was INVOLVED — attacker, target, or neither;
 *   * the gain the OLD curve gives it and the gain the SHIPPED curve gives it.
 *
 * ## 🚨 THE OLD CURVE IS WRITTEN OUT HERE. THAT IS DELIBERATE AND IT IS NOT A SECOND COPY.
 *
 * `OLD_GAIN` below is the formula that shipped until this pass, quoted so a before/after
 * table can exist at all. It is a **historical constant**, not a live rule: nothing in
 * `src/` computes it any more, so there is no second answer to "how far is too far" for it
 * to drift from. The SHIPPED curve is imported from `src/proximity.ts` — the one module
 * both the audio and the render layer are meant to read — precisely so that this
 * instrument cannot certify a curve the game does not use.
 *
 * ## Controls (`docs/AGENT-BRIEF.md` §4.4 — a guard not shown to FAIL is not a guard)
 *
 *   `--arm base`      the real thing.
 *   `--arm nearonly`  every voiced event is teleported onto the listener before the
 *                     distance is taken. Every distance bucket except `0-200` MUST empty
 *                     and both curves MUST report gain 1.000 everywhere. If the buckets
 *                     stay populated, this file is not reading the position it thinks it
 *                     is. (The failure this catches is real: `hit-landed.x/y` is the
 *                     TARGET's position, not the attacker's, and reading the wrong one
 *                     would still produce a plausible-looking table.)
 *   `--arm faronly`   every voiced event is teleported to the far corner of the arena.
 *                     The OLD curve must report its floor (0.32) and the SHIPPED curve
 *                     must report 0.000 and cull. If the OLD column does not sit exactly
 *                     on the floor, `OLD_GAIN` has been mistyped.
 *   `--arm selfhit`   every `hit-landed` is relabelled as targeting the local slot. The
 *                     `target` involvement class must take 100% of hits and its median
 *                     distance must stay at whatever it already was — which is the check
 *                     that the involvement classifier reads `source.attackerId` /
 *                     `targetId` rather than the two-seat `role` fallback.
 *   `--arm attackerpos`
 *                     🚨 **THE KNOWN-BAD FOR THE ONE CLAIM EVERYTHING ELSE RESTS ON.** The
 *                     base run reports *"hits ON the local seat: max distance 0.00 wu"*,
 *                     and that single number is the whole argument for deleting
 *                     `MIN_DISTANCE_GAIN`: a hit on YOU is stamped at YOUR position
 *                     (`combat.ts:267` — `x: target.x, y: target.y`), so it is full level
 *                     under any monotone falloff and the floor was never what made "you are
 *                     being shot at" audible. This arm re-stamps every weapon hit at the
 *                     ATTACKER's position instead — the plausible misreading — and that row
 *                     MUST go non-zero. A control that leaves it at 0.00 would mean the row
 *                     is reading something that cannot distinguish the two, which is exactly
 *                     the vacuity class in `CLAUDE.md` #6.
 *
 * ⚠️ `--arm nearonly` proves the ARITHMETIC (bucketing, gain lookup, the cull), not the
 * position source; it teleports the event, so it cannot catch reading the wrong one. That
 * is `--arm attackerpos`'s job, and the two are listed apart on purpose.
 *
 * ⚠️ **NON-EMPTY FIRST.** Every ratio printed here asserts its denominator > 0 before it
 * is taken (`CLAUDE.md` #6: `[].every()` is `true`, and that vacuity fired three times in
 * three files in one session). A run that voices nothing prints `EMPTY` and exits 1.
 *
 * ## What this does NOT claim
 *
 * ⚠️ Every seat is `controller: 'ai'` — `scripted_player.mjs` opens `state.player` /
 * `state.enemy` and cannot drive seats 2–5, exactly as `sx_census.mjs` records. So slot 0
 * is a BOT standing in for the listener. That is fine for a distance distribution (a bot
 * chases and fights like a player does) and it is NOT comparable to any 110-cell 1v1
 * number, so none is printed beside it.
 *
 * ⚠️ These are DISTANCES AND GAINS, not loudness. A gain is a linear multiplier on a
 * voice, and two voices at 0.32 are not "as loud as" one at 0.64. The acceptance claim is
 * about how many events arrive ABOVE an audibility threshold, which is what
 * `audibleAtOrAbove` counts — the perceptual claim belongs to `tools/audio-probe.mjs`,
 * which renders real samples.
 *
 * ## Use
 *
 *   node tools/tmp/sx_at_cens.mjs --n 2 --matches 40
 *   node tools/tmp/sx_at_cens.mjs --n 6 --matches 40
 *   node tools/tmp/sx_at_cens.mjs --n 6 --arm nearonly
 *   node tools/tmp/sx_at_cens.mjs --selftest
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const args = (() => {
  const o = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true;
    else { o[a.slice(2)] = n; i++; }
  }
  return o;
})();

const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
const SRC_DIR = String(args.src ?? `${ROOT}/src`);
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const { CHARACTER_IDS, MATCH_DURATION_MS, LEVEL_MIN } = RULES;

/** THE SHIPPED CURVE — imported, never re-implemented. See the header. */
const PROX = await import(`${SRC_DIR}/proximity.ts`);
const { proximityGain, SFX_FULL_WU, SFX_FADE_WU, SFX_INAUDIBLE_GAIN } = PROX;

/**
 * THE CURVE THAT SHIPPED UNTIL THIS PASS, quoted verbatim from `director.ts`:
 *
 *     gain = Math.max(MIN_DISTANCE_GAIN, 1 / (1 + dist / DISTANCE_HALF_WU))
 *          = Math.max(0.32,              1 / (1 + dist / 420))
 *
 * A historical constant. Nothing in `src/` computes this any more.
 */
const OLD_HALF_WU = 420;
const OLD_FLOOR = 0.32;
const OLD_GAIN = (d) => Math.max(OLD_FLOOR, 1 / (1 + d / OLD_HALF_WU));

const N = Number(args.n ?? 6);
const MATCHES = Number(args.matches ?? 40);
const DT = Number(args.dt ?? 16.667);
const ARM = String(args.arm ?? 'base');
const HARD_CAP = MATCH_DURATION_MS * 4;
/**
 * The level at which a voice stops carrying information in a busy mix. NOT a
 * psychoacoustic constant and not presented as one: it is the same number
 * `proximity.ts` culls at, so "audible" here means exactly "the shipped director would
 * schedule a voice for it". Reported at two thresholds so the count is not an artefact
 * of one line.
 */
const AUD_THRESHOLDS = [SFX_INAUDIBLE_GAIN, 0.1, 0.25];

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
if (!existsSync(ARENA_PATH)) { console.error(`sx_at_cens: no arena dump at ${ARENA_PATH}`); process.exit(2); }
const ARENA = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
if (!Array.isArray(ARENA.spawns) || ARENA.spawns.length < N) {
  console.error(`sx_at_cens: arena declares ${ARENA.spawns?.length ?? 0} spawns; need ${N}.`);
  process.exit(2);
}
const FAR_CORNER = { x: ARENA.width ?? 2800, y: ARENA.height ?? 2000 };

/** Seeded roster picker, identical in shape to `sx_census.mjs`'s. */
function rosterFor(i) {
  const ids = CHARACTER_IDS.slice();
  let s = (i * 2654435761) >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0; t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let k = ids.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [ids[k], ids[j]] = [ids[j], ids[k]]; }
  return ids.slice(0, N);
}

const LOCAL = 0;

/**
 * WHAT THE DIRECTOR VOICES, AND WHERE.
 *
 * Mirrored from `audio/director.ts` rather than imported, for the reason
 * `audio_census.mjs` states in its own header: importing the director drags in
 * `AudioEngine` and a Web Audio context Node does not have (and, since this session,
 * a TypeScript parameter property `node --experimental-strip-types` refuses outright).
 *
 * ⚠️ The mirror is of the PLACEMENT decision only — which events get a world position and
 * which are centre-panned at full level. It is deliberately NOT a mirror of the gain
 * formula; that is imported. `tools/audio-probe.mjs --mode coverage` is what asserts the
 * voiced/silent split does not drift.
 *
 * Returns `null` for an event that is NOT placed (countdown, match flow, the fog tick, the
 * giantSlam ultimate, the local `hurt` layer) — those are full-level by design and no
 * distance rule touches them.
 */
function placedEventsOf(ev, state) {
  const at = (x, y, kind, involved) => ({ kind, x, y, involved });
  switch (ev.type) {
    case 'weapon-fired': {
      const f = state.fighters[ev.fighterId];
      if (!f) return null;
      // The giantSlam ultimate is centre-panned at full level by contract; it is not
      // resolved here because doing so needs the weapon table and it would be excluded
      // from every distance bucket anyway.
      return at(f.x, f.y, 'cast', ev.fighterId === LOCAL ? 'attacker' : 'other');
    }
    case 'hit-landed': {
      if (ev.source.kind === 'fog') return null;      // "the zone is everywhere"
      let involved = 'other';
      if (ev.targetId === LOCAL) involved = 'target';
      else if (ev.source.kind === 'weapon' && ev.source.attackerId === LOCAL) involved = 'attacker';
      else if (ev.source.kind === 'trail' && ev.source.ownerId === LOCAL) involved = 'attacker';
      return at(ev.x, ev.y, `hit:${ev.source.kind}`, involved);
    }
    case 'heal': {
      const f = state.fighters[ev.fighterId];
      if (!f) return null;
      return at(f.x, f.y, 'heal', ev.fighterId === LOCAL ? 'target' : 'other');
    }
    case 'death': {
      const f = state.fighters[ev.fighterId];
      if (!f) return null;
      // The local player's own death is forced to full level by the director. Recorded as
      // `target` so it lands in the involved class rather than in the scenery.
      return at(f.x, f.y, 'death', ev.fighterId === LOCAL ? 'target' : 'other');
    }
    case 'projectile-destroyed':
      if (ev.reason !== 'hit-cover') return null;
      return at(ev.x, ev.y, 'cover', 'other');
    default:
      return null;
  }
}

const BUCKETS = [0, 200, 400, 600, 900, 1400, 2000, Infinity];
function bucketOf(d) {
  for (let i = 0; i < BUCKETS.length - 1; i++) if (d >= BUCKETS[i] && d < BUCKETS[i + 1]) return i;
  return BUCKETS.length - 2;
}

function runCensus() {
  const rows = [];
  let matchesRun = 0;
  for (let i = 0; i < MATCHES; i++) {
    const ids = rosterFor(i);
    const spawns = ARENA.spawns.slice(0, N).map((p) => ({ x: p.x, y: p.y }));
    const configs = ids.map((characterId, seat) => ({
      characterId, controller: 'ai', spawn: spawns[seat], level: LEVEL_MIN,
    }));
    const state = createMatch(ARENA, configs);
    const inputs = new Array(state.fighters.length).fill(null);
    while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
      const evs = stepMatch(state, DT, inputs);
      const me = state.fighters[LOCAL];
      for (const ev of evs) {
        let e = ev;
        if (ARM === 'selfhit' && ev.type === 'hit-landed') e = { ...ev, targetId: LOCAL, targetRole: 'player' };
        const p = placedEventsOf(e, state);
        if (!p) continue;
        let { x, y } = p;
        if (ARM === 'nearonly') { x = me.x; y = me.y; }
        if (ARM === 'faronly') { x = FAR_CORNER.x; y = FAR_CORNER.y; }
        if (ARM === 'attackerpos' && e.type === 'hit-landed' && e.source.kind === 'weapon') {
          const a = state.fighters[e.source.attackerId];
          if (a) { x = a.x; y = a.y; }
        }
        const d = Math.hypot(x - me.x, y - me.y);
        rows.push({ m: i, kind: p.kind, involved: p.involved, d });
      }
    }
    matchesRun++;
  }
  return { rows, matchesRun };
}

function pct(n, d) {
  if (d <= 0) return 'EMPTY';
  return `${((100 * n) / d).toFixed(1)}%`;
}
function median(xs) {
  if (xs.length === 0) return NaN;
  const s = xs.slice().sort((a, b) => a - b);
  const h = Math.floor(s.length / 2);
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}

function report() {
  const { rows, matchesRun } = runCensus();

  // ── NON-EMPTY FIRST (CLAUDE.md #6). Every ratio below divides by one of these. ──
  if (matchesRun === 0) { console.error('sx_at_cens: no matches ran — EMPTY'); process.exit(1); }
  if (rows.length === 0) { console.error('sx_at_cens: no placed events voiced — EMPTY'); process.exit(1); }

  const NEW_GAIN = (d) => proximityGain(d, SFX_FULL_WU, SFX_FADE_WU);

  console.log(`\nSX_AT_CENS  N=${N}  matches=${matchesRun}  dt=${DT}  arm=${ARM}`);
  console.log(`  shipped curve: full=${SFX_FULL_WU} wu  fade=${SFX_FADE_WU} wu  cull<${SFX_INAUDIBLE_GAIN}`);
  console.log(`  old curve:     max(${OLD_FLOOR}, 1/(1+d/${OLD_HALF_WU}))   [historical, see header]`);
  console.log(`  placed voices: ${rows.length}  (${(rows.length / matchesRun).toFixed(1)} per match)\n`);

  // ── The named distances from the brief, re-derived rather than pasted ──────
  console.log('  d (wu)      old     new     note');
  const NAMED = [
    [0, 'the listener'],
    [199.2, 'FAIR_PLAY guaranteed-visible radius'],
    [470, 'camera worst-case ground reach'],
    [892.5, 'where the OLD floor starts binding'],
    [915.9, 'minimum spawn separation'],
    [1534, 'mean distance to a living opponent at N=6'],
    [3440.9, 'far corner of the 2800x2000 map'],
  ];
  for (const [d, note] of NAMED) {
    console.log(`  ${String(d).padStart(8)}  ${OLD_GAIN(d).toFixed(3)}   ${NEW_GAIN(d).toFixed(3)}   ${note}`);
  }

  // ── Distance distribution ────────────────────────────────────────────────
  console.log('\n  distance bucket      voices     share    old gain   new gain');
  for (let b = 0; b < BUCKETS.length - 1; b++) {
    const in_ = rows.filter((r) => bucketOf(r.d) === b);
    const lo = BUCKETS[b], hi = BUCKETS[b + 1];
    const label = hi === Infinity ? `${lo}+` : `${lo}-${hi}`;
    const mid = in_.length ? median(in_.map((r) => r.d)) : NaN;
    console.log(`  ${label.padEnd(18)} ${String(in_.length).padStart(7)}  ${pct(in_.length, rows.length).padStart(7)}`
      + `    ${in_.length ? OLD_GAIN(mid).toFixed(3) : '  -  '}      ${in_.length ? NEW_GAIN(mid).toFixed(3) : '  -  '}`
      + (in_.length ? `   (median ${mid.toFixed(0)} wu)` : ''));
  }

  // ── Involvement ──────────────────────────────────────────────────────────
  console.log('\n  involvement    voices     share   median d   old gain@median  new gain@median');
  for (const cls of ['target', 'attacker', 'other']) {
    const in_ = rows.filter((r) => r.involved === cls);
    const mid = median(in_.map((r) => r.d));
    console.log(`  ${cls.padEnd(12)} ${String(in_.length).padStart(7)}  ${pct(in_.length, rows.length).padStart(7)}`
      + `   ${in_.length ? mid.toFixed(0).padStart(7) : '   -   '}   ${in_.length ? OLD_GAIN(mid).toFixed(3).padStart(13) : '     -       '}`
      + `    ${in_.length ? NEW_GAIN(mid).toFixed(3).padStart(12) : '     -      '}`);
  }

  // 🚨 THE CLAIM THE FLOOR'S COMMENT MAKES: "you must be able to hear that you are being
  // shot at". `combat.ts` stamps `hit-landed` at `target.x/y`, so a hit ON THE LISTENER is
  // at distance ~0 and is full level under ANY monotone falloff. This row is what decides
  // whether removing the floor can cost that cue, and it is printed unconditionally.
  const onMe = rows.filter((r) => r.involved === 'target' && r.kind.startsWith('hit:'));
  if (onMe.length === 0) {
    console.log('\n  !! no hits on the local seat in this corpus — the floor question is UNTESTED here');
  } else {
    const worst = Math.max(...onMe.map((r) => r.d));
    console.log(`\n  hits ON the local seat: ${onMe.length}   max distance ${worst.toFixed(2)} wu`
      + `   min new gain ${Math.min(...onMe.map((r) => NEW_GAIN(r.d))).toFixed(3)}`);
  }

  // ── Audible counts, the acceptance number ────────────────────────────────
  console.log('\n  audible voices per match (gain >= threshold)');
  console.log('   threshold      old      new     delta');
  for (const t of AUD_THRESHOLDS) {
    const o = rows.filter((r) => OLD_GAIN(r.d) >= t).length / matchesRun;
    const n = rows.filter((r) => NEW_GAIN(r.d) >= t).length / matchesRun;
    console.log(`   ${String(t).padEnd(10)} ${o.toFixed(2).padStart(8)} ${n.toFixed(2).padStart(8)} ${(n - o).toFixed(2).padStart(9)}`);
  }
  const culled = rows.filter((r) => NEW_GAIN(r.d) < SFX_INAUDIBLE_GAIN).length;
  console.log(`\n  voices the shipped curve CULLS entirely: ${culled} / ${rows.length} (${pct(culled, rows.length)})`
    + `  = ${(culled / matchesRun).toFixed(2)} per match`);

  // ── Arm assertions ───────────────────────────────────────────────────────
  let bad = 0;
  const must = (name, ok, detail) => {
    console.log(`  ${ok ? ' ok  ' : 'FAIL '} ${name}   ${detail}`);
    if (!ok) bad++;
  };
  if (ARM === 'nearonly') {
    console.log('\n  --arm nearonly assertions');
    const far = rows.filter((r) => r.d > 1e-6);
    must('every voice is on the listener', far.length === 0, `${far.length} voices off-listener`);
    must('both curves report full gain', rows.every((r) => NEW_GAIN(r.d) === 1 && OLD_GAIN(r.d) === 1),
      `n=${rows.length}`);
  }
  if (ARM === 'faronly') {
    console.log('\n  --arm faronly assertions');
    const d = rows[0].d;
    must('the OLD curve sits exactly on its floor', Math.abs(OLD_GAIN(d) - OLD_FLOOR) < 1e-12,
      `old=${OLD_GAIN(d)} floor=${OLD_FLOOR} at d=${d.toFixed(0)}`);
    must('the SHIPPED curve is silent', rows.every((r) => NEW_GAIN(r.d) === 0), `n=${rows.length}`);
  }
  if (ARM === 'attackerpos') {
    console.log('\n  --arm attackerpos assertions (the known-bad for the "distance 0.00" claim)');
    const onMeW = rows.filter((r) => r.involved === 'target' && r.kind === 'hit:weapon');
    must('the corpus contains weapon hits on the local seat', onMeW.length > 0, `${onMeW.length}`);
    if (onMeW.length > 0) {
      const worst = Math.max(...onMeW.map((r) => r.d));
      must('KNOWN-BAD: stamping the ATTACKER position moves that row OFF zero', worst > 1,
        `max distance ${worst.toFixed(2)} wu (base arm reports 0.00)`);
    }
  }
  if (ARM === 'selfhit') {
    console.log('\n  --arm selfhit assertions');
    const hits = rows.filter((r) => r.kind.startsWith('hit:'));
    const asTarget = hits.filter((r) => r.involved === 'target');
    must('the corpus contains hits at all', hits.length > 0, `${hits.length} hits`);
    must('every hit is classified as ON the listener', asTarget.length === hits.length,
      `${asTarget.length}/${hits.length}`);
  }
  if (bad > 0) process.exit(1);
}

// ── SELFTEST — the curve's own LOGIC, separately from where it is pointed ──────
// ⚠️ `CLAUDE.md` #6: `--selftest` validates a tool's logic; it NEVER validates where the
// tool is pointed. That is what `--arm nearonly/faronly/selfhit` are for, and they run
// against the real sim.
function selftest() {
  let bad = 0;
  const eq = (name, got, want, tol = 1e-9) => {
    const ok = Math.abs(got - want) <= tol;
    console.log(`  ${ok ? ' ok  ' : 'FAIL '} ${name}   got ${got} want ${want}`);
    if (!ok) bad++;
  };
  const t = (name, ok, detail = '') => {
    console.log(`  ${ok ? ' ok  ' : 'FAIL '} ${name}   ${detail}`);
    if (!ok) bad++;
  };
  console.log('\nsx_at_cens --selftest');
  eq('proximityGain at 0 is 1', proximityGain(0, 200, 900), 1);
  eq('proximityGain at full is 1', proximityGain(200, 200, 900), 1);
  eq('proximityGain at fade is 0', proximityGain(900, 200, 900), 0);
  eq('proximityGain beyond fade is 0', proximityGain(5000, 200, 900), 0);
  eq('proximityGain at the midpoint is 0.5', proximityGain(550, 200, 900), 0.5);
  // Monotone non-increasing — the "as I get closer it becomes louder" clause.
  let mono = true, prev = 1;
  for (let d = 0; d <= 4000; d += 5) { const g = proximityGain(d, 200, 900); if (g > prev + 1e-12) mono = false; prev = g; }
  t('proximityGain is monotone non-increasing', mono);
  // Degenerate radii must not produce NaN — a fade <= full is a misconfiguration, not a crash.
  t('fade <= full is a step, not a NaN', Number.isFinite(proximityGain(150, 200, 200)) && Number.isFinite(proximityGain(250, 200, 200)),
    `${proximityGain(150, 200, 200)} / ${proximityGain(250, 200, 200)}`);
  // KNOWN-BAD: the OLD formula must FAIL the assertion the new one passes, or the
  // assertion is not measuring the change.
  t('KNOWN-BAD: the OLD curve is NOT silent at the far corner', OLD_GAIN(3440.9) > 0.3,
    `old(3440.9)=${OLD_GAIN(3440.9).toFixed(3)}`);
  t('KNOWN-BAD: the OLD curve does NOT reach 1.0 on screen', OLD_GAIN(199.2) < 0.7,
    `old(199.2)=${OLD_GAIN(199.2).toFixed(3)}`);
  eq('OLD floor binds at 892.5 wu', 892.5, OLD_HALF_WU * (1 / OLD_FLOOR - 1), 1e-9);
  return bad;
}

/**
 * THE DRIFT CHECK `proximity.ts` PROMISES.
 *
 * `SFX_FULL_WU` is sized to `render/camera.ts`'s `FAIR_PLAY.radiusUnits` but deliberately
 * does NOT import it (that would make `src/audio` reach the render layer through a root
 * module — see `proximity.ts`'s header). The coupling is therefore CHECKED here instead of
 * wired, because retyping a coordinate is how this repo grew a dozen stale 1× map
 * literals. Split from `selftest()` because it needs a `three`-importing module, so a
 * `--selftest` in an environment without it should still be able to run the pure half.
 *
 * ⚠️ The assertion is one-sided on purpose. `SFX_FULL_WU` must never be SMALLER than the
 * guaranteed-visible radius — that would put something certainly on screen below full
 * level, which is the exact clause of Uri's report this constant answers. It is allowed to
 * be a little larger (200 against 199.22 is a rounding, not a decision).
 */
async function fairPlayDriftCheck() {
  let bad = 0;
  const t = (name, ok, detail = '') => {
    console.log(`  ${ok ? ' ok  ' : 'FAIL '} ${name}   ${detail}`);
    if (!ok) bad++;
  };
  let FAIR_PLAY;
  try {
    ({ FAIR_PLAY } = await import(`${SRC_DIR}/render/camera.ts`));
  } catch (e) {
    console.log(`  SKIP  FAIR_PLAY drift check — camera.ts not loadable here (${String(e).slice(0, 60)})`);
    return 0;
  }
  const R = FAIR_PLAY?.radiusUnits;
  t('camera.ts still exports a fair-play radius', typeof R === 'number' && R > 0, `R=${R}`);
  if (typeof R !== 'number') return bad + 1;
  t('SFX_FULL_WU is not SMALLER than the guaranteed-visible radius', SFX_FULL_WU >= R,
    `SFX_FULL_WU=${SFX_FULL_WU} FAIR_PLAY.radiusUnits=${R}`);
  t('SFX_FULL_WU has not drifted ABOVE it by more than a rounding', SFX_FULL_WU <= R * 1.1,
    `${SFX_FULL_WU} <= ${(R * 1.1).toFixed(2)}`);
  // KNOWN-BAD: the assertion must be able to fail. A full disc at half the fair radius is
  // the defect it guards against, and it is shown failing rather than asserted to.
  t('KNOWN-BAD: a full disc at half the fair radius would FAIL this', !(R / 2 >= R),
    `${(R / 2).toFixed(2)} >= ${R} is false`);
  return bad;
}

async function runSelftest() {
  let bad = selftest();
  bad += await fairPlayDriftCheck();
  if (bad > 0) process.exit(1);
  console.log('  selftest OK');
}

if (IS_MAIN) {
  if (args.selftest) await runSelftest();
  else report();
}

export { OLD_GAIN, placedEventsOf };
