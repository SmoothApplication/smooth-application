'use strict';
// User request ("batch29"): a new EU/Schengen-only question on the Travel Experience session —
// "Do you have the money ready right now to travel to your desired European country?" A "Yes"
// reveals a purely informational follow-up about single-entry visa comfort (see te_euSingleEntryBox
// in index.html); a "No" reveals advice suggesting the applicant consider a UK application instead,
// since the UK typically grants a minimum 6-month multiple-entry visa versus a first-time Schengen
// single-entry visa typically valid only 10-15 days. Both branches are informational only — neither
// one gates readiness or blocks progress to the next session either way.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  // Part 1: EU/Schengen applicant — the question and both its branches.
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page, { country: 'EU' });
    await goToSessionByPill(page, 1);
    await page.waitForSelector('#te_firstTime');

    // EU applicant -> the funds-readiness question shows regardless of travel-history answer.
    await page.waitForFunction(function(){
      var el = document.getElementById('te_euFundsBox');
      return el && getComputedStyle(el).display !== 'none';
    }, { timeout: 3000 });

    // Neither sub-branch shows before the question itself is answered.
    var singleEntryVisible0 = await page.$eval('#te_euSingleEntryBox', function(el){ return getComputedStyle(el).display !== 'none'; });
    var ukAdviceVisible0 = await page.$eval('#te_euUkAdviceBox', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(singleEntryVisible0, false, 'Single-entry follow-up should be hidden before "Do you have the money ready" is answered');
    assert.strictEqual(ukAdviceVisible0, false, 'UK-instead advice should be hidden before "Do you have the money ready" is answered');

    // "Yes" -> single-entry comfort follow-up appears, UK advice stays hidden.
    await page.selectOption('#te_euFundsReady', 'yes');
    await page.waitForFunction(function(){
      var el = document.getElementById('te_euSingleEntryBox');
      return el && getComputedStyle(el).display !== 'none';
    }, { timeout: 3000 });
    var ukAdviceVisibleAfterYes = await page.$eval('#te_euUkAdviceBox', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(ukAdviceVisibleAfterYes, false, 'UK-instead advice should stay hidden once "Yes" is picked');
    var followUpText = await page.$eval('#te_euSingleEntryBox', function(el){ return el.textContent; });
    assert.ok(/single-entry visa/i.test(followUpText), 'Follow-up should ask about single-entry visa comfort, got: ' + followUpText);
    assert.ok(/10-15 days/.test(followUpText), 'Follow-up should mention the typical 10-15 day validity, got: ' + followUpText);

    // The "this doesn't affect your checklist/block anything" reassurance used to sit inline as a
    // "Why?" toggle; it's now one of the toggles collectReasons() relocates into the Reasons tab
    // (see reasons-tab.test.js), so it's checked there instead of on the question itself.
    await page.click('#reasonsTabBtn');
    await page.waitForSelector('#reasonsModalOverlay:not([hidden])');
    var reasonsHtml = await page.$eval('#reasonsModalBody', function(el){ return el.innerHTML; });
    assert.ok(/doesn\'t affect your checklist|doesn\'t block/i.test(reasonsHtml), 'Reasons tab should still explain this is non-blocking, got: ' + reasonsHtml.slice(0, 400));
    await page.click('#reasonsModalClose');

    // Answering the single-entry follow-up must not be sticky/required for anything — switching
    // the parent question back to "No" should cleanly swap branches.
    await page.selectOption('#te_euSingleEntryComfort', 'yes');
    await page.selectOption('#te_euFundsReady', 'no');
    await page.waitForFunction(function(){
      var el = document.getElementById('te_euUkAdviceBox');
      return el && getComputedStyle(el).display !== 'none';
    }, { timeout: 3000 });
    var singleEntryVisibleAfterNo = await page.$eval('#te_euSingleEntryBox', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(singleEntryVisibleAfterNo, false, 'Single-entry follow-up should hide once "No" is picked');
    var adviceText = await page.$eval('#te_euUkAdviceBox', function(el){ return el.textContent; });
    assert.ok(/United Kingdom|UK/.test(adviceText), 'Advice should recommend considering the UK, got: ' + adviceText);
    assert.ok(/6 months/.test(adviceText), 'Advice should mention the UK\'s typical 6-month minimum validity, got: ' + adviceText);
    assert.ok(/multiple entry/i.test(adviceText), 'Advice should mention multiple entry, got: ' + adviceText);
    assert.ok(/general guidance, not a guarantee/i.test(adviceText), 'Advice should carry the general-guidance disclaimer, got: ' + adviceText);
    assert.ok(/free to continue with your European application/i.test(adviceText), 'Advice should make clear the applicant can still continue with Europe, got: ' + adviceText);

    // Non-blocking check: fill in the (unrelated) earlier Passport session so the 70%-readiness
    // gate is judged on Travel Experience's own progress, then answer "Have you travelled outside
    // Nigeria before?" -> "No" (100% for this session per the existing grading rule) while leaving
    // the new EU question unanswered. The next session pill must NOT be locked — proving the new
    // question is never counted toward readiness and never gates progress either way.
    await goToSessionByPill(page, 0);
    await page.fill('#f_passportNumber', 'B12345678');
    await page.fill('#f_passportExpiry', '2031-01-01');
    await goToSessionByPill(page, 1);
    await page.selectOption('#te_firstTime', 'no');
    await page.selectOption('#te_euFundsReady', '');
    await page.waitForFunction(function(){
      var pill = document.querySelector('.session-pill[data-idx="2"]');
      return pill && !pill.disabled;
    }, { timeout: 3000 });
  } finally {
    await page.context().close();
  }

  // Part 2: a non-EU (UK) applicant should never see this question at all.
  var page2 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page2, { country: 'UK' });
    await goToSessionByPill(page2, 1);
    await page2.waitForSelector('#te_firstTime');
    await page2.selectOption('#te_firstTime', 'no');
    await page2.waitForTimeout(200);
    var euBoxVisibleForUk = await page2.$eval('#te_euFundsBox', function(el){ return getComputedStyle(el).display !== 'none'; });
    assert.strictEqual(euBoxVisibleForUk, false, 'The EU funds-readiness question should not show for a UK applicant');
  } finally {
    await page2.context().close();
  }
};
