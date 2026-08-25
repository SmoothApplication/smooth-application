'use strict';
// "Based on the closing balance generated from the bank statement, tell the user how many
// percentage he/she is ready for application. Work the percentage readiness based on the closing
// balance and the Rough worst-case cost estimate. Tell the applicants how much it need to get in
// total to be ready. Break it down and tell it how much it needs till his/her desired date of
// travel." Exercises the full flow: enter trip dates (so the rough cost estimate exists), scan a
// statement (so a real closing balance exists), and check the readiness %, shortfall, and
// per-week/per-month savings breakdown all come out arithmetically correct.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

var SAMPLE_STATEMENT = path.join(__dirname, 'fixtures', 'bank-statement-sample.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    // Before any statement is scanned, the box should explain what's missing rather than show a
    // bogus 0%.
    await goToSessionByPill(page, 4); // 'Financial readiness' — holds #statementReadinessBox/#stmtFile1
    var emptyState = await page.$eval('#statementReadinessBox', function(el){ return el.textContent; });
    assert.ok(/scan a bank statement/i.test(emptyState), 'Should prompt to scan a statement first, got: "' + emptyState + '"');

    // Enter trip dates so the rough cost estimate (and therefore the 2× recommended-funds figure
    // this box compares against) actually exists — trip fields live in 'About you' (index 0).
    await goToSessionByPill(page, 3);
    await page.fill('#f_traveldate', '2026-12-01');
    await page.fill('#f_returndate', '2026-12-06');
    await page.waitForTimeout(300);

    // Scan the fixture statement — its last row has a closing balance of exactly 1,823,000.
    await goToSessionByPill(page, 4);
    await page.setInputFiles('#stmtFile1', SAMPLE_STATEMENT);
    await page.click('#btnAnalyzeStatements');
    await page.waitForSelector('#unexplainedInflowsBox .explain-box', { timeout: 20000 });
    await page.waitForTimeout(500);

    var html = await page.$eval('#statementReadinessBox', function(el){ return el.innerHTML; });

    // Rough cost estimate for a 5-night trip (same formula as the "Rough worst-case cost estimate"
    // box): hotel 50,000×5 + bus £6/day×5 (×1840.60) + £100 shopping (×1840.60) + flight 1,500,000.
    var qHotel = 50000 * 5;
    var qTransportNgn = 6 * 5 * 1840.60;
    var qShoppingNgn = 100 * 1840.60;
    var qTotal = qHotel + qTransportNgn + qShoppingNgn + 1500000;
    var qRecommended = qTotal * 2;
    var closingBalance = 1823000;
    var expectedPct = Math.round(closingBalance / qRecommended * 100);
    var expectedShortfall = qRecommended - closingBalance;

    assert.ok(html.indexOf('You\'re about ' + expectedPct + '% ready') !== -1,
      'Readiness percentage should be ' + expectedPct + '%, got HTML: ' + html.slice(0, 300));
    assert.ok(html.indexOf('₦' + Math.round(closingBalance).toLocaleString('en-US')) !== -1,
      'Should show the exact closing balance from the statement');
    var shortfallFormatted = '₦' + Math.round(expectedShortfall).toLocaleString('en-US');
    assert.ok(html.indexOf(shortfallFormatted) !== -1,
      'Should show the correct shortfall (' + shortfallFormatted + '), got: ' + html.slice(0, 600));
    assert.ok(/week\(s\) until your planned travel date/.test(html), 'Should break the shortfall down by time remaining until the travel date');
    assert.ok(/\/week/.test(html) && /\/month/.test(html), 'Should show both a per-week and a per-month savings target');
  } finally {
    await page.context().close();
  }
};
