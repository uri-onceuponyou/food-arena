#!/usr/bin/env node
/**
 * FEEL CENSUS — the sim half of "what actually happens on a hit".
 *
 * Runs real matches through the real `src/game/sim.ts` (no browser, ~20 ms each) and
 * counts every `GameEvent` the sim emits, split by the axes that decide which FEEL
 * channels fire in `match.ts`:
 *
 *   - `hit-landed`   by `source.kind` (weapon / trail / hazard / fog) — because
 *                    match.ts branches hard on that: fog gets no burst and no shake,
 *                    trail/hazard get no hit-stop, only `weapon` gets everything.
 *   - `projectile-destroyed` by `reason` — only `hit-cover` draws anything.
 *   - `match-ended`  by whether anyone actually died, because a timeout end has no
 *                    `death` event and therefore no death burst, no shake, no hit-stop.
 *
 * Why this and not a screenshot: an event type that is never emitted cannot be the
 * reason the game feels flat, and an event emitted hundreds of times per match with no
 * response is the highest-value gap in the file. The audio pillar found exactly this
 * shape — `match-ended` and the FINAL RING had literally no sound because an empty-batch
 * early-out skipped them and 95.3% of ticks carry no events. This asks the same question
 * of the VISUAL consumer of the same stream.
 *
 * The response column is authored from `src/game/match.ts` + `src/game/vfx.ts` by hand
 * and is asserted live by `tools/tmp/feel_probe.mjs`, which reads `window.__feelDebug`
 * (the counters match.ts publishes). This file is the DENOMINATOR; that one is the
 * numerator. Neither is trustworthy alone.
 *
 *   node tools/tmp/feel_census.mjs                     # default matchup
 *   node tools/tmp/feel_census.mjs --all-matchups      # 110 matchups
 *   node tools/tmp/feel_census.mjs --json out.json
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const ARENA_CACHE = `${ROOT}/tools/arena.gameplay.json`;

const { createMatch, stepMatch } = await import(`${ROOT}/src/game/sim.ts`);
const { CHARACTERS, CHARACTER_IDS, HIT_RADIUS_VS_ENEMY, REACH } = await import(`${ROOT}/src/game/rules.ts`);

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}
const args = parseArgs(process.argv);

if (!existsSync(ARENA_CACHE)) {
  console.error(`No arena cache at ${ARENA_CACHE}. Run:  node tools/match-sim.mjs --refresh-arena --url $URL`);
  process.exit(1);
}
const DATA = JSON.parse(readFileSync(ARENA_CACHE, 'utf8'));
const arena = { ...DATA, build: () => null, update: () => {} };

const DT = Number(args.dt ?? 16.667);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

const POT = (arena.hazards ?? []).find((h) => h.kind === 'damage') ?? null;

/**
 * Two policies, and the difference between them IS a finding rather than a detail.
 *
 * `chase` walks straight at the enemy and holds fire. `band` additionally leaves the
 * boiling pot and holds the preferred weapon's range band. Neither is `match-sim.mjs`'s
 * flow-field `smart` — this file deliberately does not depend on that file's internals,
 * and the census question ("which event TYPES occur, and which have no response") does
 * not need a skilled driver. Both are reported so a proportion can never be quoted
 * without the driver that produced it. Treat these as the SHAPE of an event stream, not
 * as pacing: `tools/match-sim.mjs` owns pacing.
 */
function makeDecide(policy) {
  return (state) => {
    const p = state.player, e = state.enemy;
    const d = dist(p.x, p.y, e.x, e.y);
    const ws = CHARACTERS[p.characterId].weapons;
    let idx = 0, best = -1;
    ws.forEach((w, i) => {
      const r = w.range ?? 0;
      if (r > REACH.rangedMax) return;              // skip the map-scale ultimate
      if (d <= r + HIT_RADIUS_VS_ENEMY && (w.damage ?? 0) > best) { best = w.damage ?? 0; idx = i; }
    });

    let tx = e.x, ty = e.y;
    if (policy === 'band') {
      const usable = ws.filter((w) => w.type !== 'self' && (w.range ?? 0) <= REACH.rangedMax);
      const band = (usable.length ? usable.reduce((a, b) => ((a.damage ?? 0) >= (b.damage ?? 0) ? a : b)).range ?? 0 : 0) * 0.85;
      const inPot = POT && dist(p.x, p.y, POT.x, POT.y) < POT.radius + 15;
      if (inPot) {
        const ang = Math.atan2(p.y - POT.y, p.x - POT.x);
        tx = POT.x + Math.cos(ang) * (POT.radius + 60);
        ty = POT.y + Math.sin(ang) * (POT.radius + 60);
      } else if (d < band * 0.6) {
        const ang = Math.atan2(p.y - e.y, p.x - e.x);
        tx = p.x + Math.cos(ang) * 100;
        ty = p.y + Math.sin(ang) * 100;
      }
    }

    const mx = tx - p.x, my = ty - p.y;
    const mag = Math.hypot(mx, my) || 1;
    return {
      move: { x: mx / mag, y: my / mag },
      aim: { x: e.x - p.x, y: e.y - p.y },
      selectedWeapon: idx,
      attack: true,
    };
  };
}

function runMatch(player, enemy, decide) {
  const state = createMatch(arena, player, enemy);
  const counts = new Map();
  const bump = (k) => counts.set(k, (counts.get(k) ?? 0) + 1);
  let ticks = 0;
  let ticksWithEvents = 0;
  let deaths = 0;
  let damageTotal = 0;
  const amounts = [];
  while (state.phase !== 'ended' && ticks < 60000) {
    const evs = stepMatch(state, DT, decide(state));
    ticks++;
    if (evs.length) ticksWithEvents++;
    for (const ev of evs) {
      switch (ev.type) {
        case 'hit-landed':
          bump(`hit-landed:${ev.source.kind}`);
          damageTotal += ev.amount;
          amounts.push(ev.amount);
          if (ev.effect && ev.effect !== 'none') bump(`hit-landed:effect:${ev.effect}`);
          break;
        case 'projectile-destroyed': bump(`projectile-destroyed:${ev.reason}`); break;
        case 'death': deaths++; bump('death'); break;
        default: bump(ev.type);
      }
    }
  }
  bump(`match-ended:${deaths > 0 ? 'by-death' : 'on-the-clock'}`);
  return { counts, ticks, ticksWithEvents, deaths, damageTotal, amounts, seconds: state.elapsed / 1000 };
}

const pairs = [];
if (args['all-matchups']) {
  for (const p of CHARACTER_IDS) for (const e of CHARACTER_IDS) if (p !== e) pairs.push([p, e]);
} else {
  pairs.push([String(args.player ?? 'hamburger'), String(args.enemy ?? 'donut')]);
}

const POLICY = String(args.policy ?? 'band');
const decide = makeDecide(POLICY);

const total = new Map();
let ticks = 0, ticksWithEvents = 0, seconds = 0;
const allAmounts = [];
for (const [p, e] of pairs) {
  const r = runMatch(p, e, decide);
  for (const [k, v] of r.counts) total.set(k, (total.get(k) ?? 0) + v);
  ticks += r.ticks; ticksWithEvents += r.ticksWithEvents; seconds += r.seconds;
  allAmounts.push(...r.amounts);
}

/**
 * What `match.ts` + `vfx.ts` do for each event key, as of the audit. Hand-authored
 * from the source and asserted live by `feel_probe.mjs` — see this file's header.
 * `-` in a column means that channel does not fire for that event.
 */
const RESPONSE = {
  'countdown-tick':                    { vfx: '-', shake: '-', hitstop: '-', hud: 'count card', knock: '-' },
  'match-started':                     { vfx: '-', shake: '-', hitstop: '-', hud: 'GO flash', knock: '-' },
  'match-ended:by-death':              { vfx: '(death burst)', shake: '(0.42)', hitstop: '(90)', hud: 'result card', knock: '-' },
  'match-ended:on-the-clock':          { vfx: '-', shake: '-', hitstop: '-', hud: 'result card', knock: '-' },
  'weapon-fired':                      { vfx: 'spawnWeaponCast', shake: 'giantSlam only', hitstop: 'giantSlam only', hud: 'giantSlam flash', knock: '-' },
  'projectile-spawned':                { vfx: 'sync() mesh', shake: '-', hitstop: '-', hud: '-', knock: '-' },
  'projectile-destroyed:hit-target':   { vfx: '- (hit-landed covers)', shake: '-', hitstop: '-', hud: '-', knock: '-' },
  'projectile-destroyed:hit-cover':    { vfx: 'spawnCoverScuff', shake: '-', hitstop: '-', hud: '-', knock: '-' },
  'projectile-destroyed:expired':      { vfx: '- (deliberate)', shake: '-', hitstop: '-', hud: '-', knock: '-' },
  'hit-landed:weapon':                 { vfx: 'spawnImpactBurst', shake: 'yes', hitstop: '40-80ms', hud: 'dmg number', knock: 'yes' },
  'hit-landed:trail':                  { vfx: 'spawnImpactBurst', shake: 'x0.45', hitstop: '-', hud: 'dmg number', knock: 'yes' },
  'hit-landed:hazard':                 { vfx: 'spawnImpactBurst', shake: 'x0.45', hitstop: '-', hud: 'dmg number', knock: '-' },
  'hit-landed:fog':                    { vfx: '- (deliberate)', shake: '- (deliberate)', hitstop: '-', hud: 'ZONE number + edge', knock: '-' },
  heal:                                { vfx: 'spawnHealPulse', shake: '-', hitstop: '-', hud: 'heal number', knock: '-' },
  death:                               { vfx: 'spawnDeathBurst', shake: '0.42', hitstop: '90ms', hud: '-', knock: '-' },
  'splat-created':                     { vfx: 'sync() decal', shake: '-', hitstop: '-', hud: '-', knock: '-' },
  'trail-mark-created':                { vfx: 'sync() decal', shake: '-', hitstop: '-', hud: '-', knock: '-' },
};

const rows = [...total.entries()].filter(([k]) => !k.startsWith('hit-landed:effect:')).sort((a, b) => b[1] - a[1]);
const pad = (s, n) => String(s).padEnd(n);
console.log(`\nFEEL CENSUS — ${pairs.length} match${pairs.length > 1 ? "es" : ""}, "${POLICY}" policy, dt ${DT} ms`);
console.log(`${(seconds / pairs.length).toFixed(1)} s mean match · ${ticks} ticks · ${(100 * ticksWithEvents / ticks).toFixed(1)}% of ticks carry ANY event\n`);
console.log(`${pad('event', 34)}${pad('count', 8)}${pad('per match', 11)}${pad('vfx', 24)}${pad('shake', 16)}${pad('hitstop', 10)}${pad('hud', 18)}knock`);
console.log('-'.repeat(140));
for (const [k, v] of rows) {
  const r = RESPONSE[k] ?? { vfx: '?', shake: '?', hitstop: '?', hud: '?', knock: '?' };
  console.log(`${pad(k, 34)}${pad(v, 8)}${pad((v / pairs.length).toFixed(1), 11)}${pad(r.vfx, 24)}${pad(r.shake, 16)}${pad(r.hitstop, 10)}${pad(r.hud, 18)}${r.knock}`);
}
for (const k of Object.keys(RESPONSE)) {
  if (!total.has(k)) console.log(`${pad(k, 34)}${pad(0, 8)}${pad('0.0', 11)}(never emitted in this run)`);
}

const sorted = allAmounts.slice().sort((a, b) => a - b);
const q = (p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0;
console.log(`\ndamage per hit-landed: min ${q(0)} · p25 ${q(0.25)} · median ${q(0.5)} · p75 ${q(0.75)} · p95 ${q(0.95)} · max ${q(0.999)}`);
console.log(`hit-stop ms at those (clamp(38 + a*1.8, 40, 80)):  p25 ${Math.min(80, Math.max(40, 38 + q(0.25) * 1.8)).toFixed(0)} · median ${Math.min(80, Math.max(40, 38 + q(0.5) * 1.8)).toFixed(0)} · p95 ${Math.min(80, Math.max(40, 38 + q(0.95) * 1.8)).toFixed(0)}`);
console.log(`shake metres at those (clamp(0.05 + a*0.011, 0.05, 0.5)): p25 ${Math.min(0.5, Math.max(0.05, 0.05 + q(0.25) * 0.011)).toFixed(3)} · median ${Math.min(0.5, Math.max(0.05, 0.05 + q(0.5) * 0.011)).toFixed(3)} · p95 ${Math.min(0.5, Math.max(0.05, 0.05 + q(0.95) * 0.011)).toFixed(3)}`);

if (typeof args.json === 'string') {
  writeFileSync(args.json, JSON.stringify({ pairs: pairs.length, ticks, ticksWithEvents, counts: Object.fromEntries(total), amounts: { p25: q(0.25), p50: q(0.5), p75: q(0.75), p95: q(0.95) } }, null, 2));
  console.log(`\njson -> ${args.json}`);
}
