#!/usr/bin/env node
/**
 * b3b_audio — QUIET-1's red/green: a Blue Cheese aura tick is QUIET in audio, on the REAL
 * `MatchAudio` (`docs/REVAMP.md` §5, package B3b, 2026-10-15). Owner of the `b3b_` prefix.
 *
 * B3 built the aura (`sim.ts:applyWorldTick`): once a second every victim inside the wearer's
 * radius takes a `hit-landed` whose source is `combat.ts:itemDamageSource` — `kind: 'weapon'`,
 * `itemId: 'blue_cheese'`. `director.ts:playHit` voiced it as a full weapon hit: a placed impact
 * and, on the local seat, the 0.9-gain `hurt` layer — per victim, every second, for as long as
 * anyone stood near the wearer. `ITEMS.blue_cheese.look`: *"the one item that must NOT be loud"*.
 * B2 (`c77793a`) quietened the FEEL half in `match.ts`; this is the AUDIO half, mirroring its
 * test shape: a loud CONTROL that must stay loud, then the tick.
 *
 * Bundled with esbuild from `--root` (default: this tree), like `b1_audio.mjs`, so the same file
 * runs RED against a clean base worktree and GREEN against the fix. The engine is a RECORDER
 * (every `play` call with its options) — "was a voice scheduled, at what priority".
 *
 *   node tools/tmp/b3b_audio.mjs --root /private/tmp/fa-b3b-base    # expect FAIL rows
 *   node tools/tmp/b3b_audio.mjs                                     # expect all PASS
 */
import { build } from 'esbuild';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const HERE = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const TREE = resolve(String(flag('root', HERE)));

const dir = mkdtempSync(join(tmpdir(), 'b3b-audio-'));
const entry = join(dir, 'entry.ts');
writeFileSync(entry, [
  `export { createMatch, stepMatch } from ${JSON.stringify(`${TREE}/src/game/sim.ts`)};`,
  `export { MatchAudio } from ${JSON.stringify(`${TREE}/src/audio/director.ts`)};`,
  `export { Priority } from ${JSON.stringify(`${TREE}/src/audio/engine.ts`)};`,
  `export * as RULES from ${JSON.stringify(`${TREE}/src/game/rules.ts`)};`,
  `export * as PROX from ${JSON.stringify(`${TREE}/src/proximity.ts`)};`,
].join('\n'));
const out = join(dir, 'bundle.mjs');
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { createMatch, stepMatch, MatchAudio, Priority, RULES, PROX } = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

const ARENA = JSON.parse(readFileSync(`${HERE}/tools/arena.gameplay.json`, 'utf8'));
let pass = 0; let fail = 0;
const check = (name, ok, detail) => {
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail !== undefined ? `  — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
};
console.log(`b3b_audio — tree ${TREE}`);

const R = RULES.ITEM_TUNING.blue_cheese.radius;
const mkEngine = () => { const rec = []; return { rec, play(_s, o = {}) { rec.push({ ...o }); return true; } }; };
// Slot 0 = the local seat and ear at (600, 600). Slots 1-3 inside the cloud's radius of slot 0
// AND inside SFX_FULL_WU of the ear; slots 4-5 far. Slot 1 is donut so its Ring Spin is a real key.
const CH = ['hamburger', 'donut', 'taco', 'pizza', 'egg', 'soup'];
const near = [[0, 0], [0.5, 0], [-0.5, 0.2], [0, -0.55]].map(([dx, dy]) => [600 + dx * R, 600 + dy * R]);
const POS = [...near, [2100, 1500], [2300, 1700]];
const mkState = (items0, items1) => {
  const st = createMatch(ARENA, POS.map(([x, y], i) => ({
    characterId: CH[i], controller: 'human', spawn: { x, y }, level: RULES.LEVEL_MIN,
    items: i === 0 ? items0 : i === 1 ? items1 : undefined,
  })));
  st.phase = 'playing';
  st.elapsed = 20_000;
  return st;
};
const fresh = (items0, items1) => {
  const eng = mkEngine();
  const md = new MatchAudio(eng);
  const st = mkState(items0, items1);
  md.handleEvents([], st);
  eng.rec.length = 0;
  return { eng, md, st };
};
const roleOf = (i) => (i === 0 ? 'player' : 'enemy');
const hit = (st, target, source, amount) => ({
  type: 'hit-landed', targetRole: roleOf(target), targetId: target, amount, effect: null,
  x: st.fighters[target].x, y: st.fighters[target].y, source,
});
const cheese = (att) => ({ kind: 'weapon', weaponKey: 'blue_cheese', weaponName: 'Blue Cheese', attackerId: att, itemId: 'blue_cheese' });
const keyed = (rec, prefix) => rec.filter((o) => typeof o.key === 'string' && o.key.startsWith(prefix));
const loudOf = (rec) => rec.filter((o) => (o.priority ?? Priority.Normal) > Priority.Ambient);

const st0 = mkState();
const d = (i) => Math.hypot(st0.fighters[i].x - 600, st0.fighters[i].y - 600);
check('NON-VACUITY: six seats; slots 1-3 inside the cloud radius AND inside SFX_FULL_WU of the ear',
  st0.fighters.length === 6 && [1, 2, 3].every((i) => d(i) < R && d(i) < PROX.SFX_FULL_WU),
  `radius ${R}, full ${PROX.SFX_FULL_WU}: ${[1, 2, 3].map((i) => d(i).toFixed(1)).join(' ')}`);

// ── CONTROLS: a real weapon hit, and an item hit that is NOT the cloud, stay loud ──
{
  const { eng, md, st } = fresh();
  md.handleEvents([hit(st, 0, { kind: 'weapon', weaponKey: 'Ring', weaponName: 'Ring Spin', attackerId: 1 }, 9)], st);
  check('CONTROL: a Ring Spin hit on the LOCAL seat schedules an impact AND the hurt layer',
    keyed(eng.rec, 'impact:').length >= 1 && eng.rec.some((o) => o.key === 'hurt'), eng.rec.map((o) => o.key));
}
{
  const { eng, md, st } = fresh();
  md.handleEvents([hit(st, 1, { kind: 'weapon', weaponKey: 'shiitake', weaponName: 'Shiitake Shield', attackerId: 0, itemId: 'shiitake' }, 6)], st);
  check('CONTROL: a Shiitake REFLECTION (an item hit that is not the cloud) is still voiced as an impact',
    keyed(eng.rec, 'impact:').length === 1, eng.rec.map((o) => o.key));
}

// ── THE TICK ─────────────────────────────────────────────────────────────────────
{
  const { eng, md, st } = fresh(undefined, ['blue_cheese']);
  md.handleEvents([hit(st, 0, cheese(1), 1)], st);
  check('🔴 a Blue Cheese tick on the LOCAL seat schedules NO impact voice and NO hurt layer',
    keyed(eng.rec, 'impact:').length === 0 && !eng.rec.some((o) => o.key === 'hurt'), eng.rec.map((o) => `${o.key}@${o.priority}`));
  check('🔴 …and whatever it does schedule is AMBIENT priority, at most one voice',
    eng.rec.length <= 1 && loudOf(eng.rec).length === 0, eng.rec.map((o) => `${o.key}@${o.priority}`));
}
{
  const { eng, md, st } = fresh(['blue_cheese']);
  md.handleEvents([hit(st, 1, cheese(0), 1)], st);
  check('🔴 a tick on a NEAR opponent (the local seat wears it) schedules NO impact voice',
    keyed(eng.rec, 'impact:').length === 0 && loudOf(eng.rec).length === 0, eng.rec.map((o) => `${o.key}@${o.priority}`));
}
{
  // Three victims ticked in the same instant (the cloud covers them all) — the fog's rule:
  // one pressure, not three events.
  const { eng, md, st } = fresh(['blue_cheese']);
  md.handleEvents([1, 2, 3].map((v) => hit(st, v, cheese(0), 1)), st);
  check('🔴 three victims ticked in one instant schedule at most ONE quiet voice',
    eng.rec.length <= 1 && keyed(eng.rec, 'impact:').length === 0, eng.rec.map((o) => `${o.key}@${o.priority}`));
}

// ── THE REAL STREAM: slot 0 wears it, five seconds of stepMatch, nobody acts ───────
{
  const eng = mkEngine();
  const md = new MatchAudio(eng);
  const st = mkState(['blue_cheese']);
  const idle = st.fighters.map(() => ({ move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false }));
  md.handleEvents([], st);
  eng.rec.length = 0;
  let ticks = 0;
  for (let t = 0; t < 300; t++) {
    const evs = stepMatch(st, 16.667, idle);
    ticks += evs.filter((e) => e.type === 'hit-landed' && e.source?.itemId === 'blue_cheese').length;
    md.handleEvents(evs, st);
  }
  check('NON-VACUITY: the REAL sim ticked the cloud on the three victims (every second, for five seconds)',
    ticks >= 9, `${ticks} real ticks`);
  check('🔴 …and the director scheduled NO impact and NO voice above Ambient for any of them',
    keyed(eng.rec, 'impact:').length === 0 && loudOf(eng.rec).length === 0,
    `${keyed(eng.rec, 'impact:').length} impacts, ${loudOf(eng.rec).length} loud, ${eng.rec.length} total voices`);
  // The over-fix guard: QUIET is not SILENT. A director that dropped the tick entirely would
  // pass every row above; this one needs the cloud's own ambient voice to exist.
  const aura = keyed(eng.rec, 'aura');
  check('🔴 …yet the cloud is still AUDIBLE — its own Ambient voice (key "aura"), about once a second, not silenced',
    aura.length >= 3 && aura.length <= 6 && aura.every((o) => o.priority === Priority.Ambient),
    `${aura.length} aura voices for ${ticks} ticks over 5 s (${eng.rec.length} voices in all: ${[...new Set(eng.rec.map((o) => o.key))].join(', ')})`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
