// Ported from tests/amount-matched-reversal.test.js.
// Real-data finding, off a real Fidelity Bank statement: a failed POS/transfer attempt can be reversed
// WITHOUT any "RVSL"/"RSVL"/"reversal" keyword in either line's narration - the credit simply repeats
// the same merchant/reference description as the debit it's undoing (a real example: "ONB TRF TO POS
// Transf **7126 Green atarodo & red" debited, then an identical-looking credit for the exact same
// amount two rows later). markAmountMatchedReversals() flags a credit as a reversal when its amount
// exactly matches an earlier (within a few days) debit AND the two narrations share enough distinctive
// words to plausibly describe the same transaction. Also checks the original keyword-based reversal
// detection (a narration literally containing "RVSL") still works unchanged, and that an unrelated
// normal recurring sender is unaffected by either check.
import { markAmountMatchedReversals, isReversalNarration } from '../classify';
import { txn } from './testHelpers';

test('a same-amount, same-narration credit reversing an earlier debit is flagged even with no RVSL keyword', () => {
  const txns = [
    txn({ narration: 'ONB TRF TO POS Transf **7126 Green atarodo & red', debit: 8400, dateISO: '2026-03-01' }),
    // Two days later, an identical-looking credit for the exact same amount reverses it - no RVSL/reversal keyword at all.
    txn({ narration: 'ONB TRF TO POS Transf **7126 Green atarodo & red', credit: 8400, dateISO: '2026-03-03' }),
    // The original keyword-based reversal must still work unchanged.
    txn({ narration: 'Failed POS purchase RVSL Star Supermarket', debit: 5000, dateISO: '2026-03-05' }),
    txn({ narration: 'RVSL Failed POS purchase Star Supermarket', credit: 5000, dateISO: '2026-03-06' }),
    // A normal, unrelated recurring sender (Jane Doe, two separate ₦100,000 credits) must be completely
    // unaffected - shown as a real inflow, never as a reversal.
    txn({ narration: 'NIP TRF FROM JANE DOE', credit: 100000, dateISO: '2026-03-10' }),
    txn({ narration: 'NIP TRF FROM JANE DOE', credit: 100000, dateISO: '2026-04-10' }),
  ];

  markAmountMatchedReversals(txns);

  const silentReversal = txns[1];
  expect(silentReversal.__amountMatchedReversal).toBe(true);
  expect(isReversalNarration(silentReversal)).toBe(true);

  const keywordReversal = txns[3];
  expect(isReversalNarration(keywordReversal)).toBe(true);

  const janeDoeRows = txns.filter((t) => t.credit === 100000);
  expect(janeDoeRows.length).toBe(2);
  janeDoeRows.forEach((r) => {
    expect(isReversalNarration(r)).toBe(false);
    expect(r.__amountMatchedReversal).toBeFalsy();
  });
});

test('two unrelated payments through the same channel never get flagged purely off a shared reference number', () => {
  // narrationWordsForReversalMatch deliberately excludes purely-numeric tokens for exactly this reason
  // - real narrations reuse the SAME reference/sort-code numbers across many unrelated transactions.
  const txns = [
    txn({ narration: 'BANKNIP From 000014 PAYREF: 123456789', debit: 20000, dateISO: '2026-01-01' }),
    txn({ narration: 'BANKNIP From 000014 PAYREF: 987654321', credit: 20000, dateISO: '2026-01-02' }),
  ];
  markAmountMatchedReversals(txns);
  expect(txns[1].__amountMatchedReversal).toBeFalsy();
});
