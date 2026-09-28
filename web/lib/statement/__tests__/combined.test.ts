import { summarizeStatement, combineStatementSummaries } from '../combined';
import type { ParsedTxn } from '../types';

function txn(dateISO: string, balance: number): ParsedTxn {
  return { date: new Date(dateISO), credit: 0, debit: 0, balance, narration: '' };
}

describe('summarizeStatement', () => {
  test('empty statement summarizes to zeroed-out fields', () => {
    const s = summarizeStatement('Statement 1', []);
    expect(s).toEqual({ label: 'Statement 1', txnCount: 0, firstDate: null, lastDate: null, closingBalance: 0 });
  });

  test('closing balance is the LAST row balance, not the max or first', () => {
    const txns = [txn('2026-01-01', 500000), txn('2026-01-15', 300000), txn('2026-02-01', 420000)];
    const s = summarizeStatement('Salary account', txns);
    expect(s.closingBalance).toBe(420000);
    expect(s.txnCount).toBe(3);
    expect(s.firstDate).toEqual(new Date('2026-01-01'));
    expect(s.lastDate).toEqual(new Date('2026-02-01'));
  });
});

describe('combineStatementSummaries', () => {
  test('sums closing balances across both accounts', () => {
    const a = summarizeStatement('Salary account', [txn('2026-01-01', 100000), txn('2026-02-01', 150000)]);
    const b = summarizeStatement('Side business account', [txn('2026-01-10', 40000), txn('2026-02-05', 90000)]);
    const combined = combineStatementSummaries([a, b]);
    expect(combined.totalClosingBalance).toBe(240000);
    expect(combined.statements).toHaveLength(2);
  });

  test('date span covers the earliest first-date and latest last-date across both statements', () => {
    const a = summarizeStatement('A', [txn('2026-03-01', 1000), txn('2026-05-01', 2000)]);
    const b = summarizeStatement('B', [txn('2026-01-01', 500), txn('2026-04-01', 700)]);
    const combined = combineStatementSummaries([a, b]);
    expect(combined.earliestDate).toEqual(new Date('2026-01-01'));
    expect(combined.latestDate).toEqual(new Date('2026-05-01'));
  });

  test('a not-yet-uploaded second slot (empty txns) is excluded from the total and date span', () => {
    const a = summarizeStatement('A', [txn('2026-02-01', 100000)]);
    const emptySlot = summarizeStatement('B', []);
    const combined = combineStatementSummaries([a, emptySlot]);
    expect(combined.totalClosingBalance).toBe(100000);
    expect(combined.earliestDate).toEqual(new Date('2026-02-01'));
    expect(combined.latestDate).toEqual(new Date('2026-02-01'));
  });

  test('single statement (no second account) combines trivially to itself', () => {
    const a = summarizeStatement('Only account', [txn('2026-01-01', 250000)]);
    const combined = combineStatementSummaries([a]);
    expect(combined.totalClosingBalance).toBe(250000);
  });
});
