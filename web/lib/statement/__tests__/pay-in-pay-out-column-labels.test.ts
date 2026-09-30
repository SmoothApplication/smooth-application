// Real-data finding, "proper and easy to read financial analyses & report" quality audit: a real
// Fidelity Bank statement labels its columns "Pay In"/"Pay Out" (not "Credit"/"Debit" or any of the
// other previously-recognised synonyms) — detectColumnsAll never found this header, so every row fell
// back to the order-based heuristic, whose narration is the raw, un-cleaned line text. See columns.ts.
import { detectColumnsAll } from '../columns';
import { parseStatementLinesWithFallback } from '../parse';
import type { Line } from '../types';

test('"Pay In"/"Pay Out"/"Balance" header is recognised as a debit/credit/balance column set', () => {
  const header: Line = {
    text: 'Transaction Date Channel Details Pay In Pay Out Balance',
    parts: [
      { x: 0, str: 'Transaction Date' },
      { x: 100, str: 'Channel' },
      { x: 150, str: 'Details' },
      { x: 200, str: 'Pay In' },
      { x: 260, str: 'Pay Out' },
      { x: 320, str: 'Balance' },
    ],
  };
  const found = detectColumnsAll([header]);
  expect(found.length).toBe(1);
  expect(found[0].cols.credit).toBe(200);
  expect(found[0].cols.debit).toBe(260);
  expect(found[0].cols.balance).toBe(320);
});

test('a row under a Pay In/Pay Out header gets clean narration, not the raw duplicated-date line text', () => {
  const header: Line = {
    text: 'Transaction Date Channel Details Pay In Pay Out Balance',
    parts: [
      { x: 0, str: 'Transaction Date' },
      { x: 100, str: 'Channel' },
      { x: 150, str: 'Details' },
      { x: 200, str: 'Pay In' },
      { x: 260, str: 'Pay Out' },
      { x: 320, str: 'Balance' },
    ],
  };
  const row: Line = {
    text: '2-Mar-26 28-Feb-26 Online ONB TRF TO CRISP N CL 1,000,053.75 9,319,443.82',
    parts: [
      { x: 0, str: '2-Mar-26' },
      { x: 40, str: '28-Feb-26' },
      { x: 100, str: 'Online' },
      { x: 150, str: 'ONB TRF TO CRISP N CL' },
      { x: 260, str: '1,000,053.75' },
      { x: 320, str: '9,319,443.82' },
    ],
  };
  const txns = parseStatementLinesWithFallback([header, row]);
  expect(txns.length).toBe(1);
  expect(txns[0].debit).toBe(1000053.75);
  expect(txns[0].balance).toBe(9319443.82);
  // Clean narration: no leading/trailing date or amount duplicated into it.
  expect(txns[0].narration).toBe('Online ONB TRF TO CRISP N CL');
});
