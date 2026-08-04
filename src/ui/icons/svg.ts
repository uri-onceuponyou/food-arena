/**
 * Icon drawing primitives.
 *
 * Every icon in this directory is authored on ONE grid with ONE stroke language, and
 * this file is what enforces that. The rules, which are the menu/HUD design system's
 * rules (see `src/ui/screens/theme.ts` and `src/ui/hud.ts`) narrowed to icon scale:
 *
 *  * **24 x 24 viewBox.** Every path below is written in that space, so an icon can be
 *    dropped anywhere and sized purely by CSS.
 *  * **One ink outline, always.** `#1a1224`, the same ink the surfaces use, at 1.7
 *    units. At the smallest shipped size (12px in the floating health pill) that is
 *    0.85 CSS px; at the largest (48px on a trophy-road medal) it is 3.4. That range
 *    is deliberate: the outline is what keeps a 16px icon readable against the cream
 *    panel AND against the dark HUD plate, which is exactly the job emoji could not do
 *    because they carry no outline at all.
 *  * **Flat saturated fills plus one highlight.** No gradients. A gradient at 16px is
 *    a smudge, and the art direction is flat-and-chunky anyway.
 *  * **Nothing thinner than ~1.5 units.** Anything finer disappears below 20px, which
 *    is most of where these ship.
 *
 * The palette constants are duplicated from `theme.ts` deliberately: this module is
 * imported by `hud.ts`, which must not depend on the menu stylesheet.
 */

/** Menu/HUD palette, icon-scale subset. Names match `theme.ts`'s custom properties. */
export const P = {
  ink: '#1a1224',
  cream: '#FFF3DE',
  white: '#FFFFFF',
  gold: '#F4A300',
  goldDark: '#B87400',
  mustard: '#FFC93C',
  mustardHi: '#FFDD6B',
  ketchup: '#D62839',
  tomato: '#E63946',
  tomatoHi: '#FF9E9E',
  lettuce: '#7CB518',
  lettuceHi: '#A6E24A',
  leafDark: '#4E8B2B',
  water: '#1E90D8',
  waterHi: '#5BC8F5',
  ice: '#8FE1FF',
  iceHi: '#BFF0FF',
  grape: '#7A4BC4',
  grapeHi: '#9B6BE0',
  grapeDark: '#5B2E8C',
  violet: '#B497D6',
  wood: '#8B4A22',
  woodHi: '#B4622A',
  meat: '#8B3A2E',
  meatHi: '#D98A72',
  patty: '#A05A2C',
  pattyDark: '#5A2E17',
  steel: '#DCD6E8',
  bone: '#F4E9DA',
  candy: '#FF6FA5',
  candyHi: '#FFB3D1',
  flame: '#FF7A2F',
} as const;

/**
 * An N-pointed star as a single closed path.
 *
 * Hand-writing star polygons is where icon sets pick up their wonkiness — one
 * mistyped coordinate and a point sags. Six icons here need one (star, sparkle,
 * impact burst, pufferfish spines, bottle-cap ridges), so they all come from here.
 */
export function starPath(points: number, rOuter: number, rInner: number, cx = 12, cy = 12): string {
  const parts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    // Start at 12 o'clock so odd-pointed stars sit upright.
    const a = (Math.PI * i) / points - Math.PI / 2;
    parts.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${parts.join('L')}Z`;
}

/** A regular polygon, used for the gem's facets and the cap's rim. */
export function star(points: number, rOuter: number, rInner: number, fill: string, opts: { cx?: number; cy?: number; sw?: number } = {}): string {
  const { cx = 12, cy = 12, sw } = opts;
  return `<path d="${starPath(points, rOuter, rInner, cx, cy)}" fill="${fill}"${sw ? ` stroke-width="${sw}"` : ''}/>`;
}
