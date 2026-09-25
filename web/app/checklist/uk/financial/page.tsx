import FinancialCalculator from '@/components/checklist/FinancialCalculator';

// Phase 4e of task #244: refactored to use the shared FinancialCalculator component (see
// components/checklist/FinancialCalculator.tsx) instead of its own copy of the calculator UI, so
// the UK financial calculator and the 7 newly-ported countries' calculators
// (/checklist/[country]/financial) stay in sync rather than drifting apart. Storage key is
// unchanged from Phase 3 — still sa_uk_financial.
export default function UKFinancialCalculatorPage() {
  return <FinancialCalculator countryCode="UK" />;
}
