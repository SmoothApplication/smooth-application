// Task #418: regression coverage for the ported rent-estimate/yearly-cost logic (faithfully carried
// over from the original's getEstimatedAnnualRent()/updateYearlyResponsibilitiesSummary()).
import {
  getEstimatedAnnualRent,
  computeYearlyCostSummary,
  parseNum,
  LAGOS_LGA_ANNUAL_RENT,
  RENT_TIER_ANNUAL,
} from '../livingCost';

describe('getEstimatedAnnualRent', () => {
  test('uses the Lagos LGA table when state is Lagos and an LGA is picked', () => {
    const [lo, hi] = getEstimatedAnnualRent('Lagos', 'Ikeja', '', '', false);
    expect([lo, hi]).toEqual(LAGOS_LGA_ANNUAL_RENT['Ikeja']);
  });

  test('falls back to a wide citywide range when Lagos is picked but no LGA yet', () => {
    expect(getEstimatedAnnualRent('Lagos', '', '', '', false)).toEqual([700000, 3000000]);
  });

  test('applies the Eti Osa sub-area refinement over the plain Eti Osa range', () => {
    const plain = getEstimatedAnnualRent('Lagos', 'Eti Osa', '', '', false);
    const lekki1 = getEstimatedAnnualRent('Lagos', 'Eti Osa', '', 'Lekki Phase 1', false);
    const ajah = getEstimatedAnnualRent('Lagos', 'Eti Osa', '', 'Ajah / Sangotedo / Lekki (Phase 2 and beyond)', false);
    // The two named sub-areas must diverge from each other and from the un-refined blended range —
    // this is the real user-reported bug the sub-area table fixes (Lekki Phase 1 and Ajah addresses
    // both otherwise landing on the same blended Eti Osa estimate).
    expect(lekki1).not.toEqual(ajah);
    expect(lekki1).not.toEqual(plain);
  });

  test('applies the premium-pocket range for Ikeja GRA / Ogudu when the checkbox is ticked', () => {
    const base = getEstimatedAnnualRent('Lagos', 'Ikeja', '', '', false);
    const premium = getEstimatedAnnualRent('Lagos', 'Ikeja', '', '', true);
    expect(premium).not.toEqual(base);
    expect(premium[0]).toBeGreaterThan(base[0]);
  });

  test('non-Lagos states use their tier range, defaulting to "other" when unlisted', () => {
    expect(getEstimatedAnnualRent('Federal Capital Territory', '', '', '', false)).toEqual(RENT_TIER_ANNUAL.capital);
    expect(getEstimatedAnnualRent('Ekiti', '', '', '', false)).toEqual(RENT_TIER_ANNUAL.other);
  });

  test('bedroom multiplier scales the range up/down without changing its ratio direction', () => {
    const base = getEstimatedAnnualRent('Ekiti', '', '', '', false);
    const room = getEstimatedAnnualRent('Ekiti', '', 'room', '', false);
    const duplex = getEstimatedAnnualRent('Ekiti', '', '5bedDuplex', '', false);
    expect(room[1]).toBeLessThan(base[1]);
    expect(duplex[1]).toBeGreaterThan(base[1]);
  });

  test('an unrecognized/empty bedroom selection leaves the range unscaled', () => {
    expect(getEstimatedAnnualRent('Ekiti', '', 'other', '', false)).toEqual(RENT_TIER_ANNUAL.other);
    expect(getEstimatedAnnualRent('Ekiti', '', '', '', false)).toEqual(RENT_TIER_ANNUAL.other);
  });
});

describe('parseNum', () => {
  test('strips thousands separators', () => {
    expect(parseNum('1,500,000')).toBe(1500000);
  });
  test('treats blank/invalid input as 0', () => {
    expect(parseNum('')).toBe(0);
    expect(parseNum(undefined)).toBe(0);
    expect(parseNum('not a number')).toBe(0);
  });
});

describe('computeYearlyCostSummary', () => {
  test('sums rent + 12x monthly upkeep + 3-terms-per-child school fees', () => {
    const s = computeYearlyCostSummary('1500000', '120000', '300000', 2);
    expect(s.rent).toBe(1500000);
    expect(s.upkeepYearly).toBe(1440000);
    expect(s.schoolFeesYearly).toBe(1800000); // 300000 * 3 * 2
    expect(s.total).toBe(1500000 + 1440000 + 1800000);
  });

  test('zero children means zero school fees regardless of a stray per-term figure', () => {
    const s = computeYearlyCostSummary('1500000', '120000', '300000', 0);
    expect(s.schoolFeesYearly).toBe(0);
    expect(s.total).toBe(1500000 + 1440000);
  });
});
