'use strict';
// "Business Income Record" — the safer alternative built after firmly declining a request to
// auto-generate receipts matching business-statement inflows (a manufactured, amount-matched
// document is a false document under UK Home Office rules). This instead lets the applicant add
// their own honest "who paid / what for" note on each incoming payment the business statement
// analyzer already detected, then compiles those notes into one clean, dated-today record —
// explicitly labelled as the applicant's own account, never styled as a receipt.
//
// Covers: the card only appears (as its own session) once self-employed; scanning a business
// statement populates one row per credit inflow; typing a note updates the live "N of M noted"
// count; and "Build my Business Income Record" compiles a table that reflects what was typed,
// including an honest "(not specified)" + warning for any row left blank.
const assert = require('assert');
const path = require('path');
const { passConsentGate, goToSessionByPill, goToSessionByLabel, newPageAt } = require('./helpers');

// Reused from business-statement-analysis-error-surfaces.test.js — already proven to parse as a
// business statement with 4 real credit inflows (3x "SALARY PAYMENT ABC LTD" @ 450,000 + one
// blank-narration credit of 500,000), and 2 debit-only lines that must NOT turn into ledger rows.
var GOOD_FIXTURE = path.join(__dirname, 'fixtures', 'bank-statement-sample.pdf');

async function revealBizFinanceItem(page){
  await goToSessionByPill(page, 3); // trip session — Work status lives here
  await page.selectOption('#f_workStatus', 'selfEmployed');
  await page.fill('#f_businessName', 'Golden Bloom Cleaning Services Ltd');
  await page.waitForTimeout(150);
  await goToSessionByPill(page, 7); // 0 passport, 1 travelExperience, 2 responsibilities, 3 trip, 4 finance2, 5 finance, 6 cat:Identity & application, 7 cat:Financial evidence
  await page.waitForSelector('#file_bizFinance', { timeout: 5000 });
}

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    // Not self-employed yet — the session shouldn't exist at all, so a hardcoded-index test suite
    // elsewhere navigating past 'finance2' by pill number never lands on an empty ledger page.
    var hasBizLedgerPillYet = await page.evaluate(function(){
      return Array.prototype.some.call(document.querySelectorAll('.session-pill'), function(p){
        return (p.getAttribute('title') || '').indexOf('Business Income Record') === 0;
      });
    });
    assert.strictEqual(hasBizLedgerPillYet, false, 'Business Income Record should have no session pill before self-employed is set');

    await revealBizFinanceItem(page);
    await page.setInputFiles('#file_bizFinance', GOOD_FIXTURE);
    await page.waitForTimeout(300);
    await page.click('#scan_bizFinance');
    await page.waitForTimeout(8000);

    var scanHtml = await page.$eval('#scanmsg_bizFinance', function(el){ return el.innerHTML; });
    assert.ok(/4 incoming payment/.test(scanHtml), 'Scan result should point the applicant at the new Business Income Record section, got: ' + scanHtml.slice(0, 600));

    // Now the session should exist, and be reachable by its own pill label.
    await goToSessionByLabel(page, 'Business Income Record');
    await page.waitForSelector('#bizLedgerRows .explain-box', { timeout: 5000 });

    var introVisible = await page.$eval('#bizLedgerIntro', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(introVisible, false, 'The "scan your statement" intro should hide once credits are found');

    var rowCount = await page.$$eval('#bizLedgerRows .explain-box', function(els){ return els.length; });
    assert.strictEqual(rowCount, 4, 'Expected one ledger row per credit inflow (4 on this fixture), got ' + rowCount);

    var countText0 = await page.$eval('#bizLedgerCount', function(el){ return el.textContent; });
    assert.ok(/^0 of 4 payment\(s\) noted/.test(countText0), 'Should start at 0 of 4 noted, got: ' + countText0);

    // Note two of the four payments — deliberately leaving the other two blank to check the
    // "(not specified)" honesty fallback below, rather than silently inventing something for them.
    await page.fill('#bizPayer_0', 'Chidinma Okeke');
    await page.fill('#bizPurpose_0', 'Payment for cleaning contract, February');
    await page.waitForTimeout(700); // debounce
    await page.fill('#bizPayer_1', 'Walk-in customer');
    await page.fill('#bizPurpose_1', 'Cleaning supplies sold in shop');
    await page.waitForTimeout(700);

    var countText2 = await page.$eval('#bizLedgerCount', function(el){ return el.textContent; });
    assert.ok(/^2 of 4 payment\(s\) noted/.test(countText2), 'Live count should update as rows are filled in, got: ' + countText2);
    var row0Explained = await page.$eval('#bizLedgerRow_0', function(el){ return el.classList.contains('explained'); });
    assert.strictEqual(row0Explained, true, 'A fully-noted row should pick up the .explained styling');

    await page.click('#btnBuildBizLedger');
    await page.waitForSelector('.biz-income-record', { timeout: 3000 });
    var outputHtml = await page.$eval('#bizLedgerOutput', function(el){ return el.innerHTML; });

    assert.ok(/Business Income Record — Golden Bloom Cleaning Services Ltd/.test(outputHtml), 'Should title the record with the applicant\'s own business name, got: ' + outputHtml.slice(0, 400));
    assert.ok(/Chidinma Okeke/.test(outputHtml) && /cleaning contract, February/.test(outputHtml), 'Typed payer/purpose should appear in the compiled record');
    assert.ok(/Walk-in customer/.test(outputHtml) && /supplies sold in shop/.test(outputHtml), 'Second typed row should also appear');
    assert.ok(/not a receipt issued at the time/.test(outputHtml), 'Must explicitly disclaim this is the applicant\'s own account, not a contemporaneous receipt, got: ' + outputHtml.slice(0, 700));
    // Scoped to table cells specifically (not the whole output) — the warning banner right above the
    // table also contains the literal phrase `(not specified)` as part of its own wording, which a
    // whole-output count would double-count against.
    var unspecifiedCount = await page.$$eval('.biz-income-record table td', function(tds){
      return tds.filter(function(td){ return td.textContent.trim() === '(not specified)'; }).length;
    });
    assert.strictEqual(unspecifiedCount, 4, 'The 2 un-noted rows should show "(not specified)" for both payer and purpose (2 rows x 2 fields), got ' + unspecifiedCount);
    assert.ok(/still say "\(not specified\)"/.test(outputHtml), 'Should warn that some rows are still unspecified before attaching, got: ' + outputHtml.slice(0, 400));
  } finally {
    await page.context().close();
  }
};
