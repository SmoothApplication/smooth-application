// Ported from tests/reversal-false-positive-shared-boilerplate.test.js.
// User-reported bug, off a real Sterling Bank statement: 36 completely unrelated payments were tagged
// "Reversal" even though none of them are reversals or contain "RVSL". Root cause: two bugs in
// markAmountMatchedReversals()/narrationWordsForReversalMatch() combined —
//   1. purely-numeric tokens (an account/reference/sort-code number shared by EVERY transaction on a
//      channel) were counted as "distinctive shared words" between any two transactions on that
//      channel, regardless of who was actually involved.
//   2. the required overlap degraded to just 1 shared word whenever either narration was short.
// Fixed by stripping purely-numeric tokens, stopwording "BANKNIP", and always requiring a fixed 2 real
// shared words (never degraded to 1). Calls markAmountMatchedReversals directly with the same fixture
// shape the original test drove through the __testMarkAmountMatchedReversals DOM escape hatch.
import { markAmountMatchedReversals } from '../classify';
import { txn } from './testHelpers';

test('an unrelated same-channel/same-amount debit+credit pair sharing only boilerplate is never flagged as a reversal', () => {
  const txns = [
    txn({ narration: 'BANKNIP From 000014 PAYREF: - SENDER: TUNDE BAKARE', debit: 12500, dateISO: '2026-03-01' }),
    txn({ narration: 'BANKNIP From 000014 PAYREF: - SENDER: CHIOMA EZE', credit: 12500, dateISO: '2026-03-03' }),
    txn({ narration: 'BANKNIP From 000014 PAYREF: - SENDER: YARO ABUBAKAR', debit: 7300, dateISO: '2026-04-10' }),
    txn({ narration: 'BANKNIP From 000014 PAYREF: - SENDER: BLESSING OKAFOR', credit: 7300, dateISO: '2026-04-12' }),
    // The genuine case this mechanism exists for: a debit and its silent reversal, sharing real
    // distinctive merchant words beyond just channel boilerplate.
    txn({ narration: 'ONB TRF TO POS Transf **7126 Green Atarodo Red Store', debit: 8400, dateISO: '2026-05-01' }),
    txn({ narration: 'ONB TRF TO POS Transf **7126 Green Atarodo Red Store', credit: 8400, dateISO: '2026-05-02' }),
    // A one-shared-word coincidence: a short debit naming only "EZE" and an unrelated credit naming
    // "CHIOMA EZE" - a different person sharing a surname. Must not be flagged.
    txn({ narration: 'BANKNIP From 000014 PAYREF: - SENDER: EZE', debit: 4000, dateISO: '2026-06-01' }),
    txn({ narration: 'BANKNIP From 000014 PAYREF: - SENDER: CHIOMA EZE', credit: 4000, dateISO: '2026-06-02' }),
  ];

  markAmountMatchedReversals(txns);

  expect(txns[1].__amountMatchedReversal).toBeFalsy(); // CHIOMA EZE credit vs TUNDE BAKARE debit
  expect(txns[3].__amountMatchedReversal).toBeFalsy(); // BLESSING OKAFOR credit vs YARO ABUBAKAR debit
  expect(txns[5].__amountMatchedReversal).toBe(true); // genuine silent reversal
  expect(txns[7].__amountMatchedReversal).toBeFalsy(); // single shared surname coincidence
});
