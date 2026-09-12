'use strict';
// User-reported bug, off a real Sterling statement: a payment narrated "SENDER: MARY 380
// OLUWAFUNMILAYO AFENI" landed in "Other / one-off inflows (no clear sender name)" instead of Self,
// even though it's unmistakably the account holder's own name in a different order/subset than the
// statement's MOST common recipient-side narration. User's own words: "Move to self for names that
// are similar with the names of account holder OLUWAFUNMILAYO AFENI or OLUWAFUNMILAYO AFENI MARY OR
// OLUWAFUNMILAYO AGBOOLA" — the same real person shows up on the RECIPIENT side of different
// transactions narrated with different subsets/orderings of a longer name.
//
// Root cause: detectStatementHolderName picked only the SINGLE most-recurring recipient-side variant
// and discarded every other one, so a self-transfer narrated with a genuinely-recurring but
// less-common variant never matched. Fixed by detectStatementHolderNames (plural), which returns
// EVERY recipient-side variant recurring at least twice, and looksLikeSelfInflow now checks a
// candidate against ALL of them, not just the single best one.
const assert = require('assert');
const { newPageAt, passConsentGate } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    var groups = await page.evaluate(function(){
      return window.__testBuildIncomeSourceBreakdown([
        // Establishes "Agboola Mary Oluwafunmilayo" as the MOST-recurring recipient-side variant (3x).
        { narration: 'NIP TRF GOOD EMPLOYER LTD IFO AGBOOLA MARY OLUWAFUNMILAYO', credit: 300000, dateISO: '2026-01-15' },
        { narration: 'NIP TRF GOOD EMPLOYER LTD IFO AGBOOLA MARY OLUWAFUNMILAYO', credit: 300000, dateISO: '2026-02-15' },
        { narration: 'NIP TRF GOOD EMPLOYER LTD IFO AGBOOLA MARY OLUWAFUNMILAYO', credit: 300000, dateISO: '2026-03-15' },
        // Establishes "Oluwafunmilayo Afeni" as a LESS-common but still-recurring recipient-side
        // variant (2x) — the crux of the bug: this one never wins "best", so the old single-variant
        // code never even considered it.
        { narration: 'ONEBANK TRANSFER FROM XYZ VENTURES IFO OLUWAFUNMILAYO AFENI', credit: 5000, dateISO: '2026-02-01' },
        { narration: 'ONEBANK TRANSFER FROM XYZ VENTURES IFO OLUWAFUNMILAYO AFENI', credit: 6000, dateISO: '2026-03-01' },
        // The actual self-transfer in question — narrated with the LESS-common variant plus one extra
        // word ("Mary"), a real name-order quirk, not a different person.
        { narration: 'BANKNIP From 000014 PAYREF: - SENDER: MARY OLUWAFUNMILAYO AFENI', credit: 20000, dateISO: '2026-04-04' }
      ], 'Agboola Mary Oluwafunmilayo');
    });

    var selfGroups = groups.filter(function(g){ return g.type === 'self'; });
    assert.strictEqual(selfGroups.length, 1, 'The ₦20,000 payment should be classified as Self, got groups: ' + JSON.stringify(groups));
    assert.strictEqual(selfGroups[0].total, 20000, 'Self total should be exactly the ₦20,000 self-transfer, got: ' + selfGroups[0].total);
    assert.strictEqual(selfGroups[0].count, 1, 'Self should count exactly 1 payment, got: ' + selfGroups[0].count);

    // It must not have landed in "Other / one-off inflows" (the originally-reported symptom).
    var otherGroups = groups.filter(function(g){ return g.type === 'other'; });
    var otherTotal = otherGroups.reduce(function(s,g){ return s + g.total; }, 0);
    assert.strictEqual(otherTotal, 0, 'Nothing should be left in "Other" — the ₦20,000 payment must not have fallen through there, got: ' + JSON.stringify(groups));
  } finally {
    await page.context().close();
  }
};
