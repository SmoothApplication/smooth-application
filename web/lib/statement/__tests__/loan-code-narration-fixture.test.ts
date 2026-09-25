// Ported from tests/loan-code-narration-fixture.test.js.
// Real-data finding, off a real First Bank statement: loan-servicing system narrations — "PDC:LOAN
// DISBURAL 20781551FMOBAMPC/120784870 Ref20781551FMOBAMPC/PRI" and similar — are a product/batch code,
// not a person or company's name. Because they recurred more often (as separate loan disbursals) than
// the applicant's actual employer narration in that statement, "Most frequent inflow source" came back
// as the nonsense name "Pdc Loan Disbural...Fmobampc" instead of the real, human-readable sender. This
// fixture (fictional identity/account/amounts, but the same structural narration pattern) has a
// loan-code cluster appearing MORE often (3x) than a genuine recurring employer (2x) — after adding
// these terms to BANK_NARRATION_STOPWORDS, the loan-code cluster produces no name candidate at all, so
// the real employer correctly wins "Most frequent inflow source" via identifyTopIncomeSource.
import { identifyTopIncomeSource } from '../names';
import { txn } from './testHelpers';

test('a loan-servicing system code cluster never surfaces as an inflow source name, even when it recurs more often', () => {
  const txns = [
    // Loan-code cluster: 3 occurrences, never produces a usable name candidate.
    txn({ narration: 'PDC:LOAN DISBURAL 20781551FMOBAMPC/120784870 Ref20781551FMOBAMPC/PRI', credit: 50000, dateISO: '2026-01-05' }),
    txn({ narration: 'PDC:LOAN DISBURAL 20781552FMOBAMPC/120784871 Ref20781552FMOBAMPC/PRI', credit: 50000, dateISO: '2026-02-05' }),
    txn({ narration: 'PDC:LOAN DISBURAL 20781553FMOBAMPC/120784872 Ref20781553FMOBAMPC/PRI', credit: 50000, dateISO: '2026-03-05' }),
    // Genuine recurring employer: 2 occurrences, less frequent, but a real human-readable name.
    txn({ narration: 'NIP/GOLDEN STAR VENTURES/SALARY', credit: 200000, dateISO: '2026-01-20' }),
    txn({ narration: 'NIP/GOLDEN STAR VENTURES/SALARY', credit: 200000, dateISO: '2026-02-20' }),
  ];

  const result = identifyTopIncomeSource(txns, 'Test Applicant');
  expect(result).not.toBeNull();
  expect(result!.name).toBe('Golden Star Ventures');
  expect(/Pdc|Loan|Disbural|Fmobampc/i.test(result!.name)).toBe(false);
});
