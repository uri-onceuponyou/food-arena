#!/usr/bin/env node
/**
 * STUN-LOCK — which weapon holds a fighter frozen, and for how long.
 *
 * `STUN_DURATION_MS` (2000) is longer than the COOLDOWN of every weapon that applies
 * it except the ultimate. A weapon that re-stuns faster than its own stun expires can
 * hold a target at zero movement speed indefinitely; the only limit is line of sight
 * and range. This finds the worst case and names the weapon.
 */
import { readFileSync } from 'node:fs';
const ROOT = '/Users/uribishansky/claude-code/food-arena';
const { createMatch, stepMatch } = await import(`${ROOT}/src/game/sim.ts`);
const R = await import(`${ROOT}/src/game/rules.ts`);
const A = JSON.parse(readFileSync(`${ROOT}/tools/tmp/arena.frozen.json`, 'utf8'));
const arena = { ...A, maxSafeRadius: 993, build: () => null, update: () => {} };
const DT = 16.667;

console.log(`STUN_DURATION_MS = ${R.STUN_DURATION_MS}   SLOW_DURATION_MS = ${R.SLOW_DURATION_MS}\n`);
console.log(`weapons that apply a status, and whether their own cooldown outruns it:`);
const rows = [];
for (const id of R.CHARACTER_IDS) for (const w of R.CHARACTERS[id].weapons) {
  if (!w.effect) continue;
  const dur = w.effect === 'stun' ? R.STUN_DURATION_MS : R.SLOW_DURATION_MS;
  rows.push({ id, key: w.key, effect: w.effect, cd: w.cooldown, dur, perma: w.cooldown < dur });
}
rows.sort((a, b) => a.cd - b.cd);
for (const r of rows) {
  console.log(`  ${r.id.padEnd(12)}${r.key.padEnd(9)}${r.effect.padEnd(6)} cd ${String(r.cd).padStart(5)}ms  vs ${r.dur}ms  ` +
    `${r.perma ? `PERMANENT — one weapon alone holds the lock (${(r.dur / r.cd).toFixed(2)}x uptime)` : 'expires between uses'}`);
}
const permaStun = rows.filter((r) => r.effect === 'stun' && r.perma);
const permaSlow = rows.filter((r) => r.effect === 'slow' && r.perma);
console.log(`\n  ${permaStun.length}/${rows.filter((r) => r.effect === 'stun').length} stun weapons and ` +
  `${permaSlow.length}/${rows.filter((r) => r.effect === 'slow').length} slow weapons can hold their effect up ALONE.`);
console.log(`  Shortest stun-applying cooldown in the roster: ${Math.min(...rows.filter((r) => r.effect === 'stun').map((r) => r.cd))}ms` +
  ` — the largest STUN_DURATION_MS that makes a solo lock impossible.`);
console.log(`  Shortest slow-applying cooldown in the roster: ${Math.min(...rows.filter((r) => r.effect === 'slow').map((r) => r.cd))}ms`);

// ── the worst lock actually produced, and by whom ──────────────────────────────
const noInput = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
function chasePolicy() {
  let flip = 1, lastCheck = 0, lastPos = null;
  return (st) => {
    const p = st.player, e = st.enemy;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    let best = null, bestDmg = -Infinity;
    R.CHARACTERS[p.characterId].weapons.forEach((w, i) => {
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
    return { move: { x: q(Math.cos(ang)), y: q(Math.sin(ang)) }, aim: { x: e.x - p.x, y: e.y - p.y },
      selectedWeapon: best ?? 0, attack: best !== null };
  };
}

let worst = { ms: 0 };
const perMatchup = [];
for (const p of R.CHARACTER_IDS) for (const e of R.CHARACTER_IDS) {
  if (p === e) continue;
  const st = createMatch(arena, p, e);
  const act = chasePolicy();
  let run = { player: 0, enemy: 0 }, best = { player: 0, enemy: 0 };
  let since = Infinity, input = noInput;
  while (st.phase !== 'ended' && st.elapsed < 90000) {
    if (since >= 150) { input = act(st); since = 0; }
    stepMatch(st, DT, input); since += DT;
    if (st.phase !== 'playing') continue;
    for (const role of ['player', 'enemy']) {
      if (st.elapsed < st[role].status.stunnedUntil) { run[role] += DT; best[role] = Math.max(best[role], run[role]); }
      else run[role] = 0;
    }
  }
  perMatchup.push({ p, e, player: best.player, enemy: best.enemy });
  for (const role of ['player', 'enemy']) {
    if (best[role] > worst.ms) worst = { ms: best[role], p, e, role };
  }
}
perMatchup.sort((a, b) => Math.max(b.player, b.enemy) - Math.max(a.player, a.enemy));
console.log(`\nworst unbroken movement lock over 110 chase matchups: ${(worst.ms / 1000).toFixed(2)}s ` +
  `(${worst.role} in ${worst.p} vs ${worst.e})`);
console.log(`top 8 matchups by longest lock:`);
for (const r of perMatchup.slice(0, 8)) {
  console.log(`  ${r.p.padEnd(12)}vs ${r.e.padEnd(12)} player locked ${(r.player / 1000).toFixed(2)}s   enemy locked ${(r.enemy / 1000).toFixed(2)}s`);
}
const locked = perMatchup.filter((r) => Math.max(r.player, r.enemy) >= 4000).length;
console.log(`\n  ${locked}/110 matchups produce an unbroken lock of 4s or more.`);
