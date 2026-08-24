'use strict';
// User feedback, off a real Zenith/Bright Homes Cleaning bank statement: individual payments from a
// recurring income source should keep the bank's own specific narration (e.g. "February Salary",
// "March Salary") rather than being flattened to a generic "Salary" label — that's what lets a
// reviewer see salary was actually collected for each named month. And once a monthly salary
// pattern is established, a month that never got one (even though the source has other activity
// that month) should be flagged, e.g. "no July Salary payment was found."
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 1); // finance2 = Income & bank statement analysis

    var fixturePath = path.join(__dirname, 'fixtures', 'salary-month-gap-fixture.pdf');
    await page.setInputFiles('#stmtFile1', fixturePath);
    await page.waitForTimeout(500);
    await page.click('#btnAnalyzeStatements');
    await page.waitForTimeout(8000);

    var boxHtml = await page.$eval('#incomeBreakdownBox', function(el){ return el.innerHTML; });

    // Each salary payment keeps its own specific, month-named narration...
    assert.ok(/<b>February Salary<\/b>/.test(boxHtml), 'Expected "February Salary" to appear as its own narration, got: ' + boxHtml.slice(0, 400));
    assert.ok(/<b>March Salary<\/b>/.test(boxHtml), 'Expected "March Salary" to appear as its own narration');
    assert.ok(/<b>April Salary<\/b>/.test(boxHtml), 'Expected "April Salary" to appear as its own narration');
    assert.ok(/<b>May Salary<\/b>/.test(boxHtml), 'Expected "May Salary" to appear as its own narration');
    assert.ok(/<b>June Salary<\/b>/.test(boxHtml), 'Expected "June Salary" to appear as its own narration');
    // ...tagged with a small "Salary" badge for scannability...
    var salaryTagCount = (boxHtml.match(/src-tag salary/g) || []).length;
    assert.ok(salaryTagCount >= 5, 'Expected at least 5 "Salary" tags (one per salary-narration payment), got ' + salaryTagCount);
    // ...and the non-salary July payment should NOT get a Salary tag/label of its own.
    assert.ok(/<b>Transport Allowance<\/b>/.test(boxHtml), 'Expected the July payment\'s own narration to show, got: ' + boxHtml);

    // The missing month itself: July has other activity from the same source but no "July Salary" —
    // that gap should be called out once, clearly.
    assert.ok(/no <b>July Salary<\/b> payment was found/.test(boxHtml), 'Expected a missing-July-Salary warning, got: ' + boxHtml.slice(0, 300));
  } finally {
    await page.context().close();
  }
};
