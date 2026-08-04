/*
 * Dumps the GAMEPLAY-RELEVANT half of the real arena definition. See arena-dump.html.
 *
 * Kept as an EXTERNAL module rather than an inline <script type="module">: when this
 * page is served through `tools/snapshot.mjs --swap tools` the html file is a symlink,
 * and Vite's html-proxy resolves an inline script against the symlink TARGET while the
 * browser requests it against the snapshot path — a 500 with
 * "No matching HTML proxy module found". An external module has no proxy id and loads
 * fine either way.
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
  };
  document.getElementById('out').textContent = JSON.stringify(window.__arenaDump, null, 2);
} catch (e) {
  document.getElementById('out').textContent = 'FAILED: ' + String((e && e.stack) || e);
  window.__arenaError = String((e && e.stack) || e);
}
window.__arenaReady = true;
