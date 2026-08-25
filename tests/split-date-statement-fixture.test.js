'use strict';
// Real-data finding, off a real "ALAT by WEMA" statement PDF: its Date column is rendered narrow
// enough that the date text WRAPS within its own table cell, so pdf.js's y-position line-bucketing
// splits a single date across two separate lines — e.g. "05-Feb-" on one line and a bare "2026"
// several lines later — while the transaction's actual reference/narration/amount data sits at a
// DIFFERENT y-position sandwiched between those two date fragments, with no date of its own.
// parseLeadingDate then rejected every one of those data lines (nothing looked like a date at the
// start), so the row-based parser found zero transactions and the app reported "couldn't detect
// transaction rows" on an otherwise perfectly good statement.
//
// mergeSplitDateLines now reassembles the split date and prepends it onto the sandwiched data line
// before the rest of the pipeline sees it. This fixture (fictional identity/account/amounts, but the
// same structural date-split pattern) reproduces the bug and checks it's fixed.
const assert = require('assert');
const path = require('path');
const { passConsentGate, goToSessionByPill, newPageAt } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'split-date-statement-fixture.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 4); // finance2 = Income & bank statement analysis
    await page.setInputFiles('#stmtFile1', FIXTURE);
    await page.waitForTimeout(300);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction|Couldn.t automatically detect/.test(el.textContent);
    }, { timeout: 15000 });
    await page.waitForTimeout(300);
    var html = await page.$eval('#stmtAnalyzeMsg', function(el){ return el.innerHTML; });

    assert.ok(!/Couldn.t automatically detect transaction rows/i.test(html),
      'A statement whose dates are split across pdf.js lines should no longer be reported as having zero transaction rows, got: ' + html.slice(0, 500));
    assert.ok(/Detected 4 transaction\(s\)/.test(html),
      'Should detect all 4 transactions once the split date/data/year triples are reassembled, got: ' + html.slice(0, 500));
  } finally {
    await page.context().close();
  }
};
