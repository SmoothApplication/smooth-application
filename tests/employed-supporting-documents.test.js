'use strict';
// Direct request, from 20 years of real UK/Canada visa consulting experience: employed applicants
// (not just self-employed ones) need their own extra scrutiny — the employer's name as it appears
// on the bank statement, a staff ID card, and a photo at the workplace, alongside the employment
// letter and leave-approval letter that already existed. The employment letter's own name must also
// tally with the applicant's name on file and on their bank statement (guidance text only, no
// automated name-extraction from a general letter document — see the tip on 'employmentLetter').
const assert = require('assert');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

exports.run = async function(ctx){
  // Scenario 1: employed — the new items should be required and visible, with the name-match tip.
  var page1 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page1);
    await goToSessionByPill(page1, 3); // trip — Work status lives here
    await page1.selectOption('#f_workStatus', 'employed');
    await page1.fill('#f_employerName', 'Some Employer Ltd');
    await page1.waitForTimeout(150);
    await goToSessionByPill(page1, 8); // 6 cat:Identity & application, 7 cat:Financial evidence, 8 cat:Ties to Nigeria
    await page1.waitForSelector('#item_staffId', { timeout: 5000 });

    var staffIdTag = await page1.$eval('#item_staffId .tag', function(el){ return el.textContent.trim(); });
    assert.strictEqual(staffIdTag, 'Required', 'Staff ID card should be required once employed is declared, got: ' + staffIdTag);

    var officePhotoTag = await page1.$eval('#item_officePhoto .tag', function(el){ return el.textContent.trim(); });
    assert.strictEqual(officePhotoTag, 'Required', 'Workplace photo should be required once employed is declared, got: ' + officePhotoTag);

    var employmentLetterTip = await page1.$eval('#item_employmentLetter .item-tip', function(el){ return el.textContent; });
    assert.ok(/name on this letter must match your name exactly as entered above/.test(employmentLetterTip),
      'Employment letter tip should require the name to tally with the applicant\'s own name, got: ' + employmentLetterTip);
    assert.ok(/as it appears on your bank statement/.test(employmentLetterTip),
      'Employment letter tip should also require the name to tally with the bank statement, got: ' + employmentLetterTip);

    // Still there alongside it — the pre-existing leave-approval letter shouldn't have been disturbed.
    var leaveLetterEl = await page1.$('#item_leaveLetter');
    assert.ok(leaveLetterEl, 'Employer\'s leave-approval letter should still be present');
  } finally {
    await page1.context().close();
  }

  // Scenario 2: nothing declared yet — neither new item should exist at all (appliesIf gates them,
  // same as every other employed-only document), so a fresh applicant isn't shown irrelevant asks.
  var page2 = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page2);
    await goToSessionByPill(page2, 8); // cat:Ties to Nigeria — always has applicable items (the 4 "Assets & investments" ones), so its index doesn't shift
    await page2.waitForSelector('#checklistRoot', { timeout: 5000 });
    var staffIdMissing = await page2.$('#item_staffId');
    assert.strictEqual(staffIdMissing, null, 'Staff ID card should not appear before employed is declared');
    var officePhotoMissing = await page2.$('#item_officePhoto');
    assert.strictEqual(officePhotoMissing, null, 'Workplace photo should not appear before employed is declared');
  } finally {
    await page2.context().close();
  }
};
