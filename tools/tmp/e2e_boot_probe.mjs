#!/usr/bin/env node
/**
 * Two questions the three-round-trip journey raised and could not answer from inside
 * itself. Both are about the EDGE between the shell and something it owns, which is
 * why no unit gate sees either.
 *
 * ── 1. Is `window.__screenReady` true before the screen has finished appearing? ──
 * `shell.ts:navigate` sets `__screenReady = true` in the same tick it removes the
 * curtain, and `.fa-screen` then runs a 0.26 s `fa-screen-in` entry animation. Every
 * probe in this repo waits on `__screenReady` and screenshots — so if the animation is
 * still running, the captured frame is the screen at partial opacity over the orange
 * page background, and every colour, contrast and "is it blank" number taken from it
 * is measuring the fade. The journey caught exactly this on its third round trip: the
 * same screen scored stdev 95.4 when the roster took 32 s to warm and 36.7 when it was
 * cached and the shot landed 0.3 s after `__screenReady`.
 *
 * ── 2. Where does the AudioContext actually end up on the shipped boot path? ──
 * `engine.ts`'s header is explicit that a context created before a user gesture starts
 * `suspended` with a frozen clock and is "worse than silence", and that the menu shell
 * guarantees a real gesture first. `shell.ts:mount` calls `audio.music.fadeIn()` — and
 * it does so from inside a `setTimeout`, i.e. outside any gesture's call stack. The
 * journey reads `state=suspended` at home on three separate runs, while
 * `audio-probe --mode live` reads `state=running` on the same machine after one
 * `page.mouse.click`. So the environment CAN unlock audio; the question is whether the
 * shipped path does, and whether it recovers on the next real click.
 *
 *   node tools/tmp/headserve.mjs -- node tools/tmp/e2e_boot_probe.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { settleScreen, captureSettled, describe, paintState } from './settle.mjs';

const BASE = (process.env.PREVIEW_BASE ?? 'http://localhost:5173').replace(/\/$/, '');
const OUT = 'shots/e2e/bootprobe';
const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const rows = [];
const say = (name, detail) => { rows.push({ name, detail }); console.log(`  ${String(name).padEnd(40)} ${detail}`); };

const AUDIO = () => (window.__audio ? window.__audio.stats() : null);
const SCREEN = () => {
  const scr = document.querySelector('.fa-stack > *');
  const curtain = document.querySelector('.fa-curtain');
  const cs = scr ? getComputedStyle(scr) : null;
  return {
    screen: window.__screen ?? null,
    ready: window.__screenReady ?? null,
    screenOpacity: cs ? cs.opacity : null,
    screenTransform: cs ? cs.transform : null,
    animName: cs ? cs.animationName : null,
    curtainOpacity: curtain ? getComputedStyle(curtain).opacity : null,
  };
};

/**
 * ── THIS FILE IS A VALIDATOR, so one of its two captures MUST be unguarded ──────
 * The headline comparison below is "the same screen shot AT `__screenReady` against the
 * same screen shot once it has provably settled". The early frame is the SUBJECT: a
 * guard that refused it would delete the measurement. `settle_validate.mjs` is exempted
 * from `capture_audit.mjs` for exactly this reason and does exactly this.
 *
 * So `shotAtFlag` keeps the raw shutter, annotated where a reviewer sees it, and records
 * the paint state it was taken in — which is better evidence than the pixels alone,
 * because it names WHY the frame is early. `shotSettled` is the control and goes through
 * the guard, so the "after" side of every number here is a proven-painted frame rather
 * than a 2.5 s sleep that was only ever long enough on one machine.
 */
async function shotAtFlag(page, label) {
  const state = await paintState(page);
  // capture-audit: allow — the UNSETTLED frame is this probe's subject, not its output.
  const buf = await page.screenshot({ timeout: 120_000 });
  writeFileSync(`${OUT}/${label}.png`, buf);
  const st = await sharp(buf).stats();
  return {
    stdev: +Math.max(...st.channels.map((c) => c.stdev)).toFixed(2),
    mean: +(st.channels.slice(0, 3).reduce((s, c) => s + c.mean, 0) / 3).toFixed(1),
    painted: state.ok, why: state.why,
  };
}

async function shotSettled(page, label) {
  const cap = await captureSettled(page, { path: `${OUT}/${label}.png`, label, tool: 'e2e_boot_probe' });
  return { stdev: cap.stats.stdev, mean: cap.stats.mean, painted: cap.painted, why: [] };
}

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(180_000);
await page.route('**/@vite/client*', (r) => r.fulfill({
  status: 200, contentType: 'text/javascript',
  body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
}));
mkdirSync(OUT, { recursive: true });

console.log(`\n══ boot probe  ${BASE} ══\n`);
console.log('── audio state along the shipped path ──');

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
await page.waitForFunction('window.__screen === "opening"', null, { timeout: 180_000 });
await page.waitForTimeout(1500);
say('opening, before any gesture', JSON.stringify(await page.evaluate(AUDIO)));

// A real click on the title card's own button — the first gesture a player makes.
await page.click('.open-start, [data-el="start"]', { timeout: 8_000 }).catch(() => say('opening click', 'MISSED (card auto-continued first)'));
await page.waitForTimeout(600);
say('immediately after that click', JSON.stringify(await page.evaluate(AUDIO)));

await page.waitForFunction('window.__screen === "home" && window.__screenReady === true', null, { timeout: 120_000 });
await page.waitForTimeout(800);
say('at home', JSON.stringify(await page.evaluate(AUDIO)));

// A second, unambiguous trusted gesture in the middle of the frame.
await page.mouse.click(720, 450);
await page.waitForTimeout(600);
say('after a bare mouse.click(720,450)', JSON.stringify(await page.evaluate(AUDIO)));

// ── the screen-entry animation, sampled from the instant `__screenReady` flips ──
console.log('\n── .fa-screen entry animation vs window.__screenReady ──');
await page.evaluate(() => window.__shell.navigate({ name: 'characters' }));
await page.waitForFunction('window.__screenReady === true', null, { timeout: 60_000 });
const trace = [];
const t0 = Date.now();
for (let i = 0; i < 14; i++) {
  trace.push({ ms: Date.now() - t0, ...(await page.evaluate(SCREEN)) });
  await page.waitForTimeout(60);
}
for (const t of trace) console.log(`   +${String(t.ms).padStart(5)}ms  screen=${t.screen} ready=${t.ready} opacity=${t.screenOpacity} anim=${t.animName} curtain=${t.curtainOpacity}`);
const firstOpacity = Number(trace[0].screenOpacity);
say('opacity at the instant __screenReady flips', `${trace[0].screenOpacity} (curtain ${trace[0].curtainOpacity})`);
say('__screenReady means "fully visible"?', firstOpacity >= 0.99 ? 'yes' : `NO — the screen is at ${firstOpacity} and still animating`);

// Same screen, shot twice: immediately, and once the animation has certainly ended.
await page.evaluate(() => window.__shell.navigate({ name: 'home' }));
await page.waitForFunction('window.__screenReady === true', null, { timeout: 60_000 });
await page.evaluate(() => window.__shell.navigate({ name: 'characters' }));
await page.waitForFunction('window.__screenReady === true', null, { timeout: 60_000 });
const early = await shotAtFlag(page, 'select_at_screenReady');
// The control used to be `waitForTimeout(2500)` — a sleep, i.e. the same class of
// condition that let the defect hide. It is a PAINT CONDITION now, and the sleep stays
// only as a floor for timed content underneath it.
const settled = await settleScreen(page, { label: 'characters', soft: true });
await page.waitForTimeout(2500);
const late = await shotSettled(page, 'select_settled');
say('same screen, shot at __screenReady', `stdev ${early.stdev} mean ${early.mean}  painted=${early.painted}${early.painted ? '' : ` (${early.why.join('; ')})`}`);
say('same screen, shot once PROVEN painted', `stdev ${late.stdev} mean ${late.mean}  settled in ${settled.settleMs ?? '?'}ms`);
say('paint state once settled', describe(settled));

writeFileSync(`${OUT}/report.json`, JSON.stringify({ base: BASE, rows, trace, early, late }, null, 2));
console.log(`\n-> ${OUT}`);
await browser.close();
