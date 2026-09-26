import { notFound } from 'next/navigation';
import TravelHistory from '@/components/checklist/TravelHistory';
import { COUNTRY_CHECKLISTS } from '@/lib/checklist/registry';

// Generic route for the 7 non-UK ready countries (CA/EU/ZA/GH/KE/ET/MA) — see
// web/app/checklist/uk/travel-history/page.tsx for UK's own dedicated route, same split as every
// other per-country sub-route in this app (financial/statement/passport/situation/business-income).
export function generateStaticParams() {
  return Object.keys(COUNTRY_CHECKLISTS).map((code) => ({ country: code.toLowerCase() }));
}

export default function CountryTravelHistoryPage({ params }: { params: { country: string } }) {
  const data = COUNTRY_CHECKLISTS[params.country.toUpperCase()];
  if (!data) notFound();

  return <TravelHistory countryCode={data.code} />;
}
