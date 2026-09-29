import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CountryChecklistApp from '@/components/checklist/CountryChecklistApp';
import { COUNTRY_CHECKLISTS } from '@/lib/checklist/registry';
import { COUNTRY_SEO } from '@/lib/checklist/seo';

// Phase 4b of task #244: generic route for the 7 newly-ported countries (CA/EU/ZA/GH/KE/ET/MA).
// UK keeps its own dedicated /checklist/uk route (built in Phase 2) rather than moving here.
export function generateStaticParams() {
  return Object.keys(COUNTRY_CHECKLISTS).map((code) => ({ country: code.toLowerCase() }));
}

// Follow-up to "create SEO for this website" (#456/#457): without this, all 7 of these routes
// inherited the root layout's UK-led metadata verbatim, so a search for "Ghana travel checklist
// Nigeria" or "Schengen visa checklist" saw the same UK-branded title/snippet as the UK page. See
// lib/checklist/seo.ts for the per-country copy (kept accurate to each country's own visa/travel-
// document type, same names used in visaNameByCode below).
export function generateMetadata({ params }: { params: { country: string } }): Metadata {
  const copy = COUNTRY_SEO[params.country.toUpperCase()];
  if (!copy) return {};
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: `/checklist/${params.country.toLowerCase()}` },
    openGraph: { title: copy.title, description: copy.description },
    twitter: { title: copy.title, description: copy.description },
  };
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
