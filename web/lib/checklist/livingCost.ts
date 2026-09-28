// Task #418: the "Estimated yearly cost of living" rent/upkeep/school-fee estimator from the
// original's "Your responsibilities" session — ported faithfully (rent tables, bedroom multipliers,
// Eti Osa sub-area and Lagos "premium pocket" refinements all carried over as-is) since this was
// built in the pre-rebuild vanilla-JS codebase and never made it into this Next.js port.
//
// Sourced from public real-estate listing aggregates (Nigeria Property Centre, PropertyPro, and
// rent-tracking guides such as mushrooms.ng's Lagos rent guide and theafricanvestor.com's Abuja/
// Nigeria rent guides), as documented in the original's own comments — broad, INDICATIVE ranges for
// a typical 2-3 bedroom home, not appraisals. Rent varies enormously street-to-street even within
// one LGA, so this is only ever a starting number the applicant is expected to check and correct.
export type Bedrooms = '' | 'room' | '1bed' | '2bed' | '3bed' | '4bedDuplex' | '5bedDuplex' | 'other';

// Lagos is estimated at LGA level (rents vary too widely for one state-wide number); every other
// state falls back to a broader tier (STATE_RENT_TIER) rather than claiming false precision for all
// 773 Nigerian LGAs.
export const LAGOS_LGA_ANNUAL_RENT: Record<string, [number, number]> = {
  'Eti Osa': [3000000, 15000000],
  'Lagos Island': [2500000, 8000000],
  Ikeja: [2000000, 4500000],
  'Lagos Mainland': [1800000, 3500000],
  'Amuwo-Odofin': [1500000, 3000000],
  Apapa: [1500000, 3000000],
  Kosofe: [1200000, 2800000],
  Surulere: [1200000, 2500000],
  Shomolu: [1200000, 1800000],
  'Ifako-Ijaiye': [1000000, 2200000],
  'Ibeju-Lekki': [800000, 2500000],
  'Oshodi-Isolo': [800000, 1800000],
  Mushin: [700000, 1500000],
  Ikorodu: [700000, 1500000],
  Alimosho: [700000, 1800000],
  Ojo: [600000, 1400000],
  'Ajeromi-Ifelodun': [600000, 1300000],
  Agege: [600000, 1200000],
  Badagry: [500000, 1200000],
  Epe: [500000, 1200000],
};

export const STATE_RENT_TIER: Record<string, string> = {
  'Federal Capital Territory': 'capital',
  Rivers: 'secondaryCityHigh',
  Oyo: 'majorUrban',
  Kaduna: 'majorUrban',
  Kano: 'majorUrban',
  Enugu: 'majorUrban',
  Delta: 'majorUrban',
  Edo: 'majorUrban',
  Ogun: 'majorUrban',
  Anambra: 'majorUrban',
  'Cross River': 'majorUrban',
  'Akwa Ibom': 'majorUrban',
};

export const RENT_TIER_ANNUAL: Record<string, [number, number]> = {
  capital: [1800000, 5000000],
  secondaryCityHigh: [1200000, 3000000],
  majorUrban: [700000, 2000000],
  other: [400000, 1200000],
};

// Roughly a 1.3-2x step up per room added (self-contain -> 1-bed -> 2-bed), a more conservative step
// for the two duplex tiers. 'other' (and no selection) deliberately has no entry — falls back to the
// un-scaled 2-3BR baseline, since there's nothing more specific to scale it by.
export const BEDROOM_RENT_MULTIPLIER: Partial<Record<Bedrooms, number>> = {
  room: 0.4,
  '1bed': 0.65,
  '2bed': 0.85,
  '3bed': 1.15,
  '4bedDuplex': 1.8,
  '5bedDuplex': 2.4,
};

// Eti Osa alone spans genuinely incomparable neighbourhoods (Ikoyi/VI mansions, Lekki Phase 1
// towers, the cheaper Ajah/Sangotedo corridor) blended into one number in the table above — this
// refines the estimate for that one LGA instead. Figures are the same pre-bedroom-multiplier "typical
// 2-3BR" baseline the rest of this table uses.
export const ETI_OSA_SUB_AREA_RENT: Record<string, [number, number]> = {
  'Ikoyi / Victoria Island': [13000000, 39000000],
  'Lekki Phase 1': [8700000, 17400000],
  'Ajah / Sangotedo / Lekki (Phase 2 and beyond)': [870000, 5200000],
};

// A single well-known premium enclave sitting inside an otherwise fairly uniform LGA (rather than
// several genuinely different areas needing their own picker), so a plain checkbox rather than a
// dropdown. Figures are the same pre-bedroom-multiplier baseline as the rest of this table.
export const LAGOS_PREMIUM_POCKET: Record<string, { label: string; hint: string; range: [number, number] }> = {
  Ikeja: { label: 'Ikeja GRA', hint: 'not Alausa, Opebi, Oregun, or the Airport Road axis', range: [13000000, 30400000] },
  Kosofe: { label: 'Ogudu (GRA)', hint: 'not Ojota, Ketu, or Mile 12', range: [2600000, 10870000] },
};

export function getEstimatedAnnualRent(
  state: string,
  lga: string,
  bedrooms: Bedrooms,
  etiOsaArea: string,
  premiumPocket: boolean
): [number, number] {
  let range: [number, number];
  if (state === 'Lagos' && lga === 'Eti Osa' && etiOsaArea && ETI_OSA_SUB_AREA_RENT[etiOsaArea]) {
    range = ETI_OSA_SUB_AREA_RENT[etiOsaArea];
  } else if (state === 'Lagos' && premiumPocket && LAGOS_PREMIUM_POCKET[lga]) {
    range = LAGOS_PREMIUM_POCKET[lga].range;
  } else if (state === 'Lagos' && lga && LAGOS_LGA_ANNUAL_RENT[lga]) {
    range = LAGOS_LGA_ANNUAL_RENT[lga];
  } else if (state === 'Lagos') {
    range = [700000, 3000000]; // Lagos picked, LGA not yet - wide citywide range
  } else {
    const tier = STATE_RENT_TIER[state] || 'other';
    range = RENT_TIER_ANNUAL[tier];
  }
  const m = BEDROOM_RENT_MULTIPLIER[bedrooms];
  if (!m) return range;
  return [Math.round(range[0] * m), Math.round(range[1] * m)];
}

export function parseNum(v: string | number | undefined | null): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

export type YearlyCostSummary = {
  rent: number;
  upkeepMonthly: number;
  upkeepYearly: number;
  numKids: number;
  schoolFeePerTerm: number;
  schoolFeesYearly: number;
  total: number;
};

// Mirrors the original's updateYearlyResponsibilitiesSummary() maths (rent + 12x upkeep + 3 terms x
// per-child school fee), just as a pure function instead of one that also writes to the DOM.
export function computeYearlyCostSummary(
  annualRent: string | number,
  monthlyUpkeep: string | number,
  schoolFeePerTerm: string | number,
  numKids: number
): YearlyCostSummary {
  const rent = parseNum(annualRent);
  const upkeepMonthly = parseNum(monthlyUpkeep);
  const upkeepYearly = upkeepMonthly * 12;
  const schoolFee = parseNum(schoolFeePerTerm);
  const schoolFeesYearly = schoolFee * 3 * numKids;
  return {
    rent,
    upkeepMonthly,
    upkeepYearly,
    numKids,
    schoolFeePerTerm: schoolFee,
    schoolFeesYearly,
    total: rent + upkeepYearly + schoolFeesYearly,
  };
}
