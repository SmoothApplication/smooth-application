'use strict';
// Real user report (shared as an actual passport photo): the passport card showed "Expires: not
// detected" and "MRZ checksum: 2/4 matched — date of birth, expiry date check digits didn't match",
// even though the physical passport's expiry was perfectly legible ("Date of Expiry 06 OCT / OCT
// 27"). The date of birth field already had a fallback for exactly this shape of failure — a
// checksum mismatch matched instead against the plain "Date of birth" text printed elsewhere on the
// page (see dob-digit-misread-fixture.test.js) — but the expiry date field had no equivalent
// fallback at all, so a bad MRZ read there produced nothing rather than a second-source recovery.
//
// Root cause is slightly different from a simple confusable-digit swap (e.g. "8" read as "3", which
// the existing checksum-correction logic already handles): a genuinely non-digit OCR misread inside
// the MRZ's expiry field breaks parsing outright (mrzDateToDate requires 6 clean digits), not just
// the checksum. Fixed by adding extractPrintedExpiryDate() — the same fallback pattern as
// extractPrintedBirthDate — triggered whenever the MRZ-parsed expiry date is null OR its check
// digit doesn't match.
//
// Deterministic PDF text-layer fixture (not a live OCR image) reproducing that exact shape — a
// non-digit character inside the MRZ expiry field, with the printed "Date of Expiry" text intact —
// using an entirely FICTIONAL identity (not the real reporter's passport data) — see
// expiry-printed-fallback-fixture.pdf.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'expiry-printed-fallback-fixture.pdf');

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

    var html = await page.$eval('#passportValidateResult', function(el){ return el.innerHTML; });
    assert.ok(!/Expires[\s\S]{0,80}not detected/.test(html),
      'Expiry should no longer come back "not detected" when a printed fallback is available, got: ' + html.slice(0, 800));
    assert.ok(/Expires[\s\S]{0,40}2027/.test(html),
      'Expiry should show the year recovered from the printed text (2027), got: ' + html.slice(0, 800));
    assert.ok(/Auto-corrected/.test(html) && /expiry date/.test(html),
      'Should explain that the expiry date was matched against the printed text instead of the MRZ, got: ' + html.slice(0, 1200));

    // The ISO value on session 1's own expiry field isn't locale-format-dependent, unlike the
    // display text above — the authoritative check that the right date (not just the right year)
    // was recovered.
    var expiryFieldVal = await page.$eval('#f_passportExpiry', function(el){ return el.value; });
    assert.strictEqual(expiryFieldVal, '2027-10-06', 'Session 1\'s own expiry field should auto-fill with the recovered date, got: ' + expiryFieldVal);
  } finally {
    await page.context().close();
  }
};
