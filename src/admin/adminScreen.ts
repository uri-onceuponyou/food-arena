/**
 * THE ADMIN PANEL — `DECISIONS-FOR-URI.md` §76.
 *
 * Uri, 2026-08-12:
 *   > *"All game and character constants should be manageable through admin. Nothing lives
 *   > in code. This way I can play around with all constants and adjust to the best
 *   > gameplay. Admin should not look like the game. Should be a clean, thorough and
 *   > manageable admin panel. Leave a placeholder for future analytics and economics tabs."*
 *
 * ── WHAT THIS FILE IS AND IS NOT ────────────────────────────────────────────────
 *
 * It is a VIEW. It holds no constant, computes no game arithmetic and enumerates no
 * field. Everything it shows comes out of `src/game/tuning/registry.ts`, which learned it
 * from the literal in `rules.ts`; everything it computes it computes by calling the
 * registry's own `recompute` lambdas through `model.ts:resolveValue`. §76 constraint 1 —
 * *"the panel must not become the second place"* — is enforced by there being nothing
 * here to go stale.
 *
 * ── THE FOUR THINGS A ROW SAYS, AND WHY IT IS FOUR AND NOT ONE ──────────────────
 *
 * A single editable box would be a lie, and §76 constraint 4 is precisely about surfaces
 * that look authoritative and are not (*"the stat card was fiction; the rarity ramp ran
 * backwards; 20 of 34 weapon descriptions describe mechanics that do not exist"*). So:
 *
 *   AUTHORED   the literal in `rules.ts`. Never editable, always shown, so "what did this
 *              used to be" never needs a git command.
 *   LIVE       what the SIM IS RUNNING RIGHT NOW. Not what the box says.
 *   [ input ]  what it will boot as after Apply. Blank/equal-to-authored clears the
 *              override entirely rather than persisting a no-op.
 *   →  …       the DERIVED CONSEQUENCES, recomputed as you type.
 *
 * 🚨 **LIVE AND THE INPUT ARE DIFFERENT COLUMNS BECAUSE A CONSTANT CANNOT CHANGE WHILE
 * THE GAME IS RUNNING.** `store.ts` seals on first read and says why at length: an ESM
 * `const` cannot be reassigned, a getter would put a call in the sim's hot path, and a
 * constant that moved mid-match would make a seeded replay unreproducible — destroying
 * the property that *"underwrites every balance number in the project"*. A panel that
 * showed one box would be claiming an edit had already landed. This one stages, persists,
 * and reloads.
 *
 * ── THE CONSEQUENCE COLUMN IS THE POINT ─────────────────────────────────────────
 *
 * §76: *"a cooldown that happens to divide a status cycle produces an 83% lock, and
 * LENGTHENING a cooldown can make it worse… nobody could see that from a number in a text
 * box."* Every consequence shown here is a registry-declared derived value that names this
 * field as an input, transitively. The panel neither knows nor states what any of them
 * mean. Add a `derive()` in `rules.ts` tomorrow and it appears here with no edit to this
 * file; delete one and it disappears rather than becoming a stale caption.
 *
 * ⚠️ **WHAT IS NOT HERE YET, STATED PLAINLY RATHER THAN IMPLIED.** §76 also names
 * consequences that are not registry derivations — status-lock %, effective reach against
 * the press gate, time-to-close a reach band, fog share of damage, payout per minute.
 * Those are FUNCTIONS OF THE SIM, not of the constants alone, and the honest place for
 * them is `src/game/**` (a peer's file set), registered through `deriveFns()` so they
 * arrive here automatically. **Do not implement any of them in this file.** A second
 * implementation of the status-lock arithmetic inside the tool built to prevent duplicated
 * rules would be this repo's most-repeated defect committed at its own funeral.
 *
 * ── THE PORTRAIT DECISION, MADE RATHER THAN LET FALL OUT ────────────────────────
 *
 * Uri plays PORTRAIT — both phone captures are 384x848 (§74) — and `menu_accept_portrait`
 * exists because three screens shipped with no portrait layout at all. **This screen is
 * still landscape/desktop-first, and that is a decision with a reason:** it is a tuning
 * tool, not a place the game is played. Six columns of numbers at 384 px wide is either
 * four characters per cell or a horizontal scroll, and both are worse than the honest
 * answer, which is that this is used on a laptop beside the game.
 *
 * What narrow gets instead (`styles.ts`, one flat `@media (max-width: 760px)`): the row
 * collapses to key-over-input with consequences beneath, the authored/live columns hide,
 * and every control goes to a 44 px tap target. So a phone can READ it and make a small
 * edit; it is not where 250 character fields get swept.
 *
 * ⚠️ **AND IT IS NOT IN `menu_accept`'s SCREEN LIST — MEASURED, NOT ASSUMED.**
 * `tools/tmp/menu_accept.mjs:803` iterates a HARDCODED six: opening, home, characters,
 * trophies, shop, settings. It does not contain `lobby` either, which shipped last
 * session. So a new screen does NOT join that gate by existing, its 361 checks do not
 * move, and adding this one would mean editing a file outside this agent's owned set.
 * `tools/tmp/adm_accept.mjs` is this screen's acceptance battery instead.
 */

import type { Screen, ScreenContext } from '../ui/screens/types.ts';
import { ADMIN_ENABLED } from './gate.ts';
import { ensureAdminStyles } from './styles.ts';
import { installSelftestRegistry, selftestRequested } from './selftest.ts';
import {
  buildEnvelope, buildGraph, canonicalise, consequencesFor, fmt, parseImported,
  pendingCandidates, persistStagedSet, readRegistry, readStoredSet, resolveValue,
  stagedHash, validateCandidate, willBe, TABS,
  type AuthoredEntry, type Consequence, type DerivedEntry, type DerivedFnEntry,
  type Graph, type Readout, type RegistryEntry, type Unavailable,
} from './model.ts';

declare global {
  interface Window {
    /**
     * QA handle for `tools/tmp/adm_accept.mjs`, same spirit as `window.__shell`. Present
     * only while the panel is mounted, and only in a build where `gate.ts` let it mount.
     */
    __admin?: {
      tab(): string;
      setTab(id: string): void;
      rowKeys(): string[];
      stagedCount(): number;
      stage(key: string, v: number): void;
      stagedHash(): string;
      liveHash(): string;
      /** The consequence lines currently rendered under a row, as flat text. */
      consequences(key: string): string[];
      badKeys(): string[];
    };
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function button(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', `adm-btn ${cls}`.trim(), label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

// ─────────────────────────────────────────────────────────────────────────────

export function createAdminScreen(_ctx: ScreenContext): Screen {
  ensureAdminStyles();

  // The fixture, if asked for, BEFORE the registry is read — it registers into the same
  // singleton and `readRegistry()` seals. See `selftest.ts` for why this is safe.
  const selftest = selftestRequested();
  if (selftest) installSelftestRegistry();

  const root = el('div', 'adm');
  root.dataset.el = 'admin';

  const status = readRegistry();
  if (!status.ok) {
    renderUnavailable(root, status.why, selftest);
    return { root, dispose() { /* nothing was wired */ } };
  }

  const readout: Readout = status.readout;
  const graph: Graph = buildGraph(readout.entries);
  const stored = readStoredSet();

  /** The set that WILL be persisted. Absence of a key means "no override" = authored. */
  const staged = new Map(stored.overrides);
  /** Keys whose typed text is currently not a legal value. Blocks Apply. */
  const bad = new Map<string, string>();

  let activeTab = TABS[0].id;
  let query = '';
  let changedOnly = false;

  // ── chrome ────────────────────────────────────────────────────────────────
  const top = el('div', 'adm-top');
  const tabsBar = el('div', 'adm-tabs');
  tabsBar.setAttribute('role', 'tablist');
  const filter = el('div', 'adm-filter');
  const body = el('div', 'adm-body');
  const foot = el('div', 'adm-foot');
  root.append(top, tabsBar, filter, body, foot);

  // ── top bar ───────────────────────────────────────────────────────────────
  const brand = el('div', 'adm-brand');
  brand.innerHTML = '<b>Food Fight Arena</b> · tuning';
  const stamp = el('div', 'adm-stamp');
  const applyBtn = button('Apply & reload', 'adm-btn--primary', apply);
  const resetBtn = button('Reset all', 'adm-btn--danger', resetAll);
  top.append(
    brand, stamp, el('div', 'adm-spacer'),
    button('Export', '', () => openSheet('export')),
    button('Import', '', () => openSheet('import')),
    button('Boot stock', '', bootStock),
    resetBtn, applyBtn,
  );

  // ── tabs ──────────────────────────────────────────────────────────────────
  const tabButtons = new Map<string, HTMLButtonElement>();
  for (const t of TABS) {
    const b = el('button', 'adm-tab');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.dataset.tab = t.id;
    const label = el('span', undefined, t.label);
    b.append(label);
    if (t.group === null) {
      b.append(el('span', 'adm-tab-soon', 'soon'));
    } else {
      const n = readout.entries.filter((e) => e.group === t.group).length;
      // A count, not a badge: a tab reading 0 is information (nothing registered in that
      // group yet), and hiding it would make an empty group look like a broken one.
      b.append(el('span', 'adm-tab-count', String(n)));
      if (t.id === 'economy') b.append(el('span', 'adm-tab-soon', 'partial'));
    }
    b.addEventListener('click', () => setTab(t.id));
    tabButtons.set(t.id, b);
    tabsBar.append(b);
  }

  // ── filter bar ────────────────────────────────────────────────────────────
  const search = el('input', 'adm-search');
  search.type = 'search';
  search.placeholder = 'Filter by key or description…   ( / )';
  search.setAttribute('aria-label', 'Filter fields');
  search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); renderTab(); });

  const changedWrap = el('label', 'adm-check');
  const changedBox = el('input');
  changedBox.type = 'checkbox';
  changedBox.addEventListener('change', () => { changedOnly = changedBox.checked; renderTab(); });
  changedWrap.append(changedBox, document.createTextNode('Changed only'));

  const tally = el('div', 'adm-tally');
  filter.append(search, changedWrap, tally);

  // ── footer ────────────────────────────────────────────────────────────────
  foot.innerHTML =
    '<span class="adm-kb"><kbd>/</kbd> filter</span>'
    + '<span class="adm-kb"><kbd>Alt</kbd>+<kbd>1</kbd>…<kbd>5</kbd> tab</span>'
    + '<span class="adm-kb"><kbd>Esc</kbd> revert field</span>'
    + '<span class="adm-kb"><kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Enter</kbd> apply &amp; reload</span>'
    + '<span class="adm-spacer"></span>'
    + '<span>Locked out by a bad set? append <code>?tuning=off</code> to the URL — it is checked before any source is read.</span>';

  // ── rows ──────────────────────────────────────────────────────────────────

  interface Row {
    key: string;
    node: HTMLElement;
    /** Registry keys whose value this row displays. Drives targeted refreshes. */
    watches: readonly string[];
    refresh(): void;
  }
  let rows: Row[] = [];

  function candidates(): Map<string, number> {
    return pendingCandidates(staged, readout.authored);
  }

  function stagedDelta(): number {
    return canonicalise(staged).size;
  }

  function refreshChrome(): void {
    const hash = stagedHash(staged);
    const tuned = hash !== 'stock';
    stamp.className = `adm-stamp${tuned ? ' is-tuned' : ''}`;
    stamp.innerHTML = '';
    stamp.append(
      document.createTextNode('live '),
      Object.assign(el('b'), { textContent: readout.liveHash }),
      document.createTextNode(` (${readout.liveSource})`),
    );
    if (hash !== readout.liveHash) {
      stamp.append(
        document.createTextNode(' → staged '),
        Object.assign(el('b'), { textContent: hash }),
      );
    }
    const pending = candidates().size;
    applyBtn.disabled = bad.size > 0 || pending === 0;
    applyBtn.textContent = pending === 0
      ? 'Apply & reload'
      : `Apply ${pending} change${pending === 1 ? '' : 's'} & reload`;
    resetBtn.disabled = stagedDelta() === 0 && pending === 0;
    if (bad.size > 0) applyBtn.title = `${bad.size} field(s) hold an illegal value`;
    else applyBtn.title = 'Persists the set to localStorage and reloads — constants are read once, at boot';
  }

  function setTab(id: string): void {
    activeTab = id;
    for (const [tid, b] of tabButtons) b.setAttribute('aria-selected', String(tid === id));
    renderTab();
  }

  function matchesQuery(e: RegistryEntry): boolean {
    if (!query) return true;
    return e.key.toLowerCase().includes(query) || e.doc.toLowerCase().includes(query);
  }

  function renderTab(): void {
    body.innerHTML = '';
    rows = [];
    // 🚨 `bad` IS CLEARED HERE, AND LEAVING IT WAS A REAL DEFECT — found by re-reading
    // this file, not by any test, so an arm in `adm_accept.mjs` now covers it.
    //
    // An illegal value exists ONLY as text in a DOM input: it is never staged, so
    // destroying the row destroys it. But `bad` outlived the row. Type garbage into a
    // field, filter it out of view, and Apply stayed disabled forever with the offending
    // row nowhere on screen — a dead button whose cause the panel could not show you.
    // Every row re-validates itself in `makeRow`'s own `refresh()`, so rebuilding the
    // set from the rows that actually exist is both correct and self-healing.
    bad.clear();
    const tab = TABS.find((t) => t.id === activeTab) ?? TABS[0];

    if (tab.id === 'analytics') {
      body.append(analyticsPlaceholder());
      tally.textContent = '';
      refreshChrome();
      return;
    }

    const group = tab.group!;
    const inGroup = readout.entries.filter((e) => e.group === group);
    const authored = inGroup.filter((e): e is AuthoredEntry => e.kind === 'authored');
    const derived = inGroup.filter(
      (e): e is DerivedEntry | DerivedFnEntry => e.kind !== 'authored',
    );

    if (tab.id === 'economy') body.append(economyPlaceholder(inGroup.length));

    if (selftest) body.append(selftestBanner());
    if (readout.liveSource === 'global' || readout.liveSource === 'env') body.append(sourceWarning(readout.liveSource));
    for (const problem of storageProblems()) body.append(problem);

    const visible = authored.filter((e) => {
      if (!matchesQuery(e)) return false;
      if (changedOnly && Object.is(willBe(e, staged), e.authored) && !e.overridden) return false;
      return true;
    });
    tally.innerHTML = `<b>${visible.length}</b> of ${authored.length} tunable · <b>${derived.length}</b> derived`;

    if (authored.length === 0 && derived.length === 0) {
      const none = el('div', 'adm-empty');
      none.append(
        Object.assign(el('h2'), { textContent: `Nothing is registered in the "${group}" group` }),
        Object.assign(el('p'), {
          textContent:
            'That is not an empty search result — no constant in this group has been declared through '
            + 'registry.ts:tune()/tunables() yet. A group with zero rows is reported rather than drawn blank, '
            + 'because a table that renders nothing looks exactly like a table that filtered everything out.',
        }),
      );
      body.append(none);
      refreshChrome();
      return;
    }

    if (authored.length > 0) {
      const sec = el('div', 'adm-section');
      const h = el('div', 'adm-section-h');
      h.append(
        document.createTextNode('Tunable'),
        Object.assign(el('span'), {
          textContent: 'editable · authored literal lives in rules.ts and is learned, never restated',
        }),
      );
      const hrow = el('div', 'adm-hrow');
      for (const c of ['Key', 'Unit', 'Authored', 'Live', 'After reload', 'Derived consequence']) {
        hrow.append(el('div', undefined, c));
      }
      sec.append(h, hrow);
      if (visible.length === 0) {
        sec.append(Object.assign(el('div', 'adm-nomatch'), {
          textContent: changedOnly
            ? `No field in this group differs from its authored default (${authored.length} tunable here).`
            : `No key or description in this group matches "${query}" (${authored.length} tunable here).`,
        }));
      }
      for (const e of visible) {
        const row = makeRow(e);
        rows.push(row);
        sec.append(row.node);
      }
      body.append(sec);
    }

    if (derived.length > 0) {
      const sec = el('div', 'adm-section');
      const h = el('div', 'adm-section-h');
      h.append(
        document.createTextNode('Derived — read only'),
        Object.assign(el('span'), {
          textContent:
            'computed from the fields above. §76 constraint 2: a text box on one of these would '
            + 'un-fix the clock/collapse drift Uri found by playing.',
        }),
      );
      sec.append(h);
      // ⚠️ Counted BEFORE the loop so an all-filtered section can say so. A header with
      // nothing under it reads as a broken screen, and that is exactly how it looked in
      // the first capture of this panel — found by looking at the PNG, not by any
      // assertion, which is `CLAUDE.md` #3 doing its job.
      const shown = derived.filter(matchesQuery);
      if (shown.length === 0) {
        sec.append(Object.assign(el('div', 'adm-nomatch'), {
          textContent: `${derived.length} derived value(s) in this group, none matching "${query}".`,
        }));
      }
      for (const e of shown) {
        const row = makeDerivedRow(e);
        rows.push(row);
        sec.append(row.node);
      }
      body.append(sec);
    }

    refreshChrome();
  }

  /** Refresh every row that displays a value the edit could have moved. */
  function refreshAffected(changedKey: string): void {
    const moved = new Set(graph.affects.get(changedKey) ?? []);
    for (const r of rows) {
      if (r.key === changedKey || r.watches.some((w) => moved.has(w))) r.refresh();
    }
    refreshChrome();
  }

  function makeRow(e: AuthoredEntry): Row {
    const node = el('div', 'adm-row');
    node.dataset.key = e.key;

    const keyCell = el('div', 'adm-key');
    keyCell.append(document.createTextNode(e.key));
    if (e.matchesRung) {
      // A DISPLAY HINT and the registry says so — a coincidence test on the current
      // value, not a record of how the literal was written. Worded to match.
      const rung = el('span', 'adm-warn', ` · sits on the ${e.matchesRung} rung — overriding pins it off the ladder`);
      keyCell.append(rung);
    }
    keyCell.append(Object.assign(el('span', 'adm-doc'), { textContent: e.doc }));
    if (e.simClamp) {
      const c = e.simClamp;
      const band = [c.lo !== undefined ? `≥ ${c.lo}` : null, c.hi !== undefined ? `≤ ${c.hi}` : null]
        .filter(Boolean).join(' and ');
      keyCell.append(Object.assign(el('span', 'adm-doc'), {
        textContent: `sim clamps this ${band || 'itself'} in ${c.where}`,
      }));
    }

    const unit = el('div', 'adm-unit adm-num', e.unit || '·');
    const authoredCell = el('div', 'adm-cell adm-num', fmt(e.authored));
    authoredCell.title = 'the literal in rules.ts';
    const liveCell = el('div', 'adm-cell adm-num is-live', fmt(e.value));
    liveCell.title = e.overridden
      ? 'what the sim is running — an override from the booted set'
      : 'what the sim is running';

    const inputWrap = el('div', 'adm-inputwrap');
    const input = el('input', 'adm-input adm-num');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.value = String(willBe(e, staged));
    input.setAttribute('aria-label', e.key);
    input.title = `legal range ${e.min} … ${e.max}${e.int ? ' (whole numbers)' : ''}`;
    inputWrap.append(input);

    const conseq = el('div', 'adm-conseq');

    node.append(keyCell, unit, authoredCell, liveCell, inputWrap, conseq);

    const watches = graph.affects.get(e.key) ?? [];

    function paintConsequences(): void {
      conseq.innerHTML = '';
      const v = Number(input.value);
      const lines = Number.isFinite(v)
        ? consequencesFor(e.key, v, candidates(), graph)
        : [];
      if (lines.length === 0) {
        conseq.append(Object.assign(el('div', 'adm-note'), {
          // Stated, not left blank: "no consequence" and "the panel did not look" must
          // not render identically.
          textContent: watches.length === 0 ? 'nothing derives from this' : '—',
        }));
        return;
      }
      for (const c of lines) conseq.append(consequenceLine(c));
    }

    function refresh(): void {
      const raw = input.value.trim();
      const v = raw === '' ? e.authored : Number(raw);
      const problem = raw === '' ? null : validateCandidate(e, v);
      if (problem) bad.set(e.key, problem); else bad.delete(e.key);

      const pending = !problem && !Object.is(v, e.value);
      node.classList.toggle('is-staged', pending);
      node.classList.toggle('is-bad', !!problem);
      input.classList.toggle('is-staged', pending);
      input.classList.toggle('is-bad', !!problem);
      input.title = problem
        ? `${problem} — legal range ${e.min} … ${e.max}${e.int ? ' (whole numbers)' : ''}`
        : `legal range ${e.min} … ${e.max}${e.int ? ' (whole numbers)' : ''}`;
      paintConsequences();
    }

    input.addEventListener('input', () => {
      const raw = input.value.trim();
      if (raw === '') staged.delete(e.key);
      else {
        const v = Number(raw);
        // An unparseable or out-of-band value is NOT staged. The row goes red and Apply
        // is disabled, so a set that `registry.ts:checkOverride` would throw on at boot
        // can never be persisted from here.
        if (Number.isFinite(v) && !validateCandidate(e, v)) {
          if (Object.is(v, e.authored)) staged.delete(e.key); else staged.set(e.key, v);
        } else {
          staged.delete(e.key);
        }
      }
      refresh();
      refreshAffected(e.key);
    });
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        input.value = String(e.value);
        staged.delete(e.key);
        if (!Object.is(e.value, e.authored)) staged.set(e.key, e.value);
        refresh();
        refreshAffected(e.key);
      }
    });

    refresh();
    return { key: e.key, node, watches, refresh };
  }

  function consequenceLine(c: Consequence): HTMLElement {
    const line = el('div', `adm-cq${c.moved ? ' is-moved' : ''}`);
    if (c.kind === 'derived-fn') {
      line.append(
        Object.assign(el('b'), { textContent: c.key }),
        Object.assign(el('span', 'adm-cq-fn'), { textContent: `moves — ${c.formula}` }),
      );
      line.title = c.doc;
      return line;
    }
    line.append(Object.assign(el('b'), { textContent: c.key }));
    line.append(Object.assign(el('span', 'adm-num'), { textContent: fmt(c.live) }));
    if (c.moved) {
      line.append(Object.assign(el('span', 'adm-cq-arrow'), { textContent: '→' }));
      line.append(Object.assign(el('span', 'adm-num'), { textContent: fmt(c.next) }));
    }
    if (c.unit) line.append(Object.assign(el('span'), { textContent: c.unit }));
    line.title = `${c.formula}${c.doc ? ` — ${c.doc}` : ''}`;
    return line;
  }

  function makeDerivedRow(e: DerivedEntry | DerivedFnEntry): Row {
    const node = el('div', 'adm-drow');
    node.dataset.key = e.key;

    const keyCell = el('div', 'adm-key');
    keyCell.append(Object.assign(el('span', 'adm-lock'), { textContent: 'derived' }));
    keyCell.append(document.createTextNode(e.key));
    keyCell.append(Object.assign(el('span', 'adm-doc'), { textContent: e.doc }));

    const unit = el('div', 'adm-unit adm-num', e.unit || '·');
    const value = el('div', 'adm-cell adm-num is-live');
    const from = el('div', 'adm-from');

    function refresh(): void {
      if (e.kind === 'derived') {
        const next = (() => {
          try { return resolveFor(e.key); } catch { return null; }
        })();
        value.textContent = fmt(e.value);
        value.title = 'what the sim is running';
        if (next !== null && Math.abs(next - e.value) > 1e-12) {
          value.textContent = `${fmt(e.value)} → ${fmt(next)}`;
          value.classList.add('adm-cq');
          node.classList.add('is-staged');
        } else {
          value.classList.remove('adm-cq');
          node.classList.remove('is-staged');
        }
      } else {
        value.textContent = 'fn';
        value.title = 'a function of run-time arguments, not of constants alone';
      }
      from.innerHTML = '';
      const formula = e.kind === 'derived' ? e.formula : `${e.where}(${e.args.join(', ')})`;
      from.append(Object.assign(el('code'), { textContent: formula }));
      from.append(document.createTextNode('  from '));
      e.inputs.forEach((i, idx) => {
        if (idx) from.append(document.createTextNode(', '));
        from.append(Object.assign(el('code'), { textContent: i }));
      });
    }

    node.append(keyCell, unit, value, from);
    refresh();
    return { key: e.key, node, watches: [e.key], refresh };
  }

  /**
   * The derived section's own recompute.
   *
   * ⚠️ Exactly the same call the consequence column makes — `model.ts:resolveValue`,
   * which walks the chain and calls the registry's own lambdas. Written as one line so
   * there is visibly no second implementation: a derived value shown in the read-only
   * table and the same value shown as a consequence under a field MUST be the same
   * number, and the only way to guarantee that is for them to be the same function.
   * A fresh `candidates()` per call is deliberate — a cached memo could outlive an edit.
   */
  function resolveFor(key: string): number {
    return resolveValue(key, candidates());
  }

  // ── sheets ────────────────────────────────────────────────────────────────
  let sheet: HTMLElement | null = null;

  function closeSheet(): void {
    sheet?.remove();
    sheet = null;
  }

  function openSheet(mode: 'export' | 'import'): void {
    closeSheet();
    const wrap = el('div', 'adm-sheet');
    const card = el('div', 'adm-sheet-card');
    const h = el('h2', undefined, mode === 'export' ? 'Export override set' : 'Import override set');
    const note = el('div', 'adm-note');
    const ta = el('textarea', 'adm-ta');
    ta.spellcheck = false;
    const msg = el('div', 'adm-err');
    const actions = el('div', 'adm-sheet-row');

    if (mode === 'export') {
      const envelope = buildEnvelope(staged);
      ta.value = JSON.stringify(envelope, null, 2);
      ta.readOnly = true;
      note.textContent =
        'This is the STAGED set, stamped with the hash it will produce. The same JSON drives the '
        + 'Node gates: FA_TUNING="$(cat set.json)" node src/game/sim.test.mjs — which is how a '
        + 'balance number gets quoted with the constant set that produced it (§76 constraint 3).';
      actions.append(button('Copy', '', () => {
        ta.select();
        try { document.execCommand('copy'); msg.className = 'adm-note'; msg.textContent = 'copied'; }
        catch { msg.className = 'adm-err'; msg.textContent = 'copy refused — select the text and copy manually'; }
      }));
      actions.append(button('Download .json', '', () => {
        const blob = new Blob([ta.value], { type: 'application/json' });
        const a = el('a');
        a.href = URL.createObjectURL(blob);
        a.download = `fa-tuning-${envelope.tuningHash}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }));
    } else {
      note.textContent =
        'Paste a set exported from here, or any JSON object of key → number. Every key is checked '
        + 'against the registry and its band before anything is staged; one bad key refuses the whole '
        + 'set rather than silently dropping it.';
      actions.append(button('Load into staging', 'adm-btn--primary', () => {
        const parsed = parseImported(ta.value);
        if ('error' in parsed) { msg.className = 'adm-err'; msg.textContent = parsed.error; return; }
        staged.clear();
        for (const [k, v] of parsed.staged) staged.set(k, v);
        bad.clear();
        closeSheet();
        renderTab();
      }));
    }
    actions.append(button('Close', '', closeSheet));

    card.append(h, note, ta, msg, actions);
    wrap.append(card);
    wrap.addEventListener('click', (ev) => { if (ev.target === wrap) closeSheet(); });
    root.append(wrap);
    sheet = wrap;
    ta.focus();
    if (mode === 'export') ta.select();
  }

  // ── actions ───────────────────────────────────────────────────────────────

  function apply(): void {
    if (bad.size > 0) return;
    try {
      persistStagedSet(staged);
    } catch (err) {
      window.alert(`Could not save: ${String((err as Error)?.message ?? err)}`);
      return;
    }
    window.location.reload();
  }

  function resetAll(): void {
    staged.clear();
    bad.clear();
    try { persistStagedSet(staged); } catch { /* reported by apply(); reset is best-effort */ }
    renderTab();
  }

  function bootStock(): void {
    // `?tuning=off` is checked by `store.ts:bootstrap` BEFORE any source is read, so this
    // is the way back in from a set that a later `min` narrowed out of legality.
    const url = new URL(window.location.href);
    url.searchParams.set('tuning', 'off');
    window.location.href = url.toString();
  }

  // ── notices ───────────────────────────────────────────────────────────────

  function storageProblems(): HTMLElement[] {
    const out: HTMLElement[] = [];
    if (stored.problem) {
      out.push(Object.assign(el('div', 'adm-empty'), {
        innerHTML: `<h2>The stored override set could not be fully read</h2><pre>${escapeHtml(stored.problem)}</pre>`,
      }));
    }
    if (stored.unknown.length) {
      out.push(Object.assign(el('div', 'adm-empty'), {
        innerHTML:
          '<h2>The stored set names keys this build does not have</h2>'
          + `<pre>${escapeHtml(stored.unknown.join('\n'))}</pre>`
          + '<p>They are shown rather than silently dropped, because a dropped override produces a '
          + 'measurement whose stamp says "tuned" and whose numbers are stock. Applying from this panel '
          + 'will remove them.</p>',
      }));
    }
    if (stored.derived.length) {
      out.push(Object.assign(el('div', 'adm-empty'), {
        innerHTML:
          '<h2>The stored set names DERIVED keys, which cannot be overridden</h2>'
          + `<pre>${escapeHtml(stored.derived.join('\n'))}</pre>`
          + '<p>registry.ts refuses these at boot and the type layer refuses them at compile time. '
          + 'They reached storage by hand.</p>',
      }));
    }
    return out;
  }

  function sourceWarning(source: string): HTMLElement {
    const n = el('div', 'adm-notice adm-notice--warn');
    n.innerHTML =
      `<h2>The live set came from <code>${escapeHtml(source)}</code>, not from this panel</h2>`
      + '<p>store.ts:bootstrap takes the FIRST non-empty source in the order '
      + 'globalThis.__FA_TUNING__ → localStorage → FA_TUNING. Anything saved here is written to '
      + 'localStorage, so while that earlier source is present it will be read and this panel will '
      + 'not take effect. Remove it, or use <code>?tuning=off</code> to boot stock.</p>';
    return n;
  }

  function selftestBanner(): HTMLElement {
    // ⚠️ `.adm-notice`, NOT `.adm-empty`. In the first capture of this panel the selftest
    // banner rendered in the error style, so a panel that was working perfectly announced
    // itself in red — a notice and a fault must not look the same.
    const n = el('div', 'adm-notice');
    n.innerHTML =
      '<h2>Selftest fixture is loaded</h2>'
      + '<p>?admin=selftest registered a synthetic <code>selftest.*</code> block into the live registry '
      + 'so this panel can be validated against values known in advance. These are not game constants. '
      + 'Reload without the parameter to see only the real registry.</p>';
    return n;
  }

  function economyPlaceholder(registered: number): HTMLElement {
    const n = el('div', 'adm-placeholder');
    n.append(Object.assign(el('div', 'adm-ph-tag'), { textContent: 'placeholder · partial' }));
    n.append(Object.assign(el('h2'), { textContent: 'Economy' }));
    n.append(Object.assign(el('p'), {
      textContent: registered > 0
        ? `The ${registered} progression constant(s) that economy/tuning.ts has registered are editable below, `
          + 'exactly like combat ones. What is still missing is the ECONOMY view of them — the derived '
          + 'consequences that make a payout number mean something.'
        : 'economy/tuning.ts has not registered any constant through the registry yet, so there is nothing '
          + 'to edit here. This tab exists now rather than later so it is obvious where those fields will land.',
    }));
    const list = el('ul', 'adm-ph-list');
    for (const [what, why] of [
      ['Payout per minute', 'It fell ~3.3x when the match clock moved and nothing noticed — §76 names it as the example of an economy consequence no number in a box can show.'],
      ['Trophy road pacing', 'Matches to each milestone at the current payout curve, so a payout edit prices itself in sessions rather than coins.'],
      ['Level-up cost curve', 'What a rarity multiplier does to time-to-max, against the store prices in economy/tuning.ts.'],
      ['Box drop expectation', 'The published rates against what a run of boxes actually returns — the shop is a compliance surface and has already shipped one stale promise.'],
    ]) {
      const li = el('li');
      li.append(Object.assign(el('b'), { textContent: what }), Object.assign(el('span'), { textContent: why }));
      list.append(li);
    }
    n.append(list);
    return n;
  }

  function analyticsPlaceholder(): HTMLElement {
    const n = el('div', 'adm-placeholder');
    n.append(Object.assign(el('div', 'adm-ph-tag'), { textContent: 'placeholder' }));
    n.append(Object.assign(el('h2'), { textContent: 'Analytics' }));
    n.append(Object.assign(el('p'), {
      textContent:
        'Nothing is collected today — the game writes no telemetry and this build ships no analytics '
        + 'transport, so there is deliberately no chart here rather than a chart of nothing. What this tab '
        + 'is reserved for, and what each one would need first:',
    }));
    const list = el('ul', 'adm-ph-list');
    for (const [what, why] of [
      ['Match outcomes by matchup', 'The sim already produces this offline (roster_table). Needs the results of REAL sessions, which means a store and a stamp — every row is meaningless without the tuning hash that produced it (§76 constraint 3).'],
      ['Session length & retention', 'Needs an event sink. None exists; adding one is a product decision, not a panel feature.'],
      ['Where players die', 'A heatmap over the arena. The sim emits the death event stream today; nothing persists it.'],
      ['Economy funnel', 'Coins in, coins out, boxes opened. Blocked on the same sink as the rest.'],
    ]) {
      const li = el('li');
      li.append(Object.assign(el('b'), { textContent: what }), Object.assign(el('span'), { textContent: why }));
      list.append(li);
    }
    n.append(list);
    return n;
  }

  // ── keyboard ──────────────────────────────────────────────────────────────

  const onKey = (ev: KeyboardEvent): void => {
    const target = ev.target as HTMLElement | null;
    const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
    if (ev.key === '/' && !typing) { ev.preventDefault(); search.focus(); search.select(); return; }
    if (ev.key === 'Escape' && sheet) { closeSheet(); return; }
    if (ev.key === 'Escape' && !typing && query) { query = ''; search.value = ''; renderTab(); return; }
    if (ev.altKey && ev.key >= '1' && ev.key <= '5') {
      const t = TABS[Number(ev.key) - 1];
      if (t) { ev.preventDefault(); setTab(t.id); }
      return;
    }
    if ((ev.metaKey || ev.ctrlKey) && ev.key === 'Enter' && !applyBtn.disabled) { ev.preventDefault(); apply(); }
  };
  window.addEventListener('keydown', onKey);

  // ── QA handle ─────────────────────────────────────────────────────────────

  window.__admin = {
    tab: () => activeTab,
    setTab,
    rowKeys: () => rows.map((r) => r.key),
    stagedCount: () => candidates().size,
    stage(key, v) {
      const input = root.querySelector<HTMLInputElement>(`.adm-row[data-key="${cssEscape(key)}"] .adm-input`);
      if (!input) throw new Error(`admin: no editable row for "${key}" on tab "${activeTab}"`);
      input.value = String(v);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    stagedHash: () => stagedHash(staged),
    liveHash: () => readout.liveHash,
    consequences(key) {
      const node = root.querySelector(`.adm-row[data-key="${cssEscape(key)}"] .adm-conseq`);
      if (!node) return [];
      return [...node.children].map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim());
    },
    badKeys: () => [...bad.keys()],
  };

  setTab(activeTab);

  return {
    root,
    dispose() {
      window.removeEventListener('keydown', onKey);
      delete window.__admin;
      closeSheet();
      root.remove();
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * The panel could not be built. Rendered LOUDLY rather than as an empty table.
 *
 * `CLAUDE.md` #6 again: an instrument that reports nothing and an instrument that finds
 * nothing must not look the same. A tuning panel with no rows is indistinguishable from a
 * tidy one at a glance, which is exactly how a vacuous guard survives.
 */
function renderUnavailable(root: HTMLElement, why: Unavailable, selftest: boolean): void {
  const box = el('div', 'adm-empty');
  box.append(Object.assign(el('h2'), { textContent: 'The tuning registry is not readable' }));
  box.append(Object.assign(el('pre'), { textContent: why.problem }));
  box.append(Object.assign(el('p'), { textContent: why.hint }));
  if (!selftest) {
    box.append(Object.assign(el('p'), {
      innerHTML:
        'To see and exercise this panel against a registry with known values, append '
        + '<code>&amp;admin=selftest</code> to the URL. That registers a synthetic '
        + '<code>selftest.*</code> block — see src/admin/selftest.ts for what each fixture entry '
        + 'is shaped to catch.',
    }));
  }
  box.append(Object.assign(el('p'), {
    innerHTML:
      'This is a status report, not a crash: the screen mounted, the registry answered, and the answer '
      + 'was that nothing has been registered. Wiring lives in <code>src/game/rules.ts</code> and '
      + '<code>src/game/economy/tuning.ts</code>, which declare their literals through '
      + '<code>registry.ts:tune()</code>.',
  }));
  root.append(box);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

/** `CSS.escape` is not in every webview this app targets, and a key contains dots. */
function cssEscape(s: string): string {
  const g = globalThis as { CSS?: { escape?: (v: string) => string } };
  if (typeof g.CSS?.escape === 'function') return g.CSS.escape(s);
  return s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

export { ADMIN_ENABLED };
