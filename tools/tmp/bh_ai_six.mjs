#!/usr/bin/env node
/**
 * BH_AI_SIX — a six-seat census of what the BOT AI actually does, on the real sim.
 *
 * Review-phase probe (2026-10-15, bot-AI bug hunt). Read-only: it imports `src/game/*.ts`
 * from `--sim` (default: the detached clean worktree of HEAD at /private/tmp/fa-rv-head)
 * and writes only to `--json` if given. It never edits a tracked file.
 *
 * Every seat is `controller: 'ai'` unless `--human statue` puts a motionless human in slot 0
 * (a stimulus, not a model of a player). Spawns are the arena's six declared spawns,
 * rotated through the roster so every character sits in every seat.
 *
 * DETECTORS (each counts bot-ticks in the `playing` phase, from PRE-STEP state):
 *
 *   sd       SUDDEN DEATH SILENCE. A bot that is NOT fleeing, whose target is VISIBLE and
 *            inside the range of a CASTLESS offensive weapon that is off cooldown, with
 *            weapons not locked — "ready". In the chase branch `pickWeapon` must return an
 *            index on such a tick unless `escaping` is set. Fire-on-ready rate is reported
 *            for normal play and for the sudden-death window separately.
 *   stale    BELIEF STALER THAN WHAT THE BOT SAW. Target not visible; the bot's belief cell
 *            (`state.sightings[self,target]`) is older than the last tick at which the same
 *            `isVisibleFrom` predicate said the bot could see that target.
 *   lock     LOCKED ON A HIDDEN TARGET. Target not visible, while ANOTHER living opponent is
 *            visible and inside the bot's own `offensiveReach`; damage taken from that
 *            visible opponent during such ticks is summed.
 *   stuck    3 s window: same visible target throughout, out of reach throughout, no press,
 *            not movement-locked, and net displacement < 20 wu.
 *   bounds   any fighter centre outside the clamp rectangle or overlapping cover.
 *   fog      fog damage / fog deaths of bots BEFORE sudden death; pot damage to bots.
 *   phase    any bot press or bot movement outside `playing` (countdown, and 60 ticks after
 *            `ended`).
 *
 *   --selftest  plants each defect class on a constructed state and requires the matching
 *               detector to fire (and to stay silent on the control). See the bottom.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const IS_MAIN = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
const args = (() => {
  const out = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) continue;
    const k = a[i].slice(2);
    const v = a[i + 1] !== undefined && !a[i + 1].startsWith('--') ? a[++i] : true;
    out[k] = v;
  }
  return out;
})();

const SIM = String(args.sim ?? '/private/tmp/fa-rv-head/src/game');
const ARENA_PATH = String(args.arena ?? '/private/tmp/fa-rv-head/tools/arena.gameplay.json');
const { createMatch, stepMatch } = await import(`${SIM}/sim.ts`);
const R = await import(`${SIM}/rules.ts`);
const S = await import(`${SIM}/state.ts`);
const M = await import(`${SIM}/movement.ts`);
const AI = await import(`${SIM}/ai.ts`);

const DT = Number(args.dt ?? 16.667);
const N = Number(args.n ?? 6);
const ROSTERS = Number(args.rosters ?? 11);
const ROTS = Number(args.rot ?? 6);
const HUMAN = String(args.human ?? 'none');

const RAW = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
// The dump carries maxSafeRadius; assert it is the value the shipped code derives, rather
// than recomputing it from a retired formula (several older tools do — see the report).
const derivedMaxR = R.fogOpeningRadiusFor(Math.hypot(RAW.width / 2, RAW.height / 2));
if (Math.abs(derivedMaxR - RAW.maxSafeRadius) > 1e-6) {
  throw new Error(`arena dump maxSafeRadius ${RAW.maxSafeRadius} != derived ${derivedMaxR}`);
}
export const ARENA = { ...RAW, build: () => null, update: () => {} };

const W = ARENA.width, H = ARENA.height;
const ids = R.CHARACTER_IDS;

function readyCastless(f, sep, now) {
  const ws = R.CHARACTERS[f.characterId].weapons;
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (w.type === 'self') continue;
    if ((w.castMs ?? 0) > 0) continue;
    if (now - f.lastUsed[i] < w.cooldown) continue;
    if (sep > (w.range ?? Infinity)) continue;
    return true;
  }
  return false;
}

function insideCover(f) {
  for (const o of ARENA.cover) {
    if (Math.abs(f.x - o.x) < (f.size + o.w) / 2 - 1e-6 && Math.abs(f.y - o.y) < (f.size + o.h) / 2 - 1e-6) return o;
  }
  return null;
}

function newTotals() {
  return {
    matches: 0, playTicks: 0, botTicks: 0,
    sd: { normalReady: 0, normalFired: 0, sdReady: 0, sdFired: 0, sdBotTicks: 0, matchesReachingSd: 0, sdAliveAtStart: [] },
    stale: { ticks: 0, episodes: 0, maxErr: 0, examples: [], spawnBeliefTicks: 0 },
    lock: { ticks: 0, dmgTaken: 0, longest: 0, examples: [] },
    stuck: { windows: 0, botSecs: 0, examples: [] },
    bounds: { outside: 0, inCover: 0, examples: [] },
    fog: { preSdFogDmg: 0, preSdFogDeaths: 0, potDmg: 0, potDeaths: 0, sdDeaths: 0, examples: [] },
    phase: { countdownPress: 0, countdownMove: 0, endedMove: 0, endedPress: 0 },
    targets: new Array(N).fill(0),
    ends: { knockout: 0, wipe: 0, timeout: 0, unresolved: 0 },
    durations: [],
    results: [],
  };
}

function seatsFor(roster, rot) {
  return roster.map((_, seat) => {
    const characterId = roster[(seat + rot) % roster.length];
    const human = (HUMAN === 'statue' || HUMAN === 'hider') && seat === 0;
    return { characterId, controller: human ? 'human' : 'ai', spawn: ARENA.spawns[seat] };
  });
}

export function runMatch(configs, T, tag, hooks = {}) {
  const st = createMatch(ARENA, configs);
  hooks.onCreate?.(st);
  const n = st.fighters.length;
  const inputs = new Array(n).fill(null);
  // `--human hider`: slot 0 walks in a straight line (validated clear) from spawn 0 into the
  // plate stack at (330,1025), through its NORTH edge (y=965), stops 110 wu past that edge
  // and never presses anything. A stimulus for "a player hides", not a model of one.
  const HIDE = { x: 330, y: 1075 };
  const idleStreak = new Array(n).fill(0);
  const seen = Array.from({ length: n }, () => Array.from({ length: n }, () => null)); // truth last-seen
  const lockStreak = new Array(n).fill(0);
  const staleOn = new Array(n).fill(false);
  const win = Array.from({ length: n }, () => []);
  const lastHitBy = new Array(n).fill(null);
  let sdLogged = false;
  let ended = false;
  const deathOrder = [];
  let tick = 0;
  T.matches++;
  while (st.elapsed < 200000) {
    const phase = st.phase;
    const now = st.elapsed;
    const sd = phase === 'playing' && R.suddenDeathActive(st.timeRemaining - DT); // this tick's SD state
    const pre = st.fighters.map((f) => ({ x: f.x, y: f.y, alive: f.alive }));
    const info = [];
    if (phase === 'playing') {
      T.playTicks++;
      if (sd && !sdLogged) {
        sdLogged = true;
        T.sd.matchesReachingSd++;
        T.sd.sdAliveAtStart.push(st.fighters.filter((f) => f.alive).length);
      }
      // truth visibility for every ordered pair
      for (const o of st.fighters) {
        if (!o.alive) continue;
        for (const t of st.fighters) {
          if (t === o || !t.alive) continue;
          if (M.isVisibleFrom(o.x, o.y, t.x, t.y, st.arena, st, t)) seen[o.id][t.id] = { at: now, x: t.x, y: t.y };
        }
      }
      for (const f of st.fighters) {
        if (!f.alive || f.controller !== 'ai') { info.push(null); continue; }
        T.botTicks++;
        const tgt = S.nearestLivingOpponent(st, f);
        if (!tgt) { info.push(null); continue; }
        T.targets[tgt.id]++;
        const vis = M.isVisibleFrom(f.x, f.y, tgt.x, tgt.y, st.arena, st, tgt);
        const sep = Math.hypot(tgt.x - f.x, tgt.y - f.y);
        const fleeing = f.hp < f.maxHp * R.AI_FLEE_HP_FRACTION;
        const ready = vis && !fleeing && !S.weaponsLocked(f, now) && readyCastless(f, sep, now);
        const cell = st.sightings[S.sightingIndex(f.id, tgt.id, n)];
        const rec = { f, tgt, vis, sep, fleeing, ready, sd, cell: { x: cell.x, y: cell.y, at: cell.at } };
        // ── stale belief
        if (!vis) {
          const s = seen[f.id][tgt.id];
          if (s && s.at - cell.at > 500) {
            const err = Math.hypot(s.x - cell.x, s.y - cell.y);
            if (err > 50) {
              T.stale.ticks++;
              if (cell.at === 0) T.stale.spawnBeliefTicks++;
              if (err > T.stale.maxErr) T.stale.maxErr = err;
              if (!staleOn[f.id]) {
                staleOn[f.id] = true;
                T.stale.episodes++;
                if (T.stale.examples.length < 12) T.stale.examples.push({ tag, tick, t: Math.round(now), bot: f.id, char: f.characterId, target: tgt.id, beliefAt: Math.round(cell.at), belief: [Math.round(cell.x), Math.round(cell.y)], sawAt: Math.round(s.at), saw: [Math.round(s.x), Math.round(s.y)], truth: [Math.round(tgt.x), Math.round(tgt.y)], err: Math.round(err) });
              }
            } else staleOn[f.id] = false;
          } else staleOn[f.id] = false;
        } else staleOn[f.id] = false;
        // ── locked on a hidden target while a visible one is in reach
        rec.lockedBy = null;
        if (!vis && !fleeing) {
          const reach = AI.offensiveReach(f.characterId);
          for (const v of st.fighters) {
            if (v === f || v === tgt || !v.alive) continue;
            const d = Math.hypot(v.x - f.x, v.y - f.y);
            if (d <= reach && M.isVisibleFrom(f.x, f.y, v.x, v.y, st.arena, st, v)) { rec.lockedBy = v.id; break; }
          }
        }
        // ── standing on its own belief point, target hidden: the no-search state
        if (!vis && !fleeing && Math.hypot(cell.x - f.x, cell.y - f.y) < 5) {
          T.idle = T.idle ?? { ticks: 0, longest: 0, onHumanTicks: 0 };
          T.idle.ticks++;
          if (tgt.controller === 'human') T.idle.onHumanTicks++;
          idleStreak[f.id]++;
          if (idleStreak[f.id] * DT > T.idle.longest) T.idle.longest = idleStreak[f.id] * DT;
        } else idleStreak[f.id] = 0;
        if (rec.lockedBy !== null) {
          T.lock.ticks++;
          lockStreak[f.id]++;
          if (lockStreak[f.id] * DT > T.lock.longest) T.lock.longest = lockStreak[f.id] * DT;
          if (lockStreak[f.id] === 60 && T.lock.examples.length < 12) T.lock.examples.push({ tag, tick, t: Math.round(now), bot: f.id, char: f.characterId, hiddenTarget: tgt.id, hiddenSep: Math.round(sep), visibleInReach: rec.lockedBy });
        } else lockStreak[f.id] = 0;
        info.push(rec);
      }
    }
    hooks.inputs?.(st, inputs);
    if (HUMAN === 'hider' && st.fighters[0].alive) {
      const h = st.fighters[0];
      const dx = HIDE.x - h.x, dy = HIDE.y - h.y, d = Math.hypot(dx, dy);
      inputs[0] = d > 2 ? { move: { x: dx / d, y: dy / d }, selectedWeapon: 0, attack: false } : null;
    }
    const evs = stepMatch(st, DT, inputs);
    tick++;
    hooks.afterStep?.(st, evs, tick);
    // ── events
    const pressed = new Set();
    for (const e of evs) {
      if (e.type === 'weapon-fired' || e.type === 'cast-started') pressed.add(e.fighterId);
      if (e.type === 'hit-landed') {
        const s = e.source;
        if (s.kind === 'weapon') lastHitBy[e.targetId] = s.attackerId;
        else if (s.kind === 'trail') lastHitBy[e.targetId] = s.ownerId;
        else lastHitBy[e.targetId] = s.kind;
        const victim = st.fighters[e.targetId];
        if (victim.controller === 'ai') {
          if (s.kind === 'fog' && !sd) T.fog.preSdFogDmg += e.amount;
          if (s.kind === 'hazard') T.fog.potDmg += e.amount;
          const r = info[e.targetId];
          if (r && r.lockedBy !== null && s.kind === 'weapon' && s.attackerId === r.lockedBy) T.lock.dmgTaken += e.amount;
        }
      }
      if (e.type === 'death') {
        deathOrder.push(e.fighterId);
        const v = st.fighters[e.fighterId];
        const by = lastHitBy[e.fighterId];
        if (v.controller === 'ai') {
          if (by === 'fog' && !sd) { T.fog.preSdFogDeaths++; if (T.fog.examples.length < 12) T.fog.examples.push({ tag, t: Math.round(now), bot: v.id, char: v.characterId, x: Math.round(v.x), y: Math.round(v.y), safeR: Math.round(st.safeRadius), distC: Math.round(Math.hypot(v.x - ARENA.center.x, v.y - ARENA.center.y)) }); }
          if (by === 'fog' && sd) T.fog.sdDeaths++;
          if (by === 'hazard') T.fog.potDeaths++;
        }
      }
      if (e.type === 'match-ended') ended = true;
    }
    // ── phase gating
    for (const f of st.fighters) {
      if (f.controller !== 'ai') continue;
      const moved = Math.hypot(f.x - pre[f.id].x, f.y - pre[f.id].y) > 1e-9;
      // 'countdown' AFTER the step too: the tick that flips countdown -> playing runs the
      // fighter loop inside the same stepMatch, so pre-step phase alone would count it.
      if (phase === 'countdown' && st.phase === 'countdown') { if (pressed.has(f.id)) T.phase.countdownPress++; if (moved) T.phase.countdownMove++; }
      if (phase === 'ended') { if (pressed.has(f.id)) T.phase.endedPress++; if (moved) T.phase.endedMove++; }
    }
    // ── sudden death / normal fire-on-ready
    for (const r of info) {
      if (!r) continue;
      if (r.sd) T.sd.sdBotTicks++;
      if (!r.ready) continue;
      const fired = pressed.has(r.f.id);
      if (r.sd) { T.sd.sdReady++; if (fired) T.sd.sdFired++; } else { T.sd.normalReady++; if (fired) T.sd.normalFired++; }
      if (!fired && !r.sd) {
        // WHY a ready, non-fleeing bot with a visible in-range target did not press.
        const f = r.f;
        const pot = ARENA.hazards.find((h) => h.kind === 'damage');
        const dPot = pot ? Math.hypot(f.x - pot.x, f.y - pot.y) : Infinity;
        const dC = Math.hypot(f.x - ARENA.center.x, f.y - ARENA.center.y);
        const casting = st.fighters.some((o) => o !== f && o.alive && o.cast !== null);
        const why = dPot < pot.radius ? 'in-pot' : dC > st.safeRadius ? 'outside-ring' : casting ? 'someone-casting' : 'other';
        T.sd.notFired = T.sd.notFired ?? {};
        T.sd.notFired[why] = (T.sd.notFired[why] ?? 0) + 1;
        T.sd.notFiredEx = T.sd.notFiredEx ?? [];
        if (why === 'other' && T.sd.notFiredEx.length < 10) T.sd.notFiredEx.push({ tag, tick, t: Math.round(now), bot: f.id, char: f.characterId, tgt: r.tgt.id, sep: Math.round(r.sep) });
      }
    }
    // ── stuck windows (3 s)
    if (phase === 'playing') {
      for (const r of info) {
        if (!r) continue;
        const f = r.f;
        const wv = win[f.id];
        const reach = AI.offensiveReach(f.characterId);
        // A kit the bot could plausibly be walking to (upper-bound speed), or a flee: both are
        // legitimate reasons to stand off a visible target, so they disqualify the window.
        const kitHeal = R.MEDIKIT.heal * R.levelHealthMultiplier(f.level);
        const kitNear = f.maxHp - f.hp >= kitHeal && st.medikits.some((m) => Math.hypot(m.x - f.x, m.y - f.y) <= (m.expiresAt - st.elapsed) * R.speedFor(f.characterId, R.AI_FLEE_SPEED) * 1.35);
        wv.push({ x: f.x, y: f.y, tgt: r.tgt.id, vis: r.vis, out: r.sep > reach + 10, pressed: pressed.has(f.id), locked: S.movementLocked(f, st.elapsed), t: st.elapsed, sep: r.sep, excused: r.fleeing || kitNear });
        if (wv.length > Math.round(3000 / DT)) wv.shift();
        if (wv.length === Math.round(3000 / DT)) {
          const a = wv[0], b = wv[wv.length - 1];
          const ok = wv.every((s) => s.tgt === a.tgt && s.vis && s.out && !s.pressed && !s.locked && !s.excused);
          if (ok && Math.hypot(b.x - a.x, b.y - a.y) < 20) {
            T.stuck.windows++;
            T.stuck.botSecs += DT / 1000;
            if (T.stuck.examples.length < 12 && (T.stuck.examples.length === 0 || T.stuck.examples[T.stuck.examples.length - 1].bot !== f.id || T.stuck.examples[T.stuck.examples.length - 1].tag !== tag)) {
              T.stuck.examples.push({ tag, t: Math.round(st.elapsed), bot: f.id, char: f.characterId, at: [Math.round(f.x), Math.round(f.y)], target: a.tgt, sep: Math.round(b.sep) });
            }
          }
        }
      }
    }
    // ── bounds
    for (const f of st.fighters) {
      if (!f.alive) continue;
      const half = f.size / 2;
      if (f.x < half - 1e-6 || f.x > W - half + 1e-6 || f.y < half - 1e-6 || f.y > H - half + 1e-6) {
        T.bounds.outside++;
        if (T.bounds.examples.length < 8) T.bounds.examples.push({ tag, t: Math.round(st.elapsed), id: f.id, x: f.x, y: f.y });
      }
      const c = insideCover(f);
      if (c) { T.bounds.inCover++; if (T.bounds.examples.length < 8) T.bounds.examples.push({ tag, t: Math.round(st.elapsed), id: f.id, x: f.x, y: f.y, cover: c.kind }); }
    }
    hooks.onTick?.(st, evs, info);
    if (hooks.stopWhen?.(st)) break;
    if (ended) {
      // 60 ticks past the whistle, to see whether any bot still acts
      for (let k = 0; k < 60; k++) {
        const pre2 = st.fighters.map((f) => ({ x: f.x, y: f.y }));
        const ev2 = stepMatch(st, DT, inputs);
        for (const f of st.fighters) {
          if (f.controller !== 'ai') continue;
          if (Math.hypot(f.x - pre2[f.id].x, f.y - pre2[f.id].y) > 1e-9) T.phase.endedMove++;
          if (ev2.some((e) => (e.type === 'weapon-fired' || e.type === 'cast-started') && e.fighterId === f.id)) T.phase.endedPress++;
        }
      }
      break;
    }
  }
  const alive = st.fighters.filter((f) => f.alive).length;
  if (st.phase !== 'ended') T.ends.unresolved++;
  else if (alive === 0) T.ends.wipe++;
  else if (st.timeRemaining <= 0) T.ends.timeout++;
  else T.ends.knockout++;
  T.durations.push(R.MATCH_DURATION_MS - st.timeRemaining);
  T.results.push({ tag, winnerId: st.winnerId, deathOrder, playMs: Math.round(R.MATCH_DURATION_MS - st.timeRemaining), sd: sdLogged });
  return st;
}

function rosters() {
  const out = [];
  for (let i = 0; i < ids.length; i++) out.push(Array.from({ length: N }, (_, j) => ids[(i + j) % ids.length]));
  return out.slice(0, ROSTERS);
}

function summary(T) {
  const pct = (a, b) => (b > 0 ? `${((100 * a) / b).toFixed(1)}%` : 'n/a');
  const d = T.durations.slice().sort((a, b) => a - b);
  const med = d.length ? d[Math.floor(d.length / 2)] : 0;
  const lines = [];
  lines.push(`matches ${T.matches} · play ticks ${T.playTicks} · bot-ticks ${T.botTicks} · median play ${(med / 1000).toFixed(1)} s · ends ${JSON.stringify(T.ends)}`);
  lines.push(`[sd]     reached SD in ${T.sd.matchesReachingSd}/${T.matches} matches (alive at SD start: ${JSON.stringify(T.sd.sdAliveAtStart)})`);
  lines.push(`         fire-on-ready  NORMAL ${T.sd.normalFired}/${T.sd.normalReady} = ${pct(T.sd.normalFired, T.sd.normalReady)}   ·   SUDDEN DEATH ${T.sd.sdFired}/${T.sd.sdReady} = ${pct(T.sd.sdFired, T.sd.sdReady)}  (SD bot-ticks ${T.sd.sdBotTicks})`);
  lines.push(`         ready-but-not-fired (normal play) by reason: ${JSON.stringify(T.sd.notFired ?? {})}`);
  lines.push(`[stale]  bot-ticks acting on a belief older than a later sighting: ${T.stale.ticks} (${pct(T.stale.ticks, T.botTicks)} of bot-ticks) · episodes ${T.stale.episodes} · belief still the SPAWN seed (at=0): ${T.stale.spawnBeliefTicks} · max error ${Math.round(T.stale.maxErr)} wu`);
  lines.push(`[lock]   bot-ticks targeting a hidden fighter while a visible one is in reach: ${T.lock.ticks} (${pct(T.lock.ticks, T.botTicks)}) · dmg taken from that visible one meanwhile ${T.lock.dmgTaken.toFixed(1)} · longest ${(T.lock.longest / 1000).toFixed(2)} s`);
  lines.push(`[idle]   bot-ticks standing on a belief point with the target hidden: ${T.idle?.ticks ?? 0} (${((T.idle?.ticks ?? 0) * DT / 1000).toFixed(1)} bot-s; on the human ${((T.idle?.onHumanTicks ?? 0) * DT / 1000).toFixed(1)} bot-s) · longest ${((T.idle?.longest ?? 0) / 1000).toFixed(2)} s`);
  lines.push(`[stuck]  3 s windows stuck with a visible out-of-reach target: ${T.stuck.windows} (${T.stuck.botSecs.toFixed(1)} bot-s)`);
  lines.push(`[bounds] outside clamp ${T.bounds.outside} · inside cover ${T.bounds.inCover}`);
  lines.push(`[fog]    bot fog dmg before SD ${T.fog.preSdFogDmg.toFixed(1)} · bot fog deaths before SD ${T.fog.preSdFogDeaths} · bot fog deaths in SD ${T.fog.sdDeaths} · pot dmg ${T.fog.potDmg.toFixed(1)} · pot deaths ${T.fog.potDeaths}`);
  lines.push(`[phase]  countdown presses ${T.phase.countdownPress} moves ${T.phase.countdownMove} · post-end presses ${T.phase.endedPress} moves ${T.phase.endedMove}`);
  lines.push(`[target] bot-ticks by target slot ${JSON.stringify(T.targets)}`);
  return lines.join('\n');
}

if (IS_MAIN && args.compare) {
  const [a, b] = String(args.compare).split(',').map((pth) => JSON.parse(readFileSync(pth, 'utf8')).results);
  const byTag = new Map(b.map((r) => [r.tag, r]));
  let n = 0, win = 0, order = 0, play = 0, sdA = 0;
  const moved = [];
  for (const r of a) {
    const q = byTag.get(r.tag);
    if (!q) throw new Error(`compare: ${r.tag} missing`);
    n++;
    if (r.sd) sdA++;
    if (r.winnerId !== q.winnerId) win++;
    if (r.deathOrder.join() !== q.deathOrder.join()) order++;
    if (r.playMs !== q.playMs) { play++; if (moved.length < 10) moved.push(`${r.tag}: winner ${r.winnerId}->${q.winnerId} deaths [${r.deathOrder}]->[${q.deathOrder}] play ${r.playMs}->${q.playMs} sdA=${r.sd}`); }
  }
  console.log(`paired six-seat matches ${n} · reached SD (A) ${sdA} · WINNER changed ${win} · death ORDER changed ${order} · any timing changed ${play}`);
  for (const m of moved) console.log(`   ${m}`);
}

if (IS_MAIN && !args.selftest && !args.compare) {
  const T = newTotals();
  const t0 = Date.now();
  for (const [ri, roster] of rosters().entries()) {
    for (let rot = 0; rot < ROTS; rot++) runMatch(seatsFor(roster, rot), T, `r${ri}/rot${rot}`);
  }
  console.log(`bh_ai_six  sim=${SIM}  n=${N}  rosters=${ROSTERS}  rot=${ROTS}  human=${HUMAN}  dt=${DT}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  console.log(summary(T));
  if (args.json) {
    writeFileSync(String(args.json), JSON.stringify(T, null, 1));
    console.log(`wrote ${args.json}`);
  }
}

export { newTotals, summary, readyCastless, seatsFor };

// ═════════════════════════════════════════════════════════════════════════════
// --selftest : every detector must FIRE on a planted defect and stay SILENT on its control.
//
//   in-process, on whatever `--sim` is (prints one JSON line):
//     F1 stale    N=3 fixture (C walks into the plate at (555,290) while A fights B; B dies)
//     F2 lock     N=3 fixture (C hides 110 wu deep; B shoots A from 126 wu) + control (no C)
//     F3 bounds   plant: slot 1 teleported to x=-50 after one step; control: no plant
//     F4 census   1 roster x 6 rotations: stuck windows + countdown moves
//   `--selftest all` (parent): builds the arms in --scratch, runs F1..F4 under each as a child
//   process (one sim per process), and asserts the matrix below.
// ═════════════════════════════════════════════════════════════════════════════
const NEUTRAL = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
const playMsOf = (st) => R.MATCH_DURATION_MS - st.timeRemaining;
function f1Stale() {
  const T = newTotals();
  let killed = false;
  runMatch([
    { characterId: 'hamburger', controller: 'human', maxHp: 1e5, spawn: { x: 555, y: 560 } },
    { characterId: 'burrito', controller: 'ai', maxHp: 1e5, spawn: { x: 820, y: 560 } },
    { characterId: 'hamburger', controller: 'human', maxHp: 1e5, spawn: { x: 820, y: 480 } },
  ], T, 'F1', {
    inputs: (st, inp) => {
      const C = st.fighters[0];
      inp[0] = st.phase === 'playing' && C.y > 325 ? { move: { x: 0, y: -1 }, selectedWeapon: 0, attack: false } : NEUTRAL;
      inp[2] = NEUTRAL;
    },
    afterStep: (st) => {
      if (!killed && st.phase === 'playing' && st.elapsed > 9000) { st.fighters[2].hp = 0; st.fighters[2].alive = false; killed = true; }
    },
    stopWhen: (st) => st.phase === 'playing' && playMsOf(st) > 25000,
  });
  return T.stale.ticks;
}
function f2Lock(withC) {
  const T = newTotals();
  const lettuce = R.CHARACTERS.hamburger.weapons.findIndex((w) => w.key === 'Lettuce');
  runMatch([
    { characterId: 'hamburger', controller: 'human', maxHp: 1e5, spawn: withC ? { x: 555, y: 515 } : { x: 2300, y: 1500 } },
    { characterId: 'burrito', controller: 'ai', maxHp: 400, spawn: { x: 555, y: 675 } },
    { characterId: 'hamburger', controller: 'human', maxHp: 1e5, spawn: { x: 900, y: 600 } },
  ], T, 'F2', {
    inputs: (st, inp) => {
      const C = st.fighters[0], A = st.fighters[1], B = st.fighters[2];
      const playing = st.phase === 'playing';
      inp[0] = withC && playing && C.y > 245 ? { move: { x: 0, y: -1 }, selectedWeapon: 0, attack: false } : NEUTRAL;
      let b = NEUTRAL;
      if (playing && playMsOf(st) > 12000) {
        if (B.x > 556) b = { move: { x: -1, y: 0 }, selectedWeapon: 0, attack: false };
        else if (B.y > 482) b = { move: { x: 0, y: -1 }, selectedWeapon: 0, attack: false };
        else b = { move: { x: 0, y: 0 }, aim: { x: A.x - B.x, y: A.y - B.y }, selectedWeapon: lettuce, attack: true };
      }
      inp[2] = b;
    },
    stopWhen: (st) => st.phase === 'playing' && playMsOf(st) > 32000,
  });
  return T.lock.ticks;
}
function f3Bounds(plant) {
  const T = newTotals();
  let done = false;
  runMatch(seatsFor(rosters()[0], 0), T, 'F3', {
    afterStep: (st) => { if (plant && !done && st.phase === 'playing' && playMsOf(st) > 5000) { st.fighters[1].x = -50; done = true; } },
    stopWhen: (st) => st.phase === 'playing' && playMsOf(st) > 8000,
  });
  return T.bounds.outside;
}
function f4Census() {
  const T = newTotals();
  for (let rot = 0; rot < 6; rot++) runMatch(seatsFor(rosters()[0], rot), T, `F4/rot${rot}`);
  return { stuck: T.stuck.windows, countdownMoves: T.phase.countdownMove + T.phase.countdownPress };
}

if (IS_MAIN && args.selftest && args.selftest !== 'all') {
  console.log(JSON.stringify({ sim: SIM, f1: f1Stale(), f2: f2Lock(true), f2control: f2Lock(false), f3: f3Bounds(true), f3control: f3Bounds(false), f4: f4Census() }));
}

if (IS_MAIN && args.selftest === 'all') {
  const { mkdirSync, copyFileSync } = await import('node:fs');
  const { spawnSync } = await import('node:child_process');
  const HEAD_ROOT = '/private/tmp/fa-rv-head';
  const SCR = String(args.scratch ?? '/private/tmp/claude-501/-Users-uribishansky-claude-code-food-arena/368cb93b-f4f8-420f-a41d-77da26503dd1/scratchpad/bh_ai_trees');
  const FILES = ['sim.ts', 'ai.ts', 'combat.ts', 'movement.ts', 'state.ts', 'rules.ts', 'tuningRegistry.ts', 'tuningStore.ts'];
  const arm = (name, edits) => {
    const root = `${SCR}/selftest_${name}`;
    mkdirSync(`${root}/src/game`, { recursive: true });
    mkdirSync(`${root}/src/arena`, { recursive: true });
    for (const f of FILES) copyFileSync(`${HEAD_ROOT}/src/game/${f}`, `${root}/src/game/${f}`);
    copyFileSync(`${HEAD_ROOT}/src/arena/types.ts`, `${root}/src/arena/types.ts`);
    for (const [file, from, to] of edits) {
      const pth = `${root}/src/game/${file}`;
      const src = readFileSync(pth, 'utf8');
      const k = src.split(from).length - 1;
      if (k !== 1) throw new Error(`selftest arm ${name}: anchor matched ${k}x in ${file}`);
      writeFileSync(pth, src.replace(from, to));
    }
    return `${root}/src/game`;
  };
  const ARMS = {
    head: `${HEAD_ROOT}/src/game`,
    fix_stale: arm('fix_stale', [['ai.ts',
      '  const sighting = state.sightings[sightingIndex(self.id, target.id, state.fighters.length)];\n  if (visible) {',
      '  for (const other of state.fighters) {\n    if (other === self || other === target || !other.alive) continue;\n    if (isVisibleFrom(self.x, self.y, other.x, other.y, state.arena, state, other)) {\n      const c = state.sightings[sightingIndex(self.id, other.id, state.fighters.length)];\n      c.x = other.x; c.y = other.y; c.at = now;\n    }\n  }\n  const sighting = state.sightings[sightingIndex(self.id, target.id, state.fighters.length)];\n  if (visible) {']]),
    fix_lock: arm('fix_lock', [['ai.ts',
      '  const target = nearestLivingOpponent(state, self);\n  if (self.hp <= 0 || target === null) return false;',
      '  let target = nearestLivingOpponent(state, self);\n  if (target !== null && !isVisibleFrom(self.x, self.y, target.x, target.y, state.arena, state, target)) {\n    let bestD = Infinity;\n    for (const o of state.fighters) {\n      if (o === self || !o.alive || o.hp <= 0) continue;\n      if (!isVisibleFrom(self.x, self.y, o.x, o.y, state.arena, state, o)) continue;\n      const d = Math.hypot(o.x - self.x, o.y - self.y);\n      if (d < bestD) { bestD = d; target = o; }\n    }\n  }\n  if (self.hp <= 0 || target === null) return false;']]),
    // KNOWN-BAD: the chase branch never moves.
    bad_nomove: arm('bad_nomove', [['ai.ts',
      '      else steer(adx / adist, ady / adist, tx, ty);\n      moveToward(self, STEER.dirX, STEER.dirY, step, state.arena, STEER.navX, STEER.navY);',
      '      else steer(adx / adist, ady / adist, tx, ty);\n      if (step < 0) moveToward(self, STEER.dirX, STEER.dirY, step, state.arena, STEER.navX, STEER.navY);']]),
    // KNOWN-BAD: bots take their turn during the countdown.
    bad_countdown: arm('bad_countdown', [
      ['sim.ts', "  if (state.phase === 'playing') {\n    /**\n     * ── THE FIGHTER LOOP.", "  if (state.phase === 'playing' || state.phase === 'countdown') {\n    /**\n     * ── THE FIGHTER LOOP."],
      ['ai.ts', "export function stepAI(state: MatchState, self: Fighter, dt: number, events: GameEvent[]): boolean {\n  if (state.phase !== 'playing') return false;", "export function stepAI(state: MatchState, self: Fighter, dt: number, events: GameEvent[]): boolean {"],
    ]),
  };
  const out = {};
  for (const [name, dir] of Object.entries(ARMS)) {
    const r = spawnSync('node', [fileURLToPath(import.meta.url), '--selftest', '--sim', dir], { encoding: 'utf8' });
    const line = (r.stdout || '').trim().split('\n').filter((l) => l.startsWith('{')).pop();
    if (!line) { console.log(`arm ${name}: no result\n${r.stderr}`); process.exit(1); }
    out[name] = JSON.parse(line);
    console.log(`  ${name.padEnd(14)} ${line}`);
  }
  let pass = 0, fail = 0;
  const check = (nm, ok, detail) => { if (ok) pass++; else fail++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${nm}  ${detail}`); };
  check('stale FIRES on HEAD (F1)', out.head.f1 > 0, `ticks=${out.head.f1}`);
  check('stale SILENT with the refresh fix (F1)', out.fix_stale.f1 === 0, `ticks=${out.fix_stale.f1}`);
  check('lock FIRES on HEAD (F2)', out.head.f2 > 0, `ticks=${out.head.f2}`);
  check('lock SILENT on the no-C control (F2)', out.head.f2control === 0, `ticks=${out.head.f2control}`);
  check('lock SILENT with prefer-visible (F2)', out.fix_lock.f2 === 0, `ticks=${out.fix_lock.f2}`);
  check('bounds FIRES on the plant (F3)', out.head.f3 > 0, `outside=${out.head.f3}`);
  check('bounds SILENT without the plant (F3)', out.head.f3control === 0, `outside=${out.head.f3control}`);
  check('stuck SILENT on HEAD (F4)', out.head.f4.stuck === 0, `windows=${out.head.f4.stuck}`);
  check('stuck FIRES on the no-move known-bad (F4)', out.bad_nomove.f4.stuck > 0, `windows=${out.bad_nomove.f4.stuck}`);
  check('phase SILENT on HEAD (F4)', out.head.f4.countdownMoves === 0, `countdown acts=${out.head.f4.countdownMoves}`);
  check('phase FIRES on the countdown known-bad (F4)', out.bad_countdown.f4.countdownMoves > 0, `countdown acts=${out.bad_countdown.f4.countdownMoves}`);
  console.log(`bh_ai_six --selftest all: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
