'use strict';
// Real-data finding, off the real Zenith statement used throughout this project: isReversalNarration
// only recognised "RVSL" as a reversal marker, but the SAME real statement uses "RSVL" (letters
// transposed) far more often — e.g. "***RSVL NIP CR/MOB/JAMES DANIEL/FBN / Grace CYC WEDDING SUPPORT",
// reversing an earlier failed outgoing transfer. Missing that spelling meant several reversed/bounced-
// back transfers were being counted as genuine new income on top of whatever eventually did go through —
// in one traced case, wrongly inflating a matched employer inflow total by ₦1,500,050 across 2 phantom
// "inflows" that were really just a failed transfer bouncing back, not new money arriving.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'rsvl-reversal-fixture.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    await goToSessionByPill(page, 3);
    await page.fill('#f_name', 'Test Applicant');
    await page.selectOption('#f_workStatus', 'selfEmployed');
    await page.fill('#f_businessName', 'Bright Homes Cleaning Solutions Ltd');

    await goToSessionByPill(page, 4);
    await page.setInputFiles('#stmtFile1', FIXTURE);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 20000 });
    await page.waitForTimeout(300);
    var html = await page.$eval('#stmtAnalyzeMsg', function(el){ return el.innerHTML; });

    // Only the genuine (non-"***RSVL") payment should count.
    assert.ok(/Found "Bright Homes Cleaning Solutions Ltd" as the sender on 1 inflow/i.test(html),
      'A "***RSVL"-marked reversal credit should NOT be counted as a genuine inflow, got: ' + html);
    assert.ok(/totaling ₦300,000/.test(html), 'Only the genuine ₦300,000 payment should be totaled, got: ' + html);
    assert.ok(!/₦600,000/.test(html), 'Should not double-count the reversed payment, got: ' + html);
  } finally {
    await page.context().close();
  }
};
