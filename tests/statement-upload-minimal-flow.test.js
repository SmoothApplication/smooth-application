'use strict';
// Mockup 2d: Step 1 of "Income & bank statement analysis" leads with a single account, reveals a
// second/third only via "Add another account", carries a "runs on your phone" reassurance note next
// to the Analyze button, and reports a "Ready · N month(s) detected" chip once analysis completes
// (rather than a bare "analyzed" bar) — see the comments on #stmtFile2Row/hideStatementUploadForm in
// index.html.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

// Same fixture financial-summary-table.test.js uses — 4 known months (Jan-Apr), so the "N month(s)
// detected" count this test checks for is a known, already-documented quantity.
var FIXTURE = path.join(__dirname, 'fixtures', 'consistent-senders-fixture.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 4); // finance2 — holds #stmtFile1/#btnAnalyzeStatements
    await page.waitForSelector('#stmtFile1');

    // --- Starts minimal: only the first statement picker showing --------------------------------
    var row1Visible = await page.$eval('#stmtFile1', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(row1Visible, true, 'The first statement picker should always be visible');
    var row2Hidden = await page.$eval('#stmtFile2Row', function(el){ return getComputedStyle(el).display === 'none'; });
    assert.strictEqual(row2Hidden, true, 'Statement 2 should start hidden');
    var row3Hidden = await page.$eval('#stmtFile3Row', function(el){ return getComputedStyle(el).display === 'none'; });
    assert.strictEqual(row3Hidden, true, 'Statement 3 should start hidden');

    var localNoteText = await page.$eval('.stmt-local-note', function(el){ return el.textContent; });
    assert.ok(/runs on your phone/i.test(localNoteText), 'Should carry the "runs on your phone" reassurance note next to Analyze, got: ' + localNoteText);

    // --- "Add another account" reveals statement 2, then statement 3, then hides itself -----------
    await page.click('#btnStmtAddAccount');
    var row2VisibleNow = await page.$eval('#stmtFile2Row', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(row2VisibleNow, true, 'First click on "Add another account" should reveal statement 2');
    var row3StillHidden = await page.$eval('#stmtFile3Row', function(el){ return getComputedStyle(el).display === 'none'; });
    assert.strictEqual(row3StillHidden, true, 'Statement 3 should stay hidden after only one click');

    await page.click('#btnStmtAddAccount');
    var row3VisibleNow = await page.$eval('#stmtFile3Row', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(row3VisibleNow, true, 'Second click should reveal statement 3');
    var addBtnHiddenNow = await page.$eval('#btnStmtAddAccount', function(el){ return getComputedStyle(el).display === 'none'; });
    assert.strictEqual(addBtnHiddenNow, true, '"Add another account" should hide itself once the 3-statement cap is reached');

    // --- Analyzing shows a "Ready · N month(s) detected" chip, not a bare "analyzed" line ----------
    await page.setInputFiles('#stmtFile1', FIXTURE);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 20000 });
    await page.waitForTimeout(300);

    var doneBarText = await page.$eval('#stmtUploadDoneBarText', function(el){ return el.textContent; });
    assert.strictEqual(doneBarText, 'Ready · 4 months detected', 'Should report the actual month count detected, got: ' + doneBarText);
  } finally {
    await page.context().close();
  }
};
