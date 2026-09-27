import { notFound } from 'next/navigation';
import FinalReviewSession from '@/components/checklist/FinalReviewSession';
import { COUNTRY_CHECKLISTS } from '@/lib/checklist/registry';

// Task #386 (Final review/declaration session, session 13): generic route for the 7 non-UK ready
// countries, mirroring ../passport/page.tsx.
export function generateStaticParams() {
  return Object.keys(COUNTRY_CHECKLISTS).map((code) => ({ country: code.toLowerCase() }));
}

export default function CountryFinalReviewPage({ params }: { params: { country: string } }) {
  const data = COUNTRY_CHECKLISTS[params.country.toUpperCase()];
  if (!data) notFound();
  return <FinalReviewSession code={data.code} />;
}
