import { notFound } from 'next/navigation';
import CountryChecklistApp from '@/components/checklist/CountryChecklistApp';
import { COUNTRY_CHECKLISTS } from '@/lib/checklist/registry';

// Phase 4b of task #244: generic route for the 7 newly-ported countries (CA/EU/ZA/GH/KE/ET/MA).
// UK keeps its own dedicated /checklist/uk route (built in Phase 2) rather than moving here.
export function generateStaticParams() {
  return Object.keys(COUNTRY_CHECKLISTS).map((code) => ({ country: code.toLowerCase() }));
}

export default function CountryChecklistPage({ params }: { params: { country: string } }) {
  const data = COUNTRY_CHECKLISTS[params.country.toUpperCase()];
  if (!data) notFound();

  const visaNameByCode: Record<string, string> = {
    CA: 'Visitor visa',
    EU: 'Short-stay visa',
    ZA: 'Visitor visa',
    GH: 'travel readiness',
    KE: 'travel readiness',
    ET: 'Tourist e-Visa',
    MA: 'travel readiness',
  };

  // Only plain strings passed as props below — CountryChecklistApp looks up its own checklist
  // data internally by `code` (see lib/checklist/all.ts). Passing data.checklist itself here
  // (an array containing appliesIf functions) is what broke the production build previously.
  return (
    <CountryChecklistApp
      code={data.code}
      flag={data.flag}
      name={data.name}
      visaName={visaNameByCode[data.code] ?? 'checklist'}
      changeCountryHref="/checklist/start"
      reasonsHref={`/checklist/${params.country}/reasons`}
      financialHref={`/checklist/${params.country}/financial`}
      statementHref={`/checklist/${params.country}/statement`}
      passportHref={`/checklist/${params.country}/passport`}
      trackerHref="/tracker"
    />
  );
}
