import { notFound } from 'next/navigation';
import TripDetailsSession from '@/components/checklist/TripDetailsSession';
import { COUNTRY_CHECKLISTS } from '@/lib/checklist/registry';

// Task #382 ("split qualifying-questions form into Sessions 3 and 4"): generic route for the 7
// non-UK ready countries, mirroring ../passport/page.tsx.
export function generateStaticParams() {
  return Object.keys(COUNTRY_CHECKLISTS).map((code) => ({ country: code.toLowerCase() }));
}

export default function CountryTripDetailsPage({ params }: { params: { country: string } }) {
  const data = COUNTRY_CHECKLISTS[params.country.toUpperCase()];
  if (!data) notFound();
  return <TripDetailsSession code={data.code} />;
}
