'use strict';
// User report (with a screenshot of a live case): "For some people either the father or mother is
// dead. consider this" — Session 3's aged-parents flow required BOTH father's and mother's names
// whenever "I have aged parents I support" was checked, with no way to indicate one parent had
// passed away, which incorrectly kept the section stuck below 100% filled for applicants in that
// situation. Fixed with a "Father/Mother has passed away / not applicable" checkbox next to each
// name field: checking it excuses that name from sessionProgress()'s required-field count, and also
// disables + clears that name input so a stale name can't linger in the saved payload.
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

// "Your responsibilities" now lives inside the merged 'About you' session (index 0) alongside
// passport / travel experience / trip — the "X% of this section filled" footer reflects the SUM
// across all 4 cards (see getVisibleSessionKeys() in index.html), so this test completes the other
// 3 first, minimally, so only the aged-parents sub-block below determines whether the aggregate
// reaches 100%.
async function readFooter(page){
  return page.evaluate(function(){
    var m = document.body.innerText.match(/(\d+)% of this section filled \((\d+) of (\d+)\)/);
    return m ? { pct: m[1], points: m[2], total: m[3] } : null;
  });
}

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await goToSessionByPill(page, 0);
    await page.waitForSelector('#rs_agedParents');

    // Passport (2 required fields).
    await page.fill('#f_passportNumber', 'A12345678');
    await page.fill('#f_passportExpiry', '2030-01-01');
    // Travel experience — "No" is itself worth full marks (no history rows required).
    await page.selectOption('#te_firstTime', 'no');
    // Trip details — 'student' work status adds no extra required fields (unlike employed/self-employed).
    await page.fill('#f_name', 'Test Applicant');
    await page.selectOption('#f_purpose', { index: 1 });
    await page.selectOption('#f_workStatus', 'student');
    await page.fill('#f_traveldate', '2026-12-01');
    await page.fill('#f_returndate', '2026-12-06');
    await page.fill('#f_appdate', '2026-10-01');

    // Fill everything else required in the responsibilities card, so only the parents sub-block
    // affects whether the aggregate hits 100%.
    await page.selectOption('#rs_numKids', '0');
    await page.selectOption('#rs_state', 'Lagos');
    await page.waitForFunction(function(){
      return document.getElementById('rs_lga').options.length > 1;
    }, { timeout: 3000 });
    await page.selectOption('#rs_lga', 'Ikeja');
    await page.fill('#rs_addressNumber', '14');
    await page.fill('#rs_addressName', 'Adeola Odeku Street');

    await page.check('#rs_agedParents', { force: true });
    await page.waitForSelector('#rs_fatherDeceased');

    // Father is deceased: tick his box, leave his name blank, fill mother + remittance. Section
    // should still reach 100% — the deceased father's name must not be required.
    await page.check('#rs_fatherDeceased', { force: true });
    var fatherDisabled = await page.$eval('#rs_fatherName', function(el){ return el.disabled; });
    assert.strictEqual(fatherDisabled, true, 'Father\'s name field should be disabled once marked deceased');
    await page.fill('#rs_motherName', 'Ngozi Okafor');
    await page.fill('#rs_remittance', '50000');
    await page.check('#rs_verifyConsent', { force: true });

    var after = await readFooter(page);
    assert.ok(after, 'Should show a footer');
    assert.strictEqual(after.pct, '100', 'Section should read 100% filled when the only missing name belongs to a parent marked deceased, got: ' + JSON.stringify(after));
    assert.strictEqual(after.points, after.total, 'Filled count should equal total, got: ' + JSON.stringify(after));

    // A name typed in before ticking "deceased" gets cleared out once the box is checked, so a
    // stale name can't linger in the saved payload.
    await page.uncheck('#rs_fatherDeceased', { force: true });
    await page.fill('#rs_fatherName', 'Emeka Okafor');
    await page.check('#rs_fatherDeceased', { force: true });
    var fatherNameAfterDeceasedCheck = await page.$eval('#rs_fatherName', function(el){ return el.value; });
    assert.strictEqual(fatherNameAfterDeceasedCheck, '', 'Father\'s name should be cleared once marked deceased, got: ' + JSON.stringify(fatherNameAfterDeceasedCheck));
  } finally {
    await page.context().close();
  }
};
