'use strict';
// Real-data finding, off a real UBA statement: two separate ways a transaction's displayed narration
// could come out wrong.
//
// (1) Some rows carry NO narration text on their own dated/amount line at all — the whole description
// sits entirely on a wrapped continuation line below it. Before this fix, the code always started
// narration-cleanup from the row's own (empty) text, then re-appended the wrapped continuation on top of
// the UNCLEANED original — producing a narration that still showed the raw date/amount prefix, and in
// some cases duplicated the wrapped text a second time.
//
// (2) Page footer/header boilerplate ("Download App | Chat with Leo | Our Website", "Head Office: ...")
// sitting right after a transaction's row, with no date and no amount of its own, used to get silently
// absorbed as if it were wrapped narration text.
//
// This fixture (fictional identity/account/amounts) reproduces both patterns in one small statement.
const assert = require('assert');
const path = require('path');
const { passConsentGate, goToSessionByPill, newPageAt } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'wrapped-narration-cleanup-fixture.pdf');

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
    var msgHtml = await page.$eval('#stmtAnalyzeMsg', function(el){ return el.innerHTML; });
    assert.ok(/Detected 2 transaction\(s\)/.test(msgHtml), 'Should detect both transactions, got: ' + msgHtml.slice(0, 500));

    var inflowsHtml = await page.$eval('#topInflowsBox', function(el){ return el.innerHTML; });

    // Transaction 1: narration should show the real (wrapped) description, cleanly — no leftover raw
    // date/amount text, and no duplication of the wrapped text.
    assert.ok(/SUNRISE FRESH PRODUCE VENTURES LTD.{0,10}SALARY MAY/is.test(inflowsHtml),
      'Should show the real wrapped-narration text for transaction 1, got: ' + inflowsHtml.slice(0, 2000));
    assert.ok(!/05-May-2025/.test(inflowsHtml.split('SUNRISE')[1] || ''),
      'Should not re-show the raw date inside the narration cell, got: ' + inflowsHtml.slice(0, 2000));
    var salaryMayCount = (inflowsHtml.match(/SALARY MAY/g) || []).length;
    assert.strictEqual(salaryMayCount, 1, 'The wrapped narration text should appear exactly once, not duplicated, got: ' + inflowsHtml.slice(0, 2000));

    // Transaction 2: footer/header boilerplate must never bleed into a narration.
    assert.ok(!/Download App|Chat with Leo|Our Website|Head Office/i.test(inflowsHtml),
      'Page footer/header boilerplate should never be absorbed into a transaction narration, got: ' + inflowsHtml.slice(0, 2000));
    assert.ok(/TNF-JOHN ADEYEMI/.test(inflowsHtml), 'Should still show transaction 2\'s real narration, got: ' + inflowsHtml.slice(0, 2000));
  } finally {
    await page.context().close();
  }
};
