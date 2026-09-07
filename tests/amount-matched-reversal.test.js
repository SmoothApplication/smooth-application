'use strict';
// Real-data finding, off a real Fidelity Bank statement: a failed POS/transfer attempt can be
// reversed WITHOUT any "RVSL"/"RSVL"/"reversal" keyword in either line's narration - the credit
// simply repeats the same merchant/reference description as the debit it's undoing (a real example:
// "ONB TRF TO POS Transf **7126 Green atarodo & red" debited, then an identical-looking credit for
// the exact same amount two rows later). Before this fix, that credit resurfaced as a brand-new
// "unexplained inflow" from a merchant-shaped non-name ("Green Atarodo Red") - not a real sender at
// all, and exactly the kind of false flag that could send an applicant chasing an explanation for
// money that never actually arrived.
//
// markAmountMatchedReversals() now flags a credit as a reversal when its amount exactly matches an
// earlier (within a few days) debit AND the two narrations share enough distinctive words to
// plausibly describe the same transaction - checked here via the fixture's own synthetic reproduction
// of that exact pattern (details anonymized, not the real statement). Also checks the ORIGINAL
// keyword-based reversal detection (a narration literally containing "RVSL") still works unchanged,
// and that an unrelated normal recurring sender is unaffected by either check.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill, goToFinanceStep } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'amount-matched-reversal-fixture.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 4); // Income & bank statement analysis

    await page.setInputFiles('#stmtFile1', FIXTURE);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 20000 });
    await page.waitForTimeout(400);

    // #topInflowsBox lives on Step 5 ("Report"), not wherever analysis leaves the page - see the
    // .fin-step[data-fin-step="5"] markup in index.html.
    await goToFinanceStep(page, 5);
    await page.click('#topInflowsGroup summary');
    var rows = await page.$$eval('#topInflowsBox tbody tr', function(trs){
      return trs.map(function(tr){
        var tds = Array.from(tr.querySelectorAll('td'));
        return { amount: tds[2] ? tds[2].textContent.trim() : '', narrationCell: tds[3] ? tds[3].innerHTML : '' };
      });
    });

    // The silent (no-keyword) amount-matched reversal: the ₦8,400.00 credit that undoes the earlier
    // ₦8,400.00 "Star Supermarket Groceries" debit must be tagged Reversal, not Personal/Company.
    var silentReversalRow = rows.filter(function(r){ return /8,400(\.00)?/.test(r.amount); })[0];
    assert.ok(silentReversalRow, 'The ₦8,400.00 reversal credit should appear in the top inflows list, got: ' + JSON.stringify(rows));
    assert.ok(/src-tag reversal/.test(silentReversalRow.narrationCell) && /Reversal/.test(silentReversalRow.narrationCell),
      'A same-amount, same-narration credit reversing an earlier debit (no RVSL keyword) should be tagged Reversal, got: ' + silentReversalRow.narrationCell);
    assert.ok(!/src-tag (personal|company)/.test(silentReversalRow.narrationCell),
      'The reversal credit must NOT be tagged as a new Personal/Company income source, got: ' + silentReversalRow.narrationCell);

    // The original keyword-based reversal (narration literally contains "RVSL") must still work.
    var keywordReversalRow = rows.filter(function(r){ return /5,000(\.00)?/.test(r.amount); })[0];
    assert.ok(keywordReversalRow, 'The ₦5,000.00 RVSL credit should appear in the top inflows list, got: ' + JSON.stringify(rows));
    assert.ok(/src-tag reversal/.test(keywordReversalRow.narrationCell) && /Reversal/.test(keywordReversalRow.narrationCell),
      'A narration containing "RVSL" should still be tagged Reversal, got: ' + keywordReversalRow.narrationCell);

    // A normal, unrelated recurring sender (Jane Doe, two separate ₦100,000 credits) must be
    // completely unaffected - shown as a real Personal inflow, never as a Reversal.
    var janeDoeRows = rows.filter(function(r){ return /100,000(\.00)?/.test(r.amount); });
    assert.strictEqual(janeDoeRows.length, 2, 'Both Jane Doe credits should appear in the top inflows list, got: ' + JSON.stringify(rows));
    janeDoeRows.forEach(function(r){
      assert.ok(/JANE DOE/i.test(r.narrationCell), 'Jane Doe credit narration should be shown as-is, got: ' + r.narrationCell);
      assert.ok(/src-tag personal/.test(r.narrationCell), 'A normal recurring sender must be tagged Personal, not Reversal, got: ' + r.narrationCell);
      assert.ok(!/src-tag reversal/.test(r.narrationCell), 'A normal recurring sender must never be tagged Reversal, got: ' + r.narrationCell);
    });
  } finally {
    await page.context().close();
  }
};
