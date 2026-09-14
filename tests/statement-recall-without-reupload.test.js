'use strict';
// User question: "is there a way applicants can recall their bank statements without having to
// download from the app" - previously the itemized statement-analysis boxes (the "needs an
// explanation" list, Top 10 inflows/senders, income breakdown, employer/business matched inflows)
// only ever existed in memory for the life of one browser tab - a returning applicant had to
// re-upload the IDENTICAL PDF just to see that breakdown again, even though their own notes on each
// inflow were already being saved separately. This locks in the fix: analyzing a statement now caches
// its parsed transactions (lastPersonalStatementTxns), persists them via buildPayload()'s
// statementTxns field, and a page reload rebuilds every itemized box from that saved data alone (see
// rebuildStatementItemizedViews/applyPayload in index.html) - no file re-upload required.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill, goToFinanceStep } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'multi-unexplained-inflows.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 4); // finance2 = Income & bank statement analysis

    await page.setInputFiles('#stmtFile1', FIXTURE);
    await page.click('#btnAnalyzeStatements');
    await page.waitForFunction(function(){
      var el = document.getElementById('stmtAnalyzeMsg');
      return el && /Detected \d+ transaction/.test(el.textContent);
    }, { timeout: 20000 });
    await goToFinanceStep(page, 5);
    await page.waitForSelector('#unexplainedInflowsBox .explain-box', { timeout: 20000 });
    var boxCountBefore = await page.$$eval('#unexplainedInflowsBox .explain-box', function(els){ return els.length; });
    assert.strictEqual(boxCountBefore, 3, 'Fixture should produce exactly 3 flagged inflows before reload, got: ' + boxCountBefore);

    // scheduleAutoSave() debounces its localStorage write by 600ms - give it a comfortable margin to
    // actually land before reloading, or the reload could race the save and look like it "didn't
    // persist" even though it would have, given a moment longer.
    await page.waitForTimeout(1200);

    await page.reload();
    // A fresh page load means the gate/quiz/docs screens all need re-passing, same as any real return
    // visit - nothing about that flow itself is what's being tested here.
    await passConsentGate(page);
    // Deliberately NO file upload on this pass at all - the itemized boxes below must reappear purely
    // from what was already saved.
    await goToSessionByPill(page, 4);

    // The upload form should read as already-analyzed ("recalled"), not present a blank untouched
    // uploader as if nothing had ever been scanned.
    var doneBarVisible = await page.$eval('#stmtUploadDoneBar', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(doneBarVisible, true, 'The done-bar should show once a recalled statement is rebuilt, not the blank upload form');
    var doneBarText = await page.$eval('#stmtUploadDoneBarText', function(el){ return el.textContent; });
    assert.ok(/Recalled from your last visit/.test(doneBarText), 'The done-bar should say the statement was recalled, got: "' + doneBarText + '"');
    var analyzeMsgText = await page.$eval('#stmtAnalyzeMsg', function(el){ return el.textContent; });
    assert.ok(/last visit/i.test(analyzeMsgText), 'The analysis message area should explain this came from a previous visit, got: "' + analyzeMsgText + '"');

    // The file input itself must still be empty - nothing was re-selected to get here.
    var fileInputEmpty = await page.$eval('#stmtFile1', function(el){ return !el.files || el.files.length === 0; });
    assert.strictEqual(fileInputEmpty, true, 'The file input should still be empty after reload - recall must not require re-selecting the file');

    await goToFinanceStep(page, 5);
    await page.waitForSelector('#unexplainedInflowsBox .explain-box', { timeout: 20000 });
    var boxCountAfter = await page.$$eval('#unexplainedInflowsBox .explain-box', function(els){ return els.length; });
    assert.strictEqual(boxCountAfter, 3, 'All 3 flagged inflows should reappear after a reload, without re-uploading, got: ' + boxCountAfter);
  } finally {
    await page.context().close();
  }
};
