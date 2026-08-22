import { chromium } from 'playwright';
import { settleScreen } from './settle.mjs';
const BASE = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 852, height: 393 }, deviceScaleFactor: 1 });
await p.goto(`${BASE}/?screen=home`, { waitUntil: 'networkidle' });
await p.waitForFunction('window.__screen === "home"');
await settleScreen(p, { label: 'home' });
console.log(JSON.stringify(await p.evaluate(() => {
  const kit = document.querySelector('.home-kit');
  const col = document.querySelector('.home-fighter');
  const cs = getComputedStyle(kit);
  // find the rule text
  let found = [];
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (const r of rules) {
      if (r.constructor.name === 'CSSMediaRule' && /max-height/.test(r.conditionText)) {
        for (const inner of r.cssRules) {
          found.push(`${inner.constructor.name}: ${(inner.conditionText || inner.selectorText || '').slice(0,80)}`);
        }
      }
    }
  }
  return {
    colWidth: col.getBoundingClientRect().width,
    containerType: getComputedStyle(col).containerType,
    gridAutoFlow: cs.gridAutoFlow,
    gridTemplateColumns: cs.gridTemplateColumns,
    kitH: kit.getBoundingClientRect().height,
    nameDisplay: getComputedStyle(document.querySelector('.home-kit-name')).display,
    innerRulesOfMediaMaxHeight: found,
  };
}, null), null, 1));
await b.close();
