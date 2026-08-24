'use strict';
// "Create a drop-down menu where the applicant picks, [salary, business, family, contribution,
// work, bonus, sales, gift & others]. Under 'others' give the applicants the chance to fill in the
// specifics." Applies to both the grouped "Income sources breakdown" boxes AND the per-transaction
// "large/unexplained inflow" boxes (which used to be a single free-text box before this change) —
// this test exercises the latter, using a synthetic bank statement (tests/fixtures) with one
// deliberately blank-narration credit so it's guaranteed to get flagged regardless of amount.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

var SAMPLE_STATEMENT = path.join(__dirname, 'fixtures', 'bank-statement-sample.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 1); // finance2 = Income & bank statement analysis

    await page.setInputFiles('#stmtFile1', SAMPLE_STATEMENT);
    await page.click('#btnAnalyzeStatements');
    await page.waitForSelector('#unexplainedInflowsBox .explain-box', { timeout: 20000 });

    // The dropdown should exist (not a free-text box) with exactly the requested options, in order,
    // plus a "Choose a reason…" placeholder.
    var optionTexts = await page.$$eval('#explain_cat_0 option', function(opts){ return opts.map(function(o){ return o.textContent; }); });
    assert.deepStrictEqual(
      optionTexts,
      ['Choose a reason…', 'Salary', 'Business', 'Family', 'Contribution', 'Work', 'Bonus', 'Sales', 'Gift',
        'Self (transfer from my own other account)', 'Reversal (a reversed/bounced-back payment)', 'Others'],
      'Dropdown options should match the requested list and order, got: ' + JSON.stringify(optionTexts)
    );

    // The free-text detail box should be hidden until "Others" is chosen.
    var othersHiddenInitially = await page.$eval('#explain_others_0', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(othersHiddenInitially, true, '"Others" detail box should start hidden');

    // Picking a non-"Others" category (Gift) should NOT reveal the detail box, and should save/collapse
    // to a one-line summary without requiring any free text.
    await page.selectOption('#explain_cat_0', 'gift');
    var othersHiddenAfterGift = await page.$eval('#explain_others_0', function(el){ return el.style.display === 'none'; });
    assert.strictEqual(othersHiddenAfterGift, true, '"Others" detail box should stay hidden when "Gift" is picked');
    await page.waitForFunction(function(){
      var box = document.getElementById('explainbox_0');
      return box && box.classList.contains('collapsed');
    }, { timeout: 3000 });
    var collapsedSummary = await page.$eval('#explainbox_0 .tx-line', function(el){ return el.textContent; });
    assert.ok(/Gift/.test(collapsedSummary), 'Collapsed summary should show "Gift", got: "' + collapsedSummary + '"');

    // Re-open, switch to "Others" — the detail box should appear and be required before it counts as
    // explained (an empty "Others" shouldn't auto-collapse as if it were filled in).
    await page.click('#explaincollapsed_0');
    await page.waitForSelector('#explain_cat_0');
    await page.selectOption('#explain_cat_0', 'others');
    var othersVisibleNow = await page.$eval('#explain_others_0', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(othersVisibleNow, true, '"Others" detail box should appear when "Others" is picked');
    await page.waitForTimeout(700); // let the debounced auto-save run with an empty detail field
    var stillExpandedWhenEmpty = await page.$eval('#explainbox_0', function(el){ return !el.classList.contains('collapsed'); });
    assert.strictEqual(stillExpandedWhenEmpty, true, 'An "Others" pick with no detail text yet should not auto-collapse as explained');

    await page.fill('#explain_detail_0', 'Wedding gift from my uncle');
    await page.waitForFunction(function(){
      var box = document.getElementById('explainbox_0');
      return box && box.classList.contains('collapsed');
    }, { timeout: 3000 });
    var finalSummary = await page.$eval('#explainbox_0 .tx-line', function(el){ return el.textContent; });
    assert.ok(/Others.*Wedding gift from my uncle/.test(finalSummary), 'Collapsed summary should include the "Others" detail text, got: "' + finalSummary + '"');
  } finally {
    await page.context().close();
  }
};
