import { notFound } from 'next/navigation';
import SituationGate from '@/components/checklist/SituationGate';
import { COUNTRY_CHECKLISTS } from '@/lib/checklist/registry';

// Generic route for the 7 non-UK ready countries (CA/EU/ZA/GH/KE/ET/MA) — see
// web/app/checklist/uk/situation/page.tsx for UK's own dedicated route, same split as every other
// per-country sub-route in this app (financial/statement/passport/reasons).
export function generateStaticParams() {
  return Object.keys(COUNTRY_CHECKLISTS).map((code) => ({ country: code.toLowerCase() }));
}

// GH/KE/MA are visa-free "travel readiness" countries (see lib/checklist/countries.ts's
// visaName field) — index.html's destName() calls this a "trip" rather than an "application" in
// the situation gate's contact messages.
const TRAVEL_READINESS_CODES = ['GH', 'KE', 'MA'];

export default function CountrySituationPage({ params }: { params: { country: string } }) {
  const data = COUNTRY_CHECKLISTS[params.country.toUpperCase()];
  if (!data) notFound();

  return (
    <SituationGate
      name={data.name}
      isTravelReadiness={TRAVEL_READINESS_CODES.includes(data.code)}
      checklistHref={`/checklist/${params.country}`}
      statementHref={`/checklist/${params.country}/statement`}
      passportHref={`/checklist/${params.country}/passport`}
    />
  );
}
