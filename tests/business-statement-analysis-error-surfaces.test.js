'use strict';
// Same silent-failure gap the personal bank-statement analyzer had (see
// statement-analysis-error-surfaces.test.js) also existed in its business-statement twin — the two
// share almost identical structure, and only the personal one got fixed first. This is the same
// test, ported: forces a real exception partway through business-statement processing and checks
// it's caught with a plain-language message and a report path, and separately checks the "no
// transaction rows detected" path also offers the same reporting path.
const assert = require('assert');
const path = require('path');
const { passConsentGate, goToSessionByPill, newPageAt } = require('./helpers');

var GOOD_FIXTURE = path.join(__dirname, 'fixtures', 'bank-statement-sample.pdf');
var NO_ROWS_FIXTURE = path.join(__dirname, 'fixtures', 'statement-analysis-no-rows.pdf');

async function revealBizFinanceItem(page){
  await goToSessionByPill(page, 0); // trip session — Work status lives here
  await page.selectOption('#f_workStatus', 'selfEmployed');
  await page.waitForTimeout(150);
  await goToSessionByPill(page, 4); // 0 trip, 1 finance2, 2 finance, 3 cat:Identity & application, 4 cat:Financial evidence
  await page.waitForSelector('#file_bizFinance', { timeout: 5000 });
}

exports.run = async function(ctx){
  // Scenario 1: a genuine mid-processing exception must be caught, surfaced, and offer a report path.
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await revealBizFinanceItem(page);
    await page.setInputFiles('#file_bizFinance', GOOD_FIXTURE);
    await page.waitForTimeout(300);

    // Make the getElementById call this flow makes on a successful parse (well after transactions
    // have already parsed) throw, to simulate an unforeseen bug.
    await page.evaluate(function(){
      var original = document.getElementById.bind(document);
      document.getElementById = function(id){
        if (id === 'incomeSourceBusiness') throw new TypeError('simulated mid-processing failure');
        return original(id);
      };
    });

    await page.click('#scan_bizFinance');
    await page.waitForTimeout(8000);

    var html = await page.$eval('#scanmsg_bizFinance', function(el){ return el.innerHTML; });
    assert.ok(/went wrong while reading this business statement/i.test(html), 'A mid-processing failure should surface a plain-language error, got: ' + html.slice(0, 500));
    assert.ok(/mailto:lalasionline%40gmail\.com|mailto:lalasionline@gmail\.com/.test(html), 'Should offer an email report link with context, got: ' + html.slice(0, 500));
    assert.ok(/wa\.me\/2349081389969/.test(html), 'Should offer a WhatsApp report link with context, got: ' + html.slice(0, 500));
  } finally {
    await page.context().close();
  }

  // Scenario 2: zero transactions detected should also offer a report path.
  var page2 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page2);
    await revealBizFinanceItem(page2);
    await page2.setInputFiles('#file_bizFinance', NO_ROWS_FIXTURE);
    await page2.waitForTimeout(300);
    await page2.click('#scan_bizFinance');
    await page2.waitForTimeout(8000);
    var html2 = await page2.$eval('#scanmsg_bizFinance', function(el){ return el.innerHTML; });
    assert.ok(/Couldn.t automatically detect transaction rows in this business statement/i.test(html2), 'Zero-row business statement should show the existing no-rows message, got: ' + html2.slice(0, 500));
    assert.ok(/wa\.me\/2349081389969/.test(html2), 'Zero-row message should now also offer a report path, got: ' + html2.slice(0, 500));
  } finally {
    await page2.context().close();
  }
};
