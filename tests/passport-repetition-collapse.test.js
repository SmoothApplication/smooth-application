'use strict';
// The passport is scanned/verified as its own guided first step (Session 1 - "Validate your
// International Passport", data-session-key="passport"). It also appears as a "Valid passport"
// checklist item under the Identity & application category (a later session), since that's the
// category the CHECKLIST data model puts it in alongside photo/application form/fee. Originally
// that category item showed its own full explanation + a second, separate "attach a file" upload
// row - even once the passport was already on file from Session 1, which read as asking the
// applicant to redo something already done ("repetition kills user attention" - field feedback).
// A first fix hid the raw upload row behind a "Replace file" toggle once a file was attached, but
// the item still repeated the full tip text and its own "Attached: ..." note as if it were a
// second, independent document. Direct feedback ("since passport has been verified in Session 1,
// the information ... should be moved to this page") led to this stronger version instead: the
// category item now shows only a short status line - "Verified in Session 1 - <filename>" once
// done, or "Not done yet? Complete this in Session 1" before - with a link that jumps straight to
// Session 1 (goToPassportSession()) rather than repeating any upload UI of its own. See
// renderItem()'s passport special-case in index.html.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

// A synthetic placeholder image, not a real passport scan - this test only exercises the
// attach/status-line/jump-link behavior (see attachFileToItem, which sets state + calls render()
// synchronously before OCR even starts), so it doesn't need a real, OCR-readable passport photo.
var SAMPLE_PASSPORT = path.join(__dirname, 'fixtures', 'sample-passport.jpg');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    // Identity & application is session index 7 (0: passport, 1: travelExperience,
    // 2: responsibilities, 3: trip, 4: finance2, 5: finance, 6: nextSteps,
    // 7: cat:Identity & application).
    await goToSessionByPill(page, 7);

    // Before attaching anything: no raw upload UI for this item on this page at all (that's owned
    // by Session 1 alone now), just a status line pointing there.
    var uploadRowExistsBefore = await page.$('#uploadRow_passport');
    assert.strictEqual(uploadRowExistsBefore, null, 'This page should never render its own upload row for the passport item');
    var attachedNoteExistsBefore = await page.$('#item_passport .attached-note');
    assert.strictEqual(attachedNoteExistsBefore, null, 'This page should not render a separate "Attached" note for the passport item');
    var statusBefore = await page.$eval('#item_passport .scan-msg', function(el){ return el.textContent; });
    assert.ok(/Not done yet/.test(statusBefore), 'Should prompt to complete it in Session 1 before anything is attached, got: ' + statusBefore);
    var jumpLinkBefore = await page.$('#item_passport a[id^="gotoPassportSession_"]');
    assert.ok(jumpLinkBefore, 'Should offer a link to jump to Session 1');

    // Attach a passport via Session 1's own scan (the same path a real applicant uses, and the
    // one whose state this item's status line reads from).
    await goToSessionByPill(page, 0);
    await page.setInputFiles('#file_passportValidate', SAMPLE_PASSPORT);
    await page.click('#btnPassportValidateAttach');

    // attachFileToItem() sets state + calls render() synchronously (scanning happens after), so
    // the checklist item's status line should already reflect the attachment without waiting on OCR.
    await goToSessionByPill(page, 7);
    await page.waitForFunction(function(){
      var el = document.querySelector('#item_passport .scan-msg');
      return el && /Verified in Session 1/.test(el.textContent);
    }, { timeout: 5000 });

    var statusAfter = await page.$eval('#item_passport .scan-msg', function(el){ return el.textContent; });
    assert.ok(/Verified in Session 1/.test(statusAfter), 'Should confirm it was verified in Session 1, got: "' + statusAfter + '"');
    assert.ok(/sample-passport\.jpg/.test(statusAfter), 'Should name the attached file, got: "' + statusAfter + '"');
    var uploadRowExistsAfter = await page.$('#uploadRow_passport');
    assert.strictEqual(uploadRowExistsAfter, null, 'Should still never render its own upload row for the passport item, even once attached');

    // Clicking the link should jump straight back to Session 1, not just scroll within this page.
    await page.click('#item_passport a[id^="gotoPassportSession_"]');
    await page.waitForFunction(function(){
      var el = document.querySelector('[data-session-key="passport"]');
      return el && el.style.display !== 'none';
    }, { timeout: 3000 });
  } finally {
    await page.context().close();
  }
};
