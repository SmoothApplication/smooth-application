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
import {
  extractNarrationReason,
  detectWorkPaymentCategory,
  WORK_PAYMENT_REASON_CATEGORIES,
  workPaymentCategoryLabel,
} from '../classify';

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

// Follow-up selection "Work-payment reason categorization": the {value,label} list itself (ported
// verbatim from index.html ~14113-14125) was never carried over before now - only the pattern-
// matching function above existed. Covering it here since this file already tests everything else
// in this narrow "work payment category" corner of classify.ts.
test('WORK_PAYMENT_REASON_CATEGORIES has a label for every value detectWorkPaymentCategory can return', () => {
  expect(WORK_PAYMENT_REASON_CATEGORIES.map((c) => c.value)).toEqual([
    'salary',
    'allowance',
    'transport_allowance',
    'housing_allowance',
    'car_allowance',
    'fuel_allowance',
    'wardrobe_allowance',
    'subsidy_allowance',
    '13th_month_allowance',
    'medical_allowance',
    'others',
  ]);
  expect(workPaymentCategoryLabel('housing_allowance')).toBe('Housing Allowance');
  expect(workPaymentCategoryLabel('13th_month_allowance')).toBe('13th Month Allowance');
});

test('workPaymentCategoryLabel falls back to the raw value for an unrecognised category', () => {
  expect(workPaymentCategoryLabel('mystery_value')).toBe('mystery_value');
  expect(workPaymentCategoryLabel(null)).toBe('');
});
