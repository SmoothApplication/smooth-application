// Task #415 follow-up (direct request): "translate them and tell the applicant the reason." Only
// chunkLetterText is unit-tested here — it's pure and deterministic. translateToEnglish itself
// makes a real network call to a third-party translation API, which isn't something to exercise in
// an automated test suite (no network in CI, and a live external dependency would make this test
// flaky) — same precedent as extractLetterText.ts's OCR/PDF calls, which also have no direct unit
// tests, only the pure logic around them.

import { chunkLetterText } from '../translateLetter';

describe('chunkLetterText', () => {
  test('returns the whole text as one chunk when it fits under maxChars', () => {
    const text = 'Short paragraph one.\n\nShort paragraph two.';
    expect(chunkLetterText(text, 480)).toEqual(['Short paragraph one.\nShort paragraph two.']);
  });

  test('splits into multiple chunks when combined paragraphs exceed maxChars', () => {
    const para1 = 'A'.repeat(300);
    const para2 = 'B'.repeat(300);
    const chunks = chunkLetterText(`${para1}\n\n${para2}`, 480);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe(para1);
    expect(chunks[1]).toBe(para2);
  });

  test('every chunk stays within maxChars', () => {
    const longText = Array.from({ length: 20 }, (_, i) => `Paragraph number ${i} with some words in it.`).join('\n\n');
    const chunks = chunkLetterText(longText, 100);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(100);
    }
  });

  test('splits a single overlong paragraph on sentence boundaries', () => {
    const sentence = 'This is one sentence of a reasonable length. ';
    const longParagraph = sentence.repeat(20).trim();
    const chunks = chunkLetterText(longParagraph, 100);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(100);
    }
    // Rejoining should still contain all the original sentences (no silent data loss).
    expect(chunks.join(' ')).toContain('This is one sentence of a reasonable length.');
  });

  test('hard-truncates a single sentence longer than maxChars rather than failing', () => {
    const hugeSentence = 'A'.repeat(600);
    const chunks = chunkLetterText(hugeSentence, 100);
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(100);
    }
  });

  test('handles empty input', () => {
    expect(chunkLetterText('')).toEqual([]);
  });

  test('drops blank paragraphs', () => {
    const text = 'First.\n\n\n\nSecond.';
    expect(chunkLetterText(text, 480)).toEqual(['First.\nSecond.']);
  });
});
