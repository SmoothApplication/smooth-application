'use strict';
// Real user report: a passport photo came back "MRZ checksum: not detected" even though the physical
// document was completely genuine. Replaying the actual reported photo through this app's OCR pipeline
// showed why: MRZ line 1 (the name line — small, dense text, often sitting right over a background
// security pattern) read as pure garbage, while MRZ line 2 (mostly digits, generally easier for OCR to
// read cleanly) came back a perfect, checksum-valid 44-character line. The old detection required
// finding a valid line 1 FIRST and only then looked at whatever line followed it — so a bad read of
// line 1 alone threw away a perfectly good line 2, and with it the entire checksum check, even though
// nothing was actually wrong with the document.
//
// Fix: the checksum check (unlike the applicant's name) only ever needs line 2, so it now also searches
// for a standalone, structurally line-2-shaped line anywhere on the page — gated on that candidate's OWN
// check digits actually corroborating the shape, so an unrelated numeric-heavy OCR line can't slip
// through just by having roughly the right layout.
//
// Deterministic PDF text-layer fixture (not a live OCR image, so this test doesn't depend on
// Tesseract's non-deterministic output) reproducing the exact garbled-line-1/clean-line-2 shape, using
// an entirely FICTIONAL identity — see mrz-line1-garbled-fixture.pdf.
const assert = require('assert');
const path = require('path');
const { newPageAt, passConsentGate } = require('./helpers');

var FIXTURE = path.join(__dirname, 'fixtures', 'mrz-line1-garbled-fixture.pdf');

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
    assert.ok(!/MRZ checksum[\s\S]*?not detected/.test(html),
      'A garbled line 1 should no longer sink the checksum check on an otherwise-clean line 2, got: ' + html.slice(0, 800));
    assert.ok(/4\/4 digit\(s\) matched/.test(html),
      'Line 2 alone should be enough to pass full MRZ checksum validation, got: ' + html.slice(0, 800));
  } finally {
    await page.context().close();
  }
};
