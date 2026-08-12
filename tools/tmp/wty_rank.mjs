#!/usr/bin/env node
/**
 * wty_rank — rank every weapon in the roster on the axes that description adjectives
 * actually claim, so "big damage" / "huge damage" / "small damage" / "slow to charge up"
 * / "a little health" can be checked against the DISTRIBUTION rather than against a
 * reader's intuition.
 *
 * WHY: an adjective is a comparative claim about the roster. Checking it against the
 * weapon's own number alone cannot answer it — 16 damage is "big" only if 16 is big HERE.
 * This is the only way a row like `egg.Tackle "for big damage"` gets a verdict that is
 * not taste.
 *
 * 🚨 `damage` IS AUTHORED PER-PELLET. Both AI drivers once ranked on the raw field and it
 * was worth 50.6 pp on Hamburger. Every row here carries BOTH.
 *
 *   node tools/tmp/wty_rank.mjs
 *
 * Read-only.
 */
import { CHARACTERS } from '../../src/game/rules.ts';

const IS_MAIN = import.meta.url === `file://${process.argv[1]}`;

export function rows() {
  const out = [];
  for (const c of Object.values(CHARACTERS)) {
    for (const w of c.weapons) {
      const pellets = w.pellets ?? 1;
      const burst = w.comboParts
        ? w.comboParts.reduce((a, p) => a + p.damage, 0)
        : w.damage * pellets * (w.peckHits ?? 1);
      out.push({
        id: `${c.id}.${w.key}`,
        type: w.type,
        perPellet: w.damage,
        pellets,
        peckHits: w.peckHits ?? 1,
        burst,
        cooldown: w.cooldown,
        // Sustained output ignoring travel/aim — the only cooldown-aware damage number
        // that is comparable across a 750 ms melee and a 7000 ms ultimate.
        dps: +(burst / (w.cooldown / 1000)).toFixed(2),
        range: w.range ?? null,
        effect: w.effect,
      });
    }
  }
  return out;
}

/** 1 = smallest. Returns `rank/total` so a row reads without a second lookup. */
function ranked(all, key) {
  const sorted = [...all].sort((a, b) => a[key] - b[key]);
  const m = new Map();
  sorted.forEach((r, i) => m.set(r.id, i + 1));
  return { m, n: all.length, sorted };
}

if (IS_MAIN) {
  const all = rows();
  const offensive = all.filter((r) => r.type !== 'self');
  const byBurst = ranked(offensive, 'burst');
  const byCd = ranked(offensive, 'cooldown');
  const byDps = ranked(offensive, 'dps');
  const MINE = new Set(['egg', 'lollipop', 'pizza', 'sushi']);

  console.log(`offensive weapons: ${offensive.length}\n`);
  console.log('BURST (damage per press, pellets x peckHits folded in) ascending:');
  console.log('  ' + byBurst.sorted.map((r) => `${r.id}=${r.burst}`).join('  '));
  console.log('\nCOOLDOWN ascending:');
  console.log('  ' + byCd.sorted.map((r) => `${r.id}=${r.cooldown}`).join('  '));
  console.log('\nDPS (burst / cooldown_s) ascending:');
  console.log('  ' + byDps.sorted.map((r) => `${r.id}=${r.dps}`).join('  '));

  console.log('\n\nMY SHARD, with roster rank (1 = smallest of ' + offensive.length + '):');
  for (const r of offensive.filter((x) => MINE.has(x.id.split('.')[0]))) {
    console.log(
      `  ${r.id.padEnd(20)} burst ${String(r.burst).padStart(3)} (rank ${String(byBurst.m.get(r.id)).padStart(2)})` +
      `  perPellet ${String(r.perPellet).padStart(2)} x${r.pellets}${r.peckHits > 1 ? ` x${r.peckHits}peck` : ''}` +
      `  cd ${String(r.cooldown).padStart(4)} (rank ${String(byCd.m.get(r.id)).padStart(2)})` +
      `  dps ${String(r.dps).padStart(5)} (rank ${String(byDps.m.get(r.id)).padStart(2)})` +
      `  ${r.type} ${r.effect ?? '-'}`,
    );
  }
}
