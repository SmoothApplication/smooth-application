import ResponsibilitiesSession from '@/components/checklist/ResponsibilitiesSession';

// Task #382 ("split qualifying-questions form into Sessions 3 and 4"): real Session 3, matching
// ../passport/page.tsx's pattern (thin Server Component wrapper, real work in the Client Component).
export default function UKResponsibilitiesPage() {
  return <ResponsibilitiesSession code="UK" />;
}
