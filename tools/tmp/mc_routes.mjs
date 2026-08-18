#!/usr/bin/env node
/**
 * THE MENU BATTERY'S SCREEN LIST, DERIVED FROM THE ROUTER INSTEAD OF TYPED.
 *
 * ── The defect this exists for ──────────────────────────────────────────────
 * `menu_accept.mjs` and `menu_accept_portrait.mjs` each carried a hand-written
 * `['opening', 'home', 'characters', 'trophies', 'shop', 'settings']`. `lobby` shipped
 * in `2d4840e` (2026-08-12) and `admin` in `eb3e44d` (2026-08-17) and **neither joined
 * either battery**, because a screen does not join a gate by EXISTING — somebody has to
 * edit a list, and nothing tells them to. The biggest gate in the repo was two screens
 * behind reality and every run of it was green.
 *
 * That is the same shape as `a11dab7`, where eleven hand-written copies of one module
 * list drifted at once. The fix there was the fix here: **stop typing the list.**
 *
 * ── AND THERE ARE THREE COPIES IN `src/`, NOT ONE ───────────────────────────
 * Measured on this tree, all three hand-maintained, none of them checked against each
 * other by anything until this file:
 *
 *   1. `src/ui/screens/types.ts`   `type Route` — the union. The SOURCE OF TRUTH:
 *                                  `RouteName = Route['name']`, and `shell.ts:build()`'s
 *                                  switch is exhaustive over it.
 *   2. `src/ui/screens/shell.ts`   `ROUTE_NAMES` — what `parseRoute` will accept off
 *                                  `history.state` or a hand-edited address bar.
 *   3. `src/main.ts`               `bootRoute`'s `?screen=` ladder — **the one that
 *                                  decides whether a battery's own navigation works.**
 *
 * `shell.ts`'s own header says of (2) and (3): *"the two have to be added to together —
 * it went stale once already."* So the drift is known, documented, and had no guard.
 *
 * 🚨 **AND (3) FAILS SILENTLY AND PLAUSIBLY.** An unknown `?screen=` value is not an
 * error: `bootRoute` falls through to `return { name: 'opening' }`. So a screen that is
 * in the union and in `ROUTE_NAMES` but missing from the ladder mounts the TITLE CARD,
 * `__previewReady` fires, every assertion runs, and the battery reports a green
 * `lobby` row measured on `opening`. That is the `valuescan` failure exactly — *"a
 * passing test is not evidence that the thing it points at is right"* — and `main.ts`'s
 * own comment names it: *"the trap that once made a capture labelled `home`
 * photograph a different screen entirely."*
 * → Both halves are guarded: this file reconciles the three lists STATICALLY, and the
 *   batteries assert `window.__screen` is the screen they asked for at RUNTIME. Neither
 *   subsumes the other — the static check names the file to fix, the runtime check is
 *   the one that cannot be fooled by a fourth copy nobody has found yet.
 *
 * ── WHAT WAS PRICED, AND WHY DERIVING WON ───────────────────────────────────
 * Hand-written costs 0 lines and has a measured failure rate of 2 screens in 5 days.
 * Deriving costs this file (~1 dependency, `typescript`, which both batteries already
 * import for their own lints) and moves the default: a new screen is IN unless someone
 * writes down why it is out. The exclusion list is still hand-written — that is
 * unavoidable, because `match` is genuinely not a menu — but forgetting it now produces
 * a LOUD failure (a screen that will not mount) instead of a silent gap.
 *
 * ⚠️ **An exclusion is itself a place to go stale, so exclusions are validated.** A
 * reason keyed to a route that no longer exists is a filter over an empty set, which is
 * `CLAUDE.md` non-negotiable #6's vacuity class — `[].every()` is `true`. Every key in
 * `MENU_EXCLUSIONS` must name a live route or `routeChecks()` fails.
 *
 * ── WHICH TREE IS READ ──────────────────────────────────────────────────────
 * `SNAPSHOT_DIR` when set (every `with_snapshot` / `sx_snap` child gets it), else the
 * cwd. That matters: the browser measures the SNAPSHOT, so the list must come from the
 * snapshot too. Reading the working tree while measuring a frozen worktree would
 * navigate to screens the served build does not have.
 *
 * Usage:
 *   import { menuScreens, routeChecks } from './mc_routes.mjs';
 *   node tools/tmp/mc_routes.mjs            # print the derivation
 *   node tools/tmp/mc_routes.mjs --selftest # the parsers, against known-bad sources
 */

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/** The tree the browser is being served from, when there is one. See the header. */
export const SOURCE_ROOT = process.env.SNAPSHOT_DIR ?? '.';

let TS = null;
async function typescript() {
  if (!TS) TS = (await import('typescript')).default;
  return TS;
}

async function parseFile(root, rel) {
  const ts = await typescript();
  const path = `${root}/${rel}`;
  const src = await readFile(path, 'utf8');
  return { ts, path, sf: ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS) };
}

// ─────────────────────────────────────────────────────────────────────────────
// The three parsers. Each takes (ts, sourceFile) so the selftest can drive them
// from a string — a parser that can only be run against the real tree cannot be
// shown to FAIL, and a guard not shown to fail is not a guard.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every `{ name: '…' }` member of `type Route`, in declaration order.
 *
 * `opaque` is the anti-silent-narrowing half and it is the important one: a union
 * member this cannot read a string literal out of (`| { name: RouteName }`, `| SomeAlias`)
 * is REPORTED rather than skipped. Skipping would shrink the battery's screen list
 * without anything going red, which is the exact failure this whole file is about.
 */
export function routeUnionFrom(ts, sf) {
  let alias = null;
  ts.forEachChild(sf, (n) => {
    if (ts.isTypeAliasDeclaration(n) && n.name.text === 'Route') alias = n;
  });
  if (!alias) return { names: [], opaque: ['<no `type Route` alias in this file>'] };
  const members = ts.isUnionTypeNode(alias.type) ? alias.type.types : [alias.type];
  const names = [];
  const opaque = [];
  for (const m of members) {
    let got = null;
    if (ts.isTypeLiteralNode(m)) {
      for (const p of m.members) {
        if (ts.isPropertySignature(p) && p.name && ts.isIdentifier(p.name) && p.name.text === 'name'
          && p.type && ts.isLiteralTypeNode(p.type) && ts.isStringLiteral(p.type.literal)) {
          got = p.type.literal.text;
        }
      }
    }
    if (got !== null) names.push(got);
    else opaque.push(m.getText(sf).replace(/\s+/g, ' ').slice(0, 48));
  }
  return { names, opaque };
}

/**
 * `shell.ts:ROUTE_NAMES`, split into unconditional entries and entries behind a build
 * flag (`...(ADMIN_ENABLED ? ['admin'] : [])`).
 *
 * The split is not decoration: a conditional name is one the battery can only reach in
 * a build that enables it, which is why `admin` gets a reachability record of its own
 * rather than being assumed present.
 */
export function shellRouteNamesFrom(ts, sf) {
  let arr = null;
  const visit = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)
      && n.name.text === 'ROUTE_NAMES' && n.initializer) arr = n.initializer;
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, visit);
  if (!arr || !ts.isArrayLiteralExpression(arr)) return { always: [], conditional: [], found: false };
  const always = [];
  const conditional = [];
  for (const el of arr.elements) {
    if (ts.isStringLiteral(el)) { always.push(el.text); continue; }
    // A spread of a conditional array, or anything else with literals inside it.
    const walk = (n) => {
      if (ts.isStringLiteral(n)) conditional.push(n.text);
      ts.forEachChild(n, walk);
    };
    walk(el);
  }
  return { always, conditional, found: true };
}

/**
 * Every literal `?screen=` value `main.ts` compares against, plus the route its
 * fallback `return` produces.
 *
 * The fallback is PARSED rather than typed here, because it is the value every
 * unrecognised `?screen=` lands on and hardcoding it would put a fourth copy of the
 * router's behaviour in the guard against copies of the router's behaviour.
 */
export function mainLadderFrom(ts, sf) {
  const accepted = new Set();
  let fallback = null;
  const isScreenGet = (n) => ts.isCallExpression(n)
    && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'get'
    && n.arguments.length === 1 && ts.isStringLiteral(n.arguments[0])
    && n.arguments[0].text === 'screen';
  const routeNameOf = (expr) => {
    if (!expr || !ts.isObjectLiteralExpression(expr)) return null;
    for (const p of expr.properties) {
      if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'name'
        && ts.isStringLiteral(p.initializer)) return p.initializer.text;
    }
    return null;
  };
  let boot = null;
  const findBoot = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === 'bootRoute') boot = n;
    ts.forEachChild(n, findBoot);
  };
  ts.forEachChild(sf, findBoot);
  if (!boot) return { accepted: [], fallback: null, found: false };

  const visit = (n) => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
      && ts.isStringLiteral(n.right) && isScreenGet(n.left)) accepted.add(n.right.text);
    ts.forEachChild(n, visit);
  };
  visit(boot);

  // The last statement of the body that is a bare `return { … }` — the ladder's floor.
  for (const st of boot.body?.statements ?? []) {
    if (ts.isReturnStatement(st)) {
      const nm = routeNameOf(st.expression);
      if (nm) fallback = nm;
    }
  }
  return { accepted: [...accepted], fallback, found: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// The exclusions — the only hand-written list left, and it is validated
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Routes the MENU batteries deliberately do not iterate, each with the reason.
 *
 * 🚨 **An unexamined exclusion is the thing this file was written to abolish**, so a key
 * here has to earn its place and is asserted to name a live route. Adding a screen to
 * this map is a decision; forgetting to add a screen to the battery no longer is.
 */
export const MENU_EXCLUSIONS = {
  match: 'not a menu — a live WebGL match with its own HUD. `shell.ts` deliberately does '
    + 'NOT set `__previewReady` for it (the match sets it from its own first frame), so '
    + 'the menu loop\'s own wait would hang. It is covered instead by menu_accept\'s flow '
    + 'section (canvas input, pause, quit) and by menu_accept_portrait\'s auditHud().',
};

/**
 * Routes that exist only in some builds. Reached when present, RECORDED as unreachable
 * when not — never silently skipped.
 *
 * `admin` is `import.meta.env.DEV || VITE_FA_ADMIN=1` (`src/admin/gate.ts`). Every
 * snapshot this battery is pointed at is a Vite DEV server (`tools/snapshot.mjs` spawns
 * `vite`), so it is reachable in practice — but a run against a production preview must
 * say so rather than measure the title card and call it `admin`.
 */
export const CONDITIONAL_SCREENS = { admin: 'src/admin/gate.ts: DEV || VITE_FA_ADMIN=1' };

// ─────────────────────────────────────────────────────────────────────────────

/** The three lists plus the derived menu screen order, read off `root`. */
export async function deriveRoutes(root = SOURCE_ROOT) {
  const a = await parseFile(root, 'src/ui/screens/types.ts');
  const b = await parseFile(root, 'src/ui/screens/shell.ts');
  const c = await parseFile(root, 'src/main.ts');
  const union = routeUnionFrom(a.ts, a.sf);
  const shell = shellRouteNamesFrom(b.ts, b.sf);
  const main = mainLadderFrom(c.ts, c.sf);
  const screens = union.names.filter((n) => !(n in MENU_EXCLUSIONS));
  return { root, union, shell, main, screens };
}

/** Just the ordered menu screen list — union order, minus the documented exclusions. */
export async function menuScreens(root = SOURCE_ROOT) {
  return (await deriveRoutes(root)).screens;
}

/**
 * The derivation, as assertions, for a battery to `record()`.
 *
 * Returned rather than printed so both batteries share one definition and one count.
 * ⚠️ Every one of these is an ordinary assertion with a named failing implementation —
 * `CLAUDE.md` #6's *"what implementation would fail this?"*:
 *   union-is-readable      a union member written as an alias instead of a literal
 *   union-covers-the-known a `Route` alias renamed or moved out of types.ts
 *   shell-agrees-with-type `ROUTE_NAMES` gaining or missing a name (its own header says
 *                          this has happened)
 *   url-ladder-covers      a route with no `?screen=` branch in `main.ts` — the silent
 *                          one, which mounts the title card and passes
 *   exclusions-are-live    a reason keyed to a route that no longer exists
 *   menu-list-is-non-empty the filter emptying the set it is filtered from
 */
export async function routeChecks(root = SOURCE_ROOT) {
  const out = [];
  const push = (check, ok, detail) => out.push({ check, ok, detail });
  let d;
  try {
    d = await deriveRoutes(root);
  } catch (err) {
    push('routes-derive', false, String(err.message ?? err).slice(0, 160));
    return { checks: out, screens: [] };
  }

  const { union, shell, main } = d;

  push('union-is-readable', union.opaque.length === 0,
    union.opaque.length ? `unreadable union members: ${union.opaque.join(' | ')}`
      : `${union.names.length} routes: ${union.names.join(' ')}`);

  // A floor plus a known member. The floor alone would pass on a list of the wrong
  // eight strings; the member alone would pass on a list of one.
  push('union-covers-the-known', union.names.length >= 8 && union.names.includes('home')
    && union.names.includes('match'), `${union.names.length} routes (>=8, incl. home + match)`);

  const shellAll = new Set([...shell.always, ...shell.conditional]);
  const missingInShell = union.names.filter((n) => !shellAll.has(n));
  const extraInShell = [...shellAll].filter((n) => !union.names.includes(n));
  push('shell-ROUTE_NAMES-agrees-with-the-union',
    shell.found && missingInShell.length === 0 && extraInShell.length === 0,
    shell.found
      ? `missing ${JSON.stringify(missingInShell)} extra ${JSON.stringify(extraInShell)}`
      : 'ROUTE_NAMES not found in shell.ts');

  // The silent one. `?screen=<unknown>` falls through to the fallback route, so a
  // route absent from the ladder is a route every `?screen=` probe measures as the
  // fallback while labelling it correctly.
  const noUrl = union.names.filter((n) => n !== 'match' && n !== main.fallback
    && !main.accepted.includes(n));
  push('every-route-has-a-?screen=-branch',
    main.found && main.fallback !== null && noUrl.length === 0,
    main.found
      ? `fallback=${main.fallback}; unreachable by URL: ${noUrl.length ? noUrl.join(' ') : 'none'}`
      : 'bootRoute not found in main.ts');

  const deadExclusions = Object.keys(MENU_EXCLUSIONS).filter((n) => !union.names.includes(n));
  const deadConditional = Object.keys(CONDITIONAL_SCREENS).filter((n) => !union.names.includes(n));
  push('exclusions-name-live-routes', deadExclusions.length === 0 && deadConditional.length === 0,
    [...deadExclusions, ...deadConditional].join(' ') || `${Object.keys(MENU_EXCLUSIONS).length} excluded, `
      + `${Object.keys(CONDITIONAL_SCREENS).length} conditional, all live`);

  // Assert the set is NON-EMPTY before anything iterates it (CLAUDE.md #6).
  push('menu-screen-list-is-non-empty', d.screens.length >= union.names.length - Object.keys(MENU_EXCLUSIONS).length
    && d.screens.length > 0, `${d.screens.length} screens: ${d.screens.join(' ')} (root ${d.root})`);

  return { checks: out, screens: d.screens };
}

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — every parser against a source carrying the defect it exists for
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURES = [
  {
    name: 'union-reads-every-literal-member',
    file: 'types.ts',
    src: "export type Route =\n  | { name: 'home' }\n  | { name: 'shop' }\n"
      + "  | { name: 'match'; player: CharacterId; enemy: CharacterId; seats?: number };\n",
    check: (ts, sf) => {
      const r = routeUnionFrom(ts, sf);
      return [r.names.join(','), r.opaque.length].join('|');
    },
    want: 'home,shop,match|0',
  },
  {
    name: 'union-REPORTS-a-member-it-cannot-read',
    // The silent-narrowing shape: an aliased member would drop out of the list and the
    // battery would quietly stop covering it. It must land in `opaque`, not vanish.
    file: 'types.ts',
    src: "export type Route =\n  | { name: 'home' }\n  | LegacyRoute\n  | { name: 'match' };\n",
    check: (ts, sf) => {
      const r = routeUnionFrom(ts, sf);
      return [r.names.join(','), r.opaque.length].join('|');
    },
    want: 'home,match|1',
  },
  {
    name: 'union-refuses-a-file-with-no-Route-alias',
    file: 'types.ts',
    src: "export type Screen = { name: 'home' };\n",
    check: (ts, sf) => {
      const r = routeUnionFrom(ts, sf);
      return [r.names.length, r.opaque.length].join('|');
    },
    want: '0|1',
  },
  {
    name: 'shell-splits-conditional-entries-from-plain-ones',
    file: 'shell.ts',
    src: "const ROUTE_NAMES: readonly string[] = [\n  'home', 'shop',\n"
      + "  ...(ADMIN_ENABLED ? ['admin'] : []),\n];\n",
    check: (ts, sf) => {
      const r = shellRouteNamesFrom(ts, sf);
      return [r.always.join(','), r.conditional.join(','), r.found].join('|');
    },
    want: 'home,shop|admin|true',
  },
  {
    name: 'shell-reports-a-missing-ROUTE_NAMES',
    file: 'shell.ts',
    src: "const OTHER = ['home'];\n",
    check: (ts, sf) => {
      const r = shellRouteNamesFrom(ts, sf);
      return String(r.found);
    },
    want: 'false',
  },
  {
    name: 'ladder-reads-the-?screen=-branches-and-the-fallback',
    file: 'main.ts',
    src: "function bootRoute(profile: PlayerProfile): Route {\n"
      + "  if (ADMIN_ENABLED && params.get('screen') === 'admin') return { name: 'admin' };\n"
      + "  if (params.get('screen') === 'lobby') return { name: 'lobby' };\n"
      + "  return { name: 'opening' };\n}\n",
    check: (ts, sf) => {
      const r = mainLadderFrom(ts, sf);
      return [r.accepted.sort().join(','), r.fallback].join('|');
    },
    want: 'admin,lobby|opening',
  },
  {
    name: 'ladder-does-NOT-count-a-branch-on-another-parameter',
    // `params.get('seats') === 'x'` is not a screen route. A parser that matched any
    // `.get(...)` would manufacture routes and hide a real gap under noise.
    file: 'main.ts',
    src: "function bootRoute(): Route {\n"
      + "  if (params.get('seats') === '6') return { name: 'match' };\n"
      + "  if (params.get('screen') === 'home') return { name: 'home' };\n"
      + "  return { name: 'opening' };\n}\n",
    check: (ts, sf) => {
      const r = mainLadderFrom(ts, sf);
      return [r.accepted.sort().join(','), r.fallback].join('|');
    },
    want: 'home|opening',
  },
];

/**
 * KNOWN-BAD END TO END, WITH ITS REPAIRED CONTROL.
 *
 * The reconciliation must go RED on the exact tree shape that shipped — a route in the
 * union and in `ROUTE_NAMES` with no `?screen=` branch, the failure that mounts the
 * title card and passes.
 *
 * ⚠️ **"the target check failed" is not enough and the first version of this only
 * asserted that.** On a three-line synthetic tree several unrelated checks fail too
 * (the >=8 floor, for one), so a reconciliation that simply failed EVERYTHING would have
 * read green — the `sentinel` MOVES property. Each fixture therefore ships a REPAIRED
 * arm differing in exactly the one file, and the target check must fail on the bad arm
 * and PASS on the good one.
 */
const RECONCILE_FIXTURES = [
  {
    name: 'reconcile-catches-a-route-with-no-URL-branch',
    types: "export type Route = { name: 'home' } | { name: 'lobby' } | { name: 'match' };",
    shell: "const ROUTE_NAMES: readonly string[] = ['home', 'lobby', 'match'];",
    main: "function bootRoute(): Route {\n  if (params.get('screen') === 'home') return { name: 'home' };\n"
      + "  return { name: 'opening' };\n}",
    repaired: {
      main: "function bootRoute(): Route {\n  if (params.get('screen') === 'home') return { name: 'home' };\n"
        + "  if (params.get('screen') === 'lobby') return { name: 'lobby' };\n"
        + "  return { name: 'opening' };\n}",
    },
    wantFail: 'every-route-has-a-?screen=-branch',
  },
  {
    name: 'reconcile-catches-ROUTE_NAMES-one-behind-the-union',
    types: "export type Route = { name: 'home' } | { name: 'lobby' };",
    shell: "const ROUTE_NAMES: readonly string[] = ['home'];",
    main: "function bootRoute(): Route {\n  if (params.get('screen') === 'home') return { name: 'home' };\n"
      + "  if (params.get('screen') === 'lobby') return { name: 'lobby' };\n"
      + "  return { name: 'opening' };\n}",
    repaired: { shell: "const ROUTE_NAMES: readonly string[] = ['home', 'lobby'];" },
    wantFail: 'shell-ROUTE_NAMES-agrees-with-the-union',
  },
  {
    name: 'reconcile-catches-a-union-member-it-cannot-read',
    types: "export type Route = { name: 'home' } | LegacyRoute;",
    shell: "const ROUTE_NAMES: readonly string[] = ['home'];",
    main: "function bootRoute(): Route {\n  if (params.get('screen') === 'home') return { name: 'home' };\n"
      + "  return { name: 'opening' };\n}",
    repaired: { types: "export type Route = { name: 'home' };" },
    wantFail: 'union-is-readable',
  },
];

export async function selftest() {
  const ts = await typescript();
  const rows = [];
  for (const f of FIXTURES) {
    const sf = ts.createSourceFile(f.file, f.src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    let got;
    try { got = String(f.check(ts, sf)); } catch (err) { got = `threw: ${err.message}`; }
    rows.push({ name: f.name, ok: got === f.want, detail: got === f.want ? got : `got ${got}, want ${f.want}` });
  }

  // The end-to-end arms run the real `routeChecks` reconciliation over synthetic trees,
  // each in a broken and a repaired arm — see RECONCILE_FIXTURES.
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const stage = async (f, over) => {
    const dir = await mkdtemp(join(tmpdir(), 'mc_routes-'));
    try {
      await mkdir(join(dir, 'src', 'ui', 'screens'), { recursive: true });
      await writeFile(join(dir, 'src', 'ui', 'screens', 'types.ts'), over.types ?? f.types);
      await writeFile(join(dir, 'src', 'ui', 'screens', 'shell.ts'), over.shell ?? f.shell);
      await writeFile(join(dir, 'src', 'main.ts'), over.main ?? f.main);
      const { checks } = await routeChecks(dir);
      return checks.filter((c) => !c.ok).map((c) => c.check);
    } finally {
      // This runs inside `menu_accept`'s battery now, so it must not litter one fixture
      // tree per run per fixture. `finally`, not a trailing call — and note that
      // `process.exit()` inside a `try` would SKIP it (docs/AGENT-BRIEF.md §3); nothing
      // here exits.
      await rm(dir, { recursive: true, force: true });
    }
  };
  for (const f of RECONCILE_FIXTURES) {
    const bad = await stage(f, {});
    const good = await stage(f, f.repaired);
    const ok = bad.includes(f.wantFail) && !good.includes(f.wantFail);
    rows.push({
      name: f.name,
      ok,
      detail: `bad: ${bad.join(', ') || 'NOTHING — the guard is blind'} || repaired: ${good.join(', ') || 'clean'}`,
    });
  }
  return rows;
}

// ── CLI. Guarded: importing this file must not run anything (AGENT-BRIEF §3). ──
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (process.argv.includes('--selftest')) {
    const rows = await selftest();
    for (const r of rows) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(52)} ${r.detail}`);
    const bad = rows.filter((r) => !r.ok).length;
    console.log(`\n${rows.length - bad}/${rows.length} mc_routes selftest checks passed`);
    process.exit(bad ? 1 : 0);
  } else {
    const d = await deriveRoutes();
    const { checks } = await routeChecks();
    console.log(`root                ${d.root}`);
    console.log(`types.ts union      ${d.union.names.join(' ')}`);
    console.log(`shell ROUTE_NAMES   ${d.shell.always.join(' ')}  [conditional: ${d.shell.conditional.join(' ') || 'none'}]`);
    console.log(`main.ts ?screen=    ${d.main.accepted.sort().join(' ')}  [fallback: ${d.main.fallback}]`);
    console.log(`menu screens        ${d.screens.join(' ')}`);
    console.log('');
    for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.check.padEnd(40)} ${c.detail}`);
    process.exit(checks.some((c) => !c.ok) ? 1 : 0);
  }
}
