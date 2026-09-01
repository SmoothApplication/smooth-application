'use strict';
// Real user report (shared as an actual passport photo): the MRZ auto-fill produced "Faith
// Folasade K Klllllllll Bello" instead of "Faith Folasade Bello" — stray OCR noise from
// the name field's trailing "<" padding survived as two extra tokens ("K" and "KLLLLLLLLLL")
// instead of clean filler, since a row of visually-identical "<" chevrons tends to get misread as
// visually-identical letters too.
//
// An earlier fix already stripped a single BARE TRAILING letter (e.g. "ADAEZE CHIOMA K" ->
// "ADAEZE CHIOMA" — see low-end-phone-mrz-fixture.test.js), but this real case has two tokens, one
// of which is a long run of a repeated letter, not a single bare letter, and neither is necessarily
// at the very end. Generalized in parseMrzFields() to drop, anywhere in the given-name field: any
// bare single-letter word, and any word matching an optional odd leading character followed by 3+
// repeats of the same letter — patterns a genuine given name never legitimately contains, but
// misread filler reliably produces.
//
// Deterministic PDF text-layer fixture (not a live OCR image, so this test doesn't depend on
// Tesseract's non-deterministic output) reproducing the exact reported noise pattern, using an
// entirely FICTIONAL identity (not the real reporter's passport data) — see
// mrz-given-name-noise-fixture.pdf.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'mrz-given-name-noise-fixture.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await page.setInputFiles('#file_passportValidate', FIXTURE);
    await page.click('#btnPassportValidateAttach');
    await page.waitForFunction(function(){
      var el = document.getElementById('passportValidateResult');
      return el && el.innerHTML.indexOf('passport-card') !== -1;
    }, { timeout: 20000 });
    await page.waitForTimeout(300);

    var nameFieldVal = await page.$eval('#f_name', function(el){ return el.value; });
    assert.strictEqual(nameFieldVal, 'Temitope Grace Adeyemi', 'Auto-filled name should have no leftover OCR noise from the padding tail, got: ' + JSON.stringify(nameFieldVal));
    assert.ok(!/\bK\b/.test(nameFieldVal), 'Should not contain the bare-letter noise token "K", got: ' + JSON.stringify(nameFieldVal));
    assert.ok(!/L{3,}/i.test(nameFieldVal), 'Should not contain the repeated-letter noise token, got: ' + JSON.stringify(nameFieldVal));

    // The passport session's own name field (see task: "the name is not editable but it is the
    // wrong name") should show the same clean value, and be directly editable — not a readonly
    // mirror pointing the applicant somewhere else to fix it.
    var pvNameVal = await page.$eval('#pv_name', function(el){ return el.value; });
    assert.strictEqual(pvNameVal, nameFieldVal, 'pv_name should mirror the same cleaned-up name');
    var pvNameReadonly = await page.$eval('#pv_name', function(el){ return el.hasAttribute('readonly'); });
    assert.strictEqual(pvNameReadonly, false, 'pv_name should be directly editable, not readonly');

    // Correcting it right there should carry through to f_name (two-way sync).
    await page.fill('#pv_name', 'Corrected Applicant Name');
    var fNameAfterEdit = await page.$eval('#f_name', function(el){ return el.value; });
    assert.strictEqual(fNameAfterEdit, 'Corrected Applicant Name', 'Editing pv_name directly should update f_name too');
  } finally {
    await page.context().close();
  }
};
