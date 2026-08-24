'use strict';
// The passport scan on Session 1 ("Validate your International Passport") and the "Valid passport"
// checklist item under Identity & application share the same underlying attachment state (via
// attachFileToItem). Before this fix, the checklist item always showed a raw, always-empty
// "Choose File" input next to the "Attached: ..." note even once a passport was on file, which
// read as asking the applicant to upload the same document twice ("repetition kills user
// attention"). Once a file is attached, the raw upload row should collapse behind a
// "Replace file" toggle instead.
// (The scan widget used to live inline on Your trip details — it moved into its own Session 1
// once that session was added, so this test attaches via Session 1 instead.)
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate, goToSessionByPill } = require('./helpers');

// A synthetic placeholder image, not a real passport scan — this test only exercises the
// attach/collapse/replace UI behavior (see attachFileToItem, which sets state + calls render()
// synchronously before OCR even starts), so it doesn't need a real, OCR-readable passport photo.
// It previously pointed at a real applicant's uploaded photo under a sandbox-only path, which
// doesn't exist in CI and made this test fail there.
var SAMPLE_PASSPORT = path.join(__dirname, 'fixtures', 'sample-passport.jpg');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    // Identity & application is a checklist category grouped into the merged 'idFinancialDocs'
    // session — index 2 (0: aboutYou, 1: financialReadiness, 2: idFinancialDocs). The passport scan
    // widget itself lives on 'aboutYou' — index 0 — since it's the passport sub-card there.
    await goToSessionByPill(page, 2);

    // Before attaching anything, the checklist item's own upload row should show normally (no
    // file attached yet, so nothing to collapse) and there should be no "Replace file" toggle.
    var uploadRowVisibleBefore = await page.$eval('#uploadRow_passport', function(el){ return el.style.display !== 'none'; });
    assert.strictEqual(uploadRowVisibleBefore, true, 'Upload row should be visible before any passport is attached');
    var replaceBtnBefore = await page.$('#btnReplace_passport');
    assert.strictEqual(replaceBtnBefore, null, 'Replace-file toggle should not exist before a passport is attached');

    // Attach a passport via Session 1's own scan (the same path a real applicant uses, and the
    // one that shares state with the checklist item).
    await goToSessionByPill(page, 0);
    await page.setInputFiles('#file_passportValidate', SAMPLE_PASSPORT);
    await page.click('#btnPassportValidateAttach');

    // attachFileToItem() sets state + calls render() synchronously (scanning happens after), so
    // the checklist item should already reflect the attachment without waiting on OCR.
    await page.waitForFunction(function(){
      var row = document.getElementById('uploadRow_passport');
      return row && row.style.display === 'none';
    }, { timeout: 5000 });

    await goToSessionByPill(page, 2);

    var uploadRowVisibleAfter = await page.$eval('#uploadRow_passport', function(el){ return el.style.display; });
    assert.strictEqual(uploadRowVisibleAfter, 'none', 'Upload row should be hidden once a passport is attached, got display: "' + uploadRowVisibleAfter + '"');

    var attachedNoteText = await page.$eval('#item_passport .attached-note', function(el){ return el.textContent; });
    assert.ok(/Attached/i.test(attachedNoteText), 'Should still show the "Attached: ..." note, got: "' + attachedNoteText + '"');

    var replaceBtnVisible = await page.$eval('#btnReplace_passport', function(el){ return el.offsetParent !== null; });
    assert.strictEqual(replaceBtnVisible, true, 'Replace-file toggle should be visible once a passport is attached');

    // Clicking "Replace file" should reveal the raw upload row again and hide the toggle.
    await page.click('#btnReplace_passport');
    var uploadRowAfterToggle = await page.$eval('#uploadRow_passport', function(el){ return el.style.display; });
    assert.strictEqual(uploadRowAfterToggle, 'flex', 'Upload row should reappear after clicking "Replace file", got display: "' + uploadRowAfterToggle + '"');

    var replaceBtnHiddenAfterClick = await page.$eval('#btnReplace_passport', function(el){ return el.offsetParent === null; });
    assert.strictEqual(replaceBtnHiddenAfterClick, true, 'Replace-file toggle should hide itself after being clicked');
  } finally {
    await page.context().close();
  }
};
