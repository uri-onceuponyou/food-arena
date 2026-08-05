#!/usr/bin/env node
/**
 * Portrait plates for the two things this pass changed — the HUD's bottom edge and the
 * settings graphics row — because a DOM measurement can be right about geometry and
 * still be looking at a rule the CSS parser silently dropped.
 *
 * `docs/LESSONS.md` §9 records exactly that failure: a comment placed after a `*∕`
 * ate a whole CSS rule, tsc was happy, and ONLY A SCREENSHOT FOUND IT. Both files
 * touched here are template-literal stylesheets with new comment blocks in them, so
 * both get looked at.
 *
 * Usage: node tools/tmp/with_snapshot.mjs -- node tools/tmp/portrait_shots.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const OUT = 'shots/portrait';
const A = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ args: A });

// The HUD, at the viewport the defect was photographed in, in both DOM states.
for (const [name, touch] of [['hud-390x844-pointer', false], ['hud-390x844-touch', true]]) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await p.goto(`${BASE}/?screen=match&player=hamburger&enemy=donut&pointerLock=0&simSpeed=0.02`,
    { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
  if (touch) await p.evaluate(() => document.documentElement.classList.add('fa-touch-capable', 'fa-touch'));
  await p.waitForTimeout(1400);
  await p.screenshot({ path: `${OUT}/${name}.png`, timeout: 120000 });
  await p.close();
  console.log(`${OUT}/${name}.png`);
}

// Settings, with and without a `?tier=` pin, at desktop and portrait.
for (const [name, w, h, q] of [
  ['settings-1280x720', 1280, 720, ''],
  ['settings-390x844', 390, 844, ''],
  ['settings-390x844-pinned', 390, 844, '&tier=medium'],
  ['settings-844x390', 844, 390, ''],
]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.goto(`${BASE}/?screen=settings${q}`, { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForFunction('window.__screen === "settings"', null, { timeout: 60000 });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/${name}.png`, timeout: 120000 });
  await p.close();
  console.log(`${OUT}/${name}.png`);
}

await b.close();
