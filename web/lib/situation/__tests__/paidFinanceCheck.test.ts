// Task #416 (direct request, screenshot): "checks it with what you filled in your finances of you
// filled UK form... confirm if your filled form fits your finances."

import { extractMoneyFigures, summarizeStatementTxns, checkDeclaredFundsFit } from '../paidFinanceCheck';
import { ParsedTxn } from '@/lib/statement';

function txn(date: string, credit: number, debit: number, balance: number, narration = 'x'): ParsedTxn {
  return { date: new Date(date), credit, debit, balance, narration };
}

describe('extractMoneyFigures', () => {
  test('finds a naira-sign amount', () => {
    const figures = extractMoneyFigures('I have ₦450,000 available for this trip.');
    expect(figures).toEqual([{ value: 450000, raw: '₦450,000' }]);
  });

  test('finds an NGN-tagged amount', () => {
    const figures = extractMoneyFigures('Funds available: NGN 1,200,000');
    expect(figures.map((f) => f.value)).toContain(1200000);
  });

  test('finds a trailing "naira" amount', () => {
    const figures = extractMoneyFigures('I currently hold 800,000 naira in savings.');
    expect(figures.map((f) => f.value)).toContain(800000);
  });

  test('ignores bare numbers with no currency marker', () => {
    const figures = extractMoneyFigures('Reference number 4021558, dated 2024-05-01.');
    expect(figures).toEqual([]);
  });

  test('ignores amounts under the noise floor', () => {
    const figures = extractMoneyFigures('Application fee: ₦100');
    expect(figures).toEqual([]);
  });

  test('deduplicates repeated amounts and sorts largest first', () => {
    const figures = extractMoneyFigures('₦500,000 shown here. Also ₦500,000 again. And ₦2,000,000 too.');
    expect(figures).toEqual([
      { value: 2000000, raw: '₦2,000,000' },
      { value: 500000, raw: '₦500,000' },
    ]);
  });

  test('handles empty input', () => {
    expect(extractMoneyFigures('')).toEqual([]);
  });
});

describe('summarizeStatementTxns', () => {
  test('computes latest balance from the most recent transaction', () => {
    const summary = summarizeStatementTxns([
      txn('2024-01-01', 100000, 0, 100000),
      txn('2024-02-01', 50000, 0, 150000),
      txn('2024-03-01', 0, 20000, 130000),
    ]);
    expect(summary.latestBalance).toBe(130000);
  });

  test('sums all credits regardless of order in the array', () => {
    const summary = summarizeStatementTxns([
      txn('2024-03-01', 0, 20000, 130000),
      txn('2024-01-01', 100000, 0, 100000),
      txn('2024-02-01', 50000, 0, 150000),
    ]);
    expect(summary.totalCredits).toBe(150000);
  });

  test('tracks earliest and latest dates', () => {
    const summary = summarizeStatementTxns([txn('2024-03-01', 0, 0, 1), txn('2024-01-01', 0, 0, 1)]);
    expect(summary.earliestDate?.toISOString().slice(0, 10)).toBe('2024-01-01');
    expect(summary.latestDate?.toISOString().slice(0, 10)).toBe('2024-03-01');
  });

  test('handles an empty transaction list', () => {
    const summary = summarizeStatementTxns([]);
    expect(summary).toEqual({ latestBalance: 0, totalCredits: 0, txnCount: 0, earliestDate: null, latestDate: null });
  });
});

describe('checkDeclaredFundsFit', () => {
  test('fits when the statement balance covers the declared amount', () => {
    const result = checkDeclaredFundsFit(500000, { latestBalance: 500000, totalCredits: 0, txnCount: 1, earliestDate: null, latestDate: null });
    expect(result.fits).toBe(true);
  });

  test('fits within the 10% tolerance even if slightly under', () => {
    const result = checkDeclaredFundsFit(500000, { latestBalance: 460000, totalCredits: 0, txnCount: 1, earliestDate: null, latestDate: null });
    expect(result.fits).toBe(true);
  });

  test('does not fit when the gap is wider than the tolerance', () => {
    const result = checkDeclaredFundsFit(500000, { latestBalance: 200000, totalCredits: 0, txnCount: 1, earliestDate: null, latestDate: null });
    expect(result.fits).toBe(false);
    expect(result.ratio).toBeCloseTo(0.4);
  });

  test('fits (and is not penalized) when the statement shows more than declared', () => {
    const result = checkDeclaredFundsFit(500000, { latestBalance: 900000, totalCredits: 0, txnCount: 1, earliestDate: null, latestDate: null });
    expect(result.fits).toBe(true);
  });

  test('does not fit when declaredAmount is zero (nothing confirmed yet)', () => {
    const result = checkDeclaredFundsFit(0, { latestBalance: 500000, totalCredits: 0, txnCount: 1, earliestDate: null, latestDate: null });
    expect(result.fits).toBe(false);
  });
});
