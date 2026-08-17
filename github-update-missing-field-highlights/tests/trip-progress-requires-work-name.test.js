'use strict';
// User report: "100% complete and the business name is not written" -- the "Your trip details"
// session's progress % ignored the employer/business name field entirely, even though it becomes
// required (marked with a red *) the moment "I'm self-employed" or "I'm currently employed" is
// checked. That let the session read 100% filled while a required field sat empty.
const assert = require('assert');
const { newPageAt, passConsentGate } = require('./helpers');

async function readTripHeader(page){
  return page.evaluate(function(){
    var m = document.body.innerText.match(/Session 1 of \d+.*?filled/);
    return m ? m[0] : null;
  });
}

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await page.fill('#f_name', 'Test Applicant');
    await page.selectOption('#f_purpose', { index: 1 });
    await page.fill('#f_traveldate', '2026-12-01');
    await page.fill('#f_returndate', '2026-12-06');
    await page.fill('#f_appdate', '2026-10-01');

    // Before ticking self-employed, the five base fields above are all that's required -- 100%.
    var beforeTick = await readTripHeader(page);
    assert.ok(beforeTick && /100% filled/.test(beforeTick), 'Should read 100% before self-employed is ticked, got: ' + beforeTick);

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
