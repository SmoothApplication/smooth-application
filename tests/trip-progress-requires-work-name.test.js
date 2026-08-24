'use strict';
// User report: "100% complete and the business name is not written" -- the "Your trip details"
// session's progress % ignored the employer/business name field entirely, even though it becomes
// required (marked with a red *) the moment "I'm self-employed" or "I'm currently employed" is
// checked. That let the session read 100% filled while a required field sat empty.
//
// "Your trip details" now lives inside the merged 'About you' session (index 0, session 1 of 5)
// alongside passport / travel experience / responsibilities — see getVisibleSessionKeys() in
// index.html. The header's "X% filled" now reflects the SUM across all 4 cards, not trip alone, so
// this test fills in the other 3 first (each to a genuine, minimal 100%) before exercising the
// trip-specific employer/business-name gating this test actually locks in — that way "100% filled"
// in the header is only possible once the trip card's own required fields are truly complete too.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

async function readAboutYouHeader(page){
  return page.evaluate(function(){
    // 'About you' is session index 0, i.e. "Session 1" in the 1-based header text.
    var m = document.body.innerText.match(/Session 1 of \d+.*?filled/);
    return m ? m[0] : null;
  });
}

async function completeEverythingExceptTrip(page){
  // Passport (2 required fields).
  await page.fill('#f_passportNumber', 'A12345678');
  await page.fill('#f_passportExpiry', '2030-01-01');
  // Travel experience — answering "No" is itself worth full marks (no history rows required).
  await page.selectOption('#te_firstTime', 'no');
  // Responsibilities (5 base required fields; leaving "married"/"aged parents" unchecked keeps it to
  // just these, matching sessionProgress()'s 'responsibilities' branch in index.html).
  await page.selectOption('#rs_numKids', '0');
  await page.selectOption('#rs_state', 'Lagos');
  await page.waitForFunction(function(){
    var el = document.getElementById('rs_lga');
    return el && el.options.length > 1;
  });
  await page.selectOption('#rs_lga', { index: 1 });
  await page.fill('#rs_addressNumber', '14');
  await page.fill('#rs_addressName', 'Adeola Odeku Street');
}

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 0);
    await completeEverythingExceptTrip(page);

    await page.fill('#f_name', 'Test Applicant');
    await page.selectOption('#f_purpose', { index: 1 });
    await page.fill('#f_traveldate', '2026-12-01');
    await page.fill('#f_returndate', '2026-12-06');
    await page.fill('#f_appdate', '2026-10-01');
    await page.waitForTimeout(300);

    // Passport/travel-experience/responsibilities are all done, but "Work status" is still on its
    // unselected placeholder — should NOT read 100% (same bug class as the employer/business name
    // check below: a user reported "100% complete" while "Work status" itself sat unanswered).
    var beforeWorkStatus = await readAboutYouHeader(page);
    assert.ok(beforeWorkStatus && !/100% filled/.test(beforeWorkStatus), 'Should NOT read 100% while Work status is still unselected, got: ' + beforeWorkStatus);

    await page.selectOption('#f_workStatus', 'selfEmployed');
    await page.waitForTimeout(300);
    var withBlankBusinessName = await readAboutYouHeader(page);
    assert.ok(withBlankBusinessName && !/100% filled/.test(withBlankBusinessName),
      'Should NOT read 100% while business name is required but blank, got: ' + withBlankBusinessName);

    await page.fill('#f_businessName', 'Okafor Fashion House');
    await page.waitForTimeout(300);
    var afterFilled = await readAboutYouHeader(page);
    assert.ok(afterFilled && /100% filled/.test(afterFilled), 'Should read 100% again once business name is filled (and everything else in "About you" is complete), got: ' + afterFilled);

    // Same check for the employer-name path (employed, not self-employed).
    await page.selectOption('#f_workStatus', 'employed');
    await page.waitForTimeout(300);
    var withBlankEmployerName = await readAboutYouHeader(page);
    assert.ok(withBlankEmployerName && !/100% filled/.test(withBlankEmployerName),
      'Should NOT read 100% while employer name is required but blank, got: ' + withBlankEmployerName);

    await page.fill('#f_employerName', 'Zenith Bank Plc');
    await page.waitForTimeout(300);
    var afterEmployerFilled = await readAboutYouHeader(page);
    assert.ok(afterEmployerFilled && /100% filled/.test(afterEmployerFilled), 'Should read 100% again once employer name is filled, got: ' + afterEmployerFilled);
  } finally {
    await page.context().close();
  }
};
