// Direct instruction: "the applicant should be given a warning [when the statement] is not six
// months. It will still be processed, but you should be told." See statementCurrency.ts.
import {
  computeStatementCurrency,
  buildStatementCurrencyWarning,
  STALE_THRESHOLD_DAYS,
  MIN_SPAN_DAYS_FOR_SIX_MONTHS,
} from '../statementCurrency';
import type { ParsedTxn } from '../types';

function txn(dateISO: string): ParsedTxn {
  return { date: new Date(dateISO), credit: 1000, debit: 0, balance: 1000, narration: 'x' };
}

const TODAY = new Date('2026-09-30T00:00:00Z');

describe('computeStatementCurrency', () => {
  test('a genuine current 6-month statement passes with no issues', () => {
    const txns = [txn('2026-04-01'), txn('2026-06-15'), txn('2026-09-20')];
    const result = computeStatementCurrency(txns, TODAY);
    expect(result.isCurrentSixMonths).toBe(true);
    expect(result.issues).toEqual([]);
  });

  test('flags "stale" when the most recent transaction is too far in the past', () => {
    const txns = [txn('2025-12-01'), txn('2026-03-01'), txn('2026-06-01')]; // last txn ~121 days before TODAY
    const result = computeStatementCurrency(txns, TODAY);
    expect(result.daysSinceLastTransaction).toBeGreaterThan(STALE_THRESHOLD_DAYS);
    expect(result.issues).toContain('stale');
    expect(result.isCurrentSixMonths).toBe(false);
  });

  test('flags "short_span" when the statement only covers a few weeks, even if recent', () => {
    const txns = [txn('2026-09-01'), txn('2026-09-20'), txn('2026-09-28')];
    const result = computeStatementCurrency(txns, TODAY);
    expect(result.spanDays).toBeLessThan(MIN_SPAN_DAYS_FOR_SIX_MONTHS);
    expect(result.issues).toContain('short_span');
    expect(result.isCurrentSixMonths).toBe(false);
  });

  test('a statement that is both stale AND short-spanned reports both issues', () => {
    const txns = [txn('2026-01-01'), txn('2026-01-15')];
    const result = computeStatementCurrency(txns, TODAY);
    expect(result.issues).toEqual(expect.arrayContaining(['stale', 'short_span']));
  });

  test('no valid dates at all is treated as both issues, never crashes', () => {
    const result = computeStatementCurrency([], TODAY);
    expect(result.earliestDate).toBeNull();
    expect(result.isCurrentSixMonths).toBe(false);
  });
});

describe('buildStatementCurrencyWarning', () => {
  test('returns null (no banner) when the statement is genuinely current', () => {
    const txns = [txn('2026-04-01'), txn('2026-09-20')];
    const result = computeStatementCurrency(txns, TODAY);
    expect(buildStatementCurrencyWarning(result)).toBeNull();
  });

  test('mentions both the specific staleness fact and that it will still be processed', () => {
    const txns = [txn('2025-11-01'), txn('2026-01-01')];
    const result = computeStatementCurrency(txns, TODAY);
    const warning = buildStatementCurrencyWarning(result);
    expect(warning).not.toBeNull();
    expect(warning).toContain('still be processed');
    expect(warning!.toLowerCase()).toContain('days ago');
  });
});
