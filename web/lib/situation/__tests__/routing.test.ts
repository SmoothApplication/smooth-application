// Ported scenarios from index.html's refusal-letter routing block (~line 16329-16427), retargeted
// at the pure functions in ../routing.ts. The original exposed these via window.__testXxx hooks
// for exactly this reason — testing the keyword/date parsing and routing decision without needing
// a real file + working OCR/CDN access.

import {
  refusalTextLooksFinancial,
  parseRefusalDateFromText,
  refusalMonthsBetween,
  computeRefusalRouting,
  refusalSuggestionText,
  RECENT_REFUSAL_MONTHS,
} from '../routing';

describe('refusalTextLooksFinancial', () => {
  test('matches known UK Home Office financial boilerplate', () => {
    expect(refusalTextLooksFinancial('I am not satisfied you have sufficient funds for your trip.')).toBe(true);
    expect(refusalTextLooksFinancial('Your bank statements do not show a stable financial history.')).toBe(true);
  });

  test('is case-insensitive and tolerant of extra whitespace', () => {
    expect(refusalTextLooksFinancial('  SUFFICIENT   FUNDS  ')).toBe(true);
  });

  test('does not match unrelated refusal wording', () => {
    expect(refusalTextLooksFinancial('I am not satisfied you are a genuine visitor who will leave the UK.')).toBe(false);
  });

  test('handles empty/null/undefined input', () => {
    expect(refusalTextLooksFinancial('')).toBe(false);
    expect(refusalTextLooksFinancial(null as unknown as string)).toBe(false);
    expect(refusalTextLooksFinancial(undefined as unknown as string)).toBe(false);
  });
});

describe('parseRefusalDateFromText', () => {
  test('parses "14 September 2026" (wordy, day-first)', () => {
    const d = parseRefusalDateFromText('Decision date: 14 September 2026');
    expect(d).toEqual(new Date(2026, 8, 14));
  });

  test('parses "14 Sep 2026" (abbreviated month)', () => {
    const d = parseRefusalDateFromText('14 Sep 2026');
    expect(d).toEqual(new Date(2026, 8, 14));
  });

  test('parses "September 14, 2026" (US month-first order)', () => {
    const d = parseRefusalDateFromText('This decision was made on September 14, 2026.');
    expect(d).toEqual(new Date(2026, 8, 14));
  });

  test('parses plain numeric DD/MM/YYYY', () => {
    const d = parseRefusalDateFromText('Ref: 14/09/2026');
    expect(d).toEqual(new Date(2026, 8, 14));
  });

  test('falls back to scanning the whole document when no date is in the first 1200 chars', () => {
    const padding = 'x'.repeat(1300);
    const d = parseRefusalDateFromText(padding + ' Decision date: 14 September 2026');
    expect(d).toEqual(new Date(2026, 8, 14));
  });

  test('returns null when no date can be found', () => {
    expect(parseRefusalDateFromText('No date anywhere in this letter.')).toBeNull();
  });

  test('returns null for empty/null/undefined input', () => {
    expect(parseRefusalDateFromText('')).toBeNull();
    expect(parseRefusalDateFromText(null as unknown as string)).toBeNull();
  });
});

describe('refusalMonthsBetween', () => {
  test('counts whole months between two dates', () => {
    expect(refusalMonthsBetween(new Date(2026, 0, 1), new Date(2026, 6, 1))).toBe(6);
  });

  test('does not count a partial month that has not reached the same day yet', () => {
    expect(refusalMonthsBetween(new Date(2026, 0, 15), new Date(2026, 6, 1))).toBe(5);
  });
});

describe('computeRefusalRouting', () => {
  const now = new Date(2026, 8, 25); // 25 Sep 2026, matches this session's "today"

  test('a financial letter routes to finance2 even if it was a long time ago', () => {
    const oldDate = new Date(2020, 0, 1);
    expect(computeRefusalRouting(oldDate, true, now)).toEqual({ target: 'finance2', months: expect.any(Number) });
  });

  test('a non-financial letter within the recent window routes to finance2', () => {
    const recentDate = new Date(2026, 6, 1); // 2 months before "now"
    const result = computeRefusalRouting(recentDate, false, now);
    expect(result.target).toBe('finance2');
    expect(result.months).toBeLessThanOrEqual(RECENT_REFUSAL_MONTHS);
  });

  test('a non-financial letter older than the recent window routes to restart', () => {
    const oldDate = new Date(2025, 0, 1); // well over 6 months before "now"
    const result = computeRefusalRouting(oldDate, false, now);
    expect(result.target).toBe('restart');
    expect(result.months).toBeGreaterThan(RECENT_REFUSAL_MONTHS);
  });

  test('exactly RECENT_REFUSAL_MONTHS months ago still counts as recent (boundary is >, not >=)', () => {
    const boundaryDate = new Date(now.getFullYear(), now.getMonth() - RECENT_REFUSAL_MONTHS, now.getDate());
    const result = computeRefusalRouting(boundaryDate, false, now);
    expect(result.target).toBe('finance2');
  });

  test('a null date fails safe toward finance2 rather than restart', () => {
    expect(computeRefusalRouting(null, false, now)).toEqual({ target: 'finance2', months: null });
  });
});

describe('refusalSuggestionText', () => {
  test('financial + finance2 target mentions finances', () => {
    const text = refusalSuggestionText({ target: 'finance2', months: 1 }, true);
    expect(text).toMatch(/finances/i);
    expect(text).toMatch(/Income &amp; bank statement analysis/);
  });

  test('non-financial + finance2 target still points at finance2, different wording', () => {
    const text = refusalSuggestionText({ target: 'finance2', months: 2 }, false);
    expect(text).toMatch(/recent enough/i);
    expect(text).toMatch(/Income &amp; bank statement analysis/);
  });

  test('restart target points at the passport scan', () => {
    const text = refusalSuggestionText({ target: 'restart', months: 20 }, false);
    expect(text).toMatch(/passport scan/i);
  });
});
