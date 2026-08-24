'use strict';
// User feedback, off the live "Income & bank statement analysis" card: (1) the financial calculator's
// own "Current closing balance" field never auto-filled from an analyzed statement — the applicant had
// to notice the figure on their own statement and retype it by hand, even though the tool already
// detects it. (2) "Closing balance strength" (and the percentage shown under it) sat stuck on "Enter
// your figures" until the SEPARATE, more detailed financial calculator further down was filled in
// (flight/accommodation/transport), even once a statement had already been analyzed and a real closing
// balance detected. It now falls back to the same rough, dates-only 2x-buffer estimate already shown
// up in "Your trip details" whenever the detailed calculator hasn't been filled in yet.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

var SAMPLE_STATEMENT = path.join(__dirname, 'fixtures', 'bank-statement-sample.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    // Enter trip dates so the rough, dates-only cost estimate (and its 2x recommended-funds figure)
    // exists — same setup as statement-readiness.test.js.
    await goToSessionByPill(page, 0);
    await page.fill('#f_traveldate', '2026-12-01');
    await page.fill('#f_returndate', '2026-12-06');
    await page.waitForTimeout(300);

    // Before scanning anything, the badge should still read "Enter your figures" — nothing to compare yet.
    await goToSessionByPill(page, 1); // 'Financial readiness' — where fc_closing/balancePill/stmtFile1 live.
    var beforePill = await page.$eval('#balancePill', function(el){ return el.textContent; });
    assert.strictEqual(beforePill, 'Enter your figures', 'Should start unfilled before any statement is scanned');

    // Scan the fixture statement — its last row has a closing balance of exactly 1,823,000 — WITHOUT
    // touching the detailed financial calculator's flight/accommodation/transport fields at all.
    await page.setInputFiles('#stmtFile1', SAMPLE_STATEMENT);
    await page.click('#btnAnalyzeStatements');
    await page.waitForSelector('#unexplainedInflowsBox .explain-box', { timeout: 20000 });
    await page.waitForTimeout(500);

    // (1) fc_closing should now be auto-filled with the detected closing balance.
    var fcClosingVal = await page.$eval('#fc_closing', function(el){ return el.value; });
    assert.strictEqual(fcClosingVal, '1823000', 'The financial calculator\'s own closing-balance field should auto-fill from the analyzed statement, got: ' + fcClosingVal);

    // (2) The badge should now show a real status, not "Enter your figures" — using the rough,
    // dates-only estimate as a fallback since the detailed calculator is still untouched.
    var afterPill = await page.$eval('#balancePill', function(el){ return el.textContent; });
    assert.notStrictEqual(afterPill, 'Enter your figures', 'Should show a real status once a statement is analyzed, even without the detailed calculator filled in');

    var qHotel = 50000 * 5;
    var qTransportNgn = 6 * 5 * 1840.60;
    var qShoppingNgn = 100 * 1840.60;
    var qTotal = qHotel + qTransportNgn + qShoppingNgn + 1500000;
    var qRecommended = qTotal * 2;
    var closingBalance = 1823000;
    var expectedPct = Math.max(0, Math.min(100, Math.round(closingBalance / qRecommended * 100)));

    var pctHtml = await page.$eval('#balancePillPct', function(el){ return el.innerHTML; });
    assert.ok(pctHtml.indexOf('₦' + closingBalance.toLocaleString('en-US')) !== -1, 'Should show the exact detected closing balance, got: ' + pctHtml);
    assert.ok(pctHtml.indexOf('<b>' + expectedPct + '%</b>') !== -1, 'Should show the correct % of the rough 2x buffer estimate (' + expectedPct + '%), got: ' + pctHtml);
    assert.ok(/rough, dates-only trip-cost estimate/.test(pctHtml), 'Should say this is based on the rough estimate, not the detailed calculator, got: ' + pctHtml);

    // Auto-fill must never clobber a figure the applicant already typed themselves — re-run with
    // fc_closing pre-filled to a different number and confirm it's left untouched.
    var page2 = await newPageAt(ctx.browser, '/index.html');
    try {
      await passConsentGate(page2);
      await goToSessionByPill(page2, 1); // finance session — fc_closing lives here
      await page2.evaluate(function(){ document.querySelectorAll('details').forEach(function(d){ d.open = true; }); });
      await page2.fill('#fc_closing', '9999999');
      await goToSessionByPill(page2, 1);
      await page2.setInputFiles('#stmtFile1', SAMPLE_STATEMENT);
      await page2.click('#btnAnalyzeStatements');
      await page2.waitForSelector('#unexplainedInflowsBox .explain-box', { timeout: 20000 });
      await page2.waitForTimeout(500);
      var preservedVal = await page2.$eval('#fc_closing', function(el){ return el.value; });
      assert.strictEqual(preservedVal, '9999999', 'Should never overwrite a closing balance the applicant already typed in themselves, got: ' + preservedVal);
    } finally {
      await page2.context().close();
    }
  } finally {
    await page.context().close();
  }
};
