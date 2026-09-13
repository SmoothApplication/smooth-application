'use strict';
// User instruction (as product owner): "we pick transfers from N50,000 above deserve an explanation" —
// a visa officer is realistically going to query any individual inflow at or above this size on its own
// terms, so the flagging rule was changed from a dynamic "1.5x the applicant's own average credit,
// floored at N300,000" threshold to a flat N50,000 floor (see UNEXPLAINED_INFLOW_MIN_AMOUNT and
// findUnexplainedLargeInflows in index.html). A narration with no readable text at all ("blank") is still
// flagged regardless of amount - even a small unexplained deposit deserves at least a label. A narration
// that already contains a recognized descriptive keyword (salary, transfer, gift, etc.) is still exempt
// at any amount, since it's already self-explanatory.
const assert = require('assert');
const { newPageAt, passConsentGate } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    var results = await page.evaluate(function(){
      return window.__testFindUnexplainedLargeInflows([
        // At/above the new N50,000 floor, no descriptive keyword - must be flagged.
        { narration: 'TUNDE BAKARE', credit: 50000, dateISO: '2026-03-01' },
        { narration: 'CHIOMA EZE ENT', credit: 120000, dateISO: '2026-03-05' },
        // Below N50,000, no descriptive keyword - must NOT be flagged (this is the actual behavior
        // change: previously nothing under ~N300,000 was flagged at all unless blank).
        { narration: 'YARO ABUBAKAR', credit: 45000, dateISO: '2026-03-08' },
        // A large amount that WOULD have been flagged before is still flagged now too - the floor moved
        // down, it didn't disappear.
        { narration: 'BLESSING OKAFOR', credit: 500000, dateISO: '2026-03-10' },
        // A big transfer with a recognized keyword already in the narration - exempt regardless of size,
        // since it's already self-explanatory to a reviewer.
        { narration: 'SALARY PAYMENT MARCH', credit: 400000, dateISO: '2026-03-15' },
        // Blank/numeric-only narration is flagged regardless of amount, even well under N50,000.
        { narration: '000123456', credit: 8000, dateISO: '2026-03-18' }
      ]);
    });

    var byCredit = {};
    results.forEach(function(r){ byCredit[r.credit] = r; });

    assert.ok(byCredit[50000], 'A N50,000 inflow with no descriptive keyword should be flagged, got: ' + JSON.stringify(results));
    assert.ok(byCredit[120000], 'A N120,000 inflow with no descriptive keyword should be flagged, got: ' + JSON.stringify(results));
    assert.ok(!byCredit[45000], 'A N45,000 inflow (below the new N50,000 floor) should NOT be flagged, got: ' + JSON.stringify(results));
    assert.ok(byCredit[500000], 'A large, clearly-above-floor inflow should still be flagged, got: ' + JSON.stringify(results));
    assert.ok(!byCredit[400000], 'A large inflow whose narration already contains a recognized keyword ("SALARY") should stay exempt, got: ' + JSON.stringify(results));
    assert.ok(byCredit[8000], 'A blank/numeric-only narration should be flagged regardless of amount, even under N50,000, got: ' + JSON.stringify(results));
    assert.strictEqual(byCredit[8000].flagReason, 'blank', 'The blank-narration inflow should be tagged with flagReason "blank", got: ' + JSON.stringify(byCredit[8000]));
    assert.strictEqual(byCredit[50000].flagReason, 'vague', 'The no-keyword inflow should be tagged with flagReason "vague", got: ' + JSON.stringify(byCredit[50000]));
  } finally {
    await page.context().close();
  }
};
