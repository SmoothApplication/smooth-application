'use strict';
// Real user report (a genuine "low quality phone photo" scan, shared with real passport screenshots):
// even after the fixMrzDateLetters()/widened-printed-fallback fix (see expiry-letter-misread-fixture.test.js),
// some scans still can't recover an expiry date at all — the MRZ field itself came back with characters
// that aren't a plausible OCR-confusable digit/letter (this fixture uses "XXXXXX" to force exactly that),
// AND the passport has no printed "Date of Expiry" line for the fallback to find either. That's a genuine
// dead end for automatic extraction — nothing in this app can safely guess a date here. What WAS missing
// was any way forward: "Expires: not detected" alone didn't tell the applicant there's already a plain
// text field just below where they can type it in themselves. This checks that a "not detected" expiry
// now links straight to that field (Session 1's f_passportExpiry, always present regardless of scan
// success) and actually focuses it.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'expiry-unrecoverable-fixture.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    // "Validate your International Passport" is Session 1 — already the active session right after
    // the consent gate, same starting point expiry-letter-misread-fixture.test.js uses.
    await passConsentGate(page);
    await page.setInputFiles('#file_passportValidate', FIXTURE);
    await page.click('#btnPassportValidateAttach');
    await page.waitForFunction(function(){
      var el = document.getElementById('passportValidateResult');
      return el && el.innerHTML.indexOf('passport-card') !== -1;
    }, { timeout: 20000 });
    await page.waitForTimeout(300);

    var html = await page.$eval('#passportValidateResult', function(el){ return el.innerHTML; });
    assert.ok(/not detected/.test(html), 'This fixture is deliberately unrecoverable — Expires should read not detected, got: ' + html);
    var jumpLink = await page.$('#passportValidateResult a.expiry-jump-link');
    assert.ok(jumpLink, 'A "type it in below" link should appear next to the not-detected expiry row');
    var linkText = await page.$eval('#passportValidateResult a.expiry-jump-link', function(el){ return el.textContent; });
    assert.strictEqual(linkText, 'type it in below');

    // Other fields on this same fixture (name, DOB, passport number) all read fine — isolates this
    // test to the expiry-specific dead end rather than a broader read failure.
    assert.ok(/FATIMA ADAEZE IBRAHIM/.test(html), 'Name should still read correctly on this fixture, got: ' + html);

    // Clicking it should land the applicant right in the manual field, cursor ready.
    await page.click('#passportValidateResult a.expiry-jump-link');
    await page.waitForTimeout(300); // smooth scroll + highlight timing
    var focusedId = await page.evaluate(function(){ return document.activeElement && document.activeElement.id; });
    assert.strictEqual(focusedId, 'f_passportExpiry', 'The manual expiry field should end up focused so the applicant can just start typing');
  } finally {
    await page.context().close();
  }
};
