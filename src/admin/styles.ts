/**
 * THE ADMIN PANEL'S OWN STYLESHEET.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🚨 READ THIS BEFORE "FIXING" THIS FILE BY IMPORTING `../ui/screens/theme.ts`.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This repo has a design-system rule, and it is a good one: every screen imports
 * `ui/screens/theme.ts` so tokens, safe areas, focus rings and motion preferences are
 * stated once (`f5a6229`, `3481d71`). **This file deliberately does not**, and that will
 * look like an oversight to the next agent who greps for it. It is not.
 *
 * The instruction is Uri's, in `DECISIONS-FOR-URI.md` §76, verbatim:
 *
 *   > *"Admin should not look like the game. Should be a clean, thorough and manageable
 *   > admin panel."*
 *
 * and §76's own SHAPE section spells out the mechanical consequence:
 *
 *   > *"Clean and dense — explicitly NOT the game's look, so it must not adopt
 *   > `src/ui/screens/theme.ts`; that is a deliberate departure from the design-system
 *   > rule and the reason should be written where the next agent will look."*
 *
 * This is where the next agent will look. **Do not import the theme here.** Doing so
 * would pull in the vinyl-toy palette, the 999px pill radii, the Rubik/Heebo display
 * faces and `fa-screen-in`, and the panel would become the thing it exists not to be —
 * a tuning table dressed as a game menu, where a hyper-saturated high-key surface is
 * actively hostile to reading four columns of numbers.
 *
 * ── WHAT IS BORROWED ANYWAY, AND WHY THAT IS NOT A CONTRADICTION ────────────────
 *
 * Two things, both platform facts rather than house style:
 *   * `env(safe-area-inset-*)` — the notch exists whatever a panel looks like.
 *   * `prefers-reduced-motion` — an accessibility setting, not a brand.
 * Both are re-stated here (six lines) rather than imported, because importing the theme
 * for them would drag the whole palette in with them. That is the trade, stated.
 *
 * ── AND WHAT IT MUST SURVIVE, WHICH IS NOT OPTIONAL ─────────────────────────────
 *
 * The panel mounts inside the shell's `.fa-stack`, under `#screens`, which `index.html`
 * sets to `pointer-events: none` — deliberately, and it is load-bearing (a match's canvas
 * gets no mouse events otherwise). So this root re-enables pointer events explicitly. It
 * also paints an opaque background, because `.fa-bg`/`.fa-rays`/`.fa-dots` are still in
 * the DOM behind it and the game's orange rays through a data table would be exactly the
 * failure Uri is asking to avoid.
 *
 * ⚠️ `index.html` forbids the PAGE from scrolling (body is `position: fixed`,
 * `overflow: hidden`). Everything that can overflow scrolls inside its own box.
 * ⚠️ No nested `@media` — `menu_accept_portrait.mjs` lints for it and a nested block that
 * contradicts its parent is dead CSS that reads as a shipped layout.
 * ⚠️ No backtick anywhere inside the literal below — `menu_accept.mjs` parses every
 * module in `src/` for exactly that, because one stray backtick in a CSS comment turns
 * the file into a syntax error and the whole app into a blank page.
 */

const STYLE_ID = 'fa-admin-styles';

const CSS = `
.adm {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr) auto;
  pointer-events: auto;
  background: #10131a;
  color: #ced5e0;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  line-height: 1.45;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}

.adm * { box-sizing: border-box; }
.adm ::selection { background: #2f6feb; color: #fff; }

/* Numerals are tabular and monospaced everywhere they are compared down a column.
   A proportional 1 next to a proportional 8 in a value column is the single most
   effective way to make a tuning table unreadable. */
.adm-num {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

/* ── top bar ─────────────────────────────────────────────────────────────── */
.adm-top {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  border-bottom: 1px solid #232a36;
  background: #151a23;
  flex-wrap: wrap;
}
.adm-brand {
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 11px;
  color: #8f9bb0;
  white-space: nowrap;
}
.adm-brand b { color: #e6ebf3; letter-spacing: 0.08em; }
.adm-stamp {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 3px 9px;
  border: 1px solid #2b3444;
  background: #0c0f15;
  color: #9fb0c8;
  font-size: 11px;
  white-space: nowrap;
}
.adm-stamp b { color: #e6ebf3; }
.adm-stamp.is-tuned { border-color: #7a5c12; color: #e0bd63; }
.adm-stamp.is-tuned b { color: #ffd479; }
.adm-spacer { flex: 1 1 auto; }

/* ── buttons: rectangular on purpose. The game is all 999px pills. ───────── */
.adm-btn {
  appearance: none;
  border: 1px solid #333d4d;
  background: #1b222d;
  color: #ced5e0;
  font: inherit;
  font-size: 12px;
  padding: 6px 12px;
  min-height: 30px;
  cursor: pointer;
  white-space: nowrap;
}
.adm-btn:hover { background: #232c3a; border-color: #435063; }
.adm-btn:active { background: #161d26; }
.adm-btn:focus-visible { outline: 2px solid #4c8dff; outline-offset: 1px; }
.adm-btn[disabled] { opacity: 0.38; cursor: default; }
.adm-btn--primary { background: #2f6feb; border-color: #2f6feb; color: #fff; font-weight: 600; }
.adm-btn--primary:hover { background: #3b7cf7; border-color: #3b7cf7; }
.adm-btn--danger { color: #ff9a8f; border-color: #4a2f2c; }
.adm-btn--danger:hover { background: #2a1c1a; border-color: #6b3d38; }

/* ── tabs ────────────────────────────────────────────────────────────────── */
.adm-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid #232a36;
  background: #10131a;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
}
.adm-tab {
  appearance: none;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #8f9bb0;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  padding: 9px 16px;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 7px;
}
.adm-tab:hover { color: #ced5e0; background: #151a23; }
.adm-tab:focus-visible { outline: 2px solid #4c8dff; outline-offset: -2px; }
.adm-tab[aria-selected="true"] { color: #e6ebf3; border-bottom-color: #2f6feb; }
.adm-tab-count {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10.5px;
  color: #6d7a8d;
  border: 1px solid #262f3c;
  padding: 0 5px;
}
.adm-tab-soon {
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #6d7a8d;
  border: 1px dashed #3a4553;
  padding: 0 5px;
}

/* ── filter bar ──────────────────────────────────────────────────────────── */
.adm-filter {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid #232a36;
  background: #12161e;
  flex-wrap: wrap;
}
.adm-search {
  appearance: none;
  background: #0a0d12;
  border: 1px solid #2b3444;
  color: #e6ebf3;
  font: inherit;
  font-size: 12.5px;
  padding: 5px 9px;
  min-height: 30px;
  min-width: 240px;
  flex: 0 1 340px;
}
.adm-search:focus { outline: 2px solid #4c8dff; outline-offset: -1px; border-color: #4c8dff; }
.adm-check { display: flex; align-items: center; gap: 6px; color: #9fb0c8; font-size: 12px; cursor: pointer; }
.adm-check input { accent-color: #2f6feb; width: 15px; height: 15px; }
.adm-tally { color: #6d7a8d; font-size: 11.5px; }
.adm-tally b { color: #ced5e0; }

/* ── the scrolling body ──────────────────────────────────────────────────── */
.adm-body { overflow: auto; padding: 0 0 22px; scrollbar-width: thin; }
.adm-section { border-bottom: 1px solid #1c232e; }
.adm-section-h {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 7px 16px;
  background: #171d27;
  border-bottom: 1px solid #232a36;
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #8f9bb0;
  font-weight: 700;
}
.adm-section-h span { letter-spacing: 0; text-transform: none; font-weight: 400; color: #6d7a8d; font-size: 11.5px; }

/* Column grid, shared by the header strip and every row so they cannot drift. */
.adm-hrow, .adm-row {
  display: grid;
  grid-template-columns: minmax(220px, 2.2fr) 54px 92px 92px 116px minmax(200px, 2fr);
  gap: 10px;
  align-items: center;
  padding: 4px 16px;
}
.adm-hrow {
  position: sticky;
  top: 30px;
  z-index: 1;
  background: #12161e;
  border-bottom: 1px solid #232a36;
  color: #6d7a8d;
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding-top: 6px;
  padding-bottom: 6px;
}
.adm-row { border-bottom: 1px solid #171d26; min-height: 34px; }
.adm-row:hover { background: #141a23; }
.adm-row.is-staged { background: #16202e; }
.adm-row.is-staged:hover { background: #1a2536; }
.adm-row.is-bad { background: #2a1618; }

.adm-key {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: #cfe0ff;
  overflow-wrap: anywhere;
}
.adm-key .adm-doc {
  display: block;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 11px;
  color: #6d7a8d;
  overflow-wrap: anywhere;
}
.adm-unit { color: #6d7a8d; font-size: 11px; }
.adm-cell { font-size: 12px; color: #9fb0c8; text-align: right; }
.adm-cell.is-live { color: #e6ebf3; }

.adm-input {
  width: 100%;
  appearance: none;
  background: #0a0d12;
  border: 1px solid #2b3444;
  color: #e6ebf3;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  text-align: right;
  padding: 4px 7px;
  min-height: 26px;
}
.adm-input:focus { outline: 2px solid #4c8dff; outline-offset: -1px; border-color: #4c8dff; }
.adm-input.is-staged { border-color: #2f6feb; background: #101a2a; color: #a8ccff; }
.adm-input.is-bad { border-color: #d0453c; background: #2a1618; color: #ffb3ab; }
.adm-input[readonly] { background: #0d1016; color: #7d8b9f; border-style: dashed; cursor: default; text-align: right; }

/* ── the consequence column: what §76 says makes this a tuning tool ──────── */
.adm-conseq { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.adm-cq {
  font-size: 11px;
  color: #7f8da2;
  display: flex;
  gap: 6px;
  align-items: baseline;
  overflow-wrap: anywhere;
}
.adm-cq b {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-weight: 500;
  color: #9fb0c8;
}
.adm-cq.is-moved { color: #d7c07a; }
.adm-cq.is-moved b { color: #ffd479; }
.adm-cq-arrow { color: #566173; }
.adm-cq-fn { color: #7f8da2; font-style: italic; }
.adm-note { font-size: 11px; color: #6d7a8d; }
.adm-warn { font-size: 11px; color: #e0a03c; }
.adm-err { font-size: 11px; color: #ff8a7e; }

/* ── read-only derived block ─────────────────────────────────────────────── */
.adm-drow {
  display: grid;
  grid-template-columns: minmax(220px, 1.6fr) 54px 110px minmax(260px, 2.4fr);
  gap: 10px;
  align-items: baseline;
  padding: 5px 16px;
  border-bottom: 1px solid #171d26;
}
.adm-drow:hover { background: #141a23; }
.adm-lock {
  display: inline-block;
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #7a6a3a;
  border: 1px solid #4a412a;
  padding: 0 4px;
  margin-right: 6px;
  vertical-align: 1px;
}
.adm-from { font-size: 11px; color: #6d7a8d; overflow-wrap: anywhere; }
.adm-from code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #9fb0c8;
  background: #171d26;
  padding: 0 3px;
}

/* ── placeholder tabs: deliberate, not broken ────────────────────────────── */
.adm-placeholder { padding: 30px 16px 40px; max-width: 780px; }
.adm-placeholder h2 {
  margin: 0 0 4px;
  font-size: 15px;
  color: #e6ebf3;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.adm-placeholder .adm-ph-tag {
  display: inline-block;
  font-size: 9.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #7f8da2;
  border: 1px dashed #3a4553;
  padding: 1px 6px;
  margin-bottom: 12px;
}
.adm-placeholder p { margin: 0 0 12px; color: #9fb0c8; max-width: 68ch; }
.adm-ph-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid #232a36; }
.adm-ph-list li {
  display: grid;
  grid-template-columns: minmax(150px, 240px) 1fr;
  gap: 14px;
  padding: 8px 0;
  border-bottom: 1px solid #1c232e;
  align-items: baseline;
}
.adm-ph-list b { color: #cfe0ff; font-weight: 600; font-size: 12.5px; }
.adm-ph-list span { color: #7f8da2; font-size: 12px; }

/* ── the "nothing to show" state ─────────────────────────────────────────── */
.adm-empty { padding: 34px 16px; max-width: 820px; }
.adm-empty h2 { margin: 0 0 10px; font-size: 15px; color: #ffb3ab; font-weight: 700; }

/* An INFORMATIONAL banner. Split from .adm-empty on the evidence of a screenshot:
   the selftest notice was rendering in the error style, so a panel that was working
   perfectly announced itself in red. A notice and a fault must not look the same, for
   the same reason an empty table and a filtered table must not. */
.adm-notice {
  padding: 12px 16px 12px 13px;
  margin: 0;
  max-width: none;
  border-left: 3px solid #2f6feb;
  background: #131b26;
  border-bottom: 1px solid #1c232e;
}
.adm-notice h2 { color: #a8ccff; font-size: 12.5px; margin: 0 0 4px; letter-spacing: 0.02em; }
.adm-notice p { color: #8fa0b6; margin: 0; max-width: 86ch; font-size: 12px; }
.adm-notice code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #cfe0ff; }
.adm-notice--warn { border-left-color: #e0a03c; background: #1e1a12; }
.adm-notice--warn h2 { color: #ffd479; }

/* A section whose rows were all filtered away. A header with nothing under it reads as
   a broken screen — caught by looking at a PNG, not by any assertion. */
.adm-nomatch { padding: 14px 16px; color: #6d7a8d; font-size: 12px; }
.adm-empty pre {
  margin: 0 0 14px;
  padding: 10px 12px;
  background: #0a0d12;
  border: 1px solid #2b3444;
  color: #d7c07a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.adm-empty p { color: #9fb0c8; margin: 0 0 10px; max-width: 72ch; }

/* ── footer ──────────────────────────────────────────────────────────────── */
.adm-foot {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 16px;
  border-top: 1px solid #232a36;
  background: #151a23;
  color: #6d7a8d;
  font-size: 11px;
  flex-wrap: wrap;
}
.adm-foot kbd {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10.5px;
  border: 1px solid #333d4d;
  border-bottom-width: 2px;
  padding: 0 4px;
  color: #9fb0c8;
  background: #1b222d;
}

/* ── the import/export sheet ─────────────────────────────────────────────── */
.adm-sheet {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(6, 8, 12, 0.78);
}
.adm-sheet-card {
  width: min(760px, 100%);
  max-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #151a23;
  border: 1px solid #333d4d;
  padding: 16px;
  overflow: auto;
}
.adm-sheet-card h2 { margin: 0; font-size: 14px; color: #e6ebf3; font-weight: 700; }
.adm-ta {
  width: 100%;
  min-height: 240px;
  resize: vertical;
  background: #0a0d12;
  border: 1px solid #2b3444;
  color: #cfe0ff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  padding: 10px;
}
.adm-ta:focus { outline: 2px solid #4c8dff; outline-offset: -1px; }
.adm-sheet-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

/* ── PORTRAIT / NARROW.  This is a DESKTOP tool; narrow is survival, not the target.
   The call and its reasoning are in adminScreen.ts under THE PORTRAIT DECISION.
   Flat rule, never nested inside another @media. ─────────────────────────── */
@media (max-width: 760px) {
  .adm { font-size: 14px; }
  .adm-hrow { display: none; }
  .adm-row {
    grid-template-columns: 1fr 116px;
    grid-template-areas: "key input" "conseq conseq";
    row-gap: 6px;
    padding: 10px 12px;
  }
  .adm-row .adm-key { grid-area: key; }
  .adm-row .adm-unit, .adm-row .adm-cell { display: none; }
  .adm-row .adm-inputwrap { grid-area: input; }
  .adm-row .adm-conseq { grid-area: conseq; }
  .adm-input { min-height: 44px; font-size: 15px; }
  .adm-btn { min-height: 44px; padding: 0 14px; }
  .adm-tab { min-height: 44px; }
  .adm-search { min-height: 44px; font-size: 15px; }
  .adm-drow { grid-template-columns: 1fr; row-gap: 3px; padding: 10px 12px; }
  .adm-ph-list li { grid-template-columns: 1fr; row-gap: 2px; }
  /* The keyboard map is dead weight on a phone and it was costing three lines of the
     848 px this viewport has. The recovery hint stays: that is the one line worth
     having when a bad set has locked you out. */
  .adm-foot .adm-kb { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .adm * { transition: none !important; animation: none !important; }
}
`;

/**
 * Inject once. Idempotent by id, like `theme.ts:ensureScreenStyles` — the same pattern,
 * not the same stylesheet.
 */
export function ensureAdminStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}
