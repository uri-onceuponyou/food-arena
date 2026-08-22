#!/usr/bin/env node
/**
 * ss_abs — census of every ABSOLUTE HP/DAMAGE THRESHOLD in `src/`.
 *
 * A rescale is a no-op if and only if every comparison is RELATIVE. This finds the places
 * where it is not: a damage or HP quantity multiplied by, added to, or compared against a
 * literal. Those are the sites a x10 silently saturates.
 *
 * 🚨 THE POINT IS THE `gate` COLUMN. `tools/tmp/ss_x10.mjs` ran the whole offline battery
 * against a x10 rules.ts: `sim.test.mjs` went red on 6 checks and `driver_guard.mjs` on 4,
 * and **every one of those is in `src/game/` or `tools/`.** Not one presentation-layer site
 * below is covered by any gate — they are all `tsc`-clean, all still "legal" numbers, and
 * they fail by SATURATING, which produces no error at all. That is the stale-but-legal
 * class in a new file set.
 *
 *   node tools/tmp/ss_abs.mjs [--root <dir>] [--factor 10]
 *   node tools/tmp/ss_abs.mjs --selftest
 *
 * Read-only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IS_MAIN = (() => {
  try { return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]); }
  catch { return false; }
})();
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

/** Identifiers that hold an HP-denominated quantity at these call sites. */
const QTY = String.raw`(?:ev\.amount|ctx\.damage|w\.damage|weapon\.damage|amount|damage|dmg|healAmount|dealt|hp|maxHp)`;

/**
 * A site is INTERESTING when a QTY meets a numeric literal through arithmetic or comparison.
 * Deliberately over-collects and classifies afterwards — a census that silently drops a class
 * is worse than one that prints a few relative comparisons for a human to strike out.
 */
const PATTERNS = [
  { re: new RegExp(String.raw`\b${QTY}\b\s*[*/]\s*[0-9.]+`), why: 'scaled by a literal' },
  { re: new RegExp(String.raw`[0-9.]+\s*[*/]\s*\b${QTY}\b`), why: 'scaled by a literal' },
  { re: new RegExp(String.raw`\b${QTY}\b\s*[<>]=?\s*[0-9]`), why: 'compared to a literal' },
  { re: new RegExp(String.raw`[0-9]\s*[<>]=?\s*\b${QTY}\b`), why: 'compared to a literal' },
  { re: new RegExp(String.raw`\b${QTY}\b\s*[+-]\s*[0-9]`), why: 'offset by a literal' },
];

/** Comparisons that are RELATIVE and therefore scale-invariant — struck from the census. */
const RELATIVE = [
  /hp\s*\/\s*\w*[Mm]axHp/, /maxHp\s*>\s*0/, /hp\s*[<>]=?\s*0\b/, /hp\s*===\s*0\b/,
  /amount\s*>\s*0/, /heal\s*<=\s*0/, /\.length/,
];

export function census(root) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.ts$/.test(e.name) || /\.test\./.test(e.name)) continue;
      const lines = fs.readFileSync(p, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '');
        if (/^\s*(\*|\/\/|\/\*)/.test(line)) return;       // doc comment
        if (RELATIVE.some((r) => r.test(code))) return;
        for (const { re, why } of PATTERNS) {
          if (re.test(code)) {
            out.push({ file: path.relative(root, p), line: i + 1, why, text: code.trim() });
            return;
          }
        }
      });
    }
  };
  walk(path.join(root, 'src'));
  return out;
}

/** Which layer does a site live in, and therefore which gate (if any) can see it? */
function layer(file) {
  if (file.startsWith('src/game/') && !file.includes('vfx') && !file.includes('match')) return 'SIM';
  if (file.startsWith('src/ui/')) return 'HUD';
  if (file.startsWith('src/audio/')) return 'AUDIO';
  if (file.startsWith('src/vfx/') || file.includes('vfx.ts') || file.includes('match.ts')) return 'FEEL/VFX';
  return 'OTHER';
}

function selftest() {
  let pass = 0, fail = 0;
  const ck = (n, ok, x = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`); ok ? pass++ : fail++; };
  const root = fs.realpathSync(arg('--root', path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')));
  const rows = census(root);
  // KNOWN-BAD 1: NON-EMPTY FIRST. A filter that empties its set passes every later assertion.
  ck('census is NON-EMPTY', rows.length > 0, `${rows.length} rows`);
  // KNOWN-BAD 2: the four sites this pass was written to find MUST appear. If a refactor
  // renames them the census must go red rather than quietly shrink.
  const must = [
    ['src/ui/hud.ts', /amount >= 15/],
    ['src/game/match.ts', /triggerHitStop/],
    ['src/audio/sounds.ts', /damage - 2\) \/ 16/],
    ['src/game/vfx.ts', /amount \* 0\.4/],
  ];
  for (const [f, re] of must) {
    const hit = rows.some((r) => r.file === f && re.test(r.text));
    ck(`census finds the known site in ${f} (${re})`, hit);
  }
  // KNOWN-BAD 3: the relative filter must actually strike something, or it is decoration.
  const struck = /hp \/ (f\.)?maxHp/;
  ck('no purely RELATIVE hp/maxHp comparison survives the filter',
    !rows.some((r) => struck.test(r.text) && !/[*+-]/.test(r.text.replace(/hp \/ \w*maxHp/, ''))));
  // KNOWN-BAD 4: every layer label must be reachable, else the grouping is a lie.
  const layers = new Set(rows.map((r) => layer(r.file)));
  ck('at least 3 distinct layers are represented', layers.size >= 3, [...layers].join(', '));
  console.log(`\n${pass} pass, ${fail} fail`);
  process.exitCode = fail ? 1 : 0;
}

function main() {
  if (argv.includes('--selftest')) return selftest();
  const root = fs.realpathSync(arg('--root', path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')));
  const rows = census(root);
  const byLayer = new Map();
  for (const r of rows) {
    const l = layer(r.file);
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l).push(r);
  }
  console.log(`root ${root}\n${rows.length} sites where an HP/damage quantity meets a numeric LITERAL\n`);
  for (const [l, rs] of [...byLayer].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`── ${l} — ${rs.length} sites ${'─'.repeat(Math.max(0, 56 - l.length))}`);
    for (const r of rs) console.log(`  ${r.file}:${r.line}\n      ${r.text}`);
    console.log();
  }
}

if (IS_MAIN) main();
