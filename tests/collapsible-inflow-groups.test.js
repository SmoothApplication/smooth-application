'use strict';
// User request, off screenshots of a fully-completed "All 7 inflow(s) explained" list and a 28-item
// itemized business-inflow list: "once filled, make both parts collapsible." Both lists already
// auto-tidy each INDIVIDUAL row down to a one-line summary once it's explained — but the whole list of
// those one-liners still always took up the same room, even once there was nothing left to act on.
//
// Both the "needs an explanation" list (unexplainedInflowsBox) and the itemized matched-inflow list
// (matchedIncomeInflowsBox, one group per declared employer/business) now wrap their rows in a native
// <details>, open by default so nothing looks different the moment it finishes — with a toggle so the
// applicant can tuck a long, already-confirmed list away.
//
// Further user request: employer-matched inflows moved to their own "Workplace income" tab (Step 5),
// separate from business-matched inflows on Step 2 — so each now gets its own single collapsible group
// in its own box, instead of the two groups sharing one box.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill, goToFinanceStep } = require('./helpers');

var UNEXPLAINED_STATEMENT = path.join(__dirname, 'fixtures', 'bank-statement-sample.pdf');
var MATCHED_STATEMENT = path.join(__dirname, 'fixtures', 'employer-inflow-narration.pdf');

exports.run = async function(ctx){
  // --- matchedIncomeInflowsBox: pre-tagged, so its group(s) should already be wrapped and collapsible
  // the moment the statement is analyzed -- no waiting for anything to be explained first. ------------
  var page1 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page1);
    await goToSessionByPill(page1, 3);
    await page1.fill('#f_name', 'Test Applicant');
    await page1.selectOption('#f_workStatus', 'both');
    await page1.fill('#f_employerName', 'Grace Covenant Youth Church');
    await page1.fill('#f_businessName', 'Bright Homes Cleaning Solutions Ltd');

    await goToSessionByPill(page1, 4);
    await page1.setInputFiles('#stmtFile1', MATCHED_STATEMENT);
    await page1.click('#btnAnalyzeStatements');
    await page1.waitForSelector('#matchedIncomeInflowsBox .explain-box', { timeout: 20000 });
    await page1.waitForTimeout(300);

    // Business-matched inflows (Step 2) get their own single collapsible group.
    var bizGroupCount = await page1.$$eval('#matchedIncomeInflowsBox details.report-group', function(els){ return els.length; });
    assert.strictEqual(bizGroupCount, 1, 'Step 2 should wrap the business-matched inflows in one collapsible group, got: ' + bizGroupCount);

    var bizStartsOpen = await page1.$$eval('#matchedIncomeInflowsBox details.report-group', function(els){ return els.every(function(el){ return el.open; }); });
    assert.strictEqual(bizStartsOpen, true, 'Business group should start OPEN so nothing looks different than before this change');

    var bizBoxCount = await page1.$$eval('#matchedIncomeInflowsBox .explain-box', function(els){ return els.length; });
    assert.strictEqual(bizBoxCount, 3, 'All 3 business-matched inflow boxes should still be present, got: ' + bizBoxCount);

    // Collapsing the business group's <summary> should hide its own 3 boxes.
    var bizGroupId = await page1.$eval('#matchedIncomeInflowsBox details.report-group', function(el){ return el.id; });
    await page1.click('#' + bizGroupId + ' > summary');
    var bizNowClosed = await page1.$eval('#' + bizGroupId, function(el){ return !el.open; });
    assert.strictEqual(bizNowClosed, true, 'Clicking the summary should collapse the business group');
    var bizBoxIds = await page1.$$eval('#matchedIncomeInflowsBox .explain-box', function(els){ return els.map(function(el){ return el.id; }); });
    var bizVisibleFlags = [];
    for (var i = 0; i < bizBoxIds.length; i++){
      bizVisibleFlags.push(await page1.locator('#' + bizBoxIds[i]).isVisible());
    }
    assert.strictEqual(bizVisibleFlags.filter(Boolean).length, 0, 'Collapsing the business group should hide all 3 of its boxes, got visible count: ' + bizVisibleFlags.filter(Boolean).length);

    // Employer-matched inflows now live on their own "Workplace income" tab (Step 4) — same
    // collapsible-group behavior, checked on that tab.
    await goToFinanceStep(page1, 4);
    var empGroupCount = await page1.$$eval('#employerIncomeInflowsBox details.report-group', function(els){ return els.length; });
    assert.strictEqual(empGroupCount, 1, 'Step 4 should wrap the employer-matched inflows in one collapsible group, got: ' + empGroupCount);

    var empStartsOpen = await page1.$$eval('#employerIncomeInflowsBox details.report-group', function(els){ return els.every(function(el){ return el.open; }); });
    assert.strictEqual(empStartsOpen, true, 'Employer group should start OPEN so nothing looks different than before this change');

    var empBoxCount = await page1.$$eval('#employerIncomeInflowsBox .explain-box', function(els){ return els.length; });
    assert.strictEqual(empBoxCount, 3, 'All 3 employer-matched inflow boxes should still be present, got: ' + empBoxCount);

    var empGroupId = await page1.$eval('#employerIncomeInflowsBox details.report-group', function(el){ return el.id; });
    await page1.click('#' + empGroupId + ' > summary');
    var empNowClosed = await page1.$eval('#' + empGroupId, function(el){ return !el.open; });
    assert.strictEqual(empNowClosed, true, 'Clicking the summary should collapse the employer group');
    var empBoxIds = await page1.$$eval('#employerIncomeInflowsBox .explain-box', function(els){ return els.map(function(el){ return el.id; }); });
    var empVisibleFlags = [];
    for (var j = 0; j < empBoxIds.length; j++){
      empVisibleFlags.push(await page1.locator('#' + empBoxIds[j]).isVisible());
    }
    assert.strictEqual(empVisibleFlags.filter(Boolean).length, 0, 'Collapsing the employer group should hide all 3 of its boxes, got visible count: ' + empVisibleFlags.filter(Boolean).length);
  } finally {
    await page1.context().close();
  }

  // --- unexplainedInflowsBox: starts WITHOUT a wrapper (there's real work to do — nothing to hide),
  // only gains the collapsible wrapper once every flagged inflow is actually explained. --------------
  var page2 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page2);
    await goToSessionByPill(page2, 4);

    await page2.setInputFiles('#stmtFile1', UNEXPLAINED_STATEMENT);
    await page2.click('#btnAnalyzeStatements');
    await page2.waitForSelector('#unexplainedInflowsBox .explain-box', { timeout: 20000 });
    await page2.waitForTimeout(300);

    var wrapperBeforeDone = await page2.$('#unexplainedInflowsGroup');
    assert.strictEqual(wrapperBeforeDone, null, 'Should NOT be wrapped in a collapsible group yet — the one flagged inflow still needs explaining');

    // Explain the one flagged inflow — this fixture has exactly one, so this also completes the list.
    await page2.selectOption('#explain_cat_0', 'self');
    await page2.waitForFunction(function(){
      var el = document.getElementById('unexplainedInflowsGroup');
      return el && el.open === true;
    }, { timeout: 3000 });

    var wrapperAfterDone = await page2.$eval('#unexplainedInflowsGroup', function(el){ return {open: el.open, tag: el.tagName}; });
    assert.strictEqual(wrapperAfterDone.tag, 'DETAILS', 'Should now be wrapped in a <details> once fully explained');
    assert.strictEqual(wrapperAfterDone.open, true, 'Should start open even once wrapped, so nothing looks different the moment it finishes');

    // The now-explained box should still be there, collapsed to its one-line summary, inside the group.
    var boxStillThere = await page2.$eval('#explainbox_0', function(el){ return el.classList.contains('collapsed') && el.classList.contains('explained'); });
    assert.strictEqual(boxStillThere, true, 'The explained box should be collapsed to a one-liner inside the new group');

    // Collapsing the group via its summary should hide that box.
    await page2.click('#unexplainedInflowsGroup > summary');
    var boxHiddenAfterCollapse = !(await page2.locator('#explainbox_0').isVisible());
    assert.strictEqual(boxHiddenAfterCollapse, true, 'Collapsing the group should hide its (now redundant) explained box');
  } finally {
    await page2.context().close();
  }
};
