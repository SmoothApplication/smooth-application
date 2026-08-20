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
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

var UNEXPLAINED_STATEMENT = path.join(__dirname, 'fixtures', 'bank-statement-sample.pdf');
var MATCHED_STATEMENT = path.join(__dirname, 'fixtures', 'employer-inflow-narration.pdf');

exports.run = async function(ctx){
  // --- matchedIncomeInflowsBox: pre-tagged, so its group(s) should already be wrapped and collapsible
  // the moment the statement is analyzed -- no waiting for anything to be explained first. ------------
  var page1 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page1);
    await page1.fill('#f_name', 'Test Applicant');
    await goToSessionByPill(page1, 0);
    await page1.selectOption('#f_workStatus', 'both');
    await page1.fill('#f_employerName', 'MFM Lekki Youth Church');
    await page1.fill('#f_businessName', 'Crisp N Clean Exclusive Solutions Ltd');

    await goToSessionByPill(page1, 1);
    await page1.setInputFiles('#stmtFile1', MATCHED_STATEMENT);
    await page1.click('#btnAnalyzeStatements');
    await page1.waitForSelector('#matchedIncomeInflowsBox .explain-box', { timeout: 20000 });
    await page1.waitForTimeout(300);

    var groupCount = await page1.$$eval('#matchedIncomeInflowsBox details.report-group', function(els){ return els.length; });
    assert.strictEqual(groupCount, 2, 'Should wrap each declared name\'s matched inflows in its own collapsible group (employer + business), got: ' + groupCount);

    var startsOpen = await page1.$$eval('#matchedIncomeInflowsBox details.report-group', function(els){ return els.every(function(el){ return el.open; }); });
    assert.strictEqual(startsOpen, true, 'Groups should start OPEN so nothing looks different than before this change');

    // All 6 boxes (3 employer + 3 business) are still visible and reachable, same as before.
    var boxCount = await page1.$$eval('#matchedIncomeInflowsBox .explain-box', function(els){ return els.length; });
    assert.strictEqual(boxCount, 6, 'All 6 individual matched-inflow boxes should still be present, got: ' + boxCount);

    // Collapsing the first group's <summary> should hide its boxes without touching the other group.
    var firstGroupId = await page1.$eval('#matchedIncomeInflowsBox details.report-group', function(el){ return el.id; });
    await page1.click('#' + firstGroupId + ' > summary');
    var nowClosed = await page1.$eval('#' + firstGroupId, function(el){ return !el.open; });
    assert.strictEqual(nowClosed, true, 'Clicking the summary should collapse that group');
    var allBoxIds = await page1.$$eval('#matchedIncomeInflowsBox .explain-box', function(els){ return els.map(function(el){ return el.id; }); });
    var visibleFlags = [];
    for (var i = 0; i < allBoxIds.length; i++){
      visibleFlags.push(await page1.locator('#' + allBoxIds[i]).isVisible());
    }
    var visibleBoxesAfterCollapse = visibleFlags.filter(Boolean).length;
    assert.strictEqual(visibleBoxesAfterCollapse, 3, 'Collapsing one group should hide only its own 3 boxes, leaving the other group\'s 3 visible, got: ' + visibleBoxesAfterCollapse);
  } finally {
    await page1.context().close();
  }

  // --- unexplainedInflowsBox: starts WITHOUT a wrapper (there's real work to do — nothing to hide),
  // only gains the collapsible wrapper once every flagged inflow is actually explained. --------------
  var page2 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page2);
    await goToSessionByPill(page2, 1);

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
