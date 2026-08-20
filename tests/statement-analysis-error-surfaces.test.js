'use strict';
// Before this, ANY bug partway through statement parsing/rendering (e.g. an unusual layout from a
// bank this tool hasn't been tested against) failed completely silently: the "Reading file(s)…"
// message just sat on screen forever, with nothing telling the applicant anything had gone wrong —
// let alone a way to tell us. The only place the failure surfaced at all was as an anonymous
// "unhandledrejection" analytics event, invisible to the person actually stuck on the page.
//
// This forces a real exception partway through the analysis chain (well after real parsing has
// begun, by making one specific document.getElementById() call this flow makes mid-processing
// throw) and checks that it's now caught: a plain-language error message appears, with a way to
// report the problem with real context attached (not a bare screenshot), and the "Reading…" message
// doesn't hang forever. Separately checks the "no transaction rows detected" path (a very real
// failure mode for an unfamiliar statement format) also now offers the same reporting path.
const assert = require('assert');
const path = require('path');
const { passConsentGate, goToSessionByPill, newPageAt } = require('./helpers');

var GOOD_FIXTURE = path.join(__dirname, 'fixtures', 'bank-statement-sample.pdf');

exports.run = async function(ctx){
  // Scenario 1: a genuine mid-processing exception must be caught, surfaced, and offer a report path.
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 4); // finance2 = Income & bank statement analysis
    await page.setInputFiles('#stmtFile1', GOOD_FIXTURE);
    await page.waitForTimeout(300);

    // Make the ONE getElementById call this flow makes mid-processing (well after transactions have
    // already parsed successfully) throw, to simulate an unforeseen bug — everything else keeps
    // working normally so this doesn't just break page setup itself.
    await page.evaluate(function(){
      var original = document.getElementById.bind(document);
      document.getElementById = function(id){
        if (id === 'statementReportGroup') throw new TypeError('simulated mid-processing failure');
        return original(id);
      };
    });

    await page.click('#btnAnalyzeStatements');
    await page.waitForTimeout(8000);

    var html = await page.$eval('#stmtAnalyzeMsg', function(el){ return el.innerHTML; });
    assert.ok(/went wrong while reading this statement/i.test(html), 'A mid-processing failure should surface a plain-language error, got: ' + html.slice(0, 500));
    assert.ok(/mailto:lalasionline%40gmail\.com|mailto:lalasionline@gmail\.com/.test(html), 'Should offer an email report link with context, got: ' + html.slice(0, 500));
    assert.ok(/wa\.me\/2349081389969/.test(html), 'Should offer a WhatsApp report link with context, got: ' + html.slice(0, 500));
    assert.ok(!/Reading 1 file\(s\)…\s*$/.test(html.trim()), 'Should not be left stuck on the "Reading…" message forever, got: ' + html.slice(0, 500));
  } finally {
    await page.context().close();
  }

  // Scenario 2: zero transactions detected (an unfamiliar bank format) should also offer a report path.
  var page2 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page2);
    await goToSessionByPill(page2, 4);
    // A file with no parseable transaction rows at all — an image-less, text-only PDF that's plain
    // prose, not a tabular statement, so parseStatementLinesWithFallback comes up genuinely empty.
    await page2.setInputFiles('#stmtFile1', path.join(__dirname, 'fixtures', 'statement-analysis-no-rows.pdf'));
    await page2.waitForTimeout(300);
    await page2.click('#btnAnalyzeStatements');
    await page2.waitForTimeout(8000);
    var html2 = await page2.$eval('#stmtAnalyzeMsg', function(el){ return el.innerHTML; });
    assert.ok(/Couldn.t automatically detect transaction rows/i.test(html2), 'Zero-row statement should show the existing no-rows message, got: ' + html2.slice(0, 500));
    assert.ok(/wa\.me\/2349081389969/.test(html2), 'Zero-row message should now also offer a report path, got: ' + html2.slice(0, 500));
  } finally {
    await page2.context().close();
  }
};
