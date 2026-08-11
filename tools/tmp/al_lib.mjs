#!/usr/bin/env node
/**
 * ARENA-LITERAL EXTRACTION — the shared half of `al_sweep.mjs` (census) and
 * `al_guard.mjs` (the gate).
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 *
 * `6631446` changed **two constants** — `ARENA_W/H`, 1400×1000 → 2800×2000. Everything
 * that DERIVED from them was correct in the same commit. Everything that held a
 * **literal copy** of the old geometry silently began describing a map that does not
 * exist, and **eleven of those were found one at a time, each by accident** (DECISIONS
 * §60, §64, §65). Four of the eleven were **GREEN the whole time**:
 *
 *   * `valuescan --selftest` reported **105/105** while 14 of its 18 stations were
 *     measuring the wrong place and **11 sat inside a `CoverBox`**.
 *   * `np_nfighter` reported **62 passed, 0 failed** with its measuring ring **1,077 wu
 *     off centre**.
 *   * four `sp_gate` / `sp_place` fixtures passed at their 1× coordinates while testing
 *     something nobody chose — a *"seat inside the pot"* pointing at a herb crate, an
 *     *"axis mirror"* about the old centre, a freezer reporting `inside-cover` by luck.
 *
 * **A passing test is not evidence the constant is right**, and `gatecount` structurally
 * cannot see this: it checks that a gate's *count* matches, never that a gate is
 * *pointed anywhere real*.
 *
 * ── The design decision that makes this tractable ───────────────────────────
 *
 * A plain grep for the numbers is useless — **2,534 raw hits** across 639 files for the
 * thirteen suspect values, and the overwhelming majority of `1000` and `500` are
 * milliseconds. So this does not grep for values. It **extracts by SYNTACTIC ROLE**:
 * only a number that is syntactically a position, a distance or an arena dimension is
 * ever a candidate. That is what takes the corpus from 2,534 to a list a human can read.
 *
 * ⚠️ **Every point in the 1× map is also a legal point in the ×4 map** — the old
 * playfield is exactly the NW quadrant of the new one. So "is this coordinate legal?"
 * cannot detect the bug and never could; that is precisely why four fixtures stayed
 * green. The detectors that DO work are:
 *   1. the **exact 1× scalars** in a role (`maxR: 890`, `cx: 700`, `w: 1400`, `~860`),
 *   2. **NW clustering** — a whole table of stations landing in one quadrant,
 *   3. **inside a `CoverBox`** — where a station cannot legally be.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ── the map, read rather than assumed ────────────────────────────────────────

/**
 * The shipped arena. Read from `tools/arena.gameplay.json` (the dump every other arena
 * tool already reads) and then **cross-checked against `src/arena/shared.ts`'s own
 * `ARENA_W/H`**, because a guard built on a stale dump is the same bug one layer up —
 * and this whole file exists because one number stopped tracking another.
 */
export function loadArena() {
  const dump = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/arena.gameplay.json'), 'utf8'));
  const shared = fs.readFileSync(path.join(ROOT, 'src/arena/shared.ts'), 'utf8');
  const w = Number(/export const ARENA_W\s*=\s*(\d+)/.exec(shared)?.[1]);
  const h = Number(/export const ARENA_H\s*=\s*(\d+)/.exec(shared)?.[1]);
  if (!Number.isFinite(w) || !Number.isFinite(h)) {
    throw new Error('al_lib: could not read ARENA_W/ARENA_H out of src/arena/shared.ts');
  }
  if (dump.width !== w || dump.height !== h) {
    throw new Error(`al_lib: tools/arena.gameplay.json is STALE — it says ${dump.width}x${dump.height}, `
      + `src/arena/shared.ts says ${w}x${h}. Re-run tools/arena-dump.js before trusting any arena tool.`);
  }
  return {
    w, h,
    cx: dump.center.x, cy: dump.center.y,
    maxSafeRadius: dump.maxSafeRadius,
    halfDiagonal: Math.hypot(w / 2, h / 2),
    cover: dump.cover ?? [],
    spawns: dump.spawns ?? [],
  };
}

/** The 1× map, kept as data so the known-bad can be described rather than guessed. */
export const MAP_1X = { w: 1400, h: 1000, cx: 700, cy: 500, halfDiagonal: 860.23, fieldOuter: 1500 };

/**
 * Every value `maxSafeRadius` has held on the 1× map, because the constant moved twice
 * and a tool can be stale to either one:
 *   **850** — the hand-set value before it was derived at all;
 *   **890** — `860.23 / (1 − 6/180)`, the derived value on the 180 s clock;
 *   **993** — `860.23 / (1 − 6/45)`, the derived value after the clock went 45 s.
 * The shipped map's is **1985**. ⚠️ `993` was the one that nearly got away: it is the
 * *newest* of the three, so a file holding it looks freshly maintained —
 * `tools/tmp/sc_fogstill.mjs` carried it under the comment *"mirrors arena-scan.mjs"*.
 */
export const MAXR_1X = [850, 890, 993];

// ── file enumeration ─────────────────────────────────────────────────────────

/**
 * Tracked text files worth scanning.
 *
 * `git ls-files` rather than a walk, so gitignored scratch output and `reference/` are
 * out by construction. ⚠️ And note `tools/tmp/nw_wire.mjs` carried **two raw NUL bytes**
 * until this pass escaped them; `grep` classifies such a file as binary and **skips it
 * silently**, so it was invisible to every text search in the repo including this one.
 * Node's `readFileSync` has no such behaviour, which is one reason this scans in JS.
 */
export function scanFiles() {
  const out = execFileSync('git', ['ls-files', 'src', 'tools', 'docs'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean)
    .filter((f) => /\.(ts|tsx|mjs|js|md)$/.test(f))
    // this file and its two consumers describe the 1× map ON PURPOSE, as data.
    .filter((f) => !/^tools\/tmp\/al_(lib|sweep|guard)\.mjs$/.test(f));
  return out;
}

// ── extraction ───────────────────────────────────────────────────────────────

const NUM = String.raw`-?\d+(?:\.\d+)?`;

/** True if `file` looks like it talks about the playfield at all. Cheap pre-filter. */
function isArenaish(text) {
  return /arena|fogRadius|safeRadius|maxSafeRadius|__matchArena|playfield|CoverBox|spawn/i.test(text);
}

/**
 * Per-line "is this line inside a comment / prose" mask.
 *
 * Not a lexer — a line is prose if it is a `//` line, sits inside a `/* … *\/` block, or
 * is Markdown. That is enough, and the distinction matters: a stale literal in a comment
 * is a **documentation** defect, not a behavioural one, and this project treats the two
 * differently (*"when a comment encodes something that has been reversed, change it and
 * keep the old wording above it with the reason"*). `fogRing.ts:207` was both at once —
 * a wrong constant justified by a wrong comment — which is exactly why they are counted
 * separately rather than merged.
 */
function commentMask(text, lines) {
  if (/\.mdx?$/.test(text.slice(0, 0))) { /* unreachable; kept for symmetry */ }
  const mask = new Array(lines.length).fill(false);
  let block = false;
  lines.forEach((ln, i) => {
    const t = ln.trim();
    const opens = (ln.match(/\/\*/g) ?? []).length;
    const closes = (ln.match(/\*\//g) ?? []).length;
    if (block) mask[i] = true;
    else if (t.startsWith('//') || t.startsWith('*')) mask[i] = true;
    else if (opens > closes) { mask[i] = true; }
    if (opens > closes) block = true;
    else if (closes > 0 && closes >= opens) block = false;
  });
  return mask;
}

/**
 * Files that DEFINE the arena rather than point at it.
 *
 * `kitchen.ts` declares every `CoverBox` as `{x, y, w, h, kind}`, so an `x:/y:` pair
 * there IS the cover — flagging it `IN-COVER` is the guard measuring its own input. Same
 * for the dump `arena-dump.js` writes. ⚠️ This is the one exclusion in the file and it is
 * deliberately narrow: excluding *"arena files"* wholesale would have hidden
 * `fogRing.ts`'s `FIELD_OUTER_UNITS = 1500`, which is exactly the bug.
 */
const DEFINES_THE_ARENA = new Set(['src/arena/kitchen.ts', 'tools/arena-dump.js']);

/**
 * Every candidate arena literal in one file, with the ROLE that made it a candidate.
 *
 * Roles:
 *   `pos`    a coordinate pair `{x, y}` in world units
 *   `dim`    an arena dimension (`w`/`h`/`width`/`height` of the playfield itself)
 *   `centre` an arena centre component
 *   `radius` a fog / safe radius
 *   `diag`   a half-diagonal
 */
export function extract(rel, text) {
  const hits = [];
  const lines = text.split('\n');
  const comment = commentMask(text, lines);
  const push = (i, role, value, why, extra = {}) =>
    hits.push({
      file: rel, line: i + 1, role, value, why, inComment: comment[i],
      text: lines[i].trim().slice(0, 200), ...extra,
    });
  const arenaish = isArenaish(text);

  lines.forEach((ln, i) => {
    // ── R1. URL query positions: `?px=850&py=500`, `px=${x}` excluded (derived). ──
    // The single most decisive extractor in the file: `px`/`py` are the game's own QA
    // hatch for "teleport the fighter to this world coordinate", so a literal there is
    // unambiguously an arena position.
    for (const m of ln.matchAll(new RegExp(String.raw`[?&]px=(${NUM})&(?:[^&'"\`]*&)*?py=(${NUM})`, 'g'))) {
      push(i, 'pos', [Number(m[1]), Number(m[2])], 'URL ?px=/&py=');
    }
    for (const m of ln.matchAll(new RegExp(String.raw`\bpx:\s*(${NUM})\s*,\s*py:\s*(${NUM})`, 'g'))) {
      push(i, 'pos', [Number(m[1]), Number(m[2])], 'px:/py: option pair');
    }

    // ── R2. Fog / safe radius requests. ──
    // ⚠️ `fog` is in the list because that is what every station table in this repo calls
    // the column (`{ id: 'west_lane', x: 600, y: 1000, fog: 1985 }`), and leaving it out
    // meant the scalar arm could not see a 1× radius sitting in a fixture row.
    for (const m of ln.matchAll(new RegExp(String.raw`\b(?:fogRadius|safeRadius|maxSafeRadius|maxR|fogArg|fog)\s*[=:]\s*(${NUM})`, 'g'))) {
      push(i, 'radius', Number(m[1]), 'fog/safe radius literal');
    }

    // ── R3. A self-declared arena object: two or more of w/h/cx/cy/maxR. ──
    // `tools/match-play.mjs` held exactly this — `{w:1400,h:1000,cx:700,cy:500,maxR:890}`
    // — and it is the shape a tool reaches for when it wants "the arena" without
    // importing one.
    for (const m of ln.matchAll(/\{[^{}]*\}/g)) {
      const obj = m[0];
      const keys = [...obj.matchAll(new RegExp(String.raw`\b(w|h|cx|cy|maxR|width|height)\s*:\s*(${NUM})\b`, 'g'))];
      if (keys.length < 2) continue;
      const map = Object.fromEntries(keys.map((k) => [k[1], Number(k[2])]));
      if (map.w !== undefined && map.h !== undefined) push(i, 'dim', [map.w, map.h], 'self-declared arena {w,h}');
      if (map.width !== undefined && map.height !== undefined && arenaish) {
        push(i, 'dim', [map.width, map.height], 'self-declared arena {width,height}');
      }
      if (map.cx !== undefined && map.cy !== undefined) push(i, 'centre', [map.cx, map.cy], 'self-declared arena {cx,cy}');
      if (map.maxR !== undefined) push(i, 'radius', map.maxR, 'self-declared arena {maxR}');
    }

    // ── R4. Named constants whose NAME says they are arena geometry. ──
    for (const m of ln.matchAll(new RegExp(
      String.raw`\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::\s*number\s*)?=\s*(${NUM})\s*[;,]`, 'g'))) {
      const name = m[1];
      if (!/RADIUS|CENTER|CENTRE|HALF_?DIAG|ARENA|FIELD_OUTER|MAX_SAFE|PLAYFIELD|_WU$/i.test(name)) continue;
      const v = Number(m[2]);
      // World units are hundreds; a THREE scene-unit height (`FLOOR_Y = -0.06`,
      // `CANOPY_Y = 3.2`) is not an arena distance and matched only on its name.
      if (Math.abs(v) < 20) continue;
      const role = /RADIUS|FIELD_OUTER|MAX_SAFE/i.test(name) ? 'radius'
        : /HALF_?DIAG/i.test(name) ? 'diag' : 'dim';
      push(i, role, v, `named constant ${name}`, { name });
    }

    // ── R5. NAMED single points: `const GREASE = { x: 1830, y: 1250 };` ──
    // ⚠️ Deliberately NOT every `x:/y:` pair. That version of this rule produced the bulk
    // of the false positives in the first run of this tool and every one was the same
    // three shapes: **direction vectors** (`facing: {x: -1, y: 0}`), **box declarations**
    // (`{x, y, w, h, kind}`) and **synthetic test geometry**. Requiring a NAME, requiring
    // both components ≥ 20 wu, and refusing a line that also carries `w:`/`h:`/`kind:`
    // removes all three without removing a single real hit.
    if (arenaish && !DEFINES_THE_ARENA.has(rel)) {
      for (const m of ln.matchAll(new RegExp(
        String.raw`\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{\s*x:\s*(${NUM})\s*,\s*y:\s*(${NUM})\s*\}`, 'g'))) {
        const x = Number(m[2]), y = Number(m[3]);
        if (Math.abs(x) < 20 || Math.abs(y) < 20) continue;
        push(i, 'pos', [x, y], `named point ${m[1]}`, { name: m[1] });
      }
    }
  });

  // ── R6. Station / fixture TABLES. Multi-line, so handled outside the line loop. ──
  // The shape that produced four of tonight's eleven: a `const STATIONS = [...]` of
  // `['name', x, y, ...]` rows. `valuescan`, `arena-scan` and `simfix` all hold one.
  //
  // 🚨 TWO SHAPES, NOT ONE. The array form was written first and it MISSED
  // `tools/tmp/limbmatch.mjs` entirely, whose table is an OBJECT —
  // `const STATIONS = { pot_south: { x: 700, y: 640, fog: 850 }, … }` — four 1×
  // coordinates under a comment claiming they were *"arena-scan's CORRECTED
  // coordinates"*. It was found by reading the file, not by the tool, which is the exact
  // failure mode this whole pass exists to end. Both forms now.
  // ⚠️ THE CLOSING BRACKET MUST BE AT COLUMN 0, and that is not cosmetic. With `\n\s*[\]}];`
  // the non-greedy body of an EARLIER declaration ran past the table and swallowed it:
  // `limbmatch`'s `STATIONS` was invisible because an `OPT = {…}` twenty lines above it
  // closed on an indented line. Requiring column 0 both anchors the top-level table and
  // stops one declaration eating the next. `al_guard`'s §S asserts the four known tables
  // are still found, so this cannot regress quietly.
  // ⚠️ AND THE OPENING BRACKET MUST BE THE LAST THING ON ITS LINE. A one-liner
  // (`const ENEMY_SPAWN = { x: 2500, y: 1190 };`) closes on the SAME line, so the
  // non-greedy body ran on to the next column-0 `];` and hoovered up the whole table
  // that followed it — `arena-scan`'s 18 stations were reported as 16 rows of
  // `ENEMY_SPAWN`. A table is multi-line by definition; requiring `[\n` says so.
  for (const m of text.matchAll(
    /(?:const|let)\s+([A-Z][A-Z0-9_]{2,})\s*(?::[^=]*)?=\s*([[{])[ \t]*\r?\n([\s\S]*?)\n[\]}];/g)) {
    const name = m[1];
    if (!/STATION|FIXTURE|SPAWN|PIN|PROBE|SEAT|PLACE|POINT|POST|MARK|CELL|PATCH|SITE|SAMPLE/i.test(name)) continue;
    const startLine = text.slice(0, m.index).split('\n').length;
    const body = m[3];
    // THREE row shapes, and all three are live in this repo, so all three are tried
    // regardless of the bracket: a positional tuple (`simfix`), an object keyed by id
    // (`limbmatch`), and an ARRAY OF OBJECTS (`arena-scan`, `valuescan` — `{ id: 'x',
    // x: 300, y: 810, fog: … }`). Keying the row shape off the outer bracket found the
    // first two and missed the third, which is the table this whole pass started from.
    // ⚠️ A row whose coordinate is an EXPRESSION (`x: GREASE.x - 110`) is deliberately
    // not matched: that is a derived coordinate, which is the thing we want people doing.
    const rows = [
      ...body.matchAll(new RegExp(String.raw`\[\s*(?:'[^']*'|"[^"]*")\s*,\s*(${NUM})\s*,\s*(${NUM})\b\s*(?:,\s*(${NUM})\b)?`, 'g')),
      ...body.matchAll(new RegExp(String.raw`\bx:\s*(${NUM})\s*,\s*y:\s*(${NUM})`, 'g')),
    ];
    for (const r of rows) {
      const line = startLine + body.slice(0, r.index).split('\n').length - 1;
      const at = (role, value, why) => hits.push({
        file: rel, line, role, value, why, table: name, inComment: comment[line - 1],
        text: (text.split('\n')[line - 1] ?? '').trim().slice(0, 200),
      });
      at('pos', [Number(r[1]), Number(r[2])], `row of table ${name}`);
      // ⚠️ A POSITIONAL FOURTH COLUMN IS A RADIUS AND WAS INVISIBLE. `simfix`'s rows were
      // `['west_lane', 340, 500, 890]` — the 890 is the fog radius, and because it is
      // positional rather than keyed, R2 could not see it: the guard's own selftest
      // caught the gap by demanding `1X-SCALAR` on that exact line and getting nothing.
      // Only sizes in the arena-distance range qualify, so a count or a seed in column 4
      // is not mistaken for a ring.
      if (r[3] !== undefined) {
        const v = Number(r[3]);
        if (v >= 100 && v <= 5000) at('radius', v, `4th column of table ${name}`);
      }
    }
  }

  return hits;
}

// ── classification ───────────────────────────────────────────────────────────

/** Is a scalar exactly one of the 1× map's characteristic quantities, in this role? */
export function is1xScalar(role, v) {
  const near = (a, b) => Math.abs(a - b) <= 0.6;
  if (role === 'radius' && MAXR_1X.includes(v)) return `1× maxSafeRadius (${v}; the map's is 1985)`;
  if (role === 'radius' && v === MAP_1X.fieldOuter) return `1× FIELD_OUTER_UNITS (1500)`;
  if (role === 'diag' && near(v, MAP_1X.halfDiagonal)) return `1× half-diagonal (~860)`;
  return null;
}

/** Is a pair one of the 1× map's characteristic points, in this role? */
export function is1xPair(role, [a, b]) {
  if (role === 'dim' && a === MAP_1X.w && b === MAP_1X.h) return '1× ARENA_W×ARENA_H (1400×1000)';
  if (role === 'centre' && a === MAP_1X.cx && b === MAP_1X.cy) return '1× CENTER (700,500)';
  return null;
}

/** The `CoverBox` a point sits inside, or null. Boxes are centre + half-extents ×2. */
export function coverAt(arena, x, y) {
  for (const c of arena.cover) {
    if (Math.abs(x - c.x) <= c.w / 2 && Math.abs(y - c.y) <= c.h / 2) return c;
  }
  return null;
}

/** NW / NE / SW / SE about the live centre. */
export function quadrant(arena, x, y) {
  return (y < arena.cy ? 'N' : 'S') + (x < arena.cx ? 'W' : 'E');
}

/**
 * Does a point in this file address the **SHIPPED** map, or a synthetic one?
 *
 * 🚨 **THIS DISTINCTION IS THE WHOLE DIFFERENCE BETWEEN A GUARD AND A NOISE GENERATOR.**
 * `src/game/sim.test.mjs` builds ~30 toy arenas with `makeArena({width: 1400, height:
 * 1000, cover: [...]})` — a corridor, a U-pocket, an open field — to unit-test pure sim
 * logic. Those are **fixtures, not the kitchen**, they are internally consistent, and
 * `1400×1000` there means "a convenient rectangle", not "the arena". Testing them
 * against the shipped `CoverBox` list flagged **41 rows in one file, every one wrong.**
 *
 * So legality (`IN-COVER`, `OOB`, quadrant coverage) applies only where the point is
 * genuinely aimed at the kitchen: the file reads the shipped dump, reads
 * `window.__matchArena`, or drives the real game in a browser — **and** does not build
 * its own arena.
 */
export function addressesShippedArena(text) {
  const reads = /arena\.gameplay\.json|__matchArena|__gameReady|__vfxDebugFighters/.test(text);
  // ⚠️ TWO WAYS TO BUILD YOUR OWN, and only the first was checked at first. A helper call
  // (`makeArena(...)`) is the obvious one; an INLINE `{ id: 'selftest', width: 1400,
  // height: 1000, center: {…}, cover: [] }` is the other, and it is what
  // `tools/match-sim.mjs` uses for its selftest — so its `PIN` was reported as sitting
  // inside a `flour_sacks` box that its own arena does not contain.
  //
  // 🚨 AND THE FIRST VERSION OF THE SECOND TEST WAS `/width:\s*\d+\s*,\s*height:\s*\d+/`,
  // WHICH MATCHES **A PLAYWRIGHT VIEWPORT** — `newPage({ viewport: { width: 1600, height:
  // 900 } })`. It silently switched legality off for **eight files that were previously
  // flagged**, including four probes standing inside a `CoverBox`. Caught only by
  // noticing the flagged count fall; nothing went red, because a guard losing coverage
  // looks exactly like a guard passing. So the inline form must ALSO carry a field only
  // an arena has.
  const buildsOwn = /\b(?:makeArena|openArena|createArena)\s*\(/.test(text)
    || (/\bwidth:\s*\d+\s*,\s*height:\s*\d+/.test(text) && /\b(?:maxSafeRadius|playerSpawn|enemySpawn)\s*:/.test(text));
  return reads && !buildsOwn;
}

/**
 * The full verdict for one extracted hit. Shared by `al_sweep` (prints it) and
 * `al_guard` (fails on it), so the two can never disagree about what a defect is.
 */
export function classify(arena, hit, ctx) {
  const flags = [];
  if (Array.isArray(hit.value)) {
    const p = is1xPair(hit.role, hit.value);
    if (p) flags.push({ code: '1X-PAIR', detail: p });
    const [x, y] = hit.value;
    if (hit.role === 'pos') {
      hit.quad = quadrant(arena, x, y);
      // A literal in prose is a DOC defect, not a fixture pointing anywhere.
      if (ctx.shipped && !hit.inComment) {
        if (x < 0 || y < 0 || x > arena.w || y > arena.h) {
          flags.push({ code: 'OOB', detail: `outside 0..${arena.w} × 0..${arena.h}` });
        } else {
          const c = coverAt(arena, x, y);
          if (c) flags.push({ code: 'IN-COVER', detail: `inside ${c.kind} at (${c.x},${c.y}) ${c.w}×${c.h}` });
        }
      }
    }
  } else {
    const s = is1xScalar(hit.role, hit.value);
    if (s) flags.push({ code: '1X-SCALAR', detail: s });
  }
  return flags;
}
