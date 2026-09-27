import { notFound } from 'next/navigation';
import ChecklistCategorySession from '@/components/checklist/ChecklistCategorySession';
import { COUNTRY_CHECKLISTS } from '@/lib/checklist/registry';

// Task #383 ("start with the document-checklist split"): one route per document-checklist
// category for the 7 non-UK ready countries (CA/EU/ZA/GH/KE/ET/MA), mirroring
// ../../uk/checklist/[catIndex]/page.tsx. Each country's own CAT_ORDER_<CODE> can be a different
// length with different category names (see lib/checklist/registry.ts), so this enumerates
// country x catIndex combinations directly from each country's own catOrder rather than assuming
// UK's shape.
export function generateStaticParams() {
  return Object.values(COUNTRY_CHECKLISTS).flatMap((data) =>
    data.catOrder.map((_, i) => ({ country: data.code.toLowerCase(), catIndex: String(i) }))
  );
}

export default function CountryChecklistCategoryPage({
  params,
}: {
  params: { country: string; catIndex: string };
}) {
  const data = COUNTRY_CHECKLISTS[params.country.toUpperCase()];
  if (!data) notFound();

  const catIndex = Number(params.catIndex);
  if (!Number.isInteger(catIndex) || catIndex < 0 || catIndex >= data.catOrder.length) {
    notFound();
  }

  // Only plain strings/numbers passed as props — see the comment in ../../page.tsx and
  // lib/checklist/all.ts.
  return <ChecklistCategorySession code={data.code} catIndex={catIndex} />;
}
