/**
 * Small menu flourishes shared by more than one screen.
 *
 * Kept out of `theme.ts` because these are BEHAVIOUR (they create and reap nodes),
 * where that file is purely declarative styling.
 */

import { PALETTE } from '../../game/rules';

/** Confetti colours, taken from the game's own palette rather than picked by eye —
 *  the celebration should be made of the same materials as the cast. */
const CONFETTI_COLORS = [
  PALETTE.tomato, PALETTE.mustard, PALETTE.lettuce,
  PALETTE.cheese, PALETTE.glaze, PALETTE.waterCap,
];

/**
 * Burst confetti from `originXPct`% across the given layer.
 *
 * Nodes are removed on a timer rather than on `animationend`: the animation is
 * cancelled outright under `prefers-reduced-motion`, and an event that never fires
 * would leak a node per burst.
 */
export function burstConfetti(layer: HTMLElement, originXPct = 50, count = 26): void {
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'fa-confetti';
    s.style.left = `${originXPct + (Math.random() * 12 - 6)}%`;
    s.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    s.style.animationDelay = `${(Math.random() * 0.22).toFixed(2)}s`;
    s.style.setProperty('--x', `${Math.round(Math.random() * 240 - 120)}px`);
    layer.appendChild(s);
    setTimeout(() => s.remove(), 1800);
  }
}

/** `<div class="…">…</div>` in one call. Every screen builds its DOM this way. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  html?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}
