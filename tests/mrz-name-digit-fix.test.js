'use strict';
// Real user report: "After the name is generated from the passport, the o in [name] read as
// zero '0'." OCR (and, per this fixture, sometimes even a "scanned to PDF" text layer) can misread a
// letter "O" as digit "0" in the MRZ's name field. Per ICAO Doc 9303, the MRZ name field is letters and
// "<" filler ONLY — a digit can never legitimately appear there, so any digit found is always a misread
// and safe to auto-correct. This fixture embeds the reported pattern (a trailing "O" in a surname
// written as "0") directly into a real PDF text layer, so the test exercises the actual
// parseMrzFields()/fixMrzNameDigits() code path deterministically, without depending on Tesseract's
// non-deterministic OCR output on an image, and using entirely fictional passport data (not a real
// applicant's document).
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate } = require('./helpers');

var MRZ_DIGIT_FIXTURE = path.join(__dirname, 'fixtures', 'mrz-name-digit-fixture.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await page.setInputFiles('#file_passportValidate', MRZ_DIGIT_FIXTURE);
    await page.click('#btnPassportValidateAttach');
    await page.waitForFunction(function(){
      var el = document.getElementById('passportValidateResult');
      return el && el.innerHTML.indexOf('passport-card') !== -1;
    }, { timeout: 20000 });
    await page.waitForTimeout(300);

    var nameRowText = await page.$eval('#passportValidateResult', function(el){
      var rows = el.querySelectorAll('.passport-row');
      for (var i=0;i<rows.length;i++){
        if (/Name \(from MRZ\)/.test(rows[i].textContent)) return rows[i].textContent;
      }
      return '';
    });
    assert.ok(/IBIDAPO/.test(nameRowText), 'MRZ name row should read "IBIDAPO" with a letter O, not a digit 0, got: ' + nameRowText);
    assert.ok(!/IBIDAP0\b/.test(nameRowText), 'MRZ name row should NOT contain the misread digit "0" in place of the O, got: ' + nameRowText);

    var nameFieldVal = await page.$eval('#f_name', function(el){ return el.value; });
    assert.strictEqual(nameFieldVal, 'Grace Ibidapo', 'Auto-filled name field should use letter O throughout, got: ' + nameFieldVal);
  } finally {
    await page.context().close();
  }
};
