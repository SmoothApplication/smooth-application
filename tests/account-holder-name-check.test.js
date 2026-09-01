'use strict';
// User question: "How do we handle those who upload wrong bank statement that doesn't tally with
// their names" -- runStatementAnalysis now tries to read the "Account Name:" (or Customer Name /
// Name of holder / A/C Name) header off the statement itself and cross-checks it against the name
// the applicant typed in on the trip-details session, flagging a clear mismatch instead of silently
// accepting a statement that isn't theirs.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill, goToFinanceStep } = require('./helpers');

var MATCHING_STATEMENT = path.join(__dirname, 'fixtures', 'account-holder-matching-name.pdf');
var WRONG_NAME_STATEMENT = path.join(__dirname, 'fixtures', 'account-holder-wrong-name.pdf');

async function analyzeAndReadMsg(page, fixturePath){
  // A successful analysis auto-advances the session from step 1 (Upload) to step 2 (Cash flow &
  // scores) — harmless the first time (already on step 1), but necessary before a second/third
  // upload+analyze in the same test, since the file inputs and Analyze button only live on step 1.
  await goToFinanceStep(page, 1);
  // A prior successful analysis on this same page hides the upload form behind a "Statement(s)
  // analyzed" bar (see #stmtUploadDoneBar) -- bring the form back before uploading again.
  var uploadBlockHidden = await page.$eval('#stmtUploadBlock', function(el){ return getComputedStyle(el).display === 'none'; });
  if (uploadBlockHidden) {
    await page.click('#btnShowStmtUpload');
    await page.waitForSelector('#stmtUploadBlock', { state: 'visible' });
  }
  await page.setInputFiles('#stmtFile1', fixturePath);
  await page.click('#btnAnalyzeStatements');
  // The first message to land is a transient "Loading local analysis tools…" notice -- wait for
  // the real result (which always starts with a "Detected N transaction(s)" line) rather than
  // just the first .scan-msg to appear.
  await page.waitForFunction(function(){
    var el = document.getElementById('stmtAnalyzeMsg');
    return el && /Detected \d+ transaction/.test(el.textContent);
  }, { timeout: 20000 });
  await page.waitForTimeout(300);
  return page.$eval('#stmtAnalyzeMsg', function(el){ return el.innerHTML; });
}

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    // Applicant types their name in on the trip card (part of 'About you') first, then moves to
    // 'Financial readiness' where the statement upload/analyze lives.
    await goToSessionByPill(page, 3);
    await page.fill('#f_name', 'Test Applicant');
    await goToSessionByPill(page, 4);

    // Case 1: statement's "Account Name:" header matches the applicant's name -- should get a
    // confirming "ok" message, not a warning.
    var matchHtml = await analyzeAndReadMsg(page, MATCHING_STATEMENT);
    assert.ok(/Account holder name detected as "TEST APPLICANT"/i.test(matchHtml),
      'Should confirm the detected holder name, got: ' + matchHtml);
    assert.ok(/matches what you entered/i.test(matchHtml),
      'Should say it matches, got: ' + matchHtml);
    // (Other, unrelated checks on this fixture — e.g. statement recency — may still produce their
    // own "err"/"warn" messages; this test only cares that the holder-name check itself doesn't.)
    assert.ok(!/doesn't match the name you entered/i.test(matchHtml),
      'A matching name should not produce a holder-name mismatch message, got: ' + matchHtml);

    // Case 2: statement's "Account Name:" header is a clearly different person -- should get a
    // hard mismatch warning naming both the detected holder and the applicant's own entered name,
    // plus a pointer toward sponsor documentation as the alternative.
    var wrongHtml = await analyzeAndReadMsg(page, WRONG_NAME_STATEMENT);
    assert.ok(/scan-msg err/.test(wrongHtml), 'A mismatched name should produce an error message, got: ' + wrongHtml);
    assert.ok(/MICHAEL EMEKA OKONKWO/.test(wrongHtml), 'Should name the detected (wrong) account holder, got: ' + wrongHtml);
    assert.ok(/Test Applicant/.test(wrongHtml), 'Should reference the applicant\'s own entered name, got: ' + wrongHtml);
    assert.ok(/sponsor/i.test(wrongHtml), 'Should point toward sponsor documentation as the alternative, got: ' + wrongHtml);

    // Case 3: guard -- with no name typed in yet, there's nothing to cross-check against, so no
    // holder-name message (matching or mismatched) should appear at all.
    var page2 = await newPageAt(ctx.browser, '/index.html');
    try {
      await passConsentGate(page2);
      await goToSessionByPill(page2, 4);
      var noNameHtml = await analyzeAndReadMsg(page2, WRONG_NAME_STATEMENT);
      assert.ok(!/account holder/i.test(noNameHtml),
        'With no applicant name entered, should not attempt a holder-name cross-check at all, got: ' + noNameHtml);
    } finally {
      await page2.context().close();
    }
  } finally {
    await page.context().close();
  }
};
