'use strict';
// User report: "Once planned return date is [before] your travel date, the system should not allow
// you [to] proceed until you choose a date further than the travel date." This app has no
// traditional "Next" button hard-gate, so "not allow to proceed" is implemented as: (1) the return
// date field gets a clear red border plus the browser's own native validation message (via a dynamic
// `min` attribute + setCustomValidity/reportValidity), (2) the trip session's own progress % no longer
// counts an invalid return date as "filled in" (same bug class already fixed for employer/business
// name), which in turn means the existing "Next →" soft-nudge (attemptAdvanceSession) now correctly
// warns the applicant before they move on with the dates still wrong.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 0); // 'About you' — holds the trip card, among 3 others.

    // "Your trip details" now shares one aggregate "X% filled" header with 3 other cards (passport /
    // travel experience / responsibilities — see getVisibleSessionKeys() in index.html), so those are
    // completed first (8 guaranteed points: 2 + 1 + 5) — the percentages asserted below are recomputed
    // against the new combined total of 14 (8 + trip's own 6), not trip's old standalone total of 6.
    await page.fill('#f_passportNumber', 'A12345678');
    await page.fill('#f_passportExpiry', '2030-01-01');
    await page.selectOption('#te_firstTime', 'no');
    await page.selectOption('#rs_numKids', '0');
    await page.selectOption('#rs_state', 'Lagos');
    await page.waitForFunction(function(){
      var el = document.getElementById('rs_lga');
      return el && el.options.length > 1;
    });
    await page.selectOption('#rs_lga', { index: 1 });
    await page.fill('#rs_addressNumber', '14');
    await page.fill('#rs_addressName', 'Adeola Odeku Street');

    await page.fill('#f_name', 'Test Applicant');
    await page.selectOption('#f_purpose', 'tourism');
    await page.selectOption('#f_workStatus', 'student');
    await page.fill('#f_traveldate', '2026-10-26');
    await page.fill('#f_returndate', '2026-09-14'); // BEFORE the travel date — invalid
    await page.fill('#f_appdate', '2026-08-24');
    await page.waitForTimeout(200);

    // 1) The return date field itself should be visibly flagged invalid, with its native `min`
    // constraint set to the day after the travel date.
    var isFlagged = await page.$eval('#f_returndate', function(el){ return el.classList.contains('field-invalid'); });
    assert.strictEqual(isFlagged, true, 'Return date field should carry the field-invalid class when it is before the travel date');
    var minAttr = await page.$eval('#f_returndate', function(el){ return el.getAttribute('min'); });
    assert.strictEqual(minAttr, '2026-10-27', 'min attribute should be the day after the travel date, got: ' + minAttr);
    var validityValid = await page.$eval('#f_returndate', function(el){ return el.validity.valid; });
    assert.strictEqual(validityValid, false, 'Return date input should be in a native :invalid state');

    // 2) The inline trip-length note should explain the problem, styled as an error.
    var tripLengthNoteText = await page.$eval('#tripLengthNote', function(el){ return el.textContent; });
    assert.ok(/must be after your travel date/i.test(tripLengthNoteText), 'Trip length note should explain the date problem, got: ' + tripLengthNoteText);
    var tripLengthNoteIsError = await page.$eval('#tripLengthNote', function(el){ return el.classList.contains('error'); });
    assert.strictEqual(tripLengthNoteIsError, true, 'Trip length note should carry the error style while the dates are invalid');

    // 3) The session's aggregate progress % should NOT count the invalid return date as filled — with
    // passport/travel-experience/responsibilities complete (8 points) and trip's name/purpose/
    // workStatus/traveldate/appdate filled but returndate invalid (5 of trip's own 6), that's 13 of 14
    // total, i.e. 93%, not the 100% it would wrongly show if the raw non-empty value counted.
    var progressText = await page.$eval('#sessionProgressPct', function(el){ return el.textContent; });
    assert.ok(/93% filled/.test(progressText), 'Session should read 93% filled (return date not counted) while dates are invalid, got: ' + progressText);

    // 4) Fixing the return date to a valid, later one should clear the invalid state and bring the
    // session back to 100%.
    await page.fill('#f_returndate', '2026-11-05');
    await page.waitForTimeout(200);
    var isFlaggedAfterFix = await page.$eval('#f_returndate', function(el){ return el.classList.contains('field-invalid'); });
    assert.strictEqual(isFlaggedAfterFix, false, 'Return date field should no longer be flagged once it is after the travel date');
    var progressTextAfterFix = await page.$eval('#sessionProgressPct', function(el){ return el.textContent; });
    assert.ok(/100% filled/.test(progressTextAfterFix), 'Session should read 100% filled once the return date is valid (all 14 points), got: ' + progressTextAfterFix);

    // 5) The existing "Next →" soft-nudge should fire a confirm() dialog when leaving a section that
    // isn't fully filled in — re-break the dates and confirm clicking Next actually triggers it.
    await page.fill('#f_returndate', '2026-09-14');
    await page.waitForTimeout(200);
    var dialogMessage = null, dialogHandled = false;
    function handleDialog(dialog){
      if (dialogHandled) return;
      dialogHandled = true;
      dialogMessage = dialog.message();
      dialog.dismiss().catch(function(){});
    }
    page.on('dialog', handleDialog);
    await page.click('#sessionFooterNextBtn');
    await page.waitForTimeout(200);
    page.off('dialog', handleDialog);
    assert.ok(dialogMessage && /only \d+% done/i.test(dialogMessage), 'Clicking "Next" with an invalid return date should trigger the soft-nudge confirm dialog, got: ' + dialogMessage);
  } finally {
    await page.context().close();
  }
};
