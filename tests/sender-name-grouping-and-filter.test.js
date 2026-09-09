'use strict';
// User request, verbatim: "if you see a funmi Agboola or agboola funmi pick it as the same name...
// group the similar together and create where the applicants can confirm if they are the same
// persons. names that appear once. For example if you see funmi afeni and a funmi agboola, you put
// it as a group and ask if they are the same person or not. For the names, remove all unnecessary
// figures that does not look like a name... it must be strictly names that should be extracted,
// names alone."
//
// Three separate behaviors, tested here without a PDF fixture (via the __testExtractNameCandidates
// and __testGetTopConsistentSenders escape hatches — see their comments in index.html):
//   1. Two candidate names that are the exact same WORDS, just reordered (e.g. "Chidi Nwosu" /
//      "Nwosu Chidi") are certain enough to be the same person that they're merged automatically —
//      see sameWordSet() in mergeNameVariants — never even reaching the ask-the-user prompt.
//   2. A name seen only ONCE (a singleton) that shares even just a single significant word (e.g. a
//      bare first name) with another sender now DOES get flagged to ask about — relaxed from the
//      general 2-shared-word rule, which still applies (and still does NOT flag) two non-singleton
//      senders who merely share one common first name — see SENDER_DUP_MIN_SHARED_WORDS_SINGLETON.
//   3. extractNameCandidates now drops any 3+ letter word with no vowel sound in it (A/E/I/O/U/Y) —
//      real personal names (Nigerian, British, American, or otherwise) always carry one; a bank's
//      own unlisted channel/reference code very often doesn't — see looksNameShaped().
const assert = require('assert');
const { newPageAt } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await page.waitForSelector('#quizIntro');

    // --- 1 + 2: full grouping pipeline, via __testGetTopConsistentSenders ------------------------
    var entries = [
      // "Chidi Nwosu" x2, plus a reordered "Nwosu Chidi" x1 — should merge into ONE row of 3.
      { date: '2026-01-15', amount: 20000, narration: 'NIP/CHIDI NWOSU/TRF' },
      { date: '2026-02-15', amount: 20000, narration: 'NIP/CHIDI NWOSU/TRF' },
      { date: '2026-03-15', amount: 20000, narration: 'NIP/NWOSU CHIDI/TRF' },
      // "Yaro Hassan" appears just once; "Yaro Ibrahim" recurs 3x — share only "Yaro", but since
      // "Yaro Hassan" is a singleton this pair should still be flagged to ask about.
      { date: '2026-01-20', amount: 15000, narration: 'NIP/YARO HASSAN/TRF' },
      { date: '2026-01-25', amount: 18000, narration: 'NIP/YARO IBRAHIM/TRF' },
      { date: '2026-02-25', amount: 18000, narration: 'NIP/YARO IBRAHIM/TRF' },
      { date: '2026-03-25', amount: 18000, narration: 'NIP/YARO IBRAHIM/TRF' },
      // Negative control: "David Okoro" and "David Chukwu" BOTH recur (2x each, neither a
      // singleton) and also share only one word ("David") — the general 2-shared-word rule should
      // still apply here and this pair should NOT be flagged.
      { date: '2026-01-05', amount: 9000, narration: 'NIP/DAVID OKORO/TRF' },
      { date: '2026-02-05', amount: 9000, narration: 'NIP/DAVID OKORO/TRF' },
      { date: '2026-01-10', amount: 9500, narration: 'NIP/DAVID CHUKWU/TRF' },
      { date: '2026-02-10', amount: 9500, narration: 'NIP/DAVID CHUKWU/TRF' }
    ];
    var result = await page.evaluate(function(e){ return window.__testGetTopConsistentSenders(e, 'Test Applicant Musa'); }, entries);

    var names = result.list.map(function(g){ return g.name; });
    assert.ok(!names.some(function(n){ return /Nwosu Chidi/i.test(n); }), 'The reordered variant should never survive as its own row, got: ' + JSON.stringify(names));
    var chidiRow = result.list.filter(function(g){ return /Chidi Nwosu/i.test(g.name); })[0];
    assert.ok(chidiRow, 'The two spellings should have merged into one "Chidi Nwosu" row, got: ' + JSON.stringify(names));
    assert.strictEqual(chidiRow.count, 3, 'Merged row should carry all 3 payments (2 + the reordered 1), got: ' + JSON.stringify(chidiRow));
    assert.strictEqual(chidiRow.monthCount, 3, 'Merged row should carry all 3 distinct months, got: ' + JSON.stringify(chidiRow));

    assert.strictEqual(result.pendingDuplicates.length, 1, 'Exactly one pair should be flagged to ask about, got: ' + JSON.stringify(result.pendingDuplicates));
    var pair = result.pendingDuplicates[0];
    assert.ok(/Yaro Hassan/i.test(pair.nameA) || /Yaro Hassan/i.test(pair.nameB), 'The singleton "Yaro Hassan" should be one side of the flagged pair, got: ' + JSON.stringify(pair));
    assert.ok(/Yaro Ibrahim/i.test(pair.nameA) || /Yaro Ibrahim/i.test(pair.nameB), 'The recurring "Yaro Ibrahim" should be the other side, got: ' + JSON.stringify(pair));
    var flaggedNames = JSON.stringify(result.pendingDuplicates);
    assert.ok(!/David/i.test(flaggedNames), 'Two non-singleton senders sharing only one word ("David") should NOT be flagged, got: ' + flaggedNames);

    // --- 3: strict name-only extraction, via __testExtractNameCandidates --------------------------
    var vowellessCases = [
      // "ZQX" (no vowel, never listed as a stopword) sits directly before a real name with nothing
      // separating them — previously it would have glued itself onto the run entirely.
      { narration: 'NIP/ZQX/JOHN SMITH/TRF', expectClean: 'John Smith', mustNotContain: 'ZQX' },
      // Same idea, trailing this time — an unlisted vowel-less code stuck AFTER a real name.
      { narration: 'NIP/MARY OKON/XRTS/TRF', expectClean: 'Mary Okon', mustNotContain: 'XRTS' }
    ];
    for (var i = 0; i < vowellessCases.length; i++){
      var c = vowellessCases[i];
      var candidates = await page.evaluate(function(n){ return window.__testExtractNameCandidates(n); }, c.narration);
      var joined = candidates.join(' | ');
      var junkRe = new RegExp('\\b' + c.mustNotContain + '\\b', 'i');
      assert.ok(!junkRe.test(joined), 'Candidate(s) for "' + c.narration + '" should not contain "' + c.mustNotContain + '", got: ' + joined);
      var titleCased = candidates.map(function(s){ return s.toLowerCase().replace(/\b[a-z]/g, function(ch){ return ch.toUpperCase(); }); });
      assert.ok(titleCased.indexOf(c.expectClean) !== -1, 'Expected "' + c.expectClean + '" among the candidates for "' + c.narration + '", got: ' + JSON.stringify(candidates));
    }
  } finally {
    await page.context().close();
  }
};
