import CountryChecklistApp from '@/components/checklist/CountryChecklistApp';

// Phase 4b of task #244: refactored to use the shared CountryChecklistApp component (see
// components/checklist/CountryChecklistApp.tsx) instead of its own copy of the profile+checklist
// UI, so the UK checklist and the 7 newly-ported countries' checklists (/checklist/[country])
// stay in sync rather than drifting apart. Behavior/storage keys are unchanged from Phase 2/3 —
// still sa_uk_answers / sa_uk_checked, still links to /checklist/uk/financial.
//
// This page stays a Server Component (no 'use client') and passes CountryChecklistApp only plain
// strings — it does NOT import/pass CHECKLIST_UK itself. CountryChecklistApp looks that data up
// internally by `code`. See lib/checklist/all.ts for why: passing a ChecklistItem[] (its
// `appliesIf` fields are functions) as a prop across the Server→Client boundary broke the
// production build (Vercel: "Static page generation for /checklist/uk is still timing out").
export default function UKChecklistPage() {
  return (
    <CountryChecklistApp
      code="UK"
      flag="🇬🇧"
      name="United Kingdom"
      visaName="Standard Visitor visa"
      changeCountryHref="/checklist/start"
      reasonsHref="/checklist/uk/reasons"
      financialHref="/checklist/uk/financial"
      statementHref="/checklist/uk/statement"
      passportHref="/checklist/uk/passport"
    />
  );
}
