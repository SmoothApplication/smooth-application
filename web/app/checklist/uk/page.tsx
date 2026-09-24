import CountryChecklistApp from '@/components/checklist/CountryChecklistApp';
import { CAT_ORDER_UK, CHECKLIST_UK } from '@/lib/checklist/uk';

// Phase 4b of task #244: refactored to use the shared CountryChecklistApp component (see
// components/checklist/CountryChecklistApp.tsx) instead of its own copy of the profile+checklist
// UI, so the UK checklist and the 7 newly-ported countries' checklists (/checklist/[country])
// stay in sync rather than drifting apart. Behavior/storage keys are unchanged from Phase 2/3 —
// still sa_uk_answers / sa_uk_checked, still links to /checklist/uk/financial.
export default function UKChecklistPage() {
  return (
    <CountryChecklistApp
      code="UK"
      flag="🇬🇧"
      name="United Kingdom"
      visaName="Standard Visitor visa"
      catOrder={CAT_ORDER_UK}
      checklist={CHECKLIST_UK}
      changeCountryHref="/checklist/start"
      reasonsHref="/checklist/uk/reasons"
      financialHref="/checklist/uk/financial"
    />
  );
}
