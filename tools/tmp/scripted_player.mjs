/**
 * THE SCRIPTED PLAYER — one implementation, imported by every Node-side balance tool.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 *
 * It did not exist, and that was the bug. `tools/match-sim.mjs` fixed a real driver
 * defect on 2026-08-05 (the stuck detector ran during the COUNTDOWN, so every match
 * began with up to 900 ms of latched sideways walking). The fix never reached
 * `tools/tmp/arena_probe.mjs`, and `status_census.mjs` / `roster_table.mjs` each
 * lifted the driver VERBATIM from there — `roster_sweep.mjs` and
 * `status_grace_sweep.mjs` then shell out to those two. Five instruments, one stale
 * copy of a driver whose defect was known and already fixed elsewhere.
 *
 * `docs/LESSONS.md` records this exact shape — *"a rule stated once and implemented
 * twice"* — as the origin of three separate AI bugs. A fifth verbatim copy, even a
 * CORRECT one, would have been the same bug with a different date on it. So the
 * driver is stated once, here, and the tools import it.
 *
 * ── The two faults this file is the fix for ─────────────────────────────────
 *
 * **1. THE STUCK DETECTOR MUST NOT RUN DURING THE COUNTDOWN.**
 * `sim.ts:movePlayer` is only called while `phase === 'playing'`, so for the first
 * `COUNTDOWN_FROM * 1000 + COUNTDOWN_START_FLASH_MS` ms of every match the player is
 * motionless BY CONSTRUCTION. The detector saw "1.5 s of walking has covered 0 wu",
 * concluded it was jammed, flipped `detourSign` and latched a 900 ms perpendicular
 * detour — repeatedly, once every ~1.2 s of countdown. Whatever was still latched at
 * the whistle was walked SIDEWAYS at the start of the match. Measured on the
 * derivable arena: contact at 5850 ms against a correct 5283 ms, i.e. **+567 ms**.
 *
 * **2. THE DRIVER MUST NOT DECIDE DURING THE COUNTDOWN**, and this one is worse,
 * because it produces no wrong number — only a wrong PAIRING. `sim.ts` ignores
 * `input` entirely while `phase === 'countdown'`, but the decision loop still ran:
 * every ~150 ms it called `decide()` and drew a fresh `rnd()` for the next reaction
 * interval. A 5.7 s countdown burns ~38 draws from the seeded stream before the
 * whistle and a 3.7 s countdown burns ~25, so **changing the countdown re-seeds every
 * match** and a paired before/after stops being paired. Measured in
 * `tools/tmp/pacing_ladder.mjs`: with the loop live, `COUNTDOWN_FROM` 5 -> 3 moved
 * **38 of 110 matchups, max |Δ| 50.0 pp**, while the approach itself moved +0.01 s.
 * Held at the whistle it moves **0 of 110**, which is what the arithmetic demands —
 * nothing in `stepMatch` reads absolute `elapsed` (`sim.test.mjs` §21 asserts exactly
 * that on the sim side; this file is the instrument side of the same claim).
 *
 * That is a mechanism by which ANY pacing or timing change can manufacture a
 * completely fictitious balance result: large, consistent, reproducible, and entirely
 * an artefact of RNG alignment. `docs/LESSONS.md` §13 in its purest form.
 *
 * ── Reproducing the historical driver ───────────────────────────────────────
 *
 * Both faults stay reachable BY FLAG, never by default, so any figure recorded before
 * 2026-08-05 can still be reproduced and shown to be what it is:
 *
 *     --nav-countdown-bug          fault 1 (the latched sideways detour)
 *     --decide-during-countdown    fault 2 (the re-seeding decision loop)
 *
 * `parseDriverFlags(args)` reads both, so every tool spells them the same way.
 *
 * ── Guard ───────────────────────────────────────────────────────────────────
 *
 * `node tools/tmp/driver_guard.mjs` fails if a SIXTH copy of this driver appears, if
 * a tool that carries its own copy loses the countdown guard, or if the decision
 * stream at the whistle ever becomes a function of countdown length again.
 */

/** 1 = pre-2026-08-05. 2 = range-before-LOS (`match-sim.mjs` rev 2). 3 = + both countdown guards. */
export const DRIVER_REV = 3;

/** mulberry32. Identical stream to the copies this file replaces — do not "improve" it. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The 8-direction keyboard quantisation the shipped `input.ts` produces. */
export function axesToward(fromX, fromY, toX, toY) {
  const dx = toX - fromX, dy = toY - fromY;
  const m = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
  const q = (v) => (v > 0.35 ? 1 : v < -0.35 ? -1 : 0);
  return { x: q(dx / m), y: q(dy / m) };
}

/** Every tool spells the two reproduction flags the same way, or the flags are useless. */
export function parseDriverFlags(args) {
  return {
    navCountdownBug: !!args['nav-countdown-bug'],
    decideDuringCountdown: !!args['decide-during-countdown'],
  };
}

/**
 * Bind the driver to one sim's rules and one arena.
 *
 * `CHARACTERS` / `REACH` come from the CALLER's `rules.ts`, not from a hard import —
 * `--sim <dir>` points these tools at a `stage_rules.mjs` copy, and a driver that
 * imported the shared tree would silently measure the shipped constants against a
 * staged sim.
 */
export function createScriptedPlayer({
  CHARACTERS, REACH, arena, hazard = null,
  navCountdownBug = false, decideDuringCountdown = false,
}) {
  if (!CHARACTERS || !REACH) throw new Error('createScriptedPlayer: CHARACTERS and REACH are required');
  if (!arena) throw new Error('createScriptedPlayer: arena is required');
  const HAZ = hazard ?? (arena.hazards ?? []).find((h) => h.kind === 'damage') ?? null;
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  const maxNormalRange = (id) =>
    Math.max(...CHARACTERS[id].weapons.filter((w) => (w.range ?? 0) <= REACH.rangedMax).map((w) => w.range ?? 0), 0);

  function preferredRange(id) {
    const ws = CHARACTERS[id].weapons.filter((w) => w.type !== 'self' && (w.range ?? 0) <= REACH.rangedMax);
    if (!ws.length) return maxNormalRange(id);
    return ws.reduce((best, w) => ((w.damage ?? 0) > (best.damage ?? 0) ? w : best)).range ?? 0;
  }

  /** Highest DAMAGE that is off cooldown and in range. Never picks a weapon for its STATUS. */
  function bestWeapon(state, d) {
    const p = state.player;
    const ws = CHARACTERS[p.characterId].weapons;
    let best = null, bestDmg = -Infinity;
    ws.forEach((w, i) => {
      if (w.type === 'self') return;
      if (state.elapsed - p.lastUsed[i] < w.cooldown) return;
      if (d > (w.range ?? Infinity)) return;
      if ((w.damage ?? 0) > bestDmg) { bestDmg = w.damage ?? 0; best = i; }
    });
    return best;
  }

  /** The same 12x12-vs-CoverBox test `stepProjectiles` runs. */
  function lineOfSight(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(d / 4));
    for (let i = 1; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      if (arena.cover.some((o) => Math.abs(x - o.x) < (12 + o.w) / 2 && Math.abs(y - o.y) < (12 + o.h) / 2)) return false;
    }
    return true;
  }

  /**
   * Walk toward a point the way a person does: straight at it, and when the wall says
   * no, sidestep and keep sidestepping until the wall is behind you.
   *
   * `rnd` may be null. `arena_probe.mjs` drives this without a seeded stream and its
   * historical initial `detourSign` is **+1**; preserving that is what makes its
   * before/after measure the countdown fix ALONE rather than the fix plus a re-roll.
   */
  function makeNav(rnd = null, { countdownStuckBug = navCountdownBug } = {}) {
    /** NET displacement over ~1.5 s, not per-tick movement: a fighter pinned on a corner
     *  still jitters, and a per-tick test reads that as walking. */
    const hist = [];
    let detourUntil = -1;
    let detourSign = rnd ? (rnd() < 0.5 ? 1 : -1) : 1;

    return function walk(state, targetX, targetY) {
      const p = state.player;

      // ── FAULT 1, FIXED. A stuck detector must only run while movement is possible.
      if (!countdownStuckBug && state.phase !== 'playing') {
        hist.length = 0; detourUntil = -1;
        return axesToward(p.x, p.y, targetX, targetY);
      }

      hist.push({ t: state.elapsed, x: p.x, y: p.y });
      while (hist.length && state.elapsed - hist[0].t > 1500) hist.shift();
      if (state.elapsed > detourUntil && hist.length > 4 && state.elapsed - hist[0].t > 1200) {
        if (Math.hypot(p.x - hist[0].x, p.y - hist[0].y) < 45) {   // ~1.5 s should cover ~180 wu
          detourSign = -detourSign; detourUntil = state.elapsed + 900; hist.length = 0;
        }
      }
      let tx = targetX, ty = targetY;
      if (state.elapsed < detourUntil) {
        const ang = Math.atan2(targetY - p.y, targetX - p.x) + detourSign * (Math.PI / 2);
        tx = p.x + Math.cos(ang) * 150; ty = p.y + Math.sin(ang) * 150;
      }
      return axesToward(p.x, p.y, tx, ty);
    };
  }

  const POLICY_FNS = {
    /** Nothing at all. The control: what does the AI do to a target that never acts? */
    idle: () => () => ({ move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false }),

    /** Run at the enemy and hold fire. The naive human's first 30 seconds. */
    chase: (rnd = null) => {
      const nav = makeNav(rnd);
      return (state) => {
        const p = state.player, e = state.enemy;
        const d = dist(p.x, p.y, e.x, e.y);
        return {
          move: nav(state, e.x, e.y),
          aim: { x: e.x - p.x, y: e.y - p.y },
          selectedWeapon: bestWeapon(state, d) ?? 0,
          attack: true,
        };
      };
    },

    /**
     * REV 1 ORDERING — line of sight tested BEFORE range. Kept ONLY so a figure recorded
     * before 2026-08-05 can be reproduced. Across 1,100 wu of a 27-box arena something is
     * nearly always in the line, so it takes the no-LOS branch at ANY distance, strafes
     * into a prop and never closes. Do not steer by it.
     */
    smart: (rnd = null) => makeDecisionTree(rnd, { losBeforeRange: true }),

    /** REV 2 — range tested BEFORE line of sight. The corrected scripted player. */
    smart2: (rnd = null) => makeDecisionTree(rnd, { losBeforeRange: false }),

    /**
     * SURVIVE — the ceiling on human passivity: circle inside the safe disc at max speed,
     * stay outside the pot, never let the AI (70 wu/s chase against the player's 120)
     * close. ANALOG axes, not the 8-direction quantisation — the shipped twin sticks are
     * analog, so this is a real input a real player can produce. No `nav` either: its
     * stuck detector fights a policy whose whole job is to keep moving.
     */
    survive: (rnd = null) => {
      let jitter = (rnd ? rnd() : 0) * Math.PI * 2;
      return (state) => {
        const p = state.player, e = state.enemy;
        const cx = arena.center.x, cy = arena.center.y;
        const R = state.safeRadius;
        const potR = HAZ ? HAZ.radius : 0;
        let vx = 0, vy = 0;
        // 1. away from the enemy, hardest when close
        const de = Math.hypot(p.x - e.x, p.y - e.y) || 1;
        const wEnemy = Math.min(3, 260 / de);
        vx += ((p.x - e.x) / de) * wEnemy;
        vy += ((p.y - e.y) / de) * wEnemy;
        // 2. toward the ring centre, hardest near the edge
        const dc = Math.hypot(p.x - cx, p.y - cy) || 1;
        const margin = R - dc;
        const wRing = margin < 140 ? 4 * (1 - Math.max(0, margin) / 140) : 0;
        vx += ((cx - p.x) / dc) * wRing;
        vy += ((cy - p.y) / dc) * wRing;
        // 3. out of the pot
        if (HAZ) {
          const dp = Math.hypot(p.x - HAZ.x, p.y - HAZ.y) || 1;
          if (dp < potR + 45) { const w = 3; vx += ((p.x - HAZ.x) / dp) * w; vy += ((p.y - HAZ.y) / dp) * w; }
        }
        // 4. a tangential component so "away from the enemy" does not walk into a wall
        jitter += 0.03;
        vx += Math.cos(jitter) * 0.5; vy += Math.sin(jitter) * 0.5;
        const m = Math.max(Math.abs(vx), Math.abs(vy)) || 1;
        return {
          move: { x: Math.max(-1, Math.min(1, vx / m)), y: Math.max(-1, Math.min(1, vy / m)) },
          aim: { x: e.x - p.x, y: e.y - p.y },
          selectedWeapon: 0,
          attack: false,
        };
      };
    },

    /**
     * KITE — never close, always retreat, use the self-heal, keep the ring at arm's
     * length. Answers "dead against the script, or dead against a human?" for the
     * regen / timeout / final-ring family. A human who is losing plays roughly this.
     */
    kite: (rnd = null) => {
      const nav = makeNav(rnd);
      return (state) => {
        const p = state.player, e = state.enemy;
        const cx = arena.center.x, cy = arena.center.y;
        const R = state.safeRadius;
        const dc = dist(p.x, p.y, cx, cy);
        const away = Math.hypot(p.x - e.x, p.y - e.y) || 1;
        const wRing = dc > R - 90 ? 2.2 : 0.6;
        const fx = ((p.x - e.x) / away) * 1.4 + ((cx - p.x) / 600) * wRing;
        const fy = ((p.y - e.y) / away) * 1.4 + ((cy - p.y) / 430) * wRing;
        const selfSlot = CHARACTERS[p.characterId].weapons.findIndex((w) => w.type === 'self');
        const canSelf = selfSlot >= 0
          && state.elapsed - p.lastUsed[selfSlot] >= CHARACTERS[p.characterId].weapons[selfSlot].cooldown;
        return {
          move: nav(state, p.x + fx * 200, p.y + fy * 200),
          aim: { x: e.x - p.x, y: e.y - p.y },
          selectedWeapon: canSelf ? selfSlot : 0,
          attack: canSelf,
        };
      };
    },
  };

  /** `smart` and `smart2` differ by ONE clause. Writing the tree twice is how they drifted. */
  function makeDecisionTree(rnd, { losBeforeRange }) {
    const nav = makeNav(rnd);
    return (state) => {
      const p = state.player, e = state.enemy;
      const d = dist(p.x, p.y, e.x, e.y);
      const idx = bestWeapon(state, d);
      const band = preferredRange(p.characterId) * 0.85;
      const los = lineOfSight(p.x, p.y, e.x, e.y);
      const cx = arena.center.x, cy = arena.center.y;
      const dc = dist(p.x, p.y, cx, cy);
      const R = state.safeRadius;

      /** In range but shooting a counter: flank, don't empty cooldowns into furniture. */
      const flank = () => {
        const ang = Math.atan2(e.y - p.y, e.x - p.x) + Math.PI / 2;
        return { x: p.x + Math.cos(ang) * 150, y: p.y + Math.sin(ang) * 150 };
      };

      let target;
      // 1. Ring first: get inside, with margin, before anything else.
      if (dc > R - 30) {
        target = { x: cx, y: cy };
        // 2. …but if the safe disc has shrunk INSIDE the pot's ring there is nowhere
        //    safe left; sit on the least-bad radius, just inside the ring.
        if (HAZ && R < HAZ.radius + 20) {
          const ang = Math.atan2(p.y - cy, p.x - cx);
          const r = Math.max(0, R - 10);
          target = { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r };
        }
      } else if (HAZ && dist(p.x, p.y, HAZ.x, HAZ.y) < HAZ.radius + 15 && R > HAZ.radius + 40) {
        // 3. Standing in the boiling pot with somewhere better to be: leave.
        const ang = Math.atan2(p.y - HAZ.y, p.x - HAZ.x);
        target = { x: HAZ.x + Math.cos(ang) * (HAZ.radius + 60), y: HAZ.y + Math.sin(ang) * (HAZ.radius + 60) };
      } else if (losBeforeRange && !los) {
        target = flank();                                   // ← REV 1's defect, kept verbatim
      } else if (d > band) {
        target = { x: e.x, y: e.y };                        // close
      } else if (!los) {
        target = flank();                                   // ← REV 2: in range AND blocked
      } else if (d < band * 0.5) {
        const ang = Math.atan2(p.y - e.y, p.x - e.x);       // back off
        target = { x: p.x + Math.cos(ang) * 100, y: p.y + Math.sin(ang) * 100 };
      } else {
        const ang = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2;   // strafe
        target = { x: p.x + Math.cos(ang) * 100, y: p.y + Math.sin(ang) * 100 };
      }

      return {
        move: nav(state, target.x, target.y),
        aim: { x: e.x - p.x, y: e.y - p.y },
        selectedWeapon: idx ?? 0,
        // Don't spend cooldowns on shots that cannot reach OR cannot arrive.
        attack: idx !== null && (los || CHARACTERS[p.characterId].weapons[idx].type === 'melee'),
      };
    };
  }

  /**
   * The reaction cadence, WITH THE COUNTDOWN GUARD — fault 2.
   *
   * Stated once so it cannot be half-copied. `stats` is what `driver_guard.mjs`
   * asserts on: a decision or a reaction draw during the countdown means the seeded
   * stream at the whistle is a function of countdown length, which is exactly the
   * mechanism that manufactured a 38-of-110 balance result out of nothing.
   *
   * `sinceDecision` starts at `Infinity`, so the first decision lands on the first
   * PLAYING tick regardless of how long the countdown was.
   */
  function createDecisionLoop({ decide, reactBase = 150, reactJit = 0, rnd = null }) {
    if (typeof decide !== 'function') throw new Error('createDecisionLoop: decide is required');
    let input = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
    let sinceDecision = Infinity;
    let nextReact = reactBase;
    const stats = { decisions: 0, decisionsInCountdown: 0, reactDraws: 0, reactDrawsInCountdown: 0 };

    return {
      stats,
      /** Call once per tick, BEFORE `stepMatch`. Returns the input for this tick. */
      next(state, dt) {
        const playing = state.phase === 'playing';
        const canAct = decideDuringCountdown || playing;
        if (canAct && sinceDecision >= nextReact) {
          input = decide(state);
          sinceDecision = 0;
          stats.decisions++;
          if (!playing) stats.decisionsInCountdown++;
          if (rnd && reactJit) {
            nextReact = reactBase + (rnd() * 2 - 1) * reactJit;
            stats.reactDraws++;
            if (!playing) stats.reactDrawsInCountdown++;
          }
        }
        if (canAct) sinceDecision += dt;
        return input;
      },
    };
  }

  return {
    DRIVER_REV,
    POLICY_FNS,
    POLICY_NAMES: Object.keys(POLICY_FNS),
    makeNav, lineOfSight, bestWeapon, preferredRange, maxNormalRange, axesToward,
    createDecisionLoop,
    flags: { navCountdownBug, decideDuringCountdown },
    /** True when this driver is reproducing a historical defect and its numbers are NOT current. */
    isHistorical: navCountdownBug || decideDuringCountdown,
  };
}
