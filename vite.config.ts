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
