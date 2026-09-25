// Ported from tests/split-date-statement-fixture.test.js.
// Real-data finding, off a real "ALAT by WEMA" statement PDF: its Date column is rendered narrow
// enough that the date text WRAPS within its own table cell, so pdf.js's y-position line-bucketing
// splits a single date across two separate lines — e.g. "05-Feb-" on one line and a bare "2026"
// several lines later — while the transaction's actual reference/narration/amount data sits at a
// DIFFERENT y-position sandwiched between those two date fragments, with no date of its own.
// parseLeadingDate then rejected every one of those data lines (nothing looked like a date at the
// start), so the row-based parser found zero transactions. mergeSplitDateLines reassembles the split
// date and prepends it onto the sandwiched data line before the rest of the pipeline sees it.
import { parseStatementLinesWithFallback } from '../parse';
import type { Line } from '../types';

function splitDateTriple(day: string, month: string, dataText: string, year: string, page: number): Line[] {
  return [
    { text: `${day}-${month}-`, parts: [], __page: page },
    { text: dataText, parts: [], __page: page },
    { text: year, parts: [], __page: page },
  ];
}

test('a date split across [head, sandwiched data, year] lines is reassembled into a real transaction row', () => {
  const lines: Line[] = ([] as Line[]).concat(
    splitDateTriple('05', 'Feb', 'TRF NIP CR 50,000.00 50,000.00', '2026', 1),
    splitDateTriple('10', 'Feb', 'TRF NIP DR 20,000.00 30,000.00', '2026', 1),
    splitDateTriple('15', 'Feb', 'TRF NIP CR 40,000.00 70,000.00', '2026', 1),
    splitDateTriple('20', 'Feb', 'TRF NIP DR 10,000.00 60,000.00', '2026', 1)
  );

  const txns = parseStatementLinesWithFallback(lines);
  expect(txns.length).toBe(4);
  expect(txns[0].credit).toBe(50000);
  expect(txns[0].balance).toBe(50000);
  expect(txns[1].debit).toBe(20000);
  expect(txns[1].balance).toBe(30000);
  expect(txns[2].credit).toBe(40000);
  expect(txns[2].balance).toBe(70000);
  expect(txns[3].debit).toBe(10000);
  expect(txns[3].balance).toBe(60000);
});
