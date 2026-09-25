// Ported from tests/work-payment-reason-categories.test.js — the pure-function parts only (the
// original test also exercised a rendered dropdown-select UI with pre-selected options and prompt
// text; this app has no such interactive "Fix reason" UI wired up yet, only the underlying
// extractNarrationReason/detectWorkPaymentCategory functions).
//
// User feedback, off a real manual extraction of every inflow from a declared employer: a matched
// inflow whose narration already states a specific reason (".../February Salary/...",
// ".../allowance/...") should have that reason read off the narration and mapped to the matching
// WORK_PAYMENT_REASON_CATEGORIES value, checking the more specific allowance types before the generic
// "Allowance" catch-all (so "housing allowance" pre-selects "housing_allowance", not just "allowance").
import { extractNarrationReason, detectWorkPaymentCategory } from '../classify';

test('a narration stating "February Salary" is read off and mapped to the "salary" category', () => {
  const reason = extractNarrationReason('NIP/BRIGHT HOMES CLEANING SOLUTIONS LTD/February Salary/REF12345');
  expect(reason).toMatch(/February Salary/i);
  expect(detectWorkPaymentCategory(reason)).toBe('salary');
});

test('a blank/no-specific-reason narration produces no reason and no work-payment category', () => {
  const reason = extractNarrationReason('NIP/TRANSFER TO TEST APPLICANT FROM BRIGHT HOMES CLEANING SOLUTIONS LTD/REF98765', []);
  expect(detectWorkPaymentCategory(reason)).toBeNull();
});

test('more specific allowance types are checked before the generic "allowance" catch-all', () => {
  expect(detectWorkPaymentCategory('Housing Allowance')).toBe('housing_allowance');
  expect(detectWorkPaymentCategory('Transport Allowance')).toBe('transport_allowance');
  expect(detectWorkPaymentCategory('Car Allowance')).toBe('car_allowance');
  expect(detectWorkPaymentCategory('General Allowance')).toBe('allowance');
});
