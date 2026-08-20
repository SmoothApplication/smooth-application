'use strict';
// Real user report: a passport photographed on a low-end phone came back "MRZ checksum: not detected"
// and the applicant's name never auto-filled, even though the photo was perfectly legible to a person.
// Confirmed by replaying the actual reported photo through this app's OCR pipeline: the MRZ's trailing
// "<" padding OCR'd as a handful of stray characters instead of clean filler, landing the line at 35
// characters — 9 short of the ideal 44, well outside the old +/-6 length tolerance — so the whole line
// (and the name earlier in it, which read fine) was silently dropped before normalizeMrzLine's own
// bad-character cleanup ever got a chance to run on it.
//
// Fixed three ways: (1) the candidate-detection regex no longer requires the WHOLE line to already be
// clean before normalizeMrzLine can try to clean it up — it just requires a genuine run of 15+ clean
// characters right after the "P<XXX" prefix (where the real name data lives), which is enough to tell a
// real MRZ line apart from an ordinary printed label line elsewhere on the page; (2) normalizeMrzLine's
// length tolerance widened from +/-6 to +/-10 (still comfortably rejects the documented "Holder's
// Signature" false-positive case, which was 14 short); (3) a stray character bleeding into a false
// second "<<" boundary right at the end of the given-name field gets stripped as a dangling single
// letter, since a real given name essentially never legitimately ends that way.
//
// Deterministic PDF text-layer fixture (not a live OCR image, so this test doesn't depend on
// Tesseract's non-deterministic output) reproducing that exact shape, using an entirely FICTIONAL
// identity (not the real reporter's passport data) — see low-end-phone-mrz-fixture.pdf.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'low-end-phone-mrz-fixture.pdf');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);
    await page.setInputFiles('#file_passportInline', FIXTURE);
    await page.click('#btnPassportInlineAttach');
    await page.waitForFunction(function(){
      var el = document.getElementById('passportInlineResult');
      return el && el.innerHTML.indexOf('passport-card') !== -1;
    }, { timeout: 20000 });
    await page.waitForTimeout(300);

    var html = await page.$eval('#passportInlineResult', function(el){ return el.innerHTML; });
    assert.ok(!/MRZ checksum[\s\S]*?not detected/.test(html), 'A short-but-otherwise-clean MRZ line should no longer be dismissed outright, got: ' + html.slice(0, 600));
    assert.ok(/4\/4 digit\(s\) matched/.test(html), 'The corrected line should pass full MRZ checksum validation, got: ' + html.slice(0, 600));

    var nameFieldVal = await page.$eval('#f_name', function(el){ return el.value; });
    assert.strictEqual(nameFieldVal, 'Adaeze Okafor', 'Name should auto-fill cleanly with no leftover OCR noise from the padding tail, got: ' + JSON.stringify(nameFieldVal));
  } finally {
    await page.context().close();
  }
};
