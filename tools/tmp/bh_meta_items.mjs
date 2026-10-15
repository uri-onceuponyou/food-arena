#!/usr/bin/env node
/**
 * bh_meta_items — REVIEW-phase probe (2026-10-15): what an EQUIPPED item actually does in
 * the real sim, with bots carrying nothing (which is what `match.ts:newMatch` ships —
 * grep `items: slot === LOCAL_SLOT`). Pure Node, writes nothing tracked.
 *
 *   node tools/tmp/bh_meta_items.mjs [--root /private/tmp/fa-rv-head] [--n6 12] [--out <json>]
 *
 * ── §A BLUE CHEESE — a passive the picker promises, and nothing the sim does ───────
 *   Paired arms on identical rosters (the sim has no RNG): CONTROL (slot 0 carries
 *   nothing) · BLUE CHEESE on slot 0 · TENDERISER on slot 0 (the POSITIVE CONTROL — a
 *   passive that is implemented MUST move outcomes, or "identical" proves nothing).
 *   Non-vacuity: count ticks where a living opponent stands inside
 *   `ITEM_TUNING.blue_cheese.radius` of the living wearer. If that exposure is > 0 and the
 *   arm is bit-identical to control, the aura never fired.
 *
 * ── §B THE FREE ITEM — slot 0's win rate with one passive and bots carrying nothing ─
 *   Same corpus, read as a win rate. This is the economy-side consequence of
 *   `ITEM_TEST_GRANT_ALL` (every profile may equip Tenderiser) meeting a shipped match
 *   in which no bot equips anything: the trophy/coin faucets are tuned at a 60% win rate.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const A = process.argv.slice(2);
const arg = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const ROOT = resolve(arg('--root', '/private/tmp/fa-rv-head'));
const OUT = resolve(arg('--out', 'shots/rv/bugs/meta/bh_meta_items.json'));
const N6 = Number(arg('--n6', 12));
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);

const RULES = await imp('src/game/rules.ts');
const SIM = await imp('src/game/sim.ts');
const BRAWL = await imp('src/ui/screens/brawl.ts');
const RAW = JSON.parse(readFileSync(join(ROOT, 'tools/arena.gameplay.json'), 'utf8'));
const ARENA = { ...RAW, build: () => null, update: () => {} };
const IDS = RULES.CHARACTER_IDS;
const AURA_R = RULES.ITEM_TUNING.blue_cheese.radius;
const DT = 1000 / 60;

const rows = [];
let faults = 0;
function ok(sec, name, pass, detail = '') {
  rows.push({ sec, name, pass: !!pass, detail });
  if (!pass) faults++;
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${sec} ${name}${detail ? `  — ${detail}` : ''}`);
}

function play(n, player, enemy, items) {
  const roster = BRAWL.brawlRoster(player, enemy, n);
  const configs = roster.map((characterId, slot) => ({
    characterId, controller: 'ai', items: slot === 0 ? items : undefined,
  }));
  const state = SIM.createMatch(ARENA, configs);
  const idle = configs.map(() => ({ move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false }));
  const counts = {};
  let exposureTicks = 0;
  let ticks = 0;
  let dmgEvents = 0;
  while (state.phase !== 'ended' && ticks++ < 200000) {
    const evs = SIM.stepMatch(state, DT, idle);
    for (const ev of evs) {
      counts[ev.type] = (counts[ev.type] ?? 0) + 1;
      if (ev.type === 'damage' || ev.type === 'hit') dmgEvents++;
    }
    if (state.phase === 'playing') {
      const w = state.fighters[0];
      if (w.alive && w.hp > 0) {
        for (let i = 1; i < state.fighters.length; i++) {
          const o = state.fighters[i];
          if (o.alive && o.hp > 0 && Math.hypot(o.x - w.x, o.y - w.y) <= AURA_R) { exposureTicks++; break; }
        }
      }
    }
  }
  const fp = JSON.stringify({
    phase: state.phase, elapsed: state.elapsed, winnerId: state.winnerId ?? null,
    f: state.fighters.map((f) => [Math.round(f.x * 1e6), Math.round(f.y * 1e6), Math.round(f.hp * 1e6), f.alive, f.deaths]),
    counts,
  });
  return { fp, winnerId: state.winnerId ?? null, exposureTicks, ticks, counts };
}

const report = { root: ROOT, at: new Date().toISOString(), auraRadius: AURA_R, arms: {} };
console.log(`bh_meta_items  root=${ROOT}  blue_cheese radius=${AURA_R}`);
const PAIRS = [];
for (const p of IDS) for (const e of IDS) if (p !== e) PAIRS.push([p, e]);

for (const [n, pairs] of [[2, PAIRS], [6, PAIRS.filter((_, i) => i % Math.max(1, Math.floor(PAIRS.length / N6)) === 0).slice(0, N6)]]) {
  const t0 = Date.now();
  const res = { control: [], blue_cheese: [], tenderiser: [] };
  for (const [p, e] of pairs) {
    res.control.push(play(n, p, e, undefined));
    res.blue_cheese.push(play(n, p, e, ['blue_cheese']));
    res.tenderiser.push(play(n, p, e, ['tenderiser']));
  }
  const m = pairs.length;
  const same = (arm) => res[arm].filter((r, i) => r.fp === res.control[i].fp).length;
  const wins = (arm) => res[arm].filter((r) => r.winnerId === 0).length;
  const exposure = res.blue_cheese.reduce((s, r) => s + r.exposureTicks, 0);
  const exposedMatches = res.blue_cheese.filter((r) => r.exposureTicks >= 60).length;
  const out = {
    matches: m, seconds: +((Date.now() - t0) / 1000).toFixed(1),
    blueCheeseIdenticalToControl: same('blue_cheese'), tenderiserIdenticalToControl: same('tenderiser'),
    blueCheeseExposureTicks: exposure, blueCheeseMatchesWith1sExposure: exposedMatches,
    slot0Wins: { control: wins('control'), blue_cheese: wins('blue_cheese'), tenderiser: wins('tenderiser') },
  };
  report.arms[`N${n}`] = out;
  console.log(`\n  N=${n}: ${m} paired rosters in ${out.seconds} s`);
  console.log(`    blue_cheese bit-identical to control: ${out.blueCheeseIdenticalToControl}/${m}`
    + ` · tenderiser bit-identical: ${out.tenderiserIdenticalToControl}/${m}`);
  console.log(`    exposure (living opponent inside ${AURA_R} wu of the living wearer): ${exposure} ticks,`
    + ` ${exposedMatches}/${m} matches with >= 1 s`);
  console.log(`    slot-0 wins: control ${out.slot0Wins.control}/${m} · blue_cheese ${out.slot0Wins.blue_cheese}/${m}`
    + ` · tenderiser ${out.slot0Wins.tenderiser}/${m}`);
  ok(`§A N=${n}`, 'NON-VACUITY: opponents DID stand inside the cloud radius (the aura had chances to fire)',
    exposedMatches > 0, `${exposedMatches}/${m} matches, ${exposure} ticks`);
  ok(`§A N=${n}`, 'POSITIVE CONTROL: an implemented passive (Tenderiser) moves outcomes on the same corpus',
    out.tenderiserIdenticalToControl < m, `${m - out.tenderiserIdenticalToControl}/${m} rosters moved`);
  ok(`§A N=${n}`, 'DEFECT: Blue Cheese is BIT-IDENTICAL to carrying nothing on every roster',
    out.blueCheeseIdenticalToControl === m, `${out.blueCheeseIdenticalToControl}/${m}`);
  if (n === 2) {
    ok('§B N=2', 'a free passive with bots carrying nothing moves slot 0\'s win rate (economy faucets assume 60%)',
      out.slot0Wins.tenderiser > out.slot0Wins.control,
      `${(100 * out.slot0Wins.control / m).toFixed(1)}% -> ${(100 * out.slot0Wins.tenderiser / m).toFixed(1)}%`);
  }
}

mkdirSync(dirname(OUT), { recursive: true });
report.rows = rows; report.faults = faults;
writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(`\nbh_meta_items: ${rows.length - faults}/${rows.length} rows as expected · report ${OUT}`);
process.exitCode = faults ? 1 : 0;
