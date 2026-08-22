/**
 * fg_lib — offline loader for the SHIPPED fog-boundary geometry.
 *
 * Why it bundles instead of transcribing: `fogRing.ts`'s ring tables, `CANOPY_Y`,
 * `GROUND_Y` and `curtainHeight()` are all MODULE-PRIVATE. Any table built by copying
 * those numbers into a tool is measuring the tool's transcription, not the build. So
 * this esbuilds the real modules, stubs the two DOM calls `makeCurtainTexture()` makes,
 * runs `createFogRing(...).update(...)` for real, and reads the radii back off the
 * BufferGeometry the renderer would have drawn.
 *
 * NOTHING here is a re-derivation of a documented constant. Every number in the report
 * comes off an object the shipped code built.
 */
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Overridable so the same tool can be run against a DETACHED WORKTREE of a known SHA.
// Rule 2: "frozen" is not "clean" — the default working tree carries peers' edits.
export const REPO = process.env.FG_REPO || '/Users/uribishansky/claude-code/food-arena';

const ENTRY = `
export { CameraRig, FAIR_PLAY, SUPPORTED_ASPECT } from './src/render/camera';
export { createFogRing } from './src/arena/fogRing';
export { wu, toWorldUnits, WORLD_SCALE, CHARACTER_HEIGHT, CHARACTER_RADIUS } from './src/units';
export { ARENA_W, ARENA_H, CENTER, MAX_SAFE_RADIUS, ARENA_HALF_DIAGONAL, APRON_OUT } from './src/arena/shared';
export {
  MIN_SAFE_RADIUS, minSafeRadiusFor, MATCH_DURATION_MS, SUDDEN_DEATH_MS,
  SUDDEN_DEATH_REMAINING_MS, SUDDEN_DEATH_RADIUS, suddenDeathActive,
  FOG_DAMAGE, FOG_TICK_MS, PLAYER_SIZE, HIT_RADIUS_VS_PLAYER,
} from './src/game/rules';
import * as THREE from 'three';
export { THREE };
`;

/** The two DOM calls `makeCurtainTexture()` makes. Nothing else in this path touches the DOM. */
function stubDom() {
  if (globalThis.document) return;
  globalThis.document = {
    createElement(tag) {
      if (tag !== 'canvas') throw new Error('fg_lib stub: unexpected createElement ' + tag);
      // The ImageData is RETAINED, not discarded: `makeCurtainTexture()`'s alpha ramp
      // and streak noise are the curtain's real opacity profile, and a tool that
      // re-derives them from the source prose is measuring its own transcription.
      const el = { width: 0, height: 0, nodeType: 1, style: {}, __image: null };
      el.getContext = () => ({
        createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: (img) => { el.__image = img; },
      });
      return el;
    },
  };
}

let cached = null;
export async function loadShipped() {
  if (cached) return cached;
  const dir = join(tmpdir(), 'fg_reg_bundle');
  mkdirSync(dir, { recursive: true });
  const out = join(dir, 'shipped.mjs');
  await build({
    stdin: { contents: ENTRY, resolveDir: REPO, sourcefile: 'fg_entry.ts', loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: out,
    logLevel: 'silent',
  });
  stubDom();
  cached = await import('file://' + out);
  return cached;
}

export const createRequireFor = createRequire(import.meta.url);
export { writeFileSync };
