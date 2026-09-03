'use strict';
// Mockup "2e" (desktop statement-analysis dashboard): the finance session's tab bar collapses to 2
// primary tabs — "Upload statements" and "What your statement shows" — with the old 4 report tabs
// (Cash flow & scores / Income sources breakdown / Workplace income / Report) demoted to a secondary
// row only shown once you're past Upload, and the deepest individual boxes reachable straight from
// an "Advanced details" dropdown. See the comment on .fin-steps-nav in index.html.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 4); // finance2 — 'Income & bank statement analysis'
    await page.waitForSelector('.fin-advanced-menu');

    // Exactly 2 primary tabs, and the secondary row starts hidden (we're on Upload).
    var primaryLabels = await page.$$eval('.fin-step-tab-primary', function(els){ return els.map(function(e){ return e.textContent; }); });
    assert.deepStrictEqual(primaryLabels, ['1. Upload statements', '2. What your statement shows'],
      'Should show exactly 2 primary tabs, got: ' + primaryLabels.join(', '));
    var substepsVisible = await page.$eval('#finSubstepsNav', function(el){ return el.classList.contains('visible'); });
    assert.strictEqual(substepsVisible, false, 'The secondary report tabs should stay hidden while on Upload');

    // Menu lists all 5 shortcuts, closed by default.
    var isOpen = await page.$eval('.fin-advanced-menu', function(el){ return el.open; });
    assert.strictEqual(isOpen, false, 'Advanced details menu should start closed');
    var itemLabels = await page.$$eval('.fin-advanced-item', function(els){ return els.map(function(e){ return e.textContent; }); });
    assert.deepStrictEqual(itemLabels, ['Top 10 inflows', 'Most consistent senders', 'Income sources breakdown', 'Workplace income', 'Download spreadsheet'],
      'Advanced details menu should list all 5 shortcuts in order, got: ' + itemLabels.join(', '));

    // Clicking "Workplace income" enters results mode, activates the matching secondary tab, and
    // closes the dropdown again.
    await page.click('.fin-advanced-menu summary');
    await page.click('.fin-advanced-item[data-fin-jump-box="employerIncomeInflowsBox"]');
    await page.waitForTimeout(150);
    var activeSubtab = await page.$eval('#finSubstepsNav .fin-step-tab.active', function(el){ return el.getAttribute('data-fin-step'); });
    assert.strictEqual(activeSubtab, '4', 'Clicking "Workplace income" in the dropdown should activate the Workplace income sub-tab');
    var resultsBtnActive = await page.$eval('#finResultsTabBtn', function(el){ return el.classList.contains('active'); });
    assert.strictEqual(resultsBtnActive, true, '"What your statement shows" should read as active once inside results');
    var substepsVisibleNow = await page.$eval('#finSubstepsNav', function(el){ return el.classList.contains('visible'); });
    assert.strictEqual(substepsVisibleNow, true, 'The secondary report tabs should reveal themselves once past Upload');
    var menuStillOpen = await page.$eval('.fin-advanced-menu', function(el){ return el.open; });
    assert.strictEqual(menuStillOpen, false, 'The dropdown should close itself after a jump');

    // The individual sub-tabs are still there and still directly clickable, e.g. jumping straight
    // to "Income sources breakdown" without going through Cash flow & scores first.
    await page.click('#finSubstepsNav .fin-step-tab[data-fin-step="3"]');
    var nowOnThree = await page.$eval('#finSubstepsNav .fin-step-tab.active', function(el){ return el.getAttribute('data-fin-step'); });
    assert.strictEqual(nowOnThree, '3', 'Sub-tabs should still be individually clickable');

    // Going back to "1. Upload statements" hides the secondary row and clears the results tab's
    // active state again.
    await page.click('.fin-step-tab[data-fin-step="1"]');
    var backOnUpload = await page.$eval('.fin-step-tab-primary[data-fin-step="1"]', function(el){ return el.classList.contains('active'); });
    assert.strictEqual(backOnUpload, true, 'Clicking "Upload statements" should activate it');
    var resultsBtnInactive = await page.$eval('#finResultsTabBtn', function(el){ return el.classList.contains('active'); });
    assert.strictEqual(resultsBtnInactive, false, '"What your statement shows" should no longer read as active');
    var substepsHiddenAgain = await page.$eval('#finSubstepsNav', function(el){ return el.classList.contains('visible'); });
    assert.strictEqual(substepsHiddenAgain, false, 'The secondary report tabs should hide again once back on Upload');
  } finally {
    await page.context().close();
  }
};
