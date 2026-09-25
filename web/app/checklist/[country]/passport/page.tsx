import { notFound } from 'next/navigation';
import PassportCheck from '@/components/checklist/PassportCheck';
import { COUNTRY_CHECKLISTS } from '@/lib/checklist/registry';

// Phase 4e of task #244: generic route for the 7 newly-ported countries' passport scans
// (CA/EU/ZA/GH/KE/ET/MA), mirroring ../reasons/page.tsx. UK keeps its own dedicated
// /checklist/uk/passport route (built during the passport-MRZ port's Phase 3), which now also
// renders the shared PassportCheck component (see web/app/checklist/uk/passport/page.tsx) so both
// routes stay in sync.
export function generateStaticParams() {
  return Object.keys(COUNTRY_CHECKLISTS).map((code) => ({ country: code.toLowerCase() }));
}

export default function CountryPassportScanPage({ params }: { params: { country: string } }) {
  const data = COUNTRY_CHECKLISTS[params.country.toUpperCase()];
  if (!data) notFound();

  // Only a plain string passed as a prop — see the comment in ../page.tsx and lib/checklist/all.ts.
  return <PassportCheck countryCode={data.code} />;
}
