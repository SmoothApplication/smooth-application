'use strict';
// Real Wema/ALAT statement finding: inbound interbank credits there sometimes narrate as
// "eTZ:<sender name>-<note>" (e.g. "eTZ:OLUWABUSOLAMI ELIZABETH OSHINOWO-NXG :MOBILET") - "ETZ" is
// eTranzact, an interbank real-time-transfer channel/processor (the same role NIP plays on most other
// narrations), not part of the sender's own name. Before this fix, extractNameCandidates glued it onto
// the front of the run ("Etz Oluwabusolami Elizabeth Oshinowo") instead of stopping at it, same class
// of bug as the NIP/ONB/ROLEZ channel-code fixes already covered by bank-field-label-name-noise.test.js.
// Uses the __testExtractNameCandidates escape hatch rather than a full PDF-upload cycle, since this is
// purely about what extractNameCandidates itself returns for a given raw narration string.
const assert = require('assert');
const { newPageAt } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await page.waitForSelector('#quizIntro');

    var cases = [
      { narration: 'eTZ:OLUWABUSOLAMI ELIZABETH OSHINOWO-NXG :MOBILET', expectClean: 'Oluwabusolami Elizabeth Oshinowo' },
      { narration: 'ETZ:ADEDOTUN OLUWATOWOJU OGUNLADE-Transfer from AD', expectClean: 'Adedotun Oluwatowoju Ogunlade' }
    ];

    for (var i = 0; i < cases.length; i++){
      var c = cases[i];
      var candidates = await page.evaluate(function(n){ return window.__testExtractNameCandidates(n); }, c.narration);
      var joined = candidates.join(' | ');
      // "ETZ" should never survive into any extracted candidate.
      assert.ok(!/\bETZ\b/i.test(joined), 'Candidate(s) for "' + c.narration + '" should not contain "ETZ", got: ' + joined);
      // The real name should still come through cleanly as one of the candidates.
      var titleCased = candidates.map(function(s){ return s.toLowerCase().replace(/\b[a-z]/g, function(ch){ return ch.toUpperCase(); }); });
      assert.ok(titleCased.indexOf(c.expectClean) !== -1,
        'Expected "' + c.expectClean + '" among the candidates for "' + c.narration + '", got: ' + JSON.stringify(candidates));
    }
  } finally {
    await page.context().close();
  }
};
