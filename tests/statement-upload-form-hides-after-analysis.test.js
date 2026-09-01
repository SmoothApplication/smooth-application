'use strict';
// User feedback: "all the upload bank statements and analyze should not show once you upload your
// bank statement on this first page. It should show you the goods and the bads. The goods should
// come in a drop down menu. The bad should come in a drop down menu." Covers both halves of that
// request: (1) the file pickers/Analyze button hide themselves once a real analysis completes,
// replaced by a compact "analyzed — upload different statement(s)" bar that brings the form back;
// (2) the results split into two dropdowns — "Needs your attention" (warn/err/info findings, OPEN
// by default since these are things to act on) and "What looks good" (ok findings, collapsed by
// default since these are reassurance, not action items — unchanged from before this change).
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

var SAMPLE_STATEMENT = path.join(__dirname, 'fixtures', 'bank-statement-sample.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 4); // finance2 — holds #stmtFile1/#btnAnalyzeStatements
    await page.waitForSelector('#stmtFile1');

    // Before any analysis: upload form visible, done-bar hidden.
    var beforeBlockVisible = await page.$eval('#stmtUploadBlock', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(beforeBlockVisible, true, 'Upload form should be visible before any statement is analyzed');
    var beforeBarVisible = await page.$eval('#stmtUploadDoneBar', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(beforeBarVisible, false, '"Upload different statement(s)" bar should be hidden before any analysis');

    await page.setInputFiles('#stmtFile1', SAMPLE_STATEMENT);
    await page.click('#btnAnalyzeStatements');
    await page.waitForSelector('#unexplainedInflowsBox .explain-box', { timeout: 20000 });
    await page.waitForTimeout(500);

    // After a real analysis: upload form hidden, done-bar shown instead.
    var afterBlockVisible = await page.$eval('#stmtUploadBlock', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(afterBlockVisible, false, 'Upload form should hide itself once a statement is actually analyzed');
    var afterBarVisible = await page.$eval('#stmtUploadDoneBar', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(afterBarVisible, true, '"Upload different statement(s)" bar should show once analyzed');

    // Results split into the two requested dropdowns, each keeping its own default open/closed state.
    var attention = await page.$eval('#stmtAnalyzeMsg .scan-msg-attention', function(el){
      return { open: el.open, text: el.textContent };
    });
    assert.strictEqual(attention.open, true, '"Needs your attention" dropdown should be open by default — these are things to act on');
    assert.ok(/need an explanation/i.test(attention.text), 'The "needs an explanation" finding should live inside the attention dropdown, got: ' + attention.text.slice(0, 200));

    var good = await page.$eval('#stmtAnalyzeMsg .scan-msg-good', function(el){ return { open: el.open, text: el.textContent }; });
    assert.strictEqual(good.open, false, '"What looks good" dropdown should stay collapsed by default, unchanged from before');
    assert.ok(/What looks good/.test(good.text), 'Good dropdown should still be labelled as before, got: ' + good.text.slice(0, 100));

    // Reveal link brings the upload form back, e.g. to analyze a different/additional statement.
    await page.click('#btnShowStmtUpload');
    var revealedBlockVisible = await page.$eval('#stmtUploadBlock', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(revealedBlockVisible, true, '"Upload different statement(s)" should bring the upload form back');
    var revealedBarVisible = await page.$eval('#stmtUploadDoneBar', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(revealedBarVisible, false, 'The done-bar should hide again once the upload form is revealed');
  } finally {
    await page.context().close();
  }
};
