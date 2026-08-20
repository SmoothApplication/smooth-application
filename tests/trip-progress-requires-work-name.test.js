'use strict';
// User report: "100% complete and the business name is not written" -- the "Your trip details"
// session's progress % ignored the employer/business name field entirely, even though it becomes
// required (marked with a red *) the moment "I'm self-employed" or "I'm currently employed" is
// checked. That let the session read 100% filled while a required field sat empty.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

async function readTripHeader(page){
  return page.evaluate(function(){
    // "Your trip details" is session index 3 (0: passport, 1: travelExperience,
    // 2: responsibilities, 3: trip), i.e. "Session 4" in the 1-based header text.
    var m = document.body.innerText.match(/Session 4 of \d+.*?filled/);
    return m ? m[0] : null;
  });
}

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 3);
    await page.fill('#f_name', 'Test Applicant');
    await page.selectOption('#f_purpose', { index: 1 });
    await page.fill('#f_traveldate', '2026-12-01');
    await page.fill('#f_returndate', '2026-12-06');
    await page.fill('#f_appdate', '2026-10-01');

    // With "Work status" still on its unselected placeholder, this should NOT read 100% -- same bug
    // class as the employer/business name check below: a user reported "100% complete" while "Work
    // status" itself sat unanswered.
    var beforeWorkStatus = await readTripHeader(page);
    assert.ok(beforeWorkStatus && !/100% filled/.test(beforeWorkStatus), 'Should NOT read 100% while Work status is still unselected, got: ' + beforeWorkStatus);

    await page.selectOption('#f_workStatus', 'selfEmployed');
    await page.waitForTimeout(300);
    var withBlankBusinessName = await readTripHeader(page);
    assert.ok(withBlankBusinessName && !/100% filled/.test(withBlankBusinessName),
      'Should NOT read 100% while business name is required but blank, got: ' + withBlankBusinessName);

    await page.fill('#f_businessName', 'Okafor Fashion House');
    await page.waitForTimeout(300);
    var afterFilled = await readTripHeader(page);
    assert.ok(afterFilled && /100% filled/.test(afterFilled), 'Should read 100% again once business name is filled, got: ' + afterFilled);

    // Same check for the employer-name path (employed, not self-employed).
    await page.selectOption('#f_workStatus', 'employed');
    await page.waitForTimeout(300);
    var withBlankEmployerName = await readTripHeader(page);
    assert.ok(withBlankEmployerName && !/100% filled/.test(withBlankEmployerName),
      'Should NOT read 100% while employer name is required but blank, got: ' + withBlankEmployerName);

    await page.fill('#f_employerName', 'Zenith Bank Plc');
    await page.waitForTimeout(300);
    var afterEmployerFilled = await readTripHeader(page);
    assert.ok(afterEmployerFilled && /100% filled/.test(afterEmployerFilled), 'Should read 100% again once employer name is filled, got: ' + afterEmployerFilled);
  } finally {
    await page.context().close();
  }
};
