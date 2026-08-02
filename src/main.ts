/**
 * Game entry point.
 *
 * Wires the pure match simulation (`game/sim.ts`), the kitchen arena, the character
 * roster and the DOM HUD into a playable match — see `game/match.ts` for the actual
 * glue (`GameSession`). This file just mounts it.
 */

import { startGame } from './game/match';

const container = document.getElementById('game')!;
const hudRoot = document.getElementById('hud')!;
const boot = document.getElementById('boot')!;

startGame({ container, hudRoot });

requestAnimationFrame(() => boot.classList.add('hidden'));
