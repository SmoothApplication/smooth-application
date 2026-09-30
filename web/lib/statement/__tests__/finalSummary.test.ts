// Direct instruction: "your financial report is ready, your opening balance good, closing balance
// good, monthly expenses good, total overall inflow good, whichever is bad, bad... no recurring
// income as salary [is a concern]... recurring income in high esteem [is a strength]."
import { buildFinalSummary, FinalSummaryInput } from '../finalSummary';

const BASE: FinalSummaryInput = {
  openingBalance: 200000,
  closingBalance: 4000000,
  totalInflow: 5000000,
  totalOutflow: 2000000,
  recommendedFundsFloor: 3000000,
  hasSalaryIncome: true,
  hasOtherRecurringIncome: false,
  statementCurrencyIssues: [],
  unexplainedGroupCount: 0,
};

describe('buildFinalSummary', () => {
  test('an all-good statement scores every line good, no attention flags', () => {
    const result = buildFinalSummary(BASE);
    expect(result.goodCount).toBe(result.totalCount);
    expect(result.attentionFlags).toEqual([]);
    expect(result.lines.every((l) => l.verdict === 'good')).toBe(true);
  });

  test('closing balance below the recommended floor reads bad, with the shortfall noted', () => {
    const result = buildFinalSummary({ ...BASE, closingBalance: 500000 });
    const line = result.lines.find((l) => l.label === 'Closing balance')!;
    expect(line.verdict).toBe('bad');
    expect(line.detail).toContain('below the');
  });

  test('total outflow exceeding total inflow reads bad', () => {
    const result = buildFinalSummary({ ...BASE, totalOutflow: 6000000 });
    const line = result.lines.find((l) => l.label === 'Monthly expenses (total outflow)')!;
    expect(line.verdict).toBe('bad');
  });

  test('salary income present reads good, worded as salary', () => {
    const result = buildFinalSummary(BASE);
    const line = result.lines.find((l) => l.label === 'Recurring salary income')!;
    expect(line.verdict).toBe('good');
  });

  test('no salary but other recurring income reads GOOD, not bad, and is framed as a strength', () => {
    const result = buildFinalSummary({ ...BASE, hasSalaryIncome: false, hasOtherRecurringIncome: true });
    const line = result.lines.find((l) => l.label === 'Recurring income')!;
    expect(line.verdict).toBe('good');
    expect(line.detail.toLowerCase()).toContain('strength');
  });

  test('no salary and no other recurring income reads bad', () => {
    const result = buildFinalSummary({ ...BASE, hasSalaryIncome: false, hasOtherRecurringIncome: false });
    const line = result.lines.find((l) => l.label === 'Recurring income')!;
    expect(line.verdict).toBe('bad');
  });

  test('statement currency issues become an attention flag, not a bad line', () => {
    const result = buildFinalSummary({ ...BASE, statementCurrencyIssues: ['stale'] });
    expect(result.attentionFlags.length).toBe(1);
    expect(result.lines.length).toBe(BASE ? 5 : 0); // still exactly the 5 scored lines, no extra bad line
  });

  test('both stale and short_span produce one combined attention flag', () => {
    const result = buildFinalSummary({ ...BASE, statementCurrencyIssues: ['stale', 'short_span'] });
    expect(result.attentionFlags.length).toBe(1);
  });

  test('unexplained inflow groups produce a countable attention flag', () => {
    const result = buildFinalSummary({ ...BASE, unexplainedGroupCount: 3 });
    expect(result.attentionFlags.some((f) => f.includes('3 inflow patterns'))).toBe(true);
  });

  test('singular phrasing for exactly one unexplained group', () => {
    const result = buildFinalSummary({ ...BASE, unexplainedGroupCount: 1 });
    expect(result.attentionFlags.some((f) => f.includes('1 inflow pattern still needs'))).toBe(true);
  });

  test('expired passport becomes an attention flag when passed', () => {
    const result = buildFinalSummary({ ...BASE, passportExpired: true });
    expect(result.attentionFlags.some((f) => f.toLowerCase().includes('passport'))).toBe(true);
  });

  test('omitting passportExpired never adds a passport flag', () => {
    const result = buildFinalSummary(BASE);
    expect(result.attentionFlags.some((f) => f.toLowerCase().includes('passport'))).toBe(false);
  });
});
