// Ported scenarios from index.html's updateTravelExperienceGrade (~line 7397-7422) and the
// TE_* country lists / TE_NO_HISTORY_GUIDES data (~line 4825-4944).

import {
  TE_AFRICAN_COUNTRIES,
  TE_EU_COUNTRIES,
  TE_NAMED_HIGH_VALUE_COUNTRIES,
  TE_ASIAN_COUNTRIES,
  TE_HIGH_SUCCESS_COUNTRIES,
  TE_COUNTRY_LIST,
  TE_NO_HISTORY_GUIDES,
  parseTravelDays,
  computeTravelExperienceGrade,
  TravelHistoryRow,
  OverstayRow,
} from '../travelHistory';

function historyRow(country: string, overrides: Partial<TravelHistoryRow> = {}): TravelHistoryRow {
  return { country, date: '2024-05', reason: 'Holiday', days: '5', ...overrides };
}

function overstayRow(country: string, days: string): OverstayRow {
  return { country, days };
}

describe('TE_COUNTRY_LIST', () => {
  test('is deduped and sorted, with Other always last', () => {
    const seen = new Set<string>();
    TE_COUNTRY_LIST.forEach((c) => {
      expect(seen.has(c)).toBe(false);
      seen.add(c);
    });
    expect(TE_COUNTRY_LIST[TE_COUNTRY_LIST.length - 1]).toBe('Other');
  });

  test('includes representative entries from every source list', () => {
    expect(TE_COUNTRY_LIST).toEqual(expect.arrayContaining(['Ghana', 'France', 'United States', 'Japan', 'Australia']));
  });

  test('sorted alphabetically apart from the trailing Other', () => {
    const withoutOther = TE_COUNTRY_LIST.filter((c) => c !== 'Other');
    const sorted = [...withoutOther].sort((a, b) => a.localeCompare(b));
    expect(withoutOther).toEqual(sorted);
  });
});

describe('TE_NO_HISTORY_GUIDES', () => {
  test('has exactly the five guides (Ghana, Kenya, Ethiopia, Morocco, South Africa)', () => {
    expect(Object.keys(TE_NO_HISTORY_GUIDES).sort()).toEqual(
      ['Ethiopia', 'Ghana', 'Kenya', 'Morocco', 'South Africa'].sort()
    );
  });

  test('each guide has a visaType, summary, and at least one step', () => {
    Object.values(TE_NO_HISTORY_GUIDES).forEach((g) => {
      expect(g.visaType.length).toBeGreaterThan(0);
      expect(g.summary.length).toBeGreaterThan(0);
      expect(g.steps.length).toBeGreaterThan(0);
    });
  });

  test('Ghana cost estimate uses the corrected ABC Transport road figure (₦100,000)', () => {
    expect(TE_NO_HISTORY_GUIDES.Ghana.costEstimate?.road).toContain('₦100,000');
  });

  test('Kenya/Ethiopia/South Africa have no realistic road option (null)', () => {
    expect(TE_NO_HISTORY_GUIDES.Kenya.costEstimate?.road).toBeNull();
    expect(TE_NO_HISTORY_GUIDES.Ethiopia.costEstimate?.road).toBeNull();
    expect(TE_NO_HISTORY_GUIDES['South Africa'].costEstimate?.road).toBeNull();
  });

  test('Morocco has no costEstimate (matching the original, which omits one)', () => {
    expect(TE_NO_HISTORY_GUIDES.Morocco.costEstimate).toBeUndefined();
  });
});

describe('parseTravelDays', () => {
  test('parses numeric strings and strips non-numeric characters', () => {
    expect(parseTravelDays('12')).toBe(12);
    expect(parseTravelDays('12 days')).toBe(12);
  });

  test('returns 0 for empty/invalid input', () => {
    expect(parseTravelDays('')).toBe(0);
    expect(parseTravelDays(null)).toBe(0);
    expect(parseTravelDays(undefined)).toBe(0);
    expect(parseTravelDays('abc')).toBe(0);
  });
});

describe('computeTravelExperienceGrade', () => {
  test('returns null when there are no history rows', () => {
    expect(computeTravelExperienceGrade([], [])).toBeNull();
  });

  test('returns null when rows exist but have no country selected yet', () => {
    expect(computeTravelExperienceGrade([historyRow('')], [])).toBeNull();
  });

  test('1 African country -> "a start to building" line', () => {
    const grade = computeTravelExperienceGrade([historyRow('Ghana')], []);
    expect(grade?.infoLines).toContainEqual(expect.stringContaining("You've visited 1 African country"));
  });

  test('2 African countries -> "good, growing" line', () => {
    const grade = computeTravelExperienceGrade([historyRow('Ghana'), historyRow('Kenya')], []);
    expect(grade?.infoLines).toContainEqual(expect.stringContaining('2 African countries'));
  });

  test('3+ African countries -> "solid, well-rounded" line', () => {
    const grade = computeTravelExperienceGrade(
      [historyRow('Ghana'), historyRow('Kenya'), historyRow('Ethiopia')],
      []
    );
    expect(grade?.infoLines).toContainEqual(expect.stringContaining('solid, well-rounded'));
  });

  test('1 EU country -> "positive factor too" line', () => {
    const grade = computeTravelExperienceGrade([historyRow('France')], []);
    expect(grade?.infoLines).toContainEqual(expect.stringContaining('1 EU country'));
  });

  test('2+ EU countries -> "another Schengen or similar visa" line', () => {
    const grade = computeTravelExperienceGrade([historyRow('France'), historyRow('Germany')], []);
    expect(grade?.infoLines).toContainEqual(expect.stringContaining('2 or more EU countries'));
  });

  test('named high-value country triggers the high-GDP line', () => {
    const grade = computeTravelExperienceGrade([historyRow('United States')], []);
    expect(grade?.infoLines).toContainEqual(expect.stringContaining('major/high-GDP destination'));
  });

  test('Asian-list country also triggers the high-GDP line', () => {
    const grade = computeTravelExperienceGrade([historyRow('Japan')], []);
    expect(grade?.infoLines).toContainEqual(expect.stringContaining('major/high-GDP destination'));
  });

  test('high-success country without overstay triggers the positive-sign line', () => {
    const grade = computeTravelExperienceGrade([historyRow('Morocco')], []);
    expect(grade?.infoLines).toContainEqual(expect.stringContaining('positive sign for a UK visa application'));
    expect(grade?.overstayedAny).toBe(false);
  });

  test('high-success country WITH an overstay suppresses the positive-sign line', () => {
    const grade = computeTravelExperienceGrade([historyRow('Morocco')], [overstayRow('Morocco', '10')]);
    expect(grade?.infoLines).not.toContainEqual(expect.stringContaining('positive sign for a UK visa application'));
    expect(grade?.overstayedAny).toBe(true);
  });

  test('overstay row with 0 or blank days does not count as an overstay', () => {
    const grade = computeTravelExperienceGrade([historyRow('Morocco')], [overstayRow('Morocco', '0')]);
    expect(grade?.overstayedAny).toBe(false);
  });

  test('lines combine when multiple criteria are met at once', () => {
    const grade = computeTravelExperienceGrade(
      [historyRow('Ghana'), historyRow('Kenya'), historyRow('France'), historyRow('United States')],
      []
    );
    expect(grade?.infoLines.length).toBeGreaterThanOrEqual(3);
  });

  test('exported lists have the expected sizes (sanity check against ported data)', () => {
    expect(TE_AFRICAN_COUNTRIES.length).toBe(18);
    expect(TE_EU_COUNTRIES.length).toBe(26);
    expect(TE_NAMED_HIGH_VALUE_COUNTRIES.length).toBe(6);
    expect(TE_ASIAN_COUNTRIES.length).toBe(11);
    expect(TE_HIGH_SUCCESS_COUNTRIES).toEqual(['South Africa', 'Morocco', 'Kenya']);
  });
});
