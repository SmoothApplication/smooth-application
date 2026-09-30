// Direct follow-up to the "expert-grade" real-statement audit: workNameCheck.ts confirms an
// employer/business NAME shows up as a real sender, but never compared the AMOUNT landing against
// what the applicant claims to earn — this is the "salary claimed ₦500k/month, only ₦50k/month
// actually lands" judgment call a human reviewer would make, now codified. See incomeMatch.ts.
import { computeIncomeMatch, buildIncomeMatchMessage, INCOME_MATCH_TOLERANCE } from '../incomeMatch';
import type { WorkNameCheckResult } from '../workNameCheck';

function fixtureCheck(overrides: Partial<WorkNameCheckResult> = {}): WorkNameCheckResult {
  return {
    label: 'employer',
    name: 'Acme Corp',
    found: true,
    inflowMatches: [],
    inflowTotal: 0,
    topReason: null,
    reasonIsMajority: false,
    salaryLabeledCount: 0,
    distinctMonthsCount: 0,
    narrationConsistencyPct: 0,
    inflowCategoryHints: [],
    ...overrides,
  };
}

// Helper to fake enough inflowMatches for distinctMonthsCount/inflowTotal to line up — the module
// under test only reads .length off inflowMatches (as a "did we find anything at all" gate) and
// otherwise trusts inflowTotal/distinctMonthsCount directly, so a minimal fake array is enough.
function fakeMatches(n: number) {
  return Array.from({ length: n }, () => ({} as never));
}

describe('computeIncomeMatch', () => {
  test('returns null when no declared amount has been entered', () => {
    const check = fixtureCheck({ inflowMatches: fakeMatches(3), inflowTotal: 1_500_000, distinctMonthsCount: 3 });
    expect(computeIncomeMatch('employer', 0, check)).toBeNull();
    expect(computeIncomeMatch('employer', -100, check)).toBeNull();
  });

  test('returns null when the name check found no direct inflow sender to average', () => {
    const check = fixtureCheck({ inflowMatches: [], inflowTotal: 0, distinctMonthsCount: 0 });
    expect(computeIncomeMatch('employer', 500_000, check)).toBeNull();
  });

  test('verdict "match" when actual is within tolerance of declared', () => {
    // Declared 500k/month, actual 480k/month (4% under) — well inside the 30% band.
    const check = fixtureCheck({ inflowMatches: fakeMatches(3), inflowTotal: 1_440_000, distinctMonthsCount: 3 });
    const result = computeIncomeMatch('employer', 500_000, check);
    expect(result).not.toBeNull();
    expect(result!.verdict).toBe('match');
    expect(result!.actualMonthlyAverage).toBe(480_000);
    expect(result!.monthsObserved).toBe(3);
  });

  test('verdict "below_declared" — the concrete "salary claimed but not landing" case', () => {
    // Declared 500k/month, actual 50k/month — a real 90% shortfall.
    const check = fixtureCheck({ inflowMatches: fakeMatches(6), inflowTotal: 300_000, distinctMonthsCount: 6 });
    const result = computeIncomeMatch('employer', 500_000, check);
    expect(result!.verdict).toBe('below_declared');
    expect(result!.actualMonthlyAverage).toBe(50_000);
    expect(result!.percentDiff).toBeCloseTo(0.9, 5);
  });

  test('verdict "above_declared" when actual comfortably exceeds declared', () => {
    // Declared 200k/month, actual 400k/month — 100% above, well past the 30% band.
    const check = fixtureCheck({ inflowMatches: fakeMatches(2), inflowTotal: 800_000, distinctMonthsCount: 2 });
    const result = computeIncomeMatch('business', 200_000, check);
    expect(result!.verdict).toBe('above_declared');
    expect(result!.percentDiff).toBeCloseTo(-1, 5);
  });

  test('exactly at the tolerance boundary still reads as a match (strict > / < comparison)', () => {
    const declared = 1_000_000;
    const actual = declared * (1 - INCOME_MATCH_TOLERANCE); // exactly 30% under
    const check = fixtureCheck({ inflowMatches: fakeMatches(1), inflowTotal: actual, distinctMonthsCount: 1 });
    const result = computeIncomeMatch('employer', declared, check);
    expect(result!.verdict).toBe('match');
  });
});

describe('buildIncomeMatchMessage', () => {
  test('below_declared reads as a warning naming both figures and the shortfall percentage', () => {
    const msg = buildIncomeMatchMessage({
      label: 'employer',
      declaredMonthlyIncome: 500_000,
      actualMonthlyAverage: 50_000,
      monthsObserved: 6,
      verdict: 'below_declared',
      percentDiff: 0.9,
    });
    expect(msg.status).toBe('warn');
    expect(msg.message).toContain('90%');
    expect(msg.message).toContain('6 month');
  });

  test('above_declared reads as a neutral "ok" note, not a warning', () => {
    const msg = buildIncomeMatchMessage({
      label: 'business',
      declaredMonthlyIncome: 200_000,
      actualMonthlyAverage: 400_000,
      monthsObserved: 2,
      verdict: 'above_declared',
      percentDiff: -1,
    });
    expect(msg.status).toBe('ok');
    expect(msg.message).toContain('100%');
  });

  test('match reads as a positive consistency note', () => {
    const msg = buildIncomeMatchMessage({
      label: 'employer',
      declaredMonthlyIncome: 500_000,
      actualMonthlyAverage: 480_000,
      monthsObserved: 3,
      verdict: 'match',
      percentDiff: 0.04,
    });
    expect(msg.status).toBe('ok');
    expect(msg.message.toLowerCase()).toContain('matches');
  });
});
