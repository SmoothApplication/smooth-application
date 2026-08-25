'use strict';
// User report: a genuine 120-page digital bank statement got truncated at the old 60-page cap on
// text-layer PDF extraction — "only the first 60 pages were read" — losing months of real transaction
// history. Text-layer extraction is cheap enough per page that the cap was raised well past that
// (60 -> 150), with headroom to spare. This fixture is a real 65-page PDF (one transaction per page) —
// past the OLD cap, comfortably under the new one — and checks every page is read with no truncation
// warning at all.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

var MANY_PAGES_STATEMENT = path.join(__dirname, 'fixtures', 'many-pages-statement.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 4); // finance2 = Income & bank statement analysis

    await page.setInputFiles('#stmtFile1', MANY_PAGES_STATEMENT);
    await page.waitForTimeout(500);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 30000 });
    await page.waitForTimeout(300);

    var html = await page.$eval('#stmtAnalyzeMsg', function(el){ return el.innerHTML; });

    // All 65 pages' worth of transactions should be detected — none silently dropped past the old cap.
    assert.ok(/Detected 65 transaction\(s\)/.test(html), 'Should detect all 65 transactions (one per page), got: ' + html.slice(0, 300));

    // No "only the first N pages were read" truncation warning should appear at all — 65 is comfortably
    // under the new 150-page cap.
    assert.ok(!/were read/.test(html), 'Should NOT show a page-truncation warning for a 65-page statement under the new cap, got: ' + html.slice(0, 400));
    assert.ok(!/pages —/.test(html), 'Should NOT mention a truncated page count at all, got: ' + html.slice(0, 400));
  } finally {
    await page.context().close();
  }
};
