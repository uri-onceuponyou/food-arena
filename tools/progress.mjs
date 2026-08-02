#!/usr/bin/env node
/**
 * Generate the live build-progress page.
 *
 * Reads `tools/progress-data.json` plus real `git log`, emits `progress.html`.
 * Written as page content only (no doctype/html/head/body) so it can be published
 * straight to an Artifact, which supplies that skeleton itself.
 *
 *   node tools/progress.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';

const data = JSON.parse(await readFile(new URL('./progress-data.json', import.meta.url), 'utf8'));

function gitLog(n = 14) {
  try {
    const raw = execSync(`git log -${n} --pretty=format:%h%x1f%s%x1f%ar`, { encoding: 'utf8' });
    if (!raw.trim()) return [];
    return raw.split('\n').map((line) => {
      const [hash, subject, when] = line.split('');
      return { hash, subject, when };
    });
  } catch {
    return [];
  }
}

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const commits = gitLog();

const allPieces = data.groups.flatMap((g) => g.pieces);
const done = allPieces.filter((p) => p.state === 'done').length;
const total = allPieces.length;
const pct = Math.round((done / total) * 100);

const STATE_LABEL = {
  done: 'approved',
  active: 'building',
  queued: 'queued',
  rejected: 'sent back',
  blocked: 'blocked',
};

function pieceRow(p) {
  return `<li class="piece piece--${esc(p.state)}">
      <span class="piece__id">${esc(p.id)}</span>
      <span class="piece__body">
        <span class="piece__name">${esc(p.name)}</span>
        ${p.note ? `<span class="piece__note">${esc(p.note)}</span>` : ''}
      </span>
      <span class="chip chip--${esc(p.state)}">${esc(STATE_LABEL[p.state] ?? p.state)}</span>
    </li>`;
}

const html = `<title>Food Fight Arena — Build Progress</title>
<style>
  :root {
    color-scheme: light dark;

    --ink:        #1a1224;
    --mustard:    #FFC93C;
    --lettuce:    #7CB518;
    --tomato:     #E63946;
    --bun:        #E8A33D;

    /* Warm-biased neutrals, pulled toward the bun rather than stock grey. */
    --bg:         #17111f;
    --surface:    #211829;
    --surface-2:  #2b2034;
    --line:       #3a2c46;
    --text:       #F6ECDC;
    --text-dim:   #b3a3ae;
    --text-faint: #7d6f86;
    --accent:     var(--mustard);

    --radius: 12px;
    --pad: clamp(16px, 4vw, 28px);
  }

  @media (prefers-color-scheme: light) {
    :root {
      --bg:         #FBF4E7;
      --surface:    #FFFCF6;
      --surface-2:  #F3E8D5;
      --line:       #e0cfb4;
      --text:       #241a2e;
      --text-dim:   #6b5b57;
      --text-faint: #97877f;
      --accent:     #C88A00;
    }
  }
  :root[data-theme="light"] {
    --bg:         #FBF4E7;
    --surface:    #FFFCF6;
    --surface-2:  #F3E8D5;
    --line:       #e0cfb4;
    --text:       #241a2e;
    --text-dim:   #6b5b57;
    --text-faint: #97877f;
    --accent:     #C88A00;
  }
  :root[data-theme="dark"] {
    --bg:         #17111f;
    --surface:    #211829;
    --surface-2:  #2b2034;
    --line:       #3a2c46;
    --text:       #F6ECDC;
    --text-dim:   #b3a3ae;
    --text-faint: #7d6f86;
    --accent:     #FFC93C;
  }

  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }

  .wrap {
    max-width: 62rem;
    margin: 0 auto;
    padding: var(--pad) var(--pad) 5rem;
    display: flex;
    flex-direction: column;
    gap: clamp(20px, 4vw, 34px);
  }

  /* ── Masthead ─────────────────────────────────────────── */
  .masthead { display: flex; flex-direction: column; gap: 6px; }
  .eyebrow {
    font: 600 0.7rem/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--accent);
  }
  h1 {
    margin: 0;
    font-size: clamp(1.6rem, 5.5vw, 2.5rem);
    font-weight: 800;
    letter-spacing: -0.025em;
    text-wrap: balance;
  }
  .sub { margin: 0; color: var(--text-dim); font-size: 0.95rem; max-width: 46ch; }

  /* ── Overall meter ────────────────────────────────────── */
  .meter { display: flex; flex-direction: column; gap: 8px; }
  .meter__head {
    display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
    font: 600 0.78rem/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: 0.06em;
    color: var(--text-dim);
    font-variant-numeric: tabular-nums;
  }
  .meter__track {
    height: 8px; border-radius: 99px; background: var(--surface-2);
    overflow: hidden; border: 1px solid var(--line);
  }
  .meter__fill {
    height: 100%; width: ${pct}%;
    background: linear-gradient(90deg, var(--lettuce), var(--accent));
    border-radius: 99px;
  }

  /* ── Now-building card ────────────────────────────────── */
  .now {
    background: var(--surface);
    border: 1px solid var(--line);
    border-left: 4px solid var(--accent);
    border-radius: var(--radius);
    padding: clamp(14px, 3vw, 20px);
    display: flex; flex-direction: column; gap: 8px;
  }
  .now__label {
    font: 600 0.68rem/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent);
    display: flex; align-items: center; gap: 8px;
  }
  .pulse {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--accent);
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
  @media (prefers-reduced-motion: reduce) { .pulse { animation: none; } }
  .now__piece { font-size: 1.12rem; font-weight: 700; letter-spacing: -0.01em; }
  .now__detail { color: var(--text-dim); font-size: 0.92rem; margin: 0; }

  /* ── Piece ledger ─────────────────────────────────────── */
  section { display: flex; flex-direction: column; gap: 12px; }
  h2 {
    margin: 0;
    font: 600 0.72rem/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-faint);
  }
  ul.pieces { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }

  .piece {
    display: grid;
    grid-template-columns: 2.9rem 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 11px 14px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 10px;
  }
  .piece--active { border-color: color-mix(in srgb, var(--accent) 55%, var(--line)); background: var(--surface-2); }
  .piece--queued { opacity: 0.62; }

  .piece__id {
    font: 600 0.72rem/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }
  .piece__body { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .piece__name { font-weight: 600; font-size: 0.95rem; }
  .piece__note { color: var(--text-dim); font-size: 0.8rem; }

  .chip {
    font: 600 0.66rem/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: 0.06em;
    padding: 5px 9px;
    border-radius: 99px;
    white-space: nowrap;
    border: 1px solid transparent;
  }
  .chip--done     { color: var(--lettuce); background: color-mix(in srgb, var(--lettuce) 14%, transparent); border-color: color-mix(in srgb, var(--lettuce) 34%, transparent); }
  .chip--active   { color: var(--accent);  background: color-mix(in srgb, var(--accent) 15%, transparent);  border-color: color-mix(in srgb, var(--accent) 38%, transparent); }
  .chip--queued   { color: var(--text-faint); background: color-mix(in srgb, var(--text-faint) 12%, transparent); }
  .chip--rejected,
  .chip--blocked  { color: var(--tomato);  background: color-mix(in srgb, var(--tomato) 15%, transparent);  border-color: color-mix(in srgb, var(--tomato) 38%, transparent); }

  /* ── Commits ──────────────────────────────────────────── */
  ol.log { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0; }
  .commit {
    display: grid; grid-template-columns: 5rem 1fr auto; gap: 12px;
    align-items: baseline;
    padding: 9px 4px;
    border-bottom: 1px solid var(--line);
    font-size: 0.87rem;
  }
  .commit:last-child { border-bottom: none; }
  .commit__hash { font: 500 0.76rem/1 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--accent); }
  .commit__subject { color: var(--text); min-width: 0; overflow-wrap: anywhere; }
  .commit__when { font: 400 0.72rem/1 ui-monospace, monospace; color: var(--text-faint); white-space: nowrap; }
  .empty { color: var(--text-faint); font-size: 0.87rem; }

  /* ── Constraints ──────────────────────────────────────── */
  ul.notes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
  .notes li {
    padding-left: 15px; position: relative;
    color: var(--text-dim); font-size: 0.87rem;
  }
  .notes li::before {
    content: ""; position: absolute; left: 0; top: 0.62em;
    width: 5px; height: 5px; border-radius: 50%; background: var(--text-faint);
  }

  footer { color: var(--text-faint); font-size: 0.76rem; font-family: ui-monospace, monospace; }

  @media (max-width: 520px) {
    .piece { grid-template-columns: 2.4rem 1fr; grid-template-areas: "id body" ". chip"; row-gap: 7px; }
    .piece__id { grid-area: id; }
    .piece__body { grid-area: body; }
    .chip { grid-area: chip; justify-self: start; }
    .commit { grid-template-columns: 4.4rem 1fr; }
    .commit__when { grid-column: 1 / -1; }
  }
</style>

<div class="wrap">
  <header class="masthead">
    <span class="eyebrow">Live build status</span>
    <h1>${esc(data.title)}</h1>
    <p class="sub">${esc(data.subtitle)}</p>
  </header>

  <div class="meter">
    <div class="meter__head">
      <span>${done} of ${total} pieces approved</span>
      <span>${pct}%</span>
    </div>
    <div class="meter__track"><div class="meter__fill"></div></div>
  </div>

  <div class="now">
    <span class="now__label"><span class="pulse"></span>Now building · round ${esc(data.active.round)}</span>
    <span class="now__piece">${esc(data.active.piece)}</span>
    <p class="now__detail">${esc(data.active.detail)}</p>
  </div>

  ${data.groups.map((g) => `<section>
    <h2>${esc(g.name)}</h2>
    <ul class="pieces">
      ${g.pieces.map(pieceRow).join('\n      ')}
    </ul>
  </section>`).join('\n  ')}

  <section>
    <h2>Commits</h2>
    ${commits.length
      ? `<ol class="log">${commits.map((c) => `<li class="commit">
        <span class="commit__hash">${esc(c.hash)}</span>
        <span class="commit__subject">${esc(c.subject)}</span>
        <span class="commit__when">${esc(c.when)}</span>
      </li>`).join('')}</ol>`
      : '<p class="empty">No commits yet.</p>'}
  </section>

  <section>
    <h2>Standing constraints</h2>
    <ul class="notes">
      ${data.notes.map((n) => `<li>${esc(n)}</li>`).join('\n      ')}
    </ul>
  </section>

  <footer>Regenerated from git and tools/progress-data.json</footer>
</div>
`;

await writeFile(new URL('../progress.html', import.meta.url), html);
console.log(`✓ progress.html — ${done}/${total} pieces approved (${pct}%), ${commits.length} commits`);
