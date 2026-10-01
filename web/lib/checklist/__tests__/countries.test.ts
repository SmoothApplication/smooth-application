// Direct user feedback (screenshot of GH's situation gate): "once you click Ghana, you do not
// need this page." isTravelReadinessCountry is the single source of truth that now drives both
// app/checklist/start/page.tsx (skip the situation gate when picking GH/KE/MA) and
// app/checklist/[country]/situation/page.tsx (redirect away from it as a safety net) — see that
// function's own comment in ../countries.ts for the full rationale.
import { isTravelReadinessCountry, TRAVEL_READINESS_CODES, COUNTRIES } from '../countries';

describe('isTravelReadinessCountry', () => {
  test('GH, KE, MA are travel-readiness (visa-free) countries', () => {
    expect(isTravelReadinessCountry('GH')).toBe(true);
    expect(isTravelReadinessCountry('KE')).toBe(true);
    expect(isTravelReadinessCountry('MA')).toBe(true);
  });

  test('is case-insensitive', () => {
    expect(isTravelReadinessCountry('gh')).toBe(true);
  });

  test('UK, CA, EU, ZA, ET have a real visa/e-Visa application and are NOT travel-readiness', () => {
    expect(isTravelReadinessCountry('UK')).toBe(false);
    expect(isTravelReadinessCountry('CA')).toBe(false);
    expect(isTravelReadinessCountry('EU')).toBe(false);
    expect(isTravelReadinessCountry('ZA')).toBe(false);
    expect(isTravelReadinessCountry('ET')).toBe(false);
  });

  test('TRAVEL_READINESS_CODES matches exactly the 3 countries whose own visaName says "Travel readiness"', () => {
    const byVisaName = COUNTRIES.filter((c) => c.visaName.toLowerCase().includes('travel readiness')).map((c) => c.code);
    expect(new Set(byVisaName)).toEqual(new Set(TRAVEL_READINESS_CODES));
  });
});
