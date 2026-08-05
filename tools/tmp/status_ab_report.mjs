#!/usr/bin/env node
/**
 * 2x2 REPORT — reads N census JSONs written by `tools/tmp/status_census.mjs` and prints
 * the isolation table for the status-grace rule and the AI hazard fix.
 *
 * The two changes interact (an AI that stops walking into the fog lives longer, which
 * changes how much of the match is spent locked), so neither can be measured by
 * subtracting the other from the combined run. Four staged sims, one arena, one seed set:
 *
 *   BEFORE   HEAD                          (no grace rule, no hazard term)
 *   STATUS   grace only, HEAD's ai.ts
 *   AI       hazard term only, HEAD's combat.ts
 *   BOTH     what ships
 *
 *   node tools/tmp/status_ab_report.mjs BEFORE=/tmp/ab_statusbase.json STATUS=... AI=... BOTH=...
 */
import { readFileSync } from 'node:fs';

const cols = process.argv.slice(2).map((a) => {
  const i = a.indexOf('=');
  return { name: a.slice(0, i), data: JSON.parse(readFileSync(a.slice(i + 1), 'utf8')) };
});
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const sec = (ms) => `${(ms / 1000).toFixed(2)}s`;

const POLICIES = Object.keys(cols[0].data.policies);

for (const policy of POLICIES) {
  const base = cols[0].data.policies[policy];
  console.log(`\n════ ${policy.toUpperCase()} · ${base.n} matches per column ════`);
  const rowsOut = [];
  for (const { name, data } of cols) {
    const p = data.policies[policy];
    const deltas = Object.keys(base.matchupRates).map((k) => (p.matchupRates[k] ?? 0) - base.matchupRates[k]);
    const worse = deltas.filter((d) => d < -1e-9).length;
    const better = deltas.filter((d) => d > 1e-9).length;
    const maxD = deltas.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
    rowsOut.push({
      name, p,
      dWin: (p.playerWinRate - base.playerWinRate) * 100,
      maxD: maxD * 100, worse, better, same: deltas.length - worse - better,
    });
  }
  const h = (s, w) => String(s).padStart(w);
  console.log(`  ${'variant'.padEnd(8)}${h('p.win', 7)}${h('Δwin', 8)}${h('per-matchup ↑/=/↓', 20)}${h('|Δ|max', 8)}${h('play', 8)}${h('engaged', 9)}`);
  for (const r of rowsOut) {
    console.log(`  ${r.name.padEnd(8)}${h(pct(r.p.playerWinRate), 7)}${h(r.dWin.toFixed(1) + 'pp', 8)}` +
      `${h(`${r.better}/${r.same}/${r.worse}`, 20)}${h(r.maxD.toFixed(1) + 'pp', 8)}${h(sec(r.p.meanPlayMs), 8)}${h(sec(r.p.meanEngagedMs), 9)}`);
  }
  console.log(`\n  ${'variant'.padEnd(8)}${h('stun %eng', 10)}${h('reapply', 9)}${h('lock max', 9)}${h('slow %eng', 10)}${h('reapply', 9)}${h('slow max', 9)}`);
  for (const { name, p } of rowsOut) {
    console.log(`  ${name.padEnd(8)}${h(pct(p.stunEngagedShare), 10)}${h(pct(p.stunLockRate), 9)}${h(sec(p.stunLongestMax), 9)}` +
      `${h(pct(p.slowEngagedShare), 10)}${h(pct(p.slowApps > 0 ? (p.byRole.player.slowReapply + p.byRole.enemy.slowReapply) / (p.byRole.player.slowApps + p.byRole.enemy.slowApps) : 0), 9)}${h(sec(p.slowLongestMax), 9)}`);
  }
  console.log(`\n  per-role, share of ENGAGED time locked (stun / slow) and longest unbroken`);
  for (const { name, p } of rowsOut) {
    const b = p.byRole;
    console.log(`  ${name.padEnd(8)} player ${pct(b.player.stunEngagedShare).padStart(6)} / ${pct(b.player.slowEngagedShare).padStart(6)}  max ${sec(b.player.stunLongestMax)} / ${sec(b.player.slowLongestMax)}` +
      `   ·   enemy ${pct(b.enemy.stunEngagedShare).padStart(6)} / ${pct(b.enemy.slowEngagedShare).padStart(6)}  max ${sec(b.enemy.stunLongestMax)} / ${sec(b.enemy.slowLongestMax)}`);
  }
  console.log(`\n  hazards — HP/match taken and who dies to the zone`);
  for (const { name, p } of rowsOut) {
    const b = p.byRole;
    console.log(`  ${name.padEnd(8)} pot  p ${b.player.dmgTaken.hazard.toFixed(1).padStart(5)} / e ${b.enemy.dmgTaken.hazard.toFixed(1).padStart(5)}` +
      `   fog  p ${b.player.dmgTaken.fog.toFixed(1).padStart(5)} / e ${b.enemy.dmgTaken.fog.toFixed(1).padStart(5)}` +
      `   killed by fog  p ${pct(p.playerKilledByFog).padStart(6)} / e ${pct(p.enemyKilledByFog).padStart(6)}` +
      `   selfHeal/match ${p.selfHealPerMatch.toFixed(2)}`);
  }
}
console.log('');
