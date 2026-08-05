#!/usr/bin/env node
/**
 * SIM-LAYER BUG PROBE — four bugs, four measurements, no browser.
 *
 *   node tools/tmp/simlayer_probe.mjs [--only timeout|fairness|trail|melee|clock]
 *
 * Runs the REAL src/game/sim.ts against the REAL cached arena (tools/arena.gameplay.json,
 * the same input tools/match-sim.mjs uses). Every number printed here is produced by
 * stepMatch(), not by a model of it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const { createMatch, stepMatch } = await import(`${ROOT}/src/game/sim.ts`);
const R = await import(`${ROOT}/src/game/rules.ts`);
const ARENA_DATA = JSON.parse(readFileSync(`${ROOT}/tools/arena.gameplay.json`, 'utf8'));
const arena = { ...ARENA_DATA, build: () => null, update: () => {} };

// `arena.maxSafeRadius` is DERIVED from MATCH_DURATION_MS inside `arena/shared.ts`, so
// the cached dump goes stale the moment the clock changes. Recompute it here from the
// same formula rather than quoting a stale 890 — and pass --maxsafe to override.
{
  const HALF_DIAG = Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2);
  const FIRST_CONTACT_MS = 6000; // arena/shared.ts FOG_FIRST_CONTACT_S
  const derived = Math.round(HALF_DIAG / (1 - FIRST_CONTACT_MS / R.MATCH_DURATION_MS));
  arena.maxSafeRadius = Number(process.env.MAXSAFE ?? derived);
  if (arena.maxSafeRadius !== ARENA_DATA.maxSafeRadius) {
    console.log(`   [arena cache says maxSafeRadius=${ARENA_DATA.maxSafeRadius}; using derived ${arena.maxSafeRadius} for MATCH_DURATION_MS=${R.MATCH_DURATION_MS}]`);
  }
}

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, all) =>
    a.startsWith('--') ? [[a.slice(2), all[i + 1]?.startsWith('--') === false ? all[i + 1] : true]] : []),
);
const ONLY = args.only ? String(args.only).split(',') : null;
const want = (k) => !ONLY || ONLY.includes(k);

const DT = 16.667;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const noInput = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
const IDS = R.CHARACTER_IDS;

// ─────────────────────────────────────────────────────────────────────────────
// 1. TIMEOUT — does the clock end anything?
// ─────────────────────────────────────────────────────────────────────────────
if (want('timeout')) {
  console.log(`\n══ 1. TIMEOUT TERMINATION ══  (both fighters immortal, run to 2x the clock)`);
  let noEnd = 0, ended = 0, winners = { player: 0, enemy: 0, null: 0 };
  for (const p of IDS) {
    for (const e of IDS) {
      if (p === e) continue;
      const st = createMatch(arena, p, e);
      st.phase = 'playing';
      st.player.hp = st.player.maxHp = 1e9;
      st.enemy.hp = st.enemy.maxHp = 1e9;
      const cap = R.MATCH_DURATION_MS * 2;
      while (st.elapsed < cap && st.phase !== 'ended') stepMatch(st, DT, noInput);
      if (st.phase === 'ended') { ended++; winners[st.winner ?? 'null']++; } else noEnd++;
    }
  }
  console.log(`   110 forced-immortal matches, stepped to ${(R.MATCH_DURATION_MS * 2) / 1000}s:`);
  console.log(`     ended:  ${ended}   never ended: ${noEnd}`);
  console.log(`     winner distribution: ${JSON.stringify(winners)}`);
  const st = createMatch(arena, 'hamburger', 'donut');
  st.phase = 'playing';
  st.player.hp = st.player.maxHp = 1e9;
  st.enemy.hp = st.enemy.maxHp = 1e9;
  while (st.elapsed < R.MATCH_DURATION_MS * 2 && st.phase !== 'ended') stepMatch(st, DT, noInput);
  console.log(`   sample: after ${(st.elapsed / 1000).toFixed(0)}s  phase=${st.phase}  winner=${st.winner}` +
    `  timeRemaining=${st.timeRemaining}  safeRadius=${st.safeRadius.toFixed(1)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FAIRNESS AT R=0 — who does the fog kill first?
// ─────────────────────────────────────────────────────────────────────────────
if (want('fairness')) {
  console.log(`\n══ 2. FOG RACE AT safeRadius→0 ══  (no attacks possible, positions pinned at centre)`);
  const st = createMatch(arena, 'hamburger', 'donut');
  st.phase = 'playing';
  // Cooldown lock: `now - lastUsed < cooldown` is true for every weapon forever.
  st.player.lastUsed = st.player.lastUsed.map(() => Infinity);
  st.enemy.lastUsed = st.enemy.lastUsed.map(() => Infinity);
  st.timeRemaining = 4000;               // ring is already tiny; both are outside it
  const px = arena.center.x + 5, py = arena.center.y;
  const ex = arena.center.x - 5, ey = arena.center.y;
  let pDead = null, eDead = null;
  while (st.elapsed < 40_000 && (pDead === null || eDead === null)) {
    st.player.x = px; st.player.y = py; st.enemy.x = ex; st.enemy.y = ey;
    const evs = stepMatch(st, DT, noInput);
    for (const ev of evs) {
      if (ev.type === 'death' && ev.fighterRole === 'player' && pDead === null) pDead = st.elapsed;
      if (ev.type === 'death' && ev.fighterRole === 'enemy' && eDead === null) eDead = st.elapsed;
    }
  }
  const fogDps = (R.FOG_DAMAGE / R.FOG_TICK_MS) * 1000;
  console.log(`   fog ${fogDps} HP/s · player ${R.PLAYER_MAX_HP} HP · enemy ${R.ENEMY_MAX_HP} HP`);
  console.log(`   arithmetic time-to-death in fog:  player ${(R.PLAYER_MAX_HP / fogDps).toFixed(2)}s   enemy ${(R.ENEMY_MAX_HP / fogDps).toFixed(2)}s`);
  console.log(`   MEASURED: player died at ${pDead === null ? '—' : (pDead / 1000).toFixed(2) + 's'}` +
    `, enemy at ${eDead === null ? '—' : (eDead / 1000).toFixed(2) + 's'}` +
    `  → gap ${pDead !== null && eDead !== null ? ((eDead - pDead) / 1000).toFixed(2) + 's' : '—'}`);
  console.log(`   winner=${st.winner}  (a timeout resolved by "last one standing" is therefore role-determined)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TRAIL STACKING
// ─────────────────────────────────────────────────────────────────────────────
if (want('trail')) {
  console.log(`\n══ 3. TRAIL DAMAGE PER TICK ══  TRAIL=${JSON.stringify(R.TRAIL)}`);
  const maxAlive = Math.ceil(R.TRAIL.durationMs / R.TRAIL.dropIntervalMs);
  console.log(`   theoretical max simultaneous marks per owner: ${maxAlive}  → worst-case one-tick burst ${maxAlive * R.TRAIL.damage} HP`);

  // (a) synthetic worst case: pile every legal mark on one spot, walk the victim in.
  {
    const st = createMatch(arena, 'hamburger', 'donut');
    st.phase = 'playing';
    st.player.x = arena.center.x; st.player.y = arena.center.y;
    st.enemy.x = arena.center.x; st.enemy.y = arena.center.y;
    st.player.hp = st.player.maxHp = 1e9;
    for (let i = 0; i < maxAlive; i++) {
      st.trailMarks.push({ id: 10_000 + i, ownerRole: 'enemy', x: arena.center.x, y: arena.center.y,
        expiresAt: st.elapsed + R.TRAIL.durationMs, damaged: false });
    }
    const before = st.player.hp;
    const evs = stepMatch(st, DT, noInput);
    const trailHits = evs.filter((e) => e.type === 'hit-landed' && e.source.kind === 'trail');
    console.log(`   (a) stacked ${maxAlive} marks on the victim, ONE ${DT.toFixed(2)}ms tick:`);
    console.log(`       hit events this tick: ${trailHits.length}   HP lost: ${before - st.player.hp}`);
  }

  // (b) real matches: worst single tick observed across every donut matchup.
  {
    let worstHp = 0, worstEvents = 0, worstWhen = null, worstMatch = null;
    let totalTrailDmg = 0, ticksWithTrail = 0, matches = 0;
    const perTickHisto = new Map();
    for (const other of IDS) {
      if (other === 'donut') continue;
      for (const [p, e] of [['donut', other], [other, 'donut']]) {
        matches++;
        const st = createMatch(arena, p, e);
        const decide = makeChasePolicy();
        let input = noInput, since = Infinity;
        while (st.phase !== 'ended' && st.elapsed < R.MATCH_DURATION_MS) {
          if (since >= 150) { input = decide(st); since = 0; }
          const evs = stepMatch(st, DT, input);
          since += DT;
          const th = evs.filter((ev) => ev.type === 'hit-landed' && ev.source.kind === 'trail');
          if (th.length) {
            const hp = th.reduce((a, ev) => a + ev.amount, 0);
            totalTrailDmg += hp; ticksWithTrail++;
            perTickHisto.set(th.length, (perTickHisto.get(th.length) ?? 0) + 1);
            if (hp > worstHp) { worstHp = hp; worstEvents = th.length; worstWhen = st.elapsed; worstMatch = `${p} vs ${e}`; }
          }
        }
      }
    }
    console.log(`   (b) ${matches} real donut matches:`);
    console.log(`       WORST single tick: ${worstHp} HP across ${worstEvents} events  (${worstMatch}, t=${(worstWhen / 1000).toFixed(1)}s)`);
    console.log(`       ticks that dealt any trail damage: ${ticksWithTrail}   total trail damage: ${totalTrailDmg} HP`);
    const histo = [...perTickHisto.entries()].sort((a, b) => a[0] - b[0]);
    console.log(`       events-per-tick histogram: ${histo.map(([k, v]) => `${k}x:${v}`).join(' ')}`);
    console.log(`       one-tick bursts ≥ 25% of PLAYER_MAX_HP: ${histo.filter(([k]) => k * R.TRAIL.damage >= R.PLAYER_MAX_HP * 0.25).reduce((a, [, v]) => a + v, 0)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MELEE AT CONTACT RANGE
// ─────────────────────────────────────────────────────────────────────────────
if (want('melee')) {
  console.log(`\n══ 4. MELEE HITS AT CONTACT RANGE ══`);
  // (a) the degenerate case, directly.
  {
    const smashIdx = R.CHARACTERS.hamburger.weapons.findIndex((w) => w.key === 'Smash');
    const st = createMatch(arena, 'hamburger', 'donut');
    st.phase = 'playing';
    st.player.x = 500; st.player.y = 500;
    st.enemy.x = 500; st.enemy.y = 500;          // dist EXACTLY 0
    st.player.facing = { x: -1, y: 0 };           // facing away is meaningless at dist 0
    const evs = stepMatch(st, 0, { move: { x: 0, y: 0 }, selectedWeapon: smashIdx, attack: true });
    const hit = evs.find((e) => e.type === 'hit-landed');
    console.log(`   (a) dist === 0, cone ${R.CHARACTERS.hamburger.weapons[smashIdx].cone}°, attacker facing 180° away:`);
    console.log(`       hit landed? ${!!hit}   (dot = NaN; NaN > cone/2 is false, so the cone check never rejects)`);
  }
  // (b) how often does a real match actually reach contact range?
  {
    let ticks = 0, d0 = 0, dLt1 = 0, dLt5 = 0, meleeHits = 0, meleeHitsClose = 0, backHits = 0;
    let minDist = Infinity;
    for (const p of IDS) {
      for (const e of IDS) {
        if (p === e) continue;
        const st = createMatch(arena, p, e);
        const decide = makeChasePolicy();
        let input = noInput, since = Infinity;
        while (st.phase !== 'ended' && st.elapsed < R.MATCH_DURATION_MS) {
          if (since >= 150) { input = decide(st); since = 0; }
          const d = dist(st.player, st.enemy);
          const preP = { ...st.player }, preE = { ...st.enemy };
          const evs = stepMatch(st, DT, input);
          since += DT;
          ticks++;
          minDist = Math.min(minDist, d);
          if (d === 0) d0++;
          if (d < 1) dLt1++;
          if (d < 5) dLt5++;
          for (const ev of evs) {
            if (ev.type !== 'hit-landed' || ev.source.kind !== 'weapon') continue;
            const owner = ev.targetRole === 'enemy' ? preP : preE;
            const victim = ev.targetRole === 'enemy' ? preE : preP;
            const def = R.CHARACTERS[owner.characterId];
            const w = def.weapons.find((ww) => ww.key === ev.source.weaponKey);
            if (!w || w.type !== 'melee') continue;
            meleeHits++;
            const dd = dist(owner, victim);
            if (dd < 1) meleeHitsClose++;
            if (dd > 0) {
              const dot = (owner.facing.x * (victim.x - owner.x) + owner.facing.y * (victim.y - owner.y)) / dd;
              const ang = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
              if (ang > (w.cone ?? 360) / 2) backHits++;
            }
          }
        }
      }
    }
    console.log(`   (b) 110 real matches, ${ticks} ticks:`);
    console.log(`       closest approach ever: ${minDist.toFixed(4)}wu`);
    console.log(`       ticks at dist exactly 0: ${d0}   <1wu: ${dLt1}   <5wu: ${dLt5}`);
    console.log(`       melee hits: ${meleeHits}   of which at dist <1wu: ${meleeHitsClose}   outside the cone (pre-tick geometry): ${backHits}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. CLOCK — is 180s ever reached?
// ─────────────────────────────────────────────────────────────────────────────
if (want('clock')) {
  console.log(`\n══ 5. MATCH LENGTH vs THE CLOCK ══  MATCH_DURATION_MS=${R.MATCH_DURATION_MS}`);
  const lens = [];
  let clockReached = 0;
  for (const p of IDS) {
    for (const e of IDS) {
      if (p === e) continue;
      const st = createMatch(arena, p, e);
      const decide = makeChasePolicy();
      let input = noInput, since = Infinity;
      while (st.phase !== 'ended' && st.elapsed < R.MATCH_DURATION_MS + 60_000) {
        if (since >= 150) { input = decide(st); since = 0; }
        stepMatch(st, DT, input);
        since += DT;
      }
      lens.push(R.MATCH_DURATION_MS - st.timeRemaining);
      if (st.timeRemaining <= 0) clockReached++;
    }
  }
  lens.sort((a, b) => a - b);
  const q = (f) => lens[Math.floor(lens.length * f)] / 1000;
  console.log(`   n=${lens.length}   min ${q(0).toFixed(1)}s  p25 ${q(0.25).toFixed(1)}s  median ${q(0.5).toFixed(1)}s  p75 ${q(0.75).toFixed(1)}s  p90 ${q(0.9).toFixed(1)}s  max ${(lens[lens.length - 1] / 1000).toFixed(1)}s`);
  console.log(`   mean ${(lens.reduce((a, b) => a + b, 0) / lens.length / 1000).toFixed(1)}s = ${((lens.reduce((a, b) => a + b, 0) / lens.length) / R.MATCH_DURATION_MS * 100).toFixed(1)}% of the clock`);
  console.log(`   matches that reached the clock: ${clockReached}/${lens.length}`);
  const maxR = arena.maxSafeRadius;
  const half = Math.hypot(arena.width / 2, arena.height / 2);
  const tContact = (1 - half / maxR) * R.MATCH_DURATION_MS;
  const rAtMedian = maxR * (1 - q(0.5) * 1000 / R.MATCH_DURATION_MS);
  console.log(`   maxSafeRadius ${maxR}, arena half-diagonal ${half.toFixed(1)}`);
  console.log(`   fog first touches the playfield at t=${(tContact / 1000).toFixed(1)}s; R at the MEDIAN match end (${q(0.5).toFixed(1)}s) is ${rAtMedian.toFixed(0)}wu (${(rAtMedian / half * 100).toFixed(0)}% of the half-diagonal)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. IDLE-PLAYER ACCEPTANCE TEST for the melee change
// ─────────────────────────────────────────────────────────────────────────────
//
// The melee fix makes a coincident swing MISS. The AI stops walking the moment a
// weapon is in range, so the failure mode to rule out is: AI closes to zero, whiffs
// forever, and a motionless player never dies. Run exactly that — a player that never
// touches the controls, against every character.
if (want('idle')) {
  console.log(`\n══ 6. MOTIONLESS PLAYER vs EVERY AI ══  (the melee-whiff deadlock test)`);
  const rows = [];
  for (const e of IDS) {
    const st = createMatch(arena, 'hamburger', e);
    while (st.phase !== 'ended' && st.elapsed < R.MATCH_DURATION_MS + 20_000) stepMatch(st, DT, noInput);
    rows.push({ e, out: st.phase === 'ended' ? st.winner : 'NO-END', t: st.elapsed, php: st.player.hp });
  }
  const killed = rows.filter((r) => r.out === 'enemy' && r.php === 0).length;
  const timedOut = rows.filter((r) => r.out !== 'NO-END' && r.php > 0).length;
  const stuck = rows.filter((r) => r.out === 'NO-END').length;
  console.log(`   ${rows.length} AIs vs a player that never moves or attacks:`);
  console.log(`     killed the idle player: ${killed}   won on the clock instead: ${timedOut}   NEVER RESOLVED: ${stuck}`);
  const melee = IDS.filter((id) => R.CHARACTERS[id].weapons.some((w) => w.type === 'melee' && (w.cone ?? 360) < 360));
  console.log(`     coned-melee characters (${melee.length}): ` +
    melee.map((id) => `${id}=${rows.find((r) => r.e === id).out}@${(rows.find((r) => r.e === id).t / 1000).toFixed(0)}s`).join(' '));
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. SUSTAINED trail DPS — the cap bounds the TICK; this bounds the SECOND.
// ─────────────────────────────────────────────────────────────────────────────
if (want('traildps')) {
  console.log(`\n══ 7. SUSTAINED TRAIL DPS ══`);
  // (a) adversarial: victim walks straight down a freshly-laid trail at full speed.
  {
    const st = createMatch(arena, 'hamburger', 'donut');
    st.phase = 'playing';
    st.player.hp = st.player.maxHp = 1e9;
    st.enemy.lastUsed = st.enemy.lastUsed.map(() => Infinity); // trail only, no shooting
    const y = arena.center.y;
    let x = 200;
    // Lay a maximal-density line of marks: one every tick along the walk.
    for (let i = 0; i < 400; i++) {
      st.trailMarks.push({ id: 50_000 + i, ownerRole: 'enemy', x: 200 + i * 2, y,
        expiresAt: 1e9, damaged: false });
    }
    st.enemy.x = 1300; st.enemy.y = y;
    let worstSecond = 0;
    const window = [];
    for (let i = 0; i < 600; i++) {
      st.player.x = x; st.player.y = y;
      const hp0 = st.player.hp;
      stepMatch(st, DT, noInput);
      window.push({ t: st.elapsed, d: hp0 - st.player.hp });
      while (window.length && st.elapsed - window[0].t > 1000) window.shift();
      worstSecond = Math.max(worstSecond, window.reduce((a, w) => a + w.d, 0));
      x += R.PLAYER_SPEED * DT;   // full player speed straight down the line
    }
    console.log(`   (a) adversarial walk down a 2wu-spaced mark line: worst 1s window = ${worstSecond} HP/s`);
  }
  // (b) real matches: worst 1-second window of trail damage seen anywhere.
  {
    let worst = 0, worstWho = null, total = 0, matches = 0;
    for (const other of IDS) {
      if (other === 'donut') continue;
      for (const [p, e] of [['donut', other], [other, 'donut']]) {
        matches++;
        const st = createMatch(arena, p, e);
        const decide = makeChasePolicy();
        let input = noInput, since = Infinity;
        const win = [];
        while (st.phase !== 'ended' && st.elapsed < R.MATCH_DURATION_MS) {
          if (since >= 150) { input = decide(st); since = 0; }
          const evs = stepMatch(st, DT, input);
          since += DT;
          const d = evs.filter((ev) => ev.type === 'hit-landed' && ev.source.kind === 'trail')
            .reduce((a, ev) => a + ev.amount, 0);
          total += d;
          win.push({ t: st.elapsed, d });
          while (win.length && st.elapsed - win[0].t > 1000) win.shift();
          const s = win.reduce((a, w) => a + w.d, 0);
          if (s > worst) { worst = s; worstWho = `${p} vs ${e}`; }
        }
      }
    }
    console.log(`   (b) ${matches} real donut matches: worst 1s window = ${worst} HP/s (${worstWho})`);
    console.log(`       total trail damage ${total} HP over ${matches} matches = ${(total / matches).toFixed(1)} HP/match`);
    console.log(`       for scale: fog ${(R.FOG_DAMAGE / R.FOG_TICK_MS) * 1000} HP/s · pot 32 HP/s · Donut's own Candy Barrage ~13-20 HP/s`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// a minimal "walk at them and shoot" policy — deliberately simpler than
// match-sim.mjs's `smart`, because these probes measure mechanics, not pacing.
// ─────────────────────────────────────────────────────────────────────────────
function makeChasePolicy() {
  let flip = 1, lastCheck = 0, lastPos = null;
  return (st) => {
    const p = st.player, e = st.enemy;
    const d = dist(p, e);
    const ws = R.CHARACTERS[p.characterId].weapons;
    let best = null, bestDmg = -Infinity;
    ws.forEach((w, i) => {
      if (w.type === 'self') return;
      if (st.elapsed - p.lastUsed[i] < w.cooldown) return;
      if (d > (w.range ?? Infinity)) return;
      if ((w.damage ?? 0) > bestDmg) { bestDmg = w.damage ?? 0; best = i; }
    });
    if (st.elapsed - lastCheck > 1200) {
      if (lastPos && Math.hypot(p.x - lastPos.x, p.y - lastPos.y) < 40) flip = -flip;
      lastPos = { x: p.x, y: p.y }; lastCheck = st.elapsed;
    }
    const ang = Math.atan2(e.y - p.y, e.x - p.x) + (flip < 0 ? Math.PI / 2 : 0);
    const q = (v) => (v > 0.35 ? 1 : v < -0.35 ? -1 : 0);
    return {
      move: { x: q(Math.cos(ang)), y: q(Math.sin(ang)) },
      aim: { x: e.x - p.x, y: e.y - p.y },
      selectedWeapon: best ?? 0,
      attack: best !== null,
    };
  };
}
console.log('');
