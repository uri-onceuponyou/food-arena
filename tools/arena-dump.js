/*
 * Dumps the GAMEPLAY-RELEVANT half of the real arena definition. See arena-dump.html.
 *
 * Kept as an EXTERNAL module rather than an inline <script type="module">: when this
 * page is served through `tools/snapshot.mjs --swap tools` the html file is a symlink,
 * and Vite's html-proxy resolves an inline script against the symlink TARGET while the
 * browser requests it against the snapshot path — a 500 with
 * "No matching HTML proxy module found". An external module has no proxy id and loads
 * fine either way.
 *
 * ── ⚠️ HIGH BLAST RADIUS. READ BEFORE CHANGING THE SHAPE ─────────────────────
 *
 * This object is the only source of `tools/arena.gameplay.json` (written by
 * `tools/match-sim.mjs --refresh-arena`), and **39 tools read that file** — every
 * `--selftest`, every balance lab, every layout probe. Almost all of them do
 * `{ ...ARENA_DATA, build: () => null, update: () => {} }` and hand the result straight
 * to `stepMatch` as a real `ArenaDefinition`.
 *
 * So the rules are: **ADD keys, never rename or remove one**, and never change a key's
 * type. An added key flows through every spread untouched and is invisible to every tool
 * that does not name it; a renamed one silently becomes `undefined` in 39 places at once.
 */
import { createKitchenArena } from '/src/arena/kitchen.ts';

try {
  const a = createKitchenArena();
  window.__arenaDump = {
    id: a.id,
    displayName: a.displayName,
    width: a.width,
    height: a.height,
    center: a.center,
    maxSafeRadius: a.maxSafeRadius,
    playerSpawn: a.playerSpawn,
    enemySpawn: a.enemySpawn,
    cover: a.cover.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h, kind: c.kind })),
    hazards: a.hazards.map((h) => ({
      x: h.x, y: h.y, radius: h.radius, kind: h.kind,
      damage: h.damage, tickMs: h.tickMs, slowFactor: h.slowFactor,
    })),
    // WALK-THROUGH CONCEALMENT. Without this line every one of the 39 tools above
    // simulates an arena with no plates in it while the game has them — the sim would be
    // measured against a layout that does not exist, which is exactly the second-source-
    // of-truth failure this repo keeps paying for.
    //
    // ⚠️ CONDITIONAL, not `?? []`, and it matters twice. `undefined` is dropped by both
    // `JSON.stringify` and `page.evaluate`'s serialiser, so an arena with no regions
    // produces a BYTE-IDENTICAL `arena.gameplay.json` to the one committed today — the
    // wiring is provably inert until an arena declares a list, and any diff in that file
    // after this change is real data rather than the plumbing. And it keeps the dump
    // honest for `arena_probe --verify`, whose whole job is to notice a MISSING list:
    // an unconditional `[]` would let a dropped list masquerade as an empty one.
    concealment: a.concealment
      ? a.concealment.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h, kind: c.kind }))
      : undefined,
  };
  document.getElementById('out').textContent = JSON.stringify(window.__arenaDump, null, 2);
} catch (e) {
  document.getElementById('out').textContent = 'FAILED: ' + String((e && e.stack) || e);
  window.__arenaError = String((e && e.stack) || e);
}
window.__arenaReady = true;
