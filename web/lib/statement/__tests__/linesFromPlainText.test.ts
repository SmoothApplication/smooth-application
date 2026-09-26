// Follow-up selection "Scanned/photographed statement support": linesFromPlainText itself was
// ported into columns.ts as part of the original bank-statement-engine port (task #244) but sat
// unused until now — it's what turns raw OCR text (from a scanned PDF page or a photographed
// statement, see lib/statement/extractFile.ts's getLinesFromPdfWithOcrFallback/
// getLinesFromImageFile) into the Line[] shape every downstream parsing function consumes.
import { linesFromPlainText } from '../columns';

describe('linesFromPlainText', () => {
  test('splits OCR text into one Line per non-blank source line, with no x-positions', () => {
    const text = '25 Jan 2026 NIP TRF/ACME CORP/SALARY 300000.00\nCredit 300000.00\n\n26 Jan 2026 POS PURCHASE 5000.00 Debit';
    const lines = linesFromPlainText(text);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual({ text: '25 Jan 2026 NIP TRF/ACME CORP/SALARY 300000.00', parts: [] });
    expect(lines.every((l) => l.parts.length === 0)).toBe(true);
  });

  test('drops blank/whitespace-only lines (common in noisy OCR output)', () => {
    const lines = linesFromPlainText('first line\n   \n\nsecond line\n\t\n');
    expect(lines.map((l) => l.text)).toEqual(['first line', 'second line']);
  });

  test('empty/null input yields no lines', () => {
    expect(linesFromPlainText('')).toEqual([]);
    expect(linesFromPlainText(null as unknown as string)).toEqual([]);
    expect(linesFromPlainText(undefined as unknown as string)).toEqual([]);
  });
});
