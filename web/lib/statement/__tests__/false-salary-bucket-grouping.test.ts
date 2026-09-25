// Ported from tests/false-salary-bucket-grouping.test.js.
// User feedback, off a real bank statement export: a genuine ₦100,000 payment from a cleaning-services
// company got swept into a false, generic "Salary" bucket in the "Income sources breakdown" — alongside
// other, completely unrelated senders' one-off ₦100,000 payments — instead of appearing under its own
// sender's name. Root cause: identifyStableIncome() only looks for a rounded amount recurring across 2+
// distinct months anywhere in the whole statement, with no check that the SAME sender is behind those
// recurring payments. The fix requires the amount's recurrence to also come from a consistent,
// identifiable sender (via identifyIncomeSourceName) before trusting it as "Salary". Calls
// buildIncomeSourceBreakdown directly with the same three-sender, coincidental-₦100,000 shape the
// original PDF fixture modelled (fictional names, as the original comment notes).
import { buildIncomeSourceBreakdown } from '../classify';
import { txn } from './testHelpers';

test('does not create a false "Salary" bucket from unrelated senders sharing a coincidental amount', () => {
  const txns = [
    // Sparkle Shine Cleaning Services Ltd - the disputed real payment, narrated "office".
    txn({ narration: 'NIP/SPARKLE SHINE CLEANING SERVICES LTD/office', credit: 100000, dateISO: '2026-01-10' }),
    // Chidinma Grace Eze - a completely unrelated sender whose one-off payment happens to land on the
    // same rounded amount.
    txn({ narration: 'NIP/CHIDINMA GRACE EZE/gift', credit: 100000, dateISO: '2026-02-12' }),
    // Patrick Johnson - a second, also-unrelated sender, same coincidental amount.
    txn({ narration: 'NIP/PATRICK JOHNSON/loan repayment', credit: 100000, dateISO: '2026-03-14' }),
  ];

  const groups = buildIncomeSourceBreakdown(txns, 'Test Applicant');

  // No group should be a generic "Salary" bucket - none of these three ₦100,000 payments share a
  // real, consistent sender across 2+ months.
  expect(groups.some((g) => g.name === 'Salary')).toBe(false);

  // Each payment should appear under its own, correctly-identified sender group.
  const sparkle = groups.find((g) => /Sparkle Shine Cleaning Services/i.test(g.name));
  expect(sparkle).toBeDefined();
  expect(sparkle!.txns[0].narration).toMatch(/office/i);

  const chidinma = groups.find((g) => /Chidinma Grace Eze/i.test(g.name));
  expect(chidinma).toBeDefined();

  const patrick = groups.find((g) => /Patrick Johnson/i.test(g.name));
  expect(patrick).toBeDefined();
});
