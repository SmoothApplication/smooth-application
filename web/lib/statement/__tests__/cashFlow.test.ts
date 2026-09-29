// Direct user report during launch: "when you put in your bank statement... your six months
// report doesn't show." Traced to a real gap against the original GitHub Pages app: its Financial
// readiness calculator auto-filled a "Monthly cash flow (last 6 months)" table from the same
// statement upload used for the income analysis; this Next.js port left that table as pure manual
// entry, disconnected from the already-parsed statement. computeMonthlyCashFlow restores the
// auto-fill numbers — see cashFlow.ts's own comment for the full story.
import { computeMonthlyCashFlow } from '../cashFlow';
import { txn } from './testHelpers';

test('groups by calendar month, summing credit as inflow and debit as outflow', () => {
  const txns = [
    txn({ narration: 'A', credit: 100000, dateISO: '2026-03-05', balance: 100000 }),
    txn({ narration: 'B', debit: 20000, dateISO: '2026-03-10', balance: 80000 }),
    txn({ narration: 'C', credit: 50000, dateISO: '2026-04-01', balance: 130000 }),
  ];
  const rows = computeMonthlyCashFlow(txns);
  expect(rows).toHaveLength(2);
  expect(rows[0]).toEqual({ month: 'Mar 2026', inflow: 100000, outflow: 20000, balance: '80000' });
  expect(rows[1]).toEqual({ month: 'Apr 2026', inflow: 50000, outflow: 0, balance: '130000' });
});

test('closing balance for a month is the LAST transaction seen for that month, in statement order', () => {
  const txns = [
    txn({ narration: 'A', credit: 10000, dateISO: '2026-01-01', balance: 10000 }),
    txn({ narration: 'B', credit: 10000, dateISO: '2026-01-15', balance: 20000 }),
    txn({ narration: 'C', debit: 5000, dateISO: '2026-01-15', balance: 15000 }),
  ];
  const rows = computeMonthlyCashFlow(txns);
  expect(rows).toHaveLength(1);
  expect(rows[0].balance).toBe('15000');
});

test('keeps only the most recent N distinct months when the statement spans more than that', () => {
  const months = ['2026-01-05', '2026-02-05', '2026-03-05', '2026-04-05', '2026-05-05', '2026-06-05', '2026-07-05'];
  const txns = months.map((dateISO, i) => txn({ narration: `M${i}`, credit: 1000 * (i + 1), dateISO, balance: 1000 }));
  const rows = computeMonthlyCashFlow(txns, 6);
  expect(rows).toHaveLength(6);
  // Earliest month (Jan) dropped, most recent 6 (Feb-Jul) kept, oldest-first order preserved.
  expect(rows[0].month).toBe('Feb 2026');
  expect(rows[rows.length - 1].month).toBe('Jul 2026');
});

test('an untouched month with no closing-balance data reads as an empty string, not "0"', () => {
  const txns = [txn({ narration: 'A', credit: 5000, dateISO: '2026-01-01', balance: 0 })];
  const rows = computeMonthlyCashFlow(txns);
  expect(rows[0].balance).toBe('');
});

test('returns an empty array for no transactions, so callers can skip auto-fill entirely', () => {
  expect(computeMonthlyCashFlow([])).toEqual([]);
});

test('ignores transactions with an invalid/missing date rather than crashing', () => {
  const bad = txn({ narration: 'A', credit: 1000, dateISO: 'not-a-date' });
  const good = txn({ narration: 'B', credit: 2000, dateISO: '2026-05-01', balance: 2000 });
  const rows = computeMonthlyCashFlow([bad, good]);
  expect(rows).toHaveLength(1);
  expect(rows[0].month).toBe('May 2026');
});
