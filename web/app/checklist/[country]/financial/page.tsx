import { notFound } from 'next/navigation';
import FinancialCalculator from '@/components/checklist/FinancialCalculator';
import { COUNTRY_CHECKLISTS } from '@/lib/checklist/registry';

// Phase 4e of task #244: generic route for the 7 newly-ported countries' financial readiness
// calculators (CA/EU/ZA/GH/KE/ET/MA), mirroring ../reasons/page.tsx. UK keeps its own dedicated
// /checklist/uk/financial route (built in Phase 3), which now also renders the shared
// FinancialCalculator component (see web/app/checklist/uk/financial/page.tsx) so both routes stay
// in sync.
export function generateStaticParams() {
  return Object.keys(COUNTRY_CHECKLISTS).map((code) => ({ country: code.toLowerCase() }));
}

export default function CountryFinancialCalculatorPage({ params }: { params: { country: string } }) {
  const data = COUNTRY_CHECKLISTS[params.country.toUpperCase()];
  if (!data) notFound();

  // Only a plain string passed as a prop — see the comment in ../page.tsx and lib/checklist/all.ts.
  return <FinancialCalculator countryCode={data.code} />;
}
