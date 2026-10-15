#!/usr/bin/env node
/**
 * BH_PRESENT_HITSTOP — does the LOCAL player's game freeze for hits it cannot see?
 *
 * REVIEW-PHASE PROBE (2026-10-15). Read-only on every tracked file.
 *
 * `match.ts` gives the camera kick a distance term (`shakeProximity`, `d0a42ea`, Uri:
 * *"make sure that the shake only happens when the proximity is close"*). The OTHER two
 * global feel channels on the same three event sites have none:
 *
 *   * HIT-STOP — `triggerHitStop(ms)` on every weapon `hit-landed` (10 + 4.6*dmg, 16..105),
 *     every `death` (90) and every giant-slam `weapon-fired` (120). It withholds 95% of the
 *     frame's dt from `stepMatch` for the WHOLE sim — the local player's own movement and
 *     animation included — then repays it at up to 4x speed.
 *   * SCREEN FLASH — `hud.flashScreen` on every giant-slam cast, wherever it is.
 *
 * At two seats every weapon hit involves the local seat, so "a hit" and "a hit near me" are
 * the same sentence. At six they are not. This probe measures how much of a living local
 * player's match is spent frozen / repaying because of events beyond the farthest ground
 * point ANY supported display can show (`CameraRig.shakeFadeRadiusUnits()`).
 *
 * ⚠️ `match.ts` CANNOT BE IMPORTED IN NODE (it imports `three` scene code and `ui/hud.ts`),
 * so the dt accounting below is a TRANSCRIPTION of `GameSession.loop` + `triggerHitStop` +
 * the three trigger sites in `handleEvents`. Every constant is cited by symbol. The sim, the
 * arena dump and the camera's fade radius are the SHIPPED modules, imported.
 *
 * Arms:
 *   --n 2|6           seats (2 is the control: every weapon hit is on, or by, the local seat)
 *   --arm base        the shipped spawns
 *   --arm nearonly    KNOWN-BAD for the distance column: every seat spawned within ~50 wu of
 *                     slot 0. If the off-screen share does not collapse at the START of the
 *                     match here, the classifier is not reading positions.
 *   --arm centre      KNOWN-BAD for the attribution: measure distance from the arena centre
 *                     instead of slot 0. Must DISAGREE with base, or slot 0 is not being read.
 *   --policy shipped  hit-stop exactly as match.ts does it
 *   --policy gated    the proposed fix: a trigger whose subject is beyond the fade radius
 *                     asks for 0 ms (everything else unchanged)
 *   --matches 40 --dt 16.667 --sim <dir> --camera <file>
 *
 *   node tools/tmp/bh_present_hitstop.mjs --n 6 --matches 40
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
const CAMERA = String(args.camera ?? `${ROOT}/src/render/camera.ts`);
const N = Number(args.n ?? 6);
const MATCHES = Number(args.matches ?? 40);
const DT = Number(args.dt ?? (1000 / 60));
const ARM = String(args.arm ?? 'base');
const POLICY = String(args.policy ?? 'shipped');

// ── TRANSCRIBED FROM src/game/match.ts (GameSession) ─────────────────────────────
const HITSTOP_TRICKLE = 0.05;          // GameSession.HITSTOP_TRICKLE
const HITSTOP_CATCHUP_RATE = 3;        // GameSession.HITSTOP_CATCHUP_RATE
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** `hit-landed` weapon branch: `triggerHitStop(clamp(10 + ev.amount * 4.6, 16, 105))`. */
const hitStopForHit = (amount) => clamp(10 + amount * 4.6, 16, 105);
const HITSTOP_DEATH = 90;              // `death` case: `this.triggerHitStop(90)`
const HITSTOP_SLAM = 120;              // giantSlam `weapon-fired`: `this.triggerHitStop(120)`

export async function run({ n = N, matches = MATCHES, arm = ARM, policy = POLICY, dt = DT } = {}) {
  const { createMatch, stepMatch } = await import(pathToFileURL(`${SIM_DIR}/sim.ts`).href);
  const RULES = await import(pathToFileURL(`${SIM_DIR}/rules.ts`).href);
  const cam = await import(pathToFileURL(CAMERA).href);
  const { CHARACTER_IDS, LEVEL_MIN, MATCH_DURATION_MS } = RULES;
  const ARENA_PATH = `${ROOT}/tools/arena.gameplay.json`;
  if (!existsSync(ARENA_PATH)) throw new Error(`no arena dump at ${ARENA_PATH}`);
  const ARENA = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));

  const FULL = cam.FAIR_PLAY.radiusUnits;
  const FADE = new cam.CameraRig({ pitchDeg: 58, yawDeg: 0, frameMode: 'fair' }).shakeFadeRadiusUnits();

  // Same seeded roster rule as `sh_dist.mjs` (lollipop forced in so the slam row is not
  // silently empty — the `[].every()` vacuity class).
  const rosterFor = (i) => {
    const ids = CHARACTER_IDS.slice();
    let s = (i * 2654435761) >>> 0;
    const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0; t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let k = ids.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [ids[k], ids[j]] = [ids[j], ids[k]]; }
    const out = ids.slice(0, n);
    if (!out.includes('lollipop')) out[out.length - 1] = 'lollipop';
    return out;
  };
  const spawnsFor = () => {
    const shipped = ARENA.spawns.slice(0, n).map((p) => ({ x: p.x, y: p.y }));
    if (arm !== 'nearonly') return shipped;
    const a = shipped[0];
    return shipped.map((_, k) => ({ x: a.x + (k % 3) * 50 - 50, y: a.y + Math.floor(k / 3) * 50 - 25 }));
  };
  const classify = (d) => (d <= FULL ? 'onscreen' : d <= FADE ? 'edge' : 'offscreen');

  const tot = {
    frames: 0, frozen: 0, repaying: 0,
    frozenBy: { onscreen: 0, edge: 0, offscreen: 0 },
    triggers: { onscreen: 0, edge: 0, offscreen: 0 },
    triggerMs: { onscreen: 0, edge: 0, offscreen: 0 },
    byKind: {},
    slams: { onscreen: 0, edge: 0, offscreen: 0 },
    matches: 0, localAliveMs: 0,
  };

  for (let i = 0; i < matches; i++) {
    const ids = rosterFor(i);
    const spawns = spawnsFor();
    const state = createMatch(ARENA, ids.map((characterId, seat) => ({
      characterId, controller: 'ai', spawn: spawns[seat], level: LEVEL_MIN,
    })));
    const inputs = new Array(state.fighters.length).fill(null);
    let budget = 0, banked = 0, owner = null;
    const HARD_CAP = MATCH_DURATION_MS * 4;
    let wall = 0;
    while (state.phase !== 'ended' && wall < HARD_CAP) {
      wall += dt;
      // ── GameSession.loop's dt accounting, verbatim in shape ──
      let stepDt;
      if (budget > 0) {
        budget = Math.max(0, budget - dt);
        stepDt = dt * HITSTOP_TRICKLE;
        banked += dt - stepDt;
      } else if (banked > 0) {
        const catchUp = Math.min(banked, dt * HITSTOP_CATCHUP_RATE);
        banked -= catchUp;
        stepDt = dt + catchUp;
      } else {
        stepDt = dt;
      }
      const me = state.fighters[0];
      const localAlive = me.alive && state.phase === 'playing';
      if (localAlive) {
        tot.frames++;
        tot.localAliveMs += dt;
        if (stepDt < dt * 0.5) { tot.frozen++; if (owner) tot.frozenBy[owner]++; }
        else if (stepDt > dt * 1.05) tot.repaying++;
      }
      if (budget <= 0) owner = null;

      const evs = stepMatch(state, stepDt, inputs);
      // The observer: slot 0 while alive (resolveViewSubject rung 1). After death the camera
      // leaves, and this probe stops counting rather than modelling the spectator ladder.
      const ref = arm === 'centre' ? ARENA.center : state.fighters[0];
      const trigger = (kind, ms, x, y) => {
        const d = Math.hypot(x - ref.x, y - ref.y);
        const cls = classify(d);
        const asked = policy === 'gated' && cls === 'offscreen' ? 0 : ms;
        if (localAlive) {
          tot.triggers[cls]++;
          tot.triggerMs[cls] += ms;
          const k = (tot.byKind[kind] ??= { onscreen: 0, edge: 0, offscreen: 0 });
          k[cls]++;
        }
        if (asked > budget) { budget = asked; owner = cls; }   // Math.max, and the owner of the max
      };
      for (const ev of evs) {
        if (ev.type === 'weapon-fired') {
          const f = state.fighters[ev.fighterId];
          const w = RULES.CHARACTERS[f.characterId].weapons.find((x) => x.key === ev.weaponKey);
          if (w?.giantSlam) {
            const d = Math.hypot(f.x - ref.x, f.y - ref.y);
            if (localAlive) tot.slams[classify(d)]++;
            trigger('slam', HITSTOP_SLAM, f.x, f.y);
          }
        } else if (ev.type === 'hit-landed') {
          if (ev.source.kind !== 'weapon') continue;   // fog breaks first; trail/hazard/item: isWeaponHit false
          const v = state.fighters[ev.targetId];
          trigger('hit', hitStopForHit(ev.amount), v.x, v.y);   // victim position, as match.ts's kick uses
        } else if (ev.type === 'death') {
          const v = state.fighters[ev.fighterId];
          trigger('death', HITSTOP_DEATH, v.x, v.y);
        }
      }
    }
    tot.matches++;
  }
  return { n, arm, policy, FULL, FADE, ...tot };
}

function report(r) {
  const pct = (a, b) => (b > 0 ? (100 * a / b).toFixed(1) : 'n/a');
  const allTrig = r.triggers.onscreen + r.triggers.edge + r.triggers.offscreen;
  console.log(`\n══ BH_PRESENT_HITSTOP  N=${r.n}  arm=${r.arm}  policy=${r.policy}  matches=${r.matches} ══`);
  console.log(`radii: full ${r.FULL.toFixed(2)} wu (FAIR_PLAY)  fade ${r.FADE.toFixed(2)} wu (shakeFadeRadiusUnits)`);
  console.log(`local-alive frames ${r.frames}  (${(r.localAliveMs / 1000 / r.matches).toFixed(1)} s/match of living play)`);
  console.log(`  frozen   ${r.frozen}  = ${pct(r.frozen, r.frames)}% of living frames`);
  console.log(`  repaying ${r.repaying}  = ${pct(r.repaying, r.frames)}%`);
  console.log(`  NOT AT 1x (frozen+repaying) = ${pct(r.frozen + r.repaying, r.frames)}%`);
  console.log(`  frozen frames owned by:  onscreen ${r.frozenBy.onscreen}  edge ${r.frozenBy.edge}  OFFSCREEN ${r.frozenBy.offscreen} (${pct(r.frozenBy.offscreen, r.frozen)}% of frozen)`);
  console.log(`hit-stop triggers while local alive: ${allTrig}  (${(allTrig / r.matches).toFixed(1)}/match)`);
  for (const c of ['onscreen', 'edge', 'offscreen']) {
    console.log(`  ${c.padEnd(9)} ${String(r.triggers[c]).padStart(6)} (${pct(r.triggers[c], allTrig).padStart(5)}%)  requested ${(r.triggerMs[c] / 1000).toFixed(1)} s`);
  }
  for (const [k, v] of Object.entries(r.byKind)) {
    console.log(`  by kind ${k.padEnd(6)} onscreen ${v.onscreen}  edge ${v.edge}  offscreen ${v.offscreen}`);
  }
  console.log(`giant-slam casts (each = full-screen flash + 120 ms hit-stop + full-level centred audio): onscreen ${r.slams.onscreen}  edge ${r.slams.edge}  OFFSCREEN ${r.slams.offscreen}`);
  return allTrig;
}

if (IS_MAIN) {
  const r = await run();
  const allTrig = report(r);
  // NON-EMPTY FIRST (CLAUDE.md rule 6): a corpus with no triggers prints a perfect table.
  if (allTrig === 0 || r.frames === 0) { console.error('bh_present_hitstop: EMPTY corpus — nothing above means anything'); process.exit(2); }
}
