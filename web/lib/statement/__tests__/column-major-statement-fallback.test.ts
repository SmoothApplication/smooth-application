// Ported from tests/column-major-statement-fallback.test.js.
// Real user report: a GTB bank statement produced only "Detected 1 transaction(s)" with a garbage row.
// Root cause: this bank's PDF export renders each table COLUMN as its own text run sharing one Y
// position down the whole page (e.g. one run reads "Balance 1,765.79 11,765.79 3,707.79" — the header
// word plus every row's value in that column), rather than a normal row grid. The row-based parser's
// Y-proximity line grouping sees this as a handful of garbled lines and finds no real transactions.
//
// The fallback (tryColumnMajorStatementParse, wired in via parseStatementLinesWithFallback) only
// activates when the normal parser finds fewer than 2 transactions. It reconstructs each row from a
// per-page date-list line and a same-length balance-list line, using the balance-to-balance delta for
// debit/credit — an "Opening Balance" figure read from the statement's own summary box seeds the very
// first delta — deliberately leaving narration blank, since this layout's Remarks column is one long
// unsplittable run per page.
import { parseStatementLinesWithFallback } from '../parse';
import type { Line } from '../types';

test('reconstructs rows from a column-major PDF layout via the balance-delta fallback', () => {
  const lines: Line[] = [
    // The statement's own info box: names the fields, then a sibling line ending in the matching
    // amounts (findOpeningBalanceForColumnMajor reads the LAST amount off whichever line satisfies
    // both the label-phrase check and the "naira"-mentioning value line with 5+ amounts).
    { text: 'Print Date Total Debit Total Credit Closing Balance Usable Balance Opening Balance', parts: [] },
    { text: '12/01/2026 Naira 1,234.00 5,678.00 3,397.79 3,397.79 3,397.79', parts: [] },
    // Per-page date-list line: almost entirely individual dates, no amounts of its own.
    { text: '01-Jan-2026 15-Jan-2026 20-Jan-2026', parts: [] },
    // Per-page balance-list line: same length (3) as the date list, starts with "Balance".
    { text: 'Balance 1,765.79 11,765.79 3,707.79', parts: [] },
  ];

  const txns = parseStatementLinesWithFallback(lines);

  expect(txns.__usedColumnMajorFallback).toBe(true);
  expect(txns.length).toBe(3);

  // Debit/credit reconstructed via balance delta from the 3,397.79 opening balance: 1,765.79 (-1,632
  // debit), 11,765.79 (+10,000 credit), 3,707.79 (-8,058 debit).
  expect(txns[0].debit).toBeCloseTo(1632, 2);
  expect(txns[0].credit).toBe(0);
  expect(txns[0].balance).toBeCloseTo(1765.79, 2);

  expect(txns[1].credit).toBeCloseTo(10000, 2);
  expect(txns[1].debit).toBe(0);
  expect(txns[1].balance).toBeCloseTo(11765.79, 2);

  expect(txns[2].debit).toBeCloseTo(8058, 2);
  expect(txns[2].credit).toBe(0);
  expect(txns[2].balance).toBeCloseTo(3707.79, 2);

  // Narration is deliberately left blank for reconstructed rows.
  txns.forEach((t) => expect(t.narration).toBe(''));

  const totalCredit = txns.reduce((s, t) => s + t.credit, 0);
  const totalDebit = txns.reduce((s, t) => s + t.debit, 0);
  expect(totalCredit).toBeCloseTo(10000, 2);
  expect(totalDebit).toBeCloseTo(9690, 2);
});
