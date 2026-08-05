#!/usr/bin/env node
/**
 * P3 PROBE — WHICH characters does `bestWeapon`'s authored-`damage` ranking key
 * actually mis-rank, and by how much? READ-ONLY.
 *
 * The record (`rules.ts` "A SECOND STALE EXCLUSION", `sim.test.mjs` §25(e)) names
 * Taco and Burrito. This asks the question behaviourally instead of structurally:
 * on every PLAYING tick of a real match, does the authored-`damage` key pick a
 * different weapon index than `ai.ts:pressValue` does?
 *
 * ⚠️ KNOWN-BAD-INPUT CONTROL: `control-vs-control` must be 0 divergent ticks for all
 * eleven characters. It is printed first. If a self-comparison ever reports a
 * divergence the comparator is broken and no row below means anything.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createScriptedPlayer, rng } from './scripted_player.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const { createMatch, stepMatch } = await import(`${ROOT}/src/game/sim.ts`);
const RULES = await import(`${ROOT}/src/game/rules.ts`);
const { pressValue } = await import(`${ROOT}/src/game/ai.ts`);
const { CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, REACH } = RULES;

const ARENA_PATH = `${ROOT}/tools/arena.gameplay.json`;
if (!existsSync(ARENA_PATH)) { console.error('no arena dump'); process.exit(1); }
const A = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
const HALF = Math.hypot(A.width / 2, A.height / 2);
const arena = { ...A, maxSafeRadius: Math.round(HALF / (1 - 6000 / MATCH_DURATION_MS)), build: () => null, update: () => {} };
const driver = createScriptedPlayer({ CHARACTERS, REACH, arena });
const DT = 16.667;
const SEEDS = Number(process.argv.includes('--seeds') ? process.argv[process.argv.indexOf('--seeds') + 1] : 8);

function chooser(rank) {
  return (state, d) => {
    const p = state.player;
    const ws = CHARACTERS[p.characterId].weapons;
    let best = null, bs = -Infinity;
    ws.forEach((w, i) => {
      if (w.type === 'self') return;
      if (state.elapsed - p.lastUsed[i] < w.cooldown) return;
      if (d > (w.range ?? Infinity)) return;
      const s = rank(w, d);
      if (s > bs) { bs = s; best = i; }
    });
    return best;
  };
}
const KEY_DAMAGE = chooser((w) => w.damage ?? 0);
const KEY_PRESS = chooser((w, d) => pressValue(w, d));

function scan(a, b) {
  const out = {};
  for (const p of CHARACTER_IDS) {
    let ticks = 0, diff = 0;
    const swaps = {};
    for (const e of CHARACTER_IDS) {
      if (p === e) continue;
      for (let s = 0; s < SEEDS; s++) {
        const rnd = rng(s * 7919 + p.length * 131 + e.length * 17 + 'smart2'.length);
        const state = createMatch(arena, p, e);
        const loop = driver.createDecisionLoop({
          decide: driver.POLICY_FNS.smart2(rnd), reactBase: 150, reactJit: s === 0 ? 0 : 60, rnd,
        });
        while (state.phase !== 'ended' && state.elapsed < MATCH_DURATION_MS * 1.6 + 20000) {
          if (state.phase === 'playing') {
            const d = Math.hypot(state.player.x - state.enemy.x, state.player.y - state.enemy.y);
            const x = a(state, d), y = b(state, d);
            ticks++;
            if (x !== y) {
              diff++;
              const ws = CHARACTERS[p].weapons;
              const k = `${x === null ? '—' : ws[x].key} -> ${y === null ? '—' : ws[y].key}`;
              swaps[k] = (swaps[k] ?? 0) + 1;
            }
          }
          stepMatch(state, DT, loop.next(state, DT));
        }
      }
    }
    out[p] = { ticks, diff, swaps };
  }
  return out;
}

console.log(`\n══ p3_rankdiv ══  ${SEEDS} seeds x 110 matchups, policy smart2, PLAYER side only`);
const ctl = scan(KEY_DAMAGE, KEY_DAMAGE);
const bad = Object.entries(ctl).filter(([, v]) => v.diff !== 0);
console.log(`\n   CONTROL (authored damage vs ITSELF): ${bad.length === 0 ? 'PASS — 0 divergent ticks on all 11' : `FAIL — ${bad.map(([k, v]) => `${k}:${v.diff}`).join(' ')}`}`);
if (bad.length) process.exit(1);

const r = scan(KEY_DAMAGE, KEY_PRESS);
console.log(`\n   ${'character'.padEnd(13)}${'ticks'.padStart(8)}${'divergent'.padStart(11)}${'share'.padStart(8)}   what the authored key picked -> what pressValue picks`);
for (const id of CHARACTER_IDS) {
  const v = r[id];
  const sw = Object.entries(v.swaps).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} x${n}`).join(' · ');
  console.log(`   ${id.padEnd(13)}${String(v.ticks).padStart(8)}${String(v.diff).padStart(11)}${`${((v.diff / v.ticks) * 100).toFixed(1)}%`.padStart(8)}   ${sw || '—'}`);
}
console.log('');
