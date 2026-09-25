// Ported from tests/salary-narration-and-gap.test.js.
// User feedback, off a real Zenith/Bright Homes Cleaning bank statement: individual payments from a
// recurring income source should keep the bank's own specific narration (e.g. "February Salary",
// "March Salary") rather than being flattened to a generic "Salary" label. And once a monthly salary
// pattern is established, a month that never got one (even though the source has other activity that
// month) should be flagged, e.g. "no July Salary payment was found." Calls buildIncomeSourceBreakdown
// (for the per-payment narration) and detectMissingSalaryMonths (surfaced as
// groups.missingSalaryMonths) directly, with the same fixture shape the original test drove through a
// full PDF-upload/render cycle.
import { buildIncomeSourceBreakdown } from '../classify';
import { txn } from './testHelpers';

test('individual salary payments keep their own month-named narration, and a missing month is flagged', () => {
  const txns = [
    txn({ narration: 'NIP/BRIGHT HOMES CLEANING SOLUTIONS LTD/February Salary', credit: 100000, dateISO: '2026-02-05' }),
    txn({ narration: 'NIP/BRIGHT HOMES CLEANING SOLUTIONS LTD/March Salary', credit: 100000, dateISO: '2026-03-05' }),
    txn({ narration: 'NIP/BRIGHT HOMES CLEANING SOLUTIONS LTD/April Salary', credit: 100000, dateISO: '2026-04-05' }),
    txn({ narration: 'NIP/BRIGHT HOMES CLEANING SOLUTIONS LTD/May Salary', credit: 100000, dateISO: '2026-05-05' }),
    txn({ narration: 'NIP/BRIGHT HOMES CLEANING SOLUTIONS LTD/June Salary', credit: 100000, dateISO: '2026-06-05' }),
    // July: other activity from the same source, but no "July Salary" narration.
    txn({ narration: 'NIP/BRIGHT HOMES CLEANING SOLUTIONS LTD/Transport Allowance', credit: 15000, dateISO: '2026-07-05' }),
    // August has activity too, keeping the statement's date range extending past the July gap.
    txn({ narration: 'NIP/BRIGHT HOMES CLEANING SOLUTIONS LTD/August Salary', credit: 100000, dateISO: '2026-08-05' }),
  ];

  const groups = buildIncomeSourceBreakdown(txns, 'Test Applicant');

  // Every salary payment should appear in the Salary group, keeping its own specific narration text.
  const salaryGroup = groups.find((g) => g.name === 'Salary');
  expect(salaryGroup).toBeDefined();
  const narrations = salaryGroup!.txns.map((t) => t.narration);
  ['February Salary', 'March Salary', 'April Salary', 'May Salary', 'June Salary', 'August Salary'].forEach((m) => {
    expect(narrations.some((n) => n.includes(m))).toBe(true);
  });
  // The July "Transport Allowance" payment is a different narration and must not carry a Salary label.
  expect(narrations.some((n) => n.includes('Transport Allowance'))).toBe(false);

  // The missing month itself: July has other activity from the same source but no "July Salary".
  expect(groups.missingSalaryMonths).not.toBeNull();
  expect(groups.missingSalaryMonths).toContain('July');
});
