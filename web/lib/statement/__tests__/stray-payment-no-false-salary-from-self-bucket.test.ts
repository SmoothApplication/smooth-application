// Ported from tests/stray-payment-no-false-salary-from-self-bucket.test.js.
// User-reported bug, off a real statement: a single, isolated ₦18,730 payment with a blank/coded
// narration got tagged "Salary", even though it has nothing to do with the declared employer. Root
// cause: the applicant's OWN recurring self-transfers (several ₦20,000 payments to herself, correctly
// classified as Self) rounded to the exact same ₦5,000 bucket as this stray payment, and
// identifyStableIncome/identifyIncomeSourceName ran on ALL credits with no awareness of Self at all —
// establishing ₦20,000 as "the" stable recurring amount purely off self-transfers, with room for the
// stray blank-narration payment to ride along. Fixed by filtering self-transfers out of
// buildIncomeSourceBreakdown's stable-amount detection before it ever runs. Calls
// buildIncomeSourceBreakdown directly with the same fixture shape as the original test.
import { buildIncomeSourceBreakdown } from '../classify';
import { txn } from './testHelpers';

test('a stray blank-narration payment coincidentally matching the applicant\'s own self-transfer amount is never folded into Salary', () => {
  const groups = buildIncomeSourceBreakdown(
    [
      // The applicant's own recurring self-transfers - several ₦20,000 payments, narrated with her
      // own full name as "sender" (a known channel quirk), across 3 distinct months.
      txn({ narration: 'BANKNIP From 000014 PAYREF: - SENDER: AGBOOLA MARY OLUWAFUNMILAYO', credit: 20000, dateISO: '2026-02-04' }),
      txn({ narration: 'BANKNIP From 000014 PAYREF: - SENDER: AGBOOLA MARY OLUWAFUNMILAYO', credit: 20000, dateISO: '2026-03-04' }),
      txn({ narration: 'BANKNIP From 000014 PAYREF: - SENDER: AGBOOLA MARY OLUWAFUNMILAYO', credit: 20000, dateISO: '2026-04-04' }),
      // Genuine recurring salary from the declared employer, in 3 different months, at a completely
      // different amount.
      txn({ narration: 'BANKNIP From 090405 PAYREF: - SENDER: CRISP N', credit: 350000, dateISO: '2026-01-07' }),
      txn({ narration: 'BANKNIP From 090405 PAYREF: - SENDER: CRISP N', credit: 350000, dateISO: '2026-02-07' }),
      txn({ narration: 'BANKNIP From 090405 PAYREF: - SENDER: CRISP N', credit: 350000, dateISO: '2026-03-07' }),
      // The stray, isolated, blank-narration payment - rounds to the same ₦20,000 bucket as the
      // self-transfers, but has nothing to do with either the self-transfers or the employer.
      txn({ narration: '3373260214/10000226 - AFRC - 080615544100155048 4891', credit: 18730, dateISO: '2026-08-06' }),
    ],
    'Agboola Mary Oluwafunmilayo'
  );

  const salaryGroups = groups.filter((g) => g.type === 'salary');
  expect(salaryGroups.length).toBe(1);
  expect(salaryGroups[0].total).toBe(1050000);
  expect(salaryGroups[0].count).toBe(3);
  expect(JSON.stringify(salaryGroups)).not.toMatch(/18,?730/);

  const selfGroups = groups.filter((g) => g.type === 'self');
  expect(selfGroups.length).toBe(1);
  expect(selfGroups[0].total).toBe(60000);
});
