#!/usr/bin/env node
/**
 * bh_match_apply_fixes — review-phase helper (2026-10-15). Applies the four candidate fixes
 * the match-lifecycle bug hunt measured (A post-whistle damage guard in sim.ts, B Escape on a
 * decided match, C the routed item-press hunk, D leaving the death pose) to a SCRATCH COPY of a
 * tree, asserting each anchor matches exactly once. It is a measuring aid, not a patch to land.
 *
 *   cp -R /private/tmp/fa-rv-head <scratch>/fixarm && rm -f <scratch>/fixarm/.git
 *   node tools/tmp/bh_match_apply_fixes.mjs <scratch>/fixarm A,B,C,D
 *
 * REFUSES any root that is a git checkout or worktree (has a `.git` entry), so it cannot be
 * pointed at the repo by accident.
 */
import { existsSync } from 'node:fs';
if (!process.argv[2] || existsSync(`${process.argv[2]}/.git`)) {
  console.error('bh_match_apply_fixes: refusing — pass a scratch COPY with no .git entry');
  process.exit(2);
}
import { readFileSync, writeFileSync } from 'node:fs';
const ROOT = process.argv[2];
const only = (process.argv[3] ?? 'A,B,C,D').split(',');
function patch(file, from, to, tag) {
  const p = `${ROOT}/${file}`;
  const src = readFileSync(p, 'utf8');
  const n = src.split(from).length - 1;
  if (n !== 1) { console.error(`ANCHOR MISS ${tag}: ${file} matched ${n} times`); process.exit(1); }
  writeFileSync(p, src.replace(from, to));
  console.log(`applied ${tag} -> ${file}`);
}
if (only.includes('A')) {
  // A — post-whistle damage: projectiles still fly and expire after the match is decided,
  // but a tick that BEGINS with the match already decided cannot land damage. The end tick
  // itself is untouched, so every instrument that stops at the end tick is bit-identical.
  patch('src/game/sim.ts',
    "  const events: GameEvent[] = [];\n  state.elapsed += dt;\n",
    "  const events: GameEvent[] = [];\n  const decidedBeforeThisTick = state.phase === 'ended';\n  state.elapsed += dt;\n", 'A1');
  patch('src/game/sim.ts',
    "  stepProjectiles(state, dt, events);\n",
    "  stepProjectiles(state, dt, events, decidedBeforeThisTick);\n", 'A2');
  patch('src/game/sim.ts',
    "function stepProjectiles(state: MatchState, dt: number, events: GameEvent[]): void {",
    "function stepProjectiles(state: MatchState, dt: number, events: GameEvent[], harmless = false): void {", 'A3');
  patch('src/game/sim.ts',
    "    if (w.peckHits && p.arrived) {\n      if (target.hp <= 0) {",
    "    if (w.peckHits && p.arrived) {\n      if (harmless || target.hp <= 0) {", 'A4');
  patch('src/game/sim.ts',
    "    const victim = projectileVictim(state, p, owner);",
    "    const victim = harmless ? null : projectileVictim(state, p, owner);", 'A5');
}
if (only.includes('B')) {
  // B — Escape on a decided match does nothing (the chip is already hidden for that reason).
  patch('src/ui/screens/matchScreen.ts',
    "    if (ev.key !== PAUSE_KEY) return;\n    ev.preventDefault();\n",
    "    if (ev.key !== PAUSE_KEY) return;\n    if (root.classList.contains('is-ended')) return;\n    ev.preventDefault();\n", 'B');
}
if (only.includes('C')) {
  // C — the routed two-line hunk from 174d046: the item press reaches the sim.
  patch('src/game/match.ts',
    "      onSelectWeapon: (index) => this.input.selectWeapon(index),\n    });",
    "      onSelectWeapon: (index) => this.input.selectWeapon(index),\n      onUseItem: (slot) => this.input.pressItem(slot),\n    });", 'C1');
  patch('src/game/match.ts',
    "    return { move, aim, selectedWeapon: this.input.selectedWeapon, attack };",
    "    return { move, aim, selectedWeapon: this.input.selectedWeapon, attack, useItem: playing ? this.input.takeItemPress() : null };", 'C2');
}
if (only.includes('D')) {
  // D — a fighter that is alive again leaves the death pose (the loop calls play('idle'|'run')
  // every frame for a living fighter, so resetting here is the whole fix).
  patch('src/characters/types.ts',
    "      default:\n        this.state = state;\n",
    "      default:\n        this.deathT = -1;\n        this.state = state;\n", 'D');
}
