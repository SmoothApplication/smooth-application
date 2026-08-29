'use strict';
// User feedback: "Can the system point out where I have not filled before proceeding." Clicking
// "Next →" on an incomplete session already showed a soft "you're only X% done" confirm, but never
// said WHICH field was still empty. It now names the specific missing field(s)/checklist item(s) in
// that same confirm message, and outlines each one in red (reusing the existing invalid-field style)
// with a scroll straight to the first one, so the applicant doesn't have to hunt for it themselves.
//
// Passport / travel experience / responsibilities / trip are each their own session again (indexes
// 0-3 — see getVisibleSessionKeys() in index.html), and a session below READY_THRESHOLD_PERCENT
// (70%) now hard-blocks "Next" instead of showing this dismissible nudge — see
// session-readiness-gate.test.js for that behavior. So this test completes passport/travel
// experience/responsibilities in full, then on "Your trip details" (6 required fields:
// f_name/f_purpose/f_traveldate/f_returndate/f_appdate/f_workStatus) leaves only ONE field
// (f_purpose) blank, keeping the session at 5 of 6 = 83% — above the hard-block threshold, so the
// original dismissible "Still needed" nudge this test is actually about still applies.
const assert = require('assert');
const { launchBrowser, PORT, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var context = await ctx.browser.newContext();
  var page = await context.newPage();
  var dialogMessages = [];
  page.on('dialog', function(d){
    dialogMessages.push(d.message());
    d.dismiss();
  });
  try {
    await page.goto('http://127.0.0.1:' + PORT + '/index.html');
    // The confidence quiz is now the first thing shown — skip it to reach the consent gate.
    await page.waitForSelector('#quizSkipLink');
    await page.click('#quizSkipLink');
    await page.waitForSelector('#gateCountrySelect');
    await page.selectOption('#gateCountrySelect', 'UK');
    await page.check('#gateAgree', { force: true });
    await page.click('#gateContinue');
    await page.waitForFunction(function(){
      var el = document.getElementById('appWrap');
      return el && el.style.display !== 'none';
    }, { timeout: 5000 });

    // Passport (session 0).
    await goToSessionByPill(page, 0);
    await page.fill('#f_passportNumber', 'A12345678');
    await page.fill('#f_passportExpiry', '2030-01-01');

    // Travel experience (session 1) — answering "No" is itself worth full marks.
    await goToSessionByPill(page, 1);
    await page.selectOption('#te_firstTime', 'no');

    // Responsibilities (session 2).
    await goToSessionByPill(page, 2);
    await page.selectOption('#rs_numKids', '0');
    await page.selectOption('#rs_state', 'Lagos');
    await page.waitForFunction(function(){
      var el = document.getElementById('rs_lga');
      return el && el.options.length > 1;
    });
    await page.selectOption('#rs_lga', { index: 1 });
    await page.selectOption('#rs_bedrooms', '2bed');
    await page.fill('#rs_addressNumber', '14');
    await page.fill('#rs_addressName', 'Adeola Odeku Street');

    // Trip (session 3) — 5 of 6 required fields, deliberately leaving "Main purpose of visit" blank.
    await goToSessionByPill(page, 3);
    await page.fill('#f_name', 'Test Applicant');
    await page.selectOption('#f_workStatus', 'student');
    await page.fill('#f_traveldate', '2026-12-01');
    await page.fill('#f_returndate', '2026-12-06');
    await page.fill('#f_appdate', '2026-10-01');
    await page.evaluate(function(){ document.activeElement && document.activeElement.blur(); });
    await page.waitForTimeout(150);
    await page.click('#sessionFooterNextBtn');
    await page.waitForTimeout(200);

    assert.strictEqual(dialogMessages.length, 1, 'Clicking Next on an 83%-done (above the hard-block threshold) session should trigger the soft-nudge confirm');
    assert.ok(/Still needed:/.test(dialogMessages[0]), 'Confirm message should list what\'s still needed, got: ' + dialogMessages[0]);
    assert.ok(/Main purpose of visit/.test(dialogMessages[0]), 'Confirm message should name the missing purpose field, got: ' + dialogMessages[0]);
    assert.ok(!/Planned travel date/.test(dialogMessages[0]), 'Travel date is already filled, should NOT be listed as missing, got: ' + dialogMessages[0]);

    // Dismissing should keep the applicant on the same (still incomplete) session, with the missing
    // field visibly outlined right on the page.
    var stillOnTrip = await page.$eval('.session-pill.active', function(el){ return el.getAttribute('data-idx'); });
    assert.strictEqual(stillOnTrip, '3', 'Dismissing the nudge should keep the applicant on "Your trip details"');

    var purposeFlagged = await page.$eval('#f_purpose', function(el){ return el.classList.contains('field-invalid'); });
    assert.strictEqual(purposeFlagged, true, 'The empty "Main purpose of visit" field should be outlined in red');
    var travelDateFlagged = await page.$eval('#f_traveldate', function(el){ return el.classList.contains('field-invalid'); });
    assert.strictEqual(travelDateFlagged, false, 'The already-filled travel date field should NOT be flagged as missing');
    var nameFlagged = await page.$eval('#f_name', function(el){ return el.classList.contains('field-invalid'); });
    assert.strictEqual(nameFlagged, false, 'The already-filled name field should NOT be flagged as missing');

    // Fill in the last required trip field, then Next should advance without any nudge at all.
    await page.selectOption('#f_purpose', { index: 1 });
    await page.evaluate(function(){ document.activeElement && document.activeElement.blur(); });
    await page.waitForTimeout(200);

    dialogMessages.length = 0;
    await page.click('#sessionFooterNextBtn');
    await page.waitForTimeout(200);
    assert.strictEqual(dialogMessages.length, 0, 'A fully-filled "Your trip details" session should advance with no nudge dialog at all');
    var nowOnSession = await page.$eval('.session-pill.active', function(el){ return el.getAttribute('data-idx'); });
    assert.strictEqual(nowOnSession, '4', 'Should have actually advanced to "Income & bank statement analysis"');
  } finally {
    await page.context().close();
  }
};
