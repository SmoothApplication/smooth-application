// Ported from tests/wrapped-narration-cleanup-fixture.test.js.
// Real-data finding, off a real UBA statement: two separate ways a transaction's displayed narration
// could come out wrong.
//
// (1) Some rows carry NO narration text on their own dated/amount line at all — the whole description
// sits entirely on a wrapped continuation line below it. Before this fix, the code always started
// narration-cleanup from the row's own (empty) text, then re-appended the wrapped continuation on top
// of the UNCLEANED original — producing a narration that still showed the raw date/amount prefix, and
// in some cases duplicated the wrapped text a second time.
//
// (2) Page footer/header boilerplate ("Download App | Chat with Leo | Our Website", "Head Office: ...")
// sitting right after a transaction's row, with no date and no amount of its own, used to get silently
// absorbed as if it were wrapped narration text.
//
// Calls mergeWrappedNarrationLines + buildCleanNarration directly with the same two-pattern shape the
// original PDF fixture modelled (fictional identity/account/amounts).
import { mergeWrappedNarrationLines, buildCleanNarration } from '../parse';
import type { Line } from '../types';

test('a row with no narration text of its own absorbs its wrapped continuation line cleanly, without duplication', () => {
  // Transaction row: date + amounts, but the "narration" part column is empty on this line.
  const row: Line = {
    text: '05-May-2025 0.00 350,000.00 500,000.00',
    parts: [
      { x: 0, str: '05-May-2025' },
      { x: 100, str: '0.00' },
      { x: 150, str: '350,000.00' },
      { x: 200, str: '500,000.00' },
    ],
    __page: 1,
  };
  const wrapLine: Line = { text: 'SUNRISE FRESH PRODUCE VENTURES LTD SALARY MAY', parts: [], __page: 1 };

  const merged = mergeWrappedNarrationLines([row, wrapLine]);
  expect(merged.length).toBe(1);
  expect(merged[0].__wrapExtra).toBe('SUNRISE FRESH PRODUCE VENTURES LTD SALARY MAY');

  const excludeX = { 100: true, 150: true, 200: true };
  const narration = buildCleanNarration(merged[0], excludeX, merged[0].__wrapExtra);

  expect(narration).toMatch(/SUNRISE FRESH PRODUCE VENTURES LTD[\s\S]{0,10}SALARY MAY/i);
  // No leftover raw date text inside the cleaned narration.
  expect(narration).not.toMatch(/05-May-2025/);
  // The wrapped narration text should appear exactly once, not duplicated.
  const occurrences = (narration.match(/SALARY MAY/g) || []).length;
  expect(occurrences).toBe(1);
});

test('page footer/header boilerplate following a transaction row is never absorbed as wrapped narration', () => {
  const row: Line = {
    text: '06-May-2025 TNF-JOHN ADEYEMI 0.00 75,000.00 575,000.00',
    parts: [
      { x: 0, str: '06-May-2025 TNF-JOHN ADEYEMI' },
      { x: 150, str: '0.00' },
      { x: 200, str: '75,000.00' },
      { x: 250, str: '575,000.00' },
    ],
    __page: 1,
  };
  const footerLine: Line = { text: 'Download App | Chat with Leo | Our Website', parts: [], __page: 1 };

  const merged = mergeWrappedNarrationLines([row, footerLine]);
  // The footer line must NOT be absorbed — it should remain its own separate (unconsumed) line.
  expect(merged.length).toBe(2);
  expect(merged[0].__wrapExtra).toBeUndefined();

  const excludeX = { 150: true, 200: true, 250: true };
  const narration = buildCleanNarration(merged[0], excludeX, merged[0].__wrapExtra);
  expect(narration).toMatch(/TNF-JOHN ADEYEMI/);
  expect(narration).not.toMatch(/Download App|Chat with Leo|Our Website|Head Office/i);
});
