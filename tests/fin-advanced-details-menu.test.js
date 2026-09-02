'use strict';
// Mockup "2e" (desktop statement-analysis dashboard) proposed collapsing the finance session's 6
// tabs down to 2, with the deeper breakdowns tucked into an "Advanced details" dropdown. Rebuilding
// the tab bar itself risked breaking every existing test hardcoded to
// .fin-step-tab[data-fin-step="N"] (goToFinanceStep in helpers.js) for a screen most people never
// revisit — so all 5 tabs stay exactly as they were, and this dropdown ADDS the one thing the
// mockup's version was really solving for: jumping straight to one specific box on tabs 3/4/5
// without visiting each tab in turn. See the comment on .fin-advanced-menu in index.html.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 4); // finance2 — 'Income & bank statement analysis'
    await page.waitForSelector('.fin-advanced-menu');

    // Menu lists all 5 shortcuts, closed by default.
    var isOpen = await page.$eval('.fin-advanced-menu', function(el){ return el.open; });
    assert.strictEqual(isOpen, false, 'Advanced details menu should start closed');
    var itemLabels = await page.$$eval('.fin-advanced-item', function(els){ return els.map(function(e){ return e.textContent; }); });
    assert.deepStrictEqual(itemLabels, ['Top 10 inflows', 'Most consistent senders', 'Income sources breakdown', 'Workplace income', 'Download spreadsheet'],
      'Advanced details menu should list all 5 shortcuts in order, got: ' + itemLabels.join(', '));

    // Clicking "Workplace income" jumps to tab 4 and closes the menu again.
    await page.click('.fin-advanced-menu summary');
    await page.click('.fin-advanced-item[data-fin-jump-box="employerIncomeInflowsBox"]');
    await page.waitForTimeout(150);
    var activeTab = await page.$eval('.fin-step-tab.active', function(el){ return el.getAttribute('data-fin-step'); });
    assert.strictEqual(activeTab, '4', 'Clicking "Workplace income" in the dropdown should activate tab 4');
    var menuStillOpen = await page.$eval('.fin-advanced-menu', function(el){ return el.open; });
    assert.strictEqual(menuStillOpen, false, 'The dropdown should close itself after a jump');

    // The existing tabs are completely untouched — still there, still individually clickable.
    await page.click('.fin-step-tab[data-fin-step="1"]');
    var backOnUpload = await page.$eval('.fin-step-tab.active', function(el){ return el.getAttribute('data-fin-step'); });
    assert.strictEqual(backOnUpload, '1', 'The original tabs should still work exactly as before');
  } finally {
    await page.context().close();
  }
};
