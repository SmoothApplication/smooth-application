'use strict';
// Real user report (via a live user, "Funmi"): her Sterling Bank statement "did not read" at all —
// zero transactions detected. Root cause: this statement uses DD/Mon/YYYY dates with SLASH separators
// (e.g. "14/Feb/2026"), which neither of parseLeadingDate's two relevant regexes matched (one requires
// an all-digit month, the other only allowed a space or hyphen before/after a month name — never a
// slash). It also labels its credit/debit columns "Money In"/"Money Out" rather than any of the
// previously-recognized header words, so even once dates parsed, column detection would still miss them.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

var STATEMENT = path.join(__dirname, 'fixtures', 'slash-date-money-columns-statement.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 1); // finance2 session — statement upload lives here
    await page.setInputFiles('#stmtFile1', STATEMENT);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 20000 });
    await page.waitForTimeout(300);
    var html = await page.$eval('#stmtAnalyzeMsg', function(el){ return el.innerHTML; });

    assert.ok(/Detected 3 transaction/.test(html), 'Should detect all 3 slash-dated rows, got: ' + html);

    var cf = await page.evaluate(function(){
      return {
        inflow: document.getElementById('cf_in_1').value,
        outflow: document.getElementById('cf_out_1').value,
        balance: document.getElementById('cf_bal_1').value
      };
    });
    // Row 1 is a "Money Out" (debit) 1,500; rows 2-3 are "Money In" (credit) 50,000 + 25,000.
    assert.strictEqual(cf.inflow, '75000', 'Total credit should be 75,000 (50,000 + 25,000), got: ' + cf.inflow);
    assert.strictEqual(cf.outflow, '1500', 'Total debit should be 1,500, got: ' + cf.outflow);
    assert.strictEqual(cf.balance, '1875802', 'Closing balance should be about 1,875,802 (rounded), got: ' + cf.balance);
  } finally {
    await page.context().close();
  }
};
