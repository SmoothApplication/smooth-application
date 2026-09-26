// Ported scenarios from index.html's renderSponsorRecommendation() (lines 7431-7473), retargeted
// at the pure functions in ../sponsor.ts.

import { getSponsorRecommendation, resolveSpouseRef, SponsorAnswers } from '../sponsor';

function answers(overrides: Partial<SponsorAnswers> = {}): SponsorAnswers {
  return { spouseWilling: '', spouseEmployed: '', spouseUkHistory: '', ...overrides };
}

describe('getSponsorRecommendation', () => {
  test('returns null when nothing has been answered yet', () => {
    expect(getSponsorRecommendation(answers())).toBeNull();
  });

  test('spouse with travel/visa history — spouse_history, no confirm checkbox', () => {
    expect(getSponsorRecommendation(answers({ spouseUkHistory: 'yes' }))).toEqual({
      kind: 'spouse_history',
      showConfirm: false,
    });
  });

  test('spouseUkHistory=yes wins regardless of the other two answers (original precedence)', () => {
    expect(
      getSponsorRecommendation({ spouseWilling: 'no', spouseEmployed: 'no', spouseUkHistory: 'yes' })
    ).toEqual({ kind: 'spouse_history', showConfirm: false });
  });

  test('willing + employed — sponsor_eligible, shows the confirm checkbox', () => {
    expect(getSponsorRecommendation(answers({ spouseWilling: 'yes', spouseEmployed: 'yes' }))).toEqual({
      kind: 'sponsor_eligible',
      showConfirm: true,
    });
  });

  test('willing but not employed — sponsor_weak, no confirm checkbox', () => {
    expect(getSponsorRecommendation(answers({ spouseWilling: 'yes', spouseEmployed: 'no' }))).toEqual({
      kind: 'sponsor_weak',
      showConfirm: false,
    });
  });

  test('not willing — no_sponsor, regardless of spouseEmployed', () => {
    expect(getSponsorRecommendation(answers({ spouseWilling: 'no' }))).toEqual({
      kind: 'no_sponsor',
      showConfirm: false,
    });
    expect(getSponsorRecommendation(answers({ spouseWilling: 'no', spouseEmployed: 'yes' }))).toEqual({
      kind: 'no_sponsor',
      showConfirm: false,
    });
  });

  test('willing answered but employed not yet answered — no match (null), matches original leaving box empty', () => {
    expect(getSponsorRecommendation(answers({ spouseWilling: 'yes' }))).toBeNull();
  });

  test('only spouseEmployed answered — no match (null)', () => {
    expect(getSponsorRecommendation(answers({ spouseEmployed: 'yes' }))).toBeNull();
  });
});

describe('resolveSpouseRef', () => {
  test('uses the trimmed name when provided', () => {
    expect(resolveSpouseRef('  Chidinma  ')).toBe('Chidinma');
  });

  test('falls back to "your spouse" when empty or whitespace-only', () => {
    expect(resolveSpouseRef('')).toBe('your spouse');
    expect(resolveSpouseRef('   ')).toBe('your spouse');
  });
});
