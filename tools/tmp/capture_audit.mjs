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
 *   CSS-IMMUNE waits on the flag, but its verdict is something no CSS transform or
 *              opacity can reach — `gl.readPixels()` off the drawing buffer, a camera
 *              projection out of `window.__charStage()`, an offscreen-rendered data
 *              URI. `aspect.mjs`'s 0.00wu number is the canonical case. This class is
 *              CLAIMED by an annotation and then CHECKED: see below.
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
 * ── The `css-immune` annotation, and why it is not an opt-out ────────────────
 * Half of the flag-waiting files in `tools/` never touch a rect or a PNG: they wait
 * for the app to boot and then read `gl.readPixels()` off the WebGL drawing buffer,
 * which sits BELOW the CSS compositor, or an NDC projection out of the 3D camera,
 * which is computed from layout size and not from any transform. A blanket "settle
 * everything" would add a wait to a number the fade cannot move, and — worse — would
 * make the audit's exposed list a place where thirteen files sit forever, which is how
 * `docs/LESSONS.md` §9's "a lint that cries wolf gets ignored" happens.
 *
 * So a file may CLAIM the class:
 *
 *     // capture-audit: css-immune — <what the verdict is, and why CSS cannot reach it>
 *
 * and the claim is then MECHANICALLY REFUSED if the file takes a raw screenshot or
 * calls `getBoundingClientRect()` anywhere, because both of those are precisely what a
 * transform and an opacity do reach. The annotation records a judgement; the check is
 * what makes it a guard rather than a promise.
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
import { pathToFileURL } from 'node:url';

// From `import.meta.url`, not `process.argv[1]`: `classify` is exported and other
// tools import it, and under `node --input-type=module -e` argv[1] is undefined, which
// threw before the audit could run a single check.
const ROOT = resolve(new URL('../..', import.meta.url).pathname);

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

  // ── The sweep that finished the list, one decision per file ────────────────
  // The 27 files reported as "exposed elsewhere" were not one problem with one fix.
  // Sorted by what the fade can actually REACH, they were four different problems:
  //
  //   a PNG      -> `capture`     a fade compresses contrast; the packet renders below
  //                               feed a ~300k-token critic round
  //   a rect     -> `geometry`    getBoundingClientRect() includes the 0.992 entry scale
  //   readPixels -> `css-immune`  the drawing buffer is read BELOW the compositor
  //   the fade
  //   ITSELF     -> `validator`   settling it would delete the measurement
  //
  // Applying one class to all of them would have meant a class loose enough to pass a
  // validator, which is a class that catches nothing.
  'tools/tmp/critic_r6_chars3.mjs': 'capture',       // renders that go into a blind critic packet
  'tools/tmp/critic_r6_wide.mjs': 'capture',
  'tools/tmp/floorprobe.mjs': 'capture',             // one CLIPPED shot, guarded by hand + annotated
  'tools/tmp/facemove.mjs': 'capture',               // scene-graph numbers, but a human LOOKS at the PNG
  'tools/tmp/ab_probe.mjs': 'capture',               // before/after in a live match on index.html
  'tools/tmp/portrait_crop_check.mjs': 'capture',    // a PNG *and* rects, both on the trophies screen
  'tools/tmp/rarity_px.mjs': 'capture',              // element crops; superseded by rarity_aa, still runnable
  'tools/tmp/reload_watch.mjs': 'capture',           // a 30-min watch: records rather than refuses
  'tools/tmp/portrait_probe.mjs': 'geometry',        // tap targets and overflow, i.e. pure rects
  'tools/tmp/faceframe.mjs': 'geometry',
  'tools/tmp/menu_roster_frame.mjs': 'geometry',     // clicks a card; ALSO had a hardcoded port
  'tools/perf.mjs': 'geometry',                      // soft, time-boxed: a perf harness must not die on paint
  'tools/tmp/perf_tier.mjs': 'geometry',
  'tools/tmp/settle_geom_ab.mjs': 'validator',       // its subject IS the unsettled frame

  // Verdicts CSS cannot reach. Annotated at the top of each file with WHAT the verdict
  // is, and the annotation is refused if the file ever grows a rect or a screenshot.
  'tools/tmp/bgsweep.mjs': 'css-immune',
  'tools/tmp/castbox.mjs': 'css-immune',
  'tools/tmp/detach.mjs': 'css-immune',
  'tools/tmp/islands.mjs': 'css-immune',
  'tools/tmp/limbcheck.mjs': 'css-immune',
  'tools/tmp/limbcheck_pitch.mjs': 'css-immune',
  'tools/tmp/masssit.mjs': 'css-immune',
  'tools/tmp/occluder.mjs': 'css-immune',
  'tools/tmp/setprobe.mjs': 'css-immune',
  'tools/tmp/stage_fg.mjs': 'css-immune',
  'tools/tmp/thumbdump.mjs': 'css-immune',
  'tools/motion_probe.mjs': 'css-immune',
  'tools/tmp/openframe.mjs': 'css-immune',
  'tools/tmp/openwidth.mjs': 'css-immune',
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
  if (role === 'css-immune') {
    if (!r.cssImmune) return 'missing the `// capture-audit: css-immune — <reason>` annotation';
    if (r.rawShots.length) {
      return `claims css-immune but screenshots at line(s) ${r.rawShots.join(',')} — a PNG is exactly what a fade compresses`;
    }
    if (r.rectReads) {
      return `claims css-immune but calls getBoundingClientRect() ${r.rectReads}x — a rect INCLUDES transforms`;
    }
    return null;
  }
  if (role === 'validator') {
    // Its SUBJECT is the unsettled frame, so it must shoot early on purpose — but it
    // has to own the guard it is validating, and every raw shot has to be annotated
    // where a reviewer sees it. Otherwise "validator" becomes the word you write on a
    // file to make the audit stop asking.
    if (!r.importsSettle) return 'a validator must import the very guard it validates';
    if (r.rawShots.length) {
      return `unannotated raw .screenshot() at line(s) ${r.rawShots.join(',')} —`
        + ' a validator marks its deliberate early shot with `// capture-audit: allow <reason>`';
    }
    return null;
  }
  return null;
}
const IMPLEMENTATION = ['tools/tmp/settle.mjs'];

/**
 * Files that capture deliberately-unsettled frames as their SUBJECT.
 *
 * `settle_validate.mjs` predates the `validator` ROLE and is skipped outright.
 * Everything else that does this now goes in `OWNED` with `role: 'validator'`, which
 * is checked rather than merely excluded — an exclusion list is a place where a file
 * stops being audited, and that is the same shape as the cache this session spent a
 * task fixing.
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
  // The annotation covers its own line and the first line of CODE after it, skipping
  // any further comment lines in between. The original version covered only `i` and
  // `i + 1`, so a three-line reason — which is what an honest reason usually is —
  // silently failed to annotate its own call. That is a lint being pedantic about the
  // shape of a comment instead of about the defect, which is how a lint gets switched
  // off (`docs/LESSONS.md` §9).
  const allowed = new Set();
  const isComment = (l) => /^\s*(\/\/|\/\*|\*)/.test(l) || /^\s*$/.test(l);
  lines.forEach((l, i) => {
    if (!/capture-audit:\s*allow/.test(l)) return;
    allowed.add(i);
    let j = i + 1;
    while (j < lines.length && isComment(lines[j])) j++;
    allowed.add(j);
  });

  const found = {
    rawShots: [],        // `.screenshot()` calls not routed through the guard
    guardCalls: 0,       // `captureSettled(...)`
    settleCalls: 0,      // `settleScreen(...)` / a local wrapper
    flagWaits: 0,        // waitForFunction on __screenReady / __previewReady
    rectReads: 0,        // `getBoundingClientRect()` — a rect INCLUDES transforms
    importsSettle: false,
    readsSidecar: false, // mentions the `<png>.capture.json` provenance record
    cssImmune: false,    // claims its verdict is out of CSS's reach
    parseError: null,
  };
  if (/capture\.json/.test(source)) found.readsSidecar = true;
  if (/capture-audit:\s*css-immune/.test(source)) found.cssImmune = true;
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
      // `x.getBoundingClientRect()` — parsed, not grepped, so the seven files that only
      // MENTION it in a comment are not counted (`docs/LESSONS.md` §9).
      if (ts.isPropertyAccessExpression(c) && c.name.text === 'getBoundingClientRect') found.rectReads++;
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
  // Claimed AND checked: no PNG and no rect, so neither opacity nor transform can move
  // the verdict. A claim that fails either test falls through to FLAG-ONLY below.
  // `flagWaits > 0` is load-bearing — without it this very file self-matched on the
  // annotation quoted in its own header and reported itself as an audited probe.
  else if (found.cssImmune && found.flagWaits > 0 && found.rawShots.length === 0 && found.rectReads === 0) cls = 'CSS-IMMUNE';
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
  {
    name: 'a MULTI-LINE allow reason still annotates its own call',
    want: 'GUARDED',
    src: `
      import { captureSettled } from './settle.mjs';
      // capture-audit: allow — this shot needs a clip rect, which the guard does not take.
      // Settled above and floor-checked below, so both guards are applied by hand
      // rather than skipped.
      const buf = await page.screenshot({ clip: { x: 0, y: 0, width: 9, height: 9 } });
      await captureSettled(page, { path: 'late.png' });
    `,
  },
  {
    name: 'css-immune: readPixels off the drawing buffer',
    want: 'CSS-IMMUNE',
    src: `
      // capture-audit: css-immune — gl.readPixels() is below the CSS compositor
      await page.waitForFunction('window.__previewReady === true');
      const px = await page.evaluate(() => { const g = window.__stage.renderer.getContext();
        const p = new Uint8Array(16); g.readPixels(0, 0, 2, 2, g.RGBA, g.UNSIGNED_BYTE, p); return [...p]; });
    `,
  },
  {
    name: 'css-immune CLAIMED but it reads a rect — claim refused, stays exposed',
    want: 'FLAG-ONLY',
    src: `
      // capture-audit: css-immune — I promise it is fine
      await page.waitForFunction('window.__screenReady === true');
      const r = await page.evaluate(() => document.body.getBoundingClientRect());
    `,
  },
  {
    name: 'css-immune CLAIMED but it screenshots — claim refused, stays exposed',
    want: 'EXPOSED',
    src: `
      // capture-audit: css-immune — I promise it is fine
      await page.waitForFunction('window.__screenReady === true');
      await page.screenshot({ path: 'a.png' });
    `,
  },
  {
    name: 'a rect named only in a COMMENT is not a rect read (grep would say it is)',
    want: 'CSS-IMMUNE',
    src: `
      // capture-audit: css-immune — reads gl.readPixels only
      // NOTE: deliberately does NOT use getBoundingClientRect(), see settle.mjs.
      await page.waitForFunction('window.__previewReady === true');
      const px = await page.evaluate(() => window.__stage.renderer.getContext());
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
  {
    name: 'css-immune role: an unannotated file cannot hold the class',
    role: 'css-immune', wantViolation: true,
    src: "await page.waitForFunction('window.__previewReady === true');\nconst p = await page.evaluate(() => 1);",
  },
  {
    name: 'css-immune role: a rect read REFUSES the claim',
    role: 'css-immune', wantViolation: true,
    src: '// capture-audit: css-immune — trust me\nconst r = el.getBoundingClientRect();',
  },
  {
    name: 'css-immune role: a screenshot REFUSES the claim',
    role: 'css-immune', wantViolation: true,
    src: "// capture-audit: css-immune — trust me\nawait page.screenshot({ path: 'a.png' });",
  },
  {
    name: 'css-immune role: annotation + no rect + no shot is clean',
    role: 'css-immune', wantViolation: false,
    src: '// capture-audit: css-immune — gl.readPixels only\nconst px = gl.readPixels(0, 0, 1, 1, 0, 0, buf);',
  },
  {
    name: 'validator role: an unannotated raw shot is a violation',
    role: 'validator', wantViolation: true,
    src: "import { settleScreen } from './settle.mjs';\nawait page.screenshot();",
  },
  {
    name: 'validator role: not importing the guard it validates is a violation',
    role: 'validator', wantViolation: true,
    src: '// capture-audit: allow — early on purpose\nawait page.screenshot();',
  },
  {
    name: 'validator role: imports the guard, early shot annotated',
    role: 'validator', wantViolation: false,
    src: "import { settleScreen } from './settle.mjs';\n"
      + '// capture-audit: allow — the unsettled frame IS the subject\nawait page.screenshot();',
  },
];

const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (IS_MAIN && process.argv.includes('--selftest')) {
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
//
// Everything below runs only as a MAIN program. `classify` is exported and imported by
// `tools/tmp/sentinel.mjs`; before this guard, importing it ran the whole audit and
// then crashed on `process.argv[1]` being undefined under `node -e`.

async function listTools(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await listTools(p));
    else if (e.name.endsWith('.mjs')) out.push(p);
  }
  return out;
}

if (!IS_MAIN) { /* imported for `classify` only */ } else {
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

const immune = rows.filter((r) => r.cls === 'CSS-IMMUNE');
if (immune.length) {
  console.log('\n── assessed CSS-IMMUNE: the fade cannot reach the verdict (claimed AND checked) ──');
  for (const r of immune.sort((a, b) => a.rel.localeCompare(b.rel))) {
    console.log(`   ${r.owned ? '*' : ' '} ${r.rel.padEnd(34)} ${r.flagWaits} flag wait(s), 0 shots, 0 rects`);
  }
}

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
  + `   ·   ${immune.length} assessed css-immune   ·   ${exposed.length} file(s) exposed elsewhere`);
process.exit(failed ? 1 : 0);
}
