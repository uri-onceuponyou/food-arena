#!/usr/bin/env node
/**
 * pu_boot — load a URL headless, report `__screen` and every page error.
 * Used to reproduce the dev-server duplicate-key throw and to prove a build boots.
 * Usage: node tools/tmp/pu_boot.mjs <url> [--wait ms]
 */
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://127.0.0.1:5210/';
const wi = process.argv.indexOf('--wait');
const wait = wi >= 0 ? Number(process.argv[wi + 1]) : 7000;
const b = await chromium.launch();
const pg = await b.newPage();
const errs = [];
pg.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message.split('\n').slice(0, 5).join(' | ')));
pg.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 400)); });
await pg.goto(url, { waitUntil: 'load' }).catch((e) => errs.push('GOTO: ' + e.message.split('\n')[0]));
await pg.waitForTimeout(wait);
const screen = await pg.evaluate(() => window.__screen ?? null).catch(() => null);
console.log(`url=${url}`);
console.log(`boot: __screen=${screen}`);
console.log(errs.length ? `${errs.length} error(s):\n  ` + errs.slice(0, 8).join('\n  ') : 'zero page errors');
await b.close();
process.exit(errs.length ? 1 : 0);
