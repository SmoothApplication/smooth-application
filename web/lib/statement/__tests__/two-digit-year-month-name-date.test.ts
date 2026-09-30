// Real-data finding, "proper and easy to read financial analyses & report" quality-audit pass
// (11 real applicant statements simulated through the pipeline): a real 13-page Fidelity Bank
// statement uses "2-Mar-26" dates — day, abbreviated month, TWO-digit year — and parseLeadingDate's
// month-name regex only accepted a 4-digit year. Every row on that statement failed to parse (0
// transactions found, no error surfaced), on an otherwise perfectly good statement. See parse.ts's
// own comment on the fix.
import { parseLeadingDate, parseStatementLinesWithFallback } from '../parse';
import type { Line } from '../types';

test('parseLeadingDate accepts a 2-digit year after a month name (D-Mon-YY)', () => {
  const result = parseLeadingDate('2-Mar-26 28-Feb-26 Others SMS ALERT CHARGES 25FEB 26 48.00 10,319,533.57');
  expect(result).not.toBeNull();
  expect(result!.date.getFullYear()).toBe(2026);
  expect(result!.date.getMonth()).toBe(2); // March, 0-indexed
  expect(result!.date.getDate()).toBe(2);
});

test('a real Fidelity-style statement (D-Mon-YY dates, no matching Pay In/Pay Out header) still parses transactions', () => {
  // No column-header row matches COL_LABELS ("Pay In"/"Pay Out" aren't recognised keywords), so this
  // exercises the order-based fallback path in parseStatementLines, same as the real statement did.
  const lines: Line[] = [
    { text: 'Opening Balance 10,319,581.57', parts: [] },
    {
      text: '2-Mar-26 28-Feb-26 Others SMS ALERT CHARGES 25FEB 26 48.00 10,319,533.57',
      parts: [],
    },
    {
      text: '2-Mar-26 28-Feb-26 Online ONB TRANSFER FROM OLUWATOSIN 53,000.00 10,372,533.57',
      parts: [],
    },
  ];
  const txns = parseStatementLinesWithFallback(lines);
  expect(txns.length).toBe(2);
  expect(txns[0].date.getFullYear()).toBe(2026);
});
