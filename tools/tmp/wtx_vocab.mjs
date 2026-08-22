#!/usr/bin/env node
/**
 * wtx_vocab.mjs — the CLOSED VOCABULARY of weapon mechanics, derived from the tree.
 *
 * Answers, once for the whole roster, "does this mechanic exist at all?" so that a
 * per-weapon description audit does not have to re-derive it 40 times.
 *
 * Three products:
 *   1. VOCAB   — every field key actually PRESENT on a shipped weapon record, plus a
 *                census of which sim/vfx/audio files READ it. A field nobody reads is
 *                authored-but-dead; a mechanic with no field at all does not exist.
 *   2. DERIVED — per weapon: burst damage (damage x pellets / sum of comboParts), the
 *                sustained HP/s, the TOTAL fan (spreadDeg is a per-pellet STEP, not the
 *                total — the interface docstring says "fanned across" and is wrong), and
 *                the nominal reach.
 *   3. KNOWN-BAD — plants a fabricated field on a synthetic weapon and requires the
 *                reader census to report it UNREAD. Without this arm the census could
 *                be reporting "read" for everything and nobody would know.
 *
 * ⚠️ The census greps SOURCE TEXT for `w.<field>` / `weapon.<field>` / `.<field>`. It
 * proves a field is MENTIONED, never that the mention is on a live path. Treat a "read"
 * verdict as necessary-not-sufficient and read the call site (this report did).
 *
 * Offline. No browser, no GPU. Owner prefix: wtx_*.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHARACTERS } from '../../src/game/rules.ts';

const REPO = fileURLToPath(new URL('../..', import.meta.url));
const SHARD = process.argv.includes('--all')
  ? Object.keys(CHARACTERS)
  : ['hamburger', 'donut', 'taco', 'burrito'];

// ── the files that could implement a mechanic ────────────────────────────────
const SIM = ['sim.ts', 'combat.ts', 'ai.ts', 'movement.ts', 'state.ts', 'match.ts', 'vfx.ts']
  .map((f) => ['sim/' + f, join(REPO, 'src/game', f)]);
const VFX = readdirSync(join(REPO, 'src/vfx/weapons'))
  .filter((f) => f.endsWith('.ts'))
  .map((f) => ['vfx/' + f, join(REPO, 'src/vfx/weapons', f)]);
const AUD = readdirSync(join(REPO, 'src/audio/weapons'))
  .filter((f) => f.endsWith('.ts'))
  .map((f) => ['aud/' + f, join(REPO, 'src/audio/weapons', f)]);
const CORPUS = [...SIM, ...VFX, ...AUD].map(([tag, p]) => [tag, readFileSync(p, 'utf8')]);

function readersOf(field) {
  const re = new RegExp(`\\.${field}\\b`);
  return CORPUS.filter(([, src]) => re.test(src)).map(([tag]) => tag);
}

// ── 1. VOCAB ─────────────────────────────────────────────────────────────────
function vocab(extraWeapons = []) {
  const keys = new Map();
  const all = [...Object.values(CHARACTERS).flatMap((c) => c.weapons), ...extraWeapons];
  for (const w of all) {
    for (const k of Object.keys(w)) {
      if (!keys.has(k)) keys.set(k, new Set());
      keys.get(k).add(JSON.stringify(w[k]));
    }
  }
  return keys;
}

// ── 3. KNOWN-BAD: a fabricated mechanic must come back UNREAD ────────────────
const FAKE = { key: 'ZZ', name: 'fake', type: 'melee', damage: 1, cooldown: 1, color: '#000', effect: null, emoji: '?', lureRadius: 999, castTimeMs: 1500 };
const kb = ['lureRadius', 'castTimeMs'].map((f) => [f, readersOf(f)]);
const kbOk = kb.every(([, r]) => r.length === 0);
console.log('── KNOWN-BAD ARM ──');
for (const [f, r] of kb) console.log(`  fabricated .${f.padEnd(12)} readers=${r.length} ${r.length === 0 ? 'OK (census can say NO)' : 'INSTRUMENT INVALID: ' + r}`);
// and the positive control: a field we KNOW is live must come back READ.
const pos = readersOf('pellets');
console.log(`  live       .pellets      readers=${pos.length} ${pos.length > 0 ? 'OK (census can say YES)' : 'INSTRUMENT INVALID'}`);
if (!kbOk || pos.length === 0) { console.error('\nINSTRUMENT INVALID — not reporting.'); process.exit(2); }

// ── report ───────────────────────────────────────────────────────────────────
console.log('\n── VOCAB: every field PRESENT on a shipped weapon record ──');
const v = vocab([FAKE]);
for (const [k, vals] of [...v].sort()) {
  if (k === 'lureRadius' || k === 'castTimeMs') continue; // synthetic
  const r = readersOf(k);
  const sim = r.filter((x) => x.startsWith('sim/'));
  const vfx = r.filter((x) => x.startsWith('vfx/'));
  const aud = r.filter((x) => x.startsWith('aud/'));
  const sample = [...vals].slice(0, 4).join(' ');
  console.log(`  ${k.padEnd(14)} sim=[${sim.map((s) => s.slice(4)).join(',')}] vfx=${vfx.length} aud=${aud.length}`);
  if (process.argv.includes('-v')) console.log(`      values: ${sample}`);
}

console.log('\n── DERIVED: per-weapon arithmetic for the shard ──');
for (const id of SHARD) {
  const c = CHARACTERS[id];
  console.log(`\n${id}  (stats dmg=${c.stats.damage} hp=${c.stats.health} spd=${c.stats.speed}, hasTrail=${c.hasTrail})`);
  for (const w of c.weapons) {
    const n = w.pellets ?? 1;
    const burst = w.comboParts
      ? w.comboParts.reduce((s, p) => s + p.damage, 0)
      : w.damage * n;
    const fan = w.pellets && w.spreadDeg ? (w.pellets - 1) * w.spreadDeg : 0;
    const dps = (burst / w.cooldown) * 1000;
    const mech = ['splatter', 'homing', 'trailBoosted', 'giantSlam', 'comboParts', 'peckHits', 'healAmount']
      .filter((k) => w[k]).join(',') || '-';
    console.log(
      `  ${w.key.padEnd(8)} ${w.type.padEnd(6)} reach=${String(w.range ?? '-').padEnd(4)} ` +
      `dmg/pellet=${String(w.damage).padEnd(3)} x${n} = BURST ${String(burst).padEnd(3)} ` +
      `cd=${String(w.cooldown).padEnd(5)} DPS=${dps.toFixed(2).padStart(6)} ` +
      `cone=${String(w.cone ?? '-').padEnd(4)} fanTOTAL=${String(fan).padEnd(4)} ` +
      `eff=${String(w.effect ?? 'none').padEnd(5)} [${mech}]`,
    );
  }
  console.log('  abilities:');
  for (const a of c.abilities) {
    const hit = c.weapons.find((w) => w.name === a.name);
    console.log(`    ${a.name.padEnd(16)} weapon=${hit ? hit.key : '*** NO WEAPON RECORD ***'}`);
  }
}

// ── roster-wide burst ranking, for "heavy"/"massive" claims ──────────────────
console.log('\n── BURST DAMAGE RANK across all 11 characters (what "heavy"/"massive" must beat) ──');
const rank = Object.entries(CHARACTERS).flatMap(([id, c]) =>
  c.weapons.map((w) => {
    const n = w.pellets ?? 1;
    const burst = w.comboParts ? w.comboParts.reduce((s, p) => s + p.damage, 0) : w.damage * n;
    return { tag: `${id}.${w.key}`, burst, dps: (burst / w.cooldown) * 1000, type: w.type };
  }),
).filter((r) => r.burst > 0).sort((a, b) => b.burst - a.burst);
rank.forEach((r, i) => console.log(`  ${String(i + 1).padStart(2)}. ${r.tag.padEnd(22)} burst=${String(r.burst).padEnd(3)} dps=${r.dps.toFixed(2)}`));
