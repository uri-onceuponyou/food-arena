import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * ── The deploy base is OPT-IN, and that is deliberate ────────────────────────
 *
 * GitHub Pages serves a project site from `/<repo>/`, so a hosted build needs
 * `base: '/food-arena/'`. Setting that unconditionally would break **everything else
 * in this repo**: `tools/snapshot.mjs`, `headserve.mjs`, `with_snapshot.mjs`,
 * `playtest.mjs` and every probe serve from `/`, and a base they do not expect turns
 * every asset into a 404 — which `docs/LESSONS.md` §1 says would present as "it isn't
 * there" and cost hours to trace.
 *
 * So it reads `DEPLOY_BASE` and defaults to `/`. Only the Pages workflow sets it, and
 * nothing measured locally changes by a byte.
 *
 * ── THERE IS A THIRD BASE, AND IT NEEDS NO CHANGE HERE ───────────────────────
 *
 * A mobile wrapper serves from neither `/` nor `/food-arena/` — it serves from a custom
 * scheme or a prefix nobody has picked yet. **`DEPLOY_BASE=./` already covers that**:
 * every emitted reference becomes relative to the document URL, so the bundle runs under
 * any prefix. Verified end-to-end by `tools/tmp/ab_basepath.mjs --selftest`, which builds
 * this file three times from one frozen tree and serves each behind a host that 404s
 * everything outside its base: `/food-arena/` at `/food-arena/` PASSES, `./` at
 * `/app/v1/wrap/` PASSES, and a `/` build at `/app/v1/wrap/` FAILS — the control that
 * proves the host is strict enough for the other two rows to mean anything.
 *
 * 🚨 `./` is NOT a fix for `file://`. That configuration fails for an unrelated reason —
 * a `<script type="module">` cannot be fetched from an opaque `file://` origin, so the
 * app never boots at all. See `docs/APP.md` §1: the wrapper must supply a SCHEME.
 *
 * ⚠️ And `./` holds only while the app's PATHNAME never gains a segment. It does not —
 * `ui/screens/shell.ts:routeUrl()` writes routes into the query string and copies
 * `location.pathname` through untouched. Move routing to path segments and this breaks.
 */
const base = process.env.DEPLOY_BASE ?? '/';

export default defineConfig({
  base,
  server: { port: 5173, strictPort: true },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        preview: resolve(__dirname, 'preview.html'),
      },
    },
  },
});
