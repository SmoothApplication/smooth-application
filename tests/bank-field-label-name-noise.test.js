'use strict';
// User-reported screenshot: the "Consistent senders" table showed garbled names like "Mptj Cg Sender
// Crisp N", "Payref Sender Adisa Bilikis Abiola Remark", and "Payref Zmo Sender Yaro Remark Ok" - a
// real bank's structured narration format prints literal field labels ("SENDER:", "REMARK:") and
// channel/processor codes ("MPTJ", "PAYREF", "CG", "WVV", "ZMO", "ONB") right alongside the actual
// name, and extractNameCandidates was gluing all of it onto the extracted name instead of stopping at
// the field labels - splitting what was likely ONE recurring sender across several differently-
// garbled rows. Uses the __testExtractNameCandidates escape hatch (see its comment in index.html)
// rather than a full PDF-upload cycle, since this is purely about what extractNameCandidates itself
// returns for a given raw narration string.
const assert = require('assert');
const { newPageAt } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await page.waitForSelector('#quizIntro');

    var cases = [
      { narration: 'MPTJ/CG/SENDER:CRISP MASTERS/REMARK:OK', expectClean: 'Crisp Masters' },
      { narration: 'PAYREF/SENDER:ADISA BILIKIS ABIOLA/REMARK:OK', expectClean: 'Adisa Bilikis Abiola' },
      { narration: 'MPTJ/WVV/SENDER:BILIKIS OYELARAN/REMARK:OK', expectClean: 'Bilikis Oyelaran' },
      { narration: 'PAYREF/SENDER:YARO HADIZA/REMARK:OK', expectClean: 'Yaro Hadiza' },
      { narration: 'PAYREF/ONB/SENDER:IBUKUNOLUWA ADEBAYO/REMARK:OK', expectClean: 'Ibukunoluwa Adebayo' }
    ];

    for (var i = 0; i < cases.length; i++){
      var c = cases[i];
      var candidates = await page.evaluate(function(n){ return window.__testExtractNameCandidates(n); }, c.narration);
      var joined = candidates.join(' | ');
      // None of the field-label/channel-code words should survive into ANY candidate.
      ['MPTJ','PAYREF','SENDER','REMARK','CG','WVV','ZMO','ONB','OK'].forEach(function(junk){
        var re = new RegExp('\\b' + junk + '\\b', 'i');
        assert.ok(!re.test(joined), 'Candidate(s) for "' + c.narration + '" should not contain "' + junk + '", got: ' + joined);
      });
      // The real name should still come through cleanly as one of the candidates.
      var titleCased = candidates.map(function(s){ return s.toLowerCase().replace(/\b[a-z]/g, function(ch){ return ch.toUpperCase(); }); });
      assert.ok(titleCased.indexOf(c.expectClean) !== -1,
        'Expected "' + c.expectClean + '" among the candidates for "' + c.narration + '", got: ' + JSON.stringify(candidates));
    }
  } finally {
    await page.context().close();
  }
};
