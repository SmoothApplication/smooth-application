'use strict';
// User report, off a real matched-inflow list: two already-explained boxes ("Sun Jul 19 2026 —
// ₦100,000" and "Tue Jul 21 2026 — ₦55,000") "are meant to collapse after filling" but stayed expanded.
// Every matched inflow is auto-tagged and rendered collapsed the first time it's shown (see
// matched-income-inflows-itemized.test.js) — but opening one via "✏️ Edit" to double-check an unusual
// narration, then clicking away WITHOUT changing anything, used to leave it stuck open forever: the only
// thing that ever re-collapsed a box was the save flow, which only runs on an actual edit. This locks in
// the fix — once focus leaves an already-explained box entirely, it tidies itself away again, matching
// the same "auto-tidy" pattern used everywhere else on this page.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

var INFLOW_STATEMENT = path.join(__dirname, 'fixtures', 'employer-inflow-narration.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    await goToSessionByPill(page, 3);
    await page.fill('#f_name', 'Test Applicant');
    await page.selectOption('#f_workStatus', 'both');
    await page.fill('#f_employerName', 'MFM Lekki Youth Church');
    await page.fill('#f_businessName', 'Crisp N Clean Exclusive Solutions Ltd');

    await goToSessionByPill(page, 4);
    await page.setInputFiles('#stmtFile1', INFLOW_STATEMENT);
    await page.click('#btnAnalyzeStatements');
    await page.waitForSelector('#matchedIncomeInflowsBox .explain-box', { timeout: 20000 });
    await page.waitForTimeout(300);

    // Open an already-explained box (same as clicking "✏️ Edit" to double-check it)...
    await page.click('#matchcollapsed_0');
    await page.waitForSelector('#match_cat_0');
    var stillFilled = await page.$eval('#matchbox_0', function(el){ return el.classList.contains('explained'); });
    assert.strictEqual(stillFilled, true, 'The reopened box should still show as explained (nothing was cleared just by opening it)');

    // ...then click somewhere else entirely WITHOUT changing anything — no select change, no typing.
    await page.click('body');
    await page.waitForFunction(function(){
      var box = document.getElementById('matchbox_0');
      return box && box.classList.contains('collapsed');
    }, { timeout: 3000 });

    var stillExplained = await page.$eval('#matchbox_0', function(el){ return el.classList.contains('explained') && el.classList.contains('collapsed'); });
    assert.strictEqual(stillExplained, true, 'Should tidy itself back to collapsed once focus leaves, even with no edit made');

    // And its underlying explanation should be untouched, not cleared out by the blur handler.
    var summary = await page.$eval('#matchbox_0 .tx-line', function(el){ return el.textContent; });
    assert.ok(/— Allowance$/.test(summary), 'The original auto-tagged explanation should survive an open-then-blur with no edits, got: ' + summary);
  } finally {
    await page.context().close();
  }
};
