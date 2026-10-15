#!/usr/bin/env node
/**
 * BH_PRESENT_AUDIO — do voices NOBODY CAN HEAR still cost the voices somebody can?
 *
 * REVIEW-PHASE PROBE (2026-10-15). Read-only on every tracked file.
 *
 * `src/proximity.ts:SFX_INAUDIBLE_GAIN` (0.02) says, in the present tense:
 *   > "Below this gain a voice is not scheduled at all. Not a taste threshold — a BUDGET one.
 *   >  `audio/engine.ts` runs a 20-voice cap and evicts by priority, so a voice at 0.004 that
 *   >  nobody can hear still costs a slot that a nearby hit wants."
 * and `8ca8f88` reported "culls 62.4%, 346 per match". **No file in `src/` reads the
 * constant.** `director.ts:place()` hands `proximityGain(...)` straight to `engine.play`, and
 * `engine.ts:play` admits any gain — so every far voice (gain exactly 0 beyond `SFX_FADE_WU`)
 * is scheduled, holds a voice slot for its whole duration, and advances the engine's shared
 * retrigger table for its `key`.
 *
 * This drives the REAL `MatchAudio` (bundled with esbuild from the tree under `--root`,
 * together with the REAL sim so there is one `rules.ts`) over real matches, with a RECORDING
 * engine in place of WebAudio, then replays `engine.ts`'s retrigger rule — transcribed:
 * `RETRIGGER_WINDOW` 0.11 s, `RETRIGGER_GAINS` [1, .62, .42, .30, .22], drop at 5 — on the
 * recorded calls twice: SHIPPED (every call enters the table) and CULLED (calls below
 * `SFX_INAUDIBLE_GAIN` never scheduled, the stated intent). An AUDIBLE voice that comes out
 * quieter or dropped in SHIPPED than in CULLED was ducked by something nobody could hear.
 *
 * It also reads the director's own GLOBAL regen-heal throttle (`HEAL_MIN_INTERVAL_MS`, one
 * `lastHealSoundAt` for every seat): an audible regen tick suppressed because the last VOICED
 * heal was inaudible.
 *
 * Counts only while slot 0 is alive (the listener is slot 0 by `resolveViewSubject` rung 1).
 *
 *   node tools/tmp/bh_present_audio.mjs --n 6 --matches 30 [--root /private/tmp/fa-rv-head]
 *   --cull 0     KNOWN-BAD / null arm: a cull threshold of 0 culls nothing, so SHIPPED and
 *                CULLED must agree on every voice — or the diff machinery invents differences.
 */
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const TREE = resolve(String(flag('root', '/private/tmp/fa-rv-head')));
const N = Number(flag('n', 6));
const MATCHES = Number(flag('matches', 30));
const CULL_OVERRIDE = flag('cull', null);
const DT = 1000 / 60;

// ── one bundle, one rules.ts ────────────────────────────────────────────────────
const dir = mkdtempSync(join(tmpdir(), 'bh-present-audio-'));
const entry = join(dir, 'entry.ts');
writeFileSync(entry, [
  `export { createMatch, stepMatch } from ${JSON.stringify(`${TREE}/src/game/sim.ts`)};`,
  `export { MatchAudio } from ${JSON.stringify(`${TREE}/src/audio/director.ts`)};`,
  `export * as RULES from ${JSON.stringify(`${TREE}/src/game/rules.ts`)};`,
  `export * as PROX from ${JSON.stringify(`${TREE}/src/proximity.ts`)};`,
].join('\n'));
const out = join(dir, 'bundle.mjs');
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const M = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });
const { createMatch, stepMatch, MatchAudio, RULES, PROX } = M;
const CULL = CULL_OVERRIDE !== null ? Number(CULL_OVERRIDE) : PROX.SFX_INAUDIBLE_GAIN;

// ── transcribed from src/audio/engine.ts ────────────────────────────────────────
const RETRIGGER_WINDOW = 0.11;
const RETRIGGER_GAINS = [1, 0.62, 0.42, 0.3, 0.22];
const PRIORITY_NAMES = ['ambient', 'normal', 'critical'];

const ARENA = JSON.parse(readFileSync(`${ROOT}/tools/arena.gameplay.json`, 'utf8'));
const ids = RULES.CHARACTER_IDS;

const tot = { plays: 0, inaudible: 0, inaudibleByKey: {}, inaudibleCritical: 0,
  audibleKeyed: 0, ducked: 0, dropped: 0, healAudibleSuppressedByInaudible: 0, healAudibleVoiced: 0, aliveS: 0 };

for (let i = 0; i < MATCHES; i++) {
  const roster = Array.from({ length: N }, (_, k) => ids[(i + k * 3) % ids.length]);
  const st = createMatch(ARENA, roster.map((c, s) => ({ characterId: c, controller: 'ai', spawn: ARENA.spawns[s], level: RULES.LEVEL_MIN })));
  const inputs = new Array(N).fill(null);
  const rec = [];
  let tNow = 0;
  const engine = { play: (_sound, opts = {}) => { rec.push({ t: tNow, key: opts.key ?? null, gain: opts.gain ?? 1, priority: opts.priority ?? 1 }); return true; } };
  const audio = new MatchAudio(engine, {});
  let lastVoicedHeal = null;   // {t, gain}
  while (st.phase !== 'ended' && st.elapsed < RULES.MATCH_DURATION_MS * 4) {
    const evs = stepMatch(st, DT, inputs);
    tNow = st.elapsed / 1000;
    const alive = st.fighters[0].alive && st.phase === 'playing';
    const before = rec.length;
    audio.handleEvents(evs, st);
    // the director's global regen throttle, observed from the outside:
    for (const ev of evs) {
      if (ev.type !== 'heal' || ev.amount > RULES.REGEN_AMOUNT) continue;
      const f = st.fighters[ev.fighterId];
      const me = st.fighters[0];
      const g = PROX.proximityGain(Math.hypot(f.x - me.x, f.y - me.y), PROX.SFX_FULL_WU, PROX.SFX_FADE_WU);
      const voiced = rec.slice(before).some((r) => r.key === 'heal' && Math.abs(r.gain - g) < 1e-9);
      if (voiced) { lastVoicedHeal = { t: tNow, gain: g }; if (alive && g >= CULL) tot.healAudibleVoiced++; }
      else if (alive && g >= CULL && lastVoicedHeal && lastVoicedHeal.gain < CULL) tot.healAudibleSuppressedByInaudible++;
    }
    if (alive) tot.aliveS += DT / 1000;
    for (let k = before; k < rec.length; k++) rec[k].alive = alive;
  }
  // ── replay the retrigger table twice ──
  const replay = (cull) => {
    const table = new Map();
    const res = new Array(rec.length).fill(null);
    rec.forEach((r, idx) => {
      if (r.gain < cull) return;                 // never scheduled
      if (!r.key) { res[idx] = { level: r.gain, dropped: false }; return; }
      const prev = table.get(r.key);
      const count = prev && r.t - prev.at < RETRIGGER_WINDOW ? prev.count + 1 : 0;
      table.set(r.key, { at: r.t, count });
      if (count >= RETRIGGER_GAINS.length) { res[idx] = { level: 0, dropped: true }; return; }
      res[idx] = { level: r.gain * RETRIGGER_GAINS[count], dropped: false };
    });
    return res;
  };
  const shipped = replay(-Infinity);
  const culled = replay(CULL);
  rec.forEach((r, idx) => {
    if (!r.alive) return;
    tot.plays++;
    if (r.gain < PROX.SFX_INAUDIBLE_GAIN) {
      tot.inaudible++;
      const k = r.key ? r.key.split(':')[0] : '(no key)';
      tot.inaudibleByKey[k] = (tot.inaudibleByKey[k] ?? 0) + 1;
      if (r.priority >= 2) tot.inaudibleCritical++;
      return;
    }
    if (!r.key) return;
    tot.audibleKeyed++;
    const a = shipped[idx], b = culled[idx];
    if (!a || !b) return;
    if (a.dropped && !b.dropped) tot.dropped++;
    else if (a.level < b.level - 1e-12) tot.ducked++;
  });
}
const m = MATCHES;
console.log(`\n══ BH_PRESENT_AUDIO  N=${N}  matches=${m}  cull=${CULL}  tree=${TREE} ══`);
console.log(`listener-alive play time ${(tot.aliveS / m).toFixed(1)} s/match`);
console.log(`voices scheduled while alive: ${tot.plays} (${(tot.plays / m).toFixed(1)}/match)`);
console.log(`  INAUDIBLE (gain < SFX_INAUDIBLE_GAIN ${PROX.SFX_INAUDIBLE_GAIN}) yet scheduled: ${tot.inaudible} (${(100 * tot.inaudible / Math.max(1, tot.plays)).toFixed(1)}%, ${(tot.inaudible / m).toFixed(1)}/match)`);
console.log(`    by key: ${Object.entries(tot.inaudibleByKey).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`    at Priority.Critical (always admitted; steals a voice when the 20-voice budget is full): ${tot.inaudibleCritical}`);
console.log(`  AUDIBLE keyed voices ${tot.audibleKeyed}: DUCKED by an inaudible same-key voice ${tot.ducked} · DROPPED ${tot.dropped}  (${(100 * (tot.ducked + tot.dropped) / Math.max(1, tot.audibleKeyed)).toFixed(2)}%)`);
console.log(`  audible REGEN heal ticks voiced ${tot.healAudibleVoiced} · suppressed because the last voiced heal was INAUDIBLE ${tot.healAudibleSuppressedByInaudible}`);
if (tot.plays === 0) { console.error('bh_present_audio: no voices recorded — vacuous'); process.exit(2); }
