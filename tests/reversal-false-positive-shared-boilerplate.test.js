'use strict';
// User-reported bug, off a real Sterling Bank statement: 36 completely unrelated payments were tagged
// "Reversal" even though the user manually checked the statement and confirmed none of them are
// reversals or contain "RVSL". User's own words: "These are not reversals. they have no RVSL."
//
// Root cause: markAmountMatchedReversals() (added for a DIFFERENT real case — a reversal with no RVSL
// keyword at all, see amount-matched-reversal.test.js) flags a credit as a reversal when its amount
// matches an earlier nearby debit AND the two narrations share "enough" distinctive words. Two bugs
// combined to make this trigger constantly on a real statement instead of only on genuine reversals:
//   1. narrationWordsForReversalMatch() didn't filter out purely-numeric tokens — an account/reference/
//      sort-code number (e.g. "000014") that appears on EVERY transaction from a given channel was
//      counted as a "distinctive shared word" between any two transactions that happened to go through
//      that same channel, regardless of who was actually involved.
//   2. The required overlap degraded to just 1 shared word whenever either narration was short — so a
//      single shared boilerplate token (a channel code, a generic field-label leftover) was enough on
//      its own to falsely flag two completely unrelated payments.
// Fixed by: stripping purely-numeric tokens from the word-overlap check, stopwording "BANKNIP" (a
// channel-name variant of the already-stopworded "ONEBANK"/"NIP"), and always requiring a fixed 2 real
// shared words (never degraded to 1) — with a hard skip (no match at all) when either narration doesn't
// even have 2 qualifying words.
const assert = require('assert');
const { newPageAt, passConsentGate } = require('./helpers');

exports.run = async function(ctx){
  var page = await newPageAt(ctx.browser, '/index.html');
  try {
    await passConsentGate(page);

    var results = await page.evaluate(function(){
      return window.__testMarkAmountMatchedReversals([
        // A same-amount, same-channel debit/credit pair from two ENTIRELY UNRELATED people, a few days
        // apart — sharing nothing but the bank's own channel boilerplate and a reference number. This
        // must NOT be flagged as a reversal.
        { narration: 'BANKNIP From 000014 PAYREF: - SENDER: TUNDE BAKARE', debit: 12500, dateISO: '2026-03-01' },
        { narration: 'BANKNIP From 000014 PAYREF: - SENDER: CHIOMA EZE', credit: 12500, dateISO: '2026-03-03' },
        // A second such unrelated pair, different amount, to make sure this isn't a one-off fluke.
        { narration: 'BANKNIP From 000014 PAYREF: - SENDER: YARO ABUBAKAR', debit: 7300, dateISO: '2026-04-10' },
        { narration: 'BANKNIP From 000014 PAYREF: - SENDER: BLESSING OKAFOR', credit: 7300, dateISO: '2026-04-12' },
        // The genuine, real case this whole mechanism exists for must still work: a debit and its
        // silent reversal, sharing real distinctive merchant words beyond just channel boilerplate.
        { narration: 'ONB TRF TO POS Transf **7126 Green Atarodo Red Store', debit: 8400, dateISO: '2026-05-01' },
        { narration: 'ONB TRF TO POS Transf **7126 Green Atarodo Red Store', credit: 8400, dateISO: '2026-05-02' },
        // A one-shared-word coincidence: a short debit narration naming only "EZE" and a separate,
        // unrelated credit naming "CHIOMA EZE" — a different, unrelated person who just happens to
        // share a surname. The old code's overlap threshold could degrade to 1 for a short narration
        // like this, falsely flagging it; it must not be flagged now.
        { narration: 'BANKNIP From 000014 PAYREF: - SENDER: EZE', debit: 4000, dateISO: '2026-06-01' },
        { narration: 'BANKNIP From 000014 PAYREF: - SENDER: CHIOMA EZE', credit: 4000, dateISO: '2026-06-02' }
      ]);
    });

    var tundeChioma = results.filter(function(r){ return /TUNDE BAKARE|CHIOMA EZE/.test(r.narration); });
    tundeChioma.forEach(function(r){
      assert.strictEqual(r.flagged, false, 'An unrelated same-channel debit/credit pair must not be flagged as a reversal, got: ' + JSON.stringify(r));
    });
    var yaroBlessing = results.filter(function(r){ return /YARO ABUBAKAR|BLESSING OKAFOR/.test(r.narration); });
    yaroBlessing.forEach(function(r){
      assert.strictEqual(r.flagged, false, 'A second unrelated same-channel debit/credit pair must not be flagged as a reversal, got: ' + JSON.stringify(r));
    });

    // Both the debit and credit rows share the same narration text; index 5 is the credit row (the
    // reversal itself) as constructed above.
    var creditRow = results[5];
    assert.strictEqual(creditRow.flagged, true, 'A genuine silent reversal sharing real distinctive merchant words must still be flagged, got: ' + JSON.stringify(creditRow));

    var ezeCreditRow = results[7];
    assert.strictEqual(ezeCreditRow.flagged, false, 'A single coincidentally-shared word (surname) between two unrelated short narrations must not be enough to flag a reversal, got: ' + JSON.stringify(ezeCreditRow));
  } finally {
    await page.context().close();
  }
};
