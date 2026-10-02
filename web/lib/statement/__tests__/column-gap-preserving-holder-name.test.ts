// Real-user bug report: "name was not extracted. and it did not follow the manual pattern i did"
// — a real statement (Providus-style tabular header: "CUST. NAME   POPOOLA ADEPEJU ADETUTU") whose
// holder name silently failed to auto-fill, even though ACCOUNT_NAME_TABULAR_LABEL_RE (names.ts) is
// exactly the pattern built for this statement shape and account-holder-name-check.test.ts already
// "covers" it.
//
// That existing coverage is false confidence: it hand-builds a string literal with the column-gap
// spacing already preserved, so it never exercises the real join step. In production, the text fed
// to extractAccountHolderName comes from linesFromTextContent's `.text` field, which collapses EVERY
// whitespace run (including a wide pdf.js x-position gap) down to a single space via
// `.replace(/\s+/g, ' ')` — destroying the very 2+-space signal the tabular regex depends on before
// extractAccountHolderName ever sees the text.
//
// These tests build the real pipeline shape instead: synthetic pdf.js-style `parts` (x + w, exactly
// like linesFromTextContent captures from tc.items), run through lineTextPreservingColumnGaps
// (columns.ts) — the actual fix — and only then into extractAccountHolderName, closing the coverage
// gap the hand-built-string tests leave open.
import { lineTextPreservingColumnGaps, COLUMN_GAP_THRESHOLD } from '../columns';
import { extractAccountHolderName } from '../names';
import type { Line } from '../types';

// Helper: lay out a row of "cells" left to right, each separated by `gap` points of real blank
// space, deriving x/w the same way pdf.js would (next cell's x = previous cell's x + w + gap).
function layoutRow(cells: { str: string; width: number }[], gap: number): Line {
  let x = 0;
  const parts = cells.map((c) => {
    const part = { x, str: c.str, w: c.width };
    x += c.width + gap;
    return part;
  });
  return { text: parts.map((p) => p.str).join(' '), parts };
}

describe('lineTextPreservingColumnGaps', () => {
  test('widens a genuine column gap (>= threshold) into a double space', () => {
    const line = layoutRow(
      [
        { str: 'CUST.', width: 30 },
        { str: 'NAME', width: 30 },
        { str: 'POPOOLA', width: 50 },
      ],
      COLUMN_GAP_THRESHOLD + 10
    );
    const out = lineTextPreservingColumnGaps(line);
    // Every gap in this row is uniformly wide (threshold + 10), so every boundary — including
    // "CUST." -> "NAME" — widens to a double space, not just the label -> value boundary.
    expect(out).toBe('CUST.  NAME  POPOOLA');
  });

  test('keeps ordinary same-cell word spacing as a single space (narrow gap)', () => {
    // Real-data finding: two date parts / words within one bank name measured 8-14pt end-to-end —
    // comfortably under COLUMN_GAP_THRESHOLD, so these must NOT get widened.
    const line = layoutRow(
      [
        { str: '11-03-2026', width: 60 },
        { str: '11-09-2026', width: 60 },
      ],
      10
    );
    expect(lineTextPreservingColumnGaps(line)).toBe('11-03-2026 11-09-2026');
  });

  test('falls back to .text when a line has no parts (OCR/plaintext source)', () => {
    const line: Line = { text: 'plain text line with no parts', parts: [] };
    expect(lineTextPreservingColumnGaps(line)).toBe(line.text);
  });

  test('falls back to a single space (never guesses a column boundary) when width is missing', () => {
    const line: Line = {
      text: 'A B',
      parts: [
        { x: 0, str: 'A' }, // no w
        { x: 200, str: 'B' }, // large raw x-gap, but no width to measure real blank space from
      ],
    };
    expect(lineTextPreservingColumnGaps(line)).toBe('A B');
  });
});

describe('real pipeline: holder name survives the column-gap-preserving join (not the collapsed .text)', () => {
  test('tabular "CUST. NAME" header — real statement shape, built from positioned parts like pdf.js produces', () => {
    const headerLine = layoutRow(
      [
        { str: 'CUST.', width: 25 },
        { str: 'NAME', width: 30 },
        { str: 'POPOOLA', width: 55 },
        { str: 'ADEPEJU', width: 55 },
        { str: 'ADETUTU', width: 55 },
        { str: 'START', width: 35 },
        { str: 'DATE', width: 30 },
        { str: '11-03-2026', width: 60 },
      ],
      // Column boundary gaps (label->value, value->next label) are wide; within-name word gaps are
      // ordinary single-space width.
      0
    );
    // layoutRow above used a single uniform gap; build this one by hand instead so the label->value
    // boundary is wide (36pt, a real measured column gap) while within-name gaps stay narrow (8pt,
    // matching the real same-cell measurement).
    const parts: Line['parts'] = [];
    let x = 0;
    const push = (str: string, width: number, gapBefore: number) => {
      x += gapBefore;
      parts.push({ x, str, w: width });
      x += width;
    };
    push('CUST.', 25, 0);
    push('NAME', 28, 8);
    push('POPOOLA', 55, 36); // label -> value: real wide column gap
    push('ADEPEJU', 55, 8); // within the name: ordinary word spacing
    push('ADETUTU', 55, 8);
    push('START', 35, 36); // value -> next label: real wide column gap
    push('DATE', 30, 8);
    push('11-03-2026', 60, 36);
    const line: Line = { text: parts.map((p) => p.str).join(' '), parts };

    const joined = lineTextPreservingColumnGaps(line);
    // The label/value boundary must have widened to 2+ spaces for the tabular regex to match...
    expect(joined).toMatch(/CUST\.\s*NAME\s{2,}POPOOLA ADEPEJU ADETUTU/i);

    const holder = extractAccountHolderName(joined);
    expect(holder).toMatch(/POPOOLA ADEPEJU ADETUTU/i);
  });

  test('the OLD collapsed .text field (pre-fix behaviour) fails to extract the same name — demonstrates the real bug', () => {
    // This is exactly what linesFromTextContent's `.text` field (and the old
    // `lines.map(l => l.text).join(' ')` in StatementSlot) produced: every whitespace run collapsed
    // to one space, so the column-gap signal never reaches extractAccountHolderName.
    const collapsedText = 'CUST. NAME POPOOLA ADEPEJU ADETUTU START DATE 11-03-2026';
    expect(extractAccountHolderName(collapsedText)).toBeNull();
  });
});
