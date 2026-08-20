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
    await goToSessionByPill(page, 3); // trip session

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

    // 3) The trip session's own progress % should NOT count the invalid return date as filled — with
    // name/purpose/workStatus/traveldate/appdate filled (purpose has a default) and returndate invalid,
    // that's 5 of 6 fields, i.e. 83%, not the 100% it would wrongly show if the raw non-empty value counted.
    var progressText = await page.$eval('#sessionProgressPct', function(el){ return el.textContent; });
    assert.ok(/83% filled/.test(progressText), 'Trip session should read 83% filled (return date not counted) while dates are invalid, got: ' + progressText);

    // 4) Fixing the return date to a valid, later one should clear the invalid state and bring the
    // session back to 100%.
    await page.fill('#f_returndate', '2026-11-05');
    await page.waitForTimeout(200);
    var isFlaggedAfterFix = await page.$eval('#f_returndate', function(el){ return el.classList.contains('field-invalid'); });
    assert.strictEqual(isFlaggedAfterFix, false, 'Return date field should no longer be flagged once it is after the travel date');
    var progressTextAfterFix = await page.$eval('#sessionProgressPct', function(el){ return el.textContent; });
    assert.ok(/100% filled/.test(progressTextAfterFix), 'Trip session should read 100% filled once the return date is valid, got: ' + progressTextAfterFix);

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
