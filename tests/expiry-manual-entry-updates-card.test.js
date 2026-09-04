'use strict';
// Real gap left by expiry-not-detected-jump-link.test.js's own fix: the "type it in below" link got
// the applicant to Session 1's f_passportExpiry field, but typing a date there never told the scan
// card back up in "Validate your International Passport" — it kept reading "Expires: not detected"
// forever, exactly as if nothing had happened, even after the applicant did precisely what the card
// itself asked. Fixed by having renderPassportCard() fall back to the manually-typed value when OCR
// couldn't recover one, and re-running that same card render whenever f_passportExpiry changes (see
// state.passport.scanText / the f_passportExpiry 'change' listener in index.html). Uses the exact
// same deliberately-unrecoverable fixture as that other test, so this picks up right where it leaves
// off.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'expiry-unrecoverable-fixture.pdf');

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

    var htmlBefore = await page.$eval('#passportValidateResult', function(el){ return el.innerHTML; });
    assert.ok(/not detected/.test(htmlBefore), 'Expiry should start out not detected on this deliberately-unrecoverable fixture, got: ' + htmlBefore);

    // Type the expiry in manually, the way the "type it in below" link points the applicant to do.
    await page.fill('#f_passportExpiry', '2030-06-15');
    await page.dispatchEvent('#f_passportExpiry', 'change');
    await page.waitForTimeout(200);

    var htmlAfter = await page.$eval('#passportValidateResult', function(el){ return el.innerHTML; });
    assert.ok(!/not detected/.test(htmlAfter), 'Expiry row should no longer say not detected once it\'s been typed in, got: ' + htmlAfter);
    assert.ok(/entered manually/.test(htmlAfter), 'Expiry row should be clearly marked as manually entered, not silently shown as if OCR had read it, got: ' + htmlAfter);
    assert.ok(/6\/15\/2030/.test(htmlAfter), 'Expiry row should show the actual typed date, got: ' + htmlAfter);

    // The jump-link itself should be gone now that there's a real value to show instead.
    var jumpLinkGone = await page.$('#passportValidateResult a.expiry-jump-link');
    assert.strictEqual(jumpLinkGone, null, 'The "type it in below" link should disappear once a value is showing');

    // Editing it again should keep the card in sync, not just work once.
    await page.fill('#f_passportExpiry', '2031-01-01');
    await page.dispatchEvent('#f_passportExpiry', 'change');
    await page.waitForTimeout(200);
    var htmlThird = await page.$eval('#passportValidateResult', function(el){ return el.innerHTML; });
    assert.ok(/1\/1\/2031/.test(htmlThird), 'Expiry row should update again after a second manual edit, got: ' + htmlThird);
  } finally {
    await page.context().close();
  }
};
