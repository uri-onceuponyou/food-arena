/**
 * Keyboard + mouse input capture for the live match.
 *
 * Purely a DOM listener → raw state accumulator. Turning that raw state into a
 * `MatchInput` (see `state.ts`) happens in `match.ts`, since converting a mouse
 * position into a world-space aim vector requires unprojecting through the active
 * camera, which only the render layer knows about.
 */

const MOVE_KEYS = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
} as const;

export class InputController {
  private readonly keys = new Set<string>();
  private mouseDown = false;
  private ndcX = 0;
  private ndcY = 0;
  private hasMouse = false;
  private weaponIndex = 0;
  private weaponCount = 1;

  constructor(private readonly canvas: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  /** Call once the player's character is known, so digit keys only select real slots. */
  setWeaponCount(n: number): void {
    this.weaponCount = Math.max(1, n);
    if (this.weaponIndex >= this.weaponCount) this.weaponIndex = 0;
  }

  get selectedWeapon(): number {
    return this.weaponIndex;
  }

  get attackHeld(): boolean {
    return this.mouseDown;
  }

  /** Normalized device coords of the last known mouse position, or null before any move. */
  get mouseNdc(): { x: number; y: number } | null {
    return this.hasMouse ? { x: this.ndcX, y: this.ndcY } : null;
  }

  /** Raw move axes, each independently in [-1, 1] — NOT normalized, matching `MatchInput.move`. */
  moveAxes(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.keyDown(MOVE_KEYS.left)) x -= 1;
    if (this.keyDown(MOVE_KEYS.right)) x += 1;
    if (this.keyDown(MOVE_KEYS.up)) y -= 1;
    if (this.keyDown(MOVE_KEYS.down)) y += 1;
    return { x, y };
  }

  /** Drop all held state — call on match restart so a stale keydown doesn't carry over. */
  reset(): void {
    this.keys.clear();
    this.mouseDown = false;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
  }

  private keyDown(codes: readonly string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= 9) {
      const idx = n - 1;
      if (idx < this.weaponCount) this.weaponIndex = idx;
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    this.hasMouse = true;
  };

  private readonly onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseDown = true;
  };

  private readonly onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseDown = false;
  };

  private readonly onBlur = (): void => {
    this.keys.clear();
    this.mouseDown = false;
  };

  private readonly onContextMenu = (e: Event): void => {
    e.preventDefault();
  };
}
