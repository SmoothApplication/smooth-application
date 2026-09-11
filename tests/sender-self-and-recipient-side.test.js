'use strict';
// User feedback, off a real statement (several messages in one sitting):
// 1) A 28-item "Other / one-off inflows (no clear sender name)" list stayed unsorted because several
//    rows' narrations only ever named their sender in ONE word ("SENDER: BILIKIS", "SENDER: CRISP",
//    "SENDER: YARO") — extractNameCandidates required 2+ words to keep a run, so these silently
//    produced ZERO candidates and fell into "no clear sender name" instead of grouping with every
//    other payment from the same person. Fixed by allowing a single word immediately after an
//    explicit sender-context marker (SENDER/FROM/FRM) to still count as a candidate.
// 2) A named group titled itself "Agboola Mary Oluwafunmilayo Mint" and absorbed an unrelated
//    "Ibukunoluwa Adedayo" payment, when it should have been "Xpedite Global Concept" only — the
//    narration's RECIPIENT-side name ("...LTD IFO AGBOOLA MARY OLUWAFUNMILAYO") was winning the
//    "longest candidate" tie-break over the real sender-side name, and relying solely on
//    isLikelyApplicantsOwnName's exact text match against the typed passport name is fragile when the
//    bank account is registered under a differently-spelled name. Fixed by tracking which stopword
//    marker preceded each extracted run (extractNameCandidatesDetailed) and structurally excluding
//    IFO/TO-marked (recipient-side) runs from "who sent this" everywhere that matters.
// 3) "TRF BOO XPEDITE GLOBAL - CONCEPT LTD IFO ..." extracted as "Boo Xpedite Global Concept" instead
//    of "Xpedite Global Concept" — "BOO" is a channel/processor code, added to the stopword list.
// 4) A sender's narration sometimes carries their full name ("SENDER: CRISP N") and sometimes just
//    its first word ("SENDER: CRISP") — the latter, now capturable per (1), still couldn't merge into
//    the former because it's shorter than NAME_MERGE_MIN_LEN. Fixed with a narrow additional merge
//    rule: a single WHOLE word merges into an existing 2+-word name that contains it, regardless of
//    length.
// 5) Recurring inflows whose sender name matches the account holder's OWN name/account ("SENDER:
//    MARY", where Mary is the applicant) were mis-swept into "Salary" (when the amount recurred) or
//    into their own "Personal" box asking "what's your relationship to this person" — neither makes
//    sense for the applicant's own money moving between their own accounts. Fixed with a new 'self'
//    classification, checked before Salary/named-group routing, using the account-holder identity
//    resolved from whichever name recurs on the RECIPIENT side of the statement's own narrations
//    (independent of whatever the applicant typed in the passport-name field).
const assert = require('assert');
const { newPageAt } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await page.waitForSelector('#quizIntro');

    // --- (1) single-word sender, gated on an explicit sender-context marker ---------------------
    var singleWordCases = [
      { narration: 'BANKNIP From 000014 PAYREF: -60426004740242514 SENDER: BILIKIS', expect: 'Bilikis' },
      { narration: 'BANKNIP From 000014 PAYREF: -60426004740242514 SENDER: CRISP', expect: 'Crisp' },
      { narration: 'BANKNIP From 090405 PAYREF: -6030607045990263 SENDER: YARO', expect: 'Yaro' }
    ];
    for (var i = 0; i < singleWordCases.length; i++){
      var sc = singleWordCases[i];
      var cands = await page.evaluate(function(n){ return window.__testExtractNameCandidates(n); }, sc.narration);
      var titleCased = cands.map(function(s){ return s.toLowerCase().replace(/\b[a-z]/g, function(ch){ return ch.toUpperCase(); }); });
      assert.ok(titleCased.indexOf(sc.expect) !== -1,
        'Expected "'+sc.expect+'" as a candidate for "'+sc.narration+'", got: '+JSON.stringify(cands));
    }
    // A lone word with NO sender-context marker in front of it should still be dropped — the marker
    // gate is what makes this safe, not a blanket relaxation of the 2+-word rule.
    var unmarked = await page.evaluate(function(n){ return window.__testExtractNameCandidates(n); }, 'NIP TRF ZUBI VALUE DATE');
    assert.deepStrictEqual(unmarked, [], 'An unmarked lone word should still produce no candidates, got: '+JSON.stringify(unmarked));

    // --- (2) + (3) sender-side vs recipient-side, and the BOO stopword --------------------------
    var xpediteNarration = 'TRF BOO XPEDITE GLOBAL - CONCEPT LTD IFO AGBOOLA MARY OLUWAFUNMILAYO';
    var detailed = await page.evaluate(function(n){ return window.__testExtractNameCandidatesDetailed(n); }, xpediteNarration);
    var senderRun = detailed.filter(function(r){ return r.precededBy !== 'IFO' && r.precededBy !== 'TO'; });
    var recipientRun = detailed.filter(function(r){ return r.precededBy === 'IFO' || r.precededBy === 'TO'; });
    assert.ok(senderRun.some(function(r){ return r.name === 'XPEDITE GLOBAL CONCEPT'; }),
      'Sender-side run should be "XPEDITE GLOBAL CONCEPT" (BOO stripped, not IFO-marked), got: '+JSON.stringify(detailed));
    assert.ok(!detailed.some(function(r){ return /\bBOO\b/.test(r.name); }),
      'No candidate should contain "BOO", got: '+JSON.stringify(detailed));
    assert.ok(recipientRun.some(function(r){ return r.name === 'AGBOOLA MARY OLUWAFUNMILAYO'; }),
      'Recipient-side run should be marked precededBy IFO, got: '+JSON.stringify(detailed));

    // "mint" trailing an account holder's real name is a bank account-product label, not part of the
    // name — confirmed by the applicant directly, off the same statement.
    var mintCands = await page.evaluate(function(n){ return window.__testExtractNameCandidates(n); }, 'OneBank Transfer from AFENI - IBUKUNOLUWA ADEDAYO to AGBOOLA MARY OLUWAFUNMILAYO mint');
    assert.ok(mintCands.indexOf('AGBOOLA MARY OLUWAFUNMILAYO') !== -1,
      'Should extract the clean "AGBOOLA MARY OLUWAFUNMILAYO" with "mint" stripped, got: '+JSON.stringify(mintCands));
    assert.ok(!mintCands.some(function(c){ return /\bMINT\b/.test(c); }),
      'No candidate should contain "MINT", got: '+JSON.stringify(mintCands));

    // --- (4) short single-word candidate merges into its fuller-name group ----------------------
    var mergeGroups = await page.evaluate(function(){
      return window.__testBuildIncomeSourceBreakdown([
        { narration: 'BANKNIP From 090405 PAYREF: - SENDER: CRISP N', credit: 350000, dateISO: '2026-04-04' },
        { narration: 'BANKNIP From 090405 PAYREF: - SENDER: CRISP', credit: 105000, dateISO: '2026-05-30' }
      ], 'Test Applicant');
    });
    var crispGroups = mergeGroups.filter(function(g){ return /crisp/i.test(g.name); });
    assert.strictEqual(crispGroups.length, 1, 'The single-word "Crisp" row should merge into the "Crisp N" group, not stay separate, got groups: '+JSON.stringify(mergeGroups));
    assert.strictEqual(crispGroups[0].count, 2, 'Merged Crisp group should contain both payments, got: '+JSON.stringify(crispGroups[0]));
    assert.strictEqual(crispGroups[0].total, 455000, 'Merged Crisp group total should be 455000, got: '+JSON.stringify(crispGroups[0]));

    // --- (5) Self classification, resolved from the statement's own recipient-side name ---------
    var selfGroups = await page.evaluate(function(){
      return window.__testBuildIncomeSourceBreakdown([
        // Establishes the account-holder identity from the RECIPIENT side, across 2 distinct months —
        // independent of whatever the (unrelated) applicantName below says.
        { narration: 'NIP TRF XPEDITE GLOBAL CONCEPT LTD IFO AGBOOLA MARY OLUWAFUNMILAYO', credit: 500000, dateISO: '2026-01-10' },
        { narration: 'FT XPEDITE GLOBAL CONCEPT LTD IFO AGBOOLA MARY OLUWAFUNMILAYO', credit: 480000, dateISO: '2026-02-10' },
        // Same recurring rounded amount across 2 distinct months, narrated as "SENDER: MARY" — old
        // behavior would swallow this into "Salary"; the fix routes it to "self" instead.
        { narration: 'BANKNIP From 000014 PAYREF: - SENDER: MARY', credit: 20000, dateISO: '2026-03-05' },
        { narration: 'BANKNIP From 000014 PAYREF: - SENDER: MARY', credit: 20000, dateISO: '2026-04-05' }
      ], 'Test Applicant');
    });
    var selfGroup = selfGroups.filter(function(g){ return g.type === 'self'; });
    assert.strictEqual(selfGroup.length, 1, 'Should produce exactly one "self" group, got: '+JSON.stringify(selfGroups));
    assert.strictEqual(selfGroup[0].count, 2, 'Self group should contain both "SENDER: MARY" payments, got: '+JSON.stringify(selfGroup[0]));
    assert.strictEqual(selfGroup[0].total, 40000, 'Self group total should be 40000, got: '+JSON.stringify(selfGroup[0]));
    var salaryGroup = selfGroups.filter(function(g){ return g.type === 'salary'; });
    assert.strictEqual(salaryGroup.length, 0, 'The self-transfer payments should NOT also form a "Salary" group, got: '+JSON.stringify(selfGroups));
    var xpediteGroup = selfGroups.filter(function(g){ return /xpedite/i.test(g.name); });
    assert.strictEqual(xpediteGroup.length, 1, 'Xpedite payments should still form their own sender group, got: '+JSON.stringify(selfGroups));
    assert.strictEqual(xpediteGroup[0].type, 'company', 'Xpedite Global Concept Ltd should classify as company, got: '+JSON.stringify(xpediteGroup[0]));

    // Regression guard: a FULL name that merely shares the applicant's surname with the resolved
    // holder identity (a family member, e.g. "Mary Smith" when the holder is "Test Applicant Smith")
    // must NOT be swept into "self" — only a BARE single-word candidate should get the relaxed
    // shared-word treatment; a multi-word candidate needs the strict full-name match instead.
    var familyGroups = await page.evaluate(function(){
      return window.__testBuildIncomeSourceBreakdown([
        // Establishes holder identity "Test Applicant Smith" from the recipient side, AND gives
        // "Good Employer" a clear 3-month stable-amount lead — deliberately NOT tied with Mary
        // Smith's own (different, non-recurring) amounts below, so this only exercises the
        // self-vs-family distinction, not identifyStableIncome's own tie-breaking.
        { narration: 'NIP TRF GOOD EMPLOYER LTD IFO TEST APPLICANT SMITH', credit: 300000, dateISO: '2026-01-15' },
        { narration: 'FT GOOD EMPLOYER LTD IFO TEST APPLICANT SMITH', credit: 300000, dateISO: '2026-02-15' },
        { narration: 'NIP TRF GOOD EMPLOYER LTD IFO TEST APPLICANT SMITH', credit: 300000, dateISO: '2026-03-15' },
        // Different first name, same surname as the applicant — a family member, not the applicant.
        // Different (non-recurring) amounts each, so neither collides with the stable-amount check.
        { narration: 'BANKNIP From 000014 PAYREF: - SENDER: MARY SMITH', credit: 15000, dateISO: '2026-03-01' },
        { narration: 'BANKNIP From 000014 PAYREF: - SENDER: MARY SMITH', credit: 18000, dateISO: '2026-04-01' }
      ], 'Test Applicant Smith');
    });
    var marySmithGroup = familyGroups.filter(function(g){ return /mary smith/i.test(g.name); });
    assert.strictEqual(marySmithGroup.length, 1, 'Mary Smith should appear as her own group, not be swept into Self, got: '+JSON.stringify(familyGroups));
    assert.strictEqual(marySmithGroup[0].type, 'family', 'Mary Smith should be typed "family" (shared surname), got: '+JSON.stringify(marySmithGroup[0]));
    var familySelfGroup = familyGroups.filter(function(g){ return g.type === 'self'; });
    assert.strictEqual(familySelfGroup.length, 0, 'No "self" group should exist here — Mary Smith is a different person, got: '+JSON.stringify(familyGroups));
  } finally {
    await page.context().close();
  }
};
