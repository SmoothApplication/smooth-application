'use strict';
// Real-data finding, off a real First Bank statement: loan-servicing system narrations — "PDC:LOAN
// DISBURAL 20781551FMOBAMPC/120784870 Ref20781551FMOBAMPC/PRI" and similar — are a product/batch code,
// not a person or company's name. Because they recurred more often (as separate loan disbursals) than
// the applicant's actual employer narration in that statement, "Most frequent inflow source" came back
// as the nonsense name "Pdc Loan Disbural...Fmobampc" instead of the real, human-readable sender.
//
// This fixture (fictional identity/account/amounts, but the same structural narration pattern) has a
// loan-code cluster appearing MORE often (3x) than a genuine recurring employer (2x) — before adding
// these terms to BANK_NARRATION_STOPWORDS, the loan-code cluster would win by raw count; after, it
// produces no name candidate at all, so the real employer correctly wins instead.
const assert = require('assert');
const path = require('path');
const { passConsentGate, goToSessionByPill, newPageAt } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'loan-code-narration-fixture.pdf');

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

    assert.ok(/Detected 5 transaction\(s\)/.test(html), 'Should detect all 5 transactions, got: ' + html.slice(0, 500));
    assert.ok(/Most frequent inflow source.{0,60}"Crisp N Clear Ventures"/is.test(html),
      'The real, more human-readable (though less frequent) employer should win over the loan-servicing code cluster, got: ' + html.slice(0, 700));
    assert.ok(!/Pdc|Loan|Disbural|Fmobampc/i.test(html),
      'A loan-servicing system code should never surface as an inflow source name, got: ' + html.slice(0, 700));
  } finally {
    await page.context().close();
  }
};
