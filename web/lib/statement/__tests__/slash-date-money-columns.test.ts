// Ported from tests/slash-date-money-columns.test.js.
// Real user report: a Sterling Bank statement "did not read" at all — zero transactions detected.
// Root cause: this statement uses DD/Mon/YYYY dates with SLASH separators (e.g. "14/Feb/2026"), which
// neither of parseLeadingDate's two relevant regexes matched (one requires an all-digit month, the
// other only allowed a space or hyphen before/after a month name — never a slash). It also labels its
// credit/debit columns "Money In"/"Money Out" rather than any previously-recognized header word, so
// even once dates parsed, column detection would still miss them.
import { parseStatementLinesWithFallback } from '../parse';
import { aggregateTransactions } from '../parse';
import type { Line } from '../types';

test('slash-separated Mon-name dates and Money In/Money Out column headers are recognised', () => {
  const header: Line = {
    text: 'Date Narration Money Out Money In Balance',
    parts: [
      { x: 0, str: 'Date' },
      { x: 100, str: 'Narration' },
      { x: 200, str: 'Money Out' },
      { x: 300, str: 'Money In' },
      { x: 400, str: 'Balance' },
    ],
  };
  const row1: Line = {
    text: '01/Jan/2026 Card purchase 1,500.00 98,500.00',
    parts: [
      { x: 0, str: '01/Jan/2026' },
      { x: 100, str: 'Card purchase' },
      { x: 200, str: '1,500.00' },
      { x: 400, str: '98,500.00' },
    ],
  };
  const row2: Line = {
    text: '02/Jan/2026 Inbound transfer 50,000.00 148,500.00',
    parts: [
      { x: 0, str: '02/Jan/2026' },
      { x: 100, str: 'Inbound transfer' },
      { x: 300, str: '50,000.00' },
      { x: 400, str: '148,500.00' },
    ],
  };
  const row3: Line = {
    text: '03/Jan/2026 Inbound transfer 25,000.00 173,500.00',
    parts: [
      { x: 0, str: '03/Jan/2026' },
      { x: 100, str: 'Inbound transfer' },
      { x: 300, str: '25,000.00' },
      { x: 400, str: '173,500.00' },
    ],
  };

  const txns = parseStatementLinesWithFallback([header, row1, row2, row3]);
  expect(txns.length).toBe(3);
  expect(txns[0].debit).toBe(1500);
  expect(txns[0].credit).toBe(0);
  expect(txns[1].credit).toBe(50000);
  expect(txns[2].credit).toBe(25000);

  const totalCredit = txns.reduce((s, t) => s + t.credit, 0);
  const totalDebit = txns.reduce((s, t) => s + t.debit, 0);
  expect(totalCredit).toBe(75000);
  expect(totalDebit).toBe(1500);

  const months = aggregateTransactions(txns);
  expect(months.length).toBe(1);
  expect(months[0].lastBalance).toBe(173500);
});
