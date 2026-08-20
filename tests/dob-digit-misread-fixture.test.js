'use strict';
// Real user report: "Reading as 3/9/1938 instead of 3/9/1988" -- a passport's date of birth, read from
// the MRZ, had an "8" OCR'd as a "3" in the birth year. Unlike the earlier name-field digit misread
// ("O" read as "0"), a birth-date field legitimately contains real digits, so it can't be "corrected"
// on sight -- it needs the MRZ's own check digit as evidence. But the check digit alone sometimes can't
// point to a single answer: "3" and "8" differ by exactly 5, and every MRZ check-digit weight (7, 3, 1)
// is odd, so swapping either digit at ANY position in the field shifts the checksum by the same amount
// regardless of position -- multiple equally "valid" corrections exist when a field (like this one) has
// more than one 3/8 digit, and the app deliberately won't guess between them. Instead it falls back to
// the plain "Date of birth" text most passport bio pages also print, in a different font, on a
// different part of the page -- a second, independent OCR read -- and uses that instead, flagging the
// swap plainly rather than silently showing a "corrected" value as if nothing needed fixing.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate } = require('./helpers');

var DOB_MISREAD_FIXTURE = path.join(__dirname, 'fixtures', 'dob-digit-misread-fixture.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await page.setInputFiles('#file_passportValidate', DOB_MISREAD_FIXTURE);
    await page.click('#btnPassportValidateAttach');
    await page.waitForFunction(function(){
      var el = document.getElementById('passportValidateResult');
      return el && el.innerHTML.indexOf('passport-card') !== -1;
    }, { timeout: 20000 });
    await page.waitForTimeout(300);

    var html = await page.$eval('#passportValidateResult', function(el){ return el.innerHTML; });

    var dobRowText = await page.$eval('#passportValidateResult', function(el){
      var rows = el.querySelectorAll('.passport-row');
      for (var i=0;i<rows.length;i++){
        if (/DOB/.test(rows[i].textContent)) return rows[i].textContent;
      }
      return '';
    });
    assert.ok(/1988/.test(dobRowText), 'DOB row should show the true birth year 1988 (recovered from the printed text), got: ' + dobRowText);
    assert.ok(!/1938/.test(dobRowText), 'DOB row should NOT show the misread year 1938, got: ' + dobRowText);

    assert.ok(/Auto-corrected/.test(html), 'Card should include an "Auto-corrected" row explaining the fix, got: ' + html);
    assert.ok(/printed/i.test(html) && /date of birth/i.test(html), 'Auto-corrected note should mention it matched against the printed date of birth, got: ' + html);

    // The MRZ zone's own checksum summary should still honestly say the birth-date check digit itself
    // didn't match -- the correction is sourced from the printed text, not from silently pretending the
    // MRZ read was fine all along.
    assert.ok(/date of birth.*didn't match|didn't match.*date of birth/i.test(html) || /matched —/.test(html),
      'MRZ checksum row should still be present and reference the mismatch, got: ' + html);
  } finally {
    await page.context().close();
  }
};
