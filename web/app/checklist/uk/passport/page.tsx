import PassportCheck from '@/components/checklist/PassportCheck';

// Phase 4e of task #244: refactored to use the shared PassportCheck component (see
// components/checklist/PassportCheck.tsx) instead of its own copy of the passport-scan checklist
// page, so the UK passport scan and the 7 newly-ported countries' scans
// (/checklist/[country]/passport) stay in sync rather than drifting apart. Storage key is
// unchanged from the passport-MRZ port's Phase 3 — still sa_uk_passport.
export default function UKPassportScanPage() {
  return <PassportCheck countryCode="UK" />;
}
