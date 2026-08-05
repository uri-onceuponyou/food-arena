#!/usr/bin/env node
/**
 * The regression guard for the `__screenReady` capture defect.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * `tools/tmp/settle.mjs` makes a correct capture POSSIBLE. It does not make an
 * incorrect one impossible: nothing stops the next edit — or the next agent — from
 * writing `await page.screenshot(...)` two lines under a `__screenReady` wait, which
 * is exactly the shape that produced a 3.7x contrast error and survived a whole
 * session because it is intermittent. A defect that is invisible in review and
 * intermittent at runtime needs a MACHINE check, not a convention.
 *
 * So this parses every tool in `tools/` and classifies it:
 *
 *   GUARDED    every screenshot goes through `captureSettled()` (which brackets the
 *              shutter with a paint check on both sides and refuses a flat frame),
 *              or the file only waits and does so through `settleScreen()`
 *   PARTIAL    imports `settle.mjs` but still has a raw `.screenshot()` somewhere
 *   EXPOSED    waits on `__screenReady`/`__previewReady` AND screenshots, with no
 *              paint condition anywhere in the file — the original defect, intact
 *   FLAG-ONLY  waits on the flag and reads the page but never captures. NOT safe:
 *              `getBoundingClientRect()` includes transforms, and `fa-screen-in`
 *              starts at `translateY(10px) scale(0.992)`. This is exactly the shape
 *              `menu_accept.mjs` had — no screenshot, and every tap-target and
 *              safe-area rect still read 0.8% small and 10px low.
 *   UNGUARDED  screenshots with no flag wait and no paint condition
 *   n/a        neither captures nor waits, so the defect cannot reach it
 *
 * The OWNED map below is the capture-integrity file set, and each entry carries the
 * requirement that file actually has to meet — a capture tool, a wait-only geometry
 * battery and a packet CONSUMER are three different obligations and one blanket
 * class would have to be loose enough to pass all three, which is how a guard stops
 * guarding. **Any owned file failing its own requirement fails this audit**, so the
 * fix cannot be quietly unpicked. Everything outside it is reported and ranked but
 * not enforced, because it belongs to other owners — `CLAUDE.md`'s one-owner-per-
 * file-set rule outranks tidiness here.
 *
 * ── Why it PARSES rather than greps ──────────────────────────────────────────
 * `docs/LESSONS.md` §9: lint a language by parsing it. Grepping for `screenshot`
 * matches seven comments in `menu_accept.mjs` alone and would have reported the
 * fixed file as broken — a false positive in a guard is how guards get switched off.
 * `typescript` is already a dependency and `ts.createSourceFile` parses `.mjs`
 * directly, so this is a real AST walk with no new package.
 *
 * ── Known-input validation ───────────────────────────────────────────────────
 * `--selftest` runs the classifier over seven synthetic files whose answers are
 * known — including the exact defect shape, the fixed shape, and a comments-only
 * file that a grep WOULD flag — and then the three role requirements against inputs
 * that must be refused and inputs that must not. An audit nobody has proved can FAIL
 * is not evidence of anything (`docs/LESSONS.md` §13).
 *
 * Usage:
 *   node tools/tmp/capture_audit.mjs              # audit, exit 1 if an owned file regressed
 *   node tools/tmp/capture_audit.mjs --selftest   # prove the classifier on known input
 *   node tools/tmp/capture_audit.mjs --all        # also list the n/a files
 */

import ts from 'typescript';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(process.argv[1], '../../..');

/**
 * The capture-integrity file set, each with the obligation it actually has.
 *
 *   capture   shoots pixels     -> zero raw `.screenshot()`, >=1 `captureSettled()`
 *   geometry  reads rects only  -> imports settle.mjs, >=1 settle call, zero raw shots
 *   consumer  reads PNGs off disk -> must import the floor and read the provenance
 *                                    sidecar, because it is the last gate before a
 *                                    ~300k-token critic round
 *
 * `settle.mjs` is the implementation and is exempt from its own rule; it and the
 * validator are listed below so a rename shows up as a missing file rather than
 * silently emptying the audit.
 */
const OWNED = {
  'tools/review.mjs': 'consumer',
  'tools/shoot.mjs': 'capture',
  'tools/tmp/menu_accept.mjs': 'geometry',
  'tools/tmp/menu_accept_portrait.mjs': 'geometry',
  'tools/tmp/screen_metrics.mjs': 'capture',
  'tools/tmp/home_metrics.mjs': 'capture',
  'tools/tmp/chars_metrics.mjs': 'capture',

  // ── The follow-through set, added after the seven above were green ──────────
  // The first pass could only REPORT these ("34 exposed files elsewhere"), because they
  // belonged to other owners at the time. They have been fixed one at a time, each with
  // the reason written at the call site, so they are enforced now — a file that is
  // merely correct today is not a guard, and this list is the only thing that makes an
  // unpicking show up as a failure rather than as a line in a report nobody reads.
  //
  // The roles are NOT interchangeable and were chosen per file, not applied in bulk:
  'tools/tmp/journey.mjs': 'capture',        // the e2e harness; 6 capture sites, 7 flag waits
  'tools/tmp/e2e_boot_probe.mjs': 'capture', // a validator: its EARLY shot is annotated, its late one guarded
  'tools/tmp/shop_accept.mjs': 'capture',    // 168 assertions incl. tap-target and safe-area rects
  'tools/tmp/name_accept.mjs': 'geometry',   // captures nothing, but clicks and types on a moving screen
  'tools/match-play.mjs': 'capture',         // drives menus -> match and shoots both
  'tools/filmstrip.mjs': 'capture',          // preview.html has no shell; the FLAT-FRAME floor is the live guard
  'tools/aspect.mjs': 'capture',             // the 0.00wu number never needed it; the optional PNG did
  'tools/tmp/rarity_aa.mjs': 'capture',      // per-rarity WCAG, built for the badge follow-through
};

/** Does this file meet the obligation its role carries? Returns null or the reason. */
function violation(role, r) {
  if (role === 'capture') {
    if (r.rawShots.length) return `raw .screenshot() at line(s) ${r.rawShots.join(',')}`;
    if (r.guardCalls === 0) return 'captures nothing through captureSettled() — did the guard get removed?';
    return null;
  }
  if (role === 'geometry') {
    if (r.rawShots.length) return `raw .screenshot() at line(s) ${r.rawShots.join(',')}`;
    if (!r.importsSettle) return 'does not import tools/tmp/settle.mjs';
    if (r.settleCalls === 0) return 'imports settle.mjs but never calls it — rects are read mid-animation';
    if (r.flagWaits > r.settleCalls) {
      return `${r.flagWaits} flag wait(s) against only ${r.settleCalls} settle call(s)`;
    }
    return null;
  }
  if (role === 'consumer') {
    if (!r.importsSettle) return 'does not import the frame floor from tools/tmp/settle.mjs';
    if (!r.readsSidecar) return 'never reads <png>.capture.json — provenance is not checked';
    return null;
  }
  return null;
}
const IMPLEMENTATION = ['tools/tmp/settle.mjs'];

/**
 * Files that capture deliberately-unsettled frames as their SUBJECT. Excluding them
 * is not an exemption from the rule — they import `settle.mjs` and call the guard
 * with `enforce:false` on purpose, which is the documented escape hatch.
 */
const VALIDATORS = ['tools/tmp/settle_validate.mjs'];

/** A `_before_*` file is a frozen pre-change copy kept for A/B. Never audited. */
const isBeforeCopy = (rel) => /(^|\/)_before_/.test(rel);

// ── The classifier ───────────────────────────────────────────────────────────

/**
 * Walk one file's AST and count the four things that decide its class.
 *
 * `allowLine` is the escape hatch: a `// capture-audit: allow <reason>` comment on
 * the screenshot's own line or the line above marks a raw capture as deliberate. It
 * has to be written down next to the call, where a reviewer sees it.
 */
export function classify(source, name = 'x.mjs') {
  const sf = ts.createSourceFile(name, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  const lines = source.split('\n');
  const allowed = new Set();
  lines.forEach((l, i) => {
    if (/capture-audit:\s*allow/.test(l)) { allowed.add(i); allowed.add(i + 1); }
  });

  const found = {
    rawShots: [],        // `.screenshot()` calls not routed through the guard
    guardCalls: 0,       // `captureSettled(...)`
    settleCalls: 0,      // `settleScreen(...)` / a local wrapper
    flagWaits: 0,        // waitForFunction on __screenReady / __previewReady
    importsSettle: false,
    readsSidecar: false, // mentions the `<png>.capture.json` provenance record
    parseError: null,
  };
  if (/capture\.json/.test(source)) found.readsSidecar = true;
  for (const d of sf.parseDiagnostics ?? []) {
    found.parseError = ts.flattenDiagnosticMessageText(d.messageText, ' ');
    break;
  }

  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;

  const walk = (node) => {
    if (ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier)
      && /settle\.mjs$/.test(node.moduleSpecifier.text)) {
      found.importsSettle = true;
    }
    if (ts.isCallExpression(node)) {
      const c = node.expression;
      // `x.screenshot(...)` — the raw capture.
      if (ts.isPropertyAccessExpression(c) && c.name.text === 'screenshot') {
        const line = lineOf(node);
        if (!allowed.has(line)) found.rawShots.push(line + 1);
      }
      // `captureSettled(...)` / `settleScreen(...)`, bare or namespaced.
      const callee = ts.isIdentifier(c) ? c.text
        : (ts.isPropertyAccessExpression(c) ? c.name.text : null);
      if (callee === 'captureSettled') found.guardCalls++;
      if (callee === 'settleScreen' || callee === 'atScreen' || callee === 'settle') found.settleCalls++;
      // `waitForFunction('... __screenReady ...')` — the flag wait, in either the
      // string form or the arrow form.
      if (callee === 'waitForFunction' && node.arguments.length) {
        const a = node.arguments[0];
        const text = a.getText(sf);
        if (/__screenReady|__previewReady/.test(text)) found.flagWaits++;
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);

  let cls;
  if (found.parseError) cls = 'PARSE-ERROR';
  else if (found.rawShots.length > 0 && found.importsSettle) cls = 'PARTIAL';
  else if (found.rawShots.length > 0 && found.flagWaits > 0) cls = 'EXPOSED';
  else if (found.rawShots.length > 0) cls = 'UNGUARDED';
  else if (found.guardCalls > 0 || (found.settleCalls > 0 && found.importsSettle)) cls = 'GUARDED';
  // No capture at all, but it waits on the flag and then reads the page. Rects
  // include transforms, so this is exposed too — it is the shape menu_accept had.
  else if (found.flagWaits > 0) cls = 'FLAG-ONLY';
  else cls = 'n/a';
  return { ...found, cls };
}

// ── Known-input selftest ─────────────────────────────────────────────────────

const FIXTURES = [
  {
    name: 'the defect, verbatim',
    want: 'EXPOSED',
    src: `
      import { chromium } from 'playwright';
      const page = await (await chromium.launch()).newPage();
      await page.waitForFunction('window.__screenReady === true', null, { timeout: 45000 });
      await page.waitForTimeout(250);
      await page.screenshot({ path: 'shot.png' });
    `,
  },
  {
    name: 'the fix',
    want: 'GUARDED',
    src: `
      import { settleScreen, captureSettled } from './settle.mjs';
      await page.waitForFunction('window.__screenReady === true', null, { timeout: 45000 });
      await settleScreen(page, { label: 'home' });
      await captureSettled(page, { path: 'shot.png', label: 'home' });
    `,
  },
  {
    name: 'half-fixed — imports the guard, still shoots raw',
    want: 'PARTIAL',
    src: `
      import { settleScreen, captureSettled } from './settle.mjs';
      await settleScreen(page);
      await captureSettled(page, { path: 'a.png' });
      await page.screenshot({ path: 'b.png' });
    `,
  },
  {
    name: 'comments only — must NOT count as a capture (grep would)',
    want: 'FLAG-ONLY',
    src: `
      // A dead control is invisible to a screenshot, so it is asserted here.
      /* every later screenshot sees this */
      await page.waitForFunction('window.__screenReady === true');
    `,
  },
  {
    name: 'no capture, no flag — genuinely out of scope',
    want: 'n/a',
    src: `
      // A pure sim probe. Never opens a browser.
      import { stepMatch } from '../../src/game/sim.js';
      console.log(stepMatch());
    `,
  },
  {
    name: 'geometry battery, unfixed (menu_accept before)',
    want: 'FLAG-ONLY',
    src: `
      await page.waitForFunction('window.__previewReady === true', null, { timeout: 45000 });
      await page.waitForTimeout(250);
      const r = await page.evaluate(() => document.querySelector('button').getBoundingClientRect());
    `,
  },
  {
    name: 'annotated escape hatch',
    want: 'GUARDED',
    src: `
      import { captureSettled } from './settle.mjs';
      // capture-audit: allow — deliberately captures the unsettled frame as its subject
      const early = await page.screenshot();
      await captureSettled(page, { path: 'late.png' });
    `,
  },
];

/** The role requirements, also on known input — a rule nobody has seen FAIL is not a rule. */
const ROLE_FIXTURES = [
  {
    name: 'capture role: raw shot is a violation',
    role: 'capture', wantViolation: true,
    src: "import { captureSettled } from './settle.mjs';\nawait captureSettled(page, {});\nawait page.screenshot();",
  },
  {
    name: 'capture role: guard-only is clean',
    role: 'capture', wantViolation: false,
    src: "import { captureSettled } from './settle.mjs';\nawait captureSettled(page, { path: 'a.png' });",
  },
  {
    name: 'geometry role: more flag waits than settles is a violation',
    role: 'geometry', wantViolation: true,
    src: "import { settleScreen } from './settle.mjs';\n"
      + "await page.waitForFunction('window.__screenReady === true');\nawait settleScreen(page);\n"
      + "await page.waitForFunction('window.__screenReady === true');\n"
      + "await page.waitForFunction('window.__screenReady === true');",
  },
  {
    name: 'geometry role: one settle per flag wait is clean',
    role: 'geometry', wantViolation: false,
    src: "import { settleScreen } from './settle.mjs';\n"
      + "await page.waitForFunction('window.__screenReady === true');\nawait settleScreen(page);",
  },
  {
    name: 'consumer role: no sidecar read is a violation',
    role: 'consumer', wantViolation: true,
    src: "import { frameStats } from './tmp/settle.mjs';\nconst s = await frameStats(png);",
  },
  {
    name: 'consumer role: floor + provenance is clean',
    role: 'consumer', wantViolation: false,
    src: "import { frameStats, FRAME_FLOOR } from './tmp/settle.mjs';\n"
      + "const s = await frameStats(png);\nconst side = `${png}.capture.json`;",
  },
];

if (process.argv.includes('--selftest')) {
  let pass = 0; let fail = 0;
  const t = (name, ok, detail) => {
    if (ok) pass++; else fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(58)} ${detail}`);
  };
  console.log('── capture_audit selftest: the classifier against known inputs ──\n');
  for (const f of FIXTURES) {
    const got = classify(f.src, 'fixture.mjs').cls;
    t(f.name, got === f.want, `want ${f.want.padEnd(9)} got ${got}`);
  }
  console.log('\n── and the role requirements ──\n');
  for (const f of ROLE_FIXTURES) {
    const v = violation(f.role, classify(f.src, 'fixture.mjs'));
    t(f.name, (!!v) === f.wantViolation, v ? `refused: ${v.slice(0, 44)}` : 'clean');
  }
  console.log(`\n${pass}/${pass + fail} classifier checks passed`);
  process.exit(fail ? 1 : 0);
}

// ── The audit ────────────────────────────────────────────────────────────────

async function listTools(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await listTools(p));
    else if (e.name.endsWith('.mjs')) out.push(p);
  }
  return out;
}

const files = (await listTools(join(ROOT, 'tools'))).sort();
const rows = [];
for (const abs of files) {
  const rel = relative(ROOT, abs);
  if (isBeforeCopy(rel)) continue;
  if (IMPLEMENTATION.includes(rel) || VALIDATORS.includes(rel)) continue;
  const r = classify(await readFile(abs, 'utf8'), rel);
  const role = OWNED[rel] ?? null;
  rows.push({ rel, ...r, role, owned: !!role, violation: role ? violation(role, r) : null });
}

const showAll = process.argv.includes('--all');
const interesting = rows.filter((r) => showAll || r.cls !== 'n/a');

const w = Math.max(...interesting.map((r) => r.rel.length), 10);
console.log('── capture audit ───────────────────────────────────────────────────────────');
console.log(`${'file'.padEnd(w)}  own  class      shots  guarded  settles  flagWaits  raw@lines`);
for (const r of interesting.sort((a, b) => (a.owned === b.owned ? a.rel.localeCompare(b.rel) : (a.owned ? -1 : 1)))) {
  console.log(
    `${r.rel.padEnd(w)}  ${r.owned ? ' * ' : '   '}  ${r.cls.padEnd(9)}`
    + `  ${String(r.rawShots.length).padStart(5)}  ${String(r.guardCalls).padStart(7)}`
    + `  ${String(r.settleCalls).padStart(7)}  ${String(r.flagWaits).padStart(9)}`
    + `  ${r.rawShots.slice(0, 6).join(',')}`,
  );
}

const ownedRows = rows.filter((r) => r.owned);
const missing = Object.keys(OWNED).filter((o) => !rows.some((r) => r.rel === o));
const bad = ownedRows.filter((r) => r.violation);

console.log('\n── owned set: each against its OWN obligation ───────────────────────────────');
for (const r of ownedRows.sort((a, b) => a.rel.localeCompare(b.rel))) {
  console.log(`  ${r.violation ? 'FAIL' : 'OK  '}  ${r.rel.padEnd(36)} role=${r.role.padEnd(9)} ${r.cls.padEnd(10)}`
    + `${r.violation ? ` <- ${r.violation}` : ''}`);
}
for (const m of missing) console.log(`  FAIL  ${m}  (MISSING — renamed or deleted)`);

const exposed = rows.filter((r) => !r.owned && (r.cls === 'EXPOSED' || r.cls === 'PARTIAL' || r.cls === 'FLAG-ONLY'));
if (exposed.length) {
  console.log('\n── still exposed, OUTSIDE this file set (reported, not enforced) ───────────');
  console.log('   These wait on a ready flag and screenshot with no paint condition. They are');
  console.log('   other owners\' files; the fix is a two-line import of tools/tmp/settle.mjs.');
  for (const r of exposed.sort((a, b) => b.rawShots.length - a.rawShots.length)) {
    console.log(`   ${r.cls.padEnd(8)} ${r.rel}  (${r.rawShots.length} raw shot(s), ${r.flagWaits} flag wait(s))`);
  }
}

const failed = bad.length + missing.length;
console.log(`\n${ownedRows.length - bad.length}/${Object.keys(OWNED).length} owned files meet their obligation`
  + `   ·   ${exposed.length} file(s) exposed elsewhere`);
process.exit(failed ? 1 : 0);
