import { getPathwayCounts, getVisibleFilterKeys, filterOpportunities } from '../store';
import { OPPORTUNITIES, Opportunity } from '../types';

describe('getPathwayCounts', () => {
  test('matches the real curated list\'s known distribution', () => {
    expect(getPathwayCounts(OPPORTUNITIES)).toEqual({
      'semester-exchange': 1,
      'full-degree-scholarship': 2,
      'postgrad-only': 5,
      'professional-fellowship': 1,
      'paid-program': 1,
    });
  });

  test('empty input gives an empty counts object', () => {
    expect(getPathwayCounts([])).toEqual({});
  });
});

describe('getVisibleFilterKeys', () => {
  test('starts with "all", then every pathway present in PATHWAY_META\'s own order', () => {
    expect(getVisibleFilterKeys(OPPORTUNITIES)).toEqual([
      'all',
      'semester-exchange',
      'full-degree-scholarship',
      'postgrad-only',
      'professional-fellowship',
      'paid-program',
    ]);
  });

  test('a pathway with zero current programs is left out of the filter list', () => {
    const onlyPostgrad: Opportunity[] = OPPORTUNITIES.filter((o) => o.pathway === 'postgrad-only');
    expect(getVisibleFilterKeys(onlyPostgrad)).toEqual(['all', 'postgrad-only']);
  });

  test('empty input still returns just "all"', () => {
    expect(getVisibleFilterKeys([])).toEqual(['all']);
  });
});

describe('filterOpportunities', () => {
  test('"all" returns every program unchanged', () => {
    expect(filterOpportunities(OPPORTUNITIES, 'all')).toEqual(OPPORTUNITIES);
  });

  test('a specific pathway returns only its programs', () => {
    const result = filterOpportunities(OPPORTUNITIES, 'paid-program');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('aiesec-global-volunteer');
  });

  test('a pathway with multiple programs returns all of them, nothing else', () => {
    const result = filterOpportunities(OPPORTUNITIES, 'full-degree-scholarship');
    expect(result.map((o) => o.id).sort()).toEqual(['mastercard-scholars', 'trent-global-citizen']);
  });
});

describe('OPPORTUNITIES data integrity', () => {
  test('has exactly 10 curated programs, each with a unique id', () => {
    expect(OPPORTUNITIES).toHaveLength(10);
    expect(new Set(OPPORTUNITIES.map((o) => o.id)).size).toBe(10);
  });

  test('every program has a non-empty official URL', () => {
    for (const o of OPPORTUNITIES) {
      expect(o.officialUrl).toMatch(/^https:\/\//);
    }
  });
});
