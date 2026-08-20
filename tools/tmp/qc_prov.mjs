#!/usr/bin/env node
/**
 * qc_prov — PROVENANCE. Which tree is this URL actually serving?
 *
 * 🚨 `docs/AGENT-BRIEF.md` §3: a pinned A/B that quietly reads the same tree for both
 * arms returns BYTE-IDENTICAL numbers on every column, "which reads exactly like 'the
 * change did nothing' — the most dangerous possible failure". `qc_ctx.mjs` returned
 * exactly that across two deploy SHAs, so this asks the server itself.
 *
 * Markers are files that exist in ONE arm only, so the answer is a 200/404 rather than
 * a judgement. Both directions are checked: a marker that must be PRESENT and one that
 * must be ABSENT — a server that 200s everything (an SPA fallback) would otherwise
 * "confirm" whichever arm you asked about.
 *
 *   node tools/tmp/sx_snap.mjs --root <dir> -- node tools/tmp/qc_prov.mjs --url {URL}
 */
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const base = get('--url', process.env.PREVIEW_BASE || '').replace(/\/$/, '');
if (!base) { console.error('qc_prov: no --url'); process.exit(2); }

const MARKERS = [
  '/src/admin/gate.ts',        // 8ca8f88 only
  '/src/proximity.ts',         // 8ca8f88 only
  '/src/render/charStage.ts',  // exists in NEITHER — the negative control
  '/src/render/stage.ts',      // exists in BOTH — the positive control
  '/src/ui/screens/charStage.ts',
];
for (const m of MARKERS) {
  let line;
  try {
    const r = await fetch(base + m);
    const body = r.ok ? await r.text() : '';
    line = `${String(r.status).padEnd(4)} ${String(body.length).padStart(7)} B  ${m}`;
  } catch (e) { line = `ERR  ${m}  ${e.message}`; }
  console.log('  ' + line);
}
