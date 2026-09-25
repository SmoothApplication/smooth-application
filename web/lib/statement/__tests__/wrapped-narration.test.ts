// Ported from tests/wrapped-narration.test.js.
// Real-data limitation, disclosed off a real 31-page Zenith statement: many bank statement
// DESCRIPTION cells wrap across MORE THAN ONE physical PDF line — the transaction's date and amounts
// sit on the first line, but the tail of its narration (e.g. "...Solutions Ltd/February Salary")
// spills onto the next line, which has no date and no amount figures of its own. That trailing text
// used to be silently dropped, which is exactly why narration-dependent checks (salary-reason
// detection) came up empty on otherwise-genuine salary payments whose "Salary" word only existed on
// the wrapped line. mergeWrappedNarrationLines stitches a qualifying trailing line back onto the
// preceding transaction's narration before the rest of the parser ever sees it.
import { parseStatementLinesWithFallback } from '../parse';
import { findInflowsMatchingName } from '../classify';
import type { Line } from '../types';

function row(dateStr: string, narrationText: string, credit: string, balance: string): Line {
  return {
    text: `${dateStr} ${narrationText} 0.00 ${credit} ${balance}`,
    parts: [
      { x: 0, str: dateStr },
      { x: 50, str: narrationText },
      { x: 200, str: '0.00' },
      { x: 300, str: credit },
      { x: 400, str: balance },
    ],
    __page: 1,
  };
}

const header: Line = {
  text: 'Date Narration Debit Credit Balance',
  parts: [
    { x: 0, str: 'Date' },
    { x: 50, str: 'Narration' },
    { x: 200, str: 'Debit' },
    { x: 300, str: 'Credit' },
    { x: 400, str: 'Balance' },
  ],
  __page: 1,
};

test('a narration that wraps onto a second physical PDF line is recovered into the transaction narration', () => {
  const lines: Line[] = [
    header,
    row('15/Feb/2026', 'NIP TRF FROM BRIGHT HOMES CLEANING', '350,000.00', '350,000.00'),
    // Wrapped continuation line: no leading date, no amounts, short enough, not page furniture.
    { text: 'SOLUTIONS LTD/February Salary', parts: [{ x: 50, str: 'SOLUTIONS LTD/February Salary' }], __page: 1 },
    row('15/Mar/2026', 'NIP TRF FROM BRIGHT HOMES CLEANING', '350,000.00', '700,000.00'),
    { text: 'SOLUTIONS LTD/March Salary', parts: [{ x: 50, str: 'SOLUTIONS LTD/March Salary' }], __page: 1 },
  ];

  const txns = parseStatementLinesWithFallback(lines);
  expect(txns.length).toBe(2);
  expect(txns[0].credit).toBe(350000);
  expect(txns[1].credit).toBe(350000);
  expect(txns[0].narration).toMatch(/SOLUTIONS LTD/i);
  expect(txns[0].narration).toMatch(/February Salary/i);
  expect(txns[1].narration).toMatch(/March Salary/i);

  // The recovered wrapped text also makes the employer name-match actually find both inflows.
  const { matches } = findInflowsMatchingName('Bright Homes Cleaning Solutions Ltd', txns);
  expect(matches.length).toBe(2);
  const total = matches.reduce((s, t) => s + t.credit, 0);
  expect(total).toBe(700000);
});
