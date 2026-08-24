'use strict';
// Real-data finding, off a real First Bank statement: its account-summary info box prints its own
// labels — "Pending Debit:", "Available Balance:", "Total Credit:", "Total Debit:" — as a vertically
// stacked label column, all left-aligned at the exact same x-position (one label per row). Each one
// independently satisfies one of the debit/credit/balance keyword lists detectColumns matches against,
// and because they share that x-position, matching them across separate lines (rather than requiring
// they name all three columns TOGETHER on one row, like a genuine table header does) wired
// debit/credit/balance up to the info box's label column instead of the real transaction table header —
// corrupting the debit/credit/balance assignment for every single transaction: a debit-only row's
// BALANCE value ended up recorded as its credit amount, and vice versa.
//
// detectColumns now requires debit/credit/balance to co-occur on the SAME physical line, which only a
// genuine header row does. This fixture (fictional identity/account/amounts, but the same structural
// info-box layout that caused the real bug) reproduces it and checks it's fixed.
const assert = require('assert');
const path = require('path');
const { passConsentGate, goToSessionByPill, newPageAt } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'infobox-column-collision-fixture.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 1); // finance2 = Income & bank statement analysis
    await page.setInputFiles('#stmtFile1', FIXTURE);
    await page.waitForTimeout(300);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction|Couldn.t automatically detect/.test(el.textContent);
    }, { timeout: 15000 });
    await page.waitForTimeout(300);
    var html = await page.$eval('#stmtAnalyzeMsg', function(el){ return el.innerHTML; });

    assert.ok(/Detected 2 transaction\(s\)/.test(html),
      'Should detect both transactions despite the info box sharing a label x-position, got: ' + html.slice(0, 500));

    // The real bug reflected each row's BALANCE as its credit amount and left the actual inflow
    // (₦30,000) undetected — check the cash-flow table's auto-filled figures directly, not just that
    // parsing "succeeded", since a wrong debit/credit split would still show "Detected 2 transaction(s)".
    var inflow = await page.$eval('#cf_in_1', function(el){ return el.value; });
    var outflow = await page.$eval('#cf_out_1', function(el){ return el.value; });
    assert.strictEqual(inflow, '30000', 'The ₦30,000 credit should be read as inflow, not the row balance, got inflow=' + inflow);
    assert.strictEqual(outflow, '500', 'The ₦500 debit should be read as outflow, not the row balance, got outflow=' + outflow);
  } finally {
    await page.context().close();
  }
};
