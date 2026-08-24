'use strict';
// User request, as "CTO" priority #3 off the friend's product review + monetization planning: a new
// "Readiness report" tab (Step 6, inside Income & bank statement analysis) summarizing financial
// readiness using CATEGORY status (Missing / Needs review / Looks complete / Not assessed) instead of
// a single raw percentage. Deliberately reuses signals already computed elsewhere on Steps 2-5
// (incomePill/balancePill classes, window.__lastUnexplainedInflows, window.__lastIncomeBreakdown,
// window.__lastNameChecks) — see computeReadinessReportRows() in index.html.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill, goToFinanceStep } = require('./helpers');

var INFLOW_STATEMENT = path.join(__dirname, 'fixtures', 'employer-inflow-narration.pdf');

exports.run = async function(ctx){
  // --- Fresh page: nothing declared, nothing uploaded — every category should read either Missing
  // (applies but not done) or Not assessed (nothing declared to check) -----------------------------
  var page1 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page1);
    await goToSessionByPill(page1, 4);
    await goToFinanceStep(page1, 6);
    await page1.waitForSelector('#readinessReportBox');

    var freshText = await page1.$eval('#readinessReportBox', function(el){ return el.innerText; });
    assert.ok(/6 categories checked/.test(freshText), 'Should report all 6 categories, got: ' + freshText);
    assert.ok(/4 missing/.test(freshText), 'Should show 4 categories as missing before anything is filled in, got: ' + freshText);
    assert.ok(/2 not assessed/.test(freshText), 'Workplace + business evidence should both be "not assessed" before Work status is declared, got: ' + freshText);
    assert.ok(!/need. review/.test(freshText) && !/look. complete/.test(freshText), 'Nothing should read as "needs review" or "looks complete" on a fresh page, got: ' + freshText);

    // Declaring an employer (without uploading a statement yet) should flip Workplace income evidence
    // from "Not assessed" to "Missing" WITHOUT touching anything in the financial calculator — this
    // exercises the render()-triggered refresh, not just the computeFinancials()-triggered one.
    await goToSessionByPill(page1, 3);
    await page1.selectOption('#f_workStatus', 'employed');
    await page1.fill('#f_employerName', 'Some Employer Ltd');
    await goToSessionByPill(page1, 4);
    await goToFinanceStep(page1, 6);
    var afterEmployerText = await page1.$eval('#readinessReportBox', function(el){ return el.innerText; });
    assert.ok(/Workplace income evidence[\s\S]*?Missing[\s\S]*?Upload a bank statement on Step 1 to check for "Some Employer Ltd"/.test(afterEmployerText),
      'Declaring an employer should flip Workplace income evidence to Missing, referencing the declared name, got: ' + afterEmployerText);
    assert.ok(/Business income evidence[\s\S]*?Not assessed/.test(afterEmployerText),
      'Business income evidence should stay Not assessed since only "Employed" was declared, got: ' + afterEmployerText);
  } finally {
    await page1.context().close();
  }

  // --- Full scenario: employer + business declared, statement analyzed, one income-breakdown source
  // still missing its note — should show a mix of "Looks complete" and "Needs review" -----------------
  var page2 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page2);
    await goToSessionByPill(page2, 3);
    await page2.fill('#f_name', 'Test Applicant');
    await page2.selectOption('#f_workStatus', 'both');
    await page2.fill('#f_employerName', 'Grace Covenant Youth Church');
    await page2.fill('#f_businessName', 'Bright Homes Cleaning Solutions Ltd');

    await goToSessionByPill(page2, 4);
    await page2.setInputFiles('#stmtFile1', INFLOW_STATEMENT);
    await page2.click('#btnAnalyzeStatements');
    await page2.waitForSelector('#matchedIncomeInflowsBox .explain-box', { timeout: 20000 });
    await page2.waitForTimeout(300);

    await goToFinanceStep(page2, 6);
    await page2.waitForSelector('#readinessReportBox');
    var fullText = await page2.$eval('#readinessReportBox', function(el){ return el.innerText; });

    assert.ok(/Income generation & consistency[\s\S]*?Looks complete/.test(fullText),
      'Income generation should read Looks complete once all matched inflows are auto-explained, got: ' + fullText);
    assert.ok(/Unexplained inflows[\s\S]*?Looks complete/.test(fullText),
      'Unexplained inflows should read Looks complete when nothing was flagged, got: ' + fullText);
    assert.ok(/Workplace income evidence[\s\S]*?Looks complete[\s\S]*?Grace Covenant Youth Church/.test(fullText),
      'Workplace income evidence should read Looks complete once every employer-matched inflow is explained, got: ' + fullText);
    assert.ok(/Business income evidence[\s\S]*?Looks complete[\s\S]*?Bright Homes Cleaning Solutions Ltd/.test(fullText),
      'Business income evidence should read Looks complete once every business-matched inflow is explained, got: ' + fullText);
    // The matched-inflow explain-box being auto-tagged does NOT automatically fill in the SEPARATE
    // "Income sources breakdown" (Step 4) note for that same sender — this category should still
    // correctly flag that gap rather than reading everything as done just because Steps 2/5 are clean.
    assert.ok(/Income sources breakdown[\s\S]*?Needs review/.test(fullText),
      'Income sources breakdown should still show Needs review while its own Step 4 note is unfilled, got: ' + fullText);
  } finally {
    await page2.context().close();
  }
};
