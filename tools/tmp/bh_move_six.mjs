#!/usr/bin/env node
/**
 * BH_MOVE_SIX — a six-seat corpus probe for the movement / collision / ring / hazard
 * dimension. Review-phase (2026-10-15). READ-ONLY: imports the sim from `--src-root`
 * (default: the clean detached worktree of HEAD, /private/tmp/fa-rv-head) and writes only
 * under shots/rv/bugs/move/.
 *
 * Every seat is `controller: 'ai'` (as `sx_census.mjs`), roster shuffled per match with the
 * same seeded picker, shipped spawns, dt 16.667. Per tick it audits:
 *
 *   INVARIANTS   every LIVING fighter is in bounds and NOT inside inflated cover.
 *                (`escapeCover`'s header: "a fighter that is trying to move is not inside a box")
 *   DISPOSAL     every `item-hit` for `disposal`: did the victim land inside cover after
 *                `placeFighterAt`'s depenetration, and if so how long did it stay put?
 *   FOG          per fighter: ms spent outside the ring before sudden death, number of
 *                separate excursions, fog HP taken, and the "free" ms (outside, no tick
 *                ever charged for that excursion) — the per-excursion reset of `fogTimer`.
 *   POT          ms inside `POT.dangerRadius`, excursions, pot HP taken.
 *   FREEZE       longest window in which a living fighter neither moved > 0.5 wu nor
 *                fired an `attack-started`-class event (proxy for "stuck, not shooting").
 *
 * Arms (`--arm`):
 *   base       no items (the shipped bot loadout).
 *   disposal   every seat equips ['disposal'] — an INSTRUMENT loadout (shipped bots equip
 *              nothing; the local human can). Measures P(trap | press).
 *   springform every seat equips ['springform'] — exercises the fast displacement path.
 *   immortal   maxHp 1e7 — forces the ring through its whole schedule (fog accounting).
 *   knownbad-trap  (vestigial) the disposal arm under another name; it only adds the
 *              "landed within a body of a box face" superset counter. The real known-bad
 *              for the inside-cover landing predicate is `bh_move_trap.mjs --selftest`'s e2e
 *              arm, which drives the same predicate to TRUE on a planted slit.
 *   RAW landing reconstruction (disposal arms): dest + dropDistance * unit(from - dest),
 *              rebuilt from positions around `stepMatch` on SINGLE-press ticks only, and
 *              self-checked: an open-floor raw landing must equal the event's landing.
 *   OSCILLATION windows are a coarse proxy — every one traced so far was a flee/chase or
 *              medikit turnaround (AI policy), not a navigation stall.
 *
 * Use:  node tools/tmp/bh_move_six.mjs --arm disposal --matches 200
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO = resolve(new URL('../..', import.meta.url).pathname);
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
  else { args[a.slice(2)] = n; i++; }
}
const SRC_ROOT = resolve(String(args['src-root'] ?? (existsSync('/private/tmp/fa-rv-head/src/game/sim.ts') ? '/private/tmp/fa-rv-head' : REPO)));
const ARENA_PATH = resolve(String(args.arena ?? `${SRC_ROOT}/tools/arena.gameplay.json`));
const OUT_DIR = resolve(String(args.out ?? `${REPO}/shots/rv/bugs/move`));
const ARM = String(args.arm ?? 'base');
const N = Number(args.n ?? 6);
const MATCHES = Number(args.matches ?? 40);
const DT = Number(args.dt ?? 16.667);
const START = Number(args.start ?? 0);

const { createMatch, stepMatch } = await import(`${SRC_ROOT}/src/game/sim.ts`);
const { placeFighterAt, tryMove } = await import(`${SRC_ROOT}/src/game/movement.ts`);
const { nearestLivingOpponent } = await import(`${SRC_ROOT}/src/game/state.ts`);
const R = await import(`${SRC_ROOT}/src/game/rules.ts`);
const { CHARACTER_IDS, LEVEL_MIN, MATCH_DURATION_MS, POT, PLAYER_SIZE, FOG_TICK_MS, suddenDeathActive } = R;
const HARD_CAP = MATCH_DURATION_MS * 4;
const HALF = PLAYER_SIZE / 2;

const ARENA = { ...JSON.parse(readFileSync(ARENA_PATH, 'utf8')), build: () => null, update: () => {} };
const insideCover = (x, y) => ARENA.cover.find((o) => Math.abs(x - o.x) < (PLAYER_SIZE + o.w) / 2 && Math.abs(y - o.y) < (PLAYER_SIZE + o.h) / 2) ?? null;
const potHz = ARENA.hazards.find((h) => h.kind === 'damage');

function rosterFor(i) {
  const ids = CHARACTER_IDS.slice();
  let s = (i * 2654435761) >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0; t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let k = ids.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [ids[k], ids[j]] = [ids[j], ids[k]]; }
  return ids.slice(0, N);
}

function runMatch(i) {
  const ids = rosterFor(i);
  const configs = ids.map((characterId, seat) => {
    const c = { characterId, controller: 'ai', spawn: { ...ARENA.spawns[seat] }, level: LEVEL_MIN };
    if (ARM === 'disposal' || ARM === 'knownbad-trap') c.items = ['disposal'];
    if (ARM === 'springform') c.items = ['springform'];
    if (ARM === 'immortal') c.maxHp = 1e7;
    return c;
  });
  const state = createMatch(ARENA, configs);
  const n = state.fighters.length;
  const inputs = new Array(n).fill(null);
  const rec = {
    i, ids, ending: null, durationS: 0,
    invariantFaults: [],
    disposal: { hits: 0, insideAfterPlace: 0, insideRaw: 0, trapped: [], rawInsideCover: 0, rawTrap: 0, rawReconstructed: 0 },
    fog: Array.from({ length: n }, () => ({ outsideMs: 0, excursions: 0, freeExcursions: 0, freeMs: 0, fogHp: 0 })),
    pot: Array.from({ length: n }, () => ({ insideMs: 0, excursions: 0, potHp: 0 })),
    freeze: new Array(n).fill(0),
    // OSCILLATION: 5 s windows in which a living fighter walked > 150 wu but ended < 25 wu
    // from where it started, fired nothing, and had no opponent within 220 wu — the shape of
    // the old alcove deadlock (`movement.ts` NAV block), which the freeze proxy cannot see.
    oscillation: [],
  };
  const hist = Array.from({ length: n }, () => []);
  const lastFire = new Array(n).fill(-Infinity);
  const prevOutside = new Array(n).fill(false);
  const excursionCharged = new Array(n).fill(false);
  const excursionMs = new Array(n).fill(0);
  const prevInPot = new Array(n).fill(false);
  const anchor = state.fighters.map((f) => ({ x: f.x, y: f.y, t: 0 }));
  const trappedWatch = new Map(); // id -> { x, y, since, landedAt }

  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    // Pre-tick positions of everyone, so a disposal landing can be compared with where the
    // victim was (the event carries both ends too).
    const pre = state.fighters.map((f) => ({ x: f.x, y: f.y, alive: f.alive }));
    const evs = stepMatch(state, DT, inputs);
    const playing = state.phase === 'playing' || state.phase === 'ended';
    const sd = suddenDeathActive(state.timeRemaining);
    let attacked = new Set();
    for (const ev of evs) {
      if (ev.type === 'attack' || ev.type === 'attack-started' || ev.type === 'projectile-spawned' || ev.type === 'weapon-fired' || ev.type === 'cast-started') {
        const id = ev.attackerId ?? ev.ownerId ?? ev.fighterId;
        if (id !== undefined) attacked.add(id);
      }
      if (ev.type === 'hit-landed') {
        if (ev.source.kind === 'fog') { rec.fog[ev.targetId].fogHp += ev.amount; if (!sd) excursionCharged[ev.targetId] = true; }
        if (ev.source.kind === 'hazard') rec.pot[ev.targetId].potHp += ev.amount;
      }
      if (ev.type === 'item-hit' && ev.itemId === 'disposal') {
        rec.disposal.hits++;
        const v = state.fighters[ev.targetId];
        // knownbad-trap: test the RAW landing (dest + dropDistance * u), reconstructed from the
        // event's destination end before depenetration is impossible to observe directly, so
        // the known-bad instead counts landings whose post-placement point is within one body
        // of a box face — a strict superset of "inside after depenetration".
        if (insideCover(ev.x, ev.y)) {
          rec.disposal.insideAfterPlace++;
          trappedWatch.set(ev.targetId, { x: v.x, y: v.y, since: state.elapsed, landedAt: { x: ev.x, y: ev.y }, from: { x: ev.fromX, y: ev.fromY } });
        }
        // Reconstruct the RAW landing (before depenetration): dest = nearest living opponent of
        // the victim excluding the thrower, at its position AT THE PRESS — post-turn if its slot
        // acted before the thrower this tick, pre-tick otherwise.
        // ⚠️ ONLY on ticks with ONE disposal: a second press in the same tick relocates
        // fighters between the presses, and positions read around stepMatch cannot see that
        // (measured: every reconstruction mismatch sat on a 3-4-press tick).
        if (evs.filter((e2) => e2.type === 'item-hit' && e2.itemId === 'disposal').length === 1) {
          const user = ev.ownerId, vid = ev.targetId;
          let best = null, bd = Infinity;
          for (const o of state.fighters) {
            if (o.id === vid || o.id === user || !pre[o.id].alive) continue;
            const ox = o.id < user ? o.x : pre[o.id].x, oy = o.id < user ? o.y : pre[o.id].y;
            const d = Math.hypot(ox - ev.fromX, oy - ev.fromY);
            if (d < bd) { bd = d; best = { x: ox, y: oy }; }
          }
          if (best) {
            let dx = ev.fromX - best.x, dy = ev.fromY - best.y; const m = Math.hypot(dx, dy);
            if (m > 1e-6) { dx /= m; dy /= m;
              const rx = Math.min(ARENA.width - HALF, Math.max(HALF, best.x + dx * R.ITEM_TUNING.disposal.dropDistance));
              const ry = Math.min(ARENA.height - HALF, Math.max(HALF, best.y + dy * R.ITEM_TUNING.disposal.dropDistance));
              rec.disposal.rawReconstructed++;
              // VALIDATION of the reconstruction: a raw landing in the open is not moved by
              // placeFighterAt, so it must equal the event's landing to the last digit.
              if (!insideCover(rx, ry)) { rec.disposal.openChecked = (rec.disposal.openChecked ?? 0) + 1; if (Math.hypot(rx - ev.x, ry - ev.y) > 1e-6) rec.disposal.openMismatch = (rec.disposal.openMismatch ?? 0) + 1; }
              if (insideCover(rx, ry)) {
                rec.disposal.rawInsideCover++;
                const g = { x: rx, y: ry, size: PLAYER_SIZE, push: { x: 0, y: 0, remaining: 0, speed: 0 } };
                placeFighterAt(g, rx, ry, ARENA);
                for (let q = 0; q < 64; q++) tryMove(g, [1, -1, 0, 0, 1, -1, 1, -1][q % 8] * 4.5, [0, 0, 1, -1, 1, 1, -1, -1][q % 8] * 4.5, ARENA);
                if (insideCover(g.x, g.y)) rec.disposal.rawTrap++;
              }
            }
          }
        }
        const nearFace = ARENA.cover.some((o) => Math.abs(ev.x - o.x) < (PLAYER_SIZE + o.w) / 2 + HALF && Math.abs(ev.y - o.y) < (PLAYER_SIZE + o.h) / 2 + HALF);
        if (nearFace) rec.disposal.insideRaw++;
      }
    }
    if (!playing) continue;
    for (let k = 0; k < n; k++) {
      const f = state.fighters[k];
      if (!f.alive) {
        if (trappedWatch.has(k)) {
          const w = trappedWatch.get(k);
          rec.disposal.trapped.push({ id: k, char: ids[k], heldMs: state.elapsed - w.since, endedBy: 'death', landedAt: w.landedAt, from: w.from, moved: Math.hypot(f.x - w.x, f.y - w.y) });
          trappedWatch.delete(k);
        }
        prevOutside[k] = false; prevInPot[k] = false;
        continue;
      }
      // Invariants.
      if (f.x < HALF - 1e-9 || f.x > ARENA.width - HALF + 1e-9 || f.y < HALF - 1e-9 || f.y > ARENA.height - HALF + 1e-9) {
        if (rec.invariantFaults.length < 20) rec.invariantFaults.push({ t: state.elapsed, id: k, kind: 'oob', x: f.x, y: f.y });
      }
      const box = insideCover(f.x, f.y);
      if (box && !trappedWatch.has(k)) {
        if (rec.invariantFaults.length < 20) rec.invariantFaults.push({ t: state.elapsed, id: k, kind: 'inside-cover', x: f.x, y: f.y, box: `${box.kind}@${box.x},${box.y}` });
      }
      // Fog accounting (ordinary fog only — sudden death is a common clock, applied separately).
      const out = !sd && Math.hypot(f.x - ARENA.center.x, f.y - ARENA.center.y) > state.safeRadius;
      if (out) {
        rec.fog[k].outsideMs += DT;
        excursionMs[k] += DT;
        if (!prevOutside[k]) { rec.fog[k].excursions++; excursionCharged[k] = false; excursionMs[k] = DT; }
      } else if (prevOutside[k]) {
        if (!excursionCharged[k]) { rec.fog[k].freeExcursions++; rec.fog[k].freeMs += excursionMs[k]; }
      }
      prevOutside[k] = out;
      // Pot.
      const inPot = potHz && Math.hypot(f.x - potHz.x, f.y - potHz.y) < potHz.radius;
      if (inPot) { rec.pot[k].insideMs += DT; if (!prevInPot[k]) rec.pot[k].excursions++; }
      prevInPot[k] = !!inPot;
      // Oscillation proxy.
      if (attacked.has(k)) lastFire[k] = state.elapsed;
      const h = hist[k]; h.push({ x: f.x, y: f.y, t: state.elapsed });
      if (h.length > 300) h.shift();
      if (h.length === 300 && (h.length % 1 === 0) && Math.round(state.elapsed / DT) % 30 === 0) {
        let path = 0; for (let q = 1; q < h.length; q++) path += Math.hypot(h[q].x - h[q - 1].x, h[q].y - h[q - 1].y);
        const net = Math.hypot(h[h.length - 1].x - h[0].x, h[h.length - 1].y - h[0].y);
        const nearOpp = state.fighters.some((o) => o !== f && o.alive && Math.hypot(o.x - f.x, o.y - f.y) < 220);
        if (path > 150 && net < 25 && state.elapsed - lastFire[k] > 5000 && !nearOpp) {
          if (rec.oscillation.length < 50) rec.oscillation.push({ t: +(state.elapsed / 1000).toFixed(1), id: k, char: ids[k], x: +f.x.toFixed(0), y: +f.y.toFixed(0), path: +path.toFixed(0), net: +net.toFixed(1) });
        }
      }
      // Freeze proxy.
      const a = anchor[k];
      if (Math.hypot(f.x - a.x, f.y - a.y) > 0.5 || attacked.has(k)) { anchor[k] = { x: f.x, y: f.y, t: state.elapsed }; }
      else rec.freeze[k] = Math.max(rec.freeze[k], state.elapsed - a.t);
      // Trapped victims: still exactly where they landed?
      if (trappedWatch.has(k)) {
        const w = trappedWatch.get(k);
        if (Math.hypot(f.x - w.x, f.y - w.y) > 1e-6) {
          rec.disposal.trapped.push({ id: k, char: ids[k], heldMs: state.elapsed - w.since, endedBy: 'moved', landedAt: w.landedAt, from: w.from, moved: Math.hypot(f.x - w.x, f.y - w.y) });
          trappedWatch.delete(k);
        }
      }
    }
  }
  for (const [k, w] of trappedWatch) {
    rec.disposal.trapped.push({ id: k, char: ids[k], heldMs: state.elapsed - w.since, endedBy: state.phase === 'ended' ? 'match-end' : 'cap', landedAt: w.landedAt, from: w.from, moved: 0 });
  }
  rec.ending = state.phase !== 'ended' ? 'UNRESOLVED' : state.timeRemaining > 0 ? 'knockout' : 'timeout';
  rec.durationS = +((MATCH_DURATION_MS - state.timeRemaining) / 1000).toFixed(2);
  return rec;
}

mkdirSync(OUT_DIR, { recursive: true });
console.log(`src-root ${SRC_ROOT}  arena ${ARENA_PATH}  arm=${ARM}  N=${N}  matches=${MATCHES}`);
const t0 = Date.now();
const recs = [];
for (let i = START; i < START + MATCHES; i++) recs.push(runMatch(i));
const ms = Date.now() - t0;

const sum = (a) => a.reduce((x, y) => x + y, 0);
const faults = recs.flatMap((r) => r.invariantFaults.map((f) => ({ match: r.i, ...f })));
const dHits = sum(recs.map((r) => r.disposal.hits));
const dInside = sum(recs.map((r) => r.disposal.insideAfterPlace));
const dRaw = sum(recs.map((r) => r.disposal.insideRaw));
const rawRec = sum(recs.map((r) => r.disposal.rawReconstructed));
const rawIn = sum(recs.map((r) => r.disposal.rawInsideCover));
const rawTrap = sum(recs.map((r) => r.disposal.rawTrap));
const openChecked = sum(recs.map((r) => r.disposal.openChecked ?? 0));
const openMismatch = sum(recs.map((r) => r.disposal.openMismatch ?? 0));
const trapped = recs.flatMap((r) => r.disposal.trapped.map((t) => ({ match: r.i, ...t })));
const fogAll = recs.flatMap((r) => r.fog);
const potAll = recs.flatMap((r) => r.pot);
const outsideMs = sum(fogAll.map((f) => f.outsideMs));
const freeMs = sum(fogAll.map((f) => f.freeMs));
const exc = sum(fogAll.map((f) => f.excursions));
const freeExc = sum(fogAll.map((f) => f.freeExcursions));
const fogHp = sum(fogAll.map((f) => f.fogHp));
const potMs = sum(potAll.map((p) => p.insideMs));
const potHp = sum(potAll.map((p) => p.potHp));
const potExc = sum(potAll.map((p) => p.excursions));
const endings = recs.reduce((o, r) => ((o[r.ending] = (o[r.ending] ?? 0) + 1), o), {});
const osc = recs.flatMap((r) => r.oscillation.map((o) => ({ match: r.i, ...o })));
const freezes = recs.flatMap((r) => r.freeze.map((ms, id) => ({ match: r.i, id, char: r.ids[id], ms }))).sort((a, b) => b.ms - a.ms);

console.log(`\n${MATCHES} matches in ${(ms / 1000).toFixed(1)} s · endings ${JSON.stringify(endings)} · mean duration ${(sum(recs.map((r) => r.durationS)) / MATCHES).toFixed(1)} s`);
console.log(`INVARIANTS  ${faults.length} faults (in-bounds + not-inside-cover, every living fighter, every tick${ARM.includes('disposal') || ARM === 'knownbad-trap' ? ', trapped disposal victims excluded — counted below' : ''})`);
for (const f of faults.slice(0, 10)) console.log(`   ${JSON.stringify(f)}`);
if (dHits || ARM.includes('disposal') || ARM === 'knownbad-trap') {
  console.log(`DISPOSAL    ${dHits} hits · ${dInside} landed INSIDE cover after depenetration (${dHits ? ((100 * dInside) / dHits).toFixed(1) : '—'}%) · ${dRaw} landed within a body of a box face (known-bad superset)`);
  console.log(`            RAW landings reconstructed ${rawRec}/${dHits} (single-press ticks only): ${rawIn} inside inflated cover (${rawRec ? ((100 * rawIn) / rawRec).toFixed(1) : '—'}%), of which ${rawTrap} are census TRAPS · reconstruction check: ${openMismatch} of ${openChecked} open-floor landings differ from the event (must be 0)`);
  const held = trapped.map((t) => t.heldMs);
  console.log(`            trapped victims: ${trapped.length} · ended by ${JSON.stringify(trapped.reduce((o, t) => ((o[t.endedBy] = (o[t.endedBy] ?? 0) + 1), o), {}))} · held ${held.length ? `median ${(held.sort((a, b) => a - b)[Math.floor(held.length / 2)] / 1000).toFixed(1)} s, max ${(Math.max(...held) / 1000).toFixed(1)} s` : '—'}`);
  for (const t of trapped.slice(0, 8)) console.log(`   ${JSON.stringify(t)}`);
}
console.log(`FOG         outside ${(outsideMs / 1000).toFixed(1)} fighter-s over ${exc} excursions · ${fogHp} fog HP (pre-SD + SD) · ${freeExc} excursions (${exc ? ((100 * freeExc) / exc).toFixed(1) : '—'}%) never charged, ${(freeMs / 1000).toFixed(1)} s (${outsideMs ? ((100 * freeMs) / outsideMs).toFixed(1) : '—'}% of outside time) free`);
console.log(`POT         inside ${(potMs / 1000).toFixed(1)} fighter-s over ${potExc} excursions · ${potHp} pot HP`);
console.log(`OSCILLATION ${osc.length} flagged 5 s windows (walked >150 wu, net <25 wu, no shot, no opponent within 220 wu)${osc.length ? ': ' + osc.slice(0, 6).map((o) => `m${o.match}/s${o.id}(${o.char}) t${o.t} @${o.x},${o.y} path ${o.path} net ${o.net}`).join(' · ') : ''}`);
console.log(`FREEZE      top 5 longest no-move-no-attack windows: ${freezes.slice(0, 5).map((f) => `m${f.match}/s${f.id}(${f.char}) ${(f.ms / 1000).toFixed(1)}s`).join(' · ')}`);
const out = `${OUT_DIR}/six_${ARM}_${START}_${MATCHES}.json`;
writeFileSync(out, JSON.stringify({ srcRoot: SRC_ROOT, arm: ARM, N, MATCHES, DT, endings, faults, dHits, dInside, dRaw, rawRec, rawIn, rawTrap, trapped, outsideMs, freeMs, exc, freeExc, fogHp, potMs, potHp, potExc, freezes: freezes.slice(0, 50), osc, recs }, null, 1));
console.log(`wrote ${out}`);
