#!/usr/bin/env node
/**
 * SH_DIST — HOW FAR AWAY IS THE THING THAT SHOOK YOUR CAMERA?
 *
 * Uri, playing the deployed six-fighter build:
 *
 *   > "The VFX of screen shaking a bit due to explosions, while playing 6, causes the
 *   >  screen to shake a lot. We need to make sure that the shake only happens when the
 *   >  proximity is close."
 *
 * `match.ts` has three camera-kick sites — `hit-landed`, `death`, and Giant Lollipop's
 * slam cast — and **none of them carried a distance term**. Shake was a function of
 * damage and one boolean (was the victim the local seat). At two seats every hit
 * involves you, so "local" and "close" were the same predicate and the missing term
 * could not express itself. At six seats there are up to fifteen pairwise fights and
 * `lu2_offscreen` already measured the consequence for the HUD: **63.7–82.9% of opponent
 * HP pills drawn at six seats belonged to a fighter outside the frame, mean separation
 * 1 534 wu.** This file measures the same geometry for the CAMERA.
 *
 * ## What it is, and what it is not
 *
 * This is the DESIGN instrument: it produces the distance distribution the falloff has
 * to be chosen against, from real matches through the real `sim.ts`, and then scores
 * candidate curves on it. It is NOT the acceptance test — that is `sh_shake.mjs`, which
 * reads the shipped `FeelDebug` accumulators out of a running browser and therefore
 * measures the code rather than a model of it.
 *
 * 🚨 **THE KICK AMPLITUDES BELOW ARE A COPY OF `match.ts`, AND A COPY IS A LIABILITY.**
 * `match.ts` cannot be imported from Node (it uses TypeScript parameter properties, which
 * Node's strip-only mode refuses), so the three amplitude formulas are transcribed. That
 * makes every number here a claim about a MODEL. The claim is closed the only way it can
 * be: `sh_shake.mjs --arm play` reads `__feelDebug.shakeRawSumM` / `.shakeSumM` from the
 * real renderer, and the ratio it reports must land on the ratio predicted here. If they
 * disagree, believe the browser.
 * ⚠️ The falloff itself is NOT copied — `shakeProximityScale` is imported from the shipped
 * `src/render/camera.ts`, which is why that file's imports carry `.ts` extensions.
 *
 * ## Arms
 *
 *   --n 6            seats. Run 2 and 6; 2 is the control, and it is a real control:
 *                    every WEAPON hit at two seats is provably inside the full-strength
 *                    radius (max threat reach is 165.2 wu against a 199.22 wu disc), so a
 *                    correct falloff must leave it almost exactly alone.
 *   --arm base       the shipped six spawns.
 *   --arm nearonly   KNOWN-BAD for the "N=6 is far away" claim: every seat is spawned
 *                    within 60 wu of slot 0. If the far-event share stays high here, the
 *                    distance column is not reading the fighters' positions at all.
 *   --sweep          score a grid of (fade radius, floor) candidates on the corpus.
 *
 *   node tools/tmp/sh_dist.mjs --n 6 --matches 40
 *   node tools/tmp/sh_dist.mjs --n 6 --sim /private/tmp/fa-clean/src/game --camera /private/tmp/fa-clean/src/render/camera.ts
 */
import { existsSync, readFileSync } from 'node:fs';
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
const N = Number(args.n ?? 6);
const MATCHES = Number(args.matches ?? 40);
const DT = Number(args.dt ?? 16.667);
const ARM = String(args.arm ?? 'base');

const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const { CHARACTER_IDS, LEVEL_MIN, MATCH_DURATION_MS } = RULES;

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
if (!existsSync(ARENA_PATH)) { console.error(`sh_dist: no arena dump at ${ARENA_PATH}`); process.exit(2); }
const ARENA = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));

// ── THE SHIPPED AMPLITUDES, TRANSCRIBED (see the header's warning) ──────────
const SHAKE_MAX_M = 0.40;                       // match.ts GameSession.SHAKE_MAX_M
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** `hit-landed`: match.ts:1393-1395. */
function hitAmp(damage, isWeapon, isLocalTarget) {
  const base = clamp(0.012 + damage * 0.0175, 0.012, SHAKE_MAX_M);
  return Math.min(base * (isLocalTarget ? 1.25 : 1) * (isWeapon ? 1 : 0.45), SHAKE_MAX_M);
}
const DEATH_AMP = Math.min(0.42, SHAKE_MAX_M);  // match.ts:1450
const SLAM_AMP = Math.min(0.55, SHAKE_MAX_M);   // match.ts:1292
// The decay each site asks `rig.shake` for. `undefined` is `CameraRig.shake`'s own 4.5.
const HIT_DECAY = 4.5, DEATH_DECAY = 3, SLAM_DECAY = 2.6;

function rosterFor(i) {
  const ids = CHARACTER_IDS.slice();
  let s = (i * 2654435761) >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0; t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let k = ids.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [ids[k], ids[j]] = [ids[j], ids[k]]; }
  // Giant Lollipop is FORCED into every roster: it owns the only `giantSlam` weapon and
  // therefore the only 0.40 m cast-time kick. A seeded shuffle drops it from most rosters
  // and the slam row would then be silently empty — the `[].every()` vacuity class.
  const out = ids.slice(0, N);
  if (!out.includes('lollipop')) out[out.length - 1] = 'lollipop';
  return out;
}

function spawnsFor(arm) {
  const shipped = ARENA.spawns.slice(0, N).map((p) => ({ x: p.x, y: p.y }));
  if (arm !== 'nearonly') return shipped;
  const a = shipped[0];
  return shipped.map((_, k) => ({ x: a.x + (k % 3) * 24 - 24, y: a.y + Math.floor(k / 3) * 24 - 24 }));
}

/** Every camera kick one match asks for: kind, requested amplitude, distance from slot 0. */
function runMatch(i, arm) {
  const ids = rosterFor(i);
  const spawns = spawnsFor(arm);
  const configs = ids.map((characterId, seat) => ({
    characterId, controller: 'ai', spawn: spawns[seat], level: LEVEL_MIN,
  }));
  const state = createMatch(ARENA, configs);
  const inputs = new Array(state.fighters.length).fill(null);
  const kicks = [];
  const HARD_CAP = MATCH_DURATION_MS * 4;
  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    const evs = stepMatch(state, DT, inputs);
    // The renderer handles events AFTER the step, reading post-step positions
    // (`match.ts:handleEvents` -> `fightersOf(this.state)[targetSlot]`), so this does too.
    const me = state.fighters[0];
    for (const ev of evs) {
      if (ev.type === 'hit-landed') {
        const v = state.fighters[ev.targetId];
        if (!v) continue;
        kicks.push({ kind: `hit:${ev.source.kind}`, amp: hitAmp(ev.amount, ev.source.kind === 'weapon', ev.targetId === 0),
          d: Math.hypot(v.x - me.x, v.y - me.y), t: state.elapsed, decay: HIT_DECAY });
      } else if (ev.type === 'death') {
        const v = state.fighters[ev.fighterId];
        if (!v) continue;
        kicks.push({ kind: 'death', amp: DEATH_AMP, d: Math.hypot(v.x - me.x, v.y - me.y), t: state.elapsed, decay: DEATH_DECAY });
      } else if (ev.type === 'weapon-fired') {
        const f = state.fighters[ev.fighterId];
        if (!f) continue;
        const def = RULES.CHARACTERS[f.characterId];
        const w = def.weapons.find((x) => x.key === ev.weaponKey);
        if (!w?.giantSlam) continue;
        kicks.push({ kind: 'slam', amp: SLAM_AMP, d: Math.hypot(f.x - me.x, f.y - me.y), t: state.elapsed, decay: SLAM_DECAY });
      }
    }
  }
  return { kicks, durationMs: state.elapsed };
}

function pct(sorted, p) {
  if (!sorted.length) return NaN;
  const k = clamp(Math.round((p / 100) * (sorted.length - 1)), 0, sorted.length - 1);
  return sorted[k];
}

async function main() {
  const CAMERA = String(args.camera ?? `${ROOT}/src/render/camera.ts`);
  let cam = null;
  try { cam = await import(pathToFileURL(CAMERA).href); } catch (e) { cam = null; var camErr = e; }

  const all = [];
  const perMatch = [];
  for (let i = 0; i < MATCHES; i++) { const m = runMatch(i, ARM); perMatch.push(m); all.push(...m.kicks); }

  // 🚨 NON-EMPTY FIRST. Every row below filters this set; `[].every()` is `true` and a
  // corpus that produced no kicks would print a perfect table (CLAUDE.md rule 6).
  if (all.length === 0) { console.error('sh_dist: ZERO kicks over the corpus — nothing below means anything.'); process.exit(2); }

  const ds = all.map((k) => k.d).sort((a, b) => a - b);
  const rawSum = all.reduce((s, k) => s + k.amp, 0);
  console.log(`\n══ SH_DIST  N=${N}  arm=${ARM}  matches=${MATCHES}  dt=${DT} ══`);
  console.log(`kicks ${all.length}  (${(all.length / MATCHES).toFixed(1)}/match)   raw shake asked for: ${rawSum.toFixed(2)} m  (${(rawSum / MATCHES).toFixed(3)} m/match)`);
  console.log(`distance from slot 0, wu:  p05 ${pct(ds,5).toFixed(0)}  p25 ${pct(ds,25).toFixed(0)}  median ${pct(ds,50).toFixed(0)}  p75 ${pct(ds,75).toFixed(0)}  p95 ${pct(ds,95).toFixed(0)}  max ${ds[ds.length-1].toFixed(0)}`);

  const byKind = new Map();
  for (const k of all) {
    const r = byKind.get(k.kind) ?? { n: 0, amp: 0, ds: [] };
    r.n++; r.amp += k.amp; r.ds.push(k.d); byKind.set(k.kind, r);
  }
  console.log('\nby kind:');
  for (const [kind, r] of [...byKind].sort((a, b) => b[1].amp - a[1].amp)) {
    const s = r.ds.sort((a, b) => a - b);
    console.log(`  ${kind.padEnd(12)} n=${String(r.n).padStart(6)}  rawM=${r.amp.toFixed(2).padStart(8)}  (${(100*r.amp/rawSum).toFixed(1).padStart(5)}% of energy)  median d=${pct(s,50).toFixed(0).padStart(5)} wu  p95 d=${pct(s,95).toFixed(0).padStart(5)} wu`);
  }

  if (!cam) { console.log(`\n(no camera module at ${CAMERA}: ${camErr?.message?.slice(0,120)})`); return; }
  const FULL = cam.FAIR_PLAY.radiusUnits;
  const rig = new cam.CameraRig({ pitchDeg: 58, yawDeg: 0, frameMode: 'fair' });
  const FADE = rig.shakeFadeRadiusUnits ? rig.shakeFadeRadiusUnits() : null;
  console.log(`\nradii from source: full=${FULL.toFixed(2)} wu (FAIR_PLAY.radiusUnits)  fade=${FADE === null ? 'n/a (pre-change tree)' : FADE.toFixed(2) + ' wu'}`);
  const inFull = all.filter((k) => k.d <= FULL);
  console.log(`inside full radius: ${inFull.length}/${all.length} kicks = ${(100*inFull.length/all.length).toFixed(1)}%   ${(100*inFull.reduce((s,k)=>s+k.amp,0)/rawSum).toFixed(1)}% of the energy`);
  if (FADE !== null) {
    const beyond = all.filter((k) => k.d >= FADE);
    console.log(`beyond fade radius: ${beyond.length}/${all.length} kicks = ${(100*beyond.length/all.length).toFixed(1)}%   ${(100*beyond.reduce((s,k)=>s+k.amp,0)/rawSum).toFixed(1)}% of the energy`);
  }

  if (!cam.shakeProximityScale) { console.log('(pre-change tree: no shakeProximityScale to score)'); return; }
  const score = (fade, floor) => {
    let sum = 0;
    for (const k of all) sum += k.amp * cam.shakeProximityScale(k.d, fade, floor);
    return sum / rawSum;
  };
  // ── WHAT THE CAMERA ACTUALLY DOES WITH IT, AT 60 fps, THROUGH THE SHIPPED INTEGRATOR ──
  //
  // 🚨 THE BROWSER CANNOT ANSWER THIS AND IT IS NOT OBVIOUS WHY. `match.ts:loop` hands
  // `rig.update` `min(realDelta, 1/20) * simSpeed` seconds, and the shake decays by
  // `decay * amount * dt` per frame. Under SwiftShader a frame is ~450 ms, so the clamp
  // gives dt = 0.05 s and `?simSpeed=6` multiplies it to 0.30 — at which `4.5 * 0.30 =
  // 1.35 > 1` and EVERY KICK IS ANNIHILATED IN ONE FRAME. Measured: a six-fighter browser
  // run logged 100 kicks and the camera was displaced on **4 of 206 frames**. That is a
  // headless-frame-rate artefact, not a finding, and reporting it as "the camera barely
  // moves" would be a confidently wrong answer about the channel under test.
  //
  // So the persistence question is answered here instead, at dt = 1/60 with simSpeed 1,
  // driving the REAL `CameraRig` — not a model of it — off the real kick timeline.
  // `shakeAmount` is reported rather than `|shakeOffset|` because the offset is three
  // `Math.random()` draws and the amount is deterministic; the offset's magnitude is
  // proportional to it, so the ratios are the same and the numbers are reproducible.
  const replay = (scaled) => {
    const r = new cam.CameraRig({ pitchDeg: 58, yawDeg: 0, frameMode: 'fair' });
    let frames = 0, moving = 0, sum = 0, peak = 0;
    for (const m of perMatch) {
      r.shakeAmount = 0; r.shakeOffset.set(0, 0, 0);
      const q = m.kicks.slice().sort((a, b) => a.t - b.t);
      let qi = 0;
      const nFrames = Math.ceil((m.durationMs / 1000) * 60);
      for (let f = 0; f < nFrames; f++) {
        const tMs = (f / 60) * 1000;
        while (qi < q.length && q[qi].t <= tMs) {
          const k = q[qi++];
          r.shake(k.amp * (scaled ? cam.shakeProximityScale(k.d, FADE) : 1), k.decay);
        }
        r.update(1 / 60);
        frames++; sum += r.shakeAmount;
        if (r.shakeAmount >= 0.002) moving++;
        if (r.shakeAmount > peak) peak = r.shakeAmount;
      }
    }
    return { frames, moving, share: moving / frames, mean: sum / frames, peak };
  };
  if (cam.shakeProximityScale) {
    const before = replay(false), after = replay(true);
    console.log('\n60 fps replay through the SHIPPED CameraRig integrator (dt=1/60, simSpeed 1):');
    console.log('                 frames   camera MOVING   share    mean amp m   peak amp m');
    for (const [label, x] of [['BEFORE (no falloff)', before], ['AFTER  (shipped)   ', after]]) {
      console.log(`  ${label}  ${String(x.frames).padStart(7)}  ${String(x.moving).padStart(13)}  ${(100*x.share).toFixed(1).padStart(5)}%  ${x.mean.toFixed(5).padStart(11)}  ${x.peak.toFixed(4).padStart(11)}`);
    }
    // 🚨 NON-EMPTY / NON-VACUOUS: a corpus in which the camera never moved BEFORE cannot
    // show a reduction, and the ratio below would be 0/0.
    if (before.moving === 0 || before.mean === 0) {
      console.log('  ⚠️ the BEFORE arm never moved the camera — the comparison below is vacuous.');
    } else {
      console.log(`  => frames with a moving camera ${(100*before.share).toFixed(1)}% -> ${(100*after.share).toFixed(1)}%  (x${(after.share/before.share).toFixed(3)})`);
      console.log(`  => mean shake amplitude        ${before.mean.toFixed(5)} -> ${after.mean.toFixed(5)} m  (x${(after.mean/before.mean).toFixed(3)})`);
      console.log(`  => peak shake amplitude        ${before.peak.toFixed(4)} -> ${after.peak.toFixed(4)} m  (x${(after.peak/before.peak).toFixed(3)})`);
    }
  }

  if (args.sweep) {
    console.log('\nsweep — delivered/raw for candidate (fade wu, floor):');
    const fades = [FULL * 1.5, FULL * 2, FADE, FULL * 3, FULL * 4];
    const floors = [0, 0.10, 0.15, 0.25];
    console.log('  fade\\floor' + floors.map((f) => String(f).padStart(9)).join(''));
    for (const fd of fades) console.log(`  ${fd.toFixed(0).padStart(9)}` + floors.map((fl) => score(fd, fl).toFixed(4).padStart(9)).join(''));
  } else {
    console.log(`\nSHIPPED CURVE delivered/raw = ${score(FADE, undefined).toFixed(4)}`);
  }
}

if (IS_MAIN) await main();
