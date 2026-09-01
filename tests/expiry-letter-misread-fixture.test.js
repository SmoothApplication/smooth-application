'use strict';
// Real user report off a live scan: "Expires: not detected", with the MRZ checksum row reading only
// 2/4 matched — even though the passport's own printed "Date of Expiry" text was perfectly legible
// elsewhere on the page. Root cause: the MRZ's expiry field (positions 22-27 of line 2) had a letter
// where a digit should be (e.g. an "O" read where a "0" belonged) — a genuinely non-digit character,
// which the earlier digit-swap correction (see dob-digit-misread-fixture.test.js) can't fix at all,
// since that machinery only ever swaps one CONFUSABLE DIGIT for another, never a letter for a digit.
// mrzDateToDate's own `/^\d{6}$/` guard rejected the field outright before the checksum machinery
// even got a chance to run, so this used to fall straight through to "not detected" — and on the
// user's real scan, the printed-text fallback ALSO didn't catch it (the "Date of Expiry" label sits
// close to the photo/security-hologram on most bio pages, an area that OCRs worse than plain text
// elsewhere), so neither safety net caught it. This fixture reproduces that exact double-failure —
// the printed "Date of expiry" line is deliberately absent altogether, not just present-but-messy, so
// this genuinely exercises the fix rather than the pre-existing printed-text fallback (see the
// generator comment in scripts, or CHANGELOG, for why the printed line had to be dropped, not just
// garbled, to actually reproduce the reported bug rather than the fallback already covering it).
//
// Fixed by fixMrzDateLetters(): since MRZ date fields are digits-only by spec (ICAO 9303), a letter
// there can only ever be a look-alike OCR misread of a digit, never a genuine value — so, unlike the
// swap-correction (which must stay conservative, since fields like the passport number legitimately
// mix letters and digits), it's always safe to normalize a stray letter back to its look-alike digit
// before the checksum machinery runs at all.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate } = require('./helpers');

var EXPIRY_LETTER_FIXTURE = path.join(__dirname, 'fixtures', 'expiry-letter-misread-fixture.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await page.setInputFiles('#file_passportValidate', EXPIRY_LETTER_FIXTURE);
    await page.click('#btnPassportValidateAttach');
    await page.waitForFunction(function(){
      var el = document.getElementById('passportValidateResult');
      return el && el.innerHTML.indexOf('passport-card') !== -1;
    }, { timeout: 20000 });
    await page.waitForTimeout(300);

    var html = await page.$eval('#passportValidateResult', function(el){ return el.innerHTML; });

    // The whole point of the fix: this should no longer read "not detected".
    var expiresRowText = await page.$eval('#passportValidateResult', function(el){
      var rows = el.querySelectorAll('.passport-row');
      for (var i=0;i<rows.length;i++){
        if (/Expires/.test(rows[i].textContent)) return rows[i].textContent;
      }
      return '';
    });
    assert.ok(!/not detected/i.test(expiresRowText), 'Expiry row should no longer say "not detected", got: ' + expiresRowText);
    assert.ok(/2027/.test(expiresRowText), 'Expiry row should show the true expiry year 2027 (recovered from the MRZ itself, letter normalized back to a digit), got: ' + expiresRowText);

    // Recovered directly from the MRZ (not the printed-text fallback, which this fixture deliberately
    // can't use — its "Date of expiry" printed line is absent) — the checksum should now read as a
    // clean, full match, not a partial one propped up by a fallback.
    assert.ok(/4\/4 digit\(s\) matched/.test(html), 'MRZ checksum should read a clean 4/4 match once the letter is normalized, got: ' + html);

    // Still honestly disclosed as a correction, not silently shown as if the MRZ had simply read
    // cleanly all along — same transparency principle as the existing digit-swap correction.
    assert.ok(/Auto-corrected/.test(html), 'Card should include an "Auto-corrected" row disclosing the fix, got: ' + html);
    assert.ok(/expiry date/i.test(html), 'Auto-corrected note should name the expiry date specifically, got: ' + html);
  } finally {
    await page.context().close();
  }
};
