'use strict';
// Real user report (shared as an actual passport photo, B50338594, expiring 2027-10-06 — same
// underlying report as expiry-printed-fallback-fixture.test.js, a later round of the same OCR
// trouble spot): even after that fix, the same applicant's passport STILL came back "Expires: not
// detected". Root cause this time was one character narrower than the earlier fix covered.
//
// extractDates()'s "DD MON / MON YY" pattern already tolerated the classic "0 read as O" OCR
// confusion in the FIRST month token (an explicit "0ct" alternative alongside "oct"), because that's
// a common enough misread to have its own regex branch. But the SECOND (bilingual) month token used a
// generic [a-z]{3,4} class instead, which can't match a leading digit "0" at all. On this exact photo,
// BOTH "OCT"s in "Date of Expiry / Date d'Expiration 06 OCT / OCT 27" got OCR'd as "0CT" — so the
// first token matched fine (via the explicit 0ct alternative) but the second token's generic
// letters-only class couldn't, and the whole date silently failed to match. That meant it never even
// reached extractDates()'s "any future date on the page" fallback (renderPassportCard's own last
// resort before "not detected") — not because the fallback chain was missing a step, but because the
// lowest-level date regex never found a date at all to hand up the chain.
//
// Fixed by widening the second token's class to [a-z0][a-z]{2,3} — same single-leading-"0"-for-"O"
// tolerance as the first token, while still accepting any 3-4 letter word after that (so a genuinely
// different second-language abbreviation, like French "JUIL" for July, still isn't broken by this).
//
// Covered via the new window.__testExtractDates/__testParseMrzFields hooks (same reasoning as
// __testExtractNameCandidates for narration parsing) — no PDF/OCR fixture needed, since this is a
// pure text-regex regression, not an image-reading one.
const assert = require('assert');
const { newPageAt } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    // Both "OCT" occurrences OCR'd as "0CT" — the exact real-world corruption reported.
    var corruptedText = "Date of Expiry / Date d'Expiration 06 0CT / 0CT 27";
    var dates = await page.evaluate(function(t){
      return window.__testExtractDates(t).map(function(d){ return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate(); });
    }, corruptedText);
    assert.ok(dates.indexOf('2027-10-6') !== -1,
      'extractDates() should still find 6 Oct 2027 even when both "OCT" tokens are OCR\'d as "0CT", got: ' + JSON.stringify(dates));

    // A genuinely different second-language abbreviation (French "JUIL" for July) must still work —
    // the widened class must not have narrowed what the second token accepts.
    var frenchDates = await page.evaluate(function(t){
      return window.__testExtractDates(t).map(function(d){ return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate(); });
    }, "10 JUL / JUIL 34");
    assert.ok(frenchDates.indexOf('2034-7-10') !== -1,
      'A real second-language month abbreviation (French "JUIL") should still be tolerated, got: ' + JSON.stringify(frenchDates));

    // End-to-end: with the MRZ's own expiry field also genuinely unreadable (an 'X' dropped into its
    // check-digit-relevant digits), parseMrzFields() must recover the date from this same corrupted
    // printed text via the fallback chain, not just extractDates() in isolation.
    var mrzText = [
      "Date of Expiry / Date d'Expiration 06 0CT / 0CT 27",
      "P<NGAAFENI<<MARY<OLUWAFUNMILAYO<<<<<<<<<<<<<<<<",
      "B503385946NGA8803090F27X0062863023209853<<06"
    ].join("\n");
    var fields = await page.evaluate(function(t){
      var f = window.__testParseMrzFields(t);
      return f && f.expiryDate ? { iso: f.expiryDate.getFullYear()+'-'+(f.expiryDate.getMonth()+1)+'-'+f.expiryDate.getDate(), source: f.expiryDateSource } : null;
    }, mrzText);
    assert.ok(fields, 'parseMrzFields() should recover an expiry date at all, not return null fields');
    assert.strictEqual(fields.iso, '2027-10-6', 'Recovered expiry date should be 6 Oct 2027, got: ' + fields.iso);
    assert.strictEqual(fields.source, 'printed', 'Should be attributed to the printed-text fallback, not the (genuinely broken) MRZ, got: ' + fields.source);
  } finally {
    await page.context().close();
  }
};
