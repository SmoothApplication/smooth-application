import { notFound } from 'next/navigation';
import StatementCheck from '@/components/checklist/StatementCheck';
import { COUNTRY_CHECKLISTS } from '@/lib/checklist/registry';

// Phase 4e of task #244: generic route for the 7 newly-ported countries' bank statement checks
// (CA/EU/ZA/GH/KE/ET/MA), mirroring ../reasons/page.tsx. UK keeps its own dedicated
// /checklist/uk/statement route (built in Phase 4), which now also renders the shared
// StatementCheck component (see web/app/checklist/uk/statement/page.tsx) so both routes stay in
// sync.
export function generateStaticParams() {
  return Object.keys(COUNTRY_CHECKLISTS).map((code) => ({ country: code.toLowerCase() }));
}

export default function CountryStatementCheckPage({ params }: { params: { country: string } }) {
  const data = COUNTRY_CHECKLISTS[params.country.toUpperCase()];
  if (!data) notFound();

  // Only a plain string passed as a prop — see the comment in ../page.tsx and lib/checklist/all.ts.
  return <StatementCheck countryCode={data.code} />;
}
