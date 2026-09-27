import { notFound } from 'next/navigation';
import ChecklistCategorySession from '@/components/checklist/ChecklistCategorySession';
import { ALL_CHECKLISTS } from '@/lib/checklist/all';

// Task #383 ("start with the document-checklist split"): one route per UK document-checklist
// category (CAT_ORDER_UK), matching the real sessions 8-13 of the original — see
// lib/checklist/sessions.ts's header comment for the full session order this slots into.
export function generateStaticParams() {
  const catOrder = ALL_CHECKLISTS.UK?.catOrder ?? [];
  return catOrder.map((_, i) => ({ catIndex: String(i) }));
}

export default function UKChecklistCategoryPage({ params }: { params: { catIndex: string } }) {
  const catIndex = Number(params.catIndex);
  if (!Number.isInteger(catIndex) || catIndex < 0 || catIndex >= (ALL_CHECKLISTS.UK?.catOrder.length ?? 0)) {
    notFound();
  }
  return <ChecklistCategorySession code="UK" catIndex={catIndex} />;
}
