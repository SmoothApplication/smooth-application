// Real-data finding, off a real 2121-line/649-transaction Providus statement (user report: "I
// personally extracted the major inflows from her bank statement and see what I did" — comparing
// the user's own manual Excel extraction against the app's output surfaced this). Providus wraps
// narration text on BOTH sides of the dated row, not just trailing (which mergeWrappedNarrationLines
// already handled) — part of the narration sits on a physical line BEFORE the dated row, e.g.
// "REMITA INFLOW R-1450507303/NIGERIAN" on its own line, immediately followed by the dated row
// "31-03-2026 ... U:2NDQUARTERALLOWANCES2026TOSTAFF:CBN:/901450 ... 3,786,435.00 ...". The word
// "NIGERIAN" (the only identifier of the employer "NIGERIAN UPSTREAM PETROLEUM"/NUPRC) was being
// silently dropped on all 12 of this client's recurring REMITA salary/allowance transactions,
// splitting one consistent employer into unrelated-looking garbled groups — directly contradicting
// what the user's own manual analysis had correctly identified as one employer, ₦34,708,376.20 total.
import {
  mergeLeadingNarrationLines,
  mergeWrappedNarrationLines,
  mergeSplitDateLines,
  parseStatementLines,
  parseStatementLinesWithFallback,
} from '../parse';
import type { Line } from '../types';

function plain(text: string, page = 1): Line {
  return { text, parts: [{ x: 50, str: text }], __page: page };
}

function row(dateStr: string, narrationText: string, credit: string, balance: string, page = 1): Line {
  return {
    text: `${dateStr} ${narrationText} 0.00 ${credit} ${balance}`,
    parts: [
      { x: 0, str: dateStr },
      { x: 50, str: narrationText },
      { x: 200, str: '0.00' },
      { x: 300, str: credit },
      { x: 400, str: balance },
    ],
    __page: page,
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

test('narration text on a LEADING physical line before a dated row is recovered (REMITA/NIGERIAN pattern)', () => {
  const lines: Line[] = [
    header,
    plain('REMITA INFLOW R-1450507303/NIGERIAN'),
    row('31-03-2026', 'U:2NDQUARTERALLOWANCES2026TOSTAFF:CBN:', '3,786,435.00', '3,786,435.00'),
  ];

  const txns = parseStatementLinesWithFallback(lines);
  expect(txns.length).toBe(1);
  expect(txns[0].narration).toMatch(/NIGERIAN/i);
  expect(txns[0].narration).toMatch(/REMITA/i);
  expect(txns[0].credit).toBe(3786435);
});

test('a transaction-type opener on its own line is NOT stolen as trailing narration by the row above it', () => {
  // Real-world finding: a VAT transaction's trailing-merge pass could wrongly swallow the NEXT
  // transaction's own leading line ("REMITA INFLOW .../NIGERIAN") because, in isolation, that line
  // looks exactly like ordinary wrapped narration (no date, no amount, short, not page furniture).
  // TRANSACTION_TYPE_OPENER_RE recognises it as the start of a new transaction instead.
  const lines: Line[] = [
    header,
    row('30-03-2026', 'VAT', '50.00', '1,000,000.00'),
    plain('REMITA INFLOW R-1450507303/NIGERIAN'),
    row('31-03-2026', 'U:2NDQUARTERALLOWANCES2026TOSTAFF:CBN:', '3,786,435.00', '4,786,435.00'),
  ];

  const txns = parseStatementLinesWithFallback(lines);
  expect(txns.length).toBe(2);
  expect(txns[0].narration).not.toMatch(/REMITA|NIGERIAN/i);
  expect(txns[1].narration).toMatch(/NIGERIAN/i);
});

test('a long chain of consecutive dated rows, each needing a leading-merge, does not cascade into one giant merged transaction', () => {
  // This is the exact regression this fix was built for: once mergeLeadingNarrationLines prepends
  // leading text onto a dated row's .text, that row's .text no longer starts with its date, so a
  // naive re-check of "is this a dated row" via parseLeadingDate(prevText) wrongly reads an already-
  // merged genuine transaction as orphan leading narration belonging to the NEXT row — cascading
  // almost an entire statement (649 real transactions) down to 34. A real fixture needs several
  // CONSECUTIVE dated rows, each with its own leading-wrap line, to exercise this at all — a single
  // isolated case (the first test above) passes even with the bug present.
  const lines: Line[] = [
    header,
    plain('REMITA INFLOW R-1000000001/NIGERIAN'),
    row('01-01-2026', 'U:STAFFSALARYFORJAN2026:CBN:', '600,000.00', '600,000.00'),
    plain('REMITA INFLOW R-1000000002/NIGERIAN'),
    row('01-02-2026', 'U:STAFFSALARYFORFEB2026:CBN:', '600,000.00', '1,200,000.00'),
    plain('REMITA INFLOW R-1000000003/NIGERIAN'),
    row('01-03-2026', 'U:STAFFSALARYFORMAR2026:CBN:', '600,000.00', '1,800,000.00'),
    plain('REMITA INFLOW R-1000000004/NIGERIAN'),
    row('01-04-2026', 'U:STAFFSALARYFORAPR2026:CBN:', '600,000.00', '2,400,000.00'),
  ];

  const txns = parseStatementLines(mergeLeadingNarrationLines(mergeWrappedNarrationLines(mergeSplitDateLines(lines))));
  expect(txns.length).toBe(4);
  txns.forEach((t) => expect(t.narration).toMatch(/NIGERIAN/i));
  expect(txns[0].narration).toMatch(/JAN2026/i);
  expect(txns[1].narration).toMatch(/FEB2026/i);
  expect(txns[2].narration).toMatch(/MAR2026/i);
  expect(txns[3].narration).toMatch(/APR2026/i);
  expect(txns.map((t) => t.credit)).toEqual([600000, 600000, 600000, 600000]);
});

test('"ACCOUNT TRANSFERS" on its own leading line is recognised as a transaction-type opener, not stolen as trailing narration (applicant\'s own name recovered)', () => {
  // Direct user report, same real Providus statement: a SECOND instance of the leading-wrap pattern
  // above, with a different transaction-type phrase this regex didn't yet cover ("ACCOUNT TRANSFERS
  // MOB: TRF FROM <name>" instead of "REMITA INFLOW R-.../<name>"). Before this fix, the forward
  // pass swallowed "ACCOUNT TRANSFERS MOB: TRF FROM POPOOLA" whole as the PRECEDING (unrelated)
  // transaction's trailing text, so the applicant's own name ("POPOOLA ADEPEJU ADETUTU") showed up
  // truncated to just "ADEPEJU ADETUTU" on every transaction narrated this way — and, far more
  // visibly, produced a wall of nonsense "same person — merge?" prompts in the Top 10 senders table
  // (half-sentence fragments sharing a few words with her real name).
  const lines: Line[] = [
    header,
    row('18-03-2026', 'SOME UNRELATED CHARGE', '50.00', '1,100,441.15'),
    plain('ACCOUNT TRANSFERS MOB: TRF FROM POPOOLA'),
    row('19-03-2026', 'ADEPEJU ADETUTU 65******2249 TO WOSH VENTURES', '86,820.00', '1,013,621.15'),
  ];

  const txns = parseStatementLinesWithFallback(lines);
  expect(txns.length).toBe(2);
  expect(txns[0].narration).not.toMatch(/POPOOLA/i);
  expect(txns[1].narration).toMatch(/POPOOLA ADEPEJU ADETUTU/i);
});

test('a column-header row is never absorbed as leading narration, even against a general (non-Providus) header wording', () => {
  const genericHeader: Line = {
    text: 'Date Narration Money Out Money In Balance',
    parts: [
      { x: 0, str: 'Date' },
      { x: 50, str: 'Narration' },
      { x: 200, str: 'Money Out' },
      { x: 300, str: 'Money In' },
      { x: 400, str: 'Balance' },
    ],
    __page: 1,
  };
  const lines: Line[] = [genericHeader, row('05-05-2026', 'SALARY PAYMENT', '400,000.00', '400,000.00')];

  const txns = parseStatementLinesWithFallback(lines);
  expect(txns.length).toBe(1);
  expect(txns[0].narration).not.toMatch(/Date|Narration|Balance/i);
});
