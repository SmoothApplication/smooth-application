'use strict';
// User feedback, off a real 928-transaction statement: a declared business name is unrelated to
// another sender whose name merely shares one ordinary word — an unrelated payment narrated
// "NIP/PBNL/HOMES DEALS VENTURES/..." was wrongly counted as an inflow from "Bright Homes Cleaning
// Solutions Ltd" purely because both names share the single ordinary word "HOMES". findInflowsMatchingName
// now requires at least 2 of the declared name's distinctive words to appear in a transaction's
// narration (not just 1) before counting it as a match, so a genuine "BRIGHT HOMES CLEANING SOLUTIONS"
// payment still matches (it shares BRIGHT + HOMES + CLEANING + SOLUTIONS), while "HOMES DEALS
// VENTURES" — sharing only HOMES — no longer does.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'false-positive-name-match.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    await goToSessionByPill(page, 3);
    await page.fill('#f_name', 'Test Applicant');
    await page.selectOption('#f_workStatus', 'selfEmployed');
    await page.fill('#f_businessName', 'Bright Homes Cleaning Solutions Ltd');

    await goToSessionByPill(page, 4); // 'Financial readiness'
    await page.setInputFiles('#stmtFile1', FIXTURE);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 20000 });
    await page.waitForTimeout(300);
    var html = await page.$eval('#stmtAnalyzeMsg', function(el){ return el.innerHTML; });

    // Only the genuine "Bright Homes Cleaning Solutions" payment should count — the unrelated "Homes
    // Deals Ventures" payment (sharing only the single word "HOMES") must NOT be folded in.
    assert.ok(/Found "Bright Homes Cleaning Solutions Ltd" as the sender on 1 inflow/i.test(html),
      'Should count exactly 1 genuine business inflow, not fold in the unrelated "Homes Deals Ventures" payment, got: ' + html);
    assert.ok(/totaling ₦350,000/.test(html), 'The single genuine inflow should total ₦350,000, got: ' + html);
    assert.ok(!/₦425,000/.test(html), 'Should not total in the unrelated ₦75,000 "Homes Deals Ventures" payment, got: ' + html);

    var boxCount = await page.$$eval('#matchedIncomeInflowsBox .explain-box', function(els){ return els.length; });
    assert.strictEqual(boxCount, 1, 'Should render exactly 1 matched-inflow box, not one for "Homes Deals Ventures" too, got: ' + boxCount);

    var boxNarration = await page.$eval('#matchedIncomeInflowsBox', function(el){ return el.textContent; });
    assert.ok(!/HOMES DEALS VENTURES/i.test(boxNarration), 'The unrelated "Homes Deals Ventures" narration should not appear among the matched business inflows, got: ' + boxNarration);
  } finally {
    await page.context().close();
  }
};
