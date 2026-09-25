// Ported from tests/unexplained-inflow-50k-threshold.test.js.
// User instruction (as product owner): "we pick transfers from N50,000 above deserve an explanation" —
// the flagging rule was changed to a flat N50,000 floor (UNEXPLAINED_INFLOW_MIN_AMOUNT). A narration
// with no readable text at all ("blank") is still flagged regardless of amount. A narration that
// already contains a recognized descriptive keyword (salary, transfer, gift, etc.) is still exempt at
// any amount. Calls findUnexplainedLargeInflows directly with the same fixture the original test drove
// through the __testFindUnexplainedLargeInflows DOM escape hatch.
import { findUnexplainedLargeInflows } from '../classify';
import { txn } from './testHelpers';

test('flags inflows at/above ₦50,000 with no descriptive keyword, exempts below-floor and keyword-bearing ones', () => {
  const txns = [
    txn({ narration: 'TUNDE BAKARE', credit: 50000, dateISO: '2026-03-01' }),
    txn({ narration: 'CHIOMA EZE ENT', credit: 120000, dateISO: '2026-03-05' }),
    txn({ narration: 'YARO ABUBAKAR', credit: 45000, dateISO: '2026-03-08' }),
    txn({ narration: 'BLESSING OKAFOR', credit: 500000, dateISO: '2026-03-10' }),
    txn({ narration: 'SALARY PAYMENT MARCH', credit: 400000, dateISO: '2026-03-15' }),
    txn({ narration: '000123456', credit: 8000, dateISO: '2026-03-18' }),
  ];

  const results = findUnexplainedLargeInflows(txns);
  const byCredit: Record<number, (typeof results)[number]> = {};
  results.forEach((r) => {
    byCredit[r.credit] = r;
  });

  expect(byCredit[50000]).toBeDefined();
  expect(byCredit[120000]).toBeDefined();
  expect(byCredit[45000]).toBeUndefined();
  expect(byCredit[500000]).toBeDefined();
  expect(byCredit[400000]).toBeUndefined();
  expect(byCredit[8000]).toBeDefined();
  expect(byCredit[8000].__flagReason).toBe('blank');
  expect(byCredit[50000].__flagReason).toBe('vague');
});
